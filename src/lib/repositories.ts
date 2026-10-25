import "server-only";
import path from "node:path";
import { getPrisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  getBlob,
  getNewCommits,
  getRepository,
  getSnapshot,
  parseGitHubUrl,
} from "@/lib/github";
import { languageForPath, parseCode } from "@/lib/parsers";
import { classifyStaleness } from "@/lib/staleness";
import { mapLimit } from "@/lib/concurrency";
import { getConfiguration, requireEnv } from "@/lib/env";
import { deleteRepositoryVectors } from "@/lib/qdrant";

export async function deleteRepository(repoId: string) {
  const db = getPrisma();
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Repository" WHERE id = ${repoId} FOR UPDATE`;
      const repo = await tx.repository.findUnique({ where: { id: repoId } });
      if (!repo) throw new AppError("Repository not found.", 404);
      if (repo.status === "SYNCING")
        throw new AppError(
          "Wait for this repository to finish syncing before removing it.",
          409,
        );
      // Indexing also locks its code-unit row. Wait for in-flight writes before
      // removing vectors, so an older indexing request cannot recreate an orphan.
      await tx.$queryRaw`SELECT u.id FROM "CodeUnit" u JOIN "File" f ON f.id = u."fileId" WHERE f."repoId" = ${repoId} ORDER BY u.id FOR UPDATE OF u`;
      const indexed = await tx.documentation.count({
        where: { codeUnit: { file: { repoId } }, indexedAt: { not: null } },
      });
      if (indexed) requireEnv("QDRANT_URL", "QDRANT_API_KEY");
      if (getConfiguration().vectorStore) await deleteRepositoryVectors(repoId);
      await tx.repository.delete({ where: { id: repoId } });
    },
    { timeout: 90_000 },
  );
  return { deleted: true };
}

export async function ingestRepository(repoUrl: string, branch?: string) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new AppError("Invalid GitHub repository URL.");
  const metadata = await getRepository(parsed.owner, parsed.name);
  const trackedBranch = branch ?? metadata.default_branch;
  const db = getPrisma();
  const repo = await db.repository.upsert({
    where: { owner_name_trackedBranch: { ...parsed, trackedBranch } },
    create: {
      ...parsed,
      url: `https://github.com/${parsed.owner}/${parsed.name}`,
      defaultBranch: metadata.default_branch,
      trackedBranch,
    },
    update: { defaultBranch: metadata.default_branch },
  });
  return { repoId: repo.id, ...(await syncRepository(repo.id)) };
}

export async function syncRepository(repoId: string) {
  const db = getPrisma();
  const repo = await db.repository.findUnique({ where: { id: repoId } });
  if (!repo) throw new AppError("Repository not found.", 404);
  const lease = new Date();
  const claimed = await db.repository.updateMany({
    where: {
      id: repoId,
      OR: [
        { status: { not: "SYNCING" } },
        { syncStartedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      ],
    },
    data: { status: "SYNCING", syncStartedAt: lease, syncError: null },
  });
  if (!claimed.count)
    throw new AppError("This repository is already syncing. Please wait.", 409);
  try {
    const snapshot = await getSnapshot(
      repo.owner,
      repo.name,
      repo.trackedBranch,
    );
    const existingFiles = await db.file.findMany({
      where: { repoId },
      include: {
        codeUnits: {
          include: {
            documentation: {
              where: { status: "PUBLISHED" },
              orderBy: { version: "desc" },
              take: 1,
            },
            stalenessFlag: true,
          },
        },
      },
    });
    const byPath = new Map(existingFiles.map((file) => [file.path, file]));
    const changedFiles = snapshot.files.filter(
      (file) =>
        byPath.get(file.path)?.sha !== file.sha ||
        byPath.get(file.path)?.deletedAt,
    );
    const removedFiles = existingFiles.filter(
      (file) =>
        !file.deletedAt &&
        !snapshot.files.some((entry) => entry.path === file.path),
    );
    const changedDirectories = new Set(
      [...changedFiles, ...removedFiles].map((file) =>
        path.posix.dirname(file.path),
      ),
    );
    const parsed = await mapLimit(changedFiles, 4, async (file) => {
      const content = await getBlob(repo.owner, repo.name, file.sha);
      try {
        return { file, units: parseCode(content, file.path) };
      } catch {
        throw new AppError(
          `Could not parse ${file.path}. The sync was not applied; fix the syntax and retry.`,
          422,
        );
      }
    });
    const commits = await getNewCommits(
      repo.owner,
      repo.name,
      repo.lastSyncedSha,
      snapshot.head,
    );
    let unitCount = 0;
    await db.$transaction(
      async (tx) => {
        const owned = await tx.repository.updateMany({
          where: { id: repoId, status: "SYNCING", syncStartedAt: lease },
          data: { updatedAt: new Date() },
        });
        if (!owned.count)
          throw new AppError("Sync lease expired. Please retry.", 409);
        const saveFlag = async (
          codeUnitId: string,
          current: { signatureHash: string; bodyHash: string } | null,
          published:
            { sourceSignatureHash: string; sourceBodyHash: string } | undefined,
          related = false,
        ) => {
          const flag = classifyStaleness(
            current,
            published
              ? {
                  signatureHash: published.sourceSignatureHash,
                  bodyHash: published.sourceBodyHash,
                }
              : null,
            related,
          );
          await tx.stalenessFlag.upsert({
            where: { codeUnitId },
            create: { codeUnitId, ...flag, commitSha: snapshot.head.sha },
            update: { ...flag, commitSha: snapshot.head.sha },
          });
        };
        for (const { file, units } of parsed) {
          const stored = await tx.file.upsert({
            where: { repoId_path: { repoId, path: file.path } },
            create: {
              repoId,
              path: file.path,
              sha: file.sha,
              language: languageForPath(file.path),
            },
            update: {
              sha: file.sha,
              language: languageForPath(file.path),
              deletedAt: null,
            },
          });
          const oldUnits = new Map(
            (byPath.get(file.path)?.codeUnits ?? []).map((unit) => [
              unit.key,
              unit,
            ]),
          );
          const keys = new Set(units.map((unit) => unit.key));
          for (const unit of units) {
            const storedUnit = await tx.codeUnit.upsert({
              where: { fileId_key: { fileId: stored.id, key: unit.key } },
              create: { ...unit, fileId: stored.id },
              update: { ...unit, deletedAt: null },
            });
            await saveFlag(
              storedUnit.id,
              unit,
              oldUnits.get(unit.key)?.documentation[0],
            );
            unitCount++;
          }
          for (const oldUnit of oldUnits.values()) {
            if (keys.has(oldUnit.key) || oldUnit.deletedAt) continue;
            await tx.codeUnit.update({
              where: { id: oldUnit.id },
              data: { deletedAt: new Date() },
            });
            await saveFlag(oldUnit.id, null, oldUnit.documentation[0]);
          }
        }
        for (const file of removedFiles) {
          await tx.file.update({
            where: { id: file.id },
            data: { deletedAt: new Date() },
          });
          for (const unit of file.codeUnits) {
            await tx.codeUnit.update({
              where: { id: unit.id },
              data: { deletedAt: new Date() },
            });
            await saveFlag(unit.id, null, unit.documentation[0]);
          }
        }
        for (const file of existingFiles) {
          if (
            file.deletedAt ||
            changedFiles.some((entry) => entry.path === file.path) ||
            removedFiles.some((entry) => entry.id === file.id)
          )
            continue;
          if (!changedDirectories.has(path.posix.dirname(file.path))) continue;
          for (const unit of file.codeUnits)
            if (!unit.deletedAt)
              await saveFlag(unit.id, unit, unit.documentation[0], true);
        }
        for (const commit of commits) {
          const author = commit.commit.author ?? commit.commit.committer;
          await tx.commit.upsert({
            where: { repoId_sha: { repoId, sha: commit.sha } },
            create: {
              repoId,
              sha: commit.sha,
              message: commit.commit.message,
              author: author?.name ?? "Unknown",
              date: new Date(author?.date ?? Date.now()),
            },
            update: {},
          });
        }
        await tx.repository.update({
          where: { id: repoId },
          data: {
            lastSyncedSha: snapshot.head.sha,
            lastSyncedAt: new Date(),
            status: "READY",
            syncStartedAt: null,
            syncError: null,
          },
        });
      },
      { timeout: 120_000 },
    );
    return {
      sha: snapshot.head.sha,
      files: snapshot.files.length,
      changedFiles: changedFiles.length,
      removedFiles: removedFiles.length,
      parsedUnits: unitCount,
      commits: commits.length,
    };
  } catch (error) {
    await db.repository.updateMany({
      where: { id: repoId, syncStartedAt: lease },
      data: {
        status: "ERROR",
        syncStartedAt: null,
        syncError:
          error instanceof AppError
            ? error.message
            : "Sync failed. Check connectivity and retry.",
      },
    });
    throw error;
  }
}

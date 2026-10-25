import Link from "next/link";
import { ArrowRight, FileCode2 } from "lucide-react";
import {
  PageHeading,
  SetupNotice,
  EmptyState,
  StalenessBadge,
} from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RepositoryFilter } from "@/components/repository-filter";
import { readWorkspace, repoSelect } from "@/lib/data";
import { filtersSchema, type SearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";
export default async function DocsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const parsed = filtersSchema.safeParse(await searchParams);
  const filters = parsed.success ? parsed.data : { page: 1 };
  const { repoId, q, status, page } = filters;
  const { data, error } = await readWorkspace(async (db) => {
    const where = {
      file: { repoId },
      ...(status ? { stalenessFlag: { status } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              {
                file: {
                  path: { contains: q, mode: "insensitive" as const },
                  repoId,
                },
              },
            ],
          }
        : {}),
    };
    const [repos, count, units] = await Promise.all([
      db.repository.findMany({ select: repoSelect, orderBy: { name: "asc" } }),
      db.codeUnit.count({ where }),
      db.codeUnit.findMany({
        where,
        include: {
          file: { include: { repo: { select: repoSelect } } },
          stalenessFlag: true,
          documentation: {
            where: { status: "PUBLISHED" },
            orderBy: { version: "desc" },
            take: 1,
          },
        },
        orderBy: [{ file: { path: "asc" } }, { startLine: "asc" }],
        take: 30,
        skip: (page - 1) * 30,
      }),
    ]);
    return { repos, count, units };
  });
  function pageUrl(next: number) {
    const params = new URLSearchParams({
      ...(repoId ? { repoId } : {}),
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      page: String(next),
    });
    return `/docs?${params}`;
  }
  return (
    <>
      <PageHeading
        eyebrow="Knowledge base"
        title="Your code, documented."
        description="Browse the building blocks of your codebase. Every document stays connected to its source."
      />
      <SetupNotice
        message={
          error ??
          (!parsed.success
            ? "Some filters were invalid and have been reset."
            : null)
        }
      />
      <RepositoryFilter
        repos={data?.repos ?? []}
        action="/docs"
        repoId={repoId}
        query={q}
        status={status}
        search
      />
      <div className="mb-4 flex justify-between text-xs text-muted-foreground">
        <span>{data?.count ?? 0} code units</span>
        <span>Published versions & current source</span>
      </div>
      {data?.units.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.units.map((unit) => {
            const doc = unit.documentation[0];
            return (
              <Link
                key={unit.id}
                href={`/docs/${unit.id}`}
                className="group min-w-0"
              >
                <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-violet-400/35">
                  <div className="mb-5 flex items-start justify-between gap-2">
                    <span className="rounded-lg border border-border bg-secondary p-2">
                      <FileCode2
                        className="size-4 text-violet-300"
                        aria-hidden="true"
                      />
                    </span>
                    <Badge>{unit.type.toLowerCase()}</Badge>
                  </div>
                  <h2 className="break-all font-mono text-sm font-semibold group-hover:text-violet-300">
                    {unit.name}
                  </h2>
                  <p
                    className="mt-2 truncate text-[11px] text-muted-foreground"
                    title={unit.file.path}
                  >
                    {unit.file.path}:{unit.startLine}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {unit.file.repo.owner}/{unit.file.repo.name}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    {doc ? (
                      <StalenessBadge
                        status={unit.stalenessFlag?.status ?? "OK"}
                      />
                    ) : (
                      <Badge className="text-muted-foreground">
                        Not documented
                      </Badge>
                    )}
                    {unit.deletedAt && (
                      <Badge className="text-red-300">Removed</Badge>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {doc ? `v${doc.version}` : unit.file.language}
                    </span>
                    <ArrowRight
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={
            q || status
              ? "No matching code units"
              : "A knowledge base starts with code"
          }
          description={
            q || status
              ? "Try another name, repository, or documentation health filter."
              : "Connect a repository, then generate documentation from the overview page."
          }
          href="/"
          linkLabel="Connect a repository"
        />
      )}
      {data && data.count > 30 && (
        <div className="mt-7 flex items-center justify-between">
          <Button asChild variant="secondary" disabled={page <= 1}>
            <Link href={pageUrl(Math.max(1, page - 1))}>Previous</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {Math.ceil(data.count / 30)}
          </span>
          <Button
            asChild
            variant="secondary"
            disabled={page * 30 >= data.count}
          >
            <Link href={pageUrl(page + 1)}>Next</Link>
          </Button>
        </div>
      )}
    </>
  );
}

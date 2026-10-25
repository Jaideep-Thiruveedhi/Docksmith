import Link from "next/link";
import { ArrowUpRight, GitCommitHorizontal, GitBranch } from "lucide-react";
import {
  PageHeading,
  EmptyState,
  SetupNotice,
  StalenessBadge,
} from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/action-button";
import { RepositoryFilter } from "@/components/repository-filter";
import { readWorkspace, repoSelect } from "@/lib/data";
import { filtersSchema, type SearchParams } from "@/lib/filters";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function ChangesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const parsed = filtersSchema.safeParse(await searchParams);
  const repoId = parsed.success ? parsed.data.repoId : undefined;
  const { data, error } = await readWorkspace(async (db) => {
    const [repos, flags, commits] = await Promise.all([
      db.repository.findMany({ select: repoSelect, orderBy: { name: "asc" } }),
      db.stalenessFlag.findMany({
        where: { status: { not: "OK" }, codeUnit: { file: { repoId } } },
        include: {
          codeUnit: { include: { file: { include: { repo: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      db.commit.findMany({
        where: { repoId },
        include: { repo: true },
        orderBy: { date: "desc" },
        take: 50,
      }),
    ]);
    return { repos, flags, commits };
  });
  return (
    <>
      <PageHeading
        eyebrow="Code in motion"
        title="Stay ahead of the drift."
        description="Track commits and see where published documentation may no longer reflect the code."
        action={
          repoId ? (
            <ActionButton
              endpoint={`/api/repos/${repoId}/sync`}
              label="Check for updates"
              busyLabel="Syncing…"
              successMessage="Repository is synced."
              variant="default"
            />
          ) : undefined
        }
      />
      <SetupNotice message={error} />
      <RepositoryFilter
        repos={data?.repos ?? []}
        action="/changes"
        repoId={repoId}
      />
      <div className="grid items-start gap-7 lg:grid-cols-[1.25fr_1fr]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Documentation health</h2>
            <Badge>{data?.flags.length ?? 0} to review</Badge>
          </div>
          {data?.flags.length ? (
            <div className="space-y-3">
              {data.flags.map((flag) => (
                <Card key={flag.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link
                      href={`/docs/${flag.codeUnitId}`}
                      className="break-all font-mono text-sm font-semibold hover:text-violet-300"
                    >
                      {flag.codeUnit.name}
                    </Link>
                    <StalenessBadge status={flag.status} />
                  </div>
                  <p className="mt-2 break-all text-[11px] text-muted-foreground">
                    {flag.codeUnit.file.repo.owner}/
                    {flag.codeUnit.file.repo.name} · {flag.codeUnit.file.path}
                  </p>
                  <p className="mt-4 text-xs leading-6 text-muted-foreground">
                    {flag.reason}
                  </p>
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    {!flag.codeUnit.deletedAt && (
                      <ActionButton
                        endpoint="/api/update-draft"
                        body={{ codeUnitId: flag.codeUnitId }}
                        label="Draft an update"
                        busyLabel="Writing draft…"
                        successMessage="Draft ready. Open the document to review."
                      />
                    )}
                    <Link
                      href={`/docs/${flag.codeUnitId}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-violet-300"
                    >
                      View document
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Everything is in sync"
              description="No outstanding staleness flags. Sync a connected repository to check for new changes."
            />
          )}
        </section>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent commits</h2>
            <GitBranch
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          {data?.commits.length ? (
            <Card className="divide-y divide-border">
              {data.commits.map((commit) => (
                <div key={commit.id} className="flex gap-3 p-5">
                  <GitCommitHorizontal
                    className="mt-1 size-4 shrink-0 text-violet-300"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <a
                      href={`${commit.repo.url}/commit/${commit.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 text-sm font-medium hover:text-violet-300"
                    >
                      {commit.message.split("\n")[0]}
                    </a>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {commit.repo.owner}/{commit.repo.name}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      <span className="mr-2 font-mono text-violet-300/80">
                        {commit.sha.slice(0, 7)}
                      </span>
                      {commit.author} · {formatDate(commit.date)} UTC
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyState
              title="No commits tracked yet"
              description="Repository ingestion records its latest commit. Later syncs track new commits automatically."
            />
          )}
        </section>
      </div>
    </>
  );
}

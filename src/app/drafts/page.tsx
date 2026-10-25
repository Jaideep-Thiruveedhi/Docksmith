import Link from "next/link";
import { ArrowRight, Clock3, PenLine } from "lucide-react";
import {
  PageHeading,
  EmptyState,
  SetupNotice,
  StalenessBadge,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RepositoryFilter } from "@/components/repository-filter";
import { readWorkspace, repoSelect } from "@/lib/data";
import { filtersSchema, type SearchParams } from "@/lib/filters";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function DraftsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const parsed = filtersSchema.safeParse(await searchParams);
  const { repoId, page } = parsed.success
    ? parsed.data
    : { repoId: undefined, page: 1 };
  const { data, error } = await readWorkspace(async (db) => {
    const where = {
      status: "DRAFT" as const,
      supersededAt: null,
      codeUnit: { file: { repoId } },
    };
    const [repos, count, drafts] = await Promise.all([
      db.repository.findMany({ select: repoSelect, orderBy: { name: "asc" } }),
      db.documentation.count({ where }),
      db.documentation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 30,
        skip: (page - 1) * 30,
        include: {
          codeUnit: {
            include: { file: { include: { repo: true } }, stalenessFlag: true },
          },
        },
      }),
    ]);
    return { repos, count, drafts };
  });
  const url = (next: number) =>
    `/drafts?${new URLSearchParams({ page: String(next), ...(repoId ? { repoId } : {}) })}`;
  return (
    <>
      <PageHeading
        eyebrow="Human in the loop"
        title="A second pair of eyes."
        description="Review AI-generated updates before they become the source of truth. You decide what gets published."
        action={<Badge>{data?.count ?? 0} awaiting review</Badge>}
      />
      <SetupNotice message={error} />
      <RepositoryFilter
        repos={data?.repos ?? []}
        action="/drafts"
        repoId={repoId}
      />
      {data?.drafts.length ? (
        <div className="space-y-4">
          {data.drafts.map((draft) => (
            <Card
              key={draft.id}
              className="flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 items-start gap-4">
                <span className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
                  <PenLine className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="break-all font-mono text-sm font-semibold">
                      {draft.codeUnit.name}
                    </h2>
                    <Badge>v{draft.version}</Badge>
                    <StalenessBadge
                      status={draft.codeUnit.stalenessFlag?.status ?? "OK"}
                    />
                  </div>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {draft.codeUnit.file.repo.owner}/
                    {draft.codeUnit.file.repo.name} · {draft.codeUnit.file.path}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock3 className="size-3" aria-hidden="true" />
                    Created {formatDate(draft.createdAt)} UTC
                  </p>
                </div>
              </div>
              <Button asChild variant="secondary">
                <Link href={`/docs/${draft.codeUnitId}#review`}>
                  Review update
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your review queue is clear"
          description="When a document needs an update, open it and choose Draft an update. The proposed changes will appear here."
          href="/changes"
          linkLabel="Check documentation health"
        />
      )}
      {data && data.count > 30 && (
        <div className="mt-6 flex justify-between">
          <Button asChild variant="secondary" disabled={page <= 1}>
            <Link href={url(Math.max(1, page - 1))}>Previous</Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            disabled={page * 30 >= data.count}
          >
            <Link href={url(page + 1)}>Next</Link>
          </Button>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ExternalLink, Download, FileCode2 } from "lucide-react";
import { PageHeading, SetupNotice, StalenessBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/action-button";
import { Markdown } from "@/components/markdown";
import { DiffViewer } from "@/components/diff-viewer";
import { readWorkspace } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) notFound();
  const { data: unit, error } = await readWorkspace((db) =>
    db.codeUnit.findUnique({
      where: { id },
      include: {
        file: { include: { repo: true } },
        documentation: { orderBy: { version: "desc" }, take: 100 },
        stalenessFlag: true,
      },
    }),
  );
  if (error) return <SetupNotice message={error} />;
  if (!unit) notFound();
  const published = unit.documentation.find(
    (doc) => doc.status === "PUBLISHED",
  );
  const draft = unit.documentation.find(
    (doc) => doc.status === "DRAFT" && !doc.supersededAt,
  );
  const currentDraft =
    draft &&
    !unit.deletedAt &&
    draft.sourceSignatureHash === unit.signatureHash &&
    draft.sourceBodyHash === unit.bodyHash;
  const sourceUrl = `${unit.file.repo.url}/blob/${encodeURIComponent(unit.file.repo.lastSyncedSha ?? unit.file.repo.trackedBranch)}/${unit.file.path.split("/").map(encodeURIComponent).join("/")}#L${unit.startLine}-L${unit.endLine}`;
  return (
    <>
      <Link
        href={`/docs?repoId=${unit.file.repoId}`}
        className="mb-7 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to documentation
      </Link>
      <PageHeading
        eyebrow={`${unit.file.repo.owner}/${unit.file.repo.name}`}
        title={unit.name}
        description={`${unit.file.path} · lines ${unit.startLine}–${unit.endLine}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge>{unit.type}</Badge>
            <StalenessBadge status={unit.stalenessFlag?.status ?? "OK"} />
            {unit.deletedAt && (
              <Badge className="text-red-300">Removed from source</Badge>
            )}
          </div>
        }
      />
      {unit.stalenessFlag?.reason && (
        <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100/80">
          {unit.stalenessFlag.reason}
        </div>
      )}
      <div className="mb-7 flex flex-wrap items-start gap-3">
        {!unit.deletedAt && (
          <ActionButton
            endpoint={published ? "/api/update-draft" : "/api/generate"}
            body={{ codeUnitId: unit.id }}
            label={published ? "Draft an update" : "Generate documentation"}
            busyLabel="Writing documentation…"
            successMessage={
              published
                ? "Draft is ready for review below."
                : "Documentation published."
            }
            variant="default"
          />
        )}
        {published && (
          <Button asChild size="sm" variant="secondary">
            <a href={`/api/docs/${published.id}/download`}>
              <Download aria-hidden="true" />
              Download Markdown
            </a>
          </Button>
        )}
        {!unit.deletedAt && (
          <Button asChild size="sm" variant="ghost">
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              View source
            </a>
          </Button>
        )}
      </div>
      {draft && (
        <section id="review" className="mb-8 space-y-5 scroll-mt-28">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Review proposed update{" "}
                <span className="ml-2 font-mono text-sm text-violet-300">
                  v{draft.version}
                </span>
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Generated {formatDate(draft.createdAt)} UTC · Published
                documentation stays in place until you approve.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                endpoint="/api/update-draft/approve"
                body={{ documentId: draft.id }}
                label="Approve & publish"
                variant="default"
                disabled={!currentDraft}
                successMessage="Published. Documentation is now up to date."
              />
              <ActionButton
                endpoint="/api/update-draft/reject"
                body={{ documentId: draft.id }}
                label="Dismiss draft"
                successMessage="Draft dismissed."
              />
            </div>
          </div>
          {!currentDraft && (
            <p className="rounded-lg border border-amber-400/20 p-4 text-sm text-amber-200">
              The source changed after this draft was generated. Create a new
              draft to review the current version.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm">
                  Published{" "}
                  {published ? `· v${published.version}` : "· no version yet"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Markdown>
                  {published?.markdown ??
                    "No documentation has been published for this code unit."}
                </Markdown>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-violet-400/25">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm text-violet-300">
                  Proposed · v{draft.version}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Markdown>{draft.markdown}</Markdown>
              </CardContent>
            </Card>
          </div>
          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer text-sm font-medium">
              View Markdown diff
            </summary>
            <div className="mt-5">
              <DiffViewer
                before={published?.markdown ?? ""}
                after={draft.markdown}
              />
            </div>
          </details>
        </section>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_260px]">
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between border-b border-border">
            <CardTitle className="text-sm">Published documentation</CardTitle>
            {published && <Badge>v{published.version}</Badge>}
          </CardHeader>
          <CardContent className="pt-6">
            {published ? (
              <Markdown>{published.markdown}</Markdown>
            ) : (
              <div className="py-10 text-center">
                <FileCode2
                  className="mx-auto mb-3 size-8 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  Generate documentation to explain this code unit.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-4 text-xs font-semibold">Source details</h2>
            <dl className="space-y-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Language</dt>
                <dd className="mt-1">{unit.file.language}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Signature</dt>
                <dd className="mt-1 break-all font-mono text-[11px] leading-5 text-violet-200">
                  {unit.signature}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Index</dt>
                <dd className="mt-1">
                  {published?.indexedAt ? "Ready for chat" : "Not indexed"}
                </dd>
                {published?.indexError && (
                  <dd className="mt-2 text-[11px] leading-5 text-amber-200/80">
                    {published.indexError}
                  </dd>
                )}
              </div>
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-xs font-semibold">Version history</h2>
            <ol className="space-y-4">
              {unit.documentation.map((doc) => (
                <li key={doc.id} className="text-xs">
                  <div className="flex justify-between">
                    <span className="font-mono">v{doc.version}</span>
                    <span className="text-muted-foreground">
                      {doc.supersededAt
                        ? "dismissed"
                        : doc.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDate(doc.createdAt)} UTC
                  </p>
                  {doc.status === "PUBLISHED" && (
                    <a
                      href={`/api/docs/${doc.id}/download`}
                      className="mt-1 inline-block text-[10px] text-violet-300"
                    >
                      Download
                    </a>
                  )}
                </li>
              ))}
            </ol>
            {!unit.documentation.length && (
              <p className="text-xs text-muted-foreground">No versions yet.</p>
            )}
          </Card>
        </aside>
      </div>
      <details className="mt-6 rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Current source code
        </summary>
        <pre className="mt-5 overflow-x-auto rounded-lg border border-border bg-background p-5 font-mono text-xs leading-6 text-muted-foreground">
          <code>{unit.body}</code>
        </pre>
      </details>
    </>
  );
}

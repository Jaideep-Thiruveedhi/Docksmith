import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Layers,
  MessageSquare,
  PenLine,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, SetupNotice } from "@/components/shared";
import { IngestForm } from "@/components/ingest-form";
import { RepositoryActions } from "@/components/repository-actions";
import { getConfiguration } from "@/lib/env";
import { readWorkspace, syncIsActive } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { data, error } = await readWorkspace(async (db) => {
    const [repositories, units, documents, attention, commits, repos] =
      await Promise.all([
        db.repository.count(),
        db.codeUnit.count({ where: { deletedAt: null } }),
        db.codeUnit.count({
          where: { documentation: { some: { status: "PUBLISHED" } } },
        }),
        db.stalenessFlag.count({ where: { status: { not: "OK" } } }),
        db.commit.count(),
        db.repository.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            _count: { select: { files: { where: { deletedAt: null } } } },
          },
        }),
      ]);
    return { repositories, units, documents, attention, commits, repos };
  });
  let configuration: ReturnType<typeof getConfiguration> | null = null;
  try {
    configuration = getConfiguration();
  } catch {
    /* Configuration errors appear in SetupNotice. */
  }
  const stats = [
    {
      label: "Repositories",
      value: data?.repositories,
      icon: GitBranch,
      color: "text-violet-300",
      description: "Connected codebases",
    },
    {
      label: "Code units",
      value: data?.units,
      icon: FileCode2,
      color: "text-sky-300",
      description: "Functions, classes & modules",
    },
    {
      label: "Published docs",
      value: data?.documents,
      icon: BookOpen,
      color: "text-emerald-300",
      description: "Documented code units",
    },
    {
      label: "Needs attention",
      value: data?.attention,
      icon: PenLine,
      color: "text-amber-300",
      description: `${data?.commits ?? 0} commits tracked`,
    },
  ];
  return (
    <div className="space-y-8">
      <section className="hero-pattern relative overflow-hidden rounded-2xl border border-border px-6 py-9 sm:px-9 sm:py-11">
        <div className="relative max-w-2xl">
          <Badge className="mb-5 border-violet-400/20 bg-violet-400/10 text-violet-300">
            <Sparkles className="size-3" aria-hidden="true" />
            Your code, clearly understood
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Great code deserves
            <br />
            <span className="text-violet-300">living documentation.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
            Connect a repository. Turn source code into useful docs, catch what
            changed, and get answers grounded in your codebase.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <a href="#connect">
                <Github aria-hidden="true" />
                Connect a repository
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/docs">Explore documentation</Link>
            </Button>
          </div>
        </div>
        <div
          className="absolute right-10 top-1/2 hidden -translate-y-1/2 rotate-[-8deg] rounded-2xl border border-violet-400/15 bg-background/65 p-8 text-violet-300/80 xl:block"
          aria-hidden="true"
        >
          <Layers className="size-24 stroke-[0.8]" />
          <div className="mt-5 flex items-center justify-center gap-3 text-[10px] font-medium tracking-widest">
            <span>CODE</span>
            <ArrowRight className="size-3" />
            <span>CLARITY</span>
          </div>
        </div>
      </section>
      <SetupNotice message={error} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, description }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <Icon className={`size-4 ${color}`} aria-hidden="true" />
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight">
              {value?.toLocaleString() ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {description}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-7 lg:grid-cols-[0.85fr_1.4fr]">
        <Card id="connect" className="scroll-mt-28">
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300">
              <ArrowDownToLine className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>Bring your codebase</CardTitle>
            <CardDescription>
              Connect a GitHub repository to start building your knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IngestForm disabled={!data} />
          </CardContent>
        </Card>
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Your repositories
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A home for every codebase you understand.
              </p>
            </div>
            <Badge>{data?.repositories ?? 0} connected</Badge>
          </div>
          <div className="space-y-4">
            {data?.repos.length ? (
              data.repos.map((repo) => (
                <Card key={repo.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg border border-border bg-secondary p-2.5">
                        <Github
                          className="size-5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/docs?repoId=${repo.id}`}
                          className="break-all text-sm font-semibold hover:text-violet-300"
                        >
                          {repo.owner}
                          <span className="mx-1 text-muted-foreground">/</span>
                          {repo.name}
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GitBranch className="size-3" aria-hidden="true" />
                            {repo.trackedBranch}
                          </span>
                          <span>{repo._count.files} files</span>
                          {repo.lastSyncedSha && (
                            <span className="font-mono">
                              {repo.lastSyncedSha.slice(0, 7)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={
                        repo.status === "ERROR"
                          ? "text-red-300"
                          : repo.status === "READY"
                            ? "text-emerald-300"
                            : "text-amber-300"
                      }
                    >
                      {repo.status.toLowerCase()}
                    </Badge>
                  </div>
                  {repo.lastSyncedAt && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Last synced {formatDate(repo.lastSyncedAt)} UTC
                    </p>
                  )}
                  {repo.syncError && (
                    <p className="mt-3 text-xs text-red-300">
                      {repo.syncError}
                    </p>
                  )}
                  <RepositoryActions
                    repoId={repo.id}
                    name={`${repo.owner}/${repo.name}`}
                    syncing={syncIsActive(repo)}
                  />
                </Card>
              ))
            ) : (
              <EmptyState
                title="Your next project starts here"
                description="Connect your first repository. Its source files, documentation, and changes will live here."
              />
            )}
          </div>
        </section>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            href: "/docs",
            icon: BookOpen,
            title: "Read the code, minus the guesswork",
            text: "Markdown documentation generated from actual source code.",
          },
          {
            href: "/changes",
            icon: GitCommitHorizontal,
            title: "Keep up with every change",
            text: "See which docs need a review when the code moves on.",
          },
          {
            href: "/chat",
            icon: MessageSquare,
            title: "Ask a better question",
            text: "Find answers with references to real files and functions.",
          },
        ].map(({ href, icon: Icon, title, text }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border p-5 transition-colors hover:border-violet-400/30 hover:bg-card"
          >
            <Icon className="mb-4 size-5 text-violet-300" aria-hidden="true" />
            <h2 className="flex items-center justify-between gap-2 text-sm font-medium">
              {title}
              <ChevronRight
                className="size-4 text-muted-foreground group-hover:text-violet-300"
                aria-hidden="true"
              />
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {text}
            </p>
          </Link>
        ))}
      </section>
      <section className="rounded-xl border border-border p-5">
        <h2 className="mb-4 text-xs font-medium">Workspace connections</h2>
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          {[
            { label: "Neon database", ready: configuration?.database },
            { label: "LLM provider", ready: configuration?.llm },
            { label: "HuggingFace", ready: configuration?.embeddings },
            { label: "Qdrant", ready: configuration?.vectorStore },
            { label: "GitHub token", ready: configuration?.github },
            { label: "Signed webhooks", ready: configuration?.webhook },
          ].map(({ label, ready }) => (
            <span
              key={label}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              {ready ? (
                <Check
                  className="size-3.5 text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              )}
              <span>{label}</span>
              <span
                className={
                  ready ? "text-emerald-300/80" : "text-muted-foreground/60"
                }
              >
                {ready ? "configured" : "not set"}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground/70">
          Connection indicators show configured credentials. The database health
          check is available at{" "}
          <Link href="/api/health" className="text-violet-300">
            /api/health
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

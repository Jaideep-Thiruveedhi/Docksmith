import Link from "next/link";
import { AlertCircle, ArrowRight, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/staleness";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function SetupNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="mb-6 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-6 text-amber-100"
    >
      <AlertCircle
        className="mt-0.5 size-5 shrink-0 text-amber-400"
        aria-hidden="true"
      />
      <div>
        <p className="font-medium">Workspace setup</p>
        <p className="mt-1 text-amber-100/70">{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <Card className="flex min-h-56 flex-col items-center justify-center border-dashed p-8 text-center">
      <div className="mb-4 rounded-xl border border-border bg-secondary p-3">
        <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="font-medium">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {href && (
        <Link
          href={href}
          className="mt-5 inline-flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200"
        >
          {linkLabel ?? "Back to overview"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </Card>
  );
}

const severityLabels: Record<Severity, string> = {
  OK: "Up to date",
  REVIEW_RECOMMENDED: "Review recommended",
  POTENTIALLY_OUTDATED: "Potentially outdated",
  BROKEN: "Breaking change",
};
const severityColors: Record<Severity, string> = {
  OK: "border-emerald-400/15 bg-emerald-400/8 text-emerald-300",
  REVIEW_RECOMMENDED: "border-sky-400/15 bg-sky-400/8 text-sky-300",
  POTENTIALLY_OUTDATED: "border-amber-400/15 bg-amber-400/8 text-amber-300",
  BROKEN: "border-red-400/15 bg-red-400/8 text-red-300",
};
export function StalenessBadge({ status }: { status: Severity }) {
  return (
    <Badge className={cn("whitespace-nowrap", severityColors[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {severityLabels[status]}
    </Badge>
  );
}

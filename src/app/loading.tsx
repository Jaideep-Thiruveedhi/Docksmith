export default function Loading() {
  return (
    <div role="status" aria-label="Loading workspace" className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-secondary" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-secondary" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((id) => (
          <div
            key={id}
            className="h-48 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

import { diffLines } from "diff";

export function DiffViewer({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg border border-border bg-background font-mono text-xs leading-6"
      aria-label="Documentation changes"
    >
      <pre className="min-w-0 py-3">
        {diffLines(before, after).map((part, index) => (
          <span
            key={index}
            className={`block whitespace-pre-wrap break-words px-4 ${part.added ? "bg-emerald-500/10 text-emerald-200" : part.removed ? "bg-red-500/10 text-red-200" : "text-muted-foreground"}`}
          >
            {part.value
              .split("\n")
              .filter(
                (line, lineIndex, lines) =>
                  lineIndex !== lines.length - 1 || line !== "",
              )
              .map((line, lineIndex) => (
                <span className="block" key={lineIndex}>
                  <span
                    aria-hidden="true"
                    className="mr-3 inline-block w-3 select-none"
                  >
                    {part.added ? "+" : part.removed ? "−" : " "}
                  </span>
                  {line || " "}
                </span>
              ))}
          </span>
        ))}
      </pre>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  FileText,
  LoaderCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client";

export function RepositoryActions({
  repoId,
  name,
  syncing,
}: {
  repoId: string;
  name: string;
  syncing: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  async function run(action: "sync" | "generate" | "index" | "delete") {
    if (
      action === "delete" &&
      !window.confirm(
        `Remove ${name}, its documentation, vectors, and chat history from this workspace?`,
      )
    )
      return;
    setBusy(action);
    setNotice("");
    setFailed(false);
    try {
      if (action === "generate") {
        let total = 0;
        const warnings = new Set<string>();
        for (;;) {
          const result = await requestJson<{
            generated: number;
            remaining: number;
            warnings: string[];
          }>("/api/generate", { method: "POST", body: { repoId, limit: 2 } });
          total += result.generated;
          result.warnings.forEach((warning) => warnings.add(warning));
          setNotice(
            `${total} documents generated · ${result.remaining} remaining`,
          );
          if (!result.remaining || !result.generated) break;
        }
        setNotice(
          `${total} documents generated.${warnings.size ? ` ${[...warnings].join(" ")}` : ""}`,
        );
      } else if (action === "index") {
        let cursor: string | null = null;
        let total = 0;
        do {
          const result: { indexed: number; nextCursor: string | null } =
            await requestJson(`/api/repos/${repoId}/index`, {
              method: "POST",
              body: cursor ? { cursor } : {},
            });
          total += result.indexed;
          cursor = result.nextCursor;
          setNotice(`${total} documents indexed…`);
        } while (cursor);
        setNotice(`${total} published documents indexed for chat.`);
      } else if (action === "sync") {
        const result = await requestJson<{
          changedFiles: number;
          removedFiles: number;
        }>(`/api/repos/${repoId}/sync`, { method: "POST" });
        setNotice(
          `Sync complete. ${result.changedFiles} changed files, ${result.removedFiles} removed.`,
        );
      } else await requestJson(`/api/repos/${repoId}`, { method: "DELETE" });
    } catch (error) {
      setFailed(true);
      setNotice(
        error instanceof Error ? error.message : "The operation failed.",
      );
    } finally {
      setBusy(null);
      router.refresh();
    }
  }
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={Boolean(busy) || syncing}
          onClick={() => run("sync")}
        >
          {busy === "sync" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          Sync
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={Boolean(busy) || syncing}
          onClick={() => run("generate")}
        >
          {busy === "generate" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <FileText />
          )}
          Generate docs
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={Boolean(busy) || syncing}
          onClick={() => run("index")}
        >
          {busy === "index" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Database />
          )}
          Rebuild index
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-8 hover:text-red-300"
          aria-label={`Remove ${name}`}
          disabled={Boolean(busy) || syncing}
          onClick={() => run("delete")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <p
        role="status"
        className={`mt-2 text-xs leading-5 ${failed ? "text-red-300" : "text-muted-foreground"}`}
      >
        {notice}
      </p>
    </div>
  );
}

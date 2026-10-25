"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Github, LoaderCircle } from "lucide-react";
import { requestJson } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function IngestForm({ disabled = false }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
          const result = await requestJson<{
            files: number;
            parsedUnits: number;
          }>("/api/ingest", {
            method: "POST",
            body: {
              repoUrl: data.get("repoUrl"),
              ...(String(data.get("branch") ?? "").trim()
                ? { branch: String(data.get("branch")).trim() }
                : {}),
            },
          });
          setNotice(
            `Repository connected. Indexed ${result.files} files and ${result.parsedUnits} code units.`,
          );
          form.reset();
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Ingestion failed.",
          );
        } finally {
          setBusy(false);
          router.refresh();
        }
      }}
    >
      <div>
        <label htmlFor="repoUrl" className="mb-2 block text-xs font-medium">
          GitHub repository URL
        </label>
        <div className="relative">
          <Github
            className="absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="repoUrl"
            name="repoUrl"
            type="url"
            required
            placeholder="https://github.com/owner/repository"
            className="pl-10"
            disabled={busy || disabled}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="branch"
          className="mb-2 flex justify-between text-xs font-medium"
        >
          <span>Branch</span>
          <span className="font-normal text-muted-foreground">Optional</span>
        </label>
        <Input
          id="branch"
          name="branch"
          placeholder="Repository default branch"
          maxLength={200}
          disabled={busy || disabled}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy || disabled}>
        {busy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
        {busy ? "Reading repository…" : "Connect repository"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        JavaScript, TypeScript & Python. Private repositories use your
        server-side GitHub token.
      </p>
      <div aria-live="polite">
        {error && <p className="text-sm text-red-300">{error}</p>}
        {notice && <p className="text-sm text-emerald-300">{notice}</p>}
      </div>
    </form>
  );
}

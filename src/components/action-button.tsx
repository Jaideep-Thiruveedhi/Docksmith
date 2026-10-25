"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client";

export function ActionButton({
  endpoint,
  body,
  label,
  busyLabel = "Working…",
  successMessage = "Saved.",
  variant = "secondary",
  confirmMessage,
  disabled = false,
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  label: string;
  busyLabel?: string;
  successMessage?: string;
  variant?: "default" | "secondary" | "ghost" | "destructive";
  confirmMessage?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        size="sm"
        disabled={busy || disabled}
        onClick={async () => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          setBusy(true);
          setNotice("");
          setFailed(false);
          try {
            const result = await requestJson<{ warning?: string }>(endpoint, {
              method: "POST",
              body: body ?? {},
            });
            setNotice(result.warning ?? successMessage);
            router.refresh();
          } catch (error) {
            setFailed(true);
            setNotice(
              error instanceof Error ? error.message : "The request failed.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {busy ? busyLabel : label}
      </Button>
      <p
        aria-live="polite"
        className={`max-w-lg text-xs leading-5 ${failed ? "text-red-300" : "text-muted-foreground"}`}
      >
        {notice}
      </p>
    </div>
  );
}

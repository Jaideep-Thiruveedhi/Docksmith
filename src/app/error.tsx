"use client";

import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-2xl font-semibold">
        Something interrupted the workspace.
      </h1>
      <p className="my-5 text-sm leading-6 text-muted-foreground">
        Check your service configuration and database connection, then try
        again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

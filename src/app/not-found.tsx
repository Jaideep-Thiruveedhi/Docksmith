import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="mb-4 font-mono text-sm text-violet-300">404</p>
      <h1 className="text-3xl font-semibold">
        This page isn&apos;t in the codebase.
      </h1>
      <p className="my-5 text-sm text-muted-foreground">
        The document or page may have been removed.
      </p>
      <Button asChild>
        <Link href="/">Back to overview</Link>
      </Button>
    </div>
  );
}

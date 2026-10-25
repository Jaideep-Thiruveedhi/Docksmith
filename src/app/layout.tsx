import type { Metadata } from "next";
import Link from "next/link";
import { Blocks, Circle } from "lucide-react";
import { Navigation } from "@/components/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Docsmith · Code, documented.", template: "%s · Docsmith" },
  description:
    "Turn GitHub repositories into living documentation. Track code changes, review AI drafts, and ask questions grounded in your code.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only z-50 bg-primary p-3 focus:not-sr-only focus:fixed"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-lg">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 pt-4 md:h-20 md:flex-row md:items-center md:justify-between md:gap-5 md:pt-0 lg:px-8">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight"
            >
              <span className="flex size-9 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10">
                <Blocks className="size-5 text-violet-300" aria-hidden="true" />
              </span>
              <span className="text-lg">
                docsmith<span className="text-violet-400">.</span>
              </span>
            </Link>
            <Navigation />
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[10px] text-muted-foreground xl:flex">
              <Circle
                className="size-1.5 fill-emerald-400 text-emerald-400"
                aria-hidden="true"
              />
              Your workspace
            </span>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto min-h-[calc(100vh-10rem)] max-w-7xl px-5 py-8 sm:py-10 lg:px-8"
        >
          {children}
        </main>
        <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-7 text-[11px] text-muted-foreground/70 lg:px-8">
          <p>Docsmith — documentation that moves with your code.</p>
          <p>GitHub · Markdown · Code intelligence</p>
        </footer>
      </body>
    </html>
  );
}

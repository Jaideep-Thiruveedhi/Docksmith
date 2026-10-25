"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GitCommitHorizontal,
  LayoutDashboard,
  MessageSquare,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/docs", label: "Documentation", icon: BookOpen },
  { href: "/changes", label: "Changes", icon: GitCommitHorizontal },
  { href: "/drafts", label: "Draft reviews", icon: PenLine },
  { href: "/chat", label: "Ask Docsmith", icon: MessageSquare },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className="no-scrollbar flex gap-1 overflow-x-auto pb-3 md:pb-0"
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors lg:text-sm",
              active
                ? "bg-primary/12 text-violet-300"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

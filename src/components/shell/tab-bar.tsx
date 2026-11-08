"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, LineChart, Menu, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Today", icon: Flame, match: (p: string) => p === "/" },
  { href: "/log", label: "Log", icon: NotebookPen, match: (p: string) => p.startsWith("/log") || p.startsWith("/foods") || p.startsWith("/exercise") },
  { href: "/progress", label: "Progress", icon: LineChart, match: (p: string) => p.startsWith("/progress") || p.startsWith("/body") || p.startsWith("/checkin") },
  { href: "/more", label: "More", icon: Menu, match: (p: string) => p.startsWith("/more") || p.startsWith("/settings") },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-tabbar backdrop-blur-xl pb-safe">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
              >
                <Icon className="size-6" aria-hidden strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

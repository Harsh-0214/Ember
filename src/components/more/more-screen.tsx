"use client";
import Link from "next/link";
import { BookOpen, ChevronRight, Dumbbell, HeartPulse, Info, LogOut, Scale, Settings, ShieldCheck, Upload, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";

const SECTIONS: { title: string; items: { href: string; label: string; icon: typeof Settings; desc?: string }[] }[] = [
  {
    title: "Track",
    items: [
      { href: "/body", label: "Body metrics", icon: Scale, desc: "Weight, body fat, measurements" },
      { href: "/exercise", label: "Exercise", icon: Dumbbell, desc: "Workouts, routines, PRs" },
      { href: "/recipes", label: "Recipes & meals", icon: UtensilsCrossed, desc: "Recipes and saved meals" },
    ],
  },
  {
    title: "Connect",
    items: [
      { href: "/settings/health", label: "Connect Apple Health", icon: HeartPulse, desc: "Apple Watch, Renpho, steps, sleep" },
      { href: "/settings/import", label: "Import history", icon: Upload, desc: "MyFitnessPal and Renpho CSV" },
    ],
  },
  {
    title: "App",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, desc: "Profile, goals, units, reminders, data" },
      { href: "/help/targets", label: "How your target works", icon: Info },
      { href: "/privacy", label: "Privacy", icon: ShieldCheck },
      { href: "/help/install", label: "Install on iPhone", icon: BookOpen },
    ],
  },
];

export function MoreScreen() {
  return (
    <main className="px-4 pb-8">
      <PageHeader title="More" />
      <div className="grid gap-5">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.title}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border/70">
              {s.items.map(({ href, label, icon: Icon, desc }) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px]">{label}</span>
                      {desc ? <span className="block truncate text-xs text-muted-foreground">{desc}</span> : null}
                    </span>
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <form action="/auth/signout" method="post">
          <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-card font-semibold text-destructive ring-1 ring-border/70">
            <LogOut className="size-5" aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

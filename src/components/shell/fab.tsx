"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Droplet, Dumbbell, Plus, ScanBarcode, Scale, Utensils, Zap } from "lucide-react";
import { Sheet } from "@/components/ui/drawer";

const ACTIONS = [
  { href: "/log", label: "Food", icon: Utensils, desc: "Search, recent, favourites" },
  { href: "/log/scan", label: "Scan barcode", icon: ScanBarcode, desc: "Packaged foods" },
  { href: "/log/quick", label: "Quick calories", icon: Zap, desc: "Just the numbers" },
  { href: "/?water=1", label: "Water", icon: Droplet, desc: "Add a glass" },
  { href: "/body?add=1", label: "Weight", icon: Scale, desc: "Weigh-in & body metrics" },
  { href: "/exercise/new", label: "Exercise", icon: Dumbbell, desc: "Cardio or strength" },
] as const;

export function Fab() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Hidden on screens that are already about adding things
  if (/^\/(log|foods|settings|onboarding|exercise\/new|recipes\/)/.test(pathname)) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Quick add"
        onClick={() => setOpen(true)}
        className="fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
      >
        <Plus className="size-7" aria-hidden strokeWidth={2.5} />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Quick add">
        <ul className="grid grid-cols-2 gap-3">
          {ACTIONS.map(({ href, label, icon: Icon, desc }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="flex h-full min-h-24 flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-border active:scale-[0.98]"
              >
                <Icon className="size-6 text-primary" aria-hidden />
                <span className="font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

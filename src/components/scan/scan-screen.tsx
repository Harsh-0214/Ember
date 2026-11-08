"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/data/keys";
import type { FoodWithServings } from "@/lib/data/types";

const Scanner = dynamic(() => import("./scanner"), { ssr: false, loading: () => <Skeleton className="aspect-[3/4] w-full rounded-3xl" /> });

type State = { kind: "scanning" } | { kind: "looking"; code: string } | { kind: "notfound"; code: string; message?: string };

export function ScanScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [state, setState] = useState<State>({ kind: "scanning" });
  const [manual, setManual] = useState("");
  const extra = new URLSearchParams();
  if (params.get("meal")) extra.set("meal", params.get("meal")!);
  if (params.get("date")) extra.set("date", params.get("date")!);
  const backHref = `/log${extra.toString() ? `?${extra}` : ""}`;

  async function lookup(code: string) {
    setState({ kind: "looking", code });
    try {
      const res = await api.get<{ food: FoodWithServings | null }>(`/api/foods/barcode/${encodeURIComponent(code)}`);
      if (res.food) {
        qc.setQueryData(qk.food(res.food.id), res.food);
        const sp = new URLSearchParams(extra);
        sp.set("food", res.food.id);
        router.replace(`/log?${sp}`);
        return;
      }
      setState({ kind: "notfound", code });
    } catch (e) {
      setState({ kind: "notfound", code, message: e instanceof ApiError && e.status !== 404 ? e.message : undefined });
    }
  }

  const addHref = (code: string) => {
    const sp = new URLSearchParams(extra);
    sp.set("barcode", code);
    return `/foods/new?${sp}`;
  };

  return (
    <main className="px-4 pb-8">
      <PageHeader title="Scan barcode" back={backHref} />
      {state.kind === "scanning" ? (
        <Scanner onDetected={(c) => void lookup(c)} />
      ) : state.kind === "looking" ? (
        <div className="grid gap-3 rounded-3xl bg-card p-6 text-center ring-1 ring-border" role="status">
          <PackageSearch className="mx-auto size-8 animate-pulse text-primary" aria-hidden />
          <p className="font-semibold">Looking up {state.code}…</p>
        </div>
      ) : (
        <div className="grid gap-3 rounded-3xl bg-card p-6 text-center ring-1 ring-border">
          <PackageSearch className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">{state.message ?? "We don't know this product yet"}</p>
          <p className="text-sm text-muted-foreground">Add it once with the label on the pack. Ember remembers barcode {state.code} for next time.</p>
          <Button asChild size="lg"><Link href={addHref(state.code)}>Add this product</Link></Button>
          <Button variant="ghost" onClick={() => setState({ kind: "scanning" })}>Scan again</Button>
        </div>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = manual.replace(/\D/g, "");
          if (c.length >= 8) void lookup(c);
        }}
      >
        <Input aria-label="Type a barcode" inputMode="numeric" placeholder="Or type the barcode number" value={manual} onChange={(e) => setManual(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={manual.replace(/\D/g, "").length < 8}>Look up</Button>
      </form>
    </main>
  );
}

"use client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAddEntries } from "@/lib/data/hooks";
import { qk } from "@/lib/data/keys";
import type { FoodEntry } from "@/lib/data/types";
import { addDays } from "@/lib/dates";
import { copyEntries } from "@/lib/foods/copy";
import { uuid } from "@/lib/utils";

/** Offered on an empty day: copies everything from the previous day. */
export function CopyYesterday({ date }: { date: string }) {
  const prev = addDays(date, -1);
  const add = useAddEntries();
  const q = useQuery({
    queryKey: qk.diary(prev),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().from("food_entries").select("*").eq("date", prev).order("logged_at");
      if (error) throw new Error(error.message);
      return data as FoodEntry[];
    },
  });
  const n = q.data?.length ?? 0;
  if (!n) return null;
  const kcal = Math.round((q.data ?? []).reduce((s, e) => s + Number(e.kcal), 0));
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full"
      onClick={() => {
        add.mutate(copyEntries(q.data ?? [], date, uuid));
        toast.success(`Copied ${n} items from the day before`);
      }}
    >
      <Copy aria-hidden /> Copy previous day ({n} items · {kcal} kcal)
    </Button>
  );
}

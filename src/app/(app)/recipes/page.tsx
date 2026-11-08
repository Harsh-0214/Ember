import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Recipes & meals" };

export default function Page() {
  return <ComingSoon title="Recipes & meals" back="/more" body="Recipes with per-serving macros and one-tap saved meals." />;
}

import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Weekly check-in" };

export default function Page() {
  return <ComingSoon title="Weekly check-in" back="/settings" body="Your weekly summary and updated TDEE." />;
}

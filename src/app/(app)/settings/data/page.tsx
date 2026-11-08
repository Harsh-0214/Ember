import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Your data" };

export default function Page() {
  return <ComingSoon title="Your data" back="/settings" body="Export everything as CSV/JSON or delete your account." />;
}

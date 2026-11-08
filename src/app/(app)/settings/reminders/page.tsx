import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Reminders" };

export default function Page() {
  return <ComingSoon title="Reminders" back="/settings" body="Push reminders to log meals, weigh in and check in." />;
}

import type { Metadata } from "next";
import { Wizard } from "@/components/onboarding/wizard";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return <Wizard />;
}

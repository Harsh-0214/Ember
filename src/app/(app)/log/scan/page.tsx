import { Suspense } from "react";
import { ScanScreen } from "@/components/scan/scan-screen";

export const metadata = { title: "Scan barcode" };

export default function ScanPage() {
  return (
    <Suspense>
      <ScanScreen />
    </Suspense>
  );
}

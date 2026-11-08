import { Suspense } from "react";
import { NewFoodScreen } from "@/components/foods/food-pages";

export const metadata = { title: "Create food" };

export default function NewFoodPage() {
  return (
    <Suspense>
      <NewFoodScreen />
    </Suspense>
  );
}

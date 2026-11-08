import { EditFoodScreen } from "@/components/foods/food-pages";

export const metadata = { title: "Edit food" };

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditFoodScreen id={id} />;
}

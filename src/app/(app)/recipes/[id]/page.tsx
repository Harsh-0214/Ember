import { RecipeEditorScreen } from "@/components/recipes/recipe-editor";

export const metadata = { title: "Recipe" };

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeEditorScreen id={id} />;
}

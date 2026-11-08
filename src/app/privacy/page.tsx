export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10 pt-safe">
      <h1 className="text-2xl font-bold">Privacy</h1>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        <p>Ember is a personal app. Your data lives in your own Supabase project, protected by row-level security so only your signed-in account can read or change it.</p>
        <p>Food searches are sent to Open Food Facts and USDA FoodData Central from the server — never with your identity. Foods you view are cached so repeat lookups don&apos;t leave your database.</p>
        <p>Apple Health data only arrives when you send it with your personal API token. Tokens are stored hashed and can be revoked any time.</p>
        <p>Progress photos are stored in a private bucket and are only viewable through short-lived signed links.</p>
        <p>You can export everything (CSV/JSON) or permanently delete your account from Settings.</p>
      </div>
    </main>
  );
}

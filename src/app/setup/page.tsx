import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Setup" };

export default function SetupPage() {
  const ok = isSupabaseConfigured();
  return (
    <main className="mx-auto max-w-lg px-6 py-12 pt-safe">
      <h1 className="text-2xl font-bold">Finish setting up Ember</h1>
      {ok ? (
        <p className="mt-4">Supabase is configured. <Link className="text-primary underline" href="/">Open the app</Link>.</p>
      ) : (
        <>
          <p className="mt-4 text-muted-foreground">Ember needs a Supabase project. Add these environment variables (in <code>.env.local</code> locally, or in Vercel → Settings → Environment Variables) and redeploy:</p>
          <ul className="mt-4 list-disc space-y-1 pl-6 font-mono text-sm">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>SUPABASE_SERVICE_ROLE_KEY</li>
            <li>USDA_API_KEY</li>
            <li>NEXT_PUBLIC_SITE_URL</li>
          </ul>
        </>
      )}
    </main>
  );
}

"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-redirect";

const emailSchema = z.email("Enter a valid email");
const passwordSchema = z.string().min(8, "At least 8 characters");

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") === "link" ? "That link has expired or was already used. Try again." : null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const em = emailSchema.safeParse(email.trim());
    if (!em.success) return setError(em.error.issues[0]?.message ?? "Invalid email");
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) return setError(pw.error.issues[0]?.message ?? "Invalid password");
    setBusy(true);
    const supabase = getSupabaseBrowser();
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: em.data, password: pw.data });
        if (err) throw err;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: em.data,
          password: pw.data,
          options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
        });
        if (err) throw err;
        if (data.session) {
          router.replace("/onboarding");
          router.refresh();
        } else setInfo("Check your email to confirm your account, then come back here.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(/signups not allowed/i.test(msg) ? "New sign-ups are disabled for this app." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    setError(null);
    setInfo(null);
    const em = emailSchema.safeParse(email.trim());
    if (!em.success) return setError("Enter your email first, then tap “Email me a link”.");
    setBusy(true);
    const { error: err } = await getSupabaseBrowser().auth.signInWithOtp({
      email: em.data,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setInfo("Magic link sent — open it on this device to sign in.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Segmented<Mode>
        label="Sign in or create account"
        value={mode}
        onChange={setMode}
        options={[
          { value: "signin", label: "Sign in" },
          { value: "signup", label: "Create account" },
        ]}
      />
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
        <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error ? <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {info ? <p role="status" className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">{info}</p> : null}
      <Button type="submit" size="lg" disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
      {mode === "signin" ? (
        <Button variant="ghost" onClick={magicLink} disabled={busy}>
          <Mail aria-hidden /> Email me a sign-in link
        </Button>
      ) : null}
    </form>
  );
}

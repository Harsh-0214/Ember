import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 pt-safe pb-safe">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={64} height={64} className="mx-auto mb-4 size-16 rounded-2xl" />
        <h1 className="text-2xl font-bold tracking-tight">Ember</h1>
        <p className="mt-1 text-muted-foreground">Food, fitness and progress — in one place.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-xs text-muted-foreground">
        Private by design. <Link className="underline underline-offset-2" href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}

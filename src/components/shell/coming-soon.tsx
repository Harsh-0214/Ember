import { PageHeader } from "./page-header";

export function ComingSoon({ title, back = "/more", body }: { title: string; back?: string; body: string }) {
  return (
    <main className="px-4">
      <PageHeader title={title} back={back} />
      <div className="rounded-2xl bg-card p-6 text-center ring-1 ring-border/70">
        <p className="font-semibold">Coming in the next update</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}

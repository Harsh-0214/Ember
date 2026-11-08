import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "Install on iPhone" };

export default function InstallHelpPage() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-16">
      <PageHeader title="Install on iPhone" back="/more" />
      <ol className="grid list-decimal gap-3 pl-5 text-[15px] leading-relaxed">
        <li>Open Ember in <strong>Safari</strong> (other browsers on iOS can also add to the Home Screen on iOS 16.4+, but Safari is the most reliable).</li>
        <li>Tap the <strong>Share</strong> button (square with an up arrow).</li>
        <li>Scroll and tap <strong>Add to Home Screen</strong>, keep the name &ldquo;Ember&rdquo;, then tap <strong>Add</strong>.</li>
        <li>Open Ember from the new Home Screen icon. It opens full screen with no Safari address bar. That&apos;s standalone mode.</li>
      </ol>
      <h2 className="mt-8 mb-2 font-semibold">How to confirm it&apos;s running standalone</h2>
      <ul className="grid list-disc gap-2 pl-5 text-[15px] text-muted-foreground">
        <li>There&apos;s no Safari toolbar or address bar, and the status bar blends into the app.</li>
        <li>It appears as its own app in the App Switcher.</li>
        <li>The &ldquo;Add to Home Screen&rdquo; hint no longer appears.</li>
        <li>Reminders (Settings → Reminders) can only be enabled in the installed app on iOS 16.4 or later.</li>
      </ul>
    </main>
  );
}

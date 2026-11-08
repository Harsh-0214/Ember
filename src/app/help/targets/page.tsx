import { PageHeader } from "@/components/shell/page-header";

export const metadata = { title: "How your target works" };

export default function TargetsHelpPage() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-16">
      <PageHeader title="How your target works" back="/" />
      <div className="grid gap-5 text-[15px] leading-relaxed">
        <section>
          <h2 className="mb-1 font-semibold">1. We estimate your maintenance (TDEE)</h2>
          <p className="text-muted-foreground">At first we use the Mifflin-St Jeor formula with your activity level. After about two weeks of mostly complete logging plus regular weigh-ins, Ember learns your <em>real</em> TDEE: average intake minus the energy implied by your trend-weight change (≈7,700 kcal per kg). It blends in gradually and won&apos;t jump more than 150 kcal in a week.</p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">2. We add or subtract for your goal</h2>
          <p className="text-muted-foreground">Your weekly rate becomes a daily deficit or surplus. Targets never go below a safety floor (1,200 kcal for women, 1,500 kcal for men by default) because eating less than that makes it hard to get enough protein and micronutrients.</p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">3. Exercise is shown, not added (by default)</h2>
          <p className="text-muted-foreground">Your learned TDEE already includes your usual workouts, steps and daily movement. Adding exercise calories on top would count them twice, which is the most common reason calorie tracking &ldquo;stops working&rdquo;. So your target is fixed each day.</p>
          <p className="mt-2 text-muted-foreground">If you prefer eating back exercise, turn on <strong>Add exercise calories to budget</strong> in Settings. Ember then switches your base to BMR × 1.2 (sedentary) and adds a percentage you choose of the <em>net</em> calories from each workout. Imported Apple Watch workouts and manual ones that overlap in time are counted once.</p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">4. Trend weight, not daily weight</h2>
          <p className="text-muted-foreground">Daily weight swings 1–2 kg with water, salt and food in your gut. Ember smooths your weigh-ins with a moving average (about a 10-day half-life) and uses that trend for every calculation.</p>
        </section>
        <section>
          <h2 className="mb-1 font-semibold">5. Mark days honestly</h2>
          <p className="text-muted-foreground">Days with less than half your target logged are ignored unless you mark them &ldquo;fully logged&rdquo; or &ldquo;fasted&rdquo;. A partial day would make your TDEE look lower than it really is.</p>
        </section>
      </div>
    </main>
  );
}

# Deploying Ember to Vercel (Hobby)

## 1. Prerequisites
- The Supabase project is created and the migrations are applied. Run `npx supabase db push` again after every `git pull` that adds a migration.
- The code is in your GitHub repo `harsh-0214/ember` (Vercel deploys from GitHub).

## 2. Create the Vercel project
1. Go to <https://vercel.com/new>, then **Import Git Repository** → `harsh-0214/ember`.
2. Framework preset: **Next.js** (auto-detected). Leave the build command and output directory as the defaults.
3. Production branch: Vercel uses the repo's default branch. Either merge `claude/keen-ritchie-38e1id` into `main`, or set **Settings → Git → Production Branch** to `claude/keen-ritchie-38e1id` while building.
4. Add these **Environment Variables** (Production, and Preview too if you want preview deploys to work):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (**never** prefix with `NEXT_PUBLIC_`) |
| `USDA_API_KEY` | your FoodData Central key |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` (fill this in after the first deploy, then redeploy) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | phase 7 (reminders), optional |
| `ANTHROPIC_API_KEY` | phase 8, optional |

5. Click **Deploy**. Every later push to the production branch redeploys automatically.

## 3. Point Supabase Auth at the deployment
In Supabase, go to **Authentication → URL Configuration**:
- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: add `https://<your-app>.vercel.app/**` and keep `http://localhost:3000/**`.

Without these, magic links and email confirmations redirect to the wrong place.

## 4. Create your account, then lock sign-ups
1. Open the app, tap **Create account**, and confirm your email if confirmation is enabled.
2. In Supabase, go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. Your existing account keeps working, and anyone else who tries gets "New sign-ups are disabled".
3. Optional: under **Authentication → Rate Limits**, keep the defaults. Under **Auth → Email**, you can keep "Confirm email" on.

## 5. Install on your iPhone
1. Open the Vercel URL in **Safari**, sign in, and finish onboarding.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch Ember from the Home Screen icon. It runs full screen with no Safari UI (standalone mode).

## 6. Verify the PWA (desktop Chrome DevTools)
- **Application → Manifest**: name "Ember", display `standalone`, icons including maskable, no errors.
- **Application → Service workers**: `/serwist/sw.js` is activated and running with scope `/`.
- **Application → Cache storage**: precached `_next/static` assets appear after the first load.
- **Network → Offline** + reload: the app shell still loads. Pages you haven't visited show the offline page.
- Lighthouse no longer has a PWA category, so use the panels above instead.

On iPhone, the app is in standalone mode if there's no address bar and it shows up as its own app in the App Switcher.

## Notes
- Vercel Hobby crons run once a day, so reminders use Supabase `pg_cron` plus an Edge Function instead (phase 7).
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It's only imported from `src/lib/supabase/admin.ts`, which is marked `server-only`.

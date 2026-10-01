# Receipts

An iPhone app for shared household budgeting. Snap a receipt and Claude reads the merchant, total, and date, then picks a budget category. You check the details and save. Everyone in your household sees the same receipts, which update live.

- **Scan:** camera or photo library, or enter an expense manually. Claude also writes a one-line summary and an itemized list with prices, which you can edit or type in yourself
- **History:** search merchants and notes, filter by month and category, grouped by day
- **Insights:** totals by day, week, month, year, or a custom date range, broken down by category and by person
- **Household:** invite others with a 6-character code
- **Notifications** (home-screen web app): when someone else adds an expense, and when the monthly summary is ready. Each person is asked first and can change it in the Household tab

## How it fits together

```
iPhone app (Expo / React Native)
   │  photo, resized to ≤1568px JPEG
   ▼
Supabase Edge Function  scan-receipt ──► Claude API (vision + structured output)
   │
Supabase Postgres  (households, members, receipts, with row-level security)
Supabase Storage   (receipt photos, private per household)
Supabase Realtime  (live updates between household members)
```

The Anthropic API key lives only on the server. The app never sees it, and only signed-in users can call the scan function.

## Setup

You need a free [Supabase](https://supabase.com) account, an [Anthropic API](https://console.anthropic.com) account, and the free **Expo Go** app on your iPhone.

### 1. Create the Supabase project

1. Create a new project at supabase.com.
2. Open **SQL Editor**, paste in all of `supabase/migrations/20260929000000_init.sql`, and run it.
3. Optional, for easier setup: go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. Otherwise each person must click the link in their confirmation email before signing in.

### 2. Deploy the scan function

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF      # the ID in your project URL
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy scan-receipt --use-api   # --use-api: no Docker needed
```

Create the API key at console.anthropic.com → **API Keys**, and add a few dollars of credit under **Billing**.

> **Why not a Claude Pro subscription?** Pro ($20/month) covers claude.ai and Claude Code only. Apps call Claude through the API, which is billed separately by usage. For this app, the cost is small (see below).

### 3. Run the app on your iPhone

```bash
cp .env.example .env     # then fill in the URL and publishable (anon) key from Project Settings → API
npm install
npx expo start
```

Scan the QR code with your iPhone camera. The app opens in Expo Go. Your phone and Mac need to be on the same Wi-Fi network.

### 4. Add your partner

Create an account in the app and choose **Start new**. Then share the invite code from the **Household** tab. Your partner signs up and chooses **Join with code**.

While you're developing, your partner can also run the app through Expo Go, but only while `npx expo start` is running on your Mac. For a standalone app you both keep on your phones, see "Installing for real" below.

## Costs

| Item | Cost |
|---|---|
| Supabase | Free tier (500 MB database, 1 GB photo storage) is plenty |
| Claude API (`claude-haiku-4-5`) | Roughly 1¢ per receipt, so about $1/month at 100 receipts |

For better accuracy on long or crumpled receipts, change `MODEL` in `supabase/functions/scan-receipt/index.ts` to `claude-sonnet-5-5` (about 2× the price) or `claude-opus-5-5` (about 4×), then run `npm run deploy:functions`. Use the **Read items from photo** button on a saved receipt to compare results.

## Free web app (add to Home Screen)

The same code also builds as a website. Host it for free on Expo's hosting (EAS Hosting), and each person adds it to their iPhone home screen from Safari. It opens full-screen with its own icon. There's no Apple fee, and your Mac doesn't need to be running.

```bash
npm run deploy:functions                              # the server functions
npx eas-cli@latest login                              # same Expo account as Expo Go
npm run deploy:web                                    # builds the site and publishes it
```

The first deploy asks you to pick a name, which becomes your address: `https://your-name.expo.app`. The build uses the Supabase values from your local `.env`. Run `npm run deploy:web` again after any code change.

On each iPhone: open the address in **Safari**, tap **Share → Add to Home Screen**, then open the app from the new icon and sign in. The home-screen app keeps its own sign-in, separate from Safari.

To try the web version locally first: `npm run web`.

## Notifications

Notifications use Web Push, so they work in the web app once it's been added to an iPhone Home Screen (iOS 16.4 or later). They don't work in a Safari tab or in Expo Go.

- `notify-receipt` runs when someone saves an expense and notifies the other household members.
- `monthly-summary` is called by a database schedule on the 1st of each month.
- `public/sw.js` is the service worker that shows the notification on the phone.

One-time setup, after the database and functions from the Setup section exist:

1. **Keys.** `supabase/functions/.env` holds `VAPID_KEYS` (signs the notifications) and `CRON_SECRET` (lets only the schedule call `monthly-summary`). The matching public key is `EXPO_PUBLIC_VAPID_PUBLIC_KEY` in `.env`. Both files stay out of git. Upload the secrets:
   ```bash
   npx supabase secrets set --env-file supabase/functions/.env
   ```
2. **Functions.** `npm run deploy:functions` deploys all three. `monthly-summary` is deployed with `--no-verify-jwt` because the schedule authenticates with `CRON_SECRET` instead of a user sign-in.
3. **Schedule.** Run `supabase/monthly-cron.sql` in the SQL Editor, with `<PROJECT_URL>` and `<CRON_SECRET>` filled in.
4. **Web app.** `npm run deploy:web`.

If you ever replace `VAPID_KEYS`, every device has to turn notifications off and on again.

## Changing the database

The schema lives in `supabase/migrations/`. This project applies migrations by pasting each new file into the Supabase SQL Editor, in order, rather than with `supabase db push`. Write new migrations so they only add things and are safe to run twice, as `20261001000000_items_and_notifications.sql` does.

Deploy order matters: run the new SQL **before** deploying a web app version that depends on it.

## Installing for real (optional)

To install the app without a Mac running, build it with [EAS](https://docs.expo.dev/eas/). This needs an Apple Developer account ($99/year), and you don't need Xcode:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios   # uploads to TestFlight so your household can install it
```

## Project layout

```
src/app/                  screens (Expo Router)
  (tabs)/index.tsx        Scan: this month's total, scan buttons, recent receipts
  (tabs)/history.tsx      search + month/category filters
  (tabs)/insights.tsx     spending summaries and charts
  (tabs)/settings.tsx     household, invite code, members, account
  review.tsx              reads a scanned receipt; confirm and save
  receipt/[id].tsx        view, edit, or delete a receipt
  sign-in.tsx, setup.tsx  onboarding
src/lib/                  Supabase client, queries, scan pipeline, dates, money
src/providers/            session, household, and live-update state
supabase/migrations/      database schema and security rules
supabase/functions/       scan-receipt (Claude)
```

Categories are defined in three places that must stay in sync: `src/lib/categories.ts`, the `CATEGORIES` list in the edge function, and the `receipts.category` check constraint in the migration.

## Checks

```bash
npm run typecheck
npx expo lint
```

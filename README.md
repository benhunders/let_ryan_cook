# Let Him Cook 🍳

An UberEats-style app where **Ryan (the chef)** publishes a fresh menu each week and
**customers sign in with Google** to pick the dishes they want — with quantities and notes.

- **Frontend / hosting:** Next.js (App Router, TypeScript, Tailwind) on Vercel
- **Backend:** Supabase — Postgres + Auth (Google) + Storage (dish images)
- **Auth model:** Google OAuth via Supabase. Admins (Ryan + dev) are flagged with
  `profiles.is_admin` and enforced with Row Level Security, so customers can never edit menus.

## Features
- **Menu builder** (`/admin/menus/new`) — chef-only. Starts with 6 dish rows (add/remove
  freely), each with name, description, price, availability, and an image (upload to Supabase
  Storage **or** paste a URL). Publish toggle controls customer visibility.
- **Weekly menu + ordering** (`/`) — customers browse the published menu and submit one
  editable order per menu (per-dish quantity + note, plus an overall order note).
- **My orders** (`/orders`) — a customer's order history.
- **Chef order view** (`/admin/menus/[id]`) — prep totals + per-customer breakdown.
- **Roadmap:** automatic dish image search (Google/Unsplash) — scaffolded in
  `lib/imageSearch.ts`, not yet wired up.

## Local development
```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

## Environment variables
| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/publishable key |
| `RESEND_API_KEY` *(optional)* | Resend → API Keys. Enables order/status emails; if unset, emails are skipped. |
| `EMAIL_FROM` *(optional)* | A verified Resend sender, e.g. `Let Him Cook <hi@yourdomain.com>`. |

## Database
Schema lives in `supabase/migrations/`. Tables: `profiles`, `menus`, `dishes`, `orders`,
`order_items`, plus a public-read `dish-images` Storage bucket. Every table has RLS enabled.

## Google sign-in setup (one-time)
1. Create an OAuth client in the Google Cloud Console.
2. In Supabase → Authentication → Providers → Google, paste the Client ID + Secret.
3. Add your site URL and `<site>/auth/callback` to Supabase → Authentication → URL
   Configuration, and add the Supabase callback to the Google OAuth authorized redirect URIs.
4. Mark admins: set `is_admin = true` for Ryan's and the dev's rows in `profiles` (the
   `handle_new_user` trigger does this automatically for emails in the seeded allowlist).

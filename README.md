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
  editable order per menu (per-dish quantity + note, plus an overall order note). They pick
  a **payment method** (cash or meal ticket), and the **delivery day** + order deadline are
  shown up top. Ordering closes at the deadline, or earlier via the chef's "Close ordering
  now" toggle.
- **My orders** (`/orders`) — a customer's order history, with delivery day, chosen payment
  method, and whether the chef has marked it paid.
- **Chef order view / fulfillment** (`/admin/menus/[id]`) — prep totals, a payments summary
  (collected vs outstanding, cash vs ticket split), and a per-customer breakdown where the
  chef marks each order **paid** and advances its status.
- **Feedback** (`/feedback`) — customers send feedback tagged by category, including **dish
  requests** and **dietary needs**.
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
`order_items`, `feedback`, `ratings`, plus a public-read `dish-images` Storage bucket.
Every table has RLS enabled.

Writes go through two transactional RPCs rather than row-by-row requests:

- **`submit_order(menu_id, notes, items)`** — saves a customer's whole order
  atomically. The database validates everything: menu published, before the
  deadline, not locked by the chef, dishes on that menu and available,
  quantity 1–100. An empty item list withdraws the order.
- **`save_menu(menu_id, title, week_start, deadline, delivery_date, published, locked, dishes)`**
  — chef-only; saves menu meta + all dishes in one transaction (no more
  half-saved menus).

Order lines snapshot `dish_name`/`dish_price` at order time, so editing or
deleting a dish never rewrites (or erases) a customer's order history.
Profiles are readable only by their owner and admins. `orders.paid` is guarded
by a trigger so only admins can change it — a customer can never mark their own
order paid.

## CI
GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, and a
production build on every push/PR.

## Google sign-in setup (one-time)
1. Create an OAuth client in the Google Cloud Console.
2. In Supabase → Authentication → Providers → Google, paste the Client ID + Secret.
3. Add your site URL and `<site>/auth/callback` to Supabase → Authentication → URL
   Configuration, and add the Supabase callback to the Google OAuth authorized redirect URIs.
4. Mark admins: set `is_admin = true` for Ryan's and the dev's rows in `profiles` (the
   `handle_new_user` trigger does this automatically for emails in the seeded allowlist).

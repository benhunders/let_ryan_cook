# Let Him Cook — Product Roadmap

**Let Him Cook** is a weekly-menu ordering app: Ryan (the chef) publishes a fresh menu each week, and customers place one editable order per menu.

This roadmap captures where the app is headed next. It folds three user-requested features (admin panel, feedback, onboarding survey) together with four agreed additions into ordered delivery phases.

> **How to read this:** Phases are ordered by dependency and value, **not** by fixed dates. Each item notes the rough effort (S / M / L), what it reuses from today's codebase, and what it depends on. Tackle phases roughly in order, but individual items can be pulled forward if priorities shift.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres / Auth / Storage) · Tailwind CSS v4 · Vercel.

---

## Current State (MVP)

What exists today — the baseline everything below builds on:

- **Auth** — Google OAuth + email/password (sign-up, sign-in, password reset, email confirmation).
- **Roles** — `profiles.is_admin` flag driven by an `admin_allowlist` table; self-service admin management via `add_admin` / `remove_admin` RPCs. Admin pages under `app/admin/*` guarded by `requireAdmin()` (`lib/auth.ts`) and middleware (`lib/supabase/middleware.ts`).
- **Menus & dishes** — Admins create/edit/publish menus, each with dishes (name, description, price, image, availability). Dish images upload to a Supabase Storage bucket.
- **Ordering** — One editable order per customer per menu, with per-dish quantities/notes and an overall order note.
- **Order history** — Customers see their past orders at `/orders`; admins see per-menu prep totals and a per-customer breakdown at `/admin/menus/[id]`.
- **Account** — Profile view + GDPR account deletion (`delete_my_account()` RPC).

Data model: `profiles`, `menus`, `dishes`, `orders` (unique per `user_id`+`menu_id`, with an unused `status` field defaulting to `'submitted'`), `order_items`, `admin_allowlist`. Migrations live in `supabase/migrations/` (currently `0001`–`0005`); generated types in `types/database.ts`.

---

## Phased Roadmap

Each item below is documented as **What · Why · Key changes (DB / backend / UI) · Reuses · Effort · Dependencies**.

### Phase 1 — Admin visibility & dish labels ✅ *(implemented; on branch, pending merge)*

#### 1a. Admin panel: users + live order status `[user request]` ✅
- **What:** A dedicated admin view listing every user account alongside each user's current / recent orders and their status.
- **Why:** Ryan needs a single place to see who's signed up and where each order stands, without digging through individual menus.
- **Key changes:**
  - **DB:** None required to start — admin-read RLS on `profiles` and `orders` already exists. Optionally add a read-only SQL view or RPC that joins users → latest order → status for an efficient summary.
  - **UI:** New route `app/admin/users/page.tsx` — all `profiles` (name, email, joined date, role badge) with a per-user order list and status chips, linked from the admin dashboard.
- **Reuses:** `requireAdmin()` (`lib/auth.ts`), existing admin-read RLS policies, and the per-customer breakdown patterns already in `app/admin/menus/[id]/page.tsx`.
- **Effort:** M
- **Dependencies:** None. (Status chips become more meaningful once Phase 2 lands.)

#### 1b. Dish allergen & dietary labels `[user request — revised]` ✅
- **What:** Ryan tags each dish with allergens (the 14 EU-declared) and positive dietary tags (Vegetarian, Vegan, Gluten-free, Dairy-free); labels render on the menu with a guidance disclaimer.
- **Why & the privacy pivot:** This started as an *onboarding survey* storing each user's allergies. That data is GDPR special-category **health data** (and religious diet labels reveal belief), raising consent, access-control, and erasure obligations. We deliberately chose **not to store user health data** — instead we label the dishes and let the informed customer decide. Same outcome for safety, none of the privacy burden. This is the standard regulated-food-service model.
- **Key changes:**
  - **DB:** Migration `0006_dish_dietary.sql` adds `allergens text[]` and `dietary_tags text[]` to `dishes` (default `'{}'`). No new RLS — inherits the existing dish policies.
  - **UI:** Allergen/dietary chip toggles per dish in `components/MenuBuilder.tsx`; badges + "Contains:" line in `components/DishCard.tsx`; disclaimer on `app/page.tsx`. Shared values in `lib/dietary.ts`.
- **Reuses:** Existing dish CRUD, RLS, and card rendering.
- **Effort:** S–M
- **Dependencies:** None.

### Phase 2 — Order status workflow `[addition]` ✅ *(implemented; on branch, pending merge)*
- **What:** Turn the dormant `orders.status` field into a real state machine: `submitted → preparing → ready → completed` (plus `cancelled`).
- **Why:** Gives customers visibility into their order and gives Ryan a way to track prep progress.
- **Key changes:**
  - **DB:** Migration `0007_order_status.sql` adds a `orders_status_check` constraint on the allowed values, a `status_updated_at` timestamp, and an `orders_update_admin` RLS policy so admins can change status (customers keep `orders_update_own`).
  - **UI:** `components/OrderStatusControl.tsx` (admin status dropdown) wired into the per-customer breakdown in `app/admin/menus/[id]/page.tsx`; read-only status chips for customers on `app/orders/page.tsx` and the home page; shared helpers in `lib/orderStatus.ts`.
  - **Fix:** `components/OrderForm.tsx` no longer writes `status` on save, so a customer editing their order can't reset a chef-set status (new orders still default to `submitted`).
- **Reuses:** Existing `orders` table and admin order views; `is_admin()` for the RLS policy.
- **Effort:** M
- **Dependencies:** Pairs naturally with 1a. Feeds Phase 5 (notifications on status change).

### Phase 3 — Feedback & suggestions `[user request]` ✅ *(implemented; on branch, pending merge)*
- **What:** A "Provide feedback or suggestions" form for users — general feedback, with the option to attach it to a specific dish or menu.
- **Why:** Gives Ryan a direct signal channel for preferences and ideas, beyond order notes.
- **Key changes:**
  - **DB:** Migration `0008_feedback.sql` adds a `feedback` table (`user_id`, optional `dish_id` / `menu_id`, `category`, `body`, `created_at`). RLS: users insert/read their own; admins read all.
  - **UI:** `/feedback` page with `components/FeedbackForm.tsx` (category + optional "About" dish/menu selector, plus the user's past submissions); admin view at `app/admin/feedback/page.tsx`. Entry points: "Feedback" link in `components/Nav.tsx` and on the admin dashboard. Categories in `lib/feedback.ts`.
- **Reuses:** Standard Supabase insert/RLS patterns; admin-read + breakdown patterns from Phase 1.
- **Effort:** M
- **Dependencies:** None.

### Phase 4 — Personalized dietary filtering `[addition — deferred / likely declined]`
- **What:** Would let logged-in customers store their own allergies and auto-hide/warn on dishes they can't eat.
- **Status:** **Dish-level allergen & dietary labels already shipped in Phase 1b.** The remaining piece — *personalized* filtering — requires storing per-user allergy (health) data, which we intentionally chose to avoid for privacy reasons (see Phase 1b). Listed here for completeness; revisit only if there's clear demand and appetite for the GDPR special-category handling it entails (explicit consent, restricted access, erasure).
- **Effort:** M (plus privacy/compliance work)
- **Dependencies:** Would require introducing the user-preferences storage that Phase 1b deliberately dropped.

### Phase 5 — Email notifications (Resend) `[addition]` ✅ *(implemented; on branch, pending env config)*
- **What:** Confirmation to the customer + alert to Ryan when an order is saved; an email to the customer when Ryan changes the order status.
- **Why:** Keeps both sides informed without anyone having to refresh the app.
- **Key changes:**
  - **Backend:** `lib/email.ts` wraps the Resend SDK (no-ops without `RESEND_API_KEY`). Route handlers `app/api/notify/order/route.ts` and `app/api/notify/order-status/route.ts` authorize via the session and re-fetch order data server-side before sending.
  - **Client:** `components/OrderForm.tsx` and `components/OrderStatusControl.tsx` call those routes best-effort (fire-and-forget) after a successful write.
  - **Config:** `RESEND_API_KEY` + `EMAIL_FROM` (see `.env.local.example` / README).
- **Reuses:** Server Supabase client + RLS; Phase 2 `statusLabel`.
- **Effort:** M
- **Dependencies:** Phase 2 (status emails). **Action needed:** set `RESEND_API_KEY` and a verified `EMAIL_FROM` in the deployment env (e.g. Vercel) to turn emails on.
- **Note:** Delivery is best-effort (client-triggered). For guaranteed delivery regardless of the client, upgrade later to a Supabase DB webhook → Edge Function calling the same Resend logic.

### Phase 6 — Ratings & reviews `[addition]` ✅ *(implemented; on branch, pending merge)*
- **What:** Customers rate dishes (1–5) with an optional comment; one rating per user per dish.
- **Why:** Gives Ryan a structured quality signal to decide what to cook again.
- **Key changes:**
  - **DB:** Migration `0009_ratings.sql` adds a `ratings` table (`user_id`, `dish_id`, `rating` 1–5, `comment`, unique per user+dish). RLS: public read (for averages), users write only their own.
  - **UI:** `components/RatingControl.tsx` on `/orders` for dishes in **completed** orders (ties into the Phase 2 status); average rating on `components/DishCard.tsx` (menu) and per-dish on the admin menu page. Shared average helper in `lib/ratings.ts`.
- **Reuses:** Dish rendering, the upsert pattern, admin-read patterns from Phase 1.
- **Effort:** M
- **Dependencies:** Uses Phase 2 (`completed` status invites the rating).
- **Note:** RLS keeps users to their own rows; the UI (not RLS) limits ratings to dishes the user ordered. Tighten to an ordered-dish check if abuse appears.

---

## Backlog / Later

Captured but not yet committed to a phase:

- **Payments** — Stripe (or similar) so customers pay at order time.
- **Automated dish image search** — already scaffolded in `lib/imageSearch.ts`; wire it up.
- **Inventory / quantity caps** — per-dish max quantities so popular items can sell out.
- **Recurring menus** — templates / duplication instead of building each week from scratch.
- **Analytics** — basic usage and order metrics.
- **Timezone handling** — `menus.week_start` is currently a bare date with no timezone awareness.

---

## Cross-cutting Notes

- **RLS on everything** — every new table needs Row Level Security policies. Follow the existing patterns in `supabase/migrations/` (users read/write their own rows; admins gated by `is_admin()`).
- **Keep types in sync** — regenerate / update `types/database.ts` after each migration.
- **Next.js 16 is non-standard** — per `AGENTS.md`, this version has breaking changes vs. common conventions. Read the relevant guide in `node_modules/next/dist/docs/` before implementing any phase.

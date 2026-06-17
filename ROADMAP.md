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

### Phase 1 — Admin visibility & onboarding foundations

#### 1a. Admin panel: users + live order status `[user request]`
- **What:** A dedicated admin view listing every user account alongside each user's current / recent orders and their status.
- **Why:** Ryan needs a single place to see who's signed up and where each order stands, without digging through individual menus.
- **Key changes:**
  - **DB:** None required to start — admin-read RLS on `profiles` and `orders` already exists. Optionally add a read-only SQL view or RPC that joins users → latest order → status for an efficient summary.
  - **UI:** New route `app/admin/users/page.tsx` — a table of all `profiles` (name, email, joined date, admin badge) with an expandable per-user order list and status chips. Link it from the admin nav.
- **Reuses:** `requireAdmin()` (`lib/auth.ts`), existing admin-read RLS policies, and the per-customer breakdown patterns already in `app/admin/menus/[id]/page.tsx`.
- **Effort:** M
- **Dependencies:** None. (Status chips become more meaningful once Phase 2 lands.)

#### 1b. Onboarding allergy & preferences survey `[user request]`
- **What:** A short survey during onboarding capturing allergies, dietary preferences, and free-text notes — editable later from the account page.
- **Why:** Lets Ryan cook around real dietary needs and personalizes the experience from day one.
- **Key changes:**
  - **DB:** New migration `0006_user_preferences.sql` adding preference fields (allergies, dietary tags, free-text notes) plus an `onboarding_completed` flag — either as columns on `profiles` or a dedicated `user_preferences` table. RLS: users read/write their own; admins read.
  - **UI:** A post-signup onboarding step/route that prompts the survey (and redirects there until `onboarding_completed` is set), with an edit surface added to `app/account/page.tsx`.
- **Reuses:** Existing profile/auth flow and account page; the `handle_new_user()` trigger pattern from `supabase/migrations/0002_admin_settings.sql`.
- **Effort:** M
- **Dependencies:** None. Unlocks Phase 4 (dietary filtering).

### Phase 2 — Order status workflow `[addition]`
- **What:** Turn the dormant `orders.status` field into a real state machine: `submitted → preparing → ready → completed` (plus `cancelled`).
- **Why:** Gives customers visibility into their order and gives Ryan a way to track prep progress.
- **Key changes:**
  - **DB:** Migration `0007_order_status.sql` constraining `status` to the allowed values; optional `status_updated_at` timestamp. Add an RLS update policy so only admins can change status.
  - **UI:** Admin controls to advance status (in the Phase 1 admin panel and/or `app/admin/menus/[id]/page.tsx`); customer-facing status display on `app/orders/page.tsx` and the home page.
- **Reuses:** Existing `orders` table and admin order views; `is_admin()` for the RLS policy.
- **Effort:** M
- **Dependencies:** Pairs naturally with 1a. Feeds Phase 5 (notifications on status change).

### Phase 3 — Feedback & suggestions `[user request]`
- **What:** A "Provide feedback or suggestions" form for users — general feedback, with the option to attach it to a specific dish or menu.
- **Why:** Gives Ryan a direct signal channel for preferences and ideas, beyond order notes.
- **Key changes:**
  - **DB:** New migration `0008_feedback.sql` adding a `feedback` table (`user_id`, optional `dish_id` / `menu_id`, `body`, optional `category`, `created_at`). RLS: users insert/read their own; admins read all.
  - **UI:** A feedback entry point in the nav/account area + an admin view to read submissions (extend the Phase 1 admin panel).
- **Reuses:** Standard Supabase insert/RLS patterns; admin-read patterns from Phase 1.
- **Effort:** M
- **Dependencies:** None (admin view slots into the Phase 1 panel).

### Phase 4 — Dietary flags + filtering `[addition]`
- **What:** Tag dishes with allergens / dietary info; surface badges and warn or filter dishes based on each customer's saved allergy profile.
- **Why:** Closes the loop on the onboarding survey — turns stored preferences into a safer, personalized menu.
- **Key changes:**
  - **DB:** Migration extending `dishes` with allergen / dietary tags.
  - **UI:** Allergen badges on `components/DishCard.tsx`; warn/filter logic on the home menu driven by the customer's saved allergies; tag-editing controls in `components/MenuBuilder.tsx`.
- **Reuses:** Phase 1b preference data; existing dish rendering and menu builder.
- **Effort:** M
- **Dependencies:** Phase 1b (preferences must exist to filter against).

### Phase 5 — Email notifications `[addition]`
- **What:** Email customers on order confirmation and status changes; email Ryan on new orders.
- **Why:** Keeps both sides informed without anyone having to refresh the app.
- **Key changes:**
  - **Backend:** Implement via Supabase (Auth SMTP / Edge Functions / database webhooks) or a transactional provider (e.g. Resend). Trigger on order insert and on status transitions.
- **Reuses:** Order insert path in `components/OrderForm.tsx`; the Phase 2 status transitions.
- **Effort:** M–L
- **Dependencies:** Phase 2 (status-change emails depend on the status workflow). Requires SMTP/provider configuration.

### Phase 6 — Ratings & reviews `[addition]`
- **What:** Let customers rate dishes after a menu closes, with an optional comment.
- **Why:** Gives Ryan a structured quality signal to decide what to cook again.
- **Key changes:**
  - **DB:** New `ratings` table (`user_id`, `dish_id`, `rating`, optional `comment`). RLS: users write their own and read aggregates; admin aggregate view.
  - **UI:** Rating prompt after a menu closes; average rating surfaced on `components/DishCard.tsx`; admin aggregate view.
- **Reuses:** Dish rendering; admin-read patterns from Phase 1.
- **Effort:** M
- **Dependencies:** Benefits from Phase 2 (`completed` status as the trigger to invite a rating).

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

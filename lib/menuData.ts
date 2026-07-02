import { unstable_cache } from "next/cache";
import { createClient as createAnonSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { averagesByDish } from "@/lib/ratings";
import type { Database, Dish, Menu } from "@/types/database";

// Cache tag for the public menu; the save-menu server action revalidates it.
export const PUBLISHED_MENU_TAG = "published-menu";

type RatingMap = Record<string, { avg: number; count: number }>;

// Cookie-less anon client. It sees only what RLS exposes to anonymous
// visitors (published menus + their dishes, ratings), which is exactly what
// makes the result safe to cache and share across requests.
function anonClient() {
  return createAnonSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// The latest published menu with its dishes and rating averages. Cached
// across requests so anonymous traffic doesn't hit Postgres on every page
// view; invalidated when the chef saves a menu, and refreshed at most every
// 5 minutes to pick up new ratings.
export const getPublishedMenuData = unstable_cache(
  async (): Promise<{
    menu: Menu;
    dishes: Dish[];
    ratingByDish: RatingMap;
  } | null> => {
    const supabase = anonClient();

    const { data, error } = await supabase
      .from("menus")
      .select("*, dishes(*)")
      .eq("published", true)
      .order("week_start", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to load the menu: ${error.message}`);
    if (!data) return null;

    const { dishes: menuDishes, ...menu } = data;
    const dishes = (menuDishes ?? []).sort((a, b) => a.position - b.position);

    const dishIds = dishes.map((d) => d.id);
    const { data: ratings, error: ratingsError } = dishIds.length
      ? await supabase
          .from("ratings")
          .select("dish_id, rating")
          .in("dish_id", dishIds)
      : { data: [], error: null };
    if (ratingsError)
      throw new Error(`Failed to load ratings: ${ratingsError.message}`);

    return {
      menu,
      dishes,
      ratingByDish: Object.fromEntries(averagesByDish(ratings ?? [])),
    };
  },
  ["published-menu-data"],
  { tags: [PUBLISHED_MENU_TAG], revalidate: 300 }
);

// A signed-in user's existing order on a menu, for prefilling the form.
// Per-request (session-bound), so never cached. The explicit user filter
// matters for admins, whose RLS read scope covers everyone's orders.
export async function loadUserOrder(menuId: string, userId: string) {
  const supabase = await createClient();

  const initialItems: Record<string, { quantity: number; note: string }> = {};
  let initialNotes = "";
  let orderStatus: string | null = null;

  const { data: order, error } = await supabase
    .from("orders")
    .select("notes, status, order_items(dish_id, quantity, note)")
    .eq("menu_id", menuId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load your order: ${error.message}`);

  if (order) {
    initialNotes = order.notes ?? "";
    orderStatus = order.status;
    for (const it of order.order_items) {
      if (it.dish_id) {
        initialItems[it.dish_id] = {
          quantity: it.quantity,
          note: it.note ?? "",
        };
      }
    }
  }

  return { initialItems, initialNotes, orderStatus };
}

// Uncached loader for the admin preview page: uses the admin's session so
// drafts are visible, and includes their own test order if any.
export async function loadMenuViewData(menu: Menu, userId: string | null) {
  const supabase = await createClient();

  const { data: dishes, error } = await supabase
    .from("dishes")
    .select("*")
    .eq("menu_id", menu.id)
    .order("position", { ascending: true });
  if (error) throw new Error(`Failed to load dishes: ${error.message}`);

  const dishIds = (dishes ?? []).map((d) => d.id);
  const { data: ratings } = dishIds.length
    ? await supabase
        .from("ratings")
        .select("dish_id, rating")
        .in("dish_id", dishIds)
    : { data: [] };
  const ratingByDish = Object.fromEntries(averagesByDish(ratings ?? []));

  const order = userId
    ? await loadUserOrder(menu.id, userId)
    : { initialItems: {}, initialNotes: "", orderStatus: null };

  return { dishes: dishes ?? [], ratingByDish, ...order };
}

import { createClient } from "@/lib/supabase/server";
import { averagesByDish } from "@/lib/ratings";
import type { Menu } from "@/types/database";

// Loads everything the customer-facing menu view needs: dishes, average
// ratings, and (for a signed-in user) their existing order to prefill. Shared
// by the public home page and the admin preview page.
export async function loadMenuViewData(menu: Menu, userId: string | null) {
  const supabase = await createClient();

  const { data: dishes } = await supabase
    .from("dishes")
    .select("*")
    .eq("menu_id", menu.id)
    .order("position", { ascending: true });

  const dishIds = (dishes ?? []).map((d) => d.id);
  const { data: ratings } = dishIds.length
    ? await supabase.from("ratings").select("dish_id, rating").in("dish_id", dishIds)
    : { data: [] };
  const ratingByDish = Object.fromEntries(averagesByDish(ratings ?? []));

  const initialItems: Record<string, { quantity: number; note: string }> = {};
  let initialNotes = "";
  let orderStatus: string | null = null;
  if (userId) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, notes, status")
      .eq("menu_id", menu.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (order) {
      initialNotes = order.notes ?? "";
      orderStatus = order.status;
      const { data: existing } = await supabase
        .from("order_items")
        .select("dish_id, quantity, note")
        .eq("order_id", order.id);
      for (const it of existing ?? []) {
        initialItems[it.dish_id] = { quantity: it.quantity, note: it.note ?? "" };
      }
    }
  }

  return {
    dishes: dishes ?? [],
    ratingByDish,
    initialItems,
    initialNotes,
    orderStatus,
  };
}

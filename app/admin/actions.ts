"use server";

import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PUBLISHED_MENU_TAG } from "@/lib/menuData";
import type { Json } from "@/types/database";

export type SaveMenuInput = {
  menuId: string | null;
  title: string;
  weekStart: string | null;
  orderDeadline: string | null;
  published: boolean;
  ordersLocked: boolean;
  dishes: {
    id: string | null;
    name: string;
    description: string;
    price: string;
    image_url: string;
    available: boolean;
    allergens: string[];
    dietary_tags: string[];
  }[];
};

// Saves the whole menu (meta + dishes) in one transaction via the save_menu
// RPC — the database validates admin rights and every field — then drops the
// cached public menu so customers see the change immediately.
export async function saveMenuAction(
  input: SaveMenuInput
): Promise<{ menuId?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_menu", {
    p_menu_id: input.menuId,
    p_title: input.title,
    p_week_start: input.weekStart,
    p_order_deadline: input.orderDeadline,
    p_published: input.published,
    p_orders_locked: input.ordersLocked,
    p_dishes: input.dishes as unknown as Json,
  });

  if (error) return { error: error.message };

  // Expire immediately: after publishing, the chef checks the homepage and
  // must see the new menu on the very next request (not stale-while-revalidate).
  revalidateTag(PUBLISHED_MENU_TAG, { expire: 0 });
  return { menuId: data ?? undefined };
}

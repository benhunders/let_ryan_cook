"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PUBLISHED_MENU_TAG } from "@/lib/menuData";
import type { Json } from "@/types/database";

export type SaveMenuInput = {
  menuId: string | null;
  title: string;
  weekStart: string | null;
  orderDeadline: string | null;
  deliveryDate: string | null;
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
    p_delivery_date: input.deliveryDate,
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

// Draft a one-line menu description from a dish name so the chef can focus on
// cooking, not copywriting. Admin-gated (it spends the API key); degrades
// gracefully when ANTHROPIC_API_KEY isn't configured. Uses Haiku 4.5 — a fast,
// low-cost model that's plenty for a single appetising sentence.
export async function generateDishDescriptionAction(
  name: string
): Promise<{ description?: string; error?: string }> {
  const dish = name.trim();
  if (!dish) return { error: "Enter a dish name first." };
  if (dish.length > 120) return { error: "Dish name is too long." };

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { error: "Only the chef can generate descriptions." };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "AI descriptions aren't configured (no ANTHROPIC_API_KEY)." };
  }

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      system:
        "You write short, appetising menu descriptions for a home chef's weekly menu. " +
        "Given a dish name, reply with ONE sentence (max 20 words) describing it — " +
        "infer the cuisine and likely key ingredients from the name. " +
        "Plain text only: no quotes, no line breaks, no leading label, do not repeat the dish name as a title.",
      messages: [{ role: "user", content: dish }],
    });

    const description = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!description) return { error: "Couldn't generate a description — try again." };
    return { description };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Description generation failed.";
    return { error: msg };
  }
}

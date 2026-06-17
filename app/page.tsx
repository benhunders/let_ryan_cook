import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { DishCard } from "@/components/DishCard";
import { OrderForm } from "@/components/OrderForm";
import { statusChipClass, statusLabel } from "@/lib/orderStatus";

export const dynamic = "force-dynamic";

function formatWeek(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

export default async function Home() {
  const supabase = await createClient();
  const user = await getUser();

  // Latest published menu.
  const { data: menu } = await supabase
    .from("menus")
    .select("*")
    .eq("published", true)
    .order("week_start", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!menu) {
    return (
      <div className="text-center mt-16">
        <h1 className="text-3xl font-bold mb-2">No menu yet 🍲</h1>
        <p className="text-black/60">
          The chef hasn&apos;t published this week&apos;s menu. Check back soon!
        </p>
      </div>
    );
  }

  const { data: dishes } = await supabase
    .from("dishes")
    .select("*")
    .eq("menu_id", menu.id)
    .order("position", { ascending: true });

  // Prefill the form with the user's existing order, if any.
  const initialItems: Record<string, { quantity: number; note: string }> = {};
  let initialNotes = "";
  let orderStatus: string | null = null;
  if (user) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, notes, status")
      .eq("menu_id", menu.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (order) {
      initialNotes = order.notes ?? "";
      orderStatus = order.status;
      const { data: existing } = await supabase
        .from("order_items")
        .select("dish_id, quantity, note")
        .eq("order_id", order.id);
      for (const it of existing ?? []) {
        initialItems[it.dish_id] = {
          quantity: it.quantity,
          note: it.note ?? "",
        };
      }
    }
  }

  const hasLabels = (dishes ?? []).some(
    (d) => (d.allergens ?? []).length > 0 || (d.dietary_tags ?? []).length > 0
  );

  return (
    <div>
      <div className="mb-6">
        <p className="text-brand font-medium">
          {menu.week_start ? `Week of ${formatWeek(menu.week_start)}` : "This week"}
        </p>
        <h1 className="text-3xl font-bold">{menu.title}</h1>
        {orderStatus && (
          <p className="mt-2 text-sm text-black/60">
            Your order:{" "}
            <span
              className={`rounded-full text-xs px-2.5 py-1 ${statusChipClass(
                orderStatus
              )}`}
            >
              {statusLabel(orderStatus)}
            </span>
          </p>
        )}
        {hasLabels && (
          <p className="mt-2 text-sm text-black/50">
            Allergen and dietary labels are a guide only. If you have a severe
            allergy, please message Ryan before ordering.
          </p>
        )}
      </div>

      {user ? (
        <OrderForm
          menuId={menu.id}
          dishes={dishes ?? []}
          initialItems={initialItems}
          initialNotes={initialNotes}
        />
      ) : (
        <>
          <div className="mb-5 rounded-lg bg-brand/10 text-brand-dark px-4 py-3 text-sm">
            <Link href="/login" className="font-semibold underline">
              Sign in
            </Link>{" "}
            to choose your dishes for the week.
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(dishes ?? []).map((d) => (
              <DishCard key={d.id} dish={d} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

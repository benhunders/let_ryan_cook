import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MenuBuilder } from "@/components/MenuBuilder";

export const dynamic = "force-dynamic";

export default async function EditMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: menu } = await supabase
    .from("menus")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!menu) notFound();

  const { data: dishes } = await supabase
    .from("dishes")
    .select("*")
    .eq("menu_id", id)
    .order("position", { ascending: true });

  // Orders for this menu (admins can read all via RLS).
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("menu_id", id)
    .order("created_at", { ascending: true });

  const orderIds = (orders ?? []).map((o) => o.id);
  const userIds = [...new Set((orders ?? []).map((o) => o.user_id))];

  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };
  const { data: items } = orderIds.length
    ? await supabase.from("order_items").select("*").in("order_id", orderIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const dishById = new Map((dishes ?? []).map((d) => [d.id, d]));

  // Tally total quantity per dish across all orders.
  const tally = new Map<string, number>();
  for (const it of items ?? []) {
    tally.set(it.dish_id, (tally.get(it.dish_id) ?? 0) + it.quantity);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-6">Edit menu</h1>
        <MenuBuilder menu={menu} dishes={dishes ?? []} />
      </div>

      <section>
        <h2 className="text-xl font-bold mb-1">
          Orders ({orders?.length ?? 0})
        </h2>
        <p className="text-sm text-black/50 mb-4">
          Who ordered what this week.
        </p>

        {!orders || orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-black/50">
            No orders yet.
          </div>
        ) : (
          <>
            {/* Prep tally */}
            <div className="rounded-xl border border-black/10 bg-white p-4 mb-5">
              <h3 className="font-semibold mb-2">Prep totals</h3>
              <ul className="text-sm grid gap-1 sm:grid-cols-2">
                {[...tally.entries()].map(([dishId, qty]) => (
                  <li key={dishId} className="flex justify-between gap-3">
                    <span>{dishById.get(dishId)?.name ?? "Dish"}</span>
                    <span className="font-medium tabular-nums">×{qty}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Per-customer breakdown */}
            <div className="space-y-3">
              {orders.map((order) => {
                const profile = profileById.get(order.user_id);
                const orderItems = (items ?? []).filter(
                  (i) => i.order_id === order.id
                );
                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-black/10 bg-white p-4"
                  >
                    <div className="font-semibold mb-1">
                      {profile?.full_name ?? profile?.email ?? "Customer"}
                    </div>
                    <ul className="text-sm divide-y divide-black/5">
                      {orderItems.map((it) => (
                        <li key={it.id} className="py-1.5">
                          {it.quantity} × {dishById.get(it.dish_id)?.name ?? "Dish"}
                          {it.note && (
                            <span className="text-black/50"> — {it.note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {order.notes && (
                      <p className="mt-2 text-sm text-black/60">
                        <span className="font-medium">Notes:</span>{" "}
                        {order.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

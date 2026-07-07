import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MenuBuilder } from "@/components/MenuBuilder";
import { OrderStatusControl } from "@/components/OrderStatusControl";
import { PaidControl } from "@/components/PaidControl";
import { averagesByDish } from "@/lib/ratings";
import { paymentLabel } from "@/lib/payment";

export const dynamic = "force-dynamic";

export default async function EditMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: menuRow, error: menuError } = await supabase
    .from("menus")
    .select("*, dishes(*)")
    .eq("id", id)
    .maybeSingle();
  if (menuError) throw new Error(`Failed to load the menu: ${menuError.message}`);
  if (!menuRow) notFound();

  const { dishes: menuDishes, ...menu } = menuRow;
  const dishes = (menuDishes ?? []).sort((a, b) => a.position - b.position);

  // Orders with customer + items in one query (admins read all via RLS).
  // Item names/prices come from the order-time snapshot, so the view stays
  // truthful even after dishes are edited or removed.
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "*, profiles(full_name, email), order_items(id, dish_id, quantity, note, dish_name, dish_price)"
    )
    .eq("menu_id", id)
    .order("created_at", { ascending: true });
  if (ordersError)
    throw new Error(`Failed to load orders: ${ordersError.message}`);

  // Average rating per dish on this menu (admin aggregate view).
  const dishIds = dishes.map((d) => d.id);
  const { data: ratings } = dishIds.length
    ? await supabase
        .from("ratings")
        .select("dish_id, rating")
        .in("dish_id", dishIds)
    : { data: [] };
  const ratingByDish = averagesByDish(ratings ?? []);

  // Tally total quantity per dish across all orders, keyed so lines from
  // since-deleted dishes (dish_id null, snapshot name kept) still show up.
  const allItems = (orders ?? []).flatMap((o) => o.order_items);
  const tally = new Map<string, { name: string; qty: number; dishId: string | null }>();
  for (const it of allItems) {
    const key = it.dish_id ?? `deleted:${it.dish_name ?? "Dish"}`;
    const cur = tally.get(key) ?? {
      name: it.dish_name ?? "Dish",
      qty: 0,
      dishId: it.dish_id,
    };
    cur.qty += it.quantity;
    tally.set(key, cur);
  }

  const orderTotal = (items: typeof allItems) =>
    items.reduce((s, it) => s + (it.dish_price ?? 0) * it.quantity, 0);
  const revenue = orderTotal(allItems);

  // Payment fulfillment rollup: how much is collected, and the split by method.
  const paidRevenue = (orders ?? [])
    .filter((o) => o.paid)
    .reduce((s, o) => s + orderTotal(o.order_items), 0);
  const cashRevenue = (orders ?? [])
    .filter((o) => o.payment_method === "cash")
    .reduce((s, o) => s + orderTotal(o.order_items), 0);
  const transferRevenue = revenue - cashRevenue;
  const paidCount = (orders ?? []).filter((o) => o.paid).length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-6">Edit menu</h1>
        <MenuBuilder menu={menu} dishes={dishes} />
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Prep totals</h3>
                {revenue > 0 && (
                  <span className="text-sm text-black/60">
                    Total{" "}
                    <span className="font-medium tabular-nums">
                      €{revenue.toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
              <ul className="text-sm grid gap-1 sm:grid-cols-2">
                {[...tally.values()].map((row) => {
                  const r = row.dishId ? ratingByDish.get(row.dishId) : null;
                  return (
                    <li
                      key={row.dishId ?? row.name}
                      className="flex justify-between gap-3"
                    >
                      <span>{row.name}</span>
                      <span className="flex items-center gap-3">
                        {r && (
                          <span className="text-amber-600 tabular-nums">
                            ★ {r.avg.toFixed(1)} ({r.count})
                          </span>
                        )}
                        <span className="font-medium tabular-nums">
                          ×{row.qty}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Payments / fulfillment summary */}
            <div className="rounded-xl border border-black/10 bg-white p-4 mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Payments</h3>
                <span className="text-sm text-black/60">
                  {paidCount}/{orders.length} paid
                </span>
              </div>
              <div className="grid gap-1 text-sm sm:grid-cols-3">
                <div className="flex justify-between gap-3">
                  <span className="text-black/60">Collected</span>
                  <span className="font-medium tabular-nums text-green-700">
                    €{paidRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-black/60">💶 Cash</span>
                  <span className="font-medium tabular-nums">
                    €{cashRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-black/60">🏦 Transfer</span>
                  <span className="font-medium tabular-nums">
                    €{transferRevenue.toFixed(2)}
                  </span>
                </div>
              </div>
              {paidRevenue < revenue && (
                <p className="mt-2 text-sm text-amber-700">
                  €{(revenue - paidRevenue).toFixed(2)} still outstanding.
                </p>
              )}
            </div>

            {/* Per-customer breakdown */}
            <div className="space-y-3">
              {orders.map((order) => {
                const total = orderTotal(order.order_items);
                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-black/10 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="font-semibold">
                        {order.profiles?.full_name ??
                          order.profiles?.email ??
                          "Customer"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-black/5 text-black/70 text-xs px-2.5 py-1">
                          {order.payment_method === "cash" ? "💶" : "🏦"}{" "}
                          {paymentLabel(order.payment_method)}
                        </span>
                        <PaidControl orderId={order.id} paid={order.paid} />
                        <OrderStatusControl
                          orderId={order.id}
                          status={order.status}
                        />
                      </div>
                    </div>
                    <ul className="text-sm divide-y divide-black/5">
                      {order.order_items.map((it) => (
                        <li key={it.id} className="py-1.5">
                          {it.quantity} × {it.dish_name ?? "Dish"}
                          {it.note && (
                            <span className="text-black/50"> — {it.note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {total > 0 && (
                      <p className="mt-2 text-sm text-black/60 text-right tabular-nums">
                        €{total.toFixed(2)}
                      </p>
                    )}
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

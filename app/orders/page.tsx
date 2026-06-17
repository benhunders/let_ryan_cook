import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { statusChipClass, statusLabel } from "@/lib/orderStatus";
import { RatingControl } from "@/components/RatingControl";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/orders");
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center mt-16">
        <h1 className="text-2xl font-bold mb-2">No orders yet</h1>
        <p className="text-black/60 mb-4">
          Pick your dishes from this week&apos;s menu.
        </p>
        <Link
          href="/"
          className="rounded-md bg-brand text-white px-4 py-2 font-medium hover:bg-brand-dark"
        >
          View the menu
        </Link>
      </div>
    );
  }

  // Resolve related menus, items and dish names with explicit lookups.
  const menuIds = [...new Set(orders.map((o) => o.menu_id))];
  const orderIds = orders.map((o) => o.id);

  const { data: menus } = await supabase
    .from("menus")
    .select("id, title, week_start")
    .in("id", menuIds);
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);

  const dishIds = [...new Set((items ?? []).map((i) => i.dish_id))];
  const { data: dishes } = dishIds.length
    ? await supabase.from("dishes").select("id, name, price").in("id", dishIds)
    : { data: [] };

  // The user's own ratings, so completed-order dishes show their current value.
  const { data: myRatings } = dishIds.length
    ? await supabase
        .from("ratings")
        .select("dish_id, rating, comment")
        .eq("user_id", user.id)
        .in("dish_id", dishIds)
    : { data: [] };

  const menuById = new Map((menus ?? []).map((m) => [m.id, m]));
  const dishById = new Map((dishes ?? []).map((d) => [d.id, d]));
  const myRatingByDish = new Map(
    (myRatings ?? []).map((r) => [r.dish_id, r])
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My orders</h1>
      <div className="space-y-5">
        {orders.map((order) => {
          const menu = menuById.get(order.menu_id);
          const orderItems = (items ?? []).filter(
            (i) => i.order_id === order.id
          );
          return (
            <div
              key={order.id}
              className="rounded-xl border border-black/10 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="font-semibold">
                  {menu?.title ?? "Menu"}
                </h2>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full text-xs px-2.5 py-1 ${statusChipClass(
                      order.status
                    )}`}
                  >
                    {statusLabel(order.status)}
                  </span>
                  <Link href="/" className="text-sm text-brand hover:underline">
                    Edit
                  </Link>
                </div>
              </div>
              <ul className="text-sm divide-y divide-black/5">
                {orderItems.map((it) => {
                  const dish = dishById.get(it.dish_id);
                  const myRating = myRatingByDish.get(it.dish_id);
                  return (
                    <li key={it.id} className="py-1.5">
                      <div className="flex justify-between gap-3">
                        <span>
                          {it.quantity} × {dish?.name ?? "Dish"}
                          {it.note && (
                            <span className="text-black/50"> — {it.note}</span>
                          )}
                        </span>
                        {dish?.price != null && (
                          <span className="text-black/50 whitespace-nowrap">
                            ${(dish.price * it.quantity).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {order.status === "completed" && (
                        <RatingControl
                          dishId={it.dish_id}
                          initialRating={myRating?.rating ?? null}
                          initialComment={myRating?.comment ?? ""}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
              {order.notes && (
                <p className="mt-3 text-sm text-black/60">
                  <span className="font-medium">Notes:</span> {order.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

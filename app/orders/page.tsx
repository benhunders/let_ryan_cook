import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { statusChipClass, statusLabel } from "@/lib/orderStatus";
import { paymentLabel } from "@/lib/payment";
import { RatingControl } from "@/components/RatingControl";

export const dynamic = "force-dynamic";

function formatDeliveryDay(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function OrdersPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/orders");
  const supabase = await createClient();

  // One query: orders with their menu and items. Item names/prices come from
  // the snapshot taken at order time, so history survives menu edits.
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "*, menus(title, week_start, delivery_date), order_items(id, dish_id, quantity, note, dish_name, dish_price)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Failed to load your orders: ${error.message}`);

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

  // The user's own ratings, so completed-order dishes show their current value.
  const dishIds = [
    ...new Set(
      orders
        .flatMap((o) => o.order_items)
        .map((i) => i.dish_id)
        .filter((id): id is string => !!id)
    ),
  ];
  const { data: myRatings } = dishIds.length
    ? await supabase
        .from("ratings")
        .select("dish_id, rating, comment")
        .eq("user_id", user.id)
        .in("dish_id", dishIds)
    : { data: [] };
  const myRatingByDish = new Map((myRatings ?? []).map((r) => [r.dish_id, r]));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My orders</h1>
      <div className="space-y-5">
        {orders.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border border-black/10 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className="font-semibold">{order.menus?.title ?? "Menu"}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full text-xs px-2.5 py-1 ${statusChipClass(
                    order.status
                  )}`}
                >
                  {statusLabel(order.status)}
                </span>
                <span
                  className={
                    order.paid
                      ? "rounded-full bg-green-100 text-green-800 text-xs px-2.5 py-1"
                      : "rounded-full bg-black/5 text-black/60 text-xs px-2.5 py-1"
                  }
                >
                  {order.paid ? "✓ Paid" : "Unpaid"}
                </span>
                <Link href="/" className="text-sm text-brand hover:underline">
                  Edit
                </Link>
              </div>
            </div>
            <p className="text-sm text-black/50 mb-2">
              {order.menus?.delivery_date && (
                <>🚚 Delivery {formatDeliveryDay(order.menus.delivery_date)} · </>
              )}
              Paying by {paymentLabel(order.payment_method).toLowerCase()}
            </p>
            <ul className="text-sm divide-y divide-black/5">
              {order.order_items.map((it) => {
                const myRating = it.dish_id
                  ? myRatingByDish.get(it.dish_id)
                  : undefined;
                return (
                  <li key={it.id} className="py-1.5">
                    <div className="flex justify-between gap-3">
                      <span>
                        {it.quantity} × {it.dish_name ?? "Dish"}
                        {it.note && (
                          <span className="text-black/50"> — {it.note}</span>
                        )}
                      </span>
                      {it.dish_price != null && (
                        <span className="text-black/50 whitespace-nowrap">
                          €{(it.dish_price * it.quantity).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {order.status === "completed" && it.dish_id && (
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
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { DishCard } from "@/components/DishCard";
import { OrderForm } from "@/components/OrderForm";
import { DeadlineLabel } from "@/components/DeadlineLabel";
import { statusChipClass, statusLabel } from "@/lib/orderStatus";
import type { Dish, Menu } from "@/types/database";

function formatWeek(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

// The customer-facing menu experience, shared by the public home page and the
// admin preview page. In `preview` mode the deadline lock is ignored so an
// admin can test ordering on a draft, and a preview banner is shown.
export function MenuView({
  menu,
  dishes,
  ratingByDish,
  initialItems,
  initialNotes,
  orderStatus,
  isLoggedIn,
  preview = false,
}: {
  menu: Menu;
  dishes: Dish[];
  ratingByDish: Record<string, { avg: number; count: number }>;
  initialItems: Record<string, { quantity: number; note: string }>;
  initialNotes: string;
  orderStatus: string | null;
  isLoggedIn: boolean;
  preview?: boolean;
}) {
  const hasLabels = dishes.some(
    (d) => (d.allergens ?? []).length > 0 || (d.dietary_tags ?? []).length > 0
  );

  // Per-request server component (force-dynamic): reading the clock here is
  // intentional, to evaluate the order deadline against "now".
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const deadlinePassed = menu.order_deadline
    ? new Date(menu.order_deadline).getTime() <= nowMs
    : false;
  // In preview, admins can always order so they can test the flow.
  const closed = !preview && (deadlinePassed || menu.orders_locked);

  return (
    <div>
      {preview && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand-dark">
          <span className="font-semibold">👁 Preview</span>
          <span>
            This is how customers see this menu
            {menu.published ? " (it is live)." : " — it is not published yet."}
          </span>
          <Link
            href={`/admin/menus/${menu.id}`}
            className="ml-auto font-medium underline"
          >
            Back to editor
          </Link>
        </div>
      )}

      <div className="mb-6">
        <p className="text-brand font-medium">
          {menu.week_start ? `Week of ${formatWeek(menu.week_start)}` : "This week"}
        </p>
        <h1 className="text-3xl font-bold">{menu.title}</h1>
        {menu.order_deadline && !deadlinePassed && (
          <p className="mt-1 text-sm text-black/70">
            🕒 Order by <DeadlineLabel iso={menu.order_deadline} />
          </p>
        )}
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

      {closed ? (
        <>
          <div className="mb-5 rounded-lg bg-amber-50 text-amber-800 px-4 py-3 text-sm">
            Ordering for this menu has closed
            {deadlinePassed && menu.order_deadline ? (
              <>
                {" "}
                (deadline was <DeadlineLabel iso={menu.order_deadline} />)
              </>
            ) : null}
            .{isLoggedIn ? " You can still view your order under “My order”." : ""}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.map((d) => (
              <DishCard key={d.id} dish={d} rating={ratingByDish[d.id]} />
            ))}
          </div>
        </>
      ) : isLoggedIn ? (
        <OrderForm
          menuId={menu.id}
          dishes={dishes}
          initialItems={initialItems}
          initialNotes={initialNotes}
          ratingByDish={ratingByDish}
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
            {dishes.map((d) => (
              <DishCard key={d.id} dish={d} rating={ratingByDish[d.id]} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

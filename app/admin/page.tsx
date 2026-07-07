import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Menus with their order count aggregated in the database (previously this
  // fetched every order row ever just to count them).
  const { data: menus, error } = await supabase
    .from("menus")
    .select("*, orders(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load menus: ${error.message}`);

  const orderCount = new Map(
    (menus ?? []).map((m) => [m.id, m.orders[0]?.count ?? 0])
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Chef dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">          <Link
            href="/admin/users"
            className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5"
          >
            Users
          </Link>
          <Link
            href="/admin/feedback"
            className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5"
          >
            Feedback
          </Link>
          <Link
            href="/admin/settings"
            className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5"
          >
            Settings
          </Link>
          <Link
            href="/admin/menus/new"
            className="rounded-md bg-brand text-white px-4 py-2 font-medium hover:bg-brand-dark"
          >
            + New menu
          </Link>
        </div>
      </div>

      {!menus || menus.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-black/60">
          No menus yet. Create your first weekly menu to get cooking.
        </div>
      ) : (
        <div className="space-y-3">
          {menus.map((menu) => (
            <Link
              key={menu.id}
              href={`/admin/menus/${menu.id}`}
              className="flex items-center justify-between rounded-xl border border-black/10 bg-white p-4 hover:border-brand/40"
            >
              <div>
                <div className="font-semibold">{menu.title}</div>
                <div className="text-sm text-black/50">
                  {menu.week_start ?? "No date"} ·{" "}
                  {orderCount.get(menu.id) ?? 0} order
                  {(orderCount.get(menu.id) ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
              <span
                className={
                  menu.published
                    ? "shrink-0 rounded-full bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1"
                    : "shrink-0 rounded-full bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1"
                }
              >
                {menu.published ? "Published" : "● Draft"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: menus } = await supabase
    .from("menus")
    .select("*")
    .order("created_at", { ascending: false });

  // Count orders per menu.
  const { data: orders } = await supabase.from("orders").select("id, menu_id");
  const orderCount = new Map<string, number>();
  for (const o of orders ?? []) {
    orderCount.set(o.menu_id, (orderCount.get(o.menu_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Chef dashboard</h1>
        <div className="flex items-center gap-3">
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
                    ? "rounded-full bg-green-100 text-green-700 text-xs px-2.5 py-1"
                    : "rounded-full bg-black/10 text-black/60 text-xs px-2.5 py-1"
                }
              >
                {menu.published ? "Published" : "Draft"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

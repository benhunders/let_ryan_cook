import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";

export const dynamic = "force-dynamic";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Color map for order status chips. All orders are "submitted" today; the rest
// are ready for the Phase 2 status workflow.
function statusChip(status: string) {
  const styles: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-700",
    preparing: "bg-amber-100 text-amber-800",
    ready: "bg-green-100 text-green-700",
    completed: "bg-black/10 text-black/60",
    cancelled: "bg-red-100 text-red-700",
  };
  return styles[status] ?? "bg-black/10 text-black/60";
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Admins can read all profiles and orders via RLS.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: menus } = await supabase
    .from("menus")
    .select("id, title, week_start");

  const menuById = new Map((menus ?? []).map((m) => [m.id, m]));
  const ordersByUser = new Map<string, Order[]>();
  for (const o of orders ?? []) {
    const list = ordersByUser.get(o.user_id) ?? [];
    list.push(o);
    ordersByUser.set(o.user_id, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <Link
          href="/admin"
          className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5"
        >
          ← Dashboard
        </Link>
      </div>

      {!profiles || profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-black/60">
          No users yet.
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => {
            const userOrders = ordersByUser.get(p.id) ?? [];
            return (
              <div
                key={p.id}
                className="rounded-xl border border-black/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {p.full_name ?? p.email ?? "Customer"}
                    </div>
                    <div className="text-sm text-black/50">
                      {p.email ?? "—"} · joined {formatDate(p.created_at)}
                    </div>
                  </div>
                  <span
                    className={
                      p.is_admin
                        ? "rounded-full bg-brand/15 text-brand-dark text-xs px-2.5 py-1"
                        : "rounded-full bg-black/10 text-black/60 text-xs px-2.5 py-1"
                    }
                  >
                    {p.is_admin ? "Chef" : "Customer"}
                  </span>
                </div>

                <div className="mt-3 border-t border-black/5 pt-3">
                  {userOrders.length === 0 ? (
                    <p className="text-sm text-black/40">No orders yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {userOrders.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span>
                            {menuById.get(o.menu_id)?.title ?? "Menu"}
                            <span className="text-black/40">
                              {" "}
                              · {formatDate(o.created_at)}
                            </span>
                          </span>
                          <span
                            className={`rounded-full text-xs px-2.5 py-1 ${statusChip(
                              o.status
                            )}`}
                          >
                            {o.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

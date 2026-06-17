import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/feedback";

export const dynamic = "force-dynamic";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminFeedbackPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  const userIds = [...new Set((feedback ?? []).map((f) => f.user_id))];
  const menuIds = [
    ...new Set((feedback ?? []).map((f) => f.menu_id).filter(Boolean)),
  ] as string[];
  const dishIds = [
    ...new Set((feedback ?? []).map((f) => f.dish_id).filter(Boolean)),
  ] as string[];

  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };
  const { data: menus } = menuIds.length
    ? await supabase.from("menus").select("id, title").in("id", menuIds)
    : { data: [] };
  const { data: dishes } = dishIds.length
    ? await supabase.from("dishes").select("id, name").in("id", dishIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const menuById = new Map((menus ?? []).map((m) => [m.id, m]));
  const dishById = new Map((dishes ?? []).map((d) => [d.id, d]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <Link
          href="/admin"
          className="rounded-md border border-black/15 px-4 py-2 font-medium hover:bg-black/5"
        >
          ← Dashboard
        </Link>
      </div>

      {!feedback || feedback.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-black/60">
          No feedback yet.
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => {
            const profile = profileById.get(f.user_id);
            const about = f.dish_id
              ? `Dish — ${dishById.get(f.dish_id)?.name ?? "Dish"}`
              : f.menu_id
                ? `Menu — ${menuById.get(f.menu_id)?.title ?? "Menu"}`
                : null;
            return (
              <div
                key={f.id}
                className="rounded-xl border border-black/10 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="font-semibold">
                    {profile?.full_name ?? profile?.email ?? "Customer"}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-black/50">
                    <span className="rounded-full bg-black/10 px-2.5 py-1">
                      {categoryLabel(f.category)}
                    </span>
                    <span>{formatDate(f.created_at)}</span>
                  </div>
                </div>
                {about && (
                  <div className="text-sm text-brand-dark mb-1">{about}</div>
                )}
                <p className="text-sm whitespace-pre-wrap">{f.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

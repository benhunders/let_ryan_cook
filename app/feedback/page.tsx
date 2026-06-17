import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { FeedbackForm } from "@/components/FeedbackForm";
import { categoryLabel } from "@/lib/feedback";

export const dynamic = "force-dynamic";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default async function FeedbackPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/feedback");
  const supabase = await createClient();

  // Latest published menu + its dishes power the optional "About" selector.
  const { data: menu } = await supabase
    .from("menus")
    .select("id, title")
    .eq("published", true)
    .order("week_start", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: dishes } = menu
    ? await supabase
        .from("dishes")
        .select("id, name")
        .eq("menu_id", menu.id)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: mine } = await supabase
    .from("feedback")
    .select("id, category, body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Feedback & suggestions</h1>
      <p className="text-sm text-black/60 mb-6">
        Tell Ryan what you think — a dish you loved, something to improve, or an
        idea for a future menu.
      </p>

      <FeedbackForm
        menuId={menu?.id ?? null}
        menuTitle={menu?.title ?? null}
        dishes={dishes ?? []}
      />

      {mine && mine.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Your past feedback</h2>
          <div className="space-y-3">
            {mine.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-black/10 bg-white p-4"
              >
                <div className="text-sm text-black/50 mb-1">
                  {categoryLabel(f.category)} · {formatDate(f.created_at)}
                </div>
                <p className="text-sm whitespace-pre-wrap">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

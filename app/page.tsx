import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { MenuView } from "@/components/MenuView";
import { loadMenuViewData } from "@/lib/menuData";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const user = await getUser();

  // Latest published menu.
  const { data: menu } = await supabase
    .from("menus")
    .select("*")
    .eq("published", true)
    .order("week_start", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!menu) {
    return (
      <div className="text-center mt-16">
        <h1 className="text-3xl font-bold mb-2">No menu yet 🍲</h1>
        <p className="text-black/60">
          The chef hasn&apos;t published this week&apos;s menu. Check back soon!
        </p>
      </div>
    );
  }

  const data = await loadMenuViewData(menu, user?.id ?? null);

  return <MenuView menu={menu} isLoggedIn={!!user} {...data} />;
}

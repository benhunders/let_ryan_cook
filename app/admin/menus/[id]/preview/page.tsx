import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MenuView } from "@/components/MenuView";
import { loadMenuViewData } from "@/lib/menuData";

export const dynamic = "force-dynamic";

// Admin-only: renders any menu (including drafts) exactly as customers see it,
// so the chef can review and test the ordering flow before publishing.
export default async function PreviewMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: menu } = await supabase
    .from("menus")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!menu) notFound();

  const data = await loadMenuViewData(menu, admin.id);

  return <MenuView menu={menu} isLoggedIn preview {...data} />;
}

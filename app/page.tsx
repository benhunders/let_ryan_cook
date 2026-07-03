import { getUser } from "@/lib/auth";
import { MenuView } from "@/components/MenuView";
import { getPublishedMenuData, loadUserOrder } from "@/lib/menuData";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Menu + dishes + ratings come from a shared cache (anonymous visitors
  // don't touch Postgres); only the user's own order is fetched per request.
  const [data, user] = await Promise.all([getPublishedMenuData(), getUser()]);

  if (!data) {
    return (
      <div className="text-center mt-16">
        <h1 className="text-3xl font-bold mb-2">No menu yet 🍲</h1>
        <p className="text-black/60">
          The chef hasn&apos;t published this week&apos;s menu. Check back soon!
        </p>
      </div>
    );
  }

  const order = user
    ? await loadUserOrder(data.menu.id, user.id)
    : { initialItems: {}, initialNotes: "", orderStatus: null };

  return (
    <MenuView
      menu={data.menu}
      dishes={data.dishes}
      ratingByDish={data.ratingByDish}
      isLoggedIn={!!user}
      {...order}
    />
  );
}

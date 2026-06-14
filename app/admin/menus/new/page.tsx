import { requireAdmin } from "@/lib/auth";
import { MenuBuilder } from "@/components/MenuBuilder";

export const dynamic = "force-dynamic";

export default async function NewMenuPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New weekly menu</h1>
      <MenuBuilder />
    </div>
  );
}

import Link from "next/link";
import { requireAdmin, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminSettings } from "@/components/AdminSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const user = await getUser();
  const supabase = await createClient();

  const { data: admins } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("is_admin", true)
    .order("email");

  const { data: allowlist } = await supabase
    .from("admin_allowlist")
    .select("email");

  // Allowlisted emails that don't yet correspond to an admin profile.
  const adminEmails = new Set(
    (admins ?? []).map((a) => a.email?.toLowerCase()).filter(Boolean)
  );
  const pendingEmails = (allowlist ?? [])
    .map((a) => a.email)
    .filter((e) => !adminEmails.has(e.toLowerCase()));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-sm text-brand hover:underline">
          ← Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <AdminSettings
        admins={admins ?? []}
        pendingEmails={pendingEmails}
        currentUserEmail={user?.email ?? null}
      />
    </div>
  );
}

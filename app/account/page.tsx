import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { DeleteAccount } from "@/components/DeleteAccount";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/account");

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Account</h1>

      <div className="rounded-xl border border-black/10 bg-white p-4 mb-6 space-y-1">
        <div>
          <span className="text-black/50 text-sm">Name </span>
          {profile.full_name ?? "—"}
        </div>
        <div>
          <span className="text-black/50 text-sm">Email </span>
          {profile.email}
        </div>
        <div>
          <span className="text-black/50 text-sm">Role </span>
          {profile.is_admin ? "Chef (admin)" : "Customer"}
        </div>
      </div>

      <p className="text-sm text-black/60 mb-6">
        See how we handle your data in our{" "}
        <Link href="/privacy" className="text-brand hover:underline">
          privacy policy
        </Link>
        .
      </p>

      <DeleteAccount />
    </div>
  );
}

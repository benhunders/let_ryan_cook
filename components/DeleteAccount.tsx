"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccount() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    const ok = window.confirm(
      "Delete your account? This permanently removes your profile and all your orders. This cannot be undone."
    );
    if (!ok) return;

    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("delete_my_account");
    if (e) {
      setBusy(false);
      setError(e.message);
      return;
    }
    // Session is now invalid; clear it and return home.
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <h2 className="font-semibold text-red-800">Delete account</h2>
      <p className="text-sm text-red-700/80 mt-1 mb-3">
        Permanently deletes your profile and all of your orders. This can&apos;t
        be undone.
      </p>
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <button
        onClick={deleteAccount}
        disabled={busy}
        className="rounded-md bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700 disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Delete my account & data"}
      </button>
    </div>
  );
}

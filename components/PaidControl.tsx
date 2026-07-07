"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Admin-only toggle to mark an order paid / unpaid. RLS restricts order updates
// to admins, and a database trigger pins `paid`/`paid_at` for everyone else, so
// this control is safe to render only on admin pages. `paid_at` is stamped by
// the trigger, so we only send the boolean.
export function PaidControl({
  orderId,
  paid: initialPaid,
}: {
  orderId: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [paid, setPaid] = useState(initialPaid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !paid;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("orders")
      .update({ paid: next })
      .eq("id", orderId);
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setPaid(next);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={paid}
      className={
        paid
          ? "rounded-full bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 hover:bg-green-200 disabled:opacity-60"
          : "rounded-full border border-black/20 text-black/60 text-xs font-medium px-2.5 py-1 hover:bg-black/5 disabled:opacity-60"
      }
      title={paid ? "Marked paid — click to undo" : "Mark this order as paid"}
    >
      {busy ? "…" : paid ? "✓ Paid" : "Mark paid"}
      {error && <span className="sr-only">{error}</span>}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUSES, statusChipClass, statusLabel } from "@/lib/orderStatus";

// Admin-only control to advance an order's status. RLS also restricts the
// underlying update to admins, so this is safe to render on admin pages only.
export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (next === status) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: e } = await supabase
      .from("orders")
      .update({ status: next, status_updated_at: new Date().toISOString() })
      .eq("id", orderId);
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    // Fire-and-forget: email the customer their new status.
    fetch("/api/notify/order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    }).catch(() => {});
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full text-xs px-2.5 py-1 ${statusChipClass(status)}`}
      >
        {statusLabel(status)}
      </span>
      <select
        value={status}
        onChange={(e) => change(e.target.value)}
        disabled={busy}
        aria-label="Order status"
        className="rounded-md border border-black/15 px-2 py-1 text-sm disabled:opacity-60"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

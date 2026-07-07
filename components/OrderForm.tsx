"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DishCard } from "./DishCard";
import { QuantityStepper } from "./QuantityStepper";
import { PAYMENT_METHODS } from "@/lib/payment";
import type { Dish, Json } from "@/types/database";

type ItemState = { quantity: number; note: string };

export function OrderForm({
  menuId,
  dishes,
  initialItems,
  initialNotes,
  initialPaymentMethod = "cash",
  ratingByDish = {},
}: {
  menuId: string;
  dishes: Dish[];
  initialItems: Record<string, ItemState>;
  initialNotes: string;
  initialPaymentMethod?: string;
  ratingByDish?: Record<string, { avg: number; count: number }>;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, ItemState>>(() => {
    const base: Record<string, ItemState> = {};
    for (const d of dishes) {
      base[d.id] = initialItems[d.id] ?? { quantity: 0, note: "" };
    }
    return base;
  });
  const [notes, setNotes] = useState(initialNotes);
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(id: string, patch: Partial<ItemState>) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setSaved(false);
  }

  const totalItems = Object.values(items).reduce((s, i) => s + i.quantity, 0);

  async function submit() {
    setError(null);
    setSaving(true);
    const supabase = createClient();

    const rows = Object.entries(items)
      .filter(([, i]) => i.quantity > 0)
      .map(([dish_id, i]) => ({
        dish_id,
        quantity: i.quantity,
        note: i.note.trim() || null,
      }));

    // The whole order (order row + all items) is saved in one transaction;
    // the database also validates the deadline, availability and quantities.
    // An empty selection withdraws the order.
    const { error: rpcError } = await supabase.rpc("submit_order", {
      p_menu_id: menuId,
      p_notes: notes.trim() || null,
      p_items: rows as unknown as Json,
      p_payment_method: paymentMethod,
    });

    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSaved(true);
    if (rows.length) {
      // Fire-and-forget order notification (confirmation + admin alert).
      fetch("/api/notify/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuId }),
      }).catch(() => {});
    }
    router.refresh();
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {dishes.map((d) => (
          <DishCard key={d.id} dish={d} rating={ratingByDish[d.id]}>
            {d.available ? (
              <>
                <QuantityStepper
                  value={items[d.id].quantity}
                  onChange={(n) => update(d.id, { quantity: n })}
                />
                {items[d.id].quantity > 0 && (
                  <input
                    value={items[d.id].note}
                    onChange={(e) => update(d.id, { note: e.target.value })}
                    placeholder="Note (e.g. no onions)"
                    className="mt-2 w-full rounded-md border border-black/15 px-2 py-1 text-sm"
                  />
                )}
              </>
            ) : (
              <span className="text-sm text-black/40">Unavailable</span>
            )}
          </DishCard>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-4">
          <span className="block text-sm font-medium mb-1.5">
            How will you pay?
          </span>
          <div className="flex gap-2">
            {PAYMENT_METHODS.map((m) => {
              const on = paymentMethod === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.value);
                    setSaved(false);
                  }}
                  aria-pressed={on}
                  className={
                    on
                      ? "rounded-md border border-brand bg-brand/10 text-brand-dark px-4 py-1.5 text-sm font-medium"
                      : "rounded-md border border-black/15 px-4 py-1.5 text-sm hover:bg-black/5"
                  }
                >
                  {m.value === "cash" ? "💶 " : "🏦 "}
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block text-sm font-medium mb-1">
          Order notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          rows={2}
          placeholder="Anything the chef should know? Allergies, a preferred delivery day, pickup time, etc."
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-black/60">
            {totalItems} item{totalItems === 1 ? "" : "s"} selected
          </span>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-brand text-white px-5 py-2 font-medium hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Submit order"}
          </button>
        </div>
      </div>
    </div>
  );
}

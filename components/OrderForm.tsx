"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DishCard } from "./DishCard";
import { QuantityStepper } from "./QuantityStepper";
import type { Dish } from "@/types/database";

type ItemState = { quantity: number; note: string };

export function OrderForm({
  menuId,
  dishes,
  initialItems,
  initialNotes,
}: {
  menuId: string;
  dishes: Dish[];
  initialItems: Record<string, ItemState>;
  initialNotes: string;
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Your session expired — please sign in again.");
      return;
    }

    // One order per user per menu: upsert, then replace its items.
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .upsert(
        {
          user_id: user.id,
          menu_id: menuId,
          notes: notes.trim() || null,
          // status intentionally omitted: new orders default to 'submitted',
          // and editing an existing order must not reset a chef-set status.
        },
        { onConflict: "user_id,menu_id" }
      )
      .select()
      .single();

    if (orderErr || !order) {
      setSaving(false);
      setError(orderErr?.message ?? "Could not save your order.");
      return;
    }

    await supabase.from("order_items").delete().eq("order_id", order.id);

    const rows = Object.entries(items)
      .filter(([, i]) => i.quantity > 0)
      .map(([dish_id, i]) => ({
        order_id: order.id,
        dish_id,
        quantity: i.quantity,
        note: i.note.trim() || null,
      }));

    if (rows.length) {
      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(rows);
      if (itemsErr) {
        setSaving(false);
        setError(itemsErr.message);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {dishes.map((d) => (
          <DishCard key={d.id} dish={d}>
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
          placeholder="Anything the chef should know? Allergies, pickup time, etc."
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

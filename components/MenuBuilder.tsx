"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImageUpload } from "./ImageUpload";
import { ALLERGENS, DIETARY_TAGS } from "@/lib/dietary";
import type { Menu, Dish } from "@/types/database";

type Row = {
  id?: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  available: boolean;
  allergens: string[];
  dietary_tags: string[];
};

function emptyRow(): Row {
  return {
    name: "",
    description: "",
    price: "",
    image_url: "",
    available: true,
    allergens: [],
    dietary_tags: [],
  };
}

const SUGGESTED_MIN = 6;

export function MenuBuilder({
  menu,
  dishes,
}: {
  menu?: Menu | null;
  dishes?: Dish[];
}) {
  const router = useRouter();
  const isEdit = !!menu;

  const [title, setTitle] = useState(menu?.title ?? "");
  const [weekStart, setWeekStart] = useState(menu?.week_start ?? "");
  const [published, setPublished] = useState(menu?.published ?? false);
  const [rows, setRows] = useState<Row[]>(() =>
    dishes && dishes.length
      ? dishes.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? "",
          price: d.price?.toString() ?? "",
          image_url: d.image_url ?? "",
          available: d.available,
          allergens: d.allergens ?? [],
          dietary_tags: d.dietary_tags ?? [],
        }))
      : Array.from({ length: SUGGESTED_MIN }, emptyRow)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function toggleTag(i: number, field: "allergens" | "dietary_tags", value: string) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const has = r[field].includes(value);
        return {
          ...r,
          [field]: has
            ? r[field].filter((v) => v !== value)
            : [...r[field], value],
        };
      })
    );
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const filledCount = rows.filter((r) => r.name.trim()).length;

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Please give the menu a title (e.g. “Week of June 16”).");
      return;
    }
    if (filledCount === 0) {
      setError("Add at least one dish before saving.");
      return;
    }
    const badPrice = rows.find(
      (r) => r.name.trim() && r.price.trim() && Number.isNaN(Number(r.price))
    );
    if (badPrice) {
      setError(`“${badPrice.name}” has an invalid price.`);
      return;
    }

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

    // 1. Create or update the menu.
    let menuId = menu?.id;
    if (isEdit && menuId) {
      const { error: e } = await supabase
        .from("menus")
        .update({
          title: title.trim(),
          week_start: weekStart || null,
          published,
        })
        .eq("id", menuId);
      if (e) return fail(e.message);
    } else {
      const { data, error: e } = await supabase
        .from("menus")
        .insert({
          title: title.trim(),
          week_start: weekStart || null,
          published,
          created_by: user.id,
        })
        .select()
        .single();
      if (e || !data) return fail(e?.message ?? "Could not create the menu.");
      menuId = data.id;
    }

    // 2. Delete dishes that were removed (cascades to their order items).
    const initialIds = new Set((dishes ?? []).map((d) => d.id));
    const keptIds = new Set(rows.filter((r) => r.id).map((r) => r.id!));
    const toDelete = [...initialIds].filter((id) => !keptIds.has(id));
    if (toDelete.length) {
      const { error: e } = await supabase
        .from("dishes")
        .delete()
        .in("id", toDelete);
      if (e) return fail(e.message);
    }

    // 3. Upsert each filled dish row, preserving order via position.
    const valid = rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r.name.trim());
    for (const { r, idx } of valid) {
      const fields = {
        name: r.name.trim(),
        description: r.description.trim() || null,
        price: r.price.trim() ? Number(r.price) : null,
        image_url: r.image_url.trim() || null,
        position: idx,
        available: r.available,
        allergens: r.allergens,
        dietary_tags: r.dietary_tags,
      };
      if (r.id) {
        const { error: e } = await supabase
          .from("dishes")
          .update(fields)
          .eq("id", r.id);
        if (e) return fail(e.message);
      } else {
        const { error: e } = await supabase
          .from("dishes")
          .insert({ ...fields, menu_id: menuId! });
        if (e) return fail(e.message);
      }
    }

    setSaving(false);
    router.push("/admin");
    router.refresh();

    function fail(message: string) {
      setSaving(false);
      setError(message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Menu meta */}
      <div className="rounded-xl border border-black/10 bg-white p-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Menu title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Week of June 16"
            className="w-full rounded-md border border-black/15 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Week starting
          </label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="w-full rounded-md border border-black/15 px-3 py-2"
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">
              Published{" "}
              <span className="text-black/50">(visible to customers)</span>
            </span>
          </label>
        </div>
      </div>

      {/* Dishes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Dishes</h2>
          <span
            className={
              filledCount < SUGGESTED_MIN ? "text-sm text-amber-600" : "text-sm text-black/50"
            }
          >
            {filledCount} added
            {filledCount < SUGGESTED_MIN
              ? ` — ${SUGGESTED_MIN}+ recommended`
              : ""}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row, i) => (
            <div
              key={row.id ?? `new-${i}`}
              className="rounded-xl border border-black/10 bg-white p-4 grid grid-cols-[120px_1fr] gap-4"
            >
              <div>
                <ImageUpload
                  value={row.image_url}
                  onChange={(url) => updateRow(i, { image_url: url })}
                />
              </div>
              <div className="space-y-2">
                <input
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  placeholder="Dish name"
                  className="w-full rounded-md border border-black/15 px-2 py-1 font-medium"
                />
                <textarea
                  value={row.description}
                  onChange={(e) =>
                    updateRow(i, { description: e.target.value })
                  }
                  placeholder="Short description"
                  rows={2}
                  className="w-full rounded-md border border-black/15 px-2 py-1 text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-black/50">$</span>
                  <input
                    value={row.price}
                    onChange={(e) => updateRow(i, { price: e.target.value })}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="w-24 rounded-md border border-black/15 px-2 py-1 text-sm"
                  />
                  <label className="ml-auto inline-flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={row.available}
                      onChange={(e) =>
                        updateRow(i, { available: e.target.checked })
                      }
                    />
                    Available
                  </label>
                </div>
                <div>
                  <div className="text-xs font-medium text-black/60 mb-1">
                    Dietary
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {DIETARY_TAGS.map((t) => {
                      const on = row.dietary_tags.includes(t.value);
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => toggleTag(i, "dietary_tags", t.value)}
                          className={
                            on
                              ? "rounded-full border border-green-600 bg-green-100 text-green-800 text-xs px-2 py-0.5"
                              : "rounded-full border border-black/15 text-black/60 text-xs px-2 py-0.5 hover:bg-black/5"
                          }
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-black/60 mb-1">
                    Allergens
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALLERGENS.map((t) => {
                      const on = row.allergens.includes(t.value);
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => toggleTag(i, "allergens", t.value)}
                          className={
                            on
                              ? "rounded-full border border-amber-600 bg-amber-100 text-amber-800 text-xs px-2 py-0.5"
                              : "rounded-full border border-black/15 text-black/60 text-xs px-2 py-0.5 hover:bg-black/5"
                          }
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-4 rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5"
        >
          + Add another dish
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-brand text-white px-6 py-2.5 font-medium hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create menu"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="text-sm text-black/60 hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

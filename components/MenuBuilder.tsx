"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImageUpload } from "./ImageUpload";
import { ALLERGENS, DIETARY_TAGS } from "@/lib/dietary";
import { dishImageStoragePath } from "@/lib/images";
import { saveMenuAction, generateDishDescriptionAction } from "@/app/admin/actions";
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

// Format a Date as a value for <input type="datetime-local"> in local time.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Suggested deadline: Friday 21:00 of the menu's week (or the next Friday if no
// week is set yet). Gives Ryan the weekend to shop and cook.
function suggestedDeadline(weekStart: string): string {
  const base = weekStart ? new Date(weekStart + "T00:00:00") : new Date();
  const daysUntilFriday = (5 - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + daysUntilFriday);
  base.setHours(21, 0, 0, 0);
  return toLocalInput(base);
}

export function MenuBuilder({
  menu,
  dishes,
}: {
  menu?: Menu | null;
  dishes?: Dish[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(menu?.title ?? "");
  const [weekStart, setWeekStart] = useState(menu?.week_start ?? "");
  const [deliveryDate, setDeliveryDate] = useState(menu?.delivery_date ?? "");
  const [deadline, setDeadline] = useState(
    menu?.order_deadline
      ? toLocalInput(new Date(menu.order_deadline))
      : suggestedDeadline(menu?.week_start ?? "")
  );
  // Once the chef edits the deadline (or one was already saved), stop
  // auto-suggesting it when the week date changes.
  const [deadlineTouched, setDeadlineTouched] = useState(
    !!menu?.order_deadline
  );
  const [published, setPublished] = useState(menu?.published ?? false);
  const [ordersLocked, setOrdersLocked] = useState(
    menu?.orders_locked ?? false
  );
  // Track the menu id so saving repeatedly in place (draft workflow) updates
  // the same menu, and the saved image urls so replaced uploads get removed
  // from Storage after a successful save.
  const [menuId, setMenuId] = useState<string | undefined>(menu?.id);
  const [savedImageUrls, setSavedImageUrls] = useState<Set<string>>(
    () =>
      new Set(
        (dishes ?? [])
          .map((d) => d.image_url)
          .filter((u): u is string => !!u)
      )
  );
  const [savedNote, setSavedNote] = useState<string | null>(null);
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
  // Index of the row whose description is being generated (only one at a time).
  const [describingIndex, setDescribingIndex] = useState<number | null>(null);

  // Draft a description from the dish name via the AI helper. `force` overwrites
  // an existing description (the ✨ button); without it we only fill a blank one
  // (used on name blur, so we never clobber what the chef typed).
  async function suggestDescription(i: number, force: boolean) {
    const row = rows[i];
    if (!row?.name.trim()) return;
    if (!force && row.description.trim()) return;
    if (describingIndex !== null) return;

    setError(null);
    setDescribingIndex(i);
    const result = await generateDishDescriptionAction(row.name);
    setDescribingIndex(null);
    if (result.error) {
      // Silent on auto (blur) attempts; surface only when the chef asked.
      if (force) setError(result.error);
      return;
    }
    const description = result.description;
    if (description) {
      // Re-check freshly: on the blur path, don't clobber text the chef may
      // have typed while the request was in flight.
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i && (force || !r.description.trim())
            ? { ...r, description }
            : r
        )
      );
      setSavedNote(null);
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSavedNote(null);
  }
  function toggleTag(i: number, field: "allergens" | "dietary_tags", value: string) {
    setSavedNote(null);
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
    setSavedNote(null);
  }

  const filledCount = rows.filter((r) => r.name.trim()).length;

  // Persist the menu + its dishes in ONE transaction via the save_menu RPC
  // (through a server action, which also refreshes the cached public menu).
  // Half-saved menus are impossible: either everything commits or nothing.
  async function persist(
    nextPublished: boolean,
    requireDish: boolean
  ): Promise<boolean> {
    setError(null);
    setSavedNote(null);
    if (!title.trim()) {
      setError("Please give the menu a title (e.g. “Week of June 16”).");
      return false;
    }
    if (requireDish && filledCount === 0) {
      setError("Add at least one dish before publishing.");
      return false;
    }
    const badPrice = rows.find(
      (r) => r.name.trim() && r.price.trim() && Number.isNaN(Number(r.price))
    );
    if (badPrice) {
      setError(`“${badPrice.name}” has an invalid price.`);
      return false;
    }

    setSaving(true);

    const filled = rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r.name.trim());

    const result = await saveMenuAction({
      menuId: menuId ?? null,
      title: title.trim(),
      weekStart: weekStart || null,
      orderDeadline: deadline ? new Date(deadline).toISOString() : null,
      deliveryDate: deliveryDate || null,
      published: nextPublished,
      ordersLocked,
      dishes: filled.map(({ r }) => ({
        id: r.id ?? null,
        name: r.name,
        description: r.description,
        price: r.price,
        image_url: r.image_url,
        available: r.available,
        allergens: r.allergens,
        dietary_tags: r.dietary_tags,
      })),
    });

    if (result.error || !result.menuId) {
      setSaving(false);
      setError(result.error ?? "Could not save the menu.");
      return false;
    }
    const id = result.menuId;

    const supabase = createClient();

    // Capture server-assigned dish ids back into the rows (they come back in
    // position order, matching the payload order) so the next in-place save
    // updates instead of duplicating.
    const { data: fresh } = await supabase
      .from("dishes")
      .select("id, image_url")
      .eq("menu_id", id)
      .order("position", { ascending: true });
    const updatedRows = [...rows];
    if (fresh && fresh.length === filled.length) {
      filled.forEach(({ idx }, i) => {
        updatedRows[idx] = { ...updatedRows[idx], id: fresh[i].id };
      });
      setRows(updatedRows);
    }

    // Best-effort: remove uploads that no longer back any dish from Storage.
    const currentUrls = new Set(
      (fresh ?? [])
        .map((d) => d.image_url)
        .filter((u): u is string => !!u)
    );
    const orphanPaths = [...savedImageUrls]
      .filter((u) => !currentUrls.has(u))
      .map(dishImageStoragePath)
      .filter((p): p is string => !!p);
    if (orphanPaths.length) {
      await supabase.storage
        .from("dish-images")
        .remove(orphanPaths)
        .catch(() => {});
    }
    setSavedImageUrls(currentUrls);

    setMenuId(id);
    setPublished(nextPublished);
    setSaving(false);
    return true;
  }

  // Save progress without publishing (or take a published menu offline),
  // staying on the page so you can keep adding dishes.
  async function saveDraft() {
    const wasPublished = published;
    const ok = await persist(false, false);
    if (ok) {
      setSavedNote(
        wasPublished ? "Unpublished — saved as draft ✓" : "Draft saved ✓"
      );
      router.refresh();
    }
  }

  // Publish (or save changes to an already-published menu) and return to the
  // dashboard.
  async function publishMenu() {
    const ok = await persist(true, true);
    if (ok) {
      router.push("/admin");
      router.refresh();
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
            onChange={(e) => {
              setTitle(e.target.value);
              setSavedNote(null);
            }}
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
            onChange={(e) => {
              const v = e.target.value;
              setWeekStart(v);
              if (!deadlineTouched) setDeadline(suggestedDeadline(v));
              setSavedNote(null);
            }}
            className="w-full rounded-md border border-black/15 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Delivery day
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => {
              setDeliveryDate(e.target.value);
              setSavedNote(null);
            }}
            className="w-full rounded-md border border-black/15 px-3 py-2"
          />
          <p className="mt-1 text-xs text-black/50">
            The day you hand out the food. Customers see this; they can note a
            preferred day on their order.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">
            Order deadline
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => {
              setDeadline(e.target.value);
              setDeadlineTouched(true);
              setSavedNote(null);
            }}
            className="w-full rounded-md border border-black/15 px-3 py-2"
          />
          <p className="mt-1 text-xs text-black/50">
            Customers can order until this time. Defaults to Friday 21:00 so
            there&apos;s time to shop and cook.
          </p>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ordersLocked}
              onChange={(e) => {
                setOrdersLocked(e.target.checked);
                setSavedNote(null);
              }}
              className="h-4 w-4"
            />
            <span>
              Close ordering now{" "}
              <span className="text-black/50">
                (stops new orders before the deadline)
              </span>
            </span>
          </label>
          <div className="text-sm">
            <span className="text-black/50">Status: </span>
            <span
              className={
                published
                  ? "rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs"
                  : "rounded-full bg-black/10 text-black/60 px-2.5 py-0.5 text-xs"
              }
            >
              {published ? "Published" : "Draft"}
            </span>
          </div>
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

        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((row, i) => (
            <div
              key={row.id ?? `new-${i}`}
              className="rounded-xl border border-black/10 bg-white p-4 space-y-3"
            >
              <ImageUpload
                value={row.image_url}
                onChange={(url) => updateRow(i, { image_url: url })}
              />
              <input
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                onBlur={() => suggestDescription(i, false)}
                placeholder="Dish name"
                className="w-full rounded-md border border-black/15 px-3 py-2 font-medium"
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-black/60">
                    Description
                  </label>
                  <button
                    type="button"
                    onClick={() => suggestDescription(i, true)}
                    disabled={!row.name.trim() || describingIndex !== null}
                    className="text-xs text-brand hover:underline disabled:opacity-50 disabled:no-underline"
                    title="Draft a description from the dish name"
                  >
                    {describingIndex === i ? "✨ Writing…" : "✨ Suggest"}
                  </button>
                </div>
                <textarea
                  value={row.description}
                  onChange={(e) => updateRow(i, { description: e.target.value })}
                  placeholder="Short description (auto-fills from the dish name)"
                  rows={2}
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-black/50">€</span>
                  <input
                    value={row.price}
                    onChange={(e) => updateRow(i, { price: e.target.value })}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="w-24 rounded-md border border-black/15 px-2 py-1 text-sm"
                  />
                </div>
                <label className="inline-flex items-center gap-1.5 text-sm">
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={publishMenu}
          disabled={saving}
          className="rounded-md bg-brand text-white px-6 py-2.5 font-medium hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : published ? "Save changes" : "Publish menu"}
        </button>
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving}
          className="rounded-md border border-black/15 px-6 py-2.5 font-medium hover:bg-black/5 disabled:opacity-60"
        >
          {published ? "Unpublish" : "Save draft"}
        </button>
        {menuId && (
          <Link
            href={`/admin/menus/${menuId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-black/15 px-6 py-2.5 font-medium hover:bg-black/5"
          >
            Preview
          </Link>
        )}
        {savedNote && (
          <span className="text-sm font-medium text-green-700">{savedNote}</span>
        )}
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="ml-auto text-sm text-black/60 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

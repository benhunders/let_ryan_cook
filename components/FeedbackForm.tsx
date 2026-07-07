"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback";

// Lets a signed-in customer submit feedback, optionally attached to the current
// menu or one of its dishes. `about` values are encoded as "menu:<id>" or
// "dish:<id>"; empty means general feedback.
export function FeedbackForm({
  menuId,
  menuTitle,
  dishes,
}: {
  menuId: string | null;
  menuTitle: string | null;
  dishes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState("general");
  const [about, setAbout] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!body.trim()) {
      setError("Please write a little something before sending.");
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

    let linkMenuId: string | null = null;
    let linkDishId: string | null = null;
    if (about.startsWith("menu:")) linkMenuId = about.slice(5);
    else if (about.startsWith("dish:")) linkDishId = about.slice(5);

    const { error: e } = await supabase.from("feedback").insert({
      user_id: user.id,
      category,
      body: body.trim(),
      menu_id: linkMenuId,
      dish_id: linkDishId,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    setBody("");
    setAbout("");
    setCategory("general");
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          >
            {FEEDBACK_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            About <span className="text-black/40">(optional)</span>
          </label>
          <select
            value={about}
            onChange={(e) => {
              setAbout(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          >
            <option value="">Nothing in particular</option>
            {menuId && (
              <option value={`menu:${menuId}`}>
                This week&apos;s menu{menuTitle ? ` — ${menuTitle}` : ""}
              </option>
            )}
            {dishes.map((d) => (
              <option key={d.id} value={`dish:${d.id}`}>
                Dish — {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Your feedback</label>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          rows={4}
          placeholder="What did you love? What could be better? Any dishes you'd like to see?"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-700">Thanks — sent! 🙌</span>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-md bg-brand text-white px-5 py-2 font-medium hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </div>
  );
}

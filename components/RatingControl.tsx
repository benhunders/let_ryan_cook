"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Lets a customer rate a dish (1–5) with an optional comment. Upserts one
// rating per user per dish. Rendered on completed orders.
export function RatingControl({
  dishId,
  initialRating,
  initialComment,
}: {
  dishId: string;
  initialRating: number | null;
  initialComment: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    rating !== (initialRating ?? 0) || comment !== initialComment;

  async function save() {
    if (!rating) {
      setError("Pick a star rating first.");
      return;
    }
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
    const { error: e } = await supabase.from("ratings").upsert(
      {
        user_id: user.id,
        dish_id: dishId,
        rating,
        comment: comment.trim() || null,
      },
      { onConflict: "user_id,dish_id" }
    );
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-1">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => {
              setRating(n);
              setSaved(false);
            }}
            className={
              n <= rating ? "text-amber-500" : "text-black/20 hover:text-amber-300"
            }
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <input
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setSaved(false);
            }}
            placeholder="Add a comment (optional)"
            className="ml-2 flex-1 rounded-md border border-black/15 px-2 py-1 text-xs"
          />
        )}
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="ml-1 rounded-md bg-brand text-white px-3 py-1 text-xs font-medium hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        {!dirty && saved && (
          <span className="ml-1 text-xs text-green-700">Saved ✓</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

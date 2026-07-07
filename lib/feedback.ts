// Feedback categories, shared between the submission form and the admin view.
// Must stay in sync with the check constraint in 0008_feedback.sql.

export type FeedbackCategory =
  | "general"
  | "suggestion"
  | "compliment"
  | "problem"
  | "requested_dish"
  | "dietary";

export const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] =
  [
    { value: "general", label: "General" },
    { value: "suggestion", label: "Suggestion" },
    { value: "compliment", label: "Compliment" },
    { value: "problem", label: "Problem" },
    { value: "requested_dish", label: "Dish request" },
    { value: "dietary", label: "Dietary need" },
  ];

export function categoryLabel(value: string): string {
  return FEEDBACK_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

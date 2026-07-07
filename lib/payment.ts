// Payment methods a customer can choose when ordering. Kept in sync with the
// orders.payment_method check constraint (0013_payments_delivery_feedback.sql).
// "ticket" = a meal voucher / ticket restaurant.

export type PaymentMethod = "cash" | "ticket";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "ticket", label: "Meal ticket" },
];

export function paymentLabel(value: string): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

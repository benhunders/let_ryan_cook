// Payment methods a customer can choose when ordering. Kept in sync with the
// orders.payment_method check constraint (0014_payment_transfer.sql).

export type PaymentMethod = "cash" | "transfer";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank transfer" },
];

export function paymentLabel(value: string): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

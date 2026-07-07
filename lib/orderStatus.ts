// Order status workflow shared between the admin controls and the
// customer-facing displays. The flow is:
//   submitted → preparing → ready → completed   (plus cancelled)
// Only admins can change status (enforced by RLS); customers see it read-only.

export type OrderStatus =
  | "submitted"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function statusLabel(status: string): string {
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

// Tailwind classes for the colored status pill.
export function statusChipClass(status: string): string {
  const styles: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-700",
    preparing: "bg-amber-100 text-amber-800",
    ready: "bg-green-100 text-green-700",
    completed: "bg-black/10 text-black/60",
    cancelled: "bg-red-100 text-red-700",
  };
  return styles[status] ?? "bg-black/10 text-black/60";
}

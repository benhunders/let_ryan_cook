"use client";

// Renders an absolute timestamp in the viewer's local timezone. Client-side so
// the time is shown in the customer's zone (the server would render in UTC).
export function DeadlineLabel({ iso }: { iso: string }) {
  const text = new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return <span suppressHydrationWarning>{text}</span>;
}

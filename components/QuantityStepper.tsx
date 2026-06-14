"use client";

export function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-black/15 select-none">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="px-3 py-1 text-lg leading-none hover:bg-black/5 disabled:opacity-40"
        disabled={value === 0}
      >
        −
      </button>
      <span className="w-8 text-center tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        className="px-3 py-1 text-lg leading-none hover:bg-black/5"
      >
        +
      </button>
    </div>
  );
}

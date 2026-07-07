"use client";

// Route error boundary: failed queries now throw instead of silently
// rendering empty states, and land here with a retry.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="text-center mt-16">
      <h1 className="text-2xl font-bold mb-2">Something went wrong 😵</h1>
      <p className="text-black/60 mb-1">
        We couldn&apos;t load this page. It&apos;s us, not you — please try
        again.
      </p>
      {error.digest && (
        <p className="text-xs text-black/40 mb-4">Error ref: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-3 rounded-md bg-brand text-white px-5 py-2 font-medium hover:bg-brand-dark"
      >
        Try again
      </button>
    </div>
  );
}

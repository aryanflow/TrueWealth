"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h2 className="text-lg font-medium text-ink">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted">{error.message || "Unexpected error"}</p>
      {error.digest ? (
        <p className="mt-1 font-mono text-xs text-muted/80">Ref: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-canvas"
      >
        Try again
      </button>
    </div>
  );
}

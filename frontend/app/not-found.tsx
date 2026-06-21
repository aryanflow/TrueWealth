import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">404</p>
      <h1 className="mt-2 text-lg font-medium text-ink">Page not found</h1>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-ion transition hover:text-ion/80">
        ← Back to dashboard
      </Link>
    </div>
  );
}

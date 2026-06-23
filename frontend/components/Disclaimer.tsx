const DISCLAIMER_LEAD = "Decision support only. Not investment advice.";

const DISCLAIMER_BODY =
  "TRUE WEALTH is read-only: it does not place trades and does not store broker passwords. Metrics are explained in UI tooltips with their data lineage; verify material figures in your primary broker app.";

export function disclaimerPlainText(): string {
  return `${DISCLAIMER_LEAD} ${DISCLAIMER_BODY}`;
}

export function Disclaimer({ variant = "footer" }: { variant?: "footer" | "settings" }) {
  if (variant === "settings") {
    return (
      <footer className="mt-8 rounded-xl border border-line/80 bg-black/20 p-4 text-xs leading-relaxed text-muted">
        <p>
          <strong className="text-ink">{DISCLAIMER_LEAD}</strong> {DISCLAIMER_BODY}
        </p>
      </footer>
    );
  }
  return (
    <footer className="mt-10 border-t border-line pt-6 text-center text-xs leading-relaxed text-muted">
      <p>
        <strong className="text-ink">{DISCLAIMER_LEAD}</strong> {DISCLAIMER_BODY}
      </p>
    </footer>
  );
}

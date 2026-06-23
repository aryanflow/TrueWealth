/** Shield mark: single filled path + gradient (no hairline strokes at 22px). */
export function TrueWealthLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="tw-logo-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6EA8FF" />
          <stop offset="1" stopColor="#68D7C6" />
        </linearGradient>
      </defs>
      <path
        fill="url(#tw-logo-shield)"
        stroke="none"
        d="M12 2.4c2.8 2.1 5.9 2.6 8.8 2.9v7.2c0 5.6-3.8 9.1-8.8 9.7-5-.6-8.8-4.1-8.8-9.7V5.3c2.9-.3 6-.8 8.8-2.9Z"
      />
      <path
        fill="rgba(255,204,102,0.35)"
        stroke="none"
        d="M7.5 12.4c1.1-1.6 2.6-2.7 4.5-3.3 1.9-.6 3.7-.3 5.3.7l.6-.9c-2-.9-4-.9-6.1-.2-2 .7-3.6 2-4.8 3.7l.5.9Z"
      />
    </svg>
  );
}

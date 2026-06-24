import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0A0B0F",
        "ink-bg": "#0A0B0F",
        ink2: "#0D0F15",
        panel: "#13151D",
        panel2: "#171A24",
        hairline: "#23262F",
        line: "#23262F",
        line2: "#2C3039",
        ink: "#ECECF1",
        muted: "#A6ABB8",
        "muted-dim": "#6B7080",
        brass: "#C9A24B",
        "brass-soft": "#E2C988",
        "brass-dim": "#8A7338",
        mint: "#6FE0B0",
        coral: "#F0817E",
        peri: "#86A6FF",
        ion: "#86A6FF",
        mintglass: "#6FE0B0",
        ember: "#E9C46A",
        rose: "#F0817E",
        accent: "#86A6FF",
        gain: "#6FE0B0",
        "gain-muted": "#6FE0B0",
        loss: "#F0817E",
        "loss-muted": "#F0817E",
        warn: "#E9C46A",
        "warn-muted": "#E9C46A",
        surface: "#13151D",
        "surface-elevated": "#171A24",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04), 0 16px 48px -16px rgba(0,0,0,0.65)",
        raised: "0 20px 40px -24px rgba(0,0,0,0.8)",
      },
      spacing: {
        18: "4.5rem",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-1.5%, 1.25%, 0) scale(1.03)" },
        },
        caret: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "spine-grow": {
          from: { width: "0" },
        },
        "dial-sweep": {
          from: { strokeDashoffset: "var(--circ)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        caret: "caret 1s steps(1,end) infinite",
        "spine-grow": "spine-grow 1.1s cubic-bezier(0.6,0,0.2,1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        twilight: "#04060a",
        void: "#05070b",
        canvas: "#070A0F",
        surface: "#0B1220",
        "surface-elevated": "#0A0F1B",
        hairline: "rgba(255,255,255,0.09)",
        line: "rgba(255,255,255,0.08)",
        ink: "rgba(255,255,255,0.92)",
        muted: "rgba(255,255,255,0.58)",
        ion: "#6EA8FF",
        mintglass: "#68D7C6",
        ember: "#FFCC66",
        rose: "#FF7D9A",
        accent: "#6EA8FF",
        gain: "#68D7C6",
        "gain-muted": "rgba(104, 215, 198, 0.78)",
        loss: "#FF7D9A",
        "loss-muted": "rgba(255, 125, 154, 0.78)",
        warn: "#FFCC66",
        "warn-muted": "rgba(255, 204, 102, 0.85)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.55)",
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
      },
      animation: {
        shimmer: "shimmer 1.8s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        caret: "caret 1s steps(1,end) infinite",
      },
    },
  },
  plugins: [],
};

export default config;

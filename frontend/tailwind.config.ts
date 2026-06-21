import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        twilight: "#070A0F",
        void: "#0B1220",
        canvas: "#070A0F",
        surface: "#0B1220",
        line: "#151b28",
        ink: "rgba(255,255,255,0.92)",
        muted: "rgba(255,255,255,0.62)",
        ion: "#6EA8FF",
        mintglass: "#68D7C6",
        ember: "#FFCC66",
        rose: "#FF7D9A",
        accent: "#6EA8FF",
        gain: "#68D7C6",
        loss: "#FF7D9A",
        warn: "#FFCC66",
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

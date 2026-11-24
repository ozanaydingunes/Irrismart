import type { Config } from "tailwindcss";

const color = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        border: color("border"),
        input: color("input"),
        ring: color("ring"),
        background: color("background"),
        foreground: color("foreground"),
        primary: { DEFAULT: color("primary"), foreground: color("primary-foreground") },
        secondary: { DEFAULT: color("secondary"), foreground: color("secondary-foreground") },
        accent: { DEFAULT: color("accent"), foreground: color("accent-foreground") },
        muted: { DEFAULT: color("muted"), foreground: color("muted-foreground") },
        card: { DEFAULT: color("card"), foreground: color("card-foreground") },
        destructive: { DEFAULT: color("destructive"), foreground: color("destructive-foreground") },
        success: { DEFAULT: color("success"), foreground: color("success-foreground"), strong: color("success-strong") },
        warning: { DEFAULT: color("warning"), strong: color("warning-strong") },
        board: { DEFAULT: color("board"), foreground: color("board-foreground"), line: color("board-line") },
        math: {
          blue: color("math-blue"),
          purple: color("math-purple"),
          green: color("math-green"),
          orange: color("math-orange"),
          red: color("math-red"),
          pink: color("math-pink"),
          teal: color("math-teal"),
          gray: color("math-gray"),
        },
      },
      opacity: { 8: "0.08", 12: "0.12", 15: "0.15", 55: "0.55" },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 6px 20px -6px hsl(var(--primary) / 0.45)",
        card: "0 1px 2px hsl(240 30% 20% / 0.04), 0 8px 24px -12px hsl(250 40% 30% / 0.14)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-rounded", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "translate(-50%, -48%) scale(0.97)" }, to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" } },
        "rise-in": { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        write: { from: { clipPath: "inset(0 100% 0 0)" }, to: { clipPath: "inset(0 0 0 0)" } },
        draw: { from: { strokeDashoffset: "var(--len, 400)" }, to: { strokeDashoffset: "0" } },
        pulseRing: { "0%,100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.35)" }, "50%": { boxShadow: "0 0 0 8px hsl(var(--primary) / 0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "pop-in": "pop-in 0.25s ease-out both",
        "rise-in": "rise-in 0.45s ease-out both",
        write: "write 1.1s steps(28, end) both",
        draw: "draw 1.2s ease-out both",
        "pulse-ring": "pulseRing 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

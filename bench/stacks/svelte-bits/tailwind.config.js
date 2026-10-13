/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{svelte,ts}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--cp-bg)", surface: "var(--cp-surface)",
        elevated: "var(--cp-bg-elevated)", soft: "var(--cp-surface-soft)",
        line: "var(--cp-border)", ink: "var(--cp-text)", muted: "var(--cp-text-muted)",
        accent: "var(--cp-accent)", "accent-hover": "var(--cp-accent-hover)",
        "accent-soft": "var(--cp-accent-soft)", "accent-fg": "var(--cp-accent-fg)",
      },
      fontFamily: { sans: ['"Segoe UI"', 'Aptos', 'Calibri', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'] },
      borderRadius: { control: "0.625rem", card: "1rem" },
    },
  },
  plugins: [],
};

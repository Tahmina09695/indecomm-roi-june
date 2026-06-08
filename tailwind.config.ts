import type { Config } from "tailwindcss";

// Indecomm Brand Standards
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand
        navy: "#002060",
        // Accents
        pink: "#FF0066",
        orange: "#F1A421",      // AuditGenius primary
        green: "#8BCC9A",       // BotGenius
        purple: "#8064A2",      // DocGenius
        deepblue: "#2076BA",    // DecisionGenius/IDXGenius
        lightblue: "#2BA8E0",   // DecisionGenius/IDXGenius
        // Surfaces
        surface: "#0B2A5B",      // slightly lighter navy for cards on dark
        surfaceLight: "#F7F8FC",
        editable: "#FFF8DC",     // soft yellow for editable input cells
      },
      fontFamily: {
        sans: ["Open Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(0, 32, 96, 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ระบบสีจาก Streamlit เดิม — Lab Parfumo brand
        slate: {
          50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0",
          300: "#CBD5E1", 400: "#94A3B8", 500: "#64748B",
          600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#0F172A",
        },
        brand: {
          50: "#F4F7FB", 100: "#E8EFF8", 300: "#A8C0E0",
          400: "#8FA8C9", 500: "#6388B7", 600: "#4A6FA5",
          700: "#3A5A8C", 800: "#2E4D78", 900: "#1E3A5F",
        },
      },
      fontFamily: {
        sans: ["var(--font-sarabun)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
        sm: "0 2px 4px rgba(15, 23, 42, 0.06)",
        md: "0 4px 12px rgba(15, 23, 42, 0.08)",
        lg: "0 8px 24px rgba(15, 23, 42, 0.12)",
        brand: "0 4px 12px rgba(74, 111, 165, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;

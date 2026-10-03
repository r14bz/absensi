import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf7",
          100: "#d1fae9",
          500: "#10a37f",
          600: "#0b8a6b",
          700: "#0a6f56",
        },
      },
    },
  },
  plugins: [],
};

export default config;

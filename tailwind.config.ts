import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f7f5",
          100: "#e3ece6",
          200: "#c3d9cb",
          300: "#96bda6",
          400: "#639b7c",
          500: "#3f7d5e",
          600: "#2e644a",
          700: "#26503c",
          800: "#204032",
          900: "#1b352a",
        },
      },
    },
  },
  plugins: [],
};

export default config;

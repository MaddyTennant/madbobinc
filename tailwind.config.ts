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
        paper: {
          DEFAULT: "#F5F4ED",
          50: "#FAF9F5",
          100: "#F5F4ED",
          200: "#EDEAE0",
        },
      },
    },
  },
  plugins: [],
};

export default config;

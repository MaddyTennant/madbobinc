import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: "#FFFFFF",
        brand: {
          50: "#f4f7f5",
          100: "#e4ece4",
          200: "#c3d9cb",
          300: "#96bda6",
          400: "#639b7c",
          500: "#3f7d5e",
          600: "#2e644a",
          700: "#1b4332",
          800: "#1b4332",
          900: "#123024",
        },
        paper: {
          DEFAULT: "#FAF9F5",
          50: "#FFFFFF",
          100: "#FAF9F5",
          200: "#F5F4ED",
          300: "#E3E3E3",
        },
        stone: {
          50: "#FAF9F5",
          100: "#F5F4ED",
          200: "#E3E3E3",
          300: "#D0D0D0",
          400: "#A19E97",
          500: "#6B6A65",
          600: "#55534E",
          700: "#3D3D3A",
          800: "#26251F",
          900: "#141413",
        },
      },
      borderRadius: {
        md: "8px",
        lg: "10px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0, 0, 0, 0.10), 0 1px 2px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;

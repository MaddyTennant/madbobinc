import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Madbob Spend",
  description: "AI-driven spend management for restaurants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

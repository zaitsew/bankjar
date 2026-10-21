import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BankJar - which bank offer pays you most?",
  description:
    "Compare Spanish bank offers by goal: salary bonus, savings, free accounts and deposits. Open data, open ranking, dated sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

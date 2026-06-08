import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indecomm ROI Calculator",
  description:
    "Compare your true in-house cost of mortgage operations to Indecomm's outsourced pricing, powered by AuditGenius.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

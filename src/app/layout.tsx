import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fidelis · self-healing exam content",
  description: "Docs → knowledge graph → questions, kept correct when the docs change.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

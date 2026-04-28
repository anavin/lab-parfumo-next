import type { Metadata } from "next";
import { Sarabun, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sarabun",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lab Parfumo PO Pro",
    template: "%s — Lab Parfumo PO",
  },
  description: "Purchase Order Management System — Lab Parfumo",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${sarabun.variable} ${jetbrainsMono.variable}`}>
      <body className={sarabun.className}>{children}</body>
    </html>
  );
}

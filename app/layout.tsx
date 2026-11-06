import type { Metadata, Viewport } from "next";
import { Albert_Sans, Imbue } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Effects from "@/components/Effects";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const sans = Albert_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "700"] });
const display = Imbue({ variable: "--font-imbue", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "NITR ki Dilwali — Diwali Crackers at NIT Rourkela",
  description: "Order Diwali crackers at NIT Rourkela. Pick from the price list, confirm on WhatsApp, collect at Jagda gate.",
};

export const viewport: Viewport = { themeColor: "#17120e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Effects />
        <Toaster position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}

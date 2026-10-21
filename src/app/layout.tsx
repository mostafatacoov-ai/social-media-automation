import type { Metadata } from "next";
import { Inter, Cairo, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/Toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const techMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-tech-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Social Studio",
  description: "White-label AI social media marketing platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cairo.variable} ${techMono.variable}`}>
      <body className="font-sans min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

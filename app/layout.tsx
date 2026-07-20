import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Horizon: Roadmap Tracker",
  description: "Personal roadmap and consistency engine for the goals you're working toward.",
  icons: {
    icon: "/icon-512.png",
    shortcut: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} ${inter.variable} ${inter.className}`} suppressHydrationWarning>{children}</body>
    </html>
  );
}

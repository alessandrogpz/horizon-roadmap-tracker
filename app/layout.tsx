import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import packageJson from "../package.json";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Horizon: Roadmap Tracker",
  description: "Personal roadmap and consistency engine for the goals you're working toward.",
  // Icons are left to the app-directory file conventions — app/favicon.ico,
  // app/icon.svg and app/apple-icon.png — which emit the right rel/type/sizes
  // per file. Declaring `icons` here would override that with worse tags.
};

// Runs before first paint: applies the saved theme (or the OS preference on
// first visit) to <html> so there's no light/dark flash on load. Kept as a
// tiny inline string on purpose — it must execute before React hydrates.
const themeScript = `(function(){try{var t=localStorage.getItem('horizon-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} ${inter.variable} ${inter.className}`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <span className="fixed bottom-2 right-2.5 text-[0.65rem] text-subtle-foreground font-mono pointer-events-none select-none z-10">
          v{packageJson.version}
        </span>
      </body>
    </html>
  );
}

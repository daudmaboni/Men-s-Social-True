import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
// Kayani headline face (brand system: one font for headlines, one for everything else)
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import "./fonts.css";
import { THEME_BOOT_SCRIPT } from "@/lib/themeBoot";
import FontScope from "@/components/FontScope";

export const metadata: Metadata = {
  title: "Men's Social",
  description: "Your private companion for men's wellness.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.ico", apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Men's Social", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#027a3d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme before React loads
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <FontScope />
        {children}
      </body>
    </html>
  );
}

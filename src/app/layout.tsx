import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Men's Social",
  description: "Your private companion for men's wellness.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Men's Social", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f5c46",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

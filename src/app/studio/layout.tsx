import type { Metadata } from "next";
import { ToastProvider } from "@/components/motion/Toast";

// The Studio is for Kayani staff only: keep it out of search engines and away from the bottom tabs.
export const metadata: Metadata = {
  title: "Content Studio · Men's Social",
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-6">{children}</main>
    </ToastProvider>
  );
}

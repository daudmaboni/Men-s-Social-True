import type { Metadata } from "next";
import { ToastProvider } from "@/components/motion/Toast";
import AdminShell from "@/components/admin/AdminShell";

// The Admin Control Center is for Kayani staff only: keep it out of search engines and away from the bottom tabs.
export const metadata: Metadata = {
  title: "Admin Control Center · Men's Social",
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AdminShell>{children}</AdminShell>
    </ToastProvider>
  );
}

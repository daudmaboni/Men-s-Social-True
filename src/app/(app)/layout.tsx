import BottomNav from "@/components/BottomNav";
import { ToastProvider } from "@/components/motion/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-6">{children}</main>
      <BottomNav />
    </ToastProvider>
  );
}

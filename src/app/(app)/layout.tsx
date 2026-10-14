import BottomNav from "@/components/BottomNav";
import TabPager from "@/components/TabPager";
import { ToastProvider } from "@/components/motion/Toast";
import AccountSync from "@/components/account/AccountSync";
import AccountInviteSheet from "@/components/account/AccountInvite";
import ThemeGesture from "@/components/ThemeGesture";
import ProfilePrompt from "@/components/me/ProfilePrompt";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AccountSync />
      <AccountInviteSheet />
      <ProfilePrompt />
      <ThemeGesture />
      {/* The three tabs live in the pager; other pages (children) open on top of it */}
      <TabPager>{children}</TabPager>
      <BottomNav />
    </ToastProvider>
  );
}

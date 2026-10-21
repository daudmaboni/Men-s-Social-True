import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import TabPager from "@/components/TabPager";
import { ToastProvider } from "@/components/motion/Toast";
import AccountSync from "@/components/account/AccountSync";
import AccountInviteSheet from "@/components/account/AccountInvite";
import ThemeGesture from "@/components/ThemeGesture";
import ProfilePrompt from "@/components/me/ProfilePrompt";
import CoursePlayerHost from "@/components/course/CoursePlayerHost";
import MiniPlayer from "@/components/course/MiniPlayer";
import SleepWatcher from "@/components/progress/SleepWatcher";
import LanguageGate from "@/components/me/LanguageGate";
import OfflineSupport from "@/components/offline/OfflineSupport";
import KitoLauncher from "@/components/kito/KitoLauncher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AccountSync />
      <AccountInviteSheet />
      <ProfilePrompt />
      <ThemeGesture />
      {/* The three tabs live in the pager; other pages (children) open on top of it */}
      <TabPager>{children}</TabPager>
      {/* Lessons keep playing on every page; the mini player shows them (Step 49) */}
      <CoursePlayerHost />
      <MiniPlayer />
      <SleepWatcher />
      {/* Offline learning: downloads, service worker and the connection bar (Step 67) */}
      <OfflineSupport />
      {/* Kito, the learning assistant: floating button bottom right (Step 67) */}
      <KitoLauncher />
      <BottomNav />
      {/* On a computer the tabs sit in a sidebar instead of the bottom bar */}
      <SideNav />
      {/* First open on this phone: pick Kiswahili or English before any content */}
      <LanguageGate />
    </ToastProvider>
  );
}

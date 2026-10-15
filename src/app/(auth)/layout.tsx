import { ToastProvider } from "@/components/motion/Toast";

// Log in, sign up and "choose a new password": a full screen of their own, without the tab bar
// or sidebar, so the sign-in card sits in the middle of the screen.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider sidebar={false}>{children}</ToastProvider>;
}

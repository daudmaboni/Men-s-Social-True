"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastState = { id: number; text: string; leaving: boolean } | null;

const ToastContext = createContext<(text: string) => void>(() => {});

/** Call showToast("Saved") from any screen inside the app. */
export function useToast() {
  return useContext(ToastContext);
}

/** sidebar: the page has the desktop sidebar on the left, so the toast centres on the space beside it. */
export function ToastProvider({ children, sidebar = true }: { children: React.ReactNode; sidebar?: boolean }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const showToast = useCallback((text: string) => {
    timers.current.forEach(clearTimeout);
    const id = Date.now();
    setToast({ id, text, leaving: false });
    timers.current = [
      setTimeout(() => setToast((t) => (t && t.id === id ? { ...t, leaving: true } : t)), 2200),
      setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2500),
    ];
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className={`fixed bottom-24 left-1/2 z-50 lg:bottom-8 ${sidebar ? "lg:left-[calc(50%+8rem)]" : ""} whitespace-nowrap rounded-full bg-forest-deep px-5 py-2.5 text-sm font-medium text-white shadow-lg ${
            toast.leaving ? "toast-out" : "toast-in"
          }`}
        >
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  );
}

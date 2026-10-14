"use client";

// The Admin Control Center frame: sign-in gate, sidebar (collapsible on desktop, a drawer on phones),
// appearance controls, and the signed-in admin for every page underneath.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Settings,
  Smartphone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { GateScreen, type StudioAdmin } from "@/components/studio/StudioGate";
import { useAdmin } from "@/lib/studio/useAdmin";
import { staffName } from "@/lib/studio/username";
import { can, ROLES, type Perm } from "@/lib/admin/perms";
import { ACCENTS, setAccent, setThemePref, useAccent, useThemePref, type ThemePref } from "@/lib/theme";

type Ctx = { admin: StudioAdmin; can: (p: Perm) => boolean; refresh: () => void };
const StudioContext = createContext<Ctx | null>(null);

/** The signed-in admin, for any page inside /studio. */
export function useStudio(): Ctx {
  const c = useContext(StudioContext);
  if (!c) throw new Error("useStudio must be used inside the Admin Control Center");
  return c;
}

export const NAV: { href: string; label: string; Icon: typeof LayoutDashboard; perm: Perm | null; match?: RegExp }[] = [
  { href: "/studio", label: "Overview", Icon: LayoutDashboard, perm: null, match: /^\/studio\/?$/ },
  { href: "/studio/content", label: "Content", Icon: FileText, perm: "content.edit", match: /^\/studio\/(content|edit)/ },
  { href: "/studio/homepage", label: "Homepage", Icon: Smartphone, perm: "homepage.edit" },
  { href: "/studio/users", label: "Users", Icon: Users, perm: "users.view" },
  { href: "/studio/community", label: "Community", Icon: MessagesSquare, perm: "community.moderate" },
  { href: "/studio/notifications", label: "Notifications", Icon: Bell, perm: "notifications.send" },
  { href: "/studio/ai", label: "AI", Icon: Sparkles, perm: "ai.use" },
  { href: "/studio/analytics", label: "Analytics", Icon: BarChart3, perm: "analytics.view" },
  { href: "/studio/settings", label: "Settings", Icon: Settings, perm: null },
];

const COLLAPSE_KEY = "ms_admin_sidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { state, signIn, signOut, refresh } = useAdmin();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  useEffect(() => setDrawer(false), [pathname]);

  // One stable object per signed-in admin, so pages don't reload data on every render
  const ctx = useMemo<Ctx | null>(() => {
    if (state.status !== "admin") return null;
    const admin: StudioAdmin = { email: state.email, userId: state.userId, role: state.role, displayName: state.displayName };
    return { admin, can: (p) => can(admin.role, p), refresh: () => void refresh() };
  }, [state, refresh]);

  if (state.status !== "admin" || !ctx) return <GateScreen state={state as Exclude<typeof state, { status: "admin" }>} onSignIn={signIn} onSignOut={signOut} />;
  const { admin } = ctx;
  const items = NAV.filter((n) => !n.perm || ctx.can(n.perm));
  const active = (n: (typeof NAV)[number]) => (n.match ? n.match.test(pathname) : pathname.startsWith(n.href));
  const name = admin.displayName || staffName(admin.email);
  const roleLabel = ROLES.find((r) => r.id === admin.role)?.label ?? admin.role;
  // A page opened by its address that this role can't use: say so instead of showing controls that would be refused.
  const here = NAV.find((n) => n.perm && active(n));
  const blocked = here?.perm && !ctx.can(here.perm) ? here : null;

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const navList = (compact: boolean) => (
    <ul className="space-y-0.5">
      {items.map((n) => {
        const on = active(n);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={on ? "page" : undefined}
              title={compact ? n.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                on ? "bg-forest text-white" : "text-ink-soft hover:bg-bg hover:text-ink"
              } ${compact ? "justify-center px-0" : ""}`}
            >
              <n.Icon size={18} className="shrink-0" aria-hidden />
              {!compact && <span>{n.label}</span>}
              {compact && <span className="sr-only">{n.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <StudioContext.Provider value={ctx}>
      <div className="min-h-dvh lg:flex">
        {/* Desktop sidebar */}
        <aside
          className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
            collapsed ? "w-[72px]" : "w-60"
          }`}
        >
          <div className={`flex items-center gap-2 px-4 py-4 ${collapsed ? "justify-center px-0" : ""}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">MS</div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight">Control Center</p>
                <p className="truncate text-[11px] text-ink-soft">Men&apos;s Social</p>
              </div>
            )}
          </div>
          <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3">{navList(collapsed)}</nav>
          <div className="space-y-3 border-t border-line p-3">
            {!collapsed && <Appearance />}
            <AccountRow name={name} role={roleLabel} compact={collapsed} onSignOut={signOut} />
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-bg ${collapsed ? "justify-center px-0" : ""}`}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
              {!collapsed && "Collapse"}
            </button>
          </div>
        </aside>

        {/* Phone / tablet top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setDrawer(true)} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-line">
            <Menu size={18} />
          </button>
          <p className="text-sm font-bold">{items.find(active)?.label ?? "Control Center"}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-xs font-bold text-mint">MS</div>
        </header>

        {/* Phone / tablet drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setDrawer(false)} />
            <div className="page-enter absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
              <div className="flex items-center justify-between px-4 py-4">
                <p className="text-sm font-bold">Control Center</p>
                <button onClick={() => setDrawer(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-line">
                  <X size={16} />
                </button>
              </div>
              <nav aria-label="Admin menu" className="flex-1 overflow-y-auto px-3">{navList(false)}</nav>
              <div className="space-y-3 border-t border-line p-3">
                <Appearance />
                <AccountRow name={name} role={roleLabel} compact={false} onSignOut={signOut} />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-6xl">
            {blocked ? (
              <div className="mx-auto mt-10 max-w-md rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
                <p className="font-semibold">{blocked.label} isn&apos;t part of your role</p>
                <p className="mt-1 text-sm text-ink-soft">You&apos;re signed in as {roleLabel}. An owner can change your role in Settings → Admins.</p>
                <Link href="/studio" className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
                  Back to Overview
                </Link>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </StudioContext.Provider>
  );
}

function AccountRow({ name, role, compact, onSignOut }: { name: string; role: string; compact: boolean; onSignOut: () => void }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "flex-col" : ""}`}>
      <Link href="/studio/settings" className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-bg ${compact ? "justify-center" : ""}`} title={`${name} · ${role}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest-deep">
          {name.slice(0, 2).toUpperCase()}
        </span>
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-[11px] text-ink-soft">{role}</span>
          </span>
        )}
      </Link>
      <button onClick={onSignOut} aria-label="Sign out" title="Sign out" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-bg">
        <LogOut size={15} />
      </button>
    </div>
  );
}

/** Same appearance settings as the men's app (shared on this device): light / dark / auto and colour. */
export function Appearance() {
  const theme = useThemePref();
  const accent = useAccent();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 rounded-full bg-bg p-0.5 text-[11px] font-semibold ring-1 ring-line" role="radiogroup" aria-label="Appearance">
        {(["light", "dark", "auto"] as ThemePref[]).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={theme === m}
            onClick={(e) => setThemePref(m, { x: e.clientX, y: e.clientY })}
            className={`rounded-full py-1.5 capitalize ${theme === m ? "bg-forest text-white" : "text-ink-soft"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-1" role="radiogroup" aria-label="Colour">
        <span className="text-[11px] font-semibold text-ink-soft">Colour</span>
        <span className="flex gap-1.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={accent === a.id}
              aria-label={a.label}
              onClick={(e) => setAccent(a.id, { x: e.clientX, y: e.clientY })}
              className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-surface ${accent === a.id ? "ring-2 ring-ink" : ""}`}
              style={{ background: a.swatch }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

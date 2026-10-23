"use client";

// Phone notifications on Me (Step 79): turn them on, choose the daily reminder time, and whether the
// message text may show on the lock screen (off by default: the lock screen says only "Men's Social").
// Also PushInvite: a one-time card on the Man tab that offers the daily reminder.

import { useEffect, useState } from "react";
import { BellRing, Smartphone, X } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { haptic } from "@/lib/motion/haptics";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_REMINDER,
  REMINDER_TIMES,
  currentSubscription,
  disablePush,
  enablePush,
  loadReminder,
  pushPermission,
  pushSupport,
  saveReminder,
  type PushSupport,
  type Reminder,
} from "@/lib/notifications/push";

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (on: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2.5 text-sm">
      <span className="min-w-0">{label}</span>
      <input type="checkbox" role="switch" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-forest peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-forest after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

/** Is this phone getting notifications right now? */
function usePushState() {
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [on, setOn] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s !== "ok") return setChecked(true);
    void currentSubscription().then((sub) => {
      setOn(Boolean(sub) && pushPermission() === "granted");
      setChecked(true);
    });
  }, []);
  return { support, on, setOn, checked };
}

export default function PhoneNotifications() {
  const t = useT();
  const showToast = useToast();
  const { support, on, setOn, checked } = usePushState();
  const [busy, setBusy] = useState(false);
  const [rem, setRem] = useState<Reminder | null>(null);
  useEffect(() => {
    void loadReminder().then(setRem);
  }, []);

  if (support === "not-set-up" || support === "unsupported" || !checked) return null;

  if (support !== "ok") {
    return (
      <div className="mt-3 flex gap-3 rounded-2xl bg-bg p-3 text-xs text-ink-soft ring-1 ring-line">
        <Smartphone size={16} className="mt-0.5 shrink-0 text-forest" />
        <p>
          {support === "ios-home-screen"
            ? t("On iPhone: tap Share, then Add to Home Screen, and open Men's Social from there to turn on phone notifications.")
            : t("Phone notifications come to this app in a later update. Messages still arrive in the bell.")}
        </p>
      </div>
    );
  }

  const toggle = async (want: boolean) => {
    setBusy(true);
    if (want) {
      const r = await enablePush();
      if (r === "on") {
        setOn(true);
        haptic("done");
        showToast(t("Phone notifications on"));
      } else if (r === "denied") showToast(t("Notifications are blocked. Allow them for Men's Social in your phone's settings."));
      else showToast(t("Couldn't turn them on just now. Try again."));
    } else {
      await disablePush();
      setOn(false);
      showToast(t("Phone notifications off"));
    }
    setBusy(false);
  };

  const change = async (c: Partial<Reminder>) => {
    const prev = rem ?? DEFAULT_REMINDER;
    setRem({ ...prev, ...c });
    try {
      await saveReminder(c);
      showToast(t("Choice saved"));
    } catch {
      setRem(prev);
      showToast(t("Couldn't save just now. We'll try again."));
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-bg px-4 py-1 ring-1 ring-line">
      <Switch
        checked={on}
        disabled={busy}
        onChange={toggle}
        label={
          <span>
            <span className="block font-semibold">{t("Phone notifications")}</span>
            <span className="block text-xs text-ink-soft">{t("Your lock screen shows only \"Men's Social\".")}</span>
          </span>
        }
      />
      {on && rem && (
        <div className="divide-y divide-line border-t border-line">
          <Switch checked={rem.daily_reminder} onChange={(v) => change({ daily_reminder: v })} label={t("Daily reminder (skipped on days you've opened the app)")} />
          {rem.daily_reminder && (
            <label className="flex items-center justify-between gap-3 py-2.5 text-sm">
              {t("Remind me at")}
              <select
                value={REMINDER_TIMES.includes(rem.remind_at) ? rem.remind_at : "19:00"}
                onChange={(e) => change({ remind_at: e.target.value })}
                className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold ring-1 ring-line"
              >
                {REMINDER_TIMES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Switch checked={rem.lock_text} onChange={(v) => change({ lock_text: v })} label={t("Show the team's message text on my lock screen")} />
        </div>
      )}
    </div>
  );
}

const INVITE_KEY = "ms_push_invite_v1";

/** Man tab: a one-time offer of the daily reminder (only where it can work, and only if he hasn't decided yet). */
export function PushInvite() {
  const t = useT();
  const showToast = useToast();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(INVITE_KEY) === "1";
    } catch {}
    setShow(!seen && pushSupport() === "ok" && pushPermission() === "default");
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(INVITE_KEY, "1");
    } catch {}
    setShow(false);
  };
  return (
    <section className="relative rounded-3xl bg-surface p-5 ring-1 ring-line">
      <button onClick={close} aria-label={t("Not now")} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft">
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint text-forest">
          <BellRing size={20} />
        </span>
        <div>
          <p className="font-semibold">{t("Want a daily nudge?")}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{t("One short reminder in the evening, only on days you haven't opened the app. Your lock screen shows only \"Men's Social\".")}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={async () => {
            const r = await enablePush();
            close();
            if (r === "on") {
              haptic("done");
              showToast(t("Done. Change the time on Me → Notifications."));
            } else if (r === "denied") showToast(t("Notifications are blocked. Allow them for Men's Social in your phone's settings."));
          }}
          className="flex-1 rounded-full bg-forest py-2.5 text-sm font-semibold text-white"
        >
          {t("Turn on")}
        </button>
        <button onClick={close} className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-line">
          {t("Not now")}
        </button>
      </div>
    </section>
  );
}

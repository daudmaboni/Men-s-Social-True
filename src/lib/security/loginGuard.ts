// Slows down repeated wrong passwords and code requests on this device.
// Supabase already limits sign-in attempts per internet address on its servers (and CAPTCHA can be
// switched on); this adds a polite wait in the app so a guessing script, or a friend borrowing his
// phone, can't keep trying, and stops "send code" being tapped again and again (each SMS costs money).

type Entry = { fails: number; until: number };

const KEY = "ms_login_guard";
const FREE_TRIES = 5; // wrong tries allowed before waiting
const FIRST_WAIT = 30_000; // then 30 s, 1 min, 2 min … up to 15 min
const MAX_WAIT = 15 * 60_000;

let memory: Record<string, Entry> = {};

function load(): Record<string, Entry> {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as Record<string, Entry>;
  } catch {}
  return memory;
}
function save(all: Record<string, Entry>) {
  memory = all;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
const id = (scope: string, who: string) => `${scope}:${who.trim().toLowerCase()}`;

/** Seconds he still has to wait before trying again (0 = go ahead). */
export function waitSeconds(scope: string, who: string, now = Date.now()): number {
  const e = load()[id(scope, who)];
  return e && e.until > now ? Math.ceil((e.until - now) / 1000) : 0;
}

/** Call after a wrong password / code. Returns the new wait in seconds (0 while he still has free tries). */
export function recordFailure(scope: string, who: string, now = Date.now()): number {
  const all = load();
  const k = id(scope, who);
  const fails = (all[k]?.fails ?? 0) + 1;
  const over = fails - FREE_TRIES;
  const wait = over > 0 ? Math.min(FIRST_WAIT * 2 ** (over - 1), MAX_WAIT) : 0;
  save({ ...all, [k]: { fails, until: now + wait } });
  return Math.ceil(wait / 1000);
}

/** Call after a successful sign-in. */
export function recordSuccess(scope: string, who: string) {
  const all = load();
  delete all[id(scope, who)];
  save({ ...all });
}

/** For "send me a code": one request per `seconds`. Returns the wait left, or 0 and starts the timer. */
export function cooldown(scope: string, who: string, seconds: number, now = Date.now()): number {
  const left = waitSeconds(scope, who, now);
  if (left > 0) return left;
  const all = load();
  save({ ...all, [id(scope, who)]: { fails: 0, until: now + seconds * 1000 } });
  return 0;
}

/** "45 s" or "3 min" for messages (Kiswahili: "sekunde 45", "dakika 3"). */
export const formatWait = (s: number, lang: "en" | "sw" = "en") =>
  s < 90 ? (lang === "sw" ? `sekunde ${s}` : `${s} s`) : lang === "sw" ? `dakika ${Math.ceil(s / 60)}` : `${Math.ceil(s / 60)} min`;

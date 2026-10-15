// How strong is a new password? Used on sign-up, "choose a new password" and the Studio.
// The real rule is also set in Supabase (Authentication → Providers → Email), so it can't be skipped
// by going around the app. This check explains the rule to him and catches the obvious weak ones.

export type PasswordCheck = {
  ok: boolean;
  /** 0 = very weak … 4 = strong (for the meter) */
  score: 0 | 1 | 2 | 3 | 4;
  /** The first thing to fix, in English (translated on screen). null when ok. */
  problem: string | null;
};

// Passwords people really use (worldwide lists plus local ones). Compared without case and spaces.
const COMMON = new Set(
  [
    "password", "password1", "password123", "passw0rd", "12345678", "123456789", "1234567890", "12345678910",
    "87654321", "11111111", "00000000", "88888888", "12121212", "11223344", "123123123", "qwerty", "qwerty123",
    "qwertyuiop", "asdfghjk", "asdfghjkl", "zxcvbnm", "abc12345", "abcd1234", "1q2w3e4r", "1qaz2wsx", "iloveyou",
    "iloveyou1", "letmein", "welcome", "welcome1", "admin123", "administrator", "sunshine", "princess", "football",
    "baseball", "monkey123", "dragon123", "trustno1", "superman", "michael1", "computer", "internet", "whatever",
    // Tanzania / Swahili / this app
    "tanzania", "tanzania1", "tanzania123", "daressalaam", "dareslam", "dodoma", "arusha", "zanzibar", "kilimanjaro",
    "simba", "simba123", "simbasc", "yanga", "yanga123", "youngafricans", "azam", "taifa", "taifastars", "bongo",
    "nakupenda", "nakupenda1", "mungu", "mungu123", "mungumwema", "asante", "karibu", "karibu123", "jambo",
    "jambo123", "hakunamatata", "mpenzi", "mpenzi123", "mama1234", "baba1234", "maisha", "maisha123", "uhuru",
    "kayani", "kayani123", "kayaniherbs", "menssocial", "mens social", "mwanaume", "mwanaume1",
  ].map((p) => p.replace(/\s+/g, "")),
);

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** Same character repeated, or a straight run like 12345678 / abcdefgh. */
function isPattern(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true;
  const codes = [...pw].map((c) => c.charCodeAt(0));
  const up = codes.every((c, i) => i === 0 || c === codes[i - 1] + 1);
  const down = codes.every((c, i) => i === 0 || c === codes[i - 1] - 1);
  return up || down;
}

export function checkPassword(pw: string, opts: { email?: string | null; minLength?: number } = {}): PasswordCheck {
  const min = opts.minLength ?? 8;
  const n = norm(pw);
  const letters = /[a-z]/i.test(pw);
  const digits = /\d/.test(pw);
  const symbols = /[^a-z0-9\s]/i.test(pw);
  const mixedCase = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const kinds = [letters, digits, symbols, mixedCase].filter(Boolean).length;

  // Part of his email before the @ (e.g. "juma.mwita") is easy to guess
  const local = norm((opts.email ?? "").split("@")[0] ?? "").replace(/[^a-z0-9]/g, "");
  const hasName = local.length >= 4 && n.replace(/[^a-z0-9]/g, "").includes(local);
  // A known word with digits on the end: "simba2024", "password!!"
  const base = n.replace(/[^a-z]+$/g, "").replace(/^[^a-z]+/g, "");
  const commonBase = COMMON.has(base) && n.length < 14;

  let problem: string | null = null;
  if (pw.length < min) problem = min === 8 ? "Use at least 8 characters." : "Use at least {n} characters.";
  else if (COMMON.has(n) || isPattern(n)) problem = "This password is too common. Pick something only you would think of.";
  else if (commonBase) problem = "Too easy to guess: a common word with numbers. Add another word.";
  else if (hasName) problem = "Don't use your email name in your password.";
  else if (!(letters && digits) && pw.length < 14) problem = "Mix letters and numbers, or use a longer phrase of 3–4 words.";

  let score: PasswordCheck["score"];
  if (problem) score = pw.length === 0 ? 0 : pw.length < min || COMMON.has(n) || isPattern(n) ? 0 : 1;
  else if (pw.length >= 14 || (pw.length >= 12 && kinds >= 3)) score = 4;
  else if (pw.length >= 10 && kinds >= 2) score = 3;
  else score = 2;

  return { ok: problem === null, score, problem };
}

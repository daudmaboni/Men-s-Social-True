// Studio staff can sign in with a username (e.g. "TheAdmin") instead of an email.
// Supabase logins are emails, so a username is turned into a private staff address:
//   TheAdmin  →  theadmin@studio.menssocial.app
// That account is created once in Supabase (Authentication → Users → Add user). No password lives in the code.

export const STAFF_DOMAIN = "studio.menssocial.app";

export function toLoginEmail(input: string): string {
  const v = input.trim();
  if (v.includes("@")) return v;
  return `${v.toLowerCase()}@${STAFF_DOMAIN}`;
}

/** What to show for a signed-in staff member: their username, or their email if they used one. */
export function staffName(email: string): string {
  const suffix = `@${STAFF_DOMAIN}`;
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}

export const USERNAME_RULE = /^[A-Za-z][A-Za-z0-9._-]{2,31}$/;

// Who can do what in the Admin Control Center.
// This mirrors public.admin_can() in supabase/migrations/0006 — the DATABASE enforces it;
// the screens only use it to hide buttons a role can't use.

export type AdminRole = "owner" | "editor" | "writer" | "moderator" | "analyst";

export type Perm =
  | "content.edit"
  | "content.publish"
  | "homepage.edit"
  | "homepage.publish"
  | "notifications.send"
  | "ai.use"
  | "analytics.view"
  | "audit.view"
  | "users.view"
  | "users.restrict"
  | "users.delete"
  /** Open a man's health records — only while HE shares them with support (Step 65). Owners only. */
  | "users.private"
  | "community.moderate"
  | "settings.manage"
  | "admins.manage";

const ROLE_PERMS: Record<Exclude<AdminRole, "owner">, Perm[]> = {
  editor: ["content.edit", "content.publish", "homepage.edit", "homepage.publish", "notifications.send", "ai.use", "analytics.view", "audit.view", "users.view"],
  writer: ["content.edit", "homepage.edit", "ai.use", "analytics.view"],
  moderator: ["community.moderate", "users.view", "users.restrict", "notifications.send", "analytics.view", "audit.view"],
  analyst: ["analytics.view", "users.view"],
};

export function can(role: AdminRole | null | undefined, perm: Perm): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  return ROLE_PERMS[role]?.includes(perm) ?? false;
}

export const ROLES: { id: AdminRole; label: string; about: string }[] = [
  { id: "owner", label: "Owner", about: "Everything, including admins, switches and deleting accounts." },
  { id: "editor", label: "Editor", about: "Writes and publishes content, runs the homepage, sends notifications, uses AI." },
  { id: "writer", label: "Writer", about: "Writes drafts and submits them for review. Can't publish." },
  { id: "moderator", label: "Moderator", about: "Looks after Community: reports, hiding posts, warnings and restrictions. Can also send in-app messages." },
  { id: "analyst", label: "Analyst", about: "Reads dashboards and the user list. Can't change anything." },
];

export const isRole = (v: unknown): v is AdminRole => ROLES.some((r) => r.id === v);

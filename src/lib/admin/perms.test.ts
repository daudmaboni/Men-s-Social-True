import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { can, ROLES, type Perm } from "./perms";

// The screens' permission map must say exactly what the database says (0006 admin_can).
describe("admin permissions mirror the database", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0006_admin_control_center.sql"), "utf8");
  const block = sql.slice(sql.indexOf("create or replace function public.admin_can"), sql.indexOf("create or replace function public.require_perm"));
  for (const role of ["editor", "writer", "moderator", "analyst"] as const) {
    it(role, () => {
      const line = block.split("\n").find((l) => l.includes(`when '${role}' then`))!;
      const next = block.split("\n")[block.split("\n").indexOf(line) + 1];
      const perms = [...`${line} ${next.includes("when '") ? "" : next}`.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1] as Perm);
      const all: Perm[] = ["content.edit", "content.publish", "homepage.edit", "homepage.publish", "notifications.send", "ai.use", "analytics.view", "audit.view", "users.view", "users.restrict", "users.delete", "community.moderate", "settings.manage", "admins.manage"];
      for (const p of all) expect(`${role}:${p}:${can(role, p)}`).toBe(`${role}:${p}:${perms.includes(p)}`);
    });
  }
  it("owners can do everything; others can't manage admins", () => {
    expect(can("owner", "admins.manage")).toBe(true);
    expect(ROLES.filter((r) => can(r.id, "admins.manage")).map((r) => r.id)).toEqual(["owner"]);
    expect(can(null, "analytics.view")).toBe(false);
  });
});

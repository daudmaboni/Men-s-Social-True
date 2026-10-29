// Step 100: migration 0021 in a real Postgres (PGlite). Before it, a "journey" row is refused with the
// code account sync looks for (23514); after it, each man reads and changes only his own journey, staff
// see nothing, and his existing rows are untouched.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const JUMA = "11111111-1111-1111-1111-111111111111";
const ALLY = "22222222-2222-2222-2222-222222222222";
const ADMIN = "33333333-3333-3333-3333-333333333333";
const file = (f: string) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");

let db: PGlite;
async function as(uid: string, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}
const save = (uid: string, kind: string, data: object) =>
  as(uid, "insert into public.user_data (user_id, kind, data) values ($1, $2, $3) on conflict (user_id, kind) do update set data = excluded.data", [uid, kind, JSON.stringify(data)]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id serial primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create role anon; create role authenticated;
  `);
  await db.exec(file("0001_content_studio.sql"));
  await db.exec(file("0002_user_accounts.sql"));
  await db.exec(`
    grant usage on schema public, auth to anon, authenticated;
    grant select, insert, update, delete on public.user_data to anon, authenticated;
    grant select on public.admins to authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
    grant execute on function public.is_admin() to anon, authenticated;
  `);
  await db.query("insert into auth.users (id) values ($1), ($2), ($3)", [JUMA, ALLY, ADMIN]);
  await db.query("insert into public.admins (user_id, role) values ($1, 'owner')", [ADMIN]);
}, 30_000);

describe("migration 0021: journey rows", () => {
  it("before it, a journey row is refused with code 23514 (sync then keeps it on the phone)", async () => {
    await save(JUMA, "feed", { days: { "2026-10-28": { walk: { status: "done" } } } });
    let code: string | undefined;
    try {
      await save(JUMA, "journey", { assessment: {} });
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    expect(code).toBe("23514");
  });

  it("after it (run twice), journey rows save and nothing he had is changed", async () => {
    await db.exec(file("0021_journey.sql"));
    await db.exec(file("0021_journey.sql"));
    await save(JUMA, "journey", { assessment: { answers: { concerns: ["early"] } } });
    const rows = await as(JUMA, "select kind, data from public.user_data order by kind");
    expect(rows.rows).toEqual([
      { kind: "feed", data: { days: { "2026-10-28": { walk: { status: "done" } } } } },
      { kind: "journey", data: { assessment: { answers: { concerns: ["early"] } } } },
    ]);
  });

  it("other kinds are still refused", async () => {
    await expect(save(JUMA, "anything", {})).rejects.toThrow(/check constraint/);
  });

  it("another man and staff can't see his journey", async () => {
    expect((await as(ALLY, "select * from public.user_data where kind = 'journey'")).rows).toHaveLength(0);
    expect((await as(ADMIN, "select * from public.user_data where kind = 'journey'")).rows).toHaveLength(0);
    expect((await as(ALLY, "update public.user_data set data = '{}' where kind = 'journey' returning 1")).rows).toHaveLength(0);
  });

  it("the staff 'his records' view never includes the journey", () => {
    const later = ["0012_user_profile.sql", "0021_journey.sql"].map(file).join("\n");
    const fn = /function public\.admin_user_private[\s\S]*?\$\$;/.exec(later)?.[0] ?? "";
    expect(fn).not.toBe("");
    expect(fn).not.toMatch(/journey/);
  });
});

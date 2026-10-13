// Runs the accounts migration in a real Postgres (PGlite) and checks that every man
// can only see his own data — and that Content Studio admins can't see it either.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const JUMA = "11111111-1111-1111-1111-111111111111";
const ALLY = "22222222-2222-2222-2222-222222222222";
const ADMIN = "33333333-3333-3333-3333-333333333333";

let db: PGlite;

async function as(uid: string | null, role: "anon" | "authenticated", sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); set role ${role};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

const save = (uid: string, kind: string, data: object) =>
  as(uid, "authenticated", "insert into public.user_data (user_id, kind, data) values ($1, $2, $3) on conflict (user_id, kind) do update set data = excluded.data", [uid, kind, JSON.stringify(data)]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id serial primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create role anon; create role authenticated;
  `);
  for (const f of ["0001_content_studio.sql", "0002_user_accounts.sql"]) {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");
    await db.exec(sql);
    await db.exec(sql); // safe to run twice
  }
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

describe("men's own data", () => {
  it("a man can save and read his own data", async () => {
    await save(JUMA, "progress", { records: [{ value: 250 }] });
    await save(JUMA, "progress", { records: [{ value: 500 }] }); // update
    const r = await as(JUMA, "authenticated", "select kind, data from public.user_data");
    expect(r.rows).toEqual([{ kind: "progress", data: { records: [{ value: 500 }] } }]);
  });

  it("another man cannot see, change or delete it", async () => {
    await save(ALLY, "social", { nickname: "Ally" });
    const seen = await as(ALLY, "authenticated", "select user_id from public.user_data");
    expect(seen.rows).toEqual([{ user_id: ALLY }]);
    const upd = await as(ALLY, "authenticated", "update public.user_data set data = '{}' where user_id = $1 returning 1", [JUMA]);
    expect(upd.rows).toHaveLength(0);
    const del = await as(ALLY, "authenticated", "delete from public.user_data where user_id = $1 returning 1", [JUMA]);
    expect(del.rows).toHaveLength(0);
  });

  it("nobody can write rows in someone else's name", async () => {
    await expect(
      as(ALLY, "authenticated", "insert into public.user_data (user_id, kind, data) values ($1, 'feed', '{}')", [JUMA]),
    ).rejects.toThrow(/row-level security/);
  });

  it("Content Studio admins and visitors can't read men's data", async () => {
    expect((await as(ADMIN, "authenticated", "select * from public.user_data")).rows).toHaveLength(0);
    expect((await as(null, "anon", "select * from public.user_data")).rows).toHaveLength(0);
  });

  it("rejects unknown kinds of data", async () => {
    await expect(save(JUMA, "passwords", {})).rejects.toThrow();
  });

  it("delete my account removes his login and all his data, and nobody else's", async () => {
    await as(JUMA, "authenticated", "select public.delete_my_account()");
    const users = await db.query<{ id: string }>("select id from auth.users order by id");
    expect(users.rows.map((u) => u.id)).toEqual([ALLY, ADMIN]);
    const left = await db.query<{ user_id: string }>("select user_id from public.user_data");
    expect(left.rows).toEqual([{ user_id: ALLY }]);
  });

  it("delete my account needs a signed-in man", async () => {
    await expect(as(null, "anon", "select public.delete_my_account()")).rejects.toThrow();
  });
});

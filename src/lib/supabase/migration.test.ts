// Runs the real migration SQL in a real Postgres (PGlite) with small stand-ins for
// Supabase's auth and storage schemas, then checks the security rules.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";

const SUPABASE_STANDINS = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  create role anon; create role authenticated;
`;

const GRANTS = `
  grant usage on schema public, auth, storage to anon, authenticated;
  grant select on all tables in schema public to anon, authenticated;
  grant insert, update, delete on public.content_items to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.objects to anon;
  grant usage, select on all sequences in schema storage to authenticated;
  grant execute on all functions in schema public, auth to anon, authenticated;
`;

let db: PGlite;

async function as(uid: string | null, role: "anon" | "authenticated", sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); set role ${role};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

const insertSql = `insert into public.content_items (id, kind, topic, title, status)
  values ($1, 'article', 'erection', 'A test article', $2)`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/0001_content_studio.sql"), "utf8");
  await db.exec(migration);
  await db.exec(migration); // must be safe to run twice
  await db.exec(GRANTS);
  await db.query("insert into auth.users (id) values ($1), ($2)", [ADMIN, USER]);
  await db.query("insert into public.admins (user_id, role) values ($1, 'owner')", [ADMIN]);
}, 30_000);

describe("content security rules", () => {
  it("an admin can create drafts and published items", async () => {
    await as(ADMIN, "authenticated", insertSql, ["draft-one", "draft"]);
    await as(ADMIN, "authenticated", insertSql, ["live-one", "published"]);
    const all = await as(ADMIN, "authenticated", "select id from public.content_items order by id");
    expect(all.rows.map((r) => (r as { id: string }).id)).toEqual(["draft-one", "live-one"]);
  });

  it("the public (not signed in) sees only published content", async () => {
    const r = await as(null, "anon", "select id from public.content_items");
    expect(r.rows.map((x) => (x as { id: string }).id)).toEqual(["live-one"]);
  });

  it("a signed-in man who is not an admin also sees only published content", async () => {
    const r = await as(USER, "authenticated", "select id from public.content_items");
    expect(r.rows.map((x) => (x as { id: string }).id)).toEqual(["live-one"]);
  });

  it("a non-admin cannot create, change or delete content", async () => {
    await expect(as(USER, "authenticated", insertSql, ["sneaky", "published"])).rejects.toThrow(/row-level security/);
    const upd = await as(USER, "authenticated", "update public.content_items set title = 'hacked' where id = 'live-one' returning id");
    expect(upd.rows).toHaveLength(0);
    const del = await as(USER, "authenticated", "delete from public.content_items where id = 'live-one' returning id");
    expect(del.rows).toHaveLength(0);
  });

  it("publishing sets published_at and records who changed it", async () => {
    await as(ADMIN, "authenticated", "update public.content_items set status = 'published' where id = 'draft-one'");
    const r = await db.query<{ published_at: string | null; updated_by: string; created_by: string }>(
      "select published_at, updated_by, created_by from public.content_items where id = 'draft-one'",
    );
    expect(r.rows[0].published_at).not.toBeNull();
    expect(r.rows[0].updated_by).toBe(ADMIN);
    expect(r.rows[0].created_by).toBe(ADMIN);
  });

  it("keeps an audit log that only admins can read", async () => {
    const admin = await as(ADMIN, "authenticated", "select action, status_after from public.content_audit where content_id = 'draft-one' order by id");
    expect(admin.rows).toEqual([
      { action: "insert", status_after: "draft" },
      { action: "update", status_after: "published" },
    ]);
    const user = await as(USER, "authenticated", "select * from public.content_audit");
    expect(user.rows).toHaveLength(0);
  });

  it("rejects bad values (unknown topic, bad id)", async () => {
    await expect(
      as(ADMIN, "authenticated", "insert into public.content_items (id, kind, topic, title) values ('ok-id', 'article', 'football', 'Title')"),
    ).rejects.toThrow();
    await expect(
      as(ADMIN, "authenticated", "insert into public.content_items (id, kind, topic, title) values ('Bad ID!', 'article', 'erection', 'Title')"),
    ).rejects.toThrow();
  });

  it("only admins can upload images", async () => {
    await as(ADMIN, "authenticated", "insert into storage.objects (bucket_id, name) values ('content-images', 'a.jpg')");
    await expect(
      as(USER, "authenticated", "insert into storage.objects (bucket_id, name) values ('content-images', 'b.jpg')"),
    ).rejects.toThrow(/row-level security/);
    const pub = await as(null, "anon", "select name from storage.objects");
    expect(pub.rows).toEqual([{ name: "a.jpg" }]);
  });
});

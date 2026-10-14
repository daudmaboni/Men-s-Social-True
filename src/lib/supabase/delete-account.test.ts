// Reproduces "Delete your account" failing for someone who wrote Studio content
// (content_items_created_by_fkey), and checks migration 0004 fixes it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const WRITER = "44444444-4444-4444-4444-444444444444";
const OTHER = "55555555-5555-5555-5555-555555555555";
const file = (f: string) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");

async function setup(withFix: boolean) {
  const db = new PGlite();
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
  const files = ["0001_content_studio.sql", "0002_user_accounts.sql", "0003_fertility_topic.sql"];
  if (withFix) files.push("0004_studio_places_and_account_fix.sql");
  for (const f of files) {
    await db.exec(file(f));
    await db.exec(file(f)); // safe to run twice
  }
  await db.query("insert into auth.users (id) values ($1), ($2)", [WRITER, OTHER]);
  await db.query("insert into public.admins (user_id, role) values ($1, 'owner'), ($2, 'editor')", [WRITER, OTHER]);
  await db.exec(`select set_config('test.uid', '${WRITER}', false)`);
  await db.exec(`insert into public.content_items (id, kind, topic, title) values ('my-guide', 'guide', 'wellbeing', 'My guide')`);
  // Someone else edits it too
  await db.exec(`select set_config('test.uid', '${OTHER}', false)`);
  await db.exec(`update public.content_items set summary = 'Edited' where id = 'my-guide'`);
  await db.exec(`select set_config('test.uid', '${WRITER}', false)`);
  await db.exec(`insert into public.content_items (id, kind, topic, title) values ('second-one', 'video', 'fertility', 'Second')`);
  return db;
}

// Each test starts its own small Postgres, which can take 15+ seconds on a slower PC
describe("delete my account when he wrote Studio content", { timeout: 60_000 }, () => {
  it("fails before migration 0004 (the error Daud saw)", async () => {
    const db = await setup(false);
    await expect(db.exec("select public.delete_my_account()")).rejects.toThrow(/content_items_created_by_fkey/);
  });

  it("works after 0004: account gone, content stays, author forgotten", async () => {
    const db = await setup(true);
    await db.exec("select public.delete_my_account()");
    expect((await db.query("select id from auth.users")).rows).toEqual([{ id: OTHER }]);
    const items = await db.query<{ id: string; created_by: string | null; updated_by: string | null; summary: string }>(
      "select id, created_by, updated_by, summary from public.content_items order by id",
    );
    expect(items.rows).toEqual([
      { id: "my-guide", created_by: null, updated_by: OTHER, summary: "Edited" },
      { id: "second-one", created_by: null, updated_by: null, summary: "" },
    ]);
    // Normal edits still record who changed it
    await db.exec(`select set_config('test.uid', '${OTHER}', false)`);
    await db.exec(`update public.content_items set summary = 'Again' where id = 'second-one'`);
    const r = await db.query<{ updated_by: string }>("select updated_by from public.content_items where id = 'second-one'");
    expect(r.rows[0].updated_by).toBe(OTHER);
  });

  it("adds the Featured pin, video address, Kiswahili summary and the video bucket", async () => {
    const db = await setup(true);
    await db.exec(`update public.content_items set featured = true, video_url = 'https://x/v.mp4', summary_sw = 'Muhtasari' where id = 'second-one'`);
    const r = await db.query("select featured, video_url, summary_sw from public.content_items where id = 'second-one'");
    expect(r.rows).toEqual([{ featured: true, video_url: "https://x/v.mp4", summary_sw: "Muhtasari" }]);
    expect((await db.query("select id from storage.buckets order by id")).rows).toEqual([{ id: "content-images" }, { id: "content-videos" }]);
  });
});

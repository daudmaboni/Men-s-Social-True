// Admin Control Center rules, checked in a real Postgres (PGlite) with every migration applied.
// These prove the permissions are enforced by the database, not just hidden in the screens.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const OWNER = "00000000-0000-0000-0000-000000000001";
const EDITOR = "00000000-0000-0000-0000-000000000002";
const WRITER = "00000000-0000-0000-0000-000000000003";
const MOD = "00000000-0000-0000-0000-000000000004";
const ANALYST = "00000000-0000-0000-0000-000000000005";
const JUMA = "00000000-0000-0000-0000-00000000000a";
const ALLY = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;

// By default everyone is signed in with the second step done (aal2), like a real admin after 0007.
// Pass aal = "aal1" for "password only".
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = [], aal: "aal1" | "aal2" = "aal2") {
  const claims = uid ? JSON.stringify({ sub: uid, role: "authenticated", aal }) : "";
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role ${uid ? "authenticated" : "anon"};`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}
const fails = (uid: string | null, sql: string, params: unknown[] = []) => expect(as(uid, sql, params)).rejects.toThrow();

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now(),
      last_sign_in_at timestamptz, banned_until timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
  `);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  // Old files run again by mistake must not switch off two-step sign-in (re-run guard, Step 34)
  await db.exec(readFileSync(join(dir, "0001_content_studio.sql"), "utf8"));
  await db.exec(readFileSync(join(dir, "0006_admin_control_center.sql"), "utf8"));
  await db.exec(readFileSync(join(dir, "0008_safety_fixes.sql"), "utf8")); // safe to run twice
  await db.exec(`grant all on all tables in schema public to anon, authenticated; grant usage, select on all sequences in schema public to anon, authenticated;`);
  await db.exec(`grant select on storage.buckets to anon, authenticated;`);
  const people: [string, string][] = [[OWNER, "owner@x.co"], [EDITOR, "editor@x.co"], [WRITER, "writer@x.co"], [MOD, "mod@x.co"], [ANALYST, "analyst@x.co"], [JUMA, "juma@x.co"], [ALLY, "ally@x.co"]];
  for (const [id, email] of people) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  for (const [id, role] of [[OWNER, "owner"], [EDITOR, "editor"], [WRITER, "writer"], [MOD, "moderator"], [ANALYST, "analyst"]])
    await db.query("insert into public.admins (user_id, role) values ($1, $2)", [id, role]);
}, 60_000);

describe("content workflow", { timeout: 30_000 }, () => {
  it("writers draft and submit for review, but can't publish", async () => {
    await as(WRITER, "insert into public.content_items (id, kind, topic, title) values ('w-guide', 'guide', 'wellbeing', 'Writer guide')");
    await as(WRITER, "update public.content_items set status = 'review' where id = 'w-guide'");
    await fails(WRITER, "update public.content_items set status = 'published' where id = 'w-guide'");
    expect((await as(null, "select id from public.content_items"))).toEqual([]);
  });

  it("editors publish; men then see it; writers can't change live content", async () => {
    await as(EDITOR, "update public.content_items set status = 'published' where id = 'w-guide'");
    expect(await as(null, "select id from public.content_items")).toEqual([{ id: "w-guide" }]);
    await fails(WRITER, "update public.content_items set title = 'Changed by writer' where id = 'w-guide'");
  });

  it("scheduled content stays hidden from men until its time", async () => {
    await as(EDITOR, "insert into public.content_items (id, kind, topic, title, status, publish_at) values ('later-one', 'article', 'libido', 'Later', 'published', now() + interval '2 days')");
    expect((await as(null, "select id from public.content_items order by id")).map((r) => r.id)).toEqual(["w-guide"]);
    expect((await as(ANALYST, "select id from public.content_items order by id")).map((r) => r.id)).toEqual(["later-one", "w-guide"]);
  });

  it("keeps the previous version on every change", async () => {
    await as(EDITOR, "update public.content_items set summary = 'New summary' where id = 'w-guide'");
    const v = await as<{ title: string }>(EDITOR, "select snapshot->>'summary' as title from public.content_versions where content_id = 'w-guide' order by id desc limit 1");
    expect(v[0].title).toBe("");
  });

  it("AI-assisted content can't go live until a professional has checked it", async () => {
    await as(EDITOR, "insert into public.content_items (id, kind, topic, title, ai_generated) values ('ai-draft', 'article', 'wellbeing', 'AI draft', true)");
    await fails(EDITOR, "update public.content_items set status = 'published' where id = 'ai-draft'");
    await as(EDITOR, "update public.content_items set status = 'published', review = 'reviewed' where id = 'ai-draft'");
  });

  it("records content actions in the audit log", async () => {
    const rows = await as<{ action: string }>(OWNER, "select action from public.admin_audit where target = 'w-guide' order by id");
    expect(rows.map((r) => r.action)).toEqual(["content.create", "content.review", "content.published"]);
  });
});

describe("homepage layout", { timeout: 30_000 }, () => {
  const cfg = JSON.stringify({ version: 1, sections: [{ id: "featured", visible: true, items: ["w-guide"] }, { id: "topics", visible: false }] });
  it("writers save drafts; only editors/owners publish; men read only the live one", async () => {
    await as(WRITER, "select public.homepage_save_draft($1::jsonb)", [cfg]);
    await fails(WRITER, "select public.homepage_publish('try')");
    expect(await as(null, "select config from public.homepage_configs")).toEqual([]);
    await as(EDITOR, "select public.homepage_publish('First layout')");
    const live = await as<{ config: { sections: unknown[] } }>(null, "select config from public.homepage_configs");
    expect(live).toHaveLength(1);
    expect(live[0].config.sections).toHaveLength(2);
  });
  it("rejects unknown sections", async () => {
    await fails(EDITOR, "select public.homepage_save_draft($1::jsonb)", [JSON.stringify({ sections: [{ id: "ads" }] })]);
  });
  it("restores an earlier layout as a draft", async () => {
    await as(EDITOR, "select public.homepage_save_draft($1::jsonb)", [JSON.stringify({ sections: [{ id: "topics", visible: true }] })]);
    await as(EDITOR, "select public.homepage_publish('Second')");
    const old = await as<{ id: number }>(EDITOR, "select id from public.homepage_configs where state = 'archived'");
    await as(EDITOR, "select public.homepage_restore($1)", [old[0].id]);
    const draft = await as<{ n: number }>(EDITOR, "select jsonb_array_length(config->'sections') as n from public.homepage_configs where state = 'draft'");
    expect(draft[0].n).toBe(2);
    await as(EDITOR, "select public.homepage_discard_draft()");
  });
});

describe("community and moderation", { timeout: 30_000 }, () => {
  let postId = "";
  it("men post; others never see who wrote an anonymous post", async () => {
    const r = await as<{ id: string }>(JUMA, "select public.community_create_post('general', 'How do you handle nerves?', '', true, null, false) as id");
    postId = r[0].id;
    const seen = await as<Record<string, unknown>>(ALLY, "select * from public.community_list('all', 'new', 20)");
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0])).not.toContain("author");
    expect(seen[0].mine).toBe(false);
    expect(await as(ALLY, "select * from public.community_posts")).toEqual([]); // no direct access
  });
  it("blocks phone numbers and flags risky health advice for moderators", async () => {
    await fails(ALLY, "select public.community_create_post('general', 'Call me on 0712 345 678 please', '', true, null, false)");
    await as(ALLY, "select public.community_create_post('general', 'Just stop taking your medicine', '', true, null, false)");
    const q = await as<{ urgent: boolean; auto: boolean }>(MOD, "select urgent, auto from public.mod_reports('open')");
    expect(q).toEqual([{ urgent: true, auto: true }]);
  });
  it("moderators hide posts; men stop seeing them; the author still sees his own", async () => {
    await as(ALLY, "select public.community_report('post', $1, 'Selling or advertising')", [postId]);
    await as(MOD, "select public.mod_set_status('post', $1, 'hidden', 'Off-topic')", [postId]);
    expect((await as<{ id: string }>(ALLY, "select id from public.community_list()")).map((x) => x.id)).not.toContain(postId);
    expect((await as<{ id: string }>(JUMA, "select id from public.community_list()")).map((x) => x.id)).toContain(postId);
    const reports = await as<{ status: string }>(MOD, "select status from public.mod_reports('all') where target_id = $1", [postId]);
    expect(reports.every((r) => r.status === "resolved")).toBe(true);
  });
  it("only moderators can moderate", async () => {
    await fails(EDITOR, "select public.mod_set_status('post', $1, 'visible')", [postId]);
    await fails(JUMA, "select * from public.mod_items()");
  });
});

describe("users", { timeout: 30_000 }, () => {
  it("analysts see masked emails; owners see full emails", async () => {
    const a = await as<{ email: string }>(ANALYST, "select email from public.admin_users('juma', 'all', 10, 0)");
    expect(a[0].email).toBe("ju•••@x.co");
    const o = await as<{ email: string }>(OWNER, "select email from public.admin_users('juma', 'all', 10, 0)");
    expect(o[0].email).toBe("juma@x.co");
  });
  it("moderators restrict; restricted men can't post; editors can't restrict", async () => {
    await fails(EDITOR, "select public.admin_restrict_user($1, 7, 'spam')", [ALLY]);
    await as(MOD, "select public.admin_restrict_user($1, 7, 'Repeated selling')", [ALLY]);
    await fails(ALLY, "select public.community_create_post('general', 'Another question here', '', true, null, false)");
    await fails(MOD, "select public.admin_restrict_user($1, 7, 'x')", [EDITOR]); // admins can't be restricted
  });
  it("support notes: moderators and owners only (analysts and editors can't read or write them)", async () => {
    expect((await as<{ body: string }>(MOD, "select body from public.user_notes where user_id = $1", [ALLY])).length).toBeGreaterThan(0); // the restriction reason
    expect(await as(ANALYST, "select body from public.user_notes")).toEqual([]);
    expect(await as(EDITOR, "select body from public.user_notes")).toEqual([]);
    await fails(ANALYST, "insert into public.user_notes (user_id, body, author) values ($1, 'x', $2)", [ALLY, ANALYST]);
  });
  it("only owners delete accounts, never another owner", async () => {
    await fails(MOD, "select public.admin_delete_user($1)", [ALLY]);
    await as(OWNER, "select public.admin_delete_user($1)", [ALLY]);
    expect(await as(OWNER, "select id from public.admin_users('ally', 'all', 10, 0)")).toEqual([]);
  });
  it("men can't list users", async () => {
    await fails(JUMA, "select * from public.admin_users()");
  });
});

describe("notifications", { timeout: 30_000 }, () => {
  it("send to everyone: men see it in their inbox, which counts as delivered", async () => {
    const r = await as<{ id: string }>(EDITOR, "select public.notif_save(null, 'New guide out', 'Read our new sleep guide.', 'new_content', '/social', 'all') as id");
    await as(EDITOR, "select public.notif_schedule($1, null)", [r[0].id]);
    const inbox = await as<{ title: string }>(JUMA, "select title from public.my_notifications()");
    expect(inbox.map((x) => x.title)).toContain("New guide out");
    expect((await as<{ title: string }>(OWNER, "select title from public.my_notifications()")).map((x) => x.title)).not.toContain("New guide out"); // staff aren't "men"
    const s = await as<{ delivered: number; opened: number }>(EDITOR, "select delivered, opened from public.notif_stats() where id = $1", [r[0].id]);
    expect(s[0]).toEqual({ delivered: 1, opened: 0 });
  });
  it("respects his opt-out", async () => {
    await as(JUMA, "insert into public.notification_prefs (user_id, tips) values ($1, false)", [JUMA]);
    const r = await as<{ id: string }>(EDITOR, "select public.notif_save(null, 'Tip of the day', 'Drink water first thing.', 'tip', null, 'all') as id");
    await as(EDITOR, "select public.notif_schedule($1, null)", [r[0].id]);
    expect((await as<{ title: string }>(JUMA, "select title from public.my_notifications()")).map((x) => x.title)).not.toContain("Tip of the day");
  });
  it("refuses duplicates and more than 3 a day", async () => {
    const dup = await as<{ id: string }>(EDITOR, "select public.notif_save(null, 'New guide out', 'Read our new sleep guide.', 'new_content', null, 'all') as id");
    await fails(EDITOR, "select public.notif_schedule($1, null)", [dup[0].id]);
    const third = await as<{ id: string }>(EDITOR, "select public.notif_save(null, 'Third message', 'Hello again everyone.', 'announcement', null, 'all') as id");
    await as(EDITOR, "select public.notif_schedule($1, null)", [third[0].id]);
    const fourth = await as<{ id: string }>(EDITOR, "select public.notif_save(null, 'Fourth message', 'One too many today.', 'announcement', null, 'all') as id");
    await fails(EDITOR, "select public.notif_schedule($1, null)", [fourth[0].id]);
  });
  it("analysts can't send", async () => {
    await fails(ANALYST, "select public.notif_save(null, 'Nope', 'Not allowed here.', 'tip', null, 'all')");
  });
});

describe("dashboard, admins and audit", { timeout: 30_000 }, () => {
  it("counts real activity; men can't read the dashboard", async () => {
    await as(JUMA, "select public.touch_activity()");
    await as(null, "select public.track_content('w-guide', 'view')");
    await as(null, "select public.track_search('0712345678', 0)"); // never stored
    await as(null, "select public.track_search('Sleep', 0)");
    const o = await as<{ o: { dau: number; views: number; users_total: number } }>(ANALYST, "select public.admin_overview(30) as o");
    expect(o[0].o.dau).toBe(1);
    expect(o[0].o.views).toBe(1);
    expect(o[0].o.users_total).toBe(1); // Juma only: admins and the deleted Ally aren't counted as men
    expect(await as(ANALYST, "select term, no_results from public.search_stats_daily")).toEqual([{ term: "sleep", no_results: 1 }]);
    await fails(JUMA, "select public.admin_overview(30)");
  });
  it("hides topic counts for groups under 5 men", async () => {
    await as(JUMA, "insert into public.user_data (user_id, kind, data) values ($1, 'social', '{\"interests\": [\"libido\"]}')", [JUMA]);
    const a = await as<{ a: { topics_followed: Record<string, number | null> } }>(ANALYST, "select public.admin_adoption() as a");
    expect(a[0].a.topics_followed).toEqual({ libido: null });
  });
  it("only owners manage admins, and there's always an owner", async () => {
    await fails(EDITOR, "select public.admin_add('juma@x.co', 'writer')");
    await as(OWNER, "select public.admin_add('juma@x.co', 'writer')");
    await fails(OWNER, "select public.admin_set_role($1, 'editor')", [OWNER]);
    await fails(OWNER, "select public.admin_remove($1)", [OWNER]);
    await as(OWNER, "select public.admin_remove($1)", [JUMA]);
  });
  it("analysts can't read the audit log; owners can", async () => {
    expect(await as(ANALYST, "select id from public.admin_audit")).toEqual([]);
    expect((await as(OWNER, "select id from public.admin_audit")).length).toBeGreaterThan(5);
  });
  it("only owners change switches", async () => {
    await fails(EDITOR, "select public.settings_set('community_enabled', 'false'::jsonb)");
    await as(OWNER, "select public.settings_set('community_enabled', 'false'::jsonb)");
    await fails(JUMA, "select public.community_create_post('general', 'Is anyone around today?', '', true, null, false)");
    await as(OWNER, "select public.settings_set('community_enabled', 'true'::jsonb)");
  });
});

describe("two-step sign-in for admins (0007)", { timeout: 30_000 }, () => {
  const pwOnly = <T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) => as<T>(uid, sql, params, "aal1");

  it("a password alone gives no admin powers", async () => {
    expect((await pwOnly(OWNER, "select public.is_admin() as ok"))[0]).toEqual({ ok: false });
    expect((await pwOnly(OWNER, "select public.admin_can('settings.manage') as ok"))[0]).toEqual({ ok: false });
    expect((await pwOnly(OWNER, "select public.admin_role() as r"))[0]).toEqual({ r: null });
    await expect(pwOnly(OWNER, "insert into public.content_items (id, kind, topic, title) values ('pw-only', 'guide', 'wellbeing', 'Nope')")).rejects.toThrow();
    expect(await pwOnly(OWNER, "select user_id from public.admins")).toEqual([]);
  });

  it("with the authenticator code, the same admin has his powers", async () => {
    expect((await as(OWNER, "select public.is_admin() as ok"))[0]).toEqual({ ok: true });
    expect((await as(WRITER, "select public.admin_can('content.publish') as ok"))[0]).toEqual({ ok: false });
    expect((await as(EDITOR, "select public.admin_can('content.publish') as ok"))[0]).toEqual({ ok: true });
  });

  it("the sign-in screen can still tell staff apart, without giving powers", async () => {
    expect((await pwOnly(EDITOR, "select public.my_admin_role() as r"))[0]).toEqual({ r: "editor" });
    expect((await pwOnly(JUMA, "select public.my_admin_role() as r"))[0]).toEqual({ r: null });
    await fails(null, "select public.my_admin_role()");
  });
});

describe("safety fixes (0008)", { timeout: 30_000 }, () => {
  it("re-running old migrations keeps two-step sign-in on", async () => {
    // beforeAll re-ran 0001 and 0006 after 0007: a password-only session still gets nothing
    expect((await as(OWNER, "select public.is_admin() as ok", [], "aal1"))[0]).toEqual({ ok: false });
    expect((await as(OWNER, "select public.admin_can('settings.manage') as ok", [], "aal1"))[0]).toEqual({ ok: false });
    expect((await as(OWNER, "select public.admin_can('settings.manage') as ok"))[0]).toEqual({ ok: true });
  });

  it("logged-out visitors can't call action functions", async () => {
    for (const sql of [
      "select public.admin_list()",
      "select public.delete_my_account()",
      "select public.community_list('all', 'new', 10)",
      "select public.my_notifications()",
      "select public.settings_set('x', '{}'::jsonb)",
      "select public.log_admin('fake', null, '{}'::jsonb)",
      "select public.is_restricted('00000000-0000-0000-0000-00000000000a')",
    ])
      await expect(as(null, sql), sql).rejects.toThrow(/permission denied/);
  });

  it("guests still read published lessons and the live homepage", async () => {
    await as(EDITOR, "insert into public.content_items (id, kind, topic, title, status) values ('guest-ok', 'guide', 'wellbeing', 'For everyone', 'published')");
    const rows = await as(null, "select id from public.content_items where id = 'guest-ok'");
    expect(rows).toEqual([{ id: "guest-ok" }]);
    await expect(as(null, "select count(*) from public.homepage_configs")).resolves.toBeTruthy();
    await expect(as(null, "select public.track_search('kukosa usingizi', 3)")).resolves.toBeTruthy();
  });

  it("signed-in men can still use their own functions; internal helpers are closed", async () => {
    await expect(as(JUMA, "select public.my_notifications()")).resolves.toBeTruthy();
    await expect(as(JUMA, "select public.is_restricted('00000000-0000-0000-0000-00000000000a')")).rejects.toThrow(/permission denied/);
  });

  it("storage refuses big or wrong files", async () => {
    const b = await db.query<{ id: string; file_size_limit: string; allowed_mime_types: string[] }>(
      "select id, file_size_limit, allowed_mime_types from storage.buckets order by id",
    );
    const by = Object.fromEntries(b.rows.map((r) => [r.id, r]));
    expect(Number(by["content-images"].file_size_limit)).toBe(3 * 1024 * 1024);
    expect(by["content-images"].allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(Number(by["content-videos"].file_size_limit)).toBe(50 * 1024 * 1024);
    expect(Number(by["content-audio"].file_size_limit)).toBe(40 * 1024 * 1024);
  });
});

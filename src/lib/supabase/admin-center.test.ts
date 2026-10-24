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
      last_sign_in_at timestamptz, banned_until timestamptz, phone text, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb not null default '{}'::jsonb);
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
  await db.exec(readFileSync(join(dir, "0014_remove_review_gate.sql"), "utf8")); // 0006 puts the old publish rule back; 0014 says to run again
  await db.exec(readFileSync(join(dir, "0015_reels.sql"), "utf8")); // 0006 resets the list of content kinds; 0015 says to run again
  await db.exec(readFileSync(join(dir, "0016_discover_settings.sql"), "utf8")); // 0006 resets the list of settings; 0016 says to run again
  await db.exec(readFileSync(join(dir, "0017_push_and_helped.sql"), "utf8")); // 0006 puts back the old track_content; 0017 says to run again
  await db.exec(readFileSync(join(dir, "0019_discover_hooks.sql"), "utf8")); // 0017 puts back the old track_content and push_due; 0019 says to run again
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

  it("editors publish AI-assisted content directly; writers still can't publish (0014)", async () => {
    await as(EDITOR, "insert into public.content_items (id, kind, topic, title, ai_generated) values ('ai-draft', 'article', 'wellbeing', 'AI draft', true)");
    await as(EDITOR, "update public.content_items set status = 'published' where id = 'ai-draft'");
    expect(await as(null, "select id from public.content_items where id = 'ai-draft'")).toEqual([{ id: "ai-draft" }]);
    await as(WRITER, "insert into public.content_items (id, kind, topic, title, ai_generated) values ('ai-w', 'article', 'wellbeing', 'Writer AI draft', true)");
    await fails(WRITER, "update public.content_items set status = 'published' where id = 'ai-w'");
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

describe("courses (0009)", { timeout: 30_000 }, () => {
  const course = (title: string, hidden = false) =>
    JSON.stringify({ version: 1, id: "wazimu", title, summary: "", credit: "© Kayani Herbs", passPercent: 70, modules: [{ id: "m1", title: "Goals", lessons: [{ id: "wz-1-0", code: "1.0", title: "Goals", kind: "audio", points: 10, hidden }] }] });

  it("writers save drafts that men can't see; only editors publish", async () => {
    await as(WRITER, "select public.course_save_draft('wazimu', $1::jsonb)", [course("Draft one")]);
    expect(await as(null, "select id from public.course_versions")).toEqual([]);
    expect(await as(JUMA, "select id from public.course_versions")).toEqual([]);
    await fails(WRITER, "select public.course_publish('wazimu')");
    await as(EDITOR, "select public.course_publish('wazimu', 'First')");
    const live = await as<{ title: string }>(JUMA, "select data->>'title' as title from public.course_versions");
    expect(live).toEqual([{ title: "Draft one" }]);
    // Step 59 (0010): guests can't read the course, even straight from the database
    expect(await as(null, "select id from public.course_versions")).toEqual([]);
  });

  it("a new draft doesn't change what men see until it's published; old versions are kept", async () => {
    await as(WRITER, "select public.course_save_draft('wazimu', $1::jsonb)", [course("Second")]);
    expect((await as<{ title: string }>(JUMA, "select data->>'title' as title from public.course_versions"))[0].title).toBe("Draft one");
    await as(OWNER, "select public.course_publish('wazimu')");
    expect((await as<{ title: string }>(JUMA, "select data->>'title' as title from public.course_versions"))[0].title).toBe("Second");
    const states = await as<{ state: string }>(EDITOR, "select state from public.course_versions order by id");
    expect(states.map((s) => s.state)).toEqual(["archived", "published"]);
  });

  it("nobody writes to the table directly, and guests can't call the functions", async () => {
    await fails(EDITOR, "insert into public.course_versions (course_id, state, data) values ('x1', 'published', '{}'::jsonb)");
    await as(OWNER, "update public.course_versions set data = '{}'::jsonb"); // allowed to run, changes nothing
    expect((await as<{ title: string }>(JUMA, "select data->>'title' as title from public.course_versions"))[0].title).toBe("Second");
    await expect(as(null, "select public.course_save_draft('wazimu', $1::jsonb)", [course("Hack")])).rejects.toThrow(/permission denied/);
    await fails(JUMA, "select public.course_save_draft('wazimu', $1::jsonb)", [course("Hack")]);
  });

  it("refuses a broken course", async () => {
    await fails(EDITOR, "select public.course_save_draft('wazimu', $1::jsonb)", [JSON.stringify({ title: "No modules" })]);
    await fails(EDITOR, "select public.course_save_draft('wazimu', $1::jsonb)", [JSON.stringify({ title: "Bad", modules: [{ id: "m1", lessons: [{ id: "a", title: "A", kind: "podcast" }] }] })]);
  });

  it("unpublish takes it off the Man tab; actions are in the audit log", async () => {
    await as(EDITOR, "select public.course_unpublish('wazimu')");
    expect(await as(null, "select id from public.course_versions")).toEqual([]);
    const log = await as<{ action: string }>(OWNER, "select action from public.admin_audit where target = 'wazimu' order by id");
    expect(log.map((l) => l.action)).toEqual(["course.save_draft", "course.publish", "course.save_draft", "course.publish", "course.unpublish"]);
  });
});

describe("course files are members only (0010)", { timeout: 30_000 }, () => {
  const OLD = "https://x.supabase.co/storage/v1/object/public/content-audio/courses/wazimu/wz-1-0-1.m4a";
  const NEW = "private:course-media/courses/wazimu/wz-1-0-1.m4a";
  const course = JSON.stringify({ version: 1, id: "wz2", title: "Files", summary: "", credit: "", passPercent: 70, modules: [{ id: "m1", title: "M", lessons: [{ id: "a", code: "1.0", title: "A", kind: "audio", points: 10, mediaUrl: OLD }] }] });

  // The setup re-runs 0006 on purpose (an old file run again by mistake), which brings back the old
  // open audio rule. Running 0010 again closes it — the same advice the 0010 notes give.
  beforeAll(async () => {
    await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/0010_course_members_only.sql"), "utf8"));
  });

  it("the private folder exists and is not public", async () => {
    expect(await as(OWNER, "select public from storage.buckets where id = 'course-media'")).toEqual([{ public: false }]);
  });

  it("only signed-in men can open lesson files; guests can't even list old ones", async () => {
    // Supabase gives these table rights to everyone; the policies decide what each person sees
    await db.exec(`grant select, insert, update, delete on storage.objects to anon, authenticated; grant usage, select on all sequences in schema storage to anon, authenticated;`);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('course-media', 'courses/wz2/a.m4a'), ('content-audio', 'courses/wz2/old.m4a'), ('content-audio', 'podcast/p.m4a')`);
    expect(await as(null, "select name from storage.objects where bucket_id = 'course-media'")).toEqual([]);
    expect(await as(JUMA, "select name from storage.objects where bucket_id = 'course-media'")).toEqual([{ name: "courses/wz2/a.m4a" }]);
    expect(await as(null, "select name from storage.objects where bucket_id = 'content-audio' order by name")).toEqual([{ name: "podcast/p.m4a" }]);
  });

  it("only staff can put files in the private folder", async () => {
    await fails(JUMA, "insert into storage.objects (bucket_id, name) values ('course-media', 'courses/x/hack.m4a')");
    await as(EDITOR, "insert into storage.objects (bucket_id, name) values ('course-media', 'courses/x/ok.m4a')");
  });

  it("swaps old links in every version; only publishers can, and only to private files", async () => {
    await as(EDITOR, "select public.course_save_draft('wz2', $1::jsonb)", [course]);
    await as(EDITOR, "select public.course_publish('wz2')");
    await as(EDITOR, "select public.course_save_draft('wz2', $1::jsonb)", [course]);
    await fails(WRITER, "select public.course_media_moved($1::jsonb)", [JSON.stringify({ [OLD]: NEW })]);
    await fails(JUMA, "select public.course_media_moved($1::jsonb)", [JSON.stringify({ [OLD]: NEW })]);
    await fails(EDITOR, "select public.course_media_moved($1::jsonb)", [JSON.stringify({ [OLD]: "https://evil.example/x.m4a" })]);
    const n = await as<{ n: number }>(EDITOR, "select public.course_media_moved($1::jsonb) as n", [JSON.stringify({ [OLD]: NEW })]);
    expect(n[0].n).toBe(2);
    const urls = await as<{ u: string }>(EDITOR, "select data->'modules'->0->'lessons'->0->>'mediaUrl' as u from public.course_versions where course_id = 'wz2'");
    expect(urls.map((r) => r.u)).toEqual([NEW, NEW]);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;

describe("user profile and sharing with support (0012)", { timeout: 30_000 }, () => {
  it("staff see his account and app use, never his records", async () => {
    await as(JUMA, "insert into public.user_data (user_id, kind, data) values ($1, 'social', $2) on conflict (user_id, kind) do update set data = excluded.data", [
      JUMA,
      JSON.stringify({ nickname: "Juma", interests: ["erection"], history: { a: "2026-10-01" }, bookmarks: {}, profile: { region: "Mwanza", ageRange: "25–34" } }),
    ]);
    await as(JUMA, "insert into public.user_data (user_id, kind, data) values ($1, 'progress', $2) on conflict (user_id, kind) do update set data = excluded.data", [
      JUMA,
      JSON.stringify({ records: [{ id: "r1", metric: "mood", value: 2, note: "rough day" }], goals: [] }),
    ]);
    await as(JUMA, "select public.touch_activity('sw', 'android')");
    const [{ p }] = await as<{ p: J }>(ANALYST, "select public.admin_user_profile($1) as p", [JUMA]);
    expect(p.account.email).toBe("ju•••@x.co");
    expect(p.app).toMatchObject({ lang: "sw", platform: "android" });
    expect(p.nickname).toBe("Juma");
    expect(p.usage).toMatchObject({ opened: 1, topics: 1 });
    expect(p.community.items).toBeNull(); // analysts don't read his posts
    expect(p.can_open_private).toBe(false);
    const text = JSON.stringify(p);
    for (const secret of ["rough day", "Mwanza", "erection"]) expect(text).not.toContain(secret);
    const [{ p: m }] = await as<{ p: J }>(MOD, "select public.admin_user_profile($1) as p", [JUMA]);
    expect(Array.isArray(m.community.items)).toBe(true);
  });
  it("men can't read other men's profiles", async () => {
    await fails(JUMA, "select public.admin_user_profile($1)", [OWNER]);
    await fails(null, "select public.admin_user_profile($1)", [JUMA]);
  });
  it("his records open only after he shares them, only for owners, with a reason, and it's logged", async () => {
    await fails(OWNER, "select public.admin_user_private($1, 'Helping with his water goal')", [JUMA]);
    await as(JUMA, "insert into public.support_shares (user_id) values ($1)", [JUMA]);
    await fails(JUMA, "insert into public.support_shares (user_id) values ($1)", [OWNER]); // only for himself
    await fails(MOD, "select public.admin_user_private($1, 'Helping with his water goal')", [JUMA]);
    await fails(OWNER, "select public.admin_user_private($1, 'x')", [JUMA]);
    const [{ d }] = await as<{ d: J }>(OWNER, "select public.admin_user_private($1, 'Helping with his water goal') as d", [JUMA]);
    expect(d.records[0].note).toBe("rough day");
    expect(d.profile.region).toBe("Mwanza");
    const log = await as<{ action: string }>(OWNER, "select action from public.admin_audit where target = $1 and action = 'user.private_view'", [JUMA]);
    expect(log.length).toBe(1);
    const extra = await as<{ shared: boolean; lang: string }>(ANALYST, "select shared, lang from public.admin_users_extra(array[$1::uuid])", [JUMA]);
    expect(extra[0]).toEqual({ shared: true, lang: "sw" });
  });
  it("when he turns sharing off, it closes straight away", async () => {
    await as(JUMA, "delete from public.support_shares where user_id = $1", [JUMA]);
    await fails(OWNER, "select public.admin_user_private($1, 'Helping with his water goal')", [JUMA]);
  });
});

describe("Kito, the members' assistant (0013)", { timeout: 30_000 }, () => {
  const KITO = "00000000-0000-0000-0000-00000000000c";
  beforeAll(async () => {
    await db.query("insert into auth.users (id, email) values ($1, 'kito@x.co') on conflict do nothing", [KITO]);
  });
  it("signed-in men can ask; visitors can't", async () => {
    const [{ id }] = await as<{ id: number }>(KITO, "select public.kito_allow('sw') as id");
    expect(Number(id)).toBeGreaterThan(0);
    await as(KITO, "select public.kito_done($1, 'answered', 3, 40, 300)", [id]);
    await expect(as(null, "select public.kito_allow('en')")).rejects.toThrow(/permission denied/);
  });
  it("never keeps the question or the answer", async () => {
    const cols = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'kito_usage'")).rows.map((r) => r.column_name);
    expect(cols.some((c) => /question|answer|text|body/.test(c))).toBe(false);
    expect(await as(KITO, "select * from public.kito_usage")).toEqual([]); // men can't read the log
  });
  it("checks each man's questions one at a time, so sending many at once can't beat the limit (0020)", async () => {
    const [{ src }] = (await db.query<{ src: string }>("select prosrc as src from pg_proc where proname = 'kito_allow'")).rows;
    expect(src).toMatch(/pg_advisory_xact_lock/);
  });
  it("stops at 15 questions an hour per man", async () => {
    for (let i = 0; i < 14; i++) await as(KITO, "select public.kito_allow('en')");
    await expect(as(KITO, "select public.kito_allow('en')")).rejects.toThrow(/this hour/);
  });
  it("the owner's switch turns it off for everyone", async () => {
    await db.query("update public.app_settings set value = 'false' where key = 'kito_enabled'");
    await expect(as(JUMA, "select public.kito_allow('en')")).rejects.toThrow(/resting/);
    await db.query("update public.app_settings set value = 'true' where key = 'kito_enabled'");
  });
  it("staff see totals only; men can't", async () => {
    const [{ s }] = await as<{ s: Record<string, number> }>(ANALYST, "select public.admin_kito_stats(30) as s");
    expect(Number(s.questions)).toBeGreaterThanOrEqual(15);
    expect(Number(s.answered)).toBe(1);
    await fails(KITO, "select public.admin_kito_stats(30)");
  });
});

describe("reels (0015)", { timeout: 30_000 }, () => {
  it("editors publish a reel; men see it; an unknown kind is still refused", async () => {
    await as(EDITOR, "insert into public.content_items (id, kind, topic, title, status, video_url) values ('reel-1', 'reel', 'ejaculation', 'Garlic and turmeric', 'published', 'https://x.co/r.mp4')");
    expect(await as(null, "select kind from public.content_items where id = 'reel-1'")).toEqual([{ kind: "reel" }]);
    await fails(EDITOR, "insert into public.content_items (id, kind, topic, title) values ('bad-kind', 'tiktok', 'wellbeing', 'Nope')");
  });
});

describe("Studio → Discover settings (0016)", { timeout: 30_000 }, () => {
  it("editors save the Discover settings; men read them; writers and analysts can't change them", async () => {
    await as(EDITOR, `select public.settings_set('discover_config', '{"reelEvery": 4, "adaptive": true, "shuffle": true, "pinned": ["do-kegel"], "hidden": []}'::jsonb)`);
    const [{ v }] = await as<{ v: { reelEvery: number } }>(JUMA, "select value as v from public.app_settings where key = 'discover_config'");
    expect(v.reelEvery).toBe(4);
    await fails(WRITER, `select public.settings_set('discover_config', '{"reelEvery": 4}'::jsonb)`);
    await fails(ANALYST, `select public.settings_set('discover_config', '{"reelEvery": 4}'::jsonb)`);
  });
  it("refuses settings that would break Discover", async () => {
    await fails(EDITOR, `select public.settings_set('discover_config', '{"reelEvery": 1}'::jsonb)`);
    await fails(EDITOR, `select public.settings_set('discover_config', '{"pinned": "x"}'::jsonb)`);
  });
  it("Kito's switch still works after this update", async () => {
    await as(OWNER, `select public.settings_set('kito_enabled', 'true'::jsonb)`);
  });
});

describe("phone notifications and Did it help? (0017)", { timeout: 30_000 }, () => {
  const EP = "https://fcm.googleapis.com/fcm/send/juma-phone-1";
  const KEY1 = "BOrK".padEnd(87, "x");
  const KEY2 = "auth-secret-123456";
  // A time zone where it's around midday now, so the test doesn't depend on when it runs
  const utcHour = new Date().getUTCHours();
  let off = 12 - utcHour;
  if (off > 14) off -= 24;
  if (off < -12) off += 24;
  const TZ = off === 0 ? "Etc/GMT" : `Etc/GMT${off > 0 ? "-" : "+"}${Math.abs(off)}`;
  const due = async () =>
    (await db.query<{ user_id: string; kind: string; ref: string; body: string; subscription_id: string; link: string }>("select * from public.push_due(now())")).rows;

  it("a man registers his own phone; nobody else can see it; visitors can't register", async () => {
    await as(JUMA, "select public.push_subscribe($1, $2, $3)", [EP, KEY1, KEY2]);
    expect(await as(JUMA, "select endpoint from public.push_subscriptions")).toEqual([{ endpoint: EP }]);
    expect(await as(ALLY, "select endpoint from public.push_subscriptions")).toEqual([]);
    expect(await as(OWNER, "select endpoint from public.push_subscriptions")).toEqual([]);
    await fails(null, "select public.push_subscribe($1, $2, $3)", ["https://x.example/2", KEY1, KEY2]);
    await fails(JUMA, "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x.example/3', $2, $3)", [ALLY, KEY1, KEY2]);
  });

  it("only the server can see what's due or mark it sent", async () => {
    await fails(JUMA, "select * from public.push_due(now())");
    await fails(OWNER, "select * from public.push_due(now())");
    await fails(JUMA, "select public.push_mark('[]'::jsonb, '[]'::jsonb)");
    expect(await as(JUMA, "select * from public.push_log")).toEqual([]);
  });

  it("pushes live Studio messages discreetly, once, and the daily reminder only if he hasn't opened the app", async () => {
    // Reminder time: half an hour ago, his time
    await as(JUMA, `insert into public.notification_prefs (user_id, daily_reminder, remind_at, tz)
                    values ($1, true, ((now() at time zone $2) - interval '30 minutes')::time, $2)
                    on conflict (user_id) do update set daily_reminder = true, remind_at = excluded.remind_at, tz = excluded.tz`, [JUMA, TZ]);
    await db.query("delete from public.user_activity_days where user_id = $1", [JUMA]);
    const rows = (await due()).filter((r) => r.user_id === JUMA);
    const campaigns = rows.filter((r) => r.kind === "campaign");
    expect(campaigns.length).toBeGreaterThan(0); // the messages sent in the notifications tests above
    expect(campaigns.every((r) => r.body === "You have a new message.")).toBe(true); // no text on his lock screen
    expect(rows.some((r) => r.kind === "reminder")).toBe(true);
    // Sent: never again
    const sent = JSON.stringify(rows.map((r) => ({ subscription_id: r.subscription_id, user_id: r.user_id, kind: r.kind, ref: r.ref })));
    await db.query("select public.push_mark($1::jsonb, '[]'::jsonb)", [sent]);
    expect((await due()).filter((r) => r.user_id === JUMA)).toEqual([]);
  });

  it("no reminder on a day he already used the app; message text only if he allowed it", async () => {
    await db.query("delete from public.push_log where user_id = $1", [JUMA]);
    await db.query("insert into public.user_activity_days (user_id, day) values ($1, (now() at time zone $2)::date) on conflict do nothing", [JUMA, TZ]);
    await as(JUMA, "update public.notification_prefs set lock_text = true where user_id = $1", [JUMA]);
    const rows = (await due()).filter((r) => r.user_id === JUMA);
    expect(rows.some((r) => r.kind === "reminder")).toBe(false);
    expect(rows.some((r) => r.kind === "campaign" && r.body !== "You have a new message.")).toBe(true);
  });

  it("a phone the push service says is gone is removed; a phone that moves to another account follows it", async () => {
    const BRO = "00000000-0000-0000-0000-00000000000c"; // his brother signs in on the same phone
    await db.query("insert into auth.users (id, email) values ($1, 'bro@x.co') on conflict do nothing", [BRO]);
    await as(BRO, "select public.push_subscribe($1, $2, $3)", [EP, KEY1, KEY2]);
    expect(await as(BRO, "select endpoint from public.push_subscriptions")).toEqual([{ endpoint: EP }]);
    expect(await as(JUMA, "select endpoint from public.push_subscriptions")).toEqual([]);
    const [{ id }] = (await db.query<{ id: string }>("select id from public.push_subscriptions where endpoint = $1", [EP])).rows;
    await db.query("select public.push_mark('[]'::jsonb, $1::jsonb)", [JSON.stringify([{ subscription_id: id, gone: true }])]);
    expect((await db.query("select 1 from public.push_subscriptions where endpoint = $1", [EP])).rows).toHaveLength(0);
  });

  it("counts Did it help? answers without saying who", async () => {
    await as(JUMA, "select public.track_content('do-kegel', 'helped_yes')");
    await as(EDITOR, "select public.track_content('do-kegel', 'helped_no')");
    await as(EDITOR, "select public.track_content('do-kegel', 'helped_bogus')");
    const [r] = await as<{ y: number; n: number }>(ANALYST, "select sum(helped_yes)::int as y, sum(helped_no)::int as n from public.content_stats_daily where content_id = 'do-kegel'");
    expect(r).toEqual({ y: 1, n: 1 });
  });
});

describe("Tell us feedback and retention (0018)", { timeout: 30_000 }, () => {
  it("a man sends feedback; he can't read anyone's; staff who see users read it and mark it done", async () => {
    const [{ id }] = await as<{ id: string }>(JUMA, "select public.feedback_send('The reels load slowly on my phone', 4, 'me', 'sw', 'android') as id");
    expect(await as(JUMA, "select * from public.app_feedback")).toEqual([]);
    await fails(JUMA, "select * from public.feedback_list('all', 50)");
    await fails(WRITER, "select * from public.feedback_list('all', 50)");
    const list = await as<{ message: string; rating: number; who: string; status: string }>(ANALYST, "select * from public.feedback_list('open', 50)");
    expect(list[0]).toMatchObject({ message: "The reels load slowly on my phone", rating: 4, who: "juma@x.co", status: "new" });
    await fails(ANALYST, "select public.feedback_mark($1, 'nonsense')", [id]);
    await as(EDITOR, "select public.feedback_mark($1, 'done')", [id]);
    expect(await as(EDITOR, "select * from public.feedback_list('open', 50) where id = $1", [id])).toEqual([]);
  });

  it("visitors can't send; men can't write the table directly; at most 5 a day; empty messages refused", async () => {
    const BABA = "00000000-0000-0000-0000-0000000000f1";
    await db.query("insert into auth.users (id, email) values ($1, 'baba@x.co') on conflict do nothing", [BABA]);
    await fails(null, "select public.feedback_send('hello there', null, null, null, null)");
    await expect(as(BABA, "insert into public.app_feedback (user_id, message) values ($1, 'sneaky')", [BABA])).rejects.toThrow(/permission|security/);
    await fails(BABA, "select public.feedback_send('   ', null, null, null, null)");
    for (let i = 0; i < 5; i++) await as(BABA, "select public.feedback_send($1, null, null, null, null)", [`note ${i}`]);
    await fails(BABA, "select public.feedback_send('one more', null, null, null, null)");
  });

  it("retention: who came back the next day and in week 2, and what they did first — counts only, staff left out", async () => {
    const NEW1 = "00000000-0000-0000-0000-0000000000d1";
    const NEW2 = "00000000-0000-0000-0000-0000000000d2";
    await db.query("insert into auth.users (id, email, created_at) values ($1, 'n1@x.co', now() - interval '20 days'), ($2, 'n2@x.co', now() - interval '20 days') on conflict do nothing", [NEW1, NEW2]);
    // NEW1 came back the next day and in week 2, and first did a Discover card; NEW2 never came back or did anything
    await db.query(`insert into public.user_activity_days (user_id, day) values
      ($1, ((now() - interval '20 days') at time zone 'Africa/Dar_es_Salaam')::date + 1),
      ($1, ((now() - interval '20 days') at time zone 'Africa/Dar_es_Salaam')::date + 9) on conflict do nothing`, [NEW1]);
    await db.query(`insert into public.user_data (user_id, kind, data) values ($1, 'feed',
      jsonb_build_object('tried', jsonb_build_object('do-kegel', jsonb_build_object('at', (now() - interval '19 days')::text)),
                         'days', jsonb_build_object('2020-01-01', jsonb_build_object('walk', jsonb_build_object('status', 'done', 'at', (now() - interval '18 days')::text)))))
      on conflict (user_id, kind) do update set data = excluded.data`, [NEW1]);
    await fails(JUMA, "select public.admin_retention(8)");
    const [{ r }] = await as<{ r: { cohorts: { signed_up: number; day1: number; day1_eligible: number; week2: number; week2_eligible: number }[]; first: Record<string, number> } }>(ANALYST, "select public.admin_retention(4) as r");
    const total = r.cohorts.reduce((s, c) => ({ signed_up: s.signed_up + c.signed_up, day1: s.day1 + c.day1, week2: s.week2 + c.week2 }), { signed_up: 0, day1: 0, week2: 0 });
    expect(total.day1).toBeGreaterThanOrEqual(1);
    expect(total.week2).toBeGreaterThanOrEqual(1);
    expect(r.first.card).toBe(1);
    expect(r.first.nothing).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(r)).not.toContain("n1@x.co"); // never who
  });
});

describe("Discover hooks (0019)", { timeout: 30_000 }, () => {
  const MAN = "00000000-0000-0000-0000-0000000000e1";
  const MAN2 = "00000000-0000-0000-0000-0000000000e2";
  beforeAll(async () => {
    await db.query("insert into auth.users (id, email) values ($1, 'man1@x.co'), ($2, 'man2@x.co') on conflict do nothing", [MAN, MAN2]);
  });

  it("counts hearts, shares and challenges without who; anyone reads helped totals", async () => {
    await as(MAN, "select public.track_content('do-beet', 'heart')");
    await as(MAN2, "select public.track_content('do-beet', 'heart')");
    await as(MAN2, "select public.track_content('do-beet', 'unheart')");
    await as(MAN2, "select public.track_content('do-beet', 'heart')");
    await as(MAN, "select public.track_content('do-beet', 'share')");
    await as(MAN, "select public.track_content('do-beet', 'challenge_start')");
    await as(MAN, "select public.track_content('do-beet', 'challenge_finish')");
    const [{ c }] = await as<{ c: Record<string, number> }>(null, "select public.helped_counts() as c");
    expect(c["do-beet"]).toBe(2);
    const rows = await as<{ hearts: number; shares: number; challenge_starts: number; challenge_finishes: number }>(ANALYST, "select * from public.admin_hook_stats(30) where content_id = 'do-beet'");
    expect(rows[0]).toMatchObject({ hearts: 2, shares: 1, challenge_starts: 1, challenge_finishes: 1 });
    await fails(MAN, "select * from public.admin_hook_stats(30)");
  });

  it("a man can say his message may be shared; staff see it; a story needs his yes", async () => {
    const [{ id: yes }] = await as<{ id: string }>(MAN, "select public.feedback_send('The kegel timer changed my nights, thank you', 5, 'me', 'en', 'web', true) as id");
    const [{ id: no }] = await as<{ id: string }>(MAN2, "select public.feedback_send('Please add more recipes', null, 'me') as id");
    const list = await as<{ id: string; share_ok: boolean }>(MOD, "select id, share_ok from public.feedback_list('stories', 50)");
    expect(list.map((r) => r.id)).toContain(yes);
    expect(list.map((r) => r.id)).not.toContain(no);
    await fails(EDITOR, "select public.story_save(null, 'Please add more recipes for us', null, 'A man', null, null, 'draft', $1)", [no]);
    const [{ id: story }] = await as<{ id: string }>(EDITOR, "select public.story_save(null, 'The kegel timer changed my nights.', 'Kipima muda cha kegel kimebadilisha usiku wangu.', 'A man, 34, Dar', 'Mwanaume, 34, Dar', 'last', 'published', $1) as id", [yes]);
    expect(await as(null, "select who_sw from public.men_stories")).toEqual([{ who_sw: "Mwanaume, 34, Dar" }]);
    // Writers draft but can't publish or change a live story; men and visitors can't write
    await as(WRITER, "select public.story_save(null, 'A draft story from a writer here', null, null, null, null, 'draft', null)");
    expect(await as(null, "select count(*)::int as n from public.men_stories")).toEqual([{ n: 1 }]); // drafts stay hidden
    await fails(WRITER, "select public.story_save(null, 'Trying to publish this one', null, null, null, null, 'published', null)");
    await fails(WRITER, "select public.story_save($1, 'Changed words here', null, null, null, null, 'draft', null)", [story]);
    await fails(MAN, "select public.story_save(null, 'My own fake story here', null, null, null, null, 'draft', null)");
    await fails(MAN, "insert into public.men_stories (text_en, status) values ('Sneaky story text', 'published')");
    await as(EDITOR, "select public.story_delete($1)", [story]);
    expect(await as(null, "select count(*)::int as n from public.men_stories")).toEqual([{ n: 0 }]);
  });

  it("the daily drop: at the drop time, once, only when something new went live, not for staff", async () => {
    const utcHour = new Date().getUTCHours();
    let off = 12 - utcHour;
    if (off > 14) off -= 24;
    if (off < -12) off += 24;
    const TZ = off === 0 ? "Etc/GMT" : `Etc/GMT${off > 0 ? "-" : "+"}${Math.abs(off)}`;
    const EP = "https://fcm.googleapis.com/fcm/send/drop-man-1";
    await as(MAN, "select public.push_subscribe($1, $2, $3)", [EP, "BOrK".padEnd(87, "y"), "auth-secret-abcdef"]);
    await as(MAN, `insert into public.notification_prefs (user_id, daily_reminder, tz) values ($1, false, $2)
                   on conflict (user_id) do update set daily_reminder = false, tz = excluded.tz`, [MAN, TZ]);
    const at = (await db.query<{ t: string }>("select to_char((now() at time zone $1) - interval '20 minutes', 'HH24:MI') as t", [TZ])).rows[0].t;
    await as(EDITOR, `select public.settings_set('discover_config', $1::jsonb)`, [JSON.stringify({ reelEvery: 6, pinned: [], hidden: [], dropAt: at })]);
    const drops = async () => (await db.query<{ user_id: string; kind: string; body: string }>("select * from public.push_due(now())")).rows.filter((r) => r.kind === "drop" && r.user_id === MAN);
    await db.query("update public.content_items set published_at = now() - interval '3 days' where published_at > now() - interval '1 day'");
    expect(await drops()).toEqual([]); // nothing new today
    await as(EDITOR, `insert into public.content_items (id, kind, topic, title, status, action) values ('drop-card', 'guide', 'erection', 'Beetroot at night', 'published',
                      '{"type":"food","challenges":["hard"],"results":"days","steps":[{"text":"a","textSw":"a"}]}'::jsonb)`);
    const rows = await drops();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("Something new is waiting for you."); // discreet
    const [{ id }] = (await db.query<{ id: string }>("select id from public.push_subscriptions where endpoint = $1", [EP])).rows;
    await db.query("select public.push_mark($1::jsonb, '[]'::jsonb)", [JSON.stringify([{ subscription_id: id, user_id: MAN, kind: "drop", ref: rows.length ? (await db.query<{ d: string }>("select (now() at time zone $1)::date::text as d", [TZ])).rows[0].d : "" }])]);
    expect(await drops()).toEqual([]); // once a day
    // Switched off in the Studio
    await db.query("delete from public.push_log where user_id = $1 and kind = 'drop'", [MAN]);
    await as(EDITOR, `select public.settings_set('discover_config', '{"reelEvery": 6, "pinned": [], "hidden": [], "dropAt": ""}'::jsonb)`);
    expect(await drops()).toEqual([]);
  });
});

-- 0008 · Safety fixes (from the October 2026 security review + Supabase's security advisor)
--
-- 1. Storage: the database itself now refuses files that are too big or the wrong type
--    (the Studio already checked this in the browser; now it can't be skipped).
-- 2. Five small functions get a fixed search_path (advisor: "function_search_path_mutable").
-- 3. Logged-out visitors can no longer call the action functions (admin, moderation, community,
--    notifications, account). They were already refused inside each function; now they're refused
--    at the door too. The checks used while reading published content (is_admin, admin_can,
--    admin_role, mfa_ok) and the anonymous reading counters stay open, so guests still see lessons.
-- 4. Two internal helpers can only be used by the database's own functions.
--
-- Safe to run more than once. Run it in Supabase → SQL Editor (or ask Claude to apply it).

-- 1. Upload limits, matching the Studio's own limits
update storage.buckets
   set file_size_limit = 3 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'content-images';
update storage.buckets
   set file_size_limit = 50 * 1024 * 1024,
       allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime']
 where id = 'content-videos';
update storage.buckets
   set file_size_limit = 40 * 1024 * 1024,
       allowed_mime_types = array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm']
 where id = 'content-audio';

do $$
declare
  f record;
  has_service boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  -- 2. Fixed search_path
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('community_risky', 'community_text_problem', 'content_items_touch', 'homepage_check', 'user_data_touch')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;

  -- 3. Action functions: signed-in people only (each still checks who may do what inside)
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'admin\_%' or p.proname like 'community\_%' or p.proname like 'mod\_%'
           or p.proname like 'notif\_%' or p.proname like 'homepage\_%' or p.proname like 'my\_%'
           or p.proname in ('delete_my_account', 'settings_set', 'log_admin', 'require_perm', 'touch_activity', 'mask_email'))
      -- stay open: used by the rules that let guests read published content and the homepage
      and p.proname not in ('admin_can', 'admin_role')
      -- small text checks used inside other functions and table rules
      and p.proname not in ('community_risky', 'community_text_problem', 'homepage_check')
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    if has_service then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;

  -- 4. Internal helpers: only the database's own functions use these
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('is_restricted', 'notification_targets')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if has_service then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;

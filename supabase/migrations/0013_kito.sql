-- 0013 · Kito, the members' learning assistant (Step 67)
--
-- Kito answers men's questions from Kayani's own library (guides, "do this" cards and the course) and links
-- to the lessons it used. It's separate from the staff AI drafting tool (/api/ai): different screen,
-- different rules, its own switch and its own limits.
--
-- 1. kito_enabled: an owner switches Kito on or off for everyone (Studio → Settings → Features). Starts ON.
-- 2. kito_usage: one row per question — WHO and WHEN and how it went, NEVER the question or the answer.
-- 3. kito_allow(): the server asks before every question. Signed-in men only, not restricted,
--    at most 15 questions an hour and 40 a day per man, and 1,500 a day for everyone (cost control).
-- 4. kito_done(): the server writes how it went (answered from the library or not).
-- 5. admin_kito_stats(): totals for the Studio (no per-man questions, ever).
--
-- If 0006 is ever run again, run this file again after it (0006 resets the list of settings).
-- Safe to run more than once. Run it in Supabase → SQL Editor.

insert into public.app_settings (key, value) values ('kito_enabled', 'true') on conflict (key) do nothing;

-- Owners can now switch Kito too (same function as 0006, one more allowed key)
create or replace function public.settings_set(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_key = 'ai_config' then perform public.require_perm('ai.use');
  else perform public.require_perm('settings.manage'); end if;
  if p_key not in ('community_enabled', 'notifications_enabled', 'ai_config', 'kito_enabled') then raise exception 'Unknown setting.' using errcode = '22023'; end if;
  if p_key = 'ai_config' and not public.admin_can('settings.manage') and (p_value ->> 'enabled') is distinct from
     (select value ->> 'enabled' from public.app_settings where key = 'ai_config') then
    raise exception 'Only owners can switch AI on or off.' using errcode = '42501';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public.log_admin('settings.' || p_key, p_key, jsonb_build_object('value', p_value));
end;
$$;

create table if not exists public.kito_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  lang text check (lang in ('en', 'sw')),
  status text not null default 'asked' check (status in ('asked', 'answered', 'not_in_library', 'safety', 'error')),
  sources int not null default 0,
  input_chars int,
  output_chars int
);
create index if not exists kito_usage_user_at_idx on public.kito_usage (user_id, at desc);
create index if not exists kito_usage_at_idx on public.kito_usage (at desc);
alter table public.kito_usage enable row level security; -- no policies: only through the functions below

-- Returns the usage row id when he may ask now; otherwise raises a plain-language reason.
create or replace function public.kito_allow(p_lang text default null)
returns bigint language plpgsql security definer set search_path = public, auth as $$
declare v_id bigint; v_hour int; v_day int; v_all int;
begin
  if auth.uid() is null then raise exception 'Sign in to ask Kito.' using errcode = '42501'; end if;
  if (select value from public.app_settings where key = 'kito_enabled') = 'false'::jsonb then
    raise exception 'Kito is resting right now. Try again later.' using errcode = 'P0001', hint = 'off';
  end if;
  if public.is_restricted(auth.uid()) then raise exception 'Your account is restricted for now.' using errcode = '42501'; end if;
  select count(*) filter (where at > now() - interval '1 hour'), count(*) into v_hour, v_day
    from public.kito_usage where user_id = auth.uid() and at > now() - interval '1 day';
  if v_hour >= 15 then raise exception 'You''ve asked a lot this hour. Take a break and ask again in a little while.' using errcode = 'P0001', hint = 'limit'; end if;
  if v_day >= 40 then raise exception 'That''s today''s questions done. Kito is back tomorrow.' using errcode = 'P0001', hint = 'limit'; end if;
  select count(*) into v_all from public.kito_usage where at > now() - interval '1 day';
  if v_all >= 1500 then raise exception 'Kito is very busy today. Try again tomorrow.' using errcode = 'P0001', hint = 'limit'; end if;
  insert into public.kito_usage (user_id, lang) values (auth.uid(), case when p_lang in ('en', 'sw') then p_lang end) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.kito_done(p_id bigint, p_status text, p_sources int, p_in int, p_out int)
returns void language sql security definer set search_path = public as $$
  update public.kito_usage
     set status = case when p_status in ('answered', 'not_in_library', 'safety', 'error') then p_status else 'error' end,
         sources = greatest(0, least(coalesce(p_sources, 0), 20)), input_chars = p_in, output_chars = p_out
   where id = p_id and user_id = auth.uid();
$$;

-- Studio: how Kito is used (totals only)
create or replace function public.admin_kito_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365); r jsonb;
begin
  perform public.require_perm('analytics.view');
  select jsonb_build_object(
    'questions', count(*),
    'men', count(distinct user_id),
    'answered', count(*) filter (where status = 'answered'),
    'not_in_library', count(*) filter (where status = 'not_in_library'),
    'safety', count(*) filter (where status = 'safety'),
    'errors', count(*) filter (where status = 'error'),
    'kiswahili', count(*) filter (where lang = 'sw'),
    'today', count(*) filter (where at > now() - interval '1 day')
  ) into r from public.kito_usage where at > now() - make_interval(days => d);
  return r;
end;
$$;

do $$
declare f record; has_service boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('kito_allow', 'kito_done', 'admin_kito_stats', 'settings_set')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    if has_service then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end $$;

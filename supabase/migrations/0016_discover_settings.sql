-- 0016 · Studio → Discover settings (Step 71)
--
-- One setting, "discover_config", that the app reads to build each man's Discover:
--   reelEvery  one reel after every N cards (3–12, starts at 6)
--   adaptive   let each man's habits move that number (watchers a bit more reels, readers fewer)
--   shuffle    a new card order every visit, different for each man
--   pinned     card/reel ids kept at the top, in order
--   hidden     card/reel ids taken off Discover (they still open from links, search and Saved)
-- Editors and owners change it (the same people who could publish the old homepage). Every change is logged.
--
-- If 0006 or 0013 is ever run again, run this file again after it (they reset the list of settings).
-- Safe to run more than once. Run it in Supabase → SQL Editor.

insert into public.app_settings (key, value)
values ('discover_config', '{"reelEvery": 6, "adaptive": true, "shuffle": true, "pinned": [], "hidden": []}')
on conflict (key) do nothing;

create or replace function public.settings_set(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_key = 'ai_config' then perform public.require_perm('ai.use');
  elsif p_key = 'discover_config' then perform public.require_perm('homepage.publish');
  else perform public.require_perm('settings.manage'); end if;
  if p_key not in ('community_enabled', 'notifications_enabled', 'ai_config', 'kito_enabled', 'discover_config') then
    raise exception 'Unknown setting.' using errcode = '22023';
  end if;
  if p_key = 'ai_config' and not public.admin_can('settings.manage') and (p_value ->> 'enabled') is distinct from
     (select value ->> 'enabled' from public.app_settings where key = 'ai_config') then
    raise exception 'Only owners can switch AI on or off.' using errcode = '42501';
  end if;
  if p_key = 'discover_config' and (jsonb_typeof(p_value) <> 'object'
     or coalesce((p_value ->> 'reelEvery')::int, 6) not between 3 and 12
     or jsonb_typeof(coalesce(p_value -> 'pinned', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_value -> 'hidden', '[]')) <> 'array'
     or pg_column_size(p_value) > 20000) then
    raise exception 'Those Discover settings aren''t valid.' using errcode = '22023';
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform public.log_admin('settings.' || p_key, p_key, jsonb_build_object('value', p_value));
end;
$$;

revoke execute on function public.settings_set(text, jsonb) from public, anon;
grant execute on function public.settings_set(text, jsonb) to authenticated;

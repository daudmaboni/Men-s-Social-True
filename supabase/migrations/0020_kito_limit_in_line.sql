-- Step 91: Kito's question limits hold even when questions arrive at the same instant.
-- Before, two questions sent together could both be counted before either was saved, so tapping very fast
-- could go past 15 an hour. Now each man's questions wait in line for a moment (a lock held only until
-- the check is done), and the limits are checked one at a time. Same limits, same messages.
-- Safe to run more than once. Run it after 0013 (and again after 0013 if 0013 is ever re-run).

create or replace function public.kito_allow(p_lang text default null)
returns bigint language plpgsql security definer set search_path = public, auth as $$
declare v_id bigint; v_hour int; v_day int; v_all int;
begin
  if auth.uid() is null then raise exception 'Sign in to ask Kito.' using errcode = '42501'; end if;
  if (select value from public.app_settings where key = 'kito_enabled') = 'false'::jsonb then
    raise exception 'Kito is resting right now. Try again later.' using errcode = 'P0001', hint = 'off';
  end if;
  if public.is_restricted(auth.uid()) then raise exception 'Your account is restricted for now.' using errcode = '42501'; end if;
  -- His questions one at a time (until this check ends)
  perform pg_advisory_xact_lock(hashtext('kito:' || auth.uid()::text));
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

revoke execute on function public.kito_allow(text) from public, anon;
grant execute on function public.kito_allow(text) to authenticated;

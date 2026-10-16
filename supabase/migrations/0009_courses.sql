-- 0009 · Courses (Step 48): audio courses on the Man tab, built in the Studio (Courses)
--
-- One course = one document (modules → lessons), kept as:
--   draft      what staff are editing (only staff can read it)
--   published  what men see (anyone can read it)
--   archived   earlier published versions (staff only), for history
-- Writers and editors save drafts; only editors and owners publish (same rules as content).
-- Audio and video files go in the existing content-audio / content-videos buckets (0006, limits in 0008).
--
-- Men's progress (where he stopped, what he finished) is saved with the rest of his private data
-- in user_data (0002). Staff never see it.
--
-- Safe to run more than once. Run it in Supabase → SQL Editor (or ask Claude to apply it).

create table if not exists public.course_versions (
  id bigint generated always as identity primary key,
  course_id text not null check (course_id ~ '^[a-z0-9-]{2,40}$'),
  state text not null check (state in ('draft', 'published', 'archived')),
  data jsonb not null,
  note text check (char_length(note) <= 200),
  saved_by uuid,
  saved_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid
);
create unique index if not exists course_one_draft on public.course_versions (course_id) where state = 'draft';
create unique index if not exists course_one_live on public.course_versions (course_id) where state = 'published';
alter table public.course_versions enable row level security;

drop policy if exists "everyone reads live courses" on public.course_versions;
create policy "everyone reads live courses" on public.course_versions
  for select using (state = 'published' or public.admin_can('content.edit') or public.admin_can('analytics.view'));
-- No insert/update/delete policies: changes only go through the functions below.

create or replace function public.course_check(p jsonb)
returns void language plpgsql immutable set search_path = public as $$
begin
  if coalesce(jsonb_typeof(p), '') <> 'object' or coalesce(jsonb_typeof(p -> 'modules'), '') <> 'array' then
    raise exception 'A course needs a list of modules.' using errcode = '22023';
  end if;
  if coalesce(trim(p ->> 'title'), '') = '' then
    raise exception 'A course needs a title.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'modules') m
             where coalesce(jsonb_typeof(m -> 'lessons'), '') <> 'array' or coalesce(m ->> 'id', '') = '') then
    raise exception 'Every module needs an id and a list of lessons.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'modules') m, jsonb_array_elements(m -> 'lessons') l
             where coalesce(l ->> 'id', '') = '' or coalesce(trim(l ->> 'title'), '') = ''
                or coalesce(l ->> 'kind', '') not in ('audio', 'video', 'reading')) then
    raise exception 'Every lesson needs an id, a title and a type (audio, video or reading).' using errcode = '22023';
  end if;
  if pg_column_size(p) > 600000 then raise exception 'The course is too large.' using errcode = '22023'; end if;
end;
$$;

create or replace function public.course_save_draft(p_course text, p_data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.require_perm('content.edit');
  perform public.course_check(p_data);
  update public.course_versions set data = p_data, saved_by = auth.uid(), saved_at = now()
    where course_id = p_course and state = 'draft' returning id into v_id;
  if v_id is null then
    insert into public.course_versions (course_id, state, data, saved_by) values (p_course, 'draft', p_data, auth.uid())
      returning id into v_id;
  end if;
  perform public.log_admin('course.save_draft', p_course, '{}'::jsonb);
  return v_id;
end;
$$;

create or replace function public.course_publish(p_course text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_draft public.course_versions; v_id bigint;
begin
  perform public.require_perm('content.publish');
  select * into v_draft from public.course_versions where course_id = p_course and state = 'draft';
  if v_draft.id is null then raise exception 'There are no unpublished changes.' using errcode = '22023'; end if;
  perform public.course_check(v_draft.data);
  update public.course_versions set state = 'archived' where course_id = p_course and state = 'published';
  insert into public.course_versions (course_id, state, data, note, saved_by, saved_at, published_at, published_by)
    values (p_course, 'published', v_draft.data, left(p_note, 200), v_draft.saved_by, v_draft.saved_at, now(), auth.uid())
    returning id into v_id;
  delete from public.course_versions where id = v_draft.id;
  perform public.log_admin('course.publish', p_course, jsonb_build_object('note', p_note));
  return v_id;
end;
$$;

create or replace function public.course_discard_draft(p_course text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('content.edit');
  delete from public.course_versions where course_id = p_course and state = 'draft';
  perform public.log_admin('course.discard_draft', p_course, '{}'::jsonb);
end;
$$;

-- Take a course off the Man tab (it stays in history and can be published again)
create or replace function public.course_unpublish(p_course text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm('content.publish');
  update public.course_versions set state = 'archived' where course_id = p_course and state = 'published';
  perform public.log_admin('course.unpublish', p_course, '{}'::jsonb);
end;
$$;

-- Same door rules as 0008: signed-in people only (each function checks the admin role inside)
do $$
declare
  f record;
  has_service boolean := exists (select 1 from pg_roles where rolname = 'service_role');
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('course_save_draft', 'course_publish', 'course_discard_draft', 'course_unpublish')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    if has_service then execute format('grant execute on function %s to service_role', f.sig); end if;
  end loop;
end;
$$;

grant select on public.course_versions to anon, authenticated;

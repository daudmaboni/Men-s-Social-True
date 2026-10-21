-- 0014 · Staff can publish AI-assisted content directly (Step 66b)
--
-- Before: content marked "Drafted with AI help" couldn't go live until someone ticked
-- "Checked by a qualified health professional" (rule added in 0006).
-- After: editors and owners publish it like any other item. Everything else stays the same:
-- only editors and owners can publish or change live content, writers submit for review,
-- and the times and authors are still recorded.
--
-- If 0006 is ever run again, run this file again after it (0006 puts the old rule back).
-- Safe to run more than once. Run it in Supabase → SQL Editor.

create or replace function public.content_items_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and ((old.created_by is not null and new.created_by is null)
          or (old.updated_by is not null and new.updated_by is null)) then
    return new; -- an account is being deleted: leave the content as it is
  end if;
  -- Only editors and owners can make something live or change live content (writers submit for review).
  -- (Changes made directly in the Supabase SQL editor have no signed-in admin and are allowed.)
  if auth.uid() is not null and not public.admin_can('content.publish')
     and (new.status = 'published' or (tg_op = 'UPDATE' and old.status = 'published')) then
    raise exception 'Only editors and owners can publish or change live content. Submit it for review instead.' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.publish_at, now());
  end if;
  return new;
end;
$$;

-- Men's Social — Content Studio
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- ─────────────────────────────────────────────
-- 1. Who is an admin
-- ─────────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- true when the signed-in person is in the admins table
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins can see admins" on public.admins;
create policy "admins can see admins" on public.admins
  for select using (public.is_admin());

-- ─────────────────────────────────────────────
-- 2. Content (guides, articles, videos, quizzes, tools, expert answers)
-- ─────────────────────────────────────────────
create table if not exists public.content_items (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  kind text not null check (kind in ('guide', 'article', 'video', 'quiz', 'tool', 'expert')),
  topic text not null check (topic in ('erection', 'ejaculation', 'libido', 'confidence', 'intimacy', 'wellbeing')),
  title text not null check (char_length(title) between 3 and 160),
  title_sw text,
  summary text not null default '',
  minutes int not null default 3 check (minutes between 1 and 60),
  priority int not null default 50 check (priority between 0 and 100),
  tags text[] not null default '{}',
  body jsonb not null default '[]'::jsonb,        -- array of paragraphs ("## " = heading)
  body_sw jsonb not null default '[]'::jsonb,
  key_points jsonb not null default '[]'::jsonb,  -- videos
  question text,                                  -- expert answers
  quiz jsonb,                                     -- [{q, options[], answer, explain}]
  tool text check (tool in ('pelvic-floor', 'doctor-check')),
  source text not null default 'Men''s Social editorial',
  review text not null default 'draft' check (review in ('draft', 'reviewed')),
  cover jsonb not null default '{"tone":"forest","motif":"rings"}'::jsonb,
  cover_image_url text,
  origin jsonb,                                   -- {platform, url, postedAt, format}
  in_man_feed boolean not null default false,
  points int not null default 10 check (points between 0 and 100),
  published_at timestamptz,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_status_idx on public.content_items (status, priority desc);
create index if not exists content_items_topic_idx on public.content_items (topic);

alter table public.content_items enable row level security;

-- Everyone (signed in or not) can read PUBLISHED content only
drop policy if exists "anyone can read published content" on public.content_items;
create policy "anyone can read published content" on public.content_items
  for select using (status = 'published' or public.is_admin());

-- Only admins can create, change or delete content
drop policy if exists "admins can insert content" on public.content_items;
create policy "admins can insert content" on public.content_items
  for insert with check (public.is_admin());

drop policy if exists "admins can update content" on public.content_items;
create policy "admins can update content" on public.content_items
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins can delete content" on public.content_items;
create policy "admins can delete content" on public.content_items
  for delete using (public.is_admin());

-- Keep timestamps and "who changed it" correct automatically
create or replace function public.content_items_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists content_items_touch on public.content_items;
create trigger content_items_touch
  before insert or update on public.content_items
  for each row execute function public.content_items_touch();

-- ─────────────────────────────────────────────
-- 3. Audit log: every create / update / delete is recorded
-- ─────────────────────────────────────────────
create table if not exists public.content_audit (
  id bigint generated always as identity primary key,
  content_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  status_before text,
  status_after text,
  actor uuid,
  at timestamptz not null default now()
);

alter table public.content_audit enable row level security;

drop policy if exists "admins can read audit" on public.content_audit;
create policy "admins can read audit" on public.content_audit
  for select using (public.is_admin());

create or replace function public.content_items_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_audit (content_id, action, status_before, status_after, actor)
  values (
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else old.status end,
    case when tg_op = 'DELETE' then null else new.status end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists content_items_audit on public.content_items;
create trigger content_items_audit
  after insert or update or delete on public.content_items
  for each row execute function public.content_items_audit();

-- ─────────────────────────────────────────────
-- 4. Image storage for covers (public to view, admins to upload)
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('content-images', 'content-images', true)
on conflict (id) do nothing;

drop policy if exists "anyone can view content images" on storage.objects;
create policy "anyone can view content images" on storage.objects
  for select using (bucket_id = 'content-images');

drop policy if exists "admins can upload content images" on storage.objects;
create policy "admins can upload content images" on storage.objects
  for insert with check (bucket_id = 'content-images' and public.is_admin());

drop policy if exists "admins can change content images" on storage.objects;
create policy "admins can change content images" on storage.objects
  for update using (bucket_id = 'content-images' and public.is_admin());

drop policy if exists "admins can delete content images" on storage.objects;
create policy "admins can delete content images" on storage.objects
  for delete using (bucket_id = 'content-images' and public.is_admin());

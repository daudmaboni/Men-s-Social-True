-- 0015 · Reels: short vertical videos on Discover (Step 70)
-- Adds "reel" to the kinds of content the Studio can publish. Reels use the video folder from 0004
-- (content-videos, 50 MB per file). Nothing else changes.
-- Safe to run more than once. Run it in Supabase → SQL Editor.

alter table public.content_items drop constraint if exists content_items_kind_check;
alter table public.content_items
  add constraint content_items_kind_check check (kind in ('guide', 'article', 'video', 'quiz', 'tool', 'expert', 'audio', 'infographic', 'reel'));

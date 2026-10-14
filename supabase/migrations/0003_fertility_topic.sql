-- Men's Social — add "Fertility and sperm health" as its own topic for Content Studio content.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

alter table public.content_items drop constraint if exists content_items_topic_check;
alter table public.content_items
  add constraint content_items_topic_check
  check (topic in ('erection', 'ejaculation', 'libido', 'fertility', 'confidence', 'intimacy', 'wellbeing'));

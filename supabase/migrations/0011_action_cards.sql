-- Step 63: "do this" cards made in the Studio (Admin → Card maker).
-- A card's steps, ingredients, timing and challenges are kept in one JSON column, so a card made in the
-- Studio shows on Discover exactly like the built-in ones. Safe to run again.

alter table public.content_items add column if not exists action jsonb;

alter table public.content_items drop constraint if exists content_items_action_shape;
alter table public.content_items add constraint content_items_action_shape check (
  action is null or (
    jsonb_typeof(action) = 'object'
    and jsonb_typeof(action -> 'steps') = 'array'
    and jsonb_array_length(action -> 'steps') between 1 and 12
    and jsonb_typeof(action -> 'challenges') = 'array'
    and octet_length(action::text) < 40000
  )
);

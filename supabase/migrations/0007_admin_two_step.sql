-- 0007 · Two-step sign-in (2FA) for the Admin Control Center
--
-- After this, admin powers only work when the admin signed in with password AND a code from an
-- authenticator app (Supabase calls this "aal2"). A stolen password alone can no longer read user
-- lists, publish content or change settings, even by calling the database directly.
--
-- ORDER MATTERS:
--   1. Deploy the Step 30 code first (Netlify).
--   2. Open /studio, sign in, and set up the authenticator app when asked.
--   3. Only then run this file in Supabase → SQL Editor.
-- If you lose the phone: Supabase → Authentication → Users → the admin → delete the MFA factor,
-- then sign in again and set it up on the new phone.
--
-- Men's own data is not affected: their access never depended on these functions.

-- true when this session passed the second step (password + authenticator code)
create or replace function public.mfa_ok()
returns boolean language sql stable set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'aal', 'aal1') = 'aal2';
$$;

-- Same three checks every admin rule already uses, now also requiring the second step.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admins where user_id = auth.uid() and public.mfa_ok();
$$;

create or replace function public.admin_can(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and coalesce((
    select case a.role
      when 'owner' then true
      when 'editor' then perm in ('content.edit', 'content.publish', 'homepage.edit', 'homepage.publish',
                                  'notifications.send', 'ai.use', 'analytics.view', 'audit.view', 'users.view')
      when 'writer' then perm in ('content.edit', 'homepage.edit', 'ai.use', 'analytics.view')
      when 'moderator' then perm in ('community.moderate', 'users.view', 'users.restrict',
                                     'notifications.send', 'analytics.view', 'audit.view')
      when 'analyst' then perm in ('analytics.view', 'users.view')
      else false end
    from public.admins a where a.user_id = auth.uid()), false);
$$;

-- For the sign-in screen only: "is this person staff?" so it can ask for the authenticator code.
-- Answers about the signed-in person only, and gives no admin powers.
create or replace function public.my_admin_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admins where user_id = auth.uid();
$$;
revoke all on function public.my_admin_role() from public, anon;
grant execute on function public.my_admin_role() to authenticated;

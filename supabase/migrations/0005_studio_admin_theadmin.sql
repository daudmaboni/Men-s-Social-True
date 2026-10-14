-- Men's Social — make the "TheAdmin" Studio login an owner.
-- FIRST create the login (once): Supabase → Authentication → Users → Add user → Create new user
--   Email:     theadmin@studio.menssocial.app
--   Password:  (the admin password you chose)
--   ✓ Auto Confirm User
-- THEN paste this file into SQL Editor → Run. Safe to run more than once.
-- In the Studio sign-in you can then type just "TheAdmin" as the username.

insert into public.admins (user_id, role)
select id, 'owner' from auth.users where email = 'theadmin@studio.menssocial.app'
on conflict (user_id) do update set role = 'owner';

-- Check: this should show one row with role "owner"
select u.email, a.role
from public.admins a join auth.users u on u.id = a.user_id
where u.email = 'theadmin@studio.menssocial.app';

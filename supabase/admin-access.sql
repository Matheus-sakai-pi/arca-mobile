-- Run in the Supabase SQL Editor only AFTER confirming this is your existing Arca account.
-- This does not create an account or grant access to future signups with the same email.
begin;
do $$
declare owner uuid;
begin
  select id into strict owner from auth.users
    where lower(email)='matheussakai23032001@gmail.com' and email_confirmed_at is not null;
  insert into public.arca_admins(user_id) values(owner) on conflict do nothing;
exception when no_data_found then raise exception 'Confirme a conta existente e o e-mail antes de liberar o painel.';
end;
$$;
commit;

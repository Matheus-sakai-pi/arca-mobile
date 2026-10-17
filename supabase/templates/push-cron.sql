-- Run only after deploying dispatch-push and saving the URL and dedicated secret in Vault.
-- This file never contains the private FCM key or a Supabase service-role key.
do $$
declare endpoint text; secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='push_project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name='push_dispatch_secret';
  if endpoint is null or endpoint !~ '^https://[a-z0-9]+\.supabase\.co$' then raise exception 'Configure push_project_url in Vault first'; end if;
  if secret is null or length(secret)<32 then raise exception 'Configure push_dispatch_secret in Vault first'; end if;
end$$;

select cron.schedule('arca-push-every-five-minutes','*/5 * * * *',$job$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='push_project_url')||'/functions/v1/dispatch-push',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='push_dispatch_secret')),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  );
$job$);

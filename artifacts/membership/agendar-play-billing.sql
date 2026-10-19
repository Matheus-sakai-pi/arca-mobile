-- Agenda a conferência das assinaturas VIP a cada 5 minutos.
-- Antes de rodar: (1) ative pg_cron e pg_net em Database > Extensions;
-- (2) salve no Vault o segredo play_billing_cron_secret, com o MESMO valor de PLAY_BILLING_CRON_SECRET.
-- Este arquivo não contém senhas nem chaves; ele lê o segredo do Vault na hora de cada execução.
do $$
declare secret text;
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then raise exception 'Ative a extensão pg_cron em Database > Extensions'; end if;
  if not exists (select 1 from pg_extension where extname='pg_net') then raise exception 'Ative a extensão pg_net em Database > Extensions'; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='play_billing_cron_secret';
  if secret is null or length(secret)<32 then raise exception 'Salve play_billing_cron_secret no Vault (32 caracteres ou mais)'; end if;
  -- Pode rodar de novo sem duplicar o agendamento.
  if exists (select 1 from cron.job where jobname='arca-play-billing-every-five-minutes') then
    perform cron.unschedule('arca-play-billing-every-five-minutes');
  end if;
end$$;

select cron.schedule('arca-play-billing-every-five-minutes','*/5 * * * *',$job$
  select net.http_post(
    url:='https://kuawynauynlyieocaahr.supabase.co/functions/v1/play-billing',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='play_billing_cron_secret')),
    body:='{"action":"reconcile"}'::jsonb,
    timeout_milliseconds:=60000
  );
$job$);

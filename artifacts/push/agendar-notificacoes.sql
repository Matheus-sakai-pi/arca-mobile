-- Agenda o envio das notificações (bateria cheia e convite para voltar) a cada 5 minutos.
-- Antes de rodar: (1) pg_cron e pg_net ativos em Database > Extensions;
-- (2) publique a função dispatch-push e salve PUSH_DISPATCH_SECRET nos secrets dela;
-- (3) salve no Vault o segredo push_dispatch_secret com o MESMO valor.
-- Este arquivo não contém senhas; o segredo é lido do Vault a cada execução.
do $$
declare secret text;
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then raise exception 'Ative a extensão pg_cron em Database > Extensions'; end if;
  if not exists (select 1 from pg_extension where extname='pg_net') then raise exception 'Ative a extensão pg_net em Database > Extensions'; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='push_dispatch_secret';
  if secret is null or length(secret)<32 then raise exception 'Salve push_dispatch_secret no Vault (32 caracteres ou mais)'; end if;
  -- Pode rodar de novo sem duplicar o agendamento.
  if exists (select 1 from cron.job where jobname='arca-push-every-five-minutes') then
    perform cron.unschedule('arca-push-every-five-minutes');
  end if;
end$$;

select cron.schedule('arca-push-every-five-minutes','*/5 * * * *',$job$
  select net.http_post(
    url:='https://kuawynauynlyieocaahr.supabase.co/functions/v1/dispatch-push',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='push_dispatch_secret')),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  );
$job$);

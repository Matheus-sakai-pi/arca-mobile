-- Bateria com limite de 30 e carga completa em 24 horas (1 energia a cada 48 minutos).
-- Seguro para bancos que já aplicaram 202610170001: atualiza as regras e mantém
-- as carteiras coerentes. Quem estava com a bateria cheia (25) passa a 30;
-- quem estava abaixo do limite continua recarregando a partir do saldo atual.
update public.battery_rules
set rules = jsonb_set(jsonb_set(rules, '{capacity}', '30'::jsonb), '{refillSeconds}', '2880'::jsonb)
where singleton;

update public.battery_wallets
set balance = 30, refill_at = null
where refill_at is null and balance < 30;

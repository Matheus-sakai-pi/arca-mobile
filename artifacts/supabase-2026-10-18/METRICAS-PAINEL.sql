begin;

-- Métricas de crescimento do painel administrativo. Só contas (visitantes não chegam ao servidor).
-- "Ativo" segue o restante do painel: concluiu ao menos uma lição ou revisão (lesson_attempts).
-- Todas as datas em UTC.
create or replace function public.arca_admin_growth() returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare today date:=current_date; first_unit text; result jsonb;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  select u.id into first_unit from public.units u join public.courses c on c.id=u.course_id
    where u.published and c.published order by c.order_index,u.order_index limit 1;

  with active as (
    select distinct user_id,created_at::date as day from public.lesson_attempts where created_at>=(today-130)::timestamptz
  ), signups as (
    select id as user_id,created_at,created_at::date as day from public.profiles where created_at>=(today-91)::timestamptz
  ),
  -- Retenção clássica: ativo exatamente no dia N após o cadastro. Só entra quem já passou do dia N inteiro.
  retention as (
    select s.user_id,s.day,n.offset_days,s.day+n.offset_days<today as eligible,
      exists(select 1 from active a where a.user_id=s.user_id and a.day=s.day+n.offset_days) as retained
    from signups s cross join (values(1),(7),(30)) n(offset_days)
  ), daily as (
    select d::date as day,(select count(*) from active a where a.day=d::date) as active
    from generate_series(today-30,today,interval '1 day') d
  ),
  -- Funil do primeiro dia: contas cujas primeiras 24 horas já terminaram, cadastradas nos últimos 30 dias.
  first_day as (
    select s.user_id,
      (select count(distinct a.lesson_id) from public.lesson_attempts a where a.user_id=s.user_id and a.created_at<s.created_at+interval '24 hours') as lessons,
      first_unit is not null and not exists(select 1 from public.lessons l where l.unit_id=first_unit and l.published
        and not exists(select 1 from public.lesson_attempts a where a.user_id=s.user_id and a.lesson_id=l.id and a.created_at<s.created_at+interval '24 hours')) as unit_done
    from signups s where s.created_at>=now()-interval '31 days' and s.created_at<now()-interval '24 hours'
  ),
  -- Sessões de lição com pelo menos um exercício respondido nos últimos 30 dias.
  sessions as (
    select s.wallet_id,s.attempt_id,s.completed,w.user_id,min(e.created_at) as started,max(e.created_at) as last_event
    from public.battery_sessions s join public.battery_wallets w on w.id=s.wallet_id and w.user_id is not null
    join public.battery_events e on e.wallet_id=s.wallet_id and e.attempt_id=s.attempt_id
    group by s.wallet_id,s.attempt_id,s.completed,w.user_id having min(e.created_at)>=now()-interval '30 days'
  ),
  -- Estimativa: sessão não concluída em que a pessoa ficou sem bateria depois do último exercício,
  -- sem ter respondido nada em outra sessão entre esse exercício e o bloqueio.
  stopped as (
    select s.* from sessions s where not s.completed and exists(
      select 1 from public.learning_energy_daily d where d.user_id=s.user_id and d.day>=s.last_event::date and d.last_blocked_at>=s.last_event
        and not exists(select 1 from public.battery_events e where e.wallet_id=s.wallet_id and e.created_at>s.last_event and e.created_at<=d.last_blocked_at))
  ), blocked as (
    select user_id,max(last_blocked_at) as last_blocked_at,sum(blocked) as blocks from public.learning_energy_daily where day>=today-29 group by user_id
  )
  select jsonb_build_object(
    'retention',jsonb_build_object(
      'summary',(select jsonb_object_agg('d'||offset_days,jsonb_build_object('eligible',eligible,'retained',retained))
        from (select offset_days,count(*) filter (where eligible) as eligible,count(*) filter (where eligible and retained) as retained
          from retention group by offset_days) t),
      'cohorts',(select jsonb_agg(jsonb_build_object('week',w.week,'users',(select count(*) from signups s where date_trunc('week',s.day)::date=w.week),
          'd1',(select jsonb_build_object('eligible',count(*) filter (where eligible),'retained',count(*) filter (where eligible and retained)) from retention r where r.offset_days=1 and date_trunc('week',r.day)::date=w.week),
          'd7',(select jsonb_build_object('eligible',count(*) filter (where eligible),'retained',count(*) filter (where eligible and retained)) from retention r where r.offset_days=7 and date_trunc('week',r.day)::date=w.week),
          'd30',(select jsonb_build_object('eligible',count(*) filter (where eligible),'retained',count(*) filter (where eligible and retained)) from retention r where r.offset_days=30 and date_trunc('week',r.day)::date=w.week))
        order by w.week desc)
        from (select (date_trunc('week',today::timestamp)-k*interval '1 week')::date as week from generate_series(0,7) k) w)),
    'activity',jsonb_build_object(
      'dau',(select count(*) from active where day=today),
      'wau',(select count(distinct user_id) from active where day>=today-6),
      'mau',(select count(distinct user_id) from active where day>=today-29),
      -- Aderência usa os 30 dias completos anteriores a hoje: média diária ÷ pessoas distintas no período.
      'stickyUserDays',(select coalesce(sum(active),0) from daily where day<today),
      'stickyUsers',(select count(distinct user_id) from active where day between today-30 and today-1),
      'days',(select jsonb_agg(jsonb_build_object('day',day,'active',active) order by day) from daily where day>today-30)),
    'funnel',jsonb_build_object(
      'signups',(select count(*) from first_day),
      'firstLesson',(select count(*) from first_day where lessons>=1),
      'threeLessons',(select count(*) from first_day where lessons>=3),
      'firstUnit',(select count(*) from first_day where unit_done)),
    'battery',jsonb_build_object(
      'enabled',(select enabled from public.learning_energy_config where singleton),
      'sessions',(select count(*) from sessions),
      'stopped',(select count(*) from stopped),
      'stoppedUsers',(select count(distinct user_id) from stopped),
      'blockedUsers',(select count(*) from blocked),
      'returnedUsers',(select count(*) from blocked b where exists(select 1 from public.lesson_attempts a where a.user_id=b.user_id and a.created_at>b.last_blocked_at)))
  ) into result;
  return result;
end;
$$;
revoke all on function public.arca_admin_growth() from public,anon;
grant execute on function public.arca_admin_growth() to authenticated;

commit;

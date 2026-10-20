begin;

-- Painel administrativo: os 10 jogadores mais avançados (mais lições concluídas, desempate por XP)
-- e a fase em que cada um está (primeira lição ainda não concluída, na ordem da trilha).
create or replace function public.arca_admin_top_players() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare players jsonb; total integer;
begin
  if not public.arca_is_admin() then raise exception 'admin_required'; end if;
  with course as (
    select l.id, l.title, u.title as unit_title,
      dense_rank() over (order by c.order_index, u.order_index)::integer as unit_number,
      row_number() over (order by c.order_index, u.order_index, l.order_index)::integer as position
    from public.lessons l join public.units u on u.id=l.unit_id join public.courses c on c.id=u.course_id
    where l.published and u.published and c.published
  ), done as (
    select p.user_id, count(*)::integer as completed
    from public.user_lesson_progress p join course on course.id=p.lesson_id
    where p.status in ('completed','mastered') group by p.user_id
  ), top as (
    select pr.id, pr.display_name, pr.xp_total, pr.current_streak, d.completed
    from done d join public.profiles pr on pr.id=d.user_id
    order by d.completed desc, pr.xp_total desc, pr.id limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', t.display_name, 'xp', t.xp_total, 'streak', t.current_streak, 'completed', t.completed,
      'current', (select jsonb_build_object('unit', c.unit_number, 'unitTitle', c.unit_title, 'lesson', c.title, 'position', c.position)
        from course c where not exists(select 1 from public.user_lesson_progress p
          where p.user_id=t.id and p.lesson_id=c.id and p.status in ('completed','mastered'))
        order by c.position limit 1),
      'lastActivity', (select max(a.created_at) from public.lesson_attempts a where a.user_id=t.id)
    ) order by t.completed desc, t.xp_total desc, t.id), '[]'::jsonb)
  into players from top t;
  select count(*)::integer into total from public.lessons l join public.units u on u.id=l.unit_id
    join public.courses c on c.id=u.course_id where l.published and u.published and c.published;
  return jsonb_build_object('total', total, 'players', players);
end;
$$;
revoke all on function public.arca_admin_top_players() from public,anon;
grant execute on function public.arca_admin_top_players() to authenticated;

commit;

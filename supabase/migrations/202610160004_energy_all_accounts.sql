begin;

-- Remove the introductory exemption without revoking existing lesson access.
create or replace function public.energy_intro(p_lesson text) returns boolean
language sql stable security definer set search_path='' as $$
  select false
$$;

update public.learning_energy_config
set enabled=true,rollout=100,updated_at=clock_timestamp(),updated_by=null
where singleton;

commit;

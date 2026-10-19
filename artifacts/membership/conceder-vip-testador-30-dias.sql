-- Execute AFTER 202610180007_admin_vip.sql, as the database administrator.
-- This separate gift does not change the owner's grant or create a Play purchase.
begin;
set local timezone='UTC';
do $$
declare target uuid; matches integer; previous public.admin_vip_grants;
begin
  select count(*), (array_agg(u.id))[1] into matches,target
    from auth.users u join public.profiles p on p.id=u.id
    where lower(btrim(u.email))='matsakteste@gmail.com';
  if matches<>1 then raise exception 'Conta nao encontrada ou email ambiguo. Nenhum VIP foi concedido.'; end if;
  insert into public.admin_vip_grants(request_key,user_id,expires_at,reason)
    values('tester-matsakteste-2026-10-18-30-days',target,now()+interval '30 days','Teste VIP de 30 dias para a conta do testador, autorizado pelo titular')
    on conflict(request_key) do nothing;
  select * into previous from public.admin_vip_grants where request_key='tester-matsakteste-2026-10-18-30-days';
  if previous.user_id is distinct from target then raise exception 'Concessao anterior pertence a outra conta. Nenhuma alteracao realizada.'; end if;
end $$;
select user_id,starts_at,expires_at,revoked_at from public.admin_vip_grants
  where request_key='tester-matsakteste-2026-10-18-30-days';
commit;

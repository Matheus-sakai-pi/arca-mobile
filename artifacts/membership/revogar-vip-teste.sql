-- Optional: stop only this administrative gift. Google Play subscriptions remain intact.
update public.admin_vip_grants set revoked_at=coalesce(revoked_at,now())
  where request_key='owner-test-2026-10-18-30-days';

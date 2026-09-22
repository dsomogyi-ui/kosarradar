-- Apply after restoring the existing project. Not yet applied to the inactive project.
begin;
create table public.price_watches (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 config jsonb not null check (jsonb_typeof(config)='object' and octet_length(config::text)<=16000),
 last_prices jsonb not null default '{}',
 last_checked_at timestamptz,
 last_status text not null default 'pending' check(last_status in ('pending','ok','partial','unavailable')),
 created_at timestamptz not null default now()
);
create index price_watches_user_idx on public.price_watches(user_id,created_at desc);
create index price_watches_due_idx on public.price_watches(last_checked_at nulls first);
alter table public.price_watches enable row level security;
revoke all on public.price_watches from anon,authenticated;
grant select,delete on public.price_watches to authenticated;
grant insert(user_id,config) on public.price_watches to authenticated;
grant all on public.price_watches to service_role;
create policy watches_read_own on public.price_watches for select to authenticated using ((select auth.uid())=user_id);
create policy watches_create_own on public.price_watches for insert to authenticated with check ((select auth.uid())=user_id);
create policy watches_delete_own on public.price_watches for delete to authenticated using ((select auth.uid())=user_id);

create table public.price_alerts (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 watch_id uuid not null references public.price_watches(id) on delete cascade,
 event_key text not null,
 event jsonb not null,
 read boolean not null default false,
 created_at timestamptz not null default now(),
 unique(watch_id,event_key)
);
create index price_alerts_user_idx on public.price_alerts(user_id,created_at desc);
alter table public.price_alerts enable row level security;
revoke all on public.price_alerts from anon,authenticated;
grant select on public.price_alerts to authenticated;
grant update(read) on public.price_alerts to authenticated;
grant all on public.price_alerts to service_role;
grant usage,select on sequence public.price_alerts_id_seq to service_role;
create policy alerts_read_own on public.price_alerts for select to authenticated using ((select auth.uid())=user_id);
create policy alerts_mark_own on public.price_alerts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Serialize quota checks so concurrent inserts cannot bypass the per-user limit.
create function public.limit_price_watches() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if (select count(*) from public.price_watches where user_id=new.user_id)>=10 then raise exception 'watch limit reached'; end if;
 return new;
end;
$$;
revoke all on function public.limit_price_watches() from public,anon,authenticated;
create trigger price_watch_limit before insert on public.price_watches for each row execute function public.limit_price_watches();

-- Only the server worker can write observations/events. Row lock + expected version
-- makes duplicate/overlapping cron executions idempotent; deleted watches stay deleted.
create function public.commit_price_check(p_id uuid,p_expected timestamptz,p_prices jsonb,p_events jsonb,p_checked timestamptz,p_status text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare w public.price_watches; e jsonb;
begin
 select * into w from public.price_watches where id=p_id for update;
 if not found or w.last_checked_at is distinct from p_expected then return false; end if;
 if jsonb_typeof(p_prices)<>'object' or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>192 or octet_length(p_prices::text)>100000 then raise exception 'invalid observations'; end if;
 if p_checked<=coalesce(w.last_checked_at,'epoch'::timestamptz) then return false; end if;
 update public.price_watches set last_prices=p_prices,last_checked_at=p_checked,last_status=p_status where id=p_id;
 for e in select value from jsonb_array_elements(p_events) loop
  insert into public.price_alerts(user_id,watch_id,event_key,event) values(w.user_id,w.id,e->>'id',e) on conflict(watch_id,event_key) do nothing;
 end loop;
 -- Keep a bounded recent history per watch.
 delete from public.price_alerts where watch_id=w.id and id not in (select id from public.price_alerts where watch_id=w.id order by id desc limit 100);
 return true;
end;
$$;
revoke all on function public.commit_price_check(uuid,timestamptz,jsonb,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.commit_price_check(uuid,timestamptz,jsonb,jsonb,timestamptz,text) to service_role;
commit;

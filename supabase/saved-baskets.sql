-- Apply once after schema.sql. Every saved snapshot is immutable and user-owned.
create table public.saved_baskets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 60000),
 created_at timestamptz not null default now()
);
create index saved_baskets_user_created on public.saved_baskets(user_id, created_at desc);
alter table public.saved_baskets enable row level security;
revoke all on public.saved_baskets from anon, authenticated;
grant select, insert on public.saved_baskets to authenticated;
create policy "Users read own baskets" on public.saved_baskets for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users save own baskets" on public.saved_baskets for insert to authenticated with check ((select auth.uid()) = user_id);

-- Apply once to the chosen KosárRadar Supabase project.
create table if not exists public.user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (char_length(display_name) <= 80),
 favorite_shop_ids text[] not null default '{}' check (cardinality(favorite_shop_ids) <= 50),
 updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon;
grant select,insert,update,delete on public.user_preferences to authenticated;
create policy "Read own preferences" on public.user_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy "Insert own preferences" on public.user_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own preferences" on public.user_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Delete own preferences" on public.user_preferences for delete to authenticated using ((select auth.uid())=user_id);

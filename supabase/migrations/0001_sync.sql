-- MonkeySlap: tables for backing up and syncing what the extension stores locally.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Access rules (Row Level Security): every signed-in user can read and write only
-- their own rows. The extension uses the publishable key, so these rules are what
-- keep one user's data away from another.

-- One row per user: their sites, limits and preferences.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null,
  -- When the settings were last changed on any device; the newer copy wins.
  updated_at timestamptz not null default now(),
  -- When this person was first slapped (ends the 1-minute first slap rule everywhere).
  first_slap_at timestamptz
);

-- One row per user, per device, per day, per site: time spent and slaps.
-- Each device writes its own rows, so totals across devices are a simple sum.
create table if not exists public.daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  day date not null,
  domain text not null check (char_length(domain) between 3 and 253),
  ms bigint not null default 0 check (ms >= 0),
  slaps integer not null default 0 check (slaps >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id, day, domain)
);

create index if not exists daily_usage_user_day on public.daily_usage (user_id, day);

alter table public.user_settings enable row level security;
alter table public.daily_usage enable row level security;

-- Let signed-in users reach these tables through the API (the rules below still
-- limit them to their own rows). Signed-out visitors (anon) get no access at all.
-- Needed when "Grant API access to new tables automatically" is off.
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.daily_usage to authenticated;
revoke all on public.user_settings from anon;
revoke all on public.daily_usage from anon;

-- (select auth.uid()) is evaluated once per query instead of once per row.
drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own usage" on public.daily_usage;
create policy "own usage" on public.daily_usage
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

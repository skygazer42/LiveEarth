create extension if not exists pgcrypto;

create type public.scene_channel as enum ('storm', 'ocean', 'night');
create type public.ranking_channel as enum ('earth', 'storm', 'ocean', 'night');
create type public.feed_protocol as enum ('srt', 'rtmps', 'rtsp', 'hls');
create type public.feed_state as enum ('pending', 'live', 'degraded', 'offline', 'disabled');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text not null,
  region text not null,
  country text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  title jsonb not null,
  source_url text not null,
  source_protocol public.feed_protocol not null,
  playback_url text not null check (playback_url like 'https://%.m3u8%'),
  poster_url text not null check (poster_url like 'https://%'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  timezone text not null,
  primary_channel public.scene_channel not null,
  channels public.scene_channel[] not null check (cardinality(channels) > 0),
  attribution jsonb not null,
  rights_expires_at timestamptz not null,
  allow_audio boolean not null default false,
  allow_transcoding boolean not null check (allow_transcoding),
  allow_frame_analysis boolean not null check (allow_frame_analysis),
  allow_derived_metadata boolean not null check (allow_derived_metadata),
  max_retention_hours smallint not null check (max_retention_hours between 0 and 24),
  state public.feed_state not null default 'pending',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (primary_channel = any(channels)),
  check (rights_expires_at > created_at)
);

create table public.published_scenes (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null unique references public.feeds(id) on delete cascade,
  slug text not null unique,
  channel public.scene_channel not null,
  payload jsonb not null,
  analysis_observed_at timestamptz not null,
  last_frame_at timestamptz not null,
  is_publishable boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  channel public.ranking_channel not null,
  version text not null unique,
  payload jsonb not null,
  generated_at timestamptz not null,
  next_refresh_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index ranking_snapshots_channel_generated_idx
  on public.ranking_snapshots(channel, generated_at desc);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id uuid not null references public.published_scenes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, scene_id)
);

create table public.view_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id uuid not null references public.published_scenes(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, scene_id)
);

create index view_history_user_viewed_idx on public.view_history(user_id, viewed_at desc);

alter table public.admin_users enable row level security;
alter table public.feeds enable row level security;
alter table public.published_scenes enable row level security;
alter table public.ranking_snapshots enable row level security;
alter table public.favorites enable row level security;
alter table public.view_history enable row level security;

create policy "admins can see themselves"
  on public.admin_users for select
  using (user_id = auth.uid());

create policy "admins manage feeds"
  on public.feeds for all
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "public reads publishable scenes"
  on public.published_scenes for select
  using (
    is_publishable = true
    and last_frame_at >= now() - interval '90 seconds'
    and analysis_observed_at >= now() - interval '10 minutes'
  );

create policy "admins read all scenes"
  on public.published_scenes for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "admins initialise scenes"
  on public.published_scenes for insert
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "public reads published rankings"
  on public.ranking_snapshots for select
  using (
    generated_at <= now()
    and generated_at >= now() - interval '10 minutes'
  );

create policy "users read own favorites"
  on public.favorites for select using (user_id = auth.uid());
create policy "users add own favorites"
  on public.favorites for insert with check (user_id = auth.uid());
create policy "users delete own favorites"
  on public.favorites for delete using (user_id = auth.uid());

create policy "users read own history"
  on public.view_history for select using (user_id = auth.uid());
create policy "users add own history"
  on public.view_history for insert with check (user_id = auth.uid());
create policy "users update own history"
  on public.view_history for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own history"
  on public.view_history for delete using (user_id = auth.uid());

create or replace function public.trim_view_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.view_history
  where user_id = new.user_id
    and scene_id in (
      select scene_id from public.view_history
      where user_id = new.user_id
      order by viewed_at desc
      offset 100
    );
  return new;
end;
$$;

create trigger trim_view_history_after_write
after insert or update on public.view_history
for each row execute function public.trim_view_history();

comment on table public.feeds is
  'Contains confidential ingest URLs and rights metadata. Never expose through a public API.';
comment on column public.published_scenes.payload is
  'Validated @liveearth/domain Scene payload; excludes confidential ingest credentials.';

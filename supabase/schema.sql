-- Shira's Cookbook — database schema
-- Run this in the Supabase SQL editor once the project exists.
-- Auth (accounts, email login) is handled by Supabase itself — this only
-- defines the app's own tables, keyed off Supabase's built-in auth.users.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  palette text not null default 'blue' check (palette in ('pink', 'blue', 'green', 'yellow')),
  created_at timestamptz not null default now()
);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  emoji text not null,
  blurb text not null,
  source text not null,
  keywords text[] not null default '{}',
  have_items text[] not null default '{}',
  buy_items text[] not null default '{}',
  steps jsonb not null,               -- [{ text, timerSeconds, parallelTip }, ...]
  note text,
  created_at timestamptz not null default now()
);

-- One row per time a recipe is actually cooked — this is what lets a note like
-- "too salty" travel forward into future chat requests for the same dish.
create table if not exists cook_sessions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  rating int check (rating between 1 and 5),
  note text,
  cooked_at timestamptz not null default now()
);

-- Row Level Security: each person can only see and edit their own data.
alter table profiles enable row level security;
alter table recipes enable row level security;
alter table cook_sessions enable row level security;

create policy "profiles: read own" on profiles for select using (auth.uid() = id);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);
create policy "profiles: insert own" on profiles for insert with check (auth.uid() = id);

create policy "recipes: read own" on recipes for select using (auth.uid() = owner_id);
create policy "recipes: write own" on recipes for insert with check (auth.uid() = owner_id);
create policy "recipes: update own" on recipes for update using (auth.uid() = owner_id);
create policy "recipes: delete own" on recipes for delete using (auth.uid() = owner_id);

create policy "cook_sessions: read own" on cook_sessions for select
  using (exists (select 1 from recipes where recipes.id = recipe_id and recipes.owner_id = auth.uid()));
create policy "cook_sessions: write own" on cook_sessions for insert
  with check (exists (select 1 from recipes where recipes.id = recipe_id and recipes.owner_id = auth.uid()));

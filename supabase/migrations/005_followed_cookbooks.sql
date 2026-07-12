-- Remembering friends' shared cookbooks: opening a share link once (while signed in)
-- saves that book to your "friends' books" list, so it's always reachable from the
-- browse page afterwards without needing the link again.
create table if not exists followed_cookbooks (
  follower_id uuid not null references profiles (id) on delete cascade,
  owner_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, owner_id)
);

alter table followed_cookbooks enable row level security;

create policy "follows: read own" on followed_cookbooks
  for select using (auth.uid() = follower_id);
create policy "follows: insert own" on followed_cookbooks
  for insert with check (auth.uid() = follower_id);
create policy "follows: delete own" on followed_cookbooks
  for delete using (auth.uid() = follower_id);

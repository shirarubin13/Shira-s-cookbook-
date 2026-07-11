-- Real cookbook sharing: an owner can flip is_shared on, which makes their profile name
-- and non-pending recipes readable (view-only) via /browse/<their-user-id>, without
-- requiring the visitor to have an account or be signed in. Off by default — nothing is
-- shared until the owner explicitly turns it on from the Share sheet.
alter table profiles add column if not exists is_shared boolean not null default false;

create policy "profiles: public read when shared" on profiles
  for select using (is_shared = true);

create policy "recipes: public read when owner shared" on recipes
  for select using (
    pending = false
    and exists (select 1 from profiles where profiles.id = recipes.owner_id and profiles.is_shared = true)
  );

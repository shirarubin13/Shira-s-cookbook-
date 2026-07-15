-- Sharing a single recipe (not the whole book): a per-recipe is_shared flag the
-- owner turns on when copying a share link. Anyone with the link can then view
-- that one recipe — nothing else from the book becomes visible.
alter table recipes add column if not exists is_shared boolean not null default false;

create policy "recipes: public read when recipe shared" on recipes
  for select using (is_shared = true);

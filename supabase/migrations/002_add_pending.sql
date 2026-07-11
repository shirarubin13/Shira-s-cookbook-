-- Adds the "pending" flag used by the save-for-later flow: a recipe saved from
-- chat shows up in the cookbook right away, but only counts as permanently kept
-- once it's actually cooked and confirmed at Feedback.
alter table recipes add column if not exists pending boolean not null default false;

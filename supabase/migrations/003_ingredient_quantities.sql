-- Ingredients now carry a quantity (e.g. "2 יחידות"), so have_items/buy_items move from
-- plain text[] to jsonb arrays of {name, quantity}. Existing rows are migrated in place —
-- each old string becomes { "name": <string> } with no quantity, which the app just
-- displays without a quantity shown.
--
-- Postgres doesn't allow a subquery inside ALTER COLUMN ... USING, so the conversion goes
-- through a temporary column populated via UPDATE instead of a single in-place ALTER.

alter table recipes add column have_items_new jsonb not null default '[]'::jsonb;
alter table recipes add column buy_items_new jsonb not null default '[]'::jsonb;

update recipes
set have_items_new = coalesce(
  (select jsonb_agg(jsonb_build_object('name', item)) from unnest(have_items) as item),
  '[]'::jsonb
);

update recipes
set buy_items_new = coalesce(
  (select jsonb_agg(jsonb_build_object('name', item)) from unnest(buy_items) as item),
  '[]'::jsonb
);

alter table recipes drop column have_items;
alter table recipes rename column have_items_new to have_items;

alter table recipes drop column buy_items;
alter table recipes rename column buy_items_new to buy_items;

-- Per-ingredient suggestions derived from a past cooking note (e.g. "maybe 4 onions next
-- time instead of 5") — shown next to the ingredient's quantity, never applied automatically.
alter table recipes add column if not exists ingredient_notes jsonb;

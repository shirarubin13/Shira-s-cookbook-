-- One-time cleanup: accounts created before seeding was removed got these four
-- demo recipes inserted automatically at signup. Deletes them for every account —
-- run once. (Recipes people created themselves have different titles and survive.)
delete from recipes
where title in (
  'המבורגר עם בצל מקורמל',
  'קציצות לארוחת ערב',
  'עוגת שוקולד בספל',
  'פסטה עם פטה אפויה'
)
and source in ('מהצ׳אט', 'יובא מטיקטוק');

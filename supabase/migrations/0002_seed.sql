-- flunky.bet v0 — seed data.
-- Placeholder team names/slugs. Swap in the real ones before launch.

-- Global config (single row).
insert into settings (id, betting_open, starting_credits)
values (1, true, 200);

-- 7 teams. Slugs are used in the results JSON at settlement.
insert into teams (slug, name) values
  ('lions',  'Lions'),
  ('tigers', 'Tigers'),
  ('eagles', 'Eagles'),
  ('bears',  'Bears'),
  ('sharks', 'Sharks'),
  ('wolves', 'Wolves'),
  ('hawks',  'Hawks');

-- 21 matches: every unordered pair, alphabetical slot order so slugs/ordering
-- are deterministic (e.g. bears-vs-eagles). match_order runs 1..21.
insert into matches (slug, team_a_id, team_b_id, match_order)
select a.slug || '-vs-' || b.slug,
       a.id, b.id,
       row_number() over (order by a.slug, b.slug)
from teams a
join teams b on a.slug < b.slug;

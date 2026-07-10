-- flunky.bet — rename the 7 placeholder teams to the real tournament teams.
--
-- Each team is named after the people on it, so the display names are long. The
-- UI was checked at a 375px phone viewport and at desktop to confirm the long
-- names wrap cleanly and don't overflow/clip any layout (match cards, bet slip,
-- tournament-winner list, leaderboard).
--
-- We RENAME in place — update `name` (and `slug`) on the existing rows — rather
-- than recreate, so team IDs are preserved and every matches/bets foreign key
-- that points at them stays valid (there are already live bets). There are
-- exactly 7 teams today and exactly 7 new names, so the mapping is a straight
-- 1:1 in the original seed order (see 0002_seed.sql):
--
--   lions  → Eoghan, Ronan & Quigs
--   tigers → Fouad, Sofia, Julian & Ciara
--   eagles → Donal, Jake & Agathe
--   bears  → Anya, Callum & Daria
--   sharks → Jochem, Fedja & Eda
--   wolves → Maisy, Eva & Marcelo
--   hawks  → Tijn, Hannah & Kelly
--
-- Slugs are refreshed to match the members too. Slugs key the hand-authored
-- results JSON at settlement (docs/SPEC.md), so leaving animal codes on teams
-- of people would be a footgun for whoever writes that JSON. Match slugs are
-- derived from team slugs, so they're regenerated below in lockstep;
-- team_a_id / team_b_id / match_order are left exactly as seeded.

begin;

update teams set slug = 'eoghan-ronan-quigs',       name = 'Eoghan, Ronan & Quigs'       where slug = 'lions';
update teams set slug = 'fouad-sofia-julian-ciara', name = 'Fouad, Sofia, Julian & Ciara' where slug = 'tigers';
update teams set slug = 'donal-jake-agathe',        name = 'Donal, Jake & Agathe'         where slug = 'eagles';
update teams set slug = 'anya-callum-daria',        name = 'Anya, Callum & Daria'         where slug = 'bears';
update teams set slug = 'jochem-fedja-eda',         name = 'Jochem, Fedja & Eda'          where slug = 'sharks';
update teams set slug = 'maisy-eva-marcelo',        name = 'Maisy, Eva & Marcelo'         where slug = 'wolves';
update teams set slug = 'tijn-hannah-kelly',        name = 'Tijn, Hannah & Kelly'         where slug = 'hawks';

-- Regenerate match slugs from the new team slugs, keeping the seed's
-- alphabetical slot-order convention (least/greatest) so each unordered pair
-- yields one stable, unique slug regardless of which team sits in the a/b slot.
-- Old (animal) slugs and new (people) slugs are disjoint, so there is no
-- transient unique-constraint collision during the update.
update matches m
set slug = least(ta.slug, tb.slug) || '-vs-' || greatest(ta.slug, tb.slug)
from teams ta, teams tb
where ta.id = m.team_a_id
  and tb.id = m.team_b_id;

commit;

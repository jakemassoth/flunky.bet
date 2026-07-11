-- flunky.bet — LOCK BETTING (tournament kickoff).
--
-- Applying this migration freezes ALL betting at once. It is the migration form
-- of the admin runbook's "kickoff" step (docs/SPEC.md 2.7):
--
--     update settings set betting_open = false where id = 1;
--
-- Merging this PR = the markets close. Betting was designed around ONE global
-- lock, so a single flag covers every market — all 21 match markets AND the
-- tournament-winner market (docs/SPEC.md 1.6). There is no per-market locking to
-- reconcile.
--
-- How the lock is ENFORCED (already in 0001_init.sql, not the frontend):
--   The `bets_enforce` trigger runs `enforce_bet_rules()` BEFORE every
--   INSERT / UPDATE / DELETE on `bets`. With betting closed it raises
--   'Betting is closed', which blocks new bets (INSERT), edits (UPDATE) and
--   cancels (DELETE) alike — matching "once betting locks, all bets are final"
--   (docs/SPEC.md 1.5). The check is server-side and RLS-independent, so a
--   client holding only the anon key cannot bypass it.
--
-- What this does NOT touch:
--   * Existing bets are left exactly as placed (no delete, no stake/payout edit).
--   * Settlement is unaffected: settle_tournament() sets flunky.settling='on',
--     so its own payout writes bypass the trigger even while betting is closed.
--   * Reads (own bets, get_market_pools, get_leaderboard) are unaffected.
--
-- To UNDO (reopen betting), run as the service role (SQL editor):
--   update settings set betting_open = true where id = 1;

begin;

update settings set betting_open = false where id = 1;

-- Fail loudly if the single settings row is missing or wasn't flipped, so a
-- silent no-op can never masquerade as "betting locked".
do $$
begin
  if not exists (select 1 from settings where id = 1 and betting_open = false) then
    raise exception
      'lock-betting: settings row (id=1) missing or betting_open is not false; betting is NOT locked';
  end if;
end $$;

commit;

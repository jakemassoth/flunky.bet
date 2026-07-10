# flunky.bet — Product & Technical Spec (v0)

A paper-trading (no real money) betting app for a one-day **7-team single
round-robin flunky ball tournament** between me and my friends. It's a joke app:
low polish, ~20–30 accounts, and the whole event happens in a single day.

This document is the finalized spec. Part 1 is the product in plain language.
Part 2 is how to build it on **Vue 3 + Supabase**.

---

## Part 1 — Product spec

### 1.1 The tournament

- **7 teams**, **single round-robin**: every team plays every other team once
  = `C(7,2)` = **21 matches**, all played in one day.
- **No draws** — every match has exactly one winning team.
- The **overall tournament winner** is the team with the **most matches won**.
  Ties are possible and expected (7 teams, 6 games each) — see settlement.

### 1.2 Users, accounts, credits

- **Sign up with email + password.** **No email confirmation** and **no magic
  links** — signup is instant and sends no email at all. (Rationale: everyone
  registers within the same hour tomorrow; depending on Supabase email delivery
  would be a needless single point of failure.)
- A **display name** is collected at signup and used everywhere a person is shown
  (leaderboard, etc.).
- Every new account is granted **200 flunky credits** (paper currency).
- **No top-ups.** 200 is your entire bankroll for the day. You can bet down to
  **0**, at which point you're out (you can watch, but can't place bets). This is
  intentional — it makes the 200 mean something and keeps the leaderboard honest.

### 1.3 Markets — what you can bet on

There are **22 markets**:

1. **21 match markets** — one per match. A 2-way market: pick which of the two
   teams wins that match.
2. **1 tournament-winner market** — pick which of the 7 teams wins the most
   matches overall.

### 1.4 Odds & payouts — parimutuel (pool-based)

There are **no authored/fixed odds**. Each market is a **parimutuel pool**:

- Everyone's stakes on a market go into a shared pool.
- **House cut (rake) = 0%.** The entire pool is redistributed.
- When the market settles, **the winning side splits the whole pool in
  proportion to stake**:

  ```
  your_payout = floor( your_stake / total_winning_stake × total_market_pool )
  ```

- **Losing stakes are forfeit.** If your side loses, your stake is gone (it was
  part of the pool paid out to the winners).
- **Credits are whole integers.** Payouts are **floored** to whole credits; the
  tiny rounding remainder is burned (never redistributed). This is consistent
  with the burn rule below and avoids fractional-credit ugliness.

**Nice properties of this model (0% rake):** a winning bettor can never *lose*
money — worst case (everyone backed the same winner) you simply get your own
stake back. Winners always net ≥ 0.

**Burn rule — nobody backed the winner.** If, for a settled market, **no bet was
placed on the actual winning outcome**, there are no winners to pay, so the pool
is **not paid out — it's simply burned**. (This also uniformly covers zero-bet
markets and one-sided markets where only the losing side was backed.) There is
**no refund path** to build: settlement is just "if you picked the winner, you
collect a share; otherwise nothing."

> Consequence: credits slowly leave the economy over the day (it's deflationary).
> That's fine for a one-day joke and makes the leaderboard a pure test of betting
> skill.

**Tournament-winner ties.** The winner is computed purely from the 21 match
results (see 1.7). If **N teams tie for the most wins**, then **every bettor who
backed any of the tied teams wins**, and they split the pool proportionally:

```
total_winning_stake = Σ stake over all bets on ANY team tied for most wins
```

No admin judgment, no separate tiebreak input — it's fully derived.

### 1.5 Placing bets

- **One bet per market per user.** You pick **one side** and a **whole-credit
  stake** (min **1**, max = your **current available balance**). No hedging
  (you can't back both teams in a match).
- While betting is **open**, you can **freely edit** (change side/stake) or
  **cancel** your bet; a cancelled/reduced bet returns credits to your balance
  immediately.
- Once betting **locks**, all bets are **final** — no edits, no cancels.

### 1.6 Betting window & the global lock

- All 22 markets open together during a single **betting window**.
- There is **one global lock**. At tournament kickoff, the admin (me) flips a
  single switch that **freezes all betting at once**. There is no per-match
  timing and no live in-play betting.
- Because everything locks at the same instant, the tournament-winner market has
  no information-advantage problem (nobody can bet it after seeing results).
- **During the open window, everyone can see live pool information**: for each
  market, the **total staked on each outcome** and the resulting **implied odds
  / payout**, updating as bets come in. Individual bets are **private** (you only
  see aggregate pools, never who bet what).

> Implied odds are only an *estimate* of your payout — the pool keeps moving until
> lock, and your own stake changes the pool. The UI should present them as
> "~X.Xx", not a promise.

### 1.7 Settlement — one reveal at the end

- **The entire settlement is a pure function of the 21 match results.** The only
  input is "who won each match." From that, everything derives: match-market
  payouts, the standings, the tournament-winner market, and the leaderboard.
- **One reveal at the end:** after the tournament, the admin submits all 21
  results **once**, and everything settles in a single pass.
- Settlement is **idempotent and re-runnable**: it recomputes from scratch every
  time. Fix a typo in the results, run it again, and all balances recompute
  correctly. There is no partial/incremental state to corrupt.
- **Admin = me, operating via the Supabase SQL editor** (service role). There is
  **no in-app admin UI** and **no admin user flag** — the ability to lock betting
  and to settle is simply the ability to run privileged SQL, which only I have.

### 1.8 Leaderboard

- Ranks users by **final total credits, descending** (equivalently: net profit
  vs. the starting 200 — same ordering).
- **Hidden until settlement.** Before settling, a player sees only their **own**
  balance; the full ranked leaderboard **unlocks the moment settlement runs**.
  This preserves the "one big reveal" at the end.

### 1.9 Explicitly out of scope for v0

Real money or payments; email verification / password reset flows; per-match or
timed locking; live in-play betting; top-ups or credit grants; an in-app admin
console; hedging / multiple bets per market; cash-out of a bet after lock; heavy
styling. All deliberately cut to be buildable in an evening.

---

## Part 2 — Technical spec (Vue 3 + Supabase)

Stack is fixed and already scaffolded: **Vue 3 (`<script setup>`) + Vite + TS +
Pinia + Vue Router**, `@supabase/supabase-js` client wired up in
`src/lib/supabase.ts` (anon key only, client-side), Supabase CLI initialized
(`supabase/config.toml`). No tables, migrations, functions, auth UI, or domain
code exist yet — this is greenfield.

### 2.1 Security model (the spine)

- **Client only ever holds the anon key.** Never ship the service-role key.
- **RLS is on for every table, default-deny.** Clients can only do what a policy
  explicitly allows.
- **All money-affecting invariants are enforced server-side**, not in the Vue
  app:
  - *Betting lock* and *sufficient balance* and *valid pick* are enforced by a
    database **trigger** on `bets` (a client cannot bypass it).
  - *Settlement* runs in a single privileged **`SECURITY DEFINER` function**
    whose `EXECUTE` is **revoked from `anon` and `authenticated`** — only the
    service role (me, in the SQL editor) can call it.
  - *Pool totals* and the *leaderboard* are exposed through
    `SECURITY DEFINER` functions that return **only aggregates / gated data**, so
    RLS on `bets` can stay "owner-only" without hiding the pools.

### 2.2 Data model

All IDs are `uuid` (`gen_random_uuid()`), all timestamps `timestamptz`.

#### `settings` — single-row global config

| column            | type      | notes                                        |
| ----------------- | --------- | -------------------------------------------- |
| `id`              | int PK    | always `1` (`check (id = 1)`)                |
| `betting_open`    | boolean   | default `true`; flip to `false` at kickoff   |
| `starting_credits`| int       | default `200`                                |
| `settled_at`      | timestamptz null | set by `settle_tournament` when done  |

#### `profiles` — one per auth user

| column         | type          | notes                                   |
| -------------- | ------------- | --------------------------------------- |
| `id`           | uuid PK       | references `auth.users(id)` on delete cascade |
| `display_name` | text not null | shown on the leaderboard                |
| `created_at`   | timestamptz   | default `now()`                         |

Created automatically by a trigger on `auth.users` (see 2.4), reading
`display_name` from signup metadata.

#### `teams` — 7 rows, seeded

| column       | type          | notes                              |
| ------------ | ------------- | ---------------------------------- |
| `id`         | uuid PK       |                                    |
| `slug`       | text unique   | short code, e.g. `lions` (used in results JSON) |
| `name`       | text not null | display name (placeholder in seed) |

#### `matches` — 21 rows, seeded (all unordered pairs)

| column           | type      | notes                                             |
| ---------------- | --------- | ------------------------------------------------- |
| `id`             | uuid PK   |                                                   |
| `slug`           | text unique | e.g. `lions-vs-tigers` (used in results JSON)    |
| `team_a_id`      | uuid      | references `teams` (`a`/`b` are just slots, no home advantage) |
| `team_b_id`      | uuid      | references `teams`                                |
| `match_order`    | int       | display order 1..21                               |
| `winner_team_id` | uuid null | references `teams`; set at settlement; must equal `team_a_id` or `team_b_id` |
| | | `check (team_a_id <> team_b_id)` |

#### `bets`

| column        | type        | notes                                                       |
| ------------- | ----------- | ----------------------------------------------------------- |
| `id`          | uuid PK     |                                                             |
| `user_id`     | uuid        | not null, default `auth.uid()`, references `auth.users`     |
| `market_type` | text        | `check in ('match','tournament_winner')`                    |
| `match_id`    | uuid null   | references `matches`; **not null iff** `market_type='match'`|
| `team_id`     | uuid        | not null, references `teams` — the picked team              |
| `stake`       | int         | `check (stake >= 1)`                                        |
| `payout`      | int         | not null default `0`; set at settlement (0 if unsettled/lost)|
| `settled`     | boolean     | not null default `false`                                    |
| `market_key`  | text        | **generated**: `match_id::text` for match bets, else `'TOURNAMENT_WINNER'` |
| `created_at` / `updated_at` | timestamptz | |
| | | `unique (user_id, market_key)` → one bet per market per user |
| | | `check ((market_type='match') = (match_id is not null))`    |

Pick validity (match bets: `team_id ∈ {team_a, team_b}`; winner bets: any team)
is cross-row, so it's enforced by the trigger, not a `CHECK`.

#### Derived balance (never stored)

```
available_balance(user) = settings.starting_credits
                          − Σ(stake  over the user's bets)
                          + Σ(payout over the user's bets)
```

Pre-settlement, `payout` is 0 for everyone, so balance = `200 − Σ stakes`. The
invariant the trigger maintains is simply **`Σ stakes ≤ starting_credits`** while
betting is open.

### 2.3 Row-Level Security

Enable RLS on all five tables. Summary:

| table      | select                                   | insert / update / delete                         |
| ---------- | ---------------------------------------- | ------------------------------------------------ |
| `settings` | `authenticated` (read `betting_open`, `starting_credits`, `settled_at`) | none (service role only) |
| `teams`    | `authenticated` (public within app)      | none (seeded)                                    |
| `matches`  | `authenticated` (public within app)      | none (seeded / settled by function)              |
| `profiles` | **own row only** (`id = auth.uid()`)     | update own (rename); insert via trigger; no delete |
| `bets`     | **own rows only** (`user_id = auth.uid()`) | insert/update/delete own — **gated by trigger** (see 2.4) |

Pools and the leaderboard are intentionally **not** exposed via table SELECT;
they come from the functions in 2.5 so that `bets` stays owner-only.

Example policies:

```sql
alter table bets enable row level security;

create policy "bets_select_own" on bets
  for select using (user_id = auth.uid());
create policy "bets_insert_own" on bets
  for insert with check (user_id = auth.uid());
create policy "bets_update_own" on bets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bets_delete_own" on bets
  for delete using (user_id = auth.uid());
```

### 2.4 Triggers

**Auto-create profile on signup** (`display_name` comes from signup metadata):

```sql
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''),
             split_part(new.email,'@',1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

**Enforce lock + balance + valid pick on `bets`** (BEFORE INSERT/UPDATE/DELETE):

```sql
create function enforce_bet_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg          settings%rowtype;
  other_stakes int;
  m            matches%rowtype;
begin
  select * into cfg from settings where id = 1;
  if not cfg.betting_open then
    raise exception 'Betting is closed';
  end if;

  if tg_op = 'DELETE' then
    return old;  -- allowed only because betting is open (checked above)
  end if;

  -- valid pick
  if new.market_type = 'match' then
    select * into m from matches where id = new.match_id;
    if new.team_id not in (m.team_a_id, m.team_b_id) then
      raise exception 'Team is not in this match';
    end if;
  end if;

  -- balance: sum the user's OTHER bets (exclude the row being updated)
  select coalesce(sum(stake),0) into other_stakes
    from bets
   where user_id = new.user_id
     and id is distinct from new.id;

  if other_stakes + new.stake > cfg.starting_credits then
    raise exception 'Insufficient balance';
  end if;

  return new;
end $$;

create trigger bets_enforce
  before insert or update or delete on bets
  for each row execute function enforce_bet_rules();
```

> Concurrency note: at 20–30 users the risk of two concurrent inserts both
> passing the balance check is negligible; not worth a heavier lock for a
> one-day joke. Documented, accepted.

### 2.5 Read functions (aggregate / gated)

**`get_market_pools()`** — pool totals per outcome, safe to expose to everyone
because it returns only aggregates:

```sql
create function get_market_pools()
returns table (market_key text, market_type text, match_id uuid,
               team_id uuid, total_stake bigint, bet_count bigint)
language sql security definer set search_path = public as $$
  select market_key, market_type, match_id, team_id,
         sum(stake)::bigint, count(*)::bigint
  from bets
  group by market_key, market_type, match_id, team_id
$$;
revoke all on function get_market_pools() from public;
grant execute on function get_market_pools() to authenticated;
```

Frontend derives implied odds per outcome as
`market_total / outcome_stake` (show `—` when `outcome_stake = 0`).

**`get_leaderboard()`** — gated on `settled_at`; returns nothing until settlement:

```sql
create function get_leaderboard()
returns table (display_name text, credits int, rank bigint)
language plpgsql security definer set search_path = public as $$
begin
  if (select settled_at from settings where id=1) is null then
    return;  -- leaderboard hidden until settled
  end if;
  return query
    select p.display_name,
           (s.starting_credits
             - coalesce(sum(b.stake),0)
             + coalesce(sum(b.payout),0))::int as credits,
           rank() over (order by (s.starting_credits
             - coalesce(sum(b.stake),0)
             + coalesce(sum(b.payout),0)) desc)
    from profiles p
    cross join settings s
    left join bets b on b.user_id = p.id
    group by p.id, p.display_name, s.starting_credits
    order by credits desc;
end $$;
revoke all on function get_leaderboard() from public;
grant execute on function get_leaderboard() to authenticated;
```

(Own balance can be computed client-side from the user's own bets + `settings`;
a small `get_my_balance()` convenience function may be added if handy.)

### 2.6 Settlement — `settle_tournament(results jsonb)`

`SECURITY DEFINER`, **`EXECUTE` revoked from `anon`/`authenticated`** so only the
service role (SQL editor) can run it. Runs the whole thing in one transaction and
**recomputes from scratch** (idempotent).

**Results JSON schema** — human-authorable, keyed by the seeded slugs so I can
write it by hand:

```json
{
  "matches": [
    { "match": "lions-vs-tigers",  "winner": "lions" },
    { "match": "lions-vs-eagles",  "winner": "eagles" },
    { "match": "tigers-vs-eagles", "winner": "tigers" }
    // … all 21 entries, one per match slug …
  ]
}
```

- `match` = `matches.slug`; `winner` = `teams.slug` and **must be one of the two
  teams in that match** (validated — bad input aborts the whole transaction).
- Missing/extra/duplicate match slugs are rejected. All 21 required for the
  tournament-winner market to settle.

**Algorithm (one transaction):**

1. **Reset** for idempotency: `matches.winner_team_id = null`;
   `bets.payout = 0, bets.settled = false`; `settings.settled_at = null`.
2. **Apply results**: for each entry, resolve slugs → ids, validate the winner is
   in the match, set `matches.winner_team_id`.
3. **Settle each match market** (for every match now having a winner):
   - `P` = Σ stake of match bets on that match.
   - `W` = Σ stake of those bets whose `team_id = winner`.
   - If `W = 0`: burn (no payouts). Else each winning bet
     `payout = floor(stake::numeric / W * P)`.
   - Mark all that match's bets `settled = true`.
4. **Settle the tournament-winner market** (only if all 21 matches have winners):
   - Compute wins per team; `maxWins = max`; `winners = {teams with maxWins}`.
   - `P` = Σ stake of winner-market bets.
   - `W` = Σ stake of winner-market bets whose `team_id ∈ winners`.
   - If `W = 0`: burn. Else `payout = floor(stake::numeric / W * P)` for bets on
     any winning team. Mark all winner-market bets `settled = true`.
5. `settings.settled_at = now()` (all 21 present ⇒ fully settled).
6. Return a summary `jsonb` (matches applied, total staked, total paid, burned,
   per-market breakdown) for a sanity check.

### 2.7 Admin runbook (SQL editor, service role)

No UI — these are the only two operations:

```sql
-- 1) Kickoff: freeze all betting
update settings set betting_open = false where id = 1;

-- 2) After the tournament: settle everything (re-runnable)
select settle_tournament('{ "matches": [ ... 21 entries ... ] }'::jsonb);

-- Oops, need to fix a result? Just edit the JSON and run (2) again.
-- Need to reopen betting? update settings set betting_open=true, settled_at=null where id=1;
```

### 2.8 Frontend (Vue + Pinia + Router)

Routes (unauthenticated → redirected to `/login` by a router guard):

- `/login`, `/signup` — email + password. Signup passes `display_name` via
  `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`.
- `/` **Markets** — lists the 21 match markets + the tournament-winner market.
  For each outcome: live pool total + implied odds (from `get_market_pools()`,
  refetched on an interval and after any bet action). Bet form (pick side +
  stake); place / edit / cancel while `betting_open`; shows the user's own
  balance and their own bets. All controls disabled once `betting_open` is false.
- `/leaderboard` — calls `get_leaderboard()`; shows "results not in yet" until it
  returns rows, then the ranking.

Pinia stores:

- `useAuthStore` — session, current user, profile, sign-in/up/out.
- `useMarketsStore` — teams, matches, `settings`, pools; derives implied odds.
- `useBetsStore` — the user's own bets; place/edit/cancel actions + derived
  available balance.

Realtime is optional; **polling `get_market_pools()` every few seconds** is the
simplest way to keep pools live and is plenty for this scale.

### 2.9 Migrations & seed

Use Supabase CLI migrations under `supabase/migrations/`:

1. `0001_init.sql` — tables, constraints, generated `market_key`, RLS enable +
   policies, triggers (`handle_new_user`, `enforce_bet_rules`), functions
   (`get_market_pools`, `get_leaderboard`, `settle_tournament`) with the correct
   `grant`/`revoke`.
2. `0002_seed.sql` — insert the single `settings` row; 7 `teams` (placeholder
   names + slugs); all 21 `matches` (every unordered pair, `match_order` 1..21,
   slugs `a-vs-b`). **Swap in real team names before launch.**

### 2.10 Build plan / milestones (target: buildable in an evening)

- **M1 — Database.** Write and apply `0001`/`0002` against local Supabase
  (`supabase start`). Manually verify RLS (a normal user can't read others' bets,
  can't write when `betting_open=false`, can't overspend).
- **M2 — Auth.** Signup (email + password + display name), login, logout, session
  persistence, router guard. Confirm the profile row is auto-created with the
  display name.
- **M3 — Betting UI.** Markets list with live pools/implied odds; place/edit/
  cancel bet; own-balance display; everything disables on lock.
- **M4 — Leaderboard.** Gated view driven by `get_leaderboard()`.
- **M5 — Settlement dry run.** With seeded data + some test bets locally, run
  `settle_tournament` with sample JSON. Verify: floored parimutuel payouts, the
  **burn** case (nobody backed the winner), the **tie-split** winner case, and
  **idempotency** (run twice → identical balances).
- **M6 — Deploy.** Create the cloud Supabase project, push migrations, set real
  team names, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, deploy the
  static Vue build (e.g. Vercel/Netlify). Smoke-test signup → bet → lock →
  settle → leaderboard.

### 2.11 Risk notes

- **Timeline is tomorrow** — cut anything not in M1–M4 for launch; M5 is the one
  step not to skip (settlement correctness is the whole point).
- **No email dependency** by design (no confirmation / magic links), so nothing
  can be rate-limited or bounce.
- **Correctness lives in the DB** (trigger + `settle_tournament`), so the Vue app
  can stay thin and unpolished without compromising the money logic.

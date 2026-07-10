-- flunky.bet v0 — schema, RLS, triggers, and functions.
-- See docs/SPEC.md part 2. Money-affecting invariants live here, not in the client.

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------

-- Single-row global config.
create table settings (
  id               int primary key check (id = 1),
  betting_open     boolean     not null default true,
  starting_credits int         not null default 200,
  settled_at       timestamptz
);

-- One profile per auth user (created by a trigger on auth.users).
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  created_at   timestamptz not null default now()
);

-- 7 teams, seeded in 0002.
create table teams (
  id   uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text        not null
);

-- 21 matches (every unordered pair), seeded in 0002.
create table matches (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  team_a_id      uuid not null references teams (id),
  team_b_id      uuid not null references teams (id),
  match_order    int  not null,
  winner_team_id uuid references teams (id),
  check (team_a_id <> team_b_id)
);

-- One bet per market per user.
create table bets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  market_type text not null check (market_type in ('match', 'tournament_winner')),
  match_id    uuid references matches (id),
  team_id     uuid not null references teams (id),
  stake       int  not null check (stake >= 1),
  payout      int  not null default 0,
  settled     boolean not null default false,
  market_key  text generated always as (
    case when market_type = 'match' then match_id::text else 'TOURNAMENT_WINNER' end
  ) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, market_key),
  check ((market_type = 'match') = (match_id is not null))
);

-------------------------------------------------------------------------------
-- Row-Level Security
-------------------------------------------------------------------------------

alter table settings enable row level security;
alter table profiles enable row level security;
alter table teams    enable row level security;
alter table matches  enable row level security;
alter table bets     enable row level security;

-- settings / teams / matches: readable by any signed-in user, no writes.
create policy "settings_select" on settings for select to authenticated using (true);
create policy "teams_select"    on teams    for select to authenticated using (true);
create policy "matches_select"  on matches  for select to authenticated using (true);

-- profiles: own row only (insert happens via the security-definer signup trigger).
create policy "profiles_select_own" on profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- bets: own rows only; writes additionally gated by the enforce trigger below.
create policy "bets_select_own" on bets
  for select to authenticated using (user_id = auth.uid());
create policy "bets_insert_own" on bets
  for insert to authenticated with check (user_id = auth.uid());
create policy "bets_update_own" on bets
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bets_delete_own" on bets
  for delete to authenticated using (user_id = auth.uid());

-- Table privileges for the Data API roles. RLS (above) still restricts which
-- rows; these grants are required because new tables are not auto-exposed under
-- the current Supabase default. Profile inserts happen via the definer trigger,
-- so authenticated only needs select/update there.
grant select on settings to authenticated;
grant select on teams    to authenticated;
grant select on matches  to authenticated;
grant select, update on profiles to authenticated;
grant select, insert, update, delete on bets to authenticated;

-------------------------------------------------------------------------------
-- Triggers
-------------------------------------------------------------------------------

-- Auto-create a profile row on signup, reading display_name from signup metadata.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''),
             split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep updated_at fresh on edits.
create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger bets_touch_updated_at
  before update on bets
  for each row execute function touch_updated_at();

-- Enforce the global lock + sufficient balance + a valid pick on every bet write.
-- settle_tournament sets flunky.settling='on' so its own payout writes bypass this.
create function enforce_bet_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg          settings%rowtype;
  other_stakes int;
  m            matches%rowtype;
begin
  if coalesce(current_setting('flunky.settling', true), 'off') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into cfg from settings where id = 1;
  if not cfg.betting_open then
    raise exception 'Betting is closed';
  end if;

  if tg_op = 'DELETE' then
    return old;  -- allowed only because betting is open (checked above)
  end if;

  -- valid pick (match bets must pick one of the two teams in the match)
  if new.market_type = 'match' then
    select * into m from matches where id = new.match_id;
    if new.team_id not in (m.team_a_id, m.team_b_id) then
      raise exception 'Team is not in this match';
    end if;
  end if;

  -- balance: sum the user's OTHER bets (exclude the row being updated)
  select coalesce(sum(stake), 0) into other_stakes
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

-------------------------------------------------------------------------------
-- Read functions (aggregate / gated)
-------------------------------------------------------------------------------

-- Pool totals per outcome. Only aggregates, so safe to expose to everyone.
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

-- Leaderboard, gated on settled_at: returns nothing until settlement runs.
create function get_leaderboard()
returns table (display_name text, credits int, rank bigint)
language plpgsql security definer set search_path = public as $$
begin
  if (select settled_at from settings where id = 1) is null then
    return;  -- hidden until settled
  end if;
  return query
    select p.display_name,
           (s.starting_credits
             - coalesce(sum(b.stake), 0)
             + coalesce(sum(b.payout), 0))::int as credits,
           rank() over (order by (s.starting_credits
             - coalesce(sum(b.stake), 0)
             + coalesce(sum(b.payout), 0)) desc)
    from profiles p
    cross join settings s
    left join bets b on b.user_id = p.id
    group by p.id, p.display_name, s.starting_credits
    order by credits desc;
end $$;
revoke all on function get_leaderboard() from public;
grant execute on function get_leaderboard() to authenticated;

-------------------------------------------------------------------------------
-- Settlement — pure function of the 21 match results. Idempotent / re-runnable.
-- SECURITY DEFINER, execute revoked from anon/authenticated (service role only).
-------------------------------------------------------------------------------

create function settle_tournament(results jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  entry         jsonb;
  v_match_slug  text;
  v_winner_slug text;
  m             matches%rowtype;
  v_winner_id   uuid;
  n_applied     int;
  p             bigint;
  w             bigint;
  v_winner_teams uuid[];
  v_summary     jsonb;
begin
  -- Let our own writes below bypass enforce_bet_rules (betting is closed now).
  perform set_config('flunky.settling', 'on', true);

  if results ? 'matches' = false or jsonb_typeof(results->'matches') <> 'array' then
    raise exception 'results.matches must be a JSON array';
  end if;

  -- 1) Reset for idempotency.
  update matches set winner_team_id = null;
  update bets set payout = 0, settled = false;
  update settings set settled_at = null where id = 1;

  -- 2) Apply results: resolve slugs, validate, set winners.
  for entry in select * from jsonb_array_elements(results->'matches')
  loop
    v_match_slug  := entry->>'match';
    v_winner_slug := entry->>'winner';

    select * into m from matches where slug = v_match_slug;
    if not found then
      raise exception 'Unknown match slug: %', v_match_slug;
    end if;
    if m.winner_team_id is not null then
      raise exception 'Duplicate match slug: %', v_match_slug;
    end if;

    select id into v_winner_id from teams where slug = v_winner_slug;
    if v_winner_id is null then
      raise exception 'Unknown team slug: %', v_winner_slug;
    end if;
    if v_winner_id not in (m.team_a_id, m.team_b_id) then
      raise exception 'Winner % is not in match %', v_winner_slug, v_match_slug;
    end if;

    update matches set winner_team_id = v_winner_id where id = m.id;
  end loop;

  select count(*) into n_applied from matches where winner_team_id is not null;
  if n_applied <> 21 then
    raise exception 'Expected all 21 match results, got % applied', n_applied;
  end if;

  -- 3) Settle each match market.
  for m in select * from matches
  loop
    select coalesce(sum(stake), 0) into p
      from bets where market_type = 'match' and match_id = m.id;
    select coalesce(sum(stake), 0) into w
      from bets where market_type = 'match' and match_id = m.id
                  and team_id = m.winner_team_id;
    if w > 0 then
      update bets set payout = floor(stake::numeric / w * p)
        where market_type = 'match' and match_id = m.id
          and team_id = m.winner_team_id;
    end if;
    update bets set settled = true where market_type = 'match' and match_id = m.id;
  end loop;

  -- 4) Settle the tournament-winner market (all 21 applied ⇒ winner is derivable).
  --    Ties: everyone who backed any team tied for the most wins splits the pool.
  with wins as (
    select winner_team_id as team_id, count(*) as n
    from matches
    group by winner_team_id
  )
  select array_agg(team_id) into v_winner_teams
  from wins
  where n = (select max(n) from wins);

  select coalesce(sum(stake), 0) into p
    from bets where market_type = 'tournament_winner';
  select coalesce(sum(stake), 0) into w
    from bets where market_type = 'tournament_winner' and team_id = any(v_winner_teams);
  if w > 0 then
    update bets set payout = floor(stake::numeric / w * p)
      where market_type = 'tournament_winner' and team_id = any(v_winner_teams);
  end if;
  update bets set settled = true where market_type = 'tournament_winner';

  -- 5) Mark settled.
  update settings set settled_at = now() where id = 1;

  -- 6) Return a summary for a sanity check.
  select jsonb_build_object(
    'matches_applied', n_applied,
    'winner_teams', (select coalesce(jsonb_agg(slug order by slug), '[]'::jsonb)
                     from teams where id = any(v_winner_teams)),
    'total_staked', coalesce(sum(stake), 0),
    'total_paid',   coalesce(sum(payout), 0),
    'burned',       coalesce(sum(stake), 0) - coalesce(sum(payout), 0),
    'by_market', (
      select coalesce(jsonb_agg(jsonb_build_object(
                'market_key', market_key, 'pool', pool, 'paid', paid) order by market_key), '[]'::jsonb)
      from (
        select market_key, sum(stake) as pool, sum(payout) as paid
        from bets group by market_key
      ) t
    )
  ) into v_summary
  from bets;

  return v_summary;
end $$;

revoke all on function settle_tournament(jsonb) from public;
-- (execute is NOT granted to anon/authenticated: service role only.)

-- LIGO / Feira de Ciências — ranking e sessões autenticadas
-- Executar exclusivamente no projeto Supabase dedicado.
create extension if not exists pgcrypto;
create table if not exists public.players (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null,
 nickname_key text generated always as (lower(btrim(nickname))) stored unique,
 created_at timestamptz not null default now(),
 constraint nickname_valid check (char_length(btrim(nickname)) between 3 and 18 and nickname ~ '^[[:alnum:] ]+$')
);
create table if not exists public.game_runs (
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.players(id) on delete cascade,
 started_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 duration_ms bigint,
 stage int not null default 1 check (stage between 1 and 6),
 status text not null default 'playing' check (status in ('playing','completed','abandoned')),
 challenge_version text not null default 'mirror-random-v1',
 constraint valid_completed check (status <> 'completed' or (completed_at is not null and duration_ms > 0 and stage = 6))
);
create table if not exists public.stage_challenges (
 run_id uuid not null references public.game_runs(id) on delete cascade,
 stage int not null check (stage between 1 and 5),
 puzzle jsonb not null,
 solution jsonb not null,
 completed_at timestamptz,
 primary key(run_id,stage)
);
create index if not exists game_runs_rank_idx on public.game_runs (duration_ms,completed_at) where status='completed';
create index if not exists game_runs_player_idx on public.game_runs(player_id,started_at desc);
alter table public.players enable row level security;
alter table public.game_runs enable row level security;
alter table public.stage_challenges enable row level security;
revoke all on public.players,public.game_runs,public.stage_challenges from anon,authenticated;
grant select on public.players to anon,authenticated;
grant select on public.game_runs to authenticated;
create policy "players read public nicknames" on public.players for select to anon,authenticated using (true);
create policy "player reads own runs" on public.game_runs for select to authenticated using (player_id = (select auth.uid()));
-- All writes and challenge secret reads live in the backend only; no INSERT/UPDATE grants.
create or replace view public.global_ranking with (security_invoker=true) as
 select p.id as player_id,p.nickname, min(r.duration_ms) as best_ms,
 min(r.completed_at) filter(where r.duration_ms=(select min(rr.duration_ms) from public.game_runs rr where rr.player_id=p.id and rr.status='completed')) as record_at
 from public.players p join public.game_runs r on r.player_id=p.id
 where r.status='completed'
 group by p.id,p.nickname;
-- Ranking public is obtained via a dedicated Edge Function with service credentials.
revoke all on public.global_ranking from public,anon,authenticated;
comment on table public.stage_challenges is 'Do not expose solution via API, SQL grants or views';

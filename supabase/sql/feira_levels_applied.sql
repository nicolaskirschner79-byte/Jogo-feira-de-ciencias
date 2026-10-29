-- Registro da alteração aplicada no Supabase pelo MCP em 2026-10-29.
-- Histórico/espelho do schema: não reaplique sem verificar o estado do banco.
-- Migração Supabase: feira_tres_dificuldades_nome_completo.

alter table public.players drop constraint players_nickname_check;
alter table public.players
  add constraint players_full_name_check
  check (
    char_length(btrim(nickname)) between 5 and 80
    and btrim(nickname) like '% %'
    and length(split_part(btrim(nickname), ' ', 1)) >= 2
    and btrim(nickname) ~ '^[[:alpha:]][[:alpha:] ''-]*[[:alpha:]]$'
  ) not valid;
alter table public.players drop constraint players_nickname_key_key;
create index if not exists players_nickname_key_lookup_idx on public.players(nickname_key);
alter table public.game_runs
  add column difficulty text not null default 'legado'
  check(difficulty in ('facil','medio','dificil','legado'));
create index if not exists game_runs_difficulty_time on public.game_runs(difficulty,duration_ms)
  where status='completed';
create or replace view public.global_ranking with (security_invoker=true) as
with records as (
  select distinct on (player_id,difficulty)
    player_id,difficulty,duration_ms as best_ms,completed_at as record_at
  from public.game_runs
  where status='completed' and difficulty in ('facil','medio','dificil')
  order by player_id,difficulty,duration_ms,completed_at,id
)
select
  row_number() over(partition by r.difficulty order by r.best_ms,r.record_at,r.player_id)::bigint as position,
  p.id as player_id,p.nickname,r.best_ms,r.record_at,r.difficulty
from records r join public.players p on p.id=r.player_id;
revoke all on public.global_ranking from public,anon,authenticated;

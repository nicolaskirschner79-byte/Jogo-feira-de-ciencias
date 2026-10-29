# LIGO — Feira de Ciências

Este repositório contém o jogo em `index.html`. O backend online está preparado em `supabase/migrations/001_ranking.sql` e precisa de um projeto Supabase disponível para deploy.

## Status real

- Jogo v4 enviado ao GitHub com circuitos gerados por partida.
- Banco Supabase novo **não criado**: limite gratuito da conta atingido (dois projetos ativos).
- Ranking online **não está conectado nem testado**. Nenhum tempo local deve aparecer como resultado global.
- Não reutilize o Supabase de outra aplicação sem aprovação explícita.

## Para ativar

1. Liberar uma vaga no plano gratuito ou ampliar o limite de projetos.
2. Criar um Supabase dedicado; habilitar autenticação anônima e medidas de antiabuso/CAPTCHA.
3. Aplicar migração, publicar Edge Functions autenticadas para criar jogador, iniciar partida, gerar desafios no servidor, validar cada solução e finalizar tempo.
4. Configurar domínio e chave **publishable** no cliente. Nunca compartilhar chave secreta.
5. Validar RLS, pulo de etapas, concorrência, rate limits, rank e testes mobile com múltiplos navegadores.

## Integridade do ranking

Tempos do navegador não são confiáveis. O servidor precisa registrar `started_at`, validar cada puzzle e computar `duration_ms` em transação antes de incluir a partida na classificação. Como fases aleatórias variam de dificuldade, comparar apenas tempos no mesmo ranking é imperfeito: recomenda-se ranking competitivo de percurso fixo ou score normalizado para o modo aleatório.

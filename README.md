# LIGO — O Desafio dos Lasers

Jogo educativo com cinco circuitos de reflexão por partida, com posições geradas de forma variável.

## Modo feira de ciências (dispositivo compartilhado)
- Toda vez que alguém clica em **Jogar** ou **Próximo jogador**, a tela solicita um nome, inclusive quando outra pessoa já jogou no mesmo navegador.
- Cada nome recebe sua própria credencial aleatória local, separando partidas e recordes no Supabase.
- Se um participante já jogou **no mesmo navegador**, digitar o mesmo nome recupera o perfil e o melhor tempo, mas inicia uma nova tentativa.
- Nomes já cadastrados em **outro navegador** não podem ser recuperados apenas digitando o apelido, para evitar que outra pessoa se passe pelo participante; nesse caso, será necessário escolher outro apelido.
- A identificação não é restaurada automaticamente ao abrir a página.
- Os tokens de identidade são armazenados no navegador do dispositivo da feira; usar um perfil de navegador público implica riscos de acesso local e exige cuidado com limpeza de dados após o evento.


## Cadastro e níveis — feira de ciências

**Fluxo:** Iniciar missão → digitar Nome e Sobrenome (campos obrigatórios) → escolher **Fácil**, **Médio** ou **Difícil** → tutorial → cinco circuitos gerados no servidor → resultado com tempo e posição.

| Nível | Espelhos ao longo das cinco fases |
| --- | --- |
| Fácil | 1, 2, 2, 3, 3 |
| Médio | 2, 3, 4, 4, 5 |
| Difícil | 4, 4, 5, 5, 6 |

Os circuitos são gerados no Supabase, com posições variáveis do emissor, receptor e espelhos. A complexidade é progressiva em dois eixos: a quantidade de reflexões obrigatórias e o comprimento dos segmentos entre as curvas (mais curtos no Difícil).

### Controles simplificados

O espelho possui duas posições físicas, `/` e `\\`. Clique ou toque para alterná-las. O código mantém o caminho e a verificação da reflexão compatíveis com a API.

O ranking salva o melhor tempo **por jogador e por dificuldade**. A aba Ranking permite alternar entre os três níveis e consulta os dados automaticamente.

O cadastro exige dois campos separados: Nome (2 a 35 caracteres) e Sobrenome (2 a 45 caracteres). Não aceita cadastrar um jogador novo com somente um nome. Os registros anteriores continuam armazenados como `legado` e não são comparados aos novos modos. Pessoas com o mesmo nome completo em navegadores diferentes podem ter identidades diferentes; no mesmo navegador o perfil é reaproveitado pelo nome completo digitado.

**Privacidade:** o nome completo é publicado no ranking. Como a feira pode receber menores de idade, obtenha consentimento adequado dos responsáveis ou considere mudar para a exibição de nome e inicial do sobrenome antes de divulgar o endereço do jogo.

**Estado da verificação:** o gerador foi validado com 900 circuitos nos três níveis, e 600 circuitos adicionais passaram nos testes cruzados com a lógica de ângulos da interface, incluindo reflexões equivalentes, bloqueio de 45° e retorno 315°→0°. O JavaScript da interface passou na verificação de sintaxe. O deploy `ligo-api` está na versão 5. Testes HTTP reais com múltiplos visitantes ainda não foram concluídos neste ambiente.

## Modo leve — retorno aos dois sentidos (29/10/2026)

- Espelhos voltaram às duas diagonais: **/** e **\\**. Um clique/toque no espelho ou no botão alterna a orientação.
- A lógica de colisão e o validador do Supabase usam estados booleanos. A API da função `ligo-api`, versão 5, gera desafios novos com espelhos binários; desafios antigos com ângulos numéricos são convertidos ao carregar.
- A complexidade dos níveis continua por quantidade de espelhos: Fácil 1/2/2/3/3, Médio 2/3/4/4/5 e Difícil 4/4/5/5/6, com distâncias diferentes entre reflexões.
- A interface **não redesenha o tabuleiro continuamente**: desenha uma vez quando a fase abre e anima por aproximadamente 220 ms após cada giro; em seguida, para de requisitar quadros.
- Efeitos ambientais de fundo foram ocultados durante a partida, preservando o visual do menu e dos rankings.
- Cadastro com nome e sobrenome, partidas separadas por visitante e rankings por dificuldade foram mantidos.
- Teste simulado: 15 combinações (5 fases × 3 dificuldades), com laser e espelhos carregados, botões funcionais e **nenhum quadro agendado após a animação**. Também foram testados 600 circuitos gerados no backend. Esses testes não substituem testes visuais em navegadores reais, especialmente celulares usados na feira.

## Conexão Supabase
- Projeto: **LIGO - Feira de Ciencias**
- Project ref: `jgjgmbsgkwdimiinhcbk`
- Região: `sa-east-1`
- Endpoint: `https://jgjgmbsgkwdimiinhcbk.supabase.co/functions/v1/ligo-api`
- Frontend: `index.html`, conectado com a chave **publishable**.
- Backend versionado em `supabase/functions/ligo-api/index.ts`; o deploy da função `ligo-api` está ativo.
- Tabelas presentes no banco: `players`, `game_runs`, `stage_challenges`; view `global_ranking`.
- Consulta de ranking a cada 12 segundos enquanto a tela de classificação estiver aberta.
- O servidor gera os puzzles e salva a solução fora da resposta pública. Somente partidas validadas entram no ranking.

## Avisos importantes
- A migração anterior `supabase/migrations/001_ranking.sql` é um **rascunho anterior**, não corresponde ao banco atual e não deve ser reaplicada. O banco foi configurado diretamente via migration do Supabase `ligo_global_ranking_initial`.
- O serviço aceita um token aleatório por perfil de participante, salvo no mesmo navegador. Limpar os dados do navegador ou usar outro perfil pode impedir a recuperação do registro original; não existe bloqueio infalível por dispositivo.
- Há limite de dez novas partidas por hora por identidade, mas ainda são necessárias proteções adicionais contra automação e cadastros abusivos antes de uma competição pública de grande porte.
- Circuitos aleatórios podem apresentar dificuldades distintas, então tempos isolados podem não ser perfeitamente comparáveis.
- A criação do projeto, schema e publicação da Edge Function foram verificadas com as ferramentas Supabase. **Um teste real de ponta a ponta, via navegador público, ainda precisa ser realizado**; o ambiente de execução não alcançou o endpoint HTTP diretamente.
- Para publicar a interface é necessário habilitar GitHub Pages ou vincular o repositório a uma hospedagem. O GitHub sozinho guarda o código, mas não ativa um domínio de jogo por padrão.

## Segurança
Nunca coloque `service_role` no HTML. O código do navegador usa somente a chave pública, e a Edge Function obtém segredos no ambiente do Supabase.

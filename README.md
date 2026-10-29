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

### Giro completo de 360°

- Clique em um espelho do tabuleiro para girar **+45°**.
- Arraste o espelho com mouse ou toque para girá-lo em qualquer direção ao longo da volta completa, com encaixe em incrementos de 45°.
- Use os botões **↶ −45°** e **↷ +45°** abaixo do tabuleiro para ajustar com precisão.
- O visor de cada espelho mostra a orientação de **0°, 45°, 90°, 135°, 180°, 225°, 270° ou 315°**. Após 315°, o próximo passo retorna a 0° e o sprite gira suavemente até 360°.
- Como a simulação usa trajetos horizontais e verticais, o feixe é refletido nas orientações equivalentes **0°/180°** e **90°/270°**. Orientações intermediárias sem alinhamento **interrompem o feixe** e sinalizam o espelho.
- A animação respeita a opção de movimento reduzido do dispositivo.

A solução do servidor continua protegida como orientações ópticas equivalentes (duas possibilidades a cada 180°); antes de registrar uma fase no ranking, a API verifica os ângulos informados pelo cliente e normaliza as duas direções. Todas as soluções equivalentes são aceitas, sem exigir uma volta ou direção de giro específicas. O ranking salva o melhor tempo **por jogador e por dificuldade**. A aba Ranking permite alternar entre os três níveis e consulta os dados automaticamente.

O cadastro exige dois campos separados: Nome (2 a 35 caracteres) e Sobrenome (2 a 45 caracteres). Não aceita cadastrar um jogador novo com somente um nome. Os registros anteriores continuam armazenados como `legado` e não são comparados aos novos modos. Pessoas com o mesmo nome completo em navegadores diferentes podem ter identidades diferentes; no mesmo navegador o perfil é reaproveitado pelo nome completo digitado.

**Privacidade:** o nome completo é publicado no ranking. Como a feira pode receber menores de idade, obtenha consentimento adequado dos responsáveis ou considere mudar para a exibição de nome e inicial do sobrenome antes de divulgar o endereço do jogo.

**Estado da verificação:** o gerador foi validado com 900 circuitos nos três níveis, e 600 circuitos adicionais passaram nos testes cruzados com a lógica de ângulos da interface, incluindo reflexões equivalentes, bloqueio de 45° e retorno 315°→0°. O JavaScript da interface passou na verificação de sintaxe. O deploy `ligo-api` está na versão 4. Testes HTTP reais com múltiplos visitantes ainda não foram concluídos neste ambiente.

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

# ECHO — PR15.5-B-FIX.2 · Mostrar Métricas

> Atualizado pelo **PR15.5 PERFORMANCE AUDIT #1**: o diagnóstico permanece
> visível/amostrando em eventos, loja, TAB, pausa, DEV/Sandbox e fim da run.
> O relatório da auditoria e os ganhos estruturais estão em
> `PR15_5_PERFORMANCE_AUDIT1.md`. A base de criação abaixo é histórica.

## Objetivo e escopo

Adicionar uma ferramenta permanente e simples para playtests: números de desempenho e cardinalidade, sem criar um profiler, histórico, gráficos ou novas entidades visuais. A ferramenta é somente observação; não modifica dano, HP, escudo, velocidade, cooldown, ondas, IA, RNG, economia, equipamentos, Echos ou PR15.

Base verificada **antes de qualquer alteração**:

- Branch: `arena/01a086e2-echojogo`.
- HEAD: `6f81af1c9a8aa7bc1149d6127f9d94d2a954d7f1`.
- `git status --short`: sem saída; working tree limpo.
- Baseline executado: **49 suítes, 2822 checks, 0 falhas**.

Não houve reset, checkout, pull, abertura de PR ou merge. O B-FIX aprovado pelo jogador permanece preservado.

## Configuração e persistência

Caminho: **CONFIGURAÇÕES → MOSTRAR MÉTRICAS**, entre **TELA CHEIA** e **QUALIDADE GRÁFICA**. Disponível tanto no menu inicial quanto nas Configurações do menu de pausa.

- Descrição: “Exibe informações de desempenho durante a partida.”
- Controle: o mesmo `cfgRow` / `.cfgv` existente; clique alterna **DESLIGADO / LIGADO**, com a classe `.off` quando desligado. Não há menu paralelo.
- Campo: `cfg.metrics`, inteiro `0` ou `1`.
- Default: **DESLIGADO (`0`)**.
- Persistência: `saveCfg()` existente, usando `localStorage`, chave **`echoCfg.v1`**.
- `loadCfg()` começa este campo em `0`, importa somente chaves já reconhecidas pelo sistema e normaliza `1`/`true` para ligado; qualquer outro valor resulta em desligado.
- Settings antigos, campo ausente, dados inválidos e JSON malformado não fazem a ferramenta herdar ON nem produzir números inválidos. As demais preferências não são apagadas. A migração já existente de `dmgnum` permanece intacta.
- O retorno ao título já chama `loadCfg()` na arquitetura original; agora também oculta/reinicia a janela do painel, inclusive se o armazenamento trouxer OFF.
- Nenhuma versão de save/settings foi incrementada. A preferência não entra em checkpoint, slot, Echo memory, PR15 memory/presence/intention, progressão, inventário ou economia.
- Falha de armazenamento é tratada pelo `try/catch` existente: o toggle continua funcionando na sessão, mas não é possível prometer persistência se o ambiente negar a gravação.

## Painel, HUD e resolução

Implementação DOM, irmã do `#hud` no `body`, com `position:fixed; z-index:84`. Sair do stacking context de z-index 10 do HUD é necessário para ficar visível acima de modais/DEV. Um único `<aside id="metrics-overlay" hidden>`, sete valores `<dd>` fixos e referências DOM guardadas uma vez no carregamento. O atributo `hidden` impede aparecimento inicial quando a preferência está OFF.

Características: 174 × 158 px, fonte monoespaçada de 11 px com linha de 17 px, algarismos tabulares, fundo escuro, borda ciano discreta, rótulos em pt-BR e números alinhados à direita. Sem animações, transições, blur, glow, sombras, gráficos, Canvas ou interceptação de cliques.

### Auditoria de posição

- Superior esquerdo: Integridade e Escudo (`#hpwrap`).
- Superior central: onda/tempo/abates e indicação de facções; barra de boss abaixo.
- Superior direito: créditos, resíduos temporais, Fractura, perfil moral e status dos Echos, organizados em `#slots`/grupos. Não foi adicionada informação nessa coluna congestionada.
- Inferior esquerdo: Sincronia (`#xpwrap`); no Sandbox, o chip `#sb-chip` fica a 132 px do rodapé.
- Inferior direito: arsenal, Dash, Especial e cooldowns.
- Centro: banners, mensagens e toasts. Em DEV/TAB/laboratório o diagnóstico usa a margem superior livre, sem cobrir controles nem desaparecer.

Posição escolhida: **`left:16px; bottom:178px`**, na lateral inferior esquerda, acima da Sincronia e do chip Sandbox.

Validação automatizada em Chromium headless, incluindo inspeção das capturas:

| Resolução | Retângulo do painel `(x, y, largura, altura)` | Resultado |
|---|---|---|
| 960 × 540 — mínimo definido no Electron | `(16, 204, 174, 158)` | Dentro da tela, sem corte nem sobreposição com os blocos essenciais auditados |
| 1280 × 720 | `(16, 384, 174, 158)` | Dentro da tela, sem corte nem sobreposição com os blocos essenciais auditados |
| 1920 × 1080 | `(16, 744, 174, 158)` | Dentro da tela, sem corte nem sobreposição com os blocos essenciais auditados |

Em 960 × 540, há **20 px** entre o fim do painel e o início do chip Sandbox. Também foi verificado o preenchimento de todos os números em um cenário sintético, sem overflow de rótulos ou valores.

Com ON, jogador existente e documento visível, o painel continua em combate,
pausa, evento, loja, TAB, laboratório, DEV, morte/fratura e vitória. Banners não o
ocultam nem reiniciam a janela. Só fica oculto fora da sessão (`title`, `slots`,
`slotMenu`, `slotConfirm`), sem jogador, com documento oculto ou timestamp inválido.

A auditoria de 960×540 comprovou interseção da posição vertical antiga com cards
no evento/loja, seções do TAB e o painel DEV. Nesses fluxos, no laboratório,
Configurações/Codex e telas finais, `.metrics-dock` dispõe os **mesmos sete valores**
numa faixa de **18 px**, `top:1px; left:16px; right:16px`. Ela ocupa a margem antes
do conteúdo dos modais, sem esconder opções. Não cria outro painel. Combate e
pausa simples mantêm a posição vertical original. A mudança de classe acontece
somente na transição de layout; números continuam amostrados em 250 ms.

A nova política passou por 25 verificações de navegador nas três resoluções,
sem corte de números/rótulos ou interseção com cards/seções/controles auditados.

## Auditoria dos números: fontes reais

| Métrica | Origem exata | Definição e observações |
|---|---|---|
| **INIMIGOS** | `metricsLength(enemies)` → `enemies.length` | Array do mundo. Inclui comuns, elites, sombras hostis, bosses e minibosses. `spawnBoss` e `spawnMiniBoss` já fazem `enemies.push(b)`; **não** se soma `boss`/`miniBoss` novamente. Inclui entidades em materialização/spawn. |
| **PROJÉTEIS** | `metricsLength(projectiles)` → `projectiles.length` | Projéteis de todas as equipes, no array real. Expirados/colididos são removidos pelo updater existente. Não inclui ataque instantâneo sem projétil persistente. |
| **FX** | `metricsLength(parts) + metricsLength(arcs) + metricsLength(swings) + metricsLength(ftexts)` | Partículas/anéis/estilhaços + arcos elétricos temporários + cortes ativos da Lâmina de Arco + textos flutuantes. Quatro tamanhos globais; nenhuma classificação por elemento. |
| **ECHOS** | `(echoes?.[0]?.alive?1:0) + (echoes?.[1]?.alive?1:0) + (pr15Presence?1:0)` | Dois slots reais vivos, inclusive hostis/dissonantes, mais a única presença temporal física PR15. Inclui a presença enquanto está nascendo/saindo, até o objeto ser removido. Não conta registros de memória. |
| **ENTIDADES** | `enemyN + projectileN + fxN + echoN` | Soma exclusiva das quatro categorias acima. Não pretende ser o total literal de objetos JavaScript ou de todos os elementos desenhados. |

`metricsLength` retorna zero para estrutura ausente, tamanho não finito ou negativo. Não usa `list || []`, não cria fallback temporário e não visita elementos.

### Por que ECHOS não usa apenas `.length`

Echos mortos permanecem em `echoes`, com `alive=false`. Portanto, `.length` não representaria os ativos. A arquitetura possui dois slots, inclusive no DEV (`spawnEcho` restringe o slot a 1/2) e no Sandbox. São feitas **duas consultas diretas**, sem loop. `pr15Presence` é um singleton separado, limitado a uma presença, e não entra em `echoes` nem em `enemies`.

Sombras hostis de boss pertencem a `enemies`; ficam em INIMIGOS para evitar duplicação. Se futuramente o jogo suportar mais de dois slots de Echo, esta definição precisará ser revisada junto com esse contrato, não antecipada com listas espelho.

### Definição e limites de FX

Auditados:

- `parts`: alimentado por `spawnParticles`, `spawnRing`, `spawnShards` e outros produtores já existentes. Guarda somente a lista ativa; `partPool` é armazenamento de objetos inativos e **não entra**.
- `arcs`: efeitos elétricos temporários, expirados em `updateArcs`.
- `swings`: cortes temporários ativos, removidos em `updateSwings`. Podem ter função de combate, mas são classificados aqui como efeitos/ataques transitórios, não como projéteis.
- `ftexts`: textos flutuantes com tempo de vida, compactados no loop existente.
- Rastros/ghosts são privados das entidades (`player.ghosts`, `echoes[i].ghosts`, `e.ghosts`, `pr15Presence.ghosts`), não um array global `trails`.
- Flashes usam escalares/estado existente (`flashT`, `resoFlash`, `aberr`); poses, emissões e vários cues são desenhados nas próprias entidades.
- Hazards de miniboss vivem em `e.hazards`; choques e campos do boss vivem em `e.shocks`/`e.gravs`. Não são inventariados como FX globais.
- `dust` é ambientação de fundo; caches de sprites/gradientes são recursos, não FX ativos.
- Não foi encontrada uma lista global de decals/flashes/trails que permita representar todo o renderer simplesmente somando tamanhos.

Assim, **FX significa o conjunto transitório global monitorado**, não a quantidade de toda primitiva/efeito visual. Rastros privados, campos de chefes, bolhas de fala do sistema dedicado e efeitos embutidos ficam fora. Isso é uma limitação intencional: não há varredura de inimigos/projéteis para tentar classificar tudo.

### Outras entidades auditadas e excluídas

`player`, `xporbs`, `pickups`, `allies`, `beacon` e agentes físicos de facções não entram em ENTIDADES. `echoQueue`/`recorder` são dados de memória/gravação, não população ativa do overlay. Nem o painel nem os recursos de renderização entram na contagem.

Os arrays existentes são consultados após os updates no loop; `enemies` usa a compactação existente. Uma morte causada **depois** dessa compactação pode permanecer no tamanho até a compactação seguinte. O painel é um snapshot amostrado de população residente, não uma segunda simulação que reclassifica cada corpo como vivo/morto.

## FPS, FRAME e frequência

Único hook: `metricsTick(now)` no `loop(now)` existente, depois do gate adaptativo, dos updates, do render e do HUD. RAFs rejeitados pelo gate retornam antes do sampler.

Estado limitado a escalares: `metricsStart`, `metricsLast`, `metricsFrames`, `metricsVisible` e `metricsDocked`.

1. A primeira entrada na sessão elegível mostra `---` e estabelece o timestamp inicial, sem inventar uma amostra.
2. Cada frame aceito incrementa um contador escalar. O primeiro callback estabelece a origem e não é contado como um intervalo completo.
3. `elapsed = now - metricsStart`, usando o timestamp real do RAF. Não usa `dt` suavizado, limitado a 50 ms ou afetado por câmera lenta.
4. Quando `elapsed >= 250`:
   - **FPS** = `metricsFrames * 1000 / elapsed`, arredondado para inteiro.
   - **FRAME** = `elapsed / metricsFrames`, com uma casa decimal e `ms`.
   - São lidos os tamanhos/slots reais e publicados os textos diferentes.
   - A janela é reiniciada, sem histórico crescente.

Frequência nominal: aproximadamente quatro publicações por segundo. O threshold é **250 ms**; a publicação ocorre no primeiro frame aceito que o ultrapassa. Em cadências estáveis entre 30 e 60 FPS, a granularidade é aproximadamente 250–283,3 ms. Em 50 FPS, por exemplo, a janela de teste fecha em 260 ms. Um hitch maior pode atrasar a publicação: não se usa timer paralelo para fingir atualização enquanto o jogo não processa frames.

FPS e FRAME usam **a mesma janela**, preservada ao abrir/fechar overlays. Em pausa/evento/loja, representam a cadência de renderização, não a frequência da simulação congelada. Timestamps inválidos ocultam e reiniciam o sampler; repetidos/regressivos reiniciam a janela sem divisão por zero. Valores não finitos de FPS/FRAME não são publicados. Não há exibição de `NaN`, `Infinity`, `undefined` ou `null`.

FRAME é **intervalo médio entre frames processados**, não tempo de CPU, GPU, draw call ou profiler. A média também não revela percentis/1% lows, nem necessariamente cada hitch isolado.

## Auditoria de performance estrutural

### CUSTO QUANDO OFF

Por frame que alcança o hook:

1. Uma chamada a `metricsTick(now)`.
2. Leitura de `cfg.metrics` e `if(!cfg.metrics)return`.

Depois disso, nada do módulo é executado: **zero contagem de frames/entidades, zero consultas de arrays/slots, zero strings, zero alocações explícitas de objetos/arrays, zero acesso/atualização de DOM e zero loops adicionais**.

O DOM fixo e o objeto de referências DOM são criados uma vez no carregamento, inclusive quando OFF; isso é custo de inicialização/memória fixa, não custo por frame. Ao desligar uma opção previamente ON, há uma única escrita de `hidden` e reset escalar; `saveCfg` serializa as configurações por ação do usuário, não no hot path.

### CUSTO QUANDO ON

Frames elegíveis entre publicações:

- Guards escalares de estado/jogador/visibilidade e seleção de layout. O estado do Codex é lido por `classList.contains` no nó já existente, sem query nem leitura geométrica; OFF retorna antes disso.
- Validação numérica do timestamp, incremento do contador, subtração e comparação da janela.
- Nenhum loop, consulta de entidades, objeto/array temporário, string ou atualização textual por frame estável. Mudanças de classe/visibilidade ocorrem apenas nas transições, não a cada frame.

A cada janela completa:

- Duas divisões para FPS/FRAME e operações escalares de soma/arredondamento.
- Seis chamadas a `metricsLength` (dois arrays de entidades e quatro de FX); cada uma só valida/lê `.length`.
- Dois acessos diretos aos slots de Echo e consulta ao singleton PR15.
- Formatação dos sete valores: há strings temporárias **somente por publicação**, incluindo a formatação com `ms`.
- Sete comparações com `textContent`; escrita apenas nos valores que mudaram.
- Nenhum objeto/array temporário, lista espelho, classificação, ordenação, serialização ou varredura global.

Na transição de oculto para visível, existe uma escrita de visibilidade e reposição de textos neutros, antes da primeira amostra. Ao sair da sessão elegível (título/seleção/ausência de jogador/documento oculto), existe uma escrita de ocultação e reset escalar. Overlays de gameplay não ocultam nem zeram a janela. São transições, não atualização visual contínua por RAF.

Instrumentação determinística, sem teste frágil de duração de CPU:

| Cenário | Resultado |
|---|---|
| OFF, 120 chamadas simuladas | 0 escritas textuais, 0 escritas de visibilidade, 0 chamadas aos contadores, 0 publicações |
| ON, 120 frames simulados de 20 ms, valores estáveis, após a apresentação inicial | 9 publicações, 54 chamadas a `metricsLength`, 7 escritas textuais |
| Janela ainda abaixo de 250 ms | 0 contagens de entidades e 0 escritas textuais |
| Arrays instrumentados com tamanho 1.000.000 | Nenhuma leitura de elemento; somente `.length` |

**Esses números não são FPS de hardware nem evidência de ausência de impacto no Electron.**

## Ciclo de vida, runs, Save/Continue e Sandbox

- Um sampler no script da aplicação, acionado apenas pelo loop já existente.
- Nenhum `setInterval`, `setTimeout`, RAF adicional ou listener novo no módulo.
- `metricsSetEnabled` persiste a escolha e reinicia/oculta a janela; OFF desaparece imediatamente.
- `resetRunWorld`, compartilhado por Nova Run, Continue e início/reinício de Sandbox, apenas chama `metricsHide`. Não cria outro sampler nem outro painel.
- `loadCfg` também reinicia a janela, necessário porque o título recarrega as preferências.
- Pausa/loja/evento/TAB/laboratório/morte/vitória **não suspendem mais a medição**. O sampler observa os frames que o loop existente continua renderizando.
- Abrir/fechar overlays preserva a janela. Título/seleção, toggle, reset de mundo e suspensão detectada do documento reiniciam o sampler. Abrir Configurações repetidamente não adiciona timers nem callbacks.
- Save/Continue não serializa o sampler nem a preferência. Continue respeita a configuração atual, mesmo que tenha sido desligada depois do checkpoint.
- Morte, retorno ao título e Nova Run mantêm a escolha gravada. Sandbox não escreve progresso real e não recebe exceção no cálculo de métricas: seu combate também usa `state==='play'`.
- DEV não é requisito. Com painel DEV aberto, o diagnóstico continua funcionando na faixa superior; fechando a ferramenta, volta à disposição vertical se nenhum outro overlay exigir a faixa.

## Testes executados

### Suíte dedicada

`node tests/pr15-5-metrics-overlay.test.js`: **108 checks, 0 falhas**.

Executa o código real de `index.html` usando o harness existente, com instrumentação restrita ao teste. Cobre default/migração, cliques reais do `cfgRow`, persistência, erros de storage, visibilidade, quatro cadências sintéticas, frame time, timestamps inválidos, amostragem, alterações de contadores, FX, slots vivos/mortos, presença PR15, ausência de estruturas, invariantes OFF/ON, gate, transições, Save/Continue, runs, ausência de duplicação e cinco hashes mecânicos. A descoberta automática de `tests/*.test.js` já inclui a suíte; não foi preciso alterar `package.json` ou o runner.

### PR15.5 aprovado anteriormente

| Suíte | Checks | Falhas |
|---|---:|---:|
| `pr15-5-visual-foundation.test.js` — A, hurt/recoil/lazy state | 95 | 0 |
| `pr15-5-a-fix1-performance.test.js` — A-FIX | 28 | 0 |
| `pr15-5-b-common-enemy-readability.test.js` — B | 132 | 0 |
| `pr15-5-b-fix1-performance-visibility.test.js` — B-FIX | 56 | 0 |
| **Total** | **311** | **0** |

Também foi executado `node audit_pr155/visual_foundation_benchmark.js`: permanecem os deltas estruturais aprovados, incluindo Swarm sem custo individual de cue, ranged integrado e Singular com apenas um path/arc/stroke adicional no cenário de influência. Não é benchmark de FPS.

### Regressão completa

`npm test` na criação: **50 suítes, 2930 checks, 0 falhas**. Após PERFORMANCE AUDIT #1: **51 suítes, 3041 checks, 0 falhas**, incluindo 111 checks novos. Os 108 checks desta feature foram mantidos, atualizando as expectativas de visibilidade que o novo requisito substituiu.

Inclui arsenal, inimigos, minibosses/boss, balance, Save/Continue, legacy restore, Sandbox, DEV, PR15 B1–B4, Fracture, facções, operadores, itens, escudo, statmods, eventos e demais suítes descobertas. A suíte de métricas teve apenas as expectativas de visibilidade/posição/estado escalar atualizadas no Audit #1. As regressões mecânicas permanecem intactas.

### Verificação adicional de navegador da criação (histórico)

A atualização Audit #1 acrescenta 25 verificações aprovadas do novo contrato de overlays, descritas acima e no relatório próprio.

Chromium headless com Playwright, ferramentas instaladas fora do repositório, sem novas dependências do jogo:

- **21 verificações aprovadas** de UI, fluxos, visibilidade, tamanhos, reload, nova página e Sandbox; sem erros JavaScript capturados na execução concluída.
- **3 verificações adicionais aprovadas**: fechar/reabrir o Chromium com perfil persistente mantém ON; mantém OFF; números sintéticos preenchidos cabem em 960 × 540.
- Fluxo por cliques: Configurações → ligar → voltar → Iniciar → Save 1 → Nova Run; pausa → Configurações → desligar → retomar; menu global → Sandbox → laboratório.
- Uma tentativa de UI executada em paralelo com a regressão teve timeout de clique ao reabrir Configurações após reload. A repetição isolada concluiu as 21 verificações sem alteração no código. Não se usa duração desse teste como resultado de performance.
- A validação de navegador **não é playtest humano no Electron**. Escala de DPI, fontes/contraste na máquina do jogador, HUD congestionado em combate tardio e FPS real continuam pendentes de avaliação humana.

## Comparação mecânica obrigatória

Referência: **`4667720babece82b1c9bb1b92e8d47b7b1c5cc45`**.

Comparação direta dos blocos integrais de fonte, extraídos com `git show`, normalizados para LF: **todos idênticos**, sem divergência mecânica encontrada.

| Bloco | SHA-256 do bloco integral de referência e atual |
|---|---|
| `WEAPONS` | `cb92e03d4d36f390b41c70b8ab85e5ace7e183b779249dfa89295ff7bfabda03` |
| `EDEFS` | `fe919859b535e7645a50ce13bfe948bb4de5c3c1df716123a5674a59baae698e` |
| `waveCompBase` | `3f49dd9c64897c75062d248e0096ad8d493190cc1dfb0dda9935ae6cb82eb368` |
| `MINIBOSS` | `6ce87e31b85d36526611d202d98473bc587e8fb241d9dae20ba2569fc107dc18` |
| `spawnBoss` | `3872a65edcacad431d90d014d0741cad5c6b84767a5a02189f701c410fc7379e` |

A suíte dedicada conserva esses hashes sem exigir que o histórico Git completo exista na máquina que executa os testes.

O diff da implementação não altera funções de gameplay ou renderização de inimigos: mantém remoção de `contactR + 54`, ausência de pose/transform contínuo, Swarm barato, Singular barata, Shooter/Orbiter/Phantom integrados, frente de Bulwark por `shieldAng` e fast paths do A-FIX.

## Arquivos da criação do painel (histórico)

A relação adicional de arquivos do Audit #1 está no relatório dessa auditoria.

**Alterado**

- `index.html`: linha de Configurações, campo global persistente, DOM/CSS do painel, sampler e hooks mínimos de loop/reset/load. Sem reorganização de grandes blocos.

**Criados**

- `tests/pr15-5-metrics-overlay.test.js`: 108 checks dedicados funcionais/estruturais/mecânicos; instrumentação de testes fora do código de produção.
- `PR15_5_METRICS_OVERLAY.md`: esta auditoria, contrato dos números, custo, limites, resultados e roteiro de playtest.

Nenhum arquivo de arsenal, catálogo, economia, save schema, Electron, dependências ou harness existente foi modificado. Capturas, logs e ferramentas temporárias de navegador ficaram fora do Git.

## Playtest humano necessário no Electron

1. Sem settings novos: confirmar MOSTRAR MÉTRICAS = DESLIGADO e nenhum painel.
2. Ativar no menu inicial, iniciar/continuar uma run e aguardar a primeira janela de aproximadamente 250 ms. O banner de entrada não deve esconder o diagnóstico.
3. Observar FPS/FRAME em combate real, distinguindo quedas para 50/40/30 de uma cadência próxima de 60; não foi prometido FPS nesta entrega.
4. Alternar OFF/ON em cenários comparáveis e avaliar eventual custo real da própria ferramenta, sem atribuir diferenças de carga de uma onda a ela.
5. Conferir legibilidade em 960 × 540, tela cheia e escala/DPI usados pelo jogador; testar fases congestionadas, Echos vivos/mortos, presença PR15, boss/miniboss e bastante FX.
6. Confirmar que o painel não compete com vida, escudo, economia, Fractura/perfis, Echos, habilidades, cooldowns, banners ou objetivos/eventos. Durante banner/modal, o painel deve continuar visível. Em evento/loja/TAB/DEV, conferir a faixa superior e o retorno à posição normal.
7. Pausar → Configurações → desligar → retomar: painel ausente. Religar deve começar nova janela sem duplicação.
8. Morrer/sair, iniciar outra run, Save/Continue e reiniciar o aplicativo: preferência mantida, um único painel, sem alteração mecânica.
9. Repetir em combate Sandbox e DEV, abrindo/fechando laboratório e painel DEV.
10. Interpretar FX e ENTIDADES como os subconjuntos documentados; não como contagem completa de primitivas de GPU, memória ou objetos do jogo.

**Decisão técnica:** critérios estruturais e regressões aprovados para playtest. Performance real e aprovação visual final dependem do jogador no Electron.

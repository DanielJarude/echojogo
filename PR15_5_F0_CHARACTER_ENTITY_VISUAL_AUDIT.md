# PR15.5-F0 — Auditoria e Especificação · Identidade Visual dos Operadores e Entidades Temporais/Especiais

**Data:** 2026-09-16 (UTC)
**Repositório:** `DanielJarude/echojogo`
**Branch permanente auditada:** `dev/pr15-5-visual-overhaul`
**Branch de trabalho da sessão:** `arena/01a0ab1a-echojogo`

> **F0 é SOMENTE auditoria, inventário e especificação.** Nenhum renderer de
> produção foi alterado. `index.html` permanece byte-idêntico ao HEAD base.
> Deliverables: este documento + `tests/pr15-5-f0-character-visual-audit.test.js`
> (suíte de auditoria, 87 checks, sem efeito no jogo).

---

## 1. Base

- SHA base exigido: **`9001082451dcabc1d4e5c31a56c8744ac5eba3e2`**
- Commit: `PR15.5-FINAL: auditar integração do Visual Overhaul`
- HEAD inicial da sessão: exatamente o SHA acima (clone *grafted*/shallow).
- `git status --short` inicial: working tree limpa.
- Branch da sessão: `arena/01a0ab1a-echojogo` (fixada pela sessão; a permanente
  `dev/pr15-5-visual-overhaul` não foi tocada).

## 2. Baseline

```text
npm test
SUÍTES: 70 · COM FALHA: 0 · CHECKS ✔: 4626 · FALHAS ✘: 0
TODAS AS SUÍTES PASSARAM
```

**Divergência de ambiente encontrada e resolvida antes de prosseguir.** Na
primeira execução a baseline NÃO reproduziu (70 suítes · 4578 checks · 17
falhas em 2 suítes). Investigação: as suítes
`pr15-5-c-hurt-death.test.js` e `pr15-5-e9-impact-visual-grammar.test.js`
executam comparações "idêntico à base" via `git show <sha>:index.html`
(base mecânica `5d8e244c…` e `6f532f7…`). O checkout da sessão é um clone
shallow/grafted **sem esses objetos históricos**, então `git show` falhava —
falha infraestrutural, não regressão de código. Correção aplicada sem
qualquer mudança de working tree:

```text
git fetch --depth=1 origin 5d8e244c22b1a505c1cd25c4149497f91c83871a 6f532f72ed1680a68704e85f43b593e204081422
```

Após o fetch dos dois objetos: **70 · 4626 · 0 — baseline reproduzida
exatamente.** Nenhum arquivo do jogo foi tocado para reproduzir a baseline.

## 3. Inventário real de operadores

**Existem exatamente 8 operadores jogáveis no HEAD** — o planejamento
histórico de 8 nomes bate com o código, com duas ressalvas de identificação:

| # | id | nome | papel | hp | speed | r | slots | guns[0] | sp [E] | perk (resumo) | unlock |
|---|---|---|---|---:|---:|---:|---:|---|---|---|---|
| 1 | `vector` | VECTOR | EQUILIBRADO | 100 | 335 | 14 | 4 | plasma | SALTO DE FASE (blink) | +1 reroll/loja | base |
| 2 | `wraith` | WRAITH | ASSASSINO | 72 | 410 | 13 | 2 | nail | PROTOCOLO MASSACRE | rush pós-dash | base |
| 3 | `bulwark` | BULWARK | FORTALEZA | 185 | 262 | 16 | 5 | shotgun | BASTIÃO | −22% dano, regen | 5 runs |
| 4 | `pyre` | PYRE | INCENDIÁRIO | 88 | 322 | 14 | 3 | flamer | NOVA INCENDIÁRIA | status +45%, burnSpread | 800 status |
| 5 | `warden` | **HARDEN** | TÁTICO | 112 | 300 | 15 | 4 | acid | TORRE DE CONTENÇÃO | status +40% dur, kits ×2 | 1500 status |
| 6 | `nomad` | NÔMADE | MERCENÁRIO | 92 | 352 | 14 | 5 | smg | CACHE DE SUPRIMENTOS | +45% créditos, 5 slots | 10000 moedas |
| 7 | `echo0` | ECHO-0 | RESSONANTE | 80 | 345 | 14 | 3 | tesla | SOBRECARGA RESSONANTE | Ecos +60%, +60 créditos | 1 vitória |
| 8 | `revenant` | REVENANT | CEIFADOR | 66 | 368 | 13 | 3 | scythe | COLHEITA MACABRA | abate cura 3 HP | 2000 kills |

Cada operador possui paleta completa de 6 canais (`pal.body/dark/edge/glow/
visor/head`) + `color`, `title`, `lore`, `quote`, `perk`, `desc` — identidade
de *ficha* completa (Dossiê/Codex). `BASE_CHARS=['vector','wraith']`; os
demais 6 têm condição real em `UNLOCKS` (`c_bulwark…c_revenant`).

**Respostas diretas do §4 do brief:**

- **A.** 8 operadores jogáveis de fato.
- **B.** VECTOR, WRAITH, BULWARK, PYRE, HARDEN, NÔMADE, ECHO-0, REVENANT.
- **C.** Nenhum dos 8 nomes existe apenas em documentação/código morto — todos
  têm definição viva em `CHARS`, seleção, apply() e testes. Nenhum operador
  fantasma.
- **D.** HARDEN existe (id interno **`warden`**); NÔMADE existe (id `nomad`);
  REVENANT existe (id `revenant`). A única armadilha de nome: **HARDEN não tem
  id `harden`** — auditorias por id literal não o encontrariam.
- **E.** **ECHO-0 é um operador jogável** (id `echo0`, papel RESSONANTE, perk
  orientado a Ecos). Não é entidade temporal: as entidades "Echo" são outras
  (ver §9). A sobreposição de nome entre o operador ECHO-0 e as entidades
  ECHO·01/02 é apenas nominativa.
- **F.** Evidência de remoção histórica: `tests/operators.test.js` chama-se
  "Restauração dos 8 operadores originais (PR 6)" e `legacy-restore.test.js`
  documenta a restauração de conteúdo histórico — ou seja, os operadores
  foram removidos em algum momento pré-PR6 e restaurados. No HEAD atual nada
  falta. Colisão documentada: **`bulwark` é id de operador E de inimigo
  comum** (contexts distintos, sem conflito funcional).

## 4. Divergências históricas

| tema | planejamento histórico | HEAD real | veredito |
|---|---|---|---|
| quantidade de operadores | "até oito nomes" | exatamente 8, todos jogáveis | planejamento confirmado |
| HARDEN | nome previsto | existe, mas id interno é `warden` | divergência de id documentada |
| escopo F (docs B/C) | "minibosses e transformação do Paradoxo: PR15.5-F" | brief atual expande F para operadores + entidades temporais; miniboss identity JÁ foi feita pelo PR13.5-B5-A (8 renderers próprios); boss/miniboss morte ainda é fallback | escopo F real = operadores + fechamentos pendentes |
| escopo G (docs B) | "otimização global e profiling final: PR15.5-G" | brief atual define G = Mundo/Eventos/Fracture/Coerência | G redefinido; performance é guardada transversal (metrics overlay) |
| BULWARK como operador | — | também é tipo de inimigo comum (BLINDADO) | colisão de id sem efeito |

## 5. Renderer dos operadores

**Um único renderer de corpo: `drawUnit(x,y,aim,r,pal,opts)`** (index.html
~19964). Estrutura desenhada (sempre igual, escalada por `s=r/14`):

1. sombra projetada (elipse `r*.42`, alpha .34);
2. PERNAS — 2 retângulos `r*.72×r*.48` alternando com o passo (`sw=sin(phase)`,
   `phase=runTime*(6+walk*7)`);
3. MOCHILA/núcleo — roundRect atrás (`-r*1.0`, `r*.55`) + orbe glow `r*.20`
   (shadowBlur 12);
4. TORSO — path custom (frente `r*.62`, traseira `-r*.55/-r*.80`) com gradiente
   linear cacheado (`linGrad2` `body→dark`) + faixa peitoral glow (blur 9);
5. BRAÇOS — 2 strokes `r*.30` até `r*.92` (ou pose rígida melee PR15.5-D);
6. ARMA — `drawWeaponSprite(wi,s,accent,recoil)` na mão (`r*.86`);
7. MÃOS — 2 círculos `r*.17`;
8. CABEÇA — círculo `r*.40` + visor arco `r*.24` glow (blur 13);
9. pose composição: `opts.pose` (hurt PR15.5-C + melee body PR15.5-D),
   glitch determinístico (E0) via `opts.phase`.

**Todos os corpos humanoide-operador do jogo passam por `drawUnit`:**
player (`drawPlayer`), Eco aliado (`drawEchoEntity`), Eco Sombrio
(`drawShadow`), Presença Temporal (`pr15PresDraw`) e o wrapper legado
`drawShip`. A tela de seleção usa `charPortrait` — **um único template SVG**
paleta-substituído para os 8.

Overlays por operador no `drawPlayer`: aura de rush do WRAITH (`p.rushT`),
escudo de fase genérico (`invT`), anel de dash, arco de mira, retícula de
gamepad, anel de alcance na troca de arma. Especiais [E] são eventos de
partícula/banner (`spawnRing/spawnShards`) + buff de estado; o único especial
com entidade persistente é a TORRE DE CONTENÇÃO do HARDEN (allies[],
renderer próprio em `drawWorldExtras`).

## 6. Matriz visual dos operadores

| campo | VECTOR | WRAITH | BULWARK | PYRE | HARDEN | NÔMADE | ECHO-0 | REVENANT | classe de diferença |
|---|---|---|---|---|---|---|---|---|---|
| cor principal | #9ff3ff | #c56bff | #8ff6ff | #ff7a2f | #39d98a | #ffd166 | #ff4df0 | #a8ff3d | COR |
| corpo/dark/edge/glow/visor/head | 6 canais próprios | idem | idem | idem | idem | idem | idem | idem | COR |
| geometria | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | — (idêntica) |
| proporção (r) | 14 | 13 | 16 | 14 | 15 | 14 | 14 | 13 | PROPORÇÃO (±7–14%) |
| arma inicial | plasma | nail | shotgun | flamer | acid | smg | tesla | scythe | ARMA (sprite) |
| acessório estrutural | nenhum | nenhum | nenhum | nenhum | nenhum | nenhum | nenhum | nenhum | — (não existe) |
| assimetria | não | não | não | não | não | não | não | não | — |
| idle | estático (pernas paradas em walk=0; só pulso do glow da arma) | idem | idem | idem | idem | idem | idem | idem | — |
| movimento | pernas alternam (walk) | idem | idem | idem | idem | idem | idem | idem | ANIMAÇÃO (compartilhada) |
| dash | trail de ghosts + anel | idem + aura rush própria | idem | idem | idem | idem | idem | idem | EFEITO (1 exclusivo) |
| especial | ring+banner | ring+banner | ring+banner | ring duplo+shards | ring + **torre persistente** | ring+shards+drops | ring nos Ecos | ring+shards+arcos execução | EFEITO (partículas) |
| hurt | pose C + flicker 9 Hz (paleta rosa) — idêntico para todos | idem | idem | idem | idem | idem | idem | idem | ANIMAÇÃO (compartilhada) |
| death | sem corpse próprio (player não usa deathVisuals) | idem | idem | idem | idem | idem | idem | idem | — |
| muzzle/impacto | pipeline E8/E9 por ARMA (não por operador) | idem | idem | idem | idem | idem | idem | idem | EFEITO (arma) |
| outline/glow | via pal.glow | idem | idem | idem | idem | idem | idem | idem | COR |
| temporal | nenhum | nenhum | nenhum | nenhum | nenhum | nenhum | nenhum | nenhum | — |
| renderer | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | drawUnit | — |
| custo (ops canvas, idle) | 120 | 120 | 135 | 130 | 130 | 120 | 130 | 126 | — |

**Síntese:** a única diferenciação estrutural entre operadores vem do SPRITE
DA ARMA (14 classes) e do raio. O corpo é 100% palette-swap.

## 7. Teste de silhueta (executado, não estimado)

Método: harness `audit_pr135/harness.js` + mock de Canvas que registra cada
comando; **assinatura estrutural** = sequência de primitivas com argumentos
normalizados por tipo (número→`n`, cor→`c`, string→`s`). Duas entidades com a
mesma assinatura são indistinguíveis sem cor.

**Resultado 1 — corpo puro:** `drawUnit` com a MESMA paleta, MESMO r e MESMA
arma nos 8 operadores → **hash estrutural idêntico** (`ec2a5075aeea4f35`)
para todos os 8. Zero diferenciação corporal.

**Resultado 2 — drawPlayer completo (com arma inicial de cada um):** exatamente
**5 grupos estruturais** para 8 operadores:

| grupo | operadores | causa |
|---|---|---|
| 1 | VECTOR(plasma) · WRAITH(nail) · NÔMADE(smg) | sprite default/pistola-rifle de mesma estrutura |
| 2 | BULWARK(shotgun) | sprite próprio |
| 3 | PYRE(flamer) · HARDEN(acid) | classe `nozzle` compartilhada |
| 4 | ECHO-0(tesla) | classe `coil` |
| 5 | REVENANT(scythe) | classe `scythe` (melee) |

**Resposta à pergunta do §6 do brief:** NÃO. Em monocromático, sem HUD, sem
cor de arma e sem partículas, os operadores **não** são distinguíveis — o corpo
é idêntico; pares diretamente confundíveis: VECTOR×WRAITH×NÔMADE (estrutura
idêntica) e PYRE×HARDEN (idem). BULWARK/ECHO-0/REVENANT só se separam pela
arma na mão, não pelo corpo. O teste está travado na suíte F0 (bloco C) como
registro; F1+ deve atualizá-lo deliberadamente.

## 8. Canvas vs sprites

- Operadores, Ecos, Sombrios, Presença, inimigos, minibosses, Paradoxo,
  projéteis, eventos: **100% Canvas 2D procedural**. Não existe pipeline de
  sprites raster para entidades. Única exceção de `drawImage`: halos
  pré-renderizados por cor (`glowSprite`, otimização PR15.5-A) e o piso
  (`floorCv`).
- O renderer atual **suporta** silhuetas mais distintas: os inimigos comuns
  (11 renderers únicos no mesmo `drawEnemy`) e os 8 minibosses (B5-A) provam
  o padrão arquitetural — perfis declarativos + renderer próprio, custo
  controlado, zero RNG.
- **Não é necessário mudar de arquitetura.** A recomendação técnica é
  estender `drawUnit` com um perfil declarativo por operador (precedente:
  `MINIBOSS_VISUALS`), mantendo Canvas procedural. Custo estimado por
  operador: +20–60 comandos no draw (ver orçamento §22). Sprites raster
  permanecem fora do F.

## 9. Echo — inventário completo

Sete conceitos distintos compartilham o universo "Echo". NÃO foram misturados:

| # | conceito | natureza | origem | renderer | silhueta | cor | relação c/ save | relação c/ Memory Director | relação c/ Repetição |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Echo aliado** (`echoes[]`, slots 1–2) | entidade combatente aliada | runData (trail) de runs anteriores via `makeEcho(data,slot)` | `drawEchoEntity` → `drawUnit` (alpha .72, walk .55) + ghosts + anel orbital + labels | MESMA do operador | slot1 `#46e0ff` ciano · slot2 `#ff4df0` magenta + camadas glitch (E0) | `cp.echoes` (legado) | não decide; é fonte de assinatura (B1) | nenhuma |
| 2 | **Echo entre runs** (`echoQueue`) | DADO, não entidade | `onPlayerDeath` captura trail/build/personalidade | não desenha | — | — | `saveEchoes/loadEchoes` | alimenta candidatos do Director (B2) | nenhuma (gate não lê echoQueue) |
| 3 | **Presença Temporal** (`pr15Presence`, PR15-B3) | entidade NÃO-combatente, 1 por vez, fora de `echoes[]` | descriptor consumido pelo Director B2 | `pr15PresDraw` → `drawUnit` translúcido ×2 (corpo + duplicata magenta atrasada) + fenda no solo + anel ciano + arco de ruptura magenta | MESMA do operador (silhueta `wi` derivada do build da memória) | ciano `PR15_PRES_CYAN` + magenta | `cp.pr15presence` (estado mínimo) | materializa o que o B2 decide | reconhece ativação com 2 arcos (PR15.7-C), sem mecânica |
| 4 | **ECO SOMBRIO** (`enemies[]`, `type:'shadow'`) | INIMIGO invocado pelo Paradoxo (fase 2) | `spawnShadowEcho(srcData)` — usa build real do jogador na trail | `drawShadow` → `drawUnit` glitch + label `ECO SOMBRIO·0N` | MESMA do operador | `#7fd8ff` / `#ff8df5` | não persiste | não | nenhuma |
| 5 | **Echo hostil por Dissonância** (estado `e.dis.st==='hostile'`) | o próprio Echo aliado rebelado IN LOCO | `enterDissonance` (relação/trust) | `drawEchoEntity` (ramo dissonante): drawUnit vermelho + jitter + medidor RUPTURA | MESMA do operador | `#ff2f5e` + `DIS_COLOR` por estado | estado run-scoped | pressão de memória alimenta instabilidade | nenhuma |
| 6 | **ECHO-0 operador** | operador jogável | `CHARS` | `drawUnit` via `drawPlayer` | MESMA (paleta própria) | `#ff4df0` | progressão de unlock `c_echo0` | nenhuma | dispara como qualquer operador |
| 7 | evento `ghost` ("TRANSMISSÃO FANTASMA") | evento de decisão (PR13) | Event Director | `renderRift`-família (escopo G) | — | `#ff4df0` | não | não | não |

Camada temporal de projétil (E2): `PTM_ECHO` (fantasma sutil atrás do
projétil) detectado por **metadata** (`owner.slot>0 && owner.data`), nunca por
cor. Repetição (`PTM_REPLAY`) tem prioridade e traço duplo "forte".

## 10. Repetição Ancorada — regra absoluta respeitada

Sistema PR15.7-A/B: captura do ÚLTIMO disparo ranged primário
(`TEMPORAL_ACTION_WEAPONS = plasma|shotgun|rail|sniper`), janela 5 s, cooldown
6 s, dano 50% do snapshot, máx. 8 projéteis. Verificações de independência
executadas no HEAD:

- `temporalReplayTry` (gate) **não referencia** echoQueue, trust, Ressonância,
  Memory Director ou progressão — travado no teste F0-E04;
- detecção temporal por metadata (`PTM_REPLAY` ≠ `PTM_ECHO`), prioridade
  documentada §18 do PR15.7;
- camada visual `drawProjectileTemporalLayer` usa `TEMPORAL_REPLAY_COLOR`
  (#ff4df0) **apenas como traço-acento** atrás do projétil — o corpo continua
  sendo a identidade da arma (E2);
- marcador ARMED (`drawTemporalActionMarker`): arco ciano de expiração + linha
  magenta de direção no ponto de captura.

**Veredito F0:** nenhum risco atual de acoplamento. Recomendação para F: a
regra é *visual compartilhado OK, mecânica compartilhada PROIBIDA*; qualquer
rework de silhueta do operador NÃO deve tocar `temporalAction*`. O corpo do
operador e a Repetição não se cruzam no pipeline.

## 11. Phantom (LEVIANO)

- **Categoria:** inimigo comum (`EDEFS.phantom`, hp 30, spd 212, r 13, dmg 15,
  xp 14 — o de maior XP entre comuns).
- **Comportamento:** alterna fases — `ghostT>0` = intangível/invisível
  (mecânica intacta, anchor de fonte verificado); rematerializa para atacar.
- **Renderer:** branch próprio em `drawEnemy`: contorno de "mariposa"
  translúcida (path quadrático), preenchimento `rgba(191,251,255,.25)`, olho
  `#eaffff`; alpha `.95` visível / `.16+.54·matP` em fase ghost.
- **Telegraph:** `attackStyle:'materialize'` com progresso `matP` (PR15.5-B,
  check I01–I04 da suíte B) — anuncia rematerialização NA POSIÇÃO REAL.
- **Hurt/death:** família `spectral` (PR15.5-C) — dip de alpha + eco de fase
  efêmero; morte `spectral` no pipeline corpse.
- **Relação temporal:** temática (fanta), sem mecânica temporal.
- **PR15.5-B já alterou Phantom?** SIM — telegraph de rematerialização + pose
  materialize + pureza. **Tratamento adicional em F:** somente se o replaytest
  humano apontar problema de visibilidade mínima (alpha .16 em áreas claras).
  Classificado **P2/condicional** — fora do escopo núcleo de F.

## 12. Singular

- **Categoria:** inimigo comum "pesado anômalo" (hp 190, spd 96, r 24, dmg 24,
  xp 30 — o comum mais valioso).
- **Comportamento:** poço gravitacional — pull dentro de 420 px (`pullVisual`,
  um único arco local, sem visual state — B-FIX1), reflexão instantânea
  probabilística (35%, sem janela falsa — verificado B-J05).
- **Renderer:** 3 anéis colapsando (`pulseA`), gradiente radial `#ff9df7`,
  núcleo preto `#12000f` r*.35; reflexão pinta anéis brancos e inverte pulso.
- **Hurt/death (C):** compressão radial (`sgz=1-.22·lean`) + núcleo pulsa;
  morte `anomalous` no pipeline corpse.
- **O que falta visualmente:** nada estrutural — B (ataque) e C (reação)
  cobriram. Leitura de "perigo" funciona (anéis + pull arc). **P2** — não
  repetir B dentro de F.

## 13. Paradoxo (O PARADOXO)

Separação exigida pelo brief:

**CORPO/IDENTIDADE VISUAL (candidato a F):**
- corpo central: hexágono rotativo magenta (blur 30) + triângulo ciano
  contra-rotativo `r*.72` + núcleo gradiente radial pulsante (branco→magenta)
  + 3 arcos internos ciano; intro de spawn com anel de 240 px; r=66.
- flash de hurt: troca para branco (blur 46) — pipeline PRÓPRIO (não usa
  `visualHurtPose` de C).
- **sem corpse** (fallback `death:null`) — fechamento pendente.

**MECÂNICAS/TELEGRAPHS (preservar — não é F):**
- **beams rotativos**: 3 (fase 1) / 4 (fase 2), gradiente magenta→ciano, núcleo
  branco, 820 px, dano por contato com gate .42 s, telegraph = fade-in
  `beamOn` + ring na ativação;
- **gravs** (modo melee-adaptativo): campo `#9d7bff` alpha .16 + 4 anéis
  convergindo `#c9a9ff`;
- **shocks** (modo ranged-adaptativo): anel expansivo `#ff4df0` blur 22 até
  900 px com toast "APROXIME-SE";
- espiral de projéteis `eorb` 2/3 braços; dash 1150; fase 2 aos 50% (banner +
  spawn de Ecos Sombrios);
- **adaptação por bossIntel** (`analyzeEchoData` dos echoQueue): modo
  ANTI-DISTÂNCIA × ANTI-AGRESSÃO + dashes do jogador aceleram shocks —
  **isto é território de PR16** (ver §27).

**Veredito:** o corpo central pertence ao F (leitura + morte); beams/gravs/
shocks/espiral/fases são telegraphs que o F **não pode destruir**; os campos
gravitacionais e ondas de choque em escala de arena pertencem majoritariamente
a G (ambiente). Paradoxo hoje: 49 ops idle / 94 ops com 3 beams — barato.

## 14. Minibosses (pool real de 8)

Todos com renderer próprio desde PR13.5-B5-A (`MINIBOSS_VISUALS` declarativo +
`MINIBOSS_RENDERERS`), spawn signature, telegraph próprio e phase-visual.
Blindagem (`e.plates`, mecânica) é representada por cada renderer do seu jeito
(sem placas genéricas).

| id | nome | cor | r | silhouette | telegraph | spawn | renderer (ops) | avaliação |
|---|---|---|---|---|---|---|---|---|
| herald | O ARAUTO DA FRATURA | #ff9d3c | 44 | vertical-crowned (halo quebrado + coroa) | radial-omen | omen-pulses | 87 | **A único** |
| furnace | A FORNALHA VIVA | #ff5c2f | 48 | heavy-block (fissuras/vents) | heat-bloom | heat-shimmer | 128 | **A único** |
| sentinel | A SENTINELA ESPELHADA | #8ff6ff | 42 | plated-symmetric | lock-line | lock-in | 182 | **A único** |
| brood | A MATRIZ PROLÍFERA | #39d98a | 46 | clustered-mass (pods/satélites) | pod-swell | pods-hatch | 135 | **A único** |
| duelist | O DUELISTA FANTASMA | #ff3d68 | 34 | thin-blade (lâmina + afterimage) | narrow-lunge (alcance REAL) | blink-in | 77 | **A único** |
| colossus | O COLOSSO DORMENTE | #ff2f5e | 56 | massive-rings (placas grossas) | ground-crack | ground-rise | 162 | **A único** |
| oracle | O ORÁCULO DISSONANTE | #ffd166 | 40 | eye-orbits (anéis concêntricos) | prophecy-arc | eye-open | 87 | **A único** |
| leech | O SANGUESUGA TEMPORAL | #a8ff3d | 40 | asymmetric-tendrils (núcleo sucção) | siphon-thread (fio ondulado real) | unfurl | 105 | **A único** |

**Classificação do §14:** os 8 são **(A) claramente únicos** — silhueta,
telegraph, spawn e phase-visual distintos (8/8/8/8, verificado). Nenhum é
variante ilegível (B), excessivamente parecido (C) ou dependente só de cor (D):
a forma carrega a identidade e o telegraph é geometria fiel do ataque. Débitos
restantes: (1) morte **sem corpse** (fallback C), (2) hurt sem pose C (flash
branco no renderer), (3) colisões de cor com operadores (§24). O rework de
identidade estrutural NÃO é necessário — F apenas fecha os débitos.

## 15. Inimigos comuns — validação PR15.5-B

Os 11 comuns (chaser, shooter, tank, spawner, anomaly, swarm, orbiter,
bulwark, splitter, phantom, singular) mantêm: geometria única por tipo
(perseguidor insetoide, drone flutuante, mecha pesado, carcaça hexagonal
ancorada, triângulo com aberração cromática, inseto alado, anel+núcleo,
pentágono+placa, casca rachada, mariposa translúcida, poço gravitacional),
perfis `ENEMY_VISUAL_PROFILES` (attackFamily + antecipação/ativação/recuperação
declaradas), telegraphs B-FIX1 (deformação de primitivas existentes, cue só em
janelas curtas) e pureza de draw (suíte B, 73 checks verdes na baseline).
**Nenhuma regressão de identidade encontrada pós-B/C/D/E.**
**FORA DO ESCOPO DE F** — exceto os pontos P2 explícitos de Phantom/Singular
(visibilidade condicional). Não repetir B dentro de F.

## 16. Hurt/death — validação PR15.5-C

Pipeline C preservado e reutilizável pelo F: perfis por massa/material
(`ENEMY_IMPACT_PROFILES`, 11 famílias), hurt lazy coalescente com direção real
do dano, pose espectral/energético com dip de alpha, corpse visual (cap 24,
pool, 0.12–0.34 s, draw puro). Suíte C: 163 checks verdes.

**Entidades especiais com pipeline DIFERENTE (mapa):**

| entidade | hurt | death |
|---|---|---|
| Paradoxo | flash branco próprio no drawBoss (blur 46) | **sem corpse** (fallback) + explosão de partículas |
| minibosses | flash branco no renderer próprio + phase 2 visual | **sem corpse** (fallback) + banner/ring/shards |
| ECO SOMBRIO | glitch (sem flash branco) | **sem corpse** (fallback) |
| Echo aliado | pose C aplicada via drawUnit (compartilha) | dissolução de partículas própria |
| Presença Temporal | n/a (não-combatente) | desmaterialização (anel abre) própria |

F reutiliza C sem duplicar: o fechamento pendente é **habilitar corpse/familia
para boss/miniboss/shadow** (o próprio doc C marca "fechamento em PR15.5-F").

## 17. Armas — validação D/E

- **Corpo a corpo D:** perfis `MELEE_VISUAL_PROFILES` para as 7 brancas
  (blade/katana/scythe/chains/glaive/gaunt/hammer), fases
  windup→active→recover, pose rígida braços+mãos+arma, trail por família SEM
  blur (23 ops no pico active), fast path null. Integrado a `drawUnit` via
  `opts.melee` — **player, Ecos e Sombrios compartilham**.
- **Ranged E:** `PROJ_FAMILY` cobre os 19 projéteis sem fallback; formas por
  família (SLUG/ENERGY/FLUID/SWARM/CONDUCT/KINETIC) 17–25 ops + 1 drawImage
  (halo); camada temporal E2 ortogonal à forma.
- **Muzzle E8:** emissão direcional determinística por família
  (`muzzleShot`, 1–6 partículas, ZERO RNG), origem `src.r+10`.
- **Impacto E9:** `impactShot` determinístico por família.
- **Integração operador:** `drawUnit` desenha `drawWeaponSprite(wi…)` na mão —
  **não existe renderer de arma paralelo por operador**. O rework do corpo
  deve preservar o contrato `wi` + `translate(r*.86)` (ver §18/§30).

## 18. Hitbox vs desenho (âncoras críticas)

| âncora | valor no HEAD | onde |
|---|---|---|
| raio mecânico do player | `C.r` (13–16), player.r = C.r | makePlayer |
| escala do corpo | TODO drawUnit escala por `s=r/14` | drawUnit |
| bounds visuais do corpo | torso −0.80r…+0.62r; pernas ±0.42r; cabeça +0.10r±0.40r | drawUnit |
| origem do projétil | `src.r+6` na direção do aim | fireWeaponFrom |
| origem do muzzle (E8) | `src.r+10` | emitWeaponMuzzleVisual |
| origem do feixe | `src.r+6` | drawBeamFrom |
| origem inimiga | `e.r+6` (padrão em todos os shooters) | updateEnemy |
| melee | centro da entidade + `reach` (não a ponta da arma) | fireMelee |
| sombra | elipse em `r*.42` | drawUnit/drawEnemy |
| marcador de seleção | player: arco de mira `r+4`; sem selection marker de gameplay | drawPlayer |

**Riscos mapeados para o futuro F:**
1. **muzzle flutuando:** a ponta desenhada do sprite rifle vai até
   ~`0.86r+1.52r≈2.4r` (≈33 px para r=14), enquanto muzzle nasce em `r+10`
   (24 px) e o projétil em `r+6` (20 px) — o flash já nasce "dentro do cano".
   Se F alongar/encurtar braços-arma, essa defasagem de ~9–13 px pode virar
   leitura quebrada. Recomendação: F1 não muda as âncoras; se o corpo mudar a
   mão, testar muzzle×origem visualmente no replaytest.
2. **melee desalinhado:** o trail D segue o relógio do swing a partir do
   CENTRO — seguro para qualquer silhueta nova.
3. **colisão injusta:** corpo visual ≈ hitbox (±0.85r) hoje; F deve manter
   bounds visuais ≤ ~1.0r para o torso (armas podem exceder; já excedem).
4. **escala:** qualquer peça estrutural nova deve derivar de `r` (como todo o
   drawUnit) para BULWARK (16) não "estourar" em relação a WRAITH (13).

## 19. Orientação

- player: mouse = instantâneo (`atan2`), gamepad = suavizado 16 rad/s,
  autofire (sem mira) = alvo mais próximo a 5 rad/s (`updatePlayer`).
- inimigos/Ecos/boss: `angTo(cur,tgt,step)` com taxa própria por tipo
  (boss 1.6, chaser 11, echo slot1 15/slot2 9…). Bulwark orienta o CORPO por
  `shieldAng` (placa), não pelo aim.
- minibosses: 5 giram com `e.aim`; **oracle/brood/leech não giram** (formas
  orgânicas/olho) — decisão B5-A documentada.
- `drawUnit` recebe `aim` pronto; F não deve adicionar RNG nem estado
  mecânico de orientação. Toda rotação visual já existente é derivada de
  estado lógico.

## 20. Animação (inventário procedural)

| animação | mecanismo | determinística? | compartilhada? |
|---|---|---|---|
| idle player | estático (walk=0 congela pernas); pulso só no glow da ponta da arma (`sin(runTime*15..22)`) | sim | player/Eco/Sombrio/Presença |
| walk/move | pernas alternam `sin(runTime*(6+walk*7))` | sim | idem |
| hovers/anel inimigo | `sin(runTime*3.4..9 + phase0/visualSeed)` | sim | por tipo |
| recoil ranged | `visualWeaponRecoil` (evento real fire) | sim | player/Eco/Sombrio |
| swing melee (D) | windup→active→recover + stretch/squash | sim | idem |
| dash | ghosts trail + anel | sim | player (Eco tem orbit ring) |
| hurt (C) | pose + flicker 9 Hz via `hurtT*18` | sim | player+inimigos (por família) |
| death (C) | corpse por família (≤14 primitivas) | sim | 11 comuns |
| especial [E] | partículas/banner (evento) | sim (spawnX determinístico) | todos |
| glitch temporal (E0) | `vJit1/vHash32(seed,tick 30 Hz)` | sim | Eco slot2, Sombrio, Dissonância, anômalo |
| distorção temporal | aberr/shake senoidais incomensuráveis (37/43 Hz) | sim | global |

**Não há animação de idle corporal** (respiração/bob) no player — nota de
oportunidade para F, custo ~2–4 ops com `sin(runTime)`.

## 21. RNG no render

Scan com extração de corpo de função + remoção de comentários, sobre todos os
renderers do escopo F: `drawUnit`, `drawPlayer`, `drawEchoEntity`,
`drawShadow`, `drawBoss`, `drawMiniBoss`, `drawEnemy`, `drawWeaponSprite`,
`drawSwings`, `meleeDrawTrail`, `drawStatus`, `drawEchoRole`,
`drawProjectile*`, `pr15PresDraw`, `charPortrait` e os 8 renderers de
miniboss → **ZERO ocorrências de Math.random/rand/randi/performance.now/
Date.now** (falsos positivos em comentários foram eliminados).

Únicos renderers com RNG no HEAD: **`renderVault` (randi) e `renderScrap`
(rand×4)** — visuais de evento PR13, **escopo G**. (Hits anteriores em
`renderRift/renderAmbush` eram comentários; `noise()` é o sistema de ÁUDIO.)
RNG de gameplay (proc crit, doubleTap, spawns) permanece fora do draw —
disciplina E0 intacta. O F deve herdá-la: peças estruturais novas usam
`visualSeed`/`phase`/`runTime`, nunca RNG.

## 22. Performance (medições no HEAD, Canvas mock — não é FPS real)

| entidade | ops/draw | shadowBlur>0 | gradientes | save/restore | drawImage |
|---|---:|---:|---:|---:|---:|
| player (qualquer operador, idle) | 120–135 | 8 | 1 (cacheado) | 6 | 0 |
| Echo aliado slot1 (+labels/ghosts) | 133–265 | 8–16 | 1 | 6 | 0 |
| ECO SOMBRIO | 141 | 8 | 0 | 7 | 0 |
| Presença Temporal (com ghosts) | 271 | 16 | 0 | 14 | 0 |
| Paradoxo | 49 / 94 (3 beams) | 2 / 8 | 1–4 | 3 | 0 |
| minibosses (8) | 77–182 | **0** | 1–2 | 2–14 | 1 (glowSprite) |
| inimigos comuns (11) | 32–81 | 2–6 | 0–1 | 2–4 | 0 |
| projétil (família E) | 17–25 | 0 | 0 | 0–1 | 1 |
| swing melee (pico) | 23 | 0 | 0 | 0 | 0 |

Contexto: `shadowBlur` é a operação dominante (PR15.5-A já migrou halos de
partículas/miniboss para `glowSprite`+`drawImage`). Histórico humano:
~60 FPS caindo para ~55 sob carga no Electron (PR15_5_PERFORMANCE_AUDIT1).

**Orçamento recomendado para F (guarda a adicionar no F8):**

- corpo do operador (drawUnit p/ player): ≤ **200 ops** e **≤ 8 blur**
  (migração de glows estáticos para glowSprite conta como redução);
- Echo/Presença: ≤ 300 ops;
- nenhuma nova fonte de blur por entidade sempre-presente; gradients só
  cacheados (`linGrad2/radGrad2`);
- suíte F0 já trava miniboss blur=0 (F10) e contagens de grupos (C02/C03).

## 23. Hierarquia visual (avaliação por leitura de código + assinaturas)

| par | risco | evidência |
|---|---|---|
| jogador se encontra facilmente? | **ok** | corpo opaco (alpha 1) + arco de mira + retícula; Ecos têm alpha .72 |
| Echo confundido com player? | **risco REAL** | mesma silhueta estrutural (drawUnit idêntico); separação atual é alpha+cor+labels; quando F der silhuetas distintas aos operadores, o Echo herda? NÃO AUTOMÁTICO — decidir em F4 (Echo usa paleta própria cyan/magenta, não a do operador) |
| Repetição confundida com Echo? | ok | PTM por metadata; traço duplo "forte" magenta vs sutil ciano; prioridade REPLAY |
| Phantom desaparece demais? | risco condicional | alpha .16 em ghost (intencional: intangível) + materialize telegraph; validar em replaytest |
| Singular comunica perigo? | ok | anéis colapsando + arco 420 + núcleo preto |
| miniboss comunica importância? | ok | r 34–56, spawn signature, banner, HUD próprio |
| Paradoxo domina sem esconder telegraphs? | ok | corpo compacto (r 66, 49 ops) e telegraphs em escala de arena; beams/gravs/shocks têm leitura própria |

## 24. Cores temporais (gramática atual — não redefinir)

| cor | significado dominante | conflitos documentados |
|---|---|---|
| `#46e0ff` ciano | presente/Eco slot1/presença/plasma | anômalo (cópia de aberração) |
| `#8ff6ff` ciano-claro | escudo/BULWARK operador/rail/Sentinela/elite shield/vault | **maior colisão do jogo (115 ocorrências)** |
| `#ff4df0` magenta | temporal ARMED/Ressonância/Eco slot2/Paradoxo/ECHO-0/dis hostil-adjacente | sobreposição semântica intencional do sistema temporal |
| `#ff2f5e` | hostil/dano/Dissonância hostil/reactor | tank/colossus compartilham vermelho |
| `#ffd166` ouro | economia/med/NÔMADE operador/Oráculo miniboss | dupla leitura operador×miniboss |
| `#39d98a` verde | HARDEN operador/brood miniboss/spawner | dupla leitura |
| `#a8ff3d` lima | REVENANT operador/leech miniboss/corrStatus | dupla leitura |

**Regra para F:** forma continua carregando identidade; cor é apoio. As
colisões operador×miniboss (I02 na suíte) são **aceitáveis hoje** porque a
forma difere — mas o rework de operadores NÃO deve criar novas colisões, e
quando a silhueta do operador mudar, revalidar contraste contra o miniboss da
mesma cor em cenário real (replaytest F3).

## 25. Facções (interseções apenas)

- Operadores e Ecos **não têm vínculo de facção** no HEAD (nenhum campo, nenhuma
  leitura). `fpTagAlly(ally,faction,presenceId)` existe como hook de ANOTAÇÃO
  para aliados de evento (B2-G), sem efeito ofensivo/defensivo e **sem callers
  vivos** em entidades de F.
- Presenças físicas de facção (PR14-B3) têm renderers próprios
  (`fpDrawAnchor` âncora ⬡, `fpDrawConsortium` cofre ◈, …) — **separados do
  F**; documentados aqui só como fronteira.
- Nada do PR14 será absorvido pelo F.

## 26. Dependências de G (mundo/eventos/Fracture)

Registradas, sem implementar: corpo do Paradoxo × ambiente (gravs/shocks em
escala de arena se leem como "ambiente hostil" — rework de corpo em F não deve
competir com eles); Echo × Fracture (a Dissonância aumenta com pressão de
fratura — visual já parametrizado por `_ds`); eventos 1–20 (renderers
`renderRift/renderAmbush/renderVault/renderScrap/…`, beacon, obeliscos/nós de
intenção `pr15IntentDraw`) permanecem 100% em G. Fracture global (state
`'fracture'`, aberração, shake) intocado.

## 27. Fronteira com PR16 (Bosses Adaptativos)

- A adaptação atual do Paradoxo (`bossIntel=analyzeEchoData()` → modo
  ANTI-DISTÂNCIA/ANTI-AGRESSÃO, dashes do jogador aceleram shocks, HP escala
  com echoQueue) é **o embrião real do PR16**.
- F toca APENAS: corpo central, leitura de hurt, corpse de morte — nada de
  `mode`, `bossIntel`, escalada, fases, spawns.
- Ecos Sombrios (builds do jogador reutilizadas) são conteúdo PR16-adjacente:
  F só pode redesenhar o que já existe (`drawShadow`), sem novos comportamentos.
- Telegraphs (beams/gravs/shocks) são contrato de leitura — intocáveis por F.

## 28. Fronteira com PR18.5 (Identidade dos Operadores)

- **PR15.5-F fica com:** silhueta, corpo, leitura visual, animação visual,
  integração visual da arma (sprite na mão), diferenciação imediata em jogo e
  no seletor (`charPortrait`).
- **PR18.5 fica com:** gameplay/stats/meta (perks, specials, unlocks),
  personalidade/narrativa (lore já existe e não é alterada por F), progressão,
  cosméticos, conteúdo novo, sistemas específicos.
- O rework visual NÃO pode usar gameplay como muleta: nenhuma mudança de
  hp/speed/r/slots/perk/sp. A suíte F0 trava o inventário mecânico (bloco A).

## 29. Matriz de candidatos ao rework

| entidade | tipo | renderer | identidade atual | problema | risco | prioridade | bloco | dependências | human test |
|---|---|---|---|---|---|---|---|---|---|
| 8 operadores (corpo) | jogador | drawUnit compartilhado | palette-swap puro | falha no teste de silhueta; 0 peça estrutural | médio (4 famílias de entidade usam drawUnit) | **P0** | F1–F3 | âncoras §18; suíte C | sim (silhueta + leitura) |
| charPortrait (menu) | UI | 1 template SVG | paleta | mesma silhueta no seletor | baixo | **P1** | F3 | seguir corpo final de cada operador | sim |
| Echo aliado × player | entidade | drawEchoEntity/drawUnit | distingue só por alpha/cor/label | confusão em cena densa | médio | **P1** | F4 | decisões de F1 (herança de silhueta) | sim |
| boss/miniboss/ECO SOMBRIO death | entidade | fallback C | sem corpse | morte sem assinatura material | baixo | **P1** | F6 | pipeline C (perfis novos por família) | sim |
| Paradoxo corpo | boss | drawBoss próprio | hex+tri+núcleo legível | hurt fora do pipeline C; corpo genérico | médio (telegraphs) | **P2** | F7 | §13; PR16/G boundaries | sim |
| Phantom visibilidade | inimigo | drawEnemy próprio | translúcido intencional | alpha .16 pode sumir em áreas claras | baixo | **P2** | F5 (condicional) | replaytest B | sim |
| Singular | inimigo | drawEnemy próprio | completa (B+C) | nenhum identificado | baixo | fora do F | — | — | — |
| minibosses (identidade) | miniboss | 8 renderers B5-A | completa | nenhum estrutural | baixo | fora do F | — | — | — |
| inimigos comuns (identidade) | inimigo | 11 branches B | completa | nenhum (B preservado) | baixo | fora do F | — | — | — |
| Presença Temporal | temporal | pr15PresDraw | translúcida, anéis | nenhuma crítica (não-combatente) | baixo | fora do F (verificação F4) | — | — | opcional |
| Repetição | sistema | camada E2 | correta e independente | nenhuma | — | fora do F | — | — | — |
| colisões de cor operador×miniboss | gramática | — | 4 pares | dupla leitura cor-first | baixo | **P2** | F3/F8 (verificação) | §24 | sim |

## 30. Proposta de sub-blocos F (nascida do código atual)

> Princípio: repetir o padrão que o próprio código já consagrou duas vezes
> (inimigos B, minibosses B5-A) — **perfil declarativo + renderer próprio +
> teste de silhueta + replaytest** — agora aplicado a `drawUnit`.

- **F1 — Fundação de silhueta dos operadores.** Tabela declarativa
  `OPERATOR_VISUALS` (id → peças estruturais, proporções, assimetria,
  assinatura) + hooks no `drawUnit` (opts; fast path inalterado sem perfil).
  Zero mudança visual neste bloco; suíte F0 atualizada com harness de
  silhueta parametrizado.
- **F2 — Operadores grupo A (VECTOR, WRAITH, BULWARK, PYRE).** 1–2 peças
  estruturais exclusivas cada, proporcionais a `r`, derivadas da função
  (ex.: BULWARK maciço/placas; WRAITH lâminas finas; PYRE vents; VECTOR
  estabilidade simétrica). Arma continua o sprite D/E na mão — sem renderer
  paralelo. Testes: silhueta distinta (≥6 grupos), âncoras §18, orçamento
  §22, pureza, RNG-free.
- **F3 — Operadores grupo B (HARDEN, NÔMADE, ECHO-0, REVENANT) + charPortrait.**
  Idem; sincronizar o template SVG do seletor (template único com peças por
  perfil — sem 8 SVGs manuais).
- **F4 — Echo/presenças temporais.** Verificar herança de silhueta (decisão:
  Echo mantém silhueta de operador com paleta temporal própria — recomendado,
  é a linguagem "versão temporal de você" — ou ganha delta próprio); labels
  e Dissonância preservados; contraste player×Echo validado em replaytest.
- **F5 — Phantom/Singular (condicional).** Executar SOMENTE se o replaytest
  humano dos blocos anteriores apontar perda de visibilidade; escopo mínimo.
- **F6 — Fechamento hurt/death de especiais.** Habilitar perfis de morte
  (corpse C) para minibosses, Paradoxo e ECO SOMBRIO + hurt pose C onde couber
  sem destruir flash legível.
- **F7 — Corpo do Paradoxo.** Leitura do corpo central + hurt no pipeline C;
  telegraphs intocados (§13); fronteira PR16/G respeitada.
- **F8 — Integração/performance/replaytest final.** Guarda de orçamento (ops/
  blur por entidade), metrics overlay em sessão humana, atualização da suíte
  F0 como registro final, replaytest completo.

Cada bloco: pequeno, objetivo visual claro, testado, replaytest humano, zero
mudança mecânica (hp/speed/r/dmg/IA/colisão), sem cherry-picks grandes.

## 31. Riscos

1. **drawUnit é compartilhado por 4 famílias de entidade** (player/Eco/
   Sombrio/Presença) — mudar o corpo sem gating por perfil pode alterar
   entidades temporais sem querer (mitigação: hooks opt-in F1).
2. **Âncoras r+6/r+10/`r*.86`** — silhueta nova pode desalinhar muzzle/projétil
   (§18.1).
3. **Suítes existentes travam estado atual** (operators.test, f0 C-blocks) —
   atualização deve ser deliberada e documentada, nunca "consertar o teste".
4. **Blow de custo**: 8 operadores × peças novas em entidades sempre-presentes
   (budget §22).
5. **Colisões de cor** (§24) podem piorar se peças estruturais usarem cores
   de minibosses.
6. **Fronteiras**: PR16 (adaptação do boss), PR18.5 (gameplay/meta do
   operador), G (ambiente/eventos) — delimitadas em §26–28.
7. **Repetição/Echo**: qualquer mudança em `drawUnit` NÃO deve criar caminho
   mecânico novo para Repetição (regra absoluta §10).

## 32. Roteiro de replaytest humano (para F1+; F0 não tem rework)

1. `npm start` → Sandbox (F1) → selecionar cada operador (grade 4×2).
2. **Teste de silhueta:** screenshot monocromático (filtro de cinza) de cada
   operador idle+moving, sem HUD — identificar sem label. GO: 8/8; NO-GO:
   qualquer par trocado.
3. **Âncoras:** disparar plasma/rail/tesla de cada operador — muzzle nasce no
   cano? golpes melee saem da mão?
4. **Echo×player:** run com 2 Ecos em cena densa (20+ inimigos, projéteis) —
   o player se encontra em <1 s?
5. **Miniboss da mesma cor do operador** (BULWARK×Sentinela etc.) — confusão?
6. **Paradoxo:** waves 19→20 — beams/gravs/shocks continuam legíveis com o
   corpo novo; morte tem assinatura própria.
7. **Performance:** metrics overlay (PR15.5) durante tudo — sem queda além do
   aceito (~55 FPS sob carga no hardware do playtest histórico).

---

## 33. Artefatos desta auditoria

- `PR15_5_F0_CHARACTER_ENTITY_VISUAL_AUDIT.md` (este documento).
- `tests/pr15-5-f0-character-visual-audit.test.js` — 87 checks (inventário,
  renderer mapping, silhueta, âncoras, Echo/Repetição, minibosses, D/E,
  RNG-free, cores, pureza). Descoberta automática pelo runner.
- `index.html` — **intocado** (byte-idêntico ao HEAD base).
- Fetch de 2 objetos git históricos (metadados de objeto, não arquivos de
  trabalho) para reproduzir a baseline no clone shallow.

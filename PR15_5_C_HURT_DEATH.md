# PR15.5-C — Hurt/Death: Reação ao Dano, Identidade Material e Morte por Família

**Alvo:** os 11 inimigos comuns (`chaser, shooter, tank, spawner, anomaly, swarm,
orbiter, bulwark, splitter, phantom, singular`) — Canvas 2D procedural.
**Base:** `5d8e244` (PR15.5-D, replaytestado, ~60–70 FPS).
**Escopo de fora:** boss/miniboss (PR15.5-F), Echos e player (reuso gratuito apenas).

---

## 1. Regra absoluta — camada estritamente visual

Nada neste PR toca: HP, dano, armor/shield, velocidade, knockback, stun, spawn,
rewards, XP, drops, IA, hitbox, callbacks de morte, RNG mecânico, balance,
comportamento de boss/miniboss, PR15 Memory ou save.

Concretamente garantido por teste (suíte K do brief, itens J/I):

- `damageEnemy`, `updateEnemy` **byte-idênticos** à base (hash SHA-256 — J13/J14);
- `killEnemy` idêntica **exceto 1 linha visual documentada**
  (`deathVisualPush(e)` — J12 prová o strip);
- o corpse **jamais** chama `damageEnemy`/`killEnemy`/`itemEmit`/`xporbs`/
  `pickups.push`/FX (E19, verificação estática do bloco);
- corpse não entra em colisão/targeting/dano (E17/E18);
- RNG mecânico consumido é **idêntico** ANTES×DEPOIS em 200 frames de dano (I06)
  e em 3 cenários de morte (gate G5 do benchmark).

## 2. Inventário real e classificação de massa/material

11 tipos do `EDEFS` (A16/A17). Cada tipo recebeu `massClass`/`materialClass`:

| tipo | massa | material | leitura de dano | leitura de morte |
|---|---|---|---|---|
| chaser | light | carapace | recuo + rotação + squash elástico | snap rápido (contração) |
| swarm | tiny | organic | mínima deformação, mais barato | flicker (some) |
| tank | heavy | armor | quase imóvel, compressão curta | collapse lento de peças |
| bulwark | heavy | shield | a placa cede na direção da frente | plate-fall (placa cai da frente) |
| spawner | heavy | organic-armor | a fenda central reage | core-collapse (núcleo abre e some) |
| shooter | light (energy) | plasma | orbe pulsa/interrompe o brilho | dissolve de dentro p/ fora |
| orbiter | light (energy) | plasma | anéis dessincronizam | dissolve de dentro p/ fora |
| anomaly | anomalous | instável | jitter amplifica, assimétrico | implosão (anel contrai) |
| splitter | medium | cristalino | microfissura abre sem path novo | divide em 3 shards angulares GRANDES |
| phantom | spectral | fase | dip de alpha + eco de fase | phase-out (dashing, sem corpo) |
| singular | anomalous | gravitacional | compressão radial dos anéis | implosão + anel final |

## 3. `ENEMY_IMPACT_PROFILES` — a camada de classificação

- Tabela **pré-computada e congelada** (`Object.freeze` em 3 níveis — A02);
  exatamente 11 entradas (A03) + `ENEMY_IMPACT_PROFILE_FALLBACK`.
- Lookup O(1) por referência de tipo, retorna a **mesma referência** (A04/A21).
- **Zero duplicação de stats mecânicos**: nenhum campo `hp/spd/dmg/xp/r/armor/
  range/cooldown/knockback/hitbox/damage` existe no perfil (A05).
- Evolve o sistema existente (a fundação PR15.5-A `visualHurtPose` agora
  consulta o perfil do tipo) — não é um segundo sistema paralelo.
- Tipos fora do escopo (`boss`, `miniboss`, `shadow`, qualquer desconhecido)
  recebem o **fallback** congelado: hurt genérico legado, `death:null`
  (sem corpse — A06). O pipeline shared é compatível e seguro.

## 4. Tabela de semântica de dano (hurt)

`dur` em s; `off·r` = deslocamento como fração do raio; `rot` em rad;
`sq`/`st` = squash/stretch; `dip` = dip de alpha; `int` = intensidade.

| tipo | dur | off·r | rot | sq | st | dip | int |
|---|---|---|---|---|---|---|---|
| chaser | .11 | .30 | .05 | .18 | .10 | 0 | 1 |
| swarm | .09 | .20 | .04 | .12 | .06 | 0 | .7 |
| tank | .13 | .06 | .015 | .14 | .04 | 0 | .9 |
| bulwark | .12 | .05 | .012 | .10 | .03 | 0 | .8 |
| spawner | .12 | .05 | .015 | .12 | .04 | 0 | .8 |
| shooter/orbiter | .11 | 0 | 0 | .04 | 0 | .15 | 1 |
| anomaly | .10 | .10 | .05 | .10 | .10 | 0 | 1 |
| splitter | .12 | .12 | .04 | .14 | .08 | 0 | .9 |
| phantom | .12 | .15 | .02 | .06 | .10 | .30 | .8 |
| singular | .13 | .04 | .01 | .12 | .05 | 0 | .9 |
| FALLBACK (legado) | .11 | .05 | .018 | .025 | — | 0 | 1 |

Durações bounded em (0, .2] s (A08). Leve recua **>2×** o pesado (D01/D02);
pesado offset ≤ .07·r e rotação ≤ .02 rad (D03); energético zero
deslocamento/rotação — a reação é interna (D04).

## 5. Durações de morte (death)

Estilos: `snap, flicker, collapse, plate-fall, core-collapse, dissolve, implode,
divide, phase-out, implosion` (A10). Todas bounded em [.12, .40] s (A09/F12):

chaser .16 · swarm .12 · tank .34 · bulwark .30 · spawner .30 · shooter/orbiter
.20 · anomaly .20 · splitter .22 · phantom .26 · singular .30.

## 6. Pipeline de hurt — lazy, coalescente, direção real

- **Lazy:** estado visual só existe após o 1º dano real (`visualPeek`/tick/draw
  idle não criam estado — B01–B04; 46 inimigos × 600 frames sem nunca ser
  atingidos = zero estados, I13).
- **Coalescente, sem fila:** o hit mais recente **substitui** o anterior
  (10000 hits → chaves estáveis ≤ 20, zero arrays — B07/B10). Contrato da
  fundação preservado (≤ 20 chaves em `e.visual` — B06).
- **Direção da ORIGEM REAL do dano:** `damageEnemy` já recebe `srcx/srcy` em
  todos os call sites; o evento pré-computa o vetor unitário `hitX/hitY`
  (1 hip + 2 divisões **no evento**, zero trig por frame — C10). Origem
  colapsada/NaN → fallback determinístico pela direção do `aim` (B08–B12).
- **Phase empacotado em int 0..3** (quadrante do impacto) — nenhum objeto novo
  por frame (B14).
- **Scratch reutilizado:** `visualHurtPose(e)` devolve o mesmo scratch global
  a cada frame (C09/I12) — zero alocação em regime.
- **DoT** também registra hurt (C04); **intangível** (phantom ghost) e
  **anômalo fora de fase** não registram (C05/C06); **bulwark bloqueado**
  ainda registra (dano reduzido é dano — C07).
- Flash legado (`flashT`) preservado (C02); ataque em curso **não** é
  cancelado pelo hurt (C12).

## 7. A pose por frame (renderer)

`drawEnemy` aplica, quando há hurt ativo, **exatamente** 3 operações extra —
1 `translate` + 1 `rotate` + 1 `scale` (C15) — e nada mais; expirado volta ao
número original (C16). Sem path novo, sem `shadowBlur` (Δblur = 0 no hurt
isolado e nos cenários B/C — gate G2). A identidade por família muda os
**argumentos** existentes (raios do orbe, centro da placa, gap da fissura,
alpha do eco), não a quantidade de operações (D05–D17).

## 8. Morte — claramente distinta do hurt

Hurt = deformação reversível curta (≤ .13 s). Morte = evento único com
estilo próprio por família (≤ .34 s) e identidade de material nos
fragmentos:

- **leve:** snap — contração + até 3 fagulhas;
- **enxame:** flicker — o corpo recolhe e some (1 fill, 0 stroke — F02);
- **pesado:** collapse / plate-fall / core-collapse — 2–4 peças lentas,
  ≤ 5 paths (F04), sem explosão de shards;
- **energético:** dissolve de dentro p/ fora, ≤ .25 s (F05), zero fragmentos;
- **espectral:** phase-out — dashing + eco, **sem fill de corpo físico** (F06),
  fade não-linear (decai mais que o linear no fim — F10);
- **cristalino:** divide — 3 shards angulares GRANDES (F09), sem tempestade;
- **anômalo:** implosão — o anel **contrai** com o tempo (F07), não explode;
- **invocador:** core-collapse — a fenda abre e o núcleo some.

## 9. O corpse (`deathVisuals`) — registro visual inerte

- **Cópia mínima (10 campos):** `x, y, r, type, color, aim, dir, t, dur, seed`
  (E03). Zero campos de gameplay — `hp/vx/vy/dmg/xp/spd/...` jamais copiados.
- `dir` = direção **real** do último dano (1 `atan2` no evento de morte),
  fallback `aim`; `seed` = `e.visualSeed` (determinístico por spawn — zero RNG
  no draw); bulwark preserva a **frente** (`shieldAng → aim`) no cadáver (E05).
- **Cap fixo e explícito:** `DEATH_VISUAL_CAP = 24`. Quando cheio, o mais novo
  é **ignorado** (O(1), determinístico) — os 24 mais velhos continuam drenando
  (E06/E07: 46 mortes → 24 corpses, exatamente os primeiros 24).
- **Pool bounded** (`DEATH_VISUAL_CAP*2`): zero alocação em regime (E09).
- **Lifetime curta** por família; remoção determinística no `deathVisualTick`
  (chamado no loop principal, no mesmo relógio das partículas; no-op vazio).
- **Remoção em:** `resetRunWorld` (Save/Continue — E20),
  `sandboxClearRunState` (Sandbox — E21).
- Boss/miniboss/shadow **não geram corpse** (fallback `death:null` — E02/E23).
- Remoção mecânica direta (`e.dead=true` sem `killEnemy`) não gera corpse (E22).

## 10. Inerência do corpse — o que ele NUNCA faz

Verificado por teste:

- não causa dano ao jogador mesmo sobreposto (E17);
- `pickTarget`/`damageEnemy` não o consultam (E18, estático);
- o bloco inteiro não chama `damageEnemy|killEnemy|itemEmit|bumpProg|xporbs|
  pickups.push|spawnShards|spawnParticles|spawnRing|Math.random|setTimeout|
  setInterval` (E19);
- não persiste em checkpoint (E20);
- tick do corpse **não re-recompensa** (G04/G06: 200 ticks, kills/coins estáveis);
- draw é leitura pura: não remove corpse, não cria partículas, não consome RNG
  (I01/I04/I11/K04);
- NaN em qualquer campo é neutralizado no draw (K01/K02);
- type desconhecido → no-op seguro (K01); offscreen → cullado (F16).

## 11. Reward/XP/drop — exatamente uma vez

- `kills++` 1× (E12/G01), `onKill` 1× (G02), XP orbs somam exatamente o `xp`
  do inimigo 1× (E13/G03), créditos do drop 1× (G04/J11);
- morte por DoT mantém o pipeline (G07/G08);
- **splitter:** exatamente 2 filhos, 1×, íntegros (`hp=maxHp`), e **sem
  re-spawn** por tick do corpse (E16/G05);
- comparação contra a base mecânica 5d8e244 em mundo isolado com RNG semeado:
  créditos (E14), contagem de FX (E15), splitter (J07), crit (I07), knockback
  (I08), phantom intangível (I09), pull do singular (I10), 200 frames de dano
  (estado + consumo de RNG — I06) — tudo **idêntico**.

## 12. Tipos especiais

- **Splitter:** morte = `divide` (3 shards angulares grandes) + a divisão
  mecânica original intacta. O crack de dano abre a geometria existente
  (microfissura) **sem path novo** (D09).
- **Phantom:** dano = dip de alpha + 1 eco de fase (exatamente 1
  `beginPath`+1 `stroke` extra — D08); morte = phase-out **sem explosão
  física** (zero fill — F06).
- **Bulwark/Tank:** massa — deslocamento mínimo (D03), **sem** shake de
  câmera extra e sem muitos shards (F04); o cadáver do bulwark preserva a
  direção da placa (E05).
- **Singular:** dano = compressão radial dos anéis sem ops novos (D11); o pull
  mecânico termina **exatamente** no momento da morte — zero campo residual
  (F08; pull do vivo idêntico à base — I10).
- **Swarm:** o cenário-chave de stress (grupo morrendo em massa) é o mais
  barato de todo o arsenal: hurt = só o pose (1 transform extra, zero path
  novo — D13); morte = flicker de 7 ops (1 fill). **A redução de custo
  visual do PR15.5-B-FIX não foi revertida.**

## 13. Boss/miniboss fora do escopo (PR15.5-F)

Recebem o fallback: hurt genérico legado (mesma aparência de antes),
**sem corpse** (E02/E23). O pipeline shared trata qualquer tipo desconhecido
com segurança (A06/K01). Nada de boss/miniboss foi redesenhado aqui.

## 14. Player/Echos — reuso gratuito

O hurt do player continua no PR15.5-D/A (fora do escopo). Os Echos já usam a
fundação; nada aqui adiciona custo a player/Echos (o `deathVisuals` só é
populado por `killEnemy` de inimigos comuns).

## 15. Pureza do draw

- `drawDeathVisuals` vazio = **zero ops** (F15); com corpses, desenha
  exclusivamente (I11: o array antes/depois do draw é idêntico);
- `drawEnemy` com hurt **não muta a entidade** (C14, JSON antes/depois);
- save/restore balanceados e bounded (≤ 4 por corpse — F17);
- zero gradientes no draw do corpse (F14);
- **zero `shadowBlur` em todas as 11 famílias** (F13; gate G3).

## 16. Determinismo

- zero `Math.random`/`Date.now`/`performance.now`/timer/listener/RAF no bloco
  C (I04, verificação estática);
- draw do corpse com `Math.random` lançando → não lança (I01);
- mesmos campos de corpse → mesmo canvas (hash idêntico — F11);
- variação de fragmentos vem de `e.visualSeed` (fixo por spawn) + direção do
  último impacto + `t/dur` — 100% reprodutível;
- **RNG mecânico intacto:** I06 (200 frames: estado + consumo idênticos),
  G5 (benchmark: D/E/F com RNG total igual).

## 17. Performance — fast path e limites

- **Idle:** ops/frame **idênticos** ANTES×DEPOIS em 46 vivos (1132.76 =
  1132.76, gate G1); render idle **byte-idêntico** (hash do canvas — G6);
  46 × 600 frames sem dano → zero estados (I13);
- **Hurt:** O(1) no evento; por frame, exatamente 3 ops quando ativo (C15);
  zero `shadowBlur` (G2); zero trig por frame (C10 — melhorou: a pose da base
  fazia `atan2` por frame na janela de hurt, a nova não faz — K/L mostra
  atan2 0 vs 11.15/frame);
- **Death:** bounded por `DEATH_VISUAL_CAP` (24) + lifetime ≤ .34 s; pool
  limitado; descarte O(1);
- **Costo do corpse isolado por família** (ops de 1 `drawDeathVisuals`):
  swarm 7 < phantom 9 < anomaly 10 < shooter/orbiter 12 < bulwark 13 <
  chaser 14 < tank/spawner 16 < splitter/singular 21. **Blur: 0 em todas.**

## 18. Benchmark estrutural ANTES×DEPOIS (cenários A–L)

`audit_pr155/hurt_death_benchmark.js` (resultados em `hurt_death_results.json`).
Ops reais do Canvas mock — **não** ms, **não** FPS inventado.

| cenário | ops/frame A→D | blur A→D | RNG A→D | corpses máx |
|---|---|---|---|---|
| A idle 46 (600f) | 1132.76 → **1132.76** | 91.74 = 91.74 | 18842 = 18842 | 0 |
| B hits leves (600f) | 1240.49 → 1241.24 | 91.76 = 91.76 | 24342 = 24342 | 0 |
| C dano pesado (600f) | 1237.46 → 1239.98 | 91.95 = 91.95 | 19473 = 19473 | 0 |
| D 25 mortes 1/f | 0 → 44.44 | 0 = 0 | 5834 = 5834 | 20 |
| E 46 mortes quase simult. | 0 → 24.71 | 0 = 0 | 3923 = 3923 | 8 |
| F swarm em massa | 0 → 9.8 | 0 = 0 | 5315 = 5315 | **24** |
| G morte mista pesada | 0 → 65.3 | 0 = 0 | 6311 = 6311 | 18 |
| H melee + mortes | 0 → 0 | 0 = 0 | 1628 = 1628 | 8 |
| I ranged + mortes | 0 → 0.82 | 0 = 0 | 2162 = 2162 | 1 |
| J Sandbox/FX + mortes | 853.33 → 855.63 | 36.73 = 36.73 | 4035 = 4035 | 5 |
| K métricas ON + 24 corpses | 1170.15 → 1234.72 | 74.7 = 74.7 | 318 = 318 | **24** |
| L métricas OFF + 24 corpses | 1170 → 1234.57 | 74.7 = 74.7 | 318 = 318 | **24** |

**Gates (todos OK):** G1 idle ≤ base · G2 zero blur novo no hurt ·
G3 zero blur no corpse (11/11) · G4 corpses ≤ 24 sempre · G5 RNG mecânico
igual · G6 render idle byte-idêntico.

Leitura: o custo marginal do PR15.5-C aparece **apenas** quando há corpse vivo
no frame (D–G, K/L), é limitado pelo cap, e desaparece quando drenam. Hurt
custa ~+0.75 ops/frame com 46 inimigos sendo atingidos continuamente (eco do
phantom + transforms do pose) e zero ops no idle.

## 19. Suíte de testes — `tests/pr15-5-c-hurt-death.test.js` (163 checks)

Grupos: **A** perfis (21) · **B** lazy/coalescência/direção (14) · **C**
pipeline de hurt (16) · **D** reação por massa (17) · **E** corpse
segurança (23) · **F** morte por família (17) · **G** reward 1× (8) ·
**H** stress 46/melee/ranged/loop real (13) · **I** pureza/determinismo/RNG
(16) · **J** comparação mecânica vs base (14) · **K** robustez (4).

Destaques: mundo isolado da base 5d8e244 (harness + strip da linha de export
PR15.5-C, RNG L-CG semeado) para comparativas reais; `updateEnemy`/
`damageEnemy`/corpo de `killEnemy` provados byte-idênticos por hash SHA-256;
stress 46 inimigos, 5000 mortes sequenciais, render completo via `loop()` real.

## 20. Rebaselines (3) — nenhuma invariant enfraquecida

1. **`pr15-5-visual-foundation` D16** — de “valor fixo único” para “finito e
   bounded **por família**” (offset ≤ `perfil.hurt.offset·r`, rotação ≤
   `perfil.hurt.rotation`, alpha > 0). A invariante (finitude + bounds) é a
   mesma; só a constante virou a do perfil do tipo — **o teste ficou mais
   forte** (valida cada família contra o próprio contrato).
2. **`pr15-5-performance-audit1` — hash de `drawEnemy`** →
   `669f39f70bfb7f147c7a13ebda101dc90099379751c59ed912fec428c78b1dfe`.
   Motivo: `drawEnemy` ganhou a aplicação do pose por família (mudança
   **visual intencional**). As outras 23 funções da tabela foram verificadas
   **hash-idênticas** antes do rebaseline (precedente: `drawSwings` no PR15.5-D).
3. **`pr15-5-visual-foundation` G02** — não foi rebaseline de teste: o scan
   textual capturava tokens `Math.random`/`Date.now`/`performance.now`
   escritos em **comentários** do bloco C; os comentários foram reescritos
   (“zero aleatoriedade, relógio de parede…”) sem mudança de comportamento.

## 21. Save/Continue, Sandbox, DEV

- **Checkpoint:** `captureCheckpoint` não serializa corpse; `resumeRun` →
  `resetRunWorld` → `deathVisualClear` (E20: kill + checkpoint + resume → 0
  corpses).
- **Sandbox:** `sandboxClearRunState` limpa corpses; `sandboxRestart` não
  herda corpses do teste anterior (E21).
- **DEV:** remoção de miniboss no DEV não gera corpse (E23); DEV_MODE não
  altera o pipeline.
- **Slots:** runs isoladas por slot — estado de corpse é por-run (reset na
  troca).

## 22. Regressão completa

- Baseline 5d8e244: **52 suítes / 3208 checks / 0 falhas** (log arquivado).
- Com PR15.5-C: **53 suítes / 3371 checks / 0 falhas** (+163 = nova suíte).
- Nenhuma suíte anterior quebrou além das 2 rebaselines documentadas (§20).

## 23. Limitações

- O benchmark é **estrutural** (ops de canvas mock, trig, RNG) — não mede ms
  nem FPS em Electron; a confirmação de 60–70 FPS exige o replaytest humano
  (§24) num desktop real.
- O cenário E (46 mortes “quase simultâneas”) esgota o cap apenas indiretamente
  (máx 8 vivos ao mesmo tempo); o cap em 24 é exercitado diretamente em F/K/L.
- O draw do corpse usa `seed` fixo por spawn: dois corpses do mesmo tipo no
  mesmo instante têm variação de fragmentos idêntica — aceitável (cap 24,
  lifetime curta) e preferível a RNG no draw.
- Boss/miniboss seguem o fallback legado (fechamento em PR15.5-F).

## 24. Roteiro de replaytest humano (Electron) + GO/NO-GO

**Como rodar:** `npm start`, Sandbox (F1) ou run real. Matar intencionalmente,
por família, cada tipo listado — de perto, lendo **sem HUD**.

Por tipo, perguntar: **(h)** a reação ao dano parece do material certo?
**(d)** a morte é **claramente** outra coisa da reação?

1. **Chaser (leve):** (h) recua e “estica” na direção oposta ao impacto?
   (d) some num snap rápido?
2. **Swarm (grupo!):** (h) quase imperceptível — barato? (d) pisca e some?
   **Deixe 46+ swarm morrerm juntos** — o jogo segue liso?
3. **Tank (pesado):** (h) quase não se move — “peso”? (d) desmonta devagar,
   em 2–4 peças lentas (não explode)?
4. **Shooter/Orbiter (energia):** (h) o orbe “interrompe”/pulsa, sem se mover?
   (d) dissolve de dentro p/ fora, sem fragmentos?
5. **Bulwark:** (h) a placa cede **da direção da frente**? (d) a placa cai
   mantendo a direção?
6. **Splitter (cristalino):** (h) fissura abre no corpo? (d) quebra em 3
   shards angulares GRANDES — e os 2 filhos mecânicos continuam normais?
7. **Phantom:** (h) fica translúcido + eco de fase? (d) desmaterializa
   (dashing), sem explosão física?
8. **Singular:** (h) os anéis comprimem? (d) implode (anel contrai)?
   **O puxão mecânico para exatamente na morte?**
9. **Spawner:** (h) a fenda reage? (d) o núcleo abre e some?
10. **Anomaly:** (h) o jitter amplifica de forma assimétrica? (d) implode?

**Perguntas de sistema:**
- Dá para distinguir HIT de DEATH só pelo visual (sem HUD)?
- Dá para distinguir leve/pesado/energia/espectral/cristal só pelo
  comportamento?
- O FPS manteve-se 60–70 em: idle, 46 vivos, abates em massa de swarm,
  24 corpses simultâneos?
- Algum “flash” de tela, tremor de câmera novo ou explosão genérica que não
  existia antes? (qualquer um = bug)
- Save/Continue: após morrer e continuar, nenhum “cadáver” sobra?
- Sandbox: reiniciar o laboratório limpa os cadáveres?

**GO:** 10/10 tipos distinguíveis (h) e (d), sem regressão de FPS perceptível,
sem shake/flash novo, Save/Sandbox limpos.
**NO-GO:** qualquer item de mecânica violado (dano/knockback/reward/RNG),
qualquer FPS perceptível abaixo do baseline, ou reação ilegível.

---

## Resumo de arquivos

| arquivo | mudança |
|---|---|
| `index.html` | bloco PR15.5-C após `enemyVisualProfile` (~@5033): perfis + push/tick/clear/draw do corpse; `drawEnemy` aplica pose por família; `killEnemy` +1 linha (`deathVisualPush`); loop +`deathVisualTick`; render +`drawDeathVisuals`; resets limpam corpses |
| `tests/pr15-5-c-hurt-death.test.js` | **nova** — 163 checks (A–K) |
| `tests/pr15-5-performance-audit1.test.js` | rebaseline `drawEnemy` (documentada, §20) |
| `tests/pr15-5-visual-foundation.test.js` | D16 rebaseline por família (documentada, §20) |
| `audit_pr135/harness.js` | +1 linha de export (removível por strip; usada pelo mundo ANTES) |
| `audit_pr155/hurt_death_benchmark.js` | **novo** — benchmark estrutural A–L |
| `audit_pr155/hurt_death_results.json` | **novo** — resultados ANTES×DEPOIS + gates |
| `PR15_5_C_HURT_DEATH.md` | este documento |

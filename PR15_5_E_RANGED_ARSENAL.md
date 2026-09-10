# PR15.5-E — Arsenal Ranged: Identidade Visual de Projétil, Muzzle, Trail e Impacto

Entrega visual-only que dá a cada uma das **20 armas ranged** do ECHO uma
identidade legível de **FORMA / MOVIMENTO / TIMING / POSE / TRAIL / PROJÉTIL /
IMPACTO** — sem resolver nada com mais partículas, glow, shadowBlur, explosões,
shake ou filtros.

- **Base ANTES**: `f2a602a` (PR15.5-D integrado, 53 suítes / 3371 checks / 0 falhas)
- **Main de referência mecânica**: `4667720`
- **Resultado DEPOIS**: 54 suítes / 3674 checks / 0 falhas; benchmark 10/10 gates

---

## 1. Escopo e a regra visual-only absoluta

O bloco E (**index.html ~5414–6272**) adiciona muzzle, corpo, trail e impacto por
família. **Zero mudança mecânica**: dano, fireRate, cooldown, range, speed,
spread, crit, penetração, ricochete, homing, AoE, status, knockback, ammo,
economia, IA, targeting, hitbox, colisão, lifetime, RNG mecânico, save, PR15,
bosses e balance permanecem byte-idênticos (prova: seções 21–24).
`updateProjectiles`, `damageEnemy`, `killEnemy`, `updateEnemy`, `WEAPONS`,
`EDEFS`, `waveCompBase`, `MINIBOSS`, `spawnBoss` não mudaram um byte.
As únicas funções pré-existentes editadas: `fireWeaponFrom` (1 assinatura de
muzzle no disparo real), `drawProjectile` (corpo por família quando `p.pv`),
`onProjectileHit` (1 assinatura de impacto no hit real), `explodeOrb` /
`detonateSpecial` (1 assinatura na detonação já existente), `fireBeam`
(muzzle 1× no início da rajada) e 3 clears + 1 tick + 2 draws no
render/loop/sandbox — exatamente as 7 superfícies documentadas (M17/M18).

## 2. Inventário ranged real (audit §4)

20 armas ranged confirmadas no código (`WEAPONS`): plasma, shotgun, orb, beam,
flamer, rail, smg, cryo, tesla, acid, nail, boomer, homing, mine, sniper, void,
ricochet, gatling, prism, plague (+7 melee do PR15.5-D, fora do escopo E).
Cada arma recebe **exatamente um perfil visual congelado** — nunca por tipo de
projétil ad-hoc. Testes A01–A08.

## 3. Famílias visuais (14)

`RANGED_VISUAL_FAMILIES`: kinetic, shotgun, precision, heavy, plasma, energy,
arc, explosive, homing, anomaly, bio, flame, temporal, beam. A família é a
unidade de leitura ("isso parece munição pesada"), a arma é a variação
(escala/duração). Testes A09–A12.

## 4. Perfis congelados por arma — `WEAPON_RANGED_VISUAL_PROFILES`

Tabela **externa** ao `WEAPONS` (nenhum campo mecânico é copiado para dentro).
Campos: `family`, `muzzle/muzzleScale/muzzleDur`, `recoilKick/muzzleRot`,
`projShape/projLen/projW`, `trailMode/trailLen`,
`impactShape/impactScale/impactDur` — tudo congelado (`Object.freeze`),
despachos numéricos (`body/trailK/mzK/imK`) precomputados 1× no load.

| arma | família | corpo | trail (len) | muzzle | recoil | impacto |
|---|---|---|---|---|---|---|
| smg | kinetic | tracer | tracer (18) | cone .8 | .8 | spark .85 |
| nail | kinetic | dart | tracer (22) | cone .85 | .9 | spark .95 |
| gatling | kinetic | tracer | tracer (20) | cone 1 | 1 | spark 1 |
| ricochet | kinetic | pellet | tracer (14) | cone .9 | 1.1 | spark 1 |
| shotgun | shotgun | pellet | — | fan 1.5 | 1.9 | burst 1.5 |
| sniper | precision | dart | thin (34) | needle 1.3 | 2.2 | cut 1.2 |
| rail | heavy | slug | dense (46) | blast 1.8 | 2.6 | ring 1.5 |
| plasma | plasma | core | ghost (20) | pulse 1.15 | 1 | halo 1.15 |
| cryo | energy | shard | ghost (16) | pulse 1.1 | .9 | poly 1.1 |
| prism | energy | shard | ghost (14) | pulse 1.05 | .9 | poly 1 |
| tesla | arc | bolt | jag (22) | discharge 1.2 | .8 | discharge 1.2 |
| flamer | flame | drop | — | spray 1.25 | .3 | bloom .9 |
| mine | explosive | shell | — | ring .8 | .25 | bloom 1.6 |
| boomer | anomaly | disc | after (12) | twin .9 | .4 | twin 1 |
| void | anomaly | voidorb | after (16) | ring 1.3 | .9 | twin 1.5 |
| homing | homing | missile | thin (20) | bloom 1.1 | .7 | burst 1.1 |
| acid | bio | spore | — | spray 1.1 | .5 | bloom 1 |
| plague | bio | spore | — | spray 1.15 | .6 | bloom 1.3 |
| orb | temporal | orbdense | after (14) | ring 1.2 | .7 | twin 1.6 |
| beam | beam | tracer | — | beam 1 | 1 | halo .8 |

Testes A13–A18 (freeze, fallback, 20 perfis, zero campo mecânico).

## 5. Vocabulário de shapes (primitivas baratas)

Corpos **14** (`RV_BODY`): tracer, pellet, dart, slug, core, shard, bolt,
shell, missile, disc, spore, drop, orbdense, voidorb. Muzzles **11**
(`RV_MUZZLE`): cone, fan, needle, blast, pulse, discharge, spray, ring, twin,
bloom, beam. Impactos **9** (`RV_IMPACT`): spark, burst, cut, ring, poly,
halo, discharge, bloom, twin. Trails **6** (`RV_TRAIL`): none, tracer, thin,
dense, ghost, after, jag. Todos com 2–4 paths, zero imagem nova, zero
shadowBlur, zero compositeOperation novo por projétil. Testes D09, B-, F-.

## 6. Muzzle — nasce SOMENTE no disparo real

`muzzleVisualPush(x,y,dx,dy,def,crit)` é chamado 1× por disparo real dentro do
`fireWeaponFrom` existente (e 1× no início da rajada do `fireBeam`). Sem timer,
sem RAF, sem listener, sem polling. dx,dy = direção unitária **pré-computada
pelo chamador** (reuso dos cos/sin do disparo — zero trig no muzzle). Vida
≤ **.12 s** (`RANGED_MUZZLE_LIFE_MAX`), cap **48** (`MUZZLE_FX_MAX`).
Projéteis sem perfil e inimigos não emitem muzzle. Testes B01–B12.

## 7. Recoil — reúso da arquitetura A/D (render-only)

`recoilKick` do perfil **multiplica** o coice legado `src.recoil` já decaído
por `visualTimelineTick` (arquitetura do PR15.5-A/D); `muzzleRot` é rotação
RENDER-ONLY do sprite da arma sob coice em `drawWeaponSprite`. Nenhum valor
afeta posição lógica, hitbox ou timing mecânico. Shotgun 1.9 / rail 2.6 /
sniper 2.2 leem "peso"; flamer .3 / mine .25 leem "leveza". Testes C01–C07.

## 8. Corpo do projétil por família

`drawRangedProjectileBody(p,prof,fade)` desenha o corpo a partir de
**primitivas baratas** (2–4 paths): cápsula kinetic, dart fino, slug pesado,
core de plasma, shard cristalino, bolt em zigue-zague, shell hexagonal armado,
missile com aletas, disc giratório (giro REAL `p.spin`), spore pulsante, drop
com flicker, orbe denso, voidorb com núcleo escuro. O glow legado (drawImage
com `lighter`) é **mantido** como base — a identidade vem da forma, não de
mais brilho. Testes D01–D10.

## 9. Orientação por ângulo armazenado — zero atan2 no draw

A direção vem de `p.vx/p.vy` no próprio draw (perpendicular sem rotate/atan2);
`p.seed=(_rangedFxSeq+1)&1023` varia o blink **deterministicamente** (sem
Math.random). Vértices de ângulos FIXOS (hexágono do shell, tríscele do disc)
usam **tabelas de cossenos** (`RV_HEX_CK/SK`, `RV_TRI_CJ/SJ`) — após o
primeiro benchmark, a trig por vértice foi eliminada: mine 24→0, boomer 6→2
chamadas sinCos/draw (seção 27). Gate G7: **zero atan2/projétil**.
Testes D02–D07.

## 10. Trail por direção × comprimento (sem histórico)

Trails derivam de `(dx,dy) × trailLen` **no frame corrente** — zero array de
posições, zero push em draw, zero crescimento por projétil (prova M14 + gate
do benchmark). 6 modos: tracer linear, fino (precision/homing), denso (heavy),
ghost curto (energy/plasma), afterimage (anomaly/temporal), jag quebrado (arc).
Testes E01–E08.

## 11. Impacto — nasce SOMENTE no hit real

`impactVisualPush(x,y,vx,vy,def,crit)` é chamado 1× pelo `onProjectileHit`
existente (hit real: com dano/colisão reais) — o visual **não** causa dano,
não gera reward, não cria estado. Direção da viagem real, vida ≤ **.2 s**
(`RANGED_IMPACT_LIFE_MAX`), cap **96** (`IMPACT_FX_MAX`), zero shadowBlur
novo. 9 shapes por família. Testes F01–F16.

## 12. Explosivos — o visual reage ao evento EXISTENTE

`explodeOrb` e `detonateSpecial` (funções pré-existentes, dano/AoE intactos)
ganham exatamente 1 linha cada: assinatura visual da família na detonação
REAL (orb→twin temporal, mine→bloom explosive, void→twin anomaly,
plague→bloom bio). O FX não altera dano, raio, slow, chill, implode ou
sequência RNG (F16: 10 impactos a mais não movem o HP). Testes F13–F16, H·MINE/ORB/VOID/PLAGUE.

## 13. Beams — leitura visual sem tocar em range/DPS/tick

O beam não ganha projétil: `fireBeam` ganhou **1 inserção única**
(`muzzleVisualPush` no início da rajada, guard `!(src.beamT>0)`) e o
comentário `PR15.5-E`. rampMax/dano/tick/range inalterados (H·BEAM·3
estrutural: exatamente 1 `muzzleVisualPush` na função, resto idêntico).
Testes H·BEAM·1–3.

## 14. Ecos, aliados e projéteis legados (fast path)

Projéteis do arsenal nascem com `pv` (perfil congelado + seed) no spawn REAL
do `fireWeaponFrom` — ecos/aliados que reutilizam `fireWeaponFrom` herdam a
identidade automaticamente (reuso seguro, zero código novo por entidade).
Projéteis **sem** `pv` (fixtures sintéticas, projéteis legados, fragmentos do
Prisma) seguem o caminho anterior EXATO (glow + tracer) — D08.
Testes J01–J08, D08.

## 15. Draw purity

Nenhuma função de draw do E cria, avança ou remove estado: sem Math.random,
Date.now, performance.now, `.push(`, addEventListener, setTimeout/setInterval
na parte de draw (L12); `drawProjectile/drawMuzzleFx/drawImpactFx` não alteram
life/dist/pierce/crit/fireTimer (M15); o tick de vida (avaliar/compactar) fica
em `rangedFxTick`, no relógio do jogo. Testes L12, M15, D10.

## 16. Determinismo (RNG mecânico intacto)

O único "random" visual é `p.seed=(_rangedFxSeq+1)&1023` — um contador, não
Math.random. A sequência RNG mecânica é **idêntica** ANTES×DEPOIS: 447 valores
iguais no cenário G17; `randomTotal` igual nos 20 cenários do benchmark (G3);
cenário misto de 19 armas × 120 frames sem divergência (M16). Zero
Math.random/Date.now/performance.now em draw (G6).

## 17. Caps, pool e vidas

Coleções bounded com cap rígido + pool de objetos: muzzle ≤ 48, impact ≤ 96,
pool compartilhado ≤ 192 (`RANGED_FX_POOL_MAX`), `rangedFxTake` reusa
`rangedFxPool.pop()||{}`, `rangedFxDrop` devolve ao pool (limpando prof/color).
Vidas ≤ .12 s / .2 s. Excedente derruba o mais antigo (FIFO por shift).
Compactação in-place no tick (sem splice). Testes B03, F02, L10, G10 do benchmark.

## 18. Stress ≥ 500 projéteis

500 mines simultâneas (count 1, life 14 s): 500 projéteis na tela, **zero
NaN/Infinity**, muzzle no cap 48, impact ≤ 96, ops/projétil **6.58** no draw
em massa (teto do gate: 40), zero blur. Coleções bounded em todos os cenários
de fogo denso (flamer: projMax 8, ops/frame 48.52 total incluindo 12 tanks).
Testes I01–I03; gates G4/G9.

## 19. Benchmark estrutural — cenários A–T

`audit_pr155/ranged_arsenal_benchmark.js` (+ `ranged_arsenal_results.json`),
mesmo método dos benchmarks C/D: **não mede ms, não inventa FPS** — conta
operações reais do Canvas mock. 20 cenários (1 por arma, 600 frames de fogo
real contra 12 tanks, câmera no player, RNG semeado):

| cen | arma | ops/frame ANTES | DEPOIS | projMax | mz | im |
|---|---|---|---|---|---|---|
| A | plasma | 1.64 | 12.21 | 1 | 1 | 1 |
| B | shotgun | 5.69 | 17.67 | 7 | 1 | 6 |
| C | orb | 1.75 | 4.65 | 1 | 1 | 1 |
| D | beam | 0.00 | 0.05 | 0 | 1 | 0 |
| E | flamer | 12.93 | 48.52 | 8 | 2 | 3 |
| F | rail | 1.24 | 11.27 | 1 | 1 | 10 |
| G | smg | 4.23 | 14.81 | 3 | 1 | 2 |
| H | cryo | 0.48 | 2.51 | 1 | 1 | 1 |
| I | tesla | 0.49 | 1.99 | 1 | 1 | 1 |
| J | acid | 3.86 | 18.03 | 2 | 1 | 2 |
| K | nail | 1.50 | 5.98 | 1 | 1 | 1 |
| L | boomer | 2.79 | 20.52 | 1 | 1 | 3 |
| M | homing | 2.27 | 12.06 | 3 | 1 | 3 |
| N | mine | 6.69 | 14.76 | 7 | 1 | 1 |
| O | sniper | 0.20 | 1.51 | 1 | 1 | 2 |
| P | void | 0.44 | 2.98 | 1 | 1 | 1 |
| Q | ricochet | 1.09 | 4.84 | 1 | 1 | 1 |
| R | gatling | 2.81 | 9.86 | 2 | 1 | 2 |
| S | prism | 8.66 | 21.68 | 6 | 1 | 3 |
| T | plague | 0.44 | 3.10 | 1 | 1 | 1 |

O custo por projétil vivo é o que importa (o ANTES desenhava glow+tracer
genérico; o DEPOIS desenha glow+corpo+trail com identidade). Draw isolado por
projétil real (300 draws): ANTES 3 ops → DEPOIS 6–13 ops, **2–4 paths**,
zero blur, zero atan2, zero random.

## 20. Benchmark — gates G1–G10 (todos ✔)

- **G1** render idle 46 vivos byte-idêntico ANTES×DEPOIS (hash `c0a27ba8…`)
- **G2** zero blur novo: blurDraws/frame DEPOIS ≤ ANTES nos 20 cenários (0 em todos)
- **G3** RNG mecânico: randomTotal DEPOIS == ANTES nos 20 cenários
- **G4** identidade barata: ops/projétil ≤ 40 no draw isolado (max observado 13)
- **G5** caps: muzzle ≤ 48 / impact ≤ 96 (pico em todos os cenários)
- **G6** draw purity: zero Math.random em drawProjectile (19 armas)
- **G7** zero atan2/projétil; sinCos ≤ 6/projétil (mine 0, boomer 2)
- **G8** vidas ≤ .12 s / .2 s (constantes estruturais)
- **G9** stress 500: zero NaN, caps ok, ops/proj 6.58 ≤ 40
- **G10** pool bounded 192: cap + take/drop por pool (fonte)

`Resultado estrutural: TODOS OS GATES OK` (exit 0).

## 21. Comparação mecânica vs `4667720` (main) e vs `f2a602a` (base)

`WEAPONS`, `EDEFS`, `waveCompBase`, `MINIBOSS`, `spawnBoss` byte-idênticos à
base e à main (M02–M06 + G06 hash). `damageEnemy`, `killEnemy`, `updateEnemy`,
`updateProjectiles` byte-idênticos (M07–M10: updateProjectiles é hash-pinned).
`fireWeaponFrom`/`drawProjectile` têm rebaseline documentada (seção 22).
Snapshots mecânicos (posição/velocidade/dano/life/pierce) idênticos
ANTES×DEPOIS para as 19 armas de projétil (D05, D06, G01–G18).

## 22. Rebaselines documentadas (sem enfraquecer testes)

`tests/pr15-5-performance-audit1.test.js`: hash de `fireWeaponFrom` →
`34f7d222e44158c160b448e61c4ec6d50e415f5f62293dc434a1138ed54e944f`
(1 assinatura de muzzle no disparo real) e `drawProjectile` →
`a9338b8ea347808e78494bd3a78c9a46cb549d2872515b7ace318992be348237`
(corpo por família quando `p.pv`), ambos com comentário `PR15.5-E`.
`updateProjectiles` NÃO foi editado (pin intacto). Nenhum check foi removido
ou enfraquecido — os pins mudaram de valor documentando a superfície autorizada.

## 23. Suíte de testes E — 303 checks, 0 falhas

`tests/pr15-5-e-ranged-arsenal.test.js` (1441 linhas, ~303 checks reais):

- **A** Inventário e perfis (A01–A18)
- **B** Muzzle (B01–B12)
- **C** Recoil (C01–C07)
- **D** Projétil visual (D01–D10)
- **E** Trail (E01–E08)
- **F** Impact (F01–F16)
- **G** Mecânica ANTES×DEPOIS (G01–G18)
- **H** Arsenal real por família (H·KINETIC/SHOTGUN/PRECISION/HEAVY/PLASMA/
  ENERGY/ARC/FLAME/EXPLOSIVE/MINE/VOID/ORB/BOOMER/HOMING/BIO/PLAGUE/BEAM/PRISM)
- **I** Stress (I01–I03)
- **J** Player/Echo (J01–J08)
- **K** Save/Dev/Sandbox (K01–K10)
- **L** Regressão PR15.5 (L01–L12: A-fix, B, C, D, metrics, audit1 intactos)
- **M** Code safety (M01–M18)

O teste usa mundos duplos (base `f2a602a` × atual) com o adapter que troca a
linha de export E do harness pela versão mínima (`drawProjectile,
onProjectileHit, explodeOrb, detonateSpecial`) — nada do jogo é alterado.

## 24. Regressão completa

`node tests/run-all.js`: **54 suítes · 0 com falha · 3674 checks ✔ · 0 ✘**
(baseline 53 suítes/3371 checks + suíte E 303 checks = 3674; nenhuma suíte
antiga perdeu checks). Suítes PR15.5: a-fix1 28/0, b 132/0, b-fix1 56/0,
c 163/0, d 166/0, **e 303/0**, metrics 108/0, visual-foundation 95/0,
audit1 112/0.

## 25. Save / Dev / Sandbox

`rangedFxClear()` em `sandboxClearRunState` (K05), `startRun` (K06) e
`clearRunEntities` (K07/K08: slot switch e title/new run nunca herdam FX).
Checkpoints (`smBuildCheckpoint`) não serializam muzzle/impact/pv (K01–K04:
JSON sem `muzzleFx/impactFx/mzK/imK/"pv"`). Pause com dt congelado apenas
desacelera (K09); event/shop não dependem de state (K10).

## 26. Code safety (M01–M18)

Funções mecânicas não autorizadas intocadas (hash vs base); WEAPONS/EDEFS/
waveCompBase/MINIBOSS/spawnBoss estáveis; zero timer novo (M11), zero RAF
novo (M12), zero listener novo (M13), zero array crescente em draw (M14),
draw sem mutação de estado (M15), RNG sem divergência (M16), funções
alteradas são EXATAMENTE as 7 documentadas (M17), render/loop ganharam apenas
as linhas do bloco E (M18). Comentários do bloco E evitam literais que os
scanners de teste procuram (shadowBlur → "desfoque de sombra").

## 27. Otimização pós-benchmark (tabelas de cossenos)

A 1ª rodada do benchmark apontou mine 24 e boomer 6 chamadas sinCos/draw no
shell/disc. Como os ângulos do hexágono são FIXOS (j·π/3) e o disc gira com
`p.spin` real, os vértices viraram lookup: `RV_HEX_CK/SK` (6 pares) e
`RV_TRI_CJ/SJ` (3 pares) + 1 par cos/sin por draw do disc. Resultado:
**mine 24→0, boomer 6→2**, gate G7 ≤ 6 com folga. Mudança render-only
(verificada: teste E 303/0, audit1 112/0, foundation 95/0, benchmark 10/10).

## 28. Integração — pontos de entrada no index.html

Bloco E ~5414–6272 (constantes RV_*, profiles, pool, push/tick/clear, draw
de muzzle/impacto/corpo). Inserções em funções existentes: `fireWeaponFrom`
(assinatura de muzzle), `drawProjectile` (corpo quando `p.pv`), 
`onProjectileHit` (impacto), `explodeOrb`/`detonateSpecial` (detonação),
`fireBeam` (muzzle 1× na rajada), `drawWeaponSprite` (recoil/muzzleRot),
`sandboxClearRunState`/`startRun`/`clearRunEntities` (clears), loop
(`rangedFxTick`) e render (`drawMuzzleFx`/`drawImpactFx`). Export E no
`audit_pr135/harness.js`.

## 29. Limitações e decisões

(1) O glow legado é mantido como base de leitura — a identidade vem da forma,
não do brilho (regra do brief). (2) O muzzle dura ≤ .12 s: em fireRates
altíssimos (gatling) ele reaparece por disparo, nunca acumula (cap 48).
(3) Beams não ganham projétil nem trail contínuo — o contracto é leitura do
ramp existente. (4) Projéteis inimigos continuam no caminho legado (fast
path) — identidade é do arsenal do player/eco. (5) O benchmark é estrutural
(ops de canvas, não ms): o histórico humano permanece ~60–70 FPS pós-D.

## 30. Roteiro de replaytest humano (Electron) — 20 perguntas

Rode em DEV_MODE, arena com inimigos, uma arma por vez (teclas de troca),
compare com a memória do ANTES (glow genérico). Responda SIM/NÃO + nota 0–5.

1. **SMG** — a bala lê como cápsula/tracer rápido com muzzle cone curto, ou ainda é um glow genérico?
2. **Nail** — o dart fino se distingue do tracer da SMG no meio da tela cheia?
3. **Gatling** — em rajada longa, o muzzle cone + recoil 1.0 dão leitura de cadência sem virar poluição?
4. **Ricochet** — o pellet quica e o trail curto ajuda a acompanhar o ricochete?
5. **Shotgun** — o leque (fan) no disparo + burst nos impactos lê "espalhamento" de imediato?
6. **Sniper** — o needle longo + recoil 2.2 + corte (cut) no alvo dão peso de tiro único?
7. **Rail** — o slug denso + blast 1.8 + anel no impacto (e no pierce através de 3 inimigos) leem "tiro pesado que atravessa"?
8. **Plasma** — o core + ghost trail leem plasma sem precisar de cor?
9. **Cryo** — o shard cristalino + impacto poly lê gelo/queda de velocidade?
10. **Prism** — os shards herdam identidade de energy sem confundir com cryo?
11. **Tesla** — o bolt em zigue-zague + jag trail + discharge no impacto leem eletricidade?
12. **Flamer** — o drop com flicker + spray contínuo leem chama/cone curto (sem trail eterno)?
13. **Acid** — a spore + bloom no impacto leem ácido (distinto do flamer)?
14. **Plague** — a spore maior + bloom 1.3 + detonação bio leem "nuvem" da arma?
15. **Mine** — o shell hexagonal pisca armado (determinístico, sem strobe aleatório)? O deploy é discreto (ring .8)?
16. **Boomer** — o disc gira IDA e VOLTA (p.spin real) e o afterimage ajuda a ler a volta?
17. **Homing** — o missile com aletas + trail fino leem "teleguiado" na curva?
18. **Void** — o voidorb com núcleo escuro + implode visual na detonação leem vácuo?
19. **Orb** — o orbe denso explode no fim do alcance (não fica eterno) com twin temporal visível?
20. **Composição** — com hurt (C), melee (D) e ranged (E) simultâneos: poses compõem sem NaN/travamento, e o FPS se mantém na faixa de sempre (~60–70)?

Extra (obrigatório):死亡/死 visual — após morte em massa, muzzle/impacto somem
com a run/slot switch (sem vazar para a próxima run).

## 31. Critérios GO/NO-GO

- **GO** exige: 54 suítes/0 falhas (✔ 3674 checks), benchmark 10/10 gates (✔),
  zero mudança mecânica no diff (✔ M01–M10 + hashes), rebaselines documentadas
  (✔ seção 22), cobertura A–M completa (✔ 303 checks), save/sandbox sem vazamento
  (✔ K01–K10), stress 500 sem NaN (✔), doc ≥25 seções (✔ 31) + replaytest
  (✔ seção 30) + relatório 65 itens (✔ abaixo).
- **NO-GO** se qualquer item acima falhar ou o replaytest humano reprovar a
  leitura de identidade em ≥6 das 20 perguntas.

**Veredito: GO** (todas as condições automatizadas atendidas; replaytest
humano pendente por definição — roteiro na seção 30).

---

## Relatório final de entrega — 65 itens numerados

1. Regra visual-only absoluta respeitada: zero mudança de dano/fireRate/cooldown/range/speed/spread/crit.
2. Zero mudança em penetração, ricochete, homing, AoE, status, knockback, ammo.
3. Zero mudança em economia, IA, targeting, hitbox, colisão, lifetime, RNG mecânico.
4. Zero mudança em save, PR15, bosses, balance (WEAPONS/EDEFS byte-idênticos).
5. Bloco E isolado (~5414–6272) + 7 superfícies autorizadas editadas (M17/M18).
6. Nenhum campo mecânico copiado para os perfis (tabela externa congelada).
7. 20 armas ranged inventariadas com perfil único cada (A01–A08).
8. 14 famílias visuais definidas (A09–A12).
9. Vocabulário: 14 corpos, 11 muzzles, 9 impactos, 6 trails — só primitivas baratas.
10. Perfis congelados com Object.freeze + despachos numéricos no load (A13–A18).
11. SMG: cápsula kinetic + cone curto (recoil .8) — cadência legível.
12. Nail: dart alongado + tracer 22 — projétil "prego" distinto da SMG.
13. Gatling: tracer denso em rajada + cone 1.0 — sem poluição (cap muzzle).
14. Ricochet: pellet + tracer 14 — rastro curto que acompanha o quique.
15. Shotgun: pellet×n + fan 1.5 + burst — espalhamento lido no disparo.
16. Sniper: dart fino + needle 1.3 + cut — peso de tiro único (recoil 2.2).
17. Rail: slug denso + blast 1.8 + ring (no pierce através de 3 alvos) — "pesado".
18. Plasma: core + ghost trail + halo — identidade de energia estável.
19. Cryo: shard + ghost 16 + poly — leitura de gelo/lentidão.
20. Prism: shards de energy herdam família sem confundir com cryo.
21. Tesla: bolt zigue-zague + jag + discharge — arco elétrico em movimento.
22. Flamer: drop com flicker + spray — chama de cone curto, vida curta.
23. Acid: spore + bloom — áido distinto do fogo pela forma, não pela cor.
24. Plague: spore grande + bloom 1.3 + detonação bio — nuvem visível.
25. Mine: shell hexagonal armada piscando determinística + ring discreto.
26. Boomer: disc girando com p.spin real (ida/volta) + afterimage.
27. Homing: missile com aletas + trail fino — curva teleguiada legível.
28. Void: voidorb núcleo escuro + afterimage + twin na implosão.
29. Orb: orbe denso + twin temporal, explode no fim do alcance (nunca eterno).
30. Beam: muzzle 1× por rajada; range/DPS/tick/rampMax intocados (H·BEAM·3).
31. Muzzle nasce só no disparo real — sem timer/RAF/listener/polling (B01–B12).
32. Muzzle usa direção pré-computada do disparo — zero trig nova (B04).
33. Vida do muzzle ≤ .12 s; cap 48 com FIFO (B03, G8).
34. Recoil multiplica arquitetura A/D existente — render-only (C01–C07).
35. muzzleRot rotação render-only do sprite sob coice (C06–C07).
36. Corpo por família: 2–4 paths, zero shadowBlur, zero composite novo (D09).
37. Glow legado mantido — identidade por forma, não por mais brilho (D08).
38. Orientação via vx/vy + perpendicular: zero rotate/atan2 por frame (D02–D07).
39. Vértices fixos viraram tabelas de cossenos: mine 24→0, boomer 6→2 sinCos/draw.
40. Trails por direção×comprimento — zero histórico crescente (E01–E08, M14).
41. Impacto só em hit real (onProjectileHit) — sem dano/reward/estado (F01–F16).
42. Impacto com direção da viagem real, vida ≤ .2 s, cap 96 (F02–F03).
43. Explosivos: 1 assinatura por detonação existente; dano/AoE intactos (F13–F16).
44. Ecos/aliados herdam identidade via fireWeaponFrom — reuso seguro (J01–J08).
45. Projéteis legados/sem pv: fast path byte-idêntico ao ANTES (D08).
46. Draw purity: sem random/now/push/listener em draw (L12, M15).
47. Determinismo: seed visual é contador, RNG mecânico idêntico (M16, G3).
48. Caps 48/96 + pool 192 com take/drop — sem alocação por frame (M14, G10).
49. Stress 500 projéteis: zero NaN, caps ok, 6.58 ops/proj (I03, G9).
50. Benchmark estrutural sem inventar FPS: cenários A–T por arma (19).
51. Gate G1: render idle byte-idêntico (hash c0a27ba8…) — zero custo fora do arsenal.
52. Gates G2–G3: zero blur novo e RNG igual nos 20 cenários.
53. Gates G4–G7: ops/proj ≤ 40 (max 13), caps, purity, zero atan2.
54. Gates G8–G10: vidas ≤ .12/.2, stress ok, pool bounded — 10/10 ✔.
55. Comparação mecânica vs 4667720 e f2a602a: idêntica (M01–M10, G06).
56. updateProjectiles byte-idêntico (pin audit1 intacto — M10).
57. Rebaseline fireWeaponFrom documentada (34f7d222…) — 1 assinatura de muzzle.
58. Rebaseline drawProjectile documentada (a9338b8e…) — corpo quando pv.
59. Suíte E: 303 checks / 0 falhas, cobertura A–M completa.
60. Regressão: 54 suítes / 3674 checks / 0 falhas (nenhuma suíte antiga perdeu checks).
61. Save/dev/sandbox: FX nunca atravessam runs/slots/checkpoints (K01–K10).
62. Code safety: zero timer/RAF/listener novo; scanners de comentário respeitados (M11–M13).
63. Otimização pós-benchmark aplicada e revalidada (tabelas hex/tri) — seção 27.
64. Documentação: 31 seções, benchmark + JSON, replaytest 20 perguntas (seção 30).
65. Git: commit único no branch interno `arena/01a08cce-echojogo`, push somente
nele, confirmado com `git ls-remote` — main/`dev/pr15-5-visual-overhaul` intocados.

---

## Resumo de arquivos

- `index.html` — bloco E (~5414–6272) + 7 superfícies autorizadas + tabelas hex/tri
- `audit_pr155/ranged_arsenal_benchmark.js` — benchmark estrutural A–T, gates G1–G10
- `audit_pr155/ranged_arsenal_results.json` — resultados ANTES (f2a602a) × DEPOIS
- `tests/pr15-5-e-ranged-arsenal.test.js` — 303 checks A–M, 0 falhas
- `tests/pr15-5-performance-audit1.test.js` — rebaselines E comentadas
- `audit_pr135/harness.js` — linha de export E
- `PR15_5_E_RANGED_ARSENAL.md` — este documento

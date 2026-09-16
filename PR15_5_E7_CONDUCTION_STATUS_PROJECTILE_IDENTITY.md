# PR15.5-E7 — Identidade visual dos projéteis de CONDUÇÃO / STATUS

Família `PVF_CONDUCT` (definida no E1): **tesla**, **plague**.
Até aqui as duas caíam em `drawProjectileLegacyLine` — um traço reto de
comprimento 5 — e eram literalmente intercambiáveis quando recoloridas.
Eram, também, **os últimos ocupantes do ramo legado**: após o E7, nenhuma
arma de projétil do jogador depende do fallback. Este bloco lhes dá
gramática própria, com a regra do projeto: **a cor ajuda, a forma decide**.

Escopo: apenas o OBJETO LANÇADO. Não é muzzle (E8), não é impacto (E9).
Nenhuma mecânica foi alterada.

---

## 1. Base e baseline

- Base exata: `80b1349db55c615927f2c5905f5fe2a36a67d61f`
  (permanente `dev/pr15-5-visual-overhaul`, mensagem
  `PR15.5-E6: diferenciar projéteis fluidos e spray`, parent
  `5b8df0c9`).
- Pré-flight: clone shallow → `git fetch --unshallow`; HEAD restaurado em
  `80b1349`; working tree clean.
- Baseline pré-E7 reproduzida: **67 suítes · 4409 checks · 0 falhas**.

## 2. Auditoria mecânica — TESLA (o que o código REALMENTE faz)

`WEAPONS` → `fireWeaponFrom` → `updateProjectiles` → `onProjectileHit` →
`chainShock` / `applyStatus` / `tickStatus` → expiração. Sonda empírica
`/tmp/probe_e7_audit.js` (LCG, seed 55511122; `spawnT` zerado antes de
toda leitura de dano — armadilha de invulnerabilidade de spawn já
documentada no E5/E6).

| campo | valor | consumido? | prova |
|---|---|---|---|
| interval | .52 | ✔ | cadência real do disparo |
| speed | 820 | ✔ | nascimento `vx=819.63` (jitter .03) |
| dmg | 14 | ✔ | Δhp do alvo direto = 14.00 |
| count | 1 | ✔ | 1 projétil por disparo |
| spread | 0 | ✔ | — |
| jitter | .03 | ✔ | ângulo de nascimento varia ±.03 |
| life | 1.1 | ✔ | expiração por vida é silenciosa |
| pr | 4.5 | ✔ | `r` do projétil |
| kick | 38 | ✔ | recoil `player.vx=-38` |
| range | 470 | ✔ | `maxDist`; expiração solta 3 faíscas |
| **chain** | **2** | **✔ REAL** | `onProjectileHit` → `chainShock(e,dmg*.78,2+chainBonus,src)` |
| fx `shock` | 2s/1 | ✔ (marcador) | ver abaixo |
| pierce/aoe/homing/bounce/mine/boomerang/split | — | ausentes | nascem 0/indefinidos |

**Chain real, medido três vezes:**

- 3 alvos enfileirados a 100px: Δ = **14.00 → 10.92 → 8.5176**
  (razão exata **0.78** e **0.78²**); 2 arcos no array `arcs` (um por salto).
- Raio de busca: **230px** — a 220px encadeia, a 231px não encadeia
  (`bd=230*230` em `chainShock`).
- O salto escolhe o alvo mais próximo **não atingido** (`hitSet`), vivo e
  targetable; a recursão continua enquanto `jumps>1 && !best.dead`.
- Sem vizinho (alvo único ou >230px): 0 arcos, 2º alvo intocado.
- Alvos sobrepostos (2px): o chain salta para o vizinho colado —
  **2 feridos é mecânica, não perfuração** (pierce 0; o projétil morre).
- Visual histórico do chain: `arcs.push(...)` + `spawnRing` + procText
  `CADEIA` + tom de áudio, desenhados por `drawArcs` (jitter
  determinístico do E0). **Preservado byte-a-byte** — é a fronteira do
  §20: efeito histórico necessário para representar mecânica existente
  (A), não polimento novo de impacto (B, que é E9).

**Shock (fx 2s/1) é marcador, não DoT:**

- `applyStatus('shock')` grava `shockT=2`, `shockP=1`, `shockSrc=src`.
- `tickStatus`: `shockT` só decai — **0 de dano em 3s de tick** (medido).
- Consumo real: `damageEnemy` conta `shockT>0` como *afflicted* para a
  sinergia `afflictBonus` de itens; `drawStatus` pisca o raio no inimigo
  (visual de ALVO, fora do escopo E7).
- **`shockP` e `shockSrc` são write-only** — gravados e nunca lidos
  (1 ocorrência de cada no código, a própria gravação). Config morta
  documentada; NÃO corrigida (E7 é visual).

## 3. Auditoria mecânica — PLAGUE

| campo | valor | consumido? | prova |
|---|---|---|---|
| interval | .95 | ✔ | — |
| speed | 480 | ✔ | — |
| dmg | 16 | ✔ | Δhp do alvo direto = 16.00 |
| count | 1 | ✔ | 1 projétil |
| spread/jitter | 0 | ✔ | trajetória reta |
| life | 2.0 | ✔ | expiração por vida silenciosa |
| pr | 7 | ✔ | o maior `r` da família |
| kick | 30 | ✔ | recoil `player.vx=-30` |
| range | 450 | ✔ | `maxDist`; 3 faíscas no fim |
| **aoe** | **130** | **✘ MORTO** | ver abaixo |
| **contagion** | **true** | **✘ MORTO** | ver abaixo |
| fx `corrode` | 5s/.10 | ✔ REAL | ver abaixo |
| pierce/chain/homing/… | — | ausentes | — |

**Config morta da plague (achado do E7, precedente Void/E5):**

- `p.aoe` só é lido dentro de `explodeOrb`, e `explodeOrb` só é chamado
  sob `p.type==='orb'`. O projétil da plague NASCE carregando
  `aoe:130` — e o valor nunca é consumido.
- `d.contagion` só é lido dentro de `detonateSpecial`, e
  `detonateSpecial` só é chamado no ramo `if(p.mine)`. A plague não é
  mina — o bloco de contágio é inalcançável para ela.
- Provas empíricas: 2 alvos a 80px (dentro do "AoE 130") → **2º intocado,
  Δhp=0**; alvo com 1hp morto pelo impacto com vizinhos a 90px e 180px →
  **nenhum vizinho ganha `corrT`**.
- Consequência: a descrição da loja ("Nuvem tóxica que se ESPALHA:
  alvos mortos infectam os vizinhos") **não descreve a mecânica real**.
  Documentado; NÃO corrigido no E7 (zero gameplay).

**Corrode 5s/.10 é real (amplificador, não DoT):**

- `corrT=5`, `corrP=.10` aplicados **exclusivamente ao alvo atingido**.
- `statusDmgMul`: ×1.10 (1 stack), ×1.20 (2), teto **×1.60** (cap .60).
- 2s de `tickStatus`: **Δhp=0** — sem dano ao longo do tempo.
- Amplificação medida: dano 10 com 9 stacks → **16.00** (×1.60).
- Expira: após ~5s de tick, `statusDmgMul` volta a 1 e `corrP` zera.

## 4. Decisão visual

Nenhuma forma usa cor, glow, gradiente, RNG, `arc` (exclusivo do
orb/eorb) ou `runTime` para se diferenciar. Todas legíveis em silhueta
chapada.

| arma | forma | por quê (mecânica auditada) |
|---|---|---|
| **tesla** | **DESCARGA ENTRE TERMINAIS** — corpo em zigue-zague (3 segmentos, kinks alternados e desiguais) atravessado entre 2 traços perpendiculares de polaridade, o dianteiro maior. 100% traço, **zero fills** (2 strokes, 8 vértices) | o chain real acontece NO IMPACTO (arco histórico do `chainShock`), então o projétil em voo comunica apenas **carga conduzida**: geometria quebrada angular, condutor entre dois terminais. A quebra é FIXA — nada de flicker/RNG. É o único projétil do arsenal com zigue-zague |
| **plague** | **CÁPSULA CONTAMINANTE** — 1 corpo lobulado assimétrico de 6 vértices (lóbulo superior maior, cauda fora do eixo) + **3 espinhos curtos presos** em posições desiguais (1 fill + 1 stroke, 12 vértices) | sem AoE, sem nuvem, sem propagação (tudo config morta), o que existe é **contato direto que semeia corrode**: espora armada, massa pesada e lenta (speed 480, pr 7 — o maior da família). Orgânica por assimetria, não por curvas |

**Tesla ≠ Plague é estrutural, não cromático:** tesla é traço partido
linear e angular; plague é massa orgânica preenchida. Número de corpos
preenchidos (0 vs 1), continuidade (quebrada vs fechada), simetria
(nenhuma vs lobulada), apêndices (2 terminais transversais vs 3 espinhos
radiais). Recoloridas e com o mesmo raio, seguem imediatamente
distinguíveis (provado no bloco C da suíte, r ∈ {3,4,5,6,8}).

### Distinção contra todas as famílias (§12/§13/§14)

- **≠ E6 (flamer/acid):** tesla não é corpo alongado com cauda (é
  zigue-zague compacto entre terminais); plague não é gota com satélite
  (acid tem 2 fills disjuntos; plague tem 1 fill + stroke de espinhos).
- **≠ E5 (plasma/void/cryo/orb):** tesla não é "plasma com zig-zag" — o
  plasma é envelope hexagonal PREENCHIDO com núcleo; tesla é puro traço.
  Plague não é "orb irregular" — sem `arc`, e lobulada por vértices.
- **≠ E3/E4/E10:** varredura automatizada de topologia+geometria sobre
  as 16 armas redesenhadas + eorb + desconhecido: **nenhuma colisão**
  envolvendo tesla/plague. As colisões remanescentes no jogo são as
  pré-existentes `eorb == orb` (mesmo objeto, versão inimiga) e
  `gatling == shotgun` (E10, distinguidas por geometria) — fora do escopo.
- O zigue-zague de 3 segmentos num único path (`lineTo,lineTo,lineTo` +
  `stroke`) é topologicamente único no arsenal; o tríplice par de
  espinhos da plague separa-a da costura dupla da mine e das 2 aletas do
  homing.

### Custo (ops de Canvas por projétil)

`tesla` **22** · `plague` **26** (incluindo glow e o `set:globalAlpha`
final)

Referência: gatling 15 · ricochet 17 · rail 20 · flamer 18 · acid 21 ·
boomer 22 · cryo 22 · homing 23 · mine 24 · plasma 25 · **prism 26**.
Nenhuma forma do E7 ultrapassa o teto já aprovado. O tesla — cadência
.52, ~2× a da plague — é o mais barato da família; a plague iguala o
prism no teto, mas tem a segunda menor cadência do arsenal (interval
.95, só o orb 1.05 é mais lento). O teste `J07d` do E1 fixa
`tesla ≤ plague ≤ 26`.

Zero `shadowBlur` novo, zero `Path2D`, zero gradiente por projétil, zero
array temporário, zero `save/restore`, zero `rotate`.

## 5. Arquitetura

`drawProjectileConductionStatus(p)` — helper único, inserido imediatamente
antes de `drawProjectile` (padrão E3/E4/E5/E6/E10). O dispatcher ganhou
**uma** linha, inserida entre `PVF_KINETIC` e o fallback:

```
glow → globalAlpha=fade → fillStyle → (eorb | ENERGY | FLUID | SLUG | SWARM | KINETIC | CONDUCT | legacy) → camada temporal → globalAlpha=1
```

O sub-dispatch interno é por `p.type` (tesla/plague), como nas demais
famílias. O fade de alcance, o glow, a camada temporal (E2), Echo, Replay
e o culling **não foram tocados nem duplicados**. Tetos de linha do
dispatcher nos testes E1/E2/E3 subiram 23→24, 22→23 e 22→23
respectivamente — cada um **documentado no comentário do próprio teste**
como o custo explícito de UMA linha nova.

## 6. Legacy depois do E7 (§26)

Auditado: `WEAPONS` tem 20 armas ranged (19 que geram projétil + beam).
**Todas as 19 têm família não-legacy e forma própria** — a migração das
armas conhecidas do jogador está COMPLETA.

`drawProjectileLegacyLine` foi **MANTIDO** (não é PR de limpeza):

- é o `else` final do dispatcher — fallback defensivo para qualquer tipo
  desconhecido/ausente/futuro (`visualFamilyForProjectile` retorna
  `PVF_LEGACY` para `null`, `undefined`, `{}`, type numérico, string
  vazia);
- continua coberto por testes (E1 D06/D07, E7 K02/K03) e é a âncora do
  traço reto nos testes E3/E4/E5/E6/E8/E10 atualizados.

`eorb` segue no ramo próprio (`p.type==='eorb'` avaliado ANTES da
família) e no desenho histórico do orb — intocado.

## 7. E2 / E8 / E9 / Echo / Repetição

- **E2:** `projectileTemporalMode` / `drawProjectileTemporalLayer`
  intocados; a camada é aplicada DEPOIS da forma base (a arma é dominante).
  Zero menção a temporalidade dentro do helper.
- **E8:** `emitWeaponMuzzleVisual` byte-identical — tesla segue emitindo
  a centelha dupla rápida (2 partículas) e plague o puff orgânico lento
  (3 partículas). Nenhuma mudança visual de muzzle.
- **E9:** nenhum efeito de impacto novo. Nada de raio no alvo, nuvem,
  splash, anel, decal ou partícula de colisão dentro do helper. O arco
  histórico do chain (`chainShock` → `arcs` → `drawArcs`) segue vivo e
  intocado — fronteira §20 documentada no §2 acima.
- **Echo:** herda pelo pipeline comum (mesmo `p.type`, mesma família,
  mesma forma base + camada temporal). Não existe renderer separado de
  Echo. Testado com owner slot/data.
- **Repetição Ancorada:** `TEMPORAL_ACTION_WINDOW/COOLDOWN/DAMAGE` e
  `replayTemporalAction` intocados; o replay herda forma + camada e é
  distinto do Echo. Zero lógica ofensiva nova.

## 8. Determinismo (E0) e pureza

Zero RNG em desenho (sentinel: contador de `Math.random` = 0). Zero
`runTime` no helper — as formas são estáticas por proposição. `p` nunca
é mutado (snapshot antes/depois). Nenhuma coleção cresce durante o draw
(`parts/projectiles/enemies/arcs` estáveis em 10 draws × 2 armas). Draws
repetidos do mesmo estado: trace byte-idêntico (30×). Orientação por
`vx/vy` com divisão protegida (`||1`): ±x, ±y, diagonal e velocidade
zero sem NaN/Infinity (verificado em todos os argumentos logados).

## 9. Prova de que a mecânica não mudou

Comparação BASE `80b1349` ↔ E7 (sonda LCG + suíte L da E7):

- **defs** campo a campo (interval, speed, dmg, count, spread, jitter,
  life, pr, kick, range, color, chain, aoe, contagion, fx): idênticas;
- **nascimento** (`fireWeaponFrom` com RNG fixo): count, type, color, r,
  dmg, pierce, maxDist, life, aoe carregado e recoil: 0 divergências;
- **impacto tesla:** dano 14 no alvo direto, `shockT=2`/`shockP=1`,
  chain 14→10.92→8.5176 (0.78/0.78²), raio 230 (220 sim / 231 não),
  2 arcos históricos, projétil morto no impacto;
- **impacto plague:** dano 16 + `corrT=5`/`corrP=.10` no alvo único,
  2º alvo intocado a 80px, sem contágio ao matar;
- **runout:** shock sem DoT (0 em 3s) e expira; corrode ×1.10/×1.20,
  teto ×1.60, sem DoT (0 em 2s), amplificação 10→16 e expiração;
- **morte:** 3 faíscas por alcance, silêncio por vida, pierce 0;
- **estático:** `detonateSpecial` chamado 1× (só mine), `contagion` só
  dentro dele, todo `p.aoe` em código vive dentro de `explodeOrb`,
  `onProjectileHit`/`applyStatus`/`tickStatus`/`chainShock`/`updateProjectiles`
  sem menção ao helper.

## 10. Testes

### Nova suíte — `tests/pr15-5-e7-conduction-status-projectile-identity.test.js`

**96 checks** (95 + contagem de armas), blocos A–M:
classificação/roteamento (A), formas exclusivas e topologia (B), mesma
cor/mesmo raio (C), separação de todas as famílias + varredura global de
colisões (D), orientação e estado zero (E), determinismo e pureza (F),
canvas budget (G), Echo e Repetição (H), muzzle/E9/eorb/beam/inimigos
(I), blocos anteriores preservados (J), situação do legacy (K), mecânica
+ config morta (L) e regressão (M).

### Listas datadas estreitadas (sempre com assert positivo)

A âncora de legado das suítes anteriores era `tesla` (desde o E6).
Com o E7 ela passa a ser um **tipo desconhecido** — o único caminho real
até o fallback, conforme a arquitetura. Nenhuma arma falsa foi criada em
`WEAPONS`. Cada suíte ganhou assert positivo da nova arquitetura:

| suíte | mudança | assert positivo acrescentado |
|---|---|---|
| E1 | bucket C01h (tesla/plague mudaram em TODAS as combinações); âncoras C03/D05 → tipo desconhecido; tetos I06 23→24; J07 remove tesla/plague | `C01h`, `D05b`, `J07d` (tesla ≤ plague ≤ 26) — 105 → **108** |
| E2 | teto J08 22→23 (comentário) | mesmo comportamento — 83 |
| E3 | âncoras A05/A05d/J05/J04 → tipo desconhecido; teto A06 22→23 | `A05f` (CONDUÇÃO ≠ slug, 2 topologias) — 80 → **81** |
| E4 | âncoras O03/O03c → tipo desconhecido | `O03e` (não colide com o enxame) — 74 → **75** |
| E5 | âncoras J06/J07/J04 → tipo desconhecido | J06 vira positivo (fora do legado) — 82 |
| E6 | âncoras D01/J04/J07 → tipo desconhecido | D01/J07 viram positivos (E7 ≠ E6, fallback vivo) — 80 |
| E8 | âncoras H02/H02d/H02e → tipo desconhecido | `H02f` (forma própria, muzzle intocado) — 71 → **72** |
| E10 | âncoras AD02/AD02b/AD02c → tipo desconhecido | `AD02d` (não colide com a cinética) — 72 → **73** |
| perf-audit1 | re-baseline do hash de **texto-fonte** de `drawProjectile` (`633c53d5…` → `9ffa21e4…`), comentário do E7 | **112** — os 9 `hashCanvas` das cenas A–I seguem IDÊNTICOS (nenhum fixture usa tesla/plague; todos usam plasma) e o consumo de RNG de draw segue 0 |

É o mesmo tipo de re-baseline de texto já feito no E1–E6/E10. Nenhuma
assertiva afrouxada, nenhuma cobertura removida.

## 11. Riscos conhecidos

- O zigue-zague do tesla, em movimento rápido (820), pode ler como um
  "S" comprimido em vez de raio se o raio for muito pequeno. Os clamps
  mínimos (`zz ≥ .9`) mitigam;merece olho no replaytest.
- Os 3 espinhos da plague podem ler como "pontas de estrela" em r muito
  pequeno. A assimetria dos ângulos evita a leitura de estrela simétrica;
  se confundir, encurtar o espinho B (cauda) mantém a topologia e nenhum
  teste muda.
- A plague iguala o teto de ops do prism (26). Cadência .95 torna o
  custo agregado baixo, mas qualquer adição futura à forma deve primeiro
  cortar algo.
- Config morta (`aoe`/`contagion` da plague; `shockP`/`shockSrc` do
  tesla) segue no código — correção é decisão de gameplay, fora do E7.

## 12. Roteiro de replaytest manual

Este bloco **não está HUMAN APPROVED**. Verificar em jogo:

1. **Tesla** — o zigue-zague entre terminais lê como descarga elétrica
   instantaneamente, sem depender do amarelo?
2. **Plague** — a cápsula lobulada com espinhos lê como contaminante
   orgânico, sem depender do verde?
3. **Mesma cor** — forçar tesla e plague na mesma cor: continuam
   distinguíveis por forma?
4. **Plague ≠ Acid** — lado a lado: glóbulo+satélite (acid) vs cápsula
   espinhosa (plague), sem ambiguidade?
5. **Tesla ≠ Rail/Plasma** — o zigue-zague não lê como dardo/haste?
6. **Tamanho pequeno** — em r 4.5 (tesla) e 7 (plague), as silhuetas
   seguem legíveis?
7. **Combate denso** — misturando famílias, as duas novas separam-se ou
   viram ruído?
8. **Sem promessa falsa** — nenhuma das formas sugere nuvem/AoE/propagação
   que a plague não tem? O tesla não sugere raio conectando inimigos?
9. **Chain real** — ao acertar, o arco histórico amarelo entre alvos
   continua idêntico ao de antes (cadeia ×2 com proc "CADEIA")?
10. **Echo** — Echo com tesla/plague herda a forma + camada temporal azul?
11. **Repetição Ancorada** — replay segue independente, sem ataque extra?
12. **Muzzle** — centelha do tesla e puff da plague idênticos aos de antes?
13. **Impactos** — faíscas/anéis de expiração e morte idênticos?
14. **Fim de alcance** — o fade de 22% age uniformemente sobre as novas
    silhuetas?
15. **Sem regressão** — E3/E4/E5/E6/E10 continuam como estavam?

## 13. Referência de auditoria

- Sonda: `/tmp/probe_e7_audit.js` + `/tmp/probe_e7_shapes.js` (não
  commitadas — artefatos de execução)
- Suíte: `tests/pr15-5-e7-conduction-status-projectile-identity.test.js`
- Diff de código: UMA linha no dispatcher + UM helper
  `drawProjectileConductionStatus(p)` + 1 bridge `typeof` no harness
- Goldens: apenas o pin textual de `drawProjectile` no perf-audit1
  (rebasing documentado); os 9 `hashCanvas` inalterados

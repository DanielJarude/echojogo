# PR15.5-E4 — Enxame / Múltiplo: identidade do projétil

SMG, Shotgun, Homing e Prism. O E8 diferenciou **como a arma solta** o
projétil. Este bloco diferencia **o que ela lança**.

Critério: *se cor, glow e partículas forem removidos, a forma ainda deve
comunicar o que é o projétil.* A forma decide; a cor ajuda.

---

## 1. Comportamento real auditado

Nada foi assumido pelo nome. Valores lidos de `WEAPONS` e do loop de update:

| | SMG | Shotgun | Homing | Prism |
|---|---|---|---|---|
| nome | REPETIDOR ENXAME | ESCOPETA MAGNÉTICA | ENXAME BUSCADOR | PRISMA DIVERGENTE |
| `count` | **1** | **7** | 3 | 3 |
| `interval` | **0.065** | 0.74 | 0.85 | 0.4 |
| `spread` | 0 | 0.13 | 0.45 | 0.22 |
| `jitter` | 0.13 | 0.09 | 0.1 | 0.02 |
| `speed` | 900 | 720 | 420 | 760 |
| `dmg` | 4.2 | 7 | 17 | 9 |
| `pr` (raio) | 2.6 | 3.5 | 4.5 | 3.4 |
| `range` | 480 | 245 | 760 | 540 |
| especial | — | — | `homing:230` | `split:2` |

Descobertas que **definiram o desenho**:

- **SMG tem `count:1`.** A multiplicidade dele não é espacial — é
  **temporal**, vinda do `interval` de 0.065 s. Por isso a forma tem de ser
  minúscula: o que enche a tela é a cadência, não o projétil.
- **Shotgun é a única com multiplicidade espacial real** (`count:7`,
  `spread:0.13`). O leque já existe mecanicamente no conjunto — desenhar
  leque em cada pellet seria redundante e errado.
- **Homing tem steering real**: em `updateProjectiles`, `p.vx/p.vy` são
  reescritos a cada frame (`angTo(ca,ta,p.homing/180*PI*dt*3.2)`, aquisição em
  raio 460). Logo, `vx/vy` é fonte **confiável e instantânea** de orientação —
  a forma acompanha a correção de curso de graça.
- **Prism divide de verdade**, mas só no impacto: `onProjectileHit` cria 2
  fragmentos com `def:null`, `dmg*.55`, `maxDist:260` — e **sem** o campo
  `split`. O pai é distinguível do fragmento por estado já existente, sem
  inventar flag nem RNG. Não há refração nem reflexão: não inventei nenhuma.

---

## 2. Problema anterior

As quatro caíam em `drawProjectileLegacyLine`:

```js
const l=p.type==='plasma'?10:5;
ctx.beginPath();ctx.moveTo(p.x,p.y);
ctx.lineTo(p.x-p.vx/sp*l,p.y-p.vy/sp*l);ctx.stroke();
```

Um traço de 5 px, largura `p.r`. Um pellet de escopeta, um míssil buscador e
um fragmento prismático eram **a mesma geometria recolorida**. Nenhuma delas
comunicava função.

---

## 3. Helper e dispatcher

Helper único `drawProjectileSwarm(p)`, com quatro ramos internos — sem
sub-arquitetura, sem registry, sem classes. O dispatcher do E1 continua sendo
o ponto principal e ganhou **uma linha**:

```js
else if(visualFamilyForProjectile(p)===PVF_SWARM)drawProjectileSwarm(p);
```

Toda a construção usa o eixo real do voo `nx,ny = vx/sp, vy/sp` e sua
perpendicular `px,py = -ny,nx`. **Nenhum** `ctx.rotate`, `save`, `restore`,
`translate`, gradiente, `shadowBlur`, `Path2D`, array ou objeto temporário.

---

## 4. As quatro formas

### SMG — microcápsula
Losango de 4 vértices, simétrico, `head 1.9r / tail 1.5r / meia-largura .52r`.
Corpo mínimo e fechado, um só `beginPath`, sem stroke. Lê como munição
repetida; não é um mini-Rail (que tem cauda afilada de 7.2r e núcleo
interno). A sensação de rajada vem da cadência existente — **sem tracer
persistente, sem alternância de forma, sem `runTime`**.

### Shotgun — pellet
Fragmento **irregular de 5 vértices**: frente **chata** e estreita (pellet não
tem ponta), corpo alargando para trás e traseira **quebrada em dois planos
desiguais**. É a assimetria — verificada em teste — que o separa
topologicamente do losango simétrico do SMG. Uma unidade barata por pellet,
sem leque desenhado: a dispersão é mecânica.

### Homing — buscador
Casco fechado com **ogiva** (2.2r à frente) mais **dois estabilizadores**
traçados na traseira. É a única da família com apêndices fora do corpo —
assinatura de unidade autopropelida. Frente e trás são inequívocas, e como o
steering reescreve `vx/vy`, a forma gira junto com a correção de curso.

### Prism — construção facetada
**Duas facetas** preenchidas de larguras diferentes (`w1 .78r`, `w2 .44r`)
separadas por uma **aresta de divisão** visível. Não é um triângulo: são dois
planos que o olho lê como sólido facetado, coerente com a mecânica real de
divisão em 2. O fragmento pós-split herda a mesma gramática em escala menor.

---

## 5. Diferenças topológicas (medidas)

Assinatura estrutural de ops de path, mesma cor, mesmo `r`, mesma direção:

| arma | vértices | assinatura |
|---|---|---|
| smg | 3 `lineTo` | `beginPath,moveTo,lineTo×3,closePath,fill` |
| shotgun | 4 `lineTo` | `beginPath,moveTo,lineTo×4,closePath,fill` |
| homing | 6 `lineTo` | corpo `closePath,fill` + `beginPath,moveTo,lineTo,moveTo,lineTo,stroke` |
| prism | 6 `lineTo` | 2× `closePath,fill` + `beginPath,moveTo,lineTo,stroke` |

**4 topologias únicas de 4.** A prova roda com cor idêntica (`#ffffff`),
tamanho idêntico e direção idêntica — a diferenciação não usa cor, largura
nem alpha.

---

## 6. Canvas call budget

| arma | ops totais |
|---|---|
| smg | **14** (o mais barato da família) |
| shotgun | 15 |
| homing | 23 |
| prism | 26 |
| *(referência)* cryo legado | 13 |
| *(referência)* rail (E3) | 20 |

SMG, o que mais dispara, é o mais barato. Shotgun, que cria 7 pellets, custa
15 — salva completa em 105 ops, dentro do teto testado de 140. Custo é
constante: não cresce com repetição (verificado com 30 draws consecutivos).

---

## 7. Determinismo e pureza

Zero `Math.random`/`rand`/`randi` no draw — verificado por texto-fonte e por
contagem em runtime (0 chamadas nas 4). 20 draws repetidos são
byte-idênticos. Nenhuma mutação do objeto projétil durante o desenho e
nenhuma coleção (`parts`, `projectiles`, `enemies`, `arcs`) cresce. A forma não
depende de `runTime`, então não oscila no tempo.

---

## 8. Ortogonalidade

- **E2 (temporal)** — intacto e aplicado *depois* da forma base: para as 4
  armas, o traço com Echo/replay **começa** com a assinatura nova e a estende.
  Echo e replay continuam distinguíveis entre si. `projectileTemporalMode` e
  `drawProjectileTemporalLayer` não foram tocados. O critério real do Echo
  (`owner.slot>0 && owner.data`) foi respeitado — nada de flag solta.
- **E3 (slug)** — rail, sniper e nail com assinatura byte-idêntica;
  `SNIPER_FAR_DIST=450` preservado. Nenhuma arma do enxame usa
  `drawProjectileSlug`.
- **E8 (muzzle)** — `muzzleShot`, `muzzlePower` e `emitWeaponMuzzleVisual`
  intocados; `muzzlePower(kick 280)=1.4` confirmado. O E4 começa depois que o
  projétil nasceu.
- **Echo** — herda a forma automaticamente: o desenho depende só de `p.type`,
  e o helper não referencia `owner`, `team`, `slot` nem `echoes`.
- **eorb / beam** — fora da família (`PROJ_FAMILY` não os contém); eorb segue
  idêntico a orb, beam segue fora do dispatcher.
- **Demais 10 armas** (plasma, flamer, tesla, acid, boomer, mine, void,
  ricochet, gatling, plague) seguem na linha legada, inalteradas.

---

## 9. Mecânica preservada

Comparação automatizada contra `de4ce87`, com `Math.random` determinístico,
para as 4 armas: `count`, `vx`, `vy`, `dmg`, `r`, `color`, `type`, `life`,
`maxDist`, `homing`, `split`, `pierce`, `bounce`, `aoe`, o recoil do jogador e
as defs completas de `WEAPONS` → **0 divergências**.

Especificamente: o leque da shotgun continua com 7 ângulos distintos e
abertura mecânica intacta (nada foi "organizado" visualmente); o steering do
homing (turn rate `dt*3.2`, aquisição `460²`) não foi tocado; o split do prism
(2 fragmentos, `dmg*.55`, `maxDist:260`) não foi tocado.

---

## 10. Goldens

Um único golden mudou: o hash de **texto-fonte** de `drawProjectile`
(`cbdf3836…` → `ab862aad…`), porque a função recebeu **uma linha adicionada**
e nada removido. Os **9 cenários de Canvas** do performance audit seguem
byte-idênticos — nenhum deles usa as 4 armas — e o RNG segue em 0. O
re-baseline está justificado em comentário no próprio teste.

Suítes antigas que afirmavam "todas as não-slug estão na linha legada" foram
**estreitadas, não afrouxadas**: as 4 armas saíram dessas listas e ganharam
asserts **positivos** provando que têm forma própria e que não copiam slug
nem a linha legada (E1 `C01c`: 180/180 combinações mudaram; E3 `A05b`; E8
`H02b`). O teto de linhas do dispatch subiu de 18 para 20 (o E4 acrescentou 1
ramo). Total de checks subiu de 4086 para **4160**.

---

## 11. Testes

`tests/pr15-5-e4-swarm-projectile-identity.test.js` — **71 checks, 0 falhas**,
cobrindo A–X: mapeamento de família, roteamento, as 6 comparações de
topologia par a par, mesma cor sem colapso, orientação do homing em 4
direções, facetas do prism, escala, custo bounded, determinismo, pureza,
ortogonalidade E2/E3/E8/Echo/eorb/beam e mecânica.

Regressão completa: **64 suítes · 0 falhas · 4160 checks**.

---

## 12. Replaytest humano

**SMG** — compacto e rápido? Em alta cadência não vira linha contínua? Não
parece mini-Rail?
**Shotgun** — cada pellet parece fragmento? O conjunto abre pelo spread real?
Não parece SMG multiplicado?
**Homing** — frente/trás clara? A curva de perseguição continua legível? Parece
buscador, não bolinha?
**Prism** — as facetas são perceptíveis? Não é triângulo neon? Não parece
Homing? Os fragmentos pós-impacto leem como pedaços do original?
**Mesma cor** — se todas fossem brancas, ainda seriam distinguíveis?
**Echo / Repetição Ancorada** — as formas são herdadas? O temporal layer
continua por cima sem apagar a silhueta?
**Combate denso** — SMG e Shotgun continuam leves, sem poluição visual?

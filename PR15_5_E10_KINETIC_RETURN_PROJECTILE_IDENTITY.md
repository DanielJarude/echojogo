# PR15.5-E10 — Cinético / Retorno: identidade do projétil

Ricochet, Boomer, Gatling e Mine — as quatro últimas armas presas na linha
legada. O E8 já diferenciou a emissão; aqui muda **o objeto lançado**.

Princípio: *material antes de efeito, função antes de ornamento, forma antes
de cor.*

---

## 1. Comportamento real auditado

Nada foi assumido pelo nome. Tudo lido de `WEAPONS`, `fireWeaponFrom`,
`updateProjectiles`, `onProjectileHit` e `detonateSpecial`.

| | Ricochet | Boomer | Gatling | Mine |
|---|---|---|---|---|
| nome | PISTOLA RICOCHETE | LÂMINA ORBITAL | GIRO-CANHÃO | SEMEADOR DE MINAS |
| `interval` | 0.22 | 0.7 | **0.09** | 0.8 |
| `speed` | 880 | 640 | **1000** | **300** |
| `dmg` | 12 | 22 | 6.8 | 44 |
| `pr` (raio) | 3.6 | **8** | 3 | 7 |
| `life` | 2.6 | 2.4 | 1 | **14** |
| `range` | 900 | 420 | 560 | **200** |
| especial | `bounce:3` | `boomerang`, `basePierce:99` | `spinUp` | `mine`, `aoe:120` |

### Ricochet — bounce é real
```js
if(p.x<p.r){p.x=p.r;p.vx=Math.abs(p.vx);bounced=true;}   // …4 paredes
if(bounced){p.bounce--;p.dmg*=1.15;p.hits=null;}
```
Rebate nas 4 paredes invertendo o componente da velocidade. **`p.bounce` é
estado real e observável** (3→2→1→0) e cada quique dá **+15% de dano**. A peça
literalmente se gasta enquanto fica mais letal.

### Boomer — retorno é real
```js
if(t>life0*.42&&!p.returning){p.returning=1;}
p.vx=lerp(p.vx,Math.cos(a)*sp,…); p.maxDist=0; p.hits=null;
p.spin=(p.spin||0)+dt*18;
```
Aos 42% da vida inverte o curso rumo ao atirador, zera `maxDist`, limpa `hits`
(fere de novo na volta) e some ao chegar a 32px. Tem `basePierce:99` —
atravessa tudo. **E já existe `p.spin`, incrementado `dt*18`**: a peça gira de
verdade. Dois estados reais disponíveis de graça: `returning` e `spin`.

### Gatling — o `spinUp` NÃO é do projétil
```js
const jt=def.spinUp?def.jitter*(1-.7*(src.spin||0)):def.jitter;
```
O spin acelera a cadência e **fecha a mira da arma** — o projétil em si é uma
bala comum, a mais rápida do jogo (1000) e sem nenhum campo especial. Seria
errado desenhar rotação nele.

### Mine — dispositivo com ciclo de armamento
```js
p.vx*=Math.pow(.02,dt); p.armT=(p.armT||0)+dt;
if(p.armT>.45) for(const e of enemies) if(dist2(…)<110*110){trig=true;}
```
Desacelera a **quase zero** (medido: 300 → 22 px/s em 40 frames), **arma aos
0.45 s** (`p.armT`) e só então detecta proximidade em raio 110, detonando com
`aoe:120`. Não é bala: é dispositivo lançado que se assenta.

---

## 2. Problema visual anterior

As quatro usavam `drawProjectileLegacyLine`: **13 ops, traço de 5px,
assinatura idêntica**. Uma mina de 44 de dano e uma bala de giro-canhão
desenhavam exatamente a mesma coisa.

---

## 3. Helper e dispatcher

`drawProjectileKinetic(p)` com quatro ramos. O dispatcher do E1 ganhou **uma
linha**; a ordem das famílias já implementadas não mudou:

```js
Slug → E3 · Swarm → E4 · Kinetic → E10 · restante → legado
```

Construção por vetores (`nx/ny` + perpendicular). **Zero** `rotate`, `save`,
`restore`, gradiente, `Path2D`, alocação ou RNG.

---

## 4. As quatro formas

### Ricochet — peça chanfrada
Hexágono alongado com as **quatro quinas cortadas**: são faces de impacto, a
razão de sobreviver ao rebote. O chanfro **encolhe conforme `p.bounce` cai**
(3→0) — a peça vai ficando gasta, usando estado que já existia, sem flag nova
e sem histórico. A topologia não muda entre os estados: muda a proporção.

### Boomer — lâmina dupla
Cubo central com **dois braços opostos** (simetria rotacional de 180°: a
assinatura de "feito para voltar"), mais um traço de eixo transversal. O eixo
dos braços vem de **`p.spin` real**, então a peça gira; na volta o vetor já
aponta ao jogador e a forma acompanha sozinha. Sem trail, sem seta circular.

### Gatling — cartucho
Ogiva curta + **base reta cortada** (2 vértices traseiros). É o que o separa
do SMG (losango com 1 vértice traseiro) e do Nail (haste longa com entalhe em
V). **O mais barato da família: 15 ops, um único path, sem stroke.**

### Mine — casco com pernas
Casco hexagonal compacto — **sem nenhum `arc`**, deliberadamente, para não
colidir com a linguagem energética do Orb — com **duas juntas de placa**
transversais (leitura de peça montada). Quando `p.armT>0.45`, exatamente o
instante em que a mecânica arma a proximidade, aparecem **4 pernas de
implantação**. Nenhum timer visual paralelo: o limiar `.45` é o da mecânica.

---

## 5. Diferenças topológicas

| arma | ops | assinatura |
|---|---|---|
| gatling | **15** | `beginPath,moveTo,lineTo×4,closePath,fill` |
| ricochet | 17 | `beginPath,moveTo,lineTo×6,closePath,fill` |
| boomer | 22 | corpo `closePath,fill` + eixo `stroke` |
| mine (voo) | 24 | casco + **2** juntas |
| mine (armada) | 36 | casco + juntas + **4 pernas** |

Quatro assinaturas únicas — e nenhuma colide com **qualquer** outra arma do
jogo (verificado contra rail, sniper, nail, smg, shotgun, homing, prism, orb,
cryo).

### Comparações obrigatórias

- **Ricochet vs Nail** (§13): topologias diferentes; ricochet é mensuravelmente
  mais curto. Nail penetra; ricochet rebate.
- **Gatling vs SMG** (§12): SMG tem **1** vértice traseiro (losango), Gatling
  tem **2** (base reta). Testado com mesma cor, mesmo `r`, mesma direção.
- **Gatling vs Shotgun**: mesma contagem de ops, mas o cartucho é
  **simétrico** e o pellet **assimétrico** — provado por geometria, não por
  contagem. Não fabriquei ops extras só para diferenciar: gatling precisa ser
  o mais barato.
- **Boomer vs Prism** (§14): prism tem 2 facetas preenchidas, boomer tem 1
  corpo + eixo.
- **Mine vs Orb** (§11): orb usa `arc` (energia), mine **nunca** usa — nem
  armada.

---

## 6. Orientação

Ricochet, Boomer e Gatling seguem `vx/vy` em `+x`, `+y` e diagonal. Após o
quique real (`vx` invertido), o bico do ricochet passa de `+x` para `-x`
sozinho — **nenhum efeito de impacto foi adicionado** (isso é o E9). O
`p.spin` do boomer gira a peça preservando o comprimento dos braços (giro, não
deformação).

**Mine**: a orientação é funcional (o casco usa o eixo atual), mas como a
mecânica a desacelera a ~0, o helper cai no fallback `1,0` quando `v=0` —
testado contra `NaN`.

---

## 7. Canvas budget

Gatling 15 (mais barato da família e mais barato que rail, nail, homing,
prism, orb, boomer e mine) · Ricochet 17 · Boomer 22 · Mine 24/36.

Nenhum custo cresce com tempo de vida, distância, número de bounces, spin
acumulado ou repetição de draw — todos verificados explicitamente.

---

## 8. Determinismo e pureza

Zero `Math.random`/`rand`/`randi` e zero `runTime` no helper. 30 draws
produzem traces idênticos. Nenhuma mutação do projétil (testado com todos os
campos de estado preenchidos) e nenhuma coleção cresce. O helper não referencia
`spawnParticles`, `projectiles`, `enemies`, `player`, `echoes` nem `detonate`.

---

## 9. Blocos anteriores

- **E2** — camada temporal aplicada **depois** da forma base: para as 4 armas,
  Echo e replay começam com a assinatura nova e a estendem, e continuam
  distinguíveis entre si. Helpers intocados.
- **E3** — rail/sniper/nail byte-idênticos; `SNIPER_FAR_DIST=450`.
- **E4** — smg/shotgun/homing/prism byte-idênticos. **Nada do E4 foi
  "harmonizado"**: a diferenciação veio toda do código novo.
- **E8** — muzzle intocado; as contagens de emissão das 4 armas do E10
  (ricochet 2, boomer 3, gatling 1, mine 2) continuam idênticas.
- **Echo** — herda a forma automaticamente (o desenho depende de `p.type`).
- **beam / eorb** — fora da família.
- Plasma, void, flamer, acid, tesla e plague seguem no legado, aguardando
  E5/E6/E7.

---

## 10. Mecânica

Comparação automatizada contra `4366eb6`, RNG determinístico: `count`,
`vx/vy`, `dmg`, `r`, `color`, `type`, `life`, `maxDist`, `bounce`, `homing`,
`aoe`, `pierce`, `mine`, `boomerang`, `crit`, recoil e defs completas →
**0 divergências**.

Ciclos reais simulados também conferem:
- **quique**: `vx` −880 → +880, `bounce` 3→2, `dmg` 12→13.8 (×1.15);
- **mine**: velocidade 300 → 22, `armT` 0.667 (> 0.45, pernas visíveis).

---

## 11. Goldens

Apenas o hash de **texto-fonte** de `drawProjectile` (`ab862aad…` →
`6b7dad12…`), por **uma linha adicionada** ao dispatch. As **9 cenas de
Canvas seguem byte-idênticas** — nenhuma usa essas armas — e o RNG segue em 0.
Justificativa documentada no próprio teste.

Suítes antigas foram **estreitadas, não afrouxadas** (§38): as 4 armas saíram
das listas "linha legada" e ganharam asserts positivos provando forma própria
e não-cópia de slug/swarm — E1 `C01d` (180/180 combinações mudaram), E3
`A05c`, E4 `O03b`, E8 `H02c`. Checks totais subiram de 4160 para **4234**.

---

## 12. Testes

`tests/pr15-5-e10-kinetic-return-projectile-identity.test.js` — **70 checks,
0 falhas**, cobrindo A–AD mais os testes específicos de bounce (§34), retorno
(§35) e ciclo da mine (§36).

Regressão completa: **65 suítes · 0 falhas · 4234 checks**.

---

## 13. Replaytest humano

**Ricochet** — parece peça material feita para rebater? Ao inverter a direção
a forma acompanha imediatamente? O desgaste após 2–3 quiques é perceptível?
Não parece Nail?
**Boomer** — parece dispositivo retornável? O giro é legível? Ida e volta
permanecem claras? Não parece Prism?
**Gatling** — munição mecânica e compacta? Em cadência máxima não vira linha
contínua? Não parece SMG?
**Mine** — parece dispositivo lançado, não bala? As pernas aparecem quando ela
se assenta? Não parece Orb?
**Mesma cor** — todos brancos, ainda são reconhecíveis?
**Echo / Repetição Ancorada** — formas herdadas e temporal layer correto?
**Combate denso** — Gatling continua barata, Mine não polui, vários Ricochets
não criam ruído, FPS estável?

# PR15.5-E5 — Identidade visual dos projéteis de ENERGIA / MASSA

Família `PVF_ENERGY` (definida no E1): **plasma**, **orb**, **void**, **cryo**.
Até aqui as quatro pertenciam à família mas desenhavam a *reta legada* — eram
literalmente o mesmo traço em cores diferentes. Este bloco lhes dá gramática
própria, com a regra do projeto: **a cor ajuda, a forma decide**.

Escopo: apenas o OBJETO LANÇADO. Não é muzzle (E8), não é impacto (E9).
Nenhuma mecânica foi alterada.

---

## 1. Auditoria mecânica (o que o código REALMENTE faz)

| id | interval | speed | dmg | life | pr | kick | range | AoE | especial |
|---|---|---|---|---|---|---|---|---|---|
| plasma | .16 | 980 | 11 | 1.4 | 4 | 55 | 760 | — | arma inicial, `jitter .035` |
| orb | 1.05 | 250 | 24 | 3 | 8 | 40 | 430 | **105 (real)** | `explodeOrb`: ring + 18 part + 8 shards, `slowT=1.4` |
| void | 1.25 | 340 | 30 | 2.6 | 9 | 50 | 560 | **150 (morto)** | `implode:210` **morto** |
| cryo | .62 | 600 | 13 | 1.4 | 6 | 60 | 520 | — | `fx:{k:'chill',dur:2.6,pow:.34}` |

### Achado crítico — o Void não implode

`detonateSpecial(p)` é a única leitora do campo `implode`, e a única chamada
dela no arquivo está dentro de `if(p.mine)`. `explodeOrb(p)` só é chamada sob
`p.type==='orb'`. Logo **o Void é um impacto único e pesado**: os campos `aoe`
e `implode` do seu `WEAPONS` são código morto.

Isso foi confirmado empiricamente duas vezes, disparando contra dois inimigos
enfileirados:

| arma | hp dos 2 alvos (de 2600) | slow | chill | leitura |
|---|---|---|---|---|
| orb | `2576` / `2576` | 1.4 / 1.4 | — | AoE e lentidão reais |
| void | `2570` / **`2600` intacto** | 0 / 0 | — | **impacto único, sem AoE** |
| cryo | `2587` / `2600` intacto | — | 2.6 / 0 | chill no alvo direto, sem AoE |

Nota de método: o inimigo nasce com `spawnT: 0.55` (invulnerabilidade de
spawn). Sem zerar esse campo, os projéteis **atravessam o alvo sem causar
dano** e a comparação passaria vazia — dando um falso "sem divergências".

**Consequência de desenho:** a tentação era dar ao Void um anel de sucção ou
partículas orbitando. Seria *mentir sobre a mecânica*. O Void recebeu uma
forma de **contenção/ausência**, não de implosão ativa.

---

## 2. Decisão visual

Nenhuma forma usa cor, glow, gradiente, RNG ou trail para se diferenciar.
Todas são legíveis em silhueta chapada.

| arma | forma | por quê |
|---|---|---|
| **plasma** | envelope hexagonal alongado **+ núcleo losangular preenchido** dentro dele | massa energética *contida e dirigida*; dupla camada em vez de trail. É a arma mais rápida (980) e a mais barata da família |
| **orb** | círculo pulsante + anel de contenção (**histórico, delegado**) | massa volumétrica já era exclusiva e boa; único da família com `arc` |
| **void** | casco octogonal **interrompido** (4 segmentos soltos), **sem preenchimento** + 2 traços de colapso | espaço negativo *é* a forma: massa que falta. Sem `fill`, sem `arc` |
| **cryo** | losango facetado preenchido + 2 farpas transversais assimétricas | cristalização por geometria material, sem partículas de neve e sem RNG |

### Colisões verificadas

Varredura de topologia sobre **16 tipos de projétil**. Durante a
implementação, o plasma saiu com topologia **idêntica ao `boomer`** (E10) —
mesmo número de ops, mesma sequência. Corrigido: o núcleo passou de *traço*
para *corpo preenchido*, o que separa as duas silhuetas e ainda reforça a
leitura de "massa dentro de um campo".

Colisões remanescentes no jogo inteiro: `eorb == orb` (intencional — é o
mesmo objeto, versão inimiga) e `gatling == shotgun` (pré-existente do E10,
distinguidas por geometria). **Nenhuma envolve as 4 armas do E5.**

### Custo (ops de Canvas por projétil)

`orb` 17 · `cryo` 22 · `plasma` 25 · `void` 26

Referência do E10: gatling 15 · ricochet 17 · rail 20 · boomer 22 ·
homing 23 · mine 24 · **prism 26**. Nenhuma forma do E5 ultrapassa o teto já
aprovado, e o teste `J07b` do E1 passou a fixar isso. O plasma, de altíssima
cadência, usa duas primitivas simples sem `arc`.

Zero `shadowBlur` novo, zero `Path2D`, zero gradiente por projétil, zero
array temporário, zero `save/restore` adicional.

---

## 3. Arquitetura

`drawProjectileEnergyMass(p)` — helper único, inserido antes de
`drawProjectile`. O dispatcher ganhou **uma** linha:

```
glow → globalAlpha=fade → fillStyle → (eorb | ENERGY | SLUG | SWARM | KINETIC | legacy) → camada temporal → globalAlpha=1
```

O teste `eorb` passou a ser avaliado **antes** da família. Motivo:
`projectileUsesOrbShape` cobre `orb || eorb`, e desviar o `eorb` logo na
entrada mantém o projétil inimigo no caminho histórico byte-idêntico,
enquanto o `orb` do jogador passa pela família nova (que, por sua vez,
delega ao mesmo desenho histórico). A ordem das demais famílias é a de antes.

O fade de alcance, o glow, a camada temporal (E2), Echo, Replay e o culling
**não foram tocados nem duplicados**.

---

## 4. Determinismo (E0)

Zero RNG em desenho. `p` nunca é mutado. Nenhuma coleção cresce. Draws
repetidos produzem trace idêntico. A única dependência de `runTime` é o pulso
**histórico** do orbe, que já existia — nenhuma animação nova foi inventada.

---

## 5. Prova de que a mecânica não mudou

`/tmp/probe5.js`, LCG com seed 55511122, comparando o estado atual contra
`81b0076`: `WEAPONS` das 4 armas, todos os campos do projétil no nascimento
(count, vx/vy, dmg, r, color, type, life, maxDist, aoe, pierce, crit),
recoil `player.vx/vy`, resultado de impacto de orb e void, e o `st` do cryo.

**0 divergências.**

---

## 6. Testes

`tests/pr15-5-e5-energy-mass-projectile-identity.test.js` — **81 checks**,
blocos A–L, cobrindo os 18 itens obrigatórios: classificação, forma
exclusiva, topologia, orientação (±x, ±y, diagonal), estado zero sem NaN,
mesma cor, comparação contra E3/E4/E10, ausência de RNG, pureza, ausência de
mutação, budget, Echo, Replay + camada temporal, `eorb`, `beam`, muzzle,
regressões e mecânica contra `81b0076`.

Dois asserts foram *corrigidos* durante a escrita, por erro do teste e não do
código: o Void é radialmente simétrico (medir `extX>extY` não fazia sentido —
passou a medir **rotação**), e um regex de `detonateSpecial` casava a própria
declaração.

### Listas datadas estreitadas (sempre com assert positivo)

Seis suítes anteriores listavam as 4 armas como "linha legada". Todas foram
**estreitadas, nunca afrouxadas** — em cada caso a âncora de legado passou de
`cryo` para `flamer`, e um assert positivo novo entrou no lugar:

| suíte | assert positivo acrescentado |
|---|---|
| E1 | `C01e` (as 3 mudaram em todas as combinações), `C01f` (**orb byte-idêntico à base**), `J07b` (teto de ops) |
| E2 | `J08` + assert de que o dispatch **não desenha geometria inline** |
| E3 | `A05d` (forma própria e não-SLUG, 4 topologias distintas) |
| E4 | `O03c` (não colide com nenhuma forma do enxame) |
| E8 | `H02d` (forma própria, muzzle não as tocou) |
| E10 | `AD02b` (não colide com nenhuma cinética) |

Contagens: E1 100 → **103**, E2 82 → **83**, E3 78 → **79**, E4 72 → **73**,
E8 69 → **70**, E10 70 → **71**.

### Rebaseline de golden — justificativa

`tests/pr15-5-performance-audit1.test.js`: o hash textual de
`drawProjectile` (`6b7dad12…` → `d4f2d106…`) e os hashes de Canvas das cenas
**B a I**.

Justificativa: as 9 cenas de benchmark foram enumeradas e **oito delas usam
exclusivamente projéteis `plasma`** (a arma inicial). A cena **A**, a única
sem projéteis, manteve o hash `92128f38…` **inalterado** — prova de que nada
fora do escopo mudou. Além disso, os **9 asserts de consumo de RNG de draw
continuam passando sem rebaseline**, confirmando que a mudança é puramente
geométrica.

---

## 7. Riscos conhecidos

- O Void é a forma mais cara da família (26 ops), empatada com o `prism`. É a
  arma de menor cadência (1.25 s), então o custo agregado é baixo.
- Com raio muito pequeno, os vãos do casco do Void podem fechar
  visualmente e ele lê como um octógono sólido. Os clamps mínimos mitigam,
  mas isso merece olho no playtest.
- `gatling == shotgun` em topologia segue pré-existente (E10). Fora do escopo.

---

## 8. Roteiro de replaytest manual

Este bloco **não está HUMAN APPROVED**. Verificar em jogo:

1. **Plasma** — em cadência alta, o dardo lê como energia dirigida e não
   como bala? O núcleo é visível em movimento?
2. **Orb** — continua com a identidade de sempre, sem regressão no pulso?
3. **Void** — o casco interrompido lê como ausência/contenção? Em raio
   pequeno ainda se distingue de um polígono sólido?
4. **Cryo** — as facetas leem como cristal sem depender do ciano?
5. **Mesma cor** — forçar as 4 na mesma cor: ainda são distinguíveis?
6. **Echo** — o Echo herda a forma corretamente?
7. **Repetição Ancorada** — segue independente, sem ataque extra ou bônus?
8. **Combate denso** — com muitos projéteis em tela, as silhuetas se separam
   ou viram ruído?

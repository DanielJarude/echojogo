# PR15.5-E6 — Identidade visual dos projéteis de FLUIDO / SPRAY

Família `PVF_FLUID` (definida no E1): **flamer**, **acid**.
Até aqui as duas caíam em `drawProjectileLegacyLine` — um traço reto de
comprimento 5 — e eram literalmente intercambiáveis quando recoloridas,
além de indistinguíveis de tesla/plague (os outros ocupantes do ramo
legado). Este bloco lhes dá gramática própria, com a regra do projeto:
**a cor ajuda, a forma decide**.

Escopo: apenas o OBJETO LANÇADO. Não é muzzle (E8), não é impacto (E9).
Nenhuma mecânica foi alterada.

---

## 1. Auditoria mecânica (o que o código REALMENTE faz)

| id | interval | speed | dmg | count | spread | jitter | life | pr | kick | range | status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| flamer | **.045** | 430 | 2.6 | 1 | 0 | **.30** | .5 | 5 | 8 | 210 | `burn` 3.2s, pow 9 |
| acid | .28 | 520 | 7 | **2** | .10 | .07 | 1.1 | 4 | 26 | 330 | `corrode` 4.5s, pow .12 |

Trace da sonda empírica (LCG com seed, sandbox compilado do HEAD):

- **Disparo real** (`fireWeaponFrom` + `Math.random` fixo): cada projétil
  nasce com `aoe:0`, `pierce:0`, `homing/bounce/mine/boomerang/split`
  ausentes ou zerados e `fx` apenas em `p.def` (consumido no impacto).
  Recoil confirmado: flamer empurra `player.vx` em −8, acid em −26.
- **Impacto** (dois inimigos enfileirados, um em 700 e outro em 760):
  · flamer aplica `burnT=3.2`, `burnP=9` só no 1º; o 2º fica **intocado**;
  · acid aplica `corrT=4.5`, `corrP=.12` só no 1º; o 2º fica **intocado**.
- **Burn é DoT real**: 12 ticks de `.25s × 9` = **27.00** de dano em 3.2 s;
  empilha até `pow×6`.
- **Corrode NÃO é DoT**: 2 s de `tickStatus`, Δhp = **0**. É amplificador
  puro: `statusDmgMul = 1 + corrP` — ×1.12 com 1 stack, ×1.24 com 2,
  teto 60%. Bate com a descrição da loja ("cada camada faz alvo receber
  +12% de dano").
- **Pierce base 0**: com dois alvos sobrepostos, morre no primeiro —
  exatamente 1 ferido, projétil removido.
- **Morte (fora do escopo do E9)**: expiração por alcance solta as 3
  faíscas genéricas do sistema; expiração por vida é **silenciosa**.

### Achado-chave — a família NÃO tem AoE de nenhuma espécie

Nenhum anel, splash, poça ou nuvem existe para flamer/acid: `detonateSpecial`
só é chamado por `mine` e `explodeOrb` só por `orb`. **Todo campo que as duas
declaram em `WEAPONS` é consumido** — não há config morta (ao contrário do
`aoe/implode` do Void, achado documentado no E5).

Isso foi confirmado empiricamente duas vezes (impacto em alvos enfileirados
e alvos sobrepostos), com `spawnT` zerado antes das leituras — sem isso os
inimigos estão invulneráveis por 0.55 s e o projétil atravessa sem causar
efeito (armadilha já documentada no E5).

**Consequência de desenho:** a tentação era dar ao acid gotas espirrando
como splash ou ao flamer um halo de calor com anel. Seria *mentir sobre a
mecânica*. As duas formas comunicam somente **material em voo** — líquido
pesado (acid) vs. jato instável (flamer) — sem prometer efeito de área.

---

## 2. Decisão visual

Nenhuma forma usa cor, glow, gradiente, RNG, `arc` (exclusivo do orb/eorb)
ou `runTime` para se diferenciar. Todas são legíveis em silhueta chapada.

| arma | forma | por quê |
|---|---|---|
| **flamer** | LÍNGUA DE JATO — bico afunilado à frente e **cauda partida em dois garfos assimétricos** (1 corpo, 8 vértices/7 segmentos, sem `arc`, sem segundo corpo) | o flamer é o maior `jitter` do arsenal (.30) e o maior cadência (.045): forma larva que se agita; a forquilha sugere fluido se partindo atrás do bico — caos barulhento e quente |
| **acid** | GLÓBULO PESADO — gota com cintura comprimida **+ 1 satélite desacoplado** 2.4r atrás (2 corpos, fill duplo) | o acid disfra **em pares** (count 2), range maior e coerência alta (jitter .07): lê como líquido viscoso que perde uma gotícula atrás — peso e gotejamento, não labareda |

Os dois discriminadores cruzam intuitivamente com a mecânica auditada:
o flamer queima **com repetição** (12 ticks) — cauda partida, caos; o acid
corrói **por camadas** — gota + gotícula, material que se acumula.

### Colisões verificadas

Varredura de topologia+geometria (`shape`) sobre as 16 armas de projétil
mais `eorb` e um tipo desconhecido, incluindo as 4 famílias já redesenhadas
(E3/E4/E5/E10). **Nenhuma colisão envolve flamer/acid.** As pré-existentes
(`eorb == orb`, `gatling == shotgun` no E10) seguem fora do escopo.

### Custo (ops de Canvas por projétil)

`flamer` **18** · `acid` **21** (incluindo glow e o `set:globalAlpha` final)

Referência do E10: gatling 15 · ricochet 17 · rail 20 · boomer 22 ·
homing 23 · mine 24 · plasma 25 · **prism 26**. Nenhuma forma do E6
ultrapassa o teto já aprovado. O flamer — que dispara **22× por segundo** —
ficou dentro da mesma faixa da forma mais barata (um corpo `lineTo` único,
sem `arc`); o acid, tão alto quanto rail. O teste `J07c` do E1 passou a
fixar `flamer ≤ acid ≤ 26`.

Zero `shadowBlur` novo, zero `Path2D`, zero gradiente por projétil, zero
array temporário, zero `save/restore` adicional, zero `rotate`.

---

## 3. Arquitetura

`drawProjectileFluidSpray(p)` — helper único, inserido imediatamente antes
de `drawProjectile` (padrão E3/E4/E5/E10). O dispatcher ganhou **uma**
linha, inserida entre `PVF_ENERGY` e `PVF_SLUG`:

```
glow → globalAlpha=fade → fillStyle → (eorb | ENERGY | FLUID | SLUG | SWARM | KINETIC | legacy) → camada temporal → globalAlpha=1
```

O fade de alcance, o glow, a camada temporal (E2), Echo, Replay e o culling
**não foram tocados nem duplicados**. Os tetos de linha do dispatcher nos
testes E1/E2 subiram 22→23 e 21→22 respectivamente — ambos **documentados no
comentário dos próprios testes** como o custo explícito de UMA linha nova.

O muzzle do E8 (`PVF_FLUID` em `emitWeaponMuzzleVisual`) **não foi tocado**:
continua emitindo 2 partículas em cone largo. Nenhuma emissão de impacto
nova foi adicionada (domínio do E9).

---

## 4. Determinismo (E0)

Zero RNG em desenho. Zero `runTime` **no helper** — diferente do orb (herdado
do histórico), flamer/acid **não piscam nem oscilam**: a identidade vem da
silhueta fixa (forquilha / gota+satélite), não de animação. `p` nunca é
mutado, nenhuma coleção cresce, draws repetidos do mesmo estado têm trace
byte-idêntico (testado 30×).

---

## 5. Prova de que a mecânica não mudou

`/tmp/probe_e6_audit.js`, LCG com seed `55511122`, sobre o HEAD de trabalho:

- **defs** de flamer/acid em `WEAPONS` comparadas campo a campo com os
  valores da base: idênticas;
- **nascimento** (count, `r`, `dmg`, `vx/vy`, `life`, `maxDist`, `aoe`,
  `pierce`, `crit`) e **recoil** `player.vx/vy`: 0 divergências;
- **impacto**: `st.burnT/burnP` (flamer) e `st.corrT/corrP` (acid) aplicados
  exatamente como antes, exclusivamente no alvo atingido;
- **runout** do burn (12 ticks, 27.00) e **não-DoT** do corrode (Δhp = 0 em
  2 s; amplificador ×1.12/×1.24 confirmado com `damageEnemy` em sandbox);
- **mortes**: 3 partículas por alcance, 0 por vida — sem regressão inercial.

---

## 6. Testes

`tests/pr15-5-e6-fluid-spray-projectile-identity.test.js` — **80 checks**,
blocos A–L, cobrindo os itens obrigatórios: classificação e roteamento,
forma exclusiva (flamer único corpo forquilhado / acid 2 corpos disjuntos),
topologia exacta, orientação ±x ±y diagonal, estado zero sem NaN, mesma cor,
comparação cruzada contra E3/E4/E5/E10 e legado (tesla/plague), ausência
de RNG, ausência de mutação, budget (inclusive custo **decrescente com a
ordem inversa da cadência**), Echo + camada temporal e Replay distinto,
`eorb`/`beam`/`muzzle` intocados, mecânica (defs, nascimento, impacto,
burn/corrode, pierce, morte) e regressão + docs.

### Listas datadas estreitadas (sempre com assert positivo)

Sete suítes/travas anteriores listavam flamer/acid como \"linha legada\" ou
usavam o flamer como âncora. Todas foram **estreitadas, nunca afrouxadas** —
a âncora de legado passou para `tesla` (que continua no ramo junto com
`plague`), e um assert positivo novo entrou em cada uma:

| suíte | assert positivo acrescentado |
|---|---|
| E1 | `C01g` (as duas mudaram em TODAS as combinações), `J07c` (teto 26 + flamer ≤ acid), âncora D05 `L()`/J07 movida p/ tesla |
| E2 | `J08` teto do dispatch 21 → 22 (explicado no comentário) |
| E3 | `A05`/`J05` âncora passou de flamer p/ tesla; `A05e` (forma própria e NÃO-slug, 2 topologias distintas) |
| E4 | `O03d` (flamer/acid não colidem com nenhuma forma do enxame) |
| E5 | `J07` (forma própria + distintas + não colidem com plasma/orb/void/cryo) |
| E8 | `H02e` (as duas têm forma própria e o muzzle não as tocou) |
| E10 | `AD02c` (não colidem com nenhuma forma cinética) |
| perf-audit1 | re-baseline do hash de **texto-fonte** de `drawProjectile` (UMA linha adicionada, ver §6b do teste) |

Contagens: E1 103 → **105**, E2 83 → **83** (mesma contagem, teto subiu),
E3 79 → **80**, E4 73 → **74**, E5 81 → **82**, E8 70 → **71**, E10 71 → **72**,
E6 **80**.

### Rebaseline de golden — justificativa

`tests/pr15-5-performance-audit1.test.js`: apenas o hash textual de
`drawProjectile` (`d4f2d106…` → `633c53d5…`). Os 9 `hashCanvas` das cenas
A–I **seguem idênticos** — nenhum fixture usa flamer/acid (primeras 8
cenários usam plasma, A é vazio) — e o `consumo de RNG de draw` continua 0.
É o mesmo tipo de re-baseline de texto já feito no E1, E2, E3, E4, E5 e E10.

---

## 7. Riscos conhecidos

- Quando muitos projéteis de flamer se acumulam em tela (cadência .045), a
  forquilha da cauda pode ler como "serra" no agregado. É intencional
  (comunica caos), mas merece olho no playtest para não virar ruído.
- O satélite do acid pode ser lido como "segundo projétil" por fração de
  segundo. É o *detalhe* de gotejamento desejado. Se confundir leitura de
  hitbox em jogo denso, a alternativa é tornar o satélite proporcionalmente
  menor (0.28r vs 0.30r atual) — **mesma topologia, nenhum teste mexeria**.
- Nota de padrão: nenhuma forma usa `runTime` — são estáticas por
  proposição. Se um dia for considerada oscilação orgânica, deve seguir o
  precedente do orb (fase por `sin(runTime*k)`) e atualizar o teste F03.

---

## 8. Roteiro de replaytest manual

Este bloco **não está HUMAN APPROVED**. Verificar em jogo:

1. **Flamer** — sem spam completo de cadência (22 proj/s), a língua de jato
   lê como fogo se partindo, não como bala? A forquilha fica visível ou só
   o bico? 
2. **Acid** — o par glóbulo+satélite lê como gotejamento viscoso, com forma
   clara e contida? O satélite confunde a contagem do count 2?
3. **Mesma cor** — forçar flamer e acid na mesma cor (mod debug ou Echo com
   arma de cor compartilhada): continuam distinguíveis por forma?
4. **Versus outras famílias** — lado a lado com slug (rail/sniper/nail),
   swarm (smg/shotgun), energy (plasma/orb/void) e cinética (ricochet/boomer):
   nenhum tipo de projétil fica ambíguo em combate?
5. **Entrada e saída do fade** — a forquilha do flamer desaparece
   enviesadamente antes do bico? (não deveria: o fade é uniforme sobre o
   corpo). 
6. **Echo** — projéteis do Echo de flamer/acid herdam as formas com a camada
   temporal azul oclusa?
7. **Repetição Ancorada** — segue independente, sem projétil extra de
   repetição flamer/acid compounding a cor?
8. **Combate denso** — 20+ projéteis simultâneos misturando famílias: as
   silhuetas continuam legíveis ou viram mancha? (budget: flamer = 18 ops,
   ácido = 21, ambos abaixo do teto 26 do prism)

---

## 9. Referência de auditoria

- Sonda: `/tmp/probe_e6_audit.js` (não commitada — artefato de execução)
- Suite: `tests/pr15-5-e6-fluid-spray-projectile-identity.test.js` (**80 checks**)
- Diff: UMA linha no dispatch + UM helper `drawProjectileFluidSpray(p)` —
  41 linhas, derivado do padrão `drawProjectileEnergyMass(p)` do E5
- Harness: `drawProjectileFluidSpray: typeof drawProjectileFluidSpray!=="undefined"&&drawProjectileFluidSpray,` (guard-if atrás da linha do EnergyMass, mesma convenção)

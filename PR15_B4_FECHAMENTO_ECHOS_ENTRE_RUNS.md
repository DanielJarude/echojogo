# PR15 · B4 — Fechamento: Echos entre Runs

**Intenção, interação e significado das memórias temporais.**

Consolida o que eram B4 + B5 + B6 num único bloco: a memória temporal criada pelo
B1, agendada pelo B2 e corporificada pelo B3 deixa de ser um adorno visual e
passa a **querer alguma coisa** — e o jogador precisa conseguir perceber *o que*
e *por quê*.

- Branch: `arena/01a0844f-echojogo`
- Base: `0a79bc7` (merge do PR #26, `main`)
- Bloco no `index.html`: linhas **33790 – 35521** (1 732 linhas), entre
  `/* ===== PR15·b4 — INTENÇÃO …` e `/* ===== PR15·fim b4 =====*/`
- Boot: `pr15IntentKitBoot();` depois de `pr15PresenceKitBoot();` (o kit do B4
  boota **por último**, então cada wrapper roda depois do correspondente do B3)
- Suíte: `tests/pr15-b4.test.js` — **134 checks + SIM-A…SIM-F**
- `npm test`: **45 suítes · 2 486 checks · 0 falhas · 124.0 s**

---

## A — Problema que este PR resolve

Até o B3, a presença temporal era legível mas **muda**: aparecia, orbitava o
operador, sumia. Nada do que aconteceu na run anterior mudava o comportamento
dela, e nada do que o jogador faz no presente tinha consequência sobre ela.

O B4 fecha três lacunas ao mesmo tempo:

1. **Semântica** — a memória chega com uma *intenção* (aliada / rival /
   ambígua) derivada do que realmente aconteceu na run de origem e do estado
   atual do jogador.
2. **Gameplay** — a intenção se materializa numa de 9 variantes com mecânica
   própria, todas com custo/benefício comunicado antes e nenhuma com dano
   inevitável.
3. **Comunicação** — o jogador consegue responder, sem abrir menu, *"isso veio
   de uma run minha"* e *"está se comportando assim porque…"*.

## B — O que está explicitamente FORA de escopo

IA adaptativa, ML/LLM, difficulty director, Codex, conquistas, nova progressão
meta, reforma de HUD, novos sprites/animações, PR16/17/18. Nada disso foi
tocada. O bloco não cria nenhum elemento de DOM, nenhum listener, nenhum timer.

## C — Arquitetura em uma página

```
B1  memória   →  echoQueue[]  (registro v3: causa, arquétipo, moral, tema…)
B2  director  →  descriptor   (quando, de qual memória, com qual ressonância)
B3  presença  →  pr15Presence (corpo, fases, TTL, visual)
B4  intenção  →  pr15Presence.it  (família, variante, estado, âncora, orçamentos)
```

`pr15Presence.it` é um **sub-objeto do corpo do B3**, não uma entidade nova.
Ele nasce no `pr15PresSpawn` e morre no `pr15PresEnd`. Quando `it` é `null`,
todas as funções do B4 fazem early-return: sem presença, o B4 custa zero.

O B4 nunca escreve em `echoes[]`, `enemies[]`, `projectiles[]` nem chama
`makeEcho`. A presença continua sendo uma entidade separada (ver §P).

## D — O problema espacial e a ÂNCORA (decisão estrutural do B4)

O B3 mantém a presença **orbitando** o operador com `idealDist 320` e piso
`minHoldDist 190`. Isso é correto para o visual — mas torna **impossível por
construção** chegar perto do corpo: a distância mínima é 190 px e qualquer raio
de interação útil (76 px) nunca seria alcançado.

A solução não foi afrouxar o B3 (o `minHoldDist` é coberto por testes dele). Foi
separar duas coisas que estavam coladas:

- **O corpo** continua orbitando o operador — é a identidade visual.
- **A ÂNCORA** `p.it.node = {x, y}` é um ponto fixo do mundo, deixado no ponto de
  spawn. É nela que toda a geometria do B4 é medida: zona, pulso, pressão,
  lobos, interação e indicador off-screen.

Consequência de design: a memória **marca um lugar**, como uma lembrança marca um
canto do mapa. O jogador atravessa a arena para encontrá-la, e ela não o segue.

A âncora é persistida como `act.nx` / `act.ny` (quantizada ×10, como o x/y do B3)
e restaurada exatamente no Continue. Sem isso, um save/continue faria a interação
"andar" junto com a memória.

## E — Intenção: as 3 famílias

| Família | Nome no mundo | Símbolo | Ritmo | Postura |
|---|---|---|---|---|
| `allied` | RESSONÂNCIA COOPERATIVA | ◈ | estável | ajuda sem pedir nada |
| `rival` | DESAFIO TEMPORAL | ◇ | tenso | cobra, mas sempre avisa |
| `ambiguous` | MEMÓRIA INDETERMINADA | ◬ | oscilante | propõe trocas |

RIVAL é **desafio, não inimigo**: nenhuma variante de rival spawna boss,
miniboss, inimigo ou projétil, e nenhuma causa dano direto (B4-35, B4-63).

## F — O algoritmo de intenção

Quatro etapas puras, encadeadas:

```
pr15IntentContext(mem, descriptor)   → contexto lido do jogo
pr15IntentSignalsFor(ctx)            → lista de {tag, signal} acionados
pr15IntentScores(ctx)                → {allied, rival, ambiguous}
pr15IntentDecide(ctx)                → {kind, scores, reasons, u}
```

**Scores.** Cada família parte de uma base (`allied 1.00 · rival 0.92 ·
ambiguous 0.90`) e **soma** os pesos dos sinais disparados. Existe piso de 0.12
por família: nenhuma pode zerar (B4-10).

**Decisão.** `u = fractureRng(fractureHash32("pr15intent|runSeed|seed|intentSeed|memoryId"))()`
e a família é escolhida por roleta sobre os três scores. É determinístico —
`Math.random` não aparece no bloco (B4-07) — mas a seed é o **desempate real**,
não uma faixa fixa.

**O que isto não é.** Não há `intentSeed % 3`, não há faixas 0–33/34–66/67–99,
não há `Math.random`. Os testes B4-06 e B4-11 verificam isso estruturalmente e
comportamentalmente: mudar **um** sinal desloca os **três** scores.

## G — Os 21 sinais e seus pesos

| Sinal | Condição | allied | rival | ambiguous |
|---|---|---:|---:|---:|
| `moralSame` | distância moral < 0.22 | **+0.55** | −0.30 | +0.10 |
| `moralMixed` | 0.22 ≤ distância ≤ 0.46 | +0.05 | +0.05 | **+0.45** |
| `moralShift` | distância > 0.46 | −0.35 | **+0.60** | +0.15 |
| `archSame` | arquétipo dominante igual | **+0.45** | −0.10 | +0.05 |
| `archOther` | arquétipo dominante diferente | −0.10 | +0.20 | **+0.30** |
| `opSame` | mesmo operador nas duas runs | **+0.30** | −0.05 | +0.10 |
| `opOther` | operador diferente | −0.05 | +0.15 | **+0.25** |
| `causeBoss` | morreu para boss/miniboss | −0.15 | **+0.45** | +0.05 |
| `causeHazard` | morreu para hazard | **+0.35** | +0.05 | +0.05 |
| `causeEcho` | morreu por causa de um Echo | +0.05 | +0.05 | **+0.40** |
| `causeEvent` | morreu em evento | −0.05 | +0.05 | **+0.45** |
| `causeEnemy` | morreu para inimigo comum | 0.00 | **+0.22** | +0.12 |
| `causeUnknown` | causa desconhecida | +0.05 | +0.05 | **+0.20** |
| `themeSame` | tema da Fratura igual | **+0.35** | −0.10 | +0.05 |
| `themeOther` | tema diferente | −0.10 | +0.15 | **+0.25** |
| `factionPos` | tensão de facção ≥ +2 | **+0.40** | −0.20 | +0.05 |
| `factionNeg` | tensão de facção ≤ −2 | −0.20 | **+0.45** | +0.10 |
| `fractureHigh` | pressão da Fratura ≥ 0.62 | −0.15 | **+0.35** | +0.15 |
| `srcN2` | memória N-2 (mais antiga) | −0.12 | +0.05 | **+0.30** |
| `resUnstable` | ressonância instável | −0.15 | +0.15 | **+0.35** |
| `resHigh` | ressonância alta | **+0.20** | −0.05 | −0.05 |

**N-2 é mais antiga, não mais forte** (B4-46): o único efeito é empurrar levemente
para AMBÍGUA. Ressonância **não vira raridade** — não há palavra de tier em lugar
nenhum (B4-50).

## H — Vocabulário de razões (fechado)

`MORAL_ECHO · BUILD_RESONANCE · SAME_OPERATOR · DEATH_MEMORY ·
THEME_RESONANCE · FACTION_TENSION · FRACTURE_CONFLICT · MEMORY_AGE ·
COHERENCE · INTENT_SEED`

Dez tags, cap de 12 por decisão (B4-21). Nenhum nome interno cru vaza para texto
de jogador (B4-22) — as tags existem para o DEV e para os testes.

## I — Moralidade 2.0 sem virar "bom = aliado"

O sinal moral é **divergência**, não alinhamento:

```js
pr15MoralDistance(moral, mem.moral)   // 0..1, sobre os 3 eixos normalizados
< 0.22  → moralSame  (ALIADA)
> 0.46  → moralShift (RIVAL)
senão   → moralMixed (AMBÍGUA)
```

Uma run anterior **cruel** com um jogador **cruel hoje** gera ALIADA. Uma run
anterior cruel com um jogador compassivo hoje gera RIVAL. Bom e ruim não
aparecem na conta (B4-53).

O delta moral concedido pelo B4 é **sempre ±1 ponto**, apenas em escolha aceita
pelo jogador, orçado em `budget.moral = 3` por run — menos do que os 3/6/10 por
eixo necessários para trocar de tier sozinha (B4-54).

`moralGain` **não** é usado: ele renderiza negativos como `"+-1"` e dispara
fanfarra de tier. O B4 escreve `moral[axis]` diretamente e chama `applyMoral()`
+ `applyMoralTuning(player)` + toast explícito.

## J — Facções: uma reação, não um segundo sistema

`pr15IntentFactionNet()` lê o `FACTION_GRID` existente + `factionHasPact` +
`fracRival`. Nenhuma tabela nova. Com zero pactos o sinal simplesmente não
aparece (B4-58). A reação passa por `factionEmit(ev, {fac, obs, boost})` com os
eventos já existentes (`compassion_choice`, `greed_choice`, `violence_choice`,
`temporal_residue_offered`) e é limitada por `budget.rep = 6` por run.

`fracFeedback` já se auto-limita por `fracKnows(id)` com cooldown de ~2.6 s,
então não há farming (B4-56).

## K — As 9 variantes

| Família | Variante | Mecânica | Números |
|---|---|---|---|
| ALIADA | `zone` ZONA DE RESSONÂNCIA | −12% dano recebido **só dentro do raio** | raio 170, ×0.88, dura 1.2 s (renovável) |
| ALIADA | `pulse` PULSO DE MEMÓRIA | +6% de escudo máximo a cada pulso (ou +4 HP sem escudo) | a cada 5 s, raio 240, máx. 4 pulsos |
| ALIADA | `legacy` HERANÇA DE BUILD | buff temporário do arquétipo histórico | 14 s, ver tabela abaixo |
| RIVAL | `pressure` PRESSÃO TEMPORAL | +12% dano recebido **dentro do anel**, com aviso | anel 210, aviso 1.4 s, a cada 5.5 s, dura 4 s |
| RIVAL | `trial` PROVA DA RUN ANTERIOR | 4 abates em 14 s → ⧗+3; falhar **não pune** | recompensa 3 resíduos |
| RIVAL | `scar` CICATRIZ DA MORTE | o jogador **aceita** pagar HP por um buff | 8% do HP máx. (mín. 4, máx. 14), 16 s, 1× por run |
| AMBÍGUA | `trade` TROCA TEMPORAL | ⧗4 por +15% de dano | 12 s |
| AMBÍGUA | `unstable` MEMÓRIA INSTÁVEL | aproximar estabiliza; resultado sorteado, **nunca pune** | ⧗+2 / +6% escudo / +3 HP / nada |
| AMBÍGUA | `choice` ESCOLHA DE RESSONÂNCIA | dois lobos no mundo: aceitar (+8% cadência, 10 s) ou recusar (⧗+2) | lobos a 110 px da âncora |

**Herança de build** (`PR15_LEGACY_MODS`, uma assinatura por arquétipo):

| Arquétipo | Stat | Tipo | Valor |
|---|---|---|---|
| `melee` | `meleeRange` | mult | ×1.18 |
| `ranged` | `rangedRange` | mult | ×1.18 |
| `crit` | `crit` | add | +0.06 |
| `shield` | `shieldMax` | mult | ×1.20 |
| `dash` | `speed` | mult | ×1.10 |
| `economy` | `coinMul` | mult | ×1.15 |
| `status` | `fireRate` | mult | ×1.10 |
| `echo` | `pickupR` | mult | ×1.18 |
| *fallback* | `damage` | mult | ×1.08 |

Todos com `stacks:'replace'` e `dur` — **nenhum buff permanente** (B4-28).
As magnitudes ficam **abaixo** da presença de facção equivalente; o maior
multiplicador do bloco é 1.20 e o de herança `echo` foi fixado em 1.18 para
respeitar essa referência (B4-27).

## L — Escolha de variante

`pr15IntentVariant(kind, ctx)` pondera dentro da família usando `cause` e
`resonance` — **nunca trava** uma variante. Cobertura medida em 20 000 amostras:

```
allied    legacy 50.3% · zone 27.0% · pulse 22.7%
rival     scar 41.0% · trial 32.4% · pressure 26.7%
ambiguous unstable 35.5% · choice 33.5% · trade 31.0%
```

A variante é fixada no spawn e não muda durante o ciclo (B4-43). Uma variante
inválida cai num valor válido **da própria família** (B4-44).

## M — Distribuição de intenções

Medição do **SIM-A** (20 000 contextos com espaço amplo de causa/tema/origem/
ressonância/moral):

```
ALIADA 21.99% · RIVAL 32.70% · AMBÍGUA 45.31%
```

Segundo espaço de contexto (20 000 amostras, distribuição uniforme sobre as 7
causas, 3 temas, 2 origens, 3 ressonâncias):

```
ALIADA 33.45% · RIVAL 25.62% · AMBÍGUA 40.92%
```

Nenhuma família desaparece em nenhum dos dois espaços (B4-13, B4-14). Com
contexto homogêneo (4 000 amostras, mesma memória repetida) a distribuição fica
em 37.8 / 22.3 / 39.9 — a variação vem só do `intentSeed`, exatamente como deve
ser.

## N — O ciclo de uma interação

```
spawn      →  it = {kind, variant, st:'idle', t:0, cd, pulses:0, node:{x,y}}
oferece    →  it.t >= 1.4 s COM O JOGADOR EM ALCANCE → rótulo no mundo
interage   →  pr15IntentTryInteract → handler da variante → st final
resolve    →  pr15IntentMarkResolved(encounterId, kind, variant, ganho)
fim        →  pr15IntentClear → p.it = null
```

Estados: `idle · offered · accepted · declined · resolved` (`PR15_ISTATES`).
`accepted`, `declined`, `refused` e `resolved` são **terminais** — `tryInteract`
recusa reabrir a oferta. É isso que impede cobrar duas vezes (B4-78).

## O — Custo comunicado antes, sempre

| Variante | O que o jogador lê antes de decidir |
|---|---|
| `scar` | `APROXIME-SE PARA ABRIR A CICATRIZ · −9 → +BENEFÍCIO TEMPORÁRIO` |
| `trade` | `TROCA TEMPORAL · ⧗4 → +15% DANO · 12s · SALDO 20` |
| `pressure` | telegrafo de 1.4 s no anel **antes** do primeiro tick de custo |
| `choice` | dois lobos rotulados `ACEITAR` / `RECUSAR` no mundo |

`pr15IntentInteractLabel(p)` é a **única** fonte do rótulo, e `pr15IntentTradeOffer(p)`
é um predicado puro que o rótulo, o DEV e a cobrança compartilham — comunicado e
cobrado não podem divergir. Sair sem interagir é resposta válida e registrada
(B4-42, B4-68). Nenhuma variante abre modal ou congela o combate (B4-41).

## P — Zero transformação

- nunca entra em `echoes[]` nem em `enemies[]` (B4-60, B4-62, B4-107)
- nunca recebe `hp/maxHp/shield/team/solid/hitbox/tgt/trust/dis/hostile` (B4-61)
- nunca é alvo de `pickTarget`; `drawEchoEntity`/`updateEcho` não têm ramificação
  sobre ela (B4-64)
- nunca causa dano direto ao jogador (B4-63)
- `makeEcho` não é chamado em nenhum caminho do B4

## Q — Orçamentos por run (anti-snowball)

Uma run recebe no máximo 3 aparições (teto do B2). Os tetos valem para a **soma
das três**:

| Chave | Teto por run | O que limita |
|---|---:|---|
| `res` | 12 ⧗ | resíduos temporais concedidos |
| `heal` | 40 HP | cura total |
| `shield` | 0.40 | escudo como fração do máximo |
| `rep` | 6 | reputação de facção |
| `moral` | 3 | pontos de moralidade |
| `scar` | 1 | aberturas de cicatriz |

O teto de escudo é **deliberadamente menor** do que três aparições cheias
conseguiriam (3 × 4 pulsos × 6% = 0,72). Sem isso ele seria decorativo: o
SIM-F mede que ele **morde** em 392 de 900 runs simuladas.

`pr15IntentSpend(k, n)` devolve o valor **realmente concedido** (pode ser 0), e
todo grant usa esse retorno — então o texto mostrado ao jogador nunca promete o
que o orçamento não pagou.

> **Defeito encontrado e corrigido durante os testes.** `pr15IntentSpend` fazia
> `r.bud[k] = ((r.bud[k]|0) + got)`. O `|0` trunca para inteiro, e o orçamento de
> escudo é fracionário: quatro pulsos de 6% acumulavam 0.06 em vez de 0.24, e o
> teto de escudo nunca acumulava. Trocado por `((+r.bud[k]||0) + got)`. Foi o
> SIM-F reescrito que expôs o bug — antes ele resetava o registro a cada encontro
> e media sempre zero.

## R — Persistência

Campo próprio no checkpoint:

```js
cp.pr15intent = {
  v: 1,
  res: [ {enc, k, v, g, at} ],       // encontros resolvidos (cap 8)
  bud: {res, heal, shield, rep, moral, scar},
  act: {enc, it, vr, st, t, cd, pu, fi, tr, k0, nx, ny}   // só escalares
}
```

`cp.pr15mem` (B2) e `cp.pr15presence` (B3) ficam **byte a byte** como estavam
(B4-72, B4-108) — estender `cp.pr15presence` quebraria as asserções de forma de
pack do B3.

O pack nunca serializa partículas, afterimages, closures nem entidades (B4-71).
Tudo é re-sanitizado por `pr15IntentSanitize` na carga, então um save corrompido
não lança nem produz NaN (B4-99, B4-100). Um save antigo sem `cp.pr15intent`
carrega e não concede nada (B4-101).

**Continue.** `resumeRun` faz unpack **antes** de aplicar e chama
`pr15IntentRebuild()` depois. O rebuild lê o payload **antes** de
`pr15PresRebuild()` — o attach disparado pelo wrapper do spawn consome
`pr15IntentRun.act`. Resultado medido: 0 reroll de intenção/variante, 0
duplicação de recompensa ou custo, TTL e âncora preservados (B4-73…B4-76,
SIM-C com 600 ciclos).

## S — Idempotência

- `pr15IntentMarkResolved` é idempotente por `encounterId` e **não sobrescreve**
  (B4-79)
- `pr15IntentAlreadyResolved` barra recompensa repetida no mesmo encontro (B4-74)
- estados terminais barram custo repetido (B4-75, B4-78)
- a cicatriz só abre uma vez por run, via `budget.scar = 1` (B4-83)
- TTL nunca reinicia (B4-67): `ttl = PR15_PRES_TOTAL − age`, e o B4 não escreve
  em `ttl` nem em `age`

## T — Sandbox

Os 5 pontos de sandbox do projeto (`sandboxStart`, `sandboxExit`,
`sandboxRestart`, `sandboxEndToSetup`, `sandboxCloseSetup`) recebem
`pr15IntentSandboxContextStart` / `pr15IntentSandboxTearDown`.

Dentro do laboratório: registro vazio, `pr15IntentGuard()` retorna `false`,
nenhuma consequência é aplicada, nenhum anúncio nem áudio sai, e o registro real
volta intacto na saída (B4-84…B4-88). O laboratório não escreve memória nem
contamina o slot.

## U — DEV

`DEV.pr15IntentState`, `pr15IntentExplain`, `pr15ForceIntent`,
`pr15ForceVariant`, `pr15PresenceIntentState` — todos com guarda `!DEV_MODE`,
inertes em release (B4-89). Forçar intenção ou variante chama `devTaint()`, então
a run **nunca** vira memória legítima e nunca persiste estado do B4
(B4-90…B4-95). Forçar intenção não cria descriptor falso no B2 (B4-95).

## V — Isolamento de slot

`activateSlot` e `smClearSlotSave` foram embrulhados para chamar
`pr15IntentReset()`. Um slot sem estado não escreve lixo no save do vizinho
(B4-96…B4-98).

## W — UX e comunicação

- Banner `RESSONÂNCIA TEMPORAL` + toast curto, **uma vez** por aparição (B4-114)
- Rótulo world-space que **some sozinho** em `labelHold = 6.0 s` — não é painel
  permanente (B4-115)
- Indicador off-screen (`edgePad 52`, `edgeMinAlpha 0.35`) que aparece só quando a
  presença está fora da janela (B4-118) e **aponta a âncora** quando há interação
  pendente, o corpo caso contrário (B4-118b)
- Fala rara de Echo aliado com cooldown de `speechCooldown = 9 s` (B4-59)
- Nenhuma UI permanente: o bloco não cria elemento nem HUD novo (B4-117)

## X — Performance

- `pr15IntentUpdate` faz early-return quando `pr15Presence` é nulo (B4-112)
- nenhum `setTimeout`/`setInterval`/`addEventListener`/`requestAnimationFrame`
  no bloco (B4-111)
- caps: `afterimageMax 4`, `particleMax 10`, `doneMax 8`, `resMax 8`,
  `reasonMax 12` — nenhum array cresce sem limite (B4-110, SIM-E)
- 1 200 aparições completas em 3.9 s: 0 órfãs, 0 NaN, sem crescimento (SIM-E)

## Y — Regressões

`tests/pr15-b1.test.js` (40), `pr15-b2.test.js` (65) e `pr15-b3.test.js` (80)
continuam verdes **sem nenhuma edição**. Os blocos B1/B2/B3 não foram alterados
internamente (B4-109); o B4 só acrescenta wrappers aditivos que bootam depois.

## Z — Defeitos encontrados pelos próprios testes

| # | Defeito | Como foi achado | Correção |
|---|---|---|---|
| 1 | Interação **inalcançável**: `minHoldDist 190` vs raio 76 | B4-30 em diante falhavam em massa | Âncora fixa no mundo (§D) |
| 2 | `it.st='accepted'` marcado **antes** do handler, que recusava `st==='accepted'` | B4-33/36/37/40/75/78 | Handler decide e marca o estado |
| 3 | `pr15IntentSpend` truncava com `\|0` e o orçamento de escudo nunca acumulava | SIM-F reescrito | `(+r.bud[k]\|\|0)` |
| 4 | `pr15IntentRebuild` lia o payload **depois** do attach que o consome | B4-73 (âncora não preservada) | Ler `act` antes de `pr15PresRebuild()` |
| 5 | Sinais expostos como `{tag, sig}` mas lidos como `.signal` | B4-52 | Campo único `signal` |
| 6 | `PR15_INTENT_CFG` é plano; `cfg.allied.pulseMax` não existe | B4-73 | `cfg.pulseMax` |
| 7 | 4 funções públicas lançavam com `null` | B4-123 | Guards em `Lobes`/`Label`/`Offerable`/`TryInteract` |
| 8 | Herança `echo` ×1.25 acima da referência de facção | B4-27 | ×1.18 |
| 9 | Teto de escudo 0.80 nunca mordia (0.72 era o máximo possível) | B4-80 | 0.40 |
| 10 | `pr15IntentTradeOffer` referenciado mas inexistente | B4-36 | Predicado puro extraído de `pr15IntentTrade` |

## AA — 30 invariantes finais

1. A intenção é função determinística de `runSeed|seed|intentSeed|memoryId` + contexto.
2. `Math.random` não decide nada no B4.
3. Nenhuma família tem score 0: o piso é 0.12.
4. Mudar um sinal desloca os três scores (soma, não fatia).
5. Nenhuma família desaparece num espaço amplo de contexto.
6. As razões vêm de um vocabulário fechado de 10 tags, cap 12.
7. A moralidade influencia por **divergência**, nunca por bom/ruim.
8. O delta moral do B4 é ±1 e cabe em `budget.moral = 3`.
9. Facções reagem só com pacto real, via `FACTION_GRID` existente.
10. Ressonância não vira raridade nem power tier.
11. N-2 é mais antiga, não mais forte.
12. A variante é fixada no spawn e pertence sempre à família decidida.
13. A presença nunca entra em `echoes[]`.
14. A presença nunca entra em `enemies[]` nem vira alvo.
15. `makeEcho` nunca é chamado pelo B4.
16. Nenhuma variante causa dano direto ao jogador.
17. RIVAL nunca spawna boss, miniboss, inimigo ou projétil.
18. Nenhum custo é aplicado sem estar no rótulo antes.
19. Nenhuma variante abre modal ou congela o combate.
20. Sair sem interagir é resposta válida e registrada.
21. Nenhum buff é permanente: tudo tem `dur` e `stacks:'replace'`.
22. Todo ganho passa por `pr15IntentSpend` e usa o valor realmente concedido.
23. Os seis tetos de orçamento valem para a soma das três aparições da run.
24. O teto de escudo morde (0.40 < 0.72 possíveis).
25. `cp.pr15mem` e `cp.pr15presence` permanecem byte a byte como no B2/B3.
26. O Continue não rerolla intenção nem variante, e preserva TTL, contadores e âncora.
27. Recompensa e custo já aplicados nunca são aplicados de novo.
28. Save/Continue é tolerante: corrompido não lança, antigo não concede.
29. Sandbox e DEV não aplicam consequência nem persistem; DEV tainta a run.
30. Sem presença, o B4 custa zero (early-return) e não aloca por frame.

## AB — Dívidas técnicas conhecidas

1. **`allied/legacy` é a variante mais frequente** (50.3%). A ponderação por
   `cause` favorece `legacy` quando há arquétipo histórico — que é quase sempre.
   Não é bug, mas o playtest deve dizer se enjoa.
2. **A âncora é o ponto de spawn**, não um ponto semanticamente significativo.
   Uma memória de boss poderia ancorar na arena do boss. Ficou de fora: exigiria
   que o B1 gravasse posição.
3. **`unstable` sorteia por `fractureRng(seed^intentSeed)`**, então o resultado é
   fixo por encontro. O jogador que recarrega e repete a aproximação vê o mesmo
   resultado — é o comportamento correto (determinismo), mas não está sinalizado.
4. **`budget.rep = 6` nunca foi atingido** em nenhuma das 900 runs do SIM-F
   (pior caso medido: 0). O teto existe como defesa, mas a reação de facção é
   rara o suficiente para nunca chegar perto.
5. **`pr15IntentExplain` é caro** (reconstrói o contexto). Só é chamado pelo DEV
   e pelos testes — nunca por frame. Está documentado aqui para ninguém
   engatá-lo no loop.
6. **O rótulo usa `labelHold = 6.0 s` fixo.** Para `trade` e `scar` o texto é
   longo e pode sair da tela antes de ser lido. O playtest deve decidir.

## AC — Checklist de playtest humano (10 itens)

Marque cada item jogando de verdade, com `DEV_MODE` **desligado**.

- [ ] **1 — Percepção de origem.** Ao ver a presença, você consegue dizer
      *"isso veio de uma run minha"* sem olhar nenhum menu?
- [ ] **2 — Percepção de causa.** Você consegue apontar **qual** run de origem
      ela é (a última? uma mais antiga?) e **por que** ela se comporta assim?
- [ ] **3 — ALIADA ajuda de verdade.** A zona/pulso/herança muda como você joga
      aquela arena, ou você a ignora?
- [ ] **4 — RIVAL é desafio, não castigo.** Depois de uma PRESSÃO TEMPORAL ou
      CICATRIZ, você se sente desafiado ou punido? O aviso de 1.4 s é suficiente
      para reagir?
- [ ] **5 — Custo lido antes.** Em todas as interações, você soube o que ia
      pagar **antes** de pagar? Algum rótulo saiu da tela rápido demais?
- [ ] **6 — Âncora encontrável.** Você achou o ponto de interação sem se perder?
      O indicador off-screen bastou?
- [ ] **7 — AMBÍGUA é escolha real.** Recusar a ESCOLHA DE RESSONÂNCIA parece uma
      opção válida, ou você sente que "perdeu"?
- [ ] **8 — Continue transparente.** Morrer no meio de um encontro e continuar
      retoma exatamente onde estava, sem sensação de reroll ou de ter pago duas
      vezes?
- [ ] **9 — Sem snowball.** Depois de 3 aparições numa run, o ganho acumulado
      parece justo ou você ficou forte demais?
- [ ] **10 — Sem ruído.** A presença nunca virou inimigo, nunca apareceu na lista
      de Echos, nunca quebrou o HUD e nunca travou o combate?

## AD — Verificação automatizada

```
node tests/pr15-b4.test.js      →  134 PASSARAM · 0 FALHAS
npm test                        →  45 suítes · 2 486 checks · 0 falhas · 124.0 s
```

| SIM | O que mede | Resultado |
|---|---|---|
| A | distribuição em 20 000 contextos | 21.99 / 32.70 / 45.31 — nenhuma some |
| B | determinismo sob 200 000 `Math.random` intercalados | 0 divergências |
| C | 600 ciclos de save/Continue em todas as fases | 0 reroll, 0 duplicação, TTL preservado |
| D | reload, Continue repetido, abort, morte, vitória, slot, Sandbox, DEV | 0 violações |
| E | 1 200 aparições completas em 3.9 s | caps respeitados, 0 órfãs, 0 NaN |
| F | 900 runs × 3 encontros | tetos respeitados; teto de escudo morde em 392/900 |

## AE — Veredito

# GO PARA PLAYTEST

O bloco está completo, integrado, testado e documentado. As 30 invariantes são
verificadas por checks executáveis. As seis dívidas de §AB são de **sensação de
jogo**, não de correção — e é exatamente isso que o checklist de §AC existe para
responder.

**Não é GO final para merge.** O veredito final depende do playtest humano.

*Nenhum PR foi aberto, nenhum merge foi feito, nada foi enviado por push.*

# PR15 · B3 — PRESENÇA TEMPORAL FÍSICA

> **Versão do jogo:** 0.9.0-alpha · **SM_VERSION:** 3 · **FRACTURE_STATE_VERSION:** 1
> **Bloco:** `index.html` linhas **32860–33787** (`PR15·b3` … `PR15·fim b3`), boot em **33798**
> **Suíte:** `tests/pr15-b3.test.js` — 80 checks (75 áreas do brief §30 + 5 simulações §31)
> **Auditoria extra:** `audit_pr15/temporal_presence_b3_audit.js` (simulações longas, fora do `npm test`)
> **Depende de:** PR15·B1 (memória temporal v3) e PR15·B2 (Director / descriptor)
> **Não implementa:** intenção (ALIADA/RIVAL/AMBÍGUA), moralidade, facções reagindo, diálogo,
> escolhas de evento, recompensas, IA adaptativa, boss adaptation, Codex, HUD final, balanceamento — tudo isso é B4+

---

## A. Objetivo

O B1 criou os **dados** (memórias N-1/N-2 com identidade estável).
O B2 criou a **decisão** (quando, qual memória, com que ressonância — o *descriptor*).

O B3 responde à única pergunta que sobrou:

> **"Como essa decisão vira algo que o jogador VÊ na arena?"**

Concretamente, quando o Director marca um descriptor como `consumed`, o B3:

1. **materializa** uma entidade física na arena, separada dos Echos aliados;
2. dá a ela uma **entrada** visual, uma **permanência** limitada e uma **saída** por desmaterialização;
3. escolhe uma **posição segura e determinística**, longe do operador;
4. aplica um **movimento base** próprio (nada de replay de trail);
5. dá a ela uma **identidade visual** lida como "versão temporal de uma run anterior";
6. **liga** essa presença exatamente à memória histórica de origem, sem copiá-la nem alterá-la;
7. **persiste** o mínimo necessário para o Continue não duplicar nem reiniciar o ciclo;
8. entrega um **contrato estável** para o B4 pendurar intenção.

O B3 é **corpo + ciclo de vida + identidade visual + movimento**. Zero combate, zero significado.

---

## B. Arquitetura

```
  DESCRIPTOR B2 (st:'consumed', at:W)          MEMÓRIA HISTÓRICA (echoQueue, do B1)
              │                                             │
              ▼                                             │ (somente leitura)
      pr15PresOnWave(W)                                     │
              │  filtros: fresh? cap 1? at===W? sandbox? restoring?
              ▼                                             │
      pr15PresSpawn(descriptor)                             │
              ├── pr15PresResolveMemory(descriptor.mem) ────┘  → null ⇒ falha segura
              ├── pr15PresReadVisual(mem)      escalares de apresentação
              ├── pr15PresPos(descriptor.seed) determinístico, seguro
              └── pr15Presence = { corpo }     ← 1 por vez, FORA de echoes[]
                        │
     ┌──────────────────┼──────────────────────────────┐
     ▼                  ▼                              ▼
 pr15PresUpdate(dt)  pr15PresDraw()             pr15PresPack()
  (updateAllies)     (drawWorldExtras)          (smBuildCheckpoint)
     │                                                  │
     ├── pr15PresMove()      órbita + suavização        ▼
     ├── pr15PresGhostTick() afterimages (cap)   cp.pr15presence
     └── fases → pr15PresEnd() → done[]                 │
                                                        ▼
                                            pr15PresUnpack + pr15PresRebuild
                                                   (resumeRun)
```

Todo o acoplamento com o jogo é feito por **monkey-patch aditivo** em `pr15PresenceKitBoot()`,
chamado logo depois de `pr15MemoryKitBoot()`. Nenhuma função pré-existente foi editada
internamente — `drawEchoEntity`, `updateEcho` e `updateEnemy` continuam sem qualquer
ramificação sobre a presença (verificado por `B3-44` e `B3-45`).

---

## C. Limites B3 vs B4

| Pergunta | Responde | Onde |
|---|---|---|
| Existe uma aparição nesta run? | B2 | descriptor `st` |
| Em que onda? | B2 | `descriptor.at` |
| Qual memória? | B2 | `descriptor.mem` |
| Quão coerente? | B2 | `descriptor.res` |
| **Como ela aparece na arena?** | **B3** | `pr15PresSpawn` |
| **Quanto tempo fica?** | **B3** | `PR15_PRES_CFG` |
| **Como se move?** | **B3** | `pr15PresMove` |
| **Como é desenhada?** | **B3** | `pr15PresDraw` |
| Ela é ALIADA / RIVAL / AMBÍGUA? | B4 | — |
| Ela ataca, ajuda, dialoga? | B4+ | — |
| Ela dá recompensa / muda facção / entra no Codex? | B4+ | — |

O B3 **transporta** `intentSeed` sem interpretá-lo. Nenhuma comparação de faixa, nenhum
`% 3`, nenhum enum de postura existe no bloco (`B3-17`, `B3-73`).

---

## D. A entidade

Estado global único: **`pr15Presence`** (`null` quando não há nada em cena).
Ela **não** entra em `echoes[]`, **não** entra em `enemies[]`, e **não** é criada por `makeEcho`.

```js
{
  v:1,
  encounterId, memoryId,        // ligação exata: B2 e B1
  source:'n1'|'n2',             // do descriptor, nunca re-derivado
  resonance:'high'|'normal'|'unstable',
  seed, intentSeed, wave,       // do descriptor, nunca re-rolados
  x, y, vx, vy, hx, hy, r,      // posição atual, velocidade, âncora, raio
  phase, age, ttl,              // ciclo de vida
  alpha, scale, entered, leaving,
  aim, orbit, dir,              // movimento base
  ghosts:[], ghostT,            // afterimages (cap duro)
  pUsed,                        // orçamento de partículas consumido
  vis, fb, dev, why             // apresentação, fallback de posição, marca DEV, motivo
}
```

**Campos que deliberadamente NÃO existem:** `hp`, `maxHp`, `shield`, `shieldMax`, `team`,
`solid`, `hitbox`, `tgt`, `target`, `rel`, `trust`, `dis`, `hostile`, `itemIds`, `ownedW`,
`curW`, `data`, `trail`, `pi`, `slot`. A ausência é testada (`B3-35`, `B3-38` … `B3-43`).

---

## E. Configuração centralizada (`PR15_PRES_CFG`)

Nenhum número mágico vive fora desta tabela (`B3-01` verifica que `entryTime` e
`minPlayerDist` não aparecem duplicados fora do bloco).

| Chave | Valor | Papel |
|---|---|---|
| `entryTime` | `1.0` s | materialização (brief: 0,8–1,2) |
| `activeTime` | `24.0` s | permanência (brief: 20–30) |
| `exitTime` | `1.2` s | desmaterialização (brief: 0,8–1,5) |
| `radius` | `14` | raio visual/lógico |
| `margin` | `120` | margem interna da arena |
| `minPlayerDist` | `280` | distância mínima do operador no spawn (brief: 220–300) |
| `maxPlayerDist` | `560` | distância máxima (fica legível na tela) |
| `minHoldDist` | `190` | distância que o movimento base nunca fura |
| `holdEps` | `0.25` | histerese do clamp acima (ver §S) |
| `idealDist` | `320` | raio de órbita preferido |
| `orbitSpeed` | `0.20` | rad/s da órbita |
| `follow` | `1.6` | suavização até a âncora |
| `posTries` | `10` | tentativas de posicionamento antes do fallback |
| `avoidEnemy` / `avoidBoss` / `avoidMini` | `70` / `230` / `200` | raios de exclusão |
| `avoidBeacon` / `avoidPresence` / `avoidHazard` | `170` / `170` / `40` | raios de exclusão |
| `afterimageBase` / `afterimageMax` | `3` / **`4`** | cap duro de afterimages |
| `particleMax` | **`10`** | orçamento de partículas por aparição |
| `ghostInterval` | `0.10` s | cadência de amostragem do afterimage |
| `doneMax` | `8` | tamanho máximo do registro de materializados |

Derivada: **`PR15_PRES_TOTAL = 26.2 s`** (`entry + active + exit`).

---

## F. Ciclo de vida

`PR15_PRES_PHASES = { spawning, active, leaving, done }`

| Fase | Duração | Comportamento |
|---|---|---|
| `spawning` | `entryTime` | `alpha` e `scale` crescem; `entered=false`; já se move |
| `active` | `activeTime` | `alpha=1`, `scale=1`; órbita plena |
| `leaving` | `exitTime` | `alpha` decresce; `leaving=true` |
| `done` | — | `pr15Presence=null`, `encounterId` vai para `done[]` |

`age` cresce monotonicamente e `ttl = TOTAL - age`. `pr15PresLeave(motivo)` antecipa a saída
**sem** encurtá-la: o `ttl` passa a ser exatamente `exitTime` (`B3-24`). `pr15PresEnd()` é
idempotente e nunca deixa timers ou listeners para trás — o bloco não usa `setTimeout`,
`setInterval`, `requestAnimationFrame` nem `addEventListener` (`B3-29`).

`dt` hostil (`NaN`, negativo, `Infinity`, string, `null`) é clampado; a idade nunca vira
`NaN` nem regride (`B3-26`).

---

## G. Determinismo e posicionamento

`pr15PresPos(seed, px, py)` usa **`fractureRng(fractureHash32(seed))`** — o RNG determinístico
do projeto. **`Math.random` não aparece uma única vez no bloco** (`B3-16`).

Algoritmo:

1. até `posTries` amostras de `(ângulo, distância)` derivadas da seed, com
   `minPlayerDist ≤ d ≤ maxPlayerDist`;
2. cada candidato é clampado à arena (`margin`) e testado por `pr15PresSpotBlocked`;
3. se nada passar, **fallback determinístico**: varredura de 16 ângulos no raio ideal,
   e por último o ponto mais distante do operador dentro da margem — sempre marcando `fb=1`.

`pr15PresSpotBlocked(x,y)` recusa proximidade de inimigos vivos, boss, mini-chefe e seus
hazards, beacon, e presença de facção. É o **único** ponto do bloco que menciona facção,
e apenas como leitura geométrica (`B3-74`).

**Resultado medido (SIM-B, 4.000 amostras):** 100 % determinístico, 100 % dentro da arena,
100 % com distância ≥ 280 px (faixa observada 280–559 px), fallback em 1,2 % dos casos.
Com a arena artificialmente saturada de obstáculos, 250/250 caem no fallback e 250/250
continuam dentro da arena com coordenadas finitas (`B3-21`).

---

## H. Movimento base

`pr15PresMove(p, dt)`: âncora orbital em torno do operador a `idealDist`, com velocidade
angular `orbitSpeed`, sentido dado por `dir` (derivado da seed), seguida por uma suavização
exponencial (`follow`) da posição real até a âncora. A posição é sempre clampada à arena e
nunca fura `minHoldDist` (com histerese `holdEps`).

Não é replay: a presença **não lê `trail`** de memória nenhuma (`B3-43`). Ela não persegue,
não recua, não intercepta, não colide.

---

## I. Ligação com a memória histórica

`pr15PresResolveMemory(memoryId)` procura o id **apenas** nos índices 0 e 1 do `echoQueue`
(N-1 e N-2) e exige `pr15MemIsEligible` (assinatura v3). Devolve `{rec, idx, source}` ou `null`.

- id ausente, vazio, `null`, numérico ou objeto ⇒ `null` ⇒ **spawn recusado**, nenhuma
  entidade parcial criada, run segue jogável (`B3-08`);
- memória **v2 legada** nunca resolve ⇒ nunca vira presença — mas continua funcionando
  normalmente como Echo aliado via `makeEcho` (`B3-09`).

`pr15PresReadVisual(rec)` extrai **apenas escalares de apresentação** (operador, tema, arma
assinatura → índice de silhueta). O registro histórico nunca é copiado para dentro da
entidade e nunca é modificado (`B3-30`).

---

## J. Identidade visual

Paleta fixa do ECHO: `PR15_PRES_CYAN = '#46e0ff'` e `PR15_PRES_MAGENTA = '#ff4df0'`.
A leitura pretendida é **distorção temporal** (deslocamento cromático, contorno instável,
afterimages defasados, anel de fase), não "glitch genérico" e não "inimigo especial".

### Ressonância — `PR15_PRES_RES_VIS`

| `resonance` | Leitura | `jitter` | `split` | `wobble` | `ghosts` |
|---|---|---|---|---|---|
| `high` | **mais coerente / mais estável** | menor | menor | menor | menos |
| `normal` | distorção moderada | médio | médio | médio | médio |
| `unstable` | mais deslocamento e oscilação | maior | maior | maior | mais (≤ cap) |

> **Decisão de design (brief §17):** `high` é ~75 % dos casos, então **não pode parecer
> raridade lendária**. A diferença é *coerência*, não *brilho*. O bloco não contém nenhuma
> palavra de raridade (`lend`, `legend`, `rare`, `epic`, `gold`…) — testado em `B3-46`.

### Origem — `PR15_PRES_SRC_VIS`

| `source` | `crisp` | `lag` | `frag` | Leitura |
|---|---|---|---|---|
| `n1` | `1.00` | `0.06` | `0` | silhueta definida, quase sincronizada |
| `n2` | `0.82` | `0.14` | `1` | degradada, atrasada, fragmentada |

A tabela de origem **não define nenhuma cor** (`B3-50`): as duas origens compartilham a mesma
dupla ciano/magenta, e a diferença é forma/nitidez/defasagem — legível em daltonismo.

`pr15PresVisualState(res, src)` combina as duas tabelas; valores inválidos caem em
`normal`/`n1` sem inventar decisão nova.

---

## K. Caps de performance

- **Afterimages:** `afterimageMax = 4`, duro. `pr15PresGhostCapFor(res, src)` devolve o cap
  da combinação; medido em todas as 6 combinações e nunca excedido (`B3-51`).
- **Partículas:** orçamento `particleMax = 10` **por aparição**, contado em `pUsed`.
  `pr15PresBurst` devolve `0` quando o orçamento acabou; pedidos de 20×50 partículas não
  furam o teto (`B3-52`). Máximo real observado no stress: **7/10**.
- **Registro `done[]`:** truncado em `doneMax = 8`.
- O renderer não aloca por frame fora dos arrays já limitados, e não toca DOM (`B3-44`).

**Stress (SIM-D, 300 aparições completas):** afterimages máx 4/4, partículas máx 7/10,
`done` máx 8/8, **zero** entidade vazada, `echoQueue` intacta.

---

## L. Zero combate

Garantido por ausência estrutural + verificação comportamental:

| Garantia | Como |
|---|---|
| Não dá dano ao jogador | HP inalterado em 400 ticks; bloco não chama `damagePlayer` |
| Não dá dano a inimigos | HP inalterado; bloco não chama `damageEnemy`/`killEnemy` |
| Não cria projéteis | `projectiles` continua vazio; sem `projectiles.push`/`fire*` |
| Não adquire alvo | sem `tgt`/`target`; bloco não chama `pickTarget`/`nearestEnemy` |
| Não bloqueia | projétil atravessa a área da presença; jogador não é empurrado |
| Inimigos não a miram | `pickTarget` devolve o jogador; ela não está em `echoes[]` |
| Jogador não a atinge | ela não está em `enemies[]`; bloco nunca faz `enemies.push` |

---

## M. Separação dos Echos aliados

A presença **não** é um Echo. Não passa por `makeEcho`, não entra em `echoes[]`, e não recebe
`relationship`, `Dissonância`, `equipment`, escudo aliado nem trail replay — cada um desses
sistemas tem um teste dedicado verificando tanto o campo ausente na entidade quanto a
ausência da chamada no código-fonte do bloco (`B3-38` … `B3-43`).

`sigW` da memória é lido **só** como detalhe visual, virando um índice de silhueta via
`pr15PresSilhouetteWi()` — nunca uma arma funcional (`B3-41`).

---

## N. Estado run-scoped

```js
pr15PresRun = { v:1, done:[ encounterId… ], act:{…}|null }
```

- `done[]` — encounters já materializados nesta run (impede repetição, truncado em 8);
- `act` — buffer de restauração usado entre `pr15PresUnpack` e `pr15PresRebuild`;
- `pr15PresSandboxStash` — guarda o estado real enquanto o laboratório roda.

`pr15PresStatusOf(id)` → `'pending' | 'active' | 'done'`.

---

## O. Checkpoint e Continue

`smBuildCheckpoint` grava `cp.pr15presence = pr15PresPack()`:

```js
{ v:1, done:[…], act:{ v, enc, mem, src, res, seed, intent, wave, x, y, ph, age, fb } }
```

**Não persistido** (reconstruído em jogo): partículas, afterimages, `alpha`, `scale`,
`vx/vy`, âncora, buffers de render (`B3-56`).

`resumeRun` chama `pr15PresUnpack(cp)` + `pr15PresRebuild()`:

- `Unpack` limpa o corpo, sanitiza e guarda em `act`;
- `Rebuild` reconstrói **uma única vez** — a segunda chamada devolve `null` (`B3-58`);
- `age` é preservada ⇒ **o TTL nunca reinicia** (`B3-57`);
- o encounter restaurado entra em `done[]`, então a onda reprocessada não duplica (`B3-12`).

**Save antigo sem `cp.pr15presence`** (ou `null`, `{}`, string, número) carrega normalmente e
não materializa nada (`B3-59`). Uma run antiga com descriptor `consumed` em onda anterior
**não ganha aparição retroativa**: `pr15PresOnWave(w)` exige `e.at === w`.

**Presença DEV nunca é gravada** no checkpoint (`B3-65`).

---

## P. Sanitização

`pr15PresSanitize` / `pr15PresSanAct` clampam tudo: `src` ∈ {n1,n2}, `res` ∈ {high,normal,unstable},
fase válida e diferente de `done`, `seed`/`intent`/`wave`/`x`/`y`/`age`/`fb` finitos,
`0 ≤ age ≤ TOTAL`, `done` array truncado.

**600 cargas hostis** (NaN, Infinity, `-Infinity`, strings, objetos, arrays, booleanos,
negativos, `1e30`) passaram por `unpack → rebuild → pack` sem exceção, sem `NaN` no pack e
sem campo não-finito na entidade (`B3-61`).

---

## Q. Isolamento (slot / sandbox / DEV)

- **Slots:** `activateSlot` e `smClearSlotSave` chamam `pr15PresReset()`. Slot sem estado
  produz `pack() === null` — nada de lixo escrito no save do vizinho (`B3-62`).
- **Sandbox:** `pr15PresOnWave` retorna imediatamente quando `sandboxRun` é verdadeiro.
  `pr15PresSandboxContextStart()` guarda o estado real e entrega um registro limpo ao
  laboratório; `pr15PresSandboxTearDown()` devolve o original intacto e destrói qualquer
  corpo criado lá dentro. Nada vaza nos dois sentidos (`B3-63`).
- **DEV:** `pr15DevPresenceState/Spawn/End/Visual` checam `DEV_MODE` e retornam `null` em
  release (`B3-64`). `pr15DevPresenceSpawn` chama `devTaint()`, marca `dev:true`, **não**
  registra em `done[]`, **não** é persistida e **não** cria descriptor falso no estado do B2
  (`B3-65`).

---

## R. Hooks instalados (`pr15PresenceKitBoot`)

| Alvo | Ação |
|---|---|
| `spawnWave` | `pr15PresOnWave(w)` após a lógica original |
| `updateAllies` | `pr15PresUpdate(dt)` |
| `drawWorldExtras` | `pr15PresDraw()` |
| `smBuildCheckpoint` | `cp.pr15presence = pr15PresPack()` |
| `resumeRun` | `pr15PresUnpack(cp)` + `pr15PresRebuild()` |
| `startRun`, `onPlayerDeath`, `onVictory`, `showVictory`, `abortRun` | `pr15PresReset()` |
| `activateSlot`, `smClearSlotSave` | `pr15PresReset()` |
| `sandboxStart`, `sandboxRestart` | `pr15PresSandboxContextStart()` |
| `sandboxEndToSetup`, `sandboxExit`, `sandboxCloseSetup` | `pr15PresSandboxTearDown()` |
| `DEV.pr15Presence*` | helpers de playtest |

Em `startRun` o `pr15PresReset()` roda **antes** do corpo original, para que nenhuma presença
atravesse a fronteira entre runs (`B3-66`).

---

## S. Quantização de posição no save (decisão registrada)

`x`/`y` são gravados com **0,1 px** de precisão (`Math.round(v*10)/10`) e `age` com 0,01 s.
Isso é intencional: mantém o checkpoint compacto e estável.

Consequência conhecida: após o Continue, a posição pode diferir em até 0,1 px da original.
Os testes comparam `x`/`y` com tolerância `0.1001`, igual à própria quantização.

Um efeito colateral apareceu durante a auditoria: o clamp de `minHoldDist` reagia à
coordenada já arredondada e a empurrava mais ~0,1 px por frame de restauração. A correção foi
`holdEps = 0.25` — o clamp só age quando a distância fura o limite **com folga**. Tentativa
descartada: gravar com 2 casas decimais **piorou** o resultado (dupla quantização entre pack
e snapshot).

---

## T. Observabilidade

`pr15PresSnapshot()` devolve um objeto plano e seguro para DEV/telemetria:

```js
{ active, encounterId, memoryId, source, resonance, seed, intentSeed, wave,
  phase, age, ttl, x, y, alpha, fallback, dev, why,
  memory:{ op, theme, sigW }, vis:{…}, done:[…] }
```

`intentSeed` é exposto **cru**, sem tradução — é justamente o gancho do B4.

---

## U. Contrato para o B4

O B4 pode contar com, sem alterar nada do B3:

1. **`pr15Presence`** — a entidade viva ou `null`, no máximo uma;
2. **`pr15Presence.intentSeed`** — inteiro estável, determinístico, sobrevive ao Continue;
3. **`encounterId` / `memoryId`** — ligação exata com o descriptor B2 e a memória B1;
4. **`phase`** — `spawning` → `active` → `leaving`, com durações centralizadas;
5. **`pr15PresLeave(motivo)`** — saída antecipada limpa (o B4 vai querer isso ao resolver o encontro);
6. **`pr15PresVisualState(res, src)`** — camada de apresentação isolada, extensível;
7. **`pr15PresSnapshot()`** — leitura estável para lógica e telemetria;
8. **`cp.pr15presence`** — o B4 deve **acrescentar** campos ao `act`, nunca reinterpretar os existentes.

O que o B4 **não** deve fazer: recalcular `source`/`resonance`/`seed`, escrever em `echoQueue`,
mudar `st` de descriptor, ou pendurar combate no `pr15PresUpdate` (crie um módulo próprio e
patcheie aditivamente, como o B3 fez).

---

## V. Testes

`tests/pr15-b3.test.js` — **80 checks, 0 falhas**, descoberta automática pelo runner.

- `B3-01` … `B3-75` — mapa **1:1** com as 75 áreas do brief §30, na ordem literal;
- `SIM-A` … `SIM-E` — as 5 simulações do §31.

Muitos checks fazem **auditoria estrutural por regex** no código-fonte do bloco (extraído de
`SRC` e com comentários removidos): ausência de `Math.random`, `makeEcho`, `echoes.push`,
`enemies.push`, `damageEnemy`, `setTimeout`, `pr15MemRun =`, `.trail`, termos de raridade e
termos de intenção. Isso trava o escopo contra regressão futura, não só o comportamento atual.

### Resultados das simulações

| Sim | Escopo | Resultado |
|---|---|---|
| **A** | ciclo de vida, 1.500 entidades, `dt` variável | duração média **26,217 s** (alvo 26,2) · 0 NaN · 0 órfã · 3 fases sempre percorridas |
| **B** | posicionamento, 4.000 amostras | 100 % determinístico · 100 % dentro da arena · 100 % ≥ 280 px · fallback 1,2 % |
| **C** | Continue, 600 estados nas 3 fases | 600/600 campos idênticos · TTL nunca reinicia · 0 duplicações |
| **D** | stress, 300 aparições completas | afterimages 4/4 · partículas 7/10 · done 8/8 · 0 vazamentos |
| **E** | regressão dos Echos aliados | 524 ticks com presença ativa · 2 Echos sem nenhuma mudança de atributo |

`audit_pr15/temporal_presence_b3_audit.js` roda as mesmas 5 simulações com amostras maiores
(3.000 entidades, 4.800 posições, 900 ciclos de Continue, 400 aparições) fora do `npm test`.

### Suíte completa

```
SUÍTES: 44 · COM FALHA: 0 · CHECKS ✔: 2352 · FALHAS ✘: 0 · 75.2s
```

Baseline pré-B3: 43 suítes / 2272 checks. Delta: +1 suíte, +80 checks, **zero regressão**.

---

## W. Save / migração

- `SM_VERSION` **não** mudou: `cp.pr15presence` é um campo **aditivo e opcional**.
- Save sem o campo → carrega normal, nenhuma presença.
- Save com o campo parcial/corrompido → sanitizado, nunca quebra.
- Downgrade (save novo em build antigo) → o campo é ignorado.
- Run antiga com encounter `consumed` mas sem estado B3 → **nada materializa retroativamente**.

---

## X. Fora de escopo (confirmado por teste)

Nenhuma linha do bloco toca: intenção ALIADA/RIVAL/AMBÍGUA, moralidade (`applyMoral`),
facções (`factionAffinity`, `factionPact`, `spawnBeacon`), escolhas de evento, recompensas,
diálogo (`echoSpeak`, `ECHO_LINES`), IA adaptativa, boss adaptation, progressão/meta
(`saveMeta`, `addResidues`, `grantWeapon`), Codex, HUD final. Testado em `B3-72` … `B3-74`.

---

## Y. Observabilidade DEV (uso em playtest)

```js
DEV.pr15PresenceState()                              // snapshot completo
DEV.pr15PresenceSpawn({source:'n2', resonance:'unstable'})   // força — TAINTA a run
DEV.pr15PresenceEnd(true)                            // encerra imediatamente
DEV.pr15PresenceVisual('high','n1')                  // inspeciona a camada visual
```

Todos inertes com `DEV_MODE=false`.

---

## Z. Recomendação para o PR15·B4

1. Crie um bloco `PR15·b4` separado, com `pr15IntentKitBoot()` chamado **depois** de
   `pr15PresenceKitBoot()`. Não edite o bloco B3.
2. Derive a intenção **exclusivamente** de `pr15Presence.intentSeed` (determinístico,
   já persistido). Não invente seed nova.
3. Persista a intenção resolvida como campo **novo** dentro de `cp.pr15presence.act` — o
   `Sanitize` do B3 ignora chaves desconhecidas, então adicione a validação no seu módulo.
4. Se a intenção precisar encerrar a aparição antes do tempo, use `pr15PresLeave(motivo)`;
   nunca zere `pr15Presence` diretamente.
5. Variações visuais de intenção devem estender `pr15PresVisualState`, mantendo a paleta
   ciano/magenta e o teto de 4 afterimages / 10 partículas.
6. Ao introduzir combate, **não** o pendure em `pr15PresUpdate`: a garantia "zero combate"
   do B3 está travada por teste e deve continuar valendo para o corpo base.

---

## INVARIANTES DA PRESENÇA TEMPORAL

1. **No máximo uma** presença física ativa por vez.
2. A presença **nunca** entra em `echoes[]` nem em `enemies[]`, e nunca é criada por `makeEcho`.
3. A presença **nunca** é permanente: o ciclo dura exatamente `PR15_PRES_TOTAL` e sempre termina.
4. Todas as durações vêm de `PR15_PRES_CFG` — **zero** número mágico espalhado.
5. `source`, `resonance`, `seed` e `intentSeed` vêm do descriptor B2 e **nunca** são recalculados.
6. A posição deriva de `descriptor.seed` via `fractureRng` — **`Math.random` nunca é chamado**.
7. A posição está sempre dentro da arena e a ≥ `minPlayerDist` do operador, com fallback determinístico.
8. `memoryId` que não resolve ⇒ **falha segura**: nenhuma entidade, run intacta.
9. O histórico (`echoQueue`) **nunca** é lido para replay, copiado, mutado ou reordenado.
10. O estado do Director (`pr15MemRun`) **nunca** é escrito pelo B3.
11. Zero combate: sem dano, sem projétil, sem alvo, sem colisão bloqueadora, sem hostilidade.
12. Nenhum sistema de Echo aliado (relationship, Dissonância, equipment, escudo, trail) é aplicado.
13. Renderer e update são **dedicados**; `drawEchoEntity`/`updateEcho`/`updateEnemy` seguem intocados.
14. `resonance` e `source` afetam **apenas** apresentação — e `high` é coerência, **não** raridade.
15. Afterimages ≤ 4 e partículas ≤ 10 por aparição, sempre.
16. O Continue **nunca** duplica a presença nem reinicia o TTL.
17. Save antigo sem `cp.pr15presence` carrega normal e **não** materializa retroativamente.
18. Qualquer carga corrompida é sanitizada: **nunca** `NaN`, `Infinity` ou fase inválida.
19. Sandbox e slots são isolados nos dois sentidos; presença DEV nunca é persistida.
20. `intentSeed` é **transportado, jamais interpretado** — a semântica pertence ao B4.

---

## Dívidas / observações para o B4

1. **Quantização de 0,1 px** no save: aceitável, documentada em §S; se o B4 precisar de
   posição exata, mude o pack e revalide o `holdEps`.
2. **`activeTime = 24 s`** foi escolhido no meio da faixa 20–30 s sem playtest humano; é o
   primeiro número a ajustar depois do teste em jogo.
3. **`minPlayerDist = 280` + `maxPlayerDist = 560`** ainda não foram validados em resoluções
   pequenas — a presença pode nascer fora do enquadramento confortável em telas estreitas.
4. **Sem áudio.** A materialização não tem cue sonoro; provavelmente necessário para a
   aparição ser percebida quando o jogador está sob pressão.
5. **Sem indicação off-screen.** Se a presença nascer fora do campo de visão imediato, o
   jogador pode nunca notá-la. Uma seta/pulso de borda é candidata natural ao B4.
6. **`why`** é preenchido mas não exibido em lugar nenhum — gancho pronto para telemetria.
7. **`done[]` truncado em 8** é generoso para o `maxEncounters = 3` do B2; se o B2 subir esse
   teto, reavaliar.
8. A auditoria pesada vive em `audit_pr15/temporal_presence_b3_audit.js`, fora do `npm test`,
   para não inflar o tempo da suíte. Rode-a manualmente ao mexer em posicionamento ou save.

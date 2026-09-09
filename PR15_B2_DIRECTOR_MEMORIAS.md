# PR15 · B2 — DIRECTOR DE MEMÓRIAS TEMPORAIS

> **Versão do jogo:** 0.9.0-alpha · **SM_VERSION:** 3 · **FRACTURE_STATE_VERSION:** 1
> **Bloco:** `index.html` linhas **32252–32859** (`PR15·b2` … `PR15·fim b2`), boot em **32869**
> **Suíte:** `tests/pr15-b2.test.js` — 65 checks (60 áreas do brief + 5 simulações)
> **Depende de:** PR15·B1 (memória temporal e assinatura de run)
> **Não implementa:** entidade física, IA, combate, renderer, narrativa, UI — tudo isso é B3+

---

## A. Objetivo

O PR15·B1 criou a **fundação de dados**: memórias históricas N-1/N-2 no `echoQueue`, com
identidade estável (`id`) e assinatura temporal v3 (`op/theme/seed/arch/sigW/sigItems`).

O B2 responde a uma pergunta que o B1 deliberately não respondia:

> **"O que esta run vai FAZER com essas memórias?"**

Concretamente, o Director decide de forma **determinística e persistente**:

1. **SE** alguma memória vai interferir na run atual;
2. **QUAL** memória (N-1 ou N-2);
3. **EM QUAL onda** ela fica agendada;
4. **sem conflitar** com eventos importantes já existentes;
5. **sem duplicar** por Continue/save-load;
6. **registrando** que a aparição foi agendada/consumida;
7. produzindo um **descriptor estável** que o PR15·B3 transformará em presença física.

O B2 é **decisão + agendamento + persistência + contrato**. Nada mais.

---

## B. Arquitetura

```
        MEMÓRIA N-1 / N-2   (echoQueue — fonte única, do B1)
                 │
                 ▼
        pr15MemCandidates()        ← elegibilidade (leitura pura)
                 │
                 ▼
        pr15MemBuildPlan()         ← decisão determinística, UMA vez por run
                 │
                 ▼
        descriptor agendado        ← compacto, referencia memoryId
                 │
                 ▼
        pr15MemOnWave(n)           ← resolução na fronteira de onda + conflitos
                 │
                 ▼
        cp.pr15mem (checkpoint)    ← sobrevive a save / fechar / Continue
                 │
                 ▼
        ╔═══════════════════════╗
        ║   [PR15·B3 — FUTURO]  ║  → presença temporal física
        ╚═══════════════════════╝
```

O bloco segue **exatamente o padrão dos kits PR12/13/14/B1**: integração por
*monkey-patch explícito* dentro de `pr15MemoryKitBoot()`. Nada do Director é costurado
dentro das funções de run/onda/save do jogo.

| Gancho | Função original | O que o B2 faz |
|---|---|---|
| 1 | `smBuildCheckpoint` | anexa `cp.pr15mem = pr15MemPack()` |
| 2 | `activateSlot`, `smClearSlotSave` | `pr15MemForgetRun()` — nada vaza entre slots |
| 3 | `startRun` | `pr15MemBeginRun(echoQueue)` — plano ANTES do 1º checkpoint |
| 4 | `resumeRun` | `pr15MemUnpack(activeRun)` — **restaura**, nunca recalcula |
| 5 | `onPlayerDeath`, `onVictory`, `showVictory`, `abortRun` | `pr15MemEndRun()` |
| 6 | `spawnWave` | `pr15MemOnWave(n)` **depois** do corpo (mesma janela do scheduler de Presença de Facção) |
| 7 | `sandboxStart/Restart/EndToSetup/Exit/CloseSetup` | contexto isolado |
| 8 | `DEV.*` | 4 helpers de leitura/força, guardados por `!DEV_MODE` |

Ordem de boot: `fracKitBoot → fractureKitBoot → factionPresenceKitBoot →
factionPresencePhysicalKitBoot → pr15TemporalKitBoot → pr15MemoryKitBoot`.

---

## C. Limites B2 vs B3

| | B2 (este PR) | B3 (próximo) |
|---|---|---|
| Decide se/quem/quando | ✅ | — |
| Persiste a decisão | ✅ (`cp.pr15mem`) | — |
| Spawna entidade | ❌ **proibido** | ✅ |
| Sprite / renderer | ❌ | ✅ |
| Colisão / dano | ❌ | ✅ |
| Recompensa / combate | ❌ | ✅ |
| Diálogo físico | ❌ | ✅ |
| IA da memória | ❌ | ✅ |
| ALIADA / RIVAL / AMBÍGUA | ❌ (só `intentSeed`) | ✅ |
| UI / HUD | ❌ | ✅ |
| Comportamento por Build Profile / moral / personalidade | ❌ (só leitura) | ✅ / B4 / PR16 |

O teste **B2-60** faz a auditoria estrutural disso: o bloco B2 não pode conter
`spawnEnemy`, `makeEcho`, `projectiles.push`, `ctx.`, `damagePlayer`, `addCoins`,
`spawnParticles`, `speech`, `innerHTML`, `Math.random`, entre outros — e,
comportamentalmente, rodar uma run inteira não cria inimigo, Eco, projétil nem beacon.

---

## D. Fonte N-1 / N-2

**`echoQueue` é a fonte única.** Não existe `slot.mems`, segunda fila nem cópia.

| Posição | Papel | Prioridade |
|---|---|---|
| `echoQueue[0]` | **N-1** — última run válida morta | principal |
| `echoQueue[1]` | **N-2** — penúltima | secundária |

O Director **só lê**. Não existe `echoQueue.splice/shift/pop`, `echoQueue=[]` nem
`saveEchoes()` no bloco B2 (verificado por auditoria textual em B2-25). A fila só muda
pelas regras de validade do B1 (`pr15RunIsValid` / `pr15QueuePush`).

O momento do planejamento é o `startRun`: nessa hora a fila ainda contém as memórias das
runs **anteriores** — a morte da run atual só entra na fila no fim, pelo B1.

---

## E. Elegibilidade v3

`pr15MemIsEligible(rec)` exige **todas** as condições:

```js
rec é objeto (não array, não null)
!rec.dev                                    // run DEV nunca vira memória
typeof rec.id === 'string' && rec.id && rec.id.length <= 32   // identidade v3
Array.isArray(rec.trail) && rec.trail.length > 0              // mínimo p/ replay
Number.isFinite(trail[0][1]) && Number.isFinite(trail[0][2])  // posição inicial válida
```

A condição de trail é **a mesma** que o B1 usa em `pr15SanitizeRecord` — o Director não
inventa um critério próprio.

## F. Comportamento v2 (Echo legado)

| Registro | Elegível p/ o B2? | Continua funcionando como Eco? |
|---|---|---|
| v3 com `id` estável | ✅ sim | ✅ |
| v2 legado **sem `id`** | ❌ **não** | ✅ **sim, integralmente** |
| v3 com `id` inválido (tipo errado, vazio, >32 chars) | ❌ não | ✅ (o B1 remove o campo) |
| corrompido / trail ausente / NaN / Infinity | ❌ não | ✅ (o B1 repara ou descarta só em memória) |
| marcado `dev` | ❌ não | n/a |

**Decisão de design:** um v2 sem identidade **não é forçado** para dentro do Director. Sem
`id` não há como produzir um `memoryId` estável no descriptor, e um descriptor sem
referência estável quebraria a idempotência do Continue. O Eco legado segue com trail,
`makeEcho`, personalidade, confiança, relação/Dissonância e equipamento exatamente como
antes (testes B2-06, B2-50 a B2-54).

**Nenhum registro histórico é destruído por ser inelegível.** Aqui só há leitura.

---

## G. Determinismo

**Regra absoluta: o Director nunca toca `Math.random` nem o RNG global de combate.**

Verificado de duas formas:

- **estrutural** (B2-11): o bloco B2 sem comentários não contém `Math.random`, `rand(`,
  `randInt(`, `pickWeighted(`, `pickWeightedMoral(`;
- **comportamental** (B2-11): 5.000 chamadas a `Math.random()` entre o planejamento e a
  resolução **não alteram** nenhum campo do plano.

A decisão também **não muda** porque o jogador:

- abriu/fechou menu — nenhum estado do Director depende de UI;
- salvou / carregou / usou Continue — o plano é restaurado, não recalculado (§S, §T);
- mudou de FPS — não há `dt`, timer ou acumulador no Director;
- ficou parado — idem;
- outra função chamou `Math.random` — verificado acima.

## H. Seed / hash

Reutiliza os primitivos determinísticos que **já existem** no projeto
(`fractureHash32` + `fractureRng`, os mesmos usados pelo Diretor de Fratura e pela
Presença de Facção), com uma derivação de chave própria:

```js
function pr15MemSeedFor(purpose, runSeed, wave, memId){
  let h = 0x811C9DC5;                                  // FNV-1a offset basis
  const s = purpose + '|' + (runSeed>>>0) + '|' + (wave|0) + '|' + (memId||'');
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i)&0xFF; h = Math.imul(h,0x01000193)>>>0; }
  return fractureHash32(h>>>0);
}
function pr15MemRng(purpose, runSeed, wave, memId){
  return fractureRng(pr15MemSeedFor(purpose, runSeed, wave, memId));
}
```

`purpose` separa os fluxos para que uma decisão não contamine a outra:

| `purpose` | Decide |
|---|---|
| `gate` | se a vaga 2/3 do plano é usada |
| `pick` | N-1 vs N-2 |
| `res`  | `normal` vs `unstable` quando o Tema difere |
| `enc`  | `seed` do descriptor |
| `intent` | `intentSeed` (hook neutro p/ B3) |

## I. Identidade da run

**Não usa timestamp como identidade lógica.** Usa o que o jogo já tem e já persiste:

```js
runKey = 's' + slot + ':' + fractureGetSeed()      // ex.: "s1:424242"
```

- `slot` — `curSlot` (1..3), com fallback em `smRoot.lastSlot`;
- `seed` — `fractureGetSeed()`, criada **uma única vez** por `fractureMakeSeed()` no início
  da run e depois apenas **lida** do checkpoint (`cp.fracture`);
- fallback estável `PR15_MEM_CFG.fallbackSeed = 0x51EED1` quando não há Diretor de Fratura
  (documentado, determinístico, sem relógio).

**Nenhum sistema de save novo foi criado.** O `runKey` é derivado, não armazenado como
fonte de verdade — ele é gravado em `cp.pr15mem.key` apenas para inspeção/DEV.

---

## J. Cadência

Toda a cadência vive num único objeto — **não há magic number espalhado**:

```js
const PR15_MEM_CFG={
  version:1,
  firstWave:4,          // K
  cooldownWaves:3,      // L
  maxEncounters:3,      // M
  conflictShiftMax:2,   // U
  n1Chance:0.75,        // N
  extraChance:0.50,     // J
  unstableN1:0.30,      // O
  unstableN2:0.55,      // O
  fallbackSeed:0x51EED1 // I
};
```

**Vagas de onda:** `firstWave + k·cooldownWaves` para `k = 0..maxEncounters-1` ⇒ **4, 7, 10**.

- a **1ª vaga sempre ocorre** se houver memória elegível (garante ≥1);
- as vagas 2 e 3 passam por um **portão determinístico** de `extraChance = 0.50`.

Distribuição resultante (SIM-A, 10.000 runs):

| oportunidades/run | frequência |
|---|---|
| 0 | **0,0%** (nunca, havendo memória elegível) |
| 1 | 25,3% |
| 2 | 50,3% |
| 3 | 24,4% |
| **média** | **2,006** |

## K. firstWave

`firstWave = 4`. Nenhuma oportunidade é planejada ou consumida antes da onda 4
(B2-14: 800 seeds no plano + 120 seeds resolvendo onda a onda).

## L. cooldown

`cooldownWaves = 3`, aplicado **sobre a onda resolvida** (`pr15MemCooldownBusy`), não só
sobre a planejada. Assim um *shift* por conflito não consegue violar o intervalo:

```js
last = max(at de todos os encounters 'consumed')
busy = last > 0 && (n - last) < cooldownWaves
```

B2-15 exercita isso em 900 seeds e exige `at[i] - at[i-1] >= 3` em todos os pares.

## M. Limite de encontros

`maxEncounters = 3`. É o tamanho máximo do plano (o laço para em `k < maxEncounters` e
também quando `baseWave > MAX_WAVE`) e o teto de `count`. B2-16 verifica em 900 seeds.

## N. Seleção N-1 / N-2

```js
if (n1 && n2)  return rng('pick', seed, wave)() < n1Chance ? n1 : n2;   // 75 / 25
return n1 || n2 || null;                                               // só uma elegível
// nenhuma elegível ⇒ plano vazio (nenhuma memória falsa é criada)
```

**Peso final: N-1 = 75%, N-2 = 25%** (dentro da faixa 70–80 / 20–30 pedida).

Medido em 10.000 runs (SIM-A): **N-1 = 75,16% · N-2 = 25,14%**.

## O. Resonance

Influência, **nunca trava**. Memória com Tema diferente continua podendo aparecer.

| Condição | Resonance |
|---|---|
| `memory.theme === fractureGetThemeId()` | `high` |
| Tema diferente, sorteio ≥ `unstableN1` (0,30) / `unstableN2` (0,55) | `normal` |
| Tema diferente, sorteio < limiar | `unstable` |
| memória sem `theme` **ou** run sem Tema | `normal` (neutro, sem informação) |

N-2 é tratada como memória **mais distante/instável**: limiar 0,55 contra 0,30 de N-1
(B2-24 mede `unstable` mais frequente em N-2).

O B2 **apenas registra** a classificação no descriptor. Nenhum efeito de gameplay deriva
dela aqui — isso pertence a B3/B4.

---

## P. Descriptor do encontro temporal

Contrato compacto, **todos os campos escalares**, serializável e sanitizável.

| Campo | Tipo | Significado |
|---|---|---|
| `v` | int | versão do descriptor (1) |
| `id` | string ≤32 | identificador estável — `p<slot>-<seed36>-w<baseWave>` |
| `mem` | string ≤32 | **memoryId** (ex. `e1-12`) — *referência*, nunca cópia |
| `src` | `n1`\|`n2` | origem da memória |
| `wave` | int 0..20 | onda em que está agendada (pode ser adiada por conflito) |
| `base` | int 0..20 | onda originalmente planejada (âncora do budget de shift) |
| `shift` | int 0..2 | adiamentos já aplicados |
| `res` | `high`\|`normal`\|`unstable` | ressonância com o Tema |
| `seed` | uint32 | seed própria e determinística (variação p/ B3) |
| `st` | `scheduled`\|`consumed`\|`skipped` | estado |
| `at` | int 0..20 | onda em que resolveu (0 = ainda não) |
| `why` | string ≤48 | motivo do adiamento/skip (`''` quando não se aplica) |
| `intent` | int 0..99999 | **intentSeed neutro** — hook p/ B3/B4 |

**Exemplo real:**

```json
{"v":1,"id":"p1-93ci-w4","mem":"e1-2","src":"n1","wave":4,"base":4,"shift":0,
 "res":"high","seed":3705021661,"st":"consumed","at":4,"why":"","intent":28357}
```

**O descriptor NÃO copia** (B2-18, B2-58, B2-59): trail, player, `hp/maxHp/shield/coins/xp`,
inimigos, projéteis, `itemState`, `items/upg/owned`, entidades, frame state, `fracRun`,
relação, Dissonância, `arch`, `moral`, `ps`, `sigItems`, `sigW`.

Tamanho medido: **< 2 kB** para o plano inteiro; **< 4 kB** para todo o estado persistido.

### `intentSeed` — por que existe e por que é neutro

O B2 **não** decide ALIADA / RIVAL-DESAFIO / AMBÍGUA-MEMÓRIA. Decidir agora fecharia
prematuramente regras de gameplay que pertencem a B3/B4. O que o B2 fornece é um número
determinístico e estável que o B3 pode consumir como quiser (inclusive ignorar). Nenhuma
semântica é atribuída a ele neste bloco.

---

## Q. Estado run-scoped

```js
pr15MemRun = {
  v:1,
  key:'s1:424242',     // identidade derivada (inspeção/DEV)
  slot:1,
  seed:424242,
  enc:[ ...descriptors... ],
  used:[ 'e1-2' ],     // memoryIds consumidos NESTA run (únicos)
  waveDone:7,          // última onda processada — a chave da idempotência
  lastWave:7,
  count:1              // oportunidades consumidas
}
```

Formato escolhido a partir do save/checkpoint **real**: escalares + duas arrays planas,
espelhando o estilo compacto de `cp.fracture` (`fractureRunPack`) e `cp.presence`
(`factionPresencePack`).

É **run-scoped**: morre em `onPlayerDeath`, `onVictory`, `showVictory` e `abortRun`
(`pr15MemEndRun`), e em `activateSlot` / `smClearSlotSave` (`pr15MemForgetRun`).

## R. Checkpoint

Persistido como **`cp.pr15mem`** via wrapper de `smBuildCheckpoint` — o mesmo mecanismo de
`cp.fracture` (PR13) e `cp.presence` (PR14). Nenhum caminho de save novo.

O jogo já chama `captureCheckpoint('onda', n)` no início de cada onda dentro de `spawnWave`,
então o estado do Director é fotografado a cada fronteira de onda sem custo adicional.

## S. Continue

`resumeRun` → `pr15MemUnpack(activeRun)`:

- se `cp.pr15mem` existe → **restaura** o estado (sanitizado);
- se não existe → `pr15MemRun = null` (inicialização segura, nada é inventado);
- **nunca recalcula o plano.** Essa é a garantia central: o plano é uma decisão tomada uma
  única vez no `startRun`.

Cenário do brief, verificado em B2-28:

```
Director agenda e1-2 na wave 7
jogador salva na wave 6  →  cp.pr15mem guarda o plano
fecha o jogo
Continue                 →  continua existindo UMA oportunidade e1-2 na wave 7
```

Não é criada outra, não rerrola para a wave 8, não troca N-1 por N-2, não altera
`resonance`, não gera outro `seed`, não incrementa `count`.

## T. Idempotência

Dois mecanismos combinados:

1. **plano restaurado, nunca recalculado** (§S) — `memoryId`, `wave`, `seed`, `res`,
   `intent` e `id` são imutáveis após o `startRun`;
2. **`waveDone`** — `pr15MemOnWave(n)` retorna imediatamente se `n <= waveDone`. Isso torna
   seguro reprocessar uma onda quando o checkpoint foi gravado **antes** do processamento
   daquela onda (o checkpoint de onda é capturado dentro de `spawnWave`, antes do gancho do
   B2). A reentrada produz exatamente o mesmo resultado e não duplica nada.

Consequência verificada (B2-33): **uma oportunidade consumida nunca ressuscita**, mesmo
com múltiplos ciclos de Continue.

### "consumed" não consome a memória histórica

`consumed` significa *"esta oportunidade temporal foi usada nesta RUN"*. **Não** significa
apagar N-1/N-2. O histórico permanece intacto — não existe `echoQueue.splice()` nem
equivalente no bloco (B2-25). A fila só muda quando uma nova morte válida entra, pelas
regras do B1.

---

## U. Conflitos

`pr15MemWaveBusy(n)` devolve a lista de motivos pelos quais a onda `n` está ocupada, lendo
**apenas estado real já existente**:

| Sinal | Fonte | Motivo |
|---|---|---|
| `evMem.dw === n` | PR 10.5 — decisão já aberta nesta onda | `decision` |
| `beacon != null` | beacon de evento fisicamente vivo | `beacon` |
| `factionPresenceRun.scheduled.wave === n` | PR14 — presença agendada | `presence` |
| `factionPresenceRun.active` | PR14 — presença ativa | `presence_active` |
| `fractureRun.b3.mini[n]` | PR13 — miniboss escolhido para a onda | `miniboss` |
| `fractureRun.b4.sig[n]` | PR13 — assinatura do Diretor para a onda | `signature` |

Mais o cooldown próprio (§L).

**Semântica escolhida (e testada):**

```
onda ocupada?
├─ não  → st = 'consumed', at = n
└─ sim  → shift < conflictShiftMax (2) e n+1 <= MAX_WAVE ?
          ├─ sim → wave = n+1, shift++, continua 'scheduled'
          └─ não → st = 'skipped', why = motivo, at = n
```

`conflictShiftMax = 2` ⇒ a onda agendada nunca sai de `[base, base+2]`. **Não há loop**: o
laço percorre a lista de descriptors uma única vez por onda.

**Nenhum scheduler externo foi modificado.** O B2 só lê — auditoria textual em SIM-D
confirma que o bloco não chama `factionPresenceSchedule` / `scheduleBeacon` /
`fractureEmit` e não escreve em `evMem`, `beacon`, `fractureRun` nem `factionPresenceRun`.

## V. Decision events

Detectados por `evMem.dw` (a onda em que a última decisão abriu a régua global) e pela
presença física de `beacon`. Ambos são persistidos (`cp.ev` via `evMemPack()`), então a
detecção é fiel após Continue.

## W. Faction presence

Detectada por `factionPresenceRun.scheduled.wave` e `factionPresenceRun.active`, ambos
persistidos em `cp.presence`. O gancho do B2 em `spawnWave` roda **depois** do corpo — a
mesma janela que o scheduler de presença usa — justamente para enxergar a presença
agendada para a onda corrente.

---

## X. Sandbox

O Sandbox **não** cria agendamento histórico, não consome memória real, não altera estado
persistente, não polui o Continue e não modifica N-1/N-2.

Mecanismo (espelhando `factionPresenceSandboxContextStart/TearDown`):

```js
sandboxStart / sandboxRestart  →  pr15MemSandboxContextStart()   // guarda o estado real, zera
sandboxEndToSetup / Exit / CloseSetup  →  pr15MemSandboxTearDown()  // devolve o estado real
```

Além disso, tanto `pr15MemBeginRun` quanto `pr15MemOnWave` têm guarda explícita
`if (sandboxRun) return null`, e `pr15MemPack()` devolve `null` quando não há estado —
nada do Sandbox chega ao checkpoint. Teste B2-43 verifica byte a byte que o estado real e a
fila voltam intactos.

## Y. DEV

| Helper | Tipo | Efeito |
|---|---|---|
| `DEV.pr15MemoryState()` | leitura | `{active, runKey, slot, seed, eligible, scheduled, consumed, skipped, lastWave, count, waveDone, used}` |
| `DEV.pr15MemoryCandidates()` | leitura | candidatas N-1/N-2 com `theme/seed/op/cause/arch/moral/dom/sigW/sigItems` |
| `DEV.pr15MemorySchedule()` | leitura | `{runKey, cfg, plan, busy, cooldown}` |
| `DEV.pr15MemoryForce({source, wave})` | **força** | substitui o estado por uma decisão diagnóstica |

Todos começam com `if(!DEV_MODE)return null;` — **inertes em release** (B2-44 verifica a
guarda por auditoria de fonte e por comportamento).

`pr15MemoryForce` chama `devTaint()`, marcando a run como `devTainted`. Como `pr15RunIsValid`
rejeita `dev===true`, o B1 **nunca** transforma uma run forçada em memória legítima. Sem
memória elegível, a força falha explicitamente (`{ok:false}`) e **não inventa** memória
(B2-45). O `wave` forçado é clampeado a `[firstWave, MAX_WAVE]`.

Os helpers de leitura **não mutam** estado (verificado em B2-44).

---

## Save / migração

`pr15MemUnpack` + `pr15MemSanitize` + `pr15MemSanEnc` são conservadores por construção:
**nunca lançam, nunca apagam slot, nunca quebram o Continue, nunca invalidam Echo legado,
nunca tocam `echoQueue`.**

| Entrada | Resultado |
|---|---|
| save antigo sem `pr15mem` | `pr15MemRun = null` — inicialização segura |
| save PR15·B1 / com v2 / com v3 | idem (a chave simplesmente não existe) |
| `pr15mem` null / `0` / string / array / `true` / `NaN` | idem |
| `pr15mem: {}` ou `{v:1}` | estado vazio seguro (sem descriptors) |
| `enc` não-array | `enc = []` |
| descriptor sem `id` **ou** sem `mem` | descartado individualmente; o resto sobrevive |
| `wave` negativa / enorme / NaN / Infinity / string | clampeado a `[0, MAX_WAVE]` |
| `seed`/`shift`/`at`/`intent`/`base` NaN ou Infinity | default finito seguro |
| `st`/`src`/`res` inválidos | caem em `scheduled` / `n1` / `normal` |
| `slot`/`seed`/`waveDone`/`lastWave`/`count` inválidos | defaults finitos, `count` limitado a `enc.length` |

Testado por B2-55, B2-56 e **SIM-E** (2.000 estados hostis: 0 exceções, 0 `NaN` no `pack`,
`echoQueue` e slot intactos).

### Slot isolation

`pr15MemSlot()` deriva o slot de `curSlot` (fallback `smRoot.lastSlot`). O `id` do
descriptor carrega o slot (`p<slot>-…`) e o `memoryId` vem sempre da fila do slot ativo.
`activateSlot` e `smClearSlotSave` descartam o estado. Testes B2-40/41/42 verificam os três
slots e que nenhum descriptor referencia memória de outro slot.

### Morte da run atual

`onPlayerDeath` → `pr15MemEndRun()` descarta o estado run-scoped. Em seguida o B1 decide,
pelas regras dele, se a morte é válida e entra na fila. Na próxima run um **novo** estado é
criado a partir do histórico atualizado — nenhum descriptor da run morta vaza (B2-48).

### Vitória / abort

`onVictory`, `showVictory` e `abortRun` chamam `pr15MemEndRun()`. Descriptors pendentes
**não** viram memória. O PR15·B1 segue integralmente preservado: ABORT não cria memória nem
desloca a fila; VICTORY não entra em N-1/N-2 (B2-46, B2-47).

---

## Observabilidade

Sem entidade física, a verificação é por DEV + testes. `pr15MemSnapshot()` é leitura pura e
devolve exatamente o formato pedido:

```js
{ active, runKey, slot, seed,
  eligible:[{source,id}...],
  scheduled:[...], consumed:[...], skipped:[...],
  lastWave, count, waveDone, used:[...] }
```

Não aparece no HUD normal.

---

## Testes

`tests/pr15-b2.test.js` — **65 checks**, mapeados 1:1 às 60 áreas do brief (B2-01…B2-60)
mais as 5 simulações. Descoberto automaticamente pelo runner.

| Simulação | Escala | Resultado |
|---|---|---|
| **A — distribuição** | 10.000 runs | N-1 **75,16%** · N-2 **24,84%** · média **2,006** · 1→25,3% 2→50,3% 3→24,4% · 0→0% · ondas 4/7/10 · 3 ressonâncias presentes |
| **B — cadência** | 6 durações × 600 seeds | oportunidades/run: `3→0,00 · 5→1,00 · 10→2,02 · 15→2,02 · 20→1,96` · zero violações de firstWave, cooldown e teto |
| **C — Continue** | 800 seeds | **1.621** descriptors comparados campo a campo (`mem/src/wave/seed/res/id/base/intent` + `st`) · **0 divergências** |
| **D — conflitos** | 500 seeds esparsos + 300 densos | nenhum consumo em onda ocupada · decisão reproduzível · **584** skips no caso denso · `shift ≤ 2` sempre · 10.000 iterações sem loop |
| **E — fuzz de save** | 2.000 estados hostis | **0 exceções** · 1.381 estados criados · 0 `NaN` no pack · `echoQueue` e slot intactos |

**Regressão completa:** 43 suítes · **2272 checks** · **0 falhas**.
**Suítes relacionadas** (pr15 / saveslots / devmode / devtools / fracture / pr14 / sandbox /
legacy-restore): 20 suítes · 1374 checks · 0 falhas.

---

## Z. Recomendação para o PR15·B3

### ✅ **GO**

O B2 entrega exatamente o contrato que o B3 precisa, sem nenhuma dependência de entidade
física:

- o descriptor já traz `memoryId`, `src`, `wave`, `res`, `seed`, `st`, `at` e `intentSeed`;
- `pr15MemSnapshot().consumed` dá ao B3 a lista exata do que deve virar presença, na onda
  certa, com a seed certa;
- a persistência (`cp.pr15mem`) já sobrevive a Continue, então o B3 herda a idempotência
  sem reimplementá-la;
- conflitos com decision events e presença de facção já são desviados **antes** de o B3
  existir — o B3 não precisa negociar janela com outros sistemas.

---

## INVARIANTES DO DIRECTOR

Estes invariantes são verificados por teste e **não podem ser quebrados** por nenhum bloco
futuro sem atualizar a suíte correspondente.

1. **Nunca usar `Math.random` global.** Nenhuma decisão do Director passa pelo RNG global
   de combate. Tudo deriva de `(slot, Fracture seed, memoryId, onda)` por FNV-1a +
   `fractureHash32` + `fractureRng`. *(B2-11)*
2. **Nunca apagar memória histórica.** Não existe `echoQueue.splice/shift/pop`,
   `echoQueue=[]` nem `saveEchoes()` no bloco. `consumed` é run-scoped. *(B2-25, B2-26)*
3. **Nunca duplicar após Continue.** O plano é restaurado, nunca recalculado; `waveDone`
   impede reprocessar uma onda; uma oportunidade consumida nunca ressuscita. *(B2-28…B2-33, SIM-C)*
4. **Nunca spawnar entidade no B2.** Nenhuma entidade, sprite, renderer, colisão, dano,
   recompensa, diálogo ou UI. *(B2-60)*
5. **Nunca contaminar slots.** O Director de um slot não lê, consome nem reutiliza memória,
   contador ou descriptor de outro slot. *(B2-40, B2-41, B2-42)*
6. **Nunca usar Sandbox/DEV como histórico real.** Sandbox guarda o estado real de lado e o
   devolve; DEV é leitura inerte em release, e a força manual tainta a run — que o B1
   jamais converte em memória legítima. *(B2-43, B2-44, B2-45)*
7. **Nunca criar memória falsa.** Sem candidata elegível não há plano; `pr15MemForce` sem
   memória elegível falha explicitamente. *(B2-02, B2-45)*
8. **Nunca quebrar o save.** Sanitização tolerante: ausência, tipo errado, `NaN`,
   `Infinity`, descriptor parcial — nada disso lança, apaga slot ou quebra Continue.
   *(B2-55, B2-56, B2-57, SIM-E)*
9. **Nunca modificar scheduler de outro sistema.** O Director apenas **lê** `evMem`,
   `beacon`, `factionPresenceRun` e `fractureRun`. *(SIM-D)*
10. **Nunca exceder a cadência.** `firstWave ≥ 4`, `cooldown ≥ 3`, `máx. 3` oportunidades,
    `shift ≤ 2`. *(B2-14, B2-15, B2-16, B2-38, SIM-B)*

---

## Dívidas / observações para B3

Encontradas no código real ou adiadas deliberadamente:

1. **`intentSeed` ainda é opaco.** O B2 gera um inteiro determinístico 0..99999 e não lhe
   atribui semântica. ALIADA / RIVAL-DESAFIO / AMBÍGUA-MEMÓRIA continuam indefinidos — é
   decisão do B3/B4.
2. **`resonance` não tem efeito.** `high`/`normal`/`unstable` estão registrados e
   determinísticos, mas nada no jogo os consome. O B3/B4 precisa definir o que muda.
3. **`skipped` é terminal na run.** Uma oportunidade sem onda segura dentro de
   `base..base+2` é perdida — não é reagendada para uma janela futura. Se o playtest mostrar
   que isso acontece demais em runs muito ocupadas, o ajuste é em `PR15_MEM_CFG`
   (`conflictShiftMax`) e não na lógica.
4. **Run em andamento quando o B2 foi ativado não recebe oportunidades.** Um checkpoint
   anterior ao B2 não tem `cp.pr15mem`; o `resumeRun` inicializa estado vazio em vez de
   planejar retroativamente (planejar no meio da run quebraria a garantia "plano calculado
   uma única vez"). É comportamento intencional e seguro; vale uma linha na nota de release.
5. **`pr15MemWaveBusy` usa `beacon != null` como sinal conservador.** Isso inclui beacons de
   evento que ainda não foram abertos. É intencional (adiar é mais barato que competir), mas
   se o B3 quiser mais oportunidades, esse é o primeiro sinal a refinar.
6. **A ressonância `high` é muito frequente quando o Tema coincide.** Em SIM-A, `high`
   respondeu por ~75% das oportunidades — esperado, já que N-1 costuma carregar o mesmo
   Tema da run seguinte em slots jogados em sequência. O B3/B4 deve considerar isso ao
   dimensionar o efeito de `high`, para que não vire o caso padrão.
7. **`MAX_WAVE = 20` limita o horizonte.** Com `firstWave 4` e `cooldown 3`, as vagas são
   4/7/10 — todas confortavelmente dentro do limite. Se `MAX_WAVE` mudar, `pr15MemBuildPlan`
   já corta vagas acima dele, mas a cadência deve ser reavaliada.
8. **Sem telemetria agregada de balanceamento.** O B2 não registra métricas de quantas
   oportunidades foram consumidas por run ao longo do tempo (o `fracRun.eco` faz isso para a
   economia). Se o B3/B4 precisar calibrar com dados de playtest, esse é um acréscimo
   pequeno e run-scoped.

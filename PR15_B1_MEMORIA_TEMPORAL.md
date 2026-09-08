# PR15 · B1 — MEMÓRIA TEMPORAL E ASSINATURA DE RUN (FUNDAÇÃO DE DADOS)

> **Natureza:** este bloco constrói **somente a fundação de dados** de
> "Echos entre runs" (PR15) sobre o `echoQueue` existente — **fonte única**
> de memória persistida por slot. Nenhuma presença nova (scheduler,
> entidade, evento, interação, UI, recompensa, penalidade, detecção,
> facção ou balanceamento) é criada aqui; isso é B2+.
>
> **Regra central:** a fila de Ecos passa a guardar **memórias de runs
> VÁLIDAS** — morte real que atinge o piso de significância
> (`kills>=5 && (onda>=3 || dur>=90)`). Tudo o que não for morte real
> (abort, vitória) ou vier de contexto não-canônico (Sandbox/DEV) ou for
> morte fraca **nunca entra na fila, nunca desloca N-1/N-2**.

---

## ÍNDICE A–Z (§36)

| Letra | Seção | Letra | Seção |
|---|---|---|---|
| A | Propósito, natureza e escopo | N | Assinatura temporal — campos e regras |
| B | Baseline (branch/HEAD/versão/testes) | O | ID estável da memória |
| C | Arquitetura escolhida (bloco + monkey-patch) | P | Build Profile (arch) |
| D | Fonte única da verdade — echoQueue v3 aditivo | Q | Arma assinatura (sigW) |
| E | Contrato de dados do registro v3 | R | Módulos assinatura (sigItems) |
| F | Regra de run válida (função pura única) | S | Sanitização tolerante de carga |
| G | Histórico N-1/N-2 · cap 2 | T | Save/load, slim v3 e migração old-save |
| H | Morte real fraca — nunca desloca | U | Continue — fila preservada, causa zerada |
| I | ABORTAR RUN — sem memória/Echo | V | Trail legada preservada |
| J | Vitória — nunca cria memória | W | Echos legados intactos (makeEcho e cia.) |
| K | Sandbox — isolamento total | X | Nenhuma presença PR15 em B1 (exclusões) |
| L | DEV/devTainted — isolamento + DEV.pr15* | Y | Testes e simulações (§33/§34) |
| M | Death cause — enum run-scoped | Z | Dívidas, limites do B1 e plano B2 |

---

## A. PROPÓSITO, NATUREZA E ESCOPO

PR15-B1 entrega a **fundação de dados** da Memória Temporal: um registro
persistente, compacto e determinístico que resume uma run que terminou em
**morte real válida**, para que blocos futuros (B2+) construam em cima
dela (histórico entre runs, presença, interface, recompensas…).

**Decisões fechadas (brief §33–§39 literal):**

1. Fila = `echoQueue`, evoluído de slim v2 → **v3 ADITIVO** (superset dos
   Echos legados). **NUNCA** `slot.mems` nem segunda fila persistente.
2. Histórico: máx. **2 memórias VÁLIDAS** por slot.
3. Regra de validade em **UMA função pura** (`pr15RunIsValid`).
4. ABORTAR RUN ≠ morte real → **não entra na fila**, não desloca, não vira
   Echo, não cria assinatura, não reaproveita causa da morte; limpeza /
   progressão / tela continuam no `onPlayerDeath`/`abortRun` (captura
   separada da limpeza).
5. Vitória → nunca cria memória (legado: `onVictory` não toca a fila).
6. Morte real fraca → não entra na fila, não desloca, sem assinatura;
   progressão e tela de morte seguem como hoje.
7. Causa da morte: enum curto sanitizado, contexto run-scoped, reset entre
   runs, nunca reutilizada em abort, `unknown` quando não há certeza.
8. Registro v3: campos legados INTACTOS + assinatura compacta nova.
9. Sandbox/DEV: totalmente isolados (DEV.pr15* = leitura com guarda).
10. Migração: v2/parcial/corrupto carrega com fallback seguro; nunca
    destrói slot.

---

## B. BASELINE

| Item | Valor |
|---|---|
| Branch | `arena/01a08235-echojogo` |
| HEAD de origem | `30eb267c3c430785f4a0c2cf1b3632501b4ba2b1` (`main`) |
| Versão | `0.8.0-alpha` (runtime `ECHO_VERSION` + `package.json`) |
| SM_VERSION | **3** (inalterado — campos novos são aditivos) |
| `npm test` (antes) | 0 falhas ✅ (40 suítes) |
| `npm test` (depois) | 0 falhas ✅ (41 suítes; PR15·B1 somou `tests/pr15-b1.test.js`) |

---

## C. ARQUITETURA ESCOLHIDA

Bloco autocontido no fim do `<script>` de `index.html`, delimitado por
marcadores auditáveis:

```
/* ==================== PR15·b1 … ==================== */   (cabeçalho em 31733)
… funções puras + contexto + helpers DEV …
/* ==================== PR15·fim b1 ==================== */  (32249)
```

Integração por **monkey-patch no BOOT** (`pr15TemporalKitBoot()`,
chamado logo após `factionPresencePhysicalKitBoot()`), o mesmo padrão dos
kits PR12–PR14. **Nenhuma função de run/onda/save foi reescrita por
dentro**; a costura é feita por wrappers que rodam por último (envolvem a
cadeia fracture/facção). Exceções pontuais e mínimas no código legado:

- `damagePlayer(d,cause)` — ganhou 2º parâmetro **opcional** `cause` e uma
  chamada `pr15NoteDamage(cause)` quando o dano é real (pós-guards).
  Call-sites confiáveis anotados com a causa (ver seção M).
- `saveEchoes()` — o slim passou a incluir os campos novos do v3 quando o
  registro em memória tem `id` (ver seção T).
- HTML: microcopy do botão `#p-abort` (ver seção I).

---

## D. FONTE ÚNICA DA VERDADE — echoQueue v3 ADITIVO

A fila canônica é `echoQueue` (já usada por PR 7.5+ para os Ecos entre
runs). O PR15 **evolui o registro** de slim v2 → v3 aditivo:

- em **memória**: o registro da morte válida é o `runData` legado (com
  `kills`, `mh`, `ps`, `st`…) + campos de assinatura cravados
  (`id/out/cause/op/theme/seed/arch/sigW/sigItems`);
- no **arquivo** (`smRoot.slots[i].echoes`, slim): o objeto escrito
  materializa `v:3` quando o registro tem `id` (senão `v:2`), converte
  `kills→k`, e carrega os campos novos;
- no **reload** (`loadEchoes`/`activateSlot`): sanitização tolerante em
  memória + migração aditiva `k→kills` (para o re-save nunca zerar o
  contador de Echos legados).

Não existe `slot.mems`, nem histórico paralelo, nem segunda fonte
persistente de memória.

---

## E. CONTRATO DE DADOS DO REGISTRO v3

### Campos legados (intactos, v2 → v3)

`dur, dmgMul, frMul, wave, level, trail, crit, critMul, pierce, aoeMul,
rangeMul, meleeRangeMul, rangedRangeMul, projSpdMul, longRangeBonus,
coins, items, upg, owned, moral, dom, k(arquivo)/kills(memória), mh, st,
ps`.

### Campos novos (assinatura temporal v3)

| Campo | Tipo | Papel |
|---|---|---|
| `v` | 3 (arquivo/reload) | versão do registro (aditivo; derivada de `id`) |
| `id` | string `e<slot>-<seq>` | identificador estável da memória |
| `out` | `'death'` | desfecho persistido — só `death` é possível na fila |
| `cause` | enum §M | causa da morte sanitizada |
| `op` | string ≤16 | operador (`player.charId`) |
| `theme` | string ≤24 \| null | Fracture Theme id na morte |
| `seed` | uint32 \| null | Fracture seed (>>>0) |
| `arch` | `{dom,sec,state,domS,secS}` | Build Profile resumido |
| `sigW` | string | arma assinatura |
| `sigItems` | string[] ≤4 | módulos assinatura |

**Fora da assinatura (nunca gravado):** `itemState`, hooks, projéteis,
inimigos, posições, `frame`, `fracRun`, event-memory, relação/Dissonância,
cópia do player.

> **Nota de contrato:** em memória o registro **não** carrega `v`/`k`
> (pertencem ao slim do arquivo); testes e consumidores devem ler versão e
> abates no arquivo ou após `loadEchoes`.

---

## F. REGRA DE RUN VÁLIDA — UMA FUNÇÃO PURA

`pr15RunIsValid(o)` (e `pr15ValidityReason(o)` para diagnóstico):

```
VALID = realDeath && !sandbox && !dev && !abort && !victory
        && kills>=5 && (wave>=3 || dur>=90)
```

- Única função de verdade: o wrapper de morte e a fila pura usam ela.
- Coerção numérica (`+v`) e `Number.isFinite` — strings numéricas entram,
  `NaN`/`undefined` nunca passam.
- `pr15ValidityReason` retorna motivos legíveis (usado nos helpers DEV e
  nas simulações).

---

## G. HISTÓRICO N-1/N-2 · CAP 2

- `pr15QueuePush(queue, verdict, rec)` — **fila pura** que espelha a regra
  real (usada nas simulações): se `pr15RunIsValid(verdict)` → `[rec, ...q]`
  truncado em 2; senão → fila inalterada (`captured:false`).
- A fila real opera pela mesma regra no wrapper de `onPlayerDeath`:
  nova memória → N-1, antiga N-1 → N-2, N-2 → descartada. Fila nunca > 2
  (nem em memória nem no arquivo).
- Morte inválida **nunca desloca** — o wrapper reverte memória E disco ao
  estado anterior (`echoQueue=preQ; saveEchoes()`).

---

## H. MORTE REAL FRACA — NUNCA DESLOCA

Morte real que **falha** a validade (ex.: onda 1 com 3 abates, ou 40s de
run): `onPlayerDeath` roda normalmente para **progressão/tela** (bump de
prog, `state='fracture'`, `showFracture`, `clearActiveRun`), mas o
`runData` criado pelo original é **descartado** — fila em memória e
arquivo voltam ao estado anterior. Nenhuma assinatura é criada.

---

## I. ABORTAR RUN — SEM MEMÓRIA/ECHO

Hoje (legado), `abortRun` (pausa) chamava `onPlayerDeath` e a run "virava
Echo·01". PR15-B1 separa **captura** de **limpeza**:

- `abortRun` wrapper sinaliza `pr15Ctx.abort=true` (run-scoped) antes de
  chamar o fluxo original;
- o wrapper de `onPlayerDeath` vê `abort` → `realDeath=false` →
  **inválida** → o `runData` do abort é revertido (memória + disco);
- limpeza/progressão/tela de fratura **preservadas**;
- causa da morte anterior **nunca é reaproveitada** (contexto resetado);
- microcopy do botão atualizado:
  `ABORTAR RUN` · `ENCERRA O CICLO — NENHUMA MEMÓRIA TEMPORAL É CRIADA`;
- `SAVE_SYSTEM.md` §9 ganhou **nota de dívida** sobre o fluxo antigo.

---

## J. VITÓRIA — NUNCA CRIA MEMÓRIA

`onVictory` **não toca** `echoQueue`/`saveEchoes` (legado preservado — a
tela de vitória já limpava `activeRun`). `pr15RunIsValid` exclui
`victory` → vitória nunca cria memória nem assinatura. Wrapper de
`onVictory` apenas reseta o contexto de causa da run.

---

## K. SANDBOX — ISOLAMENTO TOTAL

O laboratório (sandbox) já não criava Echo (`sandboxDeath`). O wrapper de
`onPlayerDeath` **desvia** qualquer chamada com `sandboxRun` direto para o
original — nada de PR15 no laboratório, inclusive com métricas "válidas".
`pr15RunIsValid` exclui `sandbox`.

---

## L. DEV / devTainted — ISOLAMENTO + DEV.pr15*

- Run DEV (`devTainted`, setada em `startRun` quando `DEV_MODE`) nunca
  captura: o wrapper rejeita (`dev:true` → inválida) e reverte memória e
  disco (o guard de `saveEchoes` já bloqueava o arquivo).
- `DEV.pr15History()` · `DEV.pr15Signature()` · `DEV.pr15Validity()` ·
  `DEV.pr15DeathCause()` — **helpers de LEITURA**, com guarda
  `!DEV_MODE → null` (inertes em release). Não escrevem save nem taint.

---

## M. DEATH CAUSE — ENUM RUN-SCOPED

Enum: `boss | miniboss | echo | enemy | hazard | event | unknown`
(`PR15_DEATH_CAUSES`; `pr15SanitizeCause`).

- Contexto run-scoped `pr15Ctx`: `ev` (eventos de dano reais), `causeEv`,
  `cause`, `pending`, `abort`.
- `pr15NoteDamage(cause)` é chamado **dentro** de `damagePlayer` quando o
  dano é real (pós-guards de invulnerabilidade/escudo). A causa da morte é
  a do **último evento de dano**; se o último evento não tiver causa
  confiável → `unknown` (nunca vaza a causa anterior).
- Call-sites anotados com causa **confiável**: contato de inimigo/comum
  (`enemy`), feixes e ataques do boss (`boss`), ataques de miniboss
  (`miniboss`), zonas/efeitos de área (`hazard`), dano de escolha de
  evento via pendente `evOpt` (`event`), projéteis com `srcC` na criação
  ou dono (Echo hostil → `echo`).
- Reset: run nova, Continue, abort, troca de slot e `smClearSlotSave`
  zeram o contexto (`pr15ResetCause`). Causa nunca é reutilizada em abort.

---

## N. ASSINATURA TEMPORAL — CAMPOS E REGRAS

Capturada **antes** do corpo original do `onPlayerDeath` (estado vivo:
tema/seed do Diretor ainda presentes) e anexada **depois** sobre
`echoQueue[0]` via `pr15CommitSig` + segundo `saveEchoes()` (v3 no
arquivo). Compacta, determinística, sanitizada no commit e na carga.
Ver tabela em §E. `out` é sempre `'death'` — aborts/vitórias/Sandbox/DEV/
mortes fracas **não entram na fila**, logo `death` é o único desfecho
mecânico persistido (semântica "outcome" documentada; sem valores
inventados para outros desfechos).

---

## O. ID ESTÁVEL — e<slot>-<seq>

`pr15SlotIdNext()`: contador monotônico **por slot**,
`seq = max(slot.seq, maior seq já na fila) + 1`. Id `e<slot>-<seq>`
(ex.: `e1-3`). Persistido em `smRoot.slots[slot].seq` no `pr15CommitSig`.

- Estável: sobrevive save/load; monotônico; determinístico.
- Sem timestamp puro e **sem `Math.random`**.
- Compatível com saves antigos (sem `slot.seq`: varre a fila existente e
  continua de lá).

---

## P. BUILD PROFILE — arch

`pr15BuildSignature` chama `buildProfileSummary()` no momento da morte e
compacta em `arch`:

```
{dom, sec, state, domS, secS}
```

- `dom`/`sec`: arquétipos dominante/secundário validados em
  `BUILD_ARCH_IDS`; `state`: rótulo do estado do build; `domS`/`secS`:
  scores arredondados (1000) ou `null`.
- Determinístico (vem do summary da run — sem RNG).

---

## Q. ARMA ASSINATURA — sigW

Regra escolhida (barata e determinística):

1. **Mais usada na trail** — `wi` (índice de arma) de cada linha do
   `recorder` é amostrado a cada 250ms; uma única varredura na morte
   conta frequências (empate → menor índice).
2. **Fallback** — trail sem dado confiável: `player.wi` (arma ativa).

Sem contadores pesados por frame; a amostragem já existia no `recorder`.

---

## R. MÓDULOS ASSINATURA — sigItems

2..4 módulos representativos, **determinísticos, sem RNG**, do inventário
real do player na morte:

1. Score de **compatibilidade com o Build Profile** (`buildCompat(id,
   prof)`) — reflete o build real;
2. Desempate por **ordem de aquisição** (índice no `player.items`);
3. Desempate final por **id estável**.

Máximo 4; sem módulos no inventário → `[]`. Nada de módulos "ideais
teóricos": só o que o jogador tinha.

---

## S. SANITIZAÇÃO TOLERANTE DE CARGA

`pr15SanitizeRecord(r)` roda nas cópias em memória de
`loadEchoes`/`activateSlot`. Regras:

- **Nunca lança**; registro sem condição mínima de replay (trail ausente
  ou posição inicial não-numérica) sai **só da memória** (arquivo não é
  reescrito aqui).
- Trail reparada **linha a linha** quando qualquer célula não for `number`
  finito — inclusive strings numéricas (`'5'` → `5`) — para o replay
  legado nunca receber NaN/string.
- Numéricos com tipo errado → defaults seguros (`PR15_SAN_DEFAULTS`);
  enums/ids inválidos → campo ausente (leitor usa legado); listas
  filtradas e limitadas; `owned` vazio → starter; `moral` objeto 3 eixos;
  `ps` não-objeto removido; `sigItems` >4 removido; strings longas
  truncadas/cortadas.
- **Migração aditiva** `k→kills` (em memória) — mantém o re-save de Echos
  v2 estável sem tocar o arquivo v2.

---

## T. SAVE/LOAD, SLIM v3 E MIGRAÇÃO OLD-SAVE

- `saveEchoes()` slim: `v:(r.id?3:2)` + campos legados + campos novos
  (`id/out/cause/op/theme/seed/arch/sigW/sigItems`); `kills→k`.
- Arquivo v2 antigo (sem `id`/assinatura): carrega **sem migração
  forçada** — continua v2 no re-save, preservando `k` (via migração
  `k→kills` em memória) e todos os campos legados.
- Corrupto/parcial (string, número, `trail:'nada'`, enums inválidos,
  arrays gigantes): nunca explode o load nem destrói slot.
- Slots isolados: fila, seq e arquivo de um slot nunca vazam para os
  outros (ids escopados por slot).

---

## U. CONTINUE — FILA PRESERVADA, CAUSA ZERADA

- `resumeRun` wrapper: `pr15ResetCause()` (causa da run anterior nunca
  vaza para a retomada) e a fila do slot permanece intacta.
- Morte válida pós-Continue: memória nova com `id` monotônico.
- Abort pós-Continue: sem memória, sem deslocamento.

---

## V. TRAIL LEGADA PRESERVADA

A trail continua sendo gravada **integra** (memória = `recorder` + linha
final de morte do `onPlayerDeath`; arquivo e reload idênticos). **Sem
downsample, sem reprojeção** neste bloco. A linha final de morte é o único
acréscimo e já era comportamento legado.

> **Dívida documentada (não tratada no B1):** tamanho/débito da trail
> (crescimento do save) permanece como está; redução/reprojeção é tema de
> bloco futuro (B2+), nunca alterada aqui.

---

## W. ECHOS LEGADOS INTACTOS

`makeEcho`, replay de trail, personalidade (`ps`/`pers`), trust, relação/
Dissonância, equipamento (itens/owned/upg), escudo e fala **não foram
tocados**: o registro v3 é superset, e a carga sanitiza sem quebrar o
construtor de Echos (suíte valida v2 e v3 gerando aliados íntegros).

---

## X. NENHUMA PRESENÇA PR15 EM B1 (EXCLUSÕES)

Proibido e verificado por teste (tokens ausentes do corpo): `pr15Spawn`,
`pr15Entity`, `pr15Draw`, `pr15Render`, `pr15Ui`, `pr15Event`,
`pr15Reward`, `pr15Duel`, `pr15Banner`, `pr15Tooltip`, `pr15Modal`, tab
PR15 no Codex, DOM `id/class="pr15*"`. O bloco **não agenda nada** (sem
`setInterval/setTimeout/requestAnimationFrame/spawnWave` dentro dele) —
nenhum scheduler, presença, spawn, evento, interação, recompensa,
penalidade, detecção, banner/UI, integração de facção ou mudança de
balanceamento.

---

## Y. TESTES E SIMULAÇÕES (§33/§34)

`tests/pr15-b1.test.js` (40 testes, adicionado à cadeia do `package.json`
— 41 suítes no `npm test`):

- **§33 áreas 1–37** — contrato v3 superset (arquivo+reload), compat v2 e
  re-save preservando `k`, sanitização (tipos/enums/arrays), validade
  (wave/duração/kills), morte fraca, abort, vitória, Sandbox, DEV,
  N-1/N-2/cap 2, inválida não desloca, operador, moral, personalidade,
  Build Profile, arma assinatura (trail + fallback), módulos
  (determinismo/inventário/vazio), Tema, seed, death cause (+`unknown`),
  reset run-scoped, save/load, old-save, corrupt/partial, isolamento dos
  3 slots, Continue (fila/causa, morte e abort pós-Continue), Echos
  legados (v2 e v3), trail íntegra, nenhuma presença/scheduler PR15.
- **§34 simulações** — A: 10.000 desfechos mistos (válida/inválida/abort/
  Sandbox/DEV/vitória): fila ≤2, inválida nunca desloca, ordem N-1..N-2,
  zero duplicação; B: varredura kills 0–10 × wave 0–5 × dur 0–120
  (7.986 combos) = exatamente `kills>=5 && (wave>=3 || dur>=90)`; C:
  corpus hostil de sanitização (antigos/parciais/ausentes/tipos errados/
  enums inválidos/arrays grandes/strings) — nenhum explode load, destrói
  slot, gera NaN ou quebra `makeEcho`.

Legado ajustado para a semântica nova (morte válida virando Echo):
`tests/devmode.test.js` (morte DEV não deixa registro em memória),
`tests/saveslots.test.js` (run de morte com métricas válidas),
`tests/fracture-director.test.js` (meta-teste da cadeia: 41 suítes).

---

## Z. DÍVIDAS, LIMITES DO B1 E PLANO B2

### Dívidas registradas
- **SAVE_SYSTEM.md §9** — nota sobre o fluxo antigo de ABORTAR RUN
  ("vira Echo·01") vs. semântica nova (sem memória).
- **Tamanho/débito da trail** — documentado em §V; redução/reprojeção
  fica para B2+.
- Suítes legadas que chamam `onPlayerDeath()` com runs fracas precisam de
  métricas válidas se quiserem Echo (comportamento novo e intencional).

### Limites do B1
- Nenhum scheduler/Diretor temporal, presença/entidade/alvo, aliado/rival/
  ambíguo, evento, interação, recompensa, penalidade, UI de detecção
  (banner/tooltip/modal/renderer), facção ou balanceamento.
- `out` com um único valor (`death`) — B2 pode estender o enum se surgir
  outro desfecho persistível; nenhuma semântica é inventada agora.

### Plano para B2 (próximo bloco, quando autorizado)
- Consumidores da memória/assinatura (histórico entre runs, presença
  temporal mínima), scheduler determinístico e manifestação física;
- redução/reprojeção de trail se entrar no escopo;
- UI de estado/assinatura (leitura dos campos v3).

---

## APÊNDICE — MARCADORES DE FONTE (index.html)

| Marco | Linha (pós-PR15·b1) |
|---|---|
| Cabeçalho do bloco `PR15·b1` | ~31732 |
| `PR15_DEATH_CAUSES` + contexto de causa | ~31768 |
| `pr15RunIsValid` / `pr15ValidityReason` | ~31820 |
| `pr15QueuePush` | ~31843 |
| `pr15BuildSignature` | ~31875 |
| `pr15SlotIdNext` / `pr15CommitSig` | ~31933 / ~31955 |
| `pr15SanitizeRecord` | ~31994 |
| `pr15DevHistory/Signature/Validity/DeathCause` | ~32092 |
| `pr15TemporalKitBoot` | ~32141 |
| `/* ==================== PR15·fim b1 ==================== */` | 32249 |
| `pr15TemporalKitBoot();` (BOOT) | 32258 |
| `damagePlayer(d,cause)` | 14060 |
| `saveEchoes()` (slim v3 aditivo) | 3536 |

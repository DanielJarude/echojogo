# PR15 · B1 — MEMÓRIA TEMPORAL E ASSINATURA DE RUN

> Fundação de dados (somente) de "Echos entre runs". Fonte única:
> `echoQueue`. Nenhuma presença/scheduler/UI/evento/recompensa nova em B1.

---

## A. OBJETIVO

Construir a **fundação de dados** da Memória Temporal: o `echoQueue` passa
a representar exclusivamente as **mortes reais VÁLIDAS** (N-1 = última
morte válida; N-2 = penúltima; cap 2), e cada memória persistida recebe
uma **assinatura compacta e determinística** da run que a originou — para
que blocos futuros (B2+) construam histórico/presença/UI em cima de dados
estáveis, sem depender de trail nem de campos proibidos.

## B. ARQUITETURA

- Bloco autocontido no fim do `<script>` de `index.html`, entre os
  marcadores auditáveis `/* ==================== PR15·b1` e
  `/* ==================== PR15·fim b1 ==================== */`.
- Integração por **monkey-patch no BOOT** (`pr15TemporalKitBoot()` após
  `factionPresencePhysicalKitBoot()`), mesmo padrão dos kits PR12–PR14.
- Toques pontuais no legado (mínimos, explicados nas seções próprias):
  - `damagePlayer(d,cause)` — 2º parâmetro **opcional** + `pr15NoteDamage`
    quando o dano é real; call-sites confiáveis anotados com a causa;
  - `saveEchoes()` — slim grava os campos novos do v3 quando há `id`;
  - microcopy do botão `#p-abort` (seção E);
  - suítes legadas ajustadas para a semântica nova (seção V).
- Harness de auditoria (`audit_pr135/harness.js`) expõe os símbolos PR15 e
  getters/setters de estado para os testes.

## C. DECISÕES FECHADAS

1. `echoQueue` é a **única** fonte persistente de histórico — nunca
   `slot.mems` nem segunda fila.
2. A fila guarda só **mortes reais VÁLIDAS**: N-1 (última) e N-2
   (penúltima), cap 2.
3. Gate exato de validade (uma função pura):
   `realDeath && !sandbox && !dev && !abort && !victory && kills>=5 &&
   (wave>=3 || dur>=90)`.
4. Morte real fraca: não entra, não vira Echo, não desloca, sem assinatura
   (progressão/tela seguem como hoje).
5. ABORT: não entra, não desloca, não cria memória/assinatura, não reutiliza
   deathCause; preserva só o cleanup/progressão/tela necessários.
6. Vitória: nunca entra na fila.
7. v3 = evolução **ADITIVA** do v2 — campos legados preservados para
   `makeEcho`, trail replay, personalidade e comportamento atual dos Echos.
8. Assinatura PR15 **compacta**, sem depender da trail como contrato
   principal (a trail continua campo legado integral; a assinatura não a
   inclui).
9. `out='death'` para toda memória válida (não existe `outcode`; sem
   armazenamento paralelo de outcomes); `cause` = causa da morte.
10. Sandbox/DEV isolados; DEV.pr15* são helpers de leitura com guarda.

## D. RUN VÁLIDA

`pr15RunIsValid(o)` (verdade única) e `pr15ValidityReason(o)` (diagnóstico):

```
VALID = realDeath && !sandbox && !dev && !abort && !victory
        && kills>=5 && (wave>=3 || dur>=90)
```

- Coerção numérica + `Number.isFinite`: strings numéricas entram;
  `NaN`/`undefined` nunca passam.
- Usada pelo wrapper de morte e pela fila pura `pr15QueuePush`
  (simulações).

## E. ABORT

- `abortRun` (pausa) sinaliza `pr15Ctx.abort=true` antes do fluxo
  original; o wrapper de `onPlayerDeath` vê `abort` → não é morte real →
  o `runData` do abort é **revertido** (memória + disco).
- Não desloca a fila, não vira Echo, não cria assinatura, não reutiliza a
  causa de morte anterior.
- Cleanup/progressão/tela de fratura preservados (captura separada da
  limpeza).
- Microcopy do botão: `ABORTAR RUN` · `ENCERRA O CICLO — NENHUMA MEMÓRIA
  TEMPORAL É CRIADA`; `SAVE_SYSTEM.md` §9 registra a dívida do fluxo
  antigo ("vira Echo·01").

## F. VITÓRIA

- `onVictory` **não toca** `echoQueue`/`saveEchoes` (legado preservado;
  a vitória já limpava `activeRun`).
- `pr15RunIsValid` exclui `victory` → vitória nunca cria memória nem
  assinatura. O wrapper de `onVictory` apenas reseta o contexto de causa.

## G. CAUSA DA MORTE

- Enum sanitizado: `boss | miniboss | echo | enemy | hazard | event |
  unknown` (`PR15_DEATH_CAUSES`, `pr15SanitizeCause`).
- Contexto run-scoped `pr15Ctx` (`ev`, `causeEv`, `cause`, `pending`,
  `abort`): `pr15NoteDamage(cause)` é chamado dentro de `damagePlayer`
  quando o dano é real; a causa da morte é a do **último evento de dano**;
  sem causa confiável no último evento → `unknown` (nunca vaza a anterior).
- Call-sites confiáveis anotados: inimigos (`enemy`), boss (`boss`),
  minibosses (`miniboss`), zonas/áreas (`hazard`), escolha de evento via
  pendente `evOpt` (`event`), projéteis com `srcC`/dono (Echo → `echo`).
- Reset em run nova / Continue / abort / troca de slot / limpeza de slot.

## H. CONTRATO DO REGISTRO

Registro v3 **aditivo** sobre o v2:

- **Legados (intactos):** `dur, dmgMul, frMul, wave, level, trail, crit,
  critMul, pierce, aoeMul, rangeMul, meleeRangeMul, rangedRangeMul,
  projSpdMul, longRangeBonus, coins, items, upg, owned, moral, dom,
  k(arquivo)/kills(memória), mh, st, ps`.
- **Novos (assinatura):** `id, out, cause, op, theme, seed, arch, sigW,
  sigItems` (+ `v:3` materializado no arquivo).
- **Fora da assinatura (nunca gravado):** `itemState`, hooks, projéteis,
  inimigos, posições, `frame`, `fracRun`, event-memory, relação/
  Dissonância, cópia do player.
- **Formas:** em memória o registro da morte é o `runData` + assinatura
  (sem `v`/`k`); no arquivo o slim materializa `v` (derivado de `id`) e
  `kills→k`; no reload a carga sanitiza e migra `k→kills`.

## I. ASSINATURA TEMPORAL

Capturada **antes** do corpo original do `onPlayerDeath` (estado vivo:
tema/seed do Diretor ainda presentes), anexada **depois** sobre
`echoQueue[0]` (`pr15CommitSig`) + segundo `saveEchoes()` (v3 no arquivo).

- Compacta e determinística (sem RNG, sem timestamp puro).
- `out` é **sempre `'death'`** — não existe `outcode`; abort/vitória/
  Sandbox/DEV/morte fraca não criam registro.
- Exemplos: `out='death', cause='boss'` · `out='death', cause='enemy'` ·
  `out='death', cause='unknown'`.
- Não depende da trail como contrato: a assinatura não contém trail nem
  derivados de replay.

## J. BUILD PROFILE

`pr15BuildSignature` usa `buildProfileSummary()` no momento da morte e
compacta em `arch = {dom, sec, state, domS, secS}`:

- `dom`/`sec` validados em `BUILD_ARCH_IDS`; `state` = rótulo do estado do
  build; `domS`/`secS` = scores arredondados (ou `null`).
- Determinístico (summary da run, sem RNG).

## K. ARMA ASSINATURA

Regra escolhida (barata e determinística):

1. **Mais usada na trail** — `wi` de cada linha do `recorder` (amostrado a
   cada 250ms, já existente); uma varredura na morte conta frequências
   (empate → menor índice);
2. **Fallback** — trail sem dado confiável: `player.wi` (arma ativa/slot).

## L. MÓDULOS ASSINATURA

`sigItems` = 2..4 módulos **representativos**, determinísticos, sem RNG,
do inventário real na morte:

1. Score de **compatibilidade com o Build Profile** (`buildCompat(id,
   prof)`);
2. Desempate por **ordem de aquisição**;
3. Desempate final por **id estável**.

Sem itens → `[]`. Nunca módulos teóricos fora do inventário.

## M. MORALIDADE

- `moral = {comp, greed, viol}` e `dom` (dominante) são persistidos no
  registro (campos legados, intactos) e sobrevivem ao save/load.
- Nenhum campo novo de moralidade é criado em B1.

## N. PERSONALIDADE

- `ps` derivada **uma única vez** na morte (`deriveEchoPersonality`, legado
  PR 8) e `st` (contadores de comportamento) seguem no registro.
- Sobrevivem ao save/load; `makeEcho` reconstrói `e.ps`/`e.pers` do
  registro (v2 migrado ou v3).
- Sem mudança de taxonomia nem de cálculo em B1.

## O. FRACTURE THEME

- `theme` (id do Fracture Theme) e `seed` (uint32, `>>>0`) da run são
  capturados no momento da morte, via Diretor (`fractureGetThemeId`/
  `fractureGetSeed`), null-safe.
- Persistem no registro/arquivo; sem Diretor ativo → `null`.

## P. N-1/N-2

- Cap exato 2, por slot. Inserção: nova memória → N-1; antiga N-1 → N-2;
  N-2 → descartada.
- `pr15QueuePush(queue, verdict, rec)` — fila pura que espelha a regra
  real: válida → `[rec, ...q]` truncado em 2; inválida → inalterada.
- Morte inválida/abort **nunca desloca** (wrapper reverte memória e disco).
- Fila nunca > 2, nem em memória nem no arquivo.

## Q. SAVE/MIGRAÇÃO

- `saveEchoes()` slim: `v:(r.id?3:2)` + campos legados + campos novos;
  `kills→k`; `seq` do slot persistido (`smRoot.slots[slot].seq`).
- **Old save v2** (sem `id`/assinatura): carrega sem migração forçada;
  re-save continua v2 e preserva `k` (migração aditiva `k→kills` em
  memória).
- **Corrupto/parcial** (string, número, `trail:'nada'`, enums inválidos,
  arrays gigantes, strings inesperadas): sanitização tolerante em memória;
  nunca explode load, nunca destrói slot; trail reparada linha a linha
  (strings numéricas → números) para o replay nunca receber NaN.
- Isolamento: fila/seq/arquivo de um slot nunca vazam para os outros
  (ids escopados por slot).

## R. SANDBOX

- Laboratório (`sandboxRun`) já não criava Echo; o wrapper de
  `onPlayerDeath` desvia direto para o original — nada de PR15 no
  laboratório, mesmo com métricas "válidas".
- `pr15RunIsValid` exclui `sandbox`.

## S. DEV

- Run DEV (`devTainted`, setada em `startRun` quando `DEV_MODE`) nunca
  captura: inválida → revert (memória + disco; o guard de `saveEchoes` já
  bloqueava o arquivo).
- `DEV.pr15History()` · `DEV.pr15Signature()` · `DEV.pr15Validity()` ·
  `DEV.pr15DeathCause()` — leitura apenas, com guarda `!DEV_MODE → null`
  (inertes em release); não escrevem save nem taint.

## T. CONTINUE

- `resumeRun` reseta o contexto de causa (nunca vaza a run anterior) e
  preserva a fila do slot.
- Morte válida pós-Continue: memória nova com `id` monotônico.
- Abort pós-Continue: sem memória, sem deslocamento, causa não reutilizada.

## U. COMPATIBILIDADE COM ECHOS ATUAIS

- `makeEcho`, trail replay, personalidade, trust, relação/Dissonância,
  equipamento (itens/owned/upg), escudo e fala **intactos** — o v3 é
  superset do v2 e a carga sanitiza sem quebrar o construtor de Echos.
- Trail preservada **integral** (memória = `recorder` + linha final de
  morte; arquivo e reload idênticos; sem downsample/reprojeção em B1).
- Suíte valida v2 legado e v3 gerando aliados íntegros via `makeEcho`/
  `startRun`.

## V. TESTES

`tests/pr15-b1.test.js` (40 testes, integrado ao `npm test` — 41 suítes).

Mapa 1:1 com §33 (1–37): contrato novo; compatibilidade v2; sanitização;
run válida por wave; run válida por duração; kills mínimo; morte inválida;
abort; vitória; Sandbox; DEV; N-1; N-2; cap 2; memória inválida não
desloca fila; operador; moral; personalidade; Build Profile; arma
assinatura; módulos assinatura; Tema; seed; death cause; death cause
unknown; reset death cause; save/load; old save; corrupt/partial record;
isolamento dos 3 slots; Continue; morte pós-Continue; abort pós-Continue;
Echos legados continuam carregando; trail preservada; nenhuma presença
PR15 criada; nenhum scheduler PR15 criado. (Ordem literal preservada.)

Usa o harness existente (`audit_pr135/harness.js`) — nenhuma segunda
infraestrutura de testes.

Suítes legadas ajustadas para a semântica nova:
`tests/devmode.test.js` (morte DEV não deixa registro em memória),
`tests/saveslots.test.js` (morte do teste com métricas válidas),
`tests/fracture-director.test.js` (meta-teste da cadeia: 41 suítes).

## W. SIMULAÇÕES

- **A — Fila:** 10.000 resultados de runs misturando válidas/inválidas/
  abort/Sandbox/DEV/vitória. Invariantes: fila nunca >2; inválida nunca
  desloca; ordem sempre correta; sem duplicação acidental.
- **B — Validade:** varredura kills 0–10 × wave 0–5 × dur 0–120 (7.986
  combos) confirma exatamente `kills>=5 && (wave>=3 || dur>=90)` para
  morte real normal; flags (sandbox/dev/abort/victory) anulam qualquer
  métrica.
- **C — Sanitização:** corpus com antigos/parciais/ausentes/tipos
  errados/enums inválidos/arrays grandes/strings inesperadas — nenhum
  explode `load`, destrói slot, gera NaN ou quebra `makeEcho`.

## X. DÍVIDAS

- **SAVE_SYSTEM.md §9** — nota sobre o fluxo antigo de ABORTAR RUN
  ("vira Echo·01") vs. semântica nova (sem memória).
- **Tamanho/débito da trail** — documentado, não tratado em B1
  (redução/reprojeção é tema de B2+).
- Suítes legadas que chamam `onPlayerDeath()` com runs fracas precisam de
  métricas válidas para gerar Echo — comportamento novo e intencional
  (gate de validade).

## Y. ESCOPO EXPLICITAMENTE NÃO IMPLEMENTADO

Nenhum scheduler/Diretor temporal; presença/entidade/alvo; spawn; aliado/
rival/ambíguo; evento; interação; recompensa; penalidade; detecção; UI
(banner/tooltip/modal/renderer); integração de facção; balanceamento.
Nada disso existe em B1 (verificado por teste: sem `pr15Spawn/Entity/Draw/
Render/Ui/Event/Reward/Duel/Banner/Tooltip/Modal`, sem tab PR15, sem DOM
`pr15*`, e o bloco não agenda nada). Também não implementado: `slot.mems`
ou segunda fila; campo `outcode`; armazenamento paralelo de outcomes.

## Z. RECOMENDAÇÃO PARA B2

- Base de dados estável e validada: fila = mortes válidas (cap 2),
  assinatura compacta por memória, causa confiável, IDs monotônicos,
  sanitização tolerante.
- B2 pode consumir `id/out/cause/op/theme/seed/arch/sigW/sigItems` +
  legado para histórico entre runs e presença mínima, com scheduler
  determinístico quando autorizado.
- Endereçar a dívida da trail (redução/reprojeção) fora do contrato da
  assinatura.
- Manter o gate em `pr15RunIsValid` como única verdade e evoluir `out`
  somente se surgir outro desfecho persistível (hoje só `death`).

---

## APÊNDICE — MARCADORES DE FONTE (index.html)

| Marco | Linha |
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

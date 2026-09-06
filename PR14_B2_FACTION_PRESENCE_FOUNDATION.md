# PR14 — PRESENÇA DE FACÇÃO · B2 — FUNDAÇÃO ARQUITETURAL

> **Natureza:** este bloco cria a **fundação estrutural** (sem gameplay visual)
> que o B3 usará para manifestar facções fisicamente na arena. Segue o
> **MODELO C (Híbrido)** recomendado no B1: o Diretor **agenda**
> deterministicamente; a manifestação física efêmera fica para o B3.
>
> **Regra central (B1):** **FACÇÃO ≠ FRACTURE THEME.** Este bloco **lê** o
> Diretor (seed/onda/estado) para agendar, mas **nunca** escreve `fractureRun`,
> **nunca** toca o Tema, a composição, a Intensidade ou o budget. A única saída
> para o Diretor é `fractureEmit('faction_reaction', …)` — que por contrato tem
> `i:0` (não muda Intensidade) e só registra histórico.

---

## 1. BASELINE

| Item | Valor |
|---|---|
| Branch | `arena/01a074d8-echojogo` |
| HEAD inicial | `f5c5edfce9ecaa3d2ed1aad9395ea238f76cf665` |
| Versão | `0.8.0-alpha` (runtime `ECHO_VERSION` + `package.json`) |
| SM_VERSION | **3** (inalterado) |
| FRACTURE_STATE_VERSION | **1** (inalterado) |
| `npm test` (antes) | 0 falhas ✅ |
| `npm test` (depois) | 0 falhas ✅ (28 suítes; +1 nova) |

---

## 2. ARQUITETURA ESCOLHIDA

**MODELO C — Híbrido**, implementado como um bloco autocontido
`PR14·bloco fp1.js … PR14·fim fp1.js` no fim do `<script>` de `index.html`,
integrado por **monkey-patch** (`factionPresenceKitBoot`) — o **mesmo padrão**
do Diretor de Fratura (`fractureKitBoot`). Nenhuma função de run/onda/save foi
editada internamente; toda a costura é feita por wrappers no boot.

Motivo (menor risco): o padrão de boot por monkey-patch já é validado pela
suíte do PR13, mantém o `index.html` **puramente aditivo** (459 inserções, 0
deleções) e isola a nova lógica atrás de marcadores auditáveis.

---

## 3. CONTRATO DE DADOS (B2-B)

`fpMakePresence(o)` → objeto **plano, serializável, determinístico**. Sem DOM,
sem closures, sem funções, sem ciclos. Campos **mínimos**:

| Campo | Tipo | Papel |
|---|---|---|
| `id` | int ≥1 | serial da run (único/crescente) |
| `faction` | `anchor`/`remnants`/`consortium`/`deviants` \| null | facção validada via `FRACTION_BY_ID` (`hasOwnProperty`) |
| `kind` | `signal`/`emissary` | taxonomia mínima (B2-C) |
| `state` | `scheduled`/`active`/`resolved`/`expired` | lifecycle |
| `wave` | 0..MAX_WAVE | onda alvo |
| `seed` | uint32 | seed determinística da decisão |
| `reason` | string ≤24 | rótulo de origem/debug |

Campos como `x/y/life/duration/interactive/hostile/allied/payload/tags` foram
**deliberadamente omitidos**: não há comportamento no B2 que os justifique
(anti-antecipação). Entram no B3 quando existir entidade física real.

---

## 4. ESTADO RUNTIME (B2-D)

`factionPresenceRun` — **próprio e run-scoped**, separado de `fracRun` (afinidade/
resíduos) e de `fractureRun` (Tema/Intensidade). Criado por
`factionPresenceFresh()`:

| Campo | Papel |
|---|---|
| `v` | versão do estado (1) |
| `serial` | contador de ids |
| `active` | presença ativa (cap=1) ou null |
| `scheduled` | intenção agendada aguardando ativação (B3) |
| `lastWave` | última onda agendada (cooldown) |
| `history[]` | histórico compacto (cap 24) |

**Não duplica** afinidade, resíduos, moralidade nem Tema — não é uma segunda
facção nem um segundo Diretor.

---

## 5. TIPOS DE PRESENÇA (B2-C)

Taxonomia **mínima**: `FACTION_PRESENCE_KINDS = ['signal','emissary']`. Dois
tipos bastam para o B3 diferenciar uma presença passiva (sinal/transmissão) de
uma presença personificada (emissário). Mais tipos só entram quando houver
comportamento real que os exija. Estados de lifecycle:
`['scheduled','active','resolved','expired']`.

---

## 6. CAP DE PRESENÇA (B2-E)

`FACTION_PRESENCE_ACTIVE_CAP = 1` (constante explícita, sem número mágico).
Política mais segura: **não substituir silenciosamente**. Se já há presença
ativa, `factionPresenceSchedule` retorna `null` (não agenda) e
`factionPresenceActivate` recusa a segunda ativação. Nunca há mais de 1 ativa.

---

## 7. SCHEDULER (B2-H / B2-I) E DETERMINISMO

`factionPresenceSchedule(n)` decide **apenas a intenção** para a onda `n` (não
spawna nada visual). Pipeline:

1. `n < FACTION_PRESENCE_MIN_WAVE (2)` → não agenda.
2. Cap: se há `active` → não agenda.
3. Anti-duplicação: se já há `scheduled` para a **mesma onda** → devolve a mesma.
4. Cooldown: `n - lastWave < FACTION_PRESENCE_COOLDOWN (2)` → não agenda.
5. **RNG determinístico** `fpRng(n)` (ver abaixo); portão ~40% (frequência
   **não é tunada** no B2 — isso é B6, só precisa ser determinística).
6. `fpPickFaction(rng)` escolhe a facção; `kind` sorteado da taxonomia.
7. Cria a presença, grava em `scheduled`, atualiza `lastWave`, empurra no
   histórico.

**Determinismo:** `fpDeterministicSeed(w)` = `fractureHash32(seed_do_Diretor ^
hash(w))`, e `fpRng` = `fractureRng(...)` — o **mesmo gerador** do Diretor.
**Nunca** usa `Math.random`. Mesma `(seed, wave)` ⇒ mesma decisão (testado com
300 seeds). Integrado em `spawnWave` (fronteira de onda, ponto SEGURO do B1),
com guardas de `smRestoring` (Continue não re-agenda) e `sandboxRun`.

**Não** lê `fractureGetIntensity()` (respeita a guarda de arquitetura do PR13
que proíbe leitura de Intensidade para balance fora do bloco do Diretor).

---

## 8. SELEÇÃO DE FACÇÃO (B2-L)

`fpPickFaction` sorteia entre as 4 facções elegíveis com **viés suave** de
afinidade: peso ∈ `[0.5 .. 1.5]` (`1 + aff/100 * 0.5`). Isso **evita**
"maior afinidade sempre aparece" (não há determinismo trivial nem snowball) e
**permite variedade** — facções diferentes podem surgir na mesma run (testado).
Afinidade é **somente lida** (via `getFactionAffinity`); jamais escrita.

---

## 9. INTEGRAÇÃO COM AFINIDADE (B2-M)

Afinidade continua **exclusivamente** em `fracRun.aff`. O B2 **lê** (para o viés
de seleção) e **nunca** aplica `+aff`/`-aff` automático. Teste dedicado verifica
que `fracRun.aff` fica byte-idêntico após centenas de agendamentos.

---

## 10. faction_reaction (B2-J / resolve DT-4)

`fpEmitFactionReaction(p, reason)` é o **primeiro emissor real** do tipo
`faction_reaction` (que existia no `FRACTURE_EVENT_GRID` sem emissor). Payload
**mínimo**: `{wave, source:'presence', faction, kind, affinityState, reason}`.
É determinístico, gated no Sandbox (o scheduler não roda lá) e **não tem side
effect de gameplay**. Como `faction_reaction` tem `i:0` no contrato, **não altera
Intensidade nem Tema** — apenas registra histórico do Diretor. Testado
explicitamente (`delta === 0`, Tema/Intensidade inalterados após 10 emissões).

---

## 11. COEXISTÊNCIA COM BEACON (B2-F / DT-2)

**Decisão de menor risco:** **não** transformar `beacon` em array (evita
regressão nos 12 eventos de facção + eventos comuns que usam o singleton). A
presença tem **estado próprio**; quando (no B3) precisar do beacon físico, pede
reserva via `canUseBeaconForFactionPresence()`:

- Se há beacon de evento vivo (`beacon != null`) → **não** toma (retorna false).
- Se uma presença ativa já segura um beacon → **não** toma.

Garantias verificadas em teste: nenhum beacon existente some, o objeto beacon
permanece intacto (`kind` preservado), e a reserva respeita o singleton.

---

## 12. TAGS EM ALLIES (B2-G / DT-3)

`fpTagAlly(ally, faction, presenceId)` **anota** `origin:'faction'`, `faction` e
`presenceId` — **somente** quando a facção é válida. Retrocompatível: aliados
legados continuam funcionando sem os campos; facção inválida **não toca** o
objeto; o comportamento ofensivo/defensivo (`fighter`/`turret`) **não** é criado
nem removido. `allies` **não** foi transformado em sistema de facção.

---

## 13. LIFECYCLE E CLEANUP (B2-P)

Funções: `factionPresenceActivate` / `Resolve` / `Expire` / `Cleanup` +
`BeginRun` / `EndRun` / `ForgetRun`. `update`/`draw` completos ficam para o B3.

**Cleanup garantido** (via monkey-patch, sem timers órfãos — evita o problema
corrigido no Paradoxo):

| Gatilho | Ação |
|---|---|
| `startRun` | `factionPresenceBeginRun()` (estado fresco antes do 1º checkpoint) |
| `onPlayerDeath` / `onVictory` / `showVictory` | `factionPresenceEndRun()` (cleanup total) |
| `activateSlot` / `smClearSlotSave` | `factionPresenceForgetRun()` (nada vaza entre slots) |
| `resumeRun` | `factionPresenceUnpack(activeRun)` (Continue fiel) |

---

## 14. SAVE / CONTINUE (B2-N)

Estado mínimo aditivo em **`cp.presence`** (injetado por wrapper em
`smBuildCheckpoint`). **SM_VERSION permanece 3** (campo opcional aditivo).

- `factionPresencePack()` serializa `serial/lastWave/active/scheduled/history`
  (sem timers/closures).
- `factionPresenceUnpack(cp)` trata o payload como **input não confiável**: save
  antigo (sem `cp.presence`) cai em `factionPresenceFresh()` (default seguro);
  campos são revalidados individualmente.
- **Continue não duplica:** `lastWave` e `scheduled` são preservados, então
  re-agendar a mesma onda após restore devolve a **mesma** intenção (mesmo `id`)
  — sem segunda reação. Testado.

Persistir o estado mínimo (em vez de puramente reconstruir) é justificado:
garante que `serial`, `cooldown` e a intenção pendente sobrevivam ao Continue
sem re-emitir reação.

---

## 15. SANDBOX (B2-O)

Contexto **isolado**: `factionPresenceSandboxContextStart` cria estado próprio
no laboratório; `factionPresenceSandboxTearDown` o descarta. O scheduler é
**gated** (`!sandboxRun`) no `spawnWave`, então não agenda reação de run real
dentro do Sandbox. `captureCheckpoint` já recusa gravação em sandbox — nada
vaza para os saves reais (afinidade, resíduos, moralidade, relationship,
equipment, unlocks, discovery, endings, meta permanecem intocados).

---

## 16. PERFORMANCE (B2-R)

- Cap de **1** presença ativa.
- **Nenhum** loop por frame novo: a única costura no loop é o agendamento na
  fronteira de onda (`spawnWave`), com **early-return** quando não há run de
  presença / durante restore / no sandbox.
- Zero alocação por frame; `ENEMY_BUDGET=46` e `PARTS_MAX=900` **inalterados**.

---

## 17. DEV / UX (B2-S / B2-T)

- **Invisível ao jogador**: sem HUD, sem painel de afinidade, sem efeitos.
- Helper **read-only** `factionPresenceDevText()` + seção
  `factionPresenceDevSection()` (só em `DEV_MODE`, injetada via `devRender`).
  Mostra `cap/serial/lastWave/active/scheduled/history`. **Não** altera
  afinidade, **não** spawna, **não** concede recursos, **não** persiste, **não**
  funciona fora do DEV MODE.

---

## 18. EVENTOS ANTIGOS (B2-Q)

Regressão proibida respeitada: os **12** `FACTION_RUN_EVENTS` + **4**
`FRAC_CONTACT_EVENTS` continuam registrados e no pool (`ALL_RUN_EVENTS`).
Verificado por teste. Nada foi convertido para o novo sistema (isso é B3+).

---

## 19. TESTES (B2-U/B2-V)

Nova suíte `tests/pr14-b2-faction-presence.test.js` — **26 casos, 0 falhas**,
cobrindo os 40 pontos pedidos (agrupados) + stress:

- contrato/validação (1,2); cap (3); ids únicos (4); determinismo (5/6);
  variedade (7); não altera Tema/Intensidade (8/9/10, 11b); `faction_reaction`
  (11/12/13); history+cap (14/15); anti-duplicação (16); cooldown (17);
  afinidade só-leitura (18/19); coexistência de beacon (20/21/22); tags em
  allies (23/24); lifecycle (25/26/27/28); save antigo/default (29/30); Continue
  sem duplicar (31); SM/FRACTURE version (32/33); Sandbox isolado (34); fonte
  sem RNG global (35) e sem escrever `fractureRun` (35b); early-return (36);
  eventos antigos (37/38/39); versão 0.8.0-alpha (40).
- **Stress:** 300 seeds × ondas 1–20 — nunca >1 ativa, nenhuma facção inválida,
  nenhum NaN, nenhum estado impossível, Tema/Intensidade nunca mudam, history
  nunca explode.

Um meta-teste do PR13 (`fracture-director.test.js`) que conta as suítes do
`npm test` foi atualizado de 27→28 para incluir legitimamente a nova suíte.

---

## 20. DÍVIDAS

- **DT-2 (beacon único):** endereçada arquiteturalmente via política de reserva
  (`canUseBeaconForFactionPresence`). A **coexistência plena** (quando o B3 de
  fato ocupar o beacon) será exercitada no B3. Status: **fundação pronta**.
- **DT-3 (allies sem cap/tag):** **tag** resolvida (`fpTagAlly`); o **cap** de
  aliados de facção será definido no B3, quando existir spawn real de aliado de
  facção. Status: **parcial (tag pronta)**.
- **DT-4 (faction_reaction sem emissor):** **RESOLVIDA** — emissor real
  (`fpEmitFactionReaction`) ligado ao scheduler.
- **DT-5 (HUD persistente de relação):** **não** tratada no B2 (por instrução).

---

## 21. DECISÕES DELIBERADAS

- Bloco autocontido + monkey-patch boot (mirroring do PR13) → risco mínimo,
  `index.html` puramente aditivo.
- Contrato mínimo (sem `x/y/life/…`) → anti-antecipação; entra no B3.
- Só 2 `kinds` (`signal`/`emissary`) → menos é mais até haver comportamento.
- Não mexer no `beacon` como array → preserva 16 eventos existentes.
- Persistir estado mínimo em `cp.presence` → Continue fiel sem duplicar reação,
  sem bump de SM_VERSION.

---

## 22. LIMITES DO B2 (o que NÃO foi feito)

Nenhuma presença visual, entidade de arena, emissário/drone/estrutura/cache/
zona, unidade hostil/aliada, buff/penalidade de facção, reação nova de Echo,
fala, contrato, missão, UI/HUD nova, evento/oferta/equipamento novo, moeda,
moralidade, alteração de Tema/composição/budget, adaptive difficulty ou mudança
de boss/miniboss. Afinidade **não** é alterada.

---

## 23. PLANO PARA O B3

- Ativar (`factionPresenceActivate`) a intenção agendada como **entidade física
  efêmera** na arena (usando a reserva de beacon e/ou `allies` com `fpTagAlly`).
- `update`/`draw`/colisão/interação por proximidade da presença.
- Primeira(s) facção(ões) com identidade visual (cor/símbolo já existentes).
- Definir cap de aliados de facção (fecha DT-3) e exercitar coexistência plena
  de beacon (fecha DT-2).
- Manter tudo determinístico, Save-safe (SM_VERSION=3), Sandbox-gated, e a linha
  vermelha **FACÇÃO ≠ TEMA**.

---

## APÊNDICE — MARCADORES DE FONTE

O bloco vive entre `PR14·bloco fp1.js` e `PR14·fim fp1.js` em `index.html`.
Os testes de arquitetura delimitam o bloco por esses marcadores (mesma
convenção do PR13) para verificar que ele não escreve `fractureRun` nem usa RNG
global.

# 🌌 DIRETOR DE FRATURA — PR 13

> **Bloco 1 — Fundação.** Este documento descreve o sistema como ele **existe hoje no código**
> e o que ficou explicitamente **fora** desta PR. Nada aqui é promessa: o que está escrito
> como "futuro" ainda não está ligado ao jogo.

---

## 1. Objetivo

O **Diretor de Fratura** existe para dar **identidade própria a cada run**.

Duas runs de ECHO não devem ser a mesma coisa. No início de cada ciclo o Diretor escolhe
**um Tema de Fratura** (o jogador **nunca** escolhe) e passa a acompanhar uma
**Intensidade da Fratura** (0–100) que cresce com o que acontece dentro da run.

Nos próximos blocos esse par — **Tema + Intensidade** — passa a orientar:

- Tema da Fratura da run;
- composição e pesos de inimigos;
- pacing e escalada das waves;
- seleção/ponderação de eventos;
- seleção/ponderação de minibosses;
- liberação progressiva de conteúdo pela Intensidade;
- interações leves com Facções (PR 12) e Echo (PR 8/10);
- sinais visuais/UI;
- persistência em Continue;
- contexto isolado no Sandbox.

### O que o Diretor NÃO é

- **Não é** "inimigos ganham mais HP". Intensidade não é um multiplicador de dificuldade:
  ela é **dado** que os próximos blocos convertem em **conteúdo** (pools, composições,
  eventos, minibosses, anomalias).
- **Não é** escolha do jogador. Não existe tela, botão ou prompt de Tema.
- **Não é** controlado por Facções. As Facções da PR 12 podem **reagir** ao Tema
  (principalmente em RESSONÂNCIA), mas **nunca o determinam**.

---

## 2. Arquitetura

### 2.1 Regra central

O Diretor segue a mesma filosofia dos controladores que já existem no projeto:

| Sistema | Controlador central | Estado |
| --- | --- | --- |
| Stats (PR 7) | `smFlat` / `smMul` / `smRemoveId` | `player.sm` |
| Itens | `itemEmit` | `player.items` |
| Facções (PR 12) | `factionEmit` | `fracRun` |
| Echo Equipment (PR 12) | `echoEqEmit` | `fracRun.eq` |
| **Diretor de Fratura (PR 13)** | **`fractureEmit`** | **`fractureRun`** |

Consequências práticas:

1. **Todo efeito relevante entra por `fractureEmit(type, payload)`.**
2. **Nada fora do bloco do Diretor escreve em `fractureRun`.**
   Não existe — e não deve existir — `fractureRun.intensity += 5` espalhado em dezenas de
   funções. Há um teste que falha se isso aparecer.
3. **Leitura pública só por API**: `fractureGetTheme()`, `fractureGetIntensity()`,
   `fractureGetStage()`, `fractureSnapshot()`.
4. **Toda integração com o jogo mora em `fractureKitBoot()`** — monkey-patch explícito de
   `smBuildCheckpoint`, `activateSlot`, `smClearSlotSave`, `startRun`, `resumeRun`,
   `onPlayerDeath`, `onVictory`, `showVictory`, `spawnWave`, `sandboxStart`,
   `sandboxRestart`, `sandboxEndToSetup`, `sandboxExit`, `sandboxCloseSetup`,
   `devCommand` e `devRender`. Nenhum desses corpos originais foi editado.

### 2.2 Localização no código

Todo o sistema vive num único bloco marcado em `index.html`:

```
/* ==================== PR13·bloco fx1.js ==================== */
```

Ele fica **depois** do bloco da PR 12 e **antes** da seção `BOOT`, e é ligado por
`fractureKitBoot();` logo após `fracKitBoot();`.

---

## 3. Estrutura real de `fractureRun`

```js
fractureRun = {
  v: 1,                    // versão do estado (FRACTURE_STATE_VERSION)
  theme: 'anomaly',        // id do Tema (null até fractureEnsureTheme)
  seed: 2182809783,        // seed 32 bits da run — PERSISTIDA
  intensity: 10,           // 0–100
  stage: 'latente',        // SEMPRE derivado de intensity
  waveProfile: {
    wave: 6,               // última onda conhecida pelo Diretor
    last: 6,               // última FRONTEIRA de onda processada
    bias: {},              // (futuro) viés de composição por arquétipo — VAZIO no B1
    pool: []               // (futuro) pool de onda sobrescrita — VAZIA no B1
  },
  history: [               // últimos acontecimentos relevantes (teto: 24)
    { t: 'theme_pick',    w: 1, d: 0, s: 'anomaly' },
    { t: 'run_start',     w: 1, d: 0, s: 'nova_run' },
    { t: 'wave_complete', w: 1, d: 2, s: 'fronteira' }
  ],
  last: { t: 'wave_start', w: 6, d: 0 }   // último evento recebido
}
```

Campos:

| Campo | Tipo | Persiste | Observação |
| --- | --- | --- | --- |
| `v` | int | sim | versão do payload |
| `theme` | string\|null | sim | id de `FRACTURE_THEMES`; inválido ⇒ re-derivado da seed |
| `seed` | uint32 | sim | fonte única de verdade da seleção |
| `intensity` | int 0–100 | sim | clampado no pack **e** no unpack |
| `stage` | string | **não** | sempre recalculado por `fractureStageOf(intensity)` |
| `waveProfile.wave` | int 0–20 | sim | onda conhecida |
| `waveProfile.last` | int 0–20 | sim | última fronteira processada (dirige `wave_complete`) |
| `waveProfile.bias` | objeto | sim | pesos futuros — vazio no B1 |
| `waveProfile.pool` | array | sim | pool futura — vazia no B1 |
| `history` | array | sim (últimos 24) | FIFO rígido |
| `last` | objeto\|null | sim | `{t,w,d}` |

`fractureRun` é **run-scoped**: vale `null` fora de uma run e é zerado em morte, vitória,
troca de slot e apagamento de slot.

---

## 4. Os 6 Temas

| id | Nome | Símbolo | Identidade | Tendências futuras |
| --- | --- | --- | --- | --- |
| `collapse` | **COLAPSO** | `⋔` | pressão numérica, instabilidade, hordas, fragmentação | Swarm, Splitter, maior densidade, ondas caóticas |
| `siege` | **CERCO** | `⬢` | resistência, contenção, pressão sustentada | Bulwark, inimigos resistentes, arenas longas, formações defensivas |
| `hunt` | **CAÇADA** | `➤` | perseguição, mobilidade, pressão direta no jogador | Phantom, Orbiter, inimigos rápidos, composições de perseguição |
| `anomaly` | **ANOMALIA** | `✷` | realidade quebrada, distorções, imprevisibilidade | Singular, eventos temporais, anomalias, combinações incomuns |
| `resonance` | **RESSONÂNCIA** | `∿` | Echo, memória, relacionamento, Dissonância | eventos de Echo, Trust, Relationship, Dissonância |
| `scarcity` | **ESCASSEZ** | `◇` | sobrevivência, recursos limitados, risco/recompensa | economia apertada, eventos econômicos, contratos, Credits e Resíduos |

Cada entrada do catálogo (`FRACTURE_THEMES`) carrega:

```js
{ id, nm, sym, col, desc, identidade:[], tags:[], tendencias:[], bias:{}, pool:[] }
```

- `tags` é o **vocabulário compartilhado** de casamento. No futuro, eventos, minibosses e
  arquétipos poderão declarar `fractureTags: ['ANOMALIA','RESSONANCIA']` e o Diretor
  pondera quem casa com o Tema da run.
- `bias` e `pool` existem **vazios de propósito**. Colocar números de balance sem consumidor
  real seria dívida imediata — eles só são preenchidos quando `waveComp`/`pickMiniBoss`
  passarem a consultá-los (Bloco 2+).

### 4.1 Seleção do Tema

```js
fractureBeginRun()                 // startRun → UMA vez, antes do 1º checkpoint
  └─ fractureRun = fractureFresh(fractureMakeSeed())
  └─ fractureEnsureTheme(1)        // só seleciona se theme estiver vazio
       └─ theme = fracturePickTheme(seed)
```

- `fractureMakeSeed()` mistura relógio, `Math.random`, `curSlot` e o tamanho da fila de Ecos
  num inteiro de 32 bits **não-nulo**.
- `fracturePickTheme(seed)` é **função pura** da seed (hash de inteiros + módulo 6).
  Mesma seed ⇒ sempre o mesmo Tema.
- `fractureEnsureTheme()` devolve `false` quando o Tema já existe. É isso que garante
  **"somente uma seleção por run"** mesmo se algo chamar de novo.
- A seleção acontece **antes** do corpo de `startRun`, portanto o checkpoint `'início'`
  (onda 1) **já carrega o Tema** — um Continue na onda 1 devolve exatamente o mesmo Tema.

O que **não** muda o Tema:

- reload / Continue;
- abrir, rolar ou fechar a loja;
- entrar e sair de menus, pause, Codex, ficha;
- entrar e sair do Sandbox;
- trocar de aba ou re-renderizar qualquer UI.

O que **pode** mudar o Tema (caminhos de desenvolvimento, nunca de jogo):
`fractureForceTheme(id, motivo)` e `fractureRerollTheme(motivo)` — ambos exclusivos do
Modo Desenvolvedor (`fx:theme:*`, `fx:reroll`) e ambos contaminam a run (`devTaint`).

---

## 5. Intensidade da Fratura

Faixa conceitual **0 → 100**, exposta como `FRACTURE_INT_MIN` / `FRACTURE_INT_MAX`.

```js
fractureGetIntensity()                 // leitura
fractureAddIntensity(amount, source)   // único ponto de mutação relativo
fractureSetIntensity(value, source)    // absoluto (implementado via Add)
```

- **Clamp 0–100** aplicado em `fractureAddIntensity`, em `fractureRunPack` **e** em
  `fractureRunUnpack`.
- As três funções devolvem o **delta aplicado** (0 quando satura), não o valor pedido.
- Entrada suja (`NaN`, `null`, strings, objetos) vira `0` — nunca `NaN` no estado.
- `opts.quiet` suprime a entrada de histórico quando quem já registra é o `fractureEmit`
  (evita duplicar linha no histórico).
- O **estágio** é sempre rederivado: `fractureStageOf(intensity)`. Mesmo que o campo
  `stage` seja corrompido à mão ou venha sujo do save, a leitura pública continua correta.

### 5.1 Estágios

| Intensidade | Estágio | Rótulo |
| --- | --- | --- |
| 0–19 | `latente` | LATENTE |
| 20–39 | `instavel` | INSTÁVEL |
| 40–59 | `propagando` | PROPAGANDO |
| 60–79 | `critica` | CRÍTICA |
| 80–100 | `ruptura` | RUPTURA |

### 5.2 Gatilhos ligados no Bloco 1 (mínimos, de propósito)

| Momento | Fonte | Ganho |
| --- | --- | --- |
| Início da run | `fractureBeginRun` | `FRACTURE_INT_START` = **0** |
| Onda superada | `fractureEmit('wave_complete')` | **+2** por fronteira |

Uma run completa de 20 ondas fecha em **38/100** só com ondas — espaço deliberado para os
fatores que ainda vão entrar (minibosses, eventos importantes, decisões, anomalias).

### 5.3 Fronteira de onda: por que `wave_complete` é derivado

O jogo não tem uma função "onda terminou" — a limpeza de fim de onda acontece inline dentro
do `loop()`. Em vez de costurar o Diretor no loop (exatamente o espalhamento que a PR 13
proíbe), o Diretor usa a **mesma política de "fronteira de onda"** que o save já usa:

> chegar à onda `n` significa que a onda `n-1` foi superada.

`fractureOnWaveStart(n)` é o **único** hook do Diretor nas ondas (instalado sobre
`spawnWave`). Ele:

1. se `smRestoring` está ligado (retomada de checkpoint), **só sincroniza** `waveProfile`
   e não emite nada — a onda retomada já estava consolidada no checkpoint;
2. caso contrário, emite `wave_complete` para `waveProfile.last` **se** `n > last`
   (idempotente: repetir a mesma onda ou voltar de onda não cobra de novo);
3. emite `wave_start` para `n`.

Um salto de onda (DEV `goToWave`, Sandbox `sandboxJumpTo`) conta **uma** fronteira.

---

## 6. Event bus — `fractureEmit(type, payload)`

Porta **única** de entrada. Recusa qualquer tipo fora do contrato, nunca lança, e devolve
o que aconteceu:

```js
{ ev, ok, delta, before, after, reason }
```

Contrato (`FRACTURE_EVENT_GRID`):

| Evento | Ganho padrão | Histórico | Liga no B1? |
| --- | --- | --- | --- |
| `run_start` | 0 | sim | ✅ |
| `wave_start` | 0 | não | ✅ |
| `wave_complete` | +2 | sim | ✅ |
| `enemy_spawn` | 0 | não | ⏳ |
| `enemy_killed` | 0 | não | ⏳ |
| `miniboss_spawn` | 0 | sim | ⏳ |
| `miniboss_killed` | +4 | sim | ⏳ |
| `event_triggered` | 0 | sim | ⏳ |
| `echo_dissonance` | 0 | sim | ⏳ |
| `faction_reaction` | 0 | sim | ⏳ |
| `shop_open` | 0 | não | ⏳ |
| `run_end` | 0 | sim | ✅ |

Flags do contrato: `i` (ganho de Intensidade), `hist` (entra no histórico),
`wave` (atualiza `waveProfile.wave`), `track` (também marca a fronteira).

Comportamentos garantidos por teste:

- tipo desconhecido ⇒ `{ok:false, reason:'evento_desconhecido'}` e **nenhuma** mutação;
- sem run ativa ⇒ `{ok:false, reason:'sem_run_ativa'}`;
- `payload` pode sobrescrever o ganho (`{intensity: n}`), mas continua clampado;
- `payload` sujo (`{wave:'abc'}`, `{intensity:'lixo'}`, arrays, `null`) não quebra nada;
- campos estranhos do payload **não** entram no estado (anti-poluição);
- `fractureRun.last` é atualizado em todo evento aceito.

### 6.1 Histórico

`fractureRun.history` guarda os últimos acontecimentos relevantes no formato compacto
`{t, w, d, s}` (tipo, onda, delta, fonte). Teto rígido `FRACTURE_HIST_MAX = 24` com FIFO —
`fractureHistPush` descarta o mais antigo quando enche, então sessões longas não crescem
sem limite. Strings são truncadas (24 chars), onda é clampada em `0–MAX_WAVE` e delta em
`±100`.

---

## 7. Save / Continue

### 7.1 Onde o estado é persistido

O checkpoint da run ganha **um campo novo**, ao lado do `frac` da PR 12:

```js
cp.fracture = fractureRunPack()   // ou null quando não há run ativa
```

O campo é injetado por um wrapper de `smBuildCheckpoint` instalado em `fractureKitBoot()` —
o corpo da função original **não foi editado**.

`SM_VERSION` continua **3**. Não houve necessidade de migração: ausência de `cp.fracture`
é tratada como "save de versão anterior" e cai no fallback seguro.

### 7.2 `fractureRunPack()`

Devolve `null` sem run ativa (checkpoint antigo não ganha lixo) e um objeto sanitizado com
run ativa: `v`, `theme` (só se válido), `seed`, `intensity` clampada, `wave`
(`wave`/`last`/`bias`/`pool`), `hist` (últimos 24) e `last`.

### 7.3 `fractureRunUnpack(cp)`

Trata `cp.fracture` como **input não confiável**, no mesmo espírito de `fracRunUnpack`:

| Entrada | Resultado |
| --- | --- |
| ausente / `null` (save antigo) | estado fresco + **Tema novo** derivado de seed nova |
| `theme` inválido | Tema **re-derivado da seed persistida** (reproduzível) |
| `intensity` suja | clampada em 0–100 |
| `seed` suja | nova seed |
| `hist` não-array / lixo | histórico vazio ou filtrado, sempre ≤ 24 |
| `wave.bias` com valores não-numéricos | entradas descartadas; numéricos clampados em 0–10 |
| `wave.pool` com não-strings | filtrado, strings truncadas, máx. 12 |
| objeto inteiro de lixo (`{}`, `[]`, `'lixo'`) | run continua jogável |

O unpack é chamado **dentro do wrapper de `resumeRun`, antes** do corpo original — ou seja,
na mesma janela em que a produção faz `fracRunUnpack(cp)`: antes de `spawnWave(wave)` da
retomada. O Tema e a Intensidade valem desde o primeiro frame da onda retomada, e a onda
retomada **não** é cobrada de novo (guarda `smRestoring`).

### 7.4 Garantias

- **Continue restaura exatamente o mesmo Tema** (inclusive na onda 1);
- **Continue restaura a Intensidade** e o estágio derivado;
- saves antigos sem o campo funcionam;
- `cp.fracture` malformado não quebra o jogo;
- **morte** (`onPlayerDeath`) e **vitória** (`onVictory`/`showVictory`) limpam o estado
  run-scoped;
- **trocar de slot** (`activateSlot`) e **apagar slot** (`smClearSlotSave`) descartam o
  contexto em memória — o checkpoint do slot é a única fonte;
- Save Slots continuam isolados: o Diretor de S1 nunca vaza para S2/S3.

---

## 8. Sandbox (R5)

O laboratório tem **contexto próprio** do Diretor, seguindo o padrão de
`fracSandboxContextStart`:

```js
fractureSandboxContextStart()  // sandboxStart / sandboxRestart
fractureSandboxTearDown()      // sandboxExit / sandboxEndToSetup / sandboxCloseSetup
```

`fractureSandboxContextStart()` cria um `fractureRun` **novo** (seed própria, Tema próprio,
Intensidade 0) e só age quando `sandboxRun` é verdadeiro.

Garantias absolutas, cobertas por teste:

- o Sandbox **não altera** o Tema de Save 1/2/3;
- o Sandbox **não altera** a Intensidade persistida;
- o Sandbox **não altera** o histórico persistido;
- o Sandbox **não grava** no `activeRun` real — `captureCheckpoint` já recusa em
  laboratório (`sandboxRun || sandboxMode`), então nem existe caminho de escrita;
- após a sessão, `echoSave.v3` sai **byte a byte idêntico**, com S1/S2/S3 e `curSlot`
  intactos;
- `sandboxRestart` zera a Intensidade do laboratório; `sandboxEndToSetup` e
  `sandboxCloseSetup` descartam o Diretor do laboratório.

---

## 9. Dev Mode

`Ctrl+Shift+D` liga o Modo Desenvolvedor. O Diretor adiciona:

- **Seção no painel DEV** (`fractureDevSection`) — Tema, seed, Intensidade/estágio,
  identidade, tags, ondas, pesos, pools, último evento e histórico. O re-render não duplica
  a seção.
- **Comandos `fx:*`** via `fractureDevCommand`, roteados pelo wrapper de `devCommand`:

| Comando | Efeito |
| --- | --- |
| `fx:theme:<id>` | força o Tema (DEV) |
| `fx:reroll` | nova seed + novo Tema |
| `fx:int:+N` / `fx:int:-N` | soma N à Intensidade |
| `fx:int:N` | define a Intensidade |
| `fx:emit:<tipo>` | emite um evento do contrato |
| `fx:insp` | despeja o inspetor no log |

Todo comando exige `DEV_MODE` e contamina a run (`devTaint`), como o resto do painel.

O **Fracture Director Inspector completo** (composição prevista da próxima onda, pools
ativos por Tema, histórico navegável) fica para um bloco posterior — no B1 o inspetor é
textual e já mostra tudo que existe de estado.

---

## 10. Integração futura

Esta seção nasceu no Bloco 1 como contrato para o que ainda não existia. **§10.1 (waves) já
foi implementada no Bloco 2** e §10.3 ganhou o metadado de tags; o restante segue previsto e
não está ativo. Mantida aqui para que os próximos blocos tenham o contrato, não uma página em
branco.

### 10.1 Waves — ~~futuro~~ **IMPLEMENTADO NO BLOCO 2**

Ver **§13**. `waveComp(n)` continua sendo a **única** fonte de composição, e o pipeline
previsto aqui foi implementado exatamente como desenhado:

```js
waveComp(n) = waveCompFit(fractureShapeWave(waveCompBase(n), n), ENEMY_BUDGET)
```

`waveProfile.bias` e `waveProfile.pool` deixaram de ser contrato morto: agora alimentam
`fractureShapeWave` de verdade (com sanitização dura — ver §13.8).

### 10.2 Eventos

Os eventos existentes (`RUN_EVENTS`, `RUN_CHAIN_EVENTS`, legados `EV_KINDS`,
`FACTION_RUN_EVENTS`, `FRAC_CONTACT_EVENTS` — 61 no pool, 67 registrados) **não precisam
mudar**. O casamento é aditivo:

```js
{ id:'x_...', family:'anomalias', weight:46, fractureTags:['ANOMALIA','RESSONANCIA'], ... }
```

`scoreEvent(d, ctx)` ganharia um termo do tipo:

```js
if (d.fractureTags && tema && d.fractureTags.indexOf(temaTag) >= 0) w *= FRACTURE_TAG_BOOST;
```

Evento **sem** `fractureTags` mantém o peso de hoje — eventos antigos não quebram.
`event_triggered` já existe no contrato do bus para o Diretor acompanhar o que a run viu.

### 10.3 Minibosses — metadado pronto, ponderação ainda **não** ligada

O **Bloco 2** adicionou `tags` aos 8 minibosses, usando o **mesmo vocabulário** dos
arquétipos (§13.2):

| miniboss | tags |
| --- | --- |
| herald | PRESSAO, INVOCADOR |
| furnace | PRESSAO, DISTORCAO |
| sentinel | DEFESA, CONTENCAO, RESISTENTE |
| brood | ENXAME, INVOCADOR, FRAGMENTACAO |
| duelist | CACADOR, MOVEL, EVASIVO |
| colossus | PESADO, RESISTENTE, CONTENCAO |
| oracle | ANOMALIA, DISTORCAO, DISTANCIA |
| leech | SUSTENTACAO, DISTANCIA, ANOMALIA |

**`pickMiniBoss(n)` não foi alterado** — continua filtrando por HP e sorteando uniforme.
As tags são metadado para o hook futuro (ponderar pelo Tema antes do sorteio).
`miniboss_spawn` / `miniboss_killed` seguem no contrato do bus.

### 10.4 Facções e Echo

- Facções (PR 12): apenas **influência secundária** — `faction_reaction` existe no contrato
  para o Diretor registrar a reação. Facções **não** determinam o Tema.
- Echo (PR 8/10): `echo_dissonance` existe no contrato. RESSONÂNCIA pode **reagir** a
  Trust/Relationship/Dissonância sem acoplar os sistemas: o Diretor lê, nunca escreve.

---

## 11. Limites desta PR (PR 13)

**Implementado no Bloco 1:** catálogo de 6 Temas, seleção única determinística por seed,
Intensidade 0–100 com API central e clamp, event bus com contrato de 12 eventos, histórico
limitado, checkpoint/Continue sanitizado, limpeza em morte/vitória, isolamento de slots,
contexto próprio no Sandbox, seção e comandos DEV, suíte de testes e documentação.

**Implementado no Bloco 2** (ver **§13**): tags nos 11 arquétipos e nos 8 minibosses,
correção do teto de `ENEMY_BUDGET`, `waveCompBase`/`waveCompFit`/`fractureShapeWave`,
perfis `waveBias` nos 6 Temas, Intensidade/Stage como modulação, `waveProfile.bias`/`pool`
integrados e sanitizados, inspetor DEV expandido com BASE × FINAL, seção do Diretor no
Sandbox, `fractureSimulate` e 77 verificações novas.

**Explicitamente FORA desta PR:**

- chefe adaptativo ao estilo do jogador (**PR 15**);
- guerra entre facções;
- mapa de facções;
- finais novos;
- nova árvore de progressão;
- dezenas de inimigos novos;
- sistema de chefe adaptativo completo;
- rework visual de UI (a UI de Tema/Intensidade fica para o **B4**);
- `fractureTags` em eventos e ponderação de `pickMiniBoss` pelo Tema (**B3** — o metadado
  de tags já está pronto, o consumo não);
- qualquer alteração de HP/dano/velocidade de inimigo derivada do Tema (**B3/B4**);
- identidade real de RESSONÂNCIA e ESCASSEZ (**B3/B4** — no B2 elas são sutis de propósito).

---

## 12. Testes

Suíte dedicada: **`tests/fracture-director.test.js`**, integrada ao `npm test`.

Blocos cobertos:

| Bloco | Assunto |
| --- | --- |
| 0 | integridade: sintaxe, ausência de mutação espalhada, `cp.fracture`, sem duplicação, `npm test` |
| 1 | catálogo (6 temas, ids únicos, identidade, tags, estágios, sem balance prematuro) |
| 2 | seleção (validade, pureza da seed, uma por run, loja/menus não trocam, nova run pode ter novo Tema) |
| 3 | Intensidade (clamp 0–100, set/add, estágio derivado, +2/onda, fronteira idempotente, sem efeito de combate) |
| 4 | event bus (contrato, alteração só quando esperado, recusas, payload sujo, perfil de onda) |
| 5 | histórico (teto FIFO, formato sanitizado, entrada do briefing) |
| 6 | checkpoint/Continue (`cp.fracture`, Tema, Intensidade, save antigo, malformado, `SM_VERSION`) |
| 7 | fim de run (morte, vitória, `showVictory`, aborto) |
| 8 | Save Slots (isolamento, seed independente, apagar slot) |
| 9 | Sandbox (contexto próprio, **byte a byte**, restart/build/preparo, sem checkpoint) |
| 10 | Dev Mode (inspetor, `fx:*`, seção sem duplicar) |
| 11 | arquitetura e não-regressão (snapshot defensivo, sistemas existentes, 18 suítes no `npm test`, docs) |
| **12** | **B2.1** teto de entidades: o bug provado, 0 estouros em 1–19, proporção, pisos, budgets degenerados, onda 20 fora |
| **13** | **B2.2** pipeline na fonte, `waveCompBase` pura, identidade sem Diretor / sem perfil / Intensidade 0 |
| **14** | **B2.3** tags dos 11 arquétipos e 8 minibosses, vocabulário de 15, `enemyTags` vs. prototype pollution, `updateEnemy`/`scoreEvent` intactos |
| **15** | **B2.4/B2.5** perfis dos 6 Temas medidos, sutileza de RESSONÂNCIA/ESCASSEZ, volume de ESCASSEZ, nenhum hard replacement |
| **16** | **B2.6** monotonia da Intensidade, budget em 0–100, nenhum desbloqueio antecipado, wave 1, sem monocultura |
| **17** | **B2.7** os 5 stages como modulação, stage reprodutível e monotônico, sem progressão paralela |
| **18** | **B2.8** thresholds medidos na base, `elite`/`eliteChance`/`makeElite` preservados |
| **19** | **B2.9** teto de participação, mínimo de arquétipos, jitter determinístico, nenhum `Math.random` |
| **20** | **B2.10** dois boots, Continue fiel, loja/menu sem reroll, round-trip de `waveProfile`, seed própria no Sandbox |
| **21** | **B2.11** `bias`/`pool` influenciam de verdade + sanitização dura (NaN, Infinity, string, pollution, duplicata, teto) |
| **22** | **B2.15–B2.17** isolamento de facções/Echo, comandos DEV e taint, inspetor, Sandbox byte a byte |
| **23** | **B2.19** simulação 6×19×120 com 0 estouros/violações/monoculturas, curva dentro de ±8 %, participação dos favorecidos |
| **24** | regressões do B2: combate, `pickMiniBoss`, pool de eventos, `SM_VERSION`, escrita em `waveProfile` |

Rodar:

```bash
npm test                        # tudo
node tests/fracture-director.test.js   # só a PR 13
```

---

## 13. BLOCO 2 — Temas + composição de waves

O Bloco 1 montou o controlador. O Bloco 2 faz o Tema **importar**: duas runs com Temas
diferentes, mesmo operador/arma/dificuldade/onda, agora têm composição mecânica
perceptivelmente distinta — sem destruir a curva de dificuldade e sem substituir o sistema
de waves por geração caótica. **O sistema remodela a composição existente; ele não a
reinventa.**

### 13.1 Pipeline obrigatório

```
waveCompBase(n)          intenção original do jogo (fórmulas de sempre, puras)
      ↓
fractureShapeWave(base, n, ctx)   Tema dá a DIREÇÃO; Intensidade/Stage dão o QUANTO
      ↓
waveCompFit(shaped, ENEMY_BUDGET) teto de entidades (método do maior resto)
      ↓
waveComp(n)              composição final — única fonte consultada por spawnWave
```

Cada etapa é **pura**. `waveComp` é chamado várias vezes por onda (spawn, banner
`peekWave`, testes), então nada aqui pode depender de relógio, de `Math.random` ou de
estado mutável além de `fractureRun`.

**Identidade garantida** — `waveComp` devolve exatamente `waveCompFit(base)` quando:

- não há Diretor (`fractureRun === null`);
- o Tema não tem `waveBias`;
- a Intensidade é `0` (peso do Tema = 0).

### 13.2 Tags — o casamento sem tabela hardcoded

`ENEMY_TAG_DEFS` define **15 tags** com descrição. Elas são aplicadas aos 11 arquétipos de
`EDEFS` e aos 8 minibosses:

| arquétipo | tags |
| --- | --- |
| chaser | CACADOR, PRESSAO |
| shooter | DISTANCIA, SUSTENTACAO |
| tank | PESADO, RESISTENTE, CONTENCAO |
| spawner | INVOCADOR, PRESSAO |
| anomaly | ANOMALIA, DISTORCAO |
| swarm | ENXAME, PRESSAO, MOVEL |
| orbiter | MOVEL, CACADOR, DISTANCIA |
| bulwark | DEFESA, CONTENCAO, PESADO, RESISTENTE |
| splitter | FRAGMENTACAO, PRESSAO |
| phantom | CACADOR, MOVEL, EVASIVO |
| singular | ANOMALIA, DISTORCAO, PESADO |

**São só metadado.** `updateEnemy` continua decidindo por `e.type`; não existe nenhum
`switch (Tema)` escolhendo inimigo. `enemyTags(type)` usa `hasOwnProperty` e devolve `[]`
para `elite`, para tipos inexistentes e para `'__proto__'`/`'constructor'`/`'toString'`.

O vocabulário é **compartilhado** com `FRACTURE_THEMES[].tags` (ENXAME, FRAGMENTACAO,
CONTENCAO, SUSTENTACAO, PRESSAO, ANOMALIA, DISTORCAO já existiam no B1). É isso que permite
casar Tema e arquétipo **sem** uma tabela `Tema → inimigo` espalhada pelo código.

### 13.3 Perfil de cada Tema — `theme.waveBias`

```js
waveBias:{ force, density, tags:{TAG:peso}, arch:{arquétipo:ajuste}, capShare, minKinds }
```

O viés de um arquétipo é a **soma** dos pesos das suas tags mais o ajuste fino de `arch`,
clampado em `[-0.75, +0.90]` (`FRACTURE_BIAS_DOWN` / `FRACTURE_BIAS_UP`). Nunca há *hard
replacement*: só multiplicadores sobre a base.

| Tema | force | density | capShare | minKinds | favorece | reduz |
| --- | --- | --- | --- | --- | --- | --- |
| COLAPSO | 1.00 | 1.12 | .42 | 5 | ENXAME .55, FRAGMENTACAO .50, INVOCADOR .40, PRESSAO .35 | tank −.45, bulwark −.40 |
| CERCO | 1.00 | 1.05 | .34 | 5 | DEFESA .55, CONTENCAO .50, RESISTENTE .45, PESADO .30, SUSTENTACAO .30, DISTANCIA .20 | swarm −.50, phantom −.45, chaser −.20 |
| CAÇADA | 1.00 | 1.05 | .34 | 5 | CACADOR .60, MOVEL .50, EVASIVO .40, PRESSAO .20, DISTANCIA .15 | tank −.50, bulwark −.45, spawner −.20 |
| ANOMALIA | 1.00 | 1.00 | .36 | 4 | ANOMALIA .65, DISTORCAO .55, FRAGMENTACAO .40, EVASIVO .25, singular +.35 | bulwark −.20, shooter −.15 |
| RESSONÂNCIA | **0.50** | 1.00 | .32 | 5 | ANOMALIA .20, DISTORCAO .18, DISTANCIA .15, EVASIVO .12 | — |
| ESCASSEZ | **0.55** | 0.94 | .32 | 5 | DISTANCIA .25, INVOCADOR .20, PESADO .18, RESISTENTE .15 | ENXAME −.25, FRAGMENTACAO −.15 |

**RESSONÂNCIA e ESCASSEZ são deliberadamente sutis aqui.** A identidade real delas vem nos
Blocos 3/4 (eventos, Echo, Dissonância, economia) — não de buff artificial e não de redução
de HP/dano, que este bloco não faz. ESCASSEZ desloca o mix para alvos de maior valor sem
encolher a onda: medido, ela mantém **≥ 97 %** do volume da base corrigida.

Viés efetivo por arquétipo (Intensidade 100), medido com `fractureArchBias`:

```
arquétipo   collapse  siege   hunt  anomaly  reson  scarc
chaser        +0.35  -0.20  +0.80    0.00   0.00   0.00
shooter        0.00  +0.50  +0.15   -0.15  +0.15  +0.25
tank          -0.45  +0.90  -0.50    0.00   0.00  +0.33
spawner       +0.75  +0.10   0.00    0.00   0.00  +0.20
anomaly        0.00   0.00   0.00   +0.90  +0.38   0.00
swarm         +0.90  -0.50  +0.70    0.00   0.00  -0.25
orbiter       +0.15  +0.20  +0.90    0.00  +0.15  +0.25
bulwark       -0.40  +0.90  -0.45   -0.20   0.00  +0.33
splitter      +0.85   0.00  +0.20   +0.40   0.00  -0.15
phantom       +0.15  -0.45  +0.90   +0.25  +0.12   0.00
singular      -0.15  +0.30   0.00   +0.90  +0.38  +0.18
```

### 13.4 O algoritmo de `fractureShapeWave`, passo a passo

1. **Escala + arredondamento estocástico determinístico.** Para cada arquétipo com
   `base[k] > 0`: `raw = base[k] * (1 + w * force * bias)`. A parte inteira entra direta; a
   fração vira `+1` se `rnd() < fração`, onde `rnd` vem de `fractureWaveRng(seed, wave)`.
   Isso faz duas ondas vizinhas não ficarem clones, mantendo o reload reproduzível.
2. **Pool da run** (`waveProfile.pool`): `+1` nos arquétipos pedidos — sempre respeitando o
   threshold (um arquétipo com `base[k] === 0` nunca entra).
3. **Densidade.** O total é renormalizado para `round(baseArchTot * (1 + (density−1) * w * force))`
   pelo maior resto. **É isto que separa MIX de VOLUME**: sem esse passo a curva de
   dificuldade derivaria da soma dos vieses (media −16 % de entidades). Com ele, o Tema
   escolhe a cara da onda e `density` escolhe o tamanho.
4. **Teto de participação.** `cap = max(2, floor(total * capShare))`; o excedente é
   redistribuído aos menores. Se `cap * nºDeArquétipos < total` o teto é **ignorado** —
   diversidade nunca pode custar entidade. Se ainda sobrar excedente, ele volta ao maior
   arquétipo: **o shaping nunca perde entidade** (quem impõe o teto real é `waveCompFit`).
5. **Mínimo de arquétipos distintos** (`minKinds`), só entre os desbloqueados: tira 1 do
   maior (sem zerar o doador) e dá ao ausente.
6. **`elite` é copiado da base.** O Diretor não mexe em elites neste bloco.

### 13.5 Intensidade e Stage — o QUANTO, nunca o QUÊ

```js
peso = clamp( (intensidade/100) * FRACTURE_STAGE_MUL[stage] , 0, 1 )
FRACTURE_STAGE_MUL = { latente:.80, instavel:.90, propagando:1, critica:1.05, ruptura:1.10 }
```

O *quê* é decidido pelo Tema; a Intensidade só dosa **quanto** dele aparece. Os 5 stages do
Bloco 1 são usados como **modulação** — não existe segunda barra de progressão, e o stage
continua sendo função pura da Intensidade.

Distância total da base corrigida (soma de `|final − base|` por arquétipo; 30 seeds ×
ondas 5/10/15/19), medida com `fractureSimulate`/`fractureShapeWave`:

| Tema | int 0 | int 25 | int 50 | int 75 | int 100 |
| --- | --- | --- | --- | --- | --- |
| COLAPSO | **0** | 210 | 692 | 1008 | **1150** |
| CERCO | **0** | 466 | 818 | 1138 | **1500** |
| CAÇADA | **0** | 276 | 682 | 1112 | **1316** |
| ANOMALIA | **0** | 252 | 440 | 668 | **798** |
| RESSONÂNCIA | **0** | 116 | 198 | 288 | **344** |
| ESCASSEZ | **0** | 216 | 330 | 416 | **440** |

Estritamente crescente nos 6 Temas, e `int 0` é **exatamente** a base (delta 0,0 %).
Note a hierarquia: CERCO/CAÇADA/COLAPSO se afastam muito; RESSONÂNCIA e ESCASSEZ ficam
entre 3× e 4× mais perto da base — é a sutileza exigida, medida e não declarada.

### 13.6 O teto de entidades (correção do `ENEMY_BUDGET`)

`ENEMY_BUDGET = 46` era aplicado a apenas **9 dos 12** campos: `splitter`, `spawner` e
`elite` passavam intactos. A base da onda 19 soma **69** entidades; o corte antigo fechava em
**48** — acima do teto — e ainda *sub*-preenchia em 12/13/14/16 (43/44/43).

`waveCompFit` agora corta **todos** os campos pelo método do maior resto (Hare): inteiros
`≥ 0`, total **exatamente** igual ao budget, proporção preservada ao máximo, desempate por
resto fracionário e depois pela ordem estável de `WAVE_KEYS`.

`WAVE_PROTECTED_MIN = { chaser:2, swarm:2 }` são **mínimos, não substitutos**: quem ficar
abaixo do piso sobe, e a diferença sai de quem tem mais — sem estourar o teto, sem zerar o
doador e sem tocar em outro protegido.

| onda | base | antigo | corrigido |
| --- | --- | --- | --- |
| 1–11 | ≤ 43 | igual à base | **igual à base** |
| 12 | 50 | 43 | **46** |
| 13 | 56 | 43 | **46** |
| 14 | 58 | 44 | **46** |
| 15 | 61 | 46 | **46** |
| 16 | 62 | 43 | **46** |
| 17–18 | 66 | 46 | **46** |
| 19 | 69 | **48 ⚠** | **46** |

**Entidades dinâmicas.** O teto conta o que **nasce na onda**. Filhotes de `spawner` e
fragmentos de `splitter` aparecem depois, durante o combate, e **não** entram na conta —
isso está escrito no código, junto de `waveCompFit`. A onda 20 (O PARADOXO) é despachada por
caminho próprio em `spawnWave` e fica **fora** do reshape.

### 13.7 Thresholds e diversidade — os safeguards

- **Nenhum desbloqueio antecipado.** Só arquétipos com `base[k] > 0` são escalados.
  Thresholds medidos na base real: chaser/swarm 1, orbiter 2, shooter 3, bulwark 4,
  tank/anomaly/splitter 6, **spawner 8**, **phantom 8**, singular 13. O Tema altera
  só a **frequência** depois do desbloqueio — Singular continua impossível na wave 1 com
  qualquer Tema e qualquer Intensidade.
  (`elite` aparece em `waveComp` a partir da wave 7; `eliteChance(n)` já é não-nula na 6,
  porque `spawnWave` elitiza incrementalmente por cima da composição. Os dois caminhos
  continuam intactos — ver §13.9.)
- **Sem monocultura.** Nenhum arquétipo passa de 60 % da onda (testado em 6 Temas × 4 ondas
  × 6 Intensidades × 40 seeds).
- **Sem extinção.** Em 200 seeds por Tema, todos os 11 arquétipos continuam aparecendo:
  favorecer nunca vira "só existe isso".
- **Determinismo.** `fractureWaveRng(seed, wave)`; nenhum `Math.random` no caminho. Mesma
  `(seed, Tema, Intensidade, onda)` ⇒ mesma composição, em boots separados.
- **Continue fiel.** seed, Tema e Intensidade vêm do checkpoint; loja, menus e re-render não
  rerrolam. (`closeShop()` avança a onda — comportamento real do jogo — e a composição muda
  porque a Intensidade mudou, de forma determinística.)

### 13.8 `waveProfile.bias` / `waveProfile.pool`

Deixaram de ser contrato morto. **O formato mudou** (documentado aqui e nos testes):

| | B1 | B2 |
| --- | --- | --- |
| `bias` | `{}` vazio, clamp `[0,10]` se preenchido | multiplicador por arquétipo, clamp **±0.60**, **negativos permitidos** |
| `pool` | `[]` vazio | até **6** arquétipos, `+1` garantido na onda |

Sanitização dura em `fractureCleanBias` / `fractureCleanPool` (entrada de save é **input não
confiável**):

- só arquétipos que existem em `WAVE_ARCHETYPES`;
- só `typeof === 'number'` finito (`'3'`, `NaN`, `Infinity`, `null` são rejeitados);
- `hasOwnProperty` — nenhuma chave herdada do protótipo entra;
- pool sem duplicata, com teto.

Escrita só pela API central: `fractureSetWaveBias`, `fractureSetWavePool`,
`fractureClearWaveProfile`.

### 13.9 O que o Tema **não** faz

- **não** altera HP, dano ou velocidade de inimigo (`diffHp`/`diffDmg`/`diffSpd` não
  conhecem o Diretor);
- **não** aumenta `eliteChance` nem chama `makeElite`;
- **não** muda `pickMiniBoss`;
- **não** aplica `fractureTags` a eventos nem toca em `scoreEvent`;
- **não** é determinado por facções, Echo, Personality, Relationship ou Dissonância;
- **não** é escolhido pelo jogador.

### 13.10 Dev Mode

O inspetor (`fx:insp`) passou a mostrar, além do que o B1 já mostrava:

- peso do Tema em % (Intensidade × multiplicador do estágio);
- `force`, `density`, teto de participação e mínimo de tipos do perfil;
- **FAVORECIDOS** e **REDUZIDOS** com o viés numérico de cada um;
- **COMPOSIÇÃO BASE × FINAL** da onda atual e de uma onda de contraste, com total, budget
  usado, sobra e nº de tipos.

Comandos novos (os do B1 continuam valendo e não foram duplicados):

| comando | efeito | tainta? |
| --- | --- | --- |
| `fx:comp` / `fx:comp:<n>` | BASE × FINAL da onda | **não** (leitura) |
| `fx:wave:<n>` | no Sandbox salta de verdade; fora dele é prévia | sim (no Sandbox) |
| `fx:bias:<arch>:<v>` / `fx:bias:off` | viés da run | sim |
| `fx:pool:<a/b>` / `fx:pool:off` | pool da run | sim |
| `fx:sim` / `fx:sim:<int>` | simulação de balanceamento no log | não |

### 13.11 Sandbox

Seção **PR 13 — DIRETOR DE FRATURA** dentro do laboratório existente: os 6 Temas,
Intensidade 0/25/50/75/100, **seed própria**, re-sorteio, salto de onda e leitura
BASE × FINAL com o viés aplicado.

O isolamento é **herdado** do Sandbox (R5): `captureCheckpoint`, `clearActiveRun`,
`fracDiscSave` e `saveProg` já retornam cedo quando `sandboxRun` é true. O teste
byte-for-byte de saves continua passando com a seção ativa.

### 13.12 Simulação de balanceamento — `fractureSimulate(opts)`

Função **pura** (não toca em `fractureRun` nem no estado do jogo). Roda
`temas × ondas × seeds` e devolve, por Tema: média de entidades, média da base corrigida,
máximo, acertos/estouros de budget, distribuição por arquétipo, participação percentual,
média de arquétipos distintos, monoculturas e violações de threshold.

Resultado com **6 Temas × ondas 1–19 × 120 seeds, Intensidade 100**:

| Tema | ent. média | base corr. | delta | máx | estouros | tipos/onda | monoculturas | violações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COLAPSO | 34.21 | 32.84 | **+3.8 %** | 46 | 0 | 8.39 | 0 | 0 |
| CERCO | 33.53 | 32.84 | +1.6 % | 46 | 0 | 8.43 | 0 | 0 |
| CAÇADA | 33.53 | 32.84 | +1.6 % | 46 | 0 | 8.46 | 0 | 0 |
| ANOMALIA | 32.84 | 32.84 | −0.5 % | 46 | 0 | 8.52 | 0 | 0 |
| RESSONÂNCIA | 32.84 | 32.84 | −0.5 % | 46 | 0 | 8.53 | 0 | 0 |
| ESCASSEZ | 32.47 | 32.84 | **−1.6 %** | 46 | 0 | 8.51 | 0 | 0 |

Participação por arquétipo (%), Intensidade 100, 200 seeds:

| arquétipo | COLAPSO | CERCO | CAÇADA | ANOMALIA | RESSON. | ESCASSEZ |
| --- | --- | --- | --- | --- | --- | --- |
| chaser | 23.9 | 17.4 | **27.6** | 20.7 | 20.5 | 20.9 |
| shooter | 10.4 | **19.2** | 11.2 | 10.9 | 14.4 | 14.9 |
| tank | 2.6 | **9.3** | 2.5 | 5.2 | 5.1 | 6.4 |
| spawner | **4.7** | 3.5 | 2.3 | 3.4 | 3.4 | 3.8 |
| anomaly | 5.5 | 6.7 | 4.9 | **12.1** | 8.5 | 7.0 |
| swarm | **25.7** | 8.8 | 21.0 | 16.3 | 16.3 | 14.3 |
| orbiter | 9.4 | 12.5 | **14.5** | 10.2 | 11.7 | 12.0 |
| bulwark | 3.4 | **10.8** | 2.9 | 5.0 | 6.5 | 7.4 |
| splitter | **6.1** | 4.3 | 3.7 | 5.6 | 4.3 | 4.2 |
| phantom | 3.2 | 1.7 | **4.1** | 3.9 | 3.4 | 3.3 |
| singular | 1.0 | 1.4 | 1.1 | **2.3** | 1.5 | 1.4 |

### 13.13 Exemplos reais (seed 20260903, Intensidade 100)

**Onda 5** — base 18/46: `chaser 6, shooter 3, swarm 5, orbiter 3, bulwark 1`

| Tema | total | composição |
| --- | --- | --- |
| COLAPSO | 20 | chaser 7, shooter 3, **swarm 7**, orbiter 2, bulwark 1 |
| CERCO | 19 | chaser 6, **shooter 5**, **swarm 3**, orbiter 4, bulwark 1 |
| CAÇADA | 19 | chaser 6, shooter 2, swarm 6, **orbiter 4**, bulwark 1 |
| ANOMALIA | 18 | chaser 6, shooter 2, swarm 6, orbiter 3, bulwark 1 |
| RESSONÂNCIA | 18 | chaser 5, shooter 3, swarm 5, orbiter 3, bulwark 2 |
| ESCASSEZ | 17 | chaser 5, shooter 3, swarm 4, orbiter 3, **bulwark 2** |

**Onda 10** — base 43/46: `chaser 10, shooter 6, tank 2, spawner 1, anomaly 3, swarm 8, orbiter 5, bulwark 3, splitter 2, phantom 1 · elite 2`

| Tema | total | composição |
| --- | --- | --- |
| COLAPSO | 46 | chaser 11, shooter 5, tank 1, spawner 1, anomaly 3, **swarm 13**, orbiter 4, bulwark 1, **splitter 4**, phantom 1 · elite 2 |
| CERCO | 45 | chaser 8, **shooter 10**, **tank 3**, spawner 1, anomaly 3, **swarm 4**, orbiter 6, **bulwark 5**, splitter 2, phantom 1 · elite 2 |
| CAÇADA | 45 | **chaser 14**, shooter 4, tank 1, spawner 1, anomaly 2, swarm 11, **orbiter 7**, bulwark 1, splitter 1, phantom 1 · elite 2 |
| ANOMALIA | 43 | chaser 9, shooter 5, tank 2, spawner 1, **anomaly 6**, swarm 7, orbiter 5, bulwark 2, splitter 3, phantom 1 · elite 2 |
| RESSONÂNCIA | 43 | chaser 9, shooter 6, tank 2, spawner 1, anomaly 4, swarm 8, orbiter 5, bulwark 3, splitter 2, phantom 1 · elite 2 |
| ESCASSEZ | 42 | chaser 10, shooter 6, tank 2, spawner 1, anomaly 3, swarm 7, orbiter 5, bulwark 3, splitter 2, phantom 1 · elite 2 |

**Onda 15** — base 46/46: `chaser 9, shooter 6, tank 3, spawner 2, anomaly 4, swarm 7, orbiter 5, bulwark 3, splitter 2, phantom 2, singular 1 · elite 2`

| Tema | composição |
| --- | --- |
| COLAPSO | chaser 9, shooter 5, tank 2, spawner 3, anomaly 3, **swarm 10**, orbiter 4, **bulwark 1**, **splitter 3**, phantom 3, singular 1 · elite 2 |
| CERCO | **chaser 6**, **shooter 8**, **tank 6**, spawner 2, anomaly 4, **swarm 3**, orbiter 5, **bulwark 6**, splitter 2, **phantom 1**, singular 1 · elite 2 |
| CAÇADA | **chaser 12**, shooter 5, **tank 1**, spawner 1, anomaly 3, swarm 9, **orbiter 6**, bulwark 1, **splitter 1**, **phantom 4**, singular 1 · elite 2 |
| ANOMALIA | chaser 8, shooter 5, tank 3, spawner 2, **anomaly 7**, swarm 6, orbiter 4, bulwark 2, splitter 3, phantom 2, **singular 2** · elite 2 |
| RESSONÂNCIA | chaser 8, shooter 7, tank 3, spawner 2, anomaly 5, swarm 6, orbiter 5, bulwark 3, splitter 2, phantom 2, singular 1 · elite 2 |
| ESCASSEZ | chaser 9, shooter 6, **tank 4**, spawner 2, anomaly 4, swarm 6, orbiter 5, bulwark 3, splitter 2, phantom 2, singular 1 · elite 2 |

**Onda 19** — base 46/46: `chaser 8, shooter 5, tank 3, spawner 3, anomaly 5, swarm 6, orbiter 4, bulwark 3, splitter 3, phantom 2, singular 1 · elite 3`

| Tema | composição |
| --- | --- |
| COLAPSO | chaser 9, shooter 4, tank 2, **spawner 4**, anomaly 4, **swarm 9**, orbiter 3, **bulwark 1**, **splitter 4**, phantom 2, singular 1 · elite 3 |
| CERCO | **chaser 6**, **shooter 7**, **tank 5**, spawner 3, anomaly 4, **swarm 3**, orbiter 5, **bulwark 4**, splitter 3, **phantom 1**, **singular 2** · elite 3 |
| CAÇADA | **chaser 11**, shooter 4, **tank 1**, spawner 2, anomaly 3, swarm 8, **orbiter 6**, bulwark 1, splitter 3, phantom 3, singular 1 · elite 3 |
| ANOMALIA | chaser 8, shooter 4, tank 3, spawner 3, **anomaly 7**, swarm 5, orbiter 3, bulwark 2, splitter 3, phantom 3, **singular 2** · elite 3 |
| RESSONÂNCIA | chaser 7, shooter 5, tank 3, spawner 3, anomaly 5, swarm 5, orbiter 5, bulwark 3, splitter 3, phantom 2, singular 2 · elite 3 |
| ESCASSEZ | chaser 8, shooter 6, tank 3, spawner 3, anomaly 4, swarm 5, orbiter 4, bulwark 3, splitter 3, phantom 2, singular 2 · elite 3 |

Todas as 24 composições fecham em ≤ 46. Nenhuma introduz arquétipo não desbloqueado.

### 13.14 Testes do Bloco 2

`tests/fracture-director.test.js` foi de **67** para **144** verificações (13 blocos novos,
`[12]` a `[24]`). `npm test` total: **1105** verificações, **0** falhas, **18** suítes.

Dois testes do Bloco 1 foram **atualizados de propósito**, e o motivo está escrito neles:

1. *"waveComp não reage à Intensidade"* → *"nenhum multiplicador de combate referencia o
   Diretor"*. A primeira afirmação era verdadeira no B1 e é **falsa por design** no B2; a
   segunda é a que precisa valer para sempre.
2. O clamp de `waveProfile.bias` mudou de `[0,10]` para `±0.60`, porque o campo passou a
   alimentar o shaping.

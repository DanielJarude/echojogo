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

## 10. Integração futura (ainda **não** ligada)

Nada abaixo está ativo no jogo hoje. Está documentado para que os próximos blocos tenham um
contrato, não uma página em branco.

### 10.1 Waves

`waveComp(n)` continua sendo a **única** fonte de composição. O caminho previsto é:

```js
const base = waveComp(n);
const comp = fractureShapeWave(base, n);   // aplica waveProfile.bias / pool do Tema
```

`waveProfile.bias` (vazio no B1) é o lugar dos multiplicadores por arquétipo; `pool` é o
lugar de uma composição sobrescrita. Enquanto estiverem vazios, `fractureShapeWave` seria
identidade — por isso ainda não existe.

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

### 10.3 Minibosses

Hoje `pickMiniBoss(n)` filtra o pool de 8 por HP e sorteia. O caminho previsto é o mesmo
casamento por tags: cada miniboss declara `fractureTags`, e `pickMiniBoss` passa a ponderar
pelo Tema **antes** do sorteio. `miniboss_spawn` / `miniboss_killed` já estão no contrato
(`miniboss_killed` já vale +4 de Intensidade quando emitido).

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

**Explicitamente FORA desta PR:**

- chefe adaptativo ao estilo do jogador (**PR 15**);
- guerra entre facções;
- mapa de facções;
- finais novos;
- nova árvore de progressão;
- dezenas de inimigos novos;
- sistema de chefe adaptativo completo;
- rework visual de UI (a UI de Tema/Intensidade fica para o **B4**);
- qualquer número de balance definitivo (os `bias`/`pool` do catálogo nascem vazios);
- qualquer efeito de gameplay derivado da Intensidade (neste bloco ela é dado puro).

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

Rodar:

```bash
npm test                        # tudo
node tests/fracture-director.test.js   # só a PR 13
```

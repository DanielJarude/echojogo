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

**Implementado no Bloco 3** (ver **§14**): `fractureTags` consumidos em eventos e na
ponderação de `pickMiniBoss`, identidade real de RESSONÂNCIA e ESCASSEZ, custo de
Intensidade por raridade com tetos anti-farm, 12 run events temáticos, integração do
Eco como leitura.

**Implementado no Bloco 4** (ver **§15**): UI de Tema/Intensidade no HUD, revelação
gradual, 12 encounter signatures, progressão de Stages com camadas, Codex da Fratura,
anúncios e falas de facção.

**Implementado no Bloco 5** (ver **§16**): validação de Save/Continue e do Sandbox,
simulação em escala, recalibração do pacing, correções de performance, correção de
dois bugs reais e 13 verificações novas.

**Explicitamente FORA desta PR:**

- chefe adaptativo ao estilo do jogador (**PR 15**);
- guerra entre facções;
- mapa de facções;
- finais novos;
- nova árvore de progressão;
- dezenas de inimigos novos;
- sistema de chefe adaptativo completo.

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

---

## 14. BLOCO 3 — Eventos, minibosses e identidade temática

O Bloco 1 criou o estado e o barramento. O Bloco 2 ligou o Tema à composição
de onda. O Bloco 3 liga o Tema **ao que acontece entre as ondas**: quais
eventos aparecem, qual mini-chefe chega, o que o Eco diz e o que a economia
faz.

A regra continua sendo a mesma e é a mais importante desta seção:

> O Diretor é um **sistema de influência**. Ele muda pesos e oportunidades.
> Ele nunca decide o resultado, nunca tranca conteúdo e nunca vira roteiro.

Concretamente: `if(theme==='hunt') return X` **não existe** em nenhum caminho
deste bloco. O teste `B3-49` varre a fonte procurando por isso.

---

### 14.1 `fractureTags` — vocabulário compartilhado

Os 67 eventos registrados antes do Bloco 3 (20 legados `lg_*` + 25
`RUN_EVENTS` + 12 de facção + 4 de contato + 6 de cadeia) foram lidos **um a
um** e classificados pelo que acontece neles, não pela família. Depois os 13
novos entraram no mesmo mapa.

Hoje `RUN_EVENT_BY_ID` tem **80 eventos: 0 sem tag e 0 tag órfã** (as 24 tags
do vocabulário são todas usadas). O pool sorteável (`ALL_RUN_EVENTS`) foi de
61 para **73**.

O vocabulário tem **24 tags** em `FRACTURE_EVENT_TAG_DEFS`:

| origem | tags |
|---|---|
| reuso do B2 (mesmo sentido) | `PRESSAO` `CONTENCAO` `DEFESA` `ANOMALIA` `DISTORCAO` `CACADOR` `MOVEL` `FRAGMENTACAO` `EVASIVO` `INVOCADOR` `SUSTENTACAO` |
| próprias de evento | `RECURSO` `ECONOMIA` `ESCASSEZ` `MEMORIA` `ECHO` `RESSONANCIA` `VINCULO` `MORAL` `EXPLORACAO` `FACCAO` `INSTABILIDADE` `RISCO` `SACRIFICIO` |

Reusar as tags do B2 foi deliberado: `CACADOR` significa a mesma coisa num
inimigo e num evento, e manter um vocabulário só evita dois dicionários que
divergem. As 13 novas existem porque "economia", "memória" e "sacrifício" não
descrevem nenhum inimigo.

`fractureEventTags(d)` devolve **cópia**, então mutar o resultado não
contamina o mapa (teste `B3-03`).

---

### 14.2 Como o viés entra no `scoreEvent`

`scoreEvent` ganhou **um termo, o último**:

```
w = d.weight
  → família anterior ×0.30
  → fadiga de família  w /= (1 + .30·fr)
  → saturação          w *= 1/(1 + .07·seen)
  → novidade           seen===0 → ×1.25
  → MORAL_BALANCE.eventBias
  → condições (coins<35, hp<.35, echoCount>0, disRuptured)
  → w *= fractureEventBiasMul(d, ctx)      ← BLOCO 3
  → return Math.max(.01, w)
```

Tudo que existia continua existindo e continua decidindo sozinho quando não há
Diretor. O teste `B3-09` afirma numericamente que
`score === max(.01, base × viés)` — ou seja, o viés é multiplicativo e vem por
último.

Dentro de `fractureEventBiasMul`:

```js
b = Σ (peso da tag no perfil do Tema)     // prof.tags[tag] ou prof.red[tag]
b = b / sqrt(nº de tags do evento)        // normalização
mul = 1 + clamp(pesoDoTema,-1,1) · prof.force · b
mul *= fractureResoBias(d, ctx)           // só em RESSONÂNCIA (14.4)
return clamp(mul, prof.down, prof.up)     // piso > 0: nunca hard lock
```

A normalização por `sqrt(n)` impede que um evento com 3 tags afins leve
vantagem tripla sobre um com 1.

**Limites por Tema** (`FRACTURE_EVENT_BIAS`):

| Tema | favorece | reduz | teto | piso |
|---|---|---|---|---|
| `collapse` | INSTABILIDADE .75 · FRAGMENTACAO .65 · PRESSAO .55 · RISCO .50 · EXPLORACAO .35 · ANOMALIA .30 | — | ×1.55 | ×0.72 |
| `siege` | CONTENCAO .80 · DEFESA .70 · SUSTENTACAO .45 · FACCAO .30 · MORAL .20 | — | ×1.55 | ×0.72 |
| `hunt` | CACADOR .85 · MOVEL .60 · PRESSAO .55 · RISCO .50 · EVASIVO .45 | — | ×1.60 | ×0.70 |
| `anomaly` | ANOMALIA .90 · DISTORCAO .80 · INSTABILIDADE .60 · MEMORIA .25 | — | ×1.65 | ×0.70 |
| `resonance` | ECHO .95 · RESSONANCIA .90 · MEMORIA .70 · VINCULO .55 · SACRIFICIO .25 | RISCO −.20 · PRESSAO −.15 | ×1.70 | ×0.80 |
| `scarcity` | ESCASSEZ .95 · ECONOMIA .85 · RECURSO .65 · MORAL .35 · SACRIFICIO .30 | ANOMALIA · DISTORCAO | ×1.70 | ×0.80 |

O piso é **estritamente positivo** em todos os Temas. Medido em 6 Temas ×
todos os eventos: menor multiplicador **0.70**. Nada é excluído — só fica mais
raro.

Sem `fractureRun`, ou com Intensidade 0, o multiplicador devolve **exatamente
1** para todo evento (testes `B3-04`, `B3-05`).

**Por que Intensidade 100 não vira pool temático:** o peso do Tema entra
multiplicado por `clamp(pesoDoTema,-1,1)`, e o `b` normalizado raramente passa
de ~0.8. Na Intensidade 100, **pelo menos 35% do pool continua com
multiplicador exatamente 1** em qualquer Tema (teste `B3-07`).

---

### 14.3 `event_triggered` — emissão real

`evSelectFinal(d, opts)` é o **ponto único** de "este evento foi escolhido de
verdade". As quatro saídas reais de `pickRunEvent` passam por ele:

1. fila de cadeia (`evQueue`)
2. sorteio ponderado
3. fallback `pickEventKind()`
4. caminho legado

O que **não** emite: `scoreEvent`, `fractureEventBiasMul`, `buildEventContext`,
`getEligibleEvents`, `eventBlockReason`, render, evento bloqueado/rejeitado, e
a simulação do DEV (`pickRunEvent(ctx, rnd, {silent:true})`).

O teste `B3-10` chama todos os caminhos de leitura e conta as emissões antes e
depois: zero.

**Intensidade por evento** — não existe "todo evento = +X". A magnitude vem da
raridade que o sistema antigo já define:

| raridade | Intensidade |
|---|---|
| `common` | +0 |
| `uncommon` | +3 |
| `rare` | +6 |
| `anomalous` | +10 |

Valores recalibrados no **Bloco 5** (ver §16.5): a escala original era bimodal e
deixava a maioria das runs parada em PROPAGANDO.

Cadeias (`noPool`) não cobram — já foram pagas pelo evento que as enfileirou.

**Tetos** (guardados em `fractureRun.b3`, portanto sobrevivem ao reload):

- `FRACTURE_EV_INT_PER_WAVE_MAX = 6` por onda
- `FRACTURE_EV_INT_PER_RUN_MAX = 26` por run

Sem isso, ficar parado numa área com vários beacons viraria farm de
Intensidade.

---

### 14.4 RESSONÂNCIA — o Diretor **lê** o Eco

> **Regra dura:** o Diretor pode LER Trust, Relationship, Dissonância e
> Personality. Ele **nunca escreve** em nenhum deles.

`fractureResoRead()` é a única porta de leitura e devolve objeto neutro quando
não há Eco (run sem Eco continua 100% jogável):

```js
{count, allied, hostile, ruptured, trust, rel, disSt, pressure}
```

Nenhum caminho do bloco chama `echoSetDis`, `changeEchoTrust`, `smFlat` ou
qualquer mutador. O teste `B3-25` tira um snapshot JSON do Eco antes e depois
de varrer todos os eventos e disparar reações — byte a byte igual. O teste
`B3-26` varre o **texto-fonte** do bloco procurando os nomes dos mutadores.

**A identidade vem de duas coisas, nenhuma delas mutação:**

1. **Peso.** `fractureResoBias(d, ctx)` só age quando o Tema é `resonance`:

   | estado do Eco | memória/ressonância/vínculo | distorção/anomalia |
   |---|---|---|
   | estável | **+0.45** | −0.20 |
   | em crise (`ruptured`/`fracturing`/`hostile`) | −0.15 | **+0.45** |

   Medido: com Eco estável `lg_ghost` 1.318 e `lg_mirror` 0.750; com Eco em
   crise `lg_mirror` 1.450 e `lg_ghost` 1.000. O clamp é `[0.75, 1.45]` — mais
   apertado que o viés geral, porque aqui o ajuste é contextual e não pode
   competir com ele.

2. **Fala.** `FRACTURE_RESO_LINES` tem **4 situações** (`signature`,
   `highStage`, `ruptured`, `memory`), 3 frases cada. `fractureResoReact`
   escolhe **uma** por vez, na ordem de prioridade, e entrega por `echoSpeak`
   — que já tem `_echoSpeakCd` próprio e chance anti-spam. Por cima disso há
   um cooldown do Diretor: no máximo **1 reação a cada 3 ondas**.

**O Tema RESSONÂNCIA não causa Dissonância.** `echoSetDis` não aparece no
bloco, e Dissonância influencia apenas **pesos** (via `disSt` lido), nunca é
gerada.

---

### 14.5 ESCASSEZ — identidade por economia

Não é "-30% de tudo". São quatro efeitos pequenos e mensuráveis:

**1. Crédito de evento de Fratura.** `fractureCoinMul(source)` devolve 1 para
qualquer `source` que não seja `'fracture_event'`. Kill, drop, loja e qualquer
outra fonte ficam **intactos**.

```
mul = 1 - (1 - 0.88) · clamp(pesoDoTema, 0, 1)
```

Medido: 100 créditos de evento → **88** na Intensidade 100, **99** na
Intensidade 10. Interpolado pela Intensidade de propósito: no começo da run
quase não se sente.

`fractureCoins(n, source)` aplica o multiplicador e **nunca toca custo**:
`fractureCoins(-50, ...) === -50` (teste `B3-33`).

**2. Resíduos Temporais.** Só pela API da PR12 — `addResidues`. O bloco nunca
escreve em `fractureRun.res` nem em `fracRun.res` (teste `B3-34` varre a fonte).
`fractureScarcityResidues(n, src)` dá `+1` em run de ESCASSEZ e `0` nos outros
Temas: medido 3 → 4 e 3 → 0.

**3. Reroll da loja.** O primeiro reroll da visita sai por **7** em vez de 10,
uma vez por onda, e volta a 10 depois de usado (medido). Preços de oferta,
item e arma não são tocados — não é rework de loja.

**4. Peso de evento econômico.** Já vem das tags: `ESCASSEZ` .95 e
`ECONOMIA` .85.

**Impacto medido** (200 runs × 8 recompensas de 50 créditos):

| Tema | créditos | resíduos |
|---|---|---|
| `scarcity` | **74.600** (−6,75%) | 200 |
| `collapse` | 80.000 (referência) | 0 |

---

### 14.6 Minibosses — peso temático

`pickMiniBoss` era *filtro de HP + sorteio uniforme*. Agora é:

```
filtro de segurança (INTACTO)  →  pool elegível  →  peso temático  →  sorteio determinístico
```

O filtro de HP não foi tocado e continua decidindo sozinho quem pode aparecer.
Pools medidos: **onda ≤5 → 6**, **6–10 → 8**, **≥11 → 7**.

`fractureMiniWeight(m, ctx)` usa as **tags** do miniboss (metadado puro —
nenhum HP, dano, velocidade ou AI foi alterado; teste `B3-15`):

```js
b = Σ prof.tags[tag] + prof.red[tag]
b = b / sqrt(nº de tags)
return clamp(1 + pesoDoTema · b, prof.down, prof.up)
```

Sem `fractureRun` devolve 1 para todos (uniforme original).

**Tags dos 8 minibosses:**

| miniboss | HP | tags |
|---|---|---|
| `herald` | 1.00 | PRESSAO · INVOCADOR |
| `furnace` | 1.25 | PRESSAO · DISTORCAO |
| `sentinel` | 1.05 | DEFESA · CONTENCAO · RESISTENTE |
| `brood` | 1.15 | ENXAME · INVOCADOR · FRAGMENTACAO |
| `duelist` | 0.70 | CACADOR · MOVEL · EVASIVO |
| `colossus` | 1.75 | PESADO · RESISTENTE · CONTENCAO |
| `oracle` | 0.90 | ANOMALIA · DISTORCAO · DISTANCIA |
| `leech` | 1.00 | SUSTENTACAO · DISTANCIA · ANOMALIA |

**Pesos na Intensidade 100** (onda 10, pool de 8):

| miniboss | collapse | siege | hunt | anomaly | resonance | scarcity |
|---|---|---|---|---|---|---|
| herald | 1.92 | 1.21 | 1.21 | 1.00 | 1.18 | **1.81** |
| furnace | 1.64 | 1.21 | 1.21 | 1.64 | 1.39 | 1.49 |
| sentinel | 0.62 | **2.20** | 0.83 | 0.83 | 1.00 | 1.00 |
| brood | **2.20** | 1.00 | 1.00 | 1.17 | 1.14 | 1.26 |
| duelist | 1.00 | 0.62 | **2.30** | 1.00 | 1.00 | 0.86 |
| colossus | 0.83 | **2.20** | 0.60 | 1.00 | 0.86 | 1.17 |
| oracle | 1.20 | 1.00 | 1.00 | **2.30** | 1.87 | 1.32 |
| leech | 1.00 | 1.00 | 1.23 | 1.78 | 1.84 | 1.69 |

O piso é **0.596** — nenhum elegível é excluído.

**Continue/reload não rerrola.** A escolha fica em `fractureRun.b3.mini[wave]`
e o `unpack` a revalida contra a lista de ids reais. `spawnMiniBoss(n, forced)`
continua obedecendo o `forced` e grava o id escolhido.

**Emissão.** `fractureOnMiniSpawn(def, n)` e `fractureOnMiniKill(def, n)`
emitem **uma vez por onda**, com flags em `b3.miniSpawn` / `b3.miniPaid`. O
kill paga **+4** (`FRACTURE_EVENT_GRID.miniboss_killed.i`), dentro da faixa
+3..+5 pedida — medido antes de decidir, não chutado.

---

### 14.7 Os 12 eventos novos

Dois por Tema, mais uma cadeia da CAÇADA. Todos com **no mínimo 2 escolhas** e
custo real em pelo menos uma (vida, escudo máximo permanente, créditos,
resíduo, confiança de Eco, dano permanente ou moral). Nenhum dá recompensa de
graça, e todo crédito passa por `fractureCoins(..., 'fracture_event')` para que
ESCASSEZ seja sentida dentro deles.

| Tema | evento | família | o que cobra |
|---|---|---|---|
| COLAPSO | `fx_col_secao` — A SEÇÃO QUE SE MULTIPLICA | ruptura | 16% da vida, ou uma entidade extra na próxima onda |
| COLAPSO | `fx_col_alicerce` — O ALICERCE QUE RESTA | exploracao | escudo máximo permanente, ou 34 créditos |
| CERCO | `fx_cer_rotas` — AS ROTAS QUE FECHAM | ambiente | 40 créditos, ou −12 de confiança de todos os Ecos |
| CERCO | `fx_cer_choke` — O ÚLTIMO CORREDOR | sobreviventes | vida + escudo máximo permanente |
| CAÇADA | `fx_cac_assinatura` — A ASSINATURA | risco | dano permanente, ou enfileira a cadeia |
| CAÇADA | `fx_cac_isca` — A ISCA | moral | 18% da vida, ou −22 de confiança dos Ecos |
| ANOMALIA | `fx_ano_duas` — DUAS VERSÕES INCOMPATÍVEIS | anomalias | 12% da vida, ou um inimigo duplicado |
| ANOMALIA | `fx_ano_testemunha` — A TESTEMUNHA QUE NÃO EXISTE | memoria | −10 de confiança, ou 30 créditos |
| RESSONÂNCIA | `fx_res_memoria` — MEMÓRIA DE FORA | memoria | dissonância acumulada, ou −8 de confiança |
| RESSONÂNCIA | `fx_res_coro` — O CORO DESALINHADO | echo | 10% da vida, ou −20 de confiança |
| ESCASSEZ | `fx_esc_tempo` — O TEMPO DISPUTADO | recursos | nada sobra para vender, ou −14 de escudo máximo |
| ESCASSEZ | `fx_esc_mercado` — O MERCADO QUE NÃO VOLTA | fracao | 60 créditos, ou −18 de confiança e −1 de dano |
| (cadeia) | `fx_cac_assinatura2` — ELE CHEGOU | risco | dano + escudo máximo, ou 35 créditos e −1 de dano |

**Rebalanceamento medido.** A primeira versão nasceu com peso 30–46 e 5 eventos
`rare`. Isso quebrou 4 checks legados de `tests/events.test.js`. A causa raiz
não foi o peso: dois eventos usavam `aff:'violence'`, e o eixo moral real é
`'viol'` — `scoreEvent` devolvia **NaN**, que corrompia o sorteio ponderado
inteiro (`fx_esc_tempo` chegou a 16,8% de todas as seleções).

Depois de corrigir o `aff`, os 12 foram ajustados à **convenção real do pool**
(medida: `common`=42–46, `uncommon`=8–22, `rare`=8–10 e sempre `oncePerRun`).
Como são eventos recorrentes de identidade, todos são `uncommon` com peso
15–18, somando **10,6%** do pool e espalhados em 11 famílias.

| métrica (400 runs, seed 777) | antes dos 12 | com os 12 |
|---|---|---|
| avg `common` | 3,2333 | 2,8630 |
| avg `uncommon` | 0,4773 | 0,6176 |
| avg `rare` | 0,1889 | 0,1444 |
| evento mais frequente | 3,80% | 3,50% |
| família no topo | recursos 21,2% | recursos 20,1% |
| `x_no` | 2,60% | 2,80% |

A escala de raridade continua monotônica e a suíte legada volta a **82/0 sem
nenhuma alteração nos testes legados**.

**Pico temático:** os 12 atingem o maior multiplicador no próprio Tema (12/12).

---

### 14.8 Facções

`factionEmit` aparece só onde a escolha é **semanticamente** ligada a uma
ideologia — nunca por tabela fixa, e nunca atrelada ao Tema:

| escolha | Âncora | Remanescentes | Consórcio | Desviados |
|---|---|---|---|---|
| `route_sealed` (selar rotas de fuga) | +3 | −3 | +1 | −1 |
| `line_held` (segurar o corredor) | +2 | +1 | 0 | −2 |
| `line_sold` (vender a barricada) | −3 | −1 | +3 | +1 |
| `echo_marked` (marcar um Eco como isca) | −1 | −4 | +2 | +3 |
| `signal_cut` (cortar a transmissão) | +3 | −3 | +1 | −1 |
| `record_erased` (apagar o registro) | +2 | +2 | −2 | 0 |
| `time_drained` (drenar o bolsão) | −2 | −1 | +3 | +1 |
| `trail_sold` (vender o próprio rastro) | −2 | −3 | +4 | +1 |

Tema **não** determina afinidade de facção e facção **não** determina o Tema.

---

### 14.9 `shop_open`

`fractureOnShopOpen()` é chamado **uma vez por abertura real** da loja:

- **depois** do early-return do voto de pobreza (loja pulada não abre);
- **não** em `renderShop`, que roda de novo a cada compra e a cada reroll.

`shop_open` tem `delta 0` na grade do B1: medido **0 e 0** em duas aberturas
seguidas. Abrir e fechar loja não pode farmar Intensidade.

---

### 14.10 Estado persistido

`fractureRun.b3` guarda só o que impede exploit ou duplicidade:

```js
{evW, evWG, evRG, mini, miniSpawn, miniPaid, lastEv, resoW, scarUsed}
```

`evW` é a onda, `evWG`/`evRG` os contadores de teto, `mini`/`miniSpawn`/
`miniPaid`/`scarUsed` são mapas `onda → valor`, `lastEv` é o último evento
disparado e `resoW` a onda da última reação de RESSONÂNCIA.

**Sanitização** (`fractureRunPack` / `fractureRunUnpack`):

- mapas validados contra `1..MAX_WAVE`;
- ids de miniboss validados contra `MINIBOSS`;
- `lastEv.id` precisa **existir** em `RUN_EVENT_BY_ID`, e `family`/`rarity`
  saem do **registro**, não do save;
- tags filtradas pelo vocabulário, no máximo 6;
- consultas com `hasOwnProperty` para não resolver `__proto__`/`constructor`.

O teste `B3-44` injeta lixo deliberado (onda 0 e 99, id inexistente,
`__proto__`, texto em campo numérico, contadores negativos) e verifica que tudo
é recusado ou clampado.

**Save antigo sem `b3` carrega normalmente**, com `b3` zerado. `SM_VERSION`
continua **3**.

---

### 14.11 Anti-exploit

| vetor | proteção | teste |
|---|---|---|
| reload duplica Intensidade | caps em `b3.evWG`/`b3.evRG`, persistidos | B3-12, B3-38, B3-42 |
| Continue duplica kill de miniboss | `b3.miniPaid[wave]` | B3-23 |
| Continue rerrola miniboss | `b3.mini[wave]` revalidado no unpack | B3-22 |
| abrir loja gera ganho | `shop_open` delta 0 | B3-10, medição direta |
| evento concede 2× | teto por onda | B3-12 |
| cadeia dispara 2× por restore | `noPool` + não cobra Intensidade | B3-39 |
| reroll de ESCASSEZ vira farm | `b3.scarUsed['rr'+wave]`, 1× por onda | B3-35 |
| DEV/Sandbox gravam | `captureCheckpoint` recusa em sandbox | B3-46 |
| inspetor contamina a run | leitura pura (pack idêntico antes/depois) | B3-50 |

---

### 14.12 Simulações

**Eventos — 3000 seleções por Tema, Intensidade 100:**

| Tema | eventos distintos | mais frequente | família no topo |
|---|---|---|---|
| collapse | 52/73 | `lg_reactor` 4,0% | recursos 21,9% |
| siege | 52/73 | `lg_forge` 5,5% | recursos 26,3% |
| hunt | 52/73 | `lg_ambush` 4,1% | recursos 22,1% |
| anomaly | 52/73 | `lg_rift` 4,6% | recursos 17,8% |
| resonance | 52/73 | `lg_shrine` 4,6% | recursos 21,8% |
| scarcity | 52/73 | `lg_vault` 5,5% | recursos **32,0%** |

52 dos 73 eventos aparecem em cada Tema, e nenhum evento passa de 5,5%.
`recursos` lidera em todos os Temas porque `scoreEvent` já tem um multiplicador
de estado para `coins < 35` — isso é anterior ao Diretor. O que o Diretor faz é
visível na diferença: 32,0% em ESCASSEZ contra 17,8% em ANOMALIA, e o evento
mais frequente muda de Tema para Tema.

**Minibosses — 4000 sorteios por Tema/onda, Intensidade 100:**

| Tema | w5 | w10 | w15 | prob. mínima de qualquer elegível |
|---|---|---|---|---|
| collapse | brood 28,9% | brood 20,7% | brood 23,6% | 6,00% |
| siege | sentinel 32,4% | colossus 22,2% | sentinel 22,8% | 5,98% |
| hunt | duelist 31,1% | duelist 24,5% | furnace 18,0%¹ | 6,35% |
| anomaly | oracle 28,2% | oracle 22,6% | oracle 23,6% | 7,72% |
| resonance | leech 22,8% | oracle 19,3% | oracle 19,9% | 8,33% |
| scarcity | herald 22,3% | herald 17,1% | herald 18,8% | 8,07% |

¹ Na onda 15 o `duelist` **não é elegível** (filtro de HP), então o topo é de
outro — o filtro de segurança continua mandando.

Nenhum elegível cai abaixo de **5,98%** de probabilidade.

**Intensidade — 200 runs completas** (20 ondas, ~0,6 decisão/onda + 3
minibosses):

| onda | média | mín | máx | estágio |
|---|---|---|---|---|
| 5 | 12,7 | 12 | 16 | latente |
| 10 | 28,1 | 26 | 35 | instável |
| 15 | 43,5 | 40 | 50 | propagando |
| 19 | 52,5 | 48 | 61 | propagando |

**0 de 200 runs chegaram a 100.** Máximo absoluto 61. O "wave 10 → 100
automático" não acontece.

---

### 14.13 DEV e Sandbox

**DEV Inspector** — `fractureB3InspectorLines()` devolve quatro blocos curtos,
anexados ao texto existente do Bloco 1/2:

```
EVENTOS[resonance]: favorece ECHO/RESSONANCIA/MEMORIA/VINCULO/SACRIFICIO
  · reduz RISCO/PRESSAO · teto ×1.7 piso ×0.8
  TOP VIÉS: lg_altar×1.70 lg_ghost×1.70 lg_child×1.70
  ÚLTIMO: fx_res_memoria @w6 [uncommon] MEMORIA/RESSONANCIA/ECHO/VINCULO
  · int de evento 1/26 (onda 1/3)
MINIBOSS w10: pool 8 elegíveis · pesos herald 1.18 furnace 1.39 ... oracle 1.86
  ESCOLHIDO: oracle
RESSONÂNCIA (lido, nunca escrito): Ecos=1 aliados=1 hostile=false
  · rel=aliado trust=62 dis=stable pressão=0.24
ESCASSEZ: coinMul(evento)=1.000 · resíduo=7 · reroll da loja 10/10
  (Tema neutro: economia intacta)
```

O bloco de RESSONÂNCIA mostra explicitamente o que foi **lido** — é a forma de
conferir no olho que o Diretor não escreveu nada.

**Sandbox** — a mesma leitura aparece na seção do Diretor, remontada a cada
troca de Tema/Intensidade. Nada ali emite evento, dá resíduo ou grava; o
byte-a-byte dos Save 1/2/3 continua intacto (92/0 em `tests/sandbox.test.js`).

---

### 14.14 O que mudou em relação ao que o Bloco 2 afirmava

Nenhuma afirmação do Bloco 2 foi invalidada. O que mudou é escopo:

1. *"o pool tem 61 eventos"* → *"o pool tem 73 eventos (61 + 12 de Fratura)"*.
   O teste correspondente foi atualizado com o motivo escrito nele.
2. `fractureCleanLastEv` era permissivo demais: aceitava qualquer string como
   id de evento. Agora o id precisa existir no registro, e `family`/`rarity`
   saem do registro em vez de saírem do save.

---

## 15. BLOCO 4 — Assinaturas, revelação e progressão visível

Os Blocos 1 a 3 fizeram o Diretor **existir** e **influenciar**: estado central,
composição de onda, eventos, minibosses, economia. Mas quase nada disso era
*perceptível*. O jogador não tinha como dizer "esta linha temporal está se
comportando de um jeito diferente" — só sentia que as ondas variavam.

O Bloco 4 é a camada de **leitura**. Ele responde a três perguntas do jogador:

1. *O que está acontecendo comigo?* → **revelação do Tema**
2. *Está piorando?* → **Stages com camadas que se abrem**
3. *Esta run é diferente daquela?* → **Encounter Signatures**

E mantém a regra que atravessa toda a PR 13:

> O Diretor é um **sistema de influência**. O Bloco 4 acrescenta *linguagem*
> ao que já existia. Ele não acrescenta poder.

Concretamente: **nenhum número de HP, dano ou recompensa global muda por
Stage**. O teste `B4-28` varre a tabela de gates procurando por isso.

---

### 15.1 Encontro com a realidade: três bugs que a medição achou

Antes de escrever qualquer feature nova, o Bloco 4 mediu o que os Blocos
anteriores afirmavam. Três afirmações caíram:

**(a) `fractureStageGate` era código morto.** A tabela `FRACTURE_STAGE_GATES`
estava definida com campos `bias` e `sig`, mas a função nunca era chamada em
lugar nenhum. Pior: o campo `bias` (.45 … 1.32) multiplicaria
`fractureThemeWeight` **de novo**, por cima do `FRACTURE_STAGE_MUL` que já
existe desde o Bloco 2. Medido, isso faria LATENTE valer .80×.45 = **.36** e
RUPTURA valer 1.10×1.32 = **1.45** — uma segunda progressão escondida sobre a
primeira, exatamente o que o escopo proíbe. O campo foi **removido**, não
ligado. O teste `B4-24` trava isso: a tabela não pode voltar a ter `bias`.

**(b) RUPTURA era matematicamente impossível.** O teto teórico de Intensidade
de uma run é 38 (19 ondas × 2) + 12 (3 minibosses × 4) + 26 (eventos) =
**76**. RUPTURA começa em **80**. Não era "rara": era inatingível, e nenhuma
run jamais anunciaria o Stage final.

**(c) 4 assinaturas pediam arquétipos ainda bloqueados.** `sig_col_cadeia`
pedia `spawner` na w7, mas `spawner` só entra na base na **w8**. `sig_sie_linha`
e `sig_esc_raciona` pediam `tank` na w5 (entra na **w6**); `sig_res_freq` pedia
`anomaly` na w5 (entra na **w6**). A onda real de desbloqueio foi medida, não
lembrada — a tabela que constava na memória da sessão dizia "spawner w7" e
estava errada.

---

### 15.2 Stages — auditoria e camadas (B4.1 / B4.2)

Os thresholds **não mudaram**: 0 / 20 / 40 / 60 / 80. Eles continuam função
exclusiva da Intensidade e não criam contagem paralela (teste `B4-23`).

O que mudou é que cada Stage agora **libera camadas de comportamento**, e cada
camada é uma coisa que *aparece*, nunca um número global:

| Stage | Intensidade | `sig` | `opp` | Identidade (`FRACTURE_STAGE_MUL`) |
|---|---|---|---|---|
| LATENTE | 0–19 | ✗ | ×1 | .80 |
| INSTÁVEL | 20–39 | ✗ | ×1 | .90 |
| PROPAGANDO | 40–59 | ✓ | ×1 | 1.00 |
| CRÍTICA | 60–79 | ✓ | ×1.20 | 1.05 |
| RUPTURA | 80–100 | ✓ | ×1.45 | 1.10 |

- **`sig`** — libera Encounter Signatures. LATENTE e INSTÁVEL são discretos de
  verdade: a run inteira pode passar sem nenhuma.
- **`opp`** — `fractureRareOppMul` eleva o **peso de eventos `rare` e
  `anomalous`**. Não é buff: é frequência de sorte bom. Evento comum devolve
  ×1.00 sempre (teste `B4-27`). É a parte "oportunidades raras" do escopo.

A leitura correta da tabela: LATENTE não faz nada além de existir; RUPTURA tem
identidade clara **e** acesso às oportunidades mais valiosas do pool.

---

### 15.3 RUPTURA — por que existe um pico separado (B4.15 / B4.16)

Dado o item (b) acima, havia duas saídas. A errada era subir o ganho por onda:
isso inflaria **todas** as runs e destruiria a meta de pacing (early Latente,
late Propagando). O escopo é explícito: *"não aumentar artificialmente toda run
até 100 para forçar RUPTURA"*.

A saída foi dar a RUPTURA uma fonte **própria e rara**: os eventos anômalos.

```js
const FRACTURE_ANOMALY_SPIKE=26;   // uma vez por run, só de rarity 'anomalous'
```

São apenas **3** eventos anômalos no pool (`x_onda0`, `x_observador`,
`x_cicatriz`), todos `oncePerRun`. Medido em 400 runs: **3,8%** das runs topam
em um.

Dois detalhes que só a medição mostrou:

1. **O pico precisou ficar FORA do orçamento anti-farm.** Na primeira versão
   ele era descontado de `evRG`, então apenas *substituía* intensidade comum e
   o teto continuava 76 — RUPTURA seguia inalcançável (máx medido 75). Aditivo,
   o teto vira 38+12+26+26 = **102**.
2. **O valor 26 foi dimensionado por curva, não por intuição.** Com pico 18,
   RUPTURA acontecia em 0,5% das runs — raro a ponto de não existir. A medição
   da distribuição condicional mostrou que 26 é o ponto em que *toda* run que
   encontra a anomalia chega lá. A regra fica legível: **RUPTURA é o que
   acontece quando a linha temporal topa na anomalia.**

O pico é limitado a uma vez por run por flag (`b3.evSpike`), persistida nos
quatro pontos (init ×2, pack, unpack) — sem ela o Continue re-concederia 26 de
Intensidade a cada reload (teste `B4-30`).

**Pacing medido em 300 runs realistas** (eventos + minibosses):

| Onda | Média | p10 | p50 | p90 | Máx |
|---|---|---|---|---|---|
| 5 | 13.8 | 12 | 12 | 18 | 24 |
| 10 | 31.9 | 26 | 32 | 38 | 61 |
| 15 | 49.5 | 43 | 49 | 55 | 81 |
| 19 | 60.3 | 54 | 60 | 66 | 89 |

Stage final: PROPAGANDO 42,0% · CRÍTICA 54,7% · **RUPTURA 3,3%**. RUPTURA começa
em média na **w16** (faixa w15–18): ainda tardia, rara e marcante, mas agora é
alcançável por uma parcela real das runs.

Tabela recalibrada no **Bloco 5** (ver §16.5); os valores anteriores deixavam
92,7% das runs paradas em PROPAGANDO.

---

### 15.4 Encounter Signatures (B4.3 / B4.4)

**Não são inimigos novos.** São 12 templates raros de composição — 2 por Tema —
que *redistribuem* arquétipos que a onda já teria.

A descoberta de arquitetura que definiu o formato: **o budget já está saturado
a partir da w13** (base 56/61/69/70 contra teto de 46; a última sobra real é na
w10, de 3 entidades). Logo, uma assinatura que *somasse* entidades seria
comida pelo `waveCompFit` e não teria efeito nenhum. Por isso:

```
waveComp(n) = waveCompFit( fractureApplySignature( fractureShapeWave(
                waveCompBase(n), n ), n ), 46 )
```

`fractureApplySignature` **tira 1 de `from` e dá 1 para `add`**, na proporção
1:1. O total não muda, então o budget é respeitado **por construção** (teste
`B4-16`). A exceção é ESCASSEZ, cujo `shrink` remove **sem repassar** — menos
quantidade bruta, que é a identidade do Tema (teste `B4-17`).

**Regras duras**, todas com teste:

| Regra | Teste |
|---|---|
| Nunca antes do threshold do arquétipo na base | `B4-11` |
| Nunca em onda de miniboss (w5/10/15) | `B4-14` |
| Nunca na onda final (w20 é do boss) | `B4-14` |
| Exige o Stage mínimo próprio | `B4-15` |
| Nunca cria arquétipo bloqueado | `B4-18` |
| Teto de 3 por run | `B4-19` |
| Cooldown de 3 ondas | `B4-20` |
| Anti-repeat enquanto houver alternativa | `B4-22` |
| Determinística pela seed | `B4-21` |
| Continue reproduz, não re-sorteia | `B4-57` |

A escolha acontece **uma vez por onda**, em `fractureOnWaveStart`, e fica
gravada em `b4.sig[onda]`. `waveComp()` é chamado várias vezes por onda e
precisa ser puro, então ele apenas **lê** o que já foi decidido.

**Medido em 150 runs por Tema:** 86% das runs têm ao menos uma assinatura; média
**1,21 por run**, e as 12 aparecem (topo 15,1%, piso 2,2%).

---

### 15.5 Revelação gradual do Tema (B4.5 / B4.6 / B4.7)

A run começa com `FRACTURA ◌ DESCONHECIDA`. Em algum momento o jogador junta
pistas suficientes e o Tema é nomeado — **uma vez**, e o Tema nunca muda.

A primeira implementação revelava em **100% das runs, sempre na w6, sempre pelo
mesmo motivo**. Era exatamente o que o escopo mandava evitar. A causa: os
gatilhos "reais" estavam desligados e só o fallback de tempo funcionava.

A correção teve duas partes.

**1. Os gatilhos passaram a ser relativos, não absolutos.** Um threshold
absoluto de viés ≥1.30 nunca seria atingido antes do fallback: medido, numa run
real a Intensidade cresce ~2/onda e na w10 o peso do Tema vale ~0.14, então o
maior multiplicador de evento chega só a **~1.15**. O que o jogador percebe é
"a coisa mais característica deste Tema apareceu", então:

- `fractureIsThematicEvent` — o evento disparado está no **quintil superior**
  do viés da onda (e acima de 1.08, para não contar ruído);
- `fractureIsAlignedMini` — o miniboss que apareceu é **o argmax** do pool da
  onda (e acima de 1.10). São só 3 ondas de miniboss por run e o favorito tem
  ~25-30% de chance, então é raro de verdade.

**2. O fallback de tempo deixou de ser fixo.** `fractureRevealForceWave()`
devolve 8 + `hash(seed) % 5`, ou seja **8 a 12** conforme a run (teste `B4-39`).

**Resultado medido em 300 runs:** revelação em 300/300, onda média **w9.1**,
faixa **w5–w12**, e os quatro motivos aparecem:

| Motivo | Fatia |
|---|---|
| tempo (fallback) | 49% |
| evento temático | 32% |
| Intensidade ≥ 30 | 15% |
| miniboss alinhado | 4% |

Nenhum domina. `signature` fica em 0% porque assinaturas exigem PROPAGANDO
(w13+), e a essa altura o Tema já foi revelado — o gatilho existe para runs
atípicas de Intensidade alta cedo, não para ser o caminho comum.

**O HUD nunca mostra número.** `fractureHudText()` produz estados narrativos
(`FRACTURA ◌ DESCONHECIDA` → `FRACTURA CAÇADA · INSTÁVEL`), nunca `47/100` e
nunca um id cru. O teste `B4-36` varre os 6 Temas × 6 Intensidades × 2 estados
procurando por dígito ou underscore.

---

### 15.6 Anúncio de Stage (B4.8)

Uma vez por Stage por run, gravado em `b4.stages`. O Continue não repete
(teste `B4-43`). LATENTE é marcado **sem anunciar** — é o estado inicial da run
e não deve gastar o primeiro banner com algo que o jogador já está vendo
(teste `B4-42`).

`fractureStageAnnounce` **valida o id contra o catálogo antes de marcar**. Sem
isso, qualquer string — inclusive `'__proto__'` ou um Stage inventado — virava
"já anunciado" e a função devolvia `true` alegando ter anunciado algo
inexistente. Bug real, corrigido, travado pelo teste `B4-44`.

---

### 15.7 Codex, Echo e facções (B4.11–B4.14)

**Codex** — aba `fracture` com nome, símbolo, descrição, lore e status. São
**12 entradas de lore** (2 por Tema). A descoberta persiste por Save Slot em
`smRoot.slots[curSlot].fxThemes` como um mapa `{id:1}` — só o id, nenhum estado
mecânico (teste `B4-49`). Enquanto o Tema não é descoberto, o Codex mostra
`◌ ASSINATURA NÃO IDENTIFICADA` e **não vaza** nome nem id (teste `B4-50`).

Descoberta narrativa é permanente — **mas nunca a partir do Sandbox nem de uma
run contaminada pelo DEV**. `fractureCodexDiscover` recusa nos dois casos
(testes `B4-47` e `B4-48`). Este guard foi exigido pelo teste byte-a-byte do
Sandbox: a primeira versão gravava `fxThemes` no slot *durante* a sessão de
laboratório e quebrou o teste 17.

**Facções** — `FRACTURE_FACTION_REMARKS` são falas, e `fractureFactionRemark`
**não chama `factionEmit`**. Afinidade continua vindo só de escolhas concretas.
O teste `B4-52` varre a fonte pelo padrão vetado
(`theme === 'x' … factionEmit`) e confere que a tabela de falas não carrega
números de afinidade.

**Echo** — reage à revelação, à CRÍTICA e à RUPTURA via `echoSpeak`, sem tocar
em Personality ou Trust (teste `B4-54`).

---

### 15.8 Sandbox e DEV (B4.18 / B4.19)

**Sandbox** ganhou botões de Stage, revelação, assinatura forçada e simulação
de transição. `fractureSandboxSimTransitionLines()` é **pura**: varre os 5
Stages e devolve o que muda em cada um sem tocar em `fractureRun`. O
byte-a-byte dos Save 1/2/3 continua intacto (92/0 em `tests/sandbox.test.js`).

**DEV** ganhou três comandos, todos taintando a run:

```
fx:reveal                 revela o Tema na hora
fx:signature:<id>         força uma assinatura na onda atual
fx:signature:off          limpa as assinaturas da run
fx:stage:<stage>          vai para o MEIO da faixa do Stage
```

`fx:stage:` mira o meio da faixa, não o limite — assim o Stage pedido fica
estável e não cai no vizinho por arredondamento. Ids inválidos são recusados
**sem taintar** (teste `B4-58`).

O inspetor ganhou quatro seções (`fractureB4InspectorLines`): REVELAÇÃO com os
sinais acumulados, STAGE com as camadas ativas, ASSINATURA com o pool elegível,
e CODEX com o status de descoberta. É leitura pura: não tainta.

---

### 15.9 O que ficou de fora, de propósito

Do escopo negativo da PR 13, nada foi implementado: novos finais, epílogos,
Tema × Facção no fim da run, boss adaptativo (reservado para a PR 15), guerra
entre facções, mapa de facções, progressão permanente nova, novas árvores,
rework do HUD.

`SM_VERSION` continua **3**. O `b4` é um campo novo dentro do checkpoint
existente, e um save antigo sem ele ganha o estado zerado (teste `B4-56`).

---

## 16. BLOCO 5 — Fechamento técnico, balanceamento e validação

O Bloco 5 não adiciona camada de gameplay. Ele **mede, corrige e registra**.
Tudo o que está abaixo saiu de execução real do código — nada foi ajustado por
intuição.

Ferramentas de medição (fora do repositório, usadas para produzir os números):

| Script | O que faz |
|---|---|
| `b5/sim.js` | 20 ondas completas por run: `spawnWave` real + `pickMiniBoss`/`fractureOnMiniKill` + `pickRunEvent` com PRNG seedado |
| `b5/measure.js` | ciclo completo + Continue + morte + limpeza |
| `b5/audit_save.js` | as 35 verificações das seções 2 e 3, com saída `OK`/`FALHA` |
| `b5/smoke.js` | os 26 passos do caminho mínimo (20 de jogo + 6 de Sandbox) |

---

### 16.1 Dois bugs reais encontrados e corrigidos

**Bug 1 — sinais de revelação não eram persistidos.** `fractureRevealTrigger`
lê `b.miniAligned`, `b.evThematic` e `b.evSig`, mas `fractureRunPack` não
gravava nenhum dos três. Um miniboss alinhado ou um evento fortemente temático
ocorridos antes do save deixavam de servir de gatilho na retomada, e a revelação
caía para um motivo mais fraco e mais tardio.

Medido: `miniAligned` ia de 10 para 0 no Continue, reproduzível em 3 de 400
reloads em CRÍTICA.

Verificação da correção — as **196 combinações** de `miniAligned × evThematic ×
evSig` (0–6 × 0–6 × {0,3,7,12}) sobrevivem ao ciclo pack → unpack: 196
preservadas, 0 divergências. Fora da faixa o clamp segura: `999 → 20`, `-5 → 0`,
`1e6 → 20` (`MAX_WAVE`).

> **Cuidado ao re-medir.** `fractureRunUnpack(cp)` espera o **wrapper**
> `{fracture: {...}}`. Passar o pack cru faz `p` cair em `null` e a função cria
> uma run **nova** e zerada — o que parece "sinais perdidos" mas é só argumento
> errado. Igualmente, um ciclo em que nenhum sinal foi populado compara 0 com 0
> e não prova nada.

Save antigo sem os campos cai em 0 — o comportamento de antes, campo a campo
revalidado. Não há quebra de compatibilidade, então `SM_VERSION` continua 3 e
`FRACTURE_STATE_VERSION` continua 1. Coberto por `B5-13`.

**Bug 2 — o Sandbox reportava redução como falha.** `fractureSetIntensity`
devolve o **delta** aplicado, e os ramos `int:` e `stage:` do laboratório usavam
`>=0` como teste de sucesso. Qualquer ação que *reduzia* a Intensidade
(`int:20` a partir de 90, `stage:latente` a partir de RUPTURA) era aplicada
corretamente mas reportada como falha — e como o fim da função faz
`if(!ok)return false`, o toast e o refresh do painel eram pulados: o laboratório
mudava de estado sem dar feedback nenhum.

Medido antes: `int:20` (de 90) → `false` com a Intensidade já em 20. Depois:
`true`, e `lixo:xxx` continua `false`. Os testes existentes só cobriam aumentos,
por isso o bug passou.

---

### 16.2 Performance (seção 11 da validação)

Dois pontos corrigidos, ambos localizados:

**a) `fractureHudChip` rodava a 60 fps com três escritas DOM.** O wrapper do
HUD chama o chip *depois* de `updateHUD`, portanto **fora** do throttle de
`.09` do jogo. O cache `b4.hudSeen` era escrito mas nunca lido. Com a guarda
`if(b.hudSeen===key && chip.textContent) return;`, 600 frames estáveis caíram de
**600 escritas para 0**; mudar de Stage custa exatamente 1.

**b) o summon do `spawner` era o único invocador sem teto.** Existem quatro
invocadores de entidades: splitter, mini-chefe, `SK.swarmSpawn` e o spawner. Os
três primeiros já respeitavam `ENEMY_BUDGET`; o quarto não. COLAPSO favorece
spawner (**1,58/onda** contra 0,95–1,16 dos outros Temas, máximo 4 na onda 19),
o que somava ~80 entidades extras em 120 s sobre um teto de 46.

O que estava limpo e foi confirmado: `render()`/`loop()` não chamam `fracture*`;
`devTick` é throttled a 0,2 s; os loops aninhados rodam só sobre 11 arquétipos
uma vez por onda; `fractureKitBoot` tem guarda `.done`.

---

### 16.3 DEV `fx:*` (seção 13 da validação)

`fx:reveal` taintava **depois** de `fractureReveal()`, então `fractureCodexDiscover()`
chegava a gravar uma descoberta permanente a partir de um comando de DEV
(medido: `["hunt"]`). Agora tainta antes → `[]`.

Comando | Efeito | Tainta
---|---|---
`fx:comp[:n]` · `fx:wave:<n>` (fora do Sandbox) · `fx:sim` · `fx:insp` | leitura | não
`fx:theme:` · `fx:int:` · `fx:emit:` · `fx:bias:` · `fx:pool:` · `fx:reroll` · `fx:reveal` · `fx:signature:` · `fx:stage:` · `fx:wave:` (Sandbox) | mutação | sim

---

### 16.4 Auditoria de Save/Continue e Sandbox

`b5/audit_save.js` — **35/35 verificações OK**, reproduzido em 8 execuções
seguidas:

- ciclo completo run → checkpoint → sair → Continue → avançar → morte, com
  Tema, seed, Intensidade e composição preservados;
- reload idêntico nos seis pontos pedidos: antes da revelação, logo após, após
  assinatura, após miniboss, em CRÍTICA e em RUPTURA;
- miniboss não paga de novo nem rerrola no Continue; anúncio de Stage não
  repete; `wave_complete` não é cobrado duas vezes na retomada;
- save antigo funciona; save malformado é sanitizado;
- **Sandbox byte-a-byte idêntico nos Save 1/2/3** (~8,5 KB, 11 ações, segunda
  revelação recusada); isolamento entre slots; `smClearSlotSave` descarta o
  Diretor.

`b4.hudSeen` **não** entra no pack por desenho — é cache de redraw. Uma
auditoria que compare o `b4` inteiro gera falso positivo.

---

### 16.5 Recalibração do pacing (seção 6 da validação)

A escala `{common:0, uncommon:1, rare:2, anomalous:3}` era **bimodal**: 80,8%
das runs terminavam em 50–54, a faixa 60–74 ficava vazia, e CRÍTICA aparecia em
5,5% das runs. O teto teórico de 102 nunca era o problema — o piso
determinístico de 48 já garantia PROPAGANDO, e os eventos não tinham peso para
subir dali.

`{0,4,8,12}` foi medido e **rejeitado** (CRÍTICA 67,0% — viraria o normal).
Aplicado `{0,3,6,10}`, com `PER_WAVE_MAX` de 3 para 6 para que um único evento
raro ainda se faça sentir. `common:0` foi preservado de propósito (anti-farm,
`B3-37`).

| | antes | depois |
|---|---|---|
| Intensidade média na w19 | 53,0 | 60,3 |
| CRÍTICA | 5,5% | 54,7% |
| RUPTURA | 2,0% | 3,3% |
| primeiro RUPTURA | w19 (w17–20) | w16 (w15–18) |

Nenhum HP, dano ou velocidade global foi tocado — a recalibração é só de
Intensidade, que já era o eixo de modulação.

**Por Tema** (150 runs cada, seed fixa):

| Tema | int w5 / w10 / w15 / w19 | CRÍTICA | RUPTURA | revelação | eventos | temáticos | assinaturas |
|---|---|---|---|---|---|---|---|
| COLAPSO | 14,1 / 31,6 / 49,4 / 59,9 | 52% | 3% | w8,5 | 12,9 | 20,1% | 1,15 |
| CERCO | 14,3 / 32,3 / 50,0 / 60,8 | 53% | 5% | w9,1 | 12,9 | 10,9% | 1,16 |
| CAÇADA | 13,9 / 31,8 / 49,7 / 60,5 | 52% | 5% | w8,8 | 12,8 | 14,6% | 1,16 |
| ANOMALIA | 13,6 / 30,9 / 48,2 / 59,5 | 49% | 4% | w8,6 | 12,7 | 18,1% | 1,09 |
| RESSONÂNCIA | 13,6 / 30,9 / 48,8 / 59,6 | 51% | 2% | w8,1 | 12,8 | 17,7% | 1,18 |
| ESCASSEZ | 13,6 / 30,4 / 48,1 / 58,9 | 46% | 2% | w8,4 | 12,8 | 27,8% | 1,13 |

A Intensidade é praticamente idêntica entre Temas (é o comportamento pedido: o
Tema muda a **forma** da run, não a sua dificuldade bruta). A diferença visível
está na proporção de eventos temáticos — ESCASSEZ 27,8% contra CERCO 10,9%.

**Revelação:** 100% das runs, média **w8,7**, faixa w4–w12, 9 ondas distintas.
**Assinaturas:** 86% das runs, 1,21 por run, **as 12 aparecem** (topo 15,1%,
piso 2,2%). **Minibosses:** os 8 aparecem, nenhum Tema zera elegível.
**`budgetOver` acumulado: 0.**

---

### 16.6 Game feel (seção 12 da validação)

79 strings que chegam ao jogador foram inspecionadas (HUD nos 6 Temas × 5
Stages, HUD oculto, 12 nomes de assinatura, rótulos de Stage, falas de facção,
falas do Eco, títulos de lore): **0 vazamentos** de id de Tema, id de assinatura,
id de Stage, id de evento ou número de Intensidade.

Os dois anúncios (`fractureSignatureBanner` e `fractureStageAnnounce`) reusam o
`banner()`/`toast()` do jogo em vez de criar overlay próprio, então herdam o
posicionamento da PR 11.5 e não cobrem área nova. O bloco inteiro cria só três
elementos: o chip do HUD e as duas seções de painel (Sandbox e DEV), que vivem
dentro de painéis já existentes.

Não verificado: colisão do chip em viewports muito estreitos, renderização real,
áudio e entrada de teclado — Electron não existe no ambiente de validação.

---

### 16.7 Testes

Suíte PR 13: **274 verificações**. Projeto: **18 suítes · 1235 ✔ · 0 ✘**.

O bloco novo é `[35] B5-01..B5-13`, sobre 60 runs determinísticas (seeds
`s*7919`/`s*104729`):

| | cobertura |
|---|---|
| B5-01/02 | Continue em CRÍTICA e em RUPTURA sem pico duplo |
| B5-03 | RUPTURA alcançável e não rotineira |
| B5-04 | revelação nem tarde nem imediata |
| B5-05 | `fractureSimulate` sem estouro de budget |
| B5-06 | wrappers não duplicados (contra um boot de referência) |
| B5-07 | HUD sem redraw redundante |
| B5-08 | DEV não grava Codex |
| B5-09 | as quatro âncoras de teto de entidades |
| B5-10 | o runner continua imprimindo o nome das falhas |
| B5-11 | versões intactas |
| B5-12 | as 12 assinaturas alcançáveis |
| B5-13 | sinais de revelação sobrevivem ao Continue |

Smoke semimanual: **26 passos, 0 falhas**.

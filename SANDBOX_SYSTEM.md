# ECHO — SANDBOX: LABORATÓRIO DO JOGADOR (PR 11.5)

> Modo de teste livre: monte um operador, um preset de build e uma onda
> inicial; brinque com a arena sem que NADA seja registrado na progressão
> real. Seções §N correspondem aos comentários em `index.html` e são
> referenciadas por `tests/sandbox.test.js`.

> **R4 — SANDBOX É UM MODO GLOBAL E TEMPORÁRIO / NÃO PERTENCE A NENHUM
> SAVE SLOT.** O laboratório vive **apenas no MENU INICIAL GLOBAL** (botão
> `SANDBOX` do título) e **não pertence a Save 1, 2 ou 3**. Nunca é usado
> como Save Slot 4, nunca tem "Continuar Sandbox" e fechar o jogo dentro
> dele volta ao menu normal. O botão SANDBOX só existe no menu global —
> dentro de um save (menu do slot, confirmações, morte, vitória) ele é
> removido do overlay.
>
> **R5 — O SANDBOX NÃO SIMULA DESBLOQUEIOS. ELE IGNORA COMPLETAMENTE O
> SISTEMA DE DESBLOQUEIOS** — e ignora a progressão inteira:
>
> 1. `isCharUnlocked` / `isWeaponUnlocked` / `isItemUnlocked` /
>    `isUpgUnlocked` voltaram a ser funções **puramente do jogo normal**
>    (nenhum `if (sandboxActive()) return true`). O sandbox não as chama.
> 2. O laboratório usa **CATÁLOGO PRÓPRIO** (`sandboxGetOperators`,
>    `sandboxGetWeapons`, `sandboxGetItems`, `sandboxGetUpgrades`), que
>    devolve TODO o conteúdo existente sem consultar unlock nenhum.
> 3. Nada é "zerado e restaurado": `prog`, `meta`, `echoQueue`, `charSel`,
>    `curSlot` e `activeRun` **nunca são substituídos** — nem em memória,
>    nem no arquivo. Não existe backup/restore. A sessão vive 100% em
>    `sandboxContext` (grafo de estado próprio). Testes rodam a sessão
>    inteira com a progressão real **deep-frozen** para provar isso.

---

## 1. PRINCÍPIO CENTRAL — ISOLAMENTO TOTAL (§73)

Com o laboratório ativo (`sandboxRun`), **nenhuma função de persistência
age**. O arquivo do save em localStorage fica byte a byte idêntico antes,
durante e depois de uma sessão (testado para os 3 slots).

**Defesa em profundidade:** o próprio `smCommit()` — o único escritor de
`echoSave.v3` — recusa gravar com `sandboxRun||sandboxMode`. Mesmo que um
writer futuro esqueça o guard próprio, nada é persistido.

**R5 — CATÁLOGO PRÓPRIO, nunca simulação (§2/§4/§35):** o sandbox NÃO
"desbloqueia" nada porque **não participa do sistema de desbloqueios**.
A UI do preparo renderiza o catálogo completo (`sandboxGetOperators()`),
as ofertas da loja usam o catálogo cheio (`shopWeaponPool` →
`sandboxGetWeapons()`, pools de upgrades/itens com `sandboxRun||`) e o
player nasce direto de `sandboxContext.operatorId` — **sem passar por
`is*Unlocked`, `setChar` ou `checkUnlocks`**. Essas funções representam
APENAS o jogo normal (puras), dentro e fora do laboratório.

**Janela pós-laboratório: NÃO EXISTE MAIS.** Como o sandbox nunca tocou
na progressão, o `checkUnlocks` do `showTitle` pós-saída funciona
exatamente como em qualquer ida ao menu — pendências legítimas do save
sincronizam normalmente (comportamento padrão, idêntico com ou sem
sandbox).

| Função | Comportamento no sandbox |
|---|---|
| `saveProg()` | `return false` — prog intocado (nem em memória: o global nunca é substituído) |
| `saveMeta()` | `return false` — meta/memória intocada |
| `saveEchoes()` | `return false` + aviso em console — laboratório não cria Echo |
| `bumpProg(k,n)` | no-op — abates/ondas/vitórias de teste não alimentam records |
| `checkUnlocks()` | `return false` — nada desbloqueia, nem com condições verdadeiras |
| `captureCheckpoint()` | `return false` (§91) — laboratório não cria Continue Run |

Flags (topo do arquivo): `sandboxMode` (tela de preparo),
`sandboxRun` (run ativa), `sandboxContext` (R5 §13 — grafo de estado
próprio: `operatorId`, `weapons`, `items`, `upgrades`, `credits`, `hp`,
`shield`, `wave`, `preset`, `modifiers`, `runtime`) e `sandboxCfg`
(VISTA de leitura/escrita sobre o contexto — não persiste).
`sandboxActive()` = `sandboxMode||sandboxRun`. **Não existem backups
`_sb*Bak`** — nada é restaurado porque nada é tocado.

**Coerência DEV (§92):** `startRun` mantém `devTainted=!!DEV_MODE`; as ações
do sandbox não chamam `devTaint()` — ex.: `removeItemById(p,id,taint=false)`
não marca a run (o default `taint=true` permanece para o jogo real).

---

## 2. UNLOCK-ALL (§76)

Dentro do sandbox `isCharUnlocked` / `isWeaponUnlocked` / `isItemUnlocked` /
`isUpgUnlocked` retornam **true para qualquer id** — todo o conteúdo da alpha
(operadores, 27 armas, módulos, upgrades, minibosses e o chefe) fica
disponível. Fora do sandbox os gates progressivos normais voltam a valer.

---

## 3. FLUXO DE ENTRADA (§74–§78)

```
MENU INICIAL GLOBAL → botão SANDBOX → sandboxOpenSetup()
  R5: NENHUM global real é tocado — curSlot/prog/meta/echoQueue/charSel/
  activeRun ficam como estão; só sandboxMode=true + catálogo próprio
  state='title' + openCodex('sandbox') → tela de preparo
  INICIAR TESTE → sandboxStart()        → run de laboratório
```

**Backdrop inerte (§1/§18):** clicar fora do painel do preparo NÃO faz
nada — não fecha, não volta ao menu, não muda state, não limpa a config.
As únicas saídas clicáveis são **VOLTAR AO MENU** (rodapé do codex, que
executa `sandboxCloseSetup` e cai no menu principal com overlay coerente)
e o **ESC** (mesma regra, intencional e consistente).

**Robustez do INICIAR TESTE (§32/§33):** `sandboxStart` valida a cfg
(`sandboxValidateCfg` → operador/preset/onda); config inválida deixa o
botão **desabilitado com o motivo** no próprio botão e qualquer exceção é
tratada: o preparo volta a abrir com uma caixa vermelha `✕ FALHA AO
INICIAR O TESTE — <motivo>` + toast + `console.error`. Nenhuma falha fica
silenciosa — o botão nunca "não faz nada".

- **Preparo (§77):** `renderSandboxSetup` lista os 8 operadores (com
  `⌗ N SLOTS` reais), 6 presets de build (`shieldbreak`, `fullshield`,
  `crit`, `status`, `dash`, `economy`) e ondas iniciais `SB_WAVES =
  [1,3,5,10,15,20]` (20 = chefe). ESC volta ao menu; o setup não é salvo.
- **Início (§75):** `sandboxStart` chama `startRun(sandboxRunOpts())` —
  as opções dizem ao motor: **player nasce de
  `makePlayer(sandboxContext.operatorId, freshMeta)`** (§7 — nunca via
  `charSel`/`setChar`), a meta é lida zerada (bônus do save não vazam
  para o teste) e **nenhum Eco real entra na run** (`noEchoes`). Depois:
  **+500 créditos de teste** (`giveSandboxCredits`), preset escolhido
  (`applyBuildPreset`) e onda inicial via `sandboxJumpTo` se `>1`. Nada
  disso é persistido — a sessão morre na saída.
- **Chip SANDBOX** (`#sb-chip`, canto inferior esquerdo): acende durante a
  run; clicável — abre/fecha o painel (mesmo atalho F1).
- **Banner:** "SANDBOX ATIVO — NADA É REGISTRADO · F1 ABRE O PAINEL".

---

## 4. DURANTE A RUN (§79–§86)

**Painel de laboratório (F1 ou chip):** `state='sandbox'` (entra em
`frozen` — o tempo do jogo para). O **chip `⌖ SANDBOX · [F1] LABORATÓRIO`
existe somente com `sandboxRun===true`** (`display:none` por padrão, classe
`on` ligada em `sandboxStart` e desligada em `sandboxRestoreReal`) — em run
normal, no menu principal ou após sair, nada dele aparece. O handler da
tecla **F1** só age com `sandboxRun && (state==='play'||state==='sandbox')`;
fora disso a tecla é consumida sem qualquer efeito (§13). Seções
renderizadas em `#sb-body`:

- **JOGADOR (§82):** encher HP, encher/quebrar escudo, limpar status,
  resetar cooldowns.
- **AJUSTES DO JOGADOR (§12–§18/§20):** ajustes temporários de teste que
  passam SEMPRE pelo Stat Modifier Pipeline com source IDs exclusivos —
  `sandbox:damage`, `sandbox:crit`, `sandbox:speed`, `sandbox:shield_max`,
  `sandbox:shield_regen` — portanto `BASE + SANDBOX MODIFIER = FINAL`:
  - **CRÉDITOS:** −100/−10/+10/+100 e `MAX ◈9999` (para testar economia).
    A loja normal não abre no sandbox (eventos desligados), mas os
    créditos permanecem funcionais para qualquer sistema dependente
    (coinMul, condições de unlock, etc).
  - **HP:** ENCHER · DANO −25 · +25 · SET 1 (clamp: nunca NaN/negativo).
  - **ESCUDO:** ENCHER · **QUEBRAR (PIPELINE REAL)** · ±10. Quebrar dispara
    o MESMO caminho do combate: `shieldFx('break')`, `runSt.sb++`,
    `echoReact('shieldBreak')` e `itemEmit('onShieldBreak', …)` — itens da
    PR 11 (ex.: PULSO DE FRATURA) procam de verdade e entram em cooldown.
  - **DANO ±10% · CRÍTICO ±5% · VELOCIDADE ±10% · SHIELD MÁX ±10 ·
    REGEN ±1** (multiplicativo/flat conforme o stat).
  - **RESETAR AJUSTES:** remove SOMENTE os mods `sandbox:*` — itens,
    operador, moral e status normais permanecem.
  - **NADA disto persiste:** o laboratório não grava nada e `sandboxExit`
    chama `stripSandboxMods(player)` (§18).
- **ARSENAL (§78/§79):** grade de slots do operador com contador
  `N/max SLOTS (IDENTIDADE DE <OP>)`; por slot: EQUIPAR · SUBSTITUIR ·
  REMOVER; slots vazios: + ADICIONAR; ações globais: TROCAR ARMAS DE SLOT
  (SWAP) e LIMPAR ARSENAL.
  - **Swap (§85):** armar → clique na arma de ORIGEM (rótulo `FONTE`) →
    clique no slot de DESTINO → `swapWeaponSlots` (mesmos contratos do
    arsenal: ativa acompanha a arma, nada de cooldown/stats resetados).
- **Módulos (§80/§81):** adicionar/remover qualquer item (`pickitem`); a
  remoção usa `removeItemById(p,id,false)` — sem taint.
- **ARENA (§83/§84):** pular para qualquer onda (`sandboxJumpTo`, inclusive
  20 = O PARADOXO), gerar grupo de inimigos (`SB_ETYPES`, 11 tipos), limpar
  arena, invocar o chefe.
- **Ondas arbitrárias sem records:** `sandboxJumpTo` limpa a arena e spawna
  a onda escolhida; **beacon e micro-eventos são gated por `!sandboxRun`** —
  nenhum evento narrativo nasce no laboratório.

**Fluxo de aquisição (§62/§123):** ao pedir uma arma com arsenal cheio, o
painel pergunta **"SUBSTITUIR QUAL SLOT?"** (`sbPendingWi`) e substitui o
slot escolhido via `grantWeapon(wi,false,s)` — sem reordenar os demais.

---

## 5. OPERADOR DE TESTE vs OPERADOR REAL (R5 §6/§7/§8)

`setChar` real **persiste no slot** (`smRoot.slots[curSlot].char`) e é
SEMPRE do jogo normal. O laboratório NÃO o usa:

- a seleção do preparo grava `sandboxContext.operatorId` (ID do CHARS),
  separado de `charSel`/`selectedCharacter`/slot character (§6);
- `sandboxStart`/`sandboxRestart` criam o player com
  `makePlayer(operatorId, freshMeta)` direto do contexto (§7);
- `charSel`, `smRoot.slots[curSlot].char` e a fila real ficam intactos
  durante a sessão inteira (testado com espiões e deep-freeze);
- a morte/vitória exibem `sandboxOperator().nm` (contexto), nunca
  `curChar()` (que poderia até mutar `charSel` de operador locked).

---

## 6. FINS DE SESSÃO

| Saída | Função | Comportamento |
|---|---|---|
| Morte (§89) | `onPlayerDeath → sandboxDeath` | overlay **"TESTE ENCERRADO"** — "NENHUM ECO FOI CRIADO · NADA FOI REGISTRADO"; `state='fracture'`; nenhum Echo, nenhum save |
| Vitória (§90) | `onVictory → sandboxVictory` | overlay **"TESTE CONCLUÍDO"** — nenhum final/variante/epílogo/Ponto de Memória; meta intocada |
| REINICIAR TESTE (§88) | `ov-go` (clique/Enter/Space) → `sandboxRestart` | limpa entidades, restaura o real, reinicia o MESMO setup (`sandboxCfg`) |
| ALTERAR BUILD (§87) | `ov-back` → `sandboxEndToSetup` | encerra e volta à tela de preparo (onda redefinida para 1) |
| **VOLTAR AO MENU PRINCIPAL** (§11) | `ov-exitmenu` (clique) → `sandboxExit(true)` | limpa o estado sandbox, sai da run, **não salva active run, não cria Echo, não altera progressão** → **MENU INICIAL GLOBAL** |
| VOLTAR AO MENU (rodapé do preparo) | `cx-close`/ESC → `sandboxCloseSetup` → `sandboxExit` | encerra o preparo e volta ao **MENU INICIAL GLOBAL** (nunca a Save Slots) |

**R4 — TODA saída do laboratório vai ao MENU INICIAL GLOBAL** (`showTitle`),
nunca à tela de Save Slots. **R5 — na saída NADA é restaurado:** não
existe restauração porque nada foi alterado. `sandboxExit` limpa
`sandboxRun`/`sandboxMode`, desmonta a run, `stripSandboxMods(player)` e
`showTitle()` — o contexto real (`prog/meta/echoQueue/charSel/curSlot/
activeRun`) está exatamente onde sempre esteve, em memória e no arquivo.

Morte e vitória exibem as **3 opções claras**: `REINICIAR TESTE` ·
`ALTERAR BUILD` · `⌂ VOLTAR AO MENU PRINCIPAL` — todas com binding de
CLIQUE real (e Enter/Space reinicia). `sandboxExit` seta `state='title'`
explicitamente (sem overlays fantasma). `devInfo` exibe sufixo
`· SANDBOX` enquanto ativo.

---

## 7. GARANTIAS (RESUMO TESTADO — `tests/sandbox.test.js`)

1. **Zero participação na progressão (R5 §10/§11):** prog, meta, fila de
   Ecos, `charSel`, `curSlot` e `activeRun` são IGUAIS (deep) antes,
   durante e depois da sessão — em memória E no arquivo (byte a byte).
   A sessão roda inclusive com a progressão real **deep-frozen**.
2. Morte/vitória não criam Echo, não gravam final, não mudam prog/meta.
3. Restart repete o MESMO setup (contexto) e mantém o modo; a saída não
   recarrega nada — o real nunca saiu do lugar.
4. Seleção do laboratório vive em `sandboxContext.operatorId`; `setChar`
   real nunca é chamado (espião + fonte, §8); `charSel` intocado.
5. `is*Unlocked` PUROS dentro e fora (§4); catálogos próprios devolvem
   tudo (§2); loja do sandbox oferece o catálogo completo; usar
   arma/item/upgrade/operador locked no teste NÃO desbloqueia fora.
6. Beacon/micro-eventos nunca nascem no laboratório.
7. Ações do painel (swap, substituição de slot §62, remoção de item) não
   produzem taint nem tocam a progressão.
8. **INICIAR (título) funciona indefinidamente:** `showTitle` seta
   `state='title'` (a rota ESC slots→título deixava o INICIAR morto) e o
   próprio botão tem binding de clique; 20 ciclos INICIAR→slots→ESC
   validados com cliques reais, inclusive intercalado com o Sandbox.

# ECHO — SANDBOX: LABORATÓRIO DO JOGADOR (PR 11.5)

> Modo de teste livre: monte um operador, um preset de build e uma onda
> inicial; brinque com a arena sem que NADA seja registrado na progressão
> real. Seções §N correspondem aos comentários em `index.html` e são
> referenciadas por `tests/sandbox.test.js`.

---

## 1. PRINCÍPIO CENTRAL — ISOLAMENTO TOTAL (§73)

Com o laboratório ativo (`sandboxRun`), **nenhuma função de persistência
age**. O arquivo do save em localStorage fica byte a byte idêntico antes,
durante e depois de uma sessão (testado).

| Função | Comportamento no sandbox |
|---|---|
| `saveProg()` | `return false` — prog intocado |
| `saveMeta()` | `return false` — meta/memória intocada |
| `saveEchoes()` | `return false` + aviso em console — laboratório não cria Echo |
| `bumpProg(k,n)` | no-op — abates/ondas/vitórias de teste não alimentam records |
| `checkUnlocks()` | `return false` — nada desbloqueia, nem com condições verdadeiras |
| `captureCheckpoint()` | `return false` (§91) — laboratório não cria Continue Run |

Flags (topo do arquivo): `sandboxMode` (tela de preparo),
`sandboxRun` (run ativa), `sandboxCfg {char,preset,wave}` (setup da sessão —
não persiste), `_sbEchoQueueBak`/`_sbCharBak` (backups de restauração).
`sandboxActive()` = `sandboxMode||sandboxRun`.

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
MENU → SANDOX (botão do título) → sandboxOpenSetup()
  state='title' + openCodex('sandbox')  → tela de preparo
  INICIAR TESTE → sandboxStart()        → run de laboratório
```

- **Preparo (§77):** `renderSandboxSetup` lista os 8 operadores (com
  `⌗ N SLOTS` reais), 6 presets de build (`shieldbreak`, `fullshield`,
  `crit`, `status`, `dash`, `economy`) e ondas iniciais `SB_WAVES =
  [1,3,5,10,15,20]` (20 = chefe). ESC volta ao menu; o setup não é salvo.
- **Início (§75):** `sandboxStart` preserva a fila real de Ecos em
  `_sbEchoQueueBak`, roda com `echoQueue=[]` (nenhum Eco real entra),
  troca o operador via `sandboxSetChar` (ver seção 5), dá **+500 créditos
  de teste** (`giveSandboxCredits`), aplica o preset escolhido e pula para
  a onda inicial se `>1`.
- **Chip SANDBOX** (`#sb-chip`, canto inferior esquerdo): acende durante a
  run; clicável — abre/fecha o painel (mesmo atalho F1).
- **Banner:** "SANDBOX ATIVO — NADA É REGISTRADO · F1 ABRE O PAINEL".

---

## 4. DURANTE A RUN (§79–§86)

**Painel de laboratório (F1 ou chip):** `state='sandbox'` (entra em
`frozen` — o tempo do jogo para). Seções renderizadas em `#sb-body`:

- **JOGADOR (§82):** encher HP, encher/quebrar escudo, limpar status,
  resetar cooldowns.
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

## 5. OPERADOR DE TESTE vs OPERADOR REAL (§73)

`setChar` real **persiste no slot** (`smRoot.slots[curSlot].char`).
`sandboxSetChar` troca apenas `charSel` em memória:

- `sandboxStart` guarda o operador real em `_sbCharBak` antes de trocar;
- `sandboxRestoreReal` devolve `charSel`, a fila de Ecos (mesmas
  referências), apaga o chip e restaura o texto do botão de voltar;
- o slot real NUNCA é reescrito pelo laboratório (testado).

---

## 6. FINS DE SESSÃO

| Saída | Função | Comportamento |
|---|---|---|
| Morte (§89) | `onPlayerDeath → sandboxDeath` | overlay **"TESTE ENCERRADO"** — "NENHUM ECO FOI CRIADO · NADA FOI REGISTRADO"; `state='fracture'`; nenhum Echo, nenhum save |
| Vitória (§90) | `onVictory → sandboxVictory` | overlay **"TESTE CONCLUÍDO"** — nenhum final/variante/epílogo/Ponto de Memória; meta intocada |
| REINICIAR SANDBOX (§88) | `sandboxRestart` | limpa entidades, restaura o real, reinicia o MESMO setup (`sandboxCfg`) |
| ALTERAR BUILD (§87) | `sandboxEndToSetup` | encerra e volta à tela de preparo (onda redefinida para 1) |
| MENU | `sandboxExit(true)` | restaura o save real → título |
| SELECT DE SLOT | `sandboxExit(false)` | restaura o save real → select de slots |

Em morte/vitória os botões são `REINICIAR SANDBOX` (Enter/Space) e
`ALTERAR BUILD`; `devInfo` exibe sufixo `· SANDBOX` enquanto ativo.

---

## 7. GARANTIAS (RESUMO TESTADO — `tests/sandbox.test.js`)

1. Save em localStorage idêntico antes/durante/depois da sessão.
2. Morte/vitória não criam Echo, não gravam final, não mudam prog/meta.
3. Restart restaura exatamente o mesmo setup; exit devolve a fila de Ecos
   real (mesmas referências) e o operador do slot.
4. `sandboxSetChar` não persiste; `setChar` real persiste.
5. Unlock-all dentro; gates normais fora.
6. Beacon/micro-eventos nunca nascem no laboratório.
7. Ações do painel (swap, substituição de slot §62, remoção de item) não
   produzem taint nem tocam a progressão.

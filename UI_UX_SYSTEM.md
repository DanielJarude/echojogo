# ECHO — SISTEMA DE UI/UX (PR 11.5)

> Referência técnica da camada de interface introduzida/refinada na PR 11.5.
> Todo o jogo é renderizado em canvas; a UI 2D (HUD, overlays, codex, painéis)
> é DOM/CSS puro sobre o canvas. Seções citadas (§N) correspondem aos
> comentários no fonte de `index.html` e são referenciadas pelos testes em
> `tests/`.

---

## 1. FORMATADORES CENTRAIS (§6–§10)

Uma única fonte de formatação numérica para HUD, REGISTRO DE COMBATE, Loja,
Pausa, Codex e tooltips — proibido `toFixed` cru em zonas de player-facing
(guardado por teste em `tests/formatters.test.js`).

| Função | Entrada → Saída | Uso |
|---|---|---|
| `fmtNum(v,maxDec=1)` | `32.325325` → `"32.3"` · `17` → `"17"` · `17.0000001` → `"17"` | números crus; trima zeros à direita; inteiro permanece inteiro |
| `fmtStat(v,maxDec=1)` | alias de `fmtNum` | stats de combate (dano, px, áreas) |
| `fmtPct(v,maxDec=1)` | `0.325328` → `"32.5%"` · `1` → `"100%"` | frações 0..n como percentual |
| `fmtCompact(v)` | `1200`→`"1.2K"` · `15400`→`"15.4K"` · `1.2e6`→`"1.2M"` · `1e9`→`"1.20B"` | **só onde o valor exato não importa** (coins no HUD, contadores cosméticos). Limiar: abrevia a partir de `1e3` |
| `fmtTime(s)` | `83` → `"01:23"` · `0` → `"00:00"` | cronômetros |
| `fmtSec(s)` | `1.275` → `"1.3s"` · `31` → `"31s"` | cooldowns curtos |
| `fmtRate(v)` | `3.2` → `"3.2/s"` | cadência |
| `fmtMult(v)` | `1.8` → `"×1.8"` · `0.85` → `"×0.85"` | multiplicadores (trima zeros) |
| `fmtSigned(v)` | `0.30`→`"+30%"` · `-0.15`→`"−15%"` · `0`→`"±0%"` | deltas com sinal tipográfico (`MINUS='−'` U+2212) |

Regras contratuais (testadas):
- `0` → `"0"`; **`-0` nunca vira `"-0"`**.
- Não-finitos (`NaN/±Infinity/null/undefined`) → `"—"` em TODOS os formatadores.
- Arredondamento **half-away-from-zero** (`fmtNum(-3.25,1)` → `"-3.3"`; `Math.round`
  puro enviesaria negativos para cima).
- Números crus usam hífen simples; textos ganham o minus tipográfico.

Precisão contextual (§8): HP/moedas com `maxDec=0..1`; fire rate 1 casa; crít
e percentuais 1 casa (2 quando a diferença importa); multiplicadores 2 casas.

---

## 2. FEEDBACK DE HUD (§11–§42)

Configuração persistida em `echoCfg.v1` (chave de localStorage), editável nas
CONFIGURAÇÕES:

| Chave | Valores | Efeito |
|---|---|---|
| `aberr` | `1` / `.55` | intensidade da aberração cromática (26 sites) |
| `shake` | `1/.75/.5/.25/0` | multiplicador global de screen-shake |
| `dmgnum` | `0/1/2` | números de dano: desligado / crítico+dano≥18% maxHp / tudo; crítico usa `✦` 17px `#fff6b0` |
| `tabMode` | `hold`/`toggle` | comportamento da tecla TAB (seção 3) |
| `flash` | `1`/`.55` | flash de dano em tela cheia |

- **Proc text anti-spam** (§29): mensagens de proc têm cooldown próprio
  (`_procCd` 1100ms; CADEIA 900ms; ESCUDO−N 700ms; PERFEITO 1500ms).
- **Escudo** (§30–§35): `shieldFx` de hit (0.32s), quebra (0.6s) e regen;
  barra em `#shbar`; eventos `onShieldBreak`/`onShieldFull` (PERFEITO ≥2.4s)
  alimentam itens e sinergias.
- **Chip PERFIL** (`#moralp`): resumo moral/domância no HUD.
- **Tooltips (§11)**: leem os modificadores REAIS do player (`p.sm`) — o
  valor exibido é sempre o efetivo, não o base.
- **Cards de item (§12)**: marcam `⟡ COMPOE` e `◆ TRANSFORMADOR`.
- `updateHUD` com throttle de 0.09s; coins via `fmtCompact`.

---

## 3. REGISTRO DE COMBATE — tecla TAB (§43+)

> ⚠️ O painel se chama **REGISTRO DE COMBATE**. A palavra "FICHA" é
> proibida no fonte de `index.html` — `tests/events.test.js` falha se
> existir qualquer ocorrência.

- **TOGGLE é o padrão (PR 11.5)**: TAB abre, TAB de novo fecha; soltar a
  tecla NÃO fecha. **HOLD continua disponível** em CONFIGURAÇÕES
  (`tabMode: 'toggle' | 'hold'`) — no hold, soltar fecha.
- **ESC fecha o Registro** com prioridade 1.5 (antes de abrir pausa) —
  nada empilha. **Se houver seleção de swap armada, ESC CANCELA a seleção
  primeiro** e um segundo ESC fecha.
- **Congela o jogo**: `state='sheet'` entra na lista `frozen` do loop —
  inimigos, timers e spawns param; input e cliques são bloqueados.
- Gamepad: D-PAD UP abre; B/START fecham.
- `resetRunWorld` esconde o registro e zera `sheetBrk/_sheetSig` — nada
  atravessa runs.
- Re-render incremental por `sheetSignature` a cada ≥0.12s.
- Seções: OPERADOR · DEFESA · OFENSIVA · MOBILIDADE · ECONOMIA · ARSENAL ·
  BUILD · MORALIDADE · ECO.
- `sheetStatRow` mostra o breakdown BASE → FLAT cru → ADD → MULT → FINAL;
  stats inativos exibem `[inativo]` com opacity .45.

---

## 4. ARSENAL DINÂMICO (§44–§66)

Cada operador tem **sua** quantidade real de slots (`CHARS[].slots`,
2–5; a arquitetura aceita qualquer N): VECTOR 4 · WRAITH 2 · BULWARK 5 ·
PYRE 3 · HARDEN 4 · NÔMADE 5 · ECHO-0 3 · REVENANT 3.

### Troca de slots no REGISTRO (TAB) — DOIS CLIQUES (§5–§8)
1. Clique num slot com arma → fica **SELECIONADO** (destaque + rótulo
   `SELECIONADO`; hint "ESCOLHA O SLOT DE DESTINO"; slots vazios viram
   "RECEBER AQUI").
2. Clique no slot de destino (com arma **ou vazio**) → **swap imediato** e
   seleção limpa. Destino vazio **MOVE** a arma (ex.: laser do slot 3 para
   o slot 1 vazio).
- Clicar de novo no slot selecionado **CANCELA** (§7).
- **ESC cancela a seleção antes de fechar** o TAB (§7).
- Sem botões "MOVER"/confirmar — dois cliques bastam.
- Slots vazios são `null` no `owned` (sobrevivem a checkpoint/Continue);
  `countWeapons` conta só armas reais; HUD/pipeline/quick switch ignoram
  buracos.

### Operações
| Operação | Função | Contrato |
|---|---|---|
| Equipar slot | `setWeaponSlot(s)` | slot inválido/vazio é ignorado; lembra `lastWi` |
| Ciclar | `cycleWeapon(dir)` | tecla **Q** (mantida; pula buracos) |
| Quick switch | `quickSwitchWeapon()` | tecla **X**; alterna com a última arma usada; sem anterior válida → cicla |
| **Swap de slots** | `swapWeaponSlots(a,b)` | permuta/move dentro de `maxSlots` (aceita destino vazio); recusa fora da faixa/iguais; operação leve (nunca recria o player) |

### Contratos do swap (§53/§57–§60/§120–§122 — todos testados)
1. **A identidade da arma ativa ACOMPANHA a arma**: `wi`/`lastWi` guardam
   identidade (não slot) — permutar slots NÃO troca a arma equipada.
2. **Estado preservado**: `fireTimer`, `beamRamp`, `dashCd`, pipeline `sm*`,
   `itemState` — nada é tocado.
3. **Anti-exploit**: martelar swap 3→1→3→1 não reseta cooldown, não altera
   dano/cadência/crítico, não duplica nem perde armas.

### Aquisição (§62–§63/§123)
- Slot vazio → `grantWeapon(wi,true)` empurra para o próximo slot livre.
- Arsenal cheio sem slot → `grantWeapon` falha; na UI o jogador escolhe
  **QUAL SLOT substituir**; `grantWeapon(wi,true,s)` substitui sem reordenar
  os outros slots. A arma substituída sai; se era a ativa/lastWi, os ponteiros
  migram para a nova.

### Save / Continue / Legacy (§65–§66/§124–§126)
- `captureCheckpoint` salva **ordem exata** dos slots + arma ativa + `lastWi`
  + `maxSlots`.
- CONTINUE restaura exatamente a mesma ordem/ativa/lastWi.
- Saves legados sem `lastWi` migram (`lastWi=wi`); arsenal de 5 slots em save
  antigo continua 5.

### Organizador
Organizador do Codex usa o mesmo `swapWeaponSlots` (up/dn); HUD de armas é
reconstruído (`buildWeaponHUD`) após qualquer mudança.

---

## 5. PADRÕES GLOBAIS

- **Estados congelados** (`frozen` no loop): `event`, `shop`, `victory`,
  `title`, `paused`, `sheet`, `sandbox`.
- Slots de teclado: Digit1–5 + Numpad1–5; Q ciclar; X quick switch; E
  especial; Space/RMB dash; LMB fogo; ESC `onGameEsc`; M mute; TAB registro;
  F1 painel do sandbox.
- Gamepad: A/LT dash · X especial · LB/RB/Y cycle · D-PAD UP registro ·
  SELECT organizador · START pausa.
- Tipografia fluida via `--fs-3xs..--fs-head`; acento do sandbox
  `#7dffc4` (verde laboratório).

---

## 6. COBERTURA POR TESTE

| Suíte | Arquivo | Foco |
|---|---|---|
| Formatadores | `tests/formatters.test.js` | §6–§10: casos do enunciado, precisão contextual, edge cases, proibição de `toFixed` em zona de UI |
| Arsenal | `tests/arsenal.test.js` | §44–§66: slots reais por operador, swap e contratos, anti-exploit, quick switch, save/continue/legacy |
| Sandbox | `tests/sandbox.test.js` | §73–§92: ver `SANDBOX_SYSTEM.md` |

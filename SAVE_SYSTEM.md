# ECHO — Sistema de Save, Slots e Runs Contínuas (PR 7.5)

> Este documento descreve a arquitetura de persistência implementada no
> PR 7.5: três slots de save independentes, migração automática do save da
> Alpha, checkpoint transacional de run e o novo fluxo de morte.
> Arquivo-fonte: bloco `SAVE SLOTS v3 + RUN CONTINUÁVEL` em `index.html`.

---

## 1. Visão geral

Antes do PR 7.5 o ECHO tinha **um único save global** (cinco chaves soltas no
`localStorage`) e **reiniciava sozinho após a morte**. Agora:

```
MORRE
  ↓
RESULTADO DA RUN (tela de morte)
  ↓
JOGADOR DECIDE
  ├── NOVA RUN
  └── VOLTAR AO MENU
```

```
ECHO
├── SAVE 1
│   ├── META (Pontos de Memória, melhorias, finais)
│   ├── PROG (estatísticas, unlocks, Codex)
│   ├── ECOS (fila de Ecos)
│   └── RUN ATIVA (checkpoint), se existir
├── SAVE 2 — idem, 100% independente
└── SAVE 3 — idem, 100% independente
```

Cada memória é uma linha temporal isolada: progresso, Ecos, desbloqueios e
operador de um save **nunca** vazam para outro.

---

## 2. Estrutura dos 3 slots (`echoSave.v3`)

Todo o SAVE DATA vive em **uma única chave** do `localStorage`:

```js
echoSave.v3 = {
  version: 3,          // versionamento do schema (ver seção 7)
  lastSlot: 1,         // último slot usado (1..3)
  slots: {
    1: {
      meta:   { mem, spd, reroll, vault, wins, endings[] },  // meta-progresso
      prog:   { kills, best, runs, seen[], ... },            // stats + unlocks
      char:   0..7,                                          // operador escolhido
      echoes: [ {v:2, trail, wave, dmgMul, ...} ],           // fila de Ecos (máx. 2)
      run:    null | { ...activeRun... },                    // checkpoint (seção 5)
      touched: true|false                                    // slot já inicializado?
    },
    2: { ... },
    3: { ... }
  }
}
```

### Global vs por-slot

| Dado | Escopo | Onde vive |
|---|---|---|
| Meta-progresso (◆ Memória, melhorias, finais) | **por slot** | `echoSave.v3 → slots[n].meta` |
| Estatísticas permanentes (`prog`) | **por slot** | `slots[n].prog` |
| Unlocks / Codex (armas, módulos, operadores vistos) | **por slot** | `slots[n].prog.seen` (+ `need()` avaliado ao vivo) |
| Operador selecionado | **por slot** | `slots[n].char` |
| Ecos (fila de 2) | **por slot** | `slots[n].echoes` |
| Run ativa (checkpoint) | **por slot** | `slots[n].run` |
| Configurações (música, shake, qualidade, autofire…) | **global (APP SETTINGS)** | `echoCfg.v1` |
| Áudio ligado/mudo | **global (APP SETTINGS)** | `echoAudio.v1` |

Configurações de aplicativo são preferências do jogador, não progressão —
por isso continuam fora do wrapper.

---

## 3. Migração do save da Alpha (uma única vez)

Jogadores da Alpha têm progresso nas chaves antigas:

| Conteúdo antigo | Chave antiga | Destino na migração |
|---|---|---|
| Meta-progresso | `echoMeta.v1` | `slots[1].meta` |
| Progressão + unlocks | `echoProg.v1` | `slots[1].prog` |
| Operador selecionado | `echoChar.v2` (ou `echoChar.v1`) | `slots[1].char` (v1 é remapeada por `CHAR_LEGACY_IDX`) |
| Ecos | `echoRuns.v1` | `slots[1].echoes` |

Regras da migração (`smMigrateLegacy()`):

1. Dispara **somente** se `echoSave.v3` não existir **e** alguma chave antiga existir.
2. Todo o conteúdo vai para o **SAVE 1**; Saves 2 e 3 nascem vazios.
3. O novo arquivo é gravado **antes** de remover as chaves antigas — se a
   gravação falhar (ex.: cota), as chaves antigas permanecem e a migração
   é tentada de novo na próxima inicialização.
4. Sucesso = chaves antigas removidas. **Nunca duplica**: sem
   `echoSave.v3` + chaves antigas simultâneas não há segundo gatilho.
5. A Alpha não tinha conceito de run ativa → `slots[1].run = null`.

---

## 4. Fluxo de telas

```
TÍTULO (E C H O)
  └─ INICIAR (Enter/clique)
      └─ SELECIONE UMA MEMÓRIA — SAVE 1 · SAVE 2 · SAVE 3
           │   cada cartão mostra: operador, melhor onda, nº de Ecos,
           │   ◆ memória e "RUN EM ANDAMENTO — ONDA nn" ou "NOVO SAVE"
           │   teclas 1/2/3 · gamepad D-Pad + A · ESC volta ao título
           └─ MENU DO SAVE
                ├── CONTINUAR RUN  (só existe se houver checkpoint válido)
                ├── NOVA RUN       (sempre; pede confirmação se houver run ativa)
                ├── VOLTAR         (volta à seleção de memórias)
                ├── seletor de OPERADOR (por slot) · ARSENAL · CONFIGURAÇÕES
                └── ESC volta à seleção
```

- **Slot vazio**: exibido como "NOVO SAVE"; ao selecionar, os dados base
  são criados **daquele slot** (`touched=true`) — os outros não são tocados.
- **`lastSlot`**: lembrado e reativado no boot para pré-visualização, mas a
  tela de seleção **sempre** aparece depois do título (nenhum pulo
  permanente; o jogador sempre sabe qual save está usando).

---

## 5. Meta vs activeRun (checkpoint)

- **META** = tudo que atravessa runs: Pontos de Memória, melhorias do
  Meta-Shop, finais descobertos, estatísticas, unlocks, Codex, Ecos.
- **ACTIVERUN** = o checkpoint da run em andamento. Existe **no máximo um**
  por slot e some quando a run termina (morte, vitória, abandono).

### Schema do activeRun

```js
run = {
  v: 1,                 // versão do schema da run (validado na carga)
  reason: 'onda',       // 'início' | 'onda' | 'loja' | ...
  at: <timestamp>,
  wave: 1..20,          // onda a retomar (spawna do início)
  runTime, kills, evCount,
  charIdx,              // operador (validado contra p.charId)
  moral: {comp, greed, viol},
  echoes: [ {trust, alive} ],           // confiança dos Ecos nesta run
  prog: { ...snapshot de prog... },     // anti-duplicação (seção 6)
  p: {
    // vitais (estado — nunca recalculados nem enchidos)
    hp, maxHp, shield, shieldMax, shieldRegen, shieldDelay,
    coins, level, xp, xpNext,
    // arsenal e módulos
    owned[], wi, maxSlots, items[], upgLog[],
    // modificadores PERMANENTES do Stat Pipeline (ids estáveis;
    // temporários — dur != null — e condicionais ficam de fora)
    sm: [ {id, stat, type, value, stacks, label} ],
    // bandeiras/contadores crus de itens, eventos e operador
    vowPoverty, vowBlood, markedUp, bigShop, freeRerolls, repairs,
    echoBoost, regen, dashCdMax, dashReflect, doubleTap, dashLong,
    phaseDash, lowHpBonus, afflictBonus, globalLifesteal, overheat,
    drones, resoPower, reactive, entropy, killDash, revives, thorns,
    harvestHeal, harvestStack, decayPerWave, shopPersonal,
    longRangeBonus, burnSpread, chainBonus, critChain, critHeal,
    dotCrit, enemyHpTax, execThreshold, frozenBonus, healAmount,
    healChance, medBoost, pickupSpd, stBoost, stDurMul, virulent,
    wraithRush, slowAura
  }
}
```

---

## 6. Política de checkpoint (escolha documentada)

**Checkpoint transacional por fronteira de onda.** O jogo NÃO serializa o
frame (posição, projéteis, inimigos, partículas). Grava-se somente em
pontos seguros, fora de combate:

1. **Início da run** — checkpoint apontando para a onda 1 (a run já é
   retomável antes de a primeira onda spawnar).
2. **Início de cada onda** — dentro de `spawnWave()`, incluindo a onda do
   chefe. Este é o momento em que tudo que aconteceu até então (loja da
   onda anterior, escolhas, danos) já está consolidado.
3. **Cada transação concluída da loja** — upgrade, módulo, arma, reparo e
   reroll gravam um checkpoint apontando para a **próxima** onda (ela ainda
   não começou). Compras nunca se perdem e nenhuma loja pode ser repetida.

### Por que NÃO salvar no meio da onda

Level-ups, créditos, abates e escolhas de evento acontecem durante o
combate. Se fossem consolidados no checkpoint, fechar e reabrir o jogo
repetiria a onda **mantendo** os ganhos parciais — ou seja, seria possível
coletar a mesma recompensa duas vezes. Pela política escolhida, o ganho só
vira "oficial" no checkpoint da onda seguinte:

- retomar devolve **exatamente** o estado do checkpoint (build, HP, Shield,
  moeda, onda);
- a onda do checkpoint é **rejogada do início**;
- nenhum inimigo, baú ou loja rende duas vezes na linha do tempo final;
- o snapshot de `prog` dentro do checkpoint faz contadores permanentes
  (abates, críticos, dashes…) voltarem ao estado gravado, então um trecho
  rejogado também não infla desbloqueios.

Escolhas de evento resolvidas no meio da onda seguem a mesma regra: só se
consolidam na próxima fronteira (decisão consciente: consistência primeiro —
o beacon de evento reagenda normalmente).

### Retomada (`resumeRun`)

1. Mundo limpo (`resetRunWorld`), moral restaurada, `prog` restaurado.
2. `makePlayer()` do operador do slot → campos de estado restaurados por
   cima (HP/maxHp, Shield/shieldMax, moeda, nível/XP, arsenal, módulos,
   bandeiras) → lista de modificadores permanentes substitui a recém-nascida
   → `smRefresh()` recalcula os derivados.
3. Ecos reconstruídos do slot com a confiança do checkpoint.
4. `spawnWave(wave)` com a flag `smRestoring`: mecânicas de "início de
   onda" já cobradas quando o checkpoint foi consolidado (ex.: fome do
   REVENANT) **não são cobradas de novo**, e o checkpoint original não é
   reescrito.

### O que NÃO é restaurado (de propósito)

| Dado | Motivo |
|---|---|
| Posição do jogador, inimigos, projéteis, partículas | política de checkpoint (fronteira de onda), não frame exato |
| Trajetória do Eco (`recorder`) gravada até o checkpoint | volume (centenas de KB por run); o Eco da run passa a gravar a partir da retomada |
| Modificadores temporários (Maldição do Oráculo, `dev.speed`) | expiram sozinhos; persistir os tornaria permanentes |
| `spKind`/`spT`/`spCd` (especial), i-frames, dash, buffs de segundos | estado transacional de combate |
| Ofertas visíveis da loja / rerolls não pagos | a retomada acontece fora da loja; compras pagas já estão no checkpoint |
| Escolha de evento não concluída | o beacon reagenda; nada é concedido sem escolha confirmada |

### HP/Shield (máximo ≠ atual)

HP e Shield são **estado**: restaurados com os valores exatos do checkpoint
e clampados aos respectivos máximos salvos (`maxHp`/`shieldMax` também são
salvos). Nada é "enchido de graça" ao recarregar stats — o Stat Pipeline
só reconstrói **derivados** (dano, cadência, crítico…), nunca vitais.

---

## 7. Versionamento

- `echoSave.v3.version = 3` — versão do schema de slots.
- `run.v = 1` — versão do schema da activeRun.
- Cargas validam versão **antes** do conteúdo; formato desconhecido é
  tratado como inválido (seção 10), nunca interpretado "por sorte".
- Migrações futuras: acrescentar `version: 4` + função de conversão
  `v3 → v4` em `smLoadRoot()`, mantendo o mesmo contrato.

---

## 8. Fluxo de morte (novo)

`onPlayerDeath()`:

1. Fecha a progressão da run normalmente (`runs`, ondas, créditos, recorde,
   unlocks → `saveProg`).
2. Gera o Echo normalmente (regra dos 2 Ecos → `saveEchoes` no slot atual).
3. **`clearActiveRun()`** — a run morreu; não existe "continuar".
4. Tela de morte (CICLO FRATURADO) com **NOVA RUN** (Enter/clique/gatilho A)
   e **VOLTAR AO MENU** (ESC/B/botão).

**Nenhum auto-restart.** O antigo `if(fracT>2.6) beginNextRun()` no loop de
update foi removido; `tickFracture()` apenas anima a fratura. Auditar de
novo se algum dia algo chamar `startRun()` sem clique — os caminhos válidos
hoje são: tela de morte (NOVA RUN), menu do save (NOVA RUN/CONTINUAR),
tela de vitória (INICIAR NOVO CICLO) e DEV.

---

## 9. Fluxos de NOVA RUN e CONTINUAR RUN

- **CONTINUAR RUN**: disponível apenas com checkpoint válido; carrega o
  save, restaura o estado e spawna a onda do checkpoint.
- **NOVA RUN sem run ativa**: inicia direto.
- **NOVA RUN com run ativa**: confirmação ("Existe uma run em andamento.
  Iniciar uma nova run irá encerrar a run atual." — CANCELAR / INICIAR NOVA
  RUN). Confirmar **apaga apenas o estado da run** (`clearActiveRun`);
  meta, Ecos, unlocks e Codex do slot ficam intactos.
- **MENU PRINCIPAL (pausa)**: agora é "SALVAR E SAIR PARA O MENU" — o
  último checkpoint permanece e o jogador volta ao menu do save
  (CONTINUAR RUN disponível). Quem quer encerrar a run de propósito usa
  **ABORTAR RUN** (vira Echo·01, tela de morte) — comportamento antigo
  preservado.
- **Vitória**: `onVictory()` limpa `activeRun` — nenhum save fantasma.

---

## 10. Save inválido / corrompido

- A raiz é validada campo a campo (`smSanitizeSlot`/`smSanitizeRun`).
- **activeRun inválida** (incompleta, versão errada, arsenal quebrado, HP
  impossível): apenas a run é descartada — meta, prog, char e Ecos do slot
  preservam-se; o jogo segue normalmente.
- **Slot malformado**: reconstruído como vazio, sem tocar os outros.
- **`echoSave.v3` ilegível**: cai no fluxo de migração (se as chaves da
  Alpha ainda existirem) ou cria raiz nova. Nunca explode, nunca apaga os
  três slots por culpa de uma run.
- Operador divergente entre `charIdx` e `p.charId` → run descartada com
  aviso no console.

---

## 11. DEV MODE / devTainted

- `DEV_MODE` continua `false` por padrão; build release continua inerte;
  `devTainted` continua funcionando exatamente como antes.
- O taint agora também cobre o **checkpoint**: `captureCheckpoint()`
  retorna `false` em run depurada — run de DEV não gera checkpoint, não
  vira Echo, não grava prog/meta nem recordes, e ao trocar de slot os
  dados sujos em memória são descartados sem nunca tocar o disco.
- Morte em run DEV limpa a activeRun do slot (a run acabou); nenhum dado
  legítimo é produzido.

---

## 12. Como adicionar um campo persistente no futuro

1. **Meta-progresso novo** → acrescente em `meta={...}` + `loadMeta()` +
   migração (`smMigrateLegacy`, se aplicável). Nada mais muda.
2. **Stat derivado novo** → use o Stat Pipeline (PR 7). Modificadores
   permanentes criados com `smAdd/smMul/smFlat/smAddPct` (ids estáveis,
   sem `dur`) já entram no checkpoint automaticamente via `p.sm`.
3. **Estado cru novo do player** (ex.: nova bandeira de módulo/evento):
   1. inicialize em `makePlayer()`;
   2. adicione em `smBuildCheckpoint()` (seção `p:{...}`) com default
      neutro (`||0`, `||1`, `!!`);
   3. adicione a linha correspondente em `resumeRun()`;
   4. se fizer sentido, cubra com um teste em `tests/saveslots.test.js`
      (salvar → recarregar → valor idêntico).
4. **Campo novo na activeRun** → incremente `run.v` e trate a versão
   antiga em `smSanitizeRun()` (campos ausentes recebem default; nunca
   invalide a run inteira por campo benigno faltando).
5. **Configuração global** (não é progressão) → `cfg`/`saveCfg()`
   (`echoCfg.v1`); não coloque em `echoSave.v3`.

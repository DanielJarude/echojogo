# PR 11 — ITEM & BUILD REWORK + SHIELD EXPANSION — Auditoria Real

> Esta auditoria foi conferida contra o código de produção em
> `index.html` na versão desta PR. É a implementação, não um plano.

## Baseline verificado

- Branch de trabalho: `arena/01a06088-echojogo` (fixada pela sessão; base = `d81aa55`).
- `index.html`, `main.js`, `preload.js`, `package.json`, `tests/` presentes.
- Baseline inicial: 12 suites atuais após adição da suíte PR 11; antes da PR 11 eram 11 suítes, 649 assertions/checks, 0 falhas.
- Após PR 11: **681 assertions/checks, 0 falhas** (30 novos na suíte de build + 2 novos em save slots; nº de suites = 12).

## O que existia antes

- 8 operadores, Shield base, Echo Guardian/Disruptor, Resonance/Micro,
  Dissonance 2.0, Stat Modifier Pipeline, 3 save slots, Continue Run,
  Echo personalities, Moralidade 2.0, relação Player↔Echo, eventos e finais
  expandidos, configurações para limpar Echo/save. Tudo preservado.

## O que mudou na fonte de produção (`index.html`)

1. `SM_STATS` agora inclui `shieldMax`, `shieldRegen`, `shieldDelay`.
2. `makePlayer` inicializa `_smBase` de Shield e `player.itemState`.
3. Camada central de hooks: `itemEmit(type, ctx)`, `itemTick`, cache de
   handlers, pilha de proc, orçamento por frame.
4. Tabela `ITEM_TAG_MAP` + helper `itemTags/itemHasTag`.
5. Catálogo novo de 22 itens (com `rar` explícito).
6. Hooks conectados em: `damageEnemy`, `killEnemy`, `damagePlayer`,
   `applyStatus`, `tryDash`, `updatePlayer`, `regenPlayerShield`,
   `triggerResonance`, `updatePickups`.
7. `effectivePierceItem` e `consumeCritLock` usados em `fireWeaponFrom`
   e `fireMelee`.
8. Eventos/operadores que alteravam Shield migrados para `smFlat` estável.
9. Save/Continue: `itemState` no checkpoint e restore; fallback legado.
10. DEV: `addItem`, `removeItem`, `clearBuild`, `buildPreset`,
    `buildInspector`, `buildDebug`; painel com Build Inspector e presets.
11. UI: tooltip de item, sinergias no pause, HUD `PERFEITO`.

## Hooks implementados e locais

| Hook | Local de emissão |
|---|---|
| `onHit` | `damageEnemy` (acerto direto do player) |
| `onCrit` | `damageEnemy` (bloco `crit`) |
| `onKill` | `killEnemy` (abate direto do player) |
| `onDamageTaken` | `damagePlayer` (após Shield/HP) |
| `onShieldHit` | `damagePlayer` (quando `absorbed>0`) |
| `onShieldBreak` | `damagePlayer` (quando `shieldBroke`) |
| `onShieldFull` | `itemTick` (Perfect Shield) |
| `onDash` | `tryDash` |
| `onDashEnd` | `updatePlayer` (fim do `dashT`) |
| `onStatusApply` | `applyStatus` (status vindo do player) |
| `onPickup` | `updatePickups` (moedas/kits) |
| `onResonance` | `triggerResonance` + micro-resonância |

## Itens

- **Preservados**: todos os IDs antigos (compatibilidade de save).
- **Reworkados**: `olho` (entra no crit build), `placa` (conversa com Shield
  pipeline), eventos de Shield.
- **Mesclados/removidos**: nenhum ID removido.
- **Novos**: 22.
- **Transformadores**: 5 (`trans_fratura`, `trans_ressonante`,
  `trans_conclusao`, `trans_temporal`, `trans_espectral`).

## Extremos testados

- MAX SHIELD, MAX SHIELD REGEN, MAX CRIT, MAX DAMAGE, MAX ECONOMY, MAX CONTROL.
- Protocolo de limite: build de Shield no BULWARK não cria regen ilimitado
  (regen continua limitado à taxa derivada).
- WRAITH com Shield baixo + quebra: cooldowns e orçamento de proc impedem loop.
- Performance: `itemEmit` com 0 handlers é `O(1)` (teste 5.000 emissões).

## Coincidência de critérios de conclusão

- Código de produção modificado: sim.
- Hooks existem e estão conectados: sim.
- `player.itemState`: sim.
- Shield Break: sim (3 itens + build rota).
- Full/Perfect Shield: sim.
- Shield stats via pipeline: sim.
- Itens reworkados: sim.
- Crit/Status/Dash/Economy builds: sim.
- Transformadores: sim.
- Trade-offs: sim.
- Save/Continue: sim.
- Legacy: sim.
- DEV Inspector: sim.
- DEV presets: sim.
- Testes novos: `tests/items-build-rework.test.js` + 2 testes em
  `tests/saveslots.test.js`.
- Smoke manual: pode ser executado via `npm start` (Electron) e DEV panel.

## Limitações honestas

- `removeItemById` remove IDs, estado, sintonia e modificadores de stat;
  mutações **diretas** de `maxHp/regen/dashCdMax` de itens pré-PR 11 são
  best-effort (não há log reversível para elas).
- `applyBuildPreset` é ferramenta DEV e redefine a build pelo caminho
  `makePlayer` (contamina e resetar HP/Shield é aceito para teste).
- A camada de hooks é síncrona e sem EventEmitter; não há suporte a
  cancelamento/prioridade complexa entre handlers além de chave/budget.

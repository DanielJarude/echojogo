# ECHO — ITEM SYSTEM (PR 11)

> Documentação da implementação REAL. Qualquer comportamento descrito aqui
> está implementado em `index.html` e coberto em `tests/items-build-rework.test.js`.

## 1. Filosofia

Itens deixam de ser apenas percentuais de stat e passam a mudar **como a run é
jogada**. As rotas emergentes são:

- **ESCUDO · QUEBRA** — romper o Shield vira gatilho.
- **ESCUDO · PERFEITO** — manter o Shield cheio gera uma janela.
- **ESCUDO · REGEN** — regen/delay/max entram no pipeline.
- **CRÍTICO** — críticos consecutivos, crítico após condição, bloqueio de crit.
- **STATUS · ELEM.** — burn/chill/corrode reagem entre si.
- **DASH · MOVIMENTO** — dash/pós-dash transformam a próxima ação.
- **ECONOMIA · RISCO** — moedas sobem, mas a build paga em poder/defesa.
- **TRANSFORMADOR** — itens que alteram perceptivelmente o loop da run.

Não há *set* obrigatório (ex.: “SHIELD SET 2/4/6”). A sinergia emerge da
interação entre tags/hooks.

## 2. Arquitetura

### 2.1 Hooks centralizados

```js
itemEmit(type, ctx)
```

- Handlers ativos são cacheados por versão do inventário (`player.itemVer`).
- Evento dispara apenas handlers de itens realmente instalados.
- `type` implementados: `onHit`, `onCrit`, `onKill`, `onDamageTaken`,
  `onShieldHit`, `onShieldBreak`, `onShieldFull`, `onDash`, `onDashEnd`,
  `onStatusApply`, `onPickup`, `onResonance`.
- Handlers DEVOLVEM um proc opcional (`{emit, emitCtx}`), centralizando o nó.

### 2.2 Proteção de recursão

- Profundidade máxima de `4`.
- **Orçamento por frame** (`player._itemProcBudget`) com teto baseado no
  número de itens.
- **Chave de proc** `type:itemId:target` impede o mesmo item procar o mesmo
  alvo no mesmo ciclo.
- Procs que matam inimigos rodam com `curAttacker = null`, portanto **não**
  re-entram no gatilho `onKill`.

### 2.3 Estado de build

Todo estado vivo fica em `player.itemState`:

```js
{
  [itemId]: {
    cd: 0,          // cooldown (decrementado em itemTick)
    stacks: 0,      // stacks de build
    critLock: 0,    // pròximo tiro crítico consumível
    pierceT: 0,     // perfuração temporária
    dashT: 0,       // janela temporária de dash
    ...
  },
  _perfect: { t, fired } // estado Perfect Shield
}
```

Não há propriedades soltas espalhadas pelo player para PR 11.

### 2.4 Tags internas

Cada item tem um vetor de `tags`. As tags não são sets obrigatórios; são
consumidas por DEV/organização/sinergia (ex.: `activeSynergies`).

Tags em uso: `shield`, `shield_break`, `shield_full`, `shield_regen`,
`shield_max`, `crit`, `crit_build`, `status`, `burn`, `chill`, `corrode`,
`shock`, `control`, `dash`, `movement`, `projectile`, `pierce`, `aoe`,
`economy`, `risk`, `tradeoff`, `low_hp`, `execute`, `resonance`, `echo`,
`transformer`, `hp`, `sustain`, `heal`, `destroy`, `fire_rate`, `thorns`,
`pickup`, `ranged`, `distance`.

## 3. Stat Modifier Pipeline

Todo efeito numérico usa `smAdd/smMul/smFlat/smAddPct`, com IDs estáveis.

O `SM_STATS` ganhou três stats derivados:

```js
shieldMax   // teto, clampado
shieldRegen // unidades/s
shieldDelay // segundos
```

Regra: `shape` (**state**) nunca é preenchido por alteração de `shieldMax`.
`smRefresh` apenas clampou `player.shield` ao novo teto. Eventos/operadores que
davam `+N` de Shield máximo foram migrados para `smFlat` com IDs estáveis
(`event.camara.shieldMax`, `event.gerador.shieldMax`, `event.op.vector.shieldMax`,
`event.op.bulwark.shieldMax`, etc.).

## 4. Shield Break

Gatilhos reais, com cooldown interno:

- `sb_pulso` — pulso AoE.
- `sb_janela` — janela ofensiva (+dano/+crit por 4s).
- `sb_grilhao` — aplica controle (gelo/atordoamento).
- `trans_fratura` — transformador: perfuração por 3s.

Nenhuma dessas procs re-entra em `onShieldBreak` por regeneração. O `itemTick`
controla `cd`, e o Perfect Shield é zerado no primeiro acerto no Shield.

## 5. Perfect / Full Shield

- Shield cheio por `PERFECT_SHIELD_SECONDS` (2,4s) ativa `onShieldFull`.
- Qualquer dano no Shield zera `_perfect`.
- HUD: `#shbar.perfect` (classe `PERFEITO`).
- Itens:
  - `fs_prisma` — próximo tiro crítico.
  - `fs_casulo` — controle + cura.
  - `fs_cinetica` — velocidade + dash mais rápido.

## 6. Items existentes → categorias

| Ação | Itens |
|---|---|
| Preservados | `nucleo`, `lente`, `coracao`, `iman`, `placa`, `olho`, `paradoxo`, `luneta`, `estilhaco`, status/identidade existentes, `su_*`, upgrades |
| Reworkados (mesmo ID, novo comportamento) | `placa` passa a conversar com Shield; `olho` participa do crit build. Ficam os IDs antigos para compatibilidade de save. |
| Merge/removidos | nenhum ID foi removido nesta PR — preservação de compatibilidade |
| Novos PR 11 | ver seção 7 |

## 7. Itens novos

**Shield Break:** `sb_pulso`, `sb_janela`, `sb_grilhao`
**Full Shield:** `fs_prisma`, `fs_casulo`, `fs_cinetica`
**Shield pipeline/regen:** `rg_condensador`, `rg_peso`, `rg_lagrima`
**Crit:** `crit_cadeia`, `crit_garra`
**Status:** `st_inverno`, `st_corrosivo`
**Dash:** `dash_eco`, `dash_fase`
**Economia:** `eco_risco`, `eco_divida`
**Transformadores:** `trans_fratura`, `trans_ressonante`, `trans_conclusao`,
`trans_temporal`, `trans_espectral`

## 8. Trade-offs

Todos os itens novos deixam o custo explícito no tooltip:

- `rg_condensador`: +70% regen, +35% delay, −10% max.
- `rg_peso`: +45% max, −30% regen, −10% delay.
- `eco_divida`: +100% moedas, −30% Shield max, +14% dano recebido.
- `crit_cadeia`: +4% crit mas −15% dano base; stacks adicionais vazam em dano.
- `trans_fratura`: perfuração após quebra, pagando 20% de Shield max.
- `dash_eco`: dano pós-dash, pagando −8% velocidade.

## 9. Save / Continue / Legacy

- Persiste: IDs de itens, fontes (`sm`), `itemState` relevante.
- Não persiste: stats finais.
- Save antigo sem `itemState`: `{}` via fallback.
- Save antigo com Shield alterado diretamente (pré-PR 11): é preservado como
  base caso o save não contenha modificadores de Shield no pipeline.
- Slots: `itemState` vive dentro do checkpoint do slot ativo; zero contaminação.

## 10. DEV

- `DEV.addItem(id)` / `DEV.removeItem(id)`.
- `DEV.clearBuild()`.
- `DEV.buildPreset(key)`.
- `DEV.buildInspector()` / `DEV.buildDebug()`.
- Presets: shieldbreak, fullshield, crit, status, dash, economy, shieldmax,
  shieldregen, damage, maxcrit, controle.
- Inspetor mostra: itens, tags, hooks, stacks, cooldowns, itemState, stat
  modifiers, moral affinity, sinergias.
- Todo uso DEV contamina a run (`devTainted`).

## 11. UI

- Tooltip dos itens na loja: condição + efeito + trade-off + tags + hooks.
- Pause: “SINERGIAS ATIVAS” (linguagem humana).
- HUD: `PERFEITO` no Shield quando Perfect Shield estiver ativo.

# STAT MODIFIERS — Arquitetura central de modificadores (ECHO · PR 7)

> PR de FUNDAÇÃO. Comportamento perceptível do jogo **não muda**: o jogador que
> carregar o mesmo save, escolher o mesmo operador e montar a mesma build joga
> exatamente como antes. Este documento explica a arquitetura para os próximos PRs
> (Personalidade, Moralidade 2.0, Relação Player↔Echo, Shield, Facções etc.).

---

## 1. Problema que resolve

Antes, os stats eram mutados **diretamente** em dezenas de lugares:

```js
player.dmgMul *= 1.30;      // módulo
player.dmgMul *= 1.14;      // upgrade
player.dmgMul *= 1.12;      // evento
if (p.curseT > 0) mul *= .70;  // maldição
```

Consequências:
- impossível responder "por que meu dano é 137?";
- multiplicadores irreversíveis (remover = tentar dividir, acumulando erro);
- a **base** do stat era destruída conforme o tempo passava;
- bônus temporários e permanentes misturados no mesmo campo;
- ordem de aplicação inconsistente e lógica duplicada.

## 2. Conceito

Separa-se conceitualmente:

```
BASE  +  FLAT  +  ADD(%)  +  MULT  +  OVERRIDE  +  CONDITIONAL  →  FINAL
```

- **BASE** — valor imutável capturado no nascimento do player (`p._smBase`). Nunca é reescrito.
- **FLAT** — soma fixa (ex.: `+22% de crítico` = `crit + 0.22`).
- **ADD(%)** — bônus percentual **aditivo** (dois `+15%` = `+30%`, não `×1.3225`).
- **MULT** — multiplicador (ex.: `×1.30`). Empilha multiplicativamente.
- **OVERRIDE** — substitui o resultado inteiro (uso raro; só se realmente necessário).
- **CONDITIONAL** — avaliado no momento da leitura via `cond(p)`.

Os campos derivados do player (`p.dmgMul`, `p.fireRateMul`, `p.crit`, …) são
**recalculados** a partir da base + a lista de modificadores sempre que um
modificador muda — nunca por multiplicações espalhadas que corrompem a base.

## 3. Stat ≠ State

- **Stat** = valor derivado, recalculável: `maxHp`, `shieldMax`, `dmg`, `crit`…
- **State** = estado do jogo, preservado: `hp`, `shield` (atual), timers.

Recalcular um stat **nunca** enche estado de graça. Ao recalcular:
- `hp` é apenas **clampeado** a `maxHp` (não curado);
- `shield` atual é apenas **clampeado** a `shieldMax` (não enchido).

Exemplo de comportamento legado preservado: comprar `BLINDAGEM MODULAR`
(`+25 maxHp`) cura 25 — isso é um acréscimo de maxHp e continua igual. Reduzir
maxHp (ex.: `NÚCLEO −15%`) apenas **clampa** o HP para baixo, sem curar.

## 4. Operações e ordem

Ordem determinística declarada em `SM_ORDER`:

```
1. FLAT        (soma)
2. ADD (%)     (soma percentual → ×(1 + Σ))
3. MULT        (produto)
4. OVERRIDE    (substituição)
5. CONDITIONAL (filtro aplicado em cada modificador no get)
6. CLAMP       (limites mín/máx por stat)
```

Duas runs com os mesmos modificadores produzem o mesmo resultado,
independentemente da ordem de aquisição, quando a regra de stacking permitir
(ver §6). Isso é garantido porque o cálculo sempre parte da **base**, não de
um valor acumulado.

## 5. API central

| Função | Descrição |
|---|---|
| `smAdd(p, m)` | registra um modificador. `m = {id, stat, type, value, dur?, cond?, stacks?, label}` |
| `smMul(p, stat, id, label, value)` | atalho para `type:'mult'` |
| `smFlat(p, stat, id, label, value)` | atalho para `type:'flat'` |
| `smAddPct(p, stat, id, label, value)` | atalho para `type:'add'` (`value=0.15` ⇒ `+15%`) |
| `smRemoveId(p, id)` | remove todos os modificadores com o id e recalcula |
| `smRemoveSource(p, source)` | remove todos os modificadores de uma origem e recalcula |
| `smHas(p, id)` | verifica existência |
| `smGet(p, stat)` | valor final (avalia condicionais e clamps) |
| `smBreakdown(p, stat)` | `{base, lines[], final}` — explica o cálculo |
| `smRefresh(p)` | recalcula todos os stats derivados a partir da base + modificadores |
| `smTick(p, dt)` | avança o relógio e expira modificadores temporários |

## 6. Stacking

Política definida por `m.stacks`:

| Política | Comportamento |
|---|---|
| `stack` (padrão) | múltiplas entradas com o mesmo `id` **acumulam** |
| `replace` | adicionar substitui as entradas com o mesmo `id` |
| `unique` | impede duplicata do `id` |
| `refresh` | reaplica o timer de modificadores temporários do mesmo `id` |

> Regra de ouro: **não mude silenciosamente o stacking existente.** Se o jogo
> permitia dois `+30%` somando, o pipeline (com `stack`) preserva isso.

## 7. IDs de modificadores

Todo modificador persistente tem **identidade estável**:

```
operator.bulwark.dmgTaken
module.nucleo.damage
module.olho.crit
upgrade.dmg.damage
upgrade.rate.rate
event.sobrevivente.damage
reward.duelo.damage
status.oracle_curse.damage
level.damage
```

Isso permite adicionar / remover / substituir / inspecionar sem depender de
multiplicações irreversíveis.

## 8. Modificadores temporários

Um modificador com `dur` (segundos) expira automaticamente via `smTick` e é
removido, recomputando o stat a partir da base — **sem** "desfazer" multiplicação.

Exemplo canônico — **Maldição do Oráculo** (`−30% de dano por 6s`):

```js
// aplicar (Oráculo / DEV curse)
p.curseT = 6;
smMul(p, 'damage', 'status.oracle_curse.damage', 'MALDIÇÃO DO ORÁCULO −30% DANO', .70);
```

`curseT` continua sendo o estado/duração; o efeito de dano é um modificador.
Quando `curseT` zera no `updatePlayer`, o modificador é removido e o dano
volta **exatamente** ao valor anterior.

## 9. Modificadores condicionais

Suporte simples via `cond(p)` (recebe o player, devolve `bool`). Avaliado no
`smGet`/`smBreakdown`/`calcDamageMul` no momento da leitura.

```js
smAdd(p, {id:'future.shield_full.damage', stat:'damage', type:'mult',
  value:1.15, label:'SHIELD CHEIO +15%', cond:q=>q.shield>=q.shieldMax});
```

> Ainda **não** existem condicionais de gameplay na produção (Shield cheio,
> HP baixo, confiança, moralidade, facções ficam para PRs futuros). A
> arquitetura já os suporta sem reescrita.

## 10. Como adicionar um NOVO stat

1. Adicionar entrada em `SM_STATS` (perto da definição do pipeline):
   ```js
   meuStat:{set:(p,v)=>p.meuCampo=v, base:o=>o.meuBase, cl:[min,max], lab:'MEU STAT'}
   ```
2. Gravar a base imutável em `p._smBase.meuBase` no `makePlayer`.
3. Usar `smMul/smFlat/smAddPct` para modificar.

## 11. Como adicionar um NOVO modificador

```js
smMul(player, 'damage', 'module.meu_id.damage', 'MEU MÓDULO +15% DANO', 1.15);
```

Use o prefixo da origem (`module.`, `upgrade.`, `operator.`, `event.`,
`status.`, `reward.`, `level.`).

## 12. Integração com DEV MODE

O painel de DEV MODE ganhou a seção **STAT INSPECTOR** (exclusiva de DEV).
Seleciona um stat (Dano, Velocidade, Cadência, Crítico, etc.) e mostra:

```
BASE   1
NÚCLEO +30% DANO        ×1.30
LENTE −12% DANO         ×0.88
FINAL  1.144
```

- `BASE`, `MODIFIERS` e `FINAL` são exibidos com o breakdown real.
- Condicionais inativos aparecem riscados com `[INATIVO]`.
- Modificadores temporários mostram o tempo restante `(Ns)`.
- `STAT INSPECTOR` só existe com `DEV_MODE` ativo (as proteções do PR 6.5
  continuam intactas: `DEV_MODE=false` por padrão, `IS_DEV_BUILD` exigido,
  `devTainted` protege progressão).

## 13. Stats migrados para o pipeline

| Stat | Campo derivado | Base | Tipo usado |
|---|---|---|---|
| Dano | `p.dmgMul` | `C.dmg` (operador) | mult |
| Cadência | `p.fireRateMul` | `C.rate` | mult |
| Crítico | `p.crit` | `C.crit` | flat |
| Dano Crítico | `p.critMul` | `1.8` | flat |
| Alcance | `p.rangeMul` | `1` | mult |
| Vel. Projétil | `p.projSpdMul` | `1` | mult |
| Área | `p.aoeMul` | `1` | mult |
| Velocidade | `p.speed` | `C.speed*(1+.05*meta.spd)` | mult |
| Raio Coleta | `p.pickupR` | `170` | mult |
| Moedas | `p.coinMul` | `1` | mult |
| Dano Recebido | `p.dmgTakenMul` | `1` | mult |
| Perfuração | `p.pierce` | `0` | flat |

## 14. Stats NÃO migrados + motivo

- **`maxHp`** — tem comportamento de estado acoplado (cura no acréscimo,
  clamp na redução) e dezenas de mutações de evento/fratura. Mantido como
  campo direto para **preservar o balanceamento exato**. O inspector reporta
  base/derivado de catálogo quando aplicável; mutações de run são notadas.
- **`shieldMax`/`shieldRegen`/`shieldDelay`** — hoje só o operador define e o
  DEV as altera; sem itens/upgrades de Shield ainda. Mantidos diretos até o PR
  de expansão do Shield.
- **`hp`/`shield` (atuais)** — são **state**, nunca pipeline.
- **Dash recarga (`dashCdMax`)** — não é um stat de combate listado; mantido
  direto.
- Efeitos de evento/mecânica (lifesteal, execução, burnSpread, drones,
  chain, etc.) — **categorias B–E** (event hook / stateful / utility) que
  ficam nos seus sistemas, não viram "stats" artificiais.

## 15. Operadores / Módulos / Upgrades

- **Operadores migrados (stat puro):** `bulwark.dmgTaken` (×0.78), `nomad.coin`
  (×1.45). O resto dos operadores já eram efeitos de gameplay e continuam diretos.
- **Módulos migrados (categoria A):** nucleo, lente, coracao, iman, placa(speed),
  olho, luneta, estilhaco, catalis(dmgTaken), colmeia(rate), usura(coin),
  carapaca(speed), prisma2(damage), espinho(dmgTaken), su_imante(pickupR),
  su_critcura(crit).
- **Módulos mantidos como mecânica (B–E):** rebob, paradoxo, pirostase,
  criostase, condutor, ferrao, sifao, reator, espectro, vingança, entropia,
  ressonador, ampulheta, talisma, su_vampiro, su_regen, su_sorte, su_exec,
  su_dotcrit.
- **Upgrades migrados (categoria A):** crit, critd, rate, range, magnet, dmg,
  aoe, range2, pierce, critx, sprint, dmg2, rate2, pierce2, omni, singul.
- **Upgrades mantidos:** dash, vamp, hp (maxHp), etc.

## 16. Eventos/upgrades de level migrados

Todos os ganhos persistentes de eventos, fratura, duelos e level-up que eram
`player.dmgMul*=…` agora passam pelo pipeline com id estável
(`event.*`, `reward.*`, `level.*`). Nenhum número mudou.

## 17. Performance / cache

- **Dirty-flag:** `smAdd/remove/tick` chamam `smRefresh`, que recalcula **só**
  quando um modificador muda (e a lista é pequena — tipicamente < 20).
- `smGet` reavalia condicionais ao vivo (custo trivial).
- Não há reconstrução de arrays por frame; `smTick` só varre `p.sm` para expirar
  temporários.

## 18. Compatibilidade de save

- O player **não é serializado** no localStorage; só as runs de Echo
  (`dmgMul`, `frMul`, `crit`, …). Esses campos continuam sendo os derivados
  finais do pipeline — o formato de save **não muda**.
- Nenhuma migração de schema necessária. `mods` são runtime-only.

## 19. Testes

`tests/statmods.test.js` cobre: add/remove/replace/stack/refresh/unique, flat,
add, mult, override, clamp, condicional, temporário/expiração, determinismo,
base preservada, breakdown, cache/dirty, e **equivalência** (pipeline == modelo
antigo) para builds representativas.

Rodar:

```
npm test
```

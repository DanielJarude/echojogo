# PR13.5 · B3-FIX — correções da auditoria independente do Bloco 3

Branch: `arena/01a06ff3-echojogo` · base: `b2d63cf` (B3 + auditoria) · `SM_VERSION=3` (sem bump) · `FRACTURE_STATE_VERSION=1` · `package.json 0.7.0-alpha`.

Escopo: **somente** os achados da auditoria (`PR13_5_AUDIT.md §26`). Nada de B4/Sintonia/bosses. Personalidade, relacionamento, dissonância, confiança e moralidade **não foram tocados**.

---

## 1. Correções

| # | Achado | Correção | Onde |
|---|---|---|---|
| 1 | Anti-repeat de **armas** não funcionava: `shopWeaponPool()` devolve **índices**, e o peso pedia `o.id` → `shopRepeatWeight(undefined)` = 1 sempre. | `pickWeightedAny(wp, wi=>shopRepeatWeight(WEAPONS[wi].id))`. RNG, raridade, elegibilidade e unlocks intactos; não há ban nem rotação. | `rollShop` |
| 2 | `SHOP_RECENT_MAX=12` era arbitrário: um único bigShop (10 ofertas) + reroll já expulsava a "penúltima visita" (d=1). | Dimensionado a partir da loja: visita normal = 7 ofertas (3 upg + 2 mód + 2 armas), bigShop = 10; janela pretendida = d=0 + d=1 sobrevivendo a 1 reroll com bigShop ⇒ 3 lotes × 10 = 30 → **32** (folga, ainda ~3 lotes; nunca penaliza meia run). Uso medido (300 runs, bigShop a cada 4 ondas, reroll em ondas pares): d=0 50,7 % · d=1 31,6 % · d≥2 17,7 %, comprimento máx. 32. | `SHOP_RECENT_MAX` |
| 3 | Echo perdia a separação melee×ranged do B2: `runData` gravava só `rangeMul` (=1 para Luneta) e `makeEcho` fazia `meleeRangeMul=rangedRangeMul=rangeMul` → Eco com Luneta atirava a 760 em vez de 1292. | `runData`, `saveEchoes` (slim) e `makeEcho` carregam `meleeRangeMul`/`rangedRangeMul`; `rangeMul` continua gravado para compat. `echoRangeField()` faz fallback **snapshot antigo → rangeMul → 1**. Echo Equipment (`echoEqInit/Refresh`) ganha `eqBase.mrange/rrange` (eqBase antigo cai em `range`). Sem bump de `SM_VERSION` (campos opcionais). | ~3450, ~3925, ~16190, ~21700 |
| 4 | Item Identity: `critx`, `dmg2`, `rate2` dominavam por crédito as versões simples; `omni` era universal sem custo; `singul` era "omni com mobilidade". | Price pass individual + 1 trade-off (tabela §3). Itens simples ficaram simples. Catálogo continua com 19 upgrades. | `UPGRADES` |
| 5 | Range revalidado (Luneta/Estilhaço/range/range2) para jogador **e** Eco. | Testes FIX-3 (6 casos). | — |
| 6 | Economia: após o B3 Greed (perfil C) comprava **menos** que Neutro (0,90×) e trocava 3,45× de renda por 34 % CAN_ALL. | Auditoria por multiplicador (§4): `shopWaveMul` **intacto**; `moralMarketMul` 1+.18g → **1+.14g** (`MORAL_MARKET_K`, máx ×1,306 → ×1,238); `shopSurcharge` ganha teto **×1,6** (`SHOP_SURCHARGE_CAP`, `shopSurchargeMul()`); Neutro não muda (não usa nenhum dos dois). | ~7331–7385 |
| 7 | ESCASSEZ: reroll fixo 7 vs base que agora é `10+onda`. | Decisão **B (proporcional)**: `max(7, round(base×0,70))`. Onda 1 continua 7 (identidade preservada e 1×/onda), onda 20 → 21 em vez de 7 (não vira farm com o reroll caro). Alternativa A (7 fixo) rejeitada: 77 % de desconto no late seria um benefício que cresce sozinho a cada onda. | `fractureShopRerollCost` |
| 8 | Texto "LOJA +X%" prometia sobrepreço em tudo; o efeito real (`_mk`) só atinge upgrades e módulos (armas/reparo usam outro caminho). | Descrição corrigida para **"UPGRADES/MÓDULOS +X%"** em `iman`, `usura`, `eco_risco`, `eco_divida`, `trans_temporal`. Efeito **não** ampliado. | ITEMS |
| 9 | B1 media a Ganância com `p.coinMul` setado **antes** de `applyMoralTuning` (que o reseta) → 9×/11× subestimados. | Documentado; baseline corrigido (mesmo sim, ordem certa) em `b6913e8`: renda C/A **19,1×**, saldo **62×**, CAN_ALL C 100 %. | `PR13_5_AUDIT.md §25.1` |
| 10 | Sandbox: ao sair, `shopRecent`/ofertas ficavam na memória global (stale). | `sandboxClearRunState()` zera `shopOffers/shopItems/shopGuns` e chama `shopRecentReset()`. Saves reais continuam byte-a-byte. | ~2992 |
| 11 | Save/Continue | Revalidado: checkpoint grava `coins`, `shopRecent`, `shopRollSeq`, `shopSurcharge`, `maxHp`, `dashCdMax` (logo o malus do `singul` sobrevive); reroll pago não volta no reload; Echo slim grava os novos alcances. | `smBuildCheckpoint`, `resumeRun`, `saveEchoes` |

---

## 2. Loja — antes B3 / depois B3 / depois FIX (holdout seed 777001; 1 000 runs × 20 ondas + reroll ≈ 40 000 lojas)

| Métrica | antes B3 (`b6913e8`) | depois B3 (`b2d63cf`) | **depois FIX** |
|---|---|---|---|
| Upgrades repetidos ≥1 (sem compra) | 58,2 % | 47,5 % | 47,5 % |
| Distintos em 5 / 10 / 20 lojas | 8,73 / 11,80 / 14,78 | 9,21 / 12,22 / 14,98 | 9,21 / 12,22 / 14,98 |
| Cobertura do catálogo | 77,8 % | 78,9 % | 78,9 % |
| Reroll repete ≥1 — onda 1 / 8 | 74,2 % / 56,8 % | 64,5 % / 46,1 % | 64,5 % / 46,1 % |
| Módulos repetidos | 15,6 % | 10,5 % | 10,5 % |
| **Armas repetidas** | 15,9 % | 15,9 % *(bug)* | **11,7 %** |
| Pool onda 3 (elegíveis / efetivo) | 10 / 9,85 | 14 / 12,56 | 14 / 12,56 |
| Raridade onda 16 (C/I/R/E/L) | — | 40,1/37,1/18,2/4,0/0,5 | 40,1/37,1/18,2/4,0/0,5 |

Segundo holdout (seed 555999): upgrades 47,4 %, reroll w1/w8 64,4/46,5 %, módulos 10,7 %, **armas 11,6 %**. Upgrades/módulos idênticos ao B3 porque a única mudança de sorteio foi a das armas (a capacidade maior só importa quando o histórico estoura — bigShop+reroll —, o que o cenário padrão não exercita).

Teste `FIX-1` mede diretamente: frequência da arma "vista agora" ≈ peso 0,42 (nunca zero), repetição consecutiva < 13 % (antes 15,9 %).

---

## 3. Item Identity — tabela dos 19 upgrades

Tipos: SIMPLES · TRADE-OFF · CONDICIONAL · SINÉRGICO · HÍBRIDO. Saúde: SIMPLES SAUDÁVEL · FORTE SAUDÁVEL · AUTO-PICK PROVÁVEL · NICHO · FRACO · REDUNDANTE.
"Auto-pick" = melhor valor **por crédito** que qualquer combinação de itens mais simples do mesmo eixo (escala: 1 % crit ≈ 4 % dano crítico; dano e cadência equivalentes).

| ID | Nome | Rar | Preço ant → novo | Tipo ant → novo | Auto-pick antes → depois | Redund. | Mudou | Justificativa |
|---|---|---|---|---|---|---|---|---|
| crit | LENTE DE PRECISÃO | C | 16 → 16 | SIMPLES | não → não | não | não | 8 % crit / 16 = eixo base saudável |
| critd | DETONADOR FOCADO | C | 16 → **14** | CONDICIONAL (só rende com crit) | não → não | não | preço | sem crit vale ~0; ficar mais barato que `crit` sinaliza "peça de combo" |
| rate | ACELERADOR IÔNICO | C | 18 → 18 | SIMPLES | não → não | não | não | 12 % / 18 = referência de cadência |
| hp | BLINDAGEM ADAPTATIVA | C | 18 → 18 | SIMPLES (+cura) | não → não | não | não | saudável |
| range | ESTABILIZADOR DE FASE | C | 15 → 15 | SIMPLES universal (melee+ranged) | não → não | não | não | revalidado após B2 (FIX-3) |
| magnet | ÍMÃ CINÉTICO | C | 12 → 12 | SIMPLES (QoL) | não → não | não | não | barato, não afeta DPS |
| dmg | AMPLIFICADOR | I | 22 → 22 | SIMPLES | não → não | não | não | 14 % / 22 = referência de dano |
| dash | MOTOR DE FASE | I | 16 → 16 | SIMPLES (mobilidade) | não → não | não | não | saudável |
| aoe | CAMPO EXPANSIVO | I | 20 → 20 | CONDICIONAL (só armas AoE) | não → não | não | não | NICHO saudável |
| range2 | BOBINA DE LONGO CURSO | I | 24 → 24 | SINÉRGICO ranged (range+projSpd) | não → não | não | não | não mexe no melee (revalidado) |
| pierce | PERFURADOR | R | 28 → 28 | CONDICIONAL (projéteis) | não → não | não | não | NICHO saudável |
| critx | MIRA CIRÚRGICA | R | 34 → **46** | HÍBRIDO crit+critd | **sim → não** | quase (crit+critd) | preço + valor (+55 % → +45 % dano crít.) | antes: 14 %+55 % por 34 vs 8 %+35 % por 32 → dominava; agora 0,0054/cr vs 0,0056/cr do par, mas continua melhor **por slot** (raro vale o slot) |
| vamp | SIFÃO VITAL | R | 32 → 32 | SIMPLES (sustain) | não → não | não | não | FORTE SAUDÁVEL |
| sprint | PROPULSOR DE FASE | R | 30 → 30 | TRADE-OFF (+vel, −dash) | não → não | não | não | saudável |
| dmg2 | REATOR DE ANIQUILAÇÃO | E | 52 → **58** | SIMPLES (grande) | **sim → não** | sim (2,3× `dmg`) | preço + valor (32 % → 28 %) | 0,0062/cr → 0,0048/cr (≤ `dmg` 0,0064); continua o maior salto por slot |
| rate2 | GATILHO QUÂNTICO | E | 50 → **56** | SIMPLES (grande) | **sim → não** | sim (2,5× `rate`) | preço + valor (30 % → 26 %) | 0,0060/cr → 0,0046/cr (≤ `rate` 0,0067) |
| pierce2 | LANÇA DIMENSIONAL | E | 56 → **50** | CONDICIONAL (projéteis) | não → não | não | preço | NICHO: inútil para melee; 56 o tornava lixo caro |
| omni | NÚCLEO ONISCIENTE | L | 88 → **110** | HÍBRIDO universal | **sim → não** | não | preço | 22 %+18 %+12 % crit+30 HP sem contrapartida; paga o preço da universalidade (≈ preço dos 4 simples + prêmio de slot) |
| singul | SINGULARIDADE PESSOAL | L | 92 → **100** | HÍBRIDO → **TRADE-OFF** (+45 % dano, dash ×0,5, **−12 % vida máx.**, piso 30) | não → não | não (agora oposto de omni) | preço + trade-off | omni = seguro; singul = canhão de vidro móvel. Distinção real entre os dois lendários |

Mudaram **7 de 19** (critd, critx, dmg2, rate2, pierce2, omni, singul). Nenhum item simples virou +X/−Y; só `singul` ganhou trade-off (é lendário e já era "agressivo"). `tests/statmods.test.js` atualizado para o novo `critx` (+.45).

---

## 4. Economia — auditoria por multiplicador e resultado

### 4.1 Os três multiplicadores (build Greed acumula os três)

| Multiplicador | Quem paga | Antes do FIX | Depois | Decisão |
|---|---|---|---|---|
| `shopWaveMul` | todos | 1 + 0,05·(onda−1), teto 2 | igual | **intacto** — é o que sustenta os ganhos do Neutro |
| `moralMarketMul` | Greed (g = min(1,7, greed/6)) | 1 + 0,18g (máx ×1,306) | **1 + 0,14g (máx ×1,238)** | a Ganância já paga `mEff.shopMul = 1+0,34g` do B2 — o "mercado" era um **segundo** imposto na mesma build |
| `shopSurcharge` | quem empilha módulos econômicos | 1,06·1,12·1,15·1,20·1,25 = ×2,14 | **teto ×1,6** | trade-off continua; runaway multiplicativo não |

Varredura K/CAP (N=400, seed 424242): `.06/1.5` → C CAN_ALL 98 % (rico demais); `.12/1.5` → 82 %; `.18/1.6` → 53,5 % (Greed compra 0,97× A); **`.14/1.6` → compras 1,01×, rerolls 1,05×, CAN_ALL 66 %** (escolhido); `.10/1.7` → 71 %.

### 4.2 Simulação final — `audit_pr135/eco_metrics.js`, N=1000/perfil, 20 ondas, compra agressiva + 1 reroll se couber

| Perfil | earned/run | spend | saldo final | compras | rerolls | CAN_ALL | CAN_NONE | MEANINGFUL |
|---|---|---|---|---|---|---|---|---|
| **A** Neutro (seed 424242) | 3 807 | 3 811 | 21 | 91,7 | 16,3 | 61,2 % | 0,0 % | 38,8 % |
| **B** greed 4 + ímã | 6 006 | 5 686 | 345 | 97,8 | 18,6 | 89,2 % | 0,0 % | 10,8 % |
| **C** greed 10 + 5 módulos | 10 854 | 10 798 | 81 | 92,5 | 17,2 | 65,2 % | 0,0 % | 34,8 % |
| **C2** greed 10 + ímã+usura | 9 420 | 9 380 | 65 | 97,0 | 18,1 | 85,5 % | 0,0 % | 14,5 % |
| Holdout seed 991337 — A | 3 807 | 3 812 | 20 | 91,8 | 16,2 | 61,2 % | 0,0 % | 38,8 % |
| Holdout — B | 6 006 | 5 675 | 356 | 97,8 | 18,6 | 89,2 % | 0,0 % | 10,8 % |
| Holdout — C | 10 854 | 10 801 | 78 | 92,6 | 17,2 | 65,7 % | 0,0 % | 34,3 % |
| Holdout — C2 | 9 420 | 9 379 | 66 | 97,0 | 18,1 | 85,7 % | 0,0 % | 14,3 % |

Saldo por onda (A, seed 424242): 12 · 9 · 10 · 87 · 18 · 116 · 68 · 97 · 22 · 21 (ondas 1/2/3/5/8/10/12/15/18/20) — oscila entre páginas cheias e páginas de escolha; CAN_ALL A por onda: 33/6/4/100/67/100/95/99/35/13 %. C: 99/92/30/100/30/100/92/98/25/10 %.

### 4.3 Razões C/A (o que a auditoria pediu)

| Razão | B1 (bug) | corrigido pré-B3 | depois B3 | **depois FIX** | alvo |
|---|---|---|---|---|---|
| earned | 9× | 19,1× | 2,85× | **2,85×** | claramente > 1, longe de 19× ✔ |
| saldo final | 11× | 62× | 4,9× | **3,9×** | — |
| compras | — | 1,03× | 0,90× | **1,01×** | ≥ 1,0 ✔ |
| rerolls | — | 1,06× | 1,00× | **1,06×** | ≥ 1,0 ✔ |
| CAN_ALL C vs A | — | 100 % vs 88 % | 34 % vs 62 % | **65 % vs 61 %** | Greed > Neutro, longe de 100 % ✔ |
| C2 CAN_ALL | — | 100 % | 74,5 % | **85,5 %** | < 100 % ✔ |

Neutro: 62,2 % → 61,2 % CAN_ALL, 37,9 % → 38,8 % MEANINGFUL, saldo 20 → 21, CAN_NONE 0 (a diferença vem só do price pass dos itens; a economia do Neutro não foi tocada). Guardrail "nem 19×/62×/88 %" mantido: B (moderado) é o perfil mais confortável (89 %) — Greed com 5 módulos paga por isso e fica em 65 %.

---

## 5. Testes

- Nova suíte `tests/pr13-5-b3-fix.test.js` — **26 checks**: armas (id, peso ≈0,42, repetição < 13 % sem ban), histórico (capacidade, d=0/d=1/d≥2, uso real), Echo range (novo/antigo/sem campo/inválido, luneta/estilhaço/range/range2, slim save/load, echoEq idempotente, runData), itens (19, critx/dmg2/rate2 por crédito e por slot, singul piso 30 HP, preços preservados, texto UPGRADES/MÓDULOS, armas/reparo sem surcharge), economia (mercado 1,238 máx, teto 1,6 com 5 módulos, guardrails do B3, mini-sim Greed ≥ Neutro), ESCASSEZ proporcional, Sandbox (limpeza, byte-a-byte, Continue reconstrói do slot).
- `tests/statmods.test.js` — critx +.45; `tests/fracture-director.test.js` — guarda de contagem de suítes 20 → 21 (mesma manutenção que o próprio B3 fez ao adicionar a sua).
- `npm test`: **21 suítes · 1 303 checks · 0 falhas** (1 277 + 26).
- Stress 50× em 10 suítes: ver `PR13_5_B3_FIX.md §5` final abaixo / relatório.
- Save/Continue + Sandbox re-executados contra a árvore corrigida (7/7): `shopRecent` global após `sandboxExit` = **0** (era 12 no B3).

## 6. Reprodução

```bash
node audit_pr135/shop_metrics.js "$PWD" 777001      # e 555999
node audit_pr135/eco_metrics.js "$PWD" 424242 1000  # e 991337
node tests/pr13-5-b3-fix.test.js
```

## 7. Dívida técnica

- `economy_sim.js` / `eco_metrics.js` são modelos de renda (abates + evento fixo); não simulam morte, drops de reparo nem compra de armas. Servem para razões entre perfis, não para valores absolutos.
- A capacidade 32 cobre "bigShop + 1 reroll"; um jogador com bigShop que rerolla 3+ vezes na mesma visita passa a perder d=1 (comportamento aceitável: o custo do reroll já cresce).
- `singul` reduz `maxHp` no `apply` (valor, não StatMod): não há `smRemove` para upgrades, e checkpoint grava `maxHp` como valor — consistente com `hp`/`omni`, mas fora do pipeline SM.
- Perfil B (greed moderado) está em 89 % CAN_ALL; não foi alvo desta correção e fica como observação para um passo futuro de balanceamento (não B3).

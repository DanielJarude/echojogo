# PR14.5 · B2 — PERFIL DE BUILD EMERGENTE + SINTONIA DE COMPATIBILIDADE

Relatório técnico da implementação do **B2** (melhorar decisões de build).
Branch `arena/01a07f06-echojogo`, a partir de `723e202` (merge PR #22).
Data: 2026-09-08. Todos os testes do jogo verdes (`npm test`, 39 suítes, exit 0).

---

## A. Branch
`arena/01a07f06-echojogo` (única usada; nenhum push, merge, reset ou rebase).

## B. HEADs
- Base: `723e202f043d02d01cb0b113c4ddf73a3df487cd` (`main`, merge PR #22).
- Final: ver `git log` — commits locais feitos sobre a base, tree limpa ao final.

## C. git status (final)
Limpo após os commits listados em **D**. Nenhum arquivo deletado ou renomeado.

## D. Commits locais
1. `feat(pr14.5-b2): Perfil de Build emergente + Sintonia de compatibilidade + famílias/exclusividade leve + loja por pesos suaves` — `index.html`.
2. `test(pr14.5-b2): suíte B2 (27 testes + simulação 11k) · migração da suíte B4 ao novo contrato · exports de auditoria` — `tests/`, `audit_pr135/`, `package.json`, `tests/fracture-director.test.js`.
3. `docs(pr14.5-b2): relatório técnico e roteiro de playtest` — este arquivo + `PR14_5_B2_PLAYTEST.md`.

## E. Arquivos tocados
| Arquivo | Mudança |
|---|---|
| `index.html` | +607/−26 linhas: bloco B2, Sintonia, famílias, loja, UX, DEV, inspector |
| `tests/pr145-b2.test.js` | NOVO (469 linhas): 27 testes + simulação de 11k lojas |
| `tests/pr13-5-b4.test.js` | migração ao novo contrato de sintonia (11 testes reescritos) |
| `audit_pr135/harness.js` | exports B2 (buildProfile, buildCompat, famílias, override…) |
| `tests/fracture-director.test.js` | meta-teste do npm test: 38 → 39 suítes |
| `package.json` | `npm test` inclui `tests/pr145-b2.test.js` |

## F. Arquitetura (visão geral)
```
composição da run (operador + armas + módulos + stats finais + Echos + tema)
        │  (tudo que já existe; NADA novo é salvo)
        ▼
buildProfile(p) ──► 8 scores 0..1 (arquétipos) ──► buildProfileSummary (rótulo)
        │                                              │
        ▼                                              ▼
buildCompat(item) ──► attunementScore ──► ATTUNE_STATES (5 estados, multiplicadores PR 9)
        │                                     (moral = modulador leve ±~2 p.p.)
        ▼
buildShopWeight(item) ──► rollShop (pesos suaves ×0.75–×1.35, sem garantia)
```
Três sistemas separados: **Perfil Moral** (PR 9, intocado), **Perfil de Build** (novo,
derivado) e **Sintonia** (redefinida: compatibilidade de build com modulação moral).

## G. Perfil de Build
`buildProfile(p)` (index.html, região MORALIDADE→B2):
- **Derivado 100% da composição** — recalculável a qualquer momento; NUNCA salvo
  (nem no checkpoint, nem no meta). Cache em memória (`_bpCache`/`_bpKey`) com
  invalidação automática por key (operador, arma, owned, items, stats finais,
  Echos, tema, runSt quantizado, override de DEV).
- **Entradas**: arma principal + arsenal (ativa pesa ×1 no componente de arma),
  operador/perk (hints), módulos owned (tanh(soma/2.2) — diminishing returns),
  stats finais do pipeline SM (crit/ranged/melee/economy/echo/status/shield/dash),
  comportamento real (runSt do PR 8, reusado — zero telemetria nova) e tema
  (peso pequeno aditivo, ≤.05).

## H. Scores / arquétipos
8 arquétipos, score 0..1: `MELEE, RANGED, CRIT, STATUS, ESCUDO(shield), DASH,
ECONOMIA(economy), ECHO`. Pesos: arma .38 · operador .22 · itens .22 · stats .12 ·
comportamento .06 (+ tema ≤.05 aditivo). Compressão anti-snowball:
- itens: `tanh(soma_afinidades/2.2)` — cada módulo adicional contribui menos;
- stats: sinais centrados no baseline do jogo (ex.: crit `(smGet−.20)×2`);
- clamp final 0..1 em todos os componentes.
Híbridos emergem naturalmente (duas pontuações altas próximas ⇒ HÍBRIDO).

## I. Perfil Moral preservado
`MORAL_AFFINITY`, `getMoralProfile`, `mEff`, eventos, caps e HUD MORAL: intocados.
A moral NÃO é mais a fonte da sintonia de módulos (ver J), mas continua
operando em tudo que sempre operou (header da loja, viés ≤×1.10, moral:* etc.).

## J. Sintonia nova (compatibilidade de build)
`attunementScore(id)`:
- módulo **sem** leitura de build (nucleo, su_regen, entropia, su_sorte…) →
  match moral puro do PR 9 (comportamento antigo preservado para eles);
- módulo **com** leitura → `score = clamp(.34 + .90×buildCompat + mod_moral, 0, 1)`.
Faixas de estado e multiplicadores do PR 9 **exatamente os mesmos**
(DIVERGENTE −10% · INSTÁVEL −5% · NEUTRA 0 · AFINADA +6% · RESSONANTE +12%;
econômicos banda .95–1.06; eco ×.95–1.06). `attune:<id>:<stat>` ids estáveis,
remoção/reaplicação idempotente, trade-offs nunca escalados — tudo re-testado
(suíte B4 migrada, 28/28).

## K. Fórmula build + moral
`mod_moral = BUILD_MORAL_MOD × (match_moral − 1/3)`, com `BUILD_MORAL_MOD = .024`
→ span real **−0.8 a +1.6 p.p. (≈ ±2 p.p.)**. Módulos com leitura de build mas
sem afinidade moral (lente/luneta/espectro/colmeia/prisma2) não recebem modulação.
A moral **não consegue inverter** uma leitura de compatibilidade (gap mínimo entre
estados ≫ 2.4 p.p. no pior caso relevante — testado em B2-9).

## L. BUILD_AFFINITY
Tabela central de ~55 módulos (−1..+1 por arquétipo) + **fallback por itemTags**
(`TAG_AFF`: shield/status/crit/dash/economy/echo .3–.4, ranged/melee .3) —
nada de regex de descrição. Sem sinal em nenhum lugar → compat `null` →
sintonia herda a moral (neutro de build) e peso de loja ×1.00.

## M. Famílias de módulo
`ITEM_FAMILIES` explícitas (dados, não descrição): `shield_regen`
(condensador/peso/lágrima), `focus_range` (luneta/estilhaço), `credit`
(usura/eco_risco/eco_divida). API: `itemFamily`, `itemFamilies`,
`familyBlocker`, `itemFamilyName`. `trans_temporal` ficou FORA de `credit`
de propósito (transformador ≠ membro de família).

## N. Exclusividade leve
Somente onde a coexistência real se anula (triângulo regen×max×delay;
antisinergia de alcance; mesmo contrato de crédito). Regra: posse de um membro
**tira os irmãos das NOVAS OFERTAS** (rollShop filtra `familyBlocker`); nada é
removido do inventário; sandbox idem; reroll idem.

## O. Grandfathering
Save antigo com 2 membros da mesma família: **permanece válido** (posse não é
tocada; stats intactos; Continue idêntico — testado em B2-14 e B2-24). A regra
existe só no momento de gerar oferta.

## P. Módulos
Nenhum módulo novo, nenhum nerf/buff numérico, nenhum limite global de
inventário. Os 22 módulos "sem custo" (B1) continuam como estão; o B2 apenas
passa a **rotular a direção** (sintonia + tooltip) e a dosar a oferta.

## Q. Transformadores
Os 5 preservados intactos. `trans_temporal` explicitamente fora da família
`credit`. Ganham apenas a leitura de afinidade (quando existe) e o tooltip ◆.

## R. Loja
`rollShop` de módulos: pool = não-owned **e** não-bloqueado-por-família;
sorteio `pickWeightedMoral` com peso `shopRepeatWeight(id) × buildShopWeight(o)`
(B3-A variedade × sintonia moral PR 9 × **novo** peso de build).
Abas de armas/upgrades/Echo/Fracture: intocadas.

## S. Pesos
`buildShopWeight = clamp(1 + compat×.35, .75, 1.35)`; compat null → ×1.00.
Nenhum peso zero; nenhum filtro; nenhum ×2/×3. Medição real (90k ofertas,
simulação dedicada):

| Perfil | compat | neutro | divergente | ids distintos | top1 | top5 | wmax |
|---|---|---|---|---|---|---|---|
| dedicada crit | **17.7%** | 82.3% | 0.0% | 56/57 | 6.0% | 25.7% | ×1.350 |
| híbrida melee/crit | **13.3%** | 85.0% | 1.7% | 57/57 | 5.4% | 25.3% | ×1.192 |
| indefinida (baseline) | 0.0% | 100% | 0.0% | 57/57 | 5.0% | 24.8% | ×1.047 |

Leitura: a direção existe (dedicada vê ~13× mais compatíveis que o baseline,
sem adicionar divergentes indevidos), a diversidade NÃO colapsa (57 ids
ofertados; top1 ~5% ≈ uniforme) e a oferta ruim continua dominando —
orientação, não dispensa.

## T. RNG
Nenhuma nova aleatoriedade: o peso entra no `pickWeightedMoral` existente.
0/1/2 ofertas compatíveis continuam possíveis (11k lojas da suíte: lojas sem
compatível e com 2 compatíveis ambas >2% — sem garantia de slot afinado).

## U. Reroll
Filosofia mantida (×1.6, desconto Fracture vale 1×, Ganância pune via
`mEff.rerollMul`). **NOVO: cap = 6× o custo base da onda** (`rerollCap()`) —
antes crescia sem teto e morria como decisão no late. Reroll temporal do ECHO
já tinha cap (30) e não mudou. B3 calibra os números.

## V. TRAVA
Preservada. Trava possível sobrevive a rerolls; trava cuja oferta ficou
**impossível por família exclusiva** é liberada com feedback explícito
(toast "TRAVA LIBERADA · FAMÍLIA: X JÁ INSTALADO" + som) — nunca estado
silencioso quebrado (B2-15/B2-16).

## W. Tooltips "por que combina"
`itemTipHTML` ganha seção `SINTONIA · <ESTADO>` com **1–3 razões curtas**
(`attunementReasons`: cita arma principal quando o hint é forte, operador,
módulos e estatística real) + efeito (×%). Card compacto mostra estado+efeito
em 1 linha; **neutro de build fica silencioso** (card limpo). Preview
ATUAL→PROJETADO reutilizado sem alteração de contrato.

## X. Terminologia
- "(SINTONIA)" de facção em `renderShopEcho` → **"(CONFIANÇA)"** (a palavra
  Sintonia agora é só do sistema de módulos).
- HUD: chip `PERFIL` → **`MORAL`**; linha de status → **"PERFIL MORAL"**;
  TAB MORALIDADE → **"PERFIL MORAL"**.
- Seção de módulos da loja: "MÓDULOS PASSIVOS — TRADE-OFFS REAIS" →
  **"MÓDULOS PASSIVOS — IDENTIDADE DA BUILD"** (título honesto).

## Y. TAB / UX mínima
TAB (Registro) → seção BUILD: linha **PERFIL DE BUILD** (rótulo + 2–3
arquétipos com %). Nada de HUD permanente — PR18 fará o rework de UI.

## Z. DEV
`DEV.buildProfileInfo()`, `DEV.buildProfileExplain(id)`,
`DEV.forceBuildProfile(scores|null)` (override em memória, invalida cache),
`DEV.shopWeightsDebug()`; comandos `bpinsp/bpforce/bpclr/bpshop`; seção
**BUILD PROFILE** no inspector (barras top-4 + select de arquétipo + limpar).
Todos com guarda `if(!DEV_MODE) return null/false` (testado B2-25/26).

## AA. Sandbox
Isolado como antes: override do perfil é memória, `devTaint()` marca a run,
`sandboxExit` descarta tudo; save byte-a-byte garantido em teste (B2-16/B2-25).

## AB. Save / Continue
**Nada novo persistido** (Perfil, Sintonia, famílias, override — tudo derivado
ou memória) ⇒ **sem bump de SM_VERSION/FRACTURE_STATE_VERSION** (3/1, testado).
Continue rederiva o perfil da composição (runSt sobrevive ao checkpoint, PR 8)
e o plano de sintonia é recomputado no resume — exatidão total de ids/valores
testada (B2-23), sem duplicatas de `attune:*`.

## AC. SM pipeline
Intocado: ordem BASE/FLAT/ADD%/MULT/OVERRIDE, `smAdd/smMul/smFlat/smAddPct/
smBreakdown/smPreviewDryRun`. A sintonia continua escrevendo os MESMOS
`attune:<id>:<stat>`; preview continua puro (B2-22).

## AD. attune ids
Estáveis e únicos por (módulo, stat); troca de estado remove a fonte antiga
antes de reaplicar (suíte B4: 200 transições sem duplicata, idempotência ×5,
remoção limpa). Campos diretos (echoBoost/regen/lifesteal/status fields)
continuam via `p.attuneMul`/`attuneFieldMul` (testados).

## AE. Simulações
- Suíte: 11k lojas em build dedicada + 2×4k (dedicada vs baseline) + 200 rolagens
  anti-lock-in (B2-19/20/21).
- Dedicada: média de compatíveis entre 15–75%; lojas 0-compatíveis e
  2-compatíveis >2% cada; divergentes presentes; top-5 ≤28% e top-1 ≤12%.
- Dedicada > indefinida + 5 p.p. (direção sem filtrar).
- Relatório executado com 90k ofertas: ver tabela em **S**.

## AF. Testes novos
`tests/pr145-b2.test.js` — 27 testes: perfil derivado/determinístico, 6 perfis
de arquétipo (WRAITH+katana, BULWARK, PYRE, NÔMADE, ECHO-0, sniper), sintonia
(luneta/estilhaço/paradoxo/olho), modulação moral ≤2,4 p.p. sem inversão,
razões, antisinergia+pivote, famílias, exclusividade em 40 rolagens,
grandfathering, TRAVA×família, sandbox, pesos em bounds p/ 9 builds, loja
(repeat/moral/unlock/reroll cap), sem garantia (11k), direção (8k),
anti-feedback-loop, preview puro (5 cenários), save/continue ×2, DEV inert ×2,
híbridos ×5 + summary HÍBRIDO.

## AG. Regressões
- `tests/pr13-5-b4.test.js` migrada ao novo contrato (28/28): os testes que
  forçavam estado por MORAL agora forçam por BUILD (`setBuildProfileOverride`)
  e a suíte ganhou as verificações de modulação leve. Neutros morais
  (lente/luneta/espectro/colmeia/prisma2) agora têm sintonia de BUILD;
  nucleo/su_regen/entropia continuam só-morais.
- `tests/morality.test.js`: "neutro sem poluição" continua válido — card não
  mostra tag quando o estado de build é NEUTRA.
- Demais 36 suítes: nenhum ajuste necessário.

## AH. npm test
**Exit 0 · 39 suítes · 0 falhas** (incluindo a nova suíte B2 registrada no
`package.json` e validada pelo meta-teste de suítes).

## AI. Problemas conhecidos (não bloqueantes)
1. A dedicada crit pura quase não vê divergentes (nenhum módulo tem sinal
   negativo de crit) — divergência forte hoje concentra-se em ranged×melee e
   shield×vingança. Mais antisinergias explícitas são matéria de B3.
2. O peso de raridade da loja (×100/52/24/9/2.5) domina o peso de build
   (×1.35): módulos compatíveis raros continuam raros. É proposital (não
   virar dispensa), mas B3 pode querer um leve ajuste de escala.
3. `relGap<.12` no summary pode rotular "HÍBRIDO" builds com secundário
   moderadamente próximo — aceitável, mas sensível a calibração (B3).

## AJ. Dívidas/entregas para o B3
- Calibração fina de `BUILD_MORAL_MOD`, pesos do `buildShopWeight` e cap do
  reroll com dados de playtest.
- Avaliar mais famílias (fs_*, sb_*) e mais antisinergias explícitas
  (sinais negativos em BUILD_AFFINITY).
- Balancear dominantes/mortas classificados no B1 (NÃO feito aqui por design).
- Considerar peso de tema um pouco maior para builds "temáticas".

## AK. Roteiro de playtest
Ver `PR14_5_B2_PLAYTEST.md` — 12 testes manuais com preparação, comando DEV,
comportamento esperado e critério de FAIL.

## AL. Conclusão
O jogador agora VÊ o que a build está virando (Perfil de Build no TAB e no
tooltip), RECEBE direção suave na loja sem nunca perder diversidade, sofre
antisinergia legível (Sintonia) com escape claro (pivotar, reroll com cap,
trava liberada com feedback), e a moral continua existindo como camada de
caráter — agora sem fazer o papel de compatibilidade mecânica. Saves antigos
funcionam byte-a-byte; nada foi prometido nos títulos que o jogo não entregue.

## AM. Regra final (menor sistema coerente)
Um arquivo novo de dados (famílias), ~55 entradas de afinidade, 5 funções
puras de perfil, 1 termo de modulação moral, 1 peso de loja, 1 cap de reroll.
Nenhum sistema novo de progressão, nenhuma telemetria nova, nenhum save novo.
Timeline orientou; ninguém obedeceu cegamente.

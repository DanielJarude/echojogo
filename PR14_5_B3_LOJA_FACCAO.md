# PR14.5 · B3 — HIERARQUIA DA LOJA, CALIBRAÇÕES E FACÇÃO

**Status: implementação concluída e validada em suíte — PR14.5 ainda NÃO encerrado** (pendente playtest humano + aprovação). Sem push/merge.

Base: `bd350bd` (B2). Branch `arena/01a07f06-echojogo`.

---

## A. Objetivo atendido

A Loja agora é **visualmente clara**, **mecanicamente verdadeira** e **aprendível**:

| Camada | Contrato na tela | Contrato no código |
|---|---|---|
| **CALIBRAÇÕES DE CAMPO** | "APRIMORAMENTOS ACUMULATIVOS — compram a build; rank sobe a cada compra" | repetíveis, preço fixo, rank derivado de `upgLog`, empilham de verdade |
| **MÓDULOS PASSIVOS** | "IDENTIDADE DA BUILD — definem e especializam" | itens `su_*/rg_*/…` exclusivos por família |
| **TRANSFORMADORES ◆** | "mudam uma regra" (rótulo no tooltip; mecânica intocada) | os 5 transformadores originais |

Se depende de ler código para entender, B3 não terminou — este foi o critério de todo item abaixo.

## B. Heading + subtexto (C1)

`renderShopOp` insere, antes dos cards de upgrade, o bloco `CALIBRAÇÕES DE CAMPO <span>· APRIMORAMENTOS ACUMULATIVOS</span>` (tipografia do `mTag`, sem card/badge extra). O heading de MÓDULOS ("MÓDULOS PASSIVOS — IDENTIDADE DA BUILD", B2) permanece. Um `div` só, sem poluição visual.

## C. Ranks derivados de upgLog (C2, V2)

- `upgRankOf(u)` = nº de ocorrências de `u.nm` em `player.upgLog` **+ 1** (compra futura). Derivado, **nenhum campo novo autoritativo**, sem cap rígido: IV, V, VI… (romanos até 39; acima disso `toRomanRank` cai para decimal).
- `player.upgLog` passa a ser **persistido/restaurado** no checkpoint (save antigo sem `upgLog` → `[]`, sem invalidação). Continue mantém ranks.
- Sem XP, sem bump artificial para rank. **Excesso medido e relatado (§W/§X)**: com spam deliberado o SERVO-GATILHO atinge rank médio 10,4 em 12 visitas — romano duplo (X), legível; sem cap automático.

## D. Preview ATUAL → PROJETADO (C4-adjacente)

Cards de calibração reaproveitam o Preview do B2: `efeito atual (rank N) → efeito projetado (rank N+1)`, destacado com `cimpact`. Nada de segunda engine de previsão — mesmo pipeline `previewStat/commitStat` (intocado).

## E. Preço fixo (sem escala)

Preços por compra mantidos (`B3-02 catálogo`: rate 18◈… omni 110◈). **Nenhuma escala ×1.15^n, nunca mudamos preço+efeito+frequência juntos.** A simulação §X mostra que o limitador natural da cadeia é a OFERTA (reoferta ~11%), não o preço.

## F. Tiers disfarçados consolidados (C4) — opção A

`range2/dmg2/rate2/pierce2/critx` continuam existindo (efeitos idênticos, saves preservados) mas agora são apresentados como o que são: **"CALIBRAÇÃO AVANÇADA · LINHA <ALCANCE/DANO/CADÊNCIA/PERFURAÇÃO/CRÍTICO>"** — mesma família conceitual da calibração base, tier seguinte. `UPG_ADVANCED` registra a linha; `upgDescHTML` monta o rótulo.

## G. Crit/critd/critx — caso especial (R4)

MIRA (`critd`) **não** é "as duas juntas": OLHO = chance (módulo com trade-off), MIRA = dano crítico (calibração avançada da linha CRÍTICO), CRÍTICO× (critx) = multiplicador final (avançada). Descrições nomeiam os papéis; mecânica preservada.

## H. OMNI/SINGUL — ELITE, sem 4ª categoria (C5)

Rótulo **"CALIBRAÇÃO DE ELITE"** (subtipo dentro da hierarquia, com os trade-offs descritos). Não criamos categoria nova; transformadores seguem intocados mecanicamente.

## I. Calibrações SEM Sintonia e SEM buildWeight (C6)

Cards de calibração não exibem chip de Sintonia nem recebem `buildShopWeight` (o ×0.75–1.35 de afinidade continua valendo **apenas para módulos**, inalterado). Investimento universal.

## J. LENTE (rework) — R1

Lente de Foco não é mais dominada pela PONTA: além de `+1 perfuração / −12% dano` (preservados), ganhou regra própria — **atravessar um alvo carrega o tiro: próximo disparo com dano ampliado**. Implementação: `lensChargeMul()` (×1.20 carregada / ×0.82 normal) aplicada no hook de disparo (linha ~16721); estado da lente (`sm`) intacto.

## K. SU_VAMPIRO (rework) — R2/R3

"Fome de Vácuo": **a cada 3 abates, +8 HP** (proc determinístico, float `#ff3d68`) + `medBoost ×1.20` (cura recebida). **Sem lifesteal** — esse papel é do DRENO SANGUÍNEO (calibração, intacto). Checkpoint preserva `killHealEvery/killHealAmount` com default 0 em saves antigos (grandfathering, R3).

## L. OLHO × MIRA (R4)

Ver §G — papéis legíveis, sem sobreposição conceitual; efeitos preservados.

## M. Banner de PRESENÇA estendido (F2)

Banner de facção da **entidade física** (Presença) usa **3,8 s**; banners comuns seguem **2,0 s** (`BANNER_MS` default). Nenhum outro banner foi alterado.

## N. Indicador persistente de presença (F3)

`#fpind` (barra fina sob o HUD, tick 4 Hz): `⬡/◉/◈/◬ NOME · Ns` (+ `· ◆ PACTO DISPONÍVEL` quando `canPact`). Identidade por facção (⬡ consórcio, ◉ claustro, ◈ triaría?, ◬ oráculo — símbolos atribuídos por facção), discreto, some ao expirar/consumir/limpar. TTL da presença: 3,8 s.

## O. Continue restaura SEM re-anunciar (F4)

O rebuild da presença ativa a partir do checkpoint (`cp.presence.active`) agora é **silencioso**: o banner de PRESENÇA não é reemitido no restore (a cadeia `spawnWave` de retomada emite só os banners de onda normais); o indicador volta a refletir o estado restaurado no primeiro tick.

## P. Sandbox sem scheduler (F5)

Sandbox continua sem agendar Presença; save/meta byte-a-byte validado.

## Q. DEV §50–51 (V1)

`DEV.upgradeRanks()`, `DEV.upgradeRank(id)`, `DEV.giveUpgrade(id,n≤30)` (não escreve save), `DEV.shopRepeatStats()` (agora lê a janela nova: `visit/boughtAt/window/offers[].rep/fresh`) + casos `upgranks/upg3` + input `#dev-upg`. Todos inert em release.

## R. Anti-reoferta leve — janela por visita (D1/D2)

- Mecânica: comprar na visita N marca `shopBoughtAtVisit=shopVisitN` + `shopBoughtIds`. Na visita **N+1** o comprado pesa **×0.30** no `pickWeighted` (uma única loja; N+2 volta ao normal). Comprado hoje **nunca** é penalizado pelo `shopRepeatWeight` (×1) — a janela devolve o amortecimento sem violar a semântica do repeat.
- **Métrica do teste D2** (compra de `ids[0]`, presente entre as 3 da loja seguinte; 1800 pares): ×0.7 → 26,1%; ×0.45 → 18,7%; **×0.30 → ~10,5–11,5%** (2500 pares em sim dedicada: 11,5%/10,4% — mesmo fator, duas rodadas). Auditoria (18,6%) usava metodologia distinta — não comparável.
- Não é proibição: o comprado ainda reaparece ~1 em cada 9 lojas consecutivas. `closeShop` não limpa o estado (janela sobrevive ao ciclo da loja).

## S. Testes novos — `tests/pr145-b3.test.js` (19)

- **F1–F5**: cadeia real spawnWave→Diretor→Presença→anúncio (100% anunciados); duração 3,8 s vs 2,0 s; indicador (aparece/some/pacto/facção); Continue sem re-anunciar + indicador refletindo; Sandbox sem scheduler e save byte-a-byte.
- **C1–C6**: heading/subtexto em `m-row`; ranks I/II/III/VI derivados de upgLog (render real); tiers → LINHA; OMNI/SINGUL ELITE; sem Sintonia/buildWeight.
- **D1/D2**: semântica da janela por visita (×0.30, N+2 normal); reoferta 5–15% (faixa do assert), ~11% medido.
- **R1–R4**: LENTE (sm preservado + `lensChargeMul`), SU_VAMPIRO (proc 3→+8, sem lifesteal), checkpoint da fome, OLHO×MIRA.
- **V1/V2**: DEV inert/funcional; ranks sobrevivem a save/Continue.

## T. Testes antigos atualizados (§56, com justificativa)

1. `tests/operators.test.js` — "PRESAS restauradas" travava o contrato **pré-B3** (`globalLifesteal .09`). O rework aprovado redefine o módulo (fome de vácuo). Atualizado para o novo contrato (killHeal 3/+8, medBoost ×1.20, sem lifesteal).
2. `tests/pr13-5-b55-shop-meta.test.js` — selecionava cards por índice (`m-row.children[0]`); com o heading (B), o primeiro filho passou a ser o cabeçalho. Atualizado para selecionar **cards** (filtro por `cprice`). Nenhum contrato funcional mudou.

## U. Meta-suíte — 40 suítes

`fracture-director.test.js`: 39 → **40** suítes; `package.json` registra `pr145-b3.test.js`.

## V. npm test — 100% verde

**Exit 0 · 0 falhas · 1890 checks nas 30 suítes formato "Resultado" + 10 suítes formato próprio = 40 suítes.** Baseline pré-B3: 39 suítes/1890 checks.

## W. Simulações §45 — repetição pós-B3 (3600 pares, jogo real)

| Métrica | Auditoria (pré) | Pós-B3 |
|---|---|---|
| Loja 100% idêntica | 0% | **0%** (0/3600) |
| Calibrações ≥2/3 iguais | 8,1% | **7,0%** (3/3: 0,2%) |
| Módulos ≥1/2 iguais | 10,8% | **13,7%** |
| Armas 2/2 iguais | — | **0,1%** |
| Comprado reofertado na loja seguinte | 18,6%* | **~11%** (janela ×0.30) |

\* metodologia distinta (sem marcação de compra) — não comparável numericamente; a comparação justa é D2: 18,7% (×0.45) → ~11% (×0.30).

## X. Simulações §46 — economia com ranks a preço fixo (2000 runs × 12 visitas × 62◈)

| Política | Cadência | Dano | Sobra | Rank máx médio |
|---|---|---|---|---|
| SPAM SERVO-GATILHO | **×4,50** | ×1,00 | **432◈** parados | 10,4 |
| DIVERSIFICADA (mais barato novo) | ×1,34 | **×1,13** | 14◈ | 4,3 (CAPACITOR) |

Leitura: **sem outlier dominante** — especializar dá ×3,36 na stat-foco, mas deixa créditos parados esperando o card (reoferta ~11% limita a cadeia pela OFERTA, exatamente o desenho do §31) e perde em dano. Diversificar segue competitiva. **Observação de balanceamento, sem nerf por reflexo**: cadência é a stat mais linear de empilhar; monitorar em playtest.

## Y. Grandfathering / saves

- `upgLog` ausente → `[]` (ranks I em diante recomeçam a contar **a partir da próxima compra**; nada quebra).
- `killHealEvery/Amount` ausentes → 0 (sem fome; módulo antigo continua com medBoost se aplicado antes).
- Tiers disfarçados mantêm ids/efeitos: saves antigos comprados seguem valendo.
- TRAVA, Sintonia, Perfil de Build (B2), Moral, Echo, Fracture Director: intocados.

## Z. O que NÃO foi tocado

Transformadores (mecânica), TRAVA (liberação por família), scheduler/cooldown/frequência de facção, pactos, Fracture Director, SM pipeline, itemEmit/itemState, proc guards, checkpoint/Continue (além do silenciamento do anúncio), Perfil Moral, Sandbox isolation, buildWeight de módulos, reroll, 5 transformadores, ~50 módulos fora os 4 reworks.

## AA. Riscos / observações

1. Reoferta ~11% é média; em runs curtas o jogador pode sentir "nunca vem de novo" (subjetivo) — playtest deve verificar percepção.
2. Rank romano alto (spam extremo) pode passar de XII; legível, mas monitorar.
3. O heading ocupa o primeiro filho de `m-row` — qualquer código/UT futuro que assuma "children[0] = card" deve filtrar (padrão já aplicado na suíte B5.5).
4. `shopRepeatStats` mudou de formato (janela nova) — quem lia `fresh` do DEV vê `×0.30` hoje.

## AB. Contratos internos respeitados

Dados explícitos (nunca regex de descrição); rank lê `upgLog` (fonte de verdade = código); `attune:ids` estáveis; `attuneFieldMul` intocado; Preview único pipeline; `giveUpgrade` só em DEV e sem save.

## AC. UX — hierarquia primeiro

Sem badges gigantes nem empilhamento de chips: card de calibração = **NOME + RANK + efeito próxima compra + atual→projetado + preço**. Sintonia só em módulos. ELITE/LINHA são rótulos de texto no descritivo, não camadas visuais extras.

## AD. Arquivos

- `index.html` — jogo (heading/ranks/preview/tiers/ELITE/reworks LENTE+VAMPIRO/facção presença+indicador/anti-reoferta janela/DEV helpers/checkpoint upgLog+killHeal).
- `audit_pr135/harness.js` — exports B3 (`toRomanRank, upgRankOf, UPG_ADVANCED, UPG_ELITE, upgDescHTML, upgRankSpan, lensChargeMul, fpIndicatorTick, getShopVisitN/getShopBoughtAtVisit/getShopBoughtIds`).
- `tests/pr145-b3.test.js` — 19 testes.
- `tests/operators.test.js`, `tests/pr13-5-b55-shop-meta.test.js` — atualizações justificadas (§T).
- `package.json`, `tests/fracture-director.test.js` — meta 40.

## AE–AN. Encerramento

- **AE**: ambiente restaurado 2× durante o trabalho (repo re-clonado); todas as verificações re-executadas após cada restauração.
- **AF**: síntese de sintaxe verificada após cada patch (`SINTAXE_OK`).
- **AG**: F4 corrigida **no jogo** (silenciamento do rebuild), não no teste.
- **AH**: D2 calibrado por simulação com a metodologia exata da suíte (×0.30 → ~11%, dentro de 5–15%).
- **AI**: transformadores: só tooltip/rótulo; zero mudança mecânica.
- **AJ**: Banner comum 2,0 s preservado; só PRESENÇA = 3,8 s.
- **AK**: Relatório final humano: `PR14_5_B3_PLAYTEST.md` (~6 testes).
- **AL**: PR14.5 **não encerrado** — aguardando playtest humano e aprovação.
- **AM**: Sem push/merge/reset/rebase nesta etapa (nenhum pedido explícito).
- **AN**: Próximo passo sugerido: playtest (roteiro anexo) → ajustes finos se necessário → então o usuário decide sobre push/merge.

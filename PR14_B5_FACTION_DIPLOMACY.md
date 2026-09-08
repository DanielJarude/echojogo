# PR14 · B5 — Diplomacia: Rivalidades, Pactos, Teto Diplomático e Consequências Físicas

> **Versão do jogo:** 0.8.0-alpha · **SM_VERSION:** 3 · **FRACTURE_STATE_VERSION:** 1
> **Blocos anteriores:** B1 (auditoria), B2 (fundação física), B3 (primeira presença) + FIX, B4 (quatro facções + reações dos Echos)
> **Suíte de testes:** `tests/pr14-b5-faction-diplomacy.test.js` (97 casos, incl. property/stress)
> **Harness de auditoria:** `audit_pr14/faction_diplomacy_b5_audit.js`
> **Blocos de código novos em `index.html`:**
> - `PR14·bloco b5-diplomacy.js` … `PR14·fim b5-diplomacy.js` (núcleo + prompt de pacto)
> - camada diplomática das presenças em `factionPresenceInteract` / `fpDiploTier`
> - camada diplomática dos Echos em `fp3.js` (`ECHO_DIPLO_REACTIONS`)

---

## 1. Objetivo e escopo

O B5 fecha o ciclo que os blocos anteriores abriram:

> **Escolhas → Afinidade → Posicionamento → Rivalidades → Estado → Comportamento → Presença física reage → Gameplay muda.**

O jogador deve **sentir** que "construiu uma relação" e que "as escolhas mudaram
como a rival passa a tratá-lo". Para isso o B5 introduz quatro peças, todas
**reutilizando a afinidade existente** — sem nova barra, moeda, XP ou pontos:

1. **Rivalidades** entre facções (dois eixos, sustentados pelo lore).
2. **Pactos** (alianças profundas) como **decisão explícita**, não automática.
3. **Teto diplomático** centralizado: um pacto forte limita a rival.
4. **Consequências físicas**: a presença de cada facção reage ao estado
   diplomático (aliada / base / hostil), preservando a filosofia de cada uma.

O B5 **não** cria uma 5ª facção, nova moeda, hostis como inimigos comuns, 4
barras maximizáveis, nem faz rework geral. Escopos futuros ficam registrados na
seção 36.

## 2. Descoberta central da auditoria (o "porquê" do design)

A auditoria (`audit_pr14/faction_diplomacy_b5_audit.js`) revelou dois fatos
decisivos:

1. **Os finais NÃO leem afinidade** (`buildEndingContext` usa moral / echoes /
   dissonância / wave / kills — nunca `fracRun.aff`). Portanto qualquer teto
   diplomático é **seguro**: não altera epílogos.
2. **O estado ALIADA (afinidade ≥ 85) era um limiar morto.** Um jogador que se
   posiciona chega a ~60–66 (FAVORÁVEL, min 58). Monte-Carlo (N=8000) deu **0
   alianças em 100 % das runs** — ALIADA a 85 é organicamente inalcançável.

**Decisão de design:** o **PACTO abre em FAVORÁVEL (≥ 58)**, não em 85. ALIADA
deixa de ser um número morto e passa a ser o **estado efetivo** que o pacto
concede, reutilizando o mesmo eixo de afinidade. Nada de inflar deltas.

## 3. Princípios inegociáveis (invariantes)

- **Afinidade é só LEITURA nas presenças.** Nenhuma presença concede ±afinidade.
- **Moralidade ≠ Diplomacia** e **Facção ≠ Fracture Theme** (testados cruzados).
- **Teto centralizado**: toda escrita de afinidade em gameplay passa por
  `fracApplyDelta`, que aplica o teto — sem clamps espalhados.
- **Run-scoped**: pactos e rupturas vivem em `fracRun`; nunca viram meta.
- **Idempotência**: consolidar/romper acontece **uma vez**; Continue não
  duplica, não reaplica, não esquece, não reconsolida.
- **Sem `Math.random`** em lógica sensível; o Director usa `fractureRng` /
  `fpDeterministicSeed`.
- **SM_VERSION=3 · FRACTURE_STATE_VERSION=1 · 0.8.0-alpha** — inalterados.

## 4. Rivalidades (os dois eixos)

Sustentadas pela lore existente (`FRACTIONS.rel`):

| Eixo | Facção | ↔ | Rival | Tensão |
|------|--------|---|-------|--------|
| 1 | ⬡ ÂNCORA | ↔ | ◬ DESVIADOS | estabilidade × transformação |
| 2 | ◉ REMANESCENTES | ↔ | ◈ CONSÓRCIO | preservação × exploração |

```js
const FACTION_RIVAL = { anchor:'deviants', deviants:'anchor',
                        remnants:'consortium', consortium:'remnants' };
```

A rivalidade é **simétrica** e **não zero-sum automático**: ganhar afinidade com
X **não** rebaixa Y por si só. A rival só passa a ser limitada **depois** de um
pacto consolidado (seção 6).

## 5. Afinidade e estados (o que foi reusado)

`FACTION_STATES` (7 faixas) permanece **byte-idêntico**:

| Estado | min |
|--------|-----|
| ALIADA | 85 |
| FAVORÁVEL | 58 |
| INTERESSADA | 30 |
| OBSERVANDO | 8 |
| NEUTRA | −25 |
| DESCONFIADA | −60 |
| HOSTIL | −999 |

`fracStateOf(id)` continua devolvendo o estado **bruto** (pela afinidade).
`factionDiploState(id)` é a leitura **efetiva**: se há pacto, devolve ALIADA.

## 6. Pacto — o modelo

- **Flag por facção:** `fracRun.pact[id]` ∈ {0,1}. Reusa a afinidade; **não** é
  XP/pontos/moeda/barra.
- **Constantes:**
  ```js
  const FACTION_PACT_MIN   = 58;   // FAVORÁVEL — alcançável (auditado)
  const FACTION_RUPTURE_AFF = -40; // custo da ruptura (DESCONFIADA)
  const FACTION_RIVAL_CEIL  = 0;   // teto da rival (NEUTRA, topo)
  ```
- **Elegibilidade** (`factionCanPact`): run ativa, facção **conhecida**
  (`fracKnows`), afinidade ≥ `FACTION_PACT_MIN`, ainda **sem** pacto, **rival do
  mesmo eixo sem** pacto (um por eixo) e **não** em cooldown de ruptura na run.
- **Consolidar** (`factionPactConsolidate`) é **decisão explícita** (seção 15):
  atingir 58 **não** consolida sozinho.

## 7. Consolidação (`factionPactConsolidate`)

Idempotente — só age na 1ª vez:

```js
function factionPactConsolidate(id,opts){
  if(!factionCanPact(id))return false;   // guarda todas as pré-condições
  fracRun.pact[id]=1;
  const rv=fracRival(id);
  if(rv&&(fracRun.aff[rv]|0)>FACTION_RIVAL_CEIL) fracRun.aff[rv]=FACTION_RIVAL_CEIL;
  /* feedback diegético (banner/toast) — silenciado em sandbox */
  return true;
}
```

Ao consolidar: seta a flag, **deteriora a rival até o teto uma vez** (nunca
rebaixa quem já está abaixo), e emite feedback. **Não** altera a afinidade da
própria facção aliada (só a flag).

## 8. Teto diplomático (`factionAffinityCeiling`) — centralizado

```js
function factionAffinityCeiling(id){
  if(!fracRun)return 100;
  const rv=fracRival(id);
  if(rv&&factionHasPact(rv))return FACTION_RIVAL_CEIL; // rival de aliado → NEUTRA
  return 100;
}
```

O teto é aplicado **num único ponto** — `fracApplyDelta`, a única fonte de
escrita de afinidade em gameplay:

```js
let next=clamp(before+delta,-100,100);
const ceil=factionAffinityCeiling(id);
if(next>ceil&&next>before)next=Math.max(before,ceil); // corta ganho, não rebaixa
```

**Ganhos positivos** da rival são cortados no teto; **perdas** passam normalmente;
uma rival **abaixo** do teto ainda pode subir **até** o teto. Nunca é −100
instantâneo.

## 9. Um pacto por eixo (exclusividade)

`factionCanPact` exige que a rival do eixo **não** tenha pacto. Consequência:

- **0** pactos → válido (comum).
- **1** pacto → comum.
- **2** pactos → só se forem de **eixos diferentes** (compatíveis).
- **3–4** contraditórios → **impossíveis** por construção.

A auditoria confirma **0 %** de alianças contraditórias em todas as
trajetórias (seção 33).

## 10. Ruptura (`factionPactBreak`)

```js
function factionPactBreak(id,opts){
  if(!fracRun||!factionHasPact(id))return false; // idempotente
  fracRun.pact[id]=0;
  fracRun.pactBroke[id]=1;                        // cooldown de run (anti-farm)
  fracRun.aff[id]=clamp(Math.min(before,FACTION_RUPTURE_AFF),-100,100); // custo real
  return true;
}
```

Romper: libera o teto da rival, **custa** (a antiga aliada cai a DESCONFIADA
≤ −40) e marca `pactBroke` — **sem re-consolidar na mesma run** (anti-farm de
troca de lado). Romper sem pacto é no-op (`false`).

## 11. Estado diplomático efetivo (`factionDiploState`)

```js
function factionDiploState(id){
  if(factionHasPact(id))return FACTION_STATES[0]; // ALIADA
  return fracStateOf(id);                          // bruto
}
```

Usado por UI, Codex, presenças e Echos. O teto=0 na rival **nunca** vira ALIADA
para ela (a flag é que promove).

## 12. Snapshot read-only (`factionDiplomacySnapshot`)

Fonte única para DEV/UI/testes; **nunca escreve**:

```js
out[id] = { aff, state, rawState, pact, canPact, rival, ceiling, broke };
```

## 13. `fpDiploTier` — agrupamento de comportamento físico

Em vez de 7 versões por facção, três **tiers**:

```js
function fpDiploTier(faction){
  const id=factionDiploState(faction).id;
  if(id==='aliada')return 'ally';
  if(id==='hostil'||id==='desconfiada')return 'hostile';
  return 'base';
}
```

- **ally** = ALIADA (pacto).
- **hostile** = HOSTIL ou DESCONFIADA.
- **base** = tudo entre neutra e favorável (comportamento B4 preservado).

## 14. Constantes das presenças diplomáticas

```js
const FACTION_PRESENCE_ALLY_MULT            = 1.30; // +30% sobre o benefício base
const FACTION_PRESENCE_HOSTILE_MULT         = 0.55; // benefício reduzido (quando há)
const FACTION_PRESENCE_HOSTILE_RES_COST     = 6;    // ⧗ p/ destravar cache do Consórcio hostil
const FACTION_PRESENCE_DEVIANTS_ALLY_TAKEN  = 1.08; // aliado: risco menor
const FACTION_PRESENCE_DEVIANTS_HOSTILE_DMG = 1.28; // hostil: oferta mais tentadora…
const FACTION_PRESENCE_DEVIANTS_HOSTILE_TAKEN = 1.35; // …mas muito mais instável
```

Valores **conservadores** — sem snowball, sem quebra de economia.

## 15. Prompt de pacto (decisão em superfície)

No **nódulo de manutenção** (loja, tempo congelado), quando uma facção conhecida
fica elegível, surge `b5OpenPactModal(id)` com duas opções:

- **CONSOLIDAR [nome do pacto]** — mostra o **IMPACTO NA RUN** declarativo
  (`evImpactHTML`): `[facção]: ALIANÇA` + `[rival]: RELAÇÃO PREJUDICADA` +
  `PRESENÇA FÍSICA: PASSA A COOPERAR`.
- **MANTER INDEPENDÊNCIA** — recusar **não** quebra a run; a oferta pode voltar.

`b5MaybeOfferPact` roda **uma vez por abertura de loja** (`_b5PactPromptWave`),
só na run real (não em sandbox), sem spam.

## 16. Feedback / IMPACTO NA RUN

A consequência relevante aparece **antes** da escolha permanente, em texto
(estado/consequência), **nunca** números crus. Exemplo de linha do modal:

```
⬡ ÂNCORA — PROTOCOLO DE CONTENÇÃO
CONSOLIDAR:  ⬡ ÂNCORA: ALIANÇA · ◬ DESVIADOS: RELAÇÃO PREJUDICADA · PRESENÇA FÍSICA: PASSA A COOPERAR
```

## 17. Nomes e linhas de pacto (coerência de lore)

```js
FACTION_PACT_NAME = {
  anchor:'PROTOCOLO DE CONTENÇÃO', remnants:'PACTO DE CONTINUIDADE',
  consortium:'ACORDO DE EXCLUSIVIDADE', deviants:'PACTO DE ADAPTAÇÃO' };
FACTION_PACT_LINE = {
  anchor:'A ORDEM RECONHECE VOCÊ COMO PARTE DA ESTRUTURA.',
  remnants:'ELES CONFIAM A VOCÊ A CONTINUIDADE DOS QUE FICARAM.',
  consortium:'O MERCADO ABRE UMA LINHA EXCLUSIVA EM SEU NOME.',
  deviants:'A FENDA ACEITA VOCÊ COMO PARTE DA TRANSFORMAÇÃO.' };
```

## 18. Presença ⬡ ÂNCORA (Nó de Contenção)

Estabilização defensiva de uma **fração do Escudo** (nunca HP):

- **base** = comportamento B4 (`FACTION_PRESENCE_ANCHOR_SHIELD`).
- **ally** = contenção cooperativa (×1.30, "CONTENÇÃO ALIADA").
- **hostile** = contenção **restrita** (×0.55, "CONTENÇÃO RESTRITA") — negação
  parcial, **nunca** um turret inimigo nem punição inevitável.
- Sem escudo disponível ⇒ sem efeito. Nunca ultrapassa `shieldMax`.

## 19. Presença ◈ CONSÓRCIO (Cache Temporal)

Oportunidade de **⧗ Resíduos** via API central (`addResidues`/`spendResidues`):

- **base** = `FACTION_PRESENCE_CONSORTIUM_RES`.
- **ally** = acesso prioritário (base ×1.30, "ACESSO PRIORITÁRIO").
- **hostile** = **acesso restrito com DECISÃO**: o cache só abre pagando um toll
  de `FACTION_PRESENCE_HOSTILE_RES_COST` (6 ⧗), devolvendo um **líquido pequeno
  positivo**. Sem saldo ⇒ cache negado (administrável, não fatal). **Não** quebra
  a economia ⧗ do B3-FIX.1 (o ganho líquido é menor que o bruto base+toll).

## 20. Presença ◉ REMANESCENTES (Memorial Ressonante)

Preserva o **vínculo** dos Echos (escudo parcial + trust, uma vez):

- **base** = B4 (`_REMNANTS_SHIELD=0.35`, `_REMNANTS_TRUST=4`).
- **ally** = reconhecimento — vínculo mais forte (×1.30, "VÍNCULO RECONHECIDO").
- **hostile** = **recusa do vínculo** ("VÍNCULO RECUSADO"): não restaura escudo,
  não dá +trust — mas **nunca** mata o Echo, **nunca** remove trust e **nunca**
  induz Dissonância. Só **nega** a ajuda.
- Echo hostil não recebe carinho (`echoAllied`).

## 21. Presença ◬ DESVIADOS (Fenda Adaptativa)

Trade-off temporário via **Stat Modifier Pipeline** (auto-expira em `smTick`):

- **base** = +dano / +dano recebido por 12 s (`_DEVIANTS_DMG=1.20`,
  `_DEVIANTS_TAKEN=1.15`).
- **ally** = adaptação **controlada** — mesmo +dano, **risco menor**
  (`_ALLY_TAKEN=1.08`). Sem +dano grátis.
- **hostile** = oferta mais **tentadora** (`_HOSTILE_DMG=1.28`) porém muito mais
  **instável** (`_HOSTILE_TAKEN=1.35`) — continua sendo **decisão administrável**,
  não um debuff inevitável.
- `stacks:'replace'` → **sem órfãos, sem duplicação**; expira sozinho.

O **princípio risco↔recompensa** é preservado em **todos** os tiers.

## 22. Camada diplomática dos Echos (`ECHO_DIPLO_REACTIONS`)

Uma camada **pequena**, keyed por **situação** (não por facção×personalidade —
evita a explosão 4×8×7):

```js
ECHO_DIPLO_REACTIONS = { ally:[…], hostile:[…], rival:[…] };
```

`echoDiploSituation(faction)` decide: `ally` (pacto), `hostile` (tier hostil) ou
`rival` (o operador tem pacto com a **rival** desta facção). `echoFactionReaction`
usa essa camada como **fallback preferencial** nas situações extremas e cai para
a matriz B4 (76 falas intactas) no resto.

## 23. Regras de fala (preservação do B4)

- Fala é **narrativa**: **não** altera trust/afinidade/buff.
- **Anti-repeat** determinístico (sem `Math.random`).
- **Dissonância coerente**: Echo hostil / em ruptura **não** fala amistoso.
- Operador ≠ Echo; 8 personalidades preservadas; 76 falas do B4 intactas.

## 24. Codex

`fracCodexBody` mostra o **estado efetivo** (pacto ⇒ ALIADA, com marca ◆), o
**nome do pacto** quando existe, e "RIVAL ALIADA" quando a rival tem pacto — sem
rework e sem números.

## 25. HUD

Nenhuma barra nova, nenhum painel persistente de facção. O rótulo de presença
(`fpEntityAffinityLabel`) mostra o estado efetivo com marca ◆ de pacto — texto,
nunca número.

## 26. Save / Continue

- `fracFresh` inclui `pact{}` e `pactBroke{}` (defaults 0).
- `fracRunPack` grava **apenas 0/1** por facção (flag pequena, run-scoped).
- `fracRunUnpack`:
  - save antigo sem `pact` → **defaults seguros** (0), **sem** subir versões;
  - **invariante um-pacto-por-eixo** reforçado no restore (save corrompido nunca
    produz duas rivais aliadas);
  - **reaplica o teto** ao estado restaurado (rival de aliado nunca > 0).
- **Idempotência**: `unpack` duas vezes → mesmo estado; Continue não duplica,
  não reconsolida, não esquece o cooldown de ruptura.

## 27. DEV helpers (`DEV.*`)

- `factionDiplomacy()` — inspetor **read-only** (não tainta).
- `setFactionAffinity(f,v)` — escrita direta clampada (tainta).
- `forceFactionAlliance(f)` — garante pré-requisitos e consolida (tainta).
- `breakFactionAlliance(f)` — rompe (tainta).
- `diploScenario(1..6)` — aplica um par diplomático de playtest (seção 30).

Todos exigem `devReady()`; inertes fora de DEV_MODE.

## 28. Sandbox (laboratório)

Novos comandos `data-fracsb`:
- `pact:<id>` — garante pré-requisitos e consolida (silencioso);
- `unpact:<id>` — rompe (silencioso).

O laboratório **silencia** transmissões (banner/toast) e **não** grava
descoberta/estado — como nos blocos anteriores.

## 29. Harness de auditoria (`faction_diplomacy_b5_audit.js`)

- Extrai `FACTION_STATES`, `FACTION_GRID` (29 eventos), thresholds, `PACT_MIN`.
- Verifica marcadores do modelo B5 no fonte (rival/pact/ceiling).
- Simula **ANTES vs DEPOIS** (`--compare`), com modelo de posicionamento
  realista (casual → comprometido) e consolidação em `PACT_MIN`.
- `--b5` e N configurável (≥ 5000 trajetórias). **EXIT 0.**

## 30. Resultados da auditoria (ANTES vs DEPOIS, N=6000)

| Métrica | ANTES | DEPOIS (B5) |
|---------|-------|-------------|
| 0 alianças | 100 % | 89.6 % |
| 1 aliança | 0 % | 10.4 % |
| 2 alianças | 0 % | 0.0 % |
| **contraditórias (rivais)** | 0 % | **0 %** |

Leitura: sem B5, aliança é **inalcançável** (limiar morto a 85). Com o pacto em
FAVORÁVEL, jogadores **comprometidos** conseguem 1 aliança; 2 permanecem raras
(exigem posicionar-se em dois eixos), e **contraditórias são impossíveis** por
construção. O teto foi respeitado em 100 % das trajetórias de `--b5`.

## 31. Balance (metas atingidas)

- **0** alianças = válido; **1** = comum; **2** compatíveis = saudável;
  **3–4** contraditórias = impossíveis. **Nenhuma dupla universalmente superior.**
- Presenças conservadoras: aliada não é pickup grátis; hostil não é inimigo
  comum. Cap físico = 1 mantido; `PARTS_MAX`/`ENEMY_BUDGET` intocados.

## 32. Economia ⧗ (não quebrada)

O único toque em ⧗ é o **toll do Consórcio hostil** (net-positivo pequeno, via
API central). `audit_pr14/residue_economy_audit.js` roda com **EXIT 0** e a
participação W4/W5 permanece intacta.

## 33. Testes (97 casos + property/stress)

`tests/pr14-b5-faction-diplomacy.test.js`:

| Grupo | Casos |
|-------|-------|
| Base / estados | 1–5 |
| Rivalidades | 6–11 |
| Aliança (pacto) | 12–20 |
| Bloqueio / teto | 21–28 |
| Ruptura | 29–33 |
| Presenças diplomáticas | 34–48 |
| Echos + diplomacia | 49–56 |
| Eventos / UI | 57–60 |
| Save / Continue | 61–68 |
| Sandbox / DEV | 69–74 |
| Regressões / invariantes | 75–92 |
| Property / stress (≥10000 seq.) | 93–97 |

Stress: 0 exceções, 0 NaN, 0 estado impossível, 0 dupla aliança rival, 0
duplicação/órfão. `npm test` verde (33 suítes).

## 34. Cenários de playtest humano

`DEV.diploScenario(n)`:

1. ⬡ ÂNCORA aliada · ◬ DESVIADOS hostil.
2. ◬ DESVIADOS aliada · ⬡ ÂNCORA hostil.
3. ◉ REMANESCENTES aliada · ◈ CONSÓRCIO hostil.
4. ◈ CONSÓRCIO aliada · ◉ REMANESCENTES hostil.
5. Todos neutros (baseline).
6. Duas alianças compatíveis (um por eixo).

Roteiro sugerido: abrir loja → aceitar/recusar pacto → observar rival cair ao
teto → interagir com a presença aliada e com a hostil → salvar/Continue →
confirmar idempotência no Codex.

## 35. Como jogar (resumo para o operador)

Posicione-se: escolhas coerentes elevam a afinidade de uma facção. Ao chegar a
FAVORÁVEL, a loja oferece um **pacto**. Consolidar torna a facção **aliada** (a
presença dela passa a cooperar) e **prejudica a rival** do mesmo eixo (que fica
limitada a NEUTRA). Você pode manter independência, ou romper depois (com custo).

## 36. Fora de escopo (dívidas registradas)

- **DT-PR14.5**: reação diplomática mais rica dos Echos por personalidade;
  eventos narrativos de guerra fria entre facções.
- **B6 (futuro)**: persistência meta de reputação; efeitos diplomáticos nos
  finais (hoje os finais **não** leem afinidade, de propósito).
- Nada disso é implementado no B5.

## 37. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Clamps de teto espalhados | Centralizado em `fracApplyDelta` (única fonte) |
| Save antigo quebrar | Defaults seguros; sem subir versões |
| Save corrompido → duas rivais aliadas | Invariante forçado no `unpack` |
| Continue reconsolidar/duplicar | Idempotência testada (66, 95) |
| Economia ⧗ | Toll net-positivo pequeno; residue audit EXIT 0 |
| Explosão de falas dos Echos | Camada por situação (3 pools), não matriz |

## 38. Checklist de conclusão

- [x] Rivalidades (2 eixos, simétricas, lore-consistentes).
- [x] Pacto como decisão explícita em FAVORÁVEL; ALIADA efetiva.
- [x] Teto diplomático centralizado; um pacto por eixo.
- [x] Ruptura com custo e cooldown de run.
- [x] Presenças reagem por tier (ally/base/hostile) preservando filosofias.
- [x] Camada diplomática dos Echos sem reescrever o B4.
- [x] Prompt de pacto com IMPACTO NA RUN; Codex mostra pacto.
- [x] Save/Continue idempotente; defaults seguros; versões intactas.
- [x] DEV + Sandbox helpers; 6 cenários de playtest.
- [x] 97 testes + property/stress; harness ANTES/DEPOIS; residue EXIT 0.
- [ ] **PLAYTEST HUMANO** (17 checagens) — pendente para fechar o B5.

# PR14 · B3-FIX.1 — Segundo Playtest Humano (3 correções cirúrgicas)

> **Versão do jogo:** 0.8.0-alpha · **SM_VERSION:** 3 · **FRACTURE_STATE_VERSION:** 1
> **Blocos anteriores:** B1 (auditoria), B2 (fundação), B3 (presença física), B3-FIX (1º playtest)
> **Suíte de testes:** `tests/pr14-b3-fix1-playtest.test.js` (52 casos + stress)
> **Harness de economia:** `audit_pr14/residue_economy_audit.js` (read-only, N≥1000 seeds)

---

## 1. Objetivo e escopo

Este bloco trata **exatamente três pontos** levantados pelo **segundo playtest
humano**, mais as **regressões diretas** de cada mudança. Nada além disso é
tocado. A metodologia foi, para cada ponto: **AUDITAR → MEDIR → identificar a
causa real → menor alteração possível → implementar → testar → stress →
revalidar**. Nenhuma causa foi presumida a partir do relato.

Os três pontos:

- **FIX A — Tooltip vazando sobre modal.** Um tooltip (ex.: "CONTRATO DE USURA")
  ficava flutuando **por cima** do modal de evento.
- **FIX B — Economia de ⧗ Resíduos Temporais.** A geração parecia baixa demais
  para participar das primeiras lojas da aba ECHO.
- **FIX C — Repetição da fala do VECTOR.** A frase *"Estabilidade não é ausência
  de risco. É escolher qual risco pagar."* aparecia em praticamente todos os
  eventos.

**O que o playtest aprovou e NÃO foi reaberto:** aba ECHO fora dos eventos;
topo dos eventos sem duplicação; remoção dos `×1`; Echo com autopreservação;
HUD superior direito organizado.

## 2. Princípios inegociáveis mantidos

- **FACÇÃO ≠ FRACTURE THEME.** Nenhum FIX mistura facção com Tema/intensidade/
  composição/`fractureShapeWave`/budget de inimigos.
- **Afinidade só leitura.** Nenhum FIX concede `+aff`/`-aff` automático.
- **Sem `Math.random` em caminho de gameplay.** O FIX C usa seleção
  **determinística cosmética** que não consome o RNG do Diretor.
- **Sem moeda nova.** O FIX B usa exclusivamente `addResidues`/⧗.
- **Versões congeladas:** `0.8.0-alpha`, `SM_VERSION=3`, `FRACTURE_STATE_VERSION=1`.
- **Sem refactor amplo, sem UI nova, sem HUD/painel persistente de facção.**
- **Sandbox isolado.** Nenhuma injeção de economia no laboratório.

## 3. Tabela mestra — PROBLEMA / CAUSA / ARQUIVO / RISCO / CORREÇÃO / TESTE

| # | Problema | Causa real (auditada) | Arquivo/local | Risco | Correção (mínima) | Teste |
|---|----------|----------------------|---------------|-------|-------------------|-------|
| A | Tooltip flutua sobre o modal ("CONTRATO DE USURA") | Sistema de tooltip é **único** (`#tip`, `z-index:60`, acima de todos os modais). Ao abrir um modal, o elemento sob o mouse é **removido do DOM** (`innerHTML=''`) → o `mouseleave` **nunca dispara** → `#tip.on` fica pendurado. | `index.html` `tipShow`/`tipHide`/`bindTip` (~19823+); aberturas de modal | Baixo | Guarda em `tipShow` (`tooltipBlockedByModal`) + `hideActiveTooltip()` na abertura de cada modal. **Não** é z-index. | 1-10, 50-52 |
| B | ⧗ insuficiente para participar das 1ªs lojas ECHO | **Bootstrap circular**: toda fonte por-abate exige equipamento de Eco que **já custa ⧗**; o 1º mini-chefe (⧗3) só vem na onda 5. Na loja da W4, **~98%** das runs tinham ⧗0 — abaixo do item mais barato (⧗3). É **geração inicial**, não preço. | `index.html` bloco de economia (~24077+) e gate `waveCleared` (~19003) | Médio | "Sedimento temporal" de fim de onda: **2,2,1,1,1** nas ondas 1-5, **0** a partir da 6 (≈⧗7 na run inteira, front-loaded). | 11-23, 44-49 |
| C | Fala do VECTOR repetida em todo evento | `OPERATOR_WHISPER` tinha **1 frase fixa** por operador, exibida em **todo** evento de facção via `operatorWhisperHTML()`. Era **arquitetural** (fallback único), não específico do VECTOR. | `index.html` `OPERATOR_WHISPER`/`operatorWhisperHTML` (~9568+) | Baixo | Pool pequeno por operador (1ª linha = assinatura histórica) + seleção **determinística com anti-repeat** que não consome RNG do Diretor. | 24-35 |

## 4. FIX A — Diagnóstico completo do tooltip

O tooltip é um **único elemento** `#tip` (CSS ~490: `position:fixed;
z-index:60; pointer-events:none; display:none`; `.on{display:block}`). Ele é
controlado por três funções e um binder:

- `tipShow(html, ev)` — injeta HTML, adiciona `.on`, posiciona.
- `tipMove(ev)` — reposiciona seguindo o mouse.
- `tipHide()` — remove `.on`.
- `bindTip(el, htmlFn)` — liga `mouseenter→tipShow`, `mousemove→tipMove`,
  `mouseleave→tipHide` (18 call sites: item/módulo/arma/operador/loja/ofertas/
  serviços/equipamentos de Eco).

**A causa raiz não é z-index.** O `#tip` já está acima de tudo por design (para
não ficar cortado). O bug é de **ciclo de vida de evento DOM**: quando o
jogador está com o mouse sobre um card e uma transição troca o conteúdo do
modal (`innerHTML=''` na ida loja→evento, por exemplo), o nó que tinha o
`mouseleave` **deixa de existir** — o navegador **não emite** `mouseleave` para
um nó removido. Resultado: `#tip` continua com `.on` e "vaza" sobre a próxima
tela.

## 5. FIX A — Correção na origem

Duas defesas complementares, ambas mínimas:

1. **Guarda em `tipShow`** — `tooltipBlockedByModal(srcEl)` recusa exibir se:
   - qualquer modal de tela cheia bloqueante está aberto
     (`TOOLTIP_BLOCKERS = ['pause-menu','codex','endwrap','sheet','sandboxp']`); **ou**
   - `#modal` está aberto **e** o elemento de origem **não pertence** a ele.
     Isso é crucial: `#modal` é **compartilhado** pela Loja Temporal (tooltips
     válidos) e pelos eventos (sem tooltips). A guarda só bloqueia o
     **vazamento** (um card de trás / removido), preservando o tooltip da Loja.

2. **`hideActiveTooltip()` na abertura de cada modal** — mata qualquer tooltip
   pendurado no exato momento da transição: `openShop`, `openEvent`,
   `openConfirm`, `pauseGame`, `openCodex`, `openSheet`.

`bindTip` passou a repassar o **elemento de origem** (`el`) para `tipShow`, para
que a guarda saiba de onde o tooltip veio.

## 6. FIX A — Por que a Loja Temporal continua funcionando

Na Loja, o `#modal` está aberto **e** os cards de item/oferta/serviço/
equipamento são **filhos** do `#modal`. Como `tooltipBlockedByModal` só bloqueia
quando o elemento **não** é descendente do `#modal`, o `mouseenter` de um card
de loja passa pela guarda e o tooltip aparece normalmente. Testes 7 e 51/52
protegem esse comportamento.

## 7. FIX A — Sequências cobertas

- Loja → evento (tooltip pendurado morre): testes 10, 52.
- Evento → loja (abas reexibidas, tooltip saudável): teste 52.
- Pausa / Codex / Registro / Sandbox abertos bloqueiam tooltip: testes 3-5, 8.
- Fechar o modal volta a permitir tooltip: teste 8.

## 8. FIX B — Auditoria da economia (fontes)

Todas as chamadas reais de `addResidues` foram mapeadas
(`audit_pr14/residue_economy_audit.js` imprime a lista viva):

- **Mini-chefe** (`mini_boss`): +⧗3 uma vez, só nas ondas **5/10/15**.
- **Equipamento de Eco** (Consórcio): `extracao`/`coleta`/`contrato` — só em
  **ELITE** ou RNG 25%/14%, com **caps por onda**, e **exige o equipamento
  instalado** (que custa ⧗).
- **Lápide** (Âncora): 6 + `floor(res/3)`, cap 10, só na **morte** do Eco.
- **Ações do Arauto**: +⧗8 (situacional).
- **Ofertas de facção** (aba ECHO): `con_avalia` +8, `dev_fenda` +6 (gated por
  observação/afinidade).
- **Eventos de facção** via `fracResFX(n)`: **16** opções, ⧗3..⧗14 — **só se a
  facção é conhecida** (`fracKnows`) e a partir do `minWave` do evento.
- **`fc_consorcio`** +2, **`fc_desviados`** +4, **`dissonancia_contida`** +1
  (cap 2/onda), **`faction_presence`** (CACHE TEMPORAL) **+4**.

## 9. FIX B — Auditoria da economia (sinks)

- **Equipamentos de Eco** (aba ECHO): **31 itens**, preço **⧗3..⧗12**
  (mediana ⧗7); lote de **4** por visita.
- **Serviços temporais**: ⧗4 (PULSO) e ⧗8 (LIMPEZA).
- **Reroll**: base ⧗3 → escala ×1.6, cap ⧗30 (⧗3 → ⧗5 → ⧗8 → ⧗13 → ⧗21).
- **Ofertas**: ⧗5+◈40, ⧗6, ⧗7, ⧗8...

## 10. FIX B — A causa real (bootstrap circular)

A auditoria Monte-Carlo (N=2000, checkpoints W4/W5/W10/W15/W20, cenários A–D)
mostrou que **o problema está concentrado nas primeiras ondas**:

```
BASELINE — Cenário A (sem interação excepcional)
 W      mean  med  P10  P25  P75  P90    %0   poder(med/preço~7)
 W4     0.2    0    0    0    0    0    98%    0.0 itens   ← PARTICIPAÇÃO ZERO
 W5     3.4    3    3    3    3    3     0%    0.4 itens
 W10    8.6    6    6    6   10   17     0%    0.9 itens
 W15   13.8    9    9    9   18   22     0%    1.3 itens
 W20   16.3   15    9    9   21   27     0%    2.1 itens
```

**Smoking gun:** na loja da **W4**, ~98% das runs têm **⧗0**, enquanto o item
mais barato custa **⧗3**. É impossível **participar**. A partir da W5 o
mini-chefe injeta ⧗3 (1 item barato) e a economia respira. Ou seja: **não é
preço, é geração inicial** — e a raiz é o **bootstrap circular** (toda fonte
por-abate exige equipamento que já custa ⧗).

## 11. FIX B — A correção (sedimento temporal)

`fracWaveSediment(w)` roda **uma vez por onda** no gate `waveCleared` e paga um
"sedimento" **pequeno e decrescente**:

| Onda | Sedimento |
|------|-----------|
| 1-2  | **+⧗2**   |
| 3-5  | **+⧗1**   |
| 6+   | **+⧗0** (taper) |

Total: **≈⧗7 na run inteira, todo front-loaded**. Fonte temática: resíduo que
"assenta" ao **estabilizar a onda** — dentro da identidade tempo/facções, sem
UI nova, sem moeda nova.

## 12. FIX B — Resultado quantitativo

```
COM SEDIMENTO — Cenário A
 W      mean  med  P10  P25  P75  P90    %0   poder
 W4     6.2    6    6    6    6    6     0%    0.9 itens   ← participa!
 W5    10.4   10   10   10   10   10     0%    1.4 itens
 W10   15.6   13   13   13   17   24     0%    1.9 itens
 W15   20.8   16   16   16   25   29     0%    2.3 itens
 W20   23.3   22   16   16   28   34     0%    3.1 itens
```

- **W4:** 98%-zero → **0%-zero**, mediana ⧗0 → **⧗6** (≈1 item barato).
- **W20:** mediana ⧗15 → ⧗22 (**~3 itens**, não os 4 do lote): o teto **não**
  foi inflado — não vira 2ª versão dos Créditos.
- Cenários B (CACHE), C (afinidade) e D (extração) continuam **acima** de A,
  como textura opcional — nenhum é obrigatório para participar.

## 13. FIX B — Filosofia atendida

> ⧗ deve ser **suficiente para decidir**, não para comprar tudo.

O sedimento eleva o **piso de participação** cedo (chance razoável de comprar
**1** item barato nas primeiras lojas) sem permitir esvaziar a loja. Escassez
**com decisão**, não **ausência de participação**.

## 14. FIX B — Idempotência e Save/Continue

- Chamado **uma vez por onda** no gate `waveCleared` (que já é único por onda).
- **Blindagem extra:** `fracRun.sedW` carimba a última onda paga; reentrar a
  mesma onda **não paga de novo** (teste 15/17).
- **Persistência:** `sedW` entra no `fracRunPack`/`fracRunUnpack` — um
  **Continue** no meio da run **não re-concede** o sedimento das ondas já pagas
  (teste 21). Save antigo sem `sedW` cai em **0** com segurança, **sem
  migration** e **sem subir `SM_VERSION`** (teste 22).
- **Sandbox:** retorna 0 imediatamente (teste 18).
- **Sem `fracRun`:** retorna 0 sem crashar (teste 19).

## 15. FIX B — CACHE TEMPORAL preservado

O `FACTION_PRESENCE_CONSORTIUM_RES` (**+⧗4** da presença física do Consórcio)
foi **medido e mantido intacto** — é saudável (cenário B fica confortavelmente
acima de A sem explodir o teto) e é **identidade** da presença. Nada da sua
aparência ou valor muda (teste 23).

## 16. FIX C — Auditoria da fala de operador

`operatorWhisperHTML()` é chamado no `render` de **todos** os eventos de facção
(20 call sites) e em vários eventos comuns. Antes, `OPERATOR_WHISPER` mapeava
**uma única string** por operador. Logo, o mesmo operador dizia **sempre a
mesma frase** — o relato citou o VECTOR, mas o defeito era **arquitetural** e
afetava os **8 operadores** (VECTOR, WRAITH, BULWARK, PYRE, WARDEN, NÔMADE,
ECHO-0, REVENANT).

## 17. FIX C — A correção (pool + anti-repeat determinístico)

`OPERATOR_WHISPER[id]` virou um **pool pequeno** (4-5 linhas por operador). A
**1ª linha de cada pool é a assinatura histórica** (preservada byte-a-byte,
para não mudar identidade). `operatorWhisperLine(id)`:

- mantém um **contador por operador** (`_opWhisperMem`) que **rotaciona** o pool;
- **anti-repeat:** nunca devolve a mesma linha **imediatamente** anterior;
- o contador é **limitado** (`% 1000000`) — não cresce indefinidamente;
- **não** usa `Math.random` nem o RNG do Diretor — seleção **determinística e
  cosmética** (teste 30/31).

## 18. FIX C — Garantias

- **Não altera gameplay** (só texto de flavor).
- **Não é salvo** (`_opWhisperMem` é transiente) → **não** sobe `SM_VERSION`.
- **Não quebra Save/Continue** (nada persistido).
- **Escalável:** adicionar uma linha ao pool de qualquer operador não exige
  mudar a lógica.
- **Distinção operador × Echo:** o pool é fala do **operador** (o jogador). As
  **reações do Echo** às facções são dívida do **B4** e **não** foram
  antecipadas (teste 35).

## 19. Arquivos alterados

- `index.html`
  - Tooltip: `tipShow`/`bindTip` + `hideActiveTooltip`/`tooltipBlockedByModal`/
    `TOOLTIP_BLOCKERS`; `hideActiveTooltip()` em 6 aberturas de modal.
  - Economia: `fracWaveSediment` + `FRAC_SEDIMENT_MAX_WAVE`; chamada no gate
    `waveCleared`; `sedW` em `fracFresh`/`fracRunPack`/`fracRunUnpack`.
  - Falas: `OPERATOR_WHISPER` (pools) + `operatorWhisperLine` + `_opWhisperMem`.
- `audit_pr14/residue_economy_audit.js` (novo, read-only).
- `tests/pr14-b3-fix1-playtest.test.js` (novo, 52 casos).
- `tests/fracture-director.test.js` (meta: 30 → **31** suítes).
- `package.json` (script `test` inclui a nova suíte).

## 20. Suíte de testes (52 casos)

- **Tooltip (1-10):** `hideActiveTooltip`; `tipShow` bloqueia por
  pause/codex/sheet/sandbox/endwrap; `#modal` bloqueia vazamento mas permite
  card interno (Loja); `bindTip` liga origem; abrir loja/evento limpa tooltip.
- **Economia (11-23):** valores 2/2/1/1/1/0; total ⧗7; idempotência;
  `sedW`; anti-reload; sandbox; sem `fracRun`; pack/unpack; save antigo;
  RES_MAX; CACHE +4.
- **Falas (24-35):** pools por operador; assinaturas históricas; anti-repeat;
  cobertura do pool; determinismo; sem `Math.random`; HTML; operador × Echo.
- **Regressões (36-52):** versões; 12+4 eventos; presença física; caps;
  `addResidues`/`spendResidues`/clamp; `TOOLTIP_BLOCKERS`; abas da Loja; fluxo
  loja→evento→loja.

## 21. Stress executado

- **Economia:** N=2000 seeds × 4 cenários × 5 checkpoints (harness).
- **Falas:** ≥5000 seleções por operador (teste 34) + 40 seleções com
  anti-repeat verificado (teste 28) + cobertura de pool em 60 seleções
  (teste 29) + determinismo entre 2 execuções do jogo (teste 30).
- **Tooltip/modal:** ciclos loja↔evento↔loja e todos os blockers (testes 8-10, 52).

## 22. Resultado dos testes

`npm test` → **31 suítes, exit 0**. A nova suíte: **52 passaram · 0 falharam**.
Baselines preservados: B3-FIX 39/0, B3 física 34/0, B2 26/0.

## 23. Riscos residuais e mitigação

- **Tooltip:** se um novo modal de tela cheia for criado no futuro, basta
  adicioná-lo a `TOOLTIP_BLOCKERS`. Mitigação documentada aqui.
- **Economia:** o harness é um **modelo externo** (ordem de grandeza), não o
  motor real do jogo — os números guiam a decisão, mas o **playtest humano**
  seguinte valida a sensação.
- **Falas:** pools são pequenos de propósito; se um operador precisar de mais
  variedade, é trivial e seguro estender.

## 24. Idempotência e compatibilidade

`SM_VERSION=3`, `FRACTURE_STATE_VERSION=1` e `0.8.0-alpha` **inalterados**.
Nenhuma migration. Save antigo sem `sedW` → `0` (seguro). `cp.frac` continua
sem duplicar recompensa (teste 22/49).

## 25. Sandbox

O sedimento é **silenciado** no laboratório (`sandboxMode||sandboxRun`).
Tooltips e falas funcionam no Sandbox como no jogo normal, sem economia
injetada. Nenhum teste byte-for-byte de Sandbox foi alterado.

## 26. O que NÃO foi feito (fora de escopo)

- **B4:** reações de Echo às facções — **não** antecipado.
- **B5 (dívida):** rivalidades ideológicas entre facções (ÂNCORA↔DESVIADOS,
  REMANESCENTES↔CONSÓRCIO) — **registrado como dívida, não implementado**.
- **PR14.5 (dívida):** rework da Loja Temporal / Módulos Passivos / Perfil —
  preservado como dívida.
- Nenhum aumento de `PARTS_MAX`/`ENEMY_BUDGET`; nenhuma nova presença
  simultânea; `FACTION_PRESENCE_ACTIVE_CAP=1` mantido.

## 27. Dívidas técnicas registradas (não implementar aqui)

- **DT-B5:** rivalidades entre facções (estados intermediários coexistem;
  aliança profunda pode limitar/deteriorar a rival por limiar/exclusividade,
  **não** −100 instantâneo; evitar "aliado de todos").
- **DT PR14.5:** rework Loja Temporal + Módulos Passivos + Perfil.

## 28. Como reproduzir a auditoria

```
node audit_pr14/residue_economy_audit.js 2000        # baseline (sem sedimento)
SEDIMENT=1 node audit_pr14/residue_economy_audit.js 2000   # com a correção
node tests/pr14-b3-fix1-playtest.test.js             # 52 casos
npm test                                             # suíte completa (31)
```

# ECHO — Sistema de Facções Observadoras (PR 12)

> Este documento descreve a PR 12 de facções: quatro entidades que **observam**
> o operador através das suas decisões — nunca escolhidas em tela, nunca
> reduzidas a barras de "reputação". Elas reagem a quem você é durante a run.
> Arquivo-fonte: bloco `PR 12 — FACÇÕES OBSERVADORAS` em `index.html`.

---

## 1. Filosofia das 4 facções

As facções **não são aliadas nem inimigas contratáveis**: são correntes do
mundo temporal que assistem o operador e formam leitura própria do que ele faz.
O jogador nunca "farma reputação" — ele **age**, e as facções **interpretam**.

| Símbolo | Facção | Leitura central |
|---|---|---|
| ⬡ | **Âncora** | estabilidade, contenção, ordem — previsibilidade como virtude |
| ◉ | **Remanescentes** | vínculo, insistência, refúgio — Ecos são gente |
| ◈ | **Consórcio** | capital, contrato, risco precificado — tudo tem preço |
| ◬ | **Desviados** | instabilidade, transformação, Dissonância como matéria-prima |
| ◇ | *(neutro)* | tecnologia sem dono — não é facção |

Regras de tom: sci-fi melancólico e temporal; sem linguagem de MMORPG
("reputação +10", quests, medalhas). O feedback é diegético (transmissões,
banners, textos de evento), nunca um placar moral na tela.

## 2. Sistema observador

- As facções **não recebem escolhas dedicadas**. Elas escutam as decisões que o
  jogo já tem (eventos de decisão, moral, tratamento dos Ecos, uso de
  tecnologia) via **`factionEmit(evento, payload)`**.
- Cada evento relevante está mapeado em **`FACTION_GRID`** com deltas por
  facção (ex.: `echo_protected`, `echo_abandoned`, `dissonance_resolved`,
  `relic_of_anchor`, …). O grid é o comportamento concreto — nunca o atalho
  "Compaixão = Remanescentes".
- Deltas são **pequenos (±1..4)** e sempre clampados a **±4 por evento**.
- `payload.fac[fid]` permite ao evento carregar nuance contextual (inversão de
  sinal etc.); sem payload, vale o grid.

## 3. Afinidade e estados

- **Afinidade**: número interno por facção, faixa **−100..+100**, run-scoped.
- **Estados derivados** (nunca exibidos como número ao jogador):
  hostil → desconfiada → observando → interessada → favorável → aliada
  (e os espelhos negativos). Cada faixa tem cor/label diegético.
- **Transições de faixa** (ALIADA/HOSTIL) disparam **uma** transmissão por
  faixa/run (`fracBandAlert` — anti-spam natural, sem barras).
- Não existe "pontuação numérica" na UI do Codex: o jogador vê estados,
  lore e símbolos.

## 4. Observações e primeiro contato

- Toda decisão que uma facção nota soma **observação** (`fracRun.obs[fid]`).
- Ao atingir o limiar de primeiro contato, a facção é **identificada**:
  `fracContact(id)` → o nome/lore abre no Codex e ela pode oferecer
  transmissões na loja.
- Desconhecidas aparecem em **cifra** no Codex ("▚ ??? — NÃO IDENTIFICADA").

## 5. Histórico mecânico

- `fracRun.hist` guarda um **histórico compacto** (cap `FACTION_HIST_MAX = 40`)
  de decisões com `{wave, ev, fid, d, r}` — usado por DEV, ofertas futuras e
  telemetria. Entradas novas deslocam as velhas; nada cresce sem limite.
- O campo `r` carrega o **rótulo** da razão (texto, ex. `contrato_cumprido`).

## 6. Eventos e transmissões (loja)

- Eventos de facção entram no pool de eventos de decisão com requisitos
  (`minWave`, `cond: fracKnows(...)`, `oncePerRun`).
- Na **Loja Temporal** (aba ECHO), facções identificadas com afinidade
  suficiente emitem **TRANSMISSÕES // ofertas** (`FRAC_OFFERS`): custos em
  ⧗ (+◈ quando há custo duplo), gating por onda e afinidade
  (`needAff`), consumo registrado em `fracRun.o[fid].n` — **aceitar 1× é
  definitivo na run** (nunca reaparece; reload não ressuscita).
- Serviços temporais neutros (`FRAC_SERVICES`) também existem na aba ECHO.

## 7. Run-scoped vs. discovery (fracRun ≠ fracDisc)

| | `fracRun` | `fracDisc` |
|---|---|---|
| Conteúdo | afinidade, observações, histórico, ofertas, estado mecânico | facções identificadas + lore desbloqueada (tokens por facção) |
| Escopo | **run** | **Save Slot** |
| Morte/vitória | resetado | preservado |
| Troca de slot | descartado | recarregado do slot |
| Checkpoint | `cp.frac = fracRunPack()` | `slots[n].fracd` |

Exemplo: você descobriu os Remanescentes, morreu, começou nova run — o Codex
continua conhecendo Remanescentes, mas a afinidade deles voltou ao estado
inicial.

## 8. Codex (aba FACÇÕES)

- Facções desconhecidas em cifra; conhecidas exibem **lore progressiva**
  (origem → filosofia → métodos → contradição, desbloqueada por eventos/loja).
- Símbolos distintos por facção; sem score numérico; textos sem estourar
  layout (classes de UI existentes do Codex).

## 9. Modelo de save (resumo)

- `smBuildCheckpoint` grava `cp.frac = fracRunPack()` — ver
  [SAVE_SYSTEM.md §13](SAVE_SYSTEM.md) para o formato e a ordem do resume.
- `smSanitizeSlot` filtra `fracd` com `fracDiscClean` (input não confiável).
- Save antigo sem `cp.frac`/`fracd` → `fracFresh()` / descoberta vazia, sem
  erro. `SM_VERSION` não mudou (campos opcionais aditivos).

## 10. Sandbox e DEV

- **Sandbox**: contexto PR 12 próprio — `fracRun=fracFresh()` ao iniciar
  teste; discovery em **cópia isolada** (swap de contexto); nada grava nos
  saves reais (ver [SANDBOX_SYSTEM.md](SANDBOX_SYSTEM.md) R5).
- **DEV**: `devTainted` bloqueia checkpoint e `fracDiscSave`; comandos
  `fr:*` são ferramentas locais e não tocam progressão.

## 11. Extensão futura

- Novos eventos: adicionar linha no `FACTION_GRID` + `FACTION_REASON`.
- Novas ofertas: entrada em `FRAC_OFFERS` com `w/needAff/price/accept()`.
- Novo lore: entrada em `FRAC_LORE[fid]` com token narrativo.
- Relação entre facções (alianças/atritos) e Echo↔Echo são explicitamente
  adiados (guardas de escopo nas suítes).

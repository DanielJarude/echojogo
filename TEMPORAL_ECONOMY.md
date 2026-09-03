# ECHO — Economia Temporal (PR 12)

> Três moedas com **responsabilidades distintas**. Este documento descreve a
> mais nova — os **Resíduos Temporais (⧗)** — e como ela convive com as
> demais. Arquivo-fonte: bloco `PR 12 — FACÇÕES/ECONOMIA` em `index.html`.

---

## 1. As três moedas

| Moeda | Nome | Escopo | Usada em |
|---|---|---|---|
| ◈ | **Créditos** | run | loja clássica do operador (upgrades, armas, módulos) |
| ⧗ | **Resíduos Temporais** | run | Loja Temporal — aba ECHO (equipamentos, ofertas, serviços, reroll) |
| ◆ | **Memória** | meta (entre runs) | loja de memória pós-vitória (unlocks permanentes) |

- ⧗ **nunca** compra na loja do operador; ◈ **nunca** compra na aba ECHO
  (exceção documentada: algumas ofertas de facção têm custo misto `⧗ + ◈`).
- ◆ não entra na run: é ganha no encerramento e gasta no meta-shop.

## 2. Resíduos Temporais — fontes

Toda fonte de ⧗ é **específica e nomeada** (o padrão é `addResidues(n,
'<motivo>_<contexto>')`). **Não existe** recompensa genérica por abate de
inimigo comum. Fontes reais incluem:

- efeitos de equipamento por abate do Eco: `eco_contrato*` (Contrato de
  Recuperação), `eco_extracao_elite`, `eco_coleta*` (caps por onda);
- morte do Eco com Lápide (`eco_destruido_lapide`);
- eventos de facção (`evento_faccao`, `fc_consorcio`, `fc_desviados`);
- mini-boss/arauto (`mini_boss` — e `eco_acoes_arauto` +8 por abate do Eco
  com Ações da Fratura);
- Dissonância contida (`dissonancia_contida`, teto 2/onda);
- ofertas pagas negativas não existem — ofertas **custam** ⧗.

## 3. Resíduos — gastos (sinks)

- **Equipamentos** da aba ECHO (`shop_equipamento_<id>`): preço base por
  item com ajuste de sintonia — **aliada/favorável −1 ⧗**, **desconfiada/
  hostil +1 ⧗** (nunca grátis, nunca desconto extremo).
- **Reroll temporal**: custo escalado (base 3 ⧗ → ×1.6 por uso, teto 30) —
  cobrado **exatamente uma vez** por reroll.
- **Ofertas/transmissões** de facção (`oferta_<fid>`): preço por oferta;
  algumas pedem ◈ adicional.
- **Serviços temporais** (`servico_*`, refund `refund_servico_*` se o efeito
  falhar): ex. Pulso de Estabilização ⧗4, Limpeza Temporal ⧗8.
- Saldo **nunca negativo** (`spendResidues` valida; sem débito fantasma).

## 4. Limites e tetos

- Teto de saldo: `RES_MAX = 9999` (anti-overflow).
- Faixa de custo observada: ⧗3 (neutros) … ⧗10 (relíquias de facção);
  ofertas ⧗6–8.
- Income projetado por run é **modesto e condicionado** (eventos + kills de
  Eco com equipamento + mini-boss) — comprar os 43 é impossível numa run;
  o lote da loja (4 itens/onda) força escolha.
- Reroll: `rerollCost` clampado 1..99; consumos registrados em `es.rerolls`.

## 5. Faction bias no estoque

O lote da aba ECHO (`fracRollStock`) pesa por **conhecimento e estado**:
- origem desconhecida: peso reduzido (só aparece após identificar);
- aliada/favorável: peso alto; hostil/desconfiada: peso baixo (sobretaxa,
  não bloqueio);
- raridade implícita por onda: itens caros têm peso menor em ondas baixas.

## 6. Anti-exploit

- **Reroll grátis**: 1 rolagem grátis por onda (carimbo `stockWave`).
  Reabrir a loja, trocar de aba ou re-render **nunca** gera lote novo.
- **Lote remanescente + lote novo**: um lote que sobrou da onda anterior é
  herdado na nova visita; comprar o remanescente esvazia e libera a rolagem
  grátis **daquela onda** (o `stockWave` avança). Esvaziar um segundo lote na
  mesma onda **não** rola outro — nunca 2 lotes grátis na mesma visita.
- **Checkpoint/Continue** preserva saldo, `rerollCost`, lote (`es.stock`),
  inventário e `stockWave` — reload não devolve ⧗, não zera o custo do
  reroll (13 continua 13) e não rerrola o estoque.
- **Oferecimento duplo**: oferta aceita/consumida (`o[fid].n`) não reaparece
  na run — reload não permite aceitar 2×.
- Fontes sempre nomeadas (auditado por guard de teste: `killEnemy` comum não
  concede ⧗).

## 7. Run reset

Ao finalizar a run (morte/vitória): saldo, custo de reroll, lote, inventário,
ofertas e progressões zeram com `fracRun` (fracFresh na próxima run). A
**Memória (◆)** e o **Codex** não são moeda de run e permanecem.

## 8. Serviços com estado

- **Limpeza Temporal** remove a Cláusula de Avaliação do Consórcio
  (`conTax`) e penalidades vitais temporárias do operador (`tempPen`).
- A penalidade vital temporária (~45 s, eventos "DOAR VIDA"/"O RELÓGIO DO
  FIM") persiste no checkpoint com o **tempo restante** — reload não a apaga
  (exploit) nem a prolonga (tempo com o jogo fechado não consome duração).

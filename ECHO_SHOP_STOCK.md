# ECHO — Loja Temporal: estoque e rolagem (PR 12 · design)

> Decisão de design auditada no Bloco 6 da PR 12, documentada para não ser
> "corrigida" como se fosse bug.

## Regra do lote

- A Loja Temporal (aba ECHO) mostra um **lote de 4 equipamentos**, rolado
  com peso por facção/estado/onda (`fracRollStock`).
- **1 rolagem grátis por onda**: o carimbo `fracRun.es.stockWave` guarda a
  onda em que o lote atual foi rolado. Reabrir a loja, trocar de aba ou
  re-render nunca gera lote novo.
- Comprar itens **não** rerrola; esvaziar o lote mostra o estado "ESTOQUE
  DESTA ONDA ESGOTADO — USE O REROLL TEMPORAL".

## Herança de lote antigo + lote novo (comportamento registrado)

Um lote que **sobrou da onda anterior** (stockWave < onda atual) é herdado
na nova visita. Se o jogador **compra o remanescente** e o estoque esvazia,
a loja rola o lote **daquela onda** — o que é correto: o jogador tinha
direito à rolagem grátis da onda nova, e o item antigo era do lote anterior.

**Isso não é reroll grátis duplo**: o `stockWave` avança para a onda atual
no momento em que a herança é consumida. Esvaziar um **segundo** lote na
mesma onda **não** rola outro lote (o carimbo já é o da onda atual).

Resumo: o jogador recebe **no máximo 1 lote grátis por onda**, e nunca 2
lotes grátis na mesma visita. Guard de teste cobre o comportamento.

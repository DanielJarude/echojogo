# Auditoria PR13.5 — Bloco 1 (ferramentas)

Estes scripts **não alteram o jogo**. Servem apenas para medir `index.html` real a partir do
mesmo harness usado pelos testes.

## Requisitos

- Node.js (versão compatível com o repo).
- Nenhuma alteração em `package.json`.

## Como reproduzir

```bash
# carrega o script real do jogo e valida os dados exportados
node -e "const {T}=require('./audit_pr135/harness.js'); console.log(T.ITEMS.length,T.UPGRADES.length,T.WEAPONS.length,T.MINIBOSS.length)"

# variedade da loja + repeticoes (10.000 lojas / cenário; 1.000 runs)
node audit_pr135/variety.js
node audit_pr135/variety2.js

# economia em 3 perfis morais (300 runs cada)
node audit_pr135/economy_sim.js

# métricas das strings de fala
node audit_pr135/speech_metrics.js

# inventário de armas e consumidores de range
node audit_pr135/range_audit.js

# matriz de minibosses
node audit_pr135/miniboss_audit.js
```

## Conteúdo

- `harness.js` — sandbox VM + DOM mínimo; expõe `T` com os dados/algoritmos do `index.html`.
- `variety.js` — distribuição, entropia e repetição (upgrades/módulos).
- `variety2.js` — at-least-once, repetição consecutiva e pool de armas.
- `economy_sim.js` — simulação de créditos com RNG seedado e heurística documentada.
- `speech_metrics.js` — comprimento/WPM das linhas de fala por fonte.
- `range_audit.js` — tabela das 27 armas e consumidores de `rangeMul`.
- `miniboss_audit.js` — matriz de habilidades dos 8 minibosses.

## RNG

Os scripts injetam um LCG (`Math.imul`/`1664525`/`1013904223`) em `Math.random` do sandbox,
com sementes derivadas de cenário/onda/perfil. Reexecutar produz os mesmos números.

## B3-FIX — holdouts (seeds nunca usadas no tuning)

```bash
# variedade/repetição da loja (1.000 runs × 20 ondas + reroll) contra a árvore indicada
node audit_pr135/shop_metrics.js "$PWD" 777001
node audit_pr135/shop_metrics.js "$PWD" 555999

# economia formal (CAN_ALL / CAN_NONE / MEANINGFUL / saldo por onda), perfis A/B/C/C2, N=1000
node audit_pr135/eco_metrics.js "$PWD" 424242 1000
node audit_pr135/eco_metrics.js "$PWD" 991337 1000
```
O 1º argumento é a raiz ABSOLUTA de uma árvore (`"$PWD"` = a atual; um extract de outro commit serve para o "antes").

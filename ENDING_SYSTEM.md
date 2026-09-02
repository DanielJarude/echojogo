# ENDING SYSTEM — PR 10.5 (finais dinâmicos: base + variante + epílogo)

> Documentação da reforma de finais introduzida na PR 10.5
> (`feat: expand run events and reform dynamic endings`).
> Complemento de `EVENT_SYSTEM.md`; identificadores em inglês, prosa em pt-BR.

---

## 1. Filosofia

- **Final = consequência da run**, não veredito moral e não conquista RNG;
- **Nada de GOOD/BAD/TRUE**: 7 bases cobrem estados de run distintos e
  **qualquer combinação é uma vida possível** — Ressonante não é "melhor",
  Fraturada não é "pior", Compassão não é "bom", Violência não é "ruim";
- **Nenhum final base depende de evento RNG raro** (regra dura): a base é
  calculada só do **estado da run**; eventos entram como **variante** e
  **epílogo**;
- **Zero `Math.random` na decisão** — mesmo contexto → mesmo final (§99);
- Os **3 finais originais permanecem alcançáveis** com as condições históricas.

## 2. Arquitetura

```
buildEndingContext()       → snapshot determinístico da run
evaluateEndingCandidates() → candidatos {key, pri, reasons[]} ordenados
pickEndingVariant(c,base)  → id da variante (when(ctx) determinístico)
collectEndingEpilogues(c)  → no MÁXIMO 2 epílogos, por prioridade
pickEnding(ctx)            → chave da base (fallback 'eterno')
resolveEnding()            → base + variante + epílogos + candidatos + motivos
```

`onVictory()` chama `resolveEnding()`, registra a base em `meta.endings`, a
variante como sub-registro `base.variante` em `meta.evars`, limpa o run ativo
(`clearActiveRun`) e monta `victoryData` (variante, epílogos, motivos, relações,
estado de Dissonância). `showVictory()` renderiza subtítulo da variante e os
epílogos abaixo do texto do final.

### Contexto (`buildEndingContext`)

`moral{comp,greed,viol}`, `light=comp`, `dark=greed+viol`, `conflict`,
`broken` (algum Eco vivo com trust < 28), `echoes[{slot,trust,rel}]`,
`echoCount` (Ecos **vivos e aliados**), `topRel` (melhor estado de relação),
`disCount/disRuptured/disReconciled` (flags da Dissonância da PR 10),
`epilogues` (prometidos durante a run), `flags`, `wave/kills/time/operator`.

## 3. As 7 bases e prioridades

| pri | Final | Condição (estado da run) |
|---|---|---|
| 100 | **O PARADOXO ETERNO** | conflito moral (luz ≥ 4 e treva ≥ 6, ou vínculo quebrado com ambos elevados) — semântica idêntica ao legado |
| 90 | **O SILÊNCIO SEM TESTEMUNHA** | vitória **sem nenhum Eco vivo** |
| 80 | **O EXÍLIO COMPARTILHADO** | ruptura de Dissonância **sem reconciliação** + desconfiança remanescente |
| 68 | **O PORTO DA FRACTURA** | compaixão dominante (≥6) + relação synced/resonant + **nenhuma ruptura** + luz > treva |
| 65 | **A DUPLA QUE CHEGOU** | ≥2 Ecos com relação synced/resonant + sem treva dominante + sem conflito |
| 50 | **O LIBERTADOR** | luz > treva, sem conflito (condição histórica) |
| 50 | **O TIRANO DO CICLO** | treva > luz, sem conflito (condição histórica) |
| 10 | O PARADOXO ETERNO (empate) | empate puro luz=treva sem conflito (legado) |

- O candidato de maior prioridade vence; empates de prioridade preservam a ordem
  de inserção (sort estável, determinístico);
- Consequência, não qualidade: tirano com Eco ressonante **continua tirano**;
  refúgio exige arquitetura de compaixão, não é "o final bom" genérico;
- `silencio` (90) domina `liber/tirano` (50) quando não há Eco vivo — vencer
  sozinho é uma história diferente, não uma derrota.

## 4. Variantes (base + variante, nunca "100 finais")

Cada base tem 2 variantes com `when(ctx)` determinístico **e uma de fallback
`when:()=>true`** — a variante é sempre resolvível:

| Base | Variantes |
|---|---|
| liber | `coro` (2+ Ecos) · `par` (1 Eco) · `unico` (fallback) |
| tirano | `usurpador` (houve ruptura) · `herdeiro` (fallback) |
| eterno | `espelho` (com Eco) · `vazio` (fallback) |
| silencio | `luto` (houve ruptura) · `novo` (fallback) |
| exilio | `ferida` (2+ rupturas) · `racha` (fallback) |
| dueto | `ressonancia` (topRel resonant) · `sincronia` (fallback) |
| refugio | `porto` (2+ Ecos) · `farol` (fallback) |

15 variantes no total. A variante entra como **subtítulo** na tela de vitória
e como sub-registro de descoberta no Codex.

## 5. Epílogos de acontecimentos

Chains e escolhas marcantes prometem epílogos via `evEpilogue(id)` durante a
run (memória compacta, teto 8). No final, `collectEndingEpilogues` ordena por
`pri` (4–10) e corta em **no máximo 2** — o final não vira lista.

18 epílogos, ex.: `ep_resposta` (pri 10 — a transmissão recebeu resposta),
`ep_pacto` (pri 10 — o pacto sem cláusulas sobreviveu ao ciclo), `ep_cicatriz`
(pri 10), `ep_confissao` (pri 9), `ep_posto` (pri 5 — o posto continua selado),
`ep_cobrador` (pri 4). Epílogo desconhecido (save antigo) é ignorado sem erro.

## 6. Garantias (testadas em `tests/endings.test.js`)

1. **Determinismo** — `buildEndingContext`/`resolveEnding` estáveis entre
   chamadas; bloco auditado na fonte sem nenhum `Math.random`;
2. **Base independente de evento** — epílogoFlags/flags não criam nem removem
   candidatos de base; apenas variante/epílogo reagem a eventos;
3. **Finais originais preservados** — luz>treva→liber · treva>luz→tirano ·
   conflito→eterno · empate→eterno, agora com Eco vivo obrigatório no teste
   (sem Eco, o silêncio é a consequência);
4. **Fallback seguro** — `pickEnding` nunca devolve chave desconhecida;
5. **Integração real** — `onVictory` registra `meta.endings`/`meta.evars`,
   monta `victoryData` completo (motivos, relações, Dissonância) e
   `showVictory` renderiza subtítulo + epílogos;
6. **Sem rótulo simplista** — auditoria estática: nenhum final usa
   GOOD/BAD/TRUE/"final bom/ruim";
7. **Codex** — seção FINAIS REGISTRADOS mostra bases descobertas
   (`meta.endings`) e variantes (`base.variante` com contagem n/total).

## 7. Dev tools

| Método | O que faz |
|---|---|
| `DEV.endingPreview()` | `resolveEnding()` leitura pura: previsto, variante, motivos, candidatos com pri, contexto moral/Ecos/Dissonância, epílogos prometidos fora do corte |
| Painel ENDING INSPECTOR | render de previsão + candidatos + contexto no `devRender` |

## 8. Testes

`tests/endings.test.js` (34 asserções, blocos A–I): registro (7 bases, variantes
com fallback, 18 epílogos com pri 4–10), contexto determinístico, candidatos e
prioridades (conflito/silêncio/exílio/reconciliação/refúgio×dueto/empate),
finais originais preservados, variantes determinísticas, epílogos (teto 2,
prioridade, ignorados desconhecidos), base não depende de evento, auditoria
estática da fonte e integração real `onVictory → meta → showVictory`.

Rodar: `npm test` (a suíte é a 11ª do pipeline).

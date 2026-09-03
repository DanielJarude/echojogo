# RELATÓRIO FINAL — BLOCO 6 (PR 12) · PARE PARA REVIEW

> Branch: `arena/01a0635d-echojogo` · Base: `main` `4355a84`
> Pacote: **`0.7.0-alpha`** (sem version bump) · `SM_VERSION` **inalterado** (3)
> `npm test` sozinho: **17 suítes · 961 checks · 0 falhas** (845 legados + 116 PR 12)
> Estado: **SEM PR, SEM MERGE — aguardando review.**

---

## Checklist de entrega (itens do Bloco 6)

1. **Integração da PR 12 à suíte oficial** — `package.json` → `scripts.test`
   termina com `&& node tests/pr12.test.js`. `npm test` sozinho cobre todas
   as 17 suítes. ✔
2. **Contagem final** — 845 legados + 116 PR 12 = **961 checks, 0 falhas**
   (exit 0). ✔
3. **Pacote `0.7.0-alpha`** — nenhum version bump. ✔
4. **`SM_VERSION` inalterado** — campo novo é opcional/aditivo; save antigo
   sem `cp.frac` segue válido (fallback `fracFresh`). ✔
5. **Persistência de temporário mecânico — penalidade vital (~45 s)** —
   `player.tempPen`/`player.tempT` entram no checkpoint com o **tempo
   restante** (segundos, 2 casas — não timestamp absoluto). ✔
6. **Continue preserva tempo restante** — 45 s, consumidos 17 s →
   retomada com **28 s** (teste B6). ✔
7. **Sem contagem de tempo offline** — `tempT` só decrementa em
   `updatePlayer(dt)` em jogo. ✔
8. **Reload não apaga penalidade** — salvar/carregar não remove `tempPen`. ✔
9. **Expiração não reaparece** — uma vez expirada, não volta com o reload. ✔
10. **Sanidade de dado corrompido** — `tempPen>0 && tempT<=0` devolve a vida
    máxima imediatamente (sem penalidade eterna). ✔
11. **Save pré-B6 sem os campos** — fallback `0`/`0` (teste B6). ✔
12. **Classificação de temporários** — A) cosméticos/transientes: não
    persistem (feedback, banners, animações); B) mecânicos: persistem
    (penalidade vital, buffs de onda em `eqBoost`, boosts per-run,
    `conTax`/Cláusula, refúgio, `stockWave`). Auditado sem reescrever o
    sistema. ✔
13. **Auditoria run-scoped (sobrevive ao Continue)** — afinidade,
    observações, histórico, Resíduos, rerollCost, estoque, ofertas,
    contratos, inventário, equipamentos, boosts, caps per-run, penalidades:
    todos serializados em `cp.frac` (`fracRunPack`) e restaurados por
    `fracRunUnpack`+`fracRestoreEquipment`. ✔
14. **Reset final limpo** — morte/vitória/nova run descartam `fracRun`
    preservando `fracDisc` narrativa por slot; reload não restaura run
    encerrada; revives não são devolvidos. ✔
15. **Discovery narrativa por slot** — `slots[n].fracd` continua independente
    do mecânico. ✔
16. **Sandbox R5** — reexecutado: S1/S2/S3 byte-for-byte antes/depois de
    mutações (⧗, facções, discoveries, equipamento, inventário, Trust,
    Dissonância, ofertas, reroll); teardown deixa saves idênticos. ✔
17. **Isolamento real no Sandbox** — swap de estado com teardown; nunca
    backup→mutar→restaurar. ✔
18. **Catálogo — 43 IDs únicos** (guards de fonte e teste). ✔
19. **Distribuição por origem** — Âncora 9 · Remanescentes 9 · Consórcio 10 ·
    Desviados 9 · Neutros 6. ✔
20. **Distribuição por categoria** — 14 Núcleos · 14 Protocolos · 15
    Relíquias. ✔
21. **Sem unlock permanente** — nada do equipamento escapa da run. ✔
22. **Nascimento Duplo: decisão formal = MANTER 2 revives/run** — justificada
    (ver §Balance abaixo). ✔
23. **Contrato de Recuperação** — cap `cr` 8/run persistido; coleta com cap
    por onda; sem loop. ✔
24. **Ações da Fratura** — ⧗ apenas em Arauto com o Eco em campo (+8),
    fonte nomeada; arautos são limitados por run. ✔
25. **Vínculo Recíproco / Núcleo Dissonante / Coração Impossível** —
    escala com relação/pressão, com tetos e consequências de Dissonância;
    sem loop econômico. ✔
26. **Política de estoque documentada** — herança de lote antigo + 1 rolagem
    grátis da onda nova ocorre **uma única vez** por onda; nunca 2ª rolagem
    na mesma visita (teste B6 + `ECHO_SHOP_STOCK.md`). Decisão: **intencional,
    não exploit** — é a rolagem grátis da onda a que o jogador tinha direito. ✔
27. **Anti-exploit de reroll** — reabrir loja/trocar aba/re-render não gera
    lote novo; reload não zera `rerollCost` nem rerrola estoque. ✔
28. **Economia** — **nenhuma recompensa genérica de ⧗ por inimigo comum**
    (guard de teste: fonte em `killEnemy` comum ausente). ✔
29. **Reação de facção ao instalar relíquia** — `fracRelicEmit` dispara
    `relic_of_<fid>` nos dois caminhos reais de instalação (compra com slot
    livre e painel do inventário), só quando `origin!=='neutral'`; guardar
    no inventário não emite. ✔
30. **UX — Loja [OPERADOR]/[ECHO]** — saldo ⧗ legível, cards não estouram,
    empty state sem Echo e com múltiplos Echos, serviços/ofertas/reroll
    auditados em fonte. ✔
31. **UX — Codex** — desconhecidas em cifra, lore progressivo, **sem score
    numérico**, textos sem quebras, símbolos distintos. ✔
32. **UX — TAB** — resumo informativo sem virar inventário. ✔
33. **Formatação numérica** — zero `toFixed` no código PR 12; sem valores
    `32.325000` (só arredondamento de 2 casas do DEV inspector e do
    `tempT` persistido via `Math.round`). ✔
34. **pt-BR canônico** — Echo/Echos, Resíduos Temporais, facções,
    Dissonância, Núcleo/Protocolo/Relíquia, Âncora/Remanescentes/Consórcio/
    Desviados; tom sci-fi/melancólico; sem MMORPG (“+reputação” só como
    menção diegética do Consórcio) e sem linguagem de sistema na narrativa
    (auditado em fonte). ✔
35. **Documentação** — `FACTION_SYSTEM.md` ✔, `ECHO_EQUIPMENT_SYSTEM.md`
    (catálogo 43) ✔, `TEMPORAL_ECONOMY.md` ✔, `ECHO_SHOP_STOCK.md`
    (decisão de estoque) ✔, `SAVE_SYSTEM.md` §13 (`cp.frac`/`fracd`) ✔.
36. **Código morto/duplicado PR 12** — removidas 8 funções mortas e
    **duplicação real de `fracEqTipHTML`** (2ª definição sobrescrevia a 1ª
    em silêncio; a canônica com rótulos pt-BR prevaleceu); guard de fonte
    impede reincidência. ✔
37. **Performance** — nenhum loop pesado sobre os 43 por frame (refreshes
    por evento; `echoEqDynMul` no tick só com equipamento dinâmico). ✔
38. **Malformed/migrations** — rerodado; save pré-B6 sem `cp.frac` é
    sanitizado e segue; slot malformado não derruba os demais; `SM_VERSION`
    não mudou. ✔
39. **Testes legados** — 845 checks verdes **sem alterar expectativas** para
    esconder regressão (única alteração: guard de escopo do relationship
    convive com facções, já validado no B5). ✔
40. **Cobertura PR 12** — 116 checks: estrutura/conteúdo, grid, afinidade,
    eventos/transmissões, Codex, economia/shop, equipamento (43), e2e de
    checkpoint/Continue (temporários, malformed, old save), run reset,
    slots, Sandbox byte-a-byte, guards B6. ✔

---

## Balance — decisões formais (B6)

**Nascimento Duplo = 2 revives/run (mantido).** Justificativa: custo alto
(⧗10), ocupa o slot de Relíquia (exclusivo com Vínculo/Última Memória),
cap duro por run em `fracRun.duoNasc` (sobrevive a reload — sem exploit),
gates de estado (Eco não-hostil, sem Refúgio ativo) e renascimento com 40%
da vida (não é imunidade). Reduzir a 1 puniria desproporcionalmente a árvore
Desviada, cujo trade-off é risco↔poder. O teto global em código (§62) impede
loop.

**Estoque “antigo + novo” = intencional.** O jogador comprou o remanescente
de um lote de onda passada e recebe a rolagem grátis **da onda nova** — que
já lhe era devida. O `stockWave` avança e impede 2 lotes grátis na mesma
visita. Registrado em `ECHO_SHOP_STOCK.md` e no teste B6.

**Fontes de ⧗** sempre nomeadas e limitadas (caps por onda/run); sem income
genérico. **Custo do reroll** escala (base 3 → ×1.6, teto 30) e é persistido.

---

## Entregáveis desta sessão

- `git status` → working tree **limpo**.
- Commits novos (B6): `4479b1d` docs · `22d8c7a` feat · `5d96ca8` test —
  sobre `f0bcf76`/`efaf1c8`/`c90efcb` (B5). 6 commits no total desde `main`.
- Docs: `FACTION_SYSTEM.md`, `ECHO_EQUIPMENT_SYSTEM.md`,
  `TEMPORAL_ECONOMY.md`, `ECHO_SHOP_STOCK.md`, `SAVE_SYSTEM.md` (§13).
- Suíte: `tests/pr12.test.js` com seções `[0]`–`[20]` (116 checks).

## Próximo passo

**PARE PARA REVIEW.** Sem PR, sem merge, sem version bump. Aguardando leitura
do relatório e decisão do usuário.

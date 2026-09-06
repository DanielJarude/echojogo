# PR14 · B3-FIX — Correções de Playtest (Event UX · Echo Survivability · HUD · Identidade Visual de Facção)

> **Versão do jogo:** 0.8.0-alpha · **SM_VERSION:** 3 · **FRACTURE_STATE_VERSION:** 1
> **Base:** PR14 B3 (`5ee8338`) · **Suíte nova:** `tests/pr14-b3-fix-playtest.test.js` (39 casos)
> Este é um **FIX orientado por problemas reais** encontrados no playtest humano do B3 — não uma expansão. B4/B5/PR14.5 **não** foram antecipados.

---

## 1. Contexto

O B3 passou em todos os testes automatizados, mas o **playtest humano** revelou
problemas de UX, IA e identidade visual que os testes não capturavam. Este
bloco audita cada achado, corrige com a menor mudança correta e adiciona
cobertura de teste — preservando o escopo do B3 e a regra **Facção ≠ Fracture
Theme**.

## 2. Achados do playtest e diagnóstico

Auditoria feita **antes** de qualquer alteração (metodologia obrigatória §2):

| # | Problema | Causa REAL | Arquivo/Função | Solução |
|---|----------|-----------|----------------|---------|
| 1 | Aba `[OPERADOR\|ECHO]` aparece em eventos | `#modal` é compartilhado loja↔evento; `renderShop()` põe `#m-tabs` em `display:flex`, mas `openEvent()` nunca resetava | `openEvent` | `openEvent` esconde e limpa `#m-tabs` |
| 2 | Echo avança e se suicida | Autopreservação só existia para `tier 0 && hurt`; tiers 1/2 perseguiam sem recuo por vulnerabilidade/densidade | `updateEcho` | camada leve `echoSurvivalAdjust` |
| 3 | Topo do evento confuso/**duplicado** | `evHead()` **já** anexa `moralStatusLine()`, mas ~60 eventos passavam a linha inline de novo → duplicação real; e a linha despejava todos os `×1` | `evHead`, `moralStatusLine` | remove chamada inline duplicada + compacta a linha |
| 4 | Escolhas não comunicam impacto | `evOpt` só renderizava narrativa + tag moral; sem impacto mecânico | `evOpt`/`mkCard` | camada declarativa `impacts` |
| 5 | HUD sup. dir. congestionado | `#slots` empilhava Créditos+Echos+Perfil; ⧗ e Fractura eram chips **absolutos** (`top:52/88px`) sobrepondo a coluna | HUD + `fracHudChip`/`fractureHudChip` | grupos hierárquicos + chips no fluxo |
| 6 | Presença de facção parece beacon | `factionPresenceDrawEntity` reusava a gramática do beacon (anel+disco+rótulo) | fp2 draw | linguagem visual própria por facção |

## 3. Causa de cada problema

- **FIX 1** — Estado visual da loja vazando: o modal é uma única caixa DOM reutilizada. A barra de abas é um elemento persistente (`#m-tabs`) cujo `display` só era ligado (loja) e nunca desligado ao entrar num evento.
- **FIX 2** — A IA antiga só recuava quando o Echo desconfiava do jogador (tier 0) **e** estava ferido. Um Echo confiante e saudável perseguia o alvo até o centro da horda.
- **FIX 3** — Duplicação **provada** (não impressão): `evHead(t,d)` faz `mDesc.innerHTML=d+'<br>'+moralStatusLine()`, mas dezenas de eventos montavam a descrição já concatenando `+moralStatusLine()`. Resultado: PERFIL + multiplicadores apareciam **duas vezes**. Além disso, a linha imprimia todos os multiplicadores mesmo neutros (`×1`).
- **FIX 4** — Faltava metadata de apresentação; a narrativa existia, mas o efeito mecânico ficava implícito no texto.
- **FIX 5** — Sobreposição real: dois chips `position:absolute` desenhados por cima da coluna `#slots`.
- **FIX 6** — O desenho da presença copiava o vocabulário visual do beacon; só trocava símbolo/cor.

## 4. Mudanças (visão geral)

Seis commits pequenos e coerentes (ver §14 e o log). Nenhuma alteração de
Theme/intensity/composition, budget, `fractureShapeWave`, moralidade,
economia ou balanceamento. Todas as chamadas ao novo código estão isoladas e
retrocompatíveis.

## 5. Event UI

- **`openEvent()`** agora, ao abrir qualquer evento, faz `#m-tabs` → `display:none` e `innerHTML=''`. A loja continua exibindo as abas normalmente (`renderShop()` as reativa). Cobertura: eventos comuns, de facção e beacon.
- **`moralStatusLine()`** foi reescrita:
  - **PERFIL** em uma linha (com tiers e `[CONFLITO]` quando houver);
  - **ESTADO DA RUN** em um bloco separado que mostra **só** os modificadores realmente ativos (≠ `×1`), com ▲ (ganho) / ▼ (perda) e cor — em vez de uma parede de `×1`.
  - A duplicação foi eliminada: todos os eventos que passavam `moralStatusLine()` inline dentro de `evHead(...)` tiveram essa chamada removida (o `evHead` já a anexa uma vez). Eventos de render direto (`mDesc.innerHTML=`) mantêm sua única chamada.

## 6. Impacto das escolhas (IMPACTO NA RUN)

Nova camada **declarativa e só de apresentação** — a gameplay dentro do
callback continua sendo a única fonte de verdade:

- `evImpactHTML(impacts)` renderiza a seção **IMPACTO NA RUN**.
- `evOpt(nm, ds, vec, extra, dis, fn, impacts)` ganhou o 7º parâmetro opcional `impacts` (retrocompatível: sem ele, nada muda).
- Cada impacto: `{ k:'RÓTULO', v:'VALOR', t:'gain|loss|risk|moral|hidden|neutral', d:'DURAÇÃO/ONDAS' }`.
- Marcadores/cores distintos por tipo (`EV_IMPACT_STYLE`): ▲ ganho, ▼ perda, ⚠ risco, ◆ moral/afinidade, ? oculto, · neutro.
- **Nada é inventado**: quem chama deriva o valor do mesmo número que o callback aplica.
- **Efeito oculto proposital** (ex.: conteúdo de cofre) usa `t:'hidden'` — sinaliza o risco sem revelar o valor secreto.
- **Ausência de impacto não quebra a UI** (retorna string vazia).

Cobertura aplicada a eventos representativos de cada categoria: **A FORJA
ABANDONADA**, **O SOBREVIVENTE FERIDO**, **O MERCADOR RENEGADO** (risco:
guardas na arena), **O COFRE SELADO** (conteúdo desconhecido), **A EMBOSCADA
TEMPORAL** (ameaça + recompensa), **A CÂMARA DE ECO** (facção ÂNCORA:
afinidade). Migração completa das 166 chamadas `evOpt` fica como **dívida
declarada** (§16) — a camada é incremental e segura.

## 7. Echo survivability (autopreservação)

Camada leve que corrige **o ALVO de movimento** (`tx,ty`) — nunca stats,
velocidade, invulnerabilidade, teleporte ou nerf de inimigo:

- **`echoSurvivalTol(e)`** — tolerância a risco por personalidade e papel:
  - AGRESSIVO 1.35 · IMPULSIVO 1.5 · RESILIENTE 1.2 · OPORTUNISTA 1.0 · PRECISO 0.8 · CAUTELOSO 0.7;
  - GUARDIÃO (slot 1) ×1.1 (segura a linha); confiança alta coopera mais tempo.
- **`echoSurvivalAdjust(e, tx, ty)`** — num **único passo O(inimigos)** avalia risco local (raio 210px): conta inimigos próximos, direção média de fuga, distância do mais próximo, com **peso extra** para boss (×3) e miniboss (×2).
  - **Distância ideal**: melee pode chegar perto (~46px); ranged mantém folga (~124px). Vulnerabilidade amplia a folga.
  - **Estado defensivo**: HP relativo < 50% e escudo quebrado aumentam `vuln` (0..1.2) → mais recuo.
  - **Recuo**: foge da direção média das ameaças, com **viés leve (30%) para o jogador** (região mais segura), passo 90–180px, misturado ao alvo original pela intensidade da necessidade.
- Integração em `updateEcho`: aplicada só na fase de engajamento em combate real, **depois** dos retornos de Dissonância/hostil (que não são afetados). Marca `e.repositioning` para inspeção DEV.
- **Não é IA perfeita** — é "um companheiro que tenta sobreviver", não um bot imortal. IMPULSIVO ainda arrisca; a autopreservação só evita a morte boba recorrente.

## 8. HUD

Canto superior direito reorganizado em **hierarquia** dentro de `#slots`:

- **ECONOMIA** (`#grp-econ`): Créditos + ⧗ Resíduos;
- **ESTADO TEMPORAL** (`#grp-temporal`): Fractura + Perfil;
- **ECHOS** (`#grp-echos`): Echo·01 + Echo·02.

Os chips dinâmicos de **Resíduos** e **Fractura**, antes `position:absolute`
(sobrepostos à coluna), agora entram **no fluxo** dos grupos (`grp-econ` e topo
de `grp-temporal`). CSS `.hudgrp` empilha itens com respiro pequeno e separa os
grupos com espaço maior; `min-width:206px` consistente para todos os chips;
`box-sizing:border-box` evita quebras com strings longas. Nenhuma informação
foi escondida ou reduzida a fonte minúscula; sem overlap; sem HUD persistente
novo.

## 9. Identidade visual da presença de facção

Abandonada a gramática do beacon (anel pulsante + disco + rótulo). Cada facção
recebeu uma **estrutura própria reconhecível em silhueta** (função dedicada):

- **Pegada de solo** distinta (hexagonal para ÂNCORA, quadrada para CONSÓRCIO) — telegrafa "estrutura instalada".
- **Raio de interação tracejado** (`setLineDash`) em vez do anel sólido do beacon.
- **Tag `▣ PRESENÇA DE FACÇÃO`** sob o nome, separando de evento comum (que usa só o nome do sinal).

### ÂNCORA — NÓ DE CONTENÇÃO (`fpDrawAnchor`)
Ordem / contenção / geometria / estabilidade. Pés fixos ancorados ao solo (não
giram), **dupla moldura hexagonal concêntrica** com contra-rotação mínima
(disciplina), **escoras de contenção** radiais e **núcleo estabilizado**
(quadrado + ponto → leitura "travado"). Cor `#8fd6ff` é apoio.

### CONSÓRCIO — CACHE TEMPORAL (`fpDrawConsortium`)
Recurso / máquina / transação / armazenamento. **Cofre-losango** central com
compartimento interno (giro lento), **colchetes de armazenamento** nos quatro
cantos e **cacos de recurso orbitando** em torno (assimetria oportunista, giro
contínuo). Cor `#ffd166` é apoio.

**Distinção além da cor**: símbolos (⬡ vs ◈), silhuetas (moldura ancorada vs
cofre orbital), ritmo de animação (contra-rotação disciplinada vs órbita
contínua) — distinguíveis mesmo em grayscale.

## 10. Regra visual das quatro facções (para B4)

Regra formalizada a partir deste FIX — **não implementar agora**. Cada facção
física deverá ter linguagem própria composta por **silhueta + geometria +
ritmo de animação + FX + símbolo + cor + comportamento visual**:

- **ÂNCORA** ⬡ `#8fd6ff` — ordem / contenção / geometria / estabilidade. *(implementada neste FIX)*
- **CONSÓRCIO** ◈ `#ffd166` — recurso / máquina / transação / armazenamento. *(implementada neste FIX)*
- **REMANESCENTES** ◉ `#7dffc4` — orgânico / memória / sobrevivência / Echo / reconstrução. *(B4)*
- **DESVIADOS** ◬ `#ff4df0` — anomalia / assimetria / mutação / instabilidade. *(B4)*

## 11. Save / Continue

- **SM_VERSION permanece 3** e **FRACTURE_STATE_VERSION permanece 1** — sem migração.
- Presença física continua serializada em `cp.presence` (B2) e reconstruída no Continue (B3), sem duplicar posição, recompensa ou UI de evento.
- Nenhuma mudança deste FIX toca o save: Event UI e HUD são camadas de apresentação; a autopreservação não persiste estado.

## 12. Sandbox

Continua isolado: o spawn físico segue bloqueado em `sandboxRun`; os hooks de
sandbox limpam a entidade; nada de Event UI/HUD/IA vaza estado persistente. A
autopreservação é puramente derivada do frame (não grava nada).

## 13. Performance

- `echoSurvivalAdjust` faz **um** laço `O(inimigos)` por Echo por frame (sem pathfinding, sem O(Echos×enemies×caro)).
- O desenho das facções é procedural **O(1)** por frame (contagem fixa de segmentos/orbitais; **sem partículas sem cap**, sem timers órfãos).
- `FACTION_PRESENCE_ACTIVE_CAP = 1` mantido; `PARTS_MAX` e `ENEMY_BUDGET` **não** foram aumentados.

## 14. Testes

Suíte nova `tests/pr14-b3-fix-playtest.test.js` (**39 casos**):

- **Event UI** (1–8b): abas não vazam para eventos; loja mantém abas; sem duplicação de PERFIL; ESTADO DA RUN só com modificadores ativos.
- **Event Impact** (9–17): render de impactos; ganho ≠ perda; duração/ondas; moral/afinidade; oculto não revelado; nada inventado; ausência não quebra.
- **Echo AI** (18–28b): recuo por proximidade/vulnerabilidade/densidade; melee ainda engaja; personalidade e papel importam; Dissonância/hostil intocados; sem buff de HP/Shield; sem NaN; boss aumenta recuo.
- **HUD** (29–33b): grupos hierárquicos; chips no fluxo (sem `position:absolute`); min-width consistente.
- **Faction Visual** (34–43): helpers próprios; ≠ beacon; distinção além da cor; cap 1; interação/recompensa idênticas ao B3; sem faction enemy; Theme/intensity imutáveis; draw não lança.
- **Save/Versões/Regressões** (47–50 + extras): SM=3; FRACTURE_STATE_VERSION=1; 0.8.0-alpha; 12+4 eventos; elegibilidade física.

Integração: `package.json` **29 → 30** suítes; meta-teste em
`tests/fracture-director.test.js` atualizado. **`npm test` → exit 0**, sem
falhas.

## 15. Stress / simulação

- **Echo AI**: 300 configurações (6 personalidades × slots × HP alto/baixo × escudo cheio/quebrado × 0–5 inimigos) — todas finitas, dentro da arena, sem NaN, sem deslocamento explosivo.
- **Faction Presence**: o stress do B3 (200 seeds × ondas 1–20) permanece verde — cap 1, posições válidas, sem presença fantasma, Theme imutável, zero faction enemy.

## 16. Dívidas restantes

- **Migração completa de `impacts`**: cobrimos categorias representativas; as 166 chamadas `evOpt` restantes podem receber `impacts` incrementalmente (a UI já suporta; sem impacto = sem seção). **Dívida declarada**, não bloqueante.
- **Ajuste fino da autopreservação**: os pesos foram escolhidos de forma conservadora; o playtest humano seguinte pode calibrar.

## 17. Itens explicitamente adiados

Não implementados neste FIX (fora de escopo): REMANESCENTES/DESVIADOS físicos,
reações novas dos Echos às facções (B4), comportamento HOSTIL/ALIADO completo
(B5), unidades de facção em `enemies[]`, Fracture Theme por facção, mudanças em
`fractureShapeWave`/Theme/intensity, contratos, moeda nova, moralidade nova,
bosses, difficulty rework, rework de Loja/Módulos, expansão de meta.

## 18. PR14.5 — Loja Temporal / Módulos Passivos / significado do Perfil

Registrado como **dívida planejada** (não tratada agora): muitos Módulos
Passivos hoje são "bom, compro se tiver dinheiro" — a decisão virou
preço/orçamento em vez de identidade de build; e o PERFIL, embora visível, tem
importância prática pouco percebida durante a run. O bloco **PR14.5** deverá
revisar trade-offs, condições, especialização, sinergias, incompatibilidades,
Sintonia/Attunement, o Perfil e criar decisões onde **não** comprar é racional
mesmo com dinheiro. Nenhuma alteração estrutural nisso neste FIX.

---

### DEV MODE (playtest humano)

Helpers só em `DEV_MODE` (inertes fora dele; não persistem, não alteram
afinidade/meta):

- `DEV.forceFactionPresence('anchor'|'consortium')` — materializa a presença para inspeção visual (respeita o cap).
- `DEV.factionPresenceState()` — snapshot read-only da presença física.
- `DEV.echoRisk()` — inspeciona autopreservação de cada Echo (personalidade, HP%, escudo quebrado, reposicionando, tolerância) sem alterar gameplay.
- Comandos de console `fp:anchor` / `fp:consortium` continuam disponíveis.

# PR14 · B6-FIX.1 — Correção da geometria do balão de fala do Echo

FIX pequeno e isolado do B6. **Não** altera balanceamento, facções,
diplomacia, scheduler, Loja, HUD, eventos ou Fracture Director. Corrige
somente o problema comprovado do balão de fala e a regressão de testes
diretamente relacionada.

- **Versões congeladas:** ECHO `0.8.0-alpha` · `SM_VERSION=3` ·
  `FRACTURE_STATE_VERSION=1`.
- **Baseline (antes de editar):** `npm test` verde (exit 0);
  `pr14-b6-finalization` 104/104.
- **Depois:** `npm test` verde (exit 0), **38 suítes**. Nova suíte
  `tests/pr14-b6-fix1-speech-bubble.test.js` (**62 casos**, todos verdes).

---

## 1. Bug visto no playtest humano

O B6 automático passou, mas o playtest humano reprovou o balão de fala.

### Reprodução 1 — stress `DEV.echoSpeakLong(60)`
- Wrapping horizontal ok, várias linhas.
- **Mas** o balão ficava absurdamente alto: começava perto do topo, descia
  até a região inferior, o texto continuava além da área útil e invadia a
  parte de baixo da tela. Não havia política vertical para o caso extremo.

### Reprodução 2 — fala realista (BUG PRINCIPAL)
```
DEV.echoSpeak('A fratura está mudando de novo. Não sei quanto tempo essa estabilidade vai durar.')
```
- Wrapping correto (~3–4 linhas), **mas o retângulo terminava antes do
  texto**: as linhas inferiores ficavam fora da caixa e desciam sobre o Echo.
- Ou seja: **nem uma fala plausível cabia** no balão.

---

## 2. Causa raiz exata

O renderer B6 usava **duas âncoras Y opostas** para caixa e texto:

- **Caixa:** `ry = yy - bh + 4`, com `bh = N*lh + 10`. O **fundo** ficava
  fixo em `yy+4` e a caixa **crescia para cima**.
- **Texto:** primeira linha com baseline em `ty = yy - 6` e **descia**
  (`ty += lh`), com `textBaseline` default (`alphabetic`).

As duas âncoras só coincidem com **N = 1 linha**. Para N ≥ 2 o texto desce a
partir de `yy-6` enquanto a caixa se mantém ancorada no rodapé `yy+4` →
overflow inferior crescente.

**Prova numérica** (px=15, lineHeight=21), overflow do texto abaixo do rodapé
da caixa:

| N linhas | overflow abaixo da caixa | espaço vazio no topo |
|---:|---:|---:|
| 1 | 0 (ok) | ok |
| 2 | ~14 px | ~30 px |
| 3 | ~35 px | ~51 px |
| 4 | ~56 px | ~72 px |
| 6 | ~98 px | ~114 px |
| 10 | ~182 px | ~198 px |

Isso explica **os dois sintomas**: fala realista (3–4 linhas) vazando por
baixo, e stress (dezenas de linhas) com caixa gigante e texto muito além dela.

### Por que os testes anteriores não pegaram
A suíte B6 validou **wrapping** (nº de linhas, largura ≤ maxW) e derivou a
"altura" e as "bordas" a partir do **próprio retângulo desenhado** — nunca
comparou a **posição real do texto** contra as bordas da caixa. Como o bug
estava exatamente na divergência entre âncora do texto e âncora da caixa, os
asserts passavam. O B6-FIX.1 fecha essa lacuna com testes de **geometria
final do desenho** (posição de cada linha vs. retângulo).

---

## 3. Arquitetura

### Anterior
`echoSpeak → speechRender` (com `speechWrapLines`). O `speechRender`
calculava largura/altura/posição e desenhava caixa e texto com fórmulas
independentes e âncoras Y opostas.

### Corrigida — LAYOUT ÚNICO
Novo `speechLayout(txt,px,ex,ey,er)` calcula **tudo** e é a única fonte de
verdade; `speechRender` só desenha a partir do resultado:

```
speechLayout → { lines, N, px, lh, gh, padX, padY, bw, bh, rx, ry, textX, textTop, truncated }
```

- `speechRender` fixa `textBaseline='top'` (âncora determinística) e desenha
  caixa em `(rx,ry,bw,bh)` e cada linha em `(textX, textTop + i*lh)`.
- **Texto e caixa derivam do mesmo `rx/ry`** ⇒ qualquer clamp move os dois
  juntos por construção (não há mais como divergirem).

Arquivos alterados:
- `index.html` — `speechLayout`, constantes de layout, `speechEllipsize`,
  `speechLineH`, `speechGlyphH`, `speechRender` reescrito.
- `tests/pr14-b6-fix1-speech-bubble.test.js` — nova suíte de geometria (62).
- `tests/pr14-b6-finalization.test.js` — teste 27 atualizado (o wrap migrou
  para `speechLayout`; render agora deriva do layout único).
- `package.json` + `tests/fracture-director.test.js` — registro (38 suítes).

---

## 4. Regras de geometria

- **speechWrapLines:** inalterada (quebra por palavra + quebra segura de
  palavra longa, grapheme-safe, preserva acentos/símbolos/nomes/`\n`).
- **Largura:** `bw = maxLineWidth(≤ SPEECH_MAXW=236) + 2·SPEECH_PADX(8)`.
- **Line-height:** `lh = px + 6` (avanço entre topos de linha).
- **Altura de glifo:** `gh = ceil(px·1.2)` (altura visual de uma linha).
- **Altura da caixa:**
  `bh = 2·SPEECH_PADY(6) + (N-1)·lh + gh`
  → a **última** linha cabe inteira dentro da caixa (topo + N−1 avanços +
  altura da última linha + padding base).
- **Padding:** `SPEECH_PADX=8` (esq/dir), `SPEECH_PADY=6` (topo/base).
- **Posição:** centrado no Echo, rodapé `SPEECH_GAP_ABOVE=14`px acima da
  cabeça (`ry = ey - er - 14 - bh`).
- **Clamp:** o **retângulo inteiro** é clampado na área útil
  `[cam±vw/2, cam±vh/2]` menos `SPEECH_VIEW_MARGIN=6`. Se o balão for maior
  que a tela, é centralizado na câmera (fallback, sem cortar).
- **Âncora do texto:** `textX = rx + bw/2`, `textTop = ry + padY`.

---

## 5. Política para conteúdo extremo

- **Falas reais SEMPRE completas.** `SPEECH_MAX_LINES=6` é o teto de linhas;
  a maior fala real do jogo tem **3 linhas** (headroom de +3).
- **Teto adaptado à viewport:** o nº de linhas nunca ultrapassa o que cabe na
  altura visível (`viewMax`), então em telas baixas o balão continua dentro
  da tela.
- **Truncamento só em input artificial/DEV** que exceda o teto: a última
  linha visível recebe `…` (via `speechEllipsize`). Nenhuma fala real atinge
  esse limite (provado por teste — caso 47).
- **Fonte preservada** (15/16/17px por prioridade); **sem** reduzir fonte,
  **sem** caixa dominando a tela.

---

## 6. Maior fala real do jogo

Auditado o corpus que passa por `echoSpeak` (`ECHO_LINES`,
`ECHO_FACTION_REACTIONS`, `ECHO_DIPLO_REACTIONS`, `FRACTURE_B4_ECHO_LINES`):

- **~140 falas coletadas.**
- **Maior:** 67 caracteres → **3 linhas** @236px, ex.:
  *"A ressonância recalibra minha assinatura. Precisa, não sentimental."*
- **Máximo de linhas entre TODAS as falas reais: 3.**

**Alguma fala real seria truncada?** **Não.** Teste 47 varre o corpus inteiro
e falha se qualquer fala real for marcada como truncada. Teste 46 exige que a
maior fila real caiba em ≤ 4 linhas; teste 50 garante `SPEECH_MAX_LINES ≥
max_real + 2`.

---

## 7. Duração

Inalterada em contrato: derivada do texto, cap de **5.0s** (B2-A) preservado,
com termo leve por linha estimada **dentro** do teto. Determinística.

## 8. Performance

- Layout/render só rodam quando há fala ativa (`if(!speechActive)return;`).
- `speechLayout` faz apenas `measureText` das linhas (mesmo custo de antes) —
  sem `getImageData`/gradientes por frame. Sem novos loops por frame, sem
  `Math.random`, sem timers.

## 9. Helpers DEV

Preservados e úteis para o playtest, ambos DEV-only (`devReady()`), sem vazar
como global:
- `DEV.echoSpeakLong(n, slot)` — fala sintética de ~n palavras (slot opcional
  do Echo).
- `DEV.echoSpeak(txt, slot)` — texto arbitrário do operador (slot opcional).

---

## 10. Testes

Nova suíte `tests/pr14-b6-fix1-speech-bubble.test.js` (62 casos):
arquitetura/layout único (1–8), falas normais cabem 100% (9–18), palavra
gigante/acentos/`\n` (19–24), stress vertical (25–32), viewport/clamp nas 9
posições + delta caixa=texto (33–44), **falas reais sem truncamento** (45–50),
duração/pipeline (51–58), DEV/performance/release (59–62).

Lacuna anterior fechada: os testes agora comparam a **posição real de cada
linha desenhada** contra as bordas do retângulo (geometria final), não só o
wrapping.

## 11. Roteiro humano

Ver seção final do relatório (Testes A–D).

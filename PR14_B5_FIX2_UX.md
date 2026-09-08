# PR14 · B5-FIX.2 — Ajustes visuais finais do encontro de pacto

> Correção derivada do **playtest humano do B5-FIX.1**. A mecânica de pacto já
> foi aprovada; este FIX é **apenas de UX/legibilidade**. Nada de balanceamento,
> thresholds, rivalidades, scheduler, economia ou do feedback de 4–5 s (todos
> intactos). **O B5 NÃO está encerrado** — haverá um playtest visual humano curto
> antes do B6.

---

## 1. O que o playtest apontou

A mecânica passou (pacto fora da Loja, proposta pela presença física, FAVORÁVEL
não autoformaliza, recusar mantém independência sem broke/penalidade, reoferta e
aceitação funcionando, ÂNCORA↔DESVIADOS coerentes, feedback de ~4,6 s confortável).
Restaram **quatro ajustes visuais pequenos**:

- **A —** o marker `◆ PACTO DISPONÍVEL` na arena estava discreto demais: em
  combate, a presença podia parecer uma presença comum da facção.
- **B —** o modal do encontro mostrava `0 CRÉDITOS` (sobra do modal de Loja/Evento).
- **C —** o modal mostrava `REGISTRO DA RUN · ARSENAL (…)` / `NENHUM MÓDULO
  INSTALADO AINDA` — irrelevante para a decisão de pacto.
- **D —** o corpo da opção `ACEITAR` estava um pouco denso, repetindo o que o
  bloco `IMPACTO NA RUN` já lista.

---

## 2. A — Marker do pacto mais evidente (sem redesenhar a presença)

Em `factionPresenceDrawEntity`, o adorno de `pactOffer` foi reforçado — mas segue
sendo um **adorno sobreposto**, não uma entidade nova, não um popup central, sem
flashing agressivo. A identidade da facção (`⬡ ◉ ◈ ◬` + nome) continua dominante.

| | Antes (FIX.1) | Depois (FIX.2) |
|---|---|---|
| Aura | 1 anel `lineWidth 2`, alpha `.10+.16·pulso` | **anel forte** (`lineWidth 2.5`, `.16+.20·pulso`) **+ halo suave** atrás (`lineWidth 6`) |
| Sinal orbital | — | **losango `◆` orbitando** devagar ao redor da presença |
| Marcador ◆ acima | `14px`, sem brilho | **`bold 20px` com brilho** (`shadowBlur 10+6·pulso`) |
| Tag de estado | `◆ PACTO DISPONÍVEL` em `8px` | **`bold 11px` com brilho**, afastada do nome |

Cuidados: pulso lento e calmo (`sin(pulse·2.2)`), sem allocations por frame, sem
partículas; a tag fica afastada (`-e.r-11`) para não sobrepor nome/HP/Echo/inimigos/HUD.

Uma presença **comum** (sem `pactOffer`) mantém exatamente a gramática antiga
(tag `▣ PRESENÇA DE FACÇÃO` discreta) — continua **distinta** da de pacto.

---

## 3. Mensagem de aproximação — preservada

A mensagem útil `APROXIME-SE …` (banner + toast de facção no spawn, texto real
`◆ PACTO DISPONÍVEL — APROXIME-SE PARA NEGOCIAR`) foi **mantida** como está. O
playtest a considerou útil; não foi removida nem reduzida.

---

## 4. B/C — Limpeza do modal (só neste contexto)

`mCoins` e `mOwned` são elementos **compartilhados** do modal (Loja, eventos,
etc.). Em `fpOpenPactEncounter` eles agora são **esvaziados** (`mCoins.textContent=''`,
`mOwned.innerHTML=''`), pela mesma prática já usada no modal de confirmação
(`closeConfirm`/`openConfirm` também zeram esses campos).

- **Não** houve remoção global: Loja (`openShop`) e eventos (`openEvent`)
  repopulam créditos e registro da run nos **seus próprios fluxos**.
- O encontro de pacto fica focado em: **facção · nome da proposta · lore curta ·
  ACEITAR · MANTER INDEPENDÊNCIA · IMPACTO NA RUN**.

**Modal antes** (encontro de pacto):
```
⬡ ÂNCORA — PROTOCOLO DE CONTENÇÃO
"A ORDEM RECONHECE VOCÊ COMO PARTE DA ESTRUTURA."  + frase de lore
[ ACEITAR · … (parágrafo longo) ]   [ MANTER INDEPENDÊNCIA ]
REGISTRO DA RUN · ARSENAL (2/4): …
NENHUM MÓDULO INSTALADO AINDA.
◈ 0 CRÉDITOS
```
**Modal depois**:
```
⬡ ÂNCORA — PROTOCOLO DE CONTENÇÃO
"A ORDEM RECONHECE VOCÊ COMO PARTE DA ESTRUTURA."  + frase de lore
[ ACEITAR · … (frase curta) + IMPACTO NA RUN ]   [ MANTER INDEPENDÊNCIA ]
(sem créditos, sem arsenal, sem módulos)
```

---

## 5. D — Texto de ACEITAR enxuto

Novo mapa `FACTION_PACT_ACCEPT_LINE` com **uma frase curta por facção** (≤ 140
chars), coerente com a lore, **sem repetir** os rótulos do `IMPACTO NA RUN`
(`RELAÇÃO RESTRINGIDA` / `EXCLUSIVO NESTA RUN` / `PASSA A COOPERAR`). A estrutura
`TÍTULO → frase curta → IMPACTO NA RUN` foi preservada.

| Facção | Corpo de ACEITAR (curto) |
|---|---|
| **ÂNCORA** | "Selar a aliança com a ÂNCORA e assumir seu eixo de estabilidade nesta run." |
| **REMANESCENTES** | "Selar o vínculo com os REMANESCENTES e assumir seu eixo de continuidade nesta run." |
| **CONSÓRCIO** | "Firmar o acordo com o CONSÓRCIO e assumir seu eixo de acesso nesta run." |
| **DESVIADOS** | "Aceitar a FENDA dos DESVIADOS e assumir seu eixo de transformação nesta run." |

**IMPACTO NA RUN** (inalterado; estados, não números crus):
```
▲ <FACÇÃO>       → ALIADA (PACTO)
▼ <RIVAL>        → RELAÇÃO RESTRINGIDA
• EIXO IDEOLÓGICO → EXCLUSIVO NESTA RUN
• PRESENÇA FÍSICA → PASSA A COOPERAR
```

`MANTER INDEPENDÊNCIA` **não** foi alterado (já estava claro: recusar por
enquanto, segue FAVORÁVEL, sem custo, sem ruptura, oferta pode voltar).

---

## 6. O que NÃO foi tocado

- **Mecânica diplomática:** thresholds (58), rivalidades, teto, `pactBroke`,
  ruptura, consolidação, reoferta — idênticos.
- **Scheduler / economia / Save-Continue** (além do necessário para regressão).
- **Feedback de presença aprovado:** `.toast.fp` (~4,6 s, 3 linhas) e o toast
  comum (2,1 s) intactos.
- **DEV:** `DEV.forcePactOffer`, `DEV.forceFactionPresence`, `DEV.factionDiplomacy`,
  `DEV.diploScenario`, `Ctrl+Shift+D`, `Ctrl+Shift+I` — preservados.
- **Sem** rework geral de UI; **PR18** segue reservado para o rework estrutural.

---

## 7. Testes

Nova suíte **`tests/pr14-b5-fix2-pact-ux.test.js`** — **33 casos**, integrada ao
`npm test` (agora **36 suítes**; meta-teste atualizado). Cobre: pacto fora da
Loja; marker específico no draw; presença normal sem marker; mensagem de
aproximação; interação abre `fpOpenPactEncounter`; modal sem créditos/arsenal/
módulos; Loja **ainda** mostra créditos e arsenal; ACEITAR/MANTER/IMPACTO/rival
preservados; aceitar consolida; recusar sem broke/penalidade; reoferta;
Save/Continue; versões; texto de ACEITAR curto e coerente por facção; feedback de
4–5 s e toast comum intactos; marker com negrito+brilho; identidade da facção
dominante; FACÇÃO ≠ TEMA.

Regressão executada e verde: B5-FIX.2 (33), B5-FIX.1 (86), B5 (97),
devtools-shortcut (21), B4 (78), B3-FIX (39) e `npm test` completo (**36 suítes**).

---

## 8. Dívida — FUTURO PR18

O rework estrutural de UI/UX (HUD, Loja, Codex, tipografia, hierarquia visual
global) permanece reservado ao **PR18**. Este FIX limitou-se aos quatro ajustes
visuais do encontro de pacto.

---

## 9. Roteiro humano rápido

1. `DEV.forcePactOffer('anchor')` → veja a presença com **aura dupla + losango ◆
   orbitando + ◆ grande brilhante + tag PACTO DISPONÍVEL** legível durante combate;
   uma presença comum (`DEV.forceFactionPresence('anchor')`) continua discreta.
2. Aproxime-se → o modal abre **sem** `0 CRÉDITOS`, **sem** arsenal, **sem**
   módulos; ACEITAR tem uma frase curta + IMPACTO NA RUN claro (rival RESTRINGIDA).
3. Abra a **Loja** normalmente → créditos e registro da run **continuam** lá.
4. Interaja com presenças comuns → o feedback de ~4–5 s (3 linhas) continua igual.

# PR15.7-B.5 — HUD / Comunicação da Repetição Ancorada

## Problema

A Repetição Ancorada já funcionava mecanicamente, mas aparecia na HUD como
mais um indicador independente. Arma, Dash, Especial e Repetição ficavam
espalhados como quatro peças no canto inferior direito, o que diminuía a
leitura de que a Repetição é uma capacidade central do jogador.

Este bloco não altera o contrato de combate da Repetição. A intervenção é
exclusivamente de comunicação, hierarquia, responsividade e feedback visual.

## PR15.7-B.5-FIX — compactação após replaytest humano

O replaytest confirmou que a organização funcionava, mas apontou que o kit
ficou desnecessariamente grande. O B.5 usava uma faixa de até 720 px em
1920×1080 (560 px no breakpoint de telas menores), com cada habilidade
ocupando toda a largura e slots de arma de 122 px, chegando a 138 px no
ativo.

A correção mantém o mesmo wrapper e a mesma hierarquia, mas passa a abraçar
o conteúdo: o kit usa `width: max-content`, largura máxima apenas defensiva
para não sair da viewport e habilidades com largura controlada de até 250 px.
Os slots passam para 78 px (88 px no ativo), com padding/gaps menores,
ícones reduzidos e metadados secundários mais discretos. As barras passam a
3 px e os blocos de habilidade usam padding vertical mínimo.

Em uma composição completa, isso reduz a largura típica do kit de cerca de
720 px para aproximadamente 430 px, sem reduzir a clareza da Repetição.
Com poucos slots, o wrapper acompanha a largura das habilidades em vez de
preencher espaço vazio. Em ARMED, apenas a Repetição recupera presença
extra por borda, brilho e pulso temporal.

Preservados integralmente: `#combat-kit`, agrupamento dos quatro elementos,
estados READY/ARMED/COOLDOWN, inputs R/R3 e Dash/Especial, constante
`TEMPORAL_REPLAY_COLOR`, integração com o marker, responsividade, feedback,
especial ausente e todos os invariantes mecânicos.

## Solução escolhida

Foi implementado o **Layout B — reorganização moderada**: um wrapper fixo e
compacto chamado `#combat-kit`, no canto inferior direito, agrupa as ações
imediatas do jogador nesta ordem:

1. `#weapwrap` — arma e slots;
2. `#dashwrap` — Dash;
3. `#spwrap` — Especial;
4. `#temporalwrap` — Repetição Ancorada.

HP/Escudo, XP, créditos, moral, Echos, onda, timer e abates permanecem fora
do wrapper. O kit tem fundo escuro translúcido, borda ciano discreta e não
usa `backdrop-filter`, partículas ou loop visual próprio.

## Estrutura DOM

```html
<div id="combat-kit" role="group" aria-label="Kit de combate">
  <div id="weapwrap" aria-label="Armas"></div>
  <div id="dashwrap" class="kit-ability">...</div>
  <div id="spwrap" class="kit-ability">...</div>
  <div id="temporalwrap" class="kit-ability" data-state="ready">...</div>
</div>
```

O arsenal preserva ícone, nome, slot, alcance e destaque da arma ativa. Em
larguras menores, os slots continuam em uma faixa horizontal rolável, em vez
de criarem uma coluna alta que invada a arena.

## Estados da Repetição

A função dedicada `updateAnchoredReplayHUD()` mantém três estados visuais
principais, expostos também em `#temporalwrap.dataset.state`:

- **READY** — `REPETIÇÃO · AGUARDANDO AÇÃO · [R]` ou `[R3]`. Deixa explícito
  que o próximo disparo elegível será registrado; não promete executar uma
  ação inexistente.
- **ARMED** — `REPETIÇÃO · AÇÃO ARMADA [R]` ou `[R3]`. A borda, a barra e o
  brilho passam para a identidade temporal magenta. A barra representa a
  janela restante de cinco segundos.
- **COOLDOWN** — `REPETIÇÃO · RECARGA Ns · [R]` ou `[R3]`. O bloco perde
  luminosidade, a barra representa o avanço da recarga e o tempo restante
  fica explícito.

Se uma ação for capturada durante uma recarga já existente, ela continua
visível como ARMADA e recebe o sufixo de recarga. Isso não cria uma nova
regra mecânica: apenas comunica os dois fatos que já podem coexistir no
estado interno.

## Feedback de transição

- READY → ARMED: pulso único curto no bloco, com microescala e aumento
  discreto de brilho;
- ARMED → COOLDOWN: o próprio pulso de mudança de estado e o rótulo de
  recarga comunicam o uso;
- COOLDOWN → READY: o mesmo pulso curto sinaliza que a capacidade pode ser
  usada novamente;
- expiração iminente: nos últimos aproximadamente 1,5 s, apenas o rótulo
  recebe uma variação sutil de intensidade (`.expiring`). Não há novo estado
  textual, flash agressivo ou animação contínua pesada.

## Input

O modo de input segue `padActive` e os bindings já existentes no jogo:

| Capacidade | Teclado/mouse | Gamepad |
|---|---|---|
| Dash | `[ESPAÇO]` | `[A / LT]` |
| Especial | `[E]` | `[X]` |
| Repetição | `[R]` | `[R3]` |

No teclado, os textos legados de Dash e Especial permanecem compatíveis. No
controle, o binding é mostrado por pseudo-elemento a partir de
`data-input`, sem reconstruir o DOM a cada atualização.

Os slots de arma continuam mostrando `[1]`–`[5]` quando aplicável. A revisão
dos bindings de slots para gamepad fica deliberadamente fora deste PR.

## HUD ↔ marcador do mundo

A cor principal da Repetição é centralizada em:

```js
const TEMPORAL_REPLAY_COLOR = '#ff4df0';
```

O módulo publica essa cor como `--temporal-replay-color`. A mesma fonte
alimenta:

- o estado ARMED e a barra da Repetição na HUD;
- a linha de direção de `drawTemporalActionMarker()`;
- o anel e as partículas breves de feedback do uso;
- a cor do projétil temporal de Shotgun, sem alteração de dano ou lógica.

O arco de janela do marcador permanece ciano, mantendo a distinção visual
entre presente/alinhado e fratura/interferência.

## Especial sem `C.sp`

A auditoria confirmou que o caminho anterior só atualizava o Especial quando
`C.sp` existia, mas deixava o elemento estrutural visível. Agora
`updateCombatKitHUD()` aplica `hidden` ao `#spwrap` quando não há especial e o
remove quando o especial volta a existir. Como o kit é flexível, o espaço é
reorganizado automaticamente, sem buraco visual.

## Responsividade e composição

- Em telas grandes, o kit tem largura máxima de 720 px;
- até 1100 px de largura, usa largura máxima de 560 px e permite rolagem
  horizontal dos slots;
- até 600 px de altura, reduz padding, gaps, labels e barras;
- o posicionamento usa `right`/`bottom` responsivos e permanece inferior
  direito;
- em alturas até 800 px, os toasts são elevados para não ficar sob a coluna
  do kit;
- o XP continua ancorado no inferior esquerdo e HP/Escudo continuam no
  superior esquerdo;
- o boss HUD continua no topo e não foi reposicionado.

As regras foram verificadas por código para 1920×1080, 1280×720 e o caso
crítico 960×540. A validação geométrica final em uma janela real continua
sendo parte do replaytest humano.

## Performance

`updateHUD()` continua throttled. Ele delega as capacidades imediatas para
`updateCombatKitHUD()`, que usa `hudText()` e só altera o texto quando ele
muda. A transição usa uma classe CSS única e bounded; não há query de DOM por
frame, `innerHTML` por frame, canvas adicional, blur novo, partículas
persistentes ou loop de entidades.

A atualização da barra continua discreta e segue a cadência existente da HUD.
O pulso usa nomes de animação específicos por estado, portanto reinicia sem
leitura de `offsetWidth` e sem forçar reflow/layout.

## Testes

Foi adicionada a suíte:

- `tests/pr15-7-b5-combat-kit-hud.test.js`

Ela cobre wrapper/ordem/escopo, READY/ARMED/COOLDOWN, janela e expiração,
pulsos de transição, R/R3, bindings de Dash e Especial para teclado e
controle, ausência de `C.sp`, responsividade, constante compartilhada,
marcador, limpeza, checkpoint e invariantes mecânicos da Repetição.

As suítes A/B existentes continuam sendo executadas sem modificação de suas
regras.

## Limitações e dívidas adiadas para PR18

- Os slots de arma não foram redesenhados para exibir bindings específicos de
  gamepad;
- a possível colisão entre `#fpind` e `#wave/#timer` não recebeu redesign;
- a largura dos slots em arsenais muito grandes pode exigir rolagem
  horizontal em telas de 960 px;
- a confirmação visual em hardware/janela real deve ser feita no replaytest
  humano, especialmente em 960×540;
- uma eventual revisão ampla da composição da HUD, incluindo HP/Escudo e
  elementos superiores, fica para PR18.

Nenhuma mecânica de Repetição, arma, dano, cooldown, janela, proc, Echo,
Director, progressão, save ou checkpoint foi redesenhada por este PR.

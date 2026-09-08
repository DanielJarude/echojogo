# PR14 · B4 — Quatro Facções Físicas + Reações dos Echos

> **Versão do jogo:** 0.8.0-alpha · **SM_VERSION:** 3 · **FRACTURE_STATE_VERSION:** 1
> **Bloco anterior:** B3 (Primeira Presença Física) — ver `PR14_B3_FACTION_PRESENCE_PHYSICAL.md` e os FIX `PR14_B3_FIX_PLAYTEST.md` / `PR14_B3_FIX1_PLAYTEST.md`
> **Suíte de testes:** `tests/pr14-b4-four-factions.test.js` (78 casos)
> **Harness de auditoria:** `audit_pr14/faction_presence_b4_audit.js`
> **Bloco de código novo:** `fp3.js` em `index.html` (entre os marcadores `PR14·bloco fp3.js` e `PR14·fim fp3.js`)

---

## 1. Objetivo e escopo

O B4 **completa o conjunto físico** da Presença de Facção. Onde o B3 provou a
arquitetura com apenas duas facções (⬡ ÂNCORA e ◈ CONSÓRCIO), o B4 acrescenta
as duas restantes — **◉ REMANESCENTES** e **◬ DESVIADOS** — e introduz a
**reação contextual dos Echos** às quatro presenças.

Duas metades bem separadas:

1. **Duas novas presenças físicas** com identidade visual inequívoca, efeito
   coerente com a filosofia da facção e balanço conservador (seções 5–12).
2. **Reações dos Echos** às quatro presenças, considerando personalidade ×
   facção × contexto, com anti-repeat determinístico e respeito absoluto à
   Dissonância (seções 13–20).

O B4 **não** abre rivalidades entre facções, alianças, facções hostis como
inimigos, nem persistência de Echos entre runs. Tudo isso é dívida técnica
registrada (seção 30).

## 2. Relação com o B3 (o que é reusado, o que é novo)

O B4 **não** reescreve o B3. Ele estende os mesmos pontos:

| Item | B3 | B4 |
|------|----|----|
| `FACTION_PRESENCE_PHYSICAL` | `['anchor','consortium']` | `['anchor','remnants','consortium','deviants']` |
| `FACTION_PRESENCE_LABEL` | 2 entradas | + `remnants` (◉) e `deviants` (◬) |
| `factionPresenceInteract` | ÂNCORA/CONSÓRCIO | + rotas REMANESCENTES/DESVIADOS |
| `factionPresenceDrawEntity` | dispatch p/ 2 desenhos | dispatch p/ 4 (`fpDrawRemnants`/`fpDrawDeviants`) |
| Reações de Echo | — | novo bloco `fp3.js` |

Os efeitos da ÂNCORA e do CONSÓRCIO **não mudaram** — a regressão é validada
pelos casos 11–19 e 76 da suíte B4, além das suítes B3 existentes.

## 3. Arquitetura: entidade única, cap = 1, sem novos agendadores

O B4 mantém as invariantes estruturais do B2/B3:

- **`FACTION_PRESENCE_ACTIVE_CAP = 1`** — nunca há mais de uma presença física
  na arena ao mesmo tempo. Um novo spawn substitui o anterior; não acumula.
- **Sem scheduler paralelo** — o B4 consome a mesma intenção agendada pelo B2.
  As quatro facções passam pelo mesmo caminho `scheduled → activate → entity`.
- **A entidade não entra em `enemies[]`** nem é aliado permanente; é um objeto
  plano dedicado, efêmero (TTL), consumido na interação.

## 4. Elegibilidade física: agora as quatro

`FACTION_PRESENCE_PHYSICAL` passou a listar as quatro facções, e
`fpIsPhysical(id)` retorna verdadeiro para todas elas. O conjunto derivado
`FACTION_PRESENCE_PHYSICAL_SET` é reconstruído a partir da lista, então não há
número mágico duplicado. Validação: casos 1–2.

## 5. Identidade das quatro presenças (silhueta antes do nome)

O requisito central do B4 é que cada presença seja **reconhecível antes de ler
o nome**. A diferenciação é por **silhueta + estrutura + movimento + geometria
+ footprint** — não apenas cor ou ícone.

| Facção | Símbolo | Cor | Nome da estrutura | Filosofia visual |
|--------|:-------:|-----|-------------------|------------------|
| ÂNCORA | ⬡ | `#8fd6ff` | NÓ DE CONTENÇÃO | hexágono rígido, ordem, contenção |
| REMANESCENTES | ◉ | `#7dffc4` | MEMORIAL RESSONANTE | orgânico/vertical, ondas de memória |
| CONSÓRCIO | ◈ | `#ffd166` | CACHE TEMPORAL | cofre/depósito, órbita mercantil |
| DESVIADOS | ◬ | `#ff4df0` | FENDA ADAPTATIVA | geometria quebrada, distorção temporal |

As cores batem com `FRACTION_BY_ID` (identidade canônica de cada facção — casos
5, 74–75). Os símbolos e nomes são únicos (casos 3–4, 6). A **footprint de
solo** também difere por facção: hexágono (âncora), quadrado rotacionado
(consórcio), círculo suave concêntrico (remanescentes) e triângulo irregular
que oscila (desviados) — ver `factionPresenceDrawEntity`.

## 6. REMANESCENTES — o MEMORIAL RESSONANTE (desenho)

`fpDrawRemnants(e,col,p,fade)` desenha uma silhueta **orgânica e viva**, oposta
à rigidez da Âncora:

- **Ondas concêntricas** que se expandem e somem (ressonância de memória).
- **Fragmentos** orbitando numa **elipse** lenta (assimetria orgânica — de
  propósito diferente da órbita circular perfeita do Consórcio).
- **Núcleo pulsante** que "respira" (dois círculos, sem bordas rígidas).
- **Aro fino** externo integrando o símbolo ◉.

Nada disso é opaco: as alfas são baixas (`0.4–0.55` moduladas por `fade`), então
o FX **não esconde** inimigos, projéteis, Echos ou o player em hordas.

## 7. REMANESCENTES — o efeito (vínculo, não cura genérica)

A filosofia dos Remanescentes é **memória / vínculo / ressonância / quase-vivo**.
O efeito escolhido é **um só** e envolve **os Echos** (não o player):

> **Restaura uma fração LIMITADA do escudo de cada Echo vivo aliado e reata um
> pouco de confiança.**

Constantes (seção 12):

- `FACTION_PRESENCE_REMNANTS_SHIELD = 0.35` — 35 % do `shieldMax` de **cada**
  Echo aliado vivo, com `Math.max(1, …)` para garantir ao menos +1 (caso 78) e
  `clamp(…, 0, shieldMax)` para nunca ultrapassar o teto (caso 21).
- `FACTION_PRESENCE_REMNANTS_TRUST = 4` — pequeno +confiança via o **ponto único
  de mutação** `changeEchoTrust(...,'faction_presence_remnants')`, que já aplica
  o `clamp(0,100)` (casos 23, 26).

Garantias explícitas (casos 20–26, 68):

- **Nunca dá HP**, nunca faz full-heal, **nunca revive** Echo morto.
- **Ignora Echo hostil** (`echoAllied` falso) — a Dissonância não é neutralizada
  nem "comprada" com carinho.
- **Múltiplos Echos** são atendidos corretamente, cada um pelo seu próprio
  `shieldMax`.
- Sem escudo disponível (`shieldMax === 0`) → só o pequeno +trust; **não vira
  cura genérica**.
- É **one-shot**: a presença é consumida; não há farm.

## 8. DESVIADOS — a FENDA ADAPTATIVA (desenho)

`fpDrawDeviants(e,col,p,fade)` traduz **distorção temporal** — não "glitch RGB
genérico":

- **Triângulo-base** com um **eco temporal** deslocado em **passos discretos**
  (`Math.floor(e.pulse*3)%3`): duas cópias em offset que se alternam, como um
  quadro atrasado no tempo.
- **Lascas trianguladas** que **saltam** de posição em passos (adaptação
  instável, não movimento contínuo).
- **Núcleo com pulso NÃO-uniforme** (soma de dois senos batendo) — nunca
  respira no mesmo ritmo, reforçando instabilidade.

A geometria é **quebrada e assimétrica**, imediatamente distinta do hexágono da
Âncora, da órbita do Consórcio e das ondas dos Remanescentes.

## 9. DESVIADOS — o efeito (risco ↔ adaptação, com trade-off)

A filosofia dos Desviados é **mutação / instabilidade / risco / adaptação**. O
efeito é **um trade-off temporário de atributo**, aplicado pelo **Stat Modifier
Pipeline** existente:

> **+20 % de dano do operador E +15 % de dano recebido, por 12 s.**

Constantes (seção 12):

- `FACTION_PRESENCE_DEVIANTS_DUR = 12` (segundos)
- `FACTION_PRESENCE_DEVIANTS_DMG = 1.20` (mult em `damage`)
- `FACTION_PRESENCE_DEVIANTS_TAKEN = 1.15` (mult em `dmgTaken`)

Implementação (casos 27–33, 67, 69):

```
smAdd(player,{id:'faction.deviants.dmg',  stat:'damage',  type:'mult',
  value:1.20, dur:12, stacks:'replace'});
smAdd(player,{id:'faction.deviants.taken',stat:'dmgTaken',type:'mult',
  value:1.15, dur:12, stacks:'replace'});
```

Garantias:

- **Sem +dano grátis**: o ganho vem sempre acompanhado do custo (`dmgTaken>1`),
  o que impede que os Desviados sejam a escolha "sempre-melhor" (caso 67).
- **Auto-expira** via `smTick` — nada a limpar manualmente; ao fim da duração,
  `damage` e `dmgTaken` voltam exatamente ao valor de base (caso 30).
- **Sem stacking indevido**: `stacks:'replace'` garante que reaplicar não
  empilha (caso 31).
- **Não toca HP nem escudo** (caso 32); é puramente um trade-off de atributo.
- É **one-shot** (caso 33).

## 10. DESVIADOS ≠ ANOMALIA (separação explícita)

**DESVIADOS é uma facção. ANOMALIA é um Fracture Theme.** São domínios
diferentes e não se cruzam:

- A facção `deviants` **nunca** é mapeada para o tema `anomaly` (nem para
  qualquer outro tema) — casos 61–63.
- Materializar/consumir a presença dos Desviados **não** altera o Theme, a
  intensidade, a composição, o `fractureShapeWave` ou o orçamento de inimigos
  (casos 61–62).
- A estética dos Desviados é **distorção temporal** (eco no tempo, passos
  discretos), deliberadamente distinta de qualquer FX de tema.

## 11. Interação one-shot e afinidade só-leitura

As quatro rotas passam pelo mesmo `factionPresenceInteract`, que aplica o efeito
**uma vez**, chama `echoFactionReaction(faction,'interact',e)`, resolve a
presença (B2) e limpa a entidade. A segunda interação é no-op (casos 15, 18, 33).

**Afinidade continua só-leitura**: nenhuma presença concede ou remove afinidade
automaticamente (casos 44, 64). O rótulo de estado de afinidade (`getFactionState`)
é lido apenas para nuance de texto no toast.

## 12. Constantes de balance (nada de número mágico espalhado)

Todas as constantes do B4 vivem juntas, comentadas, perto das do B3:

```
const FACTION_PRESENCE_REMNANTS_SHIELD=0.35;
const FACTION_PRESENCE_REMNANTS_TRUST =4;
const FACTION_PRESENCE_DEVIANTS_DUR   =12;
const FACTION_PRESENCE_DEVIANTS_DMG   =1.20;
const FACTION_PRESENCE_DEVIANTS_TAKEN =1.15;
```

A frequência de aparição **não** é tunada aqui (isso é B6); o B4 só precisa que
os efeitos sejam conservadores. Validação: caso 7.

## 13. Reações dos Echos — visão geral (bloco `fp3.js`)

Quando uma presença física **aparece** (`spawn`) ou é **interagida**
(`interact`), um Echo aliado pode **comentar** com uma fala. A reação combina:

**FACÇÃO × PERSONALIDADE × CONTEXTO** (+ Dissonância como filtro).

A fala é **puramente narrativa**: não altera trust, afinidade, Dissonância nem
buffs (seção 17). Ela usa o **pipeline central de fala** do Echo
(`echoSpeak → speechQueue`), respeitando a prioridade, o cooldown e a fila que
já existiam.

## 14. A matriz FACÇÃO × PERSONALIDADE (4 × 8)

`ECHO_FACTION_REACTIONS[faction][personality]` cobre as **4 facções × 8
personalidades = 32 células**, com **2 linhas por célula = 64 falas**. As
personalidades usam os IDs **reais** do jogo:

`aggressive · cautious · precise · impulsive · resilient · opportunist ·
versatile · fragmented`

Cada célula dá **voz própria** à combinação — por exemplo, o `fragmented` reage
aos Remanescentes com "Eles… lembram de mim. Mesmo eu não lembrando.", enquanto
o `opportunist` reage ao Consórcio com "Agora sim. Esses eu entendo.". Validação:
casos 34, 74–75.

## 15. Fallback garantido (`ECHO_FACTION_BASE`)

`ECHO_FACTION_BASE[faction]` fornece **3 linhas por facção** (12 no total) que
capturam a "voz da facção" independentemente da personalidade. É o **fallback**
quando não há célula específica (ou quando o Echo não tem personalidade
classificada). Isso garante que nenhuma combinação fique muda (casos 35, 40).

Total de falas: **64 (matriz) + 12 (base) = 76**, acima do mínimo de variedade
exigido (caso 36).

## 16. Seleção determinística com anti-repeat (sem RNG)

`echoFactionReactionPick(faction, pers, ctx)` escolhe a linha **sem usar
`Math.random` nem o RNG crítico do Fracture Director** (caso 39). O mecanismo:

- Uma memória local `_echoFacReactMem`, indexada por `pers|faction|ctx`, guarda
  um **contador** e a **última** escolha.
- O índice é `n % pool.length`, com **anti-repeat imediato** (se coincidir com a
  última, avança 1) — casos 37–38.
- A memória é **limitada** a `_ECHO_FAC_MEM_MAX = 64` entradas; `_echoFacReactTrim`
  descarta as mais antigas. Não cresce indefinidamente (caso 52).
- É **determinística**: dois motores independentes produzem a mesma sequência
  (casos 37, 54).

## 17. A fala é narrativa — nunca muda gameplay

Este é o contrato mais importante da seção de reações:

- A fala **não altera trust** (caso 43).
- A fala **não altera afinidade** (caso 44).
- A fala **não concede nem remove buff**, não toca o Stat Modifier Pipeline.
- A fala **não consome a seed** do Fracture Director (caso 72).

As consequências mecânicas da presença já foram aplicadas em
`factionPresenceInteract`; a reação apenas **comenta**. O trust pode, no futuro,
**modular a seleção** narrativa (escolher um tom), mas **nunca** ser alterado
pelo ato de falar.

## 18. Dissonância coerente

Um Echo **hostil** ou **em ruptura** não produz fala amistosa:

- `echoFactionReaction` filtra por `echoAllied(e)` verdadeiro e
  `echoInRupture(e)` falso antes de escolher quem fala (casos 45–46).
- Sem Echo elegível, a chamada é um **no-op silencioso** — nenhum erro, nenhuma
  fala fantasma (caso 47).

Isso preserva a filosofia da Dissonância definida em blocos anteriores: um Echo
dissonante **continua** dissonante; ele não é "consertado" por uma presença de
facção nem simula amizade.

## 19. Gatilhos e anti-spam

Dois gatilhos, ambos reusando o pipeline central de fala:

- **`spawn`** — em `fpEntityAnnounce`, quando a presença aparece na arena.
- **`interact`** — em `factionPresenceInteract`, quando o jogador a consome.

O Echo escolhido é **determinístico**: o de **menor slot** entre os vivos
aliados não-hostis e não-em-ruptura (caso 73). O **anti-spam** é o do próprio
`echoSpeak`/`speechQueue` (cooldown por prioridade, `SPEECH_PRI`), então não há
gatilho novo capaz de floodar a fila.

## 20. Separação OPERADOR × ECHO (não reabrir o FIX.1)

A fala do **operador** (o jogador) é `OPERATOR_WHISPER`/`operatorWhisperHTML`,
corrigida no B3-FIX.1 — o B4 **não toca** nesse caminho. A reação de facção é
sempre uma fala de **ECHO**, pelo pipeline de `echoSpeak`. Os dois canais
permanecem independentes.

## 21. Boot e ordem de carregamento

O bloco `fp3.js` é inserido **entre** o fim de `fp2.js` (B3) e o `BOOT`, para
que suas funções existam antes de qualquer chamada. Os hooks de `spawn` e
`interact` verificam `typeof echoFactionReaction === 'function'` antes de chamar,
tornando a integração **defensiva** (nunca quebra se o bloco não carregar).

## 22. Save / Continue determinístico

- `SM_VERSION` permanece **3**; `FRACTURE_STATE_VERSION` permanece **1**; sem
  migration nova (caso 48).
- O `pack`/`unpack` da presença sobrevive ao round-trip para as **quatro**
  facções (caso 49).
- Presença **consumida não duplica** recompensa em Continue (caso 50).
- A **memória de anti-repeat é cosmética** e **não é persistida** — não aparece
  no `pack` (caso 53). Não precisa persistir: é só variedade de fala.
- A posição da entidade é **determinística pela seed** (caso 51).

## 23. Sandbox isolado

A presença física e as reações funcionam no Sandbox (para playtest), mas nada
persiste — o Sandbox já recusa gravação de checkpoint, e os hooks de teardown do
laboratório chamam `factionPresenceEntityClear` (casos 55–56). O teste
byte-for-byte do Sandbox permanece intacto.

## 24. DEV helpers (read-only, inertes em release)

- Quatro botões **força-presença** (`fp:force:{anchor,remnants,consortium,deviants}`)
  materializam qualquer uma das quatro para inspeção.
- `DEV.echoFactionReaction(faction, pers)` chama `echoFactionReactionPreview` —
  **read-only**: devolve o texto sem falar, sem alterar trust/afinidade
  (casos 57–58). Tudo dentro de `DEV_MODE`; inerte fora dele.

## 25. Robustez / entradas inválidas

- `echoFactionReactionPick`/`Preview` com facção inválida devolvem string vazia
  sem lançar (caso 58).
- Contexto inválido é normalizado para `spawn` (caso 59).
- `factionPresenceInteract` com facção desconhecida na entidade não lança
  (caso 77).

## 26. Performance

- **Sem alocação massiva**: os pools são constantes; a memória de anti-repeat é
  capada em 64 entradas.
- **Sem O(n²)** por frame; o desenho é O(constante) por entidade (cap = 1).
- **Sem partículas ilimitadas**: os FX das novas presenças usam laços fixos e
  pequenos (3–4 elementos), com alfa modulado por `fade`.
- **Sem timers órfãos**: o trade-off dos Desviados expira sozinho no `smTick`.

## 27. Legibilidade em hordas

Todas as alfas dos FX novos são baixas e escalam com o `fade` (TTL restante),
de modo que nenhum efeito de presença **esconde** inimigos, projéteis, Echos ou
o player. Os desenhos ficam concentrados no raio da entidade; a footprint de
solo é a marca mais fraca (`alpha ~0.10`).

## 28. Nenhuma facção é "sempre-melhor"

Perfis de risco distintos:

| Facção | Efeito | Risco imediato | Quando brilha |
|--------|--------|:--------------:|---------------|
| ÂNCORA | +50 % do escudo do operador | 0 | quando o operador está exposto |
| CONSÓRCIO | +4 ⧗ resíduos | 0 | economia da run |
| REMANESCENTES | +35 % escudo dos Echos + 4 trust | 0 | quando os Echos estão desgastados |
| DESVIADOS | +20 % dano / +15 % dano recebido (12 s) | **sim** (temporário) | janela ofensiva agressiva |

O único efeito com custo é o dos Desviados, o que garante que ele não domine as
demais (caso 67). As outras três respondem a **estados diferentes** da run
(operador exposto, economia, Echos desgastados), então nenhuma é universalmente
superior.

## 29. Testes e verificação

`tests/pr14-b4-four-factions.test.js` — **78 casos**, integrado ao `npm test`
(que passou a listar **32 suítes**):

| Grupo | Casos | Cobre |
|-------|-------|-------|
| Arquitetura | 1–10 | 4 físicas, símbolos/cores únicos, cap=1, materialização |
| Âncora (regressão B3) | 11–15 | escudo, teto, sem HP, sem escudo, one-shot |
| Consórcio (regressão B3) | 16–19 | resíduos, não toca player/echos, one-shot |
| Remanescentes | 20–26 | escudo dos Echos, teto, sem HP/revive, +trust, hostil ignorado, múltiplos, clamp |
| Desviados | 27–33 | trade-off, +dano, +dano recebido, expira, sem stack, sem HP, one-shot |
| Reações dos Echos | 34–47 | matriz 4×8, fallback, determinismo, anti-repeat, sem RNG, narrativa, Dissonância |
| Save / determinismo | 48–54 | versões, round-trip, sem duplicar, posição, memória limitada, não persiste |
| Sandbox / DEV | 55–60 | isolado, preview read-only, robustez, contextos |
| Regressões / invariantes | 61–78 | Facção≠Tema, afinidade read-only, eventos, cap, pipeline, ao-menos-+1 |

Harness analítico: `audit_pr14/faction_presence_b4_audit.js` (EXIT 0) — valida
os marcadores estruturais, cobre a matriz 4×8 e imprime a tabela de balanço
early/mid/late para comparação das quatro.

## 30. O que este bloco **NÃO** faz (anti-escopo) e dívidas

Deliberadamente fora do B4:

- **B5** — rivalidades (ÂNCORA↔DESVIADOS / REMANESCENTES↔CONSÓRCIO), facções
  hostis/aliadas mudando comportamento físico, limiar/exclusividade, bloqueio de
  alianças. **Dívida: DT-B5.**
- **PR14.5** — rework da Loja Temporal / Módulos / Perfil. **Dívida: DT-PR14.5.**
- **PR15** — persistência de Echos entre runs.
- **PR16** — Difficulty / Boss Rework.

O B4 também **não** aumenta `PARTS_MAX`/`ENEMY_BUDGET`, não cria HUD/painel
persistente de facção, não abre facções como inimigos e não toca em
`fractureShapeWave`/seleção de Tema/composição/orçamento.

## 31. Filosofia narrativa das quatro (referência das falas)

- **ÂNCORA** — ordem e contenção. Os Echos a veem como alívio **e** prisão.
- **REMANESCENTES** — memória e vínculo. São os únicos que tratam o Echo como
  "alguém" — não o consertam nem o vendem.
- **CONSÓRCIO** — tudo tem preço, inclusive os Echos. Oportunidade vista com
  desconfiança.
- **DESVIADOS** — acham a fratura bonita. Poder fácil com custo escondido;
  transformação ou dissolução.

Nenhum lore novo foi inventado além do que o código/`FRACTION_BY_ID` já
sustentam; as falas apenas dão voz aos Echos diante do que já existe.

## 32. API pública nova (resumo)

| Símbolo | Papel |
|---------|-------|
| `FACTION_PRESENCE_REMNANTS_SHIELD/_TRUST` | balanço dos Remanescentes |
| `FACTION_PRESENCE_DEVIANTS_DUR/_DMG/_TAKEN` | balanço dos Desviados |
| `fpDrawRemnants` / `fpDrawDeviants` | desenho das duas novas presenças |
| `ECHO_FACTION_BASE` | fallback de fala por facção |
| `ECHO_FACTION_REACTIONS` | matriz 4×8 de falas |
| `ECHO_FACTION_CTX` | contextos suportados (`spawn`/`interact`) |
| `echoFactionReactionPick` | seleção determinística com anti-repeat |
| `echoFactionReactionPreview` | preview read-only (DEV/testes) |
| `echoFactionReaction` | dispara a reação de um Echo elegível |

## 33. Critério de conclusão

O B4 só é considerado **concluído** após um **PLAYTEST HUMANO** confirmar que:

1. As quatro presenças são **reconhecíveis** antes de ler o nome.
2. **Nenhuma** é sempre-melhor.
3. Os Echos **parecem perceber** as facções (reações fazem sentido).
4. As falas são **variadas** e não repetem em sequência.
5. A **Dissonância** permanece coerente (hostil não simula amizade).

Até o playtest, o código está completo, testado (78 casos) e auditado, mas o
bloco fica **aberto** para ajustes de sensação.

## 34. Resumo de commits

- `feat(pr14): presença física dos Remanescentes (memorial ressonante)`
- `feat(pr14): presença física dos Desviados (fenda adaptativa, trade-off)`
- `feat(echo): reações contextuais dos Echos às 4 facções (fp3.js)`
- `test(pr14): suíte B4 das quatro facções + reações (78 casos)`
- `docs(pr14): documentação do bloco B4`

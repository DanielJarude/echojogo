# ECHO_RELATIONSHIP.md — Relação Player ↔ Echo + Dissonância 2.0 (PR 10)

## 1. Filosofia

Antes do PR 10 o jogo já tinha as peças certas, mas soltas: personalidade
(PR 8, *como* o jogador jogava), moralidade (PR 9, *que decisões* tomava),
confiança (`trust`), diálogos e uma Dissonância que era basicamente um dado
rolado. O PR 10 **não adiciona sistemas novos** — ele liga os que já existiam
em uma cadeia única:

```
AÇÃO → CONTEXTO → PERSONALIDADE/MEMÓRIA → APROVAÇÃO/REJEIÇÃO
     → RELAÇÃO → CONFIANÇA → DIÁLOGO → (possível) DISSONÂNCIA
```

O objetivo é que o jogador sinta que **o Echo tem opinião** sobre o que ele
faz, que essa opinião **é dele** (deriva da run que o gerou, não de uma
tabela global) e que a Dissonância é a **consequência legível** de um
histórico — nunca uma punição aleatória.

## 2. Três conceitos distintos (nunca misturar)

| Conceito | O que é | Onde vive | Escala |
|---|---|---|---|
| **REAÇÃO** | julgamento imediato de UMA ação | `evaluateEchoReaction()` (puro) | −2 … +2 |
| **CONFIANÇA** | acúmulo lento das reações | `echo.trust` | 0 … 100 |
| **RELAÇÃO** | interpretação persistente do vínculo | `echo.rel` + `echoRelState()` | 5 estados derivados |

Não existe barra nova: **nada de affection / loyalty / bond / respect**.
A relação é **derivada** de confiança + memória curta + pressão, calculada sob
demanda. Isso mantém uma única fonte de verdade e evita estados
contraditórios entre HUD, save e lógica.

## 3. Reação — `evaluateEchoReaction(echo, ctx)`

Camada central e **pura**: não escreve nada, não sorteia nada. Devolve

```js
{ value, type, reason, intensity, align }
// value:     inteiro −2..+2
// type:      'approve' | 'reject' | 'neutral'
// reason:    'moral_violence', 'resonance', 'protection', ...
// intensity: 0..1  (força emocional — controla fala, feedback e memória)
```

Contextos aceitos (`ctx.kind`): `moral`, `resonance`, `micro`, `protection`,
`disruption`, `dissonance`, `reconciliation`.

### 3.1 O gatilho principal é a MEMÓRIA MORAL DE ORIGEM

Cada Echo guarda `moralSrc = {comp, greed, viol}` — o snapshot moral da run
que o gerou. A reação moral é o **produto escalar normalizado** entre o vetor
da ação atual e esse snapshot: alinhou, aprova; divergiu, rejeita. Rejeição
pesa o dobro da aprovação (`raw = t >= 0 ? t : t*2`), porque discordar marca
mais que concordar.

Consequência exigida pela spec e coberta por teste: **dois Echos julgam a
mesma ação de formas opostas**. Um Echo nascido de uma run violenta *reconhece*
uma escolha violenta; um Echo nascido de uma run compassiva a rejeita.

Echo com origem fraca (`total < 3`, ex.: run curta/fragmentada) tem a reação
multiplicada por `0.35` e, na prática, não emite veredicto forte — ele não
tem referência para julgar. Isso é intencional: silêncio é melhor que
opinião inventada.

### 3.2 Personalidade e traços apenas MODULAM

`PERS_REL_MOD` e `TRAIT_REL_MOD` são **multiplicadores por eixo** — nunca
somas, nunca inversões:

- `aggressive` tolera Violência, estranha Compaixão passiva;
- `cautious` reage forte a Violência;
- `opportunist` tolera Ganância;
- `fragmented` reage a tudo com intensidade reduzida (identidade instável);
- `resilient` absorve pequenos desvios;
- traços como `butcher` / `hoarder` / `pacifist` dão o último tempero.

Regra invariante (testada em todas as personalidades): **a personalidade nunca
inverte o sinal do snapshot moral.** Um Echo compassivo agressivo continua
rejeitando violência — só rejeita com menos ênfase. Personalidade é *forma*,
moralidade é *conteúdo*. As camadas do PR 8 e do PR 9 seguem separadas.

## 4. Confiança — `changeEchoTrust(echo, delta, reason)`

Todas as mutações de confiança passam por **um único ponto**. O padrão legado
`e.trust = clamp(e.trust ± n, 0, 100)` espalhado pelo arquivo foi eliminado
(há teste estrutural garantindo isso).

- clamp por chamada: `REL_BALANCE.trustClamp = 36` — nenhum evento isolado
  vira uma virada de relação;
- clamp global 0..100 preservado;
- toda mutação registra `{d, r, at}` em `echo.rel.lastTrust` (visível no DEV);
- `setEchoTrust(e, v, reason)` existe para *resets duros* legítimos
  (piso da Dissonância, restauração de checkpoint, presets DEV).

### 4.1 Auditoria das mutações herdadas

| Origem | Antes | Depois |
|---|---|---|
| Ressonância plena | `+18` direto | reação `resonance` → **+3** na primeira, decrescente depois |
| Micro-ressonância | ad-hoc | reação `micro` → `+0.6 × dim`, cooldown 13s |
| Dissonância moral | `−26` direto | pressão acumulada; ruptura só no limiar |
| Evento 7 (sinal) | escrita direta | `changeEchoTrust('event_signal_*')` + pressão |
| Evento 17 (criança) | escrita direta | `changeEchoTrust('event_child_*')` + pressão |
| Guardião protegeu | não existia | reação `protection`, `trustMul .35`, cooldown 20s |
| Disruptor salvou | não existia | reação `disruption`, cooldown 20s |
| Piso pós-Dissonância | `trust = 34` | `setEchoTrust(..., 'dissonance_floor')` — **valor 34 preservado** |

O **piso histórico 34** não foi alterado: continua sendo o ponto de onde a
relação é reconstruída depois de uma ruptura, e há teste explícito para ele.

### 4.2 Anti-farm

Dois mecanismos combinados:

1. **Diminishing returns por motivo** (`relDimFactor`): cada repetição do mesmo
   `reason` multiplica o peso por `dimStep = .55`, até o piso `dimFloor = .20`;
   o peso se recupera sozinho em `dimDecay = 34s`.
2. **Cooldown por motivo** (`reasonCd`): `resonance 5s`, `micro_resonance 13s`,
   `protection 20s`, `disruption 20s`, mais um cooldown global curto de
   `reactCd = .35s` por Echo, que impede rajadas no mesmo frame.

Resultado testado: repetir a mesma escolha aprovada 40× **não** enche a barra
de confiança; o 40º ganho vale menos de 60% do primeiro.

## 5. Estado da relação — derivado

`echoRelScore(e) = trust + clamp(ap − rj, −25, 25) − pressão × 0.30`

| Estado | Faixa | Leitura |
|---|---|---|
| **FRATURADA** | < 25 | o Echo mal reconhece você |
| **TENSA** | 25–44 | discorda e demonstra |
| **LATENTE** | 45–64 | neutro, observando |
| **SINCRONIZADA** | 65–84 | reconhece suas escolhas |
| **RESSONANTE** | ≥ 85 | opera como extensão sua |

Terminologia deliberadamente técnica/afetiva — **nada de AMIGO/INIMIGO**, que
achataria o tom do jogo e sugeriria facções (escopo de PR futuro).

**Nenhum estado dá stat.** Convergência não é buff tree: o retorno é
narrativo (falas, visual, estabilidade). O que a relação *afeta*
mecanicamente já existia antes (papéis Guardião/Disruptor dependem de
`trustTier`, que continua intacto) e a pressão de ruptura.

## 6. Memória — pequena de propósito

`echo.rel` guarda:

- `ap` / `rj` — acumuladores de aprovação e rejeição, teto `memCap = 26`,
  com decaimento de `.06/s` (o Echo esquece devagar);
- `streak` — sequência assinada de concordâncias/discordâncias;
- `mm` — **no máximo 4 momentos marcantes** (`{k, v, w}`: motivo, valor, onda).

Um momento só é gravado quando a reação é forte (`|v| >= 2`) e não está
saturada pelo anti-farm (`dim >= .5`). `relMomentText()` traduz para
linguagem humana ("Você matou o que eu teria poupado. Onda 3") — a UI **nunca**
mostra número, fórmula ou pressão crua.

## 7. Diálogos — hierarquia com fallback

`pickRelationLine(echo, ctx)` percorre, em ordem:

1. `context_state` — pool específico do motivo **e** do estado da relação;
2. `context` — pool do motivo;
3. `personality` — voz da personalidade (`PERS_REL_LINES`, todas as 6 têm
   aprovação e rejeição);
4. `reaction` — pool genérico por tipo;
5. `echo_lines` — o `ECHO_LINES` histórico.

Testado exaustivamente: **nenhuma combinação personalidade × tipo × estado
fica sem fala**. Não foram escritas milhares de linhas — a arquitetura é
escalável e o conteúdo, enxuto e bom.

O anti-spam anterior foi preservado: o cooldown global de fala (`_echoSpeakCd`)
continua valendo, e quando os dois Echos reagem à mesma ação **só o de reação
mais intensa fala**. O outro dá feedback visual silencioso.

## 8. Feedback discreto

`relFeedback()` mostra um sinal curto e não intrusivo (cor + micro-texto perto
do Echo), com cooldown próprio (`feedbackCd = .9s`). O jogador percebe que
"aquilo foi notado" sem que a tela vire um mural de notificações.

## 9. UI

- **Pausa** (`#p-rel`): um cartão por Echo com personalidade, estado da
  relação, confiança, aviso de instabilidade e a última memória marcante.
- **HUD** (`setChip`): o chip do Echo reflete o estado da Dissonância e o
  rótulo da relação.
- **Mundo**: rótulo do Echo aliado mostra `⚠ INSTÁVEL nn%` quando a pressão
  passa do limiar de aviso; em ruptura, mostra o medidor `RUPTURA %`.
- **Codex**: seção curta *MEMÓRIA E RELAÇÃO* explicando o conceito, sem
  expor fórmula.

## 10. Dissonância 2.0

### 10.1 Pressão, não sorte

`echo.dis.p` é a **pressão de ruptura**, alimentada por eventos concretos:

| Fonte | Efeito |
|---|---|
| rejeição intensidade 1 / 2 | `+9` / `+18` |
| aprovação intensidade 1 / 2 | `−6` / `−11` |
| ressonância | `−4` |
| confiança < 34 | `+0.8/s` enquanto durar |
| relação saudável | decaimento `−0.35/s` (`−0.12/s` logo após atividade) |
| eventos 7 e 17 (escolha contra o Echo) | `+44` / `+50` |

Limiar de fratura: `100 + min(40, rupturas × 20)` — **cada Dissonância torna a
próxima mais difícil** (anti-loop). Uma escolha isolada, por pior que seja,
nunca fratura nada: há teste garantindo isso.

### 10.2 Máquina de estados explícita

```
stable ──p≥55──► unstable ──p≥limiar──► fracturing ──1.2s──► hostile
   ▲                │                                            │
   │            p≤44│                                     contenção / 12s
   │                ▼                                            ▼
   └────── stable ◄── cooldown ◄──── 1.4s ──── recovering ◄───────┘
              (graça 26s)
```

`echo.dis.st` é a **única fonte de verdade**. `echo.hostile` e `echo.hostileT`
continuam existindo, mas viraram **acessores derivados** (getter/setter sobre
`dis.st` / `dis.t`), preservando 100% do contrato legado dos testes e do código
antigo sem criar estado duplicado. Todo efeito colateral de transição mora em
`echoSetDis()` — um lugar só.

`echoAllied(e)` é o gate único de "ainda é seu aliado" (`stable`, `unstable`,
`cooldown`) e `echoInRupture(e)` o oposto (`fracturing`, `hostile`,
`recovering`). Colisões, escudo, papéis, mira e render consultam esses dois.

### 10.3 Telegrafia

- **INSTÁVEL** (`p ≥ 55`): assinatura visual oscila, rótulo mostra a %,
  fala de aviso. Reversível — se o jogador mudar o comportamento, volta.
- **FRATURANDO** (`1.2s`, dentro da faixa 0.5–1.5s pedida): distorção forte,
  Guardião/Disruptor **já suspensos**, e **nenhum dano é causado**. É a janela
  de "isso vai acontecer".
- **DISSONANTE**: hostilidade real.

O visual é 100% derivado (`DIS_LABEL`, `DIS_COLOR` por estado) — não existe
flag visual paralela.

### 10.4 IA hostil

O Echo hostil **lembra como você jogava**: `HOSTILE_PROFILE[personality]`
define distância desejada, velocidade e cadência (agressivo pressiona de
perto; cauteloso mantém distância e atira). Ele mira **somente o jogador** —
não busca inimigos, não é atingido por inimigos, não fere outros Echos. O dano
usa `dmgMul = .9`, o mesmo do comportamento legado, e respeita Shield → HP
como qualquer dano legítimo.

Guardião e Disruptor ficam suspensos durante toda a ruptura (`roleT = 0`,
`shieldPot = 0`) e não podem reativar.

### 10.5 Contenção — o jogador tem agência

Bater no Echo hostil chama `containEcho()`, que consome **integridade de
ruptura**, nunca HP:

- `containPerHit = 14` por acerto (teto — um burst gigante não resolve tudo);
- dreno passivo `1.6/s`;
- **sobreviver limpo** (`3s` sem tomar dano) acelera a contenção em `2.0/s`:
  esquivar também é conter;
- quando a integridade zera, a Dissonância termina **antes** dos 12s.

O que a contenção **não** faz (testado item a item): XP, créditos, abate,
loot, lifesteal, progressão, moralidade, dano ao HP do Echo. O Echo **jamais
morre** por contenção — não existe morte permanente nova neste PR.

Quem não quiser lutar ainda pode esperar os 12s: a rota antiga continua
válida, só deixou de ser a única.

### 10.6 Recuperação e anti-loop

`recovering` (1.4s, transição visível, sem dano) → `cooldown` com **26s de
graça** em que nova ruptura é impossível, mesmo com pressão absurda →
`stable`. Ao recuperar, o Echo registra o momento `reconciliation`, a
confiança volta ao piso 34 e a relação **lembra**: a memória da Dissonância
fica em `rel.mm`, e a próxima fratura exige mais pressão.

## 11. Persistência

`relPackEcho()` / `disPackEcho()` gravam no checkpoint do slot, junto do
`trust` (mesmo ciclo de vida que ele já tinha):

- `rel`: `{ap, rj, sk, l, mm}` — memória compacta e limitada;
- `dis`: `{p, c, g, st, rp}` — pressão, contagem de rupturas, graça, estado e
  o marcador "estava em ruptura".

`relUnpackEcho()` restaura com clamp em tudo (payload adulterado não quebra
nada) e aplica duas regras de segurança:

- **sem exploit de reload**: a pressão volta junto — fechar o jogo não zera
  a tensão acumulada;
- **retorno seguro**: um Echo salvo em `fracturing/hostile/recovering` volta em
  `cooldown` com pelo menos 8s de graça e pressão abaixo do limiar. Nunca se
  retoma no meio da animação, nunca se rebela no primeiro tick do resume.

**Echo legado** (save anterior ao PR 10, sem payload): entra com memória vazia
e pressão derivada apenas da confiança atual (`trust < 34` → tensão inicial
coerente). Personalidade, traços, snapshot moral, confiança e `runData`
seguem **intactos**. Isolamento por slot é herdado do save system: a relação
mora dentro do checkpoint do slot, sem chave global.

## 12. Performance

- `relTick()` usa acumulador de `0.5s` — o estado da relação **não** é
  derivado por frame; `updateEcho` não chama `echoRelState()`.
- `echoDissonanceTick()` é O(1): sem loops, sem `filter`/`map`.
- As reações são disparadas **por evento** (escolha moral, ressonância,
  proteção), nunca por polling.

## 13. Limites deste PR (escopo consciente)

Não implementado aqui, por decisão explícita: finais reativos (PR 10.5),
expansão do Shield, facções, Diretor de Fratura, diálogo Echo↔Echo, bosses
adaptativos, novos operadores/armas/inimigos/módulos, persistência da relação
**entre runs** (hoje ela vive na run e no checkpoint do slot — cross-run é
escopo do PR 14).

## 14. Referências cruzadas

`ECHO_PERSONALITY.md` (PR 8) · `MORALITY_SYSTEM.md` (PR 9) ·
`SAVE_SYSTEM.md` · `DEV_MODE.md` §4.2 · `tests/relationship.test.js` (86 casos).

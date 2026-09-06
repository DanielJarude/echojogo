# PR14 — PRESENÇA DE FACÇÃO · B1 — AUDITORIA DE PRESENÇA ATUAL E PONTOS DE INTEGRAÇÃO

> **Natureza deste documento:** auditoria **somente-leitura**. Nada de gameplay,
> UI, balanceamento, afinidade, economia, Fracture Director, Save ou Sandbox foi
> alterado. Os únicos artefatos criados no B1 são este `.md` e o script read-only
> `audit_pr14/faction_presence_audit.js`.
>
> **Princípio norteador do PR14 (registrado aqui como contrato):**
> **FACÇÃO ≠ FRACTURE THEME.** Os Temas descrevem o *estado da Fratura*
> (COLAPSO, CERCO, CAÇADA, ANOMALIA, RESSONÂNCIA, ESCASSEZ). As facções são
> *forças organizadas dentro dessa realidade*. Qualquer presença futura deve
> preservar a **ortogonalidade**: uma mesma facção pode surgir sob temas
> diferentes; um mesmo tema pode coexistir com facções diferentes. **Nenhum
> mapeamento 1:1** facção↔tema.

---

## 1. BASELINE

| Item | Valor |
|---|---|
| Branch | `arena/01a074d8-echojogo` |
| HEAD | `421ea93969a7d01af6af8156278e2e7e665d2871` (snapshot grafted / depth 1) |
| `package.json` version | `0.8.0-alpha` |
| `index.html` | 28.400 linhas (arquivo-fonte monolítico do jogo) |
| SM_VERSION | **3** (não deve mudar no PR14) |
| FRACTURE_STATE_VERSION | 1 |

### 1.1 ⚠️ Baseline de testes: FALHA CONHECIDA (dívida herdada do snapshot)

`npm test` → **80 passaram · 2 falharam** (mais 2 falhas latentes não alcançadas
pelo encadeamento `&&`). **Causa:** o commit "Release 0.8.0-alpha" fez o bump de
`package.json` para `0.8.0-alpha`, mas **não** atualizou:

- `index.html` → `const ECHO_VERSION='0.7.0-alpha';` (linha ~1635);
- as asserções de versão em `tests/devmode.test.js` (2), `tests/fracture-director.test.js` (B5-11) e `tests/pr13-5-b6-balance.test.js` (B6-I2), que ainda fixam `0.7.0-alpha`.

Testes que falham por esse motivo:

1. `devmode` · *ECHO_VERSION coincide com o version do package.json*
2. `devmode` · *Versão é 0.7.0-alpha (playtest público)*
3. `fracture-director` · *B5-11: versão do jogo … intactas* (latente)
4. `pr13-5-b6-balance` · *B6-I2: version do jogo sem bump* (latente)

**Isto é uma inconsistência interna do snapshot, não do B1.** O B1 é
read-only e **não** corrige produção/testes (fora do escopo). Registrado como
**Dívida Técnica DT-1** (§19). A auditoria não depende da suíte passar.

---

## 2. ARQUITETURA ATUAL (visão geral)

O jogo é um survivor-arena em canvas 2D, single-file (`index.html` + `main.js`
Electron + `preload.js`). Estado de facção vive em **três camadas explícitas**:

| Camada | Objeto | Escopo | Persistência |
|---|---|---|---|
| **Run mecânico** | `fracRun` | run | `cp.frac` (checkpoint); resetado na morte/vitória |
| **Diretor da Fratura** | `fractureRun` | run | `cp.fracture`; resetado no fim |
| **Descoberta narrativa** | `fracDisc` (`slots[n].fracd`) | Save Slot | preservado entre runs do mesmo slot |

Fluxo central: decisões do jogador → **`factionEmit(evento, payload)`** →
`FACTION_GRID`/`payload.fac` → `fracApplyDelta` (clamp ±4/evento, afinidade
−100..+100) → observação (primeiro contato) + histórico compacto + feedback
diegético (toast/banner com cooldown) + alerta de faixa (ALIADA/HOSTIL 1×/run).

**54 call sites** de `factionEmit` já existem no código.

---

## 3. MAPA DAS QUATRO FACÇÕES (B1-A)

Símbolos, cores e identidade extraídos de `FRACTIONS[]` (linhas ~22044+).

| | ⬡ A ÂNCORA | ◉ OS REMANESCENTES | ◈ O CONSÓRCIO | ◬ OS DESVIADOS |
|---|---|---|---|---|
| **id interno** | `anchor` | `remnants` | `consortium` | `deviants` |
| **cor** | `#8fd6ff` | `#7dffc4` | `#ffd166` | `#ff4df0` |
| **ideologia** | PRESERVAR A LINHA TEMPORAL | UMA MEMÓRIA QUE SOBREVIVEU MERECE CONTINUAR | FRATURAS SÃO RECURSOS | O TEMPO NÃO PRECISA SER CONSERTADO |
| **filosofia** | ordem/contenção; limites são misericórdia | vínculo; vida é insistência | capital; o preço é o preço | transformação; o erro é voltar |

### 3.1 Classificação por dimensão (todas as 4 facções, salvo indicado)

| Dimensão | Status | Evidência |
|---|---|---|
| ID interno | **IMPLEMENTADO** | `FACTION_IDS=['anchor','remnants','consortium','deviants']` |
| Nome / símbolo / cor | **IMPLEMENTADO** | `FRACTIONS[].nm/sym/col` |
| Estilo visual próprio na arena | **NÃO EXISTE** | cor só aparece em banners/Codex/beacon default; sem sprite/estrutura própria |
| Descrição / lore / filosofia | **IMPLEMENTADO (narrativo)** | `short`, `pergunta`, `frase`, `metodos`, `lore[]` (4 tokens/facção) |
| Afinidade | **IMPLEMENTADO** | `fracRun.aff[id]` −100..+100, run-scoped |
| Thresholds / estados | **IMPLEMENTADO** | `FACTION_STATES` (7 faixas, §4) |
| Eventos associados | **IMPLEMENTADO** | 12 `FACTION_RUN_EVENTS` (3 por facção) + contato |
| Recompensas | **IMPLEMENTADO** | ⧗, equipamento, trust, refúgio, buffs de Echo via ofertas/eventos |
| Penalidades | **PARCIAL** | perda de trust, `conTax`, `tempPen`, pressão de Dissonância; **sem** hostilidade física |
| Modificadores | **IMPLEMENTADO (via Echo)** | `e.eqBoost.*` alterado por ofertas/eventos de facção |
| Shop / Echo Shop | **IMPLEMENTADO** | `FRAC_OFFERS` (8) + `FRAC_SERVICES` (2) na aba ECHO da Loja Temporal |
| Equipamentos | **IMPLEMENTADO** | `ECHO_EQUIP` por origem: anchor 9 / remnants 9 / consortium 10 / deviants 9 / neutral 6 |
| ⧗ Resíduos Temporais | **IMPLEMENTADO** | moeda da run; `addResidues`/`spendResidues`; ofertas custam/pagam ⧗ |
| Moralidade | **PARCIAL (consome, não funde)** | `compassion/greed/violence_choice` no grid mapeiam para deltas |
| Echos | **IMPLEMENTADO** | ofertas/eventos alteram trust, dissonância, eqBoost dos Echos |
| Relacionamento (Player↔Echo) | **PARCIAL** | facção **influencia** vínculo (`changeEchoTrust`), mas Echos não reagem à *presença* |
| Dissonance | **IMPLEMENTADO (sistêmico)** | `dissonance_triggered/resolved/encouraged` no grid; ofertas mexem em `e.dis.p` |
| Finais | **NÃO EXISTE (ligação direta)** | nenhum ending consulta afinidade de facção (afinidade é run-scoped e zera) |
| Codex | **IMPLEMENTADO** | aba FACÇÕES; lore progressiva; desconhecidas em cifra |
| Presença em HUD | **SÓ UI (efêmera)** | toasts/banners "TRANSMISSÃO // <facção>"; **sem** widget permanente de estado |
| Presença dentro da arena | **PARCIAL / INDIRETA** | eventos de facção nascem como **beacon** físico e usam `beacon.x/y`; mas não há entidade *própria* de facção (unidade/estrutura/emissário) |

> **Achado central:** a facção **já toca a arena fisicamente hoje** — via o
> **beacon de evento** — porém de forma genérica (mesmo beacon dos eventos
> comuns, colorido pela cor do evento). Não existe uma *entidade de facção*
> distinta, persistente ou identificável como "presença daquela facção".

---

## 4. AFINIDADE (B1-B)

### 4.1 Estados (`FACTION_STATES`, ordem por `min` decrescente)

| Estado | `min` | cor |
|---|---|---|
| ALIADA | 85 | `#7dffc4` |
| FAVORÁVEL | 58 | `#b8ffdd` |
| INTERESSADA | 30 | `#d6f9ff` |
| OBSERVANDO | 8 | `#cfe9f5` |
| NEUTRA | −25 | `#9db8c8` |
| DESCONFIADA | −60 | `#ffb48a` |
| HOSTIL | −999 | `#ff5c7a` |

- **Estrutura de dados:** `fracRun.aff={anchor,remnants,consortium,deviants}` (inteiros).
- **Faixa numérica:** clamp **−100..+100**; delta por evento clampado a **±4** (±5 com `boost`).
- **Onde AUMENTA/DIMINUI:** exclusivamente por `factionEmit` (grid `FACTION_GRID` + `payload.fac`), disparado por eventos de decisão, ofertas, contratos, mortes de boss/miniboss, escolhas morais, relíquias, dissonância.
- **Observação/primeiro contato:** `|delta|≥2` soma `fracRun.obs`; ao atingir `FRAC_CONTACT_OBS=3` → `fracContact` identifica a facção (grava em `fracDisc`).
- **Histórico:** `fracRun.hist` compacto, cap `FACTION_HIST_MAX=40`.
- **Persistência:** afinidade vai em `cp.frac` (Continue fiel dentro da run); **zera** no fim da run. Descoberta (`fracd`) persiste por slot.
- **Interação com slot / Save-Continue:** `fracRunPack`/`fracRunUnpack` (input não confiável, cai em `fracFresh` em save antigo); `fracDiscLoad`/`fracDiscSave` por `curSlot`.
- **Shop / recompensas:** `fracOffersOpen()` filtra por `needAff` (ex.: `dev_transmuta` exige aff≥20).
- **Endings:** **não** consultam afinidade (run-scoped, some).

### 4.2 Respostas obrigatórias

1. **Meta-persistente ou run-scoped?** → **Run-scoped.** Afinidade zera a cada run; só a *descoberta narrativa* (Codex) é per-slot.
2. **Pode mudar várias vezes na mesma run?** → **Sim.** Cada `factionEmit` aplica delta imediato; sem cooldown de valor (apenas o *feedback visual* tem cooldown).
3. **Existem caps?** → **Sim.** Afinidade clamp −100..+100; delta ±4/evento (±5 com boost); histórico cap 40; ⧗ cap `RES_MAX=9999`.
4. **Fontes duplicáveis/exploitáveis?** → **Baixo risco.** Ofertas são `oncePerRun` (`fracRun.o[fid].n`), eventos `oncePerRun`, estoque com `stockWave` anti-reopen, Dissonância contida com cap por onda (`dRes`). Não há loop óbvio de farm de afinidade — mas há acoplamentos a auditar em profundidade no B2 (ex.: escolhas morais repetíveis via eventos comuns).
5. **Quem consulta o ESTADO TEXTUAL (`st.lab`/`st.col`)?** → Codex (aba FACÇÕES), banners de faixa (`fracBandAlert`), feedback diegético (`fracFeedback` usa `contPos/contNeg`), painel DEV/Sandbox.
6. **Quem usa o VALOR NUMÉRICO diretamente?** → `fracOffersOpen` (`needAff`), `fracApplyDelta`/`clamp`, `fracStateOf` (derivação de faixa), histórico, DEV inspector. A UI de jogo **nunca** mostra o número cru (política de design).

---

## 5. PRESENÇA ATUAL NA RUN (B1-C)

**Pergunta central:** *o que hoje faz o jogador perceber uma facção durante uma run?*

| FACÇÃO | FORMA DE PRESENÇA | ONDE APARECE | FREQUÊNCIA | VISUAL? | MECÂNICA? | INTERATIVA? | PERSISTE? | OBSERVAÇÃO |
|---|---|---|---|---|---|---|---|---|
| Todas | **Banner/Toast "TRANSMISSÃO // <facção>"** | topo da tela (HUD efêmero) | por evento/faixa | Sim (texto) | Não | Não | Não | anti-spam (cooldown 2.6s; faixa 1×/run) |
| Todas | **Beacon de evento de facção** (fa_*) | arena (world-space) | ~1–3 beacons/onda no pool geral | Sim (círculo pulsante colorido) | Sim (ao tocar abre modal) | **Sim (proximidade)** | Não (some ao interagir/expirar) | **usa `beacon.x/y`; é a presença física mais próxima que existe** |
| Todas | **Aliado libertado** (`allies[]`) | arena | só via alguns eventos | Sim | Sim (atira/cura) | Não (autônomo) | Enquanto vivo | não é *marcado* como "de facção"; é genérico |
| Todas | **Ofertas na Loja Temporal** (aba ECHO) | modal de loja entre ondas | quando `needAff`/onda satisfeitos | Sim (texto/cor) | Sim | Sim (comprar) | efeito persiste na run | `oncePerRun` |
| Todas | **Equipamento de Echo por origem** | loja/eventos/inventário | quando obtido | Sim (cor) | Sim (stats) | Sim | run (cp.frac) | 37 itens (9/9/10/9) |
| Todas | **Codex (aba FACÇÕES)** | menu (fora da run) | a pedido | Sim | Não | Sim (leitura) | Sim (por slot) | lore progressiva |
| Todas | **⧗ ganho/gasto por ato de facção** | float text na arena | por evento | Sim | Sim | — | run | `fracResFX` usa `beacon.x/y` |
| Âncora/Remanescentes | **Núcleo/refúgio instalado** | efeito no Echo | via evento/oferta | Parcial | Sim | — | run | ex.: `anc_cont_core`, `fracRun.refugio` |

**Presenças que NÃO existem hoje** (procuradas explicitamente e ausentes):
estrutura física própria da facção, terminal/portal/cache identificável como
"da facção", unidade **hostil** de facção, emissário/holograma/drone de facção,
área de influência, objetivo opcional, intervenção em miniboss/boss atribuída a
uma facção, intervenção no Echo *provocada por presença* na arena, intervenção
direta no Fracture Director (o hook `faction_reaction` existe mas **não tem
emissor**).

---

## 6. EVENTOS DE FACÇÃO (B1-D)

12 `FACTION_RUN_EVENTS` (3 por facção) + `FRAC_CONTACT_EVENTS` (4) + ofertas.
Registro via `fracRegEvents()` → `evRegister` → entram no **mesmo pool de
beacons** dos eventos comuns (`ALL_RUN_EVENTS`), com `family:'fracao'`.

| ID | Facção | minWave | rarity/weight | oncePerRun | Estrutura |
|---|---|---|---|---|---|
| `fa_anc_camara` | anchor | 4 | uncommon/9 | sim | libertar registro vs. selar (núcleo) |
| `fa_anc_relogio` | anchor | — | — | — | contenção/tempo |
| `fa_anc_fila` | anchor | — | — | — | ordem/descarte |
| `fa_rem_enjeitado` | remnants | — | — | — | acolher Echo |
| `fa_rem_coro` | remnants | — | — | — | vínculo coletivo |
| `fa_rem_refugio` | remnants | — | — | — | **refúgio sob ataque** (já conota combate) |
| `fa_con_leilao` | consortium | — | — | — | leilão de memória |
| `fa_con_bombardeio` | consortium | — | — | — | **contrato de bombardeio** (já conota ação ofensiva) |
| `fa_con_arquivo` | consortium | — | — | — | arquivo-ativo |
| `fa_dev_espelho` | deviants | — | — | — | espelho quente |
| `fa_dev_pergunta` | deviants | — | — | — | preço da resposta |
| `fa_dev_marcha` | deviants | — | — | — | **marcha dos impossíveis** (já conota spawn/horda) |

**Cada escolha:** contexto + consequência real + `factionEmit` + custo (⧗/trust/
Dissonância/tempPen). **Nunca "+reputação"** — sempre troca algo (política §6 doc).

Classificação para o futuro:
- **Já simulam presença** (encaixam em apresentação física quase direta):
  `fa_rem_refugio` (refúgio sob ataque), `fa_con_bombardeio` (ação ofensiva
  contratada), `fa_dev_marcha` (horda de impossíveis), `fa_anc_camara` (cápsula
  física no meio da onda).
- **Puramente textuais** (decisão moral/econômica sem âncora espacial):
  `fa_con_leilao`, `fa_dev_pergunta`, `fa_anc_fila`.
- **Convertíveis a presença física SEM mudar a lógica:** todos que já leem
  `beacon.x/y` — a lógica de efeito é independente da apresentação; bastaria uma
  *skin/entidade* de facção sobre o beacon existente.
- **Incompatíveis com presença física:** nenhum é incompatível; alguns
  (leilão/arquivo) fariam pouco sentido como *entidade de combate*, mas cabem
  como **terminal/emissário**.
- **Duplicações conceituais:** contrato/greed aparece tanto em `FRAC_OFFERS`
  (`con_avalia`) quanto em eventos (`fa_con_leilao`) — não é bug, mas o B2 deve
  evitar uma **terceira** camada que refaça o mesmo gesto.

---

## 7. ECHO SHOP E EQUIPAMENTOS (B1-E)

- **Loja Temporal** com abas `[ OPERADOR ]` e `[ ECHO ]`. A aba ECHO hospeda:
  `FRAC_OFFERS` (transmissões de facção, gating por `w`+`needAff`+`fracKnows`),
  `FRAC_SERVICES` (neutros, custam só ⧗) e o **estoque de equipamento**
  (`fracRun.es.stock`, rolado 1×/onda — `stockWave` anti-reopen; reroll com custo
  crescente `REROLL_BASE=3 ×1.6 cap 30`).
- **Dono/identidade de facção da loja:** **NÃO EXISTE.** A loja é neutra
  (tecnologia sem dono, símbolo ◇). Facções só *emitem ofertas* dentro dela.
- **Estoque específico por facção:** **PARCIAL** — equipamento tem `origin`
  (anchor/remnants/consortium/deviants/neutral, 37 itens), mas o *estoque
  rolado* não é filtrado por relação/facção hoje.
- **Alteração visual por facção:** **SÓ COR** (cada oferta/equip usa a cor da
  facção). Sem layout/tema de loja por facção.
- **Modificação por relação:** **SIM (gating)** — `needAff` habilita/oculta
  ofertas; **não** há desconto/estoque dinâmico por faixa.
- **Ofertas temporárias:** **SIM** — `oncePerRun` (`fracRun.o[fid].n`).
- **Acionável pela arena:** **NÃO** — loja abre só na transição de onda
  (`openShop`); não há "chamar a facção" a partir da arena.
- **⧗ / preço / unlock / moralidade:** ofertas custam ⧗ (às vezes +◈); serviços
  só ⧗; moralidade não gate preços (consome só via grid).

**Não redesenhar a loja no PR14** (fora de escopo declarado).

---

## 8. FRACTURE DIRECTOR (B1-F)

`fractureRun` (v1) — Tema é **função pura da seed** (reload/Continue/loja/menu
nunca trocam Tema). 6 Temas (§tabela abaixo), Intensidade 0..100 → 5 Stages.

### 8.1 API e hooks existentes

| Hook / função | Papel | Emissor ligado hoje |
|---|---|---|
| `fractureBeginRun()` | cria `fractureRun`, emite `run_start` | `startRun` |
| `fractureOnWaveStart(n)` | fronteira de onda: `wave_complete`+`wave_start`, assinatura, revelação de Tema, Stage | loop por onda |
| `fractureOnShopOpen()` | emite `shop_open` | `openShop` |
| `fractureOnEventChosen(d)` | emite `event_triggered` | ao escolher evento |
| miniboss spawn/kill | emite `miniboss_spawn`/`miniboss_killed` | integrado |
| `fractureEndRun(reason)` | `run_end`, zera `fractureRun` | fim de run |
| `fractureEmit(type,payload)` | **barramento único**; só tipos do `FRACTURE_EVENT_GRID` | — |

### 8.2 `FRACTURE_EVENT_GRID` (12 tipos)

`run_start, wave_start, wave_complete, enemy_spawn, enemy_killed,
miniboss_spawn, miniboss_killed, event_triggered, echo_dissonance,
**faction_reaction**, shop_open, run_end`.

> **Achado de ouro:** `faction_reaction` **já existe** como tipo de evento do
> Diretor (`{i:0,hist:1,...}`) — **arquitetura pronta, sem emissor**. É o ponto
> de entrada natural e *já desenhado* para o Diretor **registrar** que uma
> facção reagiu, **sem** transformar facção em Tema (não altera `theme`, só
> registra histórico). O comentário do código confirma que RESSONÂNCIA pode
> fazer "facções REAGIREM, mas nunca controlam o tema".

### 8.3 Pontos de integração para presença (classificação de risco)

| Ponto de inserção | Gancho existente | Risco | Motivo |
|---|---|---|---|
| **Entre ondas / início de onda** | `fractureOnWaveStart` | **SEGURO** | já idempotente e checkpointado; lugar natural para *agendar* uma presença |
| **Antes da onda (pré-spawn)** | `fractureOnWaveStart` (out.start) | **SEGURO** | decisão determinística por (seed, wave); não toca composição |
| **Ao abrir loja** | `fractureOnShopOpen` | **SEGURO** | já emite `shop_open`; presença "de vitrine" é leve |
| **Após miniboss** | `miniboss_killed` (i:4) | **MÉDIO** | mexe em Intensidade; timing de spawn de presença precisa respeitar cleanup do miniboss (`hazards=[]`) |
| **Evento raro durante combate** | pool de beacons (`spawnBeacon`) | **MÉDIO** | reusar o beacon é seguro; *nova entidade autônoma* durante combate exige budget/cleanup |
| **Ponto de interesse / oferta na arena** | `beacon` + `allies` | **MÉDIO** | infra existe, mas exige lifecycle/Save próprios se persistir |
| **Reação registrada no Diretor** | `faction_reaction` (sem emissor) | **SEGURO** | só histórico; não altera Tema/composição |
| **Intervenção na composição de onda** | `fractureShapeWave` | **ALTO RISCO** | **violaria FACÇÃO≠TEMA**: mexer no shaping faria facção parecer Tema. **EVITAR.** |
| **Forçar/rerollar Tema por facção** | `fractureForceTheme` | **ALTO RISCO** | idem — quebra a ortogonalidade e o determinismo por seed |

**Conclusão B1-F:** os hooks de **agendamento/ciclo de vida da onda** e o tipo
`faction_reaction` dão espaço abundante e seguro para presença; o que **não**
pode ser tocado é o **shaping/seleção de Tema** (linha vermelha do PR14).

---

## 9. ARENA E ENTIDADES (B1-G)

Arrays globais (linhas ~1738, ~5071):
`player, echoes[], enemies[], projectiles[], xporbs[], parts[], ftexts[],
pickups[], allies[], beacon(objeto único), boss, miniBoss`.

| Categoria | Armazenamento | Update | Draw | Cleanup | Collision | Save | Sandbox | Cap | Lifecycle |
|---|---|---|---|---|---|---|---|---|---|
| enemies | `enemies[]` | por frame | drawEnemies | splice/`dead` | sim | não (reconstruído por onda) | gated | `ENEMY_BUDGET=46` | onda |
| projectiles | `projectiles[]` | por frame | sim | splice/life | sim (team) | não | ok | implícito | efêmero |
| parts (partículas) | `parts[]` | por frame | sim | `trimParts` | não | não | ok | `PARTS_MAX=900` | efêmero |
| pickups | `pickups[]` | `updatePickups` | `drawWorldExtras` | splice | proximidade | não | ok | — | até coletar |
| **allies** | `allies[]` | update dedicado | `drawWorldExtras` | splice (`life`/turret) | atira em inimigos | não | ok | — | fighter (autônomo) / turret (`life`) |
| **beacon** | objeto único `beacon` | inline no loop | `drawWorldExtras` (default + cases) | `null` ao interagir/expirar (`life=38`) | **proximidade** (`dist2<rr²`→`openEvent`) | não (reconstruído; `scheduleBeacon`) | **gated** (não nasce no sandbox) | 1 por vez | agendado por `evTimer` |
| boss/miniBoss | objeto único | dedicado | dedicado | `hazards=[]` no kill; `beacon=null` na vitória | sim | parcial | gated | 1 | fase |

**Qual estrutura é mais segura para presença física de facção?**

- **`beacon`** = melhor molde para **presença interativa pontual** (proximidade
  → modal). Já é world-space, tem draw default por cor de evento, cleanup por
  expiração, é gated no Sandbox e é **zerado** na vitória/cleanup. Limitação:
  **um por vez** e nasce do agendador de eventos.
- **`allies[]`** = melhor molde para **presença autônoma temporária** (unidade
  que se move/atira/cura), com lifecycle por `life`/`fighter`/`turret` e cleanup
  por splice. Limitação: não é *marcado* por facção nem persistido.
- **`enemies[]`** = molde para **presença hostil**, mas cair aqui arrisca
  transformar facção em "novo inimigo" (ver B1-J).

**Nenhuma estrutura nova foi criada.** (Anti-escopo respeitado.)

---

## 10. FORMAS FUTURAS DE PRESENÇA — AVALIAÇÃO ARQUITETURAL (B1-H)

Avaliação **conceitual** sobre a arquitetura encontrada. Nada será implementado
no B1. `Compat` = facções naturalmente compatíveis.

| POSSIBILIDADE | Compat | Sistemas necessários | Risco | Custo | Legib. | Interativ. | Perf. | Save | Sandbox | RECOMENDAÇÃO |
|---|---|---|---|---|---|---|---|---|---|---|
| Sinal/beacon temporário (skin de facção sobre `beacon`) | 4/4 | beacon + cor/sym | Baixo | Baixo | Alta | Alta | MUITO LEVE | reconstruir | gated ok | **ÓTIMA** |
| Emissário (unidade neutra parada + interação) | 4/4 | `allies`-like estático + prompt | Baixo | Médio | Alta | Alta | LEVE | estado mínimo | gated | **ÓTIMA** |
| Cache/suprimento (pickup temático de facção) | Consórcio/Remanescentes | `pickups` + tag | Baixo | Baixo | Média | Média | MUITO LEVE | reconstruir | gated | **BOA** |
| Terminal/transmissão (holograma narrativo) | 4/4 | beacon/overlay + banner | Baixo | Baixo | Alta | Média | MUITO LEVE | reconstruir | gated | **BOA** |
| Unidade aliada (reforço combatente) | Âncora/Remanescentes | `allies` fighter existente | Médio | Médio | Média | Baixa | LEVE | efêmero | gated | **BOA** (cuidado snowball, B1-K) |
| Estrutura defensiva (torre) | Âncora | `allies` turret existente | Médio | Médio | Média | Baixa | LEVE | efêmero | gated | **POSSÍVEL** |
| Drone/holograma | Consórcio/Desviados | novo mini-lifecycle sobre `allies` | Médio | Médio | Média | Média | LEVE | reconstruir | gated | **POSSÍVEL** |
| Anomalia controlada (hazard temático) | Desviados | reuso de `hazards` de boss/miniboss | Médio | Médio | Média | Baixa | MODERADO | reconstruir | gated | **POSSÍVEL** |
| Área de influência (zona de buff/debuff) | 4/4 | zona world-space + tick | Médio | Médio | Média | Baixa | MODERADO | reconstruir | gated | **POSSÍVEL** |
| Objetivo opcional / extração | Consórcio | beacon + timer + reward | Médio | Alto | Média | Alta | MODERADO | estado mínimo | gated | **POSSÍVEL** |
| Intervenção ofensiva (bombardeio contratado) | Consórcio/Desviados | efeito temporizado + telegrafia | Alto | Alto | Baixa | Baixa | MODERADO | reconstruir | gated | **RUIM** (legibilidade/fairness) |
| Unidade hostil de facção (facção "vira inimigo") | — | `enemies` + IA nova | Alto | Alto | Baixa | Baixa | CARO | — | risco | **EVITAR** (ver B1-J) |
| Presença que altera composição/Tema | — | `fractureShapeWave` | Crítico | — | — | — | — | — | — | **EVITAR** (quebra FACÇÃO≠TEMA) |

---

## 11. IDENTIDADE DE GAMEPLAY DAS 4 FACÇÕES (B1-I)

Marcações: **[SIS]** confirmado no sistema/código · **[DOC]** confirmado no
lore/documentação · **[INF]** inferência forte · **[NÃO]** não suportado.

### ⬡ A ÂNCORA
- Estabilização → **[SIS]** (`anomaly_stabilized`, `stabilization_choice`, oferta `anc_estabiliza`, evento `fa_anc_camara` selar).
- Defesa / contenção → **[SIS]** (equip `anc_cont_core`, `PROTOCOLO SENTINELA/INTERDIÇÃO`; oferta `anc_contracao` dá `shMul`).
- Ordem → **[DOC]** (ideologia/lore).
- Shield → **[SIS]** (ofertas mexem em `eqBoost.shMul`; PR13.5 tem sistema de shield).
- Controle → **[INF]** (contenção + disciplina; não há "controle" mecânico nomeado).
- Redução de Dissonance → **[SIS]** (`dissonance_resolved`; oferta `anc_estabiliza` reduz `e.dis.p`).

### ◉ OS REMANESCENTES
- Echos → **[SIS]** (todas as ofertas/eventos operam sobre `echoes`/trust).
- Confiança/vínculo → **[SIS]** (`changeEchoTrust`, `echo_trust_gain`, oferta `rem_recupera` +12 trust).
- Compassion → **[SIS]** (`compassion_choice` favorece remnants no grid).
- Sobrevivência → **[SIS]** (`rem_refugio` revive Echo com 1 HP; `fracRun.refugio`).
- Cooperação → **[DOC/INF]** (lore "refúgio"; aliado combatente existe genérico).

### ◈ O CONSÓRCIO
- Recursos/economia → **[SIS]** (`temporal_residue_offered`, `con_avalia` adianta ⧗, `conTax`).
- Contratos → **[SIS]** (`contract_accepted/refused/honored`; `fa_con_bombardeio`).
- Greed → **[SIS]** (`greed_choice` favorece consortium).
- Risco/recompensa → **[SIS]** (`con_exp`: +dano/cadência dos Echos, +Dissonância).
- ⧗ → **[SIS]** (custo/pagamento em Resíduos).

### ◬ OS DESVIADOS
- Mutação/transformação → **[SIS]** (`transformation_choice`, `dev_transmuta` reescreve Echo).
- Dissonance → **[SIS]** (`dissonance_encouraged/triggered`; `dev_fenda` +25 pressão).
- Anomalias → **[SIS]** (`anomaly_exploited`; equip de origem `deviants`).
- Evolução → **[DOC/INF]** (lore).
- Risco → **[SIS]** (trade-offs sempre com custo: −trust, +Dissonância).

**Nenhum lore novo foi inventado.** A identidade de gameplay já é fortemente
sustentada pelo `FACTION_GRID`, ofertas e equipamentos.

---

## 12. FACÇÃO HOSTIL ≠ INIMIGO COMUM (B1-J)

**O que HOSTIL significa hoje** (`aff < −60`):
- Dispara `fracBandAlert('hostil')`: **1 banner/toast por run** ("MARCOU VOCÊ COMO INSTÁVEL — ESTA RUN"). **Efeito puramente narrativo.**
- **Não** bloqueia loja, **não** altera rewards diretamente (só via `needAff` que oculta *ofertas positivas*), **não** aplica punição de combate, **não** gera inimigo.
- Ofertas com `needAff` alto ficam indisponíveis (consequência indireta).

**É tecnicamente possível uma facção HOSTIL ter presença ameaçadora sem virar
"novo inimigo"?** — **Sim.** Caminhos arquiteturais:

1. **Presença de pressão indireta** (recomendado): emissário/estrutura hostil
   *neutra-de-colisão* que impõe custo (ex.: zona de negação de ⧗, sinal que
   encarece loja) — reusa `beacon`/zona, **não** entra em `enemies[]`. Risco:
   Médio (legibilidade da ameaça).
2. **Modificador contextual do Diretor** via `faction_reaction` (histórico) +
   efeito telegrafado 1×/run — **sem** tocar composição. Risco: Médio.
3. **Reskin de hazard existente** (de boss/miniboss) como "intervenção" hostil
   curta e telegrafada. Risco: Médio-Alto (fairness).
4. **Unidade em `enemies[]`** — **EVITAR**: é exatamente "facção = novo inimigo",
   contraria o design e infla escopo/perf.

**Riscos gerais:** legibilidade (o jogador precisa entender *quem* e *por quê*),
fairness (nada instantâneo/sem telegrafia), Save (efêmero é melhor), Sandbox
(deve ser gated).

---

## 13. FACÇÃO ALIADA (B1-K)

**O que ALIADA significa hoje** (`aff ≥ 85`):
- `fracBandAlert('aliada')`: 1 banner/run ("PASSOU A TRATAR VOCÊ COMO PARTE DA CAUSA").
- Habilita as **ofertas de maior `needAff`** (ex.: `rem_refugio` aff≥15, `dev_transmuta` aff≥20) — benefício via *acesso a poder pago em ⧗*, não buff automático.
- **Não** há buff permanente nem reforço automático hoje.

**Como tornar ALIADA mais perceptível fisicamente sem quebrar o jogo:**
- **Presença pontual e opt-in** (emissário/cache que o jogador escolhe acionar) em vez de buff passivo → evita trivializar/snowball.
- **Efeito temporário e limitado** (1×/onda ou 1×/run), telegrafado, com custo de oportunidade → não substitui Echo, não vira buff permanente.
- **Reforço combatente de vida curta** (`allies` fighter já existe) com cap e `life` → sensação de aliado sem snowball, desde que não escale com a run.
- **Evitar:** stats globais permanentes, revive infinito, escala com afinidade (afinidade sobe rápido → snowball).

---

## 14. RELAÇÃO COM MORALIDADE (B1-L)

Fonte de verdade: `moral={comp,greed,viol}` + `MORAL_BALANCE`/`MORAL_AFFINITY`.

| Eixo | Influencia facções? | Como |
|---|---|---|
| **Compassion** | Sim | `compassion_choice` → +anchor/+remnants, −consortium/−deviants |
| **Greed** | Sim | `greed_choice` → +consortium |
| **Violence** | Sim | `violence_choice` → −remnants, +deviants/+consortium |

Moralidade também afeta: **itens** (`MORAL_AFFINITY` → níveis DIVERGENTE…RESSONANTE
= Attunement), **eventos** (opções morais), **Echos** (reações via
`evaluateEchoReaction`/`echoOpinion`), **finais** (perfil moral).

**PR14 pode consumir moralidade com segurança?** — **Sim, como CONTEXTO, sem
fundir.** Regra a preservar:
- **Moralidade** = contexto/decisão do operador (quem você é).
- **Afinidade de facção** = leitura própria de cada facção (já existe, separada).
- **NÃO** criar uma segunda camada de "reputação moral" nem espelhar
  moralidade dentro do estado de facção. O `FACTION_GRID` já é a *única* ponte
  (moral choice → delta) — o PR14 deve **reusar** essa ponte, não duplicá-la.

---

## 15. RELAÇÃO COM ECHOS (B1-M)

Echos têm `e.rel` (relacionamento/trust) e `e.dis` (Dissonância), `personality`,
e reações (`evaluateEchoReaction`, `echoReact`, `echoOpinion`). Facção↔Echo hoje:
- Ofertas/eventos **alteram** trust (`changeEchoTrust`), Dissonância (`e.dis.p`,
  `relAddPressure`), e `eqBoost` (dano/vida/shield/Dissonância).
- Equipamento por origem instala em Núcleo/Protocolo/Relíquia dos Echos.
- Echos **opinam** sobre escolhas morais (`echoOpinion`) — mas **não** reagem à
  *presença física* de uma facção (que ainda não existe).

**Oportunidade (conceitual, sem implementar falas):** uma presença de facção na
arena poderia **disparar uma REAÇÃO do Echo** via o sistema de fala/reação já
existente (`speechQueue` com prioridade/fila, `echoReact`) — ex.: um Echo dos
Remanescentes reage à presença dos Desviados. **Sem** transformar o Echo em
"modificador de facção": a reação é *expressiva/diegética*, o vínculo continua
sendo Player↔Echo. Falas novas ficam para blocos posteriores.

---

## 16. SAVE / CONTINUE (B1-N)

O que é salvo hoje de facção:

| Dado | Onde | Escopo | Nota |
|---|---|---|---|
| Afinidade/obs/hist/ofertas/eco | `cp.frac` (`fracRunPack`) | run/checkpoint | zera no fim da run |
| ⧗ Resíduos + equipamento de Echo | `cp.frac` | run | `es`, `eq`, `inv`, `stock` |
| `fractureRun` (Tema/seed/intensity) | `cp.fracture` (`fractureRunPack`) | run | input não confiável no unpack |
| Descoberta narrativa (Codex) | `slots[n].fracd` (`fracDiscClean`) | Save Slot | persiste entre runs |
| flags/refúgio/conTax | dentro de `fracRun` | run | `refugio`, `conTax`, `duoNasc` |

`SM_VERSION=3` e `FRACTURE_STATE_VERSION=1`. Ambos os unpacks tratam o payload
como **input não confiável** e caem em `fresh` em save antigo.

**Custo de persistir futuras presenças** — recomendação por tipo:

| Estratégia | Quando usar | Custo |
|---|---|---|
| **Não persistir (efêmera)** | presença de combate/emissário de vida curta | Nenhum. **Preferida** para a maioria. |
| **Reconstruir deterministicamente** | presença agendada por (seed, wave) via Diretor | Baixo; casa com o modelo do `fractureRun` (Tema puro da seed). **Preferida** para agendamento. |
| **Serializar estado mínimo** | objetivo opcional em progresso / cache não coletado | Médio; adicionar poucos campos *opcionais aditivos* em `cp.frac` sem mudar SM_VERSION. |
| **Serializar entidade completa** | — | **EVITAR** (infla save, exige versionamento). |

> **SM_VERSION deve permanecer 3.** Campos novos, se necessários, devem ser
> **opcionais e aditivos** (como `cp.frac`/`fracd` já foram introduzidos sem bump).

---

## 17. SANDBOX (B1-O)

Isolamento atual (guardas `sandboxMode`/`sandboxRun`):
- `fracFeedback`/`fracBandAlert`/`fracContact` **silenciados** no laboratório.
- **Beacon gated**: `scheduleBeacon` não nasce beacon no Sandbox; arena events
  (`tickArenaEvent`/`tickMicroEvents`) desligados (`!sandboxRun`).
- Discovery em **cópia isolada** (swap de contexto); **nada grava** nos saves reais.
- Equip do lab (`fracSandboxEquip`) usa o mesmo caminho de cálculo **sem** unlock/estoque/gravação.

**O que uma presença futura NÃO pode contaminar:** afinidade real, ⧗, moralidade,
relacionamento/trust dos Echos, equipamento real, unlocks, histórico de eventos,
finais, meta/prog/records. **Regra:** toda nova presença precisa herdar o mesmo
gate (`if(sandboxMode||sandboxRun)return`) que o beacon/feedback já usam, e
qualquer efeito de progressão deve passar pelos protetores existentes.

**Risco:** uma nova entidade que chame `factionEmit`/`addResidues`/
`changeEchoTrust` **sem** gate vazaria estado para os saves reais. **Auditar por
teste no bloco de implementação.**

---

## 18. PERFORMANCE (B1-P)

Limites atuais: `ENEMY_BUDGET=46` (teto de inimigos simultâneos), `PARTS_MAX=900`
(partículas, com `trimParts`), `beacon` único, `allies` sem cap explícito (mas
poucos por design). Loop principal atualiza/desenha por frame; cleanup por
splice/`life`/`dead`.

**Orçamento técnico sugerido para presença de facção (aproximado, sem falsa precisão):**

| Forma | Classe |
|---|---|
| Skin/cor de beacon (1 por vez) | **MUITO LEVE** |
| Emissário estático (1–2, sem física pesada) | **LEVE** |
| Cache/pickup temático (poucos) | **MUITO LEVE** |
| Unidade aliada combatente (cap ~2–3) | **LEVE** |
| Zona de influência (1 ativa, tick por frame) | **MODERADO** |
| Hazard/bombardeio telegrafado | **MODERADO** |
| Múltiplas unidades hostis em `enemies[]` | **CARO / EVITAR** |

**Diretriz:** manter presença **fora** do orçamento de `enemies`/`parts` sempre
que possível; **1 presença de facção ativa por vez** como teto conservador
inicial; reusar spawnRing/spawnShards para FX (já existentes) em vez de novos
sistemas de partículas.

---

## 19. UX E LEGIBILIDADE (B1-Q)

Como o jogador identifica facção **hoje**:
- **Cor + símbolo** por facção (⬡◉◈◬; #8fd6ff/#7dffc4/#ffd166/#ff4df0) — consistentes em banners, ofertas, equip e Codex.
- **Nome** sempre por extenso em "TRANSMISSÃO // <FACÇÃO>".
- **Relação/estado**: só no Codex e em banners de faixa (nunca número cru).
- **Mudança de afinidade**: feedback diegético efêmero (toast/banner), **sem** indicador persistente.
- **Evento/equip de facção**: cor + rótulo; tooltips no Codex/arsenal.

**Problemas de legibilidade que uma presença física deverá respeitar:**
1. **Sem número cru** (política forte do projeto) — a presença deve comunicar via cor/símbolo/texto diegético.
2. **Não há HUD permanente de estado de facção** — se a presença exigir que o jogador saiba a relação atual, isso hoje só está no Codex (fora da run). Cuidado: pode confundir "quem" e "por quê".
3. **Anti-spam** já é regra (cooldowns) — presença não pode gerar enxurrada de banners.
4. **Colisão de cor** com FX de combate (ex.: ciano/verde já usados por projéteis/kits) — presença precisa de forma/símbolo distinto, não só cor.
5. **Legibilidade em telas menores** (breakpoints 1600×900 / 1366×768 já existem) — world-space UI da presença deve respeitar a escala tipográfica (`var(--fs-*)`).

**Não redesenhar UI no B1.**

---

## 20. CONFLITOS COM SISTEMAS EXISTENTES (B1-R)

| Sistema | Risco | Natureza do conflito |
|---|---|---|
| **Fracture Themes / shaping** | **CRÍTICO** | tocar `fractureShapeWave`/`fractureForceTheme` transformaria facção em Tema. Linha vermelha. |
| **Fracture Director (ciclo)** | BAIXO | hooks de onda/loja e `faction_reaction` são feitos para isso |
| **Minibosses** | MÉDIO | timing de spawn de presença vs. cleanup de `hazards`; não confundir presença com miniboss |
| **Paradoxo (boss)** | MÉDIO | `onVictory` faz `beacon=null` e limpa entidades — presença deve morrer junto (reusar cleanup) |
| **Echo Shop / Loja** | MÉDIO | não duplicar ofertas; não redesenhar loja; respeitar `oncePerRun`/`stockWave` |
| **Events (pool/beacon)** | MÉDIO | reusar beacon é ótimo, mas cuidado com cadência (`evTimer`, `evMem.dw`) e `oncePerRun` |
| **Moralidade 2.0** | MÉDIO | risco de duplicar camada; reusar `FACTION_GRID` como única ponte |
| **Relationship / trust** | MÉDIO | presença que mexe em trust sem gate contamina; passar por `changeEchoTrust` |
| **Dissonance** | MÉDIO | ofertas já mexem em `e.dis`; presença não pode criar 2ª via de pressão sem cap |
| **Attunement** | BAIXO | é moral-item; presença não deve tocá-lo |
| **Save/Continue** | ALTO (se mal feito) | qualquer campo novo precisa ser opcional/aditivo; **SM_VERSION=3** intocado |
| **Sandbox** | ALTO (se mal feito) | presença sem gate vaza para saves reais |
| **Performance** | MÉDIO | manter fora do budget de enemies/parts; cap de presença ativa |
| **HUD** | MÉDIO | sem número cru; sem spam; forma distinta de FX |
| **Speech queue** | BAIXO | reação de Echo à presença cabe na fila com prioridade; `speechClear` já usado ao abrir modal |

---

## 21. SISTEMAS QUE NÃO DEVEM SER TOCADOS (referência para B2+)

`fractureShapeWave` / seleção e força de Tema · `SM_VERSION` (=3) ·
`FRACTURE_STATE_VERSION` · seed/determinismo do Diretor · balanceamento de
`waveComp`/`ENEMY_BUDGET` · Moralidade (fonte `moral`) como camada · gates de
Sandbox existentes · esquema de save de `fracRun`/`fracDisc` (só aditivo) ·
`FACTION_GRID` como *única* ponte moral→facção (reusar, não duplicar).

---

## 22. DÍVIDAS TÉCNICAS (registro)

- **DT-1 — Versão inconsistente no snapshot:** `package.json=0.8.0-alpha` vs.
  `ECHO_VERSION=0.7.0-alpha` + 4 asserções de teste fixando `0.7.0-alpha` →
  `npm test` vermelho (2 falhas diretas + 2 latentes). **Fora do escopo do B1**
  (não mexer em produção/testes). Precisa de decisão do dono (alinhar em 0.8.0
  ou reverter para 0.7.0) antes de um bloco que exija suíte verde.
  - **✅ RESOLVIDA (PR14 · B1-FIX):**
    - **Causa:** o release "0.8.0-alpha" bumpou `package.json` mas deixou
      `ECHO_VERSION` (runtime, `index.html`) e 4 asserções de teste em
      `0.7.0-alpha` — duas fontes de verdade independentes ficaram divergentes.
    - **Decisão:** versão oficial permanece **0.8.0-alpha** (não reverter).
    - **Correção (mínima, só consistência):** `ECHO_VERSION` → `0.8.0-alpha`
      (`index.html`); literais/regex de versão atualizados em
      `tests/devmode.test.js`, `tests/fracture-director.test.js` e
      `tests/pr13-5-b6-balance.test.js`. Documentação histórica (PR13.5,
      RELATORIO_B6_PR12) **preservada** em 0.7.0-alpha por descrever contexto
      anterior. `SM_VERSION=3` e `FRACTURE_STATE_VERSION=1` intocados; zero
      mudança de gameplay.
    - **Resultado `npm test`:** **0 falhas** (todas as suítes verdes).
- **DT-2 — Beacon único:** só 1 beacon por vez limita coexistência de "evento
  comum + presença de facção" na mesma janela. Se a presença reusar `beacon`,
  precisará de política de prioridade/coexistência (avaliar no B2).
- **DT-3 — `allies[]` sem cap explícito** nem marcação de origem/facção; se
  virar presença aliada, precisa de cap e tag.
- **DT-4 — `faction_reaction` sem emissor:** hook pronto e ocioso; documentar
  que o PR14 é seu consumidor natural (só histórico, nunca Tema).
- **DT-5 — Sem HUD persistente de estado de facção na run** (só Codex/banners):
  presença que dependa de "relação atual" tem legibilidade limitada hoje.

---

## 23. CONCLUSÃO DA AUDITORIA

As quatro facções já são um sistema **maduro e sistêmico**: afinidade run-scoped
(7 estados), 54 pontos de `factionEmit`, 12 eventos + 8 ofertas + 2 serviços, 37
equipamentos por origem, economia de ⧗, Codex por slot, Save/Sandbox isolados. O
que falta é exatamente o objetivo do PR14: **presença física perceptível na
arena**. A infraestrutura para isso **já existe em germe** — o `beacon`
(world-space, proximity-interactive, gated no Sandbox, limpo na vitória), o
array `allies` (unidade autônoma com lifecycle), e o hook **`faction_reaction`**
do Diretor (pronto, sem emissor). A linha vermelha é clara e única:
**não tocar no shaping/seleção de Tema** (FACÇÃO≠TEMA).

---

## 24. ARQUITETURAS CANDIDATAS PARA O RESTANTE DO PR14 (máx. 3)

### MODELO A — "Presença como entidade de arena efêmera" (skin de beacon + emissário)
- **Descrição:** a presença de facção é uma **entidade world-space efêmera**
  (evolução do `beacon`/`allies`): um marco/emissário identificável por
  cor+símbolo da facção, com interação por proximidade (reusa `openEvent`/modal
  ou um prompt curto).
- **Como funciona:** um *spawner de presença* agenda a entidade em janelas
  seguras (início/entre ondas); ao interagir, reusa a lógica de eventos/ofertas
  já existente; expira/limpa como o beacon.
- **Vantagens:** legibilidade máxima (o jogador *vê* a facção no chão);
  reaproveita beacon+allies+FX; efêmero → Save trivial; gate de Sandbox herdado.
- **Desvantagens:** beacon é único hoje (DT-2) → precisa política de
  coexistência; risco de "só mais um evento" se não tiver identidade visual própria.
- **Risco:** Médio-baixo. **Save:** efêmero/reconstruível. **Sandbox:** gated.
  **Perf:** MUITO LEVE–LEVE. **Fracture:** usa `faction_reaction` (histórico),
  **não** toca Tema. **Afinidade:** consome via `fracRun.aff`/`fracOffersOpen`.
  **Diferencia as 4?** Sim (cor/símbolo/comportamento por facção). **Escala:** boa.

### MODELO B — "Intervenção dirigida pelo Fracture Director"
- **Descrição:** a presença é **agendada e registrada pelo Diretor** via
  `faction_reaction` + hooks de onda; a manifestação (banner/efeito/skin) é
  consequência determinística de (seed, wave, afinidade/histórico).
- **Como funciona:** `fractureOnWaveStart`/`shop_open` decide, por seed, se e
  qual facção "reage" nesta onda; emite `faction_reaction` (só histórico) e
  aciona uma manifestação leve.
- **Vantagens:** determinismo/Continue-safe nativo; casa com a arquitetura pura
  da seed; ortogonalidade garantida (Diretor decide *quando*, facção decide
  *o quê*, Tema permanece independente).
- **Desvantagens:** menos "físico"/tátil que o Modelo A se a manifestação for só
  banner; risco de o jogador não *sentir* a presença se ficar sistêmico demais.
- **Risco:** Baixo (se não tocar shaping). **Save:** reconstruível por seed.
  **Sandbox:** gated. **Perf:** MUITO LEVE. **Fracture:** integração canônica.
  **Afinidade:** consome histórico/afinidade. **Diferencia as 4?** Sim.
  **Escala:** ótima. **Cuidado:** manter longe de `fractureShapeWave`.

### MODELO C — "Híbrido: Diretor agenda (B) + entidade física efêmera (A)" ⟵ **RECOMENDADO**
- **Descrição:** o **Fracture Director agenda** determinísticamente *quando/qual*
  facção se manifesta (Modelo B, via `faction_reaction` + hooks de onda), e a
  manifestação é uma **entidade de arena efêmera** identificável (Modelo A, via
  beacon/allies com skin de facção e interação por proximidade).
- **Como funciona:** agendamento determinístico (seed, wave, afinidade) → spawn
  de presença world-space com cor/símbolo da facção → interação reusa
  eventos/ofertas existentes → efeito passa pelas pontes atuais (`factionEmit`,
  `addResidues`, `changeEchoTrust`) → cleanup efêmero + registro `faction_reaction`.
- **Vantagens:** une legibilidade tátil (A) com determinismo/Continue-safe (B);
  reusa quase toda a infra existente; ortogonalidade preservada por construção.
- **Desvantagens:** mais peças a coordenar; exige resolver coexistência de beacon
  (DT-2) e cap de presença (DT-3).
- **Risco:** Médio (gerenciável). **Save:** efêmero + reconstruível (estado
  mínimo se houver objetivo em progresso; SM_VERSION intocado). **Sandbox:**
  gated herdado. **Perf:** LEVE (1 presença ativa por vez). **Fracture:**
  `faction_reaction` + hooks de onda, **nunca** shaping. **Afinidade:** consumida,
  não duplicada. **Diferencia as 4?** Sim, plenamente. **Escala:** ótima.

### 24.1 RECOMENDAÇÃO PRINCIPAL: **MODELO C (Híbrido)**

**Justificativa:** é o único que entrega o objetivo do PR14 — fazer o jogador
**sentir** a facção na arena — enquanto **maximiza reuso** (beacon, allies, FX,
`factionEmit`, ofertas) e **respeita todas as linhas vermelhas**: usa o hook
`faction_reaction` já projetado para "facção reage sem controlar o Tema", mantém
determinismo por seed (Continue-safe, SM_VERSION=3), herda os gates de Sandbox e
mantém a moralidade como camada separada. Modelo A sozinho não tem determinismo
de agendamento; Modelo B sozinho corre risco de ficar sistêmico demais e não ser
*sentido*. O híbrido combina o melhor dos dois com risco controlado.

> **O B1 NÃO implementa a recomendação.** A implementação começa no B2.

---

## 25. RECOMENDAÇÃO DE ROADMAP (B2→B6)

### 25.1 O que deve entrar no **B2** (fundação, sem gameplay novo perceptível)
- Definir o **contrato de dados** da presença (tipo `factionPresence`: id,
  facção, kind, spawn window, lifecycle, cleanup) — **sem** ainda spawnar em
  produção; testes de estrutura.
- Ligar o **emissor de `faction_reaction`** no Diretor (só histórico), com
  determinismo por (seed, wave) e **gate de Sandbox**.
- Escolher o **molde de entidade** (beacon vs. allies) e resolver **coexistência
  de beacon (DT-2)** e **cap de presença (DT-3)** no nível arquitetural.
- Garantir **Save-safe**: campos opcionais aditivos em `cp.frac` (se houver);
  **SM_VERSION permanece 3**; teste byte-for-byte de saves antigos.

### 25.2 Adiado para **B3/B4/B5/B6**
- **B3:** primeira **presença física visível** (skin de beacon/emissário) de 1–2
  facções, interação por proximidade reusando eventos; legibilidade (cor/símbolo).
- **B4:** as **4 facções** com identidade de presença distinta (aliada/neutra) +
  **reação dos Echos** à presença (via `speechQueue`/`echoReact`, sem falas novas antes da hora).
- **B5:** presença **HOSTIL** não-inimigo (pressão indireta/telegrafada, B1-J) e
  presença **ALIADA** balanceada (anti-snowball, B1-K); balanceamento de cadência/perf.
- **B6:** balanceamento final, auditoria de exploits/farm, telemetria, polish de
  UX/HUD, e resolução da **DT-1** (versão) se ainda pendente.

---

## APÊNDICE — SCRIPT DE AUDITORIA

`audit_pr14/faction_presence_audit.js` — read-only, imprime o inventário factual
(facções, estados, grid, ofertas, eventos, equipamento, entidades, hooks do
Diretor, Save, Sandbox). Executar com `node audit_pr14/faction_presence_audit.js`.
Não escreve arquivos nem altera estado.

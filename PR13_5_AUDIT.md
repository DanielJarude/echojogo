# ECHO — Auditoria Geral da PR13.5 · BLOCO 1

**Escopo:** medir e entender o jogo **como ele funciona hoje**, sem alterar gameplay.
**Idioma:** Português do Brasil (pt-BR).
**Reprodução:** os scripts usados estão em `audit_pr135/` (ferramentas de auditoria, não fazem parte do jogo).

---

## 1. Estado inicial

Fonte de verdade: `git`, `index.html`, `tests/`, `package.json`.

| Item | Valor |
|---|---|
| Branch de trabalho | `arena/01a06d35-echojogo` |
| Base | `main` no commit `10f8da76912e7002b9a345c0e0e89a7ad5f8d027` |
| HEAD inicial | `10f8da76912e7002b9a345c0e0e89a7ad5f8d027` |
| Working tree | limpa |
| PR13 / PR #20 em `main` | **SIM** — HEAD é exatamente o merge de `Pull request #20` (`Fracture Director`) |
| Versão (`package.json` / `ECHO_VERSION`) | `0.7.0-alpha` |
| `SM_VERSION` | `3` (`index.html:15151`) |
| `FRACTURE_STATE_VERSION` | `1` (`index.html:23962`) |

### Baseline de testes (antes de qualquer alteração)

```
18 suítes (arquivos de teste) · 0 falhas
```

- `npm test` executado na base: **0 falhas**.
- O comando não emite um agregado global único: cada um dos 18 arquivos imprime o próprio contador. A última linha do pipeline (suíte `fracture-director`) reporta **274 passaram · 0 falharam**; é essa a referência usada na sessão (`274/0`).
- Sumando os contadores dos 18 arquivos: **1 235 checks · 0 falhas**.
- Nenhum arquivo foi alterado; este é o baseline oficial da PR13.5.

---

## 2. Metodologia

1. Leitura direta do `index.html` real (script único, ~27.000 linhas) — código e testes como fonte de verdade.
2. Carregamento do script real em sandbox Node (mesmo harness dos testes) para inventariar dados e executar os algoritmos reais da loja, dos módulos, da moralidade e dos minibosses.
3. Simulações com **RNG seedado** (LCG injetado em `Math.random`).
4. Heurísticas de compra/renda são **explicitamente documentadas** abaixo quando usadas.
5. As métricas só são aceitas quando o estado que se pretendia testar foi realmente populado (pool `effective > 0`, ondas exercitadas, perfis morais aplicados, etc.).

Arquivos temporários/reproduzíveis em `audit_pr135/`:

- `harness.js` — carrega o script real de `index.html` em VM com DOM mínimo.
- `variety.js` / `variety2.js` — variedade da loja (10 000 lojas por cenário; 1 000 runs sequenciais).
- `economy_sim.js` — simulação econômica de 3 perfis (300 runs cada).
- `speech_metrics.js` — métricas das strings de fala.
- `range_audit.js` — inventário de armas e consumidores de `range`.
- `miniboss_audit.js` — matriz de minibosses.

---

### Resumo executivo — classificações

| Pilar | Gravidade | Resumo curto |
|---|---|---|
| Echo Speech UX | **ALTO** | Fala dura 1,1s fixos, sem fila/prioridade, cooldown global 8s, mesmo array de números de dano |
| Melee × Ranged Range | **MÉDIO** | Um único `range` afeta melee+beam+ranged; separação é factível mas mexe em UI/save/itens |
| Item Identity + Shop Variety | **ALTO** | 58% de repetição entre lojas consecutivas no início; 10+ upgrades auto-pick/redundantes |
| Run Economy | **ALTO** | Sobra dinheiro a partir da onda ~5; perfil Greed chega a ~9× os créditos do perfil neutro |
| Sintonia (Attunement) | **MÉDIO** | Já tem efeito mecânico real, mas pequeno e mal comunicado |
| Boss & Miniboss Identity + O PARADOXO | **ALTO** | 8 minibosses compartilham investida+rajada+fase 2 e mesmo corpo/paleta; O PARADOXO já é distinto |

---

## 3. Echo Speech

### Como a fala funciona hoje

- Função central: `echoSpeak(e, txt, color)` (`index.html:6134`).
- Única saída visual: **texto flutuante no canvas** via `floatText(e.x, e.y - e.r - 34, txt, color, FTEXT_SPEAK)`.
- `FTEXT_SPEAK = 15px`; `FTEXT_SIZE = 13px` (números/avisos); `FTEXT_CRIT = 17px`.
- `floatText` cria `{ x, y, txt, color, t:0, life:1.1, sz }` — **duração fixa de 1.1s**, sem quebra de linha, sem largura máxima, sem z-index (canvas).
- Fade: `ctx.globalAlpha = 1 - f.t/f.life`; a fala sobe `30px/s`.
- Concorrência: `ftexts` é o mesmo array de números de dano, procs e avisos; o teto `FTEXT_MAX = 52` é verificado apenas no `dmgNumShow` (números/procs); o `echoSpeak` **não** verifica esse teto. Uma fala **não sobrescreve** a anterior, ela **empilha no mesmo array** (podem coexistir por 1.1s). Não existe fila, prioridade, overwrite nem preempção.
- Cooldown global: `_echoSpeakCd = 8s` (`ECHO_SPEAK_INTERVAL=8`). `echoSpeak` retorna se `_echoSpeakCd > 0`; `echoReact` também usa esse gate **e** uma chance anti-spam de `35%` (`Math.random() > .35` → não fala).
- Conclusão prática: **toda fala de qualquer fonte é bloqueada por um único cooldown global de 8s**, e mensagens costumam ser simplesmente descartadas.

### Fontes de fala

| Fonte | Mecanismo |
|---|---|
| Eventos de combate (`waveStart`, `killStreak`, `playerHurt`, `shieldBreak`, `lowHp`, `echoHit`, `resonance`, `dissonance`, `dissonanceEnd`, `miniboss`, `trustHigh`, `trustLow`, `bossDeath`) | `echoReact` → `persLineFor` ou `ECHO_LINES` |
| Personalidade (`PERSONALITIES` com pools por evento) | `persLineFor(e, event)` (fallback do `echoReact`) |
| Relação/Trust (`echoesEvaluate`, `pickRelationLine`) | `echoSpeak` direto no callback de reação mais intensa |
| Dissonância/rompimento/reconciliação | `echoSetDis` → `echoSpeak` |
| Papéis táticos (`COBERTURA ATIVA.`, `DISTORÇÃO LIBERADA.`) | `echoSpeak` direto em `echoRoleTick` |
| Equipamento do Echo | `reactToEchoEq` → vozes por personalidade + fallbacks |
| Eventos com diálogo do Echo (`x_duplo`, `x_memoria`, microuniverso) | `echoSpeak` direto |
| Fracture Director (assinatura, estágio, Tema, Ressonância — B3/B4) | `fractureEchoSpeakPick` / `fractureResoReact` → `echoSpeak` |
| DEV / Sandbox | `DEV.forceSpeak` |

### Métricas reais das strings (script `speech_metrics.js`)

| Métrica | Valor |
|---|---|
| Linhas totais coletadas (pools conhecidos do código) | **256** |
| Comprimento médio | **20,5 caracteres** |
| Mediana | **20** |
| P90 | **30** |
| Máximo | **38** |
| Palavras por fala (média) | **3,2** |
| Máximo de palavras | ~7 palavras |
| Leitura exigida em 1,1s (média) | ~173 wpm |
| Leitura exigida em 1,1s (P90) | ~273 wpm |
| Leitura exigida em 1,1s (máx) | ~436 wpm |

### Diagnóstico

- **Problema confirmado (gravidade: ALTO).**
- **Causa principal:** duração fixa 1.1s + **ausência de fila/prioridade/preempção** + um **único cooldown global de 8s**. Uma fala trivial pode "consumir" o cooldown e apagar/silenciar uma fala importante; a fala aparece no canvas misturada a números de dano e procs, sem layout separado, sem quebra de linha e sem qualquer adaptação ao tamanho do texto.
- As falas em si são **curtas** (média 20 caracteres). O problema não é o tamanho — é o **canal de apresentação** (1.1s, sem fila, sem prioridade, sem zoneamento visual).
- Duração NÃO considera tamanho do texto (sempre 1.1s).
- Não existe duração maior para mensagens longas nem `word-wrap`.
- Não há cooldown por fonte/por Echo além do global de 8s; nem prioridade para `miniboss`/`dissonance`/`bossDeath`.

### Vulneráveis a desaparecer cedo

| Tipo | Exemplo | Motivo |
|---|---|---|
| Boss/miniboss | `MINI-CHEFE — ...` | dispara junto com banners de onda/boss e pode ser engolida pelo cooldown |
| Dissonância | `NÃO RECONHEÇO MAIS.` | mesma janela que qualquer outra fala |
| Fracture B3/B4 | linhas de `reveal`/`ruptura` | mesmas limitações |
| Relação (aprovação/rejeição) | `VOCÊ AINDA POUPA...` | sem prioridade sobre fala de killStreak |

**Classificação:** CRÍTICO — não, não há perda de dados; ALTO — há perda de legibilidade e de oportunidade (fala importante silenciada). NÃO CONFIRMADO — não verificamos em playtest humano a sensação exata.

---

## 4. Range

### Arquitetura atual

- `SM_STATS.range` (`index.html:4377`): `set → p.rangeMul`, `base → o.range`; `_smBase.range = 1`.
- Pipeline (`smGet`): `(base + flat) * (1 + addSum) * mult`; `smRefresh` escreve o final em `p.rangeMul`.
- `weaponRange(def, src) = (def.range || 600) * (src.rangeMul || 1)` (`index.html:1494`).

### Consumidores reais

| Consumidor | Como usa `range` |
|---|---|
| `fireMelee` | `reach = def.reach * (src.rangeMul || 1)` → **melee É afetado** |
| `fireBeam` | `range = def.range * (src.rangeMul || 1)` → **beam É afetado** |
| `fireWeaponFrom` | `maxDist = (def.range || 600) * (src.rangeMul || 1)` → **projétil É afetado** (expira por distância percorrida) |
| `updateProjectiles` | termina quando `p.dist >= p.maxDist` |
| `weaponTipHTML` / `buildWeaponHUD` / TAB / loja / anel de alcance | exibem `weaponRange` ou `smGet('range')` |
| `render` (anel de alcance do jogador) | `weaponRange(WEAPONS[p.wi], p)` |
| `sheetStatRow` (TAB) | `smGet(p,'range')` e `weaponRange(...)` |
| Save/checkpoint | `rangeMul` incluído em `captureCheckpoint(...)` e restaurado no resume |
| DEV / Sandbox | criação de player com `rangeMul:1`; DEV inspector mostra breakdown |

### Percepções do playtest × resultado

- **Bônus genérico de Range afeta melee? SIM** — `reach` é multiplicado por `rangeMul`.
- **Afeta ranged? SIM** — `maxDist` dos projéteis.
- **Afeta beam? SIM** — comprimento do feixe.
- **Arma que não obedece ao pipeline? SIM** — todos os projéteis de **drones (`colmeia`), aliados, `split`, minibosses, boss, Shadow Echos** usam `maxDist`/distâncias **hardcoded** (ex.: drones 520, aliados 470/430, `split` 260, boss `beamLen:820`).
- **Distâncias hardcoded? SIM** — muitos `maxDist` em projéteis não-arma.
- **Shotgun usa Range de maneira diferente?** Não. `maxDist = 245 * rangeMul`; os 7 projéteis usam a mesma regra de `maxDist`. O efeito percebido vem da contagem/spread, não de um alcance próprio.
- **Projéteis usam Range + lifetime + velocidade? SIM** — o projétil morre no **primeiro** evento: `maxDist` OU `life` OU sair da arena. O alcance efetivo é `min(speed*life, maxDist)`.
- **Melee usa distância geométrica + arco? SIM** — `fireMelee` testa `dist <= reach + e.r` e ângulo no arco; `reach` é o parâmetro.
- **Echo usa o mesmo conceito?** Os Ecos usam `rangeMul`/`maxDist` via `fireWeaponFrom`, mas Ecos têm `ECHO_RANGE` separado (360/400) para alvo/órbita; **não** ligado ao `range` do jogador.
- **Código que depende do nome "range"? SIM** — o pipeline inteiro, armas, `weaponRange`, `rangeLabel`, UI, loja, TAB e vários itens/upgrades usam o nome exato `range`.

### Inventário de armas (27 armas)

| id | nome | categoria | range base | tipo |
|---|---|---|---|---|
| plasma | RIFLE DE PLASMA | PRIMÁRIA | 760 | ranged |
| shotgun | ESCOPETA MAGNÉTICA | DISPERSÃO | 245 | ranged |
| orb | ORBE TEMPORAL | ÁREA | 430 | ranged (AoE) |
| blade | LÂMINA DE ARCO | CORPO A CORPO | 104 | **melee** (reach) |
| beam | FEIXE SINGULARIDADE | SUSTENTAÇÃO | 640 | **beam** |
| flamer | PROJETOR DE CHAMAS | INCENDIÁRIA | 210 | ranged |
| rail | CANHÃO DE TRILHO | PERFURAÇÃO | 1100 | ranged |
| smg | REPETIDOR ENXAME | CADÊNCIA | 480 | ranged |
| cryo | LANÇADOR CRIOGÊNICO | CONTROLE | 520 | ranged |
| tesla | BOBINA TESLA | CORRENTE | 470 | ranged |
| acid | PULVERIZADOR ÁCIDO | CORROSÃO | 330 | ranged |
| nail | CRAVADOR DE HASTES | SANGRAMENTO | 620 | ranged |
| boomer | LÂMINA ORBITAL | RETORNO | 420 | ranged |
| homing | ENXAME BUSCADOR | RASTREIO | 760 | ranged |
| mine | SEMEADOR DE MINAS | ARMADILHA | 200 | ranged (AoE) |
| sniper | PERFURADOR DE VÁCUO | PRECISÃO | 980 | ranged (+bonus longe) |
| scythe | FOICE HEMOLÍTICA | CORPO A CORPO | 118 | **melee** |
| hammer | MARRETA SÍSMICA | CORPO A CORPO | 132 | **melee** |
| void | CANHÃO DE VÁCUO | GRAVIDADE | 560 | ranged (AoE) |
| ricochet | PISTOLA RICOCHETE | REBOTE | 900 | ranged |
| gatling | GIRO-CANHÃO | ROTATIVA | 560 | ranged |
| prism | PRISMA DIVERGENTE | DIVISÃO | 540 | ranged |
| plague | CENSOR DE PRAGA | CONTÁGIO | 450 | ranged (AoE) |
| katana | KATANA DE FASE | CORPO A CORPO | 96 | **melee** |
| chains | CORRENTE FLAGELANTE | CORPO A CORPO | 172 | **melee** |
| gaunt | MANOPLA DE IMPACTO | CORPO A CORPO | 74 | **melee** |
| glaive | ALABARDA DE VÁCUO | CORPO A CORPO | 158 | **melee** |

- 7 melee, 1 beam, 19 ranged.
- Comprimentos base: mín 74 (gaunt), mediana 450, máx 1100 (rail).

### Mapa de dependências para migração

```
range atual
├─ melee: fireMelee (reach · rangeMul)            → migrar p/ meleeRange
├─ ranged: fireWeaponFrom (maxDist · rangeMul)    → migrar p/ rangedRange
├─ beam: fireBeam (len · rangeMul)                → decidir (beam é ranged)
├─ UI: weaponRange, TAB, HUD, tooltip, loja, anel → dependerá do conceito
├─ Itens/Upgrades: 'range' (todos os modificadores)
├─ Save/Checkpoint: p.rangeMul
├─ Sandbox/DEV: weaponRange/breakdown/TAB
└─ ambíguo: projéteis sem WEAPONS (drones, aliados, boss, miniboss, split)
```

**Veredito da separação:** a migração é **factível** e de **tamanho médio**. Os três pontos de consumo de combate são centralizados (`fireMelee`, `fireBeam`, `fireWeaponFrom`), mas há **muitos consumidores de exibição/save/itens** que usam o mesmo `range`, e há **projéteis hardcoded** que continuarão fora do pipeline mesmo após a separação (decisão de design: deixá-los ou migrá-los).

---

## 5. Inventário de itens normais (UPGRADES da loja)

Escopo desta seção: **itens normais da loja** = seção `UPGRADES` de `rollShop` (3 ofertas por loja, 6 com `bigShop`). Módulos passivos (57), armas e Echo Shop estão fora desta seção.

Total: **19** upgrades (10 iniciais + 9 desbloqueáveis).

| id | nome | rar | preço | efeito real | tipo | classificação |
|---|---|---|---|---|---|---|
| crit | CÂMARA CRÍTICA | COMUM | 16 | +8% crit | SIMPLES | AUTO-PICK |
| critd | DETONADOR FOCADO | COMUM | 16 | +35% dano crítico | SIMPLES | AUTO-PICK |
| rate | SERVO-GATILHO | COMUM | 18 | +12% cadência | SIMPLES | AUTO-PICK |
| hp | BLINDAGEM MODULAR | COMUM | 18 | +25 HP max + cura | SIMPLES | AUTO-PICK |
| range | ESTABILIZADOR DE FASE | COMUM | 15 | +25% alcance (todas as armas) | SIMPLES | AUTO-PICK |
| magnet | BOBINA COLETORA | COMUM | 12 | +45% raio coleta | SIMPLES | AUTO-PICK |
| dmg | CATALISADOR IÔNICO | INCOMUM | 22 | +14% dano geral | SIMPLES | AUTO-PICK |
| dash | CAPACITOR DE DASH | INCOMUM | 16 | −15% recarga dash | SIMPLES | NICHO |
| aoe | AMPLIFICADOR DE CAMPO | INCOMUM | 20 | +25% área | CONDICIONAL | NICHO |
| range2 | BOBINA DE LONGO CURSO | INCOMUM | 24 | +35% alcance · +8% vel proj | SIMPLES | AUTO-PICK / dominante sobre `range` |
| pierce | PONTA PERFURANTE | RARO | 28 | projéteis +1 alvo | CONDICIONAL | NICHO |
| critx | MIRA CIRÚRGICA | RARO | 34 | +14% crit · +55% crit dmg | SIMPLES | AUTO-PICK / dominante sobre `crit`+`critd` |
| vamp | DRENO SANGUÍNEO | RARO | 32 | rouba 5% dano como vida | CONDICIONAL | SAUDÁVEL |
| sprint | IMPULSO NEURAL | RARO | 30 | +14% vel · −10% dash cd | SIMPLES | AUTO-PICK |
| dmg2 | REATOR DE ANIQUILAÇÃO | ÉPICO | 52 | +32% dano geral | SIMPLES | AUTO-PICK / dominante sobre `dmg` |
| rate2 | GATILHO QUÂNTICO | ÉPICO | 50 | +30% cadência | SIMPLES | AUTO-PICK / dominante sobre `rate` |
| pierce2 | LANÇA DIMENSIONAL | ÉPICO | 56 | projéteis +2 alvos | CONDICIONAL | NICHO |
| omni | NÚCLEO ONISCIENTE | LENDÁRIO | 88 | +22% dano · +18% cad · +12% crit · +30 HP | SIMPLES | FORTE / AUTO-PICK |
| singul | SINGULARIDADE PESSOAL | LENDÁRIO | 92 | +45% dano · dash recarga 50% mais rápida | SIMPLES | FORTE / AUTO-PICK |

### Observações analíticas

- Não há upgrade com trade-off verdadeiro em `UPGRADES`; todos são **bônus universal** sem custo.
- `range2` domina `range` (mesma stat, além de `projSpd`).
- `critx` domina `crit`+`critd` juntos (mais barato que os dois, por um preço menor).
- `dmg2`/`rate2` dominam as versões comuns; `omni`/`singul` são exemplos claros de **item cuja penalidade é irrelevante** (nenhuma penalidade).
- `pierce`/`pierce2` são condicionais a builds de perfuração.
- Descrições correspondem ao efeito real (verificado; nenhum hook fantasma em `UPGRADES`).
- Não há anti-repeat: upgrades podem repetir infinitamente entre lojas.

---

## 6. Shop Variety

### Algoritmo real

- `rollShop()` (`index.html:7398`):
  - upgrades: `pickWeighted(pool, wave)` com peso por raridade; 3 ou 6 (bigShop); pool filtrado por `isUpgUnlocked`.
  - módulos: `pickWeightedMoral(pool, wave)` (raridade × viés moral ≤×1.10); 2 por loja; pool filtrado por `isItemUnlocked` e `ownsItem`.
  - armas: 2 por loja de `shopWeaponPool()` filtrada por `isWeaponUnlocked` e não possuídas.
- `rarityWeight`: COMUM 100, INCOMUM 52, RARO 24, ÉPICO 9, LENDÁRIO 2.5; ondas de desbloqueio `[0,1,4,8,13]` → a partir da onda 8 o pool de normal items sobe de 10 para 17; ondas 13+ chega a 19.
- `moralShopWeight`: ×1.10 no máximo; não bloqueia nada.
- **Anti-repeat: NÃO existe** (nenhum histórico de lojas; `rollShop` só remove do estoque *atual*).

### Tamanho do pool (itens normais)

| Onda | Pool efetivo (upgrades) | Pool total |
|---|---|---|
| 1–3 | **10** | 19 |
| 8 | **17** | 19 |
| 15+ | **19** | 19 |

### Simulação (10 000 lojas por cenário, independentes)

| Cenário | Onda | Seen | Máx/min (itens vistos) | Entropia |
|---|---|---|---|---|
| início | 1 | 10/10 | 1,81 | 3,27 |
| early | 3 | 10/10 | 1,50 | 3,30 |
| mid | 8 | 17/17 | 13,06 | 3,82 |
| late | 16 | 19/19 | 43,42 | 3,94 |
| greed_dom | 8 | 17/17 | 11,3 | 3,83 |
| viol_dom | 8 | 17/17 | 10,25 | 3,83 |
| comp_dom | 8 | 17/17 | 11,27 | 3,83 |

- Frequências mais altas (wave 1): `range` 12,3%, `critd` 12,2%, `crit` 12,1%, `magnet` 12,0%, `rate` 11,9%.
- Frequências mais baixas (wave 16): `singul` 0,24%, `omni` 0,22%, `rate2` 1,25%, `pierce2` 1,35%, `dmg2` 1,36%.
- Probabilidade de aparecer pelo menos uma vez em 10 lojas (wave 16): `aoe` 63,9%, `dash` 63,0%, `range2` 62,6%; itens lendários `omni`/`singul` apenas ~2,2%.

### Repetição (simulação de run sequencial, 1 000 runs, 20 lojas cada)

- **Upgrades entre duas lojas consecutivas: 58,0% de chance de repetir pelo menos um dos 3 oferecidos** (distribuição: 0 compartilhados 39,9%, 1 compartilhado 44,4%, 2 compartilhados 10,3%, 3 compartilhados 0,4%).
- Módulos entre duas lojas consecutivas, **sem compra do módulo**: 15,7% de chance de repetir pelo menos 1 dos 2. **Com compra** (módulo sai do pool): 0,0% (porque `ownsItem` o remove — não é anti-repeat, é pool consumido).
- Módulos distintos após 1/5/10/20 lojas: **11 / 32 / 48 / 57**.

### Veredito

- **Repetição confirmada** para a seção de itens normais (upgrades): o jogador vê 3 de um pool de 10 no early, e 58% dos pares consecutivos repetem pelo menos 1 item.
- **Causa principal:** **pool efetivo pequeno (10 no early)** + **pesos de raridade concentrados** (comuns dominam) + **ausência de anti-repeat**; adicionalmente, os itens comuns são auto-picks e ficam memoráveis, ampliando a sensação de repetição.
- Módulos e armas têm menos repetição (pool maior), mas módulos com compra esgotam o pool da run (reduz oferta futura).

---

## 7. Run Economy — Créditos da run

### Moedas mapeadas

- **◈ Créditos da run** (`player.coins`) — objeto da auditoria.
- **◆ Memória** — progressão meta (meta.mem), não é moeda da run.
- **⧗ Resíduos Temporais** (`fracRun.res`) — moeda do Echo/Fracture, **separada** dos créditos.
- Não há outra moeda de run encontrada.

### Fontes de créditos (código)

- Abates de inimigos: `killEnemy` — `base = tank?9 : shooter?4 : 2`, com `mEff.coinMul` e `player.coinMul`, +1 com 35% de chance.
- Miniboss: `+120 * mEff.coinMul * player.coinMul`.
- Eventos/microeventos: recompensas de 25 a 130 (usam `mEff.coinMul`).
- Opções morais/operadores/itens (ex.: `NÔMADE`, cache, observador, etc.).
- **Não há recompensa direta de conclusão de onda** (a onda em si não dá crédito).

### Saídas

- Upgrades, módulos, armas, reparo (custo base 22, ×1.5 por uso).
- Reroll: base 10, ×1.6 por reroll, multiplicado por `mEff.rerollMul` (Ganância encarece).
- Eventos com custo e taxas (ex.: Observador 20% dos créditos).

### Multiplicadores econômicos

- `mEff.coinMul = 1 + 0.85 * g` (Ganância), `mEff.shopMul = 1 + 0.34 * g`, `mEff.rerollMul = 1 + 0.50 * g`, `mEff.upgMul = 1 - 0.28 * c`.
- `player.coinMul` por módulos: `iman` ×1,3; `usura` ×1,8; `eco_risco` ×1,65; `eco_divida` ×2,0; `trans_temporal` ×1,9.
- Sintonia moral adiciona até +8% por item de Ganância e +14% global (cap).

### Simulação econômica (3 perfis, 300 runs cada; heurística documentada)

Heurística:
- Onda jogada perfeitamente (todos os inimigos abatidos), usando `waveComp(w)`;
- 1 escolha econômica de evento por onda, recompensa média base 50/60/80 (A/B/C), escalada por `coinMul`;
- Na loja: compra **tudo que couber** das ofertas (agressiva, para medir teto), 1 reroll se sobrar crédito;
- Perfil A = moral neutra, sem módulos econômicos;
- Perfil B = Ganância tier 1 + `iman`;
- Perfil C = Ganância tier 3 + `iman`, `usura`, `eco_risco`, `eco_divida`, `trans_temporal`.

| Perfil | Onda | Créditos ao abrir loja | Custo total das 5 ofertas | % consegue comprar tudo | Saldo após compras+reroll |
|---|---|---|---|---|---|
| A | 1 | ~84 | ~113 | 0% | ~7 |
| A | 5 | ~227 | ~128 | 100% | ~89 |
| A | 10 | ~345 | ~139 | 100% | ~196 |
| A | 18 | ~710 | ~152 | 100% | ~548 |
| B | 18 | ~1 900 | ~183 | 100% | ~1 704 |
| C | 18 | ~6 300 | ~244 | 100% | ~6 038 |

- Perfil C chega às lojas com **~8,9×** os créditos do Perfil A na mesma onda (e ~11× o saldo final).
- **Nota de simulação:** o modelo inclui 1 evento por onda. Removendo os eventos, o Perfil A deixa de conseguir manter o estoque a partir do mid-game (a renda de abates sozinha não cobre os gastos acumulados) — ou seja, parte relevante da inflação vem dos eventos.

### Respostas objetivas

1. **O jogador comum recebe dinheiro demais?** SIM, a partir do mid-game (~onda 5). No early (ondas 1–3) há pressão real (não consegue comprar tudo).
2. **Quando começa?** ~onda 5 em diante, quando o pool de itens abre e os preços continuam planos.
3. **Causa é renda alta?** PARCIAL — renda de abates + eventos cresce, mas **as despesas são poucas** (5 ofertas, 2 armas, 1 reparo, 1 reroll).
4. **Preços baixos?** SIM — os upgrades custam 12–30, módulos 24–72; **os preços quase não escalam** com a onda (pesos de raridade escalam mais que preço).
5. **Reroll barato?** SIM no early (10), escalando ×1,6/uso, mas raramente é um dreno de moeda.
6. **Poucos gastos?** SIM — a loja tem poucas ofertas por visita; a economia não tem "sink" robusto.
7. **Combinação?** Sim: **renda moderada + preços quase planos + poucos sinks**.
8. **Build de Ganância é significativamente mais rica?** SIM — ~9× mais créditos; **diferença exagerada**.
9. **Diferença saudável?** Não, é exagerada no teto (perfil C ~11× saldo residual).
10. **Existe pressão econômica real?** **Não do mid-game em diante** — o jogador normal pode "comprar tudo" e ainda guardar muito.

---

## 8. Passive Module Attunement / Sintonia

### Estado real

- `Sintonia` **já tem efeito mecânico** (não é só texto).
- `applyMoralTuning(player)` remove os modificadores `moral:item:<id>:<stat>` antigos e regenera com base em `calcMoralTuningPlan(player.items, getMoralProfile())`.
- Os modificadores passam pelo **Stat Modifier Pipeline** (`type:'add'`):
  - `dmgTaken` negativo (COMPAIXÃO): até −5% por item; cap global −10%.
  - `coinMul` positivo (GANÂNCIA): até +8% por item; cap global +14%.
  - `damage` positivo (VIOLÊNCIA): até +5% por item; cap global +10%.
- `moralTuneFactor(match)` é 0 quando o match ≈ baseline (1/3), e cresce até 1 no alinhamento perfeito.
- Estados `DIVERGENTE`, `NEUTRA`, `AFIM`, `HARMÔNICA` **são calculados** (cortes 0.22/0.45/0.72) e **têm consequência mecânica**, mas a magnitude é pequena.

### O que "Neutra" significa hoje

- `moralAffinityLevel(match)` → `NEUTRA` quando `0.22 <= match < 0.45`.
- Com match neutro, `moralTuneFactor` é ~0 → **nenhum bônus de sintonia** para aquele item (mas o item continua funcionando como qualquer módulo).
- Perfil moral totalmente equilibrado (`match≈1/3`) produz `NEUTRA` e **nenhum efeito de sintonia**.
- Perfil dominante (ex.: Ganância) produz `AFIM`/`HARMÔNICA` e **pequenos bônus de crédito** no pipeline.

### Perguntas diretas

1. **Sintonia altera stats?** SIM (3 stats via pipeline, como `add`).
2. **Altera hooks?** Não; hooks não são gated por sintonia.
3. **Altera preço?** Não diretamente; apenas peso de aparecimento na loja (×1.10 no máximo).
4. **Altera probabilidade?** SIM (apenas peso de loja e eventos; nada de proc chance).
5. **Altera comportamento?** Mínimo (stat add); não desbloqueia novas propriedades.
6. **Altera apenas texto?** Não — há efeito real, porém pequeno.
7. **Existe Dissonante?** SIM (`DIVERGENTE`), mas divergência **não pune** o item (`moralTuneFactor` nunca negativo).
8. **Existe Neutro?** SIM.
9. **Existe Sintonizado?** SIM (`AFIM`, `HARMÔNICA`).
10. **Estados são mecânicos ou apenas labels?** A label é derivada do mesmo cálculo que gera os modificadores; são **mecânicos**, mas a UI não comunica a magnitude.
11. **Equipar módulo altera moralidade?** Não — `giveItem` não chama `moralGain`; moralidade só muda por eventos/escolhas.
12. **Moralidade altera módulo?** SIM (derivado, recalculado).
13. **Save/Continue preserva?** SIM — sintonia é derivada e **recalculada** no resume (nunca salva os mods duplicados).
14. **Sandbox equivalente?** SIM — `applyMoralTuning` é chamável no laboratório e os testes DEV usam.

### Compatibilidade com o modelo futuro "base sempre + propriedade despertada"

- A arquitetura atual suporta **estatísticas derivadas por moral** com boa compatibilidade.
- Para **propriedades adicionais/despertadas** (ex.: novo efeito, novo proc, novo hook) o modelo atual **não comporta diretamente** — `applyMoralTuning` só gera 3 modificadores de stat; gatilhos de propriedade exigiriam extender `itemEmit`/handlers para ler o match moral, ou criar um plano de despertar por item. Refactor **moderado**, não bloqueador.

---

## 9. Minibosses — mecânica

### Matriz real (código)

| Miniboss | SHOOT | DASH | SUMMON | AOE | SHIELD | BUFF/DEBUFF | TELEPORT | DRAIN | OUTROS |
|---|---|---|---|---|---|---|---|---|---|
| Herald | ✔ (rajada radial) | ✔ (investida) | ✔ (escolta ×2) | ✔ radial | — | — | — | — | **fraturas temporais** (marcas de área) |
| Furnace | ✔ | ✔ | — | ✔ (nova 260px) | — | — | — | — | rastro de fogo (trail) + `burn` **declarado mas não usado** |
| Sentinel | ✔ | ✔ | — | ✔ radial | ✔ escudo/reflexão | — | — | — | ciclos telegraph/vulnerável; reflete projéteis |
| Brood | ✔ | ✔ | ✔ (enxame) | ✔ radial | — | — | — | — | **regeneração 1,2%/s** |
| Duelist | ✔ | ✔ | — | ✔ radial | — | — | ✔ (blink) | — | `slash` declarado mas só reduz telegraph (não é golpe próprio) |
| Colossus | ✔ | ✔ | — | ✔ (quake 300px) | — | — | — | — | **fases DORMENTE/DESPERTO** (redução de dano 60%) |
| Oracle | ✔ | ✔ | — | ✔ radial | — | ✔ **maldição −30% dano 6s** | — | — | — |
| Leech | ✔ | ✔ | ✔ (escolta) | ✔ radial | — | ✔ corrode | — | ✔ **dreno à distância** | — |

### Partes compartilhadas (1 blob)

- Todos os 8 minibosses têm **investida telegrafada + rajada radial + fase 2 a 50%** (a fase 2 dispara banner de "ARAUTO ENFURECIDO" para todos).
- A codebase trata `charge`/`burst` como código compartilhado e não distingue por skill; `SK.burst`/`SK.charge` **nunca são lidos pelo nome**.
- Summon genérico: `sk.summon || mb.id==='herald'` → herald e leech.
- `enemyHpTax`, `echoQueue.length`, dificuldade por onda.

### Contagens

- **Usam tiro (projétil radial): 8/8.**
- **Usam dash/investida: 8/8.**
- **Usam summon: 3** (herald, leech via escolta; brood via enxame).
- **Mecânica realmente exclusiva: 7** (fraturas herald; nova/trail furnace; escudo/reflexão sentinel; enxame+heal brood; quake+fases colossus; maldição oracle + blink duelist; dreno leech).
- **Mais semelhante aos demais:** todos são essencialmente variações numéricas do mesmo comportamento base; **furnace** é o que menos se destaca (só nova/trail); **duelist** tem identidade construída, mas `slash` não existe.
- **Mais diferente:** colossus (fases + quake) e sentinel (escudo/reflexão).

### Gaps de identidade

- `furnace.sk.burn` está declarado e **nunca é referenciado** (dead metadata).
- `duelist.sk.slash` só serve para encurtar o telegraph após o blink (não é um ataque próprio).
- `oracle.sk.burst` é redundante (burst já é compartilhado).
- `brood.sk.swarmSpawn` + `heal` servem bem (identidade relativamente clara).

---

## 10. Minibosses — visual

- Todos os minibosses são renderizados por `drawMiniBoss()`.
- Forma base: **octógono + aríete frontal + núcleo pulsante**, paleta **laranja fixa** (`#ff9d3c` casco, `#ffd166` placas, `#ffe9a8` núcleo), independente de `def.c`.
- `def.c` é usado apenas no **nome/HUD** do topo (`bossnm`, `bossfill`), não no corpo.
- Diferenças visuais reais:
  - Sentinel: anéis de escudo (ciano) e reflexão (azul).
  - Colossus: anel de fase dormente (roxo).
  - Herald: círculos de fratura (dourado).
  - Furnace/Brood/Duelist/Oracle/Leech: **nenhum** visual próprio além do nome/HUD.
- **Quantos usam exatamente o mesmo sprite?** Não há sprites externos; é renderização por código. Os 8 usam **o mesmo renderer** e a **mesma silhueta/paleta de corpo**. Nenhum usa "mesmo sprite", mas na prática são indistinguíveis sem ler o nome.
- **Quantos têm silhueta própria?** Nenhum (todos octógono+aríete).
- **Quantos têm animação própria?** Nenhum — só rotação de placas, pulso do núcleo e anéis de estado para 3 deles.
- **Distinguíveis sem ler o nome?** 3 parcialmente (sentinel/colossus/herald por anéis), os outros 5 **não**.
- **Assets não utilizados?** Não encontramos assets sprite externos; `build/` só tem ícones de app.
- **Assets históricos no Git?** A árvore contém `AUDITORIA_INIMIGOS_ECHO.md` e outros docs, mas nenhum `spritesheet` antigo no repositório (só canvas).
- **Infraestrutura para sprites diferentes?** Sim — `drawUnit` + `drawWeaponSprite` já diferencia personagens/armas; `drawEnemy` diferencia por `type`. **Trocar identidade visual dos minibosses pode ser feito no renderer atual**, sem novos assets.

---

## 11. O PARADOXO

- **Spawn:** `spawnWave(20)` → `spawnBoss()`.
- **HP:** `2200 + (echoQueue.length * 380)`; r=66; `dmg=34`; `spd=82`.
- **Fases:** 2. Fase 1→2 em 50% HP (`bossEnterPhase2`).
- **Mecânicas exclusivas:**
  - Feixes temporais rotativos (3 na fase 1, 4 na fase 2).
  - Espiral de projéteis (2 braços fase 1, 3 na fase 2).
  - `mode` adaptativo (ranged/melee) derivado de `analyzeEchoData()` a partir das **runs anteriores** (past Echos), não do Fracture Director:
    - `mode==='ranged'` → anéis de choque expansivos (anti-distância).
    - `mode==='melee'` → dash evasivo + campos gravitacionais (anti-agressão).
  - Fase 2: summons de **Ecos Sombrios** (usa builds dos Echos anteriores).
- **Visual próprio:** `drawBoss()` — hexágono + anéis contra-rotativos magenta/ciano, feixes, anéis de choque, campos gravitacionais. **Distinto dos minibosses.**
- **Relação com Fracture Director:** nenhuma direta; ondas 1–19 são moldadas pelo Diretor, mas o boss **não** lê Tema/Intensidade. O `mode` vem das runs passadas.
- **Relação com moralidade:** nenhuma direta encontrada no código do boss.
- **Respostas:**
  1. **Fases reais?** SIM (2 fases mecânicas).
  2. **Mecânicas exclusivas?** SIM (feixes, espiral, anéis/gravs, Ecos Sombrios).
  3. **Visualmente distinto?** SIM.
  4. **Mecanicamente distinto dos minibosses?** SIM muito.
  5. **Clímax suficiente?** Há identidade, mas o conteúdo adaptativo é **limitado a 2 modos** derivados de builds passadas; não reage à build atual nem à moralidade.
  6. **Partes apenas números maiores?** O sistema de fases tem números/frequências maiores, mas não é só isso.
  7. **Sistemas suportam rework posterior?** Sim — `mode`/`analyzeEchoData`, `fractureSignals`/Intensidade, `moral`, `echoQueue`, `itemState` e o renderer podem suportar adaptação sem arquitetura paralela.

---

## 12. Assets / renderização

- **Player:** `drawPlayer()` → `drawUnit()`.
- **Echo:** `drawEchoEntity()` → `drawUnit()` com paleta/estado derivado; estados visuais FRATURANDO/DISSONANTE/REINTEGRANDO.
- **Inimigos:** `drawEnemy()` com `switch(type)` (chaser/shooter/tank/etc.), auras de elite, sombras.
- **Minibosses:** `drawMiniBoss()` (partilhado).
- **O PARADOXO:** `drawBoss()`.
- **Projéteis/partículas/aneis:** canvas (`drawProjectile`, `spawnParticles`, `spawnRing`, `spawnShards`).
- **Armas:** `drawWeaponSprite(wi,s,accent,recoil)` por classe (`rifle`, `nozzle`, `tank`, `coil`, `disc`, `pod` etc.).
- **Spritesheets:** nenhum. **Assets externos do jogo:** nenhum (só ícone do app em `build/`).
- **Infraestrutura reutilizável:** `drawUnit` (humanoide parametrizado), `drawWeaponSprite`, `spawnRing/Shards/Particles`, `glowSprite`, `linGrad2`, `pushGhost`, desenhos de estado por `type`.
- **Boss Visual Identity futura pode ser feita no renderer atual**, com pouca ou nenhuma necessidade de assets externos.

---

## 13. Dependências entre pilares

| Pilares | Dependência | Risco para futuros blocos |
|---|---|---|
| Melee/Ranged Range → Itens | `range` é usado por `luneta`, `estilhaco`, `upgrades.range`, `upgrades.range2`, `forge` | B2 tocar em `range` afeta itens (B3). Renomear ids de modificadores quebra checkpoints antigos |
| Range → Save/Checkpoint | `rangeMul` salvo/carregado | B2 precisa de migração de save tolerante |
| Range → Sandbox/DEV/TAB | breakdown e tooltips | B2 precisa manter leitura compatível |
| Item Identity → Shop Variety | pool, pesos, raridade, locks | B3 alterar itens muda distribuição da loja |
| Shop Variety → Economy | preços, reroll, cadeado | B3 alterar preços muda simulação de renda |
| Economy → Greed → Attunement | `mEff.coinMul` + `MORAL_AFFINITY` | B4 reforço de sintonia muda economia |
| Boss Identity → Fracture themes | Diretor não afeta boss hoje (gaps) | B5 pode cruzar Tema/Intensidade |
| Echo Speech → Boss/banners/HUD | `echoReact` usa cooldown global; boss/miniboss falam | B2 mudar fila/prioridade pode alterar ordem de fala de B5 |
| Echo Speech → Equipamento/Rel/Moral | todos usam `echoSpeak` | B2 muda UX sem quebrar conteúdo |

---

## 14. Dívida técnica

| Dívida | Evidência | Impacto | Bloco afetado | Recomendação |
|---|---|---|---|---|
| `drawMiniBoss` compartilha corpo/paleta fixa | `drawMiniBoss` usa `#ff9d3c` fixo | Identidade visual baixa | B5 | Parametrizar paleta/silhueta por `mb` |
| `furnace.sk.burn` never executed | `updateMiniBoss` não lê `SK.burn` | Identidade declarada não funciona | B5 | Corrigir ou remover flag |
| `duelist.sk.slash` só reduz telegraph | única referência em `SK.slash` | Identidade do duelista incompleta | B5 | Implementar ou renomear |
| `forge` muta `WEAPONS[wi].range` diretamente | `index.html:8105` | Bypass do pipeline; efeito por arma não serializado corretamente | B2/B3 | Mover para modificador de arma/pipeline |
| `maxDist` hardcoded em projéteis não-arma | drones/aliados/split/miniboss/boss | Alcance não rastreado pelo pipeline | B2 | Se necessário, mover para pipeline |
| `ftexts` mistura fala+números sem fila/prioridade | `floatText`, `FTEXT_MAX` | Leitura de fala prejudicada | B2 | Separar canal de fala do feedback de dano |
| `rollShop` sem histórico | `rollShop` não consulta lojas passadas | Repetição de itens | B3 | Adicionar anti-repeat (B3) |
| `index.html` monólito (~27k linhas) | arquivo único | Testabilidade/refactor | todos | Extrair módulos aos poucos |
| Estado global extenso (`player`, `moral`, `mEff`, `wave`, `boss`) | código | Risco de acoplamento | B2–B6 | Encapsular por sistema |
| RNG global `Math.random` pouco controlável | `Math.random` no `randi`, `rollShop`, eventos | Simulações difíceis | B3/B6 | Injetar RNG nos sistemas de sorteio |
| `killEnemy` gigante, com responsabilidades múltiplas | `killEnemy` | Testes difíceis | B3/B6 | Extrair recompensas/logs |
| `updateBoss`/`updateMiniBoss` longos e ramificados | código | Editar fases é arriscado | B5 | Separar por skill |

---

## 15. Cobertura de testes

Relacionados relevantes existentes:
- **Echo speech:** `personality`, `relationship`, `fracture-director`, `legacy-restore`, `pr12`, `devmode` — cobrem seleção de texto/cooldown/anti-spam **no nível de função**, não cobrem duração/posição/fila/prioridade/collision visual.
- **Range/Pipeline:** `statmods`, `arsenal`, `sandbox`, `personality`, `events` — cobrem pipeline e algumas armas; **não** cobrem separação melee×ranged, alcance efetivo `min(speed*life, maxDist)`, nem os `maxDist` hardcoded.
- **Itens/loja:** `items-build-rework`, `morality`, `shield`, `operators`, `events`, `saveslots`, `legacy-restore`, `pr12` — cobrem módulos/hooks, mas **não** há teste de variedade/anti-repeat da loja nem de pool efetivo por onda.
- **Economia:** não há teste de simulação econômica; `morality` cobre algumas magnitudes de `mEff`.
- **Moralidade/Sintonia:** `morality`, `items-build-rework`, `fracture-director` — cobrem `applyMoralTuning`/mods, mas **não** a magnitude percebida nem a compatibilidade com "propriedade despertada".
- **Minibosses/boss:** `devmode`, `sandbox`, `fracture-director`, `legacy-restore` — há testes de spawn/estado/limites; **não** há matriz de abilities por miniboss nem teste de visual.

**Lacunas para B2–B6:**
- B2: teste de que `range` afeta melee e ranged igualmente; teste de leitura de fala visível por Xs.
- B3: teste de distribuição de loja por onda; teste de anti-repeat; teste de guardrail de "pode comprar tudo".
- B4: teste de magnitude efetiva da sintonia e de despertar futuro.
- B5: teste por habilidade de cada miniboss; teste de `furnace.burn`/`duelist.slash`; teste de identidade visual (silhueta/paleta).
- B6: reexecutar métricas acima como guardrails.

---

## 16. Recomendações B2

### Echo Speech
- Problema confirmado. Gravidade ALTA.
- **Causa:** 1,1s fixos + sem fila/prioridade + cooldown global único.
- Recomendação: criar fila curta (máx 1-2 mensagens) com prioridade (`boss`, `dissonance`, `miniboss`, `fracture_reveal` > `killStreak`, `relation`); tempo de leitura proporcional ao texto (ex.: 2,2–3,5s per linha); separar canal de fala do `ftexts` de dano; usar painel/HUD dedicado com largura, wrap e contraste. **Não implementar aqui.**

### Range
- Arquitetura atual: um único multiplicador aplicado a melee reach + beam + projétil maxDist.
- Separar é **seguro**? Sim, mas exige migrar consumidores de UI/itens/save.
- **Tamanho aproximado:** 3 consumidores de combate (fireMelee, fireBeam, fireWeaponFrom) + TAB/HUD/loja/tooltip/anel + upgrade/item ids + checkpoint; além de **decisão sobre projéteis hardcoded**. Estimativa média (~3–5 arquivos/sistemas), sem refactor de renderização.
- **Consumidores que precisam migrar:** todos os que usam `rangeMul`/`weaponRange` ligados a armas; itens/upgrades de alcance; `forge`; TAB; loja; HUD; anel de alcance; save (para `meleeRange`/`rangedRange` separados no checkpoint).

---

## 17. Recomendações B3

### Shop Variety
- Repetição confirmada (58% entre lojas consecutivas, early pool 10).
- **Causa:** pool pequeno + pesos de raridade + ausência de anti-repeat.
- Anti-repeat: **necessário** para upgrades (não há hoje). Sugerir histórico de 2-3 lojas (ou "recentemente visto não repete").
- Outros ajustes preferenciais: aumentar variabilidade dos comuns na loja; reavaliar peso de raridade por era; evitar que `range2`/`critx` dominem `range`/`crit` no early.

### Item Identity
- 19 upgrades; **auto-pick provável:** ~10 (os bônus universais); **fracos/redundantes:** `range` vs `range2`, `crit`+`critd` vs `critx`, `dmg` vs `dmg2`, `rate` vs `rate2`; sem trade-off real em upgrades.
- Prioridade: dar trade-off/identidade a `range`, `crit`, `dmg`, `rate` e aos lendários (hoje sem custo).

### Run Economy
- Dinheiro demais **confirmado** a partir de ~onda 5.
- **Quando:** mid-game em diante.
- **Por quê:** renda cresce + preços quase planos + poucos sinks.
- **Alavanca futura:** tornar preços de upgrades/módulos mais escalonados com a onda e/ou criar mais gastos; reduzir o teto de Ganância; rever `mEff.coinMul` × módulos econômicos.

---

## 18. Recomendações B4

- Sintonia é **mecânica** mas **pequena** e mal comunicada.
- Recomendação: comunicar o efeito real (ex.: tooltip "com seu perfil este módulo dá +X% créditos"); reforçar a magnitude ou transformar em propriedade despertada; manter recálculo derivado (não salvar os mods).
- **Arquitetura para propriedade despertada:** compatível com esforço moderado; extender `calcMoralTuningPlan`/`itemEmit` para efeitos não-stat (hooks despertados).

---

## 19. Recomendações B5

- **Similaridade mecânica:** alta (todos compartilham investida+rajada+fase 2); **similaridade visual:** alta (mesmo renderer/silhueta/paleta no corpo).
- **Maior rework:** furnace (falta `burn`), duelist (`slash` não existe), oracle (burst redundante) e os 5 sem visual próprio.
- **Boa identidade já:** colossus (fases), sentinel (escudo/reflexão), herald (fraturas), leech (dreno).
- **O PARADOXO:** já possui fases, mecânicas exclusivas e visual próprio; o rework deve focar em **adaptação** (não em identidade básica). Não precisa virar um miniboss.

---

## 20. Guardrails para B6

Métricas que devem ser repetidas antes/depois das mudanças:
1. **Loja:** pool efetivo por onda; % de repetição entre 2 lojas consecutivas (`< 35%` após B3); % chance de comprar tudo na onda 8+ (`< 60%` para perfil A).
2. **Economia:** créditos ao abrir loja por perfil e onda; razão Perfil C / Perfil A (`<= 4x` desejável); saldo residual médio.
3. **Fala:** % de falas importantes engolidas; tempo visível médio (mínimo 2,2s para linhas > 25 chars).
4. **Range:** confirmação de que `meleeRange` e `rangedRange` não interferem; testes de armas de referência (blade 104px, shotgun 245px, rail 1100px).
5. **Sintonia:** magnitude efetiva (bônus) por estado; teste de propriedade despertada (se B4 avançar).
6. **Minibosses:** cobertura de habilidade por miniboss; nenhum dead metadata (`burn`, `slash`).
7. **Boss:** fases, modos adaptativos, visual distinto; (em B5 atual, não implementar adaptação da PR16).
8. **Baseline:** `npm test` = 0 falhas (referência de sessão 274/0 na última suíte; soma real dos 18 arquivos 1 235 / 0).

---

## 21. Conclusões exigidas no §23 do enunciado

### ECHO SPEECH
- **Confirmado?** SIM.
- **Causa principal:** duração fixa 1,1s + ausência de fila/prioridade/preempção + cooldown global único de 8s, com texto no mesmo array de feedback de dano.

### RANGE
- **Hoje:** um único `range` multiplica melee reach, beam length e projétil maxDist.
- **Separar melee/ranged é seguro?** Sim, com migração.
- **Tamanho aproximado:** média (3 consumidores de combate + vários de UI/save/itens).

### ITEMS
- **Itens normais:** 19 upgrades.
- **Auto-pick prováveis:** ~10.
- **Fracos/redundantes:** `range`, `crit`/`critd`, `dmg`, `rate` + variantes (`range2`, `critx`, `dmg2`, `rate2`); preços não escalam.

### SHOP
- **Repetição confirmada?** SIM para upgrades (58% entre lojas consecutivas).
- **Causa principal:** pool efetivo pequeno (10 early) + pesos + sem anti-repeat.
- **10 mais frequentes (onda 16):** `aoe` 9,70%, `dash` 9,46%, `range2` 9,37%, `dmg` 9,31%, `range` 6,90%, `hp` 6,85%, `critd` 6,60%, `magnet` 6,57%, `crit` 6,55%, `rate` 6,44%.
- **10 menos frequentes (onda 16):** `omni` 0,22%, `singul` 0,24%, `rate2` 1,25%, `pierce2` 1,35%, `dmg2` 1,36%, `sprint` 4,17%, `vamp` 4,53%, `critx` 4,56%, `pierce` 4,57%, `rate` 6,44%.
- **Taxa de repetição:** 58,0% (≥1 upgrade repetido entre lojas consecutivas).

### ECONOMY
- **Dinheiro demais?** SIM a partir de ~onda 5.
- **Parte da run:** mid-game em diante.
- **Causa:** renda cresce, preços planos, poucos sinks.
- **Run comum termina possuindo:** Perfil A ~548 créditos ao fim (após compras + 1 reroll em onda 18/19).
- **Build econômica:** ~6 038 créditos (≈11× o saldo de A).

### SINTONIA
- **Possui efeito mecânico?** SIM.
- **O que faz:** adiciona modificadores `add` no Stat Modifier Pipeline (`dmgTaken`, `coinMul`, `damage`) com caps.
- **"Neutra" hoje:** é o estado de match `0.22–0.45`; nessa faixa `moralTuneFactor≈0`, isto é, **nenhum bônus derivado**.
- **Diferença real entre estados?** Sim, mas pequena e pouco comunicada.
- **Propriedade despertada compatível?** Sim, mas com refactor moderado (precisa estender o plano para além de stats).

### MINIBOSSES
- **Shoot:** 8/8.
- **Dash:** 8/8.
- **Summon:** 3 (herald, leech, brood).
- **Exclusivas:** herald (fraturas), furnace (nova+trail), sentinel (shield/reflexão), brood (swarm+heal), colossus (quake+fases), oracle (maldição), leech (dreno); **duelist tem only blink**; os 8 compartilham investida+rajada+fase 2.
- **Mais semelhante:** furnace (é o mais "genérico" com nova/trail); **mais diferente:** colossus e sentinel.

### VISUAL
- **Compartilham sprite?** Não há sprite externo; 8/8 usam o **mesmo renderer** e **mesma silhueta/paleta de corpo**.
- **Silhueta própria:** nenhum.
- **Infraestrutura:** existente — `drawUnit`, `drawEnemy` por tipo, `drawWeaponSprite`, partículas/aneis; dá para diferenciar no renderer sem assets.

### O PARADOXO
- **Fases:** SIM (2).
- **Identidade visual própria:** SIM.
- **Identidade mecânica própria:** SIM (feixes, espiral, anéis/gravs, Ecos Sombrios).
- **É apenas versão mais forte dos demais?** NÃO; é um design separado, com adaptação limitada a 2 modos derivados de runs passadas.

---

## 22. Escopo recomendado

- **B2:** Canal de fala (fila+prioridade+duração) e separação melee×ranged (com migração de UI/save/itens).
- **B3:** Anti-repeat + identidade/trade-off dos upgrades + reavaliar preços/sinks e teto de Ganância.
- **B4:** Comunicar e (possivelmente) ampliar sintonia; suportar propriedade despertada.
- **B5:** Diferenciar minibosses (renderer+skills), corrigir `burn`/`slash`, manter O PARADOXO como boss separado; **não** implementar adaptação (PR16).
- **B6:** Guardrails acima + reexecução das métricas.

---

## 23. B2 — implementação

Este bloco implementou somente **B2-A (Echo Speech UX)** e **B2-B (Melee × Ranged Range)**. Nada de B3+, economia, Sintonia, bosses ou versão.

### B2-A — achados corrigidos
- ❌ 1,1s fixos → ✅ `echoSpeechDuration(texto, prioridade)`, dinâmico (mín 1,6s, máx 5,0s; curta ~1,8–2,1s; longa/crítica ~3,3–4,5s).
- ❌ cooldown global único 8s → ✅ cooldown por prioridade (`LOW 8s · NORMAL 6s · HIGH 4s · CRITICAL 1,2s`) + anti-spam por frase; `_echoSpeakCd` ficou como alias de compatibilidade para telas/testes legados, mas **não bloqueia mais o fluxo real**.
- ❌ sem fila → ✅ fila curta (`ECHO_SPEECH_QUEUE_MAX = 3` aguardando + 1 ativa).
- ❌ sem prioridade → ✅ `LOW/NORMAL/HIGH/CRITICAL`; mapeamento em `ECHO_REACT_PRI` (Dissonância `CRITICAL`; miniboss/bossDeath/dissonanceEnd/trustLow/lowHp/shieldBreak `HIGH`).
- ❌ overwrite → ✅ preempção documentada: `CRITICAL` substitui qualquer; `HIGH` preempta `LOW`; `LOW/NORMAL` nunca apagam superior.
- ❌ mesmo array dos danos → ✅ `speechActive`/`speechQueue` + `speechRender()` separados de `ftexts`; `floatText` de dano intocado.
- ✅ limpeza em `resetRunWorld`, `clearRunEntities`, `sandboxClearRunState`, `openShop`, `openEvent`, `onPlayerDeath`; nenhuma persistência de estado visual de fala no Save/Continue.
- ✅ Sandbox/DEV: `DEV.forceSpeak(slot, priority)` com `speechClear()` antes; nada persiste.

### B2-B — decisões arquiteturais
- Novos stats no **mesmo Stat Modifier Pipeline**: `meleeRange` (→ `p.meleeRangeMul`) e `rangedRange` (→ `p.rangedRangeMul`).
- `range` legado permanece em `SM_STATS` apenas como compatibilidade (`p.rangeMul` para Echo replay/saves antigos); **não é mais consumido pelo combate do jogador**.
- `srcRangeMul(src,kind)`: jogador usa `meleeRange`/`rangedRange`; unidades legadas/Echo com apenas `rangeMul` usam fallback.
- `weaponRange`: melee usa `def.reach`; ranged/beam usa `def.range`.
- Migração de save antigo: `migrateLegacyRangeMods` clona `stat:'range'` para `meleeRange`+`rangedRange` no `Continue` (saves novos já gravam os 3 modificadores).
- Itens/upgrades migrados via `smRangeBoth` (mantém `range` legado + melee + ranged): `luneta`, `estilhaco`, `ESTABILIZADOR DE FASE`, `BOBINA DE LONGO CURSO`. Preços/raridades/descrições **inalterados**.
- Forja: quando tempera arma melee, também reduz `def.reach` (era base de alcance; mantém a semântica).
- **Armas:** 7 melee · 1 beam · 19 ranged; nenhuma híbrida. A classificação usa metadata existente `melee`/`beam` (não heurística por nome).
- **UI:** TAB mostra `ALCANCE C.A CORPO` e `ALCANCE LONGÍNQUO`; HUD/loja/anél de alcance usam `weaponRange` (tipo correto).
- **Echo:** continua usando `e.rangeMul` (fallback) — comportamento de alcance do Echo e `analyzeEchoData` **não** foram alterados.
- **Inimigos/boss/miniboss e AI detection:** **não** foram migrados para `meleeRange`/`rangedRange`; permanecem com distâncias próprias.

### Compatibilidade e regressões
- `SM_VERSION = 3` e `FRACTURE_STATE_VERSION = 1` **inalterados**.
- `npm test` final: 19 suítes · 0 falhas (18 legadas + PR13.5 B2). Soma dos contadores: **1 258 checks · 0 falhas** (1 235 baseline + 23 checks novos).
- Suítes relacionadas executadas **50×** sem falha: `pr13-5-b2`, `personality`, `relationship`, `statmods`, `devmode`, `fracture-director`, `arsenal`.
- Smoke visual/Electron não executado (ambiente de linha de comando; nenhuma GUI); cobertura funcional via harness real.

---

## 24. Limites de escopo

Este documento registra a auditoria B1 **e** a implementação B2 **e** a implementação B3 (seção 25). B3 **alterou** economia da run, variedade da loja e parte da identidade dos itens. **Não** alterou Sintonia, bosses, Fracture Director (além de compatibilidade), facções, versão, PR ou merge.

---

## 25. B3 — implementação (PR13.5 · Bloco 3)

O Bloco 3 foi executado na ordem obrigatória: **Shop Variety → Item Identity → Price pass → Economy pass → simulação final conjunta**. Detalhes, tabelas e métricas completas em `PR13_5_B3.md`.

### B3-A — Shop Variety (anti-repeat leve)
- Novo histórico run-scoped `shopRecent` (máx. 12 entradas, seq `shopRollSeq`).
- Item recente **não comprado**: último peso `0.42`, penúltimo `0.72`, depois normal; comprado nunca é penalizado; nenhum item é banido.
- `pickWeighted` e `pickWeightedMoral` passaram a receber um fator de repetição; armas usam `pickWeightedAny`.
- Reroll usa o mesmo histórico; Save/Continue grava `p.shopRecent`/`p.shopRollSeq` e restaura no resume (`smBuildCheckpoint`/`resumeRun`).
- Pool early: raros passam a desbloquear na **onda 3** (antes onda 4) — pool efetivo early passou de 10 para **14**; catálogo inteiro continua fechado no início.

### B3-B — Item Identity
- Range após B2:
  - `ESTABILIZADOR DE FASE`: simples, universal (`meleeRange`+`rangedRange`, +18%).
  - `BOBINA DE LONGO CURSO`: identidade ranged (`rangedRange`×1.32 + `projSpd`×1.14), não mexe no corpo a corpo.
  - `LUNETA DE VÁCUO`: ranged build (`rangedRange`×1.70, dano distante +30%, −18% cadência, −8% meleeRange).
  - `CÂMARA DE ESTILHAÇO`: close build (`rangedRange`×0.60, `meleeRange`×1.20, dano ×1.40, cadência ×1.15).
- Economia: módulos de crédito reduzidos e agora pagam **sobrepreço de mercado** (`shopSurcharge`).
- `su_sorte`: removida a promessa fantasma de “+12% de sorte”; descrição fiel ao efeito.
- Catálogo **não inflado**: mesmos 19 upgrades / 57 itens passivos.

### B3-C — Run Economy
- Entrada: abates usam `incomeCoinCap(mEff.coinMul × player.coinMul)` — soft cap (×2 intacto; só 8% do excedente vira crédito). Mini-chefe e cache usam o mesmo cap.
- Saída: `shopWaveMul` (+5%/onda, teto +100%) e `moralMarketMul` (mercado cobra da Ganância); reroll base cresce com a onda.
- Trade-off de Greed: mais créditos, mas loja mais cara (moral + surcharge dos módulos).
- Resultado: Perfil A tem fases de “não posso comprar tudo” (onda 18/20), Perfil B deixa de trivializar tudo no fim, Perfil C continua claramente mais rico (~3,5× a renda de A) mas com `canTotalPct` variando entre 0% e 100%, sem comprar tudo o tempo todo.

### Testes e simulações
- `npm test` final: **20 suítes · 0 falhas · 1277 checks** (1258 baseline B2 + 19 checks novos).
- Stress: **350 execuções** (7 suítes B3-relacionadas × 50) com **0 falhas**: `pr13-5-b3`, `statmods`, `items-build-rework`, `morality`, `pr13-5-b2`, `pr12`, `fracture-director`.
- Simulações: `audit_pr135/variety3.js` (anti-repeat sem/melhor compras e memória de reroll) e `audit_pr135/economy_sim.js` (perfis A/B/C, N=500, 20 ondas, compra agressiva + 1 reroll se couber).
- Smoke visual/Electron não executado (ambiente sem GUI); cobertura funcional via harness real.

---

## 25.1 Nota de metodologia — bug do baseline B1

O `economy_sim.js` do Bloco 1 aplicava `p.coinMul` (módulos econômicos) **antes** de `applyMoralTuning(p)`, que reseta esse campo. A renda dos perfis com módulos era subestimada e os "9× de renda / 11× de saldo" reportados para Greed vs Neutro estavam **errados**. Refazendo com a ordem correta sobre a árvore pré-B3 (`b6913e8`): renda C/A **19,1×**, saldo **62×**, CAN_ALL C = 100 %, A = 88 %. Os números do B1 não devem ser citados como baseline; os corrigidos estão em `PR13_5_B3_FIX.md §4.3`.

## 27. B3-FIX — fechamento dos achados

| Achado (§26) | Estado |
|---|---|
| Anti-repeat de armas inoperante (`o.id` em pool de índices) | corrigido · 15,9 % → 11,7 % (holdout) |
| `SHOP_RECENT_MAX=12` arbitrário | 32, derivado de 3 lotes bigShop; uso d0/d1/d2+ medido 50,7/31,6/17,7 % |
| Echo perde melee×ranged | snapshot + slim + `makeEcho` + echoEq; fallback legado; sem bump SM_VERSION |
| Auto-picks (`critx`,`dmg2`,`rate2`,`omni`) / `singul` sem custo | price pass individual (7/19 mudaram) |
| Greed compra menos que Neutro | `moralMarketMul` .18→.14, `shopSurcharge` teto 1,6; compras 1,01×, rerolls 1,06×, earned 2,85× |
| ESCASSEZ 7 fixo vs base 10+onda | desconto proporcional 0,70 com piso 7 |
| "LOJA +X%" | texto → "UPGRADES/MÓDULOS +X%" (efeito inalterado) |
| Sandbox stale `shopRecent` | limpo em `sandboxClearRunState` |
| Baseline B1 | §25.1 |

Testes: 21 suítes · 1 303 checks · 0 falhas. Detalhes e tabelas: `PR13_5_B3_FIX.md`.


# ECHO — Personalidade dos Ecos (PR 8)

> Documento de sistema. Idioma: pt-BR. Válido para `v0.6.6-alpha`.

---

## 1. Objetivo

Cada Echo passa a ter uma **personalidade derivada da run que o originou**.
O Echo deixa de ser apenas "uma cópia útil da run anterior" e passa a
"reconhecer **como** aquela pessoa jogava": duas runs diferentes com o mesmo
operador geram Ecos com identidade, fala e postura tática distintos.

A personalidade é uma **camada adicional leve**. Ela influencia:

- prioridade de alvo (viés pequeno sobre o score já existente);
- spacing (raio de órbita do modo companheiro);
- falas reativas (a VOZ do Eco);
- apresentação (tela de fratura, linha do tempo da vitória, Codex/Arquivo
  Ômega) e leitura do histórico da run.

Ela **não** substitui nem reescreve:

- **trust** (sistema de confiança, tiers, dissídio);
- papéis táticos **Guardião / Disruptor** (cooldowns, efeitos, potências);
- **Dissonância** (chance, duração 12s, trust floor 34, entrada/saída);
- **Ressonância / Micro-Ressonância** (janelas 0.5s/1.6s, cooldowns, sync);
- **dano bruto, cadência, vida ou balanceamento** de qualquer tipo.

Fronteiras deliberadas com PRs futuros:

| Camada | Descreve | Dono |
|---|---|---|
| Personalidade (PR 8) | **COMO** o jogador jogava (postura, hábitos de combate) | este sistema |
| Moralidade (PR 9) | **QUE** escolhas ele fazia (Compaixão/Ganância/Violência) | `moral`, `moralDom` — intocados |
| Relação (PR 10) | vínculo Player ↔ Echo (aprovação, lealdade, evolução) | futuro; o trust atual continua como está |

Moeda/`coins`/`moral.*` são sinais morais e são **explicitamente ignorados**
pelo scoring de personalidade.

---

## 2. Sinais usados (auditoria do que já existia)

Antes do PR, `runData` persistia: `dur, trail, dmgMul, frMul, wave, level,
crit, critMul, pierce, aoeMul, rangeMul, projSpdMul, longRangeBonus, coins,
items, upg, owned, moral, dom`. A `trail` é amostrada a cada **250 ms** com
`[t, x, y, act, aim, wi]` (`act`: 0 parado · 1 atirando · 2 dash).

O que faltava para descrever *estilo* era combativo (dano, acertos, HP
baixo). Foram adicionados **contadores O(1)** (`runSt`) sem nenhum cálculo
histórico por frame — apenas incrementos em eventos naturais + uma amostra
no tick de 250 ms que já existia:

| Sinal | Fonte | Novo? |
|---|---|---|
| `kills` da run | contador global, agora gravado em `runData.kills`/`k` | persistência nova |
| `dt` dano recebido | `damagePlayer` (`real`, antes do escudo) | novo |
| `dd` dano causado pelo jogador | `damageEnemy` (`curAttacker===player`, inclui DoT atribuído) | novo |
| `sh` projéteis disparados / `hi` acertos | `fireWeaponFrom` / `onProjectileHit` | novo |
| `ms` swings melee / `mh` alvos atingidos | `fireMelee` | novo |
| `dsh` dashes | `tryDash` | novo (a trail também vê act=2) |
| `lo`/`cr` amostras com HP ≤35% / ≤12% | amostragem 250 ms (`runStSample`) | novo |
| `mv`/`fv` atirando em movimento / parado | amostragem 250 ms | novo |
| `dS/dN` distância média ao inimigo mais próximo | amostragem 250 ms | novo |
| `ctl` status de controle aplicados (chill/stun) | `applyStatus` | novo |
| `kw` abates em alvos já fragilizados (≤35% HP) | `damageEnemy` | novo |
| `sb` quebras de escudo | `damagePlayer` | novo (uso: debug/lore futuro) |
| `mw/rw` tempo com arma corpo-a-corpo / distância | amostragem 250 ms | novo |
| `wave`, `dur`, `mh` (vida máx. final) | já existiam / 1 campo novo | — |

Nada foi instrumentado "para tudo": são 17 contadores simples num único
objeto plano.

---

## 3. Taxonomia final — 6 personalidades + 2 estados

Escolhida a partir dos sinais reais acima (nenhum critério depende de
informação que o jogo não coletem). Rótulos em pt-BR; IDs estáveis em inglês.

| id | Rótulo | Identidade (resumo) | spacing | viés de alvo |
|---|---|---|---|---|
| `aggressive` | AGRESSIVO | fecha a distância, troca golpes, resolve no corpo a corpo | 0.90 | `threat` (quem ataca o player + ameaça próxima sobem na prioridade) |
| `cautious` | CAUTELOSO | controla distância, evita risco, usa controle | 1.14 | `space` (de-prioriza multidão colada nele) |
| `precise` | PRECISO | precisão + kiting + eficiência, sem dano trocado | 1.08 | `thin` (prefere alvo isolado, longe do player) |
| `impulsive` | IMPULSIVO | age antes de calcular: dash na frente do perigo, vive no vermelho | 0.86 | `close` (pula no mais próximo) |
| `resilient` | RESILIENTE | aguenta o que mataria qualquer um; ondas longas no limite | 1.00 | nenhum |
| `opportunist` | OPORTUNISTA | caça o alvo ferido no momento certo; status + execução | 0.96 | `wounded` (alvo com ≤40% HP tem prioridade) |
| `versatile` | VERSÁTIL | sem dominância (empates/estilo misto) — comportamento = baseline atual | 1.00 | nenhum |
| `fragmented` | FRAGMENTADO | dados insuficientes — identidade estável não pode ser afirmada | 1.00 | nenhum |

Cada personalidade tem uma **descrição curta** única (`desc`), reutilizada na
fratura, no Codex e no Inspector. `versatile` mantém o comportamento
exatamente igual ao pré-PR 8 (baseline).

## 4. Traços secundários

Modelo: **1 personalidade + até 2 traços** (composição simples em vez de
dezenas de arquétipos). Traços são derivados dos mesmos sinais, com limiares
próprios, ordenados por força e desempate estável:

| id | Rótulo | Gatilho (sinal normalizado) |
|---|---|---|
| `butcher` | CARNICEIRO | killRate ≥ 0.55 |
| `brawler` | CORPO A CORPO | closeShare ≥ 0.55 |
| `marksman` | ATIRADOR | (1−closeShare)·.45 + acc·.55 ≥ 0.5 (requer ≥8 tiros) |
| `kiter` | DANÇARINO | kite ≥ 0.55 (≥16 amostras atirando) |
| `controller` | CONTROLADOR | ctlRate ≥ 0.35 |
| `swift` | RELÂMPAGO | dashRate ≥ 0.45 |
| `survivor` | SOBREVIVENTE | lowHp ≥ 0.18 (+critHp pesado) |
| `reckless` | IMPRUDENTE | takenRate·0.7 + critHp·0.8 ≥ 0.35 |

---

## 5. Fórmula de scoring

Tudo é **proporção/taxa por minuto** — nenhum total bruto entra na conta.
Sinais 0..1 (normalização na tabela abaixo), pesos somam 1.00 por
personalidade (`scorePersonalities`):

```
aggressive  = .32·closeShare + .22·killRate + .18·lowHp + .14·takenRate + .14·(1−rangePref)
cautious    = .30·rangePref + .24·(1−takenRate) + .18·ctlRate + .14·(1−lowHp) + .14·eff
precise     = .38·acc + .24·kite + .20·(1−takenRate) + .18·eff
impulsive   = .30·dashRate + .24·takenRate + .24·critHp + .22·killRate
resilient   = .32·waveProg + .24·lowHp + .22·takenRate + .22·durNorm
opportunist = .34·weakKill + .24·killRate + .22·ctlRate + .20·acc
```

## 6. Normalização

Com `dur` em segundos, `mins = max(0.2, dur/60)` e `s` = nº de amostras 250 ms:

| sinal | definição | teto da escala |
|---|---|---|
| closeShare | `mw/(mw+rw)` | — (fração) |
| rangePref | `clamp((avgDist−140)/220)` | 360 px |
| killRate | `kills/(mins·26)` | 26 kills/min |
| takenRate | `(dt/maxHp)/(mins·1.6)` | 1.6 vidas/min |
| lowHp / critHp | `lo/s` · `cr/s` | fração de tempo |
| dashRate | `dsh/(mins·20)` | 20 dashes/min |
| acc | `hi/sh` (só com `sh≥8`; senão 0.4 neutro) | — |
| ctlRate | `ctl/(mins·8)` | 8 controles/min |
| kite | `mv/(mv+fv)` (só com ≥16 amostras atirando; senão 0.5) | — |
| eff | `(dd/max(60,dt))/3` | 3× trocado a favor |
| weakKill | `kw/max(4,kills)` | — |
| waveProg | `wave/20` | — |
| durNorm | `dur/780` | ~13 min |

Uma run de 2 min e uma de 20 min com o **mesmo estilo proporcional** produzem
o mesmo veredicto (testado). 100 kills numa run longa não vale mais que 10
kills/min numa run curta — `killRate` é taxa.

## 7. Run curta, fallback e confiança

- **Insuficiência** (fallback `fragmented`): `dur < 20s` **ou** `amostras < 16`
  **ou** (`kills < 2` e `dano causado < 250`). Eco legado (sem contadores):
  exige `dur ≥ 45s` e `trail ≥ 60` amostras.
- **Suficiência**: `suff = .42·clamp(dur/120) + .24·clamp(amostras/240) +
  .34·clamp(max(kills, dd/220)/12)`.
- **Confidence**: `conf = clamp(suff · (0.5 + 0.5·sep))`, onde
  `sep = (topo − 2º)/max(0.22, topo)`. Para `fragmented`,
  `conf ≤ 0.45·suff`. Eco legado: `conf` é **limitado a 0.40** — a
  classificação legada é sempre uma hipótese fraca, nunca uma afirmação.
- O `confidence` **não aparece para o jogador**; controla apenas a força com
  que a identidade é usada (hoje: exibição descritiva e desempates futuros).

## 8. Empates (determinísticos — sem RNG)

1. Dados insuficientes → `fragmented`.
2. `topo < 0.24` → `versatile` (nenhuma dominância real).
3. `topo − 2º < máx(0.03, 7%·topo)` → `versatile` (estilo genuinamente
   misto: os sinais se contradizem).
4. Empate numérico exato → desempate pela ordem fixa
   `PERS_ORDER = aggressive, cautious, precise, impulsive, resilient,
   opportunist` (ordenação estável; sempre a mesma saída para a mesma entrada).

`Math.random()` **não** participa de nenhuma etapa de classificação. O RNG é
usado apenas — como já era antes — para escolher *qual* fala equivalente dize
num evento.

## 9. Save schema do Echo

Registro do slot (`echoSave.v3 → slots[n].echoes[i]`) ganha três campos
aditivos (recordes antigos continuam válidos; o schema do save global **não**
mudou):

```jsonc
{ "v": 2, "dur": 604.25, "trail": [ /* … */ ],
  "k": 312,                                   // kills da run
  "mh": 138,                                  // vida máx. final (normaliza dano recebido)
  "st": { "s":2416,"mw":2300,"rw":116, "…":0 }, // contadores arredondados (2 casas)
  "ps": { "id":"aggressive", "tr":["brawler","butcher"],
          "c":0.565, "s":{"aggressive":0.942, "…":0}, "v":1 }
}
```

Compacto por construção: `ps` ≈ 100–200 bytes; `st` são ~17 números inteiros.
Nada de logs gigantes — o replay continua sendo a `trail`, como sempre.

## 10. Migração de Ecos antigos (Alpha / slots existentes)

Ao carregar (`loadEchoes()` e `activateSlot()`) cada registro sem `ps` passa
por `ensureEchoPersonality(rec)`:

- Se houver `st` (eco novo) → pipeline completo.
- Se só houver `trail/dur/wave` (eco legado) → modo **parcial**: closeShare e
  dashRate vêm da trail; os sinais cegos viram neutros (≈0.5); o resultado é
  no máximo uma identidade suave, com `conf ≤ 0.40`; se a trail for curta →
  `fragmented`.
- A migração acontece **em memória, sobre clones**: o `echoSave.v3` em disco
  permanece byte-identical até o próximo fluxo normal de save. Nada é apagado,
  nada é duplicado, e o `trust` não vive no registro (é runtime + checkpoint),
  portanto não é tocado.

## 11. Geração e imutabilidade

A personalidade é calculada **uma única vez**, na consolidação do fim da run:

```
RUN → runSt (contadores) → fim (onPlayerDeath)
    → runData.kills/mh/st  →  deriveEchoPersonality(runData)
    → runData.ps           →  saveEchoes (slim com k/mh/st/ps)
```

- `makeEcho` apenas **resolve** `data.ps → e.pers` (lookup na tabela). Não há
  recálculo durante a run, nem por Dissonância, nem por trust, nem por
  save/load (o `ps` salvo é reutilizado sem recomputar).
- Após o nascimento, `e.pers` **não evolui** neste PR (estados temporários
  futuros pertencem a PR 10). Forçar via DEV é runtime puro (`e.persDev=1`),
  nunca grava.
- Regra atual de geração preservada: **morte** (e `abortRun`) gera Echo;
  **vitória** não gera (a run vencedora "ascende") — mas seu registro
  comportamental é lido e exibido na tela de vitória, sem ser persistido.

## 12. Continue Run (PR 7.5) e Nova Run

- `smBuildCheckpoint()` inclui `st: runStSnapshot()`; `resumeRun()` chama
  `runStRestore(cp.st)` logo após o reset do mundo. O comportamento ANTES e
  DEPOIS do checkpoint compõe a classificação final (testado).
- `resetRunWorld()` (usado por `startRun`) chama `runStReset()`: **Nova Run**
  começa com métricas zeradas.
- Checkpoints antigos (pré-PR 8) sem `st` apenas iniciam os contadores do
  zero no resume — nada quebra.

## 13. Integração com roles, Dissonância e Ressonância

- **Guardião/Disruptor**: `echoRoleTick` é intocado. O efeito da
  personalidade nos papéis é apenas indireto (o Eco pode estar alguns px mais
  perto/longe ao manter a órbita; o Guardião agressivo orbita o player um
  pouco mais fechado). Cooldowns (7.5s/9s), potências, `shieldPot`, pulso,
  chill/corrode e o gate de trust permanecem idênticos para todas as
  personalidades (testado para as 8 ids × 2 slots).
- **Dissonância**: chance, duração (12s), trust floor (34), entrada e saída
  inalteradas. A personalidade só pode emprestar a FALA (pool `dissonance*`
  genérico permanece; durante o estado hostil o replay do fantasma não muda).
- **Ressonância/Micro**: janelas, cooldowns, sync tracking e +3 trust
  intocados; as funções `triggerResonance`/`updateResonance` não fazem
  referência à personalidade (verificado por teste estrutural).
- **Personalidade ≠ Papel**: o mesmo Guardião pode ser CAUTELOSO ou AGRESSIVO;
  `role` e `pers` são eixos independentes (`e.slot` decide o papel; `e.pers`
  decide a postura).

## 14. Comportamento em combate (limites)

Dois — e apenas dois — pontos de influência, ambos determinísticos e
estruturalmente limitados:

1. **Spacing**: raio de órbita do modo companheiro multiplicado por
   `pers.spacing ∈ [0.86, 1.14]`. A trilha gravada (replay) e o estado hostil
   não são alterados.
2. **Target bias**: no score de alvo já existente, um multiplicador
   `persBiasMul` clampado em **[0.55, 1.6]**:

| bias | regra |
|---|---|
| `threat` | `×0.78` se o inimigo mira o player · `×0.85` se a <190 px |
| `close`  | `×0.70` se a <170 px |
| `space`  | `×1.35` se a <150 px (afasta-se da turba) |
| `thin`   | `×0.82` se o alvo está isolado (>260 px do player) |
| `wounded`| `×0.62` se o alvo está com ≤40% HP |

Menor score = mais desejado (convenção existente). O `range` de busca é duro:
nenhum viés pode tirar o alvo do range nem deixar o Eco sem alvo se houver
inimigo válido. Regras de confiança (emboscada tier-2, deserção tier-0) e
prioridade de boss/miniboss permanecem donas do resultado quando se aplicam.

**Balanceamento**: nenhum modificador de stat. `ECHO_MUL`, `ECHO_RATE`,
`ECHO_HP`, `ECHO_SHIELD*`, `ECHO_DMG_CAP` e a fórmula de `e.mul` são
intocados — teste de equivalência garante `mul/hp/crit/shield/roleCd`
idênticos com ou sem personalidade. Se um futuro PR quiser modifier leve, o
caminho é o Stat Pipeline (PR 7), jamais `echo.damage *=`.

## 15. Diálogos

Matriz escalável (sem if gigante): cada `PERSONALITIES[pid].lines` traz pools
por evento (`lowHp`, `shieldBreak`, `killStreak`, `resonance`, `miniboss`).

```
echoReact(evento)
  → gate global existente (_echoSpeakCd 8s + 35% por evento)
  → escolha o Eco que fala (como antes)
  → persLineFor(e, event)  ? fala da personalidade
  : ECHO_LINES[event]       ? pool genérico (fallback)
```

Eventos ligados (todos já existiam como pool em `ECHO_LINES`; PR 8 os
conecta a ganchos naturais, sem listener novo pesado):

| evento | gancho |
|---|---|
| `waveStart` / `resonance` / `miniboss` / `dissonance` / `dissonanceEnd` / `bossDeath` | já disparavam antes |
| `playerHurt` | `damagePlayer` com golpe ≥12% da vida máx. |
| `lowHp` | `damagePlayer` quando HP ≤25% |
| `shieldBreak` | `damagePlayer` quando o escudo racha |
| `killStreak` | `killEnemy` a cada 12 abates na onda (jogador) |

O cooldown global/por-evento é o **mesmo** (8s · 35%): a personalidade troca
o TEXTO, nunca aumenta a frequência de fala. Echo sem `ps` (ou evento sem
pool na personalidade) cai no pool genérico antigo — retrocompatível.

## 16. Apresentação (menu / fratura / vitória / Codex)

- **Tela de fratura** (`showFracture`): linha `REGISTRO COMPORTAMENTAL:
  <personalidade> · TRAÇOS: … — <descrição>` para a run recém-assimilada;
  cada Echo rebaixado exibe `· <LABEL>` junto da confiança.
- **Vitória** (`showVictory`): a linha do tempo menciona a personalidade de
  cada Echo e o registro comportamental da run vencedora (não persistido).
- **Codex → ARQUIVO ÔMEGA**: bloco "ECOS DESTA MEMÓRIA · REGISTRO
  COMPORTAMENTAL" lista, por Echo do slot ativo, `PERSONALIDADE`, `TRAÇOS
  OBSERVADOS` e a descrição curta — leitura técnica, sem invadir lore.
- **HUD**: intencionalmente **não** poluído (chips permanecem como são).
- **Visual**: rótulo + cor por personalidade; nenhum asset novo.

## 17. DEV MODE — Personality Inspector

Seção `ECHO PERSONALITY` no painel (só com DEV_MODE):

```
PERSONALIDADE PREVISTA        AGRESSIVO — 0.72
DADOS                         2416 amostras · 604s
aggressive 0.942 / cautious 0.093 / precise 0.347
impulsive  0.820 / resilient 0.569 / opportunist 0.320
TRAÇOS                        CORPO A CORPO · CARNICEIRO
ECHO·01 (SALVO / EM CAMPO)    …
```

- `PREVIEW → LOG` despeja o JSON completo (id, conf, sep, scores, traits).
- `select` + `FORÇAR · ECHO 01/02`: substitui a identidade no runtime do
  Echo em campo (para testar spacing/fala) sem tocar o save; `AUTO (DA RUN)`
  restaura a identidade legítima.
- `ECHO·0X DEV c/ PERS`: gera Echo de teste sintético com a personalidade
  escolhida (pid inválido → Echo base).
- O HUD de debug `toggleInfo` passa a mostrar `[AGGR]`/`[CAUT]`… por Echo e
  a linha `PERS PREV` com a classificação ao vivo.

Proteções: qualquer ferramenta de escrita faz `devTaint()`; `saveEchoes()`
ignora a run contaminada e registros `.dev`; `loadEchoes()` descarta dev —
**run tainted não gera Echo legítimo** e a força de DEV nunca vaza pro save.

---

## 18. Como estender

### Adicionar uma nova personalidade
1. Sinal: prefira sinais que já existem em `runSt`; se precisar de um novo,
   incrementá-lo custa 1 linha (ver §2) e 1 chave no snapshot.
2. Adicione a entrada em `PERSONALITIES` (`id, lab, short, col, desc,
   spacing ∈ [0.86,1.14], bias ∈ [null|threat|close|space|thin|wounded],
   lines{…}`) e o id em `PERS_ORDER`.
3. Adicione a fórmula em `scorePersonalities` (pesos devem somar 1.00 e usar
   só sinais normalizados).
4. Testes: pelo menos um cenário sintético A/B-style no bloco de
   classificação de `tests/personality.test.js`, mais o teste de tabela
   "sem modificadores de stat" (que precisa continuar passando).
5. Nunca introduza dano/cadência/vida; se for indispensável, use uma
   `smAdd(echo, …)` com o menor valor possível — fora deste PR.

### Adicionar um novo sinal
1. Chave nova em `runStReset()` (números apenas; o snapshot/restore é
   genérico por `for…in` e o checkpoint/`st` salvo acompanham sozinhos).
2. Incremento no evento natural (1 linha, O(1)) — nunca em loop por frame.
3. Consuma-a em `buildPersonalityMetrics` (normalize!) e adicione ao
   `scorePersonalities`/traits do pid relevante.
4. Echo legados não terão a chave — o caminho `legacy` já preenche neutros;
   confirme que a ausência dela não vira sinal falso (use `st.x|0`).

### Adicionar um evento de fala
Acrescente o pool em `ECHO_LINES[event]` (genérico, para todos) e opcionalmente
em `PERSONALITIES[pid].lines[event]`; dispare `echoReact('event')` no gancho
natural. O gate global já cuida do spam.

---

## 19. Testes (`tests/personality.test.js` — 47 casos)

Classificação A–E · determinismo (100× + RNG invertido + varredura por RNG no
código) · normalização 2min×20min · traços · save/reload round-trip +
tamanho do payload · migração (sem regravação, sem duplicação, trust
intocado) · isolamento por slot · checkpoint `st` (resume soma antes+depois;
Nova Run zera) · 8 personalidades × Guardião e Disruptor · equivalência de
balanceamento · limites de bias · Dissonância/Resonance imutáveis · diálogo
(pool certo por evento, fallback, cooldown) · DEV (preview, força sem
contaminação, gate DEV_MODE, spawnEcho com pid).

## 20. Limitações conhecidas (e dívidas assumidas)

1. **A `trail` não sobrevive ao checkpoint** (limitação pré-existente do
   replay de movimento). As métricas de personalidade, sim. Um Eco gerado após
   resume tem replay "curto", mas personalidade completa.
2. **Feixe (beam) não entra na precisão**: contá-lo por tick inflaria o sinal;
   `acc` usa projéteis. Armas de feixe pesam menos em `precise` — aceitável
   para um sinal auxiliar.
3. `sb` (quebras de escudo) é coletado mas ainda não pontua — reservado para
   leitura moral/futura (PR 9/10) e ao Inspector.
4. Ecos legados migram com `conf ≤ 0.40` e sem traços derivados de sinais que
   nunca existiram (ex.: `kiter`) — intencional: não se inventa o passado.
5. A classificação usa `mh` (vida máxima final) para `takenRate`; operators
   tanques são levemente favorecidos em `resilient/cautious`. Normalizar por
   operador (baseline por personagem) é melhoria natural para o PR 9 — não
   implementada para não acoplar personalidade a stats de personagem.
6. `versatile` por empate pode mascarar "run monótona" (pouca variabilidade):
   com poucos sinais a separação é mesmo baixa — o confidence reflete isso.
7. Personalidade não altera prioridade de BOSS/MINIBOSS nem a IA inimiga;
   adaptação do chefe (`analyzeEchoData`) continua lendo a trail diretamente
   (comportamento original intacto).

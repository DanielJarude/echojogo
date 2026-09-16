# PR15.5-FINAL — Auditoria e fechamento do Visual Overhaul

**Data da auditoria:** 2026-09-16 (UTC)
**Repositório:** `DanielJarude/echojogo`
**Branch de trabalho:** `arena/01a0aaf3-echojogo`
**Branch permanente auditada:** `dev/pr15-5-visual-overhaul`

> **Escopo:** auditoria de integração. Nenhuma arma, partícula, mecânica,
balanceamento ou UX foi redesenhado nesta etapa. A única implementação nova
é a suíte de integração consolidada descrita no §42. `index.html` não foi
alterado.

## 1. Base final e pre-flight

- SHA base exigido: **`e89885bbe3594f4fadf0435b3648f97e28f50a5a`**.
- Mensagem: `PR15.5-E9: criar gramática visual de impactos`.
- Parent do SHA base: `6f532f72ed1680a68704e85f43b593e204081422`.
- O `HEAD` inicial da sessão foi exatamente o SHA acima.
- `git status --short --branch` inicial: branch `arena/01a0aaf3-echojogo`,
  working tree limpo.
- O checkout era shallow (`true`). Foi executado `git fetch --unshallow
  origin`; depois disso `git rev-parse --is-shallow-repository` retornou
  `false`.
- A verificação pós-fetch confirmou `HEAD == e89885b...` e working tree limpo.
- O remoto permanente, consultado durante a auditoria, apontou
  `dev/pr15-5-visual-overhaul -> e89885bbe3594f4fadf0435b3648f97e28f50a5a`.

### Baseline obrigatória

Executado antes de qualquer alteração:

```text
npm test
SUÍTES: 69 · COM FALHA: 0 · CHECKS ✔: 4602 · FALHAS ✘: 0
TODAS AS SUÍTES PASSARAM
```

A baseline pós-E9 foi reproduzida sem divergência.

## 2. História real da branch

A sequência abaixo foi reconstruída por `git log`, `git show --stat`,
proveniência dos documentos `PR15_5_*` e das suítes `tests/pr15-5-*`. A
numeração E não é a ordem de integração.

| ordem real | commit | bloco | efeito auditado |
|---:|---|---|---|
| 1 | `ea1a1b93b2d713f2dd76701c38d8d93976f23098` | PR15.5-A | fundação visual |
| 2 | `91e0cd3cd0c6155d1c7b43da73bf9bacf8a69dc0` | A-FIX1 | custo visual no idle |
| 3 | `af67fbea9e9d76f7402727135160c2004e01acbc` | B | legibilidade de inimigos |
| 4 | `6f81af1c9a8aa7bc1149d6127f9d94d2a954d7f1` | B-FIX1 | sinais inimigos baratos |
| 5 | `b4654f191a16214712bd35501c1b242b1b1cbca2` | B-FIX2 | métricas persistentes |
| 6 | `4f56b76aa82d0e65323215dfa2ad31dedfb66925` | performance audit 1 | instrumentação/overlays |
| 7 | `5d8e244c22b1a505c1cd25c4149497f91c83871a` | D | arsenal melee |
| 8 | `f2a602a7d4f814ed50347068f541ac32b4d15f5f` | C | hurt/death |
| — | `91c4f562f4e599b1f4d8bcc24657e86378b13dc1`, `c59ebb643f38623b332ea59b649d99082329918e`, `e7b33a58df389f6f95114ecb054e62407a27ad2d`, `9e18a38514621015806029340aab10ea83844dd4`, `6f57dab158e017893dabeffca9489aa4df7ea760`, `2551404` | PR15.6/PR15.7 presentes entre C/D e E | dependências contemporâneas; não são novos blocos do Visual Overhaul |
| 9 | `c15e31754689bc541ab6c639e2cb02f743e1b10e` | **E0** | renderer determinístico |
| 10 | `2028e2147420149435862b6faed06eb964cb7745` | **E1** | tabela/famílias/dispatcher |
| 11 | `9f992c0d3f7faa5c04c7fd6dd370be6df714b8dd` | **E2** | identidade temporal |
| 12 | `385301ec9e3fc4099305bf6e7193d5d46b8f4de0` | **E3** | slug/penetradores |
| 13 | `e92dcc509b11398e3e1c35c67f24d20929a9cceb` | **E8** | muzzle/emissão |
| 14 | `23f1dfe302ccda2cee7347d90bffd60d402b5a05` | **E4** | swarm/múltiplos |
| 15 | `81b0076aab7931d0c8955ec05895589887888ca0` | **E10** | cinético/retorno |
| 16 | `5b8df0c91a05c725ba9578d085a9d634176f594c` | **E5** | energia/massa |
| 17 | `80b1349db55c615927f2c5905f5fe2a36a67d61f` | **E6** | fluido/spray |
| 18 | `6f532f72ed1680a68704e85f43b593e204081422` | **E7** | condução/status |
| 19 | `e89885bbe3594f4fadf0435b3648f97e28f50a5a` | **E9** | impacto |

A história E real é, portanto, **E0 → E1 → E2 → E3 → E8 → E4 → E10 → E5 →
E6 → E7 → E9**. Não houve E11 no HEAD.

## 3. Inventário final

O código atual confirma **27 armas**:

- **20 ranged:** 19 que criam entidades em `projectiles` e 1 sustentada.
- **19 projéteis:** `plasma`, `shotgun`, `orb`, `flamer`, `rail`, `smg`,
  `cryo`, `tesla`, `acid`, `nail`, `boomer`, `homing`, `mine`, `sniper`,
  `void`, `ricochet`, `gatling`, `prism`, `plague`.
- **Sustentada:** `beam`, com `beam:true`, `speed:0`, sem entidade de
  projétil.
- **7 melee:** `blade`, `scythe`, `hammer`, `katana`, `chains`, `gaunt`,
  `glaive`.

Além do arsenal do jogador:

- `eorb` é o tipo comum dos projéteis de inimigo, miniboss e boss; suas
  criações continuam com `team:'enemy'` e `srcC` próprio.
- Ataques de boss/miniboss continuam no pipeline inimigo e não são
  classificados por `PROJ_FAMILY`.
- Projéteis inimigos continuam no ramo `team !== 'ally'` de
  `updateProjectiles`; a exceção consciente é o refletido pelo dash, que
  vira um projétil aliado de gameplay existente, não um novo tipo visual.

## 4. Matriz visual final por arma ranged

**Legenda de custo:** `M` = partículas de muzzle; `I` = partículas no impacto
linear; `P/A` = paths/arcs do desenho de voo no Canvas mock, incluindo o halo
compartilhado (`drawImage` não aparece em P/A); `O105` = `explodeOrb` real,
`M120` = `detonateSpecial` real. Os números M/I foram medidos chamando os
helpers atuais com `cfg.parts=1`. “Echo” significa o pipeline comum; “Replay”
só é elegível quando a whitelist real de Repetição permite.

| ID | família | disparo real | M | forma em voo; custo P/A | camada temporal | impacto/efeito visual | mecânica especial/status real | histórico | Echo | Replay | fallback |
|---|---|---:|---:|---|---|---|---|---|---|---|---|
| `plasma` | ENERGY | 1 | 3 | envelope hexagonal + núcleo; 2/0 | Echo/replay comum | I=2, rebound | — | — | sim | sim | não |
| `shotgun` | SWARM | 7 pellets | 6 | pellet irregular de 5 vértices; 1/0 | comum | I=1 por pellet | `count:7`, spread real | — | sim | sim | não |
| `orb` | ENERGY | 1 | 3 | massa circular + anel; 2/2 | comum | `O105`, não recebe I linear | AoE 105, slow 1.4 s | `explodeOrb`, ring, shards, shake | sim | não | não |
| `flamer` | FLUID | 1 | 2 | língua com garfo traseiro; 1/0 | comum | I=1 | burn 3.2 s, 9 dps, stack ×6 | sem poça/nuvem | sim | não | não |
| `rail` | SLUG | 1 | 4 | cabeça/streak + núcleo; 2/0 | comum | I=4 (3 frontal + 1 cross) | `basePierce:99` | perfuração existente | sim | sim | não |
| `smg` | SWARM | 1 | 1 | microcápsula fechada; 1/0 | comum | I=1 | cadência .065, `count:1` | — | sim | não | não |
| `cryo` | ENERGY | 1 | 3 | cristal facetado + farpas; 2/0 | comum | I=2 | chill 2.6 s, acumula/congela | ring apenas ao congelar real | sim | não | não |
| `tesla` | CONDUCT | 1 | 2 | zigue-zague entre terminais; 2/0 | comum | I=2 + arcs históricos do chain | chain 2, raio 230, ×.78 | arcs + `CADEIA`; shock é marcador | sim | não | não |
| `acid` | FLUID | 2 | 2 | glóbulo + satélite; 2/0 | comum | I=1 por impacto | corrode 4.5 s, +.12/stack, cap .60 | sem poça/AoE | sim | não | não |
| `nail` | SLUG | 1 | 2 | haste/ponta/cauda em V; 1/0 | comum | I=2 | bleed real | — | sim | não | não |
| `boomer` | KINETIC | 1 | 3 | disco/corpo + eixo; 2/0 | comum | I=2 na ida/perfuração | retorna, `basePierce:99` | recolhimento sem impacto falso | sim | não | não |
| `homing` | SWARM | 3 | 3 | ogiva + 2 estabilizadores; 2/0 | comum | I=2 | homing 230 real | — | sim | não | não |
| `mine` | KINETIC | 1 | 2 | casco + juntas; 2/0 | comum | `M120`, não I linear | arma `.45`, trigger 110, AoE 120 | ring, 16 parts, 10 shards | sim | não | não |
| `sniper` | SLUG | 1 | 2 | haste fina + ponta/marcas; 2/0 | comum | I=2 | farBonus +85% acima de 450 | — | sim | sim | não |
| `void` | ENERGY | 1 | 3 | casco interrompido/vazio; 2/0 | comum | I=3, localizado | dano direto; `implode`/`aoe` mortos | nenhum ring/sucção falsa | sim | não | não |
| `ricochet` | KINETIC | 1 | 2 | peça refletora; 1/0 | comum | I=2; parede=3 | bounce 3, dano ×1.15 por bounce | feedback direcional determinístico | sim | não | não |
| `gatling` | KINETIC | 1 | 1 | cápsula rotativa barata; 1/0 | comum | I=1 | spin-up, cadência alta | — | sim | não | não |
| `prism` | SWARM | 3 | 3 | duas facetas + aresta; 3/0 | comum | I=2 | divide em 2 fragmentos reais | split existente | sim | não | não |
| `plague` | CONDUCT | 1 | 3 | cápsula lobulada + 3 espinhos; 2/0 | comum | I=2, localizado | corrode 5 s/.10 no alvo | sem nuvem/contágio/AoE | sim | não | não |

Todos os 19 estão em exatamente uma chave de `PROJ_FAMILY`; todos têm
`fallback = não`. O fallback só existe para tipos fora da tabela. Echo não
possui helper de desenho próprio. A Repetição usa o pipeline comum apenas
para as quatro armas presentes em `TEMPORAL_ACTION_WEAPONS`: `plasma`,
`shotgun`, `rail`, `sniper`.

## 5. Dispatcher e fallback

A ordem efetiva de `drawProjectile` é:

```text
drawProjectileGlow
→ fade/alpha
→ eorb → ENERGY → FLUID → SLUG → SWARM → KINETIC → CONDUCT → legacy
→ drawProjectileTemporalLayer, se houver
→ globalAlpha=1
```

Constatações:

- `eorb` é avaliado antes das famílias do jogador e continua usando a forma
  histórica de orb.
- Beam não chega ao dispatcher: `fireWeaponFrom` chama `fireBeam` antes de
  qualquer criação de projectile.
- As 19 armas têm classificação não-legacy e helper não-legacy.
- `drawProjectileLegacyLine` permanece no último ramo para tipo futuro,
  desconhecido ou objeto válido sem família.
- `visualFamilyForProjectile(null/undefined/{})` retorna `PVF_LEGACY` sem
  lançar. Como no renderer histórico anterior, `drawProjectile` pressupõe
  um registro de projétil válido; o loop de produção nunca envia `null`.
  A classificação defensiva está coberta; não foi introduzida correção fora
  do gate para mudar o contrato histórico de chamada.
- A nova suíte final exercita um `future_weapon` válido e confirma que o
  traço legacy é produzido.

## 6. E8 → voo → E9

A cadeia foi conferida estaticamente e em sandbox para as 19 armas:

```text
fireWeaponFrom
  → projectiles.push (ou fireBeam para Beam)
  → emitWeaponMuzzleVisual(src, def)
  → drawProjectile(p)
       → forma de família
       → camada temporal, se metadata real
  → updateProjectiles
       → dano/status/onProjectileHit
       → emitWeaponImpactVisual(p,e,eventKind)
```

`emitWeaponMuzzleVisual` só é chamado no disparo; `emitWeaponImpactVisual`
só é chamado no bounce ou contato/penetracão. O renderer não dispara
nenhum dos dois. Orb retorna antes do impacto linear porque `explodeOrb` é
despachado pelo pipeline mecânico. Mine retorna antes do impacto linear
porque `detonateSpecial` é o evento próprio. Não há muzzle no contato,
impacto no muzzle ou forma de voo desenhada duas vezes.

## 7. Famílias e distinção intrafamília

As famílias permanecem distinguíveis com cor e raio equalizados porque usam
topologias diferentes: corpos preenchidos versus strokes, paths únicos versus
múltiplos, corpos desconectados, cross/rebound, terminais e orientação pelo
vetor `vx/vy`. Os documentos E3–E7 e suas suítes fazem as comparações
cross-family e intrafamily; a suíte final confirma que o dispatcher não tem
branch duplicado.

Identidades intrafamília preservadas:

- plasma/orb/void/cryo: envelope com núcleo, círculo real, vazio interrompido,
  cristal facetado.
- flamer/acid: jato bifurcado versus glóbulo + satélite.
- tesla/plague: zigue-zague 100% stroke versus massa preenchida/espinhos.
- ricochet/boomer/gatling/mine: peça refletora, disco com eixo, cápsula
  mínima, dispositivo armado com pernas.
- rail/sniper/nail: streak com núcleo, dois strokes de precisão, haste
  preenchida com cauda em V.
- smg/shotgun/homing/prism: cápsula simétrica, pellet irregular, ogiva com
  estabilizadores, duas facetas refrativas.

O uso de cor não é necessário para as provas acima.

## 8. Casos especiais auditados

### Orb

`explodeOrb` continua sendo o único caminho de impacto do Orb. O raio é
`p.aoe = 105`, aplica dano e `slowT=1.4` aos alvos dentro do raio, cria ring
real, 18 partículas, 8 shards, shake/rumble e som. O impacto E9 comum retorna
sem partícula e sem ring adicional. Não houve mudança do raio nem dupla
explosão.

### Void

O Void é impacto único localizado. `implode:210` e `aoe:150` permanecem no
objeto de configuração, mas não são consumidos para esse projétil; o caminho
`detonateSpecial` só roda para `p.mine`. Não existe ring, sucção visual, AoE
visual ou impacto radial falso. A configuração morta foi documentada, não
corrigida.

### Tesla

A forma em voo é E7; o muzzle é E8; E9 acrescenta somente duas partículas no
contato primário. `onProjectileHit → chainShock` segue real: até 2 saltos,
raio 230, dano ×.78 por salto, `arcs` e procText `CADEIA`. A suíte E9 mede um
arco para dois alvos e confirma que o impacto e o chain não formam dois chains.
`shockT` serve como marcador/status de sinergia e o `shockP`/`shockSrc` é
write-only; não há DoT. Esse estado morto foi documentado, não corrigido.

### Plague

Muzzle E8, cápsula E7, impacto E9 localizado e `corrode` real no alvo
atingido. `aoe:130` e `contagion:true` não são consumidos pela trajetória
normal; não há nuvem, contágio visual, ring ou AoE. `corrT=5`, `corrP=.10`,
amplificação até ×1.60 permanecem no alvo direto. Esses campos mortos foram
documentados, não corrigidos.

### Flamer / Acid

Flamer usa um impacto, vida curta e budget baixo; `burn` continua DoT real
que empilha até seis vezes. Acid usa um impacto por gota, sem poça e sem
AoE; `corrode` é amplificador, não DoT. A forma do flamer é corpo único
bifurcado; a do acid tem corpo e satélite desconectado. A suíte E6 mede
zero dano de corrode em tick isolado e confirma a aplicação somente ao alvo.

### SMG / Shotgun / Gatling

- SMG: 1 partícula por contato; forma e muzzle baratos para a cadência .065.
- Shotgun: 7 projéteis continuam sendo 7 colisões mecânicas; E9 emite 1
  partícula por pellet e não uma parede de partículas.
- Gatling: 1 partícula por contato, vida .06, sem crescimento ilimitado.

A suíte E9 fixa esses budgets; `PARTS_MAX=900` e o pool impedem crescimento.

### Ricochet

O bounce continua invertendo `vx`/`vy`, decrementando `p.bounce` e aplicando
×1.15 de dano. `emitWeaponImpactVisual(...,'bounce')` é determinístico e
separado do impacto no inimigo. A trajetória não foi alterada.

### Boomer

`boomerang` continua perfurando na ida, marca retorno em `life*.42`, aponta ao
owner e usa `maxDist=0` na volta. `p.hits=null` permite novo contato na volta.
Ao alcançar o jogador o projétil é removido sem chamar E9; portanto não há
falso impacto no recolhimento.

### Mine

A mina desacelera, arma após `.45`, procura trigger em 110 px e chama
`detonateSpecial` uma única vez. O raio real é 120, com ring, 16 partículas,
10 shards e dano radial. O dispatcher E9 não acrescenta impacto linear.

### Beam

Beam é exceção consciente: `fireBeam` calcula contato, rampa/tick de dano,
`beamTarget`, `beamRamp` e `beamLen`; `drawBeamFrom` desenha o feixe e o
ponto de contato. Não há entidade `projectile`, não há `PROJ_FAMILY`, não há
E9 e não há muzzle de projectile. O caminho também é usado para Echo com
`drawBeamFrom` e não foi capturado pelo dispatcher.

## 9. eorb, inimigos e bosses

A separação foi verificada nos nove pontos de criação `type:'eorb'`, no ramo
de colisão `team !== 'ally'`, no `projectileTemporalMode` e no dispatcher.
Projéteis de inimigo não recebem `emitWeaponImpactVisual`, camada temporal do
jogador ou muzzle do jogador. `eorb` conserva círculo/anel histórico. Boss e
miniboss permanecem com seus próprios emissores e danos. Nenhuma regressão
visual/mecânica atribuível ao PR15.5 foi observada.

## 10. Echo

Echo dispara através de `fireWeaponFrom`, preserva `p.type` da arma e usa a
mesma família/forma/impacto. A camada temporal é adicionada somente por
metadata real (`owner !== player && owner.slot > 0 && owner.data`); não existe
`drawEchoProjectile`. Não há muzzle duplicado, impacto duplicado nem helper de
Echo específico.

## 11. Repetição Ancorada

Os símbolos reais auditados são `TEMPORAL_ACTION_WINDOW=5`,
`TEMPORAL_REPLAY_COOLDOWN=6`, `TEMPORAL_REPLAY_DAMAGE=.50`,
`temporalActionCapture`, `temporalReplayTry` e `replayTemporalAction`.

A elegibilidade exige origem explícita `PLAYER`, arma na whitelist, `ally`,
sem melee e sem beam. O replay consome snapshot, cria projectile temporal e
usa a mesma pipeline visual comum. Não consulta Echo, confiança, Ressonância,
Memory Director, DPS adicional, consumo compartilhado ou ataque adicional.
A nova suíte final verifica a criação do projectile temporal sem muzzle/impacto
extra; as suítes PR15.7 verificam a mecânica de dano, cooldown, cap e
telemetria. A independência mecânica está preservada.

## 12. Determinismo e RNG

Classificação, formas E3–E7, camada temporal, `muzzleShot`, `impactShot` e
`emitWeaponImpactVisual` não contêm `Math.random`, `rand` ou `randi`. O draw
histórico do Orb usa `runTime` apenas para pulsação determinística; Beam,
status e outros sistemas têm seus relógios existentes e não foram introduzidos
pelo E9.

O RNG continua reservado ao evento de gameplay/emissão histórica onde já
existia. O E8 substituiu o muzzle isotrópico por emissão direcional indexada,
reduzindo o consumo por disparo; isso foi medido e documentado em E8, não
reutilizado como novo RNG. Goldens A–I do performance audit reportam
`random: 0` durante render.

Provas usadas:

- sentinels de RNG em E0–E9;
- hash Canvas determinístico com seed fixo;
- traço repetido com mesmo estado;
- teste final que chama cada fronteira sem aleatoriedade nova.

## 13. Pure render

`drawProjectile` e helpers só leem o projectile e escrevem Canvas. A suíte
final compara JSON do projectile e comprimentos de `projectiles`, `parts`,
`arcs` e `enemies` antes/depois; não há mutação. A emissão de muzzle/impacto é
explicitamente uma operação de evento e pode inserir no pool visual, sem tocar
estado mecânico. A atualização de `parts`/`arcs` continua fora do renderer e
possui seus próprios owners/cleanup.

## 14. Performance e stress

### Custos unitários medidos no Canvas mock

O custo abaixo é estrutural (Canvas mock), não FPS/GPU:

| arma | muzzle | impacto comum | voo: paths/arcs | observação |
|---|---:|---:|---:|---|
| plasma | 3 | 2 | 2/0 | núcleo + envelope |
| shotgun | 6 | 1/pellet | 1/0 | sete pellets continuam baratos por contato |
| flamer | 2 | 1 | 1/0 | maior cadência, baixo budget |
| tesla | 2 | 2 | 2/0 | dois strokes, sem arc de voo |
| gatling | 1 | 1 | 1/0 | menor custo de alta cadência |
| orb | 3 | 0 linear | 2/2 | ring/18/8 pertencem a O105 |
| mine | 2 | 0 linear | 2/0 | detonação M120 pertence a evento especial |

O benchmark consolidado `audit_pr155/performance_benchmark.js` produziu:

| cena | inimigos | projéteis | FX | paths | save | blur draws |
|---|---:|---:|---:|---:|---:|---:|
| A idle | 0 | 0 | 0 | 14 | 9 | 7 |
| B leve | 10 | 12 | 46 | 151 | 45 | 30 |
| C médio | 25 | 60 | 198 | 481 | 110 | 67 |
| D pesado | 46 | 150 | 436 | 1022 | 210 | 122 |
| E stress sandbox | 46 | 260 | 758 | 1552 | 266 | 130 |
| F swarm-heavy | 46 | 30 | 109 | 407 | 119 | 147 |
| G projectile-heavy | 46 | 360 | 116 | 1128 | 152 | 111 |
| H FX-heavy | 10 | 20 | 976 | 1063 | 960 | 59 |
| I singular+ranged+swarm | 46 | 150 | 379 | 988 | 198 | 110 |

O cenário H preenche deliberadamente o teto de FX; não mostra crescimento
acima de `PARTS_MAX`. As cenas são sintéticas e não medem rasterização nem
FPS do Electron.

### Echo e Repetição

A cena densa E2 usada nas suítes contém 8 rails temporais, 7 pellets de
shotgun e 6 projéteis de Echo. O draw não cria entidade nem consome RNG. A
suíte final confirma separadamente que replay cria somente sua entidade
temporal e não emite muzzle/impacto adicional.

### Stress integrado

O conjunto existente cobre inimigos, alta cadência, projéteis, status, arcs,
shards, Echo/temporal layers, boss/miniboss emitters, HUD e métricas. O
benchmark não é uma simulação humana completa: ele deve ser complementado
pelo roteiro §24. Não foram observados leak, NaN, Infinity, exceção, pool
starvation ou abort de frame nos cenários auditados.

## 15. Pools e cleanup

- `PARTS_MAX = 900` e `PARTS_POOL_MAX = 900` confirmados.
- `partTake()` reutiliza objetos; `partRelease()` devolve expirados ao pool.
- `trimParts()` libera o excedente antes de remover; a suíte final força 1200
  particles e confirma `parts.length <= 900`.
- `updateArcs` remove arcs ao atingir `.life`; `drawArcs` não é owner de
  coleção.
- Rings e shards usam `parts`; textos usam compactação própria; swings e
  dmg nums seguem seus respectivos owners/cleanup.
- Nenhum cap foi aumentado.

## 16. HUD e pipeline de render

O loop executa `render()` dentro de `try/catch` e chama `updateHUD()` depois
em caminho próprio. O smoke `resize(); render(); updateHUD(true)` passou. O
benchmark forçou 120 atualizações estáveis de HUD sem escrita textual
redundante (`0` mudanças observadas pelo probe). Não houve ReferenceError,
NaN ou abort de draw subsequente.

A auditoria também confirmou que `drawBeamFrom`, `speechRender`, overlays e
camadas de modal não são chamados de dentro de helpers E9; portanto o
impacto visual não pode capturar o pipeline de HUD.

## 17. Modais, pause, resize e resolução

Pause, shop e evento mantêm seus estados reais (`paused`, `shop`, `event`),
marcam a simulação como frozen onde aplicável e retornam a `play` pelos
caminhos existentes. `arcs`, rings e particles permanecem sob o relógio
existente; não há timer novo do PR15.5 preso a modal.

O smoke de resolução chama `resize` antes do render e verifica `vw/vh` finitos.
Os helpers de projétil calculam orientação com `Math.hypot(vx,vy)||1`,
ev itando divisão zero. Não foi feito redesign responsivo.

## 18. Save/load e sandbox

`smBuildCheckpoint` serializa estado mecânico, build, Echo relation/dis, run
checkpoint e `runTime`; não serializa `parts`, rings, `arcs`, muzzle,
`impactTransient` ou `temporalReplay`. Estado puramente visual transitório é
recriado/limpo no ciclo de run. O smoke final confirma essa exclusão por
fonte.

Fixtures de performance exigem `DEV_MODE && sandboxRun`; são arquivos de
`audit_pr155`, não carregados pelo jogo release. Os caminhos
`sandboxStart/sandboxExit` e `pr15MemSandboxContextStart/TearDown` limpam o
contexto sintético. Nenhum teste visual escreve save ou contamina progressão,
economia, memória ou achievements de run real.

## 19. Equivalência mecânica

Não existe uma única base pré-PR15.5 isolada perfeita no HEAD: o histórico
entremeia PR15.5-C/D, PR15.6 e PR15.7 antes de E0, e o harness atual não pode
executar diretamente o `index.html` antigo do commit `4667720` sem suas
pontes históricas. Não foi inventada uma comparação falsa.

A prova usada foi incremental e auditável:

- C/D pinam `damageEnemy`, `updateEnemy`, melee, EDEFS, armas e minibosses
  contra suas bases apropriadas.
- E2 pinou janela, cooldown, dano, whitelist e payload da Repetição.
- E3–E7 compararam defs, nascimento, trajetória, status, alvos, split,
  homing, farBonus, pierce, bounce e recoil.
- E8 comparou `projectiles.length`, `vx/vy`, `dmg`, `color`, `type`,
  `life`, `maxDist` e recoil, com 0 divergências mecânicas; só o muzzle
  visual mudou.
- E9 comparou o caminho de dano/status e trocou somente partículas visuais
  isotrópicas por `emitWeaponImpactVisual`.
- Goldens mecânicos/hash de fonte permanecem estritos nos testes; rebaselines
  de funções visualmente alteradas estão explicados nos próprios comentários.

Conclusão: **zero divergência mecânica atribuível ao Visual Overhaul** foi
observada. A limitação de uma base monolítica está registrada, não escondida.

## 20. Configurações mortas consolidadas

Não corrigidas, conforme o gate:

| arma/sistema | campo | estado real |
|---|---|---|
| Void | `implode` | só seria lido em `detonateSpecial`; Void não é mine |
| Void | `aoe` | `explodeOrb` lê apenas Orb |
| Plague | `aoe` | não é consumido no caminho direto |
| Plague | `contagion` | bloco só é alcançado por `detonateSpecial`/mine |
| Tesla | `shockP` | escrito em `applyStatus`, não lido |
| Tesla | `shockSrc` | escrito em `applyStatus`, não lido |

Esses achados não foram convertidos em correção de gameplay ou texto.

## 21. Divergências de descrição

Também não reescritas nesta etapa:

| arma | texto atual | promessa | mecânica provada | divergência |
|---|---|---|---|---|
| Void | `Implosão que SUGA todos os inimigos para o ponto de impacto.` | sucção/AoE | impacto direto único; `implode`/`aoe` mortos | sim: descrição promete mecânica inexistente |
| Plague | `Nuvem tóxica que se ESPALHA: alvos mortos infectam os vizinhos.` | nuvem/propagação | corrode localizado; `contagion`/`aoe` mortos | sim: descrição promete nuvem/contágio |

Flamer, Acid, Tesla, Orb, Mine e as demais descrições auditadas não têm
divergência equivalente nos campos cobertos.

## 22. Inventário das suítes PR15.5

As 20 suítes PR15.5 agora executam pelo runner automático. Inventário:

| suíte | bloco/objetivo | checks | dependências/observações |
|---|---|---:|---|
| `pr15-5-visual-foundation` | fundação visual | 95 | harness, perfis, idle |
| `pr15-5-a-fix1-performance` | custo idle | 28 | Canvas mock/perf |
| `pr15-5-b-common-enemy-readability` | leitura de inimigo | 132 | EDEFS, update, draw |
| `pr15-5-b-fix1-performance-visibility` | performance/visibilidade | 56 | catálogos e budget |
| `pr15-5-c-hurt-death` | hurt/death | 163 | base `5d8e244`, hashes Canvas/mecânica |
| `pr15-5-d-melee-animation` | melee | 166 | base `4667720`, hashes de trail |
| `pr15-5-e0-visual-determinism` | RNG/pure render | 161 | seed LCG, Canvas mock |
| `pr15-5-e1-projectile-visual-grammar` | famílias/dispatcher/fallback | 108 | harness, topologia, goldens |
| `pr15-5-e2-temporal-projectile-identity` | Echo/Repetição/camada | 83 | temporal payload, seed, Canvas |
| `pr15-5-e3-slug-penetrator-identity` | rail/sniper/nail | 81 | mecânica de pierce/far |
| `pr15-5-e4-swarm-projectile-identity` | smg/shotgun/homing/prism | 75 | steering/split/budget |
| `pr15-5-e5-energy-mass-projectile-identity` | plasma/orb/void/cryo | 82 | AoE/status/config morta |
| `pr15-5-e6-fluid-spray-projectile-identity` | flamer/acid | 80 | burn/corrode/pureza |
| `pr15-5-e7-conduction-status-projectile-identity` | tesla/plague | 96 | chain/status/config morta |
| `pr15-5-e8-muzzle-emission-identity` | emissão | 72 | muzzle determinístico/pool |
| `pr15-5-e9-impact-visual-grammar` | impacto/E9 | 90 | Orb/Mine/Tesla/Plague/stress |
| `pr15-5-metrics-overlay` | métricas/HUD | 108 | hashes mecânicos/DOM |
| `pr15-5-performance-audit1` | benchmark/goldens | 112 | cenários A–I, Canvas mock |
| `pr15-5-final-integration` | fronteiras integradas | **24** | suíte nova, sem repetição de centenas de asserts |

A sobreposição é intencional nos invariantes críticos; nenhuma suíte foi
removida. A suíte final cobre composição, não substitui E0–E9.

Resultado focal PR15.5:

```text
SUÍTES: 20 · COM FALHA: 0 · CHECKS ✔: 1885 · FALHAS ✘: 0
```

## 23. Goldens e hashes

Classificação consolidada:

- **Source hash:** corpos de `damageEnemy`, `updateEnemy`, `fireWeaponFrom`,
  `updateProjectiles`, `drawEnemy`, `drawProjectile`, `drawSwings` e outros
  pins. Mudanças em funções visualmente tocadas foram re-baselineadas com
  comentário causal no teste.
- **Canvas hash:** nove cenas A–I do performance audit, com igualdade estrita
  de sequência/argumentos onde a forma não está presente; todos continuam
  passando no HEAD.
- **RNG:** antigos draws que consumiam RNG foram convertidos/medidos como
  `random:0`; os checks não foram afrouxados.
- **Collections:** sentinels conferem ausência de crescimento/mutação em
  render; pool e arcs possuem cleanup.
- **Mechanics:** hashes e comparações incrementais de dano, cadência,
  velocidade, alvo, status, pierce, bounce, split, chain, AoE, crit e
  targeting continuam estritos.

Nenhum golden foi atualizado apenas para ficar verde. As justificativas de
rebaseline estão nos comentários de `tests/pr15-5-performance-audit1.test.js`
e nos documentos E0–E9; os goldens de Canvas e RNG não precisaram de
rebaseline nesta finalização.

## 24. Regressões e correções

### Regressões encontradas

**Zero regressões atribuíveis ao PR15.5-FINAL** e zero regressões novas no
HEAD auditado. Não houve falha em suíte, exceção no smoke, NaN/Infinity,
leak observado ou captura indevida de Beam/eorb/inimigos.

### Correções realizadas

Nenhuma correção no jogo. Não houve alteração de `index.html` nem de
mecânica. A única alteração funcional da auditoria foi adicionar
`tests/pr15-5-final-integration.test.js` (24 checks); a outra alteração válida
é este relatório consolidado.

## 25. Riscos residuais e backlog

Riscos não bloqueantes:

1. O benchmark é Canvas mock/sandbox; não é medição de GPU, driver, FPS ou
   áudio do Electron do jogador.
2. O replaytest humano ainda não ocorreu; o relatório não declara aprovação
   visual humana.
3. A base pré-PR15.5 única não é executável pelo harness atual sem reconstruir
   pontes históricas; equivalência incremental é a prova disponível.
4. `drawProjectile` recebe registros válidos no loop real; a classificação
   aceita null/undefined, mas chamada direta do renderer com `null` não faz
   parte do contrato histórico do loop.
5. As duas descrições abaixo continuam prometendo mecânicas mortas.

Backlog técnico sem correção nesta etapa:

- remover ou implementar `void.implode`/`void.aoe`;
- remover ou implementar `plague.aoe`/`plague.contagion`;
- remover ou consumir `tesla.shockP`/`tesla.shockSrc`;
- alinhar descrições de Void e Plague às mecânicas reais, em etapa autorizada;
- medir a mesma carga em Electron/GPU durante o replaytest humano.

Nenhum item é um bloqueador visual/integracional comprovado desta branch;
os dois últimos exigem decisão de design/gameplay fora do gate FINAL.

## 26. Suíte final nova

Arquivo: `tests/pr15-5-final-integration.test.js`.

Valor real, sem duplicar as centenas de asserts E0–E9:

- inventário e cobertura única das 19;
- Beam e eorb fora do dispatcher;
- fallback válido preservado;
- muzzle → voo → temporal → impacto;
- Orb/Mine fora do impacto linear;
- Echo por metadata e Replay isolado;
- helpers sem RNG;
- pure render e pools;
- render/HUD/modal/save/sandbox smoke;
- ausência de branch duplicado.

Checks adicionados: **24**.

## 27. Roteiro de replaytest humano final

Este roteiro é curto por intenção. Registrar vídeo ou observações por item:

1. Iniciar combate normal e observar que o HUD continua atualizando.
2. Trocar entre pelo menos uma arma de cada família.
3. Observar muzzle no disparo, forma em voo e impacto no alvo.
4. Fazer alta cadência com Flamer, SMG e Gatling; observar fluidez e
   ausência de parede de partículas.
5. Usar Orb: confirmar um único evento radial, lentidão e ring real.
6. Usar Void: confirmar impacto localizado, sem ring/sucção/AoE falso.
7. Usar Tesla em três alvos: confirmar chain, arcos e `CADEIA` sem chain
   duplicado.
8. Usar Plague: confirmar corrode no alvo e ausência de nuvem/contágio.
9. Usar Ricochet contra inimigo e parede; confirmar bounce/trajectory.
10. Usar Boomer: ida, perfuração, retorno e recolhimento sem falso impacto.
11. Usar Mine: voo, arm, trigger, detonação e raio real sem impacto linear.
12. Usar Beam: contato contínuo/rampa, sem entidade projectile.
13. Jogar com Echo e confirmar herança de forma, impacto e camada temporal,
    sem muzzle duplicado.
14. Capturar uma Repetição; confirmar que o replay tem assinatura temporal
    mas não cria ataque/muzzle/impacto mecânico extra.
15. Enfrentar muitos projéteis inimigos, miniboss e boss; confirmar que não
    recebem forma temporal/muzzle do jogador.
16. Abrir/fechar pause, shop e evento e retornar ao combate.
17. Fazer resize em viewport normal e menor; confirmar que muzzle/impacto não
    deslocam e não surgem NaN/clipping estrutural.
18. Confirmar save/continue sem particles/rings/arcs transitórios persistidos.
19. Observar por vários segundos: sem leak, arcs/rings presos, pool starvation
    ou queda estrutural.
20. Confirmar leitura geral: famílias distinguíveis, poluição visual aceitável
    e fluidez suficiente no hardware real.

Arena não deve marcar nenhum item como aprovado automaticamente; a decisão
final é humana.

## 28. Conclusão técnica

Com base no SHA correto, baseline reproduzida, cobertura integral das 19
armas, Beam/eorb separados, fallback preservado, cadeia E8→voo→temporal→E9
íntegra, famílias e intrafamílias distinguíveis, exceções Orb/Void/Tesla/
Plague/Flamer/Acid/Ricochet/Boomer/Mine corretas, Echo e Repetição isolados,
determinismo/RNG/pure render/pools/HUD/save/sandbox preservados e **70 suítes
/ 4626 checks / 0 falhas** após a suíte final, a branch está tecnicamente
apta para aguardar a validação humana.

As configurações mortas e divergências de descrição foram deliberadamente
apenas documentadas. Não houve alteração de gameplay.

> **NÃO HUMAN APPROVED — aguardando replaytest final.**

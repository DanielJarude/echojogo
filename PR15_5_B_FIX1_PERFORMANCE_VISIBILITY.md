# ECHO — PR15.5-B-FIX #1 · Performance e visibilidade

## Status e método

O PR15.5-B original foi rejeitado no playtest humano: a animação era pouco percebida e a queda de FPS no Electron era forte. Esta correção auditou **somente** o diff `91e0cd3cd0c6155d1c7b43da73bf9bacf8a69dc0 → af67fbea9e9d76f7402727135160c2004e01acbc`.

Não se usa tempo Node nem se infere FPS. O critério é operação extra por frame: chamadas de observação, estados, poses, transforms, paths, arcs, strokes/fills, save/restore, trigonometria, marcadores e temporários. O script reproduzível é `audit_pr155/visual_foundation_benchmark.js`.

## Por que B custava muito e aparecia pouco

1. Chaser, Tank, Swarm, Bulwark e Splitter mantinham `visualAttackObserve` ativo até **54 px além do contato**. Em gameplay isso transformava perseguição comum em estado permanente.
2. Todo estado chamava `visualEnemyAttackPose`; a pose podia adicionar translate, rotate e scale.
3. Todo estado chegava a `drawCommonAttackCue`, que fazia save/restore e setup antes de descobrir se o arquétipo realmente desenhava algo.
4. Singular observava pull continuamente dentro de 420 px. `drawSingularInfluence` rodava até fora do raio: círculo tracejado, save/restore e, dentro, três marcadores, quatro arcs/strokes totais, um `atan2` e seis `sin/cos`.
5. Cada Swarm próximo pagava pose e cue próprio, incluindo path, stroke, save/restore e seno.
6. Esse trabalho resultava principalmente em squash/stretch de 1,8%–6%, deslocamentos subpixel e rotações mínimas. A silhueta quase não mudava no caos real.

## Auditoria dos hot paths

| Hot path B | Atividade/duração | Custo extra B | B-FIX |
|---|---|---|---|
| `updateEnemy` contato | contínuo em `contactR+54` | observe + state por inimigo próximo | removido; evento de 0,08 s só no contato real de Chaser/Tank/Splitter |
| `updateEnemy` Singular | contínuo dentro de 420 | observe, state, `atan2` | um escalar `pullVisual`; a mecânica do pull é idêntica |
| `updateEnemy` Shooter/Orbiter | 0,42/0,48 s | observe + `atan2` | preservado por ser janela curta e importante |
| `updateEnemy` Phantom | 0,34 s | observe | preservado por ser rematerialização importante |
| `updateEnemy` Spawner | até 2,2 s | observe/state redundante | removido; `charging/chargeT` já dirigem a geometria existente |
| `drawEnemy` | qualquer attack state | pose e até 3 transforms | pose genérica não é chamada; mudanças entram nas coordenadas existentes |
| `drawCommonAttackCue` | qualquer attack state | 1 save + 1 restore sempre; paths conforme tipo | removido |
| `drawSingularInfluence` | toda Singular; marcadores dentro | hypot, dash, arc/stroke; + loop de 3 marcadores | removido |
| Singular integrada | somente dentro de 420 | — | exatamente 1 beginPath + 1 arc + 1 stroke; zero save/restore e zero marcador |
| Swarm | contínuo próximo | pose, transforms, path/stroke individual | zero custo de ataque; asas existentes têm silhueta maior |

`visualAttackObserve/Trigger/Idle/Cancel` permanecem O(1), escalares e puros em relação ao gameplay. `visualEnemyAttackPose` permanece como API compatível/testável, mas saiu do renderer comum; portanto não cobra custo por frame.

## Redesign por arquétipo

| Arquétipo | B rejeitado | B-FIX | Operações geométricas novas durante cue |
|---|---|---|---:|
| Chaser | compressão contínua próxima | lâminas estendem 0,48R no impacto curto | 0 |
| Shooter | microescala + linha e orbe adicionais | canhão existente cresce 60% e orbe existente cresce 0,34R | 0 |
| Tank | brace contínuo | canhão existente expande no impacto curto | 0 |
| Spawner | state redundante durante carga | usa carga/fenda mecânica já existente | 0 |
| Anomaly | pose sobre fase já forte | mantém somente janela mecânica importante | 0 layer comum |
| Swarm | cue individual contínuo | asas existentes maiores; nenhuma consulta de attack state no draw | 0 |
| Orbiter | microescala + duas linhas | satélites existentes convergem ao eixo, crescem e o anel engrossa | 0 |
| Bulwark | microbrace + chevrons | placa base permanente a 1,22R, assimétrica e orientada por `shieldAng` | 0 por ataque |
| Splitter | fissura contínua próxima | separação estrutural de 0,18R apenas no impacto | 0 |
| Phantom | ring tracejado + microescala | alpha varia 0,16→0,70 e contorno existente abre/engrossa | 0 (remove até um fill enquanto ghost) |
| Singular | círculo sempre + 3 marcadores | um limite sólido somente dentro do pull; reflexão inverte anéis existentes | 1 arc + 1 stroke |

Nenhuma alteração foi feita em HP, dano, velocidade, aceleração, hitbox, range, cooldown, projéteis, spawn/waves ou targeting.

## Operações extras por frame

Números completos, incluindo `fills`, `sinCos`, `atan2`, marcadores, Swarm e temporários, são emitidos pelo benchmark. Resumo:

| Cenário | Versão | observe/states | poses/transforms | paths/arcs/strokes | save+restore | marcadores/Swarm extra |
|---|---|---:|---:|---:|---:|---:|
| mistura realista 46 | B | 21/21 | 20/37 | 19/7/17 | 44 | 3/6 |
|  | B-FIX | 5/5 | 0/0 | 1/1/1 | 0 | 0/0 |
| contatos densos 46 | B | 46/46 | 46/92 | 12/0/12 | 92 | 0/12 |
|  | B-FIX | 0/0 | 0/0 | 0/0/0 | 0 | 0/0 |
| duas Singular | B | 2/2 | 0/0 | 8/8/8 | 8 | 6/0 |
|  | B-FIX | 0/0 | 0/0 | 2/2/2 | 0 | 0/0 |
| 40 Swarm | B | 40/40 | 40/80 | 40/0/40 | 80 | 0/40 |
|  | B-FIX | 0/0 | 0/0 | 0/0/0 | 0 | 0/0 |
| 12 Shooter + 10 Orbiter em windup | B | 22/22 | 22/32 | 44/12/32 | 44 | 0/0 |
|  | B-FIX | 22/22 | 0/0 | 0/0/0 | 0 | 0/0 |

A-FIX é zero em todas essas colunas, pois elas contam somente o custo acrescentado pela camada B. Assim, contatos e Swarm voltam exatamente ao custo conceitual do A-FIX; ranged importante paga apenas state/observe e aritmética sobre geometria que já seria desenhada; Singular paga uma única primitiva enquanto o jogador está dentro do alcance.

## Validação

A suíte `tests/pr15-5-b-fix1-performance-visibility.test.js` possui 56 checks, incluindo contagem dinâmica do Canvas mock. O mock não é apresentado como benchmark de FPS: ele valida cardinalidade de operações. As suítes A, A-FIX, B adaptada ao redesign, regressões relacionadas e `npm test` devem permanecer verdes antes do GO.

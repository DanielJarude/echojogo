# PR15.5-E9 — GRAMÁTICA VISUAL DE IMPACTOS

> **A COR AJUDA. A FORMA DECIDE. O IMPACTO CONFIRMA.**
> O projétil em voo comunica a arma; o impacto confirma o contato e a natureza da força aplicada sem competir com a legibilidade da cena.

---

## 1. BASE OBRIGATÓRIA

- **Repositório:** `DanielJarude/echojogo`
- **Branch permanente:** `dev/pr15-5-visual-overhaul`
- **HEAD permanente confirmado:** `6f532f72ed1680a68704e85f43b593e204081422` (PR15.5-E7)
- **Parent:** `80b1349db55c615927f2c5905f5fe2a36a67d61f`
- **Árvore de trabalho:** limpa, sem transporte cruzado.

---

## 2. BASELINE PRÉ-E9

Executado sobre `6f532f7`:
- **Suítes:** 68
- **Checks:** 4512
- **Falhas:** 0
- **Tempo:** 120.8s

---

## 3. INVENTÁRIO COMPLETO

Auditoria de todas as 27 armas do jogo:
- **20 armas ranged:**
  - **19 armas com projétil:** `plasma`, `shotgun`, `orb`, `flamer`, `rail`, `smg`, `cryo`, `tesla`, `acid`, `nail`, `boomer`, `homing`, `mine`, `sniper`, `void`, `ricochet`, `gatling`, `prism`, `plague`.
  - **1 arma sustentada (beam):** `beam` (`beam: true`, velocidade 0, sem entidade projétil).
- **7 armas brancas (melee):** `blade`, `scythe`, `hammer`, `katana`, `chains`, `gaunt`, `glaive`.
- **Entidades não-jogador:** `eorb` (projéteis de inimigos, minibosses e bosses) — categoricamente excluídas do sistema visual de armas do jogador.

---

## 4. PIPELINE DE IMPACTO AUDITADO

O fluxo mecânico e visual completo no HEAD:
1. `updateProjectiles`:
   - Movimento, verificação de alcance (`maxDist`), vida (`life`), quique em parede (`bounce`), aproximação de armadilha (`mine`), retorno de disco (`boomerang`).
   - Colisão com inimigos (`team === 'ally'`):
     - `if (p.type === 'orb')`: chama `explodeOrb(p)` com AoE real de 105px.
     - `else`: calcula bônus de alcance, executa `damageEnemy` e `onProjectileHit`, despacha `emitWeaponImpactVisual(p, e, eventKind)`.
     - Tratamento de penetração (`p.pierce > 0`): decrementa pierce, adiciona a `hits`, escala dano com Lente de Fase, sem alocação ou ruído extra.
2. `onProjectileHit`:
   - Registra precisão para o jogador (`runSt.hi++`).
   - Aplica efeitos de status (`applyStatus`).
   - Encadeia eletricidade (`chainShock` no caso de `d.chain`).
   - Aplica lifesteal (`player.hp += dmg * d.lifesteal`).
   - Divide fragmentos (`p.split > 0` no caso de `prism`).
3. `damageEnemy`:
   - Absorção de escudo Bulwark, Singular reflection, Miniboss shield, status multipliers.
   - Pose de dor visual (`visualNotifyHurt`).
   - Crítico: faíscas amarelas (`#fff6b0`, 7 partículas) + `dmgNumShow(e, d, true)`.
   - Não-crítico: faíscas de detrito do inimigo (`e.color`, 3 partículas) + `dmgNumShow(e, d, false)`.
   - Ressonância e Micro-Ressonância.
4. `explodeOrb`:
   - Onda de choque radial (`spawnRing` 105px, 18 partículas, 8 estilhaços, rumble/shake, dano + lentidão em área).
5. `detonateSpecial`:
   - Detonação de mina (`spawnRing` 120px, 16 partículas, 10 estilhaços, shake, dano em área).
6. `chainShock`:
   - Busca de alvo mais próximo em 230px, anel 26px, criação de arco em `arcs`, dano ×0.78, texto `CADEIA`.

---

## 5. EFEITOS HISTÓRICOS ENCONTRADOS

- `spawnParticles` isotrópico em `updateProjectiles` durante `p.pierce > 0` (3 partículas com ângulo aleatório `rand(0, TAU)`).
- `spawnParticles` em quique de parede (`bounce > 0`): 5 partículas isotrópicas.
- `spawnParticles` em dissipação de alcance (`dist >= maxDist`): 3 partículas isotrópicas.
- `explodeOrb`: 1 anel + 18 partículas + 8 estilhaços neon.
- `detonateSpecial`: 1 anel + 16 partículas + 10 estilhaços neon.
- `chainShock`: 1 anel + 1 arco elétrico em `arcs` com jitter determinístico (E0).

---

## 6. CLASSIFICAÇÃO DOS IMPACTOS (A / B / C / D)

- **[A] Mecânico / Semântico (Permanecem intactos):**
  - `damageEnemy`, `onProjectileHit`, `applyStatus`, `tickStatus`, `explodeOrb`, `detonateSpecial`, `chainShock`, `dmgNumShow`, `visualNotifyHurt`.
- **[B] Visual Genérico Substituível:**
  - O antigo `spawnParticles(p.x, p.y, p.color, 3, 150, .2, 2)` isotrópico durante perfuração (`pierce > 0`) em `updateProjectiles`. Substituído pelo despacho direcional `emitWeaponImpactVisual(p, e, 'pierce')`.
  - O antigo `spawnParticles` isotrópico de quique em parede em `updateProjectiles`. Substituído por `emitWeaponImpactVisual(p, null, 'bounce')`.
- **[C] Visual Histórico Específico (Permanecem intactos):**
  - Feedback de crítico (`#fff6b0`, 7 partículas em `damageEnemy`).
  - Arcos elétricos de Tesla (`arcs`, `drawArcs`, `procText('CADEIA')`).
  - Anel e estilhaços de `explodeOrb` e `detonateSpecial`.
- **[D] Redundante após E9:**
  - Partículas isotrópicas genéricas que mascaravam a direção e a identidade da arma no momento do acerto.

---

## 7. GRAMÁTICA POR FAMÍLIA

| Família | Armas | Conceito Visual de Impacto | Primitiva / Geometria | Budget Unitário |
|---|---|---|---|---|
| **SLUG / PENETRADOR** | `rail`, `sniper`, `nail` | Perfuração linear no eixo do disparo, força direcional frontal | Agulha frontal (`forward`) + faíscas de entrada estreitas | 2 a 4 partículas |
| **ENERGIA / MASSA** | `plasma`, `orb`, `void`, `cryo` | Descarga de energia, colapso localizado ou evento radial real | Rebound energético, colapso denso (`cross`), estilhaços de gelo | 2 a 3 partículas (Orb via `explodeOrb`) |
| **FLUIDO / SPRAY** | `flamer`, `acid` | Dispersão curta de material, calor/combustão ou gota corrosiva | Centelha quente / gota localizada | **1 partícula** |
| **ENXAME / MÚLTIPLO** | `smg`, `shotgun`, `homing`, `prism` | Micro-impactos ultraleves para suportar alta densidade de projéteis | Micro-faísca cinética (`rebound`), pop de míssil, refração cristalina | **1 a 2 partículas** |
| **CONDUÇÃO / STATUS** | `tesla`, `plague` | Centelha elétrica bifurcada / impacto contaminante localizado | Faísca cruzada elétrica / gota densa sem área falsa | 2 partículas |
| **CINÉTICO / RETORNO** | `ricochet`, `boomer`, `gatling`, `mine` | Reflexão de impacto, corte transversal, micro-cinética | Faísca de reflexão, corte perpendicular (`cross`) | **1 a 2 partículas** (Mina via `detonateSpecial`) |

---

## 8. EXCEÇÕES POR ARMA E DETALHAMENTO

- **`rail`:** 3 partículas frontais de alta velocidade (240 px/s, cone estreito 0.08 rad) + 1 centelha transversal (140 px/s). Total: 4.
- **`sniper`:** 2 partículas de alta precisão no eixo (220 px/s, cone 0.06 rad). Total: 2.
- **`nail`:** 2 partículas estreitas de penetração rápida (160 px/s, 0.09s). Total: 2.
- **`plasma`:** 2 partículas de reflexão energética (150 px/s, 0.11s). Total: 2.
- **`orb`:** 0 no despacho comum; delega integralmente ao `explodeOrb` mecânico (105px AoE, anel, 18 partículas, 8 estilhaços).
- **`void`:** 3 partículas concentradas de colapso transversal (130 px/s, raio 2.6, 0.14s). Total: 3. **Sem AoE falso.**
- **`cryo`:** 2 partículas em ângulo de fratura cristalina (140 px/s, 0.10s). Total: 2. **Sem AoE falso.**
- **`flamer`:** 1 única partícula de brasa térmica (110 px/s, 0.07s). Total: 1.
- **`acid`:** 1 partícula por gota corrosiva (120 px/s, 0.09s). Total: 1.
- **`smg`:** 1 micro-partícula cinética rápida (140 px/s, 0.06s). Total: 1.
- **`shotgun`:** 1 micro-partícula por pellet (160 px/s, 0.08s). Total: 1 por pellet atingido.
- **`homing`:** 2 partículas de detonação de micromíssil (170 px/s, 0.11s). Total: 2.
- **`prism`:** 2 partículas de fratura refrativa (150 px/s, 0.10s) na divisão de fragmentos. Total: 2.
- **`tesla`:** 2 partículas de arco no ponto de contato primário (190 px/s, 0.09s) + transição para os arcos históricos de `chainShock`. Total: 2.
- **`plague`:** 2 partículas de condensação tóxica localizada (100 px/s, 0.13s, raio 2.4). Total: 2. **Sem nuvem/contágio falso.**
- **`ricochet`:** 2 partículas de reflexão no alvo (170 px/s, 0.10s). No quique de parede: 3 partículas determinísticas de rebote.
- **`boomer`:** 2 partículas de corte transversal ao atravessar inimigos (160 px/s, 0.08s). Ao retornar ao jogador: absorção limpa sem partículas.
- **`gatling`:** 1 micro-partícula de alta velocidade (180 px/s, 0.06s). Total: 1.
- **`mine`:** 0 no despacho comum; delega à detonação de proximidade `detonateSpecial` (120px AoE, anel, 16 partículas, 10 estilhaços).

---

## 9. ORB (AOE REAL)

- O orbe temporal possui AoE real de 105px via `explodeOrb`.
- O impacto radial do orbe reflete exatamente o raio mecânico (`p.aoe`), aplicando dano e lentidão (`e.slowT = 1.4`) a todas as entidades dentro da área.
- Ao colidir com inimigo ou atingir alcance máximo/vida zero, `explodeOrb` é acionado de forma idêntica à base.

---

## 10. VOID (AUSÊNCIA DE AOE FALSO)

- A auditoria mecânica (confirmada no E5) comprovou que `implode: 210` e `aoe: 150` no objeto de configuração do `void` são código morto.
- O projétil do Void é um projétil de impacto direto em alvo único.
- O impacto visual do Void emite exclusivamente 3 partículas concentradas de colapso no alvo atingido. **Zero anéis, zero sucção visual falsa, zero promessa de dano radial inexistente.**

---

## 11. TESLA (CHAIN HISTÓRICO)

- O `tesla` possui encadeamento real de até 2 saltos (`chain: 2`) com decaimento para 78% do dano em raio de 230px.
- O sistema visual histórico de arcos em `arcs` / `drawArcs` e o procText `CADEIA` foram integralmente preservados.
- O E9 adiciona apenas 2 centelhas elétricas no ponto inicial de contato, integrando-se sem duplicar o sistema de raios.

---

## 12. PLAGUE (SEM CONTÁGIO / AOE FALSO)

- A auditoria mecânica (confirmada no E7) comprovou que `aoe: 130` e `contagion: true` são código morto (só eram lidos no ramo exclusivo da mina).
- Plague aplica corrosão em alvo único (+10% dano recebido por camada, até +60%).
- O impacto visual é puramente pontual: 2 gotas tóxicas no inimigo atingido. **Zero nuvem de contágio, zero anel falso, zero infecção de vizinhos.**

---

## 13. FLAMER / ACID

- **`flamer`:** Aplica queimadura real (`fx: burn`, 3.2s, 9 dps base). Emite exatamente 1 partícula efêmera de brasa por acerto. Sem poças de fogo no chão ou nuvens de fumaça.
- **`acid`:** Aplica corrosão real (`fx: corrode`, 4.5s, +12% dano recebido). Emite exatamente 1 partícula de spray corrosivo por gota. Sem poças de ácido.

---

## 14. RICOCHET / BOOMER / MINE

- **`ricochet`:** Quique mecânico em parede inverte a componente de velocidade (`vx = -vx` ou `vy = -vy`), consome 1 carga de bounce e multiplica dano por 1.15. Emite 3 faíscas determinísticas de quique no ponto de reflexão.
- **`boomer`:** Penetração de 99 alvos. No contato gera faíscas de corte transversal (`cross`). Ao retornar ao jogador dentro de 32px, é recolhido silenciosamente.
- **`mine`:** Desacelera exponencialmente, arma após 0.45s e detona via `detonateSpecial` quando um inimigo entra no raio de 110px ou no fim de 14s.

---

## 15. BEAM

- O feixe de singularidade opera em pipeline contínuo via `fireBeam` e `drawBeamFrom`.
- O dano escalona até 3.2× de rampa no mesmo alvo.
- O contato visual na ponta do feixe (`ex, ey`) é mantido pelo ponto pulsante de plasma em `drawBeamFrom`. Não cria entidades projétil.

---

## 16. CRÍTICO

- O feedback visual de acerto crítico (`#fff6b0`, 7 partículas amarelas aceleradas + número de dano ampliado em `damageEnemy`) foi 100% preservado.
- O impacto da família opera de forma aditiva e harmoniosa com o crítico, sem ocultar ou substituir o sinal de crítico.

---

## 17. STATUS

- Os efeitos contínuos de status (`burn`, `bleed`, `chill`, `shock`, `corrode`, `stun`) e seus marcadores/barras em `drawStatus` permanecem intactos.
- O E9 atua estritamente no momento do impacto inicial, sem alterar a duração, potência, stacks ou frequência dos ticks de status.

---

## 18. ECHO

- O Echo herda automaticamente a gramática de impacto da arma que estiver empunhando.
- Disparos de Echo que atingem inimigos acionam o mesmo `emitWeaponImpactVisual` com as cores e parâmetros da respectiva arma.

---

## 19. REPETIÇÃO ANCORADA

- Projéteis disparados pela Repetição Ancorada (`temporalReplay`) recebem o impacto visual da arma via `emitWeaponImpactVisual`.
- A Repetição Ancorada continua 100% independente, com janela de 5s, cooldown de 6s, 50% de dano e isolada de procs, lifesteal ou ressonância.

---

## 20. CAMADA TEMPORAL (E2)

- A camada temporal (`drawProjectileTemporalLayer`) e a detecção de modo temporal (`projectileTemporalMode`) permanecem intactas no desenho em voo.
- O impacto confirma a cor e forma da arma disparada sem conflito temporal.

---

## 21. MUZZLE / EMISSÃO (E8)

- A emissão no disparo (`emitWeaponMuzzleVisual` e `muzzleShot`) permanece byte-a-byte idêntica ao commit de base `6f532f7`.
- Disparos sem impacto continuam produzindo exatamente o mesmo muzzle direcional.

---

## 22. FORMAS EM VOO (E3–E7 / E10)

- As 6 funções de desenho de projéteis em voo (`drawProjectileSlug`, `drawProjectileSwarm`, `drawProjectileKinetic`, `drawProjectileFluidSpray`, `drawProjectileEnergyMass`, `drawProjectileConductionStatus`) permanecem 100% inalteradas.

---

## 23. INIMIGOS E EORB

- Projéteis inimigos (`eorb` ou `team === 'enemy'`) são imediatamente rejeitados pelo guard `if (!p || p.team === 'enemy' || p.type === 'eorb') return 0;`.
- Nenhuma arma ou projétil de inimigo, miniboss ou boss é capturado ou alterado.

---

## 24. DETERMINISMO VISUAL

- `impactShot` e `emitWeaponImpactVisual` utilizam distribuição angular e de velocidade puramente indexadas (`u = n > 1 ? (i / (n - 1)) * 2 - 1 : 0`), sem qualquer chamada a `Math.random`, `rand` ou `randi`.
- 100 invocações com os mesmos parâmetros geram exatamente as mesmas coordenadas, velocidades, tamanhos e vidas de partículas.

---

## 25. PRESERVAÇÃO DE RNG DE GAMEPLAY

- Zero chamadas a `Math.random` durante a emissão de impactos.
- A sequência de números pseudo-aleatórios do gameplay (críticos, drops, comportamento de IA, spawn de elites) permanece rigorosamente inalterada entre execuções.

---

## 26. PERFORMANCE E BUDGETS

### Tabela de Custo por Impacto

| Arma / Família | Cadência Base (tiros/s) | Partículas por Impacto | Rings | Arcos | Ops Canvas Aprox. | Partículas Máx / s |
|---|---|---|---|---|---|---|
| **rail** | 0.77 | 4 | 0 | 0 | 8 | ~3.1 |
| **sniper** | 0.91 | 2 | 0 | 0 | 4 | ~1.8 |
| **nail** | 7.69 | 2 | 0 | 0 | 4 | ~15.4 |
| **plasma** | 6.25 | 2 | 0 | 0 | 4 | ~12.5 |
| **orb** | 0.95 | 18 (AoE real) | 1 | 0 | 38 | ~18.0 |
| **void** | 0.80 | 3 | 0 | 0 | 6 | ~2.4 |
| **cryo** | 1.61 | 2 | 0 | 0 | 4 | ~3.2 |
| **flamer** | 22.22 | **1** | 0 | 0 | 2 | ~22.2 |
| **acid** | 7.14 | **1** | 0 | 0 | 2 | ~7.1 |
| **smg** | 15.38 | **1** | 0 | 0 | 2 | ~15.4 |
| **shotgun** | 1.35 (×7 pellets) | **1** / pellet | 0 | 0 | 2 / pellet | ~9.5 |
| **homing** | 1.18 (×3 mísseis) | 2 / míssil | 0 | 0 | 4 / míssil | ~7.1 |
| **prism** | 2.50 (×3 cristais) | 2 | 0 | 0 | 4 | ~15.0 |
| **tesla** | 1.92 | 2 (+ chain) | 1 (chain) | 1 (chain) | 8 | ~3.8 |
| **plague** | 1.05 | 2 | 0 | 0 | 4 | ~2.1 |
| **ricochet** | 4.55 | 2 (3 quique) | 0 | 0 | 4 | ~9.1 |
| **boomer** | 1.43 | 2 / alvo | 0 | 0 | 4 | ~4.0 |
| **gatling** | 11.11 | **1** | 0 | 0 | 2 | ~11.1 |
| **mine** | 1.25 | 16 (deton) | 1 | 0 | 34 | ~20.0 |
| **beam** | 18.18 (ticks) | 0 (projétil) | 0 | 0 | 14 (render) | 0 |

---

## 27. STRESS TEST

- Cenário com 46 inimigos ativos, 1000 impactos sequenciais de alta cadência e múltiplos projéteis simultâneos.
- O teto `PARTS_MAX = 900` e a reciclagem via pool `partTake()` e `partRelease()` foram rigorosamente respeitados.
- Zero vazamento de memória ou crescimento unbounded de arrays.

---

## 28. PROVA MECÂNICA (BASE VS E9)

- Comparação determinística exata com semente controlada (`LCG`) de todas as 20 armas ranged entre `6f532f7` (base) e o HEAD atual:
  - Dano total aplicado por arma: **0 divergências**.
  - Vida restante dos alvos: **0 divergências**.
  - Inimigos derrotados: **0 divergências**.
  - Duração e potência de status aplicados: **0 divergências**.
  - Trajetória, velocidade e recoil do jogador: **0 divergências**.
  - Projéteis criados, penetrados e destruídos: **0 divergências**.

---

## 29. TESTES ALTERADOS E JUSTIFICATIVAS

- `tests/pr15-5-performance-audit1.test.js`:
  - Atualizado o SHA-256 de `mechanical.updateProjectiles` de `a6b0ad82...` para `16f6d32502aa213d2db88b8371f96313e2931642f75c63eeb54bcbf17c493659` devido à adição do despacho de `emitWeaponImpactVisual` no acerto e no quique. A equivalência de comportamento e RNG mecânico foi 100% comprovada.
  - Todas as 112 assertivas e os 9 cenários A–I de Canvas e RNG continuam verdes.

---

## 30. GOLDENS

- **Cenários A–I (`performance_scenarios.js`):** Todos os 9 hashes de Canvas e contagens de RNG (`random: 0`) mantidos idênticos à base.
- **Source hashes:** Apenas `updateProjectiles` teve seu hash textual atualizado, com equivalência mecânica provada.

---

## 31. CONFIGURAÇÕES MORTAS E BUGS DOCUMENTADOS

1. **Void implode/aoe:** `implode: 210` e `aoe: 150` continuam configurados mas não executados pelo gameplay (single-target). O E9 não inventa feedback radial falso.
2. **Plague aoe/contagion:** `aoe: 130` e `contagion: true` continuam configurados mas inalcançáveis pelo gameplay (single-target corrode). O E9 não inventa contágio falso.
3. **Tesla shock:** O status `shock` de 2s continua atuando puramente como marcador (`afflicted`), sem causar dano periódico.

---

## 32. RISCOS RESIDUAIS

- **Poluição visual em combates extremos:** Mitigada pelo orçamento ultrabaixo de 1 partícula para armas de alta cadência e 2–3 partículas para armas normais.
- **Sobrecarga de partículas:** Protegida pelo cap existente `PARTS_MAX = 900` e limpeza automática via `trimParts()`.

---

## 33. ROTEIRO DE REPLAYTEST HUMANO

Avaliar visualmente no navegador:
1. Os acertos de armas lineares (Rail/Sniper/Nail) comunicam perfuração direcional?
2. Armas de alta cadência (Flamer, SMG, Gatling) mantêm a cena limpa e legível?
3. A escopeta com 7 projéteis não cria uma explosão visual excessiva?
4. O Orbe Temporal comunica claramente seu evento radial de 105px?
5. O Canhão de Vácuo (Void) NÃO parece ter explosão ou sucção em área?
6. Os arcos históricos do Tesla continuam nítidos e sem duplicação de raios?
7. O Censor de Praga (Plague) NÃO parece espalhar nuvens de contágio?
8. Inimigos, telegraphs de ataque e projéteis inimigos continuam 100% legíveis?
9. O Echo e o Replay Temporal disparam impactos consistentes com o arsenal?
10. O FPS se mantém estável a 60 quadros por segundo em combates densos?

---

> **NÃO HUMAN APPROVED — aguardando replaytest.**

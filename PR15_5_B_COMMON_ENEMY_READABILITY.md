# ECHO — PR15.5-B · Legibilidade de Ataque dos Inimigos Comuns

## Escopo

Este bloco melhora antecipação, ação e recuperação visual dos 11 arquétipos de
`EDEFS`. Nenhum renderer controla gameplay e nenhum stat, cooldown, alcance,
hitbox ou comportamento estratégico foi alterado.

## Auditoria pré-implementação

| Inimigo | Mecânica de ataque | Sinal mecânico existente | Problema anterior | Windup honesto | Active/recovery | Risco mecânico |
|---|---|---|---|---|---|---|
| Chaser | contato | distância e `touchCd` | perseguição e ameaça tinham a mesma pose | proximidade ao raio real | contato real + relaxamento | baixo |
| Shooter | projétil | `fireT`, distância <560 | disparo sem carga corporal | últimos 0,42 s de `fireT` | criação real do projétil | médio: entrada no range com timer vencido continua imediata |
| Tank | contato pesado | distância e `touchCd` | massa sem preparação | proximidade real | contato + assentamento | baixo |
| Spawner | invocação | `charging`, `chargeT`, `spawnCd` | já bom, mas fora da fundação | 2,2 s mecânicos | spawn real + fechamento | baixo |
| Anomaly | fase + strike | `phaseT`, `strikeT` | fase legível, sequência não unificada | 0,30 s reais | strike real de 0,34 s | baixo |
| Swarm | contato em zigue-zague | distância, `wob` | parecia Chaser pequeno | proximidade real | contato real | baixo |
| Orbiter | projétil orbital | `fireT`, distância <430 | transição orbital/tiro pouco clara | últimos 0,48 s | criação real do projétil | baixo |
| Bulwark | contato + defesa frontal | `shieldAng`, distância | frente forte, mas pose pouco enfática | proximidade real | contato real | baixo |
| Splitter | contato; divide na morte | distância e fissura | propriedade pouco viva | tensão próxima ao contato | contato real | baixo |
| Phantom | contato/intangibilidade | `ghostT`, `phT` | retorno ao perigo abrupto | últimos 0,34 s de `ghostT` | materialização real | baixo |
| Singular | pull contínuo + reflexão instantânea | distância <420; proc de reflexão | raio e estados pouco explícitos | influência espacial real | pull observado; pulso no proc de reflexão | baixo |

## Extensão da fundação

O objeto visual O(1) recebeu campos escalares de ataque:

- `attackState`;
- `attackT`;
- `attackDuration`;
- `attackP`;
- `attackDir`;
- `attackRange`;
- `attackStyle`.

Não há arrays, callbacks ou listeners. APIs novas:

- `visualAttackObserve`: espelha timer/proximidade mecânicos;
- `visualAttackTrigger`: registra uma ação mecânica que ocorreu;
- `visualAttackIdle`: limpa observação que deixou de ser verdadeira;
- `visualAttackCancel`: remove telegraph em morte/cancelamento;
- `visualEnemyAttackPose`: produz pose somente com ataque ativo;
- `drawCommonAttackCue`: desenha cues corporais específicos;
- `drawSingularInfluence`: mostra o raio mecânico de 420 px.

A sequência visual curta `active → recover → idle` é atualizada por
`visualTimelineTick`. Ela não altera dano nem vulnerabilidade.

## Perfis por família

Os perfis existentes foram estendidos com:

- `attackFamily`;
- `anticipationStyle`;
- `activeStyle`;
- `recoveryStyle`.

Famílias reais usadas: `contact`, `ranged`, `heavy-contact`, `summon`,
`stealth`, `swarm`, `orbital`, `defensive` e `control`. Nenhum perfil replica
campos de `EDEFS`.

## Solução por inimigo

### Chaser

Comprime a silhueta quando entra na faixa de 54 px além do contato real. O
contato efetivo dispara um thrust curto e recovery visual. A proximidade não
causa dano nem muda velocidade.

### Shooter

Nos últimos 0,42 s positivos de `fireT`, dentro do alcance mecânico de 560 px,
o corpo comprime e o emissor cresce com uma linha local curta. A linha não é um
laser e não promete trajetória até o jogador. O estado active nasce exatamente
junto com o projétil.

Se o Shooter estiver fora de alcance enquanto `fireT` vence, a mecânica antiga
pode disparar imediatamente ao voltar ao alcance. Não foi adicionado atraso
silencioso; nesse caso limite não existe windup completo.

### Tank

Usa brace de baixa amplitude, coerente com massa pesada, seguido por ram visual
no contato e assentamento. Não recebeu círculo, partícula ou velocidade nova.

### Spawner

`charging/chargeT` alimentam `rift-open`; a invocação real dispara `spawn` e
recovery. O renderer de fenda preexistente continua sendo a assinatura visual.

### Anomaly

A fase mecânica de 0,30 s alimenta `phase-out`; o reaparecimento real e
`strikeT=.34` disparam active. Nenhuma posição visual falsa ou teleport extra
foi criado.

### Swarm

As asas combinam uma fase espacial de grupo com `visualSeed` individual
determinístico criado sem consumir RNG. Membros próximos compartilham parte do
ritmo, mas não ficam perfeitamente sincronizados. Não há scan de vizinhos,
partículas ou O(n²) novo. Próximo ao contato, as asas fecham.

### Orbiter

Nos últimos 0,48 s de `fireT`, os dois elementos orbitais convergem para o eixo
do emissor. Isso é estruturalmente distinto do núcleo/cano do Shooter. Órbita,
raio desejado de 210 px, targeting, projétil e cadência permanecem intactos.

### Bulwark

O draw usa `shieldAng` como orientação quando disponível, correspondendo
exatamente à frente defensiva mecânica. Chevrons curtos e brace reforçam o lado
protegido. Cone de 2,05 rad e multiplicador de dano 0,28 permanecem iguais.

### Splitter

A fissura abre visualmente em dois lóbulos na aproximação. Nenhum filho visual
ou mecânico é criado; a divisão real continua exclusivamente em `killEnemy`.

### Phantom

Nos últimos 0,34 s de `ghostT`, o contorno fecha e a forma recupera proporção.
A posição desenhada é a posição mecânica real. Ao final de `ghostT`, um active
curto marca a materialização. Não há fake teleport.

### Singular

Um círculo tracejado discreto usa exatamente 420 px, o mesmo limite do pull.
Quando o jogador está dentro, marcadores no eixo entidade→jogador comunicam a
atração. A reflexão não possui janela mecânica: portanto não foi inventado
windup. Um arco de sentido inverso aparece somente quando o proc real de 35%
ocorre. Pull e reflection usam forma/ritmo distintos, não apenas cor.

## Precedência e interrupção

Hurt continua compondo com ataque, sem reiniciar timer mecânico. Ataque possui
campos independentes da timeline genérica de hurt. `killEnemy` chama
`visualAttackCancel` antes do encerramento, impedindo telegraph órfão. Estados
active/recover são visuais e não criam stun, slow ou vulnerabilidade.

## Pureza e determinismo

- draw não modifica posição, HP, raio, timers, velocidade, alvo ou shield;
- os helpers novos de draw não usam `Math.random`/`rand`;
- `visualSeed` do Swarm é determinístico e não consome o RNG do gameplay;
- não há relógio de parede;
- nenhum novo gradient ou shadowBlur;
- cues usam paths curtos e somente durante estados relevantes.

## Performance

O caminho neutro do A-FIX #1 permanece:

- entidade sem state: nenhum state criado no update/draw;
- draw idle não chama cálculo de pose de ataque;
- draw idle não chama `drawCommonAttackCue`;
- nenhuma transformação PR15.5-B adicional;
- distância de contato reutiliza `d` já calculado, sem novo `hypot`;
- somente entidades ativas pagam pose/cue/transforms;
- zero alocação por frame nos helpers;
- estado continua O(1).

Benchmark lógico local:

| Mistura | Mediana por lote | States/poses | Transforms máximos |
|---|---:|---:|---:|
| 46 idle | 49,640 ms | 0 | 0 |
| 40 idle + 6 atacando | 152,702 ms | 6 | 18 |
| 23 idle + 23 atacando | 421,421 ms | 23 | 69 |
| 46 atacando | 804,838 ms | 46 | 138 |

Os números são lotes Node e não FPS. Demonstram proporcionalidade ao número de
entidades ativas. FPS real deve ser validado em playtest Electron.

## Testes

`tests/pr15-5-b-common-enemy-readability.test.js` contém 132 checks cobrindo:

- lazy/fast paths do A e A-FIX;
- 11 perfis e ausência de stats duplicados;
- windup/active/recover/cancelamento;
- Shooter e Orbiter reais;
- contato sem alteração de hitbox/dano antecipado;
- Swarm determinístico e sem scan;
- Bulwark alinhado à defesa;
- Phantom sem teleport visual;
- Singular com raio real e reflexão honesta;
- pureza de 20 draws para cada arquétipo;
- stress, finitude, arrays e caches;
- invariantes mecânicos.

## Limitações e dívida adiada

- não há morte autoral: PR15.5-C;
- hurt por material/família continua mínimo: PR15.5-C;
- melees e arma física: PR15.5-D;
- muzzle, impacto e trails: PR15.5-E;
- minibosses e transformação do Paradoxo: PR15.5-F;
- otimização global e profiling final: PR15.5-G;
- Shooter que reentra no alcance com timer vencido mantém disparo imediato por
  equivalência mecânica;
- reflexão da Singular continua sem antecipação porque é um proc instantâneo,
  não uma janela mecânica.

# ECHO — PR15.5-A · Fundação de Estado, Pose e Gramática Visual

## Escopo

O PR15.5-A é **infraestrutura**. Ele não é o redesign visual dos inimigos,
armas, minibosses ou de O Paradoxo. O redesign completo começa nos blocos
seguintes.

A implementação preserva HP, dano, velocidade, hitboxes, cadência, alcance,
projéteis, comportamento tático, economia e contratos de persistência.

## Problema

O combate possuía timers visuais isolados (`flashT`, `recoil`, `spawnT` etc.),
mas não uma camada comum e segura para poses, timelines e notificações visuais.
Adicionar animações diretamente às rotinas mecânicas aumentaria o risco de fazer
o desenho controlar dano, cooldown ou colisão.

## Arquitetura

A fundação está no bloco `PR15.5-A · FUNDAÇÃO DE ESTADO, POSE E GRAMÁTICA
VISUAL`, em `index.html`.

Cada entidade pode receber preguiçosamente um único objeto efêmero `visual`.
Ele é O(1), não contém arrays, listeners ou callbacks e guarda somente:

- estado/timeline atual;
- tempo, duração, fase e conclusão;
- último evento visual e sua duração;
- origem do último impacto;
- recoil visual.

A atualização ocorre nas rotinas normais das entidades (`updateEnemy`,
`updatePlayer` e `updateEcho`), sem um loop global adicional.

## Visual state

APIs principais:

- `visualState(entity)`;
- `visualReset(entity)`;
- `visualTimelineStart(entity, state, duration, phase)`;
- `visualTimelineTick(entity, dt)`;
- `visualTimelineProgress(entity, easing)`;
- `visualTimelineCancel(entity)`;
- `visualNotify(entity, event, data)`.

Estados reconhecidos: `idle`, `move`, `windup`, `active`, `recover`, `hurt`,
`dying`, `spawn`, `recoil` e `charge`. Estado desconhecido faz fallback seguro
para `idle`.

Entradas não finitas e `dt` negativo são neutralizados. O evento mais recente
substitui o anterior; não existe fila crescente.

## Timeline

A timeline oferece duração, progresso normalizado, fase, término e cancelamento.
Ela é exclusivamente visual: nenhum cálculo de dano, hitbox ou cooldown consulta
a timeline neste bloco.

Uma timeline concluída conserva a informação de conclusão para consulta de
progresso `1`; uma timeline cancelada volta a progresso `0`.

## Easing

Foram adicionados apenas cinco easings pequenos e testáveis:

- `linear`;
- `easeIn`;
- `easeOut`;
- `easeInOut`;
- `overshoot` leve.

Todos normalizam a entrada e protegem contra `NaN`/`Infinity`.

## Pose procedural

`visualPose` cria/sanitiza uma pose neutra ou parcial. `visualPoseCompose`
combina poses. Os parâmetros disponíveis são:

- `offsetX`, `offsetY`;
- `rotation`;
- `scaleX`, `scaleY`;
- `recoil`;
- `lean`;
- `squash`, `stretch`;
- `alpha`.

Transforms são aplicados somente no contexto Canvas. `entity.x`, `entity.y`,
`entity.r`, hitboxes e demais coordenadas mecânicas não são alterados. Dois
objetos scratch são reutilizados nos caminhos quentes para evitar alocação de
pose por frame.

## Perfis declarativos

`ENEMY_VISUAL_PROFILES` descreve gramática visual dos 11 arquétipos por:

- massa;
- material;
- locomoção;
- hurt;
- death;
- ataque.

Não replica nenhum stat de `EDEFS`.

`weaponVisualProfile(def)` deriva categoria, muzzle, recoil, impacto, trail e
movimento melee diretamente da definição existente em `WEAPONS`. Assim, não há
segunda tabela concorrente das 27 armas.

## Eventos visuais

`visualNotify` é uma chamada direta, sem EventEmitter. Não registra listeners e
não cria dependências circulares. Neste bloco reconhece as provas de integração
`hurt` e `weaponFire`; eventos futuros podem reutilizar o mesmo canal limitado.

## Integração de hurt

`damageEnemy` mantém todo o pipeline anterior e, depois de aceitar/processar os
modificadores básicos do dano, notifica `hurt` com a origem do impacto.

O renderer consulta `visualHurtPose` e aplica uma reação propositalmente sutil:

- deslocamento máximo inferior a um pixel local;
- rotação máxima de aproximadamente 0,018 rad;
- micro squash/stretch de até 2,5%.

`flashT`, partículas, HP, knockback e morte anteriores continuam intactos.

## Integração de weapon fire

`fireWeaponFrom` notifica `weaponFire` antes de despachar para melee, beam ou
projétil. O recoil visual é consultado por `drawUnit`/`drawWeaponSprite` e se
recupera com custo O(1).

O recoil mecânico/legado continua existindo. O renderer usa o maior valor entre
o recoil antigo e o novo, evitando duplicar amplitude. Cadência, cooldown,
origem, velocidade, dano e quantidade de projéteis não foram alterados.

## Pureza do draw

Os helpers novos não usam `Math.random`, `Date.now` ou `performance.now`.
`drawEnemy` deixou de inicializar `phase0` durante o desenho: quando o campo está
ausente, usa uma fase local determinística derivada da entidade, sem mutação.

Caches globais preexistentes continuam sendo exceções autorizadas.

## Persistência

`visual` não foi adicionado a:

- checkpoint;
- Save/Continue;
- slots;
- memória temporal;
- Fracture Director;
- Sandbox;
- DEV.

O objeto é reconstruído preguiçosamente após Continue ou descartado junto com a
entidade. Nenhum contrato ou versão de save mudou.

## Performance

- um objeto pequeno por entidade, criado somente quando necessário;
- nenhum array por entidade;
- nenhum listener/callback;
- timeline O(1);
- nenhum loop global novo;
- dois objetos scratch para poses nos caminhos quentes;
- nenhum novo `shadowBlur`, gradient, path ou partícula;
- nenhum `JSON clone` em runtime.

O PR15.5-A não tenta resolver os custos preexistentes de blur, paths,
trigonometria ou separação O(n²).

## Testes

A suíte `tests/pr15-5-visual-foundation.test.js` contém 95 checks cobrindo:

- inicialização, defaults, finitude, reset e fallback;
- timeline, progressão, término, cancelamento e `dt` inválido;
- easings e monotonicidade aplicável;
- pose neutra, composição e proteção numérica;
- hurt real por `damageEnemy`;
- fire real por `fireWeaponFrom`;
- pureza de draw;
- ausência de aleatoriedade nos helpers;
- não persistência;
- stress de 46 entidades por 5.000 frames;
- assinaturas mecânicas dos 11 inimigos;
- preservação de 27 armas e 8 minibosses.

O harness compartilhado apenas expõe as novas APIs para testes; não modifica o
runtime de produção.

## Compatibilidade

Foram preservados inimigos, elites, minibosses, boss, Ecos Sombrios, jogador,
Echos aliados/hostis, armas, projectiles, melee, beam, Sandbox, DEV,
Save/Continue, PR15, Fracture Director, facções, moralidade, relationship,
shields, status, economia e vitória.

Não foi adicionada instrumentação DEV: a suíte automatizada e o Sandbox atual
são suficientes para validar esta fundação sem ampliar o painel.

## Limitações e próximos blocos

Ainda não existem neste bloco:

- telegraphs novos;
- poses autorais por inimigo;
- timelines mecânico-visuais sincronizadas;
- animações completas dos sete melees;
- hurt e morte autorais por família;
- muzzle, trail e impacto por categoria;
- transformação adicional do boss;
- sprites ou assets raster;
- otimizações estruturais de Canvas.

Esses itens pertencem aos próximos blocos do PR15.5 e devem consumir esta
fundação sem transferir autoridade mecânica para o renderer.

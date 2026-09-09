# ECHO — PR15.5 PERFORMANCE AUDIT #1

## 1. Conclusão executiva e limites da evidência

O jogador observou no **Electron** aproximadamente 60 FPS no início e 55 FPS sob carga. Esse dado humano é aceito como degradação real; não foi substituído por uma estimativa do headless.

**Hipótese principal para investigar no Electron:** pressão de renderização Canvas 2D — pinturas com shadowBlur, composição aditiva, muitos paths/FX e área rasterizada — somada ao custo crescente de colisão projétil × inimigo e separação inimigo × inimigo. No laboratório, a rasterização/readback cresce fortemente com a carga; uma ablação temporária de blur reduz esse custo. Isso prioriza a investigação, **mas não identifica conclusivamente a causa dominante na máquina do jogador**.

O limitador existente explica a referência próxima de 60, não torna a queda para 55 irrelevante. O governador de qualidade tem uma faixa sem ajuste que inclui aproximadamente 55 FPS e, portanto, não tenta recuperar essa perda pequena imediatamente.

Foram entregues somente:

1. Métricas visíveis e amostrando durante overlays da sessão, com correção de stacking e layout onde havia conflito real.
2. Vértices unitários de estilhaços reutilizados: mesma geometria e ordem de desenho, sem trigonometria repetida por vértice.
3. Escritas textuais idempotentes no HUD; guarda escalar de resíduos antes da formatação.
4. Instrumentação externa DEV, fixtures e benchmarks reproduzíveis, sem código de profiler carregado em release.

**Não se afirma recuperação de 55 para 60 FPS nem ausência de impacto no Electron.** Os ganhos demonstrados são estruturais. Os tempos antes/depois de navegador não mostram ganho temporal estável; há ruído e casos mais lentos. O render, sobretudo a rasterização, continua sendo trabalho real a validar no replaytest.

## 2. Base, método e escopo

Verificação feita antes de alterar arquivos:

- Branch: `arena/01a086e2-echojogo`.
- HEAD: `b4654f191a16214712bd35501c1b242b1b1cbca2`.
- `git status --short`: sem saída; working tree limpo.
- Baseline executado: **50 suítes, 2930 checks, 0 falhas**.

As repetições da solicitação ocorreram durante esta mesma execução. Os arquivos já criados eram trabalho desta auditoria, não alterações preexistentes inesperadas. Não houve reset, checkout, pull, PR ou merge. Nenhum avanço para PR15.5-C/D/E/F/G.

### Três níveis de evidência

- **Leitura do código:** fluxo, complexidade, produtores/consumidores, estado e alocações possíveis.
- **Node + Canvas mock:** número de comandos, mudanças de estado, trigonometria, leituras de candidatos, escritas de DOM e equivalência de argumentos. Não mede rasterização nem FPS.
- **Chromium headless/SwiftShader:** tempo de submissão e tempo de render + leitura síncrona do framebuffer, além de tempos inclusivos da sonda e verificações de UI. Não representa GPU/driver/áudio/DPI do Electron do jogador.

Benchmarks usam cenas sintéticas, sem áudio ativo, inicialmente sem Echos aliados/presença PR15/facção, para isolar carga básica. Não são uma gravação do playtest humano. A sonda cobre as funções desses sistemas quando estiverem ativos em um replay real. O cenário I contém **duas Singular**, não duas presenças PR15.

Dados completos e inventário textual de blur: `audit_pr155/performance_results.json`. O arquivo identifica a base e o SHA-256 do `index.html` auditado. Não contém credenciais, dados pessoais ou saves humanos.

## 3. Ordem real do loop

### Entrada e controle temporal

`loop(now)` agenda o próximo `requestAnimationFrame(loop)` e só depois aplica o gate:

1. Sonda inicial de refresh (`refreshProbe`, primeiras 40 chamadas).
2. Gate adaptativo: callbacks adiantados podem retornar antes do update/render/sampler.
3. `raw = (now-last)/1000`; clamp superior de 0,05 s; suavização `dtSmooth` e seleção de `dt`.
4. Sanitização do input/foco, pausa no Electron sem foco, `updateRenderGovernor`, gamepad e áudio.
5. Decaimento de banner/aberração e atualização musical.
6. Determinação de `frozen` para modais e telas não interativas.

### Simulação, somente em `state==='play'`

1. Avança `runTime` e `speechTick`.
2. `updatePlayer`: movimento, disparo/especial, itens, gravação do Echo etc.
3. `updateEcho` para os slots existentes.
4. `updateEnemy` para todos os inimigos; bosses/minibosses/sombras delegam a seus updaters.
5. Compactação in-place dos inimigos mortos.
6. `updateProjectiles`: movimento, homing/minas/ricochete, alcance/vida, colisões, dano/procs e remoções.
7. `updateSwings`, `updateArcs`, `updateOrbs`, `updatePickups`.
8. `updateAllies`, com wrappers reais: aliados → `factionPresenceUpdateEntity`/`fpIndicatorTick` → `pr15PresUpdate` → `pr15IntentUpdate`.
9. `updateResonance`.
10. HUD de boss/miniboss, agendamento de beacon/eventos, eventos de arena e microeventos.
11. Desbloqueios quando sujos; fim de onda, limpeza de tiros inimigos, sedimento de facção/Fracture e spawn/loja.

Em `fracture`, executa `tickFracture` e desacelera efeitos. A lógica mecânica não é movida pelo sampler.

### FX, draw e HUD

1. `parts`: uma exponencial de atrito para o frame, atualização e compactação in-place; expirados voltam ao pool.
2. `ftexts`: envelhecimento/compactação in-place.
3. `render()`, em try/catch próprio. O wrapper PR15 acrescenta `pr15IntentEdge` após o renderer base.
4. `hudAcc += dt` e `updateHUD()`; wrappers de Resíduos/Fractura executam mesmo quando o HUD base retorna pelo throttle.
5. `metricsTick(now)` — mesma fonte de frames, janela real de 250 ms, também nos overlays.
6. Registro TAB, quando aberto, com cadência de aproximadamente 0,12 s e assinatura de estado.
7. `devTick(raw)`.

### Ordem real de renderização

`render`: higiene de matriz/alpha/composição/blur → câmera/shake → fundo/cache de piso → transformação para mundo → XP → `drawWorldExtras` (arena, pickups, aliados, beacon, facção e wrappers PR15) → inimigos/status → arcos → Echos → jogador → beams → swings → projéteis → partículas → textos → falas → restores → indicadores de elite → flashes/tempo congelado/aberração/fratura → indicador de borda PR15.

A ordem foi preservada, inclusive blends, câmera, sorteios visuais e isolamento de estado.

## 4. Cap, VSync, gate e qualidade

### Limitador e Electron

- `TARGET_FPS=60`, `FRAME_MS=1000/60`.
- RAF padrão do Chromium; VSync não foi desativado.
- O gate só é ativado quando a sonda inicial estima intervalo menor que 13,2 ms, aproximadamente acima de 75,8 Hz. Em 60 Hz normalmente fica 1:1 com RAF.
- Com gate ativo, retorna quando `gateElapsed < FRAME_MS - 0.6`; depois ajusta `frameGate` pelo resto. Jitter perto desse limite pode mudar o padrão de frames aceitos; não foi recalibrado.
- Clamp de `raw` em 50 ms e suavização afetam a simulação e o governador, **não** FPS/FRAME do painel, que usam o timestamp real dos frames aceitos.
- `main.js` habilita rasterização GPU, zero-copy e Canvas 2D acelerado; solicita D3D11 no Windows. Não usa `disable-frame-rate-limit` ou `disable-gpu-vsync`; `backgroundThrottling` está ativo.
- Essas flags são solicitações, não prova de aceleração efetiva. Driver/fallback/compositor precisam ser vistos na máquina real.

### O que LOW/MEDIUM/HIGH realmente fazem

`applyCfg` inicia `renderQuality` em **0,62 / 0,84 / 1**. `resize` usa:

- orçamento de pixels: `(fullscreen ou ocupando display ? 2.200.000 : 2.400.000) × renderQuality`;
- DPR desejado limitado a 2;
- DPR efetivo: `max(.42, min(DPR desejado, sqrt(orçamento/(largura×altura))))`.

Não reduz número de inimigos, colisões, projéteis, paths ou calls de blur. Reduz somente o framebuffer físico quando o orçamento fica abaixo do viewport/DPR desejado. A opção separada **DENSIDADE DE PARTÍCULAS** aplica seu fator já existente de aproximadamente 0,35; não foi alterada.

No headless com DPR nativo 1 e heurística de display preenchido:

| Viewport | LOW | MEDIUM | HIGH |
|---|---|---|---|
| 960×540 | 960×540 | 960×540 | 960×540 |
| 1920×1080 | 1557×876 | 1813×1020 | 1920×1080 |
| 3840×2160 | 1613×907 | 1813×1020 | 1978×1112 |

Consequência: em resolução pequena, trocar LOW/MEDIUM/HIGH pode não reduzir custo algum de rasterização; em 1080p/4K a área muda significativamente. O mínimo de DPR 0,42 também limita o quanto LOW reduz em 4K.

O governador roda em play, usa janelas de 2,5 s e cooldown de 3,5 s. Reduz qualidade somente acima de **20,5 ms**; eleva abaixo de **17,4 ms**, podendo levar LOW/MEDIUM até 1. Aproximadamente 55 FPS corresponde a 18,18 ms e fica nessa faixa sem ajuste. A configuração não é um teto permanente de qualidade. Nada disso foi alterado neste bloco.

## 5. Cenários e operações medidas

Todos são fixtures DEV + Sandbox; a preparação recusa run normal. Stress não cria 70 inimigos: respeita 46 e ultrapassa 70 entidades ao somar tiros/FX. `parts` nunca supera 900 nas fixtures.

| Cena | Descrição | N / P / FX | Candidatos PE | Separação | Paths / save / pinturas com blur | sin+cos antes → depois |
|---|---|---:|---:|---:|---:|---:|
| A | vazio | 0 / 0 / 0 | 0 | 0 | 14 / 9 / 7 | 2 → 2 |
| B | leve | 10 / 12 / 46 | 120 | 100 | 139 / 45 / 30 | 94 → 52 |
| C | médio | 25 / 60 / 198 | 1500 | 625 | 421 / 110 / 67 | 324 → 144 |
| D | pesado | 46 / 150 / 436 | 6900 | 2116 | 872 / 210 / 122 | 684 → 282 |
| E | stress Sandbox | 46 / 260 / 758 | 11960 | 2116 | 1292 / 266 / 130 | 984 → 282 |
| F | Swarm-heavy | 46 / 30 / 109 | 1380 | 2116 | 377 / 119 / 147 | 196 → 94 |
| G | projectile-heavy | 46 / 360 / 116 | 16560 | 2116 | 768 / 152 / 111 | 384 → 282 |
| H | FX-heavy | 10 / 20 / 976 | 200 | 100 | 1043 / 960 / 59 | 7252 → 52 |
| I | 2 Singular + ranged + Swarm | 46 / 150 / 379 | 6900 | 2116 | 838 / 198 / 110 | 454 → 106 |

`candidatos PE`: leituras reais do array de inimigos feitas por `updateProjectiles(0)` em um corredor sem colisões; representam o pior caso de busca sem early hit dessa fixture. `separação`: leituras dos candidatos, incluindo o próprio inimigo antes do skip; 46² = 2116, com 2070 outros pares dirigidos antes de demais guards. Não houve redução dessas verificações na entrega.

### Canvas no cenário pesado D

Por render: **210 save + 210 restore**, **872 beginPath**, 453 arcos, 218 drawImage, 541 fills, 396 strokes, 24 textos, 279 transforms e **3280 atribuições de estado Canvas**. Foram emitidas 122 pinturas com `shadowBlur>0`, não 122 alterações do atributo. Os números permanecem iguais depois da otimização geométrica.

Em H, 900 estilhaços: **960 save + 960 restore**, 1043 paths, 921 drawImage e 6077 atribuições de estado. O cache elimina trigonometria, não essas pinturas, blends ou transforms.

### Tempos de navegador, sem conversão para FPS

Sete amostras por cena fixa, depois de warmup; execuções finais antes/depois isoladas da suíte completa. `render + leitura` inclui submissão, rasterização forçada e cópia CPU de `getImageData`. Esse readback é **intrusivo e exclusivo do benchmark**, podendo mudar o comportamento do pipeline; não foi adicionado ao jogo.

| Cena | Submissão antes (ms) | Depois (ms) | Render + leitura antes (ms) | Depois (ms) | Pixels |
|---|---:|---:|---:|---:|---|
| A | 0,30 | 0,30 | 34,30 | 32,60 | Idênticos |
| B | 0,60 | 0,60 | 96,30 | 91,70 | Idênticos |
| C | 1,10 | 1,10 | 183,10 | 180,60 | Idênticos |
| D | 1,50 | 1,70 | 309,40 | 310,60 | Idênticos |
| E | 2,50 | 2,20 | 413,30 | 412,90 | Idênticos |
| F | 0,70 | 0,80 | 102,10 | 100,40 | Idênticos |
| G | 1,90 | 1,80 | 260,40 | 257,70 | Idênticos |
| H | 4,40 | 4,70 | 515,10 | 526,70 | Idênticos |
| I | 1,70 | 1,80 | 229,70 | 249,90 | Idênticos |

Não há melhora temporal consistente. Por exemplo, H remove 7200 chamadas trigonométricas, mas seu total com readback não caiu na execução final. Essas amostras não justificam prometer ganho de milissegundos ou FPS. Em execuções concorrentes com a suíte, os tempos ficaram ainda maiores; isso reforça a necessidade de não usá-los como teste de aprovação.

### Ablação de shadowBlur, somente diagnóstico

Na versão-base, desligar temporariamente todos os setters de blur **apenas dentro do benchmark** mudou a mediana de render+leitura:

- D pesado: **309,4 → 161,3 ms**.
- F Swarm-heavy: **102,1 → 90,2 ms**.
- H FX-heavy: **515,1 → 327,2 ms**.

Isso mostra sensibilidade real desse ambiente a blur/rasterização, mas não significa que cada blur tenha custo igual ou que a mesma proporção exista no Electron. **Nenhum blur foi removido da entrega.** H continua com custo elevado sem blur porque possui 900 estilhaços, blends e paths.

### Perfil de CPU/submissão por seção

Sonda externa sobre oito passos reais do loop; totais por seção divididos pelos oito frames. Pai inclui filhos: **não somar linhas aninhadas**. Chamadas `performance.now` e wrappers acrescentam overhead; rasterização assíncrona pode ficar fora de `render`.

| Seção, versão-base | D pesado (ms/frame) | G tiros (ms/frame) | H FX (ms/frame) |
|---|---:|---:|---:|
| `frame_total` | 3,587 | 3,663 | 7,013 |
| `update_total` | 1,425 | 0,963 | 0,738 |
| `fx_update` | 0,175 | 0,050 | 0,625 |
| `render` | 2,112 | 2,638 | 6,200 |
| `updateEnemy` | 0,787 | 0,138 | 0,000 |
| `updateProjectiles` | 0,412 | 0,675 | 0,037 |
| `drawEnemy` | 0,787 | 0,537 | 0,125 |
| `drawProjectile` | 0,425 | 1,750 | 0,037 |
| `updateHUD` | 0,037 | 0,062 | 0,075 |

Zeros podem resultar da resolução do relógio/amostra curta, não de ausência de execução. Totais antes/depois de todas as seções estão no JSON; não são teste temporal de aprovação.

`fx_update` mede `parts`/`ftexts`; arcos/swings têm seções próprias. O draw de partículas/textos está inline no renderer: o residual de `render` depois das funções nomeadas inclui FX, culling/travessias, XP e overlays Canvas, **não é um cronômetro exclusivo de partículas**. O cenário H isola o peso relativo de FX sem inventar essa separação.

## 6. Inimigos: update e draw

`updateEnemy` usa um `Math.hypot(dx,dy)` para distância/direção ao alvo e reutiliza `d`. `pickTarget` compara distâncias quadráticas entre jogador e até dois Echos. Swarm/Orbiter precisam de outra normalização para o vetor de movimento alterado, portanto seus dois hypot não são simplesmente duplicação do mesmo dado.

- Separação percorre `enemies` em cada inimigo comum, após integrar posição. É sequencial e sensível à ordem: não é seguro trocar por processamento de pares únicos ou spatial hash sem estudar equivalência mecânica.
- `sqrt` na separação só ocorre se os discos se sobrepõem e a distância não é quase zero.
- Bulwark calcula `atan2(dy,dx)` para `shieldAng` e novamente para orientação. Ranged pode calcular o mesmo ângulo no cue/disparo e no fim do update. São candidatos pequenos a reutilização local, não a causa provada da queda.
- Elites têm aura/escudo; status podem acionar dano, procs e FX. Ausência de status e estados visuais neutros continua com os fast paths aprovados.
- `drawEnemy` usa sombras projetadas, corpos, olhos, canhões e anéis. `visualHurtPose` mantém scratch; não se reintroduziu pose/transform contínuo de ataque.
- Anomaly contém uma closure local `tri` e jitter com `rand`; Tank/Spawner/Bulwark têm trigonometria geométrica repetida. O sampler não os modifica.

Contagem dinâmica por comum, sem elite, hurt ou flash, com estado controlado:

| Tipo | Save/restore (pares) | Paths | Pinturas com blur | sin+cos draw | hypot update |
|---|---:|---:|---:|---:|---:|
| chaser | 2 | 10 | 1 | 1 | 1 |
| shooter | 4 | 10 | 2 | 2 | 1 |
| tank | 4 | 7 | 4 | 26 | 1 |
| spawner | 3 | 9 | 4 | 29 | 1 |
| anomaly | 3 | 8 | 1 | 13 | 1 |
| swarm | 2 | 5 | 3 | 2 | 2 |
| orbiter | 2 | 5 | 1 | 3 | 2 |
| bulwark | 3 | 6 | 3 | 11 | 1 |
| splitter | 2 | 3 | 1 | 1 | 1 |
| phantom | 2 | 3 | 2 | 1 | 1 |
| singular | 2 | 6 | 1 | 1 | 1 |

Tank/Spawner têm mais trigonometria e múltiplas pinturas com blur; Shooter usa mais save/restore e paths; Swarm é geometricamente simples, mas faz três pinturas com blur por unidade, o que importa em grupo. Singular só acrescenta o círculo de influência na condição existente. Esses critérios não são um ranking definitivo de GPU por tipo: raio, área, alpha e estado também importam.

## 7. Projéteis e armas

### Colisão e complexidade

`updateProjectiles` percorre o array de trás para frente:

- Minas: busca inimigos após armar; detonam por proximidade/vida.
- Homing: outra busca de alvo em `enemies`, depois correção angular/trigonométrica.
- Boomerang: retorno, orientação e limpeza de hits.
- Movimento, alcance, ricochete e expiração.
- Tiros aliados: **para cada projétil, para cada inimigo**; guards de spawn/dead/hits e teste quadrático de colisão. `p.hits.indexOf(e)` pode acrescentar custo proporcional ao histórico de perfuração.
- Tiros inimigos: jogador e até dois Echos, não a mesma busca completa de inimigos.
- Hits/detonações podem invocar loops adicionais de AoE, status/cadeia e morte.
- `splice(i,1)` remove projéteis; múltiplas remoções de posições intermediárias podem causar deslocamentos quadráticos em um frame. Não é sempre O(P²): remover caudas consecutivas é barato.

**Nenhuma colisão, hitbox, dano, velocidade, duração, alcance, ordem, cooldown ou condição de impacto foi modificada.**

### Render e alocação

`drawProjectile` já usa halo `glowSprite` cacheado, **não shadowBlur próprio e não save/restore próprio**. Cada tiro troca composição para `lighter`, pinta halo, volta para `source-over` e pinta corpo/rastro. Tiros não-orb usam hypot para orientar o rastro; orbs calculam seno com o mesmo `runTime*10`, candidato a cache escalar futuro, não aplicado.

Não existe pool de projéteis. `fireWeaponFrom` cria objeto por tiro, `hits` é criado sob demanda, e procs podem criar fragmentos. Origem do disparo e sin/cos da mira se repetem por pellet. Não se mexeu nisso sem perfil específico de arsenal, nem se reduziu o número de tiros.

## 8. FX, duração, limpeza e pooling

A métrica FX continua sendo `parts + arcs + swings + ftexts`. Não é contagem de todo trabalho visual.

| Estrutura | Produção e vida | Update/remoção | Draw/custo |
|---|---|---|---|
| `parts` | Hits, armas, status, mortes, especiais, anéis e estilhaços. Produtores usuais limitam a 900. | Uma exponencial por frame; compactação O(F), `partRelease` em expirados; pool limitado a 900. | Culling existente. Partícula comum: círculo sem save; anel: path/stroke; estilhaço: halo aditivo + save/translate/rotate/path/restore. |
| `arcs` | `chainShock` e procs; vida típica do arco criado pela cadeia: 0,18 s. Não tem teto global próprio. | Loop reverso e splice; só em play. | Cada arco tem save/restore, blur 10, quatro segmentos e jitter via RNG. Sem culling novo para não pular sorteios. |
| `swings` | Corte de arma, por exemplo 0,26 s em `fireMelee`; não tem teto global próprio. | Segue emissor, envelhece, splice; só em play. | Um save/restore e três paths por corte; blur até 26×k em duas strokes. |
| `ftexts` | Números/avisos; `floatText` usa 1,1 s. `FTEXT_MAX=52` limita dano não-crítico/procs; críticos e chamadas diretas a floatText podem ultrapassá-lo. **Não é teto universal.** | Compactação O(T) no loop. | Culling e reaproveitamento de font quando tamanho não muda; fillText por texto. |

Estilhaços criados por `spawnShards` duram entre 0,5 e 1,05 s e têm 3–5 lados. Um hit corpo a corpo pode criar quatro; detonações/mortes/especiais criam rajadas maiores. Uma arma comum emite três partículas de muzzle, além das reações a hits. Não se reduziu nenhuma emissão.

Não foi encontrado crescimento ilimitado em `parts`/`partPool` dos produtores auditados. `partRelease` limpa owner/hits; reuso não mantém uma lista espelho. Arcos/swings/textos não possuem todos um cap global absoluto, embora tenham expiração; é importante observar picos com procs reais.

Em overlays, `parts`/`ftexts` avançam com `dt × .12`; arcos/swings permanecem congelados até retomar. Logo, alguns FX duram mais em tempo de parede por design, **não evidência de leak**. Alterar esse comportamento não fazia parte desta auditoria. XP e pickups podem permanecer até a coleta e ficam fora da métrica FX/ENTIDADES, embora custem update/draw.

### Otimização aplicada aos estilhaços

`SHARD_VERTICES`: três vetores congelados, 24 escalares no total, calculados uma vez com **a mesma expressão** `i/sides*TAU` do renderer anterior. Multiplicação por tamanho, transformações, desenho, cor, alpha e blend permanecem idênticos. Lados experimentais fora de 3–5 usam o cálculo original como fallback.

Em H, os 900 estilhaços distribuídos entre 3/4/5 lados evitam exatamente **7200 chamadas sin/cos por render**. Não cria cache por entidade nem novos objetos por frame. Não diminui paths, save/restore ou pinturas.

## 9. Inventário de blur e estado Canvas

Foram inventariadas **146 atribuições textuais de `ctx.shadowBlur` em 15 funções**. Isso inclui resets em zero; não significa 146 blurs executados a cada frame. Todas as linhas/expressões estão no JSON de evidências. Agrupamento:

| Função top-level precedente | Atribuições | Localização no index.html | Frequência/entidade |
|---|---:|---|---|
| `drawWorldExtras` | 30 | 13047–13354 | Por pickup/aliado/beacon e arte dos eventos; depende do estado e da quantidade. |
| `drawArcs` | 1 | 14631–14631 | Por arco vivo: blur 10 aplicado à sua stroke. |
| `drawSwings` | 2 | 16855–16864 | Por corte vivo: blur variável até 26×k, duas strokes com blur. |
| `drawBeamFrom` | 3 | 16885–16893 | Por beam ativo: gradiente, blur 22–44 e 20; inclui reset. |
| `drawWeaponSprite` | 38 | 18562–18807 | Por arma visível do jogador/Echo/silhueta; ramos por tipo, muitos resets. |
| `drawUnit` | 6 | 18846–18883 | Por corpo humano/Echo/clone; visor/arma e glows condicionais. |
| `drawBoss` | 6 | 19070–19109 | Por boss visível: peças e círculos de grande área, com resets. |
| `drawEnemy` | 34 | 19185–19514 | Por inimigo visível; ramos por tipo, elite/flash e resets. |
| `drawPlayer` | 3 | 19579–19628 | Por frame com jogador desenhado: campo do especial e retícula de controle condicionais; inclui reset. |
| `render` | 4 | 19663–19778 | Reset global e por XP; reset antes de overlays Canvas. |
| `fpDrawAnchor` | 3 | 31388–31420 | Somente com entidade da facção correspondente; reset entre primitivas. |
| `fpDrawConsortium` | 4 | 31433–31462 | Idem; um singleton de presença, não uma cópia por inimigo. |
| `fpDrawRemnants` | 4 | 31494–31513 | Idem; corpo, detalhes e resets. |
| `fpDrawDeviants` | 3 | 31530–31554 | Idem; campo/núcleo/detalhes. |
| `factionPresenceDrawEntity` | 5 | 31601–31652 | Guards/seleção do tipo, pulso de chegada e indicador; resets. |

Classificação:

- **Alta prioridade para perfil de raster:** corpos/elite em `drawEnemy`, XP/pickups em loops, estilhaços/blends, beams e grandes campos de boss. Grande quantidade/área pode pesar mais que número de setters.
- **Prioridade contextual:** sprites de arma, `drawUnit` do jogador/Echos e clones PR15, entidades de facção. Poucos emissores, mas múltiplas pinturas e afterimages.
- **Não tratar resets como efeitos:** `shadowBlur=0` é higiene necessária, não custo de raster equivalente a um blur positivo.
- **Não remover automaticamente:** preservar assinatura visual e estados aprovados exige captura comparativa de imagem e replaytest. O experimento sem blur é só ablação.

Equivalentes CSS também foram auditados: `.panel` usa backdrop-filter blur(2px); HUD tem text/box-shadow; modais, loja e DEV usam sombras maiores; vinheta e scanlines cobrem a tela. São candidatos a custo de composição/paint, principalmente com Canvas mudando por baixo, mas o benchmark do framebuffer **não mede o compositor completo do DOM**. Não foram removidos.

### Save/restore e mudanças de estado

- Comuns: 2–4 pares por corpo básico; elite/hurt pode acrescentar trabalho.
- Projétil normal: zero pares próprios.
- Partícula/anéis: zero pares próprios; estilhaço: um par por elemento.
- Arco/corte: um par por efeito; beam também isola seu estado.
- D: 210 pares; H: 960 pares, sem mudança antes/depois.

`fillStyle`, `strokeStyle`, `globalAlpha`, `lineWidth`, composição e blur variam em loops. Projéteis e estilhaços alternam `lighter/source-over` por elemento. `font` de ftexts já só muda quando tamanho muda; `speechRender` usa `textBaseline='top'` e layout de texto. Não houve agrupamento de draws, remoção de isolamento ou troca da ordem visual.

## 10. Loops aninhados e classificação

Prioridade é **provável**, não severidade causal confirmada no Electron. N = inimigos, P = projéteis, F = partículas, X = coletáveis, A = aliados, E ≤ 2 = Echos, H = hazards, K = saltos de cadeia.

| Prioridade | Trecho | Complexidade/custo | Observação |
|---|---|---|---|
| P0 | `updateProjectiles`: tiros aliados × `enemies` | O(P×N), mais `hits.indexOf` | 6900 candidatos em D; 16560 em G. Nenhuma broad phase. |
| P0 | `updateEnemy`: separação × `enemies` | O(N²) | 2116 leituras em 46; ordem sequencial influencia posições. |
| P1 | Homing/minas em `updateProjectiles` | Busca O(P×N) adicional em subconjunto | Mesmo projétil pode buscar alvo e depois percorrer colisões. |
| P1 | `detonateSpecial` com contagion | O(N²) no burst de mortes elegíveis | Loop de alvos mais loop de propagação por alvo morto. |
| P1 | `chainShock`, spread e efeitos de morte | O(K×N), com busca em hitSet; cascatas podem aproximar quadrático | Dependente do build/status/quantidade de mortes, não todo frame vazio. |
| P1 | Splice em projéteis/coletáveis/arcos/swings/aliados | Pior caso quadrático em remoções intermediárias numerosas | Não substituir por compactação sem preservar ordem e novas inserções durante hits. |
| P2 | `fireMelee` / `fireBeam` por emissor | O(emissores×N), melee também O(P) | Não existe colisão P×N para cada beam; são pipelines diferentes. |
| P2 | `updateEcho`/`echoSurvivalAdjust`, pickTarget/aura | O(E×N), E limitado a 2; pickTarget O(N×E) | Poucos Echos; várias passagens relevantes, não N² irrestrito. |
| P2 | Aliados/torres em `updateAllies` e `drawWorldExtras` | O(A×N) | `nearestEnemy` repetido no update e no draw da torre. |
| P2 | Hazards de miniboss e busca de posição PR15 | O(H) por emissor; candidatos espaciais podem testar H/N | Caps/ocorrência episódica. Facção física e presença PR15 são singletons. |

`parts` não tem loop partícula × partícula; update é linear e compactado. Pickups normalmente comparam só com jogador, não com todos os inimigos. Não se encontrou uma varredura global nova causada pelas métricas.

## 11. Alocações, GC e loops repetidos

Alocações existentes, **não todas por frame nem todas vazamentos**:

- Objeto por projétil disparado/fragmento e arrays `hits` quando perfuram.
- Arrays/objetos de procs, status e `itemEmit` em hits; listas de cadeia e efeitos de morte.
- `echoSurvivalAdjust` retorna `{x,y}`; memória/gravação da run faz `recorder.push([...])` na amostragem existente — histórico intencional da mecânica de Echos, não profiler.
- `drawEnemy` cria closure em Anomaly e strings de chave dos caches de gradientes; poses lazy/scratch existentes continuam preservadas.
- `drawBeamFrom` cria gradiente por beam desenhado.
- PR15 ativo chama `pr15PresVisualState` (objeto, closure `r3`, `dash.slice`) e paleta; afterimages reutilizam o pipeline de silhueta. Não foi refeito nem medido como ativo nas nove fixtures.
- `fractureHudChip` ainda constrói estado e chave `[...].join('|')` a cada chamada do wrapper antes de sua guarda. Seu DOM já é protegido por `hudSeen`, mas o custo de geração não desaparece pelo throttle do HUD base.
- `setChip`/HUD ainda formatam strings e fazem callbacks curtos (`find` nos dois slots, `pip` do perfil), embora agora textos iguais não sejam reescritos.
- `speechLayout` possui cache de linhas, mas a bolha ainda calcula seu posicionamento; TAB/loja criam HTML/objetos quando abertos ou reconstruídos, não continuamente em combate fechado.

Não se isolou tempo de GC natural do Electron. O benchmark de readback também cria ImageData por amostra e a instrumentação tem overhead próprio; atribuir suas pausas ao jogo seria incorreto. Próximo diagnóstico: trace de Performance/Memory no Electron durante o trecho que cai, separando raster/compositor, JS, áudio e GC. Não há alegação de leak ou causa por GC sem essa captura.

## 12. HUD/DOM: achado e correção

O HUD base tem throttle de 0,09 s, mas escrevia textos repetidos. `setChip` reseta classes e escreve rótulos; barras e classes continuam seguindo sua cadência original. O chip de boss/miniboss pode ser atualizado em play a cada frame. Essas rotinas não foram redesenhadas.

Achado concreto: wrapper de Resíduos chama `fracHudChip()` **depois** do retorno do HUD base. Com resíduo/inventário relevante, havia formatação e `textContent` por frame, mesmo sem mudança no saldo. Agora uma guarda escalar `_echoRes` no próprio nó evita ambos. Remover/recriar o nó invalida naturalmente; texto vazio força repintura. Esse campo não entra em estado mecânico/save.

`hudText(el,text)` compara `textContent` antes de escrever nas 11 células monitoradas do HUD básico/Echos. Não lê offset/bounding rect/computed style nem força layout síncrono. Não acrescenta histórico ou muda cooldowns. Não se mudou `innerHTML` de tiers, cores, widths ou classes neste bloco.

Resultado determinístico: 120 chamadas **forçadas** de `updateHUD(true)` com valores constantes, incluindo Resíduos, fizeram **1440 → 0 escritas textuais monitoradas** após warmup. Não significa que todas as escritas de style/class/HTML do HUD tenham sido eliminadas; o benchmark mede exatamente os campos documentados no script.

## 13. Culling: existente, limites e decisão

Já existe culling de DRAW em `render`/`drawWorldExtras`:

- XP: margem 16.
- Inimigos: boss 900; demais `(auraR || r || 20)+48`.
- Echos: margem 90.
- Projéteis: margem 32.
- Partículas: anel usa `r1`; demais usam tamanho/raio com margem.
- Ftexts: margem 60.
- Pickups/aliados: margens 24/48.
- Presença PR15: margem 150 e early-return com alpha muito baixo.

Update, colisões e existência continuam integrais fora da câmera. O renderer não apaga entidades. Boss/beams têm alcance/telegraphs maiores que o centro do corpo; não se apertaram margens.

Arcos, swings e beams não têm todos um culling por centro; um segmento/feixe pode atravessar a tela com emissor fora dela. Além disso, `drawArcs` usa `rand` e o draw de Anomaly/aberração/fratura também consome RNG compartilhado: pular novos draws poderia alterar a sequência mecânica futura.

**Nenhum culling novo foi aplicado:** os conjuntos volumosos já têm culling, e a auditoria não demonstrou ganho de uma expansão segura nos restantes. Expandir por centro sem bounds de segmento/glow/trail ou sem preservar sorteios seria otimização especulativa. Os testes confirmam o culling existente e que update/entidades continuam presentes.

## 14. Top 10 custos prováveis

Todos os caminhos abaixo estão em `index.html`; prioridade relativa muda com build/cena/hardware.

| # | Função/sistema | Frequência / complexidade | Evidência e impacto provável | Risco de otimização |
|---|---|---|---|---|
| 1 | `drawEnemy`, blur/overdraw e corpos | Por inimigo visível; O(N) em comandos, custo de área de pixels | D tem 122 pinturas com blur no frame completo; ablação reduz raster/readback fortemente. Principal hipótese visual para trace Electron. | Alto ao remover/trocar arte; nada removido. |
| 2 | FX inline em `render` | O(F), até 900 parts usuais | H: 960 pares de estado, 1043 paths e 921 drawImage; domina residual de render. Trig invariável foi eliminada, raster continua. | Baixo para vértices exatos; alto para reduzir FX ou blends. |
| 3 | `drawProjectile` e halos aditivos | O(P) + área de halos | G: 360 tiros, 378 drawImage no frame; troca de composição por tiro e raster acumulado. | Médio/alto para batching por ordem/blend. |
| 4 | `updateProjectiles` colisão/homing | O(P×N), podendo haver busca extra | 16560 candidatos em G; tempo CPU crescente. | Alto: ordem de hit, perfuração, spawn por proc e RNG. |
| 5 | Separação de `updateEnemy` | O(N²) por frame de play | 2116 leituras em 46; empurrões condicionais/sequenciais. | Alto: IA/posições/contato. |
| 6 | XP/pickups em `render`, `drawWorldExtras`, coleta | O(X), splice pior caso O(X²) | Blur por coletável e persistência até coleta; fora do contador FX. Evidência de código, não população humana medida. | Médio: magnetismo, coleta, ordem e visual. |
| 7 | `damageEnemy`, `chainShock`, AoE/status/morte | Bursts; O(K×N) ou O(N²) condicional | Loops encadeados, muitas emissões e objetos por hit/morte. Fixtures não reproduzem todo build. | Alto: dano/procs/economia/RNG. |
| 8 | `updateHUD` + wrappers Resíduos/Fractura | Base ~11 Hz; wrappers por frame | Escritas redundantes demonstradas; estilos/HTML e estado de Fractura ainda têm custo. | Baixo para texto idêntico; maior para invalidar caches complexos. |
| 9 | Alocações + eventual GC | Disparos, procs, alguns draws e HUD | Fontes reais listadas; duração de GC não isolada. | Médio/alto: pooling pode reter referências/estado obsoleto. |
| 10 | Render auxiliar: beams, `drawUnit`, PR15/facção, aberração, compositor/resolução | Contextual; poucos emissores, vários passes/área de tela | Wrappers e clones reais, gradientes, cópias do framebuffer e CSS. Não atribuir custo zero porque há só um singleton. | Médio/alto; exige cenário ativo e trace de GPU/compositor. |

Os itens não devem ser somados como percentuais: alguns se sobrepõem e a evidência mistura análise estática, operações e timings inclusivos.

## 15. Instrumentação externa: uso e segurança

### No Electron DEV

O arquivo `audit_pr155/performance_probe.js` **não é referenciado no HTML nem empacotado** (`build.files` continua explícito). Copiar como Snippet no DevTools, depois de habilitar DEV:

```js
// Executar o conteúdo de performance_probe.js uma vez, depois:
__ECHO_PERF_AUDIT1.start();
// Reproduzir o trecho de carga por alguns segundos.
const p = __ECHO_PERF_AUDIT1.snapshot();
console.table(Object.entries(p.secoes).map(([secao, v]) => ({
  secao,
  chamadas: v.chamadas,
  msPorFrame: v.totalMs / (p.secoes.frame_total.chamadas || 1),
  picoPorChamada: v.maxMs
})));
__ECHO_PERF_AUDIT1.stop();
```

- Instalação/start exigem DEV; começa desligada.
- Wrappers preservam argumentos, `this`, retorno e exceções com `try/finally`.
- Instrumenta uma **cópia em memória** do loop pelos marcadores auditados; se os marcadores mudarem, recusa instalar.
- Nenhum RAF paralelo, timer ou listener. O próximo callback da cadeia existente usa o loop instrumentado.
- start idempotente; stop restaura funções/loop originais. Desligar DEV restaura automaticamente ao executar a próxima função/loop instrumentado.
- Contadores por seção são fixos: chamadas, soma e máximo. Snapshot só aloca quando solicitado; não existe histórico por frame.
- `reset()` zera acumuladores; descartar/recarregar a página remove a instalação externa.
- Não foi adicionado profiler expandido ao painel normal. A visão por seções fica no console DEV, evitando números de profiling/overhead em release.

### Reproduzir fora do Electron

```bash
node audit_pr155/performance_benchmark.js --ref b4654f191a16214712bd35501c1b242b1b1cbca2 --json /tmp/echo-antes.json
node audit_pr155/performance_benchmark.js --json /tmp/echo-depois.json
node tests/pr15-5-performance-audit1.test.js
npm test
```

Navegador é opcional: instalar Playwright e um Chromium em diretório de ferramentas **fora do repositório**, configurar `NODE_PATH` e, se necessário, `ECHO_CHROMIUM`/bibliotecas do sistema:

```bash
node audit_pr155/performance_browser.js --ref b4654f191a16214712bd35501c1b242b1b1cbca2 --json /tmp/echo-browser-antes.json
node audit_pr155/performance_browser.js --json /tmp/echo-browser-depois.json
node audit_pr155/performance_overlay_browser.js --screenshots /tmp/echo-capturas
```

O benchmark de navegador suspende RAF automático **somente na fixture**, fixa semente/relógio de criação para equivalência de imagem e faz passos explícitos. As fixtures não são comandos para uma run legítima.

## 16. Métricas visíveis e auditoria de layout

Causa do desaparecimento anterior: guarda excluía qualquer `state!=='play'`, banners e painel DEV. Além disso, `#metrics-overlay` pertencia ao stacking context `#hud` de z-index 10, abaixo dos modais.

Correção:

- Mesmo painel, agora irmão do HUD no body, fixo, z-index 84, pointer-events none.
- Sessão inclui play, pausa, evento, loja, TAB, laboratório, DEV e telas finais. Banners não ocultam nem zeram a janela.
- Mantém FPS/FRAME na janela real de 250 ms, sem atualização numérica por RAF.
- Em pausa/modal, FPS é a cadência de **render**, não de simulação, que continua congelada conforme arquitetura existente.
- Oculto somente com OFF, sem jogador, documento oculto, título/seleção/confirmação de save ou timestamp inválido.

Antes de reposicionar, foi medido em 960×540: o retângulo antigo `(16,204,174,158)` cruzava card de evento, card de loja, duas seções do TAB e o painel DEV. Em combate e pausa simples não havia conflito com os controles auditados.

Por isso a posição normal foi preservada. Nos overlays conflitantes, Configurações/Codex, laboratório e telas finais, os mesmos sete números entram numa faixa superior de 18 px, entre y=1 e y=19. Os modais usam margens a partir de aproximadamente 21,6 px no mínimo. Em 960×540 a faixa mede `(16,1,928,18)`. Alteração de classe só ocorre quando muda esse modo de layout.

Passaram **25 verificações de navegador**: oito fluxos × três resoluções (960×540, 1280×720, 1920×1080), mais ausência de erro JavaScript. Verificados visibilidade, bounds, rótulos/números, camada, OFF vencendo `display:flex` e ausência de interseção com cards/seções/controles selecionados. Capturas foram inspecionadas; seus números são de timestamps sintéticos, não medição de FPS do navegador.

OFF mantém retorno imediato antes de qualquer consulta de contador ou DOM. ON consulta o estado do Codex por `classList.contains` no nó já existente, sem leitura geométrica/layout; classe/hidden só são escritos nas transições.

## 17. Testes, equivalência e regressão

- Suíte nova `tests/pr15-5-performance-audit1.test.js`: **111 checks, 0 falhas**.
- Métricas: **108 checks, 0 falhas**. Apenas expectativas antigas de ocultação/layout foram atualizadas para o requisito novo.
- PR15.5 A/A-FIX/B/B-FIX: **311 checks, 0 falhas**.
- `npm test`: **51 suítes, 3041 checks, 0 falhas**.
- Inclui inimigos, arsenal, minibosses/boss, Save/Continue, Sandbox, PR15 B1–B4, Fracture, balance e demais regressões.
- Os nove cenários A–I têm **mesmo hash da sequência/argumentos Canvas**, mesmo número de sorteios de draw e **mesmo SHA-256 dos pixels** antes/depois no ensaio determinístico final.
- Cache: três entradas imutáveis/24 escalares; fallback geométrico; zero listas espelho ou histórico novo.
- Sonda: guards DEV, start/stop/reset, unicidade, gate, restauração, dados finitos, número fixo de seções.
- Testes de culling existente confirmam que render offscreen não remove entidades e que os updates continuam.
- 21 blocos integrais adicionais de funções mecânicas/render sem alteração são comparados a hashes da base, cobrindo IA, colisão, dano, spawn, velocidade de tiro, cooldowns e RNG.

### Referência mecânica obrigatória

Comparação direta com `4667720babece82b1c9bb1b92e8d47b7b1c5cc45`:

| Bloco | Resultado |
|---|---|
| WEAPONS | Idêntico |
| EDEFS | Idêntico |
| waveCompBase | Idêntico |
| MINIBOSS | Idêntico |
| spawnBoss | Idêntico |

`git diff --check`: sem erros. O commit/hash final e a confirmação do push são informados na entrega, sem inserir hash autorreferente neste documento.

Nenhuma divergência encontrada. Remoção de contactR+54, fast paths/lazy state, Swarm barato, Singular barata, ranged integrado e Bulwark orientado por shieldAng permanecem aprovados. Ganho estrutural não foi obtido reduzindo inimigos, tiros, dano, efeitos, frequência de ataque ou velocidade do jogo.

## 18. Otimizações deliberadamente não aplicadas

- Remover/reduzir blur, transparências, partículas ou formas: degradação visual não autorizada.
- Spatial hash, pares únicos de separação e alteração de colisão: ordem/mecânica exigem bloco próprio.
- Pool de projéteis ou compactação de seus splices: inserções durante hits/procs e referências podem mudar semântica.
- Culling adicional de arcos/Anomaly/segmentos: RNG e bounds de telegraphs/trails.
- Cache amplo de Fracture/PR15, agrupamento de draw por cor/blend e remoção de save/restore: risco de invalidação/ordem/estado.
- Troca de hypot por distâncias quadráticas em thresholds mecânicos: oportunidades existem, mas nenhuma precisava ser alterada para entregar os ganhos seguros medidos.
- Rebalancear qualidade/governador, frame gate, dt ou flags GPU.
- Alterar engine, WebGL, gameplay, PR15 ou economia.

## 19. Arquivos

**Alterados**

- `index.html`: visibilidade/camada/layout de métricas; tabela fixa de vértices de estilhaços; escrita textual idempotente do HUD e guarda de resíduos.
- `tests/pr15-5-metrics-overlay.test.js`: adapta 11 checks cujo contrato antigo de ocultação/posição/estado escalar foi substituído; mantém 108 checks.
- `PR15_5_METRICS_OVERLAY.md`: novo comportamento de sessão/overlays, custos e testes atuais.

**Criados**

- `tests/pr15-5-performance-audit1.test.js`: 111 checks dedicados e hashes de equivalência.
- `audit_pr155/performance_probe.js`: sonda externa DEV, removível, sem import no release.
- `audit_pr155/performance_scenarios.js`: fixtures A–I restritas a DEV/Sandbox.
- `audit_pr155/performance_benchmark.js`: operações, candidatos, trig, HUD e suporte à comparação com commit-base.
- `audit_pr155/performance_browser.js`: diagnóstico opcional Chromium, seções, raster/readback, ablação e pixels.
- `audit_pr155/performance_overlay_browser.js`: verificação opcional de UI/resoluções/overlays.
- `audit_pr155/performance_results.json`: evidências antes/depois e inventário completo de atribuições de shadowBlur.
- `PR15_5_PERFORMANCE_AUDIT1.md`: este relatório.

Sem alteração de dependências, build, Electron, schema de save, harness existente ou catálogos mecânicos. Logs/capturas/binários temporários não foram adicionados ao Git.

## 20. Replaytest humano e riscos restantes

1. Confirmar branch/commit desta entrega e preferência persistente. Começar sem instrumentação externa: OFF e ON em trechos comparáveis.
2. Reproduzir a queda com a mesma resolução, qualidade, build e ambiente do playtest anterior. Registrar FPS/FRAME e contagens, onda/armas/Echos/presença e se havia muitos coletáveis.
3. Conferir o painel em evento, loja, TAB, pausa, Configurações, DEV/laboratório e telas finais. Deve continuar amostrando; observar a faixa superior e retorno à posição original.
4. Validar legibilidade/contraste em DPI real, tela cheia e 960×540. Checar HUD congestionado, mensagens de facção, tooltips e configurações de DEV que não pausam o jogo; a verificação automatizada não cobre toda combinação de conteúdo.
5. Observar mortes em massa/estilhaços: forma, halo, cor, movimento, duração e densidade devem continuar iguais. Conferir HP, escudo, créditos, Echos e resíduos mudando normalmente.
6. Se a queda persistir, repetir em DEV com a sonda externa, coletar snapshot curto e parar a sonda. Comparar **com e sem profiler**, pois ele próprio tem overhead.
7. Capturar Performance no DevTools do Electron para separar JS, raster, GPU/compositor, áudio e pausas de GC. Confirmar aceleração efetiva/driver; não inferir GPU somente do tempo de retorno de `render()`.
8. Testar Save/Continue, nova run e reinício do app: uma única instância de métricas, configuração independente do checkpoint e nenhuma mudança mecânica.

**Riscos/limites restantes:** causa dominante da queda humana ainda depende de trace no Electron; os principais loops quadráticos e blurs foram preservados; médias escondem caudas/hitches; readback headless não é hardware do jogador; FX/ENTIDADES são subconjuntos; cenas com procs, Echos/PR15, coletáveis, áudio e compositor podem mudar o ranking. Não é autorização para seguir ao próximo bloco visual.

**Decisão técnica:** correções focadas, equivalência e regressões seguras para replaytest; recuperação real de FPS ainda não comprovada.

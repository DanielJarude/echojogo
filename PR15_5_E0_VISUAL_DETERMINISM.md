# PR15.5-E0 — DETERMINISMO VISUAL

> **Regra de ouro:** o renderer é um **observador**.
> Desenhar zero, um ou dez frames extras — a 30, 60, 120 ou 144 FPS —
> não pode alterar o futuro mecânico da simulação.

Base: `6f66e70e04761a1efd63769e28f9d0e108737069`
Escopo: **somente determinismo**. Este PR **não** é o rework visual PR15.5-E.
Nenhum inimigo, Echo, boss, arma, beacon, HUD ou Fracture foi redesenhado.

---

## 1. PROBLEMA

Auditoria prévia encontrou **18 ocorrências de aleatoriedade alcançáveis
durante o draw**, todas classe A (risco mecânico), além de um caso pior:
o renderer **criava partículas**.

## 2. CAUSA

```js
// index.html:1180 — definição única
const rand  = (a,b)=>a+Math.random()*(b-a);
const randi = (a,b)=>Math.floor(rand(a,b+1));
```

`rand()` é um wrapper direto de `Math.random()` — **o mesmo fluxo global**
que alimenta:

| Sistema | Linha | Código |
|---|---|---|
| Crítico do jogador | 14483 | `Math.random()<(src.crit\|\|0)` |
| Spread de tiro | 14493 | `src.aim+off+(Math.random()-.5)*jt*2` |
| Elite no spawn | 16679-16680 | `Math.random()<ch`, `Math.random()<.5?'shield':'slow'` |
| Drop de moeda | 15043 | `if(Math.random()<.35)coins++` |
| Drop de medkit | 15050 | `Math.random()<mEff.medDrop` |
| Crítico do inimigo | 16978 | `Math.random()<e.crit` |
| Eventos de arena | 13644 | `if(Math.random()>.30)return` |
| Composição de onda | 7672, 9376 | `let r=Math.random()*tot` |

### Cadeia de risco concreta

Com 1 anômalo + 2 arcos + 3 inimigos em choque, o renderer consumia
**~20 chamadas de RNG por frame**:

```
t=0.000s  render() → drawEnemy(anomaly) 4×  +  drawArcs 12×
                   + drawStatus 4×          +  shake 2×
          → o estado do RNG global avançou 22 posições
            SEM nenhuma causa mecânica

t=0.0167s update() → shoot() linha 14483:
            Math.random() lê a 23ª posição da sequência
```

A 30 FPS o mesmo instante lógico teria consumido 11 posições, então
`shoot()` leria a **12ª** — **um valor diferente**. O crítico acontece ou
não **dependendo do FPS**. A partir daí: dano diferente → inimigo morre ou
não → drop ocorre ou não → economia diverge → **a run inteira diverge**.

### Oito vetores que alteravam o consumo

FPS · refresh rate do monitor (gate `avg<13.2`) · aba em background ·
perda de foco · `resize()` · culling `inView()` (posição da câmera) ·
`cfg.aberr` · `cfg.parts`.

Duas consequências especialmente graves:
- **Tempo parado num modal** (loja/evento) avançava o RNG em centenas de
  posições — `render()` roda fora do `if(state==='play')`;
- **Uma opção de acessibilidade** (`cfg.aberr`) mudava o resultado da run.

---

## 3. OCORRÊNCIAS CORRIGIDAS (18 → 0)

| # | Local | Linha (base) | Antes | Depois |
|---|---|---|---|---|
| 1 | `render` · shake | 20579 | `rand(-shake,shake)` ×2 | senoides 37,1/43,3 Hz |
| 2 | `render` · aberração | 20749-20752 | `Math.random()`, `rand()` ×3 | `vHash32/vJit1` + tick 24 Hz |
| 3 | `render` · Fracture bandas | 20774-20776 | `rand()` ×3 por banda | `vHash32/vJit1` + tick 26 Hz |
| 4 | `render` · Fracture linhas | 20794-20796 | `rand()` ×2 + `Math.random()` | `vHash32/vJit1` + tick 26 Hz |
| 5 | `drawEnemy` · **Anomaly** | 20216-20217 | `rand(-jj,jj)` ×4 | `sin/cos(runTime + visualSeed)` |
| 6 | `drawStatus` · choque | 15378-15381 | `Math.random()<.4` + `rand(0,TAU)` | tick 22 Hz + `vSeedOf` |
| 7 | `drawArcs` | 15418 | `rand(-9,9)` ×6 por arco | `vJit1(geometria, idade, seg)*9` |
| 8 | `drawWorldExtras` · ambush glitch | 14013 | `Math.random()<.22?rand(-3,3)` | `vHash32(pulse, x^y)` |
| 9 | `drawWorldExtras` · ambush estática | 14037 | `rand(-16,14)` ×2 | `vHash32` + tick de `pulse` |
| 10 | `drawPlayer` · hurt | 20484 | `Math.random()<.55` | `((hurtT*18)\|0)&1` |
| 11 | `drawUnit` · glitch | 19682 | `rand(-gl,gl)` ×2 | `vJit1(opts.phase, tick 30 Hz)` |
| 12 | `drawEchoEntity` · jitter | 19803 | `rand(-jit,jit)` ×2 | `vJit1(e.seed, tick 30 Hz)` |
| 13 | `drawEchoEntity` · blink | 19854 | `Math.random()<.06` | `(vHash32&1023)<61` |
| 14 | `drawEchoEntity` · deslocamento | 19857 | `Math.random()<.25` + `rand()` ×2 | `vHash32` + `vJit1` |
| 15 | `drawEchoEntity` · cópias | 19859, 19863 | `rand(-3,3)` ×2 | `vJit1` ×2 |
| 16 | `drawEchoEntity` · scanlines | 19871 | `rand(-e.r,e.r)` ×2 | `vJit1(e.seed, tick, i)` |
| 17 | `drawEchoEntity` · **partícula** | 19902 | `Math.random()<.05` + `spawnParticles` | **movido para `updateEcho`** |
| 18 | `spawnParticles` via #17 | 5755-5757 | 4 `rand()` por partícula | eliminado do caminho de draw |

---

## 4. SOLUÇÃO — HELPER DETERMINÍSTICO

Um único helper puro (~15 linhas), sem framework novo:

```js
function vHash32(a,b,c){                    // 3 inteiros → uint32
  let h=(a|0)^Math.imul((b|0)+0x9E3779B1,0x85EBCA6B);
  h^=Math.imul((c|0)+0x165667B1,0xC2B2AE35);
  h=Math.imul(h^(h>>>15),0x2C1B3C6D);
  h^=h>>>13;h=Math.imul(h,0x297A2D39);
  return (h^(h>>>16))>>>0;
}
function vJit1(a,b,c){return vHash32(a,b,c)/2147483648-1;}   // [-1,1)
function vSeedOf(e){ /* visualSeed → seed → posição */ }
```

**Padrão único aplicado em todos os casos** — o mesmo que o PR15.5-C já
usa com `d.seed`:

```
seed estável da entidade  +  tempo lógico QUANTIZADO  +  índice fixo
```

A **quantização do tempo** (`(runTime*40)|0`) é o que torna o efeito
independente de FPS: 30, 60 e 144 Hz caem no mesmo tick visual e produzem
a mesma imagem para o mesmo instante lógico.

Propriedades garantidas por teste: sem estado interno · sem `Math.random` ·
mesma entrada ⇒ mesma saída · zero alocação · não consulta gameplay ·
não altera estado · **nenhum PRNG por entidade/frame**.

### Detalhes por caso

**Shake** — duas senoides de frequência incomensurável (37,1/43,3 Hz) que
batem entre si; irregularidade preservada, `shake`, decaimento, limiar
`>0.3` e `cfg.shake` intactos.

**Anomaly** — fase de `runTime*23.7 + visualSeed*TAU`. As cópias ciano e
magenta ficaram **anti-correlacionadas** (`+aox,+aoy` / `-aox,-aoy`): elas
se separam em vez de às vezes se sobrepor, o que **melhora a leitura**.
`jj`, `strikeT` e `vp.lean` (PR15.5-C) intactos.

**Choque** — era o único dos 6 status não determinístico; os outros cinco
já derivavam de `runTime`. Agora segue o mesmo padrão: tick 22 Hz + seed.
Gate `(h&7)<3` ≈ 37,5% (original 40%). A quantização mantém cada raio
visível por ~45 ms — em 144 Hz o efeito antes piscava rápido demais.

**drawArcs** — a geometria do arco (única por par origem→alvo) é a seed;
idade quantizada em 60 Hz mantém o tremor ao longo dos ~0,2 s de vida.
Amplitude ±9, 4 segmentos, cores e `shadowBlur` intocados.

**Ambush** — `b.pulse` quantizado (14 Hz) + posição como seed implícita
(já sorteada no spawn). **Nenhum campo novo persistido.**

**Player hurt** — strobe de ~9 Hz derivado do próprio `hurtT`. Legível e
idêntico em qualquer FPS; antes, em 144 Hz virava um borrão rosado.
A **pose** do PR15.5-C (`visualPlayerDrawPose`) não foi tocada.

**drawUnit** — **assinatura pública inalterada**. Reusa `opts.phase`, que
todos os callers já passam (`phase:e.seed` nos Echos, `phase:0` no
player); o default `0` preserva compatibilidade com qualquer caller futuro
(incluindo `drawShip`, que não passa `phase`).

---

## 5. PARTÍCULA DO ECHO — DRAW → UPDATE

O bug central. Antes, em `drawEchoEntity`:

```js
if(Math.random()<.05)spawnParticles(e.x,e.y,DIS_COLOR.unstable,1,90,.25,2);
```

O renderer **criava entidades** e mutava `parts` (array com teto rígido
`PARTS_MAX=900`, pool de objetos e `trimParts()`, que podia **descartar
partículas legítimas do gameplay**). A densidade escalava com o FPS: em
144 Hz emitia **2,4× mais** que em 60 Hz.

Agora, em `updateEcho` (confirmado no código real como o tick lógico do
Echo), via acumulador determinístico:

```js
const ECHO_UNSTABLE_EMIT_HZ=3;              // = 0.05 × 60, a densidade de 60 FPS
function echoUnstableEmit(e,dt){
  if(!e||!e.dis||e.dis.st!=='unstable'){if(e)e._unsAcc=0;return 0;}
  let acc=(e._unsAcc||0)+dt*ECHO_UNSTABLE_EMIT_HZ;
  let n=0;
  while(acc>=1-1e-9&&n<4){acc-=1;n++;}      // epsilon anti-float; teto anti-rajada
  e._unsAcc=acc;
  for(let i=0;i<n;i++)spawnParticles(e.x,e.y,DIS_COLOR.unstable,1,90,.25,2);
  return n;
}
```

Optou-se pelo acumulador em vez de RNG no update (permitido pelo escopo)
porque é **mais simples e mais forte**: sem RNG algum, cadência fixa,
30/60/144 Hz emitem exatamente o mesmo número de partículas em 1 s
(provado em §K04). Congela em pausa/modal (`dt=0` não emite) e não depende
de quantos frames foram desenhados.

O epsilon `1e-9` é necessário: sem ele, `3×(1/30)` somado dez vezes dá
`0.9999999999999999` e a emissão perderia um tick — 30 e 60 FPS
divergiriam por erro de ponto flutuante.

---

## 6. INVARIANTES MECÂNICOS PRESERVADOS

**Nada de gameplay foi alterado.** Explicitamente **não tocados**:

- `rand()` / `randi()` / `Math.random()` — continuam existindo, intactos,
  para toda a simulação (**nenhuma** substituição global);
- Todo o RNG mecânico da tabela do §2 (crit, spread, Elite, drops, heal,
  DoT crit, eventos, microeventos, AI, strafe, hazard, composição de onda);
- **Fracture Director**: `fractureRng`, `fractureHash32`, `fractureWaveRng`,
  `fractureMiniRng`, `fracturePickTheme`, `fractureMakeSeed`, `fpRng`,
  `pr15MemRng`, `pr15IntentRng` — tema, intensidade, stage, composição,
  miniboss, facções e seed da run **inalterados**. Nenhum é alcançável a
  partir do draw (verificado no call graph);
- `spawnParticles` / `spawnShards` / `spawnRing` — o sorteio **no spawn**
  é aleatoriedade legítima e foi preservado;
- **PR15.5-C**: `drawDeathVisual`, `deathVisualTick`, `deathVisualPush`,
  poses de hurt por família;
- **PR15.5-D**: `meleeDrawTrail`, `visualMeleeWeaponPose`,
  `visualPlayerDrawPose`, `visualWeaponRecoil`, `drawSwings`,
  `drawWeaponSprite`, `fireMelee`;
- **PR15.7**: janela 5 s, cooldown 6 s, dano 0.50, whitelist, cap de
  projéteis, shotgun determinístico, SFX, reação temporal, HUD,
  telemetria, rewards;
- `drawMiniBoss` (+12 sub-renderers), `drawBoss`, `drawProjectile`,
  `drawBeamFrom`, `drawGrid`, `pr15PresDraw`, `pr15IntentDraw`,
  `factionPresenceDrawEntity` — já eram limpos;
- Hitbox, HP, dano, velocidade, spawn, AI, economia, loot, moralidade,
  progressão.

### Comprovação — call graph

Fecho transitivo de **84 funções** a partir de 27 raízes de draw
(incluindo os wrappers monkey-patch de `drawWorldExtras` e `render`):

```
ocorrências de Math.random / rand( / randi( : 0
mutações de estado global no draw          : 0
```

*(as 5 ocorrências de `push` remanescentes são num array **local** dentro
de `speechWrapLines` — pré-existentes e inócuas.)*

---

## 7. PERFORMANCE

**Neutro a positivo.** `vHash32` custa 3 `Math.imul` + XORs + shifts ≈
comparável a uma chamada a `Math.random()` (que não é gratuita: V8 usa
xorshift128+ com cache de 64 doubles).

| Proibição do escopo | Status |
|---|---|
| arrays novos por frame | ✅ nenhum — helper retorna primitivo |
| objetos temporários por frame | ✅ nenhum — zero pressão de GC |
| PRNG por entidade/frame | ✅ nenhum — função pura, sem closure |
| strings / hash pesado no hot path | ✅ só aritmética inteira de 32 bits |
| trigonometria excessiva | ✅ `sin/cos` só no shake (2/frame, global) e na Anomaly (2 por anômalo, era 4 `rand()`) |
| caches sem limite | ✅ nenhum cache criado |
| loops adicionais | ✅ substituição in-place, mesmas iterações |
| gradients / blur / Path2D novos | ✅ nenhum |

**Ganhos colaterais:** o choque quantizado em 22 Hz **reduz** o número de
raios desenhados em monitores de alta taxa; a emissão do Echo instável
deixou de escalar com o FPS (era 2,4× mais partículas em 144 Hz);
`drawArcs` troca 6 `Math.random()` por 6 hashes inteiros.

Medição objetiva (`pr15-5-performance-audit1`): os 9 cenários passaram de
`random: 0/6/24/48/72/0/18/96/36` para **`random: 0` em todos**. O teste
"FX-heavy elimina exatamente 7200 sin/cos por render" continua verde.

---

## 8. TESTES

### Nova suíte — `tests/pr15-5-e0-visual-determinism.test.js`
**161 checks, 0 falhas**, em 16 blocos:

| Bloco | Cobertura |
|---|---|
| A (8) | infraestrutura: `rand` vivo, sem substituição global, `fractureRng` separado, `visualSeed` presente |
| B (14) | helper: pureza, ausência de estado, faixa, dispersão, média ≈ 0, sem PRNG por chamada |
| C (6) | **call graph estrutural** — zero RNG em 84 funções alcançáveis (anti-regressão) |
| D (13) | Anomaly: zero RNG, `visualSeed`, `jj`, `strikeT`, `vp.lean`, ciano/magenta, anti-correlação |
| E (10) | choque: zero RNG, varia no tempo, cintila, frequência ≈ 37,5%, os outros 5 status intactos |
| F (12) | `drawArcs`: 4 segmentos, extremos exatos, ±9, varia na vida, **não muta `arcs`** |
| G (11) | ambush: instável, glitch alterna, ±3, scanlines, spawn intocado |
| H (9) | hurt: pisca, legível a 144 Hz, pose PR15.5-C preservada |
| I (11) | `drawUnit`: assinatura preservada, fast path sem glitch, ±2.4, `drawShip` compatível |
| J (18) | Echo: todos os estados, blink ≈ 6%, scanlines, cromatismo, **zero partículas no draw** |
| K (10) | emissão movida: só em `unstable`, **30/60/144 Hz convergem**, `dt=0` não emite, teto anti-rajada |
| L (8) | Fracture: render sem RNG, **Director/tema/seed intactos**, `cfg.aberr` cosmético |
| M (6) | shake: irregular, amplitude, `cfg.shake`, limiar 0.3 |
| N (6) | **RNG sentinel**: render completo, 120 renders, modais, fracture — todos 0; sem partículas; estado imutável |
| O (7) | FPS: 30/60/120 draws ⇒ RNG intocado e mesma imagem; bit-idêntico com câmera fixa |
| P (12) | regressões PR15.5-C / PR15.5-D / PR15.7 |

O **RNG sentinel** (§N) substitui `Math.random` por um contador dentro do
sandbox do jogo e executa `render()` de verdade sobre cena povoada
(anômalo + 3 inimigos com 5 status + 2 arcos + beacon ambush + 2 Echos +
player ferido + shake + aberração). Resultado: **0**.

### Regressão completa

```
SUÍTES: 59  ·  COM FALHA: 0  ·  CHECKS ✔: 3762  ·  FALHAS ✘: 0
TODAS AS SUÍTES PASSARAM
```

O histórico Git foi aprofundado (`git fetch --unshallow`) para
disponibilizar `5d8e244c22b1a505c1cd25c4149497f91c83871a`; com ele,
`pr15-5-c-hurt-death` passa **163/0** (antes 17 falhas por histórico raso).
**Nenhum teste antigo foi modificado para contornar falta de histórico.**

### Re-baselines intencionais (3)

Todos documentados no próprio arquivo de teste, seguindo o precedente do
PR15.5-C/D (que já re-baselinearam `drawEnemy`, `drawSwings`,
`meleeDrawTrail`):

1. **goldens de render** (`pr15-5-performance-audit1`) — o campo `random`
   era o defeito; virou `0` em todos os cenários, invariante mais forte
   que os números antigos. `hashCanvas` mudou junto porque o jitter trocou
   de fonte. **Cenário F continua bit-idêntico** (já não usava RNG),
   comprovando que caminhos sem aleatoriedade não foram tocados;
2. **`drawEnemy` / `drawArcs`** (mesma suíte) — hashes das duas funções
   efetivamente alteradas;
3. **`updateEcho`** (`pr15-5-d-melee-animation`) — diff de **uma linha**
   (`echoUnstableEmit(e,dt)`), inserida após o guard `if(!e.alive)return;`.
   `visualTimelineTick` continua sendo a primeira chamada e nada no
   caminho de swing/pose/trail mudou; `fireMelee`, `updateSwings` e
   `updatePlayer` seguem pinados e verdes.

### Harness

`audit_pr135/harness.js` ganhou 18 linhas de bridge. **Todos os símbolos
novos vão sob `typeof`** porque o mesmo harness instancia **fontes
históricas** (`git show <ref>:index.html`) nas suítes de comparação com a
base — sem a guarda, o bridge lançaria `ReferenceError` e derrubaria
suítes antigas.

---

## 9. LIMITAÇÕES E NOTAS

- **Câmera:** `cam.x+=(player.x-cam.x)*.08` converge assintoticamente e
  deixa resíduo de ~1e-12 em float entre renders. É estado **visual**
  legítimo e pré-existente, **sem RNG**, e não afeta a simulação. O teste
  §O02 usa tolerância numérica; §O02c prova que **com a câmera fixa a
  imagem é bit-idêntica**.
- **`fractureMakeSeed`** continua consumindo `Math.random()` **uma vez por
  run**, no início — é a origem legítima da seed e está fora do draw.
- **Aparência:** amplitudes, probabilidades e frequências foram
  preservadas numericamente, mas a *fonte* do jitter mudou; os padrões
  concretos de tremor são diferentes (embora estatisticamente
  equivalentes). Três efeitos ficaram deliberadamente **melhores**:
  anomaly anti-correlacionada, choque legível em alta taxa e hurt sem
  borrão em 144 Hz. **Requer replaytest humano.**
- **Fora de escopo (intencional):** `shadowBlur` por arco continua caro —
  performance visual será tratada depois. Nenhum culling novo introduzido.
- Este PR **não** redesenha nada. O rework visual é o PR15.5-E.

---

## 10. ARQUIVOS

| Arquivo | Mudança |
|---|---|
| `index.html` | +161 / −27 — helper, 17 renderers, `echoUnstableEmit` |
| `audit_pr135/harness.js` | +18 — bridge de teste (sob `typeof`) |
| `tests/pr15-5-e0-visual-determinism.test.js` | **novo** — 161 checks |
| `tests/pr15-5-performance-audit1.test.js` | re-baseline documentado |
| `tests/pr15-5-d-melee-animation.test.js` | re-baseline de 1 hash, documentado |
| `PR15_5_E0_VISUAL_DETERMINISM.md` | este documento |

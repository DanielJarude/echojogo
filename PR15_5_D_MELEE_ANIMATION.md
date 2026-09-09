# PR15.5-D — Arsenal Melee: Animação Física, Identidade e Impacto

**Branch permanente selecionada:** `dev/pr15-5-visual-overhaul` · **Branch interna Arena:** `arena/01a08757-echojogo`
**HEAD inicial validado:** `4f56b76aa82d0e65323215dfa2ad31dedfb66925` (working tree limpo)
**Base mecânica de referência:** `4667720babece82b1c9bb1b92e8d47b7b1c5cc45`

---

## 1. Inventário melee real (audit §4)

O catálogo `WEAPONS` tem **27 armas**; exatamente **7** são melee (`melee:true`). Todas
compartilhavam o mesmo formato mecânico — **um único `fireMelee()`** com dano instantâneo
em setor circular (arc × reach), penetração infinita, destruição de projéteis leves e
avanço de 160px do jogador — e o mesmo visual: **arma estática na mão + arco genérico
simétrico desenhado por `drawSwings()` com shadowBlur 26·k** (vida fixa .26s).

| id | Nome | Cooldown (interval) | Alcance (reach) | Arco (arc) | Dano | Especial mecânica | Sprite | Família visual D |
|----|------|-------|--------|-----|------|------|--------|------|
| `blade` | LÂMINA DE ARCO | .38s | 104px | 1.55 rad (~89°) | 46 | penetração infinita; destrói projéteis | próprio (wi 3) | **light** |
| `katana` | KATANA DE FASE | .24s | 96px | .95 rad (~54°) | 29 | crit +20% embutido | `katana` | **light** |
| `scythe` | FOICE HEMOLÍTICA | .46s | 118px | 2.20 rad (~126°) | 38 | lifesteal 16%; bleed | `scythe` | **cleave** |
| `chains` | CORRENTE FLAGELANTE | .58s | 172px | 2.90 rad (~166°) | 34 | pullIn 180; bleed | `chain` | **cleave** |
| `glaive` | ALABARDA DE VÁCUO | .72s | 158px | 1.15 rad (~66°) | 55 | corrode (+12%/camada) | `glaive` | **thrust** |
| `gaunt` | MANOPLA DE IMPACTO | .30s | 74px | 1.05 rad (~60°) | 41 | knock 420; lifesteal 10% | `gaunt` | **thrust** |
| `hammer` | MARRETA SÍSMICA | .95s | 132px | 1.30 rad (~74°) | 72 | shockwave 190px; stun 1.1s | `hammer` | **blunt** |

Hits por golpe: sempre **1 janela instantânea** que acerta todos os alvos no setor
(penetração infinita) — nenhuma melee tem multi-hit temporal. `gaunt`/`chains`/`hammer`
acrescentam efeitos no acerto (knock/pull/shockwave) sem mudar a janela.

**Diferença real entre armas antes do D:** apenas números (dano/alcance/arco/cadência),
propriedades no hit e sprite. **Nenhuma diferença de POSE, TRAJETÓRIA, TEMPO ou
comportamento visual** — era o débito que este PR fecha.

Quem dispara melee mecanicamente (audit §8): `updatePlayer` (jogador, inclusive
doubleTap do Prisma Fraturado), `updateEcho` (Ecos aliados) e o eco hostil
(`fireWeaponFrom(...,'enemy',...)`) — todos convergem em `fireWeaponFrom` → `fireMelee`.
A timeline visual D inicia **exatamente ali, dentro de `fireMelee`** — nunca por
proximidade/mouse/cooldown "quase pronto".

## 2. Famílias visuais (audit §5)

Famílias **derivadas do arsenal real** (nenhuma classe mecânica nova; `heavy` fica
definida no vocabulário mas sem arma — nada foi forçado):

| Família | Armas | Leitura de movimento |
|---------|-------|----------------------|
| **light** (slash leve) | blade, katana | arco curto, quase sem antecipação, velocidade angular alta (katana: flick de 2 frames de windup), overshoot pequeno, retorno rápido. Corte diagonal (perp). |
| **thrust** (estocada) | glaive, gaunt | rotação mínima (±0.16 rad); **compressão → extensão longitudinal → retorno linear**; o punho avança até .95·r (glaive) / .85·r (gaunt); escala estica brevemente no pico (stretch .22/.16). |
| **cleave** (golpe largo) | scythe, chains | varredura de até 3.65 rad cruzando o eixo corporal; **corpo gira junto** (bodyTurn .20/.28 rad); recovery amplo; chains usa easeInOut (giro contínuo de "spin"). |
| **blunt** (impacto) | hammer | ergue 1.5 rad atrás (antecipação longa, .12s), **desaba acelerando (easeIn)**, cruza o centro tarde no sweep (impacto "cai" no alvo), squash .14 no contato, recovery pesado (.29s). |
| **heavy** (slash pesado) | — (reservada) | nenhuma arma real justifica hoje; a marreta é impacto radial, não corte pesado. |

Cada família tem curva própria: `easeWindup/easeActive/easeRecover` são **referências
diretas às funções da fundação A** (`VISUAL_EASING`) — nenhuma física real, spring,
integração numérica ou Bezier por frame.

## 3. Melee Visual Profile (audit §6)

`MELEE_VISUAL_PROFILES` — tabela **const, congelada, precomputada na carga** com
exatamente 7 entradas (`Object.freeze`), lookup O(1) por `def.id`
(`meleeVisualProfile(def)`; fallback = perfil da blade). Campos **puramente visuais**:

```
family, windup, active, recover, trailFade        // TEMPO (s) — fases formais
windupAngle, endAngle                              // TRAJETÓRIA (rad): cock atrás → fim além do arco
extIn, extOut, perp                                // PUNHO: recuo/avanço/lateral (fração de r)
bodyLean, bodyTurn, bodyShift                      // CORPO sutil (rad / rad / fração de r)
squash, stretch                                    // deformação breve (blunt/thrust)
easeWindup, easeActive, easeRecover                // curvas (refs da fundação A)
trailStyle ('arc'|'line'|'impact'), trailWidth, trailTail, impactRing
```

**Nenhum atributo mecânico é duplicado** (testes A09 negam `dmg/interval/reach/arc/crit/
knock/pullIn/shockwave/lifesteal/fx/kick` no perfil). Os ângulos foram escolhidos por
arma de modo que a varredura **cubra o arco mecânico real** (`windupAngle ≥ arc/2` nas
slashes; blunt/thrust usam trajetória própria justificada pela mecânica).

Exemplo conceitual→real: `windupFrac/startAngle/travelAngle/overshoot` viraram
`windup/ windupAngle/ (windupAngle+endAngle)/ endAngle` — mesma ideia, nomes adaptados
à arquitetura real.

## 4. Fases formais da animação (audit §7)

A máquina usa **a infraestrutura existente da Visual Foundation A** — nenhum motor
paralelo. O estado mora no sub-objeto O(1) `entity.visual.melee`
(`{state,t,dir,prof}` — 4 chaves fixas, criado junto com o `visual` da entidade),
avançado pelo **mesmo** `visualTimelineTick()` que já rodava para o jogador/Ecos:

```
IDLE → WINDUP → ACTIVE → RECOVER → IDLE
```

- **finita e determinística**: sem listener, sem array crescente, sem setTimeout/
  setInterval/requestAnimationFrame; dt é clamped (`Math.max(0,visualFinite(dt,0))`);
  transição com **carry-over do excedente de dt** — o relógio visual acumula exatamente
  o mesmo tempo que o swing, então pose e trail nunca divergem (teste E09);
  `!(t>0)` em vez de `t<=0` → NaN injetado nunca trava a máquina (K03);
- **reinício limpo**: novo golpe durante recover recomeça em windup (combo); nada fica
  preso (B12/B19/K06/K08);
- **independente da mecânica**: a máquina apenas OBSERVA o evento real de ataque.

## 5. Sincronização com a mecânica (audit §8)

- A timeline inicia **dentro de `fireMelee`**, no evento REAL (jogador, Ecos aliados e
  hostis). O dano continua **instantâneo na mesma chamada** — a camada visual não é
  consultada pela mecânica em nenhum ponto (G01/G02/G16).
- Como a mecânica é instantânea, o ACTIVE visual é curto (.075–.19s) e o **impacto
  visual (lâmina cruzando o centro) acontece a ≤ .25s do evento real** em todas as
  armas (teste A30): katana ~.06s, blade ~.10s, gaunt ~.07s, glaive ~.11s, scythe ~.16s,
  chains ~.19s, hammer ~.21s (a marreta "cai" no alvo; a onda sísmica/ring/abalo
  existentes já marcam o impacto mecânico em t=0).
- `windup+active+recover ≤ interval` base de **todas** as 7 armas (A12) — a animação
  cabe na cadência; spam reinicia sem sobreposição de estado.
- A vida do swing no array `swings` deixou de ser fixa .26s: agora é
  `windup+active+trailFade` (≤ .42s), o que inclusive **reduz** sobreposição de swings
  na cadência máxima.

## 6. Pose da arma — a arma executa o golpe (audit §9)

`visualMeleeWeaponPose(entity)` (chamada 1×/frame apenas pelo draw) calcula a pose e
escreve num **scratch pré-alocado** (`MELEE_WEAPON_POSE`):

- **grupamento rígido**: braços + mãos + arma giram juntos em torno do pivô do peito
  (r·.10, −r·.10). O `drawUnit` recebe `opts.melee` e aplica
  `translate(gx,gy) rotate(rot) [scale]` ao punho, e reposiciona pontas de braços e
  mãos nas coordenadas rotacionadas — a arma nunca "solta" das mãos;
- a rotação varre de `−windupAngle` (cock atrás) até `+endAngle` (além do arco =
  **follow-through**), e o recover traz de volta a **0 = pose neutra** exata (C04/C05);
- o punho desloca: recua no windup (compressão), avança no golpe (`extOut`), deriva
  lateral (`perp`) — a distância mão↔corpo varia;
- escala: thrust estica no pico (sx até 1.22), blunt comprime no impacto (sy até .86) —
  sempre finita, nunca ≤ 0 nem > 2 (C08);
- custo por frame em melee: **exatamente 2 trig** (cos/sin da rotação — teste I10),
  ~20 somas/multiplicações, zero alocação (I09/benchmark "1 scratch reutilizado");
- tudo aplicado **só ao render**: `player.x/y`, hitbox, mira, colisão e range não mudam
  (C11/G10/H01).

`drawWeaponSprite` segue intacto — a pose envolve o sprite existente (o recoil
`visualWeaponRecoil` da fundação A continua compondo: a arma recua levemente ao longo do
próprio eixo rotacionado, reforçando a antecipação).

## 7. Pose do player (audit §10)

`visualMeleeBodyPose(entity)` — sutil por design: rotação corporal ≤ .28 rad (cleave),
lean ≤ .15 rad, weight-shift ≤ .14·r (~2px), squash só no blunt. Limites verificados em
todas as amostras (D05): |rotation| ≤ .4, |offset| ≤ .3·r, escala .7–1.3. A arma carrega
a maior parte da animação; o corpo "acompanha". Nada teleporta, desliza ou deforma além.

**Composição determinística** (audit §18): `visualPlayerDrawPose(p)` =
**base(melee) → hurt por cima** (`offsets/rot somados, escalas/alpha multiplicados`),
escrita em scratch fixo, sem alocação. Hurt não cancela melee (D08) nem vice-versa (D09).
Recoil ranged/weaponFire (fundação A) coexiste (S06). Dash não conflita: é mecânico
(posição/ghosts) e o anel visual dele já existia; a ordem de aplicação no `drawUnit`
permanece pose → rotate(aim) → corpo → grupamento arma. Soma de rotação sempre limitada
(S08). Zero NaN/Infinity/scale-zero garantidos por `visualPose`/`visualFinite` da fundação.

## 8. Trail (audit §13)

`meleeDrawTrail(s,prof)` — o trail **segue o ângulo real da lâmina** a cada frame
(`meleeVisualTrailAngle`, derivado do relógio do próprio swing — determinístico) e
**reforça** a trajetória, não substitui a animação:

| estilo | armas | desenho |
|--------|-------|---------|
| `arc` | blade, katana, scythe, chains | arco direcional atrás da lâmina (cauda .8–1.35 rad) + fio branco + setor translúcido — **3 paths** |
| `line` | glaive | afterimage longitudinal (punho→ponta na direção do aim, cresce com a extensão) — 2 paths, 0 arcs |
| `impact` | hammer, gaunt | cunha compacta no ponto de contato (fill+stroke) — 2 paths |

- **cor**: a da arma (ou `#fff6b0` no crítico — comportamento preservado, E11);
- **zero shadowBlur** (o arco genérico usava `shadowBlur=26·k` — Audit #1); só
  stroke/fill/alpha/geometria;
- vida = fases do perfil; nada de partículas para desenhar trajetória;
- **fallback legado preservado**: swings sintéticos sem perfil (fixtures de auditoria)
  continuam desenhando o arco genérico original byte-a-byte (E10) — os goldens A–I do
  Performance Audit #1 seguem idênticos.

## 9. Impacto (audit §14/§15)

Inventário de FX existente: estilhaços por alvo atingido (4), shake, áudio, shockwave
(hammer), flash/crit. Prioridade aplicada: **movimento da arma > pose > trail > impact
FX** — nada foi empilhado. A única adição é **1 anel pequeno de contato**
(`spawnRing` no pool de partículas, r 3→12–20px, vida .17s, sem blur) no **último ponto
realmente atingido** — exatamente 1 por ataque com acerto, nunca por inimigo (G14/G15),
nunca em miss. Micro-hitstop: **não implementado** (por preferência do escopo).

## 10. Orientação / aim 360° (audit §16)

A pose é **relativa ao aim** (aplicada dentro do frame rotacionado da unidade), então
funciona idêntica em 360°: testes F01–F08 cobrem direita, esquerda, cima, baixo e as 4
diagonais — pose finita, lâmina sempre dentro de ±π do aim (nunca "aponta para trás":
`max|rot| < π` garantido pelos próprios perfis, A15), trail com argumentos finitos.
`dir=±1` alterna o lado do corte espelhado com o `swingDir` mecânico (B13/C13) — o corte
sai sempre do lado correto, sem sprite espelhando incorretamente (o sprite nunca é
espelhado; apenas rotaciona). Nenhuma arma atravessa o jogador de forma incoerente.

## 11. Weapon switch / cancel (audit §17)

`setWeaponSlot` chama `meleeVisualCancel(player)` — a timeline visual anterior é
cancelada em **qualquer fase** (windup/active/recover — S01–S03) e a pose volta ao
neutro imediatamente: sem pose fantasma, sem arma anterior balançando, sem estado preso.
Trocas repetidas em combate: sempre limpo (S05). **Cooldown real intocado** — o
`fireTimer=min(fireTimer,.12)` pré-existente permanece exatamente igual (S04).

## 12. Echos (audit §19)

Ecos aliados e hostis usam os mesmos `fireWeaponFrom/fireMelee/drawUnit` — o sistema
funciona com eles **de graça**: a timeline inicia no fire do Eco (J01/J03), avança no
`visualTimelineTick` que o `updateEcho` já executava (J02), e os call sites de desenho
do Eco (estável, glitch, hostil) e do Eco Sombrio passam `melee:visualMeleeWeaponPose(e)`
— o mesmo padrão de `recoil:visualWeaponRecoil(e)` que já usavam. **Zero mudança de
IA**, zero código de Eco além de 1 opt por call site. Silhuetas da Presença Temporal
(memórias congeladas) continuam estáticas por design.

## 13. Ranged (audit §20)

Nada de muzzle/projéteis/recoil ranged/beams/trails foi tocado (pins SHA de
`updatePlayer`/`updateProjectiles`/`drawProjectile` no teste; goldens do audit #1
idênticos). Compatibilidade preservada — PR15.5-E cuidará deles.

## 14. Performance — fast path e custos (audit §21–§24)

**Fast path (filosofia A-FIX #1):** sem golpe ativo, `visualMeleeWeaponPose`,
`visualMeleeBodyPose` e `visualPlayerDrawPose` retornam **null** após 1–2 leituras de
campo; `drawUnit` segue o caminho byte-a-byte anterior; `drawSwings` com array vazio não
roda; o hot-path do tick ganhou apenas 1 leitura de campo. Perfis: cache fixo congelado
de 7 — nada cresce durante a run.

**Custo idle = zero (comprovado):** benchmark cenário A (600 frames, melee equipada):
ANTES e DEPOIS **idênticos** em ops/frame (73), save/restore (14), paths (18),
transforms (8), blurDraws (8), sin/cos (2) e RNG (0). O DEPOIS adiciona apenas 2
chamadas de pose/frame que retornam null imediatamente — o mesmo padrão/da ordem das
chamadas `visualHurtPose`/`visualWeaponRecoil` que o baseline já fazia por frame.

**Custo ativo = curto, limitado e previsível:** durante o swing: +2–3 transforms/frame
(grupamento), +1.5–2 sin/cos/frame (2 trig exatos), trail com 3 paths/2 paths e
**−1 a −2 blurDraws/frame** (o trail novo não usa blur). Nos cenários B–H o ops/frame
fica **igual ou menor** que o ANTES (H/katana: 79→77; B: 80.2→80.8 com +.6 vindo dos
transforms do grupamento, já devolvido pela queda de blur/paths). No render completo
com sopa de FX (G): 3919→3930 ops/frame (+0.3%). **RNG idêntico em todos os cenários** —
o draw não consome aleatoriedade de gameplay.

**shadowBlur:** nenhum blur novo por arma melee em loop; o blur existente da arte
(corpo do player/sprites de arma) é preservado e o blur do trail foi **removido** — o
DEPOIS tem menos passagens com blur que o ANTES em todos os cenários de ataque.

**save/restore:** **zero pares extras** — a pose da arma reutiliza o par
save/restore que já envolvia o `drawWeaponSprite`; idem o trail (1 par, como antes).
Benchmark: save/restore por frame igual ou menor (H: 16→15.2; B: 15.3→15).

## 15. Testes (audit §25/§26)

`tests/pr15-5-d-melee-animation.test.js` — **166 checks, 0 falhas**, cobrindo:
inventário/perfis/identidade (A), timeline/fases/robustez de dt (B), pose da arma com
impacto cruzando o centro e retorno ao neutro (C), pose corporal+composição hurt (D),
trail por estilo/fallback/sincronia de relógios (E), orientação 360° em 8 direções ×
7 armas (F), **alinhamento mecânico** — dano instantâneo no fire, cooldown/range/
hitbox/nº de hits/propriedades especiais intactos, anel de contato só no acerto,
pins SHA de `WEAPONS/EDEFS/waveCompBase/MINIBOSS/spawnBoss/updatePlayer/updateSwings/
updateEcho` byte-a-byte idênticos à base 4667720b + pin do novo `fireMelee` (G),
pureza de draw/persistência zero (H), fast path/custos estruturais com contagem de ops
(I), weapon switch/cancel/recoil/hurt (S), Ecos (J), robustez/stress/spam (K).

Manutenção pontual de suítes existentes (re-baseline documentado):
`pr15-5-performance-audit1.test.js` — pin do `drawSwings` atualizado + **novo pin do
`meleeDrawTrail`** (prova que o trail não ganha RNG/tempo); todos os goldens A–I e os
demais pins permanecem intactos. Nenhuma outra suíte foi alterada.

## 16. Limitações

- A latência de impacto visual (≤ .25s, família-dependente) é um compromisso assumido:
  dano instantâneo + antecipação legível. Para hammer/chains a percepção de impacto
  t=0 vem do shake/onda/anel existentes; a lâmina "termina" o golpe logo depois.
- Braços e arma giram como grupamento rígido (sem IK por braço) — decisão de leitura e
  custo; correto para os ângulos usados (|rot| < π).
- Ecos recebem a pose da arma mas não a pose corporal (corpos menores/fantasma; risco
  zero vs. benefício mínimo — documentado, não é regressão).
- Silhuetas de Presença Temporal (Fracture) continuam estáticas — estética de memória
  congelada.
- O fallback legado do arco genérico (com blur) ainda existe para swings sintéticos de
  fixtures — só é alcançável por auditoria/DEV, nunca por gameplay real.

## 17. Roteiro de replaytest humano (Electron) — audit §33

**Setup:** `npm start` · Sandbox DEV (laboratório) para equipar cada arma · métricas ON
(painel inferior-esquerdo). Rode com FPS médio visível e compare com o baseline
aproximado de 60.

1. **Cada arma individualmente** (blade, katana, scythe, chains, glaive, gaunt, hammer):
   ataque inimigos reais. A arma engata atrás, varre, passa do alvo e volta? As sete
   parecem armas diferentes (flick × ceifada × giro × estocada × soco × marretada)?
2. **Direita/esquerda**: mire para cada lado — o corte alterna o lado corretamente a
   cada golpe (swingDir)?
3. **Cima/baixo e diagonais**: a trajetória permanece coerente (corte sai do lado
   certo, nada atravessa o player de forma estranha)?
4. **Sequência rápida**: segure o botão com katana/gaunt — os golpes encadeiam sem pose
   presa?
5. **Troca de arma**: ataque e troque (1–4/Q/X) em pleno swing — cancela limpo, sem
   arma fantasma balançando, sem cooldown estranho?
6. **Hurt durante ataque**: tome dano em pleno swing — o hit reage por cima sem quebrar
   a animação?
7. **Muitos inimigos**: onda densa (25–46) com scythe/chains — FPS segue próximo do
   baseline? Anel de contato aparece só quando acerta?
8. **Muitos FX**: Sandbox cenário FX-heavy + hammer (shockwave + trail + shake) —
   legibilidade e FPS.
9. **Sandbox**: laboratório completo, troca de armas repetida, spam.
10. **Métricas ON**: observar CUSTO/FRAME e FPS durante tudo acima.
11. **Métricas OFF**: repetir 7–8 e confirmar que o comportamento visual é o mesmo.

**Perguntas-chave:** a arma realmente executa o ataque? As armas parecem diferentes?
Existe sensação de peso (hammer/glaive)? A animação acompanha o hit? Alguma arma parece
só um arco genérico ainda? Alguma exagerada/deformada? Pose presa em algum caso? FPS
próximo do baseline?

**Gate de performance:** se o idle com melee equipada mostrar qualquer custo perceptível
(métricas ON), ou FPS médio cair visivelmente abaixo do baseline nos cenários 7–8 →
NO-GO e reportar.

---

## Resumo de arquivos

| arquivo | mudança |
|---------|---------|
| `index.html` | bloco PR15.5-D (perfis, fases, poses, trail), integração em `fireMelee`/`drawSwings`/`drawUnit`/`drawPlayer`/Ecos/`setWeaponSlot`/`visualState`/`visualTimelineTick` |
| `tests/pr15-5-d-melee-animation.test.js` | novo — 166 checks |
| `tests/pr15-5-performance-audit1.test.js` | re-baseline do pin `drawSwings` + pin novo `meleeDrawTrail` |
| `audit_pr155/melee_animation_benchmark.js` | novo — benchmark estrutural ANTES/DEPOIS (A–H) |
| `audit_pr155/melee_animation_results.json` | resultados do benchmark |
| `audit_pr135/harness.js` | exportações de teste das funções D |
| `PR15_5_D_MELEE_ANIMATION.md` | este documento |

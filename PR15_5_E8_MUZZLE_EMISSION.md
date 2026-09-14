# PR15.5-E8 — Muzzle / Emissão por Família

Fazer o **instante do disparo** carregar identidade de família. O critério de
sucesso é o jogador dizer *"essas armas disparam de jeitos diferentes"* — e
nunca *"adicionaram mais partículas"*.

Projétil = **o que** a arma lança (E1/E2/E3). Muzzle = **como** a arma solta
isso no mundo. Devem conversar sem ser a mesma coisa.

---

## 1. O problema anterior

As 20 armas ranged compartilhavam **uma única linha** em `fireWeaponFrom`:

```js
spawnParticles(src.x+Math.cos(src.aim)*(src.r+10),
               src.y+Math.sin(src.aim)*(src.r+10),
               def.color,3,140,.18,2.5);
```

Rail (kick 280, cano de trilho eletromagnético) e SMG (kick 22, cadência de
0.065 s) produziam **exatamente o mesmo evento**: 3 partículas, 140 de
velocidade, 0.18 s de vida, raio 2.5. A única diferença entre 20 armas era a
cor — e a direção artística do projeto é explícita: *a cor ajuda, a forma
decide*.

### A causa raiz não era o volume

O detalhe que define todo o E8 está dentro de `spawnParticles`:

```js
const a=rand(0,TAU);
```

O ângulo é sorteado no círculo **completo**. Era literalmente impossível ter
emissão direcional com esse helper: o leque de uma shotgun e o flash contido
de um sniper saíam como a mesma nuvem isotrópica, indiferente à mira. Subir o
número de partículas só deixaria a nuvem maior — não mais legível.

Portanto o E8 **não** é "mais partículas". É trocar ruído isotrópico por
**geometria direcional**.

---

## 2. Arquitetura

Três funções novas, todas imediatamente antes de `fireWeaponFrom`:

| Função | Papel |
|---|---|
| `muzzleShot(x,y,ang,color,n,spd,life,r,spread)` | Emissão direcional determinística |
| `muzzlePower(def)` | Traduz `kick` em sinal visual comprimido |
| `emitWeaponMuzzleVisual(src,def)` | Assinatura por família; único ponto de chamada |

`fireWeaponFrom` continua legível — a emissão inteira é **uma linha**:

```js
emitWeaponMuzzleVisual(src,def);
```

### `muzzleShot` — direcional e sem RNG

O **índice** da partícula define tudo. Para `n` partículas, `u = -1..1`
simétrico sobre o eixo:

```js
const u=n>1?(i/(n-1))*2-1:0;
const a=ang+u*spread;                      // leque em torno da mira
const s=spd*(.55+.45*(1-Math.abs(u)));     // centro mais rápido que as bordas
```

Vida e raio decaem igual nas bordas. O resultado é uma forma — cone, jato ou
flash — e não uma amostra aleatória. Mesma entrada, mesma saída, **zero
`Math.random`**, zero alocação (usa `partTake()`, o pool existente), respeita
`cfg.parts` e o teto `PARTS_MAX`.

### `muzzlePower` — kick como SINAL, não escala crua

```js
return clamp(.75+Math.abs(def.kick||0)/420,.75,1.4);
```

Rail (kick 280 → 1.40) parece mais violento que SMG (kick 22 → 0.80), mas a
razão entre eles é **1.75×**, não 12.7×. Sem o clamp, "kick 280" viraria
"50 partículas". O kick modula só a velocidade de saída — nunca a contagem.

### Famílias

Reusa `PROJ_FAMILY` do E1 — **nenhuma tabela nova foi criada**.

---

## 3. Variação por arma

Números medidos na implementação real (abertura = meia-abertura observada):

| arma | família | kick | power | parts antes | parts depois | abertura | vel. máx | vida |
|---|---|---|---|---|---|---|---|---|
| rail | SLUG | 280 | 1.40 | 3 | 4 | 4° | 250 | 0.15 |
| sniper | SLUG | 190 | 1.20 | 3 | 2 | 3° | 79 | 0.09 |
| nail | SLUG | 30 | 0.82 | 3 | 2 | 6° | 68 | 0.07 |
| plasma | ENERGIA | 55 | 0.88 | 3 | 3 | 32° | 84 | 0.20 |
| orb | ENERGIA | 40 | 0.85 | 3 | 3 | 32° | 80 | 0.20 |
| cryo | ENERGIA | 60 | 0.89 | 3 | 3 | 32° | 85 | 0.20 |
| void | ENERGIA | 50 | 0.87 | 3 | 3 | 32° | 83 | 0.20 |
| flamer | FLUIDO | 8 | 0.77 | 3 | **2** | 36° | 72 | 0.07 |
| acid | FLUIDO | 26 | 0.81 | 3 | 2 | 36° | 76 | 0.09 |
| shotgun | ENXAME | 210 | 1.25 | 3 | 6 | 33° | 262 | 0.16 |
| smg | ENXAME | 22 | 0.80 | 3 | **1** | 0° | 144 | 0.07 |
| homing | ENXAME | 34 | 0.83 | 3 | 3 | 24° | 91 | 0.18 |
| prism | ENXAME | 44 | 0.85 | 3 | 3 | 17° | 128 | 0.14 |
| tesla | CONDUÇÃO | 38 | 0.84 | 3 | 2 | 49° | 111 | 0.06 |
| plague | CONDUÇÃO | 30 | 0.82 | 3 | 3 | 29° | 70 | 0.24 |
| ricochet | CINÉTICO | 40 | 0.85 | 3 | 2 | 19° | 88 | 0.09 |
| boomer | CINÉTICO | 20 | 0.80 | 3 | 3 | 38° | 104 | 0.16 |
| gatling | CINÉTICO | 26 | 0.81 | 3 | **1** | 0° | 146 | 0.07 |
| mine | CINÉTICO | 18 | 0.79 | 3 | 2 | 43° | 31 | 0.16 |

Leitura pretendida:

- **Rail** — descarga curta, estreita (4°) e rápida (250): violência contida no eixo.
- **Sniper** — a emissão mais contida do arsenal (3°), lenta e de vida curta: limpeza, não espetáculo.
- **Nail** — impulso material curto, mecânico, compacto (0.07 s).
- **Energia** — condensação arredondada, lenta (≈84) e de vida longa (0.20). **Sem anel universal**; plasma é barato; orb mantém sua identidade do E1.
- **Fluido** — abertura de cone (36°) e vida curtíssima. **Não é fluxo persistente** — isso é escopo do E5.
- **Shotgun** — leque largo e veloz, a maior emissão do jogo (6): a dispersão *é* a arma.
- **SMG / Gatling** — flash mínimo de 1 partícula no eixo. A densidade vem da cadência.
- **Homing** — cápsulas lentas e médias. **Prism** — segmentado, mais estreito e rápido.
- **Tesla** — bifurcação geométrica de 49° com `n=2`: as duas bordas do leque *são* a bifurcação, obtida por índice, **sem RNG**.
- **Plague** — orgânico contido, o mais lento (70) e o de maior vida (0.24). **Sem cloud.**
- **Ricochet** — flash angular estreito. **Boomer** — abertura larga que sugere rotação.
- **Mine** — o mais lento de todos (31) e muito aberto (43°): lançamento, não tiro linear.

### Por que o flamer usa 2 e não 1

Um cone precisa de **duas bordas**. Com `n=1` a partícula cai em `u=0`, ou
seja, exatamente no eixo — e o flamer sairia como uma agulha, visualmente
indistinguível de um slug. 2 é o mínimo que lê como abertura, e ainda assim
é **menos** que as 3 do emissor antigo, apesar de o flamer ser a arma de maior
cadência do jogo (0.045 s). A contenção veio da vida (0.07 s), não do volume.

---

## 4. Beam

`fireBeam` calcula a própria origem (`src.r+6`) e **retorna antes** da emissão
de projétil, portanto nunca recebeu o muzzle genérico. `drawBeamFrom` não foi
tocado. O beam permanece um caso especial, como especificado.

---

## 5. Custo

**A carga média caiu.**

| métrica | antes | depois |
|---|---|---|
| partículas/disparo (total, 19 armas) | 57 | **50** |
| média por arma | 3.00 | **2.63** |
| armas de alta cadência (smg/gatling) | 3 | **1** |
| flamer | 3 | **2** |
| `Math.random()` por disparo (soma das 19) | 294 | **66** (−78%) |

A queda de RNG é consequência direta da arquitetura: `spawnParticles` gastava
**4 `rand()` por partícula** (ângulo, velocidade, vida, raio). `muzzleShot`
gasta zero — tudo deriva do índice. As 66 chamadas restantes são do espalhamento
mecânico das armas (`spread` de shotgun etc.), que é intocável e não pertence
ao E8.

Shotgun (6) é a única arma acima do valor antigo, e é a que dispara mais devagar
(0.74 s de intervalo) — o pico por evento é irrelevante na média temporal.

Proibições respeitadas por tiro: nenhum gradient, `shadowBlur`, `Path2D`,
array literal, objeto temporário, timer, histórico ou cache. `PARTS_MAX`
continua sendo o teto (verificado com 400 disparos consecutivos de shotgun).

---

## 6. Determinismo

`muzzleShot` não contém `Math.random`, `rand` nem `randi` — verificado por
inspeção de texto-fonte e por contagem de chamadas em runtime nas 19 armas
(0 em todas). 20 emissões repetidas produzem retratos byte-idênticos.

`spawnParticles` permanece **intacto**, com seu `rand(0,TAU)` legítimo, para
todos os outros usos do jogo.

O muzzle é **evento**, não draw: nenhuma função de render chama
`emitWeaponMuzzleVisual` ou `muzzleShot`, e existem exatamente 2 ocorrências do
nome no arquivo (1 definição + 1 chamada, dentro de `fireWeaponFrom`). O
renderer segue observer-only.

---

## 7. Echo e Repetição Ancorada

O Echo **herda a assinatura da arma**: `emitWeaponMuzzleVisual` recebe apenas
`(src, def)` e não contém nenhuma referência a `slot`, `isEcho`, `echoes` ou
`owner`. A emissão diz *que arma disparou*, nunca *quem disparou*. Echo com
rail produz emissão idêntica à do jogador com rail, na cor da arma. **Não há
muzzle genérico de Echo.**

`replayTemporalAction` não chama `fireWeaponFrom` nem o muzzle — o replay
mantém exatamente os FX de origem que o PR15.7 já tinha. **Nenhum muzzle extra**
é disparado, e nada é emitido na posição atual do jogador. PR15.7 intocado
(janela 5 s, cooldown 6 s, dano 0.50 confirmados).

---

## 8. Mecânica

Nada de mecânico mudou. A prova é comportamental: nas 19 armas ranged, com
`Math.random` determinístico, comparando o estado **antes** (commit `055c775`)
e **depois** do E8:

- `projectiles.length` — idêntico
- `vx`, `vy`, `dmg`, `color`, `type` de cada projétil — idênticos
- recoil aplicado (`player.vx`, `player.vy`) — idêntico
- **0 campos divergentes em 19 armas**

`dmg`, `speed`, `range`, `count`, `spread`, `interval`, `kick` e `pr`
verificados numericamente contra os valores esperados.

### Golden re-baselineado

`pr15-5-performance-audit1.test.js` guarda um hash do **texto-fonte** de
`fireWeaponFrom`. Como a função teve uma linha alterada, o hash mudou:
`46e74865…` → `d53ff3c0…`.

O diff foi auditado linha a linha contra `git show 055c775` e consiste
**exclusivamente** na troca da chamada de emissão. Não houve mudança de
geometria de projétil nem de mecânica, e a equivalência comportamental está
demonstrada acima. O re-baseline está documentado em comentário no próprio
teste.

Os hashes de `drawProjectile` e das 9 cenas de Canvas **não** mudaram — o E8
não toca o renderer.

---

## 9. Testes

`tests/pr15-5-e8-muzzle-emission-identity.test.js` — **67 checks, 0 falhas**.

| grupo | cobertura |
|---|---|
| A · arquitetura | helpers existem; 19 armas emitem; reuso de `PROJ_FAMILY`; beam e melee retornam antes; `drawBeamFrom` intacto; emissão é 1 chamada |
| B · identidade | rail≠sniper≠nail; sniper o mais contido em leque; shotgun mais aberta que SMG; fluido ≠ slug; tesla ≠ plague; mine ≠ tiro linear; 6 famílias distintas; **emissão direcional** em qualquer ângulo de mira |
| C · mecânica | cor preservada; projétil, dmg, speed, spread, count, cooldown, kick, recoil intactos; helper não toca estado |
| D · custo | teto de 6; smg/gatling ≤1; média ≤ legado; bursts de 60 disparos limitados; `PARTS_MAX` respeitado; sem gradient/blur/Path2D/alocação; pool usado; `cfg.parts` funcional |
| E · determinismo | 0 RNG nas 19 armas; RNG global caiu vs legado; 20 emissões idênticas; `spawnParticles` intacto |
| F · observer-only | render não emite, não cria partículas e não consome RNG |
| G · Echo/replay | mesma assinatura; sem muzzle de Echo; replay sem muzzle extra; PR15.7 intacto |
| H · escopo | formas E3 (rail/sniper/nail) inalteradas; 16 armas na linha legada; orb/eorb; camada temporal E2; gramática E1 |
| I · regressão | suíte descoberta pelo runner; E0/E1/E2/E3/PR15.7/audit presentes; PR15.5-C/D preservados |

Dois testes falharam durante o desenvolvimento e **apontaram defeitos reais**,
corrigidos no código e não no assert:

1. **B08** flagrou que o flamer, com `n=1`, tinha abertura zero — um "cone" que
   era uma agulha. Corrigido para 2 partículas.
2. **B05** comparava aberturas contra smg/gatling, cuja emissão de amostra
   única tem abertura 0 por construção. O assert foi reescrito para comparar
   apenas emissões em leque — a afirmação original não era verificável.

Regressão completa: **63 suítes, 0 falhas, 4085+ checks**.

---

## 10. Replaytest humano

Usar o sandbox existente. Roteiro sugerido:

1. Alternar **rail → sniper → nail** disparando contra parede. Os três são
   estreitos, mas rail é uma descarga, sniper é quase invisível e nail é um
   estalo mecânico curto.
2. **Shotgun vs SMG** em sequência: leque largo e pesado contra flash mínimo.
3. Segurar **flamer** e **gatling**: confirmar que a alta cadência não cria
   acúmulo de partículas nem queda de frame.
4. **Tesla vs plague**: bifurcação seca contra emissão lenta e orgânica.
5. **Mine**: deve parecer algo *largado/arremessado*, não disparado.
6. Com **Echo** ativo, confirmar que ele dispara com a assinatura da arma.
7. Com **Repetição Ancorada**, confirmar que o replay **não** gera muzzle novo.

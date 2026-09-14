# PR15.5-E2 — IDENTIDADE TEMPORAL DOS PROJÉTEIS

> **A camada temporal não é a arma.**
> O tempo apenas deixa uma cicatriz visual sobre ela.
> Se um Rail temporal parecer "um projétil ciano", o E2 falhou.

Base: `210da13` (E1). Escopo: corrigir a dívida visual temporal **sem tocar mecânica**.

---

## 1. O BUG

A auditoria PR15.5-E encontrou, em `replayTemporalAction`:

```js
const color = a.weaponId==='shotgun' ? TEMPORAL_REPLAY_COLOR : '#46e0ff';
```

E `drawProjectile` **ignorava completamente** a flag `temporalReplay`.

### Consequência medida

| Arma repetida | Cor antes | Era igual a… |
|---|---|---|
| `rail` | `#46e0ff` | **plasma comum** |
| `sniper` | `#46e0ff` | **plasma comum** |
| `plasma` | `#46e0ff` | plasma comum |
| `shotgun` | `#ff4df0` | nada (magenta puro) |

Um Rail repetido era **visualmente indistinguível de um tiro comum de plasma**. A Repetição Ancorada apagava a identidade da arma que estava repetindo — e o Shotgun ia para o extremo oposto, virando magenta sólido sem relação com sua cor.

### Causa

Duas decisões que se somaram: a cor era **substituída** no spawn em vez de acrescentada, e não havia camada no render para carregar a assinatura temporal. Sem um lugar para pôr o "temporal", ele acabou ocupando o lugar do "qual arma".

---

## 2. SOLUÇÃO

Separar os dois canais que estavam disputando o mesmo espaço:

```
COR  → identidade da ARMA   (dominante, no corpo)
CAMADA → identidade TEMPORAL (acento, atrás do corpo)
```

### 2.1 Preservação da cor base

```js
const wdefTemporal = WEAPONS.find(w=>w.id===a.weaponId);
const color = (wdefTemporal && wdefTemporal.color) || '#46e0ff';
```

A cor vem da própria arma via `weaponId`, que **o snapshot já guardava** — nenhum campo novo, nenhum acoplamento novo, nenhum toque no payload mecânico. Fallback ciano preservado para `weaponId` desconhecido.

| Arma | Cor antes | Cor agora |
|---|---|---|
| `plasma` | `#46e0ff` | `#46e0ff` (inalterada) |
| `shotgun` | `#ff4df0` | **`#ffb347`** |
| `rail` | `#46e0ff` | **`#8ff6ff`** |
| `sniper` | `#46e0ff` | **`#bffbff`** |

As 4 armas da whitelist agora têm cores mutuamente distintas (testado).

### 2.2 Camada temporal

```js
function drawProjectileTemporalLayer(p,k,strong)
```

Desenha um **fantasma atrás do corpo, na própria linha de voo**. Essa escolha é deliberada: um eco *atrás* lê como "o que já passou" e **não alarga a silhueta** — decisivo para não poluir o combate denso nem confundir a leitura da arma. Um halo ou anel em volta faria o oposto.

- **Replay** (`strong`): dois subtraços, alpha `0.30` — dupla-imagem = "isto aconteceu duas vezes".
- **Echo**: um subtraço, alpha `0.20` — mais sutil, como pede o §8.

`TEMPORAL_REPLAY_COLOR` (`#ff4df0`) continua existindo e é usado **como acento**, nunca como corpo.

### 2.3 Ortogonalidade (§11)

A camada **não conhece arma alguma** — testado: não menciona `rail`, `sniper`, `plasma`, `shotgun`, `orb` nem `PROJ_FAMILY`. Lê apenas `x`, `y`, `vx`, `vy`, `r`: o contrato mínimo que qualquer forma futura terá. Quando E3+ redesenhar as formas-base, **a camada continua funcionando sem alteração**.

O E1 foi aproveitado integralmente; `drawProjectile` não voltou a ser monolítico:

```js
if(orb) drawProjectileOrbShape(p); else drawProjectileLegacyLine(p);
const tm=projectileTemporalMode(p);
if(tm!==PTM_NONE) drawProjectileTemporalLayer(p,fade,tm===PTM_REPLAY);
```

---

## 3. DETECÇÃO — INVESTIGADA, NÃO ASSUMIDA

O §17 exigia validar em vez de supor. Investiguei:

| Fato verificado | Resultado |
|---|---|
| `player.slot` | **`undefined`** — `makePlayer` não define slot |
| Inimigos com `slot` | **0 de 183**, em 7 cenários de fixture |
| `makeEcho(data,slot)` | único lugar que atribui slot (1..N) |
| Echo tem `.data` | sim |

```js
function projectileTemporalMode(p){
  if(!p)return PTM_NONE;
  if(p.temporalReplay)return PTM_REPLAY;        // prioridade (§18)
  const o=p.owner;
  if(o&&o!==player&&o.slot>0&&o.data)return PTM_ECHO;
  return PTM_NONE;
}
```

O check `o!==player` é redundante hoje, mas barato e protege caso um operador futuro passe a ter `slot`.

**O que a detecção deliberadamente NÃO usa:**
- ❌ `p.type` — `eorb` é o tipo de **todo** projétil de inimigo/miniboss/boss (9 pontos de criação). Usá-lo daria camada temporal a bosses.
- ❌ `p.team` — `'ally'` pode incluir fontes futuras; é a heurística frágil que o §17 proíbe.

**Replay tem prioridade sobre Echo** (§18): um projétil marcado como ambos recebe só a camada forte, nunca duas empilhadas.

---

## 4. PRESERVADO

- **Orb** (§20): mantém círculo pulsante + anel; testado que a camada **não adiciona arcos** — continuam exatamente 2, sem virar dois círculos grandes confusos.
- **Beam** (§21): `drawBeamFrom` **não tocado**. Não gera projétil e não está na whitelist do replay.
- **`eorb` inimigo** (§9): nunca recebe camada.
- **Fade de alcance** (§19): a camada recebe **o mesmo `fade`** da forma base. Medido: alpha da camada cai de `0.30` → `0.045` no fim do alcance (6.7×), junto com o corpo. Guarda `if(k<=.02)return` impede fantasma sobrevivente.
- **Forma base**: desenhada **primeiro** e nunca alterada — testado por comparação de prefixo do traço.

---

## 5. MECÂNICA — ZERO ALTERAÇÕES

Verificado por teste: janela 5 s, cooldown 6 s, dano 0.50 (dano do rail temporal = exatamente 39 = 78×0.5), `crit:false`, `owner:null`, `def:null` (sem procs/lifesteal/chain), cap de projéteis, pierce do rail limitado a 1..4, telemetria, whitelist. `fireWeaponFrom`, `updateProjectiles` e `onProjectileHit` não referenciam a camada visual.

---

## 6. DETERMINISMO E PERFORMANCE

Zero `Math.random`/`rand`/`randi`; zero spawn; zero mutação de coleções. **Sentinel: 50 desenhos temporais → RNG = 0.** Trinta desenhos consecutivos produzem traço idêntico; 50 renders sem avanço lógico não alteram nada.

O deslocamento é derivado de `vx`/`vy` (direção do voo), sem estado novo e sem depender da contagem de frames.

**Custo: 10 comandos Canvas extras no replay, 7 no Echo.** A primeira versão custava 14; unifiquei os dois subtraços em **um único `beginPath`/`stroke`**, o que também configura o estado de linha uma vez só. Sem `shadowBlur`, sem gradiente, sem `Path2D`, sem `save`/`restore`, sem alocação. Custo **zero** quando o projétil não é temporal (um teste de flag).

Cena densa testada (8 rails temporais + 7 pellets de shotgun + 6 projéteis de Echo): render não spawna nada, não muta coleções, não consome RNG.

---

## 7. TESTES

### Nova suíte — `tests/pr15-5-e2-temporal-projectile-identity.test.js`
**83 checks, 0 falhas**, em 10 blocos: cor base preservada (10) · detecção de modo (11) · camada no render (9) · diferenciação (6) · fade (3) · orb e beam (4) · determinismo/observer (8) · mecânica (12) · performance (8) · regressões (12).

Destaques: **A05/A06** travam a regressão do bug original (rail e sniper não podem voltar a ter a cor do plasma); **D05** prova que o replay continua identificável *mesmo* com a cor da arma preservada (mesma arma, mesma cor, só a flag muda → traços diferentes); **B09** revalida os 183 inimigos sem `slot` a cada execução.

### Regressão

```
SUÍTES: 61  ·  COM FALHA: 0  ·  CHECKS ✔: 3941  ·  FALHAS ✘: 0
```

### Goldens (§26)

**Os 18 goldens de cena (`hashCanvas` + RNG dos cenários A–I) passaram sem qualquer alteração** — cenas não temporais estão intactas, exatamente como o §26 pede. Os fixtures de performance não contêm projéteis de replay nem de Echo, então a camada nunca é acionada neles.

**Dois ajustes, ambos investigados e documentados, nenhum afrouxando assertiva:**

1. **`pr15-5-performance-audit1`** — rebaseline do hash do **texto-fonte** de `drawProjectile` (ganhou 2 linhas). Continua igualdade estrita de SHA-256.
2. **`pr15-5-e1` §I03/§I04** — **invertidos, não removidos**. Quando escrevi o E1, esses checks travavam o escopo afirmando *"o fix temporal pertence ao E2"*. O E2 chegou e corrigiu; agora eles protegem o inverso — que a camada existe e que a forma base é preservada. A cobertura **aumentou**: `I04` passou a verificar prefixo de traço, garantia mais forte que a igualdade anterior.

---

## 8. IMPACTO EM E3+

As formas-base serão redesenhadas família a família. Como a camada é ortogonal e lê só o contrato mínimo, **cada nova forma herda a assinatura temporal automaticamente**, sem trabalho adicional e sem risco de o rework reintroduzir o bug do ciano.

---

## 9. REPLAYTEST HUMANO

**Repetição Ancorada** — disparar e repetir Plasma, Shotgun, Rail e Sniper:
1. Dá para perceber que é uma repetição temporal?
2. Dá para perceber **qual arma** foi repetida?
3. **Rail temporal parece Rail ou voltou a parecer Plasma?** (era o bug)
4. Shotgun temporal continua parecendo Shotgun (laranja, em leque)?

**Echos** — comparar tiro do jogador e tiro do Echo:
5. O tiro do Echo tem assinatura temporal discreta?
6. A camada atrapalha a leitura em combate denso?
7. Está ficando "neon demais"?

Resposta desejada: **"tem identidade temporal sem apagar a identidade da arma."**

Atenção ao **fim de alcance** (base e fantasma devem sumir juntos) e ao **Orb temporal** (não pode virar dois círculos confusos).

---

## 10. ARQUIVOS

| Arquivo | Mudança |
|---|---|
| `index.html` | cor base no spawn + `projectileTemporalMode` + `drawProjectileTemporalLayer` + 2 linhas no dispatch |
| `audit_pr135/harness.js` | +5 linhas de bridge (sob `typeof`) |
| `tests/pr15-5-e2-temporal-projectile-identity.test.js` | **novo** — 83 checks |
| `tests/pr15-5-e1-projectile-visual-grammar.test.js` | 2 checks invertidos, documentados |
| `tests/pr15-5-performance-audit1.test.js` | 1 rebaseline de hash de texto-fonte |
| `PR15_5_E2_TEMPORAL_PROJECTILE_IDENTITY.md` | este documento |

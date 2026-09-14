# PR15.5-E3 — SLUG / PENETRADOR (rail · sniper · nail)

> **O E3 não faz três versões da mesma linha.**
> Rail = velocidade + penetração. Sniper = precisão + alcance. Nail = massa física.
> A cor ajuda. **A forma decide.**

Base: `fd6ea67` (E2). Primeira família visual real do PR15.5-E.

---

## 1. PROBLEMA

As três armas eram **a mesma linha**, variando apenas cor e espessura (`pr` 5 / 4 / 2.4):

```js
const l = p.type==='plasma' ? 10 : 5;
ctx.lineWidth = p.r;
ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-vx/sp*l, p.y-vy/sp*l);
```

Isso é incompatível com a mecânica. O Rail tem `speed 2100`, `pierce 99`, `dmg 78`, `kick 280` — a arma mais brutal do jogo — e desenhava um traço de 5 px. Em escala de cinza, as três eram indistinguíveis.

---

## 2. SOLUÇÃO — TRÊS CONSTRUÇÕES, NÃO TRÊS ESCALAS

O critério do §29 foi o guia: *"em branco, sem glow e sem HUD, consigo dizer qual é qual?"*. Por isso cada arma recebeu uma **topologia geométrica diferente**, não um ajuste de tamanho:

| Arma | Construção | Ops de geometria |
|---|---|---|
| **rail** | polígono preenchido (cabeça compacta → vértice traseiro afilado) **+** núcleo em stroke | `beginPath,moveTo,lineTo×3,closePath,fill,beginPath,moveTo,lineTo,stroke` |
| **sniper** | **dois** strokes de espessuras distintas: haste fina longa + ponta curta densa | `beginPath,moveTo,lineTo,stroke` ×2 |
| **nail** | polígono sólido de 6 vértices: ponta à frente, corpo reto, cauda em V | `beginPath,moveTo,lineTo×5,closePath,fill` |

São três assinaturas de comando **mutuamente distintas**, e a diferença sobrevive a qualquer cor, inclusive branco puro.

### Rail — velocidade e penetração
Cabeça compacta e **streak que afina para trás** (vértice único na cauda). O afilamento é o que comunica velocidade extrema sem virar um feixe de largura constante — se fosse largura constante, seria o Beam. O núcleo interno reforça a leitura de "linha de tiro atravessando" com 1 stroke barato. Extensão total ~36 px contra ~16 px do nail.

### Sniper — precisão
A primeira versão era um traço fino único — e um teste que escrevi acusou o problema: **topologia idêntica à linha legada**. Uma agulha mais fina ainda é "uma linha". Corrigi dando-lhe **quebra de espessura**: haste muito fina (`r*0.30`) atrás de uma ponta curta e densa (`r*0.72`). O olho encontra um ponto de precisão, não um traço. É a única das três **sem preenchimento** — nenhuma massa, o oposto do rail.

### Nail — massa física
**Polígono sólido fechado** de 6 vértices, com ponta que projeta à frente do centro (as outras duas ficam atrás) e cauda cortada em V. É a única com **área preenchida e ponta avançada**: lê como objeto material, não como efeito. Finalmente corresponde ao nome "Cravador de Hastes".

---

## 3. ESTADO DE LONGA DISTÂNCIA DO SNIPER

O §20 exigia obter o threshold real do código, não hardcodar 450. Investiguei `updateProjectiles`:

```js
if(pd && pd.farBonus && p.dist>450) dmgOut *= 1+pd.farBonus;
```

O critério é `p.dist` — **distância percorrida** acumulada em `updateProjectiles`, não distância euclidiana da origem. Usei exatamente essa base via `projectileTravelDistance(p)`, e `SNIPER_FAR_DIST=450` é **amarrado por teste** ao valor lido do fonte com regex: se a mecânica mudar e o visual não, a suíte falha.

Acima do limiar, o projétil ganha **duas marcas perpendiculares curtas**, como retículas, e a ponta se estende ligeiramente. É geometria — testado que as **cores são idênticas** nos dois estados, para garantir que a sinalização não virou recoloração. Transição verificada exatamente em `dist>450` (450 = normal, 451 = longa distância). Rail e nail não têm esse estado.

---

## 4. ARQUITETURA

O E1 e o E2 foram aproveitados; `drawProjectile` não voltou a ser monolítico:

```js
if(orb) drawProjectileOrbShape(p);
else if(visualFamilyForProjectile(p)===PVF_SLUG){ ctx.strokeStyle=p.color; drawProjectileSlug(p); }
else drawProjectileLegacyLine(p);
const tm=projectileTemporalMode(p);
if(tm!==PTM_NONE) drawProjectileTemporalLayer(p,fade,tm===PTM_REPLAY);
```

`drawProjectileSlug` tem sub-dispatch interno por `type`, pequeno e claro. **Não duplica lógica temporal** (testado: não menciona `temporalReplay`, `PTM_` nem `TemporalLayer`) — a camada do E2 continua ortogonal e é aplicada depois, automaticamente.

Resultado: Rail temporal = **forma Rail + cor Rail + camada temporal forte**; Echo com Rail = **forma Rail + camada sutil**. Nenhum tratamento especial por arma foi criado.

---

## 5. DETERMINISMO E PERFORMANCE

Geometria montada com `moveTo`/`lineTo` sobre a direção normalizada e sua perpendicular:

```js
const sp=Math.hypot(p.vx,p.vy)||1;
const nx=p.vx/sp, ny=p.vy/sp;   // direção
const px=-ny, py=nx;            // perpendicular
```

**Um único `Math.hypot`** por projétil (testado), **zero trigonometria** (`atan2`/`cos`/`sin` proibidos por teste — os vetores já bastam), zero `save`/`rotate`/`restore`, zero `Path2D`, gradiente, `shadowBlur` ou alocação.

O streak do rail é **geométrico**, derivado da posição do frame: sem histórico, sem array de posições, sem estado novo. Testado que o helper não escreve nada no projétil.

Zero RNG (sentinel com 60 desenhos → 0). Trinta desenhos consecutivos produzem traço idêntico. Custo: ≤22 comandos por projétil. Cena densa (10 rails + 10 snipers + 10 nails + 6 rails temporais) não spawna, não muta coleções, não consome RNG.

O fade do E1 é respeitado integralmente — o helper slug sequer menciona `maxDist`, para não recriar a regra.

---

## 6. MECÂNICA — ZERO ALTERAÇÕES

Verificado por teste: `dmg`, `speed`, `range`, `interval`, `pr`, `basePierce`, `kick` das três armas; `farBonus 0.85` do sniper; `bleed` do nail; ambas as regras de distância em `updateProjectiles` (`farBonus>450` e `longRangeBonus>400`). `fireWeaponFrom` e `updateProjectiles` não referenciam nada visual.

Fora do escopo e verificado intacto: orb, beam, `eorb` de inimigo, fallback legado e **as outras 15 armas**, todas ainda na linha legada.

---

## 7. TESTES

### Nova suíte — `tests/pr15-5-e3-slug-penetrator-identity.test.js`
**76 checks, 0 falhas**, em 11 blocos: dispatch (7) · identidade estrutural (9) · **teste sem cor (4)** · longa distância (9) · integração E2 (6) · fade (4) · determinismo (8) · performance (6) · mecânica (7) · fora do escopo (5) · regressões (11).

O bloco **C** é o critério central: força a mesma cor nos três e compara apenas geometria, em `#ffffff`, `#000000`, `#888888` e `#ff00ff`, e também com raio idêntico. Se as formas só diferissem por estilo ou espessura, ele acusaria.

### Regressão

```
SUÍTES: 62  ·  COM FALHA: 0  ·  CHECKS ✔: 4019  ·  FALHAS ✘: 0
```

### Goldens (§25) — investigados

**Os 18 goldens de cena (`hashCanvas` + RNG dos cenários A–I) passaram sem alteração**: os fixtures de benchmark não contêm rail, sniper nem nail, então a mudança de forma não os alcança. Nenhuma cena regrediu.

Ajustes, todos documentados e **nenhum afrouxando cobertura**:

1. **`pr15-5-e1` §C01** — a varredura de equivalência ficou **mais forte**, não mais fraca. Antes exigia "tudo idêntico à base"; agora exige **duas** coisas: 945 combinações idênticas **fora** da família SLUG e — check novo **C01b** — as **135 de 135** combinações dentro dela **obrigatoriamente alteradas**. A divergência foi exatamente 3 armas × 45 casos, confirmando cirurgia limpa.
2. **`pr15-5-e1` §C03/§C05/§D05/§J07** — trocaram `rail` por `cryo` como representante do caminho legado (rail saiu dele por design).
3. **`pr15-5-e1` §I06** — teto de linhas do dispatch 14 → 22 (E2 somou 2, E3 somou 4). Continua travando crescimento descontrolado.
4. **`pr15-5-performance-audit1`** — rebaseline do hash do **texto-fonte** de `drawProjectile`. Igualdade estrita de SHA-256 preservada.

---

## 8. REPLAYTEST HUMANO

**RAIL** — parece extremamente rápido? Parece perfurante? **É diferente de um Beam?** Reconhecível sem HUD?
**SNIPER** — parece mais fino e preciso que o Rail? A mudança além de 450 px de percurso é perceptível? Ajuda a leitura ou distrai?
**NAIL** — parece uma haste física? Deixou de parecer só uma linha?
**COMPARAÇÃO** — dá para distinguir os três só olhando os tiros? Continuam distinguíveis com cores parecidas? Algum ficou "efeito demais"?
**TEMPORAL** — Rail replay mantém identidade Rail? Echo com essas armas continua legível?
**PERFORMANCE** — combate denso com SMG + gatling + rails continua fluido?

---

## 9. ARQUIVOS

| Arquivo | Mudança |
|---|---|
| `index.html` | `drawProjectileSlug`, `projectileTravelDistance`, `SNIPER_FAR_DIST`, ramo no dispatch |
| `audit_pr135/harness.js` | +4 linhas de bridge (sob `typeof`) |
| `tests/pr15-5-e3-slug-penetrator-identity.test.js` | **novo** — 76 checks |
| `tests/pr15-5-e1-projectile-visual-grammar.test.js` | varredura fortalecida + ajustes de representante legado |
| `tests/pr15-5-performance-audit1.test.js` | 1 rebaseline de hash de texto-fonte |
| `PR15_5_E3_SLUG_PENETRATOR.md` | este documento |

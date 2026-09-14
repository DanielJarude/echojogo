# PR15.5-E1 — GRAMÁTICA VISUAL DOS PROJÉTEIS

> **E1 não é o rework visual. E1 é o trilho sobre o qual o rework será construído.**
> Se o jogador perceber que o arsenal ficou diferente, o E1 fez trabalho demais.

Base: `0b16400` (tree `b697ea4d…`, idêntica a `c15e317` de `dev/pr15-5-visual-overhaul`).
Resultado pretendido do replaytest humano: **"NÃO PERCEBI DIFERENÇA VISUAL."**

---

## 1. PROBLEMA

A auditoria PR15.5-E mediu a dívida estrutural do arsenal ranged:

- 20 armas ranged;
- **18 delas caíam no mesmo `else`** de `drawProjectile`;
- removendo cor, glow e partículas, **16 armas viravam o mesmo segmento de reta**;
- `drawProjectile` tinha **2 branches reais** para o arsenal inteiro;
- em contraste, `drawWeaponSprite` já tem **14 silhuetas ricas**.

A arma na mão é bem desenhada; o que ela dispara, não. A qualidade visual existe no projeto — ela só nunca foi estendida ao projétil.

### Por que não redesenhar direto

Porque cada bloco de rework reescreveria o mesmo `if`. Sem um ponto de despacho, E2–E10 colidiriam entre si e cada um teria de duplicar o preâmbulo (halo, fade, alpha). O E1 paga essa dívida **uma vez**, em um passo que não muda pixel algum e por isso é trivialmente reversível.

---

## 2. ARQUITETURA

### Antes

```js
function drawProjectile(p){
  const orb=(p.type==='orb'||p.type==='eorb');
  ...halo, fade, alpha inline...
  if(orb){ /* círculo + anel */ }
  else   { /* linha; único ajuste: l = plasma?10:5 */ }
}
```

Uma função, 30 linhas, dois caminhos rígidos, tudo inline.

### Depois

```
PROJ_FAMILY            tabela estática  type → família (criada 1×)
visualFamilyForProjectile(p)            classificação PURA
projectileUsesOrbShape(p)               escolha de FORMA (desacoplada)
projectileRangeFade(p)                  fade dos últimos 22%
drawProjectileGlow(p,fade,orb)          halo aditivo compartilhado
drawProjectileOrbShape(p)               FORMA: círculo pulsante + anel
drawProjectileLegacyLine(p)             FORMA: linha legada (fallback)
drawProjectile(p)                       dispatch — 8 linhas efetivas
```

**Decisão de projeto central:** família e forma são **deliberadamente desacopladas**. A família já classifica as 20 armas, mas **ainda não influencia o desenho** — `projectileUsesOrbShape` continua decidindo exatamente como antes. É isso que torna o E1 visualmente neutro. Quando uma família ganhar forma própria (E3+), só essa função muda; o dispatch, o halo e o fade ficam intactos.

---

## 3. FAMÍLIAS E MAPEAMENTO

Sete constantes numéricas (`PVF_*`), sendo `PVF_LEGACY = 0` — o fallback é o valor natural de ausência.

| Família | Armas | Racional |
|---|---|---|
| **SLUG / PENETRADOR** | `rail`, `sniper`, `nail` | penetrador rígido; todos com `basePierce` ou bleed de cravação |
| **ENERGIA / MASSA** | `plasma`, `orb`, `void`, `cryo` | massa energética com halo; `void`/`orb` têm AoE |
| **FLUIDO / SPRAY** | `flamer`, `acid` | jato contínuo, alcance curto, alto `jitter`, ambos `sprite:'nozzle'` |
| **ENXAME / MÚLTIPLO** | `smg`, `shotgun`, `homing`, `prism` | multiplicidade: `count>1` ou cadência extrema ou `split` |
| **CONDUÇÃO / STATUS** | `tesla`, `plague` | propagação entre alvos: `chain` e `contagion` |
| **CINÉTICO / RETORNO** | `ricochet`, `boomer`, `gatling`, `mine` | reflexão, retorno, rotação, implantação |

O mapeamento segue exatamente o proposto pela auditoria — o código real não exigiu ajuste. **Duas exclusões deliberadas:**

- **`beam`** não entra na tabela. Feixes não geram projétil (`speed: 0`, `beam: true`); são desenhados por `drawBeamFrom`, que o escopo manda preservar intacto.
- **`eorb`** não entra na tabela, **de propósito**. Investigando o código, `eorb` é o tipo de **todo** projétil de inimigo, miniboss e boss (9 pontos de criação: linhas 15859, 15959, 15994, 16087, 16938, 17046, 17194, 17227). Não tem arma associada e não é escopo do rework ranged. Ele permanece no fallback legado e continua usando a forma de círculo, exatamente como antes.

---

## 4. FALLBACK

`visualFamilyForProjectile` retorna `PVF_LEGACY` para **qualquer** entrada que não esteja na tabela — incluindo `null`, `undefined`, `{}`, `type` numérico ou string vazia. Nunca lança.

Continuam desenhando exatamente como antes: projéteis de **inimigo/boss** (`eorb`), de **Echo** (usam o `id` da arma, mesmo caminho do jogador), **temporais** (`temporalReplay`), **legados** e **conteúdo futuro** ainda não classificado.

---

## 5. O QUE FOI PRESERVADO

Preservado **byte-a-byte**, verificado por comparação de traço Canvas:

- forma do **orbe** (círculo pulsante `+ sin(runTime*10)*1.5` e anel `r+5`);
- **`drawBeamFrom`** — não tocado; gradiente, ramp, largura, ponta pulsante e anéis de sobrecarga intactos;
- **fade de alcance** (últimos 22%, piso 0.15);
- comprimento de linha (**10 para plasma, 5 para o resto**);
- `lineWidth = p.r`, cores, alphas (`.60` orbe / `.48` linha), `glowSprite`, composite `lighter`;
- **culling** `inView(p.x, p.y, 32)` no laço de render, inalterado;
- `explodeOrb`, `fireWeaponFrom`, `updateProjectiles`, `onProjectileHit` — não tocados.

**Não foi adicionado nada:** nenhum trail, halo, outline, impacto, muzzle flash, partícula, cor, animação ou marca de perfuração.

---

## 6. DETERMINISMO

O E1 **não precisou de nenhum jitter novo** — nem `vHash32`, nem `vJit1`, nem `runTime` adicional. A classificação é uma consulta em tabela estática.

Garantido por teste: nenhuma das 7 funções contém `Math.random`, `rand` ou `randi`; nenhuma spawna partículas, cria entidades ou muta coleções globais. O **sentinel** substitui `Math.random` por contador e desenha 200 projéteis de todos os tipos: **consumo 0**. Vinte desenhos consecutivos do mesmo projétil produzem traço idêntico. O renderer segue observador, como o PR15.5-E0 estabeleceu.

---

## 7. PERFORMANCE

**Neutra por construção — o traço Canvas é idêntico**, logo o custo de rasterização é idêntico.

| Proibição do escopo | Status |
|---|---|
| `shadowBlur` novo | ✅ nenhum |
| `createLinearGradient` / `createRadialGradient` | ✅ nenhum |
| `Path2D` por projétil/frame | ✅ nenhum |
| alocação de objeto/array por projétil | ✅ nenhuma (testado por regex sobre o corpo) |
| `Map` dinâmico por frame | ✅ tabela estática, criada 1× no carregamento |
| cache sem limite | ✅ nenhum criado; `_glowCache` (teto 48) preservado |
| string building no draw | ✅ nenhum |

Comandos Canvas por projétil: **exatamente os mesmos que a base** (verificado contra a implementação legada em 5 tipos). As chamadas de helper são estáticas e monomórficas — candidatas naturais a inline pelo JIT.

---

## 8. INTEGRAÇÃO COM E2–E10

O dispatch tem **8 linhas efetivas** e um ponto de extensão explícito:

```js
const orb=projectileUsesOrbShape(p);
const fade=projectileRangeFade(p);
drawProjectileGlow(p,fade,orb);
ctx.globalAlpha=fade; ctx.fillStyle=p.color;
// ← ponto de extensão: família já resolvida, corpo é UMA chamada de forma
if(orb)drawProjectileOrbShape(p);
else   drawProjectileLegacyLine(p);
```

- **E2 (fix do replay temporal + camada Echo)** — pode consultar `p.temporalReplay` e aplicar uma camada **em volta** da chamada de forma, sem duplicar halo/fade. O E1 deliberadamente **não** corrige esse bug (testado: `drawProjectile` não menciona `temporalReplay`).
- **E3–E7, E10 (formas por família)** — trocam `projectileUsesOrbShape` por um `switch` sobre a família e acrescentam helpers irmãos de `drawProjectileLegacyLine`. Uma família por PR, cada uma reversível.
- **E8/E9 (emissão e impactos)** — reutilizam `PROJ_FAMILY` como fonte única de verdade, sem reclassificar.

---

## 9. TESTES

### Nova suíte — `tests/pr15-5-e1-projectile-visual-grammar.test.js`
**97 checks, 0 falhas**, em 12 blocos:

| Bloco | Cobertura |
|---|---|
| A (7) | infraestrutura: helpers existem, 7 famílias distintas, tabela fora de função |
| B (23) | classificação das 20 ranged, uma por uma; beam fora; nenhum tipo órfão |
| C (5) | **equivalência visual** — ver abaixo |
| D (9) | forma, orbe, fallback de tipo desconhecido/nulo, proteção contra NaN |
| E (4) | pureza: 1000 chamadas idênticas, não muta, independente de ordem |
| F (6) | determinismo: sem RNG, sem spawn, **sentinel = 0**, estado imutável |
| G (13) | mecânica: dmg/speed/range/count/interval de 9 armas + 11 props especiais |
| H (3) | beam fora do dispatch, `drawBeamFrom` preservado |
| I (6) | Echo e temporal inalterados; **E1 não corrige o replay** (é o E2) |
| J (7) | performance: sem gradiente/blur/Path2D/alocação; ops ≤ base |
| K (4) | culling preservado, render completo, render sem RNG |
| L (10) | suítes C/D/E0/E7 registradas e preservadas |

### O teste que define o sucesso do E1 (§C)

A implementação **anterior** é reconstruída dentro do mesmo sandbox e o traço do ctx mock é comparado chamada a chamada, argumento a argumento:

```
576 combinações  (24 tipos × 5 fases de alcance × 3 cores × 3 vetores)
divergências: 0
```

Se o E1 alterar um único argumento de desenho, essa comparação falha.

### Goldens (item 19 do escopo)

Os **9 `hashCanvas`** dos cenários A–I em `pr15-5-performance-audit1` **passaram sem alteração** — prova independente, em cena completa e povoada, de que a sequência Canvas do render inteiro é idêntica à base. `consumo de RNG de draw` segue 0 em todos.

**Um único rebaseline foi necessário**, e é de texto-fonte, não de resultado: o pin SHA-256 do **corpo** de `drawProjectile`, que mudou por definição ao ser refatorado. O comentário no arquivo de teste registra o motivo e as duas provas independentes de equivalência visual. Nenhuma assertiva foi afrouxada (continua igualdade estrita), nenhum golden removido, nenhuma cobertura reduzida.

### Regressão completa

```
SUÍTES: 60  ·  COM FALHA: 0  ·  CHECKS ✔: 3859  ·  FALHAS ✘: 0
TODAS AS SUÍTES PASSARAM
```

---

## 10. RISCOS

- **Risco baixo por construção.** A mudança é um refactor com equivalência provada por hash, traço e golden. Reverter é apagar 7 funções e reinlinear 12 linhas.
- **Risco residual: o mock de Canvas não é um rasterizador.** A equivalência é da *sequência de comandos*, não de pixels. Como nenhuma geometria, cor ou alpha mudou, o risco de divergência real é mínimo — mas é exatamente o que o replaytest humano deve confirmar.
- **Risco futuro: shape-soup ao contrário.** 20 formas únicas podem poluir mais que 2. Mitigação já embutida: no máximo 6 famílias, com gramática compartilhada (halo e fade continuam comuns a todas).

---

## 11. REPLAYTEST HUMANO RECOMENDADO

Pergunta única: **"Houve alguma mudança visual perceptível?"** A resposta desejada é **NÃO**.

Testar: Plasma (arma inicial, maior exposição), Shotgun (7 projéteis simultâneos), Rail (velocidade 2100), SMG (cadência .065, muitos projéteis em tela), Acid (2 projéteis/disparo), Nail, Sniper, **Orb** (única forma circular do jogador), **Beam** (não deve ter sido tocado), Tesla, Homing, Ricochet, **combate denso** (wave alta + boss + projéteis inimigos `eorb`), **Echo disparando**, **Repetição Ancorada** (deve continuar com o bug do ciano — o fix é o E2).

Atenção especial ao **fim de alcance** de cada arma: é onde o fade de 22% aparece e o caminho mais sutil do refactor.

Qualquer diferença perceptível deve ser tratada como **regressão** até investigação.

---

## 12. ARQUIVOS

| Arquivo | Mudança |
|---|---|
| `index.html` | `drawProjectile` refatorado + 6 helpers + tabela `PROJ_FAMILY` |
| `audit_pr135/harness.js` | +10 linhas de bridge (todas sob `typeof`) |
| `tests/pr15-5-e1-projectile-visual-grammar.test.js` | **novo** — 97 checks |
| `tests/pr15-5-performance-audit1.test.js` | 1 rebaseline de hash de texto-fonte, documentado |
| `PR15_5_E1_PROJECTILE_VISUAL_GRAMMAR.md` | este documento |

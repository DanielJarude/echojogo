# PR15.5-F2-R1 — CHARACTER IDENTITY OVERHAUL · GRUPO A

**VECTOR · WRAITH · BULWARK · PYRE — gameplay + character select**

Base técnica: `6fa0422fb30a02d34e5001304cb2f308784c5ea4` (PR15.5-F2)
Parent permanente: `e9ca29437c5f36c67335c9c02ca1432e96492e32` (PR15.5-F1)

> **STATUS: TECNICAMENTE VERDE — IDENTIDADE VISUAL AGUARDA HUMAN APPROVAL.**
> Esta revisão **não pode se autoaprovar artisticamente**. Os testes
> respondem "o sistema está correto?"; apenas o playtest humano responde
> "os personagens estão bons?".

---

## 1. O feedback humano que causou o R1

O F2 fechou **73 suítes / 4824 checks / 0 falhas** e mesmo assim foi
**reprovado na avaliação humana**. O usuário testou PYRE e VECTOR em
gameplay real e concluiu: *"dá pra melhorar"*. Ao observar a tela de
seleção dos oito operadores, esclareceu o problema central:

> Cada operador deve **parecer visualmente um personagem único ao jogar** —
> não "menos detalhes", não "mais detalhes", não "hashes diferentes".

E impôs duas exigências adicionais:

1. o visual **também** tem de mudar na tela de escolha dos operadores;
2. direção mais ambiciosa é aceita, **inclusive aparência 3D/2.5D**,
   desde que caiba na arquitetura atual do jogo.

## 2. Por que o F2 técnico não bastou

O F2 mediu identidade por **hash estrutural distinto**. Isso provou que
os quatro streams de Canvas eram diferentes — não que os quatro
*personagens* eram diferentes.

Na prática, o F2 diferenciava os operadores por dois mecanismos fracos:

| mecanismo F2 | por que falhou |
|---|---|
| `proportions` (torso ×0.96, ×1.18…) | reescalar o mesmo boneco não cria personagem |
| `parts` chapadas (+1 antena, +1 placa) | é exatamente o anti-padrão do §9 do brief |

O resultado era **"o mesmo boneco procedural com pequenas variações"**,
tanto no gameplay quanto na character select — e a leitura era ainda pior
na escala real de jogo, onde peças de 1–2px simplesmente desaparecem.

**Hash diferente ≠ personagem visualmente único.** O R1 substitui a
direção artística do F2 mantendo integralmente sua base técnica.

---

## 3. Direção de render: pseudo-3D dentro do Canvas

Nenhuma tecnologia nova. **Sem WebGL, sem Three.js, sem engine 3D, sem
dependências** — continua o mesmo Canvas 2D e o mesmo renderer único.

A sensação de volume vem de **extrusão direcional**: cada bloco do corpo
é pintado até três vezes.

```
1. EXTRUSÃO  — cópia escurecida, deslocada no sentido contrário à luz
               (é o que cria "altura" aparente / espessura de placa)
2. FACE TOPO — a forma no tom base
3. FACE LUZ  — cópia clareada e menor, deslocada na direção da luz
               (o chanfro que revela o material)
```

### A luz é do MUNDO, não do corpo

Requisito §20 (funcionar em 360°). O operador gira com o `aim`; se a luz
fosse solidária ao corpo, ele pareceria uma decalcomania girando. A
direção da luz é fixa no mundo (↖ topo-esquerda) e convertida para o
espaço do corpo com `−aim`:

```js
const V_LIGHT_ANG = -2.356194490192345;   // ↖ canto superior esquerdo
if(aim!==_vLitA){ _vLitA=aim; const a=V_LIGHT_ANG-aim;
                  _vLitX=Math.cos(a); _vLitY=Math.sin(a); }
```

Resultado: nos oito octantes o volume permanece coerente e **nenhuma face
inverte**. O memo de uma entrada evita pagar trig por frame.

### Regra de coerência física

Face iluminada só existe onde **há volume** (`z>0`). Uma chapa sem
espessura não tem chanfro para a luz pegar. Além de fisicamente coerente,
isso poda fills que não sobreviveriam à rasterização real (§28).

---

## 4. Arquitetura — preservada, estendida genericamente

**Preservado integralmente:** `OPERATOR_VISUALS`, `operatorVisualProfile`,
`getOperatorVisual`, `drawOperatorParts`, `drawUnit`.

**NÃO houve** volta para `drawVector()` / `drawWraith()` / `drawBulwark()`
/ `drawPyre()`, nem cadeia de `if(operator===…)`. O `drawUnit` continua
sendo o **único corpo** e continua sem qualquer branch por operador — há
teste explícito para isso (`A2`).

### Extensões (genéricas, declarativas, reutilizáveis na F3)

| chave | papel | default |
|---|---|---|
| `build` | construção corporal própria: `torso`, `head`, `pack`, `leg`, `arm`, `mat` | `null` |
| `portrait` | enquadramento do busto no seletor (`scale`, `tilt`) | `null` |
| `z` (peça) | altura aparente → ativa o pseudo-3D | ausente |
| `t` (peça) | tinta do canal de paleta (−1 escuro … +1 claro) | `0` |
| `ext`/`lit`/`face` | material local (sobrepõe `build.mat`) | herda `mat` |
| `pts` + `k:'hull'` | casco poligonal próprio | — |

**`build:null` ⇒ caminho pré-R1 exato.** Todo operador do Grupo B, o Echo
aliado, o Eco Sombrio, a Presença Temporal e o `drawShip` caem no
renderer antigo **byte a byte** — verificado por teste (`C2`).

### Vocabulário de primitivas

`rect` · `round` · `circle` · `wedge` · **`hull`** (casco poligonal — a
novidade que permite silhueta própria em vez de retângulo escalado).

---

## 5. Os quatro personagens

### VECTOR — armadura temporal limpa

| | |
|---|---|
| **Construção** | torso facetado em chanfro, corpo atlético e bilateral |
| **Assinatura** | chevron em **V** repetido no peito, na crista do capacete e nas aletas dorsais |
| **Cabeça** | capacete técnico hexagonal, visor em cunha integrado, crista central |
| **Volumes** | torso `z=.23` com face iluminada ampla (`face .76`) — placa larga e bem acabada |
| **Material** | metal técnico claro; `ext −.46 / lit .20` — aresta nítida, equipamento avançado |
| **Core** | núcleo temporal circular no esterno (único `glow` do torso) |
| **Postura** | neutra/controlada — sem offset |
| **Portrait** | busto simétrico, ombreiras técnicas pareadas, chevron legível no peito |

Não virou robô genérico e não depende de ciano: a identidade sobrevive em
monocromático (teste `AF`).

### WRAITH — caçador temporal

| | |
|---|---|
| **Construção** | quilha **estreita** (a mais fina do grupo), ombros altos, cintura afilada |
| **Assinatura** | **assimetria funcional** — pauldron pesado só no flanco esquerdo |
| **Cabeça** | capacete predatório com **focinho projetado à frente**, visor em fenda, crista recuada |
| **Volumes** | `z=.16` com `face .60` — facetamento agressivo, faces pequenas e duras |
| **Material** | armadura leve escura; `ext −.58` (a extrusão mais escura do grupo) |
| **Postura** | inclinada para frente — `offset.x +.05`, `pose.swing 1.20` |
| **Portrait** | busto visivelmente mais estreito, ombro único carregado, focinho marcante |

> A inclinação é **puramente visual**. Posição mecânica, hitbox, aim,
> movimento e velocidade permanecem intocados (teste `AH2`).

Não é "VECTOR magenta com pontas": o casco do torso, a cabeça e a
distribuição de massa são completamente outros.

### BULWARK — power armor

| | |
|---|---|
| **Construção** | torso **largo e curto** (massa lateral, não comprimento), centro de massa baixo |
| **Assinatura** | ombreiras estruturais enormes + colar blindado com a cabeça **encaixada dentro** |
| **Cabeça** | rebaixada: colar `.74×.80` com `z=.26`, crânio menor embutido, visor em fresta |
| **Volumes** | **o maior `z` do grupo** (`.34` torso, `.30` ombreiras) e `face .82` |
| **Material** | placa pesada blindada; extrusão longa = espessura real de placa |
| **Postura** | baixa e pesada — `pose.swing .74` (passo curto) |
| **Portrait** | busto largo, ombreiras dominando o enquadramento, cabeça afundada |

É aqui que o pseudo-3D trabalha mais: **placa frontal + face lateral
escura + edge highlight**. Não é "um círculo maior" — é o operador mais
massivo por construção, comprovado no **mesmo `r`** (teste `AE3`), o que
isola a forma da hitbox.

> `r`, HP, escudo e hitbox **inalterados**.

### PYRE — traje industrial pressurizado

| | |
|---|---|
| **Construção** | traje com peito alto e **avental térmico assimétrico** descendo à frente |
| **Tanque** | cilindro pressurizado **deitado** + duas cintas de suporte + válvula superior |
| **Conduítes** | tubulação grossa saindo do tanque e subindo pelo ombro até o respirador |
| **Cabeça** | **máscara/respirador**: caixa de filtro projetada à frente, visor estreito |
| **Volumes** | `z=.24` no tanque, `z=.20` no torso; `face .72` |
| **Material** | metal industrial fosco; placa térmica com tinta `+.16` |
| **Postura** | equipamento puxa a massa para trás — `offset.x −.04` |
| **Portrait** | tanque e conduítes visíveis atrás do busto, máscara dominando a cabeça |

**O tanque deixou de ser "um círculo atrás do boneco"**: é equipamento
integrado, com suportes, válvula e tubulação que conecta ao respirador.

> **Nenhuma mecânica nova**: sem combustível, sem explosão, sem fraqueza,
> sem hitbox do tanque.

---

## 6. Character select — mesma fonte de verdade

### O problema

`charPortrait` usava um template SVG essencialmente compartilhado: os
oito pareciam o mesmo personagem com cores diferentes.

### A solução (§23 — proibido duplicar design)

O retrato dos quatro operadores R1 é **gerado a partir de
`OPERATOR_VISUALS[id].build`** — a mesma fonte estrutural que o `drawUnit`
usa em jogo.

```
OPERATOR_VISUALS[id].build
        │
        ├──► drawUnit          (Canvas, top-down, gameplay)
        └──► charPortraitBuild (SVG, busto ¾, character select)
```

**Não existe uma segunda descrição do personagem.** Mudou o `build`, muda
o retrato — divergência futura é estruturalmente impossível.

O que difere é apenas o **enquadramento**: gameplay é top-down; o seletor
é um busto. A conversão é uma projeção fixa e determinística — o eixo
lateral do corpo vira largura na tela, o eixo frontal vira profundidade
(desenhada como altura aparente), com a mesma direção de luz e as mesmas
tintas de material.

O retrato **não é screenshot do sprite ampliado** (§24) — é um busto
limpo, mas reconhecidamente o mesmo personagem.

### UX preservada (§26)

Cards, nomes, papéis, slots, seleção, navegação, unlock, sandbox e input
**inalterados**. Mesma classe `cicon`, mesmo `viewBox 0 0 40 40`, mesmos
call sites. Cache de 64 entradas por `id|size`.

### Grupo B no seletor

**HARDEN / NÔMADE / ECHO-0 / REVENANT permanecem no portrait legado** —
eles não têm `build`, então `charPortrait` cai no template antigo. Isso é
**intencional, aceitável e documentado** até a F3, e há regressão
explícita garantindo que continuem legados (teste `R`).

---

## 7. Integrações preservadas

| sistema | situação |
|---|---|
| **Armas** (`drawWeaponSprite`, PR15.5-D/E) | intactas — nenhum sprite alterado |
| **Encaixe da arma** | só `weapon.x/y/rot/scale` (WRAITH ×.96, BULWARK ×1.02) |
| **Projectile origin** | `r+6` congelado |
| **Muzzle** | `r+10` congelado; não referencia perfil visual |
| **Melee** | `visualMeleeWeaponPose` / `visualMeleeBodyPose` / `visualPlayerDrawPose` — reach inalterado; o braço continua o mesmo traço cinemático, o `build` só troca espessura/tinta |
| **Hurt** | troca de paleta preservada; o corpo novo convive |
| **Dash / invulnerabilidade** | rastro e anéis preservados |
| **Especiais** | Salto de Fase, Massacre, Bastião e Nova inalterados — teste garante que o corpo continua desenhado sob o efeito |
| **Echo aliado / Eco Sombrio / Presença** | fora do escopo, sem perfil, visual F1 preservado |
| **Repetição Ancorada** | mecanicamente independente; zero vínculo novo |
| **Inimigos / Singular / minibosses / Paradoxo** | não tocados |
| **Save** | nenhuma mudança de schema; persiste só o `charId` já existente |

---

## 8. Performance

`drawUnit` completo com arma, `r=14`, `walk=.4`:

| operador | F2 | **R1** | blur | teto |
|---|---|---|---|---|
| VECTOR | 158 | **230** | 3 | 230 |
| WRAITH | 158 | **219** | 2 | 230 |
| BULWARK | 149 | **212** | 3 | 230 |
| PYRE | 177 | **229** | 3 | 230 |

O §50 autoriza ultrapassar 200 quando o ganho visual justifica e fixa
**230 como teto duro**. Os quatro cabem, com **blur muito abaixo** do
orçamento de 8 (o pseudo-3D usa *paths e fills*, não blur).

### Otimizações aplicadas (de 479 → 230 ops no pior caso)

1. **Offsets baked no path** — eliminado `save/translate/restore` por
   peça e por face de extrusão (−110 ops);
2. **Trig estático pré-computado** — o `rot` das peças é constante, logo
   seu `cos/sin` é resolvido **uma vez no load**, não por frame;
3. **Luz memoizada** — 1 par de trig por render, só quando o `aim` muda;
4. **Pernas com trig compartilhado** — `cos` é par e `sin` é ímpar, então
   um par serve para as duas pernas;
5. **Alpha/glow emitidos só na mudança**;
6. **Poda por significância (§28)** — botas, aletas extrudadas e detalhes
   de 1–2px removidos: não sobreviviam à rasterização real;
7. **Face iluminada só onde `z>0`**;
8. **Contorno do casco removido** — a extrusão já entrega a aresta;
9. **`line` → `round`** nos conduítes do PYRE (8 ops → 3, leitura melhor).

O orçamento de `sin/cos` por render do PR15.5-A permanece **exatamente**
no valor auditado (52) — teste histórico intacto.

**Select:** menu, não hot loop. Ainda assim cada SVG fica abaixo de ~2.7 KB
com menos de 30 nós, cacheado e sem leak.

---

## 9. Determinismo e pureza

- **Zero** `Math.random` / `rand()` / `Date.now` / `performance.now` em
  qualquer renderer ou construtor visual;
- perfis **estáticos e congelados em profundidade** (incluindo `build`,
  sub-listas e arrays `pts`);
- o render **não muta** o perfil; o portrait **não muta** o perfil;
- retratos **determinísticos** e estáveis entre chamadas;
- `runTime` só permanece onde já era usado (passo/animações aprovadas).

---

## 10. Testes

### Nova suíte — `tests/pr15-5-f2-r1-character-identity-overhaul.test.js`

**56 checks**, cobrindo A–AJ do brief: base F2, os quatro operadores R1,
Grupo B preservado, CHARS/r/hitbox/âncoras/D/E intactos, pureza, zero RNG,
fonte compartilhada gameplay↔select, coerência por operador, Echo/Shadow/
Presença/Repetição, save, sandbox, 8 octantes, melee, hurt, dash,
especiais, performance, **escala real**, monocromático, sem arma, bounds,
portrait determinístico e ausência de dependência nova.

**Métricas estruturais além do hash** (§29): bounds, distribuição de massa
por quadrante, assimetria declarativa, largura de torso, assinatura de
cabeça e de ombro, e **pixel significance** no `r` real de cada operador.

> Os hashes continuam, mas agora são **apenas guardrail**. Passar não
> significa aprovação artística.

### Ajustes documentados em testes históricos (§55)

Três asserções do F2 e três do F1 codificavam a filosofia que o R1
**explicitamente substitui**. Nenhum invariante foi enfraquecido — todos
foram reexpressos sobre o mecanismo novo:

| teste | antes | agora | motivo |
|---|---|---|---|
| F2 · B | "alguma `proportion` ≠ 1" | "`build` com torso/cabeça próprios" | reescalar não é identidade — foi o que reprovou |
| F2 · S | ≤200 ops | ≤230 ops | teto do §50 para o pseudo-3D |
| F2 · AB | as 3 camadas povoadas | massa dorsal **e** frontal | exigir 3 camadas empurrava para "+1 antena" (§9) e mantinha peças de 1–2px (§28) |
| F1 · F05 | assimetria via `translate` | assimetria via `x` do rect | posição passou a ser baked no path |
| F1 · L03 | fundação só em drawUnit/drawPlayer | **+ `charPortrait`** | §23 exige que o portrait leia a fundação |
| F1 · M02 | schema de 8 chaves | **+ `build`, `portrait`** | extensões genéricas, puramente visuais |

A contenção continua valendo: a fundação segue **proibida** em
gameplay / save / entidades (F1 · L01/L02/L04 intactos).

### Resultado

| | suítes | checks | falhas |
|---|---|---|---|
| baseline F2 | 73 | 4824 | 0 |
| **após R1** | **74** | **4880** | **0** |

---

## 11. Artefato de auditoria visual (§56)

`audit_pr155/f2_r1_contact_sheet.js` — ferramenta **temporária**, não é
asset de produção e nada em `index.html` depende dela. Reproduz o stream
de comandos Canvas como SVG, sem adicionar dependências:

```
node audit_pr155/f2_r1_contact_sheet.js saida.svg
```

Bandas: **A0** 1:1 absoluto (`r=14`, exatamente o tamanho de jogo) · **A**
escala real com paleta e arma · **B** escala real monocromática sem arma e
sem HUD · **C** inspeção 2× · **D** octantes 0/90/180/270° · **E**
portraits do seletor.

---

## 12. Riscos residuais

1. **Julgamento artístico é humano.** Tudo aqui é estrutura; a pergunta
   "parece quatro personagens?" continua aberta até o playtest.
2. **Orçamento de ops apertado.** VECTOR (230) e PYRE (229) estão no
   teto. Qualquer peça nova exige remover outra ou otimizar.
3. **Assimetria e rotação.** WRAITH e PYRE são deliberadamente
   assimétricos; em alguns ângulos o lado carregado domina a leitura.
   Comportamento pretendido, mas merece atenção no playtest.
4. **Divergência de estilo com o Grupo B.** Até a F3, quatro operadores
   têm volume e quatro continuam chapados — inclusive lado a lado no
   seletor. Aceito e documentado.
5. **`vTint` só entende hex.** Cores `rgba()` (Ecos) passam intactas — os
   callers compartilhados não usam `build`, então não há impacto, mas a
   limitação existe se alguém ligar `build` num caller com paleta rgba.
6. **Projeção do busto é aproximação.** O retrato é coerente com o
   gameplay por construção, não uma projeção 3D rigorosa.

---

## 13. Roteiro de HUMAN PLAYTEST

1. abrir a **character select**;
2. observar VECTOR / WRAITH / BULWARK / PYRE lado a lado;
3. perguntar: **parecem personagens diferentes antes de ler o nome?**;
4. comparar com HARDEN/NÔMADE/ECHO-0/REVENANT (ainda legados — esperado);
5. jogar com **cada um** dos quatro;
6. observar em **escala normal**, sem zoom;
7. movimentar em **várias direções** (o volume deve girar coerentemente);
8. atacar (ranged e melee, se disponível);
9. **dash**;
10. tomar dano (**hurt**);
11. usar o **especial** — o corpo deve continuar reconhecível sob o efeito;
12. comparar o gameplay com o portrait — é o mesmo personagem?

### Pergunta principal

> **Cada um parece um personagem próprio?**

Se a resposta for não, o problema é de **design de personagem**, não de
infraestrutura: a camada declarativa suporta reescrever qualquer um dos
quatro sem tocar no renderer.

---

## 14. Fora de escopo (não iniciado)

**F3 NÃO foi iniciado.** WARDEN, NOMAD, ECHO0 e REVENANT não receberam
redesign — gameplay no visual F1, select no portrait legado. Echo (F4),
Eco Sombrio, Presença Temporal, inimigos, Singular, minibosses e Paradoxo
permanecem intocados.

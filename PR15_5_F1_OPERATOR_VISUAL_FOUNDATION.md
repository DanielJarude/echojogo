# PR15.5-F1 — Fundação Visual Declarativa dos Operadores

**Bloco:** PR15.5-F · Identidade visual de personagens e entidades
**Tipo:** INFRAESTRUTURA — zero mudança visual
**Base:** `747f55e2dcb38077920dd305cd8dc3eadd9092d7` (PR15.5-F0, branch permanente `dev/pr15-5-visual-overhaul`)
**Baseline F0 confirmada:** 71 suítes · 4713 checks · 0 falhas
*Nota de infraestrutura:* o clone chegou shallow/grafted e as suítes C/E9
falhavam ao buscar objetos históricos via `git show` (falha de INFRAESTRUTURA,
não regressão). `git fetch --unshallow origin` restaurou o histórico completo
e a baseline ficou verde **antes** de qualquer alteração de código.

**Resultado pós-F1:** 72 suítes · 4793 checks · 0 falhas (suíte nova:
`tests/pr15-5-f1-operator-visual-foundation.test.js`, 80 checks).

---

## 1. Objetivo e regra de ouro

F1 é **arquitetura**: criar a camada declarativa que permitirá a F2/F3 dar
identidade estrutural própria aos 8 operadores **sem** transformar `drawUnit`
em cadeia de `if(operator===...)`. A regra de ouro foi respeitada: **nenhum
operador foi redesenhado** — silhueta, paletas, efeitos, animações, tamanho,
arma, muzzle e impacto permanecem exatamente os do estado pré-F1 (prova em §14).

## 2. Arquitetura escolhida

O padrão que o próprio código consagrou duas vezes — perfil declarativo +
renderer genérico, de `ENEMY_VISUAL_PROFILES` (PR15.5-B) e `MINIBOSS_VISUALS`
(PR13.5-B5-A) — aplicado agora ao corpo humanoide:

| Peça | Papel |
|---|---|
| `OPERATOR_VISUAL_IDS` | lista congelada dos 8 ids canônicos |
| `operatorVisualProfile(id,over)` | construtor puro: herda default + overrides parciais, congela tudo |
| `DEFAULT_OPERATOR_VISUAL` | default compartilhado = equivalente exato ao renderer pré-F1 |
| `OPERATOR_VISUALS` | tabela declarativa id→perfil (prototype nulo, congelada) |
| `getOperatorVisual(id)` | resolvedor puro O(1) com fallback seguro |
| `drawOperatorParts(list,r,pal)` | renderer genérico de peças estruturais (3 camadas) |

`CHARS` **não** foi usado como lixeira visual: stats/perks/armas/lore/paleta
continuam lá; a estrutura visual mora em `OPERATOR_VISUALS`. A paleta existente
em `CHARS.pal` permanece intocada (arquitetura consolidada — sem refactor).

## 3. Schema do perfil (mínimo p/ F2/F3)

Tudo relativo a `r` (nunca à viewport — §38 do brief):

```
proportions : {torso,head,legs,arms,pack}   multiplicadores por região (1 = atual)
parts       : {back:[],body:[],front:[]}    peças por camada (F1: vazias)
              peça: {k,x,y,w,h,rot,side,pal,glow?,a?,r?}
              k∈rect|round|circle|tri|line · side −1|0|+1 (assimetria espelha x/rot)
              pal∈body|dark|edge|glow|visor|head (integração com a paleta do CHARS)
offset      : {x,y}                         deslocamento visual do corpo (unid. de r)
pose        : {swing}                       integração com pose/andação (1 = atual)
weapon      : {x,y,rot,scale}               encaixe da arma na montagem atual
palette     : {}                            slot de overrides p/ F3 (F1: vazio)
effects     : {}                            slot p/ efeitos específicos (F1: vazio)
```

Cobertura dos requisitos do brief: A proporções · B variantes (peças) ·
C peças opcionais · D assimetria (`side`) · E offsets · F pose (`swing`) ·
G arma (`weapon`) · H paleta (`palette` + canal `pal` por peça) · I efeitos
(`effects`).

**Default compartilhado:** `DEFAULT_OPERATOR_VISUAL=operatorVisualProfile(null)`
— todas as proporções 1, offset 0, três camadas vazias, arma neutra. As 8
entradas de F1 são overrides vazios: **nenhum número foi copiado** para oito
objetos; a herança via builder resolve (§8 do brief).

## 4. Integração com `drawUnit`

`drawUnit(x,y,aim,r,pal,opts)` ganhou **um** hook de entrada: `opts.visual`.
Sem perfil — Echo aliado, Eco Sombrio, Presença Temporal, `drawShip` e callers
legados — o default neutro é usado e **nenhum caller precisa de operatorId**
(§12). O renderer interpreta o perfil genericamente; não existe branch por
operador em lugar nenhum.

Camadas de desenho (ordem genérica, §24):

```
sombra projetada (hitbox no chão — NÃO acompanha offset/proporções)
→ peças back (capas/antenas)        [F1: vazio]
→ pernas → mochila/núcleo → torso + faixa peitoral
→ peças body (ombros/placas/vents)  [F1: vazio]
→ braços → arma → mãos → cabeça/visor
→ peças front (capacete/módulos)    [F1: vazio]
```

Hooks multiplicativos/adiativos com neutros exatos:

- `PJ.legs/PJ.pack/PJ.torso/PJ.head/PJ.arms` multiplicam a geometria da região;
- `PS.swing` multiplica o balanço do passo (integração pose, §23 — `opts.pose`
  do PR15.5-A/C/D permanece intacto);
- `WG.x/y/rot/scale` deslocam/giram/escalam o grupamento arma+mãos (integração
  arma, §20/§21 — `drawWeaponSprite` do PR15.5-D/E intocado);
- cache do gradiente de torso estendido com `PJ.torso` (chave) para F2 não
  reusar gradiente de outra proporção.

**Prova de neutralidade:** `x*1===x` e `x+0` são identidades exatas em IEEE754,
e transformações nulas não são emitidas (`if(rot)`, `if(x||y)`, `if(len)`).
Em F1 o stream de comandos Canvas é **byte-a-byte idêntico** ao pré-F1 (§14).

## 5. Integração com o player

Somente o player real resolve perfil (§13): `drawPlayer` passa
`visual:getOperatorVisual(p.charId)`. A fonte do id é a que já existia —
`player.charId`, definido por `makePlayer` a partir de `CHARS` (via `setChar`/
`curChar`/sandbox `operatorId`). Nenhuma fonte paralela, nenhuma mudança em
`apply()`, stats ou seleção. Sandbox usa o mesmo caminho (`makePlayer(operatorId)`),
pois perfil é só leitura de render.

## 6. Compatibilidade das entidades temporais

| Entidade | Renderer | Perfil F1? | Evidência |
|---|---|---|---|
| Echo aliado (2 slots + Dissonância) | `drawEchoEntity`→`drawUnit` | **NÃO** | fonte sem símbolos F1; probe captura `visual===undefined`; op-stream pré==pós |
| Eco Sombrio | `drawShadow`→`drawUnit` | **NÃO** | idem (via `drawEnemy`) |
| Presença Temporal | `pr15PresDraw`→`drawUnit` | **NÃO** | idem; `pr15PresPalette` segue lendo `CHARS` (dependência registrada — decisão de identidade fica p/ F4) |
| Repetição Ancorada | camada temporal E2 | **NÃO** | `temporalReplayTry` sem qualquer referência F1; bloco F1 sem acoplamento mecânico |

Nenhum caller não-operador foi convertido em operador; sem perfil o drawUnit
produz exatamente o visual compartilhado anterior (§12).

**Repetição (§17, regra absoluta):** F1 não criou vínculo novo — sem ataque,
dano, duplicação, confiança, Ressonância, proc, consumo ou DPS. A suíte L03
faz varredura de contenção: os símbolos F1 existem SOMENTE no bloco F1,
`drawUnit` e `drawPlayer` — nenhum sistema de gameplay/save/entidade os toca.

## 7. Armas, melee, âncoras

- `drawWeaponSprite` e todo o pipeline D/E preservados (suítes P: 27 armas,
  19 projéteis ranged sem fallback, muzzle/impacto determinísticos);
- âncoras congeladas e re-testadas: projétil `src.r+6` · feixe `src.r+6` ·
  muzzle E8 `src.r+10` · melee origem no centro + reach · `drawUnit` `s=r/14`;
- a diferença visual cano×muzzle NÃO foi "corrigida" (fica para quando as
  silhuetas reais existirem, §19);
- pose melee do PR15.5-D intacta: `visualMeleeWeaponPose` ainda gera o
  grupamento rígido nos pivôs `r*.86/−r*.04`; o encaixe `WG` desloca o
  grupamento **sem** tocar na pose — compatível com silhueta futura.

## 8. Hitbox e geometria

Nada mudou: `player.r` continua o stat do `CHARS` (13–16), colisões, alcance
melee e raios de interação intocados. O schema do perfil **não tem** campos
mecânicos (`r`/`radius`/`hitbox`/`hp`/`speed`/`dmg` — testado em M02). A
sombra projetada do `drawUnit` deliberadamente NÃO acompanha offset/proporções
do perfil: é a pegada da hitbox no chão.

## 9. charPortrait (preparação p/ F3)

O template SVG único do seletor permanece **visualmente idêntico** (V01–V02).
O caminho para F3 está aberto: `getOperatorVisual(C.id)` resolve perfil a
partir de qualquer entrada do `CHARS` (sem player), e as peças têm canal de
paleta integrado. F3 sincronizará o template com as peças do perfil — sem
8 SVGs manuais.

## 10. Determinismo, pureza e performance

- **Zero RNG novo** (§29): `operatorVisualProfile`, `getOperatorVisual`,
  `drawOperatorParts`, `drawUnit`, `drawPlayer`, `drawEchoEntity`, `drawShadow`,
  `pr15PresDraw` sem `Math.random`/`rand`/`Date.now`/`performance.now`
  (scan de fonte + suítes R). Animações por `runTime` permanecem.
- **Pureza** (§28): tabela, default e perfis congelados em profundidade;
  render nunca escreve neles (suíte F: snapshot JSON imutável após sessão
  completa; mutação lança em strict e é no-op em sloppy).
- **Performance** (§30): lookup é referência estática (zero alocação por
  frame); camadas vazias custam **zero** comandos (`if(len)`); orçamento de
  corpo pré==pós confirmado por contagem de ops e blur (U07: mesmos números
  da base, inclusive blur ≤ 8 no corpo).

## 11. Save / Sandbox / Modais / Resize

- **Save (§35):** perfil é configuração estática — não entra em `smRoot`
  (scan JSON negativo + controle positivo: operador continua persistido como
  identificador simples em `slots[n].char`); funções de save/pack sem
  referência F1; schema inalterado (regressão Save/Continue verde).
- **Sandbox (§36):** funções do sandbox sem referência F1; bloco F1 sem
  persistência (sem localStorage/smRoot/smCommit/prog); regressão sandbox verde.
- **Modais (§37):** smoke de seletor (`renderCodexBody`), retratos
  (`charPortrait` ×8), menu (`refreshTitleChar`) — sem exception por perfil
  ausente (fallback seguro cobre saves antigos/testes/futuros operadores).
- **Resize (§38):** o schema não armazena coordenadas absolutas — tudo em
  unidades de `r`; regressões existentes verdes.

## 12. Testes — `tests/pr15-5-f1-operator-visual-foundation.test.js`

80 checks em 22 grupos (A–V), cobrindo integralmente a lista obrigatória do
brief (A–U) mais smoke de modais:

- **A/B** 8 ids canônicos exatos, `warden` existe, `harden` não existe;
- **C/D** default neutro congelado; fallback (string desconhecida, null,
  número, `toString`/`constructor`/`__proto__`) → default sem throw;
- **E/F** lookup determinístico (mesma referência) e puro (snapshot JSON);
- **G** drawUnit sem perfil == com default == com cada um dos 8 perfis;
- **H** player resolve perfil (fonte + probe de runtime + charId do CHARS);
- **I/J/K** Echo/Sombrio/Presença sem perfil (fonte + probe + streams pré==pós);
- **L** Repetição independente + contenção global de símbolos F1;
- **M/N/O/P** hitbox, âncoras r+6/r+10/s=r/14, melee D, arsenal D/E;
- **Q** silhueta continua pré-F2: 5 grupos estruturais, VECTOR×WRAITH×NÔMADE
  e PYRE×HARDEN ainda confundíveis — **proposital** (F2/F3 resolvem);
- **R** zero RNG; **S/T** save/sandbox intactos;
- **U** equivalência Canvas-op pré×pós (ver §14);
- **V** modais/retratos não lançam; caminho F3 acessível.

## 13. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `index.html` | bloco PR15.5-F1 (~120 linhas antes de `drawWeaponSprite`); hooks neutros em `drawUnit`; `visual:getOperatorVisual(p.charId)` em `drawPlayer` |
| `tests/pr15-5-f1-operator-visual-foundation.test.js` | suíte nova (80 checks) |
| `audit_pr135/harness.js` | bridge `__t` +6 símbolos F1 sob guarda `typeof` (padrão E1–E10 — necessário p/ instanciar fontes históricas) |
| `PR15_5_F1_OPERATOR_VISUAL_FOUNDATION.md` | este documento |

Nenhum golden foi alterado; nenhuma suíte existente foi tocada.

## 14. Equivalência visual — a prova

Método: a base pré-F1 (`git show 747f55e2...:index.html`) é instanciada no
mesmo harness (padrão das suítes C/E9), com RNG semeado e `runTime` fixado;
cada cenário é desenhado nos dois mundos e o **log completo de comandos
Canvas** (mock que registra toda chamada e todo set de estado) é comparado
por `JSON.stringify` — igualdade estrita de sequência, nomes e argumentos.

Cenários comparados (todos idênticos pré==pós):

- `drawUnit` direto: 12 cenários (idle/walk/aim múltiplos/recoil/pose
  hurt/pose melee/glitch/alpha/raios 13–16/armas variadas) × {sem perfil,
  default, cada um dos 8 perfis} — 108 comparações;
- `drawPlayer`: 8 operadores × 9 estados (idle, walk, 2 aims, recoil, hurt,
  melee windup, melee active, dash) — 72 comparações;
- `drawEchoEntity` (estável, glitch slot 2, hostil, fraturando), Eco Sombrio,
  Presença Temporal, `drawShip` (com/sem glitch);
- contagem de ops e blur por corpo: números idênticos aos da base.

**Conclusão: ZERO diferença visual.** O teste de silhueta do F0 que prova
palette-swap (5 grupos) continua dando o MESMO resultado — por design.

## 15. Riscos residuais

1. **A neutralidade depende de multiplicação por 1 / adição de 0** — F2 ao
   preencher perfis reais introduz diferenças **deliberadas**; a suíte U
   (pré×pós base) passa a valer como âncora histórica e o teste de silhueta
   Q deverá ser atualizado **deliberadamente** (nunca "consertado").
2. **Melee × proporções:** `visualMeleeWeaponPose` ainda calcula o grupamento
   com pivôs fixos (`r*.86/−r*.04`); quando F2 introduzir proporções de braço
   ≠ 1, a pose melee deverá receber o perfil (ponto de integração documentado
   — o encaixe `WG` já cobre offset/rotação sem tocar em D).
3. **Echo/Presença:** quando F4 decidir herança de silhueta, o caminho é
   passar `visual` nos callers — o renderer já está pronto; a decisão de
   identidade (herdar vs. delta próprio) permanece aberta.
4. **`bulwark` é id de operador E de inimigo comum** (colisão de namespace
   registrada no F0): a tabela F1 usa o id canônico do CHARS; `ENEMY_VISUAL_
   PROFILES` segue namespace próprio — sem conflito, mas F2 não deve mesclar.
5. **Colisões de cor operador×miniboss** (F0 §24) continuam — F3 deve evitá-las
   ao escolher canais de peças.

## 16. Preparação para F2/F3

- F2 (VECTOR, WRAITH, BULWARK, PYRE): preencher `OPERATOR_VISUALS.<id>` com
  overrides reais via `operatorVisualProfile(id,{...})` — proporções, peças
  back/body/front, assimetria (`side`), offsets; atualizar deliberadamente o
  teste de silhueta (meta: ≥ 6 grupos) e o orçamento §22 (corpo ≤ 200 ops,
  ≤ 8 blur — `glow` por peça é o único custo extra);
- F3 (HARDEN/warden, NÔMADE, ECHO-0, REVENANT + seletor): idem + sincronizar
  `charPortrait` consumindo `getOperatorVisual(C.id)` e o slot `palette`;
- F4: decidir herança de silhueta para Echo/Sombrio/Presença (os callers
  ganham `visual` apenas quando a decisão for tomada);
- orçamento e invariância continuam guardados pelas suítes F1 (U/Q/M/N/O/P).

**F1 APROVADO TECNICAMENTE — ZERO MUDANÇA VISUAL; HUMAN REPLAY NÃO NECESSÁRIO.**

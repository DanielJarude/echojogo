# PR15.5-F2 — Operadores Grupo A

## Base e baseline

Base exata: `e9ca29437c5f36c67335c9c02ca1432e96492e32` (F1). Após completar o histórico do clone com `git fetch --unshallow origin`, baseline: **72 suítes, 4793 checks, 0 falhas**.

## Arquitetura

F2 preserva `operatorVisualProfile`, `OPERATOR_VISUALS`, `getOperatorVisual`, `drawOperatorParts` e o renderer único `drawUnit`. Não há renderer nem condicional por operador. O schema não precisou ser estendido: as primitivas genéricas `rect`, `round`, `circle`, `tri` e `line`, nas camadas `back/body/front`, foram suficientes. Perfis e peças continuam congelados e puros.

## Conceitos, proporções e peças

- **VECTOR — controle/precisão/estabilidade:** corpo atlético (`torso .96`, `head .94`, `legs 1.02`, `pack .72`), aletas traseiras bilaterais, ombros técnicos simétricos e capacete frontal preciso. É a referência limpa e equilibrada.
- **WRAITH — velocidade/agressão/predador:** torso/cabeça estreitos (`.78/.78`), pernas longas (`1.08`), braços `.92`, pack `.62`, swing `1.18`; duas lâminas traseiras diferentes, guarda unilateral e capacete em cunha. O volume aponta para trás e permanece assimétrico ao girar.
- **BULWARK — massa/proteção/estabilidade:** torso `1.18`, braços `1.16`, pack `1.12`, pernas `1.06`, swing contido `.78`; backpack largo, dois ombros blindados, placa peitoral e colar/capacete protegido. Continua humanoide, sem escudo ou tanque mecânico.
- **PYRE — pressão/combustão/indústria:** torso `1.02`, cabeça `.90`, braços `1.03`, pack `1.06`; reservatório lateral traseiro, válvula, conduíte, placa térmica, tubo e máscara frontal. A assimetria é funcional e legível sem laranja ou chama.

As quatro assinaturas deliberadas são: VECTOR limpo/simétrico; WRAITH estreito/afiado; BULWARK largo/blindado; PYRE industrial/reservatório.

## Bounds visuais versus raio mecânico

Todas as coordenadas são relativas a `r`. Acessórios chegam aproximadamente a 1.3r atrás/lateralmente; o core permanece próximo do footprint histórico. `CHARS.r`, colisão e hitbox não mudaram. A sombra continua desenhada antes de offset/proporções e representa o raio mecânico. WRAITH não recebe hitbox menor; BULWARK não recebe hitbox maior; tanque de PYRE não possui colisão.

## Armas, melee e estados

A montagem genérica `profile.weapon` recebeu somente pequenos encaixes em WRAITH/BULWARK/PYRE. `drawWeaponSprite`, spawn `r+6`, beam `r+6` e muzzle `r+10` não mudaram. O alinhamento visual foi auditado no harness; discrepâncias próprias de comprimento dos sprites continuam assunto posterior, sem mover âncoras mecânicas.

O agrupamento melee PR15.5-D permanece intacto; os ajustes de braço são modestos e o harness cobre desenho melee. Hurt, idle, walk e rotação mantêm acessórios no mesmo transform/alpha do corpo. Dash/rush e os especiais existentes não foram alterados; em particular nenhuma partícula foi adicionada à aura do WRAITH. A validação final de legibilidade em dash/especial é humana.

## Auditoria de silhueta

Paleta monocromática comum, sem HUD/nome/partículas/especial:

- com arma: 4 hashes únicos;
- sem arma (`drawWeaponSprite` neutralizado): 4 hashes únicos;
- ângulos: 0°, 45°, 90°, 135°, 180°, 225°, 270° e 315°, sempre 4 hashes únicos;
- escalas: r=13, r=14 e r=16, sempre 4 hashes únicos.

O teste compara todas as seis duplas implicitamente pela cardinalidade 4. BULWARK operador também difere do stream estrutural do inimigo `bulwark` e mantém anatomia humanoide.

## Performance

Medição Canvas do corpo idle/aim no harness (ops / ativações de blur / save / paths; gradiente é obtido pelo cache e o proxy não registra criação):

| Operador | Ops | Blur | Save | Paths |
|---|---:|---:|---:|---:|
| VECTOR | 158 | 4 | 11 | 17 |
| WRAITH | 158 | 4 | 10 | 16 |
| BULWARK | 149 | 4 | 11 | 17 |
| PYRE | 177 | 4 | 13 | 19 |

Todos ficam abaixo de 200 ops e 8 blurs. A identidade usa forma, não efeitos.

## Entidades e invariantes preservadas

Echo aliado, Eco Sombrio/Shadow, Presença Temporal e `drawShip` não passam perfil e permanecem no default. Repetição Ancorada não ganhou dependência visual ou mecânica. WARDEN/HARDEN, NÔMADE, ECHO-0 e REVENANT permanecem neutros e byte-equivalentes ao default F1. Isso evita antecipar F3/F4. Save persiste apenas o char id existente; nenhum perfil entra no schema. Sandbox e resize não ganham estado/coordenada absoluta.

Portraits de menu permanecem legados por decisão de escopo: existe divergência temporária **gameplay body vs menu portrait**, reservada ao F3. Nenhuma UI/HUD foi modificada.

## Riscos residuais

- Avaliação de leitura em combate denso exige olho humano; hashes provam diferença estrutural, não qualidade estética.
- A ponta visual de armas longas e o muzzle usam contratos históricos diferentes; F2 não moveu spawn.
- Comparação WRAITH×REVENANT e PYRE×HARDEN deve ser refeita depois das silhuetas do Grupo B em F3.
- Harness Canvas não substitui inspeção raster real de oclusão, hurt flicker, aura rush e especiais.

## HUMAN PLAYTEST obrigatório

1. Jogar VECTOR, WRAITH, BULWARK e PYRE, primeiro com arma inicial e depois adquirindo uma ranged e uma melee.
2. Em cada um, inspecionar parado, andando e mirando nos oito octantes; testar r visual em câmera/resize normal.
3. Acionar hurt, dash e `[E]`; observar combate denso e confirmar que efeitos não ocultam o core.
4. VECTOR: confirmar equilíbrio, precisão, simetria, encaixe do plasma, dash e Salto de Fase.
5. WRAITH: confirmar velocidade, agressão e assimetria; comparar mentalmente com REVENANT; verificar aura rush e Protocolo Massacre.
6. BULWARK: confirmar peso/proteção sem parecer apenas ampliado ou o inimigo bulwark; verificar shotgun e Bastião.
7. PYRE: confirmar tanque, válvula, conduítes e pressão sem depender de laranja/chamas nem parecer HARDEN; verificar flamer e Nova Incendiária.
8. Salvar/continuar uma run com cada operador; abrir shop, pause, evento e HUD; confirmar ausência de exceções.
9. Aprovar somente se os quatro forem reconhecidos rapidamente pela forma em gameplay real.

F2 não recebe aprovação humana automática. F3 não foi iniciado.

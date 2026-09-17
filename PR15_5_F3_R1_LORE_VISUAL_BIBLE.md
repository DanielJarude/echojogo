# PR15.5-F3-R1 — Lore Visual Bible

## Estado da revisão

Esta é a primeira entrega de R1: auditoria de lore e identidade antes de qualquer alteração em `index.html`. O commit F3 existente (`b8c8ebbc5012ff93ebac54d874f0b045973ab29c`) foi preservado. Nenhum renderer, perfil, mecânica, portrait ou teste foi alterado nesta etapa.

**Regra de evidência:** fatos abaixo são transcrições/paráfrases de conteúdo existente no projeto. Onde não há evidência suficiente, a lacuna é marcada como **NÃO ENCONTRADO NO CÂNONE ATUAL**. A seção de interpretação visual não cria fatos narrativos; ela registra decisões de design derivadas dos fatos.

## Fontes auditadas

- `index.html`, bloco `CHARS`: papel, stats mecânicos, armas iniciais, especial, perk, descrição, título, lore e quote dos oito operadores.
- `index.html`, bloco `OPERATOR_WHISPER`: falas cosméticas determinísticas por operador.
- `index.html`, eventos `CARGA PESSOAL`/`x_cargaop`: reações narrativas específicas a cada operador.
- `index.html`, resolução de especiais e perks: comportamento mecânico atual.
- `PR13_5_B6.md`: comparação e identidade mecânica histórica do elenco.
- `PR14_5_B2_PLAYTEST.md`: relações entre operador e arma/build.
- `SAVE_SYSTEM.md`, `UI_UX_SYSTEM.md`, `STAT_MODIFIERS.md`: persistência, slots e invariantes; não foram tratados como lore.

Não foi encontrada uma biografia independente fora de `CHARS`, falas e eventos acima. Portanto não foram inventados nomes civis, facções, espécies, gênero, idade, origem familiar ou história anterior àquela escrita no código.

---

## 1. VECTOR

- **Nome / ID:** VECTOR / `vector` (`index.html`, `CHARS`).
- **Papel:** EQUILIBRADO.
- **Lore encontrada:** foi a resposta da Fundação ao colapso do Núcleo Ômega; é calibrado para permanecer idêntico a si mesmo em qualquer ciclo; sua assinatura não se degrada entre fraturas.
- **Personalidade encontrada:** calculista e orientado a custo/risco. A fala diz: “Eu não sou o mais forte. Sou o que ainda está aqui.” As falas de operador repetem cálculo, margem, preço e perda.
- **Falas representativas:** “Eu não aposto. Eu calculo qual perda dói menos.”; “Estabilidade não é ausência de risco. É escolher qual risco pagar.” (`OPERATOR_WHISPER`).
- **Arma inicial:** `plasma` + `blade`.
- **Especial:** SALTO DE FASE / `blink`: teletransporte ao cursor e invulnerabilidade temporária.
- **Estilo mecânico:** equilibrado, 100 HP, 335 speed, escudo 30, quatro slots, reroll extra.
- **Motivos visuais já existentes:** âncora de estabilidade, tecnologia temporal, core, precisão bilateral. O F3 atual usa torso facetado e chevron; isso é visual já implementado, não lore adicional.
- **Conceitos temporais:** estabilidade, identidade constante, ciclo, fratura, teletransporte.

### Tradução lore → design

- **Personalidade/função:** controle calculado → postura ereta, simétrica e econômica; nenhum excesso ornamental.
- **Forma/silhueta:** um eixo central rígido e uma forma frontal claramente estabilizada, não uma mochila dominante.
- **Cabeça:** capacete de visor estreito e geométrico, com leitura de instrumento de calibração.
- **Torso/equipamento:** core frontal integrado e uma estrutura axial visível que comunica âncora/estabilidade.
- **Material:** acabamento técnico limpo, faces regulares e baixa assimetria.
- **Assinatura primária:** **eixo frontal de estabilização + core central**.
- **Assinatura secundária:** postura perfeitamente controlada e capacete de visor calibrado.
- **Portrait:** busto 3/4 contido, peito/core dominantes e cabeça alinhada ao eixo.
- **Gameplay scale:** a forma central precisa sobreviver sem cor, arma ou glow; o core deve ser um volume largo, não um ponto de 1–2 px.
- **Diferença dos outros:** é o único com simetria/controle como tema visual; não deve possuir tanque, manto, massa lateral ou fragmentação.

## 2. WRAITH

- **Nome / ID:** WRAITH / `wraith`.
- **Papel:** ASSASSINO.
- **Lore encontrada:** processa a realidade a uma taxa que o corpo humano não suporta; já não resta muito de humano; vê combate em quadros congelados e escolhe onde estar antes da ameaça existir; deixa rastro de neon roxo.
- **Personalidade encontrada:** cansado, antecipatório, fatalista e agressivo. Fala sobre já ter visto o fim e pedir que uma vez algo termine diferente.
- **Falas representativas:** “Vocês veem o presente. Eu já saí dele.”; “O futuro não me surpreende mais. Só me cansa.”
- **Arma inicial:** `nail` + `scythe`.
- **Especial:** PROTOCOLO MASSACRE / `massacre`: crítico garantido, velocidade e rastro cortante.
- **Estilo mecânico:** 72 HP, 410 speed, baixo escudo, dois slots, crítico e dash muito fortes.
- **Motivos visuais já existentes:** silhueta estreita, inclinada, lâminas e rastro temporal.
- **Conceitos temporais:** quadros congelados, antecipação, rastro, presente já abandonado.

### Tradução lore → design

- **Forma/silhueta:** corpo inclinado para frente, estreito e com uma extensão traseira que parece deixar o tempo para trás.
- **Cabeça:** máscara/capacete em cunha com visor fendido, sem rosto humano legível.
- **Torso/equipamento:** coluna de deslocamento traseira fina e lâminas longas, mas integradas à anatomia visual.
- **Postura:** predatória, sempre avançando, como se o corpo estivesse um quadro à frente.
- **Assinatura primária:** **silhueta de predador inclinado com lâmina temporal traseira**.
- **Assinatura secundária:** cabeça-máscara sem humanidade e trilha axial estreita.
- **Portrait:** 3/4 inclinado, rosto baixo, ombro avançado e negativo visível atrás.
- **Gameplay scale:** a inclinação e a cabeça em cunha devem ser reconhecíveis mesmo monocromáticas.
- **Diferença dos outros:** não é um mercenário equipado (NÔMADE) nem uma figura vertical solene (REVENANT).

## 3. BULWARK

- **Nome / ID:** BULWARK / `bulwark`.
- **Papel:** FORTALEZA.
- **Lore encontrada:** blindagem cinética de dezesseis camadas, feita a partir dos destroços das comportas que seguraram a primeira onda; cada placa falhou uma vez e foi refundida para não falhar de novo; avança devagar porque nada consegue empurrá-lo.
- **Personalidade encontrada:** protetor, paciente e disposto a absorver impacto por outros.
- **Falas representativas:** “Fica atrás de mim.”; “Nenhum Eco cai enquanto eu estiver de pé.”
- **Arma inicial:** `shotgun` + `hammer`.
- **Especial:** BASTIÃO / `bastion`: escudo que absorve dano e reflete parte aos agressores.
- **Estilo mecânico:** 185 HP, 262 speed, escudo 60, cinco slots, redução de dano e regeneração.
- **Motivos visuais já existentes:** power armor larga, massa central, placas refundidas e escudo.
- **Conceitos temporais:** primeira onda do colapso, falha/refusão, resistência, permanência.

### Tradução lore → design

- **Forma/silhueta:** volume largo, baixo e contínuo; não deve parecer apenas um humano ampliado, mas uma comporta móvel.
- **Cabeça:** cabeça encaixada em colar blindado, com pouca exposição.
- **Torso/equipamento:** placas sobrepostas espessas e estrutura de contenção frontal.
- **Postura:** imóvel/pesada, pés e ombros abertos, sem inclinação predatória.
- **Assinatura primária:** **bloco de comporta blindada com colar fechado**.
- **Assinatura secundária:** placas espessas em camadas refundidas.
- **Portrait:** busto largo, quase arquitetônico, cabeça encaixada e ombros ocupando a largura do card.
- **Gameplay scale:** largura e colar precisam ser percebidos antes de detalhes internos.
- **Diferença dos outros:** é o único cuja forma é uma fortificação móvel; HARDEN deve ser módulo/engenharia, não massa de blindagem.

## 4. PYRE

- **Nome / ID:** PYRE / `pyre`.
- **Papel:** INCENDIÁRIO.
- **Lore encontrada:** carrega reatores térmicos que não deveriam ter saído do confinamento; acredita que uma linha temporal contaminada não se conserta, queima; seu fogo quântico consome a probabilidade de um futuro ter existido.
- **Personalidade encontrada:** radical, resoluto e utilitarista; não vê destruição, mas correção.
- **Falas representativas:** “Não estou destruindo. Estou corrigindo.”; “Contenção é para quem tem medo do próprio fogo.”
- **Arma inicial:** `flamer` + `blade`.
- **Especial:** NOVA INCENDIÁRIA / `nova`: explosão de área e queimadura.
- **Estilo mecânico:** dano contínuo, status forte, propagação de burn e explosões em cadeia.
- **Motivos visuais já existentes:** reator/tanque térmico, respirador, conduítes e assimetria funcional.
- **Conceitos temporais:** probabilidade consumida, futuro contaminado, confinamento rompido, correção por fogo.

### Tradução lore → design

- **Forma/silhueta:** equipamento térmico grande e deslocado, envolvendo o operador como uma unidade de contenção rompida.
- **Cabeça:** respirador/máscara de confinamento, mais industrial que tecnológica limpa.
- **Torso/equipamento:** reator térmico dominante, com tubulação grossa ligando dorsal e máscara.
- **Postura:** carregada para o lado do reator, como quem administra peso e pressão.
- **Assinatura primária:** **reator térmico dorsal/lateral que envolve o corpo**.
- **Assinatura secundária:** máscara respiratória conectada por conduíte espesso.
- **Portrait:** tanque e máscara ocupam a maior parte do busto; não um pequeno soldado central.
- **Gameplay scale:** o tanque deve ser uma massa grande e reconhecível sem laranja ou chamas.
- **Diferença dos outros:** PYRE é um sistema industrial pressurizado; VECTOR não possui equipamento deslocado nem máscara de contenção.

## 5. HARDEN

- **Nome / ID:** HARDEN / `warden`.
- **Papel:** TÁTICO.
- **Lore encontrada:** foi estrategista de contenção; vê vetores de intenção desdobrados no tempo; trata a arena como tabuleiro; posiciona o combate onde precisa que ele aconteça.
- **Personalidade encontrada:** disciplinado, analítico, mas não obediente de forma cega. As falas contrapõem protocolo e decisão própria.
- **Falas representativas:** “Você entrou no espaço que eu escolhi para você.”; “O sistema confia em mim. Eu confio no sistema. Um de nós está errado.”
- **Arma inicial:** `acid` + `glaive`.
- **Especial:** TORRE DE CONTENÇÃO / `turret`: implanta torre autônoma por 12 segundos.
- **Estilo mecânico:** controle de área/status, duração de status +40%, cura de kits dobrada.
- **Motivos visuais já existentes:** módulos de deploy e backpack técnico do F3 atual; a lore dá base para um sistema de controle, não para “engenheiro verde” genérico.
- **Conceitos temporais:** vetores de intenção, antecipação, tabuleiro, posicionamento, contenção.

### Tradução lore → design

- **Forma/silhueta:** operador organizado em torno de uma moldura/grade de contenção, não de placas de armadura.
- **Cabeça:** visor de leitura ampla ou “visor-tábua”, remetendo a análise de vetores; sem máscara predatória.
- **Torso/equipamento:** estrutura de comando aberta, com um módulo de implantação grande e legível.
- **Postura:** rígida e deliberada, com centro de gravidade recuado como alguém que já escolheu a posição.
- **Assinatura primária:** **moldura de contenção/deploy que organiza o corpo como um tabuleiro**.
- **Assinatura secundária:** cabeça de leitura vetorial e módulo de comando claramente separado do torso.
- **Portrait:** busto 3/4 com a moldura abrindo ao redor dos ombros; o espaço negativo é intencional.
- **Gameplay scale:** a moldura precisa ser uma forma grande, não uma antena ou conjunto de placas pequenas.
- **Diferença dos outros:** BULWARK é parede/absorção; HARDEN é arquitetura de posicionamento e controle.

## 6. NÔMADE

- **Nome / ID:** NÔMADE / `nomad`.
- **Papel:** MERCENÁRIO.
- **Lore encontrada:** não jura lealdade à Fundação; cruza zonas mortas entre ciclos negociando sucata, informação e tecnologia; vê o colapso como a maior liquidação da história; sempre sai com mais do que entrou.
- **Personalidade encontrada:** pragmático, oportunista, espirituoso e comercial. Não é simplesmente “veterano misterioso”; isso não está explicitamente no cânone atual.
- **Falas representativas:** “O mundo acabou. Alguém tem que lucrar com isso.”; “Eu não roubo. Eu recupero o que o colapso largou no chão.”
- **Arma inicial:** `smg` + `katana`.
- **Especial:** CACHE DE SUPRIMENTOS / `cache`: invoca caixa com créditos, cura e upgrade aleatório.
- **Estilo mecânico:** móvel, cinco slots, economia +45%, loja −15%.
- **Motivos visuais já existentes:** kit assimétrico e mochila utilitária; a lore exige um personagem de comércio/recuperação, não sucata aleatória.
- **Conceitos temporais:** zonas mortas entre ciclos, liquidação do colapso, recuperação, troca.

### Tradução lore → design

- **Forma/silhueta:** um corpo parcialmente oculto por um “balcão”/módulo de carga modular, com compartimentos grandes e organizados.
- **Cabeça:** visor de estrada/negociador, com leitura prática; não máscara predatória nem capacete militar limpo.
- **Torso/equipamento:** cache de suprimentos dominante, com módulos de tamanhos diferentes mas encaixados como inventário funcional.
- **Postura:** solta, lateral e pronta para sair carregando algo; não a inclinação de caça do WRAITH.
- **Assinatura primária:** **módulo de carga/cache lateral grande, com compartimentos visíveis**.
- **Assinatura secundária:** postura de viajante lateral e kit de recuperação modular.
- **Portrait:** busto aberto de 3/4, carga ocupando um lado do card e torso deixando espaço negativo.
- **Gameplay scale:** a massa lateral do cache deve sobreviver sem pequenos bolsos ou cor.
- **Diferença dos outros:** NÔMADE é definido por carga recuperada e mobilidade comercial, não por stealth, armadura ou temporalidade pura.

## 7. ECHO-0

- **Nome / ID:** ECHO-0 / `echo0`.
- **Papel:** RESSONANTE.
- **Lore encontrada:** estava a nove metros do Núcleo Ômega quando ele cedeu; não sobreviveu ao colapso, foi impresso por ele; gravidade se curva ao seu redor; espaço guarda memórias de futuros que nunca aconteceram; é o primeiro Eco e os outros o obedecem.
- **Personalidade encontrada:** introspectivo, fragmentado e assombrado por memória/ordem temporal. A fala não prova que seja uma entidade Echo aliada; prova uma experiência subjetiva de memória quebrada.
- **Falas representativas:** “Eu me lembro de morrer. Todas as vezes.”; “Já estive aqui. Ou vou estar.”
- **Arma inicial:** `tesla` + `blade`.
- **Especial:** SOBRECARGA RESSONANTE / `overload`: potencializa os Ecos existentes e os mantém próximos.
- **Estilo mecânico:** operador frágil, três slots, Echo boost +60%, começa com créditos; mecanicamente continua separado das entidades fora do operador.
- **Motivos visuais já existentes:** core de ressonância, placas separadas, gravidade/fragmentação.
- **Conceitos temporais:** impressão pelo colapso, futuros não acontecidos, memória, gravidade curvada, primeiro Eco.

### Tradução lore → design

- **Forma/silhueta:** corpo incompleto/impresso, com um vazio central e componentes orbitais grandes; não um soldado com uma esfera no peito.
- **Cabeça:** capacete parcial ou máscara sem continuidade, como uma impressão que não terminou.
- **Torso/equipamento:** core exposto e placas separadas por negativo real, com massas orbitais legíveis.
- **Postura:** controlada porém estranha, sem eixo anatômico perfeitamente fechado.
- **Assinatura primária:** **vazio/core de impressão com placas orbitais desacopladas**.
- **Assinatura secundária:** cabeça incompleta e gravidade sugerida por componentes fora do casco.
- **Portrait:** busto 3/4 com partes flutuantes maiores e espaço negativo central.
- **Gameplay scale:** o vazio e o core precisam ser formas grandes; não depender de partículas ou glow.
- **Diferença dos outros:** ECHO-0 é o único cuja anatomia visual parece impressa/incompleta; isso não deve ser aplicado ao Echo aliado, Shadow ou Presença.

## 8. REVENANT

- **Nome / ID:** REVENANT / `revenant`.
- **Papel:** CEIFADOR.
- **Lore encontrada:** ninguém o construiu; montou-se sozinho nas zonas esquecidas com operadores descartados pelo ciclo; persegue energia para adiar o próprio desligamento; a cada onda algo dele se apaga, e ele continua colhendo.
- **Personalidade encontrada:** faminto, consciente da própria deterioração e ameaçador; não é simplesmente “morto-vivo” factual além da montagem descrita.
- **Falas representativas:** “Tudo termina. Eu só chego antes.”; “Eu já fui presa. Aprendi a ser o que caça.”
- **Arma inicial:** `scythe` + `rail`.
- **Especial:** COLHEITA MACABRA / `harvest`: executa inimigos enfraquecidos e cura por abate.
- **Estilo mecânico:** 66 HP, dano alto, crítico, cura por kill, dano acumulado e decadência de vida máxima por onda.
- **Motivos visuais já existentes:** forma vertical, máscara e placas longitudinais; a lore exige um corpo montado de descartes e um sistema de coleta de energia.
- **Conceitos temporais:** zonas esquecidas, descarte, desligamento, deterioração, colheita.

### Tradução lore → design

- **Forma/silhueta:** uma coluna alongada composta por módulos recolhidos, com torso vertical e “vazio de desligamento” visível.
- **Cabeça:** máscara mortuária/sem expressão, mas com encaixes de peças reaproveitadas; não apenas um visor colorido.
- **Torso/equipamento:** estrutura frontal de coleta/ceifa e placas pendentes como uma carcaça montada.
- **Postura:** solene, vertical e inclinada apenas o suficiente para ameaçar; não o avanço baixo do WRAITH.
- **Assinatura primária:** **coluna de carcaça montada com máscara mortuária e coletor frontal**.
- **Assinatura secundária:** queda vertical de placas/módulos que sugere deterioração.
- **Portrait:** busto alto, cabeça acima dos demais, coletor frontal e ombros descendo como manto estrutural.
- **Gameplay scale:** altura, máscara e queda vertical devem sobreviver no sprite real.
- **Diferença dos outros:** REVENANT é uma presença vertical de coleta e desligamento; WRAITH é velocidade e antecipação.

---

# Matriz conceitual de diferenciação

| Par | Diferença primária baseada no cânone |
|---|---|
| VECTOR × WRAITH | estabilidade axial/calibração versus corpo que já abandonou o presente |
| VECTOR × BULWARK | âncora limpa e equilibrada versus comporta refundida e massiva |
| VECTOR × PYRE | tecnologia de estabilidade versus reator térmico de probabilidade |
| VECTOR × HARDEN | operador calibrado que responde ao caos versus estrategista que posiciona o caos |
| VECTOR × NÔMADE | identidade constante versus carga e recuperação de oportunidades |
| VECTOR × ECHO-0 | continuidade de si versus impressão fragmentada pelo colapso |
| VECTOR × REVENANT | estabilidade versus deterioração/energia de sobrevivência |
| WRAITH × BULWARK | velocidade antecipatória versus permanência protetora |
| WRAITH × PYRE | predador sem humanidade versus sistema de confinamento térmico |
| WRAITH × HARDEN | reage antes da ameaça versus escolhe onde a ameaça deve estar |
| WRAITH × NÔMADE | caça/assassinato versus negociação/recuperação |
| WRAITH × ECHO-0 | corpo adiantado no tempo versus corpo impresso e incompleto |
| WRAITH × REVENANT | diagonal veloz versus coluna solene |
| BULWARK × PYRE | comporta refundida versus reator pressurizado móvel |
| BULWARK × HARDEN | absorção/parede versus arquitetura de contenção |
| BULWARK × NÔMADE | massa que não cede versus kit que nunca para de circular |
| BULWARK × ECHO-0 | casco fechado versus negativo/core exposto |
| BULWARK × REVENANT | largura e estabilidade versus altura e desligamento |
| PYRE × HARDEN | fogo que corrige por destruição versus espaço escolhido por estratégia |
| PYRE × NÔMADE | equipamento de confinamento versus inventário recuperado |
| PYRE × ECHO-0 | reator térmico contido versus impressão gravitacional aberta |
| PYRE × REVENANT | combustão/probabilidade versus energia colhida para não desligar |
| HARDEN × NÔMADE | grade de posicionamento versus cache lateral de comércio |
| HARDEN × ECHO-0 | tabuleiro ordenado versus anatomia sem continuidade |
| HARDEN × REVENANT | controle deliberado versus montagem deteriorada |
| NÔMADE × ECHO-0 | mercadoria concreta recuperada versus memórias/futuros não acontecidos |
| NÔMADE × REVENANT | viajante que acumula valor versus entidade que consome energia para continuar |
| ECHO-0 × REVENANT | primeiro Eco impresso e orbitante versus restos montados em coluna |

## Assinaturas primárias do elenco

1. VECTOR — eixo frontal de estabilização/core central.
2. WRAITH — predador inclinado com lâmina temporal traseira.
3. BULWARK — comporta blindada com colar fechado.
4. PYRE — reator térmico dominante conectado à máscara.
5. HARDEN — moldura de contenção/deploy em forma de tabuleiro.
6. NÔMADE — cache de carga lateral grande.
7. ECHO-0 — vazio/core de impressão com placas orbitais.
8. REVENANT — coluna de carcaça montada com coletor frontal.

## Decisões de escopo para a implementação posterior

- Continuar com `OPERATOR_VISUALS`, mas permitir vocabulário genérico para multi-hull, massa independente de ombro, componentes orbitais, vazio negativo, moldura e equipamento dominante.
- Não criar `drawVector`, `drawWraith` ou equivalentes.
- Não alterar qualquer valor de CHARS, hitbox, `r`, anchor, D/E, melee, save, sandbox ou entidade fora do escopo.
- Character Select deve usar uma projeção de busto 3/4 expressiva derivada do mesmo conceito declarativo, em vez de uma miniatura top-down ampliada.
- Portraits devem ocupar significativamente mais área segura do card, sem invadir nome, papel, slots ou controles.
- A implementação posterior deve ser julgada em gameplay scale, silhouette-only, monocromático, sem arma e blur leve; cor/glow não podem carregar a identidade sozinhos.

## O que ainda não é afirmado

Esta Bible não afirma que os oito designs já foram aprovados visualmente. Ela transforma o cânone encontrado em critérios de implementação e permanece sujeita a HUMAN PLAYTEST. Nenhuma lore nova foi adicionada ao jogo.

## IMPLEMENTATION RESULT

- **VECTOR** — lore de estabilidade/calibração → eixo frontal grande e core central; gameplay lê forma central/bilateral; Select usa busto ampliado com eixo e core.
- **WRAITH** — lore de predador que abandona o presente → lâmina temporal traseira grande; gameplay lê direção/inclinação; Select preserva a postura predatória.
- **BULWARK** — lore de comportas refundidas → massa superior/colar e arquitetura larga; gameplay lê fortificação; Select mantém o busto fechado e largo.
- **PYRE** — lore de reator térmico e probabilidade queimada → reservatório traseiro grande e conexão industrial; gameplay lê peso atrás; Select enfatiza reator e máscara.
- **HARDEN** — lore de estrategista de contenção → duas estruturas laterais de moldura/deploy; gameplay lê sistema carregado, não apenas mochila; Select deve enquadrar o busto com essa moldura.
- **NÔMADE** — lore de recuperação e comércio em zonas mortas → cache lateral grande; gameplay lê carga assimétrica utilitária; Select desloca o centro visual para o lado do cache.
- **ECHO-0** — lore de impressão pelo colapso → componentes orbitais laterais e core; gameplay lê ruptura/estranheza; Select enfatiza o negativo e as placas desacopladas.
- **REVENANT** — lore de carcaça montada e energia para evitar desligamento → coluna traseira alongada e coletor frontal; gameplay lê verticalidade; Select enfatiza máscara, altura e coletor.

As formas foram adicionadas através do vocabulário declarativo existente (`hull`, `round`, `tri`, `circle`, partes traseiras e materiais). Nenhum renderer por operador foi criado. O Character Select recebeu aumento de presença do retrato de 40 para 76 pixels e o tamanho base do `.cicon` foi ampliado para 76 pixels. A validação final continua exigindo gameplay real e HUMAN PLAYTEST.

## R1 audit artifacts

`PR15_5_F3_R1_AUDIT.png` é um artefato local de auditoria, fora do runtime. A validação técnica final desta implementação passou com 76 suítes, 4905 checks e zero falhas. A folha não substitui a inspeção humana do Character Select real, especialmente a leitura das assinaturas em gameplay scale.

## F3-R2 STATUS

F3-R1 gameplay foi HUMAN APPROVED. A apresentação corporal anterior do Character Select foi superseded por F3-R2. Esta revisão substitui prioritariamente `charPortraitBuild` por portraits faciais pixel-art procedural, mantendo os oito profiles e o renderer de gameplay R1. As informações faciais específicas não estão definidas como fatos no cânone; as formas são interpretações visuais documentadas pela lore já auditada. ECHO-0 usa uma cabeça fragmentada/core e REVENANT usa uma máscara/estrutura alongada, sem convertê-los em rostos humanos genéricos.

## F3-R2 IMPLEMENTATION RESULT

F3-R1 gameplay permanece aprovado e não foi redesenhado. O Character Select agora usa `face` declarativo dentro de cada `OPERATOR_VISUALS[id]` e `charPortraitBuild` gera um portrait facial/head-and-shoulders procedural em viewBox 48×48, com `shape-rendering:crispEdges` e apresentação `image-rendering:pixelated`. Os oito perfis receberam assinaturas faciais distintas: angular/calmo, wedge/predatório, collar/steady, round/respirator, square/focused, irregular/wary, fragment/core e long/dead.

Fatos canônicos faciais específicos não foram encontrados para os oito operadores. As faces são interpretações visuais originais baseadas na lore existente: ECHO-0 permanece fragmentado/core e REVENANT permanece alongado/mortuário, sem rostos humanos genéricos. A implementação não altera gameplay, save, anchors, Echo, Shadow, Presença ou Repetição. `PR15_5_F3_R2_FACE_PORTRAITS_AUDIT.png` é artefato de auditoria fora do runtime; captura real do Select não foi produzida pelo ambiente.

## F3-R3 IMPLEMENTATION RESULT

O feedback humano do R2 foi registrado: os portraits pareciam ícones, não rostos. R3 substitui a composição de placas/visor por uma construção facial genérica de 64×64: ombros, pescoço, crânio escalonado, testa, têmporas, olhos, sobrancelhas, ponte nasal, região média, mandíbula e queixo. Equipamento e molduras agora enquadram a cabeça em vez de substituí-la. A expressão é derivada de `face.expr`; ECHO-0 usa face fragmentada/core e REVENANT usa face longa/máscara mortuária.

R3 não altera `drawUnit` ou os sprites de gameplay R1. Não foi possível registrar uma captura real do browser neste ambiente; a aprovação humana deve verificar o Character Select real. A resolução 64×64 é apresentada com hard edges/pixelated e permanece cacheada.

## F3-R4 IMPLEMENTATION RESULT

O feedback do R3 foi preservado: a leitura facial continua sendo a base aprovada. R4 diferencia os oito personagens dentro dessa leitura através de largura/altura de cabeça, ângulo, centro facial, espaçamento ocular, tons de pele separados da paleta do operador, expressões, framing de ombros e assimetrias. VECTOR permanece clínico e simétrico; WRAITH estreito/inclinado; BULWARK largo e pesado; PYRE intenso com respirador; HARDEN vigilante; NÔMADE mais exposto e vivido; ECHO-0 fragmentado de forma impossível; REVENANT alongado e reconstruído.

Essas características físicas são interpretações visuais, não fatos biográficos novos. O renderer continua declarativo, cacheado e genérico. Gameplay F3-R1 permanece congelado.

# PR15.5-F3 — Full Operator Cast

## Estado
Base `79f0d85baa089aa5546799b8215ed65054bff8d6`, branch `arena/01a0ada5-echojogo`.
Baseline executada: 74 suítes; 4819 checks aprovados; falhas históricas de `git show` em clone grafted/shallow (17 checks em C, E9 e F1).

## Arquitetura
`OPERATOR_VISUALS[id]` continua sendo a fonte única para `drawUnit` e `charPortraitBuild`. As extensões são genéricas: `build`, `parts`, `mat`, `portrait`, proporções, postura e offset. Perfis são congelados, determinísticos e nenhum renderer por operador foi criado. `warden` permanece o ID canônico de HARDEN.

## Direção do elenco
VECTOR é frontal, atlético, preciso e temporal; WRAITH estreito/predatório; BULWARK largo e blindado; PYRE industrial, assimétrico e carregado para trás. HARDEN usa corpo médio, harness, módulos de implantação e sensor de comando, portanto lê engenheiro tático e não power armor. NÔMADE usa kit assimétrico adaptado, mochila lateral e peças combinadas, utilitário e mercenário, não predatório como WRAITH. ECHO-0 usa casco fragmentado, core luminoso e espaços negativos, experimental e ressonante sem dependência das entidades Echo. REVENANT é alto/longitudinal, com máscara mortuária, placas verticais e presença solene, não um WRAITH 2.

VECTOR foi refinado para ter torso central/frontal, ombros limpos e capacete angular. PYRE mantém tanque, respirador e conduítes, com massa dorsal e assimetria funcional reforçadas. Assim a diferença não depende somente das cores: VECTOR é tecnologia limpa e bilateral; PYRE é equipamento pressurizado, utilitário e pesado atrás.

## Invariantes
Não foram alterados CHARS, stats, `r`, hitboxes, anchors, armas, D/E, melee, hurt, dash, especiais, save, sandbox, Echo aliado, Eco Sombrio, Presença Temporal, Repetição Ancorada, inimigos, minibosses, Singular ou Paradoxo. Não foram adicionadas dependências, RNG ou mutação de perfis.

## Auditoria humana requerida
Verificar Character Select e gameplay em 100% e 200%, paleta real/monocromática, sem arma, oito octantes e pares críticos: VECTOR/PYRE, WRAITH/NÔMADE, BULWARK/HARDEN, WRAITH/REVENANT e VECTOR/ECHO-0. Confirmar idle, aim, ranged, melee, hurt, dash e especial dos quatro novos. Este documento não substitui aprovação artística.

**F3 TECNICAMENTE VERDE — ELENCO COMPLETO AGUARDA HUMAN PLAYTEST.**

## HISTORICAL TEST MIGRATION

- `tests/pr15-5-f1-operator-visual-foundation.test.js`: checks G/U/Q que exigiam que WARDEN, NOMAD, ECHO-0 e REVENANT fossem byte-equivalentes ao default foram migrados. Eram corretos na fundação F1, quando Grupo B era neutro; F3 agora exige builds e portraits reais. Foram preservados os checks de fallback sem perfil, IDs, callers não-operador, Echo, Shadow, Presença, Repetição, save, RNG, pureza e determinismo.
- `tests/pr15-5-f2-operator-group-a-visuals.test.js`: checks de neutralidade e equivalência do Grupo B foram substituídos por presença de build/portrait e diferença do default. As garantias mecânicas, anchors e separação de entidades permanecem.
- `tests/pr15-5-f2-r1-character-identity-overhaul.test.js`: expectativa de Grupo B legacy foi migrada para os oito portraits derivados de build. Os testes de Grupo A, CHARS, r, hitboxes, D/E, Echo, Shadow, Presença, Repetição e save continuam ativos.
- `tests/pr15-5-performance-audit1.test.js` e `tests/pr15-5-c-hurt-death.test.js`: fixtures que selecionavam `warden` apenas para comparar o corpo neutro histórico passaram a usar o ID desconhecido `__legacy__`, que testa explicitamente o fallback sem perfil e não mascara o novo F3.

O histórico Git foi restaurado antes da migração (`is-shallow-repository=false`); nenhuma expectativa foi hardcoded para contornar objetos ausentes.

## Contact sheet e performance

`PR15_5_F3_AUDIT.png` foi gerada como artefato temporário de auditoria, fora do runtime e sem carregamento por `index.html`. A folha mantém a ordem canônica dos oito operadores e seis linhas de auditoria: gameplay real, gameplay monocromático, escala 2x real, escala 2x monocromática, sem arma e Character Select. A imagem não é asset de produção.

A suíte completa passou após a migração: 75 suítes, 4885 checks, 0 falhas. O gate artístico continua separado: a contact sheet é inspeção estrutural e requer HUMAN PLAYTEST.

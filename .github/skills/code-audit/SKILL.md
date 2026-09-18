# Skill: Code Audit

## Quando usar
Use esta skill para:
- auditoria geral de código;
- dead code;
- duplicações;
- wrappers;
- lifecycle;
- riscos arquiteturais;
- dívida técnica;
- boas práticas;
- performance;
- persistência;
- isolamento de DEV/Sandbox;
- testes frágeis.

## Princípios
- Não confundir dívida técnica com bug atual.
- Não remover código apenas porque parece antigo.
- Não classificar símbolo como morto só por ter poucas referências.
- Sempre considerar:
  - callbacks;
  - event listeners;
  - maps;
  - lookup por string;
  - globalThis/window;
  - DEV;
  - harnesses;
  - testes;
  - Electron IPC;
  - save/migration;
  - wrappers;
  - acesso dinâmico.

## Classificação de dead code
Classificar cada candidato como:
- CONFIRMADO MORTO
- ALTA PROBABILIDADE
- POSSÍVEL
- USO INDIRETO
- ATIVO

Para marcar como CONFIRMADO MORTO:
- provar ausência de uso em produção;
- provar ausência de uso em testes;
- provar ausência em harnesses;
- verificar acesso dinâmico/global;
- verificar callbacks/registries/maps.

## Wrappers e monkey-patches
Ao auditar padrões como:

```js
const _old = fn;
fn = function(...) {
  ...
}
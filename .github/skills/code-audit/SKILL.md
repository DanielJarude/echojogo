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
- testes frágeis;
- APIs potencialmente abandonadas;
- código legado;
- regressões estruturais;
- acoplamento excessivo.

## Princípios

- Não confundir dívida técnica com bug atual.
- Não remover código apenas porque parece antigo.
- Não classificar símbolo como morto só por ter poucas referências.
- Não assumir que ausência de chamada direta significa ausência de uso.
- Preferir evidência concreta a inferência.
- Separar observações comprovadas de hipóteses.
- Não realizar refatorações amplas durante uma auditoria sem autorização.
- Não alterar gameplay, balanceamento ou comportamento incidentalmente.
- Sempre considerar contexto de produção, testes e ferramentas internas.

Antes de concluir que algo não é utilizado, verificar:

- callbacks;
- event listeners;
- maps;
- registries;
- lookup por string;
- `globalThis`;
- `window`;
- propriedades acessadas dinamicamente;
- DEV;
- Sandbox;
- harnesses;
- testes;
- Electron IPC;
- preload;
- persistência;
- save/migration;
- wrappers;
- monkey-patches;
- aliases;
- timers;
- hooks de lifecycle;
- acesso dinâmico.

## Classificação de dead code

Classificar cada candidato como:

- CONFIRMADO MORTO
- ALTA PROBABILIDADE
- POSSÍVEL
- USO INDIRETO
- ATIVO

### CONFIRMADO MORTO

Só usar esta classificação quando houver evidência suficiente de que o símbolo não participa do sistema.

Antes de marcar como CONFIRMADO MORTO:

- provar ausência de uso em produção;
- provar ausência de uso em `tests/`;
- provar ausência em harnesses;
- verificar acesso dinâmico/global;
- verificar callbacks;
- verificar registries;
- verificar maps;
- verificar lookup por string;
- verificar aliases;
- verificar wrappers;
- verificar Electron IPC;
- verificar persistência e migração;
- verificar referências indiretas.

Não remover automaticamente apenas porque uma busca textual retorna zero chamadas.

## Duplicações

Ao encontrar funções ou blocos aparentemente duplicados:

- comparar implementação completa;
- comparar assinatura;
- comparar efeitos colaterais;
- comparar escopo;
- verificar ordem de declaração;
- verificar se uma declaração sobrescreve outra;
- verificar consumidores;
- verificar testes;
- verificar acesso dinâmico.

Classificar como duplicação segura para remoção apenas se forem realmente equivalentes e a remoção preservar o comportamento atual.

## Wrappers e monkey-patches

Ao auditar padrões como:

```js
const _old = fn;

fn = function (...args) {
  // comportamento adicional
  return _old.apply(this, args);
};
```

verificar:

- ordem em que os wrappers são instalados;
- qual implementação está sendo encapsulada;
- preservação de `this`;
- preservação dos argumentos;
- preservação do valor de retorno;
- chamadas duplicadas;
- chamadas perdidas;
- efeitos colaterais;
- wrapper órfão;
- inicialização condicional;
- dependência da ordem dos arquivos;
- conflito entre kits;
- possibilidade de wrapping múltiplo;
- restauração ou sobrescrita posterior.

A existência de muitos wrappers é dívida arquitetural e risco de manutenção, mas não significa automaticamente bug atual.

Não adicionar novos monkey-patches sem justificativa técnica forte.

## Lifecycle

Ao auditar sistemas com lifecycle, identificar claramente os estados relevantes.

Exemplos:

- criação;
- inicialização;
- ativação;
- atualização;
- pausa;
- desativação;
- reset;
- destruição;
- troca de run;
- troca de cena;
- retorno ao menu;
- encerramento da aplicação.

Verificar:

- listeners não removidos;
- timers sobrevivendo além do esperado;
- estado global não resetado;
- objetos reaproveitados indevidamente;
- chamadas duplicadas de inicialização;
- teardown incompleto;
- estado persistente atravessando runs;
- hooks instalados múltiplas vezes.

## Persistência

Ao auditar save e meta-progressão:

- preservar compatibilidade com saves existentes;
- verificar migrations;
- verificar defaults;
- verificar dados ausentes;
- verificar dados antigos;
- verificar corrupção parcial;
- verificar leitura e escrita em Electron;
- verificar isolamento entre slots;
- evitar renomear chaves persistidas sem migração.

Nunca remover código relacionado a persistência apenas porque não aparece no fluxo normal da run.

## Performance

Distinguir:

- custo teórico;
- custo potencial;
- gargalo observado.

Classificar impacto aproximado como:

- P0 — quebra crítica ou perda de dados;
- P1 — risco alto de regressão, travamento ou problema sistêmico;
- P2 — dívida relevante, desperdício frequente ou manutenção difícil;
- P3 — otimização menor ou higiene.

Ao avaliar performance, considerar:

- código dentro do game loop;
- desenho por frame;
- buscas repetidas;
- alocação por frame;
- DOM;
- Canvas;
- filtros;
- partículas;
- sombras;
- loops aninhados;
- timers;
- serialização;
- persistência;
- criação repetida de objetos;
- funções chamadas por entidade por frame.

Não classificar micro-otimização como problema grave sem evidência.

## Testes

Ao auditar testes, identificar o tipo:

- comportamental;
- integração;
- simulação;
- estrutural;
- source-text;
- snapshot;
- golden fixture.

Dar preferência a testes de comportamento e contratos reais.

Considerar frágeis testes que dependem desnecessariamente de:

- texto exato do source;
- posição de código;
- ordem incidental;
- hashes de implementação;
- histórico Git;
- commits antigos;
- detalhes internos que não representam contrato real.

Não remover APIs usadas por testes durante uma limpeza de dead code sem investigar se são intencionalmente expostas para harnesses.

## Evidência

Toda conclusão importante deve ser classificada em um destes níveis:

### PROVADO

Há evidência direta suficiente.

Exemplos:

- referência encontrada;
- teste cobre o comportamento;
- símbolo não possui consumidores após investigação completa;
- duplicação é byte-a-byte ou semanticamente equivalente.

### FORTEMENTE INDICADO

A evidência é forte, mas ainda existe alguma possibilidade de uso indireto ou condição não testada.

### HIPÓTESE

É uma possibilidade que exige investigação adicional.

Nunca apresentar hipótese como fato confirmado.

## Severidade

### P0

Problema crítico.

Exemplos:

- perda de save;
- corrupção persistente;
- crash sistemático;
- impossibilidade de jogar;
- falha de segurança relevante.

### P1

Problema de alta prioridade.

Exemplos:

- regressão sistêmica;
- lifecycle quebrado;
- testes produzindo falsos resultados;
- dependência arquitetural extremamente frágil;
- comportamento incorreto frequente.

### P2

Problema relevante, mas não imediatamente crítico.

Exemplos:

- dead code;
- duplicação;
- dívida arquitetural;
- APIs abandonadas;
- testes excessivamente frágeis;
- manutenção difícil.

### P3

Higiene e melhoria incremental.

Exemplos:

- comentário desatualizado;
- pequena inconsistência de estilo;
- micro-otimização;
- organização menor.

## Fluxo de trabalho

Para auditorias:

1. inspecionar;
2. coletar evidência;
3. classificar achados;
4. separar fatos de hipóteses;
5. propor plano;
6. aguardar autorização;
7. fazer o menor diff seguro possível;
8. executar testes relevantes;
9. executar suíte completa quando aplicável;
10. executar `git diff --check`;
11. relatar exatamente o que foi alterado.

Não transformar uma auditoria automaticamente em refatoração.

## Regras específicas do ECHO

No projeto ECHO:

- preservar compatibilidade de save;
- preservar determinismo onde aplicável;
- não alterar balanceamento durante limpeza estrutural;
- não alterar comportamento visual aprovado incidentalmente;
- não alterar operadores aprovados incidentalmente;
- manter IDs canônicos dos operadores;
- preservar retratos oficiais;
- preservar separação conceitual e mecânica de ECHO-0;
- não confundir ECHO-0 com Echo aliado, Dark Echo, Presence, Repetição ou Memory Director.

A Repetição Ancorada deve permanecer independente das mecânicas de Echo e Memory Director.

Nunca adicionar à Repetição Ancorada:

- ataque extra;
- duplicação;
- bônus de confiança;
- Ressonância;
- consumo compartilhado;
- participação ofensiva;
- contribuição para DPS;
- sinergia mecânica ofensiva com Echo.

Mudanças de gameplay, UX ou visual exigem validação humana.

Testes automatizados não substituem playtest humano.

## Estado atual de auditoria do ECHO

AUDIT-FIX-A está concluído.

Os testes não devem depender de:

```text
git show <historical SHA>
```

AUDIT-FIX-B1 deve remover somente dead code confirmado e duplicações idênticas.

Dead code confirmado atualmente:

- `operatorPortraitFallback`
- `nearestTarget`
- `nearestHostileEcho`
- `eqCatName`
- `eqOriginCol`
- `rarPower`
- `itemStateFlags`

Duplicações confirmadas atualmente:

- `smClearSlotSave`
- `smClearSlotEchoes`
- `refreshAfterSlotWipe`

Não incluir no AUDIT-FIX-B1 sem nova investigação:

- APIs usadas somente por testes;
- `ENEMY_VISUAL_PROFILES`;
- `weaponVisualProfile`;
- `visualNotify`;
- `loadMeta`;
- `smHas`;
- `echoEq*Mul`.

Roadmap atual:

- AUDIT-FIX-A — concluído;
- AUDIT-FIX-B1 — dead code confirmado e duplicações;
- AUDIT-FIX-B2 — APIs test-only e fundação visual;
- AUDIT-FIX-C — unificar meta loading;
- AUDIT-FIX-D — reduzir risco de lifecycle e monkey-patches;
- AUDIT-FIX-E — substituir testes source-text frágeis por contratos comportamentais;
- AUDIT-FIX-F — modularização incremental de `index.html`.
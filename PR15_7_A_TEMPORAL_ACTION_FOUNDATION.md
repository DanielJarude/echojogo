# PR15.7-A — Fundação da Repetição Ancorada

## 1. Objetivo

Criar o contrato técnico, run-scoped, bounded e reversível para registrar semanticamente uma ação ranged recente do jogador. Este bloco termina em `TEMPORAL ACTION ARMED`; não existe ativação nem replay ofensivo.

## 2. Base

- Base: `c59ebb643f38623b332ea59b649d99082329918e` (`c59ebb6`).
- Branch de trabalho Arena: `arena/01a09752-echojogo`.
- Working tree estava limpa no início.

## 3. Problema de identidade

ECHO já registra runs e materializa Echos históricos, mas o combate comum ainda não oferece ao jogador um verbo para manipular diretamente uma ação recente da timeline atual. A Repetição Ancorada preencherá esse espaço sem criar rewind de mundo.

## 4. Arquitetura escolhida

Fluxo deste bloco:

```text
PLAYER ACTION
→ fireWeaponFrom
→ temporalActionCapture
→ temporalAction armada
→ substituição, expiração ou cleanup
```

Fluxo reservado ao PR15.7-B:

```text
TEMPORAL ACTION ARMED
→ input manual
→ replay simplificado
→ consequência no mundo
```

## 5. Diferença para Echo

A ação temporal:

- pertence à run atual;
- representa um único disparo semântico;
- dura cinco segundos;
- não possui entidade, IA, personalidade, confiança ou Dissonância;
- não usa nem altera `echoQueue`, `echoes[]` ou a trail histórica;
- não persiste entre runs.

Echos continuam sendo a representação persistente de runs anteriores.

## 6. Estado `temporalAction`

Existe no máximo um objeto ativo:

```js
{
  id,
  t,
  expiresAt,
  type: 'shot',
  weaponId,
  x,
  y,
  angle,
  payload,
  state: 'armed',
  source: 'player'
}
```

O objeto contém somente números e strings. Não guarda player, arma completa, inimigo, item state, callbacks, closures, RNG ou entidade viva.

## 7. Lifecycle

Estados contratuais:

- `armed`: disponível para o futuro PR15.7-B;
- `consumed`: reservado para o consumo futuro;
- `expired`: expirou, foi substituída ou limpa.

Neste bloco não há caminho de consumo jogável. Ao expirar ou ser limpa, a referência global é removida.

## 8. Whitelist

Lookup O(1), sem busca por frame:

```js
{plasma:1, shotgun:1, rail:1, sniper:1}
```

Todas as outras armas continuam funcionando normalmente, mas não armam ação temporal.

## 9. IDs reais

- `plasma` — Rifle de Plasma;
- `shotgun` — Escopeta Magnética;
- `rail` — Canhão de Trilho;
- `sniper` — Perfurador de Vácuo.

Os nomes de display não são usados como identidade lógica.

## 10. Source contract

`TEMPORAL_ACTION_SOURCES` define:

- `player`;
- `echo`;
- `temporalReplay`;
- `proc`;
- `environment`.

O contrato é mínimo e não refatora o pipeline de dano. `fireWeaponFrom` recebeu um quinto argumento opcional, `actionSource`. Somente a chamada primária do jogador informa `player`.

A chamada secundária de `doubleTap` informa `proc`. Echos não informam origem `player`. Um replay futuro deverá informar `temporalReplay`.

## 11. Captura

`temporalActionCapture(src, def, team, mul, source)` é chamado no começo de `fireWeaponFrom`, antes do comportamento normal do disparo.

Elegibilidade exige simultaneamente:

- source explícito `player`;
- `src === player`;
- team `ally`;
- arma na whitelist;
- arma não melee;
- arma não beam.

Rejeições são O(1), não alocam uma ação e não alteram o disparo.

## 12. Payload

O payload contém:

- dano pré-crit já calculado no instante da captura;
- quantidade de projéteis, limitada a oito;
- velocidade de projétil com o multiplicador atual;
- alcance atual;
- spread;
- raio do projétil.

Tudo é escalar, finito e serializável.

## 13. Política de dano futura

O payload captura `def.dmg * mul` antes do sorteio de crit. Assim o PR15.7-B poderá:

- aplicar coeficiente temporal próprio;
- não recalcular a build futura;
- não herdar upgrades adquiridos depois;
- não repetir o crit original;
- construir projéteis simplificados sem fingir que o replay é o jogador.

Nenhum coeficiente ou dano temporal foi implementado neste bloco.

## 14. Guards

- origem precisa ser explícita;
- `src` precisa ser o player vivo da run;
- whitelist é fechada;
- melee e beam são recusados;
- Echo é recusado;
- proc é recusado;
- `temporalReplay` é recusado;
- substituição não executa a ação antiga;
- expiração não executa ação.

## 15. Antirrecursão

A captura não chama `fireWeaponFrom`, não cria projéteis e não chama a si própria. O replay futuro entrará com source `temporalReplay`, que falha no gate antes de qualquer captura.

O disparo secundário de Prisma Fraturado (`doubleTap`) é marcado como `proc`, impedindo que uma chamada interna substitua a ação primária.

## 16. Expiração

`TEMPORAL_ACTION_WINDOW = 5`.

`temporalActionTick(runTime)` realiza uma comparação O(1). Ao atingir `expiresAt`:

1. marca o objeto como `expired`;
2. remove a referência global;
3. incrementa telemetria de expiração;
4. não cria entidade, dano, projétil ou efeito.

## 17. Substituição

Uma nova ação elegível substitui a ação `armed` anterior. O ID monotônico aumenta e `replaced` é incrementado. A ação substituída nunca é executada.

## 18. Cleanup

A ação é limpa em:

- `resetRunWorld`;
- `clearRunEntities`;
- `onPlayerDeath`;
- `onVictory`;
- `spawnWave`;
- expiração natural.

Nova run e Continue passam por `resetRunWorld`, portanto reiniciam também sequência e telemetria.

## 19. Checkpoint

`temporalAction` não faz parte de `smBuildCheckpoint` nem de qualquer pack/unpack. Um checkpoint criado enquanto há ação armada não contém a ação.

## 20. Sandbox/DEV

`DEV.temporalActionState()` oferece inspeção somente quando `DEV_MODE` ou `sandboxRun` está ativo. Retorna:

- active;
- id;
- weaponId;
- state;
- age;
- expiresIn;
- cópia da telemetria.

Não existe botão de replay, painel novo ou controle novo.

## 21. Telemetria

Contadores run-scoped:

- `recorded`;
- `replaced`;
- `expired`;
- `rejected`;
- `lastWeaponId`.

Não existe histórico. Contadores numéricos são saturados em `TEMPORAL_ACTION_TELEMETRY_MAX`.

## 22. Performance

- elegibilidade O(1);
- uma referência ativa;
- uma alocação somente em captura aceita;
- nenhuma alocação no tick de expiração;
- nenhum loop novo sobre inimigos, projéteis ou armas;
- nenhum array histórico;
- nenhum Canvas, path, blur, partícula ou entidade;
- payload com sete escalares após a extensão bounded de `pierce` no PR15.7-B;
- inspeção aloca cópia apenas sob chamada explícita.

## 23. Testes

Suíte dedicada:

```text
tests/pr15-7-a-temporal-action-foundation.test.js
```

Contém 52 verificações declaradas cobrindo whitelist, integração real em `fireWeaponFrom`, source contract, payload, substituição, sequência, expiração, cleanup, checkpoint, Continue e isolamento da captura. Input e replay foram adicionados posteriormente pelo PR15.7-B sem entrar no caminho de captura.

## 24. Regressão

A validação obrigatória é feita com `npm test`. A suíte nova é descoberta automaticamente por `tests/run-all.js`.

## 25. Limitações

- apenas quatro armas são capturáveis;
- não há melee, dash ou especial temporal;
- não há suporte a beam, DoT, mine, chain, homing ou armas persistentes;
- não há consumo `consumed` em gameplay;
- não há persistência em checkpoint;
- não há feedback ao jogador normal.

## 26. O que NÃO foi implementado

- input R, botão do meio ou R3;
- replay ofensivo;
- dano temporal;
- marcador visual;
- cooldown jogável;
- HUD final;
- Fracture Director;
- PR16/PR17;
- moralidade, facções ou contratos;
- Echos;
- rewind;
- alteração de balanceamento;
- PR15.5-E.

## 27. Contrato para PR15.7-B

O PR15.7-B poderá consumir somente uma ação `armed`, marcá-la como `consumed` antes de emitir qualquer efeito e criar um source separado `temporalReplay`.

O replay deverá usar o payload capturado, aplicar coeficiente temporal próprio e permanecer sem crit, item hooks, status, lifesteal, Ressonância ou recaptura. O primeiro protótipo deve continuar limitado aos quatro IDs da whitelist e ao cap de oito projéteis temporais.

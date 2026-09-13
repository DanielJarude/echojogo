# PR15.7-C — Polimento Reativo Temporal

## Objetivo

Fazer a timeline reconhecer sensorialmente uma ativação válida da Repetição Ancorada sem criar mecânica nova. O C permanece deliberadamente mínimo: uma assinatura sonora exclusiva e uma resposta visual efêmera da Presença Temporal já materializada.

## Decisão de escopo

A Repetição já captura, arma, reexecuta, causa dano, mata, concede recompensas universais, comunica cooldown na HUD e limpa corretamente. Por isso este PR não adiciona poder, progressão, recurso, input, entidade ou persistência.

## SFX da Repetição

`AudioManager.temporalReplay()` sintetiza a assinatura no Web Audio existente:

- ataque agudo curto;
- segunda camada levemente defasada e descendente;
- textura curta de ruído filtrado;
- nenhuma mídia externa.

O método reutiliza `tone()` e `noise()`. Assim, mute, contexto suspenso e budgets de vozes continuam sendo respeitados pelos gates centrais do `AudioManager`.

O SFX é chamado uma vez em `temporalReplayTry()`, somente depois de todos os gates, do consumo da ação, do início do cooldown, da telemetria `used` e da criação confirmada dos projéteis. Não toca em captura, substituição, expiração, tentativa inválida, projétil, hit ou kill.

## Reação da Physical Temporal Presence

`pr15PresOnTemporalReplay()` pertence semanticamente ao bloco B3 da Presença Temporal. A Repetição apenas envia uma notificação pontual após a ativação válida.

- sem `pr15Presence`: retorna `false`, sem efeito;
- com presença: arma `replayReactT` por `0,36s`;
- nenhum scan, distância ou colisão;
- nenhum acesso a memória histórica.

`pr15PresUpdate()` reduz o escalar até zero. `pr15PresDraw()` usa esse valor para desenhar dois arcos curtos ciano/magenta em separação cromática. Quando a intenção B4 e sua âncora já existem, `pr15IntentDraw()` reutiliza o mesmo escalar para pulsar a âncora. Nenhuma âncora é criada para reagir.

## Ponto de integração

Fluxo único:

```text
temporalReplayTry() válido
→ ação consumida
→ cooldown/telemetria confirmados
→ replayTemporalAction()
→ AUDIO.temporalReplay()
→ pr15PresOnTemporalReplay()
→ FX normal da Repetição
```

Uma ativação válida produz uma chamada sonora e uma notificação visual. Tentativas inválidas retornam antes desse ponto.

## Ausência de mudança mecânica

Permanecem inalterados:

- janela de captura: `5s`;
- cooldown: `6s`;
- dano: `0.50`;
- whitelist: plasma, shotgun, rail e sniper;
- máximo de oito projéteis;
- spread determinístico do shotgun;
- pierce limitado do rail;
- `crit:false`, `aoe:0`, `owner:null`, `def:null`;
- ausência de proc, `itemEmit` e Ressonância;
- kills e recompensas universais.

## Sistemas deliberadamente não integrados

### Fracture Director

Não foi alterado. Não existe `TEMPORAL_REPLAY_USED`, escrita em `fractureRun`, mudança de intensidade, estágio, tema ou composição.

### Memory Director

Não foi alterado nem consultado. A Repetição não lê `echoQueue`, `memoryId`, N-1/N-2 ou descriptors. A reação só ocorre se outro sistema já materializou uma Presença.

### Echo

Não foi alterado. Echo não fala, captura, ativa, duplica, recebe bônus, confiança ou Ressonância.

## Persistência e cleanup

`replayReactT` não é incluído em `pr15PresPack()`, `pr15IntentPack()` ou qualquer checkpoint. Um Continue reconstrói a presença com o valor inicial `0`.

O valor:

- desaparece naturalmente em `0,36s`;
- pertence ao objeto singleton da Presença;
- é descartado junto com `pr15Presence` em morte, vitória, menu, abort, troca de contexto ou fim de lifecycle;
- não cria timer assíncrono, callback ou referência órfã.

## Performance

- O(1) por ativação;
- um escalar efêmero;
- no-op O(1) sem Presença;
- renderer e update já existentes;
- sem array, entidade, scan global, scan espacial ou loop por projétil;
- sem partículas contínuas, blur ou filtro Canvas;
- áudio pontual sujeito aos budgets existentes.

## Testes

A suíte `tests/pr15-7-c-temporal-reactive-polish.test.js` cobre 40 checks, incluindo:

- invariantes mecânicos;
- chamada única do SFX;
- ausência de SFX em caminhos inválidos;
- no-op sem Presença;
- reação com Presença;
- imutabilidade de posição, lifecycle, identidade, intenção e budgets;
- ausência no checkpoint;
- decaimento e cleanup;
- ausência de alteração no Fracture Director, Memory Director, Echo, itens, procs e Ressonância;
- funcionamento sem histórico;
- cap e contrato dos projéteis.

## Limitações

A qualidade final do timbre, volume e leitura dos arcos precisa de replaytest humano em Electron. Os testes automatizados garantem o ponto e a quantidade das chamadas, não a percepção subjetiva do mix ou do efeito visual em combate real.

## Adiado para PR15.7-D

- revisão cromática dos projéteis temporais;
- qualquer refinamento visual adicional da Repetição;
- ajustes que dependam de replaytest humano.

Continuam fora de escopo: evento no Fracture Director, fala/reação de Echo, integração direta com memória, colisão com fraturas, resíduos, buffs, combos, upgrades, moeda, barra, rewind, slow motion e persistência.

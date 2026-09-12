# PR15.7-B — Protótipo Jogável da Repetição Ancorada

## 1. Base

Implementado sobre `a7e96562614555c1e585987427e9db73263c62f5` (`a7e9656`), reutilizando integralmente o estado, captura, whitelist, lifecycle e source contract do PR15.7-A.

## 2. Hipótese

Uma ação ranged recente permanece ancorada no ponto antigo. O jogador pode se reposicionar, esperar o mundo mudar e ativar manualmente o disparo passado. A utilidade pretendida é espacial — fogo cruzado entre passado e presente — e não um disparo duplo imediato automático.

## 3. Input

- Teclado: `R`, somente na borda e sem repetição automática.
- Gamepad padrão: `R3`, botão 11 da Gamepad API.
- Mouse: botão do meio não foi implementado para evitar adicionar um terceiro caminho sem necessidade ao protótipo.
- `Ctrl+R` continua reservado e bloqueado pelo isolamento desktop; não ativa replay.

## 4. Lifecycle

```text
armed
→ input manual
→ validação
→ consumed
→ referência ativa removida
→ cooldown iniciado
→ dispatcher
→ projéteis temporalReplay
→ colisão/dano/consequência real
```

A ação é consumida e removida antes do dispatcher. Assim erro, reentrada ou evolução futura não permite uso duplo.

## 5. Replay dispatcher

`replayTemporalAction(action)` é um dispatcher fechado para quatro IDs. Não chama `fireWeaponFrom`, `onProjectileHit` ou captura. Usa somente posição, direção, `weaponId` e payload sanitizado da ação.

## 6. Source

Projéteis possuem:

```js
source: 'temporalReplay'
temporalReplay: true
owner: null
def: null
crit: false
```

`damageEnemy` recebe explicitamente `damageSource: 'temporalReplay'`. Isso isola Ressonância, lifesteal e hooks do jogador sem refatorar todas as demais fontes.

## 7. Dano

`TEMPORAL_REPLAY_DAMAGE = 0.50`.

O dispatcher usa `payload.damage * 0.50`. Não chama `calcDamageMul`, não lê dano atual, crit atual, item state, upgrades ou modificadores adquiridos depois da captura.

## 8. Whitelist

A mesma lookup O(1) do A permanece fechada:

- `plasma`;
- `shotgun`;
- `rail`;
- `sniper`.

Beam, mine, melee e demais armas não armam nem entram no dispatcher.

## 9. Plasma

Cria um projétil temporal simples na posição original, direção original, velocidade e range capturados, com metade do dano capturado.

## 10. Shotgun

Recria deterministicamente o leque usando `projectileCount` e `spread` capturados. Não consulta multishot atual. O cap rígido limita o leque a oito projéteis.

## 11. Rail

Cria um projétil na direção original com perfuração capturada e limitada. A travessia não consulta Lente de Fase e não aumenta dano, evitando que a build atual contamine o snapshot.

## 12. Sniper

Cria um projétil simples com velocidade, alcance e dano temporal capturados. Não aplica crit nem bônus de longa distância atual porque `owner` e `def` são nulos.

## 13. Caps

- uma ação armazenada;
- uma ativação lógica por cooldown;
- no máximo oito projéteis por ativação;
- pierce capturado limitado a quatro;
- nenhuma fila ou histórico temporal;
- nenhum timer ou callback pendente de spawn.

## 14. Cooldown

`TEMPORAL_REPLAY_COOLDOWN = 6` segundos.

É independente de arma, dash, especial, build, kill e economia. Decrementa somente durante gameplay ativo pelo `dt` da run. Uma ação nova pode ser capturada durante cooldown e pode expirar normalmente.

## 15. Marker

`drawTemporalActionMarker()` desenha apenas um anel parcial e um traço na posição capturada. Não percorre inimigos, não cria entidade, não usa blur, gradiente, canvas copy ou partículas persistentes.

## 16. Direção e expiração visual

O traço usa `cos(action.angle)` e `sin(action.angle)`, deixando explícita a direção antiga. O arco restante diminui conforme `(expiresAt - runTime) / 5`, sem cronômetro flutuante.

## 17. HUD

Um indicador compacto foi colocado junto às habilidades existentes:

- `REPETIÇÃO [R]`;
- `REPETIÇÃO ARMADA [R]`;
- `REPETIÇÃO Ns` durante cooldown.

A faixa fina mostra janela restante quando armada ou recuperação do cooldown. Não foi criada barra de recurso expansiva.

## 18. Feedback

Na ativação são emitidos um ring pequeno, cinco partículas curtas, pulso Canvas breve e rumble discreto. Não há explosão, blur contínuo ou efeito persistente.

## 19. Telemetria

A telemetria run-scoped e saturada foi ampliada com:

- `used`;
- `invalidUse`;
- `hits`;
- `kills`;
- `misses`;
- `lastUsedWeaponId`;
- `maxTemporalProjectilesSeen`.

Não existe array histórico.

## 20. Phantom

O gate corrigido no PR15.6-A-FIX continua antes da colisão. Phantom em `ghostT > 0` não recebe dano, não incrementa hit e não consome falsamente o projétil temporal.

## 21. Elite Shield

O replay usa o pipeline normal de `damageEnemy`, portanto o shield Elite absorve dano antes do HP. A redução temporal não ignora nem recebe bônus contra shield.

## 22. Boss e miniboss

Recebem dano pelo pipeline normal, inclusive estados defensivos próprios já existentes. O replay não recebe exceção ofensiva, crit, status, proc ou Ressonância.

## 23. Kill, loot e XP

Uma morte temporal chama `killEnemy` normalmente: o inimigo morre, entra na conclusão da wave e gera recompensas universais, XP e loot existentes.

O `damageSource` temporal exclui o bloco de procs de kill do operador: `onKill`, killDash, curas por kill, presas e harvest não classificam esse abate como direto do jogador. O contador global de abates e as recompensas universais permanecem reais.

## 24. Echos e sistemas narrativos

Echos não capturam, ativam, recebem ou aprendem a mecânica. Projéteis temporais têm `owner: null`, portanto não entram na contenção de Echo hostil. Não foram adicionadas falas, confiança, personalidade, relação, facção, moralidade ou integração ao Fracture Director.

## 25. Wave, morte e reset

Na troca de wave, a ação é limpa e o cooldown é mantido, evitando levar uma âncora entre arenas sem oferecer reset grátis do uso.

Morte, vitória, nova run, Continue e menu usam `temporalReplayReset`: removem ação, feedback e cooldown. Não existem spawns futuros agendados. Projéteis seguem o cleanup global normal da run.

## 26. Checkpoint, performance e riscos

Ação e cooldown não são serializados. Continue começa sem ação e com cooldown zerado.

O hot path adiciona duas comparações/decrementos e um marker único. As alocações acontecem somente na ativação, limitadas a oito projéteis. Inspeção DEV pode contar projéteis com `reduce`, mas somente quando chamada explicitamente.

Riscos para replaytest: legibilidade do marker em arenas muito densas, sensação do cooldown de seis segundos, valor espacial do Rail e potência percebida do Shotgun. Esses valores não devem ser balanceados antes do teste humano.

## 27. Testes e critérios do replaytest humano

A suíte `tests/pr15-7-b-anchored-replay-prototype.test.js` cobre 80 casos: input, consumo, dispatcher, armas, snapshot, dano, hooks, kills, cooldown, marker, caps, Phantom, Elite, boss, miniboss, Echos, cleanup, Continue e regressões.

Replaytest humano necessário:

1. disparar uma arma elegível;
2. observar posição e direção do marker;
3. mover o operador para longe;
4. esperar inimigos mudarem de posição;
5. pressionar R e R3 em tentativas separadas;
6. confirmar que o disparo nasce na âncora antiga;
7. avaliar se há decisão espacial real, e não incentivo dominante a apertar R imediatamente;
8. validar legibilidade, áudio/rumble e sensação do cooldown em jogo real.

# PR14 · B3 — Primeira Presença Física na Arena

> **Versão do jogo:** 0.8.0-alpha · **SM_VERSION:** 3 · **FRACTURE_STATE_VERSION:** 1
> **Bloco anterior:** B2 (Fundação da Presença de Facção) — ver `PR14_B2_FACTION_PRESENCE_FOUNDATION.md`
> **Suíte de testes:** `tests/pr14-b3-faction-presence-physical.test.js` (34 casos + stress)

---

## 1. Objetivo e escopo

O B3 dá **corpo físico** à intenção de presença que o B2 apenas agendava em
memória. Pela primeira vez uma facção **aparece na arena** como uma entidade
world-space efêmera com a qual o jogador pode interagir por proximidade.

O escopo é deliberadamente **estreito**: apenas **duas** facções ganham
manifestação física neste bloco — **ÂNCORA** (⬡) e **CONSÓRCIO** (◈). Elas têm
identidades opostas e complementares (uma estabiliza/protege, a outra oferece
recurso/oportunidade), o que basta para **provar a arquitetura** visual e
mecânica sem construir o gameplay completo das quatro facções. REMANESCENTES
(◉) e DESVIADOS (◬) ficam intencionalmente para o **B4**.

O bloco **não** introduz combate de facção, unidades hostis, aliados
permanentes, novas moedas, contratos, missões, mudança de personalidade do
Echo ou qualquer alteração de dificuldade. É uma prova de conceito
conservadora e reversível.

## 2. Relação com o B2 (o que é reusado, o que é novo)

O B3 **não** cria um agendador paralelo. Ele consome exatamente a intenção
agendada pelo B2:

- `factionPresenceRun.scheduled` — a intenção que o Diretor plantou no B2.
- `factionPresenceActivate(p)` / `factionPresenceResolve()` / `factionPresenceExpire()` — o ciclo de vida lógico do B2 continua sendo a fonte da verdade.
- `fpDeterministicSeed(w)` / `fractureRng(seed)` — a mesma cadeia determinística do Diretor (**nunca** `Math.random`).
- `canUseBeaconForFactionPresence()` — consulta de coexistência com o beacon.
- `factionPresencePack()` / `factionPresenceUnpack()` — serialização em `cp.presence` para Save/Continue.

**Novo no B3:** apenas a camada *física* — a entidade world-space, sua posição,
desenho, interação por proximidade e efeitos. A facção **nunca é recalculada**
aqui: a entidade herda a facção já decidida na intenção agendada.

## 3. Arquitetura: entidade separada, não um beacon-array

Decisão central de arquitetura (auditoria B3-A): a presença física é uma
**entidade singleton separada** (`factionPresenceEntity`), e **não** uma
transformação do beacon legado em array.

Motivos:
- O beacon é um singleton com semântica própria (12 `FACTION_RUN_EVENTS` + 4 `FRAC_CONTACT_EVENTS` dependem dele). Transformá-lo em array causaria regressão ampla — proibido pelas restrições.
- Manter a entidade separada garante **coexistência real**: beacon e presença podem existir na mesma janela sem que um substitua o outro.
- O bloco é **autocontido** entre os marcadores `PR14·bloco fp2.js` … `PR14·fim fp2.js`, integrado por **monkey-patch no boot** (mesmo padrão de `fractureKitBoot`/`factionPresenceKitBoot`), o que o torna fácil de auditar e remover.

## 4. O contrato da entidade física

`factionPresenceEntity` (ou `null`) é o singleton. Campos:

| campo        | tipo    | significado |
|--------------|---------|-------------|
| `presenceId` | int     | id serial herdado da intenção (liga entidade ↔ presença lógica) |
| `faction`    | string  | `'anchor'` ou `'consortium'` (sempre física) |
| `kind`       | string  | rótulo da manifestação (herdado da presença) |
| `x`, `y`     | number  | posição world-space determinística |
| `r`          | number  | raio visual (`FACTION_PRESENCE_ENTITY_R = 30`) |
| `interactR`  | number  | raio de interação (`FACTION_PRESENCE_INTERACT_R = 58`, somado a `player.r`) |
| `ttl`,`ttlMax`| number | vida restante / vida total (`FACTION_PRESENCE_TTL = 32`s) |
| `state`      | string  | estado visual (`active` → `resolved`/`expired`) |
| `beacon`     | bool    | se reservou o slot de beacon (falso quando o beacon já está ocupado) |
| `pulse`      | number  | fase do pulso visual |
| `consumed`   | bool    | trava one-shot da recompensa |

A entidade **não tem** flag de colisão sólida (`solid`): ela nunca bloqueia o
movimento; a interação é puramente por raio.

## 5. Elegibilidade física (só 2 facções)

```
FACTION_PRESENCE_PHYSICAL = ['anchor', 'consortium']
fpIsPhysical(id) → true só para essas duas
```

`factionPresenceSpawnFromScheduled()` **recusa** silenciosamente qualquer
intenção agendada cuja facção não seja física (REMANESCENTES/DESVIADOS): a
presença lógica pode até ser ativada pelo B2, mas nenhuma entidade é
materializada — isso fica para o B4. O teste 18b cobre esse caso.

## 6. Spawn seguro e determinístico

`fpEntityPos(p)` calcula a posição sem jamais usar `Math.random`:

1. Deriva uma semente estável de `fpDeterministicSeed((wave*131 + id))` e cria um RNG com `fractureRng(seed)`.
2. Sorteia um ponto dentro da arena respeitando uma **margem** (`FACTION_PRESENCE_MARGIN = 150`) — nunca fora da arena.
3. Rejeita e re-sorteia (até 8 tentativas) se o ponto ficar perto demais do **player** (`MIN_PLAYER_DIST = 300`) ou do **beacon** (`MIN_BEACON_DIST = 170`).
4. Faz `clamp` final para garantir que o resultado permanece dentro dos limites da arena mesmo no pior caso.

Como o RNG deriva da seed do Diretor, a **mesma seed produz sempre a mesma
posição** (testes 3 e 4) — essencial para reprodutibilidade e para o Continue.

## 7. Coexistência com o beacon legado (B3-D)

- A presença **nunca destrói** um beacon existente (teste 7).
- Se o beacon está vivo/ocupado, `canUseBeaconForFactionPresence()` retorna falso; a entidade é criada mesmo assim, mas com `beacon:false` (não reserva o slot) e **posicionada longe** do beacon (teste 8).
- Um evento antigo (survivor/vault/etc.) e uma presença física podem coexistir na mesma janela sem que nenhum perca seu ciclo — a arquitetura separada garante isso.

## 8. Identidade visual (B3-E)

`FACTION_PRESENCE_LABEL` fixa a identidade de cada facção física — distinção
que vai **além da cor** (símbolo + forma + nome + pulso):

| facção      | símbolo | forma desenhada | cor       | nome |
|-------------|---------|-----------------|-----------|------|
| `anchor`    | ⬡       | **hexágono**    | `#8fd6ff` | NÓ DE CONTENÇÃO |
| `consortium`| ◈       | **losango**     | `#ffd166` | CACHE TEMPORAL |

As cores batem exatamente com `FRACTIONS`/`FRACTION_BY_ID` (teste 20). O desenho
tem pulso senoidal e um *fade* proporcional ao TTL restante para telegrafar a
expiração.

## 9. Efeito da ÂNCORA (B3-F)

Ao interagir com a presença da ÂNCORA:

- Restaura **escudo** ao jogador: `round(player.shieldMax * FACTION_PRESENCE_ANCHOR_SHIELD)` com `ANCHOR_SHIELD = 0.5` (metade do máximo).
- **Nunca** excede `player.shieldMax` e **nunca** toca em `player.hp` (teste 31).
- É um **único** benefício, defensivo, com limite claro (teto do escudo) e **sem buff permanente**: some quando o escudo é gasto, como qualquer escudo.

Coerente com a identidade da ÂNCORA (estabilizar/proteger) sem virar cura nem
poder de facção plena.

## 10. Efeito do CONSÓRCIO (B3-G)

Ao interagir com a presença do CONSÓRCIO:

- Concede um pequeno lote de **Resíduos Temporais** (⧗) via `addResidues(FACTION_PRESENCE_CONSORTIUM_RES, 'faction_presence', x, y)` com `CONSORTIUM_RES = 4` (teste 32).
- Usa o **recurso ⧗ já existente** — **sem** nova moeda, contrato ou terminal de troca (teste 33).

Coerente com a identidade do CONSÓRCIO (recurso/oportunidade), conservador e
one-shot.

## 11. Interação por proximidade (B3-H/B3-J)

- `factionPresenceUpdateEntity(dt)` roda **só** quando há entidade (early-return caso contrário — teste 22) e apenas em `state==='play'` (engatado em `updateAllies`).
- Quando `dist2(entidade, player) < (interactR + player.r)²`, dispara `factionPresenceInteract()` **uma vez**.
- A interação: aplica o efeito da facção, chama `factionPresenceResolve('interact')` (fecha o ciclo lógico do B2) e **remove a entidade** (`factionPresenceEntity = null`).
- **One-shot garantido:** removida a entidade, uma segunda passagem não concede nada (testes 9 e 15). Sem farm, sem reentrada.

## 12. Consulta de afinidade (B3-I) — só leitura

`fpEntityAffinityLabel(faction)` pode **consultar** `getFactionState(faction)`
para dar uma nuance leve no feedback textual. Mas:

- **Nenhuma** interação concede ou remove afinidade automaticamente (teste 27 — `fracRun.aff` fica intacto).
- Estados plenos **Hostil**/**Aliada** (presença que ataca, ou grande benefício de aliada) ficam para o **B5**. Nenhuma presença ataca; nenhum benefício grande de aliada existe aqui.

## 13. Ciclo de vida e limpeza (B3-S/B3-O)

- **Cap = 1** físico: `factionPresenceBuildEntity`/`SpawnFromScheduled` recusam uma segunda entidade enquanto uma existir (teste 6).
- **Expiração por TTL:** `updateEntity` decrementa `ttl`; ao chegar a zero chama `factionPresenceExpire('ttl')` e limpa a entidade (teste 10).
- **`factionPresenceEntityClear()`** é idempotente e é chamado em todos os fins de contexto: morte do jogador, vitória, retorno ao menu, troca de slot, limpeza de save (testes 11/12/13).
- Não há timer órfão: toda a contagem é feita no `updateEntity`, atrelada ao loop de jogo.

## 14. Save / Continue (B3-T)

- **SM_VERSION permanece 3** e **FRACTURE_STATE_VERSION permanece 1** — **sem migração** (teste 29).
- A presença ativa é serializada em `cp.presence` via `factionPresencePack()` do B2. A **entidade física em si não é persistida** — ela é **reconstruída** no Continue.
- `factionPresenceRebuildEntity()` recria a entidade a partir da presença ativa restaurada, **na mesma posição** (determinística), **sem reconceder** a recompensa (teste 14) e **sem trocar** facção ou posição (teste 35).
- Uma presença **já resolvida** não é reemitida no Continue (o `active` já é nulo).

Hook: `resumeRun` faz `factionPresenceEntityClear()` seguido de
`factionPresenceRebuildEntity()`.

## 15. Integração por boot (monkey-patch)

`factionPresencePhysicalKitBoot()` (idempotente via `.done`) é chamado **logo
após** `factionPresenceKitBoot()`. Ele encapsula funções existentes preservando
o comportamento original (padrão try/catch em todas as chamadas para o kit):

| função original      | hook adicionado |
|----------------------|-----------------|
| `spawnWave(n)`       | tenta `factionPresenceSpawnFromScheduled()` (bloqueado em `smRestoring`/`sandboxRun`) |
| `updateAllies(dt)`   | `factionPresenceUpdateEntity(dt)` |
| `drawWorldExtras()`  | `factionPresenceDrawEntity()` |
| `startRun`, `onPlayerDeath`, `onVictory`, `showVictory`, `activateSlot`, `smClearSlotSave` | `factionPresenceEntityClear()` |
| `resumeRun`          | `Clear()` + `RebuildEntity()` |
| `sandboxStart/Restart/EndToSetup/Exit` | `factionPresenceEntityClear()` |
| `devCommand(c)`      | roteia `fp:*` para `factionPresencePhysDevCommand` |
| `devRender()`        | injeta `factionPresencePhysDevSection` |

A ordem importa: o hook de `spawnWave` do B2 **agenda** a intenção; o hook do B3
**ativa** em seguida.

## 16. Sandbox isolado (B3-U)

- O spawn físico é **bloqueado** quando `sandboxRun` está ativo no hook de `spawnWave`.
- Sem uma run de presença viva, `factionPresenceSpawnFromScheduled()` retorna `null` e nada é materializado (teste 16).
- Todos os hooks de sandbox (`sandboxStart/Restart/EndToSetup/Exit`) limpam a entidade, garantindo que nada vaza entre sandbox e run real.

## 17. DEV helpers (B3-X)

Disponíveis **apenas** em DEV MODE (`DEV_MODE`):

- `DEV.forceFactionPresence('anchor'|'consortium')` → `factionPresenceDevForce(faction)`: materializa uma presença física da facção pedida **respeitando o cap** e apenas se for facção física. **Não persiste**, **não altera afinidade** nem meta-progresso.
- `factionPresencePhysDevSection()` — painel de inspeção read-only no overlay DEV.
- `factionPresencePhysDevCommand('fp:...')` — comandos textuais de DEV.

Fora de DEV MODE, todos são no-ops.

## 18. O que este bloco **NÃO** faz (anti-escopo)

- ❌ Não implementa REMANESCENTES/DESVIADOS físicos (B4).
- ❌ Não cria unidade hostil, `enemies[]`, projétil ou tiro (teste 26).
- ❌ Não adiciona aliado permanente; não cria nova entrada em `allies[]` sem cleanup dedicado.
- ❌ Não altera Tema da Fratura, Intensidade, composição de onda ou budget (testes 23/24/25). **FACÇÃO ≠ FRACTURE THEME**.
- ❌ Não concede/remove afinidade automaticamente (teste 27).
- ❌ Não introduz nova moeda, contrato, missão, loja, moralidade, boss/miniboss, HUD persistente de facção ou dificuldade adaptativa.
- ❌ Não altera personalidade/confiança/vínculo do Echo, Guardian/Disruptor ou equipamento.
- ❌ Não introduz reação nova do Echo (B4).
- ❌ Não usa `Math.random` (verificado por string no fonte).

## 19. Testes e verificação

**Suíte nova:** `tests/pr14-b3-faction-presence-physical.test.js` — **34
casos** cobrindo os 35 pontos do prompt (alguns agrupados) + stress:

- Ativação a partir da intenção agendada; contrato da entidade; determinismo de posição; posição sempre válida e nunca sobre o player; cap = 1.
- Coexistência com o beacon (não destrói / não reserva o ocupado).
- Resolve por interação; expira por TTL; `entityClear` idempotente.
- Continue reconstrói sem duplicar recompensa; interação one-shot.
- Sandbox inócuo; elegibilidade física (ÂNCORA/CONSÓRCIO sim, REMANESCENTES/DESVIADOS não).
- Símbolos ⬡/◈, cores batendo com `FRACTIONS`, draw read-only, update early-return.
- Tema/Intensidade/composição imutáveis; enemies intocado; afinidade só lida.
- 16 eventos antigos intactos; SM=3; FRACTURE_STATE_VERSION=1; versão 0.8.0-alpha.
- Efeitos ÂNCORA (escudo, nunca HP) e CONSÓRCIO (⧗ conservador); sem nova moeda; sem colisão sólida; Save/Continue preserva presença.
- **STRESS:** 200 seeds × ondas 2–20 — invariantes preservadas (dentro da arena, sem NaN, só facção física, cap = 1, sem *ghost* após expirar, Tema imutável, zero inimigos criados).

**Integração:** a suíte foi adicionada ao script `test` do `package.json`
(**28 → 29 suítes**) e o meta-teste em `tests/fracture-director.test.js` foi
atualizado (contagem 28 → 29 e verificação da presença da nova suíte).

**Resultado:** `npm test` sai com **exit 0**; a suíte B3 reporta
**34 passaram · 0 falharam**.

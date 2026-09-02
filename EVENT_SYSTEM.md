# EVENT SYSTEM — PR 10.5 (Event Director leve)

> Documentação da camada de acontecimentos de run introduzida na PR 10.5
> (`feat: expand run events and reform dynamic endings`).
> Identificadores em inglês, prosa em pt-BR, conforme convenção do repositório.

---

## 1. Objetivo e escopo

A PR 10.5 aumenta a **variedade de acontecimentos por run** sem reescrever o jogo:

- **Diretor leve de eventos**: seleção por elegibilidade + peso (não é um "director"
  completo de sessão — isso é a PR 13 futura, fora de escopo);
- **Memória de run compacta** com anti-repetição por evento e por família;
- **Famílias temáticas** (exploração, sobreviventes, recursos, anomalias, ambiente,
  echo, moral, memória, ruptura, raro, risco);
- **Raridade** em 4 níveis: `common`, `uncommon`, `rare`, `anomalous`;
- **Chains** com consequências atrasadas entre ondas;
- **Eventos de arena** (temporários, com telegrafia e cleanup completo) e
  **microeventos** de fundo;
- Integração **real** com a Moralidade 2.0 (PR 9) e com o pipeline de reações de
  Echo (PR 10) — **nenhum segundo sistema** foi criado.

Fora de escopo (decisão explícita): Shield expansion, facções, Fracture Director
completo, Echo↔Echo, bosses adaptativos, novos operadores, dezenas de armas,
reescrita de combate, final canônico.

## 2. Inventário entregue

| Grupo | Quantidade | Observação |
|---|---|---|
| Eventos novos (pool principal) | **25** | 10 comuns · 7 incomuns · 5 raros · 3 anomalous |
| Eventos legados preservados | **20** | `lg_*`, com família atribuída via `EV_LEGACY_FAMILY` |
| Continuações de chain | **6** | fora do sorteio principal (`RUN_CHAIN_EVENTS`) |
| Índice total (`RUN_EVENT_BY_ID`) | **51** | |
| Eventos de arena | **5** | `ae_campo`, `ae_enxame`, `ae_cacada`, `ae_interf`, `ae_alvo` |
| Microeventos | **4** | `me_transmissao`, `me_interferencia`, `me_assinatura`, `me_pulso` |
| Chains | **6** | sinal→resposta · caravana→volta · posto→ferido · olho→cobrança · cobrador→volta · imitador→cinzas |
| Epílogos de acontecimento | **18** | ver `ENDING_SYSTEM.md` |

Metas de conteúdo (§ do pedido): 8–12 comuns ✓ (10) · 6–8 incomuns ✓ (7) ·
4–6 raros ✓ (5) · 2–3 anomalous ✓ (3) · 3–6 chains ✓ (6, uma acima do teto
sugerido, mantida por custo marginal baixo).

### Raridade — semântica

**RARO ≠ recompensa enorme.** Raros e anomalous entregam estranheza, lore e
escolhas peculiares (`x_procissao`, `x_olho`, `x_onda0`, `x_observador`,
`x_cicatriz`). `anomalous` tem `oncePerRun` e nunca é requisito de progressão.

## 3. Contrato de um evento

```js
{
  id:'x_posto', kind:'x_posto', nm:'POSTO MÉDICO SELADO', col:'#7dffc4',
  family:'recursos', rarity:'common', weight:44,
  cd:4,              // cooldown: bloqueado por N aparições de outros eventos
  minWave:1,         // onda mínima (motivo 'min_wave')
  // maxWave, echoReq:1|-1, relReq:['fractured','tense'], relReqOn:'worst'|'best'|'any',
  // reqFlag:'dis_houve', forbidFlag:'…', oncePerRun:true, cond(ctx){…}, aff:'comp',
  render(){…},       // usa evHead()/evOpt() no modal existente
  // onPick/efeitos ficam nos handlers das opções
}
```

Campos de bloqueio (todos reportam **motivo** legível no inspetor DEV):
`min_wave`, `max_wave`, `requires_echo`, `requires_no_echo`, `requires_relation`,
`requires_flag:*`, `forbid_flag:*`, `once_per_run`, `condicao_contexto`,
`cooldown_evento`, `familia_consecutiva`.

### Escolhas com custo real

Nenhum evento tem "botão compaixão/ganância/violência" óbvio. Toda opção
`evOpt` carrega um **vetor moral** `[comp,greed,viol]` **e um ganho + um custo**,
ex.: `x_posto` — CONSUMIR AGORA (+40 HP, +2 kits **vs** +1 greed, apaga o estoque
do próximo ciclo) · POUPAR (nenhum ganho imediato, +3 comp, Ecos anotam,
epílogo) · LEVAR E MINAR (+◈40, abre chain `x_feridoposto` **vs** +2 greed
+1 viol e um ferido na porta).

## 4. Contexto, elegibilidade e sorteio

```
buildEventContext()  → wave, hp, coins, echoCount, operator, moral(normalizado),
                       relBest/relWorst, disCount, dis*, recent, seen, lastEvent,
                       lastFamily, flags, chains, queued
eventBlockReason(d,ctx) → null | motivo
getEligibleEvents(ctx,opts) → {elig[], blocked[{id,family,rarity,reason}]}
                              opts.relaxFamily / opts.relaxAll (redes de segurança)
scoreEvent(d,ctx)    → peso efetivo
pickRunEvent(ctx,rng) → evento sorteado (rng injetável p/ simulação)
```

Pipeline do `pickRunEvent`:

1. **Fila de chains** (`evQueue`) tem prioridade — continuação forçada;
2. Passada estrita de elegibilidade;
3. Se nada sobrou → relaxa só `familia_consecutiva`;
4. Se nada sobrou → relaxa tudo menos `once_per_run`;
5. Último recurso → sorteio legado puro (`pickEventKind`) — **nunca trava**.

### Peso efetivo (`scoreEvent`) — sem pity óbvio

| Fator | Efeito |
|---|---|
| Fadiga de família | `w /= 1 + 0.30 × aparições_recentes_da_família` (janela 6) |
| Saturação do evento | `w *= 1/(1 + 0.07 × vezes_visto_na_run)` — decai devagar |
| Novidade leve | nunca visto nesta run → `w ×= 1.25` |
| Afinidade moral (PR 9) | `w ×= 1 + eventBias × perfil_normalizado[aff]` |
| Adaptação leve | créditos < 35 puxa `recursos` ×1.30; HP < 35% puxa `sobreviventes/recursos` ×1.22; com Eco vivo `echo` ×1.10; pós-ruptura `ruptura` ×1.35 |

**HP baixo NÃO garante evento de cura** — só inclina levemente duas famílias
(§56/§57: sem pity explícito; a surpresa permanece). Seleção só acontece no
spawn de beacon — **nada roda por frame**.

## 5. Memória de run (`evMem`)

```js
{ rc:[últimos 12 ids], sn:{id:vezes}, fc:{família:vezes}, lf, le, seenN,
  fl:{flag:1}, ch:{estado de chain}, ep:[epílogos, teto 8], dl:[atrasadas, teto 8],
  vars:{valores numéricos, teto de chave 40} }
```

- `evMemRecord(id,fam)` registra aparição (chamado só dentro do `pickRunEvent`);
- `evEpilogue(k)` promete epílogo para o final (teto 8, FIFO);
- `evDelay(off,id,arg,{chance})` agenda consequência em `wave+off`; o gate de
  **chance é aplicado no disparo** — chains podem simplesmente não acontecer
  (mistério, não bug);
- `evMemPack()/evMemRestore(p)` serializam de forma **sanitizada** (strings curtas,
  números finitos, recortes de janela). Save legado sem campo `ev` → memória vazia
  e sem erro. Checkpoint preserva histórico/chains/flags; slots são isolados.

## 6. Anti-repetição

Três camadas, da dura para a suave:

1. **Bloqueio duro** — `cooldown_evento` (por evento, janela `cd`) e
   `familia_consecutiva` (a família do último evento fica bloqueada inteira);
2. **Relaxamento garantido** — se o bloqueio esvaziar o pool, a família cede
   primeiro; o sistema nunca trava nem repete por falta de opção;
3. **Fadiga suave** — mesmo elegível, família repetida e evento repetido perdem
   peso gradualmente (tabela acima).

## 7. Integração com a run (pontos de contato)

| Ponto | Integração |
|---|---|
| `spawnBeacon` | a partir da 2ª aparição de beacon usa `pickRunEvent()`; as duas primeiras continuam legadas (onboarding) |
| `openEvent` | `RUN_EVENT_BY_KIND[kind]` novo → `d.render()` no modal existente; legados seguem o caminho antigo |
| `spawnWave` | `stopArenaEvent`+`waveBuffSweep`+`processDelayedEvents` no início; moldagem de onda (modos de eventos); `expireWave` de aliados; `tryStartArenaEvent` antes das MINI_WAVES (arena **nunca** em onda de mini-chefe) |
| loop principal | `tickArenaEvent` + `tickMicroEvents` só sob `play` e sem boss |
| `drawWorldExtras` | `arenaEv.def.draw` (telegrafia visual) |
| `killEnemy` | soma de bounties dos eventos (`hunterBounty`, `imitadorBounty`, `cobradorBounty`, `guardiaoBounty`, `cobrancaBounty`, `iscaBounty`, `prioBounty` com marca) ×1.5 com MARCA ACEITA |
| `updateProjectiles` | interferência (`ae_interf`): projéteis do jogador ×1.35 de dano recebido enquanto ativa |
| `regenPlayerShield` | buffs com prazo respeitam `shieldRegenMul` até a onda de validade |
| `relTick` | pacto do `x_pacto` reduz a decadência de pressão em 60% |
| Dissonância (PR 10) | `enterDissonance` registra `dis_houve`; reconciliação registra `dis_reconciliado` — eventos de `ruptura` consomem essas flags |
| Moralidade (PR 9) | `evOpt` → `moralGain` (vetor) → perfil normalizado → `scoreEvent` (aff) |
| Echo reactions (PR 10) | opções chamam `changeEchoTrust(e,Δ,motivo)` — pipeline único `moralGain → echoesReact → evaluateEchoReaction → applyEchoReaction → relFeedback → pickRelationLine` |

**Stats nunca são tocados direto**: buffs temporários entram por `waveBuff →
smMul` (id estável) com a validade guardada em `evMem.vars` e varridos por
`waveBuffSweep` — arena/microeventos não acumulam modificadores.

## 8. Arena e microeventos

- **Arena** (`tryStartArenaEvent/tickArenaEvent/stopArenaEvent`): 1 por vez,
  janela mínima entre elas, **telegrafia obrigatória** (banner + zonas/marcadores
  desenhados antes de qualquer dano), duração limitada e `stopArenaEvent`
  completo (timers, entidades, modificadores, visuais, flags). Recompensa:
  créditos via bounty (`ae_alvo` paga no abate do alvo marcado), nunca stats
  permanentes.
- **Microeventos** (`tickMicroEvents`): fundo de baixa intensidade (transmissão,
  interferência, assinatura, pulso) — não interrompem o estado da run, têm
  cleanup próprio e não empilham.

## 9. Runs sem Echo / com Echo / relação fraturada

- Runs **sem Echo** continuam interessantes: nenhum evento core exige Eco
  (`echoReq` é opcional); `x_duplo`, `x_memoria`, `x_imitador` ganham camadas
  extras com Eco;
- Echo presente **varia o flavor e a reação** (confiança sobe/desce pelas
  escolhas) — não existe uma versão completa por personalidade;
- Relação **fraturada** destrava conteúdo único: `x_confissao`
  (`relReq:['fractured','tense']` em `worst`) e epílogo próprio;
- Pós-reconciliação existe em pouca quantidade e usa `dis_reconciliado`
  — a Dissonância nunca é causada arbitrariamente por evento; ela flui
  pelo sistema da PR 10.

## 10. Dev tools

`DEV` API (todos leitura pura, exceto force/simulate que marcam `devTaint`):

| Método | O que faz |
|---|---|
| `DEV.eventInspector()` | contexto, elegíveis (peso/família/raridade), bloqueados com motivo, memória, flags, chains, fila, pool |
| `DEV.forceEvent(id)` | empurra o evento no próximo beacon (`evQueue.unshift`), mata o beacon atual e reagenda |
| `DEV.simulateEvents(n,seed)` | simula n seleções (padrão 600; ≤2000) com mulberry32 e **restaura a memória da run em `finally`**; retorna `perEvent/perFamily/sameFamilyConsecutive/maxSameFamilyStreak/avgRepeatDistance/neverDrawn` |
| `DEV.endingPreview()` | ver `ENDING_SYSTEM.md` |

Painel **EVENT DIRECTOR** no `devRender` (input de força, simulações 100/500/1000,
inspetor com top elegíveis e bloqueados com motivo). Comando `devCommand`:
`evforce`, `evinsp`, `evsim100/500/1000`. Qualquer uso de força/simulação marca a
run como `devTainted` (nunca gera save legítimo).

## 11. Testes

`tests/events.test.js` (54 asserções, blocos A–J): pool/registro, elegibilidade
com motivos, anti-repetição (cooldown/família/fadiga/saturação/novidade/adaptação),
sorteio determinístico com RNG injetado, chains e consequências atrasadas,
moralidade pelo caminho real (`evOpt → moralGain`), Echo reactions pelo pipeline
único (com auditoria estática anti-segundo-sistema), arena/micro (telegrafia,
detonação, cleanup, recompensa), save/slots/migração e distribuição
(determinismo, teto de dominação <22%, anomalous ≤ raro, streak ≤3, cobertura
dos comuns incondicionais, distância média de repetição).

Rodar: `npm test` (a suíte é a 10ª do pipeline).

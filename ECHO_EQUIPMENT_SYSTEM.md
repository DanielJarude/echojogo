# ECHO — Sistema de Echo Equipment (PR 12)

> Sistema run-scoped de equipamento para Ecos: três categorias, 43 itens,
> efeitos estáticos e dinâmicos, integração com Personality/Trust/
> Relationship/Dissonância, checkpoint/Continue fiel e isolamento no Sandbox.
> Arquivo-fonte: bloco `PR 12 — ECHO EQUIPMENT` em `index.html`.

---

## 1. Conceito

Ecos carregam **tecnologia recuperada do ciclo**: módulos que mudam como eles
lutam, sentem e reagem. Tudo é **run-scoped** — equipamento, inventário e
estado morrem com a run (morte/vitória). Nada disso é unlock permanente.

## 2. Categorias

| Cat | Chave | Papel | Exemplos de efeito |
|---|---|---|---|
| **Núcleo** | `eqNucleo` | atributos | stats diretos (`stats`) |
| **Protocolo** | `eqProto` | comportamento | prioridade de alvo/órbita (`beh`), stats leves |
| **Relíquia** | `eqRelic` | narrativa/efeitos | vínculo, Trust, Dissonância, efeitos especiais (`fx`) |

Cada Eco tem **um slot por categoria** (máx. 3 equipamentos) — loadout
independente por Eco (Echo 1 e Echo 2 nunca compartilham).

## 3. Catálogo — 43 itens (fonte: `ECHO_EQUIP`)

Distribuição por origem: **Âncora 9 · Remanescentes 9 · Consórcio 10 ·
Desviados 9 · Neutros 6**. Por categoria: **14 Núcleos · 14 Protocolos ·
15 Relíquias**. IDs únicos (`nuc_assinatura`, `anc_cont_core`, …).

<formato gerado do catálogo real — mantido abaixo>

### Âncora (9)
- [Núcleo] **anc_cont_core** — NÚCLEO DE CONTENÇÃO · ⧗6
- [Núcleo] **anc_estab_core** — NÚCLEO DE ESTABILIDADE · ⧗6
- [Núcleo] **anc_disc_core** — NÚCLEO DE DISCIPLINA · ⧗5
- [Protocolo] **anc_sent_prot** — PROTOCOLO SENTINELA · ⧗6
- [Protocolo] **anc_int_prot** — PROTOCOLO DE INTERDIÇÃO · ⧗6
- [Protocolo] **anc_var_prot** — PROTOCOLO DE VARREDURA · ⧗7
- [Relíquia] **anc_mem_rel** — MEMÓRIA SELADA · ⧗8
- [Relíquia] **anc_veu_rel** — VÉU DE ORDEM · ⧗8
- [Relíquia] **anc_lap_rel** — LÁPIDE DO CICLO · ⧗9

### Remanescentes (9)
- [Núcleo] **rem_res_core** — NÚCLEO DE RESSONÂNCIA · ⧗7
- [Núcleo] **rem_vin_core** — NÚCLEO DE VÍNCULO · ⧗7
- [Núcleo] **rem_aut_core** — NÚCLEO DE AUTONOMIA · ⧗7
- [Protocolo] **rem_guard_prot** — PROTOCOLO DE GUARDA RECÍPROCA · ⧗7
- [Protocolo] **rem_rev_prot** — PROTOCOLO DE REVIGOR · ⧗6
- [Protocolo] **rem_rei_prot** — PROTOCOLO DE REINTEGRAÇÃO · ⧗7
- [Relíquia] **rem_ult_rel** — ÚLTIMA MEMÓRIA · ⧗9
- [Relíquia] **rem_vin_rel** — VÍNCULO RECÍPROCO · ⧗10
- [Relíquia] **rem_prim_rel** — PRIMEIRO CICLO · ⧗8

### Consórcio (10)
- [Núcleo] **con_ext_core** — NÚCLEO DE EXTRAÇÃO · ⧗7
- [Núcleo] **con_sob_core** — NÚCLEO DE SOBRECARGA · ⧗8
- [Núcleo] **con_cap_core** — NÚCLEO DE CAPITAL · ⧗7
- [Protocolo] **con_col_prot** — PROTOCOLO DE COLETA · ⧗6
- [Protocolo] **con_ava_prot** — PROTOCOLO DE AVALIAÇÃO · ⧗7
- [Protocolo] **con_pre_prot** — PROTOCOLO DE PRECIFICAÇÃO · ⧗6
- [Relíquia] **con_rec_rel** — CONTRATO DE RECUPERAÇÃO · ⧗9
- [Relíquia] **con_bem_rel** — BENS PENHORADOS · ⧗8
- [Relíquia] **con_aco_rel** — AÇÕES DA FRATURA · ⧗10
- [Relíquia] **con_sob_rel** — CONTRATO DE SOBRECARGA · ⧗10

### Desviados (9)
- [Núcleo] **dev_dis_core** — NÚCLEO DISSONANTE · ⧗7
- [Núcleo] **dev_fra_core** — NÚCLEO DE FRATURA · ⧗7
- [Núcleo] **dev_ano_core** — NÚCLEO ANÔMALO · ⧗7
- [Protocolo] **dev_fr_prot** — PROTOCOLO DE FRATURA · ⧗6
- [Protocolo] **dev_co_prot** — PROTOCOLO DE COLAPSO · ⧗7
- [Protocolo] **dev_des_prot** — PROTOCOLO DE DESVIO · ⧗7
- [Relíquia] **dev_cor_rel** — CORAÇÃO IMPOSSÍVEL · ⧗10
- [Relíquia] **dev_mas_rel** — MÁSCARA DA FRATURA · ⧗9
- [Relíquia] **dev_nas_rel** — NASCIMENTO DUPLO · ⧗10

### Neutros (6)
- [Núcleo] **nuc_assinatura** — NÚCLEO DE ASSINATURA · ⧗3
- [Núcleo] **nuc_pressao** — NÚCLEO DE PRESSÃO · ⧗3
- [Protocolo] **pro_execucao** — PROTOCOLO DE EXECUÇÃO · ⧗3
- [Protocolo] **pro_sincrona** — PROTOCOLO DE SÍNCRONA · ⧗3
- [Relíquia] **rel_ultimo_quadro** — ÚLTIMO QUADRO · ⧗5
- [Relíquia] **rel_agulha** — AGULHA DO CICLO · ⧗4

## 4. Origem, tags e Personalidade

- Cada item tem `origin` (facção ou neutro) e **tags** semânticas
  (`offense`, `defense`, `stability`, `control`, `risk`, `survival`, `hunt`,
  `bond`, `support`, `economy`, `dissonance`).
- `EQ_PERS_TAGS` (8 personalidades) define preferências/tolerâncias/
  conflitos por tag. Equipar um item **afim** rende reação positiva; um item
  em **conflito** rende reação negativa — mas **nunca bloqueia** o equipamento
  (identidade ≠ instrução; sem hard lock).
- Reação contextual com **anti-spam por onda** (`eqReactionOnce`).

## 5. Trust / Relationship / Dissonância

- Relíquias de vínculo alteram **Trust**; algumas interagem com
  **Relationship** (`e.rel`) e **Dissonância** (`e.dis`).
- A leitura é **sempre dos valores restaurados existentes** — PR 12 não cria
  cópia divergente de Trust/Rel/Dis (persistência própria deles no checkpoint:
  `cp.echoes[].rel/dis`).
- Ecos em ruptura (**hostil/fracturando**) têm entregas de suporte ao jogador
  suspensas (gate `echoAllied` em `echoEqEmit`) — um Eco hostil não buffa quem
  ele ataca. Contenção/reintegração reativa os efeitos sem duplicar hooks.

## 6. Efeitos: estáticos e dinâmicos

- **Estáticos** (`stats`): multiplicadores/aditivos aplicados no refresh
  (dano, cadência, vida, escudo, disMul, …).
- **Dinâmicos** (`dyn`, ex. `unstable`): escala com estado do Eco
  (`echoEqDynMul`) durante o tick.
- **Especiais** (`fx` + `fxType`): handlers em `EQ_FX_HANDLERS` disparados
  pelo bus `echoEqEmit(e, tipo, payload)` nos pontos do jogo (pkill, ekill,
  death, shopclose, recover, contain, unstable, revive, …).
- **Comportamento** (`beh`): prioridade de alvo/órbita consumida pelo
  update do Eco (`eqPrioTarget`/órbitas).

## 7. eqBase / eqFx — anti-drift

- **`e.eqBase`** é o chassis puro do Eco, capturado **uma única vez**
  (só quando ainda não existe) — nunca recaptura stats já modificados.
- **`e.eqFx`** é o resultado do refresh: `echoEqRefresh` reconstrói do zero
  `base × stats(itens) × eqBoost`. Equipar/remover nunca acumula; re-equipar
  devolve exatamente os mesmos stats.
- **`e.eqBoost`** são reforços persistentes da run (ofertas/eventos/
  relíquias como Nascimento Duplo) — multiplicados no refresh, espelhados em
  `fracRun.eq[i].b` para o checkpoint.

## 8. Caps por onda e por run

- **Por onda** (`e.eqCaps`, reset por `echoEqCapReset` quando a onda muda):
  coleta, revigor, última memória, contenção, máscara — limites anti-farm.
- **Por run** (em `fracRun`): Nascimento Duplo `duoNasc` **2/run**;
  Contrato de Recuperação `cr` **8/run**; Refúgio `refugio`; Cláusula de
  Avaliação `conTax`. **Sobrevivem ao Continue** (nunca resetam por reload —
  sem exploit de revive).

## 9. Inventário e múltiplos Echos

- **Inventário** (`fracRun.es.inv`): comprar com slot ocupado guarda o item
  (nunca sobrescreve em silêncio); o painel de equipamento instala do
  inventário devolvendo o item antigo ao inventário. Unequip devolve o
  chassis original e manda o item ao inventário.
- Echo 1 e Echo 2 têm `fracRun.eq[0]`/`fracRun.eq[1]` independentes;
  instalar em um nunca vaza para o outro.

## 10. Checkpoint / Continue

- `fracRunPack` serializa `eq: [{n,p,r,b}]` (IDs + espelho do boost);
  `fracRunUnpack` sanitiza (ID desconhecido → slot vazio, nunca item
  aleatório) e `fracRestoreEquipment` reexecuta `echoEqInit/echoEqRefresh`
  com o chassis recém-capturado — o boost do checkpoint é copiado **antes**
  do init (o refresh interno reescreveria o espelho com default).
- Ordem no resume: player/Ecos/rel/dis primeiro, PR 12 depois (ver
  [SAVE_SYSTEM.md §13](SAVE_SYSTEM.md)).

## 11. Sandbox

- O laboratório oferece o **catálogo completo (43)** por categoria com
  equipar/remover direto no Eco alvo (`fracSandboxEquip/Uneq`) — sem unlock,
  sem estoque, sem gravar nada. Estado do laboratório é descartado ao sair.

## 12. Reações de facção (B6)

Instalar tecnologia de uma facção é um ato que ela **observa**
(`relic_of_<fid>` no `FACTION_GRID`). A emissão ocorre **somente na
instalação efetiva** — compra com slot livre ou painel do inventário
(`fracRelicEmit`) — nunca ao guardar item no inventário. Itens neutros não
emitem reconhecimento.

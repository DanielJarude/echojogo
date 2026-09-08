# PR14 · B6 — Auditoria Final / Fechamento da Presença de Facção

**Escopo:** consolidar, corrigir, balancear, polir e validar a Presença de
Facção (B1–B5-FIX.2). **Não** adiciona camada nova. Um único FIX estrutural
obrigatório foi implementado (o balão de fala do Echo). Tudo o mais é
auditoria + validação.

- **Versões (congeladas):** ECHO `0.8.0-alpha` · `SM_VERSION=3` ·
  `FRACTURE_STATE_VERSION=1` · pack de presença `v:1`.
- **Baseline B6 (antes de qualquer edição):** `npm test` verde (exit 0), 34
  suítes. Todas as suítes de facção/fratura verdes.
- **Estado final:** `npm test` verde (exit 0), **37 suítes**. Nova suíte
  `tests/pr14-b6-finalization.test.js` com **104 casos** (todos verdes).

---

## 1. Mapa técnico (auditoria de arquitetura)

| Área | Onde | Situação |
|---|---|---|
| 4 facções físicas | `FACTION_IDS`, `FACTION_PRESENCE_LABEL`, `fpIsPhysical` | OK — 4 símbolos/cores/nomes distintos |
| Afinidade (leitura) | `getFactionAffinity`, `fpAffinityWeight` | OK — scheduler **só lê** aff; nunca escreve |
| Limiares/estados | `FACTION_STATES`, `FACTION_PACT_MIN=58`, `fracStateOf` | OK |
| Rivalidades/eixos | `FACTION_RIVAL` (anchor⊗deviants, remnants⊗consortium) | OK — máx 1 pacto/eixo |
| Pacto | `factionCanPact/Consolidate/Break`, `factionHasPact` | OK — run-scoped, flag por facção |
| Teto diplomático | `factionAffinityCeiling`, `fracApplyDelta` | OK — centralizado |
| Scheduler | `factionPresenceSchedule` (portão ~40%, cooldown 2, min wave 2) | OK — determinístico via `fpRng`/`fpDeterministicSeed` |
| Cap ativo | `FACTION_PRESENCE_ACTIVE_CAP=1` | OK — mantido |
| Oferta de pacto | `fpPactOfferReady`, `fpFirstPactOfferReady`, `fpTrackPactEligibility` | OK — via encontro físico |
| Entidade/lifecycle | `factionPresenceBuildEntity/Activate/Resolve/Expire/Cleanup` | OK — não entra em `enemies[]` |
| Interação | `factionPresenceInteract`, `fpOpenPactEncounter` | OK — efeitos por facção×tier |
| Save/Continue | `factionPresencePack/Unpack` (`v:1`) | OK — idempotente, save antigo → fresh |
| Reações do Echo | `echoFactionReaction*`, `echoDiploReactionPick` | OK — `faction_reaction` i:0 (só histórico) |
| Fala do Echo | `echoSpeak` → `speechWrapLines` → `speechRender` | **CORRIGIDO** (ver §3) |
| Beacon | `canUseBeaconForFactionPresence`, `fpBeaconInUse` | OK — coexistência preservada (não virou array) |
| Loja | `renderShop`/`renderShopOp` | OK — **sem** lógica de pacto (removida no B5-FIX.1) |

**Código morto / flags obsoletas:** nenhum encontrado que justifique remoção.
`b5MaybeOfferPact` já não existe (só menção em comentário histórico, correto).
As referências a "pacto" na Loja são apenas **comentários** documentando que a
proposta migrou para o encontro físico. **Nenhum refactor estético feito**
(guarda de arquitetura respeitada).

---

## 2. FACÇÃO ≠ FRACTURE THEME (independência confirmada)

- `factionPresenceSchedule` **não** toca `theme`/`intensity`/`composition`.
- Consolidar pacto e ativar presença **não** alteram `fractureGetThemeId()`
  (testes B6 #93, #94).
- `faction_reaction` mantém contrato **i:0** (só histórico) — não muda Tema.

---

## 3. FIX OBRIGATÓRIO — Balão de fala do Echo

### Diagnóstico
Todas as falas do Echo passam por **um único** renderer (`echoSpeak` →
`speechRender`). Não há caminhos paralelos de balão (auditadas todas as
origens: personalidade, combate, facção, diplomacia, Dissonância, eventos,
fallback, operador — todas chamam `echoSpeak`). O renderer B2-A já quebrava
por palavra, mas tinha **duas lacunas reais**:

1. **Palavra sem espaço** maior que a largura máxima estourava o retângulo
   (não havia quebra por caractere).
2. **Sem clamp de viewport** — uma fala perto da borda saía da tela.

### Correção (estrutural, sem gambiarra)
- Novo helper puro **`speechWrapLines(txt,maxW)`**:
  - quebra por palavra (preserva palavras/acentos/símbolos/nomes intactos);
  - **palavra longa** é quebrada por caractere de forma *grapheme-safe*
    (`Array.from`), nunca ultrapassando `maxW`;
  - respeita `\n` explícito; colapsa espaços; determinística.
- `speechRender` agora:
  - usa `speechWrapLines`; **altura cresce** com o nº de linhas;
  - **largura teto** = `maxW(236)+16` de margem, fundo/borda/margem preservados;
  - **clamp de viewport nas 4 bordas** em espaço de mundo (usa `cam`/`vw`/`vh`);
    se o balão for maior que a tela, alinha à borda **sem cortar**.
- **Fonte NÃO reduzida** (mantém 15/16/17px por prioridade). **Sem** truncar,
  ellipsis, ou overflow cortado.
- **Duração** (`echoSpeechDuration`): mantém derivação do texto e o **cap de
  5.0s (contrato B2-A preservado)**; ganhou um termo leve por linha estimada
  (`SPEECH_EST_CHARS_PER_LINE=34`), somando **dentro** do teto — falas
  multilinha ficam mais tempo na tela sem quebrar o contrato.
- **Duas falas simultâneas:** preservado o comportamento de fila/prioridade
  existente (sem mudança — não houve regressão óbvia a corrigir).

### Helper DEV (só DEV_MODE, inerte fora dele)
- `DEV.echoSpeakLong(n,slot)` — fala sintética de ~n palavras (acentos/
  símbolos/nomes) para testar quebra/altura/clamp; sem `Math.random`, faz taint.
- `DEV.echoSpeak(txt,slot)` — texto arbitrário do operador (testa palavra
  gigante sem espaço). Ambos guardados por `devReady()`; não vazam como global.

---

## 4. Simulações (Diretor RNG, determinístico — sem `Math.random` de gameplay)

### 4.1 Frequência de presença — 12.000 runs
Afinidades sorteadas por run (determinístico da seed), waves 1..20.

| Presenças/run | % |
|---|---|
| 0 | 0,0% |
| 1 | 0,1% |
| 2 | 1,1% |
| 3 | 5,5% |
| 4+ | 93,3% |

- **Média:** ~5,5 presenças/run (uma a cada ~3–4 ondas — **percebida sem
  dominar**; não é uma presença a cada onda).
- **Por facção** (média/run): anchor 1,66 · remnants 1,45 · consortium 1,26 ·
  deviants 1,12 (viés SUAVE de afinidade, esperado).
- **1ª onda média:** 3,5 · **última onda média:** 18,2 (cobre early/mid/late).
- **Diversidade:** 63,3% das runs têm ≥2 facções distintas.
- **Veredito:** frequência saudável. **Nenhuma alteração de balance** (o
  portão de ~40% é contrato B2, tuning fora do escopo de mexer sem evidência
  de problema — e não há).

### 4.2 Acessibilidade de pacto (timing) — 12.000 runs
Uma facção fica FAVORÁVEL na onda `eligWave`; mede se a oferta chega.

- **Oferta entregue:** 93,3% das runs · **pacto aceito:** 93,3%.
- **Onda média da oferta:** 12,6.
- Aceite ≈100% quando a facção fica favorável até a onda ~13; taper natural
  só quando a elegibilidade surge muito tarde (elig@15 = 85%, elig@17 = 55%)
  — restam poucas ondas, **limitação estrutural legítima**, não bug.
- **Veredito:** pactos **acessíveis**; sem inacessibilidade por timing.
  **Nenhuma correção de diplomacia necessária.** (Consistente com a baseline
  B5: a maioria das runs não força aliança; quando a afinidade sobe, o pacto
  aparece.)

---

## 5. Auditoria das 4 facções (tiers/valores REAIS — confirmados no código)

| Facção | Base | Ally (×1.30) | Hostile |
|---|---|---|---|
| **ÂNCORA** (Nó de Contenção) | +50% shieldMax | +30% sobre base | restrito (`×0.55`) |
| **REMANESCENTES** (Memorial) | 35% shieldMax por Eco vivo + trust +4 | reforçado | **VÍNCULO RECUSADO** (sem HP/revive; ignora hostil) |
| **CONSÓRCIO** (Cache) | +4⧗ | acesso prioritário | toll 6⧗ → cache 10⧗ (**net +4**) |
| **DESVIADOS** (Fenda) | +20% dano / +15% recebido / 12s | risco menor (taken 1.08) | +28% dano / +35% recebido |

Constantes conferidas 1:1 com o código (`FACTION_PRESENCE_*`). **Nenhuma
recalibração** — valores batem com o design aprovado e não há evidência de
desequilíbrio nas simulações.

---

## 6. Demais auditorias

- **Identidade visual:** 4 facções com símbolo/cor/nome distintos entre si e
  do beacon/evento genérico; pacto tem marker **bold + brilho** ("PACTO
  DISPONÍVEL") distinto de "PRESENÇA DE FACÇÃO". CTA "APROXIME-SE PARA
  NEGOCIAR" preservado.
- **Readability em combate:** balão agora nunca sai da tela nem estoura o
  retângulo — melhora direta de leitura sob pressão.
- **Modais / Loja:** a Loja não vaza em pacto (proposta migrou para encontro
  físico no B5-FIX.1; `mCoins`/`mOwned` limpos no contexto de pacto — B5-FIX.2).
- **HUD:** sem overlap/clipping introduzido (fala é world-space, HUD é overlay).
- **Echo survivability:** **não tocado** (sem buff — fora do escopo do FIX).
- **Reações diplomáticas do Echo:** variedade/anti-repeat/cooldown preservados;
  fila limitada a `ECHO_SPEECH_QUEUE_MAX=3`.
- **Fracture ≠ Theme:** confirmado (§2).
- **Beacon × presença:** coexistência preservada (guard `canUseBeaconForFactionPresence`).
- **Save/Continue:** pack `v:1`; round-trip e idempotência validados; save
  antigo (sem bloco) → fresh sem crash.
- **Sandbox / DEV:** presença gated no Sandbox para `faction_reaction`; helpers
  DEV read-only/inertes fora de `DEV_MODE`.
- **Performance:** sem loops por frame novos; wrapping roda só quando há fala
  ativa; sem timers órfãos (cleanup zera ativa/agendada).

---

## 7. Property / stress (≥10.000) — invariantes validadas

- Wrapping: **0** linhas acima de `maxW` em 10.000 combinações aleatórias.
- Duração: sempre finita, em `[1.6, 5.0]` (10.000 amostras).
- **0** pactos rivais simultâneos (10.000 operações); afinidade sempre em
  `[-100,100]`; cap de presença **= 1** sempre respeitado; **0** pactos via Loja.

---

## 8. Separação de entregas

- **IMPLEMENTADO (B6):** FIX do balão de fala (wrapping estrutural + quebra de
  palavra longa + altura dinâmica + clamp de viewport + termo de duração por
  linha), 2 helpers DEV de fala, suíte `pr14-b6-finalization` (104 casos).
- **VALIDADO (B6):** frequência de presença; acessibilidade de pacto; valores
  das 4 facções/tiers; independência Facção≠Tema; Save/Continue; property/stress.
- **CORRIGIDO (B6):** apenas o balão de fala (único problema comprovado).
- **ADIADO (dívidas futuras):**
  - Tuning fino do portão de frequência (~40%) — **PR14.5** se playtest humano
    pedir mais/menos presença.
  - Painel/HUD persistente de facção — **fora de escopo** (proibido).
  - Reputação meta / progressão entre runs — **PR15+**.
  - Quinta facção, quests, vendors, equip novos — **PR16/17/18** (proibidos aqui).

---

## 9. Conclusão

**B6 está tecnicamente pronto para playtest humano final.** Todos os testes
automatizados passam (37 suítes, exit 0). O único problema comprovado (balão de
fala) foi corrigido de forma estrutural, sem regressões e sem alterar contratos
aprovados. **PR14 NÃO está declarado encerrado** — depende do playtest humano
(roteiro no README de entrega / resumo).

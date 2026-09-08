# PR14 · B5-FIX.1 — Pactos como encontros de facção + legibilidade do feedback

> Correção derivada do **playtest humano do B5**. Dois achados corrigidos, sem
> reabrir balanceamento nem reformar HUD/Loja/Codex. **O B5 NÃO está encerrado**
> — haverá novo playtest humano depois.

---

## 1. Os dois achados do playtest

**ACHADO A — o pacto acontecia na Loja.** A proposta de pacto surgia dentro do
Nódulo de Manutenção (Loja Temporal), como um prompt que "aparecia do nada"
quando a facção ficava FAVORÁVEL. Ficava desconectado da presença física da
facção na arena e quebrava a leitura de que "a facção veio até você".

**ACHADO B — o feedback de presença era curto e chapado.** O toast comum dura
~2,1 s e é uma única linha; a mensagem de uma presença de facção (a coisa mais
importante que acontece na arena naquele instante) passava rápido demais e sem
hierarquia — difícil ler o estado, o efeito e o custo/bônus.

---

## 2. ACHADO A — o novo fluxo: pacto é um ENCONTRO FÍSICO

O pacto deixou de ser um evento da Loja. Agora ele nasce da **presença física da
própria facção** durante a run:

```
escolhas na run → afinidade FAVORÁVEL (aff ≥ 58) → pacto ELEGÍVEL
   (NÃO auto-formaliza; progressão primeiro)
→ algumas ondas depois, uma presença física da facção assume
   "PACTO DISPONÍVEL" (mesmo visual + sinal extra claro)
→ o operador se aproxima e interage
→ modal EXCEPCIONAL (não a Loja): cabeçalho da FACÇÃO + PROPOSTA DE PACTO
   + texto lore-coerente + IMPACTO NA RUN
→ ACEITAR (vira ALIADA + consequência na rival) ou
   MANTER INDEPENDÊNCIA (continua FAVORÁVEL, sem custo/ruptura; oferta pode voltar)
```

Nada disso cria um segundo scheduler ou um HUD novo: reutiliza a camada de
presença física (agendamento, entidade, interação) e a lógica diplomática de
fundo do B5 (`factionCanPact`, `factionPactConsolidate`, teto, eixos, ruptura).

### 2.1 Remoção completa da Loja

Removidos do código (sem botão morto, espaço vazio, listener órfão ou função
duplicada):

- `b5MaybeOfferPact()` — era chamada por `openShop()`;
- `b5OpenPactModal(id)` / `b5ClosePactModal()`;
- `b5EligiblePactFaction()`;
- a flag `_b5PactPromptWave`.

`openShop()` voltou a ser só compra + reroll. No lugar do bloco removido ficou um
comentário-âncora apontando para o novo fluxo físico. **Não** houve rework da
Loja (isso é escopo do futuro PR14.5).

### 2.2 Eligibilidade e timing (determinístico, sem RNG raro)

Dois campos run-scoped novos em `factionPresenceFresh()` (serializáveis):

| Campo | Significado | Default |
|---|---|---|
| `pactEligWave[fac]` | 1ª onda em que a facção ficou elegível a pacto | `-1` |
| `pactDecl[fac]` | onda em que o operador escolheu MANTER INDEPENDÊNCIA | `-1` |

Duas constantes (não são tuning de balanceamento; só cadência da oferta):

| Constante | Valor | Papel |
|---|---|---|
| `FACTION_PACT_OFFER_DELAY` | `2` ondas | "progressão primeiro": a proposta só fica pronta N ondas **depois** do +58 — nunca no instante |
| `FACTION_PACT_REOFFER_COOLDOWN` | `3` ondas | reoferta **moderada** depois de uma recusa |

`fpTrackPactEligibility(n)` roda a cada onda (dentro do scheduler, antes dos
early-returns): marca a 1ª onda de elegibilidade e **reinicia** a janela se a
facção deixar de ser elegível (afinidade caiu, rival pactuou). Tudo comparando
ondas — **nenhum** `Math.random`, nenhum consumo de RNG crítico do Director.

### 2.3 Scheduler — prioridade controlada (não é segundo scheduler)

Dentro do `factionPresenceSchedule(n)` já existente, quando o portão determinístico
(~40 %) decide agendar uma presença:

- se `fpFirstPactOfferReady(n)` retorna uma facção pronta, **ela** é escolhida com
  `pactOffer=1` e `reason='pact_offer'` (prioridade sobre o sorteio ponderado);
- senão, mantém-se o `fpPickFaction(rng)` de sempre.

Isso garante os dois extremos que o playtest pediu evitar:

- **"nunca aparece"** — se está pronta, tem prioridade na próxima presença agendada;
- **"monopoliza tudo"** — depois de aceitar (vira pacto, deixa de ser elegível) ou
  recusar (entra em cooldown de reoferta), volta ao sorteio normal.

Em runs sem diplomacia (afinidade 0 — o caso dos testes B2/B3) **nenhuma** facção
fica pronta, então o comportamento do scheduler é **idêntico** ao anterior
(determinismo e suítes B2/B3 preservados byte-a-byte no comportamento).

### 2.4 Entidade física e o encontro

- `fpMakePresence` passou a carregar `pactOffer` (0/1), serializável.
- `factionPresenceBuildEntity` só marca a entidade com `pactOffer` **se o pacto
  ainda for possível no momento do spawn** (`factionCanPact`): a afinidade pode
  ter mudado entre agendar e ativar. Nunca concede pacto — só habilita a proposta.
- `factionPresenceInteract()`: se a entidade tem `pactOffer` **e** o pacto ainda é
  possível **e** não é Sandbox, abre `fpOpenPactEncounter(e)` em vez de aplicar o
  efeito comum. Se a elegibilidade caiu no meio do caminho, **degrada** para o
  efeito normal (sem travar).
- `fpOpenPactEncounter(e)`: modal excepcional (`state='event'`) com cabeçalho da
  facção, `PROPOSTA DE PACTO`, a frase de lore da facção, `IMPACTO NA RUN`
  (estados, não números crus) e duas opções.
- `fpClosePactEncounter()`: resolve a presença lógica, limpa a entidade física
  (a proposta **é** a interação — não sobra corpo para farmar efeito depois) e
  retoma a run com breve invulnerabilidade de retorno.

### 2.5 Recusa e aceitação

- **ACEITAR** → `factionPactConsolidate(id)` (idempotente): seta a flag, deteriora
  a rival até o teto **uma vez**, promove a ALIADA.
- **MANTER INDEPENDÊNCIA** → grava `pactDecl[id] = wave` (para a reoferta) e
  **nada mais**: sem `pactBroke`, sem custo de afinidade, sem downgrade. Segue
  FAVORÁVEL; a oferta pode voltar após o cooldown.

### 2.6 Regras do B5 preservadas (nada recalibrado)

- pacto exige FAVORÁVEL (aff ≥ 58);
- um pacto por eixo; eixos rivais: **ÂNCORA ↔ DESVIADOS** e **REMANESCENTES ↔ CONSÓRCIO**;
- máximo duas alianças compatíveis (uma por eixo);
- rival de um pacto fica limitada ao teto (NEUTRA) e **não** fica pronta a ofertar
  — mas **a presença física da rival continua existindo** no tier apropriado;
- pacto já consolidado não reoferece;
- `pactBroke` bloqueia reconsolidar na mesma run (ruptura tem custo real).

### 2.7 Identidade das 4 propostas (lore real, não inventada)

Reutiliza os nomes/linhas de pacto que já existiam no B5, coerentes com a lore
de cada facção:

| Facção | Nome do pacto | Princípio |
|---|---|---|
| ÂNCORA | PROTOCOLO DE CONTENÇÃO | protocolo / estabilidade / contenção |
| REMANESCENTES | PACTO DE CONTINUIDADE | vínculo / continuidade / preservação |
| CONSÓRCIO | ACORDO DE EXCLUSIVIDADE | acordo / contrato / acesso |
| DESVIADOS | PACTO DE ADAPTAÇÃO | adaptação / transformação / ruptura controlada |

---

## 3. ACHADO B — feedback importante de presença

### 3.1 Categoria própria (não alonga os outros toasts)

O toast comum (`.toast`) segue **intacto**: 2,1 s, uma linha. Criada uma categoria
nova **só** para a mensagem principal de uma presença de facção:

- **`.toast.fp`** — dura **~4,6 s** (≈ 4–5 s úteis; animação `fptin 4.6s`), com
  moldura/borda/brilho na cor da facção (via `--fp-col`).
- Hierarquia de **3 linhas**:

  ```
  SÍMBOLO FACÇÃO · ESTADO          (.fp-head — cor da facção, negrito)
  NOME DO EFEITO                   (.fp-eff  — destaque)
  +bônus · custo/risco             (.fp-sub  — secundário, opcional)
  ```

- Função `fpImportantToast(faction, head, eff, sub)` monta o toast; sem `sub`
  gera só 2 linhas.

### 3.2 Uma mensagem principal por interação, valores reais

`factionPresenceInteract()` agora emite **uma** `fpImportantToast` como mensagem
principal (não duplica o toast comum). Os valores vêm do **próprio código** que
executa o efeito — ex.: a linha dos Desviados usa
`FACTION_PRESENCE_DEVIANTS_DMG`/`_TAKEN` reais, e o tier HOSTIL mantém os valores
atuais **+28 % dano / +35 % dano recebido** (`_HOSTILE_DMG=1.28`, `_HOSTILE_TAKEN=1.35`)
— **não** houve recalibração.

### 3.3 Sinal visual do "PACTO DISPONÍVEL"

A presença física **não** foi redesenhada. Quando tem `pactOffer`, ganha um
adorno sobreposto claro:

- aura pulsante extra + marcador `◆` acima da presença (no `factionPresenceDrawEntity`);
- rótulo de rodapé troca de `▣ PRESENÇA DE FACÇÃO` para `◆ PACTO DISPONÍVEL`;
- no spawn, banner + toast de facção anunciam `◆ PACTO DISPONÍVEL — APROXIME-SE
  PARA NEGOCIAR`.

Não bloqueia o centro/HUD/inimigos; alteração mínima de posição (só um adorno).

---

## 4. Save / Continue

- `factionPresencePack`/`Unpack` serializam `pactDecl` e `pactEligWave` (além do
  `pactOffer` da presença agendada/ativa, via `fpMakePresence`).
- Save antigo (sem os campos novos) cai em **defaults seguros** (`-1`).
- Continue restaura: elegibilidade, proposta vista/recusada, cooldown de reoferta.
- Pacto aceito **não** reaparece (a proposta nunca fica pronta com pacto ativo).
- **Sem** duplicação de penalidade da rival / pacto / teto / feedback ao retomar.
- **Nenhuma** versão foi alterada: `ECHO 0.8.0-alpha`, `SM_VERSION=3`,
  `FRACTURE_STATE_VERSION=1`, `factionPresence pack v:1`.

---

## 5. DEV / Sandbox

- Preservados: `DEV.forceFactionPresence(...)`, `DEV.factionDiplomacy()`,
  `DEV.diploScenario(1..6)`, `DEV.forceFactionAlliance(...)`,
  `DEV.breakFactionAlliance(...)`, etc.
- **Novo** helper mínimo: `DEV.forcePactOffer('anchor'|…)` — garante os
  pré-requisitos (conhecimento + FAVORÁVEL, eixo livre) e força uma presença
  física **com** `PACTO DISPONÍVEL` para playtestar o encontro → proposta.
  Read-only fora de `DEV_MODE`; respeita o cap; não consolida sozinho.
- Suporte interno: `factionPresenceDevForcePactOffer(faction)` (gated por `DEV_MODE`).
- **Ctrl+Shift+I (DEV-FIX)** e **Ctrl+Shift+D** intactos — não tocados.

---

## 6. Testes

Nova suíte: **`tests/pr14-b5-fix1-pact-presence.test.js`** — **86 casos**,
integrada ao `npm test` (agora **35 suítes**; meta-teste atualizado).

Cobertura:

- **Remoção da Loja (1–4):** funções e chamadas de pacto removidas; `openShop`
  sem pacto; novo fluxo existe.
- **Estado/serialização (5–10):** `pactOffer` normalizado; `pactDecl`/`pactEligWave`
  default `-1`; pack/unpack round-trip; save antigo → defaults; herança
  condicional do `pactOffer` na entidade.
- **Elegibilidade & timing (11–20):** base = `factionCanPact`; 57 não / 58 sim;
  tracking marca/reinicia; nunca no instante do +58; pronto após o delay; pacto/
  eixo ocupado bloqueiam; ordem determinística.
- **Scheduler (21–28):** sem diplomacia nunca marca oferta; prioriza a facção
  pronta; `reason='pact_offer'`; determinismo; cooldown; cap=1; tracking com
  presença ativa; sem monopólio pós-pacto.
- **Entidade & interação (29–40):** presença comum aplica efeito; oferta abre modal
  (não aplica efeito) e congela a run; 2 opções; ACEITAR consolida e retoma;
  MANTER não consolida/não pune/registra recusa; Sandbox não abre; sem
  afinidade automática; degradação segura; snapshot expõe `pactOffer`; cap=1.
- **Recusa/reoferta/aceitação (41–48):** cooldown de reoferta; deterioração da
  rival; promoção a ALIADA; recusa não é ruptura; segue FAVORÁVEL; idempotência.
- **Save/Continue (49–54):** pactDecl/pactEligWave restaurados; pacto não reaparece;
  presença agendada com oferta sobrevive; versões; rival não cai duas vezes.
- **Regras B5 (55–62):** limiar 58; um por eixo; máx duas; teto; pactBroke; rival
  não oferta mas tem presença; Tema imutável; nomes de pacto.
- **Feedback / ACHADO B (63–72):** `.toast.fp` com 3 linhas; hierarquia; símbolo;
  cor `--fp-col`; sub opcional; CSS 4,6 s sem mexer no toast comum; uma mensagem
  principal por interação; valores reais dos Desviados; HOSTIL 28 %/35 %; sinal.
- **DEV (73–76):** `forcePactOffer` e suporte; helpers antigos; atalho DEV intacto.
- **Regressão (77–82):** os 4 efeitos base seguem funcionando; presença comum não
  abre modal; entidade consumida não reprocessa.
- **Property / stress (83–86):**
  - 5 000 sequências de scheduler → **0** proposta impossível, **0** excesso de
    pactos, **0** dupla aliança rival, **0** NaN;
  - 5 000 interações em tiers aleatórios → **0** exceção, **0** NaN de escudo;
  - 5 000 propostas físicas → proposta **nunca** vira pacto sozinha;
  - 2 000 round-trips pack→unpack → estado preservado.

`npm test` **verde** (35 suítes). Suítes-alvo verificadas individualmente:
B2 (26/0), B3 (34/0), B4 (78/0), B5 (97/0), B5-FIX.1 (86/0), devtools-shortcut (21/0).

---

## 7. Escopo NÃO tocado

- **Sem** recalibração de balanceamento (tiers ally/base/hostile das 4 presenças,
  toll, resíduos, multiplicadores, duração de modifiers, threshold 58, teto,
  ruptura) — nenhum número de gameplay mudou.
- **Sem** rework de HUD / Loja / Codex / eventos / tipografia / menus.
- **Sem** PR14.5 / PR15 / PR16 / PR17 / PR18.
- **Sem** segundo scheduler, sem HUD/painel persistente de facção.

---

## 8. Dívidas registradas — FUTURO PR18 (rework de UI/UX)

Registrado aqui para não perder: o rework de UI/UX (HUD, Loja, Codex, tipografia,
hierarquia visual global, e uma eventual superfície persistente para acompanhar
diplomacia/pactos) fica reservado ao **PR18**. O B5-FIX.1 se limita a mover o
pacto para o encontro físico e a legibilizar o feedback da presença — sem abrir
essa frente maior.

---

## 9. Roteiro de teste humano (TESTE 1–4)

> Ative o DEV MODE com **Ctrl+Shift+D**.

**TESTE 1 — O pacto NÃO está mais na Loja.**
Jogue algumas ondas, suba a afinidade de uma facção acima de FAVORÁVEL e abra a
Loja Temporal (Nódulo de Manutenção) várias vezes. **Esperado:** a Loja só mostra
compra/reroll; nenhum prompt de pacto aparece nela.

**TESTE 2 — Encontro físico → proposta.**
Use `DEV.forcePactOffer('anchor')` (ou outra facção). **Esperado:** aparece uma
presença física da facção com sinal de **PACTO DISPONÍVEL** (aura + `◆` + rótulo).
Aproxime-se: abre o modal excepcional com cabeçalho da facção, PROPOSTA DE PACTO,
texto de lore e IMPACTO NA RUN. Escolha **ACEITAR** → facção vira ALIADA e a rival
é explicitamente restringida. Repita e escolha **MANTER INDEPENDÊNCIA** → nada é
penalizado; a facção segue FAVORÁVEL e a oferta pode voltar depois.

**TESTE 3 — Feedback legível.**
Force presenças normais (`DEV.forceFactionPresence('deviants')`, etc.) e interaja.
**Esperado:** a mensagem principal dura ~4–5 s e mostra 3 linhas —
`SÍMBOLO · ESTADO` / `NOME DO EFEITO` / `+bônus · custo/risco` — na cor da facção,
com valores reais (Desviados hostil: +28 % dano / +35 % recebido). Os toasts
comuns continuam curtos.

**TESTE 4 — Save/Continue.**
Deixe uma facção com proposta recusada e outra elegível, saia e use **Continue**.
**Esperado:** a facção recusada não reoferece imediatamente (respeita o cooldown);
a elegível ainda pode ofertar; um pacto aceito não reaparece; nenhuma penalidade
de rival é duplicada.

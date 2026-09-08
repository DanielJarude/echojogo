# PR14.5 · B3 — ROTEIRO DE PLAYTEST HUMANO (~6 testes)

Como usar: rode `npm start` (ou abra o jogo), ative DEV se indicado. Marque **FAIL** + anote o que viu se o "esperado" não ocorrer. Nenhum teste exige ler código.

---

## T1 — Hierarquia da Loja (sem código)

**Preparação**: comece uma run, junte ~60◈, entre na loja.
**O que fazer**: olhe a seção de upgrades e a de módulos por 20 s, sem hover.
**Esperado**: a seção de upgrades tem o título **"CALIBRAÇÕES DE CAMPO · APRIMORAMENTOS ACUMULATIVOS"**; módulos têm o título de identidade da build; é óbvio (sem ler tooltip) que upgrades = aprimorar a build e módulos = mudar o jeito de jogar.
**FAIL se**: título ausente, ilegível, ou se as duas seções parecem a mesma coisa.

## T2 — Rank + preview da compra

**Preparação**: mesma run; anote uma calibração (ex.: SERVO-GATILHO) e compre-a 2× ao longo da run.
**Esperado**: na 1ª compra o card mostra **RANK I** (ou II se já comprou antes); após comprar, o mesmo upgrade volta a aparecer (eventualmente) como **RANK II**, com efeito **atual → projetado** visível no card (ex.: "+12% → +24%"), preço igual ao da 1ª compra (não subiu).
**FAIL se**: rank não muda, preview some, ou o preço sobe a cada compra.

## T3 — Reoferta "apaga, mas não some"

**Preparação**: compre qualquer calibração; entre na loja seguinte **sem rerollar**.
**Esperado**: o upgrade comprado **pode** aparecer, mas na maioria das vezes não aparece na loja imediatamente seguinte; duas ou três lojas depois ele volta a ser comum. Sensação: "o jogo me oferece variedade", não "me proíbe de repetir".
**FAIL se**: o comprado aparece de novo em TODAS as lojas seguidas, ou NUNCA mais aparece.

## T4 — Presença de facção: banner + indicador + Continue

**Preparação**: run normal (DEV opcional: `DEV.forceFactionPresence()` para forçar).
**Esperado**: quando a presença surge: banner específico com nome da facção que **dura visivelmente mais** que um banner de onda (~4 s vs ~2 s); abaixo do HUD surge um indicador discreto **⬡/◉/◈/◬ NOME · Ns** contando o tempo; se a facção tem pacto disponível, o indicador mostra **◆ PACTO DISPONÍVEL**; ao expirar, o indicador some sozinho. Se morrer num momento de presença ativa e der **CONTINUE**, o indicador volta refletindo o estado **sem repetir o banner/toast**.
**FAIL se**: banner dura o mesmo dos outros; indicador genérico/sem nome; indicador continua para sempre; Continue re-anuncia com banner grande.

## T5 — LENTE e PRESAS contam histórias diferentes

**Preparação**: run com DEV (use `DEV.giveUpgrade`/loja para garantir); leve a **LENTE DE FOCO** e depois compre **PRESAS DE VÁCUO**.
**Esperado**: LENTE: além do +perfuração/−dano de sempre, atravessar um inimigo deixa o próximo tiro mais forte (perceptível no dano); PRESAS: a cada 3 abates sobe um **+8** verde de vida — e NÃO há roubo de vida por dano (isso continua sendo do DRENO SANGUÍNEO, calibração de 32◈).
**FAIL se**: PRESAS rouba vida por dano; LENTE não muda nada ao atravessar.

## T6 — Calibrações não julgam a build

**Preparação**: run com perfil de build desalinhado (ex.: comprar só módulos de escudo e olhar os cards de calibração); se quiser atalho: DEV → `DEV.forceBuildProfile(null)` e compare.
**Esperado**: cards de CALIBRAÇÃO **não** mostram chip de Sintonia (RESSONANTE/AFINADA/DIVERGENTE) nem dão bônus/penalidade por perfil; MÓDULOS continuam mostrando a sintonia compacta e reagindo ao perfil (preço/peso de oferta).
**FAIL se**: calibração exibe sintonia; ou módulos deixaram de exibir.

---

### Checklist final do playtest

- [ ] T1 hierarquia legível · [ ] T2 rank/preview/preço · [ ] T3 reoferta justa
- [ ] T4 presença (banner/indicador/pacto/Continue) · [ ] T5 LENTE/PRESAS · [ ] T6 sem sintonia em calibração

**Critério §61**: um jogador novo entende as 3 camadas (calibra / especializa / transforma) em ~2 minutos de loja, sem tutoriais.

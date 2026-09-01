# MORALITY_SYSTEM.md — Moralidade 2.0 + Sintonia Moral de Itens (PR 9)

## 1. Filosofia

Compaixão, Ganância e Violência **não são** bom/neutro/mau. São **tendências**
que descrevem o tipo de decisão que o jogador toma durante a run:

| Eixo | Representa |
|---|---|
| **COMPAIXÃO** (`comp`) | preservação, proteção, cooperação, sacrifício |
| **GANÂNCIA** (`greed`) | acúmulo, eficiência econômica, risco por recompensa |
| **VIOLÊNCIA** (`viol`) | confronto, destruição, domínio, força direta |

Nenhum eixo é "correto". Cada um oferece **benefício + custo + identidade**.
A moralidade produz identidade de build — **nunca prisão**: nenhum item é
bloqueado, nenhum caminho é objetivamente melhor, e um jogador equilibrado
continua 100% viável.

Moralidade **não é** personalidade de Echo (PR 8 mede *como* o jogador joga;
PR 9 mede *que decisões* ele toma) e **não é** relacionamento com o Echo
(PR 10) nem sistema de finais (PR 10.5).

## 2. Raw vs Normalizado

- **Fonte de verdade (raw):** o objeto global `moral = {comp, greed, viol}`.
  Valores inteiros, crescem sem teto conforme as escolhas, **por run**
  (zerados em `resetRunWorld`). O formato histórico de save **não mudou**.
- **Derivado (normalizado):** `getMoralProfile()` devolve uma representação
  proporcional para uso mecânico. Perfis proporcionais são equivalentes:
  `10/5/0` e `20/10/0` produzem o mesmo perfil derivado.

## 3. Perfil moral — `getMoralProfile(m?)`

Função central (única fonte de lógica moral — nada de `if(comp>greed)`
espalhado). Retorna:

```js
{
  raw:        {comp, greed, viol},   // valores crus
  total,                             // soma
  normalized: {comp, greed, viol},   // proporções (somam 1)
  dominant,   // eixo mais forte ('comp'|'greed'|'viol') ou null
  secondary,  // segundo eixo ou null
  intensity,  // proporção do dominante (0..1)
  state,      // 'neutral' | 'dominant' | 'mixed' | 'balanced'
  balanced    // bool
}
```

**Cache:** o perfil é recalculado apenas quando `comp|greed|viol` mudam
(chave de cache) — nunca por frame.

### Estados (constantes em `MORAL_BALANCE.profile`)

| Estado | Regra |
|---|---|
| `neutral` | `total < minTotal (3)` — a moral ainda não "acordou" |
| `balanced` | dispersão 1º−3º ≤ `balancedSpread (0.12)` |
| `dominant` | vantagem 1º−2º ≥ `dominantGap (0.18)` |
| `mixed` | qualquer outro caso (dois eixos fortes) |

Exemplos: `8/2/1` → Compaixão dominante · `5/4/1` → misto · `4/4/4` → equilíbrio.

## 4. Sintonia moral de itens

### Tabela central `MORAL_AFFINITY`

Afinidade por **id de item** (os objetos de `ITEMS` não foram alterados —
item sem entrada é **neutro por padrão**, o que também cobre a migração).
Vetores `{comp, greed, viol}` somam 1; itens mistos são permitidos
(ex.: `sifao: {comp:.5, viol:.5}`).

A classificação considera **o que o item faz** (não o nome):
proteção/cura/Shield → Compaixão · créditos/loot/risco-recompensa → Ganância ·
dano/execução/DoT → Violência.

**Classificação atual (35 módulos):**

| Eixo | Itens |
|---|---|
| COMPAIXÃO | placa, paradoxo, ressonador, talisma, su_regen |
| GANÂNCIA | iman, usura, su_imante |
| VIOLÊNCIA | nucleo, coracao, olho, estilhaco, pirostase, condutor, catalis, ferrao, reator, vinganca, entropia, su_exec, su_dotcrit |
| MISTO | rebob (C.4/V.6), criostase (C.5/V.5), sifao (C.5/V.5), carapaca (C.6/V.4), ampulheta (C.4/V.6), espinho (C.4/V.6), su_vampiro (C.6/V.4), su_sorte (C.5/V.5), su_critcura (C.5/V.5) |
| NEUTRO | lente, luneta, espectro, colmeia, prisma2 |

### Cálculo (contínuo, nunca binário)

```
match = (aff.comp·norm.comp + aff.greed·norm.greed + aff.viol·norm.viol) / Σaff
tune  = clamp((match − baseline) / (1 − baseline), 0, 1)   // baseline = 1/3
```

- `match ∈ [0,1]`: 1 = alinhamento perfeito; 1/3 = perfil equilibrado.
- `tune` é o fator de efeito: **0 na linha de base** (equilibrado) e 1 no
  alinhamento total. **Divergência nunca pune o item** — o item base
  funciona sempre, independentemente da moral.

### Stacking e orçamento global (auditoria de balanceamento)

As contribuições de sintonia são **aditivas** (`type:'add'` no pipeline) e
passam por um **orçamento global por eixo** (`MORAL_BALANCE.affinity.totalCaps`),
calculado centralmente em `calcMoralTuningPlan()`:

```
raw(item, eixo) = maxBonus[eixo] × aff[eixo] × tune      // por item
total(eixo)     = Σ raw                                   // da build
scale(eixo)     = total > cap ? cap / total : 1           // escala proporcional
delta(item)     = raw × scale                             // mod 'add' emitido
```

| Eixo | Teto por item | Orçamento global da build |
|---|---|---|
| Compaixão (dano recebido) | −5% | **−10%** |
| Ganância (créditos) | +8% | **+14%** |
| Violência (dano) | +5% | **+10%** |

Consequências: 1 módulo afinado vale o teto individual; 2 módulos somam;
a partir daí a soma **satura no orçamento** com escala proporcional
(cada módulo mantém a sua fração — remover um reduz corretamente).
Sem o cap, uma build com todos os módulos de Violência chegava a
**×2.01 de dano só de sintonia**; com o cap, o pior caso real é **×1.10**.

Interação com o sistema legado (`mEff`, intocado): pior caso total de
"dano moral" = 1.10 × 1.442 (tier 3) = **×1.586** — contra ×1.442 que o
jogo já dava antes do PR 9, e pago com os custos legados de Violência
(inimigos +34% vida, você recebe +37% de dano). Economia: 1.14 ×
2.445 = ×2.79 sobre o multiplicador de kills, dentro da identidade de
Ganância já existente.


### Níveis (apenas rótulo de UI)

`DIVERGENTE (<0.22) · NEUTRA (<0.45) · AFIM (<0.72) · HARMÔNICA (≥0.72)`
— terminologia escolhida para **não** colidir com Resonance/Micro-Resonance.

### Efeitos (via Stat Modifier Pipeline)

Temáticos por eixo, escalados por `aff[eixo] × tune` e limitados pelo
orçamento global acima:

| Eixo | Efeito | Teto por item | Teto da build |
|---|---|---|---|
| Compaixão | dano recebido ×(1 − x) | −5% | −10% |
| Ganância | créditos ×(1 + x) | +8% | +14% |
| Violência | dano ×(1 + x) | +5% | +10% |

- IDs estáveis: `moral:item:<itemId>:<stat>` (`stacks:'replace'`).
- **Derivados**: excluídos do checkpoint (`smBuildCheckpoint` filtra
  `isMoralTuneModId`) e **recalculados** no resume — nunca duplicam.
- `applyMoralTuning(p)` recalcula tudo; é chamado quando a moral muda
  (`moralGain`), quando um item entra (`giveItem`) e no `resumeRun`.
  Nunca por frame.

## 5. Escolhas morais — arquitetura

`moralGain(c, g, v)` continua sendo a **API central** de escolha moral
(todos os 20 eventos já a utilizam via `evOpt`/`moralTagHTML`). Cada escolha:

1. altera o(s) eixo(s) corretos;
2. produz consequência imediata (créditos, HP, buff, ameaça — definida no
   próprio evento);
3. mostra feedback (`COMPAIXÃO +3`, banners de virada de tier);
4. agora também recalcula a sintonia dos módulos instalados.

## 6. Consequências durante a run

1. **Eventos:** os 20 eventos existentes já oferecem escolhas nos três eixos
   com consequência imediata. Novo no PR 9: o **sorteio** dos eventos
   (após os 2 tutoriais fixos) usa `pickEventKind()` com viés leve —
   peso `×(1 + 0.30·norm[eixo])` máx. ≈×1.30 para eventos afins ao perfil
   (`EVENT_AFFINITY`). Eventos sem afinidade mantêm peso 1. Variação local
   e leve — direção procedural maior é assunto do PR 13.
2. **Economia:** os efeitos de tier pré-existentes (`applyMoral` → `mEff`)
   foram **preservados** (preços, moedas, dano, agressividade etc.).
3. **Ofertas:** módulos afinados recebem peso `×(1 + 0.10·tune)` (máx. ×1.10)
   no sorteio da loja — a loja continua diversa, nada é removido/bloqueado.
4. **Feedback:** tag de sintonia nos cards da loja/Codex, toast ao instalar
   módulo AFIM/HARMÔNICO, linha de perfil na tela de pausa.

## 7. Loja

- `pickWeightedMoral` multiplica o peso de raridade pelo peso moral
  (só para módulos passivos; upgrades e armas seguem neutros).
- **Preço:** nenhum efeito de preço foi adicionado (Ganância = desconto
  global seria forte e simplista; os efeitos de preço existentes de
  `mEff.shopMul`/`upgMul` foram mantidos como estavam).
- Card do módulo mostra `SINTONIA: <EIXOS> · ATUAL: <NÍVEL>`.

## 8. Save Slots / Continue Run / Migração

- A moral pertence à run do slot (`smRoot.slots[i].run.moral`) — Save 1
  não contamina Save 2 (testado).
- `resumeRun` restaura os valores crus, recalcula `applyMoral()` e depois
  `applyMoralTuning()` — sintonia nunca é salva nem duplicada.
- Saves antigos: checkpoint sem `moral` → zeros; `sm` legado contendo ids
  `moral:item:*` é filtrado no load; itens sem afinidade são neutros.
  **Nenhum save antigo quebra.**
- Nova run: moral zerada (regra por-run pré-existente, preservada).

## 9. DEV MODE — seção MORALITY 2.0

Painel (`devRender`) mostra o **Moral Inspector**: raw C/G/V, normalizado,
estado, dominante/secundário, intensidade, e cada módulo instalado com
afinidade, match, nível e modificadores gerados.

Comandos (todos atrás de `DEV_MODE`; setters chamam `devTaint()` — run DEV
nunca gera checkpoint/Echo/progresso legítimo):

| API | Efeito |
|---|---|
| `DEV.setMoral(c,g,v)` / `setMoralAxis(axis,v)` | define valores crus (taint) |
| `DEV.moralPreset(id)` | `compassion·greed·violence·balanced·mix_cg·mix_gv·mix_cv·zero` (taint) |
| `DEV.moralRecalc()` | força recálculo completo (taint) |
| `DEV.moralProfile()` | inspetor (leitura pura) |
| `DEV.moralItems()` | catálogo com afinidade/match/nível (leitura pura) |
| `DEV.moralItemDebug(id)` | efeito base, afinidade, match, mods, peso de loja |
| `DEV.simulateMoralChoice(axis,n)` | escolha simulada pelo caminho real (`moralGain`) |

## 10. Como adicionar um item afinado

1. Crie o item em `ITEMS` normalmente (sem tocar em moral).
2. Adicione a entrada em `MORAL_AFFINITY` com vetor que **some 1** —
   apenas se fizer sentido mecânico; caso contrário, deixe neutro.
3. Pronto: sintonia, UI, loja, DEV e checkpoint funcionam automaticamente.

## 11. Como criar uma escolha moral

Use `evOpt(nome, descrição, [c,g,v], extra, disabled, fn)` dentro de um
evento — `fn` aplica a consequência imediata e o vetor alimenta
`moralGain`. Nunca escreva `moral.greed++` diretamente.

## 12. Balanceamento

Tudo em `MORAL_BALANCE` (sem magic numbers): tetos por item (3–8%),
**orçamento global por eixo** (`totalCaps`: −10% / +14% / +10%), viés de
loja (×1.10), viés de eventos (×1.30), cortes de nível e limiares de
perfil. Testes garantem: limites por item e por build, saturação aditiva,
escala proporcional, `mEff` legado intocado (snapshot numérico) e ausência
de monopólio no sorteio de eventos (simulação com 20k sorteios: perfil
extremo de Violência gera ~24% de eventos afins vs 20% de base — sem
feedback loop perigoso).

## 13. O que o PR 9 NÃO faz (limitações intencionais)

- Não altera trust, Dissonância, Resonance/Micro-Resonance, personalidade
  de Echo (PR 8) nem finais (`pickEnding`) — coberto por testes de fonte.
- Não há aprovação/rejeição do Echo (PR 10) nem finais morais (PR 10.5).
- Upgrades e armas não têm afinidade (decisão de escopo — módulos passivos
  são o vocabulário de build; pode ser expandido depois).
- Sem efeitos event-based por item (onKill/onShieldBreak específicos de
  sintonia) — os efeitos atuais são de stat, pequenos e contextuais.
- O viés de eventos é local e leve; direção procedural real é PR 13.

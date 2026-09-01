# ECHO — AUDITORIA PROFUNDA DOS INIMIGOS E MINIBOSSES HISTÓRICOS
## Relatório Completo de Análise

---

## A. SISTEMA DE INIMIGOS ATUAL

### EDEFS Atual (5 tipos)

| Tipo | HP | VEL | Raio | Dano | XP | Cor |
|------|-----|-----|------|------|-----|------|
| chaser | 26 | 238 | 13 | 10 | 5 | `#ff4d6d` |
| shooter | 36 | 150 | 15 | 8 | 7 | `#ffd166` |
| tank | 180 | 66 | 27 | 32 | 15 | `#ff2f5e` |
| spawner | 210 | 34 | 24 | 12 | 18 | `#39d98a` |
| anomaly | 44 | 186 | 14 | 18 | 12 | `#c56bff` |

### Sistema de Waves Atual

- **MAX_WAVE**: 20
- **MINI_WAVE**: 10 (única onda de miniboss)
- **ENEMY_BUDGET**: 46 entidades simultâneas

### `spawnWave(n)` — Fluxo

1. Zera `waveKills` e `harvStacks`
2. Se `n >= MAX_WAVE` → `spawnBoss()` (O Paradoxo)
3. Calcula composição via `waveComp(n)`
4. Spawna inimigos nas bordas (`edgeSpawn()`)
5. Adiciona elites (fixos + aleatórios via `eliteChance(n)`)
6. Se `n === MINI_WAVE` → `spawnMiniBoss(n)` e retorna

### `waveComp(n)` — Composição Atual

| Wave | Chaser | Shooter | Tank | Anomaly | Spawner | Elite |
|------|--------|---------|------|---------|---------|-------|
| 1 | 4 | 0 | 0 | 0 | 0 | 0 |
| 3 | 6 | 2 | 0 | 0 | 0 | 0 |
| 5 | 8 | 3 | 1 | 0 | 0 | 0 |
| 8 | 11 | 5 | 2 | 2 | 0 | 0 |
| 10 | 14 | 6 | 3 | 3 | 1 | 1 |
| 15 | 18 | 9 | 5 | 6 | 3 | 4 |
| 18 | 18 | 10 | 7 | 7 | 4 | 6 |

### Escalonamento

- **HP**: `diffHp(n) = 1 + .155*(n-1) + .014*(n-1)²` → onda 20 = ~4.3× base
- **Dano**: `diffDmg(n) = 1 + .062*(n-1)` → onda 20 = ~2.2× base
- **Velocidade**: `diffSpd(n) = min(1.62, 1 + .021*(n-1))` → teto de 1.62×
- **XP**: `diffXp(n) = 1 + .05*(n-1)` → onda 20 = ~2× base

### Elites

- `eliteChance(n) = n < 5 ? 0 : min(0.30, (n-4)*.028)`
- **Variantes**:
  - `shield`: escudo regenerativo (65% do maxHP, regen 5.5%/s)
  - `slow`: aura de lentidão (raio 142px + raio do elite)
- Modificadores: HP ×2.3, raio ×1.28, XP ×3, dano ×1.25

### Miniboss Atual: O Arauto da Fratura

- Spawn: **único**, onda 10
- HP: `(760 + n*46) * (1 + 0.10*echoQueue.length)`
- Raio: 44, Dano: `26 * diffDmg(n)`, Velocidade: `104 * diffSpd(n)`
- Placas: 6
- Ataques: investida telegrafada, rajada radial (9/14 projéteis), convocação de escolta (chaser)
- Fase 2: abaixo de 50% HP — acelera
- Recompensa: créditos +40 HP, projéteis inimigos limpos

### Boss: O Paradoxo

- Spawn: onda 20
- HP: `2200 + echoQueue.length*380`
- Adaptativo: analisa runs anteriores (melee vs ranged)
- 2 fases, invoca Ecos Sombrios
- 3 finais possíveis baseados em moralidade

### Funções Relacionadas

- `spawnWave(n)` — composição e spawn de onda
- `spawnEnemy(type,x,y,n)` — cria inimigo com escalonamento
- `updateEnemy(e,dt)` — IA de cada tipo
- `drawEnemy(e)` — renderização
- `killEnemy(e)` — morte, recompensas, splitter
- `damageEnemy(e,d,...)` — dano, ressonância, status
- `spawnMiniBoss(n)` — Arauto
- `spawnBoss()` — Paradoxo
- `waveComp(n)` — composição de onda
- `makeElite(e,variant)` — promoção para elite

---

## B. TABELA DOS 7 INIMIGOS HISTÓRICOS

| ID | HP | VEL | Raio | Dano | XP | Cor | Categoria |
|----|-----|-----|------|------|-----|------|-----------|
| swarm | 12 | 322 | 9 | 6 | 3 | `#ff8df5` | Arquétipo inicial |
| orbiter | 34 | 205 | 12 | 9 | 6 | `#8ff6ff` | Arquétipo inicial |
| bulwark | 78 | 112 | 18 | 16 | 9 | `#c9a9ff` | Arquétipo inicial |
| splitter | 62 | 168 | 16 | 13 | 11 | `#ff9d3c` | Ameaça ≥1 |
| phantom | 52 | 212 | 13 | 15 | 14 | `#bffbff` | Ameaça ≥2 |
| reaper | 132 | 150 | 20 | 26 | 22 | `#ff2f5e` | Ameaça ≥3 |
| singular | 190 | 96 | 24 | 24 | 30 | `#ff4df0` | Ameaça ≥4 |

---

## C. FUNCIONAMENTO DETALHADO DE CADA INIMIGO

### 1. SWARM (ENXAME)

**IDENTIDADE**
- ID: `swarm`
- Nome: ENXAME
- Cor: `#ff8df5` (rosa neon)
- Raio: 9 (muito pequeno)
- HP: 12 (extremamente frágil)
- Velocidade: 322 (muito rápido — segundo mais rápido depois do anomaly em investida)
- Dano: 6 (baixo por contato, mas acumula em bando)
- XP: 3 (recompensa mínima)

**COMPORTAMENTO**
- Movimento: Investida em zigue-zague (`e.wob` oscila com frequência 7.5)
- Calcula direção perpendicular ao alvo e adiciona componente senoidal
- Não dispara projéteis — puramente contato
- Persegue o jogador diretamente com oscilação lateral
- Sem comportamento defensivo

**MECÂNICAS**
- Spawna em grande quantidade (2-12+ conforme onda)
- Força movimentação constante pela pressão numérica
- Frágil: morre com quase qualquer projétil
- Sem interação com Echos (prioridade padrão)
- Sem imunidades

**SPAWN**
- Wave mínima: 1 (desde o início)
- Quantidade: `clamp(2 + floor(n*0.78), 2, 12)`
- Wave 5 = ~5, Wave 10 = ~9, Wave 15 = ~12
- Sob ameaça: multiplicado por `threatCount()`

**CÓDIGO**
- Campo especial: `e.wob` (fase do zigue-zague)
- Branch em `updateEnemy()`: bloco `if(e.type==='swarm')` com zigue-zague
- Branch em `drawEnemy()`: asas vibrando + corpo alongado + olho
- Branch em `spawnWave()`: listado primeiro após chaser

**AMEAÇA**: **B — pequena**
O swarm não depende diretamente da ameaça, mas seu *count* é multiplicado por `threatCount()`. A mecânica base funciona sem ameaça.

---

### 2. ORBITER (ORBITADOR)

**IDENTIDADE**
- ID: `orbiter`
- Nome: ORBITADOR
- Cor: `#8ff6ff` (ciano claro)
- Raio: 12
- HP: 34 (moderado)
- Velocidade: 205 (média)
- Dano: 9
- XP: 6

**COMPORTAMENTO**
- Mantém distância fixa de 210px do alvo
- Circula o alvo (tangencial), alternando direção aleatoriamente
- Dispara rajadas de projéteis (`eorb` ciano, raio 5, velocidade 380) a cada 1.9-2.6s
- Se distância < 430px, pode atirar
- Muda direção de órbita com 18% de chance por segundo

**MECÂNICAS**
- Força o jogador a mirar liderando o alvo
- Combinação perfeita com chaser (pressão melee enquanto orbita)
- Projéteis: `eorb`, cor `#8ff6ff`
- Sem imunidades

**SPAWN**
- Wave mínima: 2
- Quantidade: `clamp(1 + floor(n*0.45), 0, 7)`
- Sob ameaça: count multiplicado

**CÓDIGO**
- Campos: `e.orbDir` (direção de órbita ±1), `e.fireT`
- Branch `if(e.type==='orbiter')` em updateEnemy com lógica de órbita
- Draw: anel giratório + núcleo + emissor + satélites

**AMEAÇA**: **B — pequena**
Não depende de ameaça para existir; apenas tem quantidade multiplicada.

---

### 3. BULWARK (BLINDADO)

**IDENTIDADE**
- ID: `bulwark`
- Nome: BLINDADO
- Cor: `#c9a9ff` (lilás)
- Raio: 18
- HP: 78 (resistente)
- Velocidade: 112 (lento)
- Dano: 16
- XP: 9

**COMPORTAMENTO**
- Persegue o jogador lentamente
- **Escudo frontal**: `e.shieldAng` = ângulo voltado para o alvo
- Dano recebido de frente (cone de ~2.05 radianos) é reduzido para 28% (72% bloqueado)
- Dano pelas costas causa valor cheio
- Velocidade reduzida a 90% durante comportamento de escudo

**MECÂNICAS**
- Ensina posicionamento e flanqueamento
- Float text "BLOQUEADO" quando o escudo absorve
- Partículas lilás no ponto de impacto bloqueado
- Sem imunidades, sem resistência a status

**SPAWN**
- Wave mínima: 4
- Quantidade: `clamp(floor((n-2)/2.8), 0, 5)`
- Wave 4 = ~0-1, Wave 10 = ~2, Wave 15 = ~4

**CÓDIGO**
- Campo: `e.shieldAng` (ângulo do escudo frontal)
- Branch em `damageEnemy()`: verificação de ângulo de impacto vs `e.shieldAng`
- Branch em `updateEnemy()`: `if(e.type==='bulwark') e.shieldAng=Math.atan2(dy,dx)`
- Draw: corpo pentagonal + arco frontal brilhante (escudo) + suportes

**AMEAÇA**: **A — nenhuma**
Não depende de ameaça para existir. Entra na composição padrão pela wave.

---

### 4. SPLITTER (CISÃO)

**IDENTIDADE**
- ID: `splitter`
- Nome: CISÃO
- Cor: `#ff9d3c` (laranja)
- Raio: 16
- HP: 62
- Velocidade: 168
- Dano: 13
- XP: 11

**COMPORTAMENTO**
- Persegue o jogador normalmente
- Sem projéteis ou habilidades especiais ativas
- Ao morrer (versão original, não fragmento): gera 2 fragmentos menores

**MECÂNICAS**
- **Cisão na morte**: 2 fragmentos com:
  - `isShard = true`
  - Raio ×0.62 (~10)
  - HP = 35% do maxHP original
  - Velocidade ×1.35
  - XP = 40% do original
  - Spawn delay: 0.25s
- Respeita `ENEMY_BUDGET` (não spawna se estourar o teto)
- Efeito visual: anel laranja ao dividir

**SPAWN**
- **Dependência: Ameaça ≥ 1**
- Quantidade: `threat >= 1 ? clamp(1 + floor(n/4), 0, 5) : 0`
- Wave 4 = 2, Wave 10 = 3, Wave 15 = 4

**CÓDIGO**
- Campo: `e.isShard` (flag para fragmento)
- Branch em `killEnemy()`: `if(e.type==='splitter' && !e.isShard)` gera 2 novos
- Draw: forma pentagonal rachada com fissura visível

**AMEAÇA**: **D — forte**
Inexistente sem ameaça ≥ 1. É inteiramente desbloqueado pelo sistema de ameaça.

---

### 5. PHANTOM (LEVIANO)

**IDENTIDADE**
- ID: `phantom`
- Nome: LEVIANO
- Cor: `#bffbff` (branco-ciano translúcido)
- Raio: 13
- HP: 52
- Velocidade: 212
- Dano: 15
- XP: 14

**COMPORTAMENTO**
- Ciclo de fases:
  - **Fase sólida** (~2.2-3.4s): vulnerável, persegue normalmente
  - **Fase fantasma** (~1.3s): intangível, velocidade ×1.5
- Transições geram partículas

**MECÂNICAS**
- **Intangibilidade total**: `if(e.type==='phantom' && e.ghostT > 0) return;` em `damageEnemy()`
- Enquanto fantasma:
  - Imune a todo dano
  - 50% mais rápido
  - Visual translúcido (alpha 0.28)
- Períodos de vulnerabilidade curtos exigem timing
- Sem interação especial com Echos

**SPAWN**
- **Dependência: Ameaça ≥ 2**
- Quantidade: `threat >= 2 ? clamp(1 + floor(n/5), 0, 4) : 0`

**CÓDIGO**
- Campos: `e.phT` (timer de fase), `e.ghostT` (timer de intangibilidade)
- Branch em `damageEnemy()`: early return se fantasma
- Branch em `updateEnemy()`: lógica de alternância de fase
- Draw: silhueta curva com preenchimento translúcido quando sólido, apenas contorno quando fantasma

**AMEAÇA**: **D — forte**
Inexistente sem ameaça ≥ 2. Toda a mecânica de intangibilidade existe por causa do sistema de ameaça.

---

### 6. REAPER (CARRASCO)

**IDENTIDADE**
- ID: `reaper`
- Nome: CARRASCO
- Cor: `#ff2f5e` (vermelho intenso)
- Raio: 20 (grande)
- HP: 132 (alto)
- Velocidade: 150 (moderada, mas escala)
- Dano: 26 (alto)
- XP: 22 (recompensa significativa)

**COMPORTAMENTO**
- Persegue implacavelmente o jogador
- **Acelera com o tempo**: `e.rage` cresce de 0.06/s até máximo 1.8×
- Partículas vermelhas constantes enquanto persegue
- Sem projéteis — contato direto

**MECÂNICAS**
- Progressão de ameaça: começa moderado, torna-se extremamente perigoso se não for eliminado rápido
- Aceleração constante recompensa foco de dano (priorizar reaper)
- Se ignorado, torna-se o inimigo mais rápido da arena
- Sem imunidades, mas alta vida exige investimento para eliminar

**SPAWN**
- **Dependência: Ameaça ≥ 3**
- Quantidade: `threat >= 3 ? clamp(floor(n/6), 0, 3) : 0`

**CÓDIGO**
- Campo: `e.rage` (multiplicador de velocidade, começa em 1.0, vai até 1.8)
- Branch em `updateEnemy()`: `if(e.type==='reaper')` com acúmulo de rage
- Draw: manto + lâmina curva (foice) + olhos gêmeos
- Efeito de brilho cresce com a raiva: `shadowBlur = 10 + rg*14`

**AMEAÇA**: **D — forte**
Inexistente sem ameaça ≥ 3.

---

### 7. SINGULAR (SINGULARIDADE)

**IDENTIDADE**
- ID: `singular`
- Nome: SINGULAR
- Cor: `#ff4df0` (magenta)
- Raio: 24 (grande)
- HP: 190 (muito alto — segundo só ao tank)
- Velocidade: 96 (muito lento)
- Dano: 24
- XP: 30 (maior recompensa entre os comuns)

**COMPORTAMENTO**
- Extremamente lento, persegue o jogador
- **Puxa o jogador**: dentro de 420px, aplica força gravitacional proporcional à distância
  - Pull: `(1 - d/420) * 260 * dt` no velocity do jogador
- **Reflete dano**: 35% de chance de refletir 25% do dano recebido de volta ao jogador (apenas dano direto, não DoT)

**MECÂNICAS**
- **Campo gravitacional**: distorce o movimento do jogador, impedindo fuga
- **Reflexão de dano**: `if(e.type==='singular' && curAttacker===player && !isDot && Math.random()<.35)` → dano ao jogador
- Combinação perigosa: o jogador é puxado PARA o singular enquanto toma dano ao atacá-lo
- Anéis gravitacionais colapsando (visual)
- Sem imunidades a status

**SPAWN**
- **Dependência: Ameaça ≥ 4**
- Quantidade: `threat >= 4 ? clamp(floor(n/8), 0, 2) : 0`

**CÓDIGO**
- Campos: `e.pulseA` (fase dos anéis gravitacionais)
- Branch em `updateEnemy()`: lógica de pull gravitacional
- Branch em `damageEnemy()`: reflexão de dano
- Draw: anéis colapsando + núcleo escuro com gradiente radial

**AMEAÇA**: **E — impossível separar sem reconstrução**
É o inimigo de Ameaça 4, o nível máximo. Depende inteiramente do sistema de ameaça para existir.

---

## D. DEPENDÊNCIAS DO SISTEMA DE AMEAÇA

### O Sistema de Ameaça (legado)

```
const THREAT_NAME = ['ESTÁVEL','INSTÁVEL','CRÍTICO','COLAPSO','SINGULAR'];
const THREAT_COLOR = ['#9db8c8','#ffd166','#ff9d3c','#ff4d6d','#ff4df0'];
```

**Módulos que subiam ameaça:**
- `thr_pacto` (Pacto de Escalada): Ameaça +1, +55% créditos e XP
- `thr_farol` (Farol de Sangue): Ameaça +2, +40% dano e +90% créditos
- `thr_selo` (Selo Rompido): Ameaça +3, dobra créditos e XP

**Efeitos da ameaça:**
- `threatHp() = 1 + threat * .22` → até 1.88× HP
- `threatSpd() = 1 + threat * .07` → até 1.28× velocidade
- `threatDmg() = 1 + threat * .15` → até 1.60× dano
- `threatCount() = 1 + threat * .14` → até 1.56× quantidade

**Desbloqueio de arquétipos:**
- Ameaça 1: splitter
- Ameaça 2: phantom
- Ameaça 3: reaper
- Ameaça 4: singular

### Situação Atual

O sistema de ameaça **foi removido** do ECHO atual. Não existe mais `threat`, `addThreat()`, `THREAT_NAME`, nem os módulos catalisadores (`thr_pacto`, `thr_farol`, `thr_selo`).

Os módulos de amplificação elemental (`el_fogo`, `el_gelo`, etc.) e utilitários (`su_sorte`, `su_exec`, etc.) também foram removidos.

### Classificação Final de Dependência

| Inimigo | Nível | Justificativa |
|---------|-------|---------------|
| swarm | B | Existe desde wave 1; ameaça apenas multiplica quantidade |
| orbiter | B | Existe desde wave 2; ameaça apenas multiplica quantidade |
| bulwark | A | Nenhuma dependência; entra pela wave 4 naturalmente |
| splitter | D | Inexistente sem ameaça ≥ 1; mecânica de cisão é autônoma |
| phantom | D | Inexistente sem ameaça ≥ 2; intangibilidade é autônoma |
| reaper | D | Inexistente sem ameaça ≥ 3; aceleração é autônoma |
| singular | E | Inexistente sem ameaça ≥ 4; reflexão + gravidade são autônomas mas inteiramente dependentes do gatilho |

---

## E. RANKING DOS 7 INIMIGOS

### Nota Técnica (0-10) e Nota de Design (0-10)

| Inimigo | Originalidade | Diversão | Clareza Visual | Diferença | Sinergia | Implementação | Valor | MÉDIA |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| swarm | 4 | 7 | 9 | 3 | 8 | 9 | 6 | **6.6** |
| orbiter | 8 | 8 | 7 | 9 | 9 | 9 | 8 | **8.3** |
| bulwark | 9 | 9 | 8 | 9 | 7 | 9 | 9 | **8.6** |
| splitter | 7 | 7 | 6 | 8 | 6 | 9 | 7 | **7.1** |
| phantom | 8 | 8 | 5 | 9 | 7 | 8 | 8 | **7.6** |
| reaper | 6 | 7 | 7 | 6 | 6 | 9 | 7 | **6.9** |
| singular | 10 | 8 | 8 | 10 | 8 | 8 | 9 | **8.7** |

### Análise Individual

**Swarm**: Simples mas eficaz. Preenche a arena e força movimentação. Baixa originalidade (enxames são comuns em roguelites). Implementação trivial.

**Orbiter**: Excelente adição. Obriga mira preditiva, cria tensão entre gerenciar melee e lidar com dano à distância. Muito diferente do que existe.

**Bulwark**: Excelente design tático. Ensina flanqueamento. O escudo frontal é uma mecânica elegante que diferencia completamente dos outros tipos.

**Splitter**: Conceito forte (mata-1-viram-2), mas a execução é simples. O risco é frustração com snowball de fragmentos. Funciona melhor como suporte do que como ameaça principal.

**Phantom**: Design fascinante. A intangibilidade cíclica cria janelas de DPS que recompensam timing e planejamento. O risco é clareza visual — o jogador precisa entender *quando* pode atacar.

**Reaper**: Conceito sólido (perseguidor que acelera) mas pouco diferente do chaser no dia a dia. A raiva crescente é a única mecânica real. Funciona como "upgrade do chaser" mais do que como arquétipo próprio.

**Singular**: Design genial. Campo gravitacional + reflexão de dano cria um paradoxo: você precisa se aproximar para matar, mas se aproximar é punido. É o inimigo com mais personalidade e mais potencial de interações táticas.

---

## F. RECOMENDAÇÃO POR INIMIGO

| Inimigo | Veredito | Justificativa |
|---------|----------|---------------|
| **swarm** | **RESTAURAR QUASE IGUAL** | Simples, divertido, sem dependências. Preenche lacuna de "enxame frágil" que falta no atual. Trivial de implementar. |
| **orbiter** | **RESTAURAR QUASE IGUAL** | Adiciona profundidade de mira. Comportamento único. Baixo custo de implementação. Alta sinergia com chaser. |
| **bulwark** | **RESTAURAR QUASE IGUAL** | Escudo frontal é mecânica elegante que ensina posicionamento. Não depende de nada do sistema antigo. Diferencia muito dos atuais. |
| **splitter** | **ADAPTAR** | Conceito bom mas precisa de ajuste. Separar do sistema de ameaça. Considerar limite de fragmentos (máx 1 geração). Bom para waves avançadas. |
| **phantom** | **ADAPTAR** | Intangibilidade é fascinante mas precisa de clareza visual melhorada no sistema atual. Separar da ameaça. Janelas de vulnerabilidade mais longas para legibilidade. |
| **reaper** | **REDESENHAR** | Muito parecido com chaser. A aceleração é a única diferença. Merece mecânica adicional para justificar existência separada, OU fundir com o chaser como variante. |
| **singular** | **ADAPTAR** | Design brilhante mas precisa ser desvinculado da ameaça. Campo gravitacional + reflexão funcionam sem o sistema antigo. Colocar em waves altas (15+) como "mini-ameaça" natural. |

---

## G. SINERGIAS ENTRE INIMIGOS

### Combinações que Criam Situações Táticas Novas

**1. Enxame + Orbitador + Tanque**
- Enxame força movimento, orbitador punição estacionária, tanque absorve dano
- Exige: gerenciar múltiplas camadas de ameaça
- Perigo: baixo — todos são arquetipos básicos

**2. Bulwark + Orbitador**
- Bulwark obriga flanqueamento, orbitador circula e atira
- O jogador precisa posicionar-se contra ambos simultaneamente
- Exige: consciência posicional 360°
- Perigo: médio — o orbitador pode ser ignorado se o bulwark for a prioridade

**3. Phantom + Chaser**
- Phantom desaparece quando atacado, chaser pressiona constantemente
- Jogador precisa decidir: atacar phantom nas janelas ou lidar com chaser?
- Exige: gerenciamento de timing e priorização
- Perigo: médio — phantom é frágil quando sólido

**4. Swarm + Singular**
- Enxame empurra o jogador para dentro do campo gravitacional do singular
- Combinação de pressão numérica + controle espacial
- Exige: manter distância do singular enquanto limpa o enxame
- Perigo: alto — fácil ser sugado para o singular sem perceber

**5. Bulwark + Swarm**
- Bulwark com escudo frontal é difícil de matar; enxame força o jogador a se reposicionar para longe do ângulo ideal de flanqueamento
- Exige: paciência e movimentação calculada
- Perigo: médio — frustração se o enxame for grande demais

**6. Orbiter + Anomaly (atual)**
- Orbitador circula e atira; Anomaly teleporta atrás do jogador
- Ameaça de 360° + dano posicional
- Exige:Awareness completo do espaço
- Perigo: alto — pode ser esmagador em ondas avançadas

**7. Splitter + Orbitador + Chaser**
- Splitter se divide ao morrer, orbitador cobre as costas, chaser pressiona
- Cada splitter morto cria mais caos enquanto o orbitador atira
- Exige: eliminar splitteres rápido e controlar o espaço
- Perigo: médio-alto — snowball de fragmentos se o jogador focar errado

**8. Phantom + Shooter (atual)**
- Phantom desaparece quando atacado, shooter mantém distância e dispara
- Jogador não pode focar ambos — se atacar phantom, shooter atira livre; se atacar shooter, phantom reaparece atrás
- Exige: alternância de foco com timing
- Perigo: alto — pode ser extremamente frustrante

**9. Singular + Tank**
- Singular puxa o jogador; tank bloqueia o caminho
- O jogador é puxado contra o tank, ficando preso entre dois perigos
- Exige: movimentação anti-gravitacional constante
- Perigo: alto — muito difícil escapar sem dash

**10. Swarm + Phantom + Reaper**
- Enxame numérico, phantom com janelas de DPS, reaper que acelera
- Pressão total: mover-se, timing, priorização
- Exige: excelência em todas as mecânicas
- Perigo: muito alto — apenas waves finais

**11. Bulwark + Singular + Orbiter**
- Trindade de controle: flanqueamento (bulwark), gravidade (singular), distância (orbiter)
- Exige: o jogador precisa resolver 3 problemas táticos simultaneamente
- Perigo: extremo — combinação de boss em wave avançada

**12. Splitter + Spawner (atual)**
- Splitter gera fragmentos ao morrer; spawner gera chasers
- Arena satura progressivamente, mesmo sem o jogador agir
- Exige: eliminar spawners primeiro ou limpar rapidamente
- Perigo: alto — estoura ENEMY_BUDGET rapidamente; precisa de limite

---

## H. LISTA COMPLETA DOS MINIBOSSES HISTÓRICOS

Encontrei **exatamente 10 minibosses** na tabela `MINIBOSS`:

| # | ID | Nome | Cor | HP Mult | VEL Mult | Raio | Placas | Skills |
|---|-----|------|-----|:-------:|:--------:|:----:|:------:|--------|
| 1 | herald | O ARAUTO DA FRATURA | `#ff9d3c` | 1.0 | 1.0 | 44 | 6 | charge, burst, summon |
| 2 | weaver | A TECELÃ DE VAZIO | `#c56bff` | 0.85 | 1.25 | 38 | 4 | teleport, spiral, grav |
| 3 | furnace | A FORNALHA VIVA | `#ff5c2f` | 1.25 | 0.72 | 48 | 7 | burn, nova, trail |
| 4 | sentinel | A SENTINELA ESPELHADA | `#8ff6ff` | 1.05 | 0.9 | 42 | 8 | reflect, beamRot, shieldUp |
| 5 | brood | A MATRIZ PROLÍFERA | `#39d98a` | 1.15 | 0.62 | 46 | 5 | swarmSpawn, heal, burst |
| 6 | duelist | O DUELISTA FANTASMA | `#ff3d68` | 0.70 | 1.55 | 34 | 3 | blink, slash, afterimage |
| 7 | colossus | O COLOSSO DORMENTE | `#ff2f5e` | 1.75 | 0.45 | 56 | 10 | quake, slam, armor |
| 8 | oracle | O ORÁCULO DISSONANTE | `#ffd166` | 0.90 | 1.0 | 40 | 5 | predict, spiral, curse |
| 9 | leech | O SANGUESUGA TEMPORAL | `#a8ff3d` | 1.0 | 1.1 | 40 | 4 | drain, corrode, summon |
| 10 | twin | OS GÊMEOS DIVERGENTES | `#ff4df0` | 0.60 | 1.3 | 32 | 3 | split, burst, link |

---

## I. FUNCIONAMENTO DETALHADO DOS MINIBOSSES

### Todos compartilham a base do Arauto:
- `spawnMiniBossVariant(n, def)` — HP = `(520 + n*54) * def.hp * scale * (1 + 0.08*echoQueue.length)`
- Escala: `scale = 1 + (n-5) * 0.10`
- Fase 2: abaixo de 50% HP
- Placas de blindagem (quebram progressivamente)
- Investida telegrafada + rajada radial + convocação de escolta (herdado do herald)

### 1. O ARAUTO DA FRATURA (herald)

**CONCEITO**: Juggernaut com investidas pesadas
**STATS**: HP ×1.0, VEL ×1.0, Raio 44, 6 placas
**ATAQUES**:
- **Investida telegrafada**: telegraph 0.85s (fase 2: 0.62s) → dash a 980/1180px/s por 0.45/0.55s. Dano ×1.35 no impacto
- **Rajada radial**: 9 projéteis (fase 2: 14) a cada 3.2s (fase 2: 2.0s). Velocidade 300, dano ×0.42
- **Escolta**: 2 chasers (fase 2: 3) a cada 11s (fase 2: 7s)
**IA**: Aproximação constante e pesada, investida periódica
**RECOMPENSA**: 120 créditos, +40 HP, limpa projéteis

### 2. A TECELÃ DE VAZIO (weaver)

**CONCEITO**: Controladora espacial com teleporte e gravidade
**STATS**: HP ×0.85, VEL ×1.25, Raio 38, 4 placas
**ATAQUES**:
- **Teleporte**: a cada 4.5s, teletransporta para perto do jogador em ângulo aleatório
- **Espiral**: projéteis em padrão espiral (compartilhado com oracle)
- **Campo gravitacional**: ancora campos que puxam o jogador
**IA**: Alta mobilidade, reposiciona constantemente, mantém pressão de área

### 3. A FORNALHA VIVA (furnace)

**CONCEITO**: Tanque incendiário com rastro de fogo
**STATS**: HP ×1.25, VEL ×0.72, Raio 48, 7 placas
**ATAQUES**:
- **Rastro de fogo**: a cada 0.28s deixa projétil estático (raio 16, dano ×0.30, vida 4.5s)
- **Nova incendiária**: a cada 6.5s, explosão de 260px que causa dano ×0.8
- Investida + rajada heredadas
**IA**: Lenta mas deixa o terreno perigoso; área negada progressiva

### 4. A SENTINELA ESPELHADA (sentinel)

**CONCEITO**: Defensora que reflete e pune abordagem frontal
**STATS**: HP ×1.05, VEL ×0.9, Raio 42, 8 placas
**ATAQUES**:
- **Reflexão**: escudo cíclico (2.6s ativo, 4s cooldown) que reflete projéteis
- **Feixes rotativos**: 3 feixes que giram a 1.5 rad/s, dano ×0.5 ao contato
- **Escudo defensivo**: alternância entre escudo ativo e vulnerável
**IA**: Defensiva, mantém distância média, pune jogadores agressivos

### 5. A MATRIZ PROLÍFERA (brood)

**CONCEITO**: Geradora de enxames com regeneração
**STATS**: HP ×1.15, VEL ×0.62, Raio 46, 5 placas
**ATAQUES**:
- **Spawn de enxame**: a cada 4.2s, gera 3 swarms ao redor (respeita ENEMY_BUDGET)
- **Regeneração**: 1.2% do maxHP por segundo continuamente
- Rajada radial herdada
**IA**: Muito lenta, ancora-se e gera criaturas continuamente. Precisa ser eliminada rápido

### 6. O DUELISTA FANTASMA (duelist)

**CONCEITO**: Lutador corpo-a-corpo extremamente rápido
**STATS**: HP ×0.70, VEL ×1.55, Raio 34, 3 placas
**ATAQUES**:
- **Blink**: teleporte ofensivo a cada 2.6s, reposiciona PRA CIMA do jogador (ângulo PI)
- **Slash**: investida curta telegrafada (0.28s) após blink
- **Afterimage**: rastro fantasma visual
**IA**: Agressiva, sempre buscando corpo-a-corpo, teleporta para fechar distância

### 7. O COLOSSO DORMENTE (colossus)

**CONCEITO**: Juggernaut extremo com tremor sísmico
**STATS**: HP ×1.75, VEL ×0.45, Raio 56, 10 placas
**ATAQUES**:
- **Tremor sísmico (quake)**: a cada 5.5s, onda de 300px, dano ×0.7 + knockback de 520
- Investida + rajada heredadas (mais lentas)
**IA**: Lentíssimo, praticamente imóvel, mas cada ataque cobre área massiva

### 8. O ORÁCULO DISSONANTE (oracle)

**CONCEITO**: Controlador que prevê e enfraquece
**STATS**: HP ×0.90, VEL ×1.0, Raio 40, 5 placas
**ATAQUES**:
- **Previsão**: prevê movimentos do jogador (spiral calibrada)
- **Espiral**: projéteis em espiral
- **Maldição**: a cada 9s, aplica `curseT = 6` → dano do jogador -30% por 6s
**IA**: Mantém distância, usa debuffs para enfraquecer, ataca com padrões preditivos

### 9. O SANGUESUGA TEMPORAL (leech)

**CONCEITO**: Drenador que rouba vida à distância
**STATS**: HP ×1.0, VEL ×1.1, Raio 40, 4 placas
**ATAQUES**:
- **Dreno**: a cada 5s, canaliza por 2.2s → dano ×0.13 por tick + cura ×0.20 + arco visual
- **Corrosão**: aplica corrode ao jogador continuamente (50% chance/s, dur 3s, pow 0.1)
- **Escolta**: herda summon
**IA**: Mantém distância média, prioriza dreno, corrói armadura passivamente

### 10. OS GÊMEOS DIVERGENTES (twin)

**CONCEITO**: Par vinculado com cura mútua
**STATS**: HP ×0.60, VEL ×1.3, Raio 32, 3 placas
**ATAQUES**:
- **Split**: sempre spawna em par (se apenas 1 slot, cria 2 vinculados)
- **Cura mútua (link)**: 0.8% do maxHP/s por tick, com arco visual entre eles
- Rajada radial herdada
**IA**: Velozes, se separam e se reencontram. Precisam ser mortos SIMULTANEAMENTE ou rapidamente

---

## J. DEPENDÊNCIAS DOS MINIBOSSES

### Sistema de Spawn (legado)

```
const MINI_WAVES = [5, 10, 15];  // ondas com mini-chefes
```

**Quantidade**:
- Onda 5: 1 miniboss (filtra: HP ≤ 1.15 → exclui colossus, furnace)
- Onda 10: 1-2 (pool completo)
- Onda 15: 1-2 (filtra: HP ≥ 0.7 → exclui os mais frágeis)

**Todos compartilham**: investida telegrafada + rajada radial + convocação de escolta (base do herald).

**Skills especiais** são implementadas via objeto `sk`:
- `charge`, `burst`, `summon` → herald (base)
- `teleport`, `spiral`, `grav` → weaver
- `burn`, `nova`, `trail` → furnace
- `reflect`, `beamRot`, `shieldUp` → sentinel
- `swarmSpawn`, `heal`, `burst` → brood
- `blink`, `slash`, `afterimage` → duelist
- `quake`, `slam`, `armor` → colossus
- `predict`, `spiral`, `curse` → oracle
- `drain`, `corrode`, `summon` → leech
- `split`, `burst`, `link` → twin

### Dependências de Sistemas Removidos

- **Nenhum miniboss depende diretamente do sistema de ameaça** para existir
- Todos usam `mEff.enemySpd` e `mEff.enemyAggr` (ainda existem no sistema de moralidade atual)
- `swarmSpawn` do brood usa `spawnEnemy('swarm',...)` — depende do tipo swarm existir
- O `applyStatus(p,'corrode',...)` do leech usa o sistema de status atual (ainda existe)
- `p.curseT` do oracle: **não existe** no código atual — precisa ser recriado
- `p.elemPow` do oracle: **não existe** no código atual

---

## K. COMPARAÇÃO COM O ARAUTO DA FRATURA

### O Arauto Atual (único miniboss)

| Aspecto | Valor |
|---------|-------|
| HP | `(760 + 10*46) * 1.1 ≈ 1340` (com 1 Echo) |
| Velocidade | `104 * diffSpd(10) ≈ 123` |
| Dano | `26 * diffDmg(10) ≈ 40` |
| Raio | 44 |
| Placas | 6 |
| Ataques | 3: investida, rajada, escolta |
| Fases | 2 (abaixo de 50%) |
| Complexidade | Baixa-média |

### Comparação Direta

| Miniboss | HP Relativo | Complexidade | vs Arauto |
|----------|:-----------:|:------------:|-----------|
| herald (base) | 1.0× | Baseline | = Arauto atual |
| weaver | 0.85× | Alta (teleporte + gravidade) | Mais complexo: controle espacial |
| furnace | 1.25× | Média (área negada) | Mais HP, mecânica diferente |
| sentinel | 1.05× | Alta (reflexão + feixes) | Muito mais complexo: pune agressão |
| brood | 1.15× | Baixa (spawn + regen) | Mais passivo; pressão por tempo |
| duelist | 0.70× | Média (blink + slash) | Mais rápido, mais frágil, diferente |
| colossus | 1.75× | Baixa (tremor + tank) | Mais HP, muito mais lento |
| oracle | 0.90× | Alta (maldição + spiral) | Debuff único: reduz dano |
| leech | 1.0× | Alta (dreno + corrode) | Mais versátil: drena + corrói |
| twin | 0.60× | Média (cura mútua) | Mecânica única: kill order importa |

### Classificação

| Miniboss | Classificação | Justificativa |
|----------|:-------------:|---------------|
| herald | **Referência** | É o próprio Arauto atual |
| weaver | **Miniboss** | Teleporte + gravidade = experiência completa |
| furnace | **Miniboss** | HP alto + área negada = tank check diferenciado |
| sentinel | **Miniboss** | Complexidade alta, merece estar |
| brood | **Miniboss** | Pressão temporal única |
| duelist | **Elite avançado ou Miniboss menor** | Frágil demais para miniboss; poderia ser "super elite" |
| colossus | **Boss ou Miniboss final** | HP extremo + mecânica de tremor = encontro de pico |
| oracle | **Miniboss** | Maldição é mecânica única e interessante |
| leech | **Miniboss** | Dreno + corrosão = pressão dupla |
| twin | **Miniboss especial** | Par vinculado = mecânica única |

---

## L. RANKING DOS MINIBOSSES

| Rank | Miniboss | Nota | Recomendação |
|:----:|----------|:----:|-------------|
| 1 | Colosso Dormente | 9.0 | Restaurar como miniboss de onda 15+ |
| 2 | Sentinela Espelhada | 8.8 | Restaurar — reflexão de projéteis é brilhante |
| 3 | Tecelã de Vazio | 8.5 | Restaurar — controle espacial é excelente |
| 4 | Oráculo Dissonante | 8.3 | Restaurar — maldição é mecânica única |
| 5 | Sanguesuga Temporal | 8.0 | Restaurar — dreno é pressão interessante |
| 6 | Fornalha Viva | 7.8 | Restaurar — área negada é diversificada |
| 7 | Matriz Prolífera | 7.5 | Adaptar — spawn de swarm precisa do swarm existir |
| 8 | Gêmeos Divergentes | 7.3 | Adaptar — mecânica de par é única mas frágil |
| 9 | Arauto da Fratura | 7.0 | Já existe; manter como referência |
| 10 | Duelista Fantasma | 6.5 | Redesenhar ou promover a elite avançado |

---

## M. NOVA ESTRUTURA SUGERIDA DE ENCONTROS

### Proposta: Escalonamento em 3 Atos

```
ONDA 1-4:  AQUECIMENTO
           Tipos base: chaser, swarm, orbiter
           Introdução gradual de bulwark
           Sem miniboss, sem elite

ONDA 5:    PRIMEIRO ENCONTRO ESPECIAL
           Pool de 3 minibosses leves
           → Duelista Fantasma (redesenhado)
           → Matriz Prolífera
           → Sanguesuga Temporal
           1 miniboss, HP reduzido

ONDA 6-9:  ESCALADA
           Tipos expandidos: shooter, tank, anomaly, splitter
           Elites começam a aparecer
           Variedade crescente

ONDA 10:   ARAUTO OU EQUIVALENTE
           Pool de 3 minibosses médios
           → Arauto da Fratura
           → Fornalha Viva
           → Oráculo Dissonante
           1 miniboss, força total

ONDA 11-14: ZONA DE PRESSÃO
            Todos os tipos disponíveis
            phantom, reaper como "ameaças naturais" (sem sistema de threat)
            Elites frequentes

ONDA 15:   MINIBOSS AVANÇADO
           Pool de 4 minibosses pesados
           → Sentinela Espelhada
           → Tecelã de Vazio
           → Colosso Dormente
           → Gêmeos Divergentes
           1-2 minibosses

ONDA 16-19: PREPARAÇÃO FINAL
            Combinações densas, singular natural
            Elites abundantes

ONDA 20:   BOSS — O PARADOXO
```

### Critérios de Seleção de Pool

- **Pool leve (onda 5)**: HP mult ≤ 1.15, focado em introduzir mecânicas
- **Pool médio (onda 10)**: todos disponíveis, balanceia complexidade
- **Pool pesado (onda 15)**: HP mult ≥ 0.9, prefere complexidade alta

---

## N. SISTEMA SUGERIDO PARA VARIEDADE ENTRE RUNS

### Pool de Minibosses por Slot

```
ONDA 5 (leve):
  1 de 3 → Duelista | Matriz | Sanguesuga
  
ONDA 10 (médio):
  1 de 3 → Arauto | Fornalha | Oráculo
  
ONDA 15 (pesado):
  1-2 de 4 → Sentinela | Tecelã | Colosso | Gêmeos
```

### "Temas de Onda" (Famílias)

Cada run poderia ter um **tema** definido na onda 1 que influencia a composição:

| Tema | Foco | Tipos Favorecidos | Sensação |
|------|------|-------------------|----------|
| **Fratura Agressiva** | Melee + rush | chaser ×1.5, swarm ×1.4, reaper | Pressão constante, sem respiro |
| **Fratura Instável** | Divisão + caos | splitter ×1.5, spawner ×1.3, anomaly | Arena satura sozinha |
| **Fratura Espectral** | Intangibilidade + controle | phantom ×1.5, orbiter ×1.4, bulwark | Timing e paciência |
| **Fratura Gravitacional** | Controle espacial | singular ×1.3, tank ×1.3, anomaly ×1.2 | Posicionamento crítico |

**Como definir o tema:**
- Aleatório na onda 1 (simples)
- OU influenciado pela moralidade (ver seção O)
- OU influenciado pelo operador escolhido

### Variação de Quantidade

Além do tema, pequena variação na quantidade total:
- **Onda enxame**: +30% inimigos, -15% HP individual
- **Onda concentrated**: -20% inimigos, +25% HP individual
- **Onda balanceada**: normal

Isso garante que nenhuma run seja idêntica à anterior.

---

## O. POSSÍVEIS INTEGRAÇÕES COM MORALIDADE

### Eixos Atuais
- **COMPAXÃO**: sustentação, Ecos mais fortes, upgrades baratos
- **GANÂNCIA**: economia, créditos, loja cara mas lucrativa
- **VIOLÊNCIA**: dano bruto, inimigos mais fortes e rápidos

### Propostas Qualitativas (não apenas "+HP")

**1. Violência alta → Tema "Fratura Agressiva" forçado**
- Inimigos do tipo reaper e swarm aparecem com mais frequência
- Minibosses mais agressivos (Duelista, Colosso) favoured
- **Consequência percebível**: "estou atraindo caçadores"

**2. Ganância alta → Mais minibosses, mais recompensa**
- Chance de miniboss bônus entre ondas
- Inimigos dropam mais créditos ao morrer
- **Mas**: minibosses são mais resistentes (não mais HP, mas placas extras)
- **Consequência percebível**: "o mercado me nota — mais risco, mais recompensa"

**3. Compaixão alta → Ecos reagem aos inimigos**
- Ecos ganham "sentinela": alertam sobre phantoms e reapers
- Inimigos do tipo singular têm campo gravitacional enfraquecido (Echos os distraem)
- **Consequência percebível**: "meus Ecos me protegem de emboscadas"

**4. Decisões específicas → Entidades específicas**

| Decisão | Consequência Tardia |
|---------|---------------------|
| Converter sobrevivente em recurso (ganância) | Na onda 8+, aparece um "Eco Sombrio" com build idêntica à run convertida |
| Curar sobrevivente (compaixão) | Na onda 12+, um aliado temporário aparece e luta por 1 onda |
| Destruir artefato (violência) | Na onda 10, o miniboss é sempre da família "agressiva" |
| Preservar artefato (compaixão) | Na onda 10, o miniboss é sempre da família "controladora" |

### Regra de Ouro

**Nunca**: "violência alta = inimigos têm mais HP" (numérico, imperceptível)
**Sempre**: "violência alta = inimigos DIFERENTES aparecem" (qualitativo, percebível)

---

## P. POSSÍVEIS INTEGRAÇÕES COM ECHOS

### 1. Inimigos que Priorizam Echos

**Reaper**: ao perceber um Echo, pode desviar para caçá-lo (trust baixa = eco vira alvo preferencial)
- **Sinergia com Dissonância**: Echo já hostil é prioridade máxima
- Implementação: no targeting do reaper, weight ×3 para Echos com trust < 34

### 2. Inimigos que Interferem na Confiança

**Oráculo (miniboss)**: a maldição poderia afetar Echos também
- Reduz cadência dos Echos em 20% por 6s
- Consequência: o jogador sente que os Echos "enfraqueceram" — pressão para eliminar o Oráculo

### 3. Inimigos que Separam Player e Echo

**Tecelã de Vazio**: campo gravitacional puxa APENAS o jogador (ou apenas o Echo)
- Força separação temporária
- Ecos com trust alta resistem ao pull (tier 2 = 50% de resistência)

**Singular**: campo gravitacional afeta ambos, mas se Echo estiver perto do jogador, ambos são puxados
- Incentiva Echos a manterem distância de segurança
- Ecos com trust baixa (que já ficam longe) são MENOS afetados

### 4. Inimigos que Incentivam Proximidade

**Fornalha Viva**: rastro de fogo cobre área — Echos e jogador próximos compartilham "cobertura"
- Mecânica bônus: Ressonância mais fácil quando ambos estão no centro limpo

**Bulwark**: quando flanqueado, pode "colapsar" escudo e explodir em área
- Se Echo e jogador atacam juntos (Ressonância), o colapso é mais rápido

### 5. Miniboss que Reconhece Padrões

**Oráculo Dissonante**: se houver Ecos na run, prevê os movimentos deles
- Projéteis miram nos Echos em vez do jogador
- **Lore**: "ele vê suas vidas passadas"

### 6. Phantom e Confiança

**Phantom**: pode escolher alvos baseados em trust
- Se trust alta: ataca o Echo (sabendo que é "forte")
- Se trust baixa: ignora o Echo (sabe que é "instável")
- Cria dinâmica interessante onde Echo confiável é "valioso" mas "visado"

---

## Q. RISCOS RELACIONADOS AO SHIELD

### Shield do Jogador (atual)
- Regenerativo, delay de 2.5s, quantidade definida pelo operador
- Absorve dano antes da integridade (HP)

### Shield dos Echos (atual)
- Regenerativo, delay de 2.5-3s, capacidade 20-30
- Suspenso durante Dissonância

### Riscos Identificados

**1. Swarm + Shield → Dano Rápido Demais**
- 10+ swarms em contato simultâneo = 60+ dano/s
- Shield de 30 (Vector) dura ~0.5s
- **Risco**: shield se torna irrelevante contra enxames
- **Não é problema grave**: o shield nunca foi pensado para tankar contato massivo

**2. Singular + Reflexão → Shield Ignora Reflexão?**
- Reflexão do singular causa dano direto ao jogador
- Shield absorve dano direto normalmente
- **Risco**: shield torna a reflexão "gratuita" — o jogador pode tankar
- **Mitigação**: reflexão poderia ignorar shield (dano "refletido" é conceitual)

**3. Leech (miniboss) + Dreno → Shield Regen Bloqueada?**
- Dreno causa dano contínuo (tick a cada ~0.25s)
- Cada tick reinicia o delay de regen do shield
- **Risco**: shield nunca regenera enquanto o dreno estiver ativo
- **Mitigação**: dreno deve contar como "dano ativo" e impedir regen (comportamento correto)

**4. Fornalha + Rastro de Fogo → Shield Regen Prejudicada**
- Rastro causa dano contínuo ao pisar
- Similar ao leech: ticks reiniciam delay
- **Risco**: jogador com shield nunca regenera enquanto atravessa rastro
- **Comportamento esperado**: é o design correto — área negada deve punir

**5. Bulwark + Shield → Shield Forte Demais?**
- Bulwark já é mitigado pelo escudo frontal (72% bloqueado de frente)
- Se o jogador tem shield + flanqueia corretamente = dano muito baixo
- **Risco**: bulwark se torna trivial com shield ativo
- **Mitigação**: bulwark não precisa de ajuste; o desafio é o flanqueamento

**6. Phantom + Shield → Desbalanceamento?**
- Phantom é imune quando em fase; só pode ser atacado na janela sólida
- Shield absorve o dano de contato quando reaparece
- **Risco**: baixo — phantom é frágil quando sólido, shield apenas suaviza

**7. Colosso (miniboss) + Tremor → Shield Anulado?**
- Tremor causa knockback + dano em área
- Shield absorve o dano, mas knockback desloca
- **Risco**: knockback pode empurrar para fora de posição defensiva
- **Comportamento correto**: shield deveria absorver dano mas não knockback

### Resumo de Riscos

| Risco | Severidade | Ação Recomendada |
|-------|:----------:|------------------|
| Swarm drena shield rápido | Baixa | Nenhum — é o design esperado |
| Singular reflexão ignora shield? | Média | Decidir: reflexão passa por shield ou não |
| Leech dreno bloqueia regen | Baixa | Correto — dreno deve impedir regen |
| Fornalha rastro bloqueia regen | Baixa | Correto — área negada deve punir |
| Bulwark trivial com shield | Baixa | Nenhum — flanqueamento é a habilidade |
| Colosso knockback vs shield | Média | Shield absorve dano, NÃO knockback |

---

## R. CONTEÚDO HISTÓRICO NÃO MENCIONADO NO PROMPT

### 1. Catalisadores de Ameaça (3 módulos removidos)

- `thr_pacto`: Ameaça +1, +55% créditos e XP
- `thr_farol`: Ameaça +2, +40% dano, +90% créditos
- `thr_selo`: Ameaça +3, dobra créditos e XP

Estes módulos eram a **porta de entrada voluntária** para inimigos avançados. O jogador ESCOLHIA subir a ameaça em troca de benefícios econômicos.

### 2. Amplificadores Elementais (6 módulos removidos)

- `el_fogo`: Dano de fogo +70%, queimadura +40%
- `el_gelo`: Dano de gelo +75%, congelamento +45%
- `el_raio`: Dano elétrico +80%, choque +35%
- `el_sangue`: Sangramento +85%, duração +40%
- `el_acido`: Corrosão +90%, duração +50%
- `el_todos`: Todos os danos elementais +45%

### 3. Módulos Utilitários Removidos (~8 módulos)

- `su_sorte`: Dado Viciado — 25% de curar ao abater
- `su_critcura`: Bisturi Simbiótico — crítico cura 4 HP
- `su_exec`: Protocolo de Execução — alvos <12% morrem instantaneamente
- `su_dotcrit`: Agulha Ressonante — DoTs podem causar crítico
- `su_xp`: Catalogador Neural — +45% XP
- Entre outros

### 4. Papéis Táticos dos Echos (removidos no atual)

O legado tinha **Guardião** e **Disruptor**:
- Guardião (Echo 1): barreira de cobertura, reduz dano recebido
- Disruptor (Echo 2): pulso temporal em área, lentifica e corrói

O atual removeu os papéis — Echos usam as armas da run original sem habilidades especiais próprias.

### 5. Micro-Ressonância (removida)

Hit no mesmo alvo que o Eco dentro de 1.6s gerava dano bônus de 22% (diferente da Ressonância plena que exige <0.5s). Removida no atual.

### 6. Sistema de Fala dos Echos (removido)

`echoSpeak(e, txt, color)` — Echos "falavam" frases contextuais baseadas na dominância moral. Ex: "COBERTURA ATIVA.", "VOCÊ ESCOLHEU ELE, NÃO A MIM.", "DISTORÇÃO LIBERADA."

### 7. ECHO_PROJ_CAP (removido)

Teto de 14 projéteis vivos por Eco no legado. Removido no atual.

### 8. Curse (maldição do Oráculo)

O Oráculo aplicava `p.curseT = 6` que reduzia dano em 30%. Esta mecânica **não existe** no código atual e precisaria ser recriada.

### 9. Limite de HP do Boss base

No legado, o boss tinha `2200 + echoQueue.length*380`. No atual, é o mesmo. Mas o legado tinha `bossIntel` mais elaborado com análise de `closeW`, `longW`, `dashes`, `shots`, `aggro`.

---

## S. PLANO DE IMPLEMENTAÇÃO EM PRs PEQUENOS

### PR 1: Restaurar os 3 Inimigos Iniciais (Swarm, Orbiter, Bulwark)

**Escopo**:
- Adicionar `swarm`, `orbiter`, `bulwark` ao EDEFS
- Implementar comportamento no `updateEnemy()`
- Implementar sprites no `drawEnemy()`
- Adicionar ao `waveComp()`: swarm (wave 1+), orbiter (wave 2+), bulwark (wave 4+)
- Atualizar codex de inimigos

**Dependências**: Nenhuma
**Risco**: Baixo
**Complexidade**: Média (sprites vetoriais)
**~400 linhas de código**

### PR 2: Sistema de Variedade de Minibosses

**Escopo**:
- Criar tabela `MINIBOSS` com os 10 minibosses
- Implementar `pickMiniBoss(n)` com filtragem por peso
- Implementar `spawnMiniBossVariant(n, def)` com stats escalados
- Adicionar `MINI_WAVES = [5, 10, 15]`
- Adicionar skills compartilhados (charge, burst, summon já existem)
- HUD agregado para múltiplos minibosses

**Dependências**: PR 1 (para swarmSpawn do brood)
**Risco**: Médio
**Complexidade**: Alta
**~500 linhas de código**

### PR 3: Skills Específicos dos Minibosses

**Escopo**:
- Implementar skills individuais: teleport, spiral, grav, burn, nova, trail, reflect, beamRot, shieldUp, swarmSpawn, heal, blink, slash, quake, curse, drain, corrode, split, link
- Cada skill em branch separado no `updateMiniBoss()`

**Dependências**: PR 2
**Risco**: Alto (muitas mecânicas)
**Complexidade**: Muito Alta
**~600 linhas de código**
**Sugestão**: Dividir em PR 3a (skills simples) e PR 3b (skills complexos como reflect, beamRot, grav)

### PR 4: Inimigos de Ameaça Adaptados (Splitter, Phantom)

**Escopo**:
- Adicionar `splitter` e `phantom` ao EDEFS
- Implementar cisão na morte (splitter)
- Implementar intangibilidade cíclica (phantom)
- Adicionar ao `waveComp()` como tipos de onda avançada (sem sistema de ameaça)
- splitter: wave 6+, phantom: wave 8+

**Dependências**: PR 1
**Risco**: Baixo-Médio
**Complexidade**: Média

### PR 5: Inimigos Avançados (Reaper ou Singular)

**Escopo**:
- Adicionar reaper OU singular ao EDEFS
- Reaper: aceleração progressiva (rage)
- Singular: campo gravitacional + reflexão de dano
- Adicionar ao `waveComp()` em waves 12+ ou 15+

**Dependências**: PR 4
**Risco**: Médio (singular pode ser complexo de balancear)
**Complexidade**: Média-Alta

### PR 6: Temas de Onda e Variedade

**Escopo**:
- Sistema de "temas" definido na onda 1
- Multiplicadores por tema
- Pool de minibosses filtrado por tema
- UI para indicar o tema da run

**Dependências**: PRs 1-5
**Risco**: Baixo
**Complexidade**: Média

### PR 7: Integração com Moralidade

**Escopo**:
- Dominância moral influencia tema de onda
- Decisões de eventos spawnam entidades tardias
- Ecos reagem a inimigos específicos baseado em trust

**Dependências**: PRs 1-6
**Risco**: Médio
**Complexidade**: Alta

### PR 8: Integração com Echos

**Escopo**:
- Inimigos que priorizam/ignoram Echos baseado em trust
- Ataques que separam player e Echo
- Ataques que incentivam proximidade

**Dependências**: PRs 1-6
**Risco**: Médio
**Complexidade**: Alta

---

## T. RECOMENDAÇÃO FINAL

> **"Se eu estivesse dirigindo o desenvolvimento do ECHO, estes seriam os conteúdos que eu recuperaria primeiro..."**

### Prioridade 1 — Restaurar QUASE IGUAL (PR 1)

**Swarm + Orbiter + Bulwark**

Por quê:
- São os 3 inimigos que **não dependem de nada** do sistema antigo
- Preenchem lacunas reais do meta atual: falta "enxame frágil", falta "atirador orbital", falta "tank que exige flanqueamento"
- São triviais de implementar (código legado é limpo e auto-contido)
- Adicionam **profundidade imediata** sem nenhuma mudança de sistema
- Swarm + Orbiter juntos criam a primeira sinergia tática real: "limpe os frágeis enquanto desvia dos projéteis orbitais"

### Prioridade 2 — Sistema de Variedade de Minibosses (PR 2, parcialmente PR 3)

**Pool de minibosses com 4-5 opções para onda 5 e onda 10**

Minibosses prioritários para restaurar:
1. **Arauto da Fratura** (já existe — manter como referência)
2. **Colosso Dormente** (tank check único, tremor sísmico)
3. **Sentinela Espelhada** (reflexão de projéteis — brilhante)
4. **Fornalha Viva** (área negada — diversifica encounters)
5. **Sanguesuga Temporal** (dreno + corrosão — pressão dupla)

Por quê:
- 1 miniboss por run é monótono — o jogador decora o encounter
- 5 minibosses com pool filtrado cria **replayability real**
- Cada um ensina uma habilidade diferente (posicionamento, timing, priorização)

### Prioridade 3 — Splitter + Phantom Adaptados (PR 4)

Por quê:
- Splitter é **divertido** (matar 1 e ver 2 menores nascendo)
- Phantom **ensina timing** (janelas de DPS são design premium)
- Ambos funcionam sem o sistema de ameaça — basta colocá-los em waves avançadas
- Phantom é particularmente valioso porque **nenhum inimigo atual tem mecânica de intangibilidade**

### Prioridade 4 — Singular (PR 5)

Por quê:
- É o inimigo com **mais personalidade** de todos os 7
- Campo gravitacional + reflexão cria um paradoxo tático brilhante
- É o "chefão" natural de waves 15-18
- **Cuidado**: precisa de balanceamento cuidadoso com Shield (ver seção Q)

### NÃO Recuperaria Agora:

- **Reaper**: muito parecido com chaser; precisa de redesenho para justificar existir separadamente. Ou fundir com chaser como "variante enfurecida".
- **Sistema de Ameaça**: não como era (escolha voluntária via módulos). Mas a ideia de "jogador escolhe dificuldade" é boa — pode voltar como **decisão de evento** em vez de módulo.
- **Amplificadores Elementais**: o sistema de status atual já funciona sem eles; adicionar amplificadores seria conteúdo extra, não restauração.
- **Duelista Fantasma**: muito frágil (HP ×0.70) para miniboss; precisa ser redesenhado ou promovido a elite avançado.

### Ordem Final de Execução

```
1. PR 1: Swarm + Orbiter + Bulwark     (1 semana, risco baixo, impacto alto)
2. PR 2: Pool de 5 Minibosses           (1 semana, risco médio, impacto altíssimo)
3. PR 4: Splitter + Phantom             (3-4 dias, risco baixo, impacto médio)
4. PR 5: Singular                       (3-4 dias, risco médio, impacto alto)
5. PR 6: Temas de Onda                  (2-3 dias, risco baixo, impacto médio)
6. PRs 3b, 7, 8: restante              (conforme aprovação)
```

**Total estimado para o núcleo (PRs 1-5): ~3 semanas de desenvolvimento.**

Isso transformaria o jogo de 5 tipos de inimigos + 1 miniboss em **9 tipos de inimigos + 5 minibosses variados**, com profundidade tática real e replayability significativa — sem alterar nenhum dos sistemas modernos intocáveis (PRs 1-5 do roadmap).

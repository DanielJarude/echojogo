# PR15.6-A · REBALANCEAMENTO DE DURABILIDADE E PACING DE COMBATE

> **Nota de Revisão (PR15.6-A-FIX #1)**:  
> Durante revisão pré-replaytest foi detectado que a primeira implementação generalizou acidentalmente a regra do Phantom para `phaseT`. O FIX restaurou a semântica legada de `phaseT` e manteve a nova intangibilidade exclusivamente em `phantom.ghostT`.

---

## 1. Contexto e Diagnóstico

Durante os testes de jogabilidade estendidos e análises de combate em ondas avançadas (ondas 10 a 20), foram identificados dois gargalos sistêmicos de pacing e fluidez:

### 1.1 Problema A — Efeito "Sponge Last Enemy" (Inimigo Esponja Residual)
- **Causa Raiz**: O crescimento exponencial/quadrático de vida por onda (`diffHp(n) = 1 + 0.155*(n-1) + 0.014*(n-1)^2`) acumulava-se sobre multiplicadores de HP base muito elevados em arquétipos pesados e de suporte:
  - **Spawner**: HP base 210. Na onda 15 com taxa de inimigo, ultrapassava 1.300+ EHP e sobrevivia sozinho por dezenas de segundos após todos os inimigos da horda terem morrido.
  - **Tank**: HP base 180.
  - **Elites**: Multiplicador de HP de **2.30x** combinado com escudo de **65% do HP do Elite** e um **bug crítico de regeneração** onde o escudo regenerava a `e.shieldRegen * dt * 10` (ou seja, 55% de regeneração por segundo em vez dos pretendidos 5.5%/s). Se o jogador desviasse por 2 segundos, o escudo do Elite recuperava 100% de sua capacidade.
- **Impacto no Gameplay**: Ao limpar os inimigos rápidos de uma onda, o jogador ficava preso em 1 ou 2 inimigos restantes com quantidades desproporcionais de HP, gerando tédio e perda de momentum na run.

### 1.2 Problema B — Phantom (Fantasma) Bloqueando Arsenal e Travando Auto-Mira
- **Causa Raiz**:
  - Quando em fase intangível (`ghostT > 0`), o Phantom não recebia dano em `damageEnemy`, mas projéteis normais colidiam com seu raio, gastavam perfuração (`pierce`) e eram destruídos sem causar efeito.
  - O sistema de mira automática (`nearestEnemy`), a IA dos Ecos aliados de Nível 2 (`updateEcho`), feixes (`fireBeam`), ataques melee (`fireMelee`), projéteis teleguiados (`homing`) e arcos de choque (`chainShock`) continuavam travando a mira no Phantom intangível.
- **Impacto no Gameplay**: Tiros eram desperdiçados no vazio e armas teleguiadas ignoravam inimigos letais tangíveis para focar em um fantasma invulnerável.

---

## 2. Soluções Implementadas no PR15.6-A

### 2.1 Phantom: Intangibilidade Real e Pass-Through de Projéteis
1. **Pass-Through Físico Exclusivo para Phantom Ghost**:
   - Em `updateProjectiles`, projéteis aliados agora ignoram colisão quando o inimigo for `phantom` em `ghostT > 0` (`if (e.type === 'phantom' && (e.ghostT || 0) > 0) continue;`).
   - Projéteis continuam sua trajetória sem perder vida, sem perder perfuração (`pierce`), sem ativar procs de on-hit e sem serem consumidos.
2. **Centralização de Elegibilidade de Alvo (`enemyIsTargetable`)**:
   - Criada a função `enemyIsTargetable(e)` focada exclusivamente em alvos tangíveis e excluindo Phantom intangível:
     ```javascript
     function enemyIsTargetable(e){
       return !!e && !e.dead && !(e.hp<=0) && !(e.spawnT>0) && !(e.type==='phantom'&&(e.ghostT||0)>0);
     }
     ```
   - Integrada em:
     - `nearestEnemy(x, y, range)` (mira primária do jogador e armas automáticas)
     - `persFindTarget(e, range)` (mira de personalidades)
     - `updateEcho` Tier 2 (mira dos ecos aliados)
     - `fireBeam` (varredura de raios contínuos)
     - `fireMelee` (varredura de cortes melee)
     - `chainShock` (propagação de choque em cadeia)
     - Homing de projéteis e detecção de minas terrestres em `updateProjectiles`
3. **Rebalanceamento de HP**:
   - Base HP reduzido de **52** para **30** (`EDEFS.phantom.hp = 30`).

### 2.2 Rebalanceamento de Durabilidade de Inimigos Comuns
- **Spawner**: Base HP reduzido de **210** para **125** (`-40.5%`). Preserva função geradora de horda sem se tornar uma esponja intransponível.
- **Tank**: Base HP reduzido de **180** para **150** (`-16.7%`). Mantém sensação de peso e colisão sem arrastar o tempo de término da onda.

### 2.3 Correção e Calibração dos Inimigos Elites
- **Multiplicador de HP**: Reduzido de **2.30x** para **1.80x** em `makeElite(e, variant)`.
- **Escudo de Elite**:
  - Quantidade inicial/máxima reduzida de **65%** para **45%** do HP máximo do Elite (`shieldMax = e.maxHp * 0.45`).
  - **Bug Fix Crítico de Regeneração**: Removido o fator espúrio `* 10` em `updateEnemy`. O escudo agora regenera a uma taxa previsível de **5.5% do shieldMax por segundo** (`e.shieldRegen * dt`).

---

## 3. Invariantes Preservados

- **Anomaly (`phaseT > 0`)**: Comportamento legado de `f2a602a` 100% restaurado e preservado (colisão de projéteis sem pass-through, elegibilidade de targeting, IA de Ecos, Melee, Beam e Homing).
- **Bulwark**: HP base mantido em **78**, ângulo de bloqueio frontal de 2.05 rad e redução de 28% mantidos intactos.
- **Singular**: HP base mantido em **190**, raio de atração 420px e reflexão mantidos intactos.
- **Splitter**: HP base mantido em **62**, divisão em 2 estilhaços mantida intacta.
- **Comuns rápidos**: Chaser (26), Shooter (36), Swarm (12), Orbiter (34), Anomaly (44) inalterados.
- **Chefes e Minibosses**: Nenhum valor de chefe (`MINIBOSS`, `spawnBoss`, `BOSS_CONFIG`) foi alterado.
- **Fórmulas de Escala**: `diffHp(n)`, `diffDmg(n)`, `diffSpd(n)` inalteradas.
- **Diretor de Fraturas**: Sem alterações na composição `waveCompBase` ou distribuição de orçamentos.
- **Arsenal e Dano do Jogador**: As 27 armas e habilidades do jogador preservadas byte a byte.
- **Ruptura / Instabilidade Temporal**: Não implementada neste bloco (reservada para PR15.6-B após validação deste rebalanceamento).

---

## 4. Tabela de Comparação de Durabilidade (EHP Base)

| Inimigo | HP Pré-15.6-A | HP Pós-15.6-A | Variação | Função Tática |
| :--- | :---: | :---: | :---: | :--- |
| **Phantom** | 52 | **30** | -42.3% | Emboscador ágil; esquiva por intangibilidade, morre rápido quando materializado. |
| **Spawner** | 210 | **125** | -40.5% | Gerador estático; alto valor de prioridade de abate sem arrastar o fim da onda. |
| **Tank** | 180 | **150** | -16.7% | Bloqueador de vanguarda; absorve dano frontal em horda. |
| **Elite (Base)** | 2.30x HP | **1.80x HP** | -21.7% | Ameaça tática de destaque. |
| **Elite Shield** | 65% HP + 55%/s regen | **45% HP + 5.5%/s regen** | -30.8% / Bugfix | Janela justa para quebra e punição de escudo. |
| **Bulwark** | 78 | **78** | 0.0% | Preservado (mecânica posicional de escudo frontal). |
| **Singular** | 190 | **190** | 0.0% | Preservado (controle de gravidade de alto risco). |
| **Splitter** | 62 | **62** | 0.0% | Preservado (ameaça multiplicativa). |
| **Anomaly** | 44 | **44** | 0.0% | Preservado integralmente (phaseT legado intacto). |

---

## 5. Roteiro de Replaytest Manual (Playtest Checklist)

### Cenário 1: Teste de Intangibilidade do Phantom
1. Abrir o jogo e entrar no modo **Sandbox / Laboratório**.
2. Spawnar 1 **Phantom** e 1 **Chaser** lado a lado.
3. Equipar uma arma de projéteis (ex: Pistola ou Rifle).
4. Atirar através do Phantom enquanto ele estiver em modo fantasma translúcido (`ghostT > 0`):
   - **Verificação**: O projétil atravessa o Phantom, continua sua trajetória e atinge o Chaser atrás. O Phantom não sofre dano e o projétil não é destruído.
5. Deixar armas automáticas ou Eco atirando:
   - **Verificação**: A mira automática trava exclusivamente no Chaser. Assim que o Phantom se materializa, a mira foca nele imediatamente.

### Cenário 2: Preservação do Comportamento da Anomaly (`phaseT`)
1. No Sandbox, spawnar 1 **Anomaly** e disparar contra ela durante o teleporte/fase (`phaseT > 0`):
   - **Verificação**: A Anomaly não toma dano, mas o projétil colide com ela e é absorvido/destruído (comportamento legado `f2a602a` preservado, sem pass-through).
   - **Verificação**: A mira automática e Ecos continuam considerando a Anomaly como alvo selecionável durante o `phaseT`.

### Cenário 3: Teste do Escudo e Regeneração do Elite
1. No Sandbox, spawnar 1 **Tank Elite com Escudo** (`makeElite(e, 'shield')`).
2. Disparar uma rajada para consumir ~50% da barra de escudo amarelo.
3. Parar de atirar e observar a taxa de regeneração:
   - **Verificação**: O escudo leva cerca de 10 a 18 segundos para se regenerar completamente (taxa gradual e justa de 5.5%/s), sem "pular" para 100% em 2 segundos.

### Cenário 4: Pacing de Fim de Onda (Ondas 10 a 15)
1. Iniciar uma run padrão e avançar até a onda 12+.
2. Eliminar os enxames e inimigos velozes.
3. Abater o Spawner / Tank restante:
   - **Verificação**: O tempo de conclusão da onda flui naturalmente em poucos segundos após o wipe da horda, sem travamento de ritmo de 30+ segundos em um único inimigo residual.

---

## 6. Resultados da Validação Automatizada

- **Total de Suítes de Testes Executadas**: 54 suítes
- **Total de Asserções / Verificações Aprovadas**: 3.408 verificações
- **Falhas / Regressões**: 0 falhas (100% de aprovação)
- **Suíte Dedicada**: `tests/pr15-6-a-enemy-pacing-balance.test.js` (37 verificações cobrindo colisões, pierce, targeting, stats EDEFS, makeElite, isolamento estrito de Phantom Ghost e preservação da semântica legada de Anomaly phaseT).

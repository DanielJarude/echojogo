# ECHO — Modo Desenvolvedor (DEV MODE)

> Introduzido no **PR 6.5**. É uma **ferramenta interna de teste**, não uma
> mecânica de jogo. Nada aqui altera balanceamento, progressão ou a
> experiência de um jogador comum.

---

## 1. Como ativar / desativar

| Ação | Como |
|---|---|
| Ativar / desativar | **`Ctrl` + `Shift` + `D`** |
| Fechar só o painel | **`ESC`** (o painel tem prioridade sobre o menu de pausa) |
| Desligar tudo | botão **DESLIGAR DEV** no topo do painel |

O atalho só responde numa **build de desenvolvimento** (`IS_DEV_BUILD`):

| Contexto | `IS_DEV_BUILD` | Ctrl+Shift+D |
|---|---|---|
| `npm start` / `npm run dev` (Electron não empacotado) | `true` | funciona |
| Build empacotada (itch.io) | `false` | **inerte** |
| Navegador com `index.html?dev=1` | `true` | funciona |
| Navegador sem a flag | `false` | **inerte** |

O canal é decidido em `main.js` (`app.isPackaged`), transmitido ao renderer
por `additionalArguments` e exposto em `preload.js` como
`window.echoDesktop.channel` (`'dev'` | `'release'`).

`DEV_MODE` **começa sempre `false`**, mesmo numa build de dev.

Enquanto ativo aparece o selo **`DEV MODE`** no rodapé central. Assim que
qualquer comando é usado, ele muda para **`DEV MODE · RUN DEBUG (NÃO SALVA)`**.

---

## 2. Política de pausa

**Painel aberto → jogo pausado** (padrão). Evita morrer enquanto se escolhe
uma opção. O botão **`PAUSA: ON/OFF`** no topo do painel desliga essa política
quando você quer ver o efeito de um comando em tempo real. Fechar o painel
(`ESC` ou **FECHAR**) retoma o jogo com 0,4 s de graça.

`ABRIR LOJA` fecha o painel e despausa automaticamente.

---

## 3. Comandos disponíveis

Todos vivem no namespace `DEV` e também estão no console em build de dev
(`window.ECHO_DEV.DEV`). **Toda função retorna `false` imediatamente se
`DEV_MODE` for `false`.**

### Onda
| Comando | Efeito |
|---|---|
| `DEV.goToWave(n)` | valida `1..MAX_WAVE`, limpa a arena e monta a onda `n` |
| `DEV.nextWave()` | avança 1 onda (nunca passa de `MAX_WAVE`) |
| `DEV.startWave()` | recompõe a onda atual imediatamente |
| `DEV.clearWave()` | encerra a onda sem XP/créditos/abates |

### Inimigos (11 tipos, IDs vindos de `EDEFS`)
`chaser · shooter · tank · spawner · anomaly · swarm · orbiter · bulwark ·
splitter · phantom · singular`

| Comando | Efeito |
|---|---|
| `DEV.spawnEnemy(id, n)` | spawna `n` (1..20) a 300–430 px do jogador |
| `DEV.clearEnemies()` | remove tudo (inclui chefe/mini-chefe e projéteis inimigos) |

### Mini-chefes (8, IDs vindos de `MINIBOSS`)
`herald · furnace · sentinel · brood · duelist · colossus · oracle · leech`

| Comando | Efeito |
|---|---|
| `DEV.spawnMiniBoss(id)` | invoca o mini-chefe pedido (usa a função de produção) |
| `DEV.clearMiniBoss()` | remove o mini-chefe e o HUD |
| `DEV.spawnBoss()` | inicia O PARADOXO com o intel de `analyzeEchoData()` |

### Player
`DEV.heal(n)` · `DEV.fullHp()` · `DEV.toggleInvuln()` · `DEV.killPlayer()` ·
`DEV.addCoins(n)` · `DEV.setSpeed(mul)` (0.25–4, temporário)

### Escudo
`DEV.fillShield()` · `DEV.zeroShield()` · `DEV.breakShield()` ·
`DEV.setShieldMax(v)` (0–500, temporário)

`breakShield()` passa pelo caminho **real** de `damagePlayer` (feedback + delay
de regeneração) e restaura o HP em seguida: nunca mata o testador.

### Echos
`DEV.spawnEcho(1|2)` · `DEV.clearEchoes()` · `DEV.setTrust(slot,v)` ·
`DEV.addTrust(slot,±10)` · `DEV.forceRole(slot)` · `DEV.resetRoleCd(slot)` ·
`DEV.forceSpeak(slot)` · `DEV.dissonance(slot)` · `DEV.endDissonance(slot)`

Echos DEV são **sintéticos** (`echo.dev === true`, `data.dev === 1`) e nunca
entram no arquivo permanente. Confiança é sempre normalizada em `0..100`.
A Dissonância chama `enterDissonance()` — nenhuma lógica de produção é
duplicada.

### Echo Personality (PR 8)
`DEV.personalityPreview()` · `DEV.personalityOf(slot)` ·
`DEV.forcePersonality(slot, pid|'auto')` · `DEV.spawnEcho(slot, pid)`

- **PERSONALITY INSPECTOR** no painel: mostra a personalidade prevista da run
  viva (id, confidence, os 6 scores, traços) usando o MESMO pipeline da
  produção (`buildPersonalityMetrics → scorePersonalities → classifyPersonality`)
  — nada é recalculado em paralelo nem gravado.
- `forcePersonality` altera **apenas o runtime** do Echo (`e.pers`, marcado
  com `e.persDev`): o registro salvo em `echoQueue`/`saveEchoes` não é tocado,
  e `devTainted` impede que a run depurada gere Echo legítimo.
- `spawnEcho(slot, pid)` aceita um pid de personalidade (ex.: `'opportunist'`)
  para gerar um Echo de teste com identidade específica; pid inválido gera o
  Echo base, sem identidade forjada.
- O HUD de debug (`toggleInfo`) exibe a tag de personalidade de cada Echo em
  campo e a linha `PERS PREV` com o estado-vivo da classificação.

### Status
`DEV.applyStatus(kind, all?)` com `burn · bleed · corrode · chill · shock ·
stun` · `DEV.clearStatus()` · `DEV.curse(s)` (maldição do Oráculo).
Nenhum status novo foi inventado.

### Módulos / loja
`DEV.grantModule(id)` · `DEV.listModules()` · `DEV.openShop()` · `DEV.reroll()`
· `DEV.addCoins(n)`

### Operadores
`DEV.setOperatorNextRun(id)` — aplica-se à **próxima** run. Trocar operador no
meio da run corromperia armas/escudo/especial já instanciados, então não é
oferecido.

### Debug
`DEV.toggleInfo()` (HUD em tempo real) · `DEV.resonanceDebug()` ·
`DEV.bossDebug()` · `DEV.state()`

O HUD de debug mostra: FPS, estado, onda, inimigos vivos, HP, Escudo,
`shieldDelay`, `curseT`, créditos, mini-chefe atual, modo adaptativo do boss +
`dashAdapt`, confiança/papel/hostilidade de cada Echo e a janela de
(micro-)ressonância do alvo mais próximo.

---

## 4. Proteção de saves e progressão

Assim que o DEV MODE é ligado durante uma run — ou qualquer comando é
executado — a run é marcada como **`devTainted`**. A partir daí:

- `saveEchoes()` retorna `false` e **não grava nada**;
- `saveProg()` e `saveMeta()` retornam `false` (progressão e meta intocadas);
- o registro da run recebe `dev: 1` em `onPlayerDeath()`;
- `loadEchoes()` descarta qualquer entrada com `dev`;
- recordes/desbloqueios não são persistidos.

**Desligar o DEV MODE não "lava" a run** — `devTainted` permanece até a
próxima `startRun()` limpa.

---

## 5. O que o DEV MODE **não** faz

- não muda valores base em `CHARS`, `EDEFS`, `MINIBOSS`, `ITEMS` ou `UPGRADES`;
- não altera balanceamento nem cria mecânicas;
- não existe na build pública;
- não é dependência de nenhum sistema de gameplay.

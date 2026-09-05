# PR13.5 · B5-B-FIX — REGRESSÃO SISTÊMICA DO HUD

Branch `arena/01a06ff3-echojogo` · base `a27b3d1` (B5-B) · `SM_VERSION=3` · `FRACTURE_STATE_VERSION=1` · `0.7.0-alpha`.

## 1. Bug encontrado no playtest (run real, `a27b3d1`)
Vida, Escudo, Dash, Especial, Créditos, Sincronia, Onda, Tempo e Abates **congelados** no HUD enquanto a lógica de gameplay seguia normal (loja, Ecos, morte, Save/Continue, mini-chefes OK).

## 2. Causa raiz (uma só, sistêmica)
`render()` chama, no fim do desenho da cena, **`renderSpeech()` — função que não existe**. A função real, criada no B2, chama-se `speechRender()`. Em runtime isso é um `ReferenceError` a cada frame. No `loop()`:

```
try{ … update … render(); hudAcc+=dt; updateHUD(); … }catch(err){ console.error (8×) }
```

Como `render()` está **antes** de `updateHUD()` dentro do mesmo `try`, a exceção aborta o frame antes do HUD — por isso os 9 indicadores morreram **juntos**: nenhum `updateHUD()` era executado pelo loop. Os únicos `updateHUD(true)` que ainda rodavam eram os forçados fora do loop (`startRun`, `resumeRun`, DEV) — o HUD mostrava o snapshot do início da run/Continue e nunca mais mudava. A cena continuava sendo desenhada porque o `ReferenceError` acontece **depois** de tudo o que importa no `render()` (é a penúltima chamada), e o `console.error` é suprimido após 8 repetições.

## 3. Origem — determinada objetivamente
Sonda `render()` no harness (mesmo mock DOM) em cada commit:

| commit | bloco | `render()` |
|---|---|---|
| `10f8da7` | main | OK (nem existe fala) |
| `90dc2b2` | B1 audit | OK |
| **`6ccf22f`** | **B2 — Echo Speech UX** | **THROW `renderSpeech is not defined`** |
| `7fc4d83` … `f5408ee` | B3/B3-FIX | THROW |
| `1e7ee6a` | B4 | THROW |
| `28899cf` | B5-A | THROW |
| `a27b3d1` | B5-B | THROW |

`git log -S'renderSpeech();'` → único commit: `6ccf22f`. **A regressão nasceu no B2 (faixa 10f8da7→28899cf, especificamente 6ccf22f), NÃO no B5-B (28899cf→a27b3d1).** B5-A/B5-B não tocaram em `render()`/`loop()`/`updateHUD()`.

## 4. Por que 1373 checks não pegaram
- Nenhum teste chamava `render()` nem `loop()` — o caminho real do frame nunca era exercitado; os testes de HUD (`shield.test.js`, `items-build-rework`) chamavam `updateHUD(true)` **diretamente**, pulando o `render()`.
- Pior: `devmode.test.js` **exigia literalmente a string `renderSpeech();`** ("fala desenhada pelo canal separado") — o teste travava o bug no lugar.
- O mock de `console.error` engole a mensagem.

## 5. Pipeline
**Antes:** `loop → try{ update… → render() ✖ ReferenceError → (updateHUD nunca) }catch` → HUD = snapshot do último `updateHUD(true)` forçado.
**Depois:** `loop → try{ update… → try{render()}catch(log) → hudAcc+=dt → updateHUD() (throttle 0,09 s) → … }catch`. Duas correções no ponto central: (1) `renderSpeech()` → `speechRender()`; (2) `render()` em `try` próprio — uma exceção de desenho nunca mais derruba o HUD (defesa sistêmica; o log continua com o mesmo `errGuard`).

## 6. Matriz
| Indicador | Source | DOM | Antes | Depois | Teste |
|---|---|---|---|---|---|
| Vida | `player.hp/maxHp` | `#hpfill`, `#hpnum` | congelado | acompanha (11 Hz) | FIX-1/2 |
| Escudo | `player.shield/shieldMax/shieldRegen/shieldDelayT` | `#shfill`, `#shnum`, classes `full/partial/empty/regen/perfect` | congelado | acompanha; regen visível | FIX-3/4 |
| Dash | `player.dashCd/dashCdMax` | `#dashfill`, `#dashwrap.ready`, **`#dashlbl`** (novo) | congelado; sem "quanto falta" | barra + **`DASH 1.4s`** / `DASH [ESPAÇO]` | FIX-5 |
| Especial | `player.spCd/spT`, `curChar().sp.cd` | `#spfill`, `#splbl`, classes | congelado | `NOME 4.5s` (cd) / `NOME 3.0s` (ativo) / `NOME [E]` | FIX-6 |
| Créditos | `player.coins` | `#coinsp` (`fmtCompact`) | congelado | acompanha (compra real testada) | FIX-7 |
| Sincronia | `player.xp/xpNext/level` | `#xpfill`, `#lvl` | congelado | acompanha | FIX-8 |
| Onda | `wave` (+`boss`/`miniBoss`) | `#wave` | congelado | acompanha | FIX-9 |
| Tempo | `runTime` | `#timer` | congelado | avança em play, para em pause, Continue restaura | FIX-10 |
| Abates | `kills` | `#timer` | congelado | acompanha (killEnemy real) | FIX-11 |

Sincronia = barra de XP/nível (`xpwrap`), não Trust/Relationship/Dissonance/Sintonia/Intensidade.

## 7. Dash / Especial — como o restante é comunicado
- Dash: rótulo `DASH [ESPAÇO]` quando pronto (+ pulso CSS já existente); em cooldown `DASH 1.4s` (via `fmtSec`, 1 decimal) + barra de progresso. Mesma linha, sem altura extra.
- Especial: já mostrava `NOME 4.5s` (cooldown) / `NOME 3.0s` (duração ativa) / `NOME [E]` — estava correto e congelado; volta a funcionar. Segue o `cd` do operador real.

## 8. Performance
Throttle de 0,09 s preservado: ~10–11 `updateHUD` efetivos/s (medido 50 em 5 s) ≈ 220 writes/s em vez de ~1320/s por frame. Linha duplicada `coinsEl.textContent=…` removida. Sem `createElement` no HUD. Custo do `try` extra: desprezível.

## 9. Testes
`tests/pr13-5-b5b-hud-fix.test.js` (20 checks) passa pelo **loop real** (`loop(now)` → `render()` → `updateHUD()`): HP, dano real, Shield (FULL→DAMAGE→BREAK→REGEN real→FULL), shieldMax do pipeline, Dash, Especial, Créditos (ganho/compra real), Sincronia, Onda (+mini-chefe), Tempo (play/pause/resume/Continue), Abates (killEnemy real), **sistêmico** (7 indicadores no mesmo frame), throttle não bloqueia, performance, Continue imediato, morte→nova run, DEV inerte/snapshot, frame real com mini-chefe B5-B F2 + hazards, HUD do boss. **Na árvore `a27b3d1` a suíte falha em 18/20** (prova). `devmode.test.js` corrigido para exigir `speechRender();` dentro de `render()` e proibir `renderSpeech`. `npm test`: **25 suítes · 1393 checks · 0 falhas**.

## 10. DEV
`DEV.hudState()` (hp/hpMax/shield/shieldMax/dashCd/dashReady/special/credits/sync/wave/runTime/kills) e `DEV.hudSnapshot()` (STATE × DOM por campo com `ok`, força um `updateHUD(true)`); botão `HUD × STATE`. `null` fora do DEV.

## 11. Regressões
B5-B (8 updaters/hazards/caps), PARADOXO, loja, Ecos, morte, Save/Continue, Fracture Director: **não tocados** (diff só em `render()` 1 linha, `loop()` 3 linhas, `updateHUD` 2 linhas, HTML 1 id, DEV). `audit_pr135/hud_runtime_audit.js` roda o loop real e compara STATE × DOM (OK agora; DIVERGENTE + 0 chamadas em `a27b3d1`).

## 12. Playtest humano pendente
Durante uma run: tomar dano de escudo e de vida; esperar regen; Dash (ver `DASH x.xs`); Especial; ganhar e gastar créditos; subir nível; passar de onda; observar tempo; matar inimigo; pausar/retomar; Continue. Pergunta: **todos os valores acompanham o state em tempo real?** Também: a fala dos Ecos (que estava sendo desenhada? — não: `speechRender` nunca rodava desde o B2) agora aparece sobre o Echo — confirmar que não polui.

## 13. Observação importante
Como `speechRender()` nunca era chamado desde o B2, as falas dos Ecos **também não eram desenhadas** no canal novo em run real (só o `floatText` legado onde ainda existia). O fix reativa o canal de fala do B2 — outro efeito colateral positivo a validar no playtest.

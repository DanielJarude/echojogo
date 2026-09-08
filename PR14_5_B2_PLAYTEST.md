# PR14.5 · B2 — ROTEIRO DE PLAYTEST HUMANO (12 testes)

Como usar: abra o jogo (`index.html`), ative o DEV (atalho de DevTools do jogo),
use os comandos/botões indicados e compare o observado com o "esperado".
**FAIL** = qualquer desvio do esperado que não seja cosmético.
Inspector DEV: seção **BUILD PROFILE** (perfil atual + FORÇAR ARQUÉTIPO + LIMPAR
+ PESOS LOJA → LOG). Sintonia: **SINTONIA B4 → LOG** (lista estados) e tooltips.

---

## 1. WRAITH / CRIT-DASH reconhece a própria build
- **Preparar**: run nova com **WRAITH**. Pegar **KATANA** na loja da onda 1–2;
  módulos de crítico (OLHO DO PREDADOR, CRIT CADEIA).
- **DEV**: inspector → BUILD PROFILE → `PERFIL → LOG`.
- **Esperado**: log mostra CRIT no topo e MELEE/DASH entre os 2 primeiros
  (ex.: "CRIT 57% · MELEE 45% · DASH 26%"); TAB [TAB] → linha
  "PERFIL DE BUILD — CRIT" com as %.
- **FAIL**: perfil INDEFINIDO após 2 ondas com essa composição; ou ESCUDO/
  ECONOMIA aparecendo no top-3.

## 2. BULWARK / SHIELD
- **Preparar**: run com **BULWARK**; comprar PLACA ou CONDENSADOR + um
  SHIELD BOOST.
- **DEV**: `PERFIL → LOG`.
- **Esperado**: ESCUDO dominante (HÍBRIDO ESCUDO/MELEE aceitável no começo,
  pela escopeta). Módulo de escudo no tooltip mostra "SINTONIA · AFINADA/
  RESSONANTE · COMBINA: …".
- **FAIL**: dom RANGED/CRIT com essa composição; tooltip divergente em
  módulo de escudo.

## 3. PYRE / STATUS
- **Preparar**: run com **PYRE**; FLAMER + PIROSTASE/ST CORROSIVO/CATALISADOR.
- **DEV**: `PERFIL → LOG`; hover no ST CORROSIVO.
- **Esperado**: STATUS dominante; tooltip "COMBINA: FLAMER · status da build".
- **FAIL**: perfil apontar CRIT/RANGED como dominante.

## 4. NÔMADE / ECONOMIA
- **Preparar**: run com **NÔMADE**; comprar USURA ou SU_IMANTE.
- **DEV**: `PERFIL → LOG`; `PESOS LOJA → LOG` com a loja aberta.
- **Esperado**: ECONOMIA no top-2; USURA mostra AFINADA/RESSONANTE com
  "COMBINA: NÔMADE"; log de pesos mostra usura/iman ≥×1.2 em build nomade.
- **FAIL**: ECONOMIA abaixo de 3º; usura NEUTRA com nomade + coinMul alto.

## 5. ECHO-0 / ECHO
- **Preparar**: run com **ECHO-0**; 2+ Echos e comprar PARADOXO (se ofertado
  — usar FORÇAR ARQUÉTIPO: ECHO para ver a loja puxar paradoxo/ressonador).
- **DEV**: FORÇAR ARQUÉTIPO → ECHO; depois LIMPAR.
- **Esperado**: com override ECHO, loja passa a oferecer paradoxo/ressonador
  com mais frequência (PESOS LOJA mostra ×1.2–1.35); PARADOXO fica AFINADO
  com Echos instalados e NEUTRO sem nenhum Echo.
- **FAIL**: paradoxo RESSONANTE com 0 Echos; override não muda os pesos.

## 6. Build híbrida válida
- **Preparar**: WRAITH + katana + estilhaço + olho (melee+crit).
- **DEV**: `PERFIL → LOG` após 2 ondas.
- **Esperado**: lab "HÍBRIDO MELEE/CRIT" (ou CRIT/MELEE) sem um lado
  fingir domínio absoluto; estilhaço E olho ambos AFINADOS+.
- **FAIL**: tudo NEUTRO ("build equilibrada") com dois lados claros.

## 7. Antisinergia legível + pivô
- **Preparar**: build melee (katana+estilhaço) e deixar LUNETA instalada
  (compre antes de pivotar).
- **DEV**: FORÇAR ARQUÉTIPO → RANGED, observar luneta; depois → MELEE, observar.
- **Esperado**: luneta RESSONANTE/AFINADA em ranged e **DIVERGENTE −10%**
  em melee puro, com tooltip "CONFLITA: …"; ao forçar melee, os mods
  `attune:luneta:*` rendem menos (SINTONIA B4 → LOG mostra ×0.90).
- **FAIL**: luneta continuar AFINADA em melee puro; ou estado mudar sem os
  mods mudarem (fantasma).

## 8. Família exclusiva (REGEN DE ESCUDO)
- **Preparar**: comprar **CONDENSADOR**.
- **DEV**: abrir lojas até a onda seguinte; `PESOS LOJA → LOG`.
- **Esperado**: PESO/LÁGRIMA **nunca** aparecem nas ofertas; slots de módulo
  continuam cheios; tooltip de qualquer rg_* mencionaria a família se
  oferecido antes da compra.
- **FAIL**: irmã do condensador ofertada; ou slot de módulo vazio/loop.

## 9. Reroll com cap + TRAVA
- **Preparar**: run normal; travar (TRAVA) um módulo; verificar que o botão
  REROLL continua funcionando e o custo sobe ×1.6 até bater o teto.
- **DEV**: `PESOS LOJA → LOG` após cada reroll.
- **Esperado**: custo do reroll PARA de subir no teto (6× base da onda);
  reroll NÃO perde a trava; se a trava for de um irmão de família já
  instalada, surge toast "TRAVA LIBERADA" e a loja rerola limpa.
- **FAIL**: custo subindo infinito; trava sumindo em silêncio.

## 10. Save / Continue
- **Preparar**: run com 3–4 módulos sintonizados; jogar 2 ondas; fechar o
  navegador na loja (checkpoint).
- **DEV**: nenhum (validar fora de DEV, sem tainted).
- **Esperado**: CONTINUE restaura módulos, stats e estados de sintonia
  idênticos (TAB mostra o mesmo PERFIL DE BUILD); nenhum módulo da mesma
  família é removido em saves antigos (grandfathering).
- **FAIL**: attune duplicado (dano "dobrado"), perfil diferente após voltar,
  módulo desaparecido.

## 11. Sandbox / DEV isolado
- **Preparar**: SANDBOX (lab); dar módulos com moral alta; forçar perfil.
- **DEV**: FORCE + SINTONIA → LOG dentro do lab.
- **Esperado**: tudo funciona no lab; SAIR restaura o save byte-a-byte
  (slots/moral/progresso); run NOVA nasce sem nenhum attune nem override.
- **FAIL**: alteração do lab vazando para o save; override permanecendo na
  run seguinte.

## 12. Loja com mãos ruins (sem garantia)
- **Preparar**: build dedicada (qualquer) e rolar 8–10 lojas SEM comprar o
  que combina; anotar estados das ofertas.
- **DEV**: `PESOS LOJA → LOG` a cada loja.
- **Esperado**: maioria NEUTRA, alguma AFINADA, às vezes DIVERGENTE; lojas
  inteiramente "ruins" acontecem; nenhum card de módulo owned; pesos no log
  entre ×0.75 e ×1.35.
- **FAIL**: TODAS as lojas vindo afinadas; algum peso ×2; card poluído com
  tag NEUTRA (neutro é silencioso).

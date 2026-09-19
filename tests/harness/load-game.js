'use strict';
/* =====================================================================
   tests/harness/load-game.js — PONTO ÚNICO DE CARREGAMENTO DO JOGO
   ---------------------------------------------------------------------
   Por que existe (AUDIT-FIX-E2-a)
   -------------------------------
   Até aqui, 43 suítes repetiam à mão a mesma sequência:

       const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
       const m    = html.match(/<script>([\s\S]*?)<\/script>/);
       if(!m) throw new Error('script não encontrado em index.html');
       let src    = m[1];

   Ou seja: a suposição "o jogo é UM único <script> inline dentro de
   index.html" estava codificada em dezenas de arquivos. Isso é o maior
   bloqueador do AUDIT-FIX-F (modularização incremental de index.html):
   mover qualquer trecho para um módulo externo quebraria as 43 suítes de
   uma só vez.

   Este módulo concentra leitura, extração e execução do código do jogo.
   Quando o AUDIT-FIX-F começar a mover código para arquivos externos,
   só `collectSources()` aqui muda — nenhuma suíte precisa ser tocada.

   O que este módulo NÃO é
   -----------------------
   · não é um framework de teste;
   · não monta DOM/Canvas/localStorage — cada suíte segue dona do seu
     sandbox e dos seus mocks (eles divergem de propósito);
   · não gerencia isolamento entre suítes: `tests/run-all.js` já roda
     cada suíte em processo próprio. O cache abaixo é por processo e
     guarda apenas strings imutáveis, portanto não vaza estado.

   API
   ---
     ROOT               raiz do repositório
     GAME_HTML_PATH     caminho absoluto de index.html
     SOURCE_LABEL       nome usado como `filename` no vm (stack traces)
     readGameHtml()     texto completo de index.html (CSS/markup inclusos),
                        normalizado para LF
     extractGameSource(html)
                        JavaScript do jogo a partir de um HTML qualquer —
                        é o ÚNICO lugar que sabe como o jogo é empacotado
     readGameSource()   atalho para extractGameSource(readGameHtml())
     runGameSource(src, context, options)
                        executa o código do jogo num contexto vm já criado
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME_HTML_PATH = path.join(ROOT, 'index.html');
const SOURCE_LABEL = 'index.html';

/* `<script>` inline ou `<script src="...">`; captura atributos e corpo. */
const SCRIPT_TAG = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
const SRC_ATTR = /\bsrc\s*=\s*["']([^"']+)["']/i;

let htmlCache = null;
let sourceCache = null;

/* Texto completo de index.html (markup + CSS + script), normalizado para
   LF: checkouts Windows com autocrlf traziam CRLF e quebravam buscas
   textuais com '\n' literal (era o que `audit_pr135/harness.js` já fazia
   por conta própria). */
function readGameHtml() {
  if (htmlCache === null)
    htmlCache = fs.readFileSync(GAME_HTML_PATH, 'utf8').replace(/\r\n?/g, '\n');
  return htmlCache;
}

/* Todos os trechos de JavaScript do jogo, em ordem de documento.
   Hoje existe exatamente um <script> inline; o ramo de `src` já está
   aqui para que a modularização do AUDIT-FIX-F não exija mudar suíte
   nenhuma. */
function collectSources(html) {
  const out = [];
  SCRIPT_TAG.lastIndex = 0;
  let m;
  while ((m = SCRIPT_TAG.exec(html))) {
    const attrs = m[1] || '';
    const ref = SRC_ATTR.exec(attrs);
    if (ref) {
      const file = path.resolve(path.dirname(GAME_HTML_PATH), ref[1]);
      if (!fs.existsSync(file))
        throw new Error('módulo de index.html não encontrado: ' + ref[1]);
      out.push(fs.readFileSync(file, 'utf8'));
    } else {
      out.push(m[2]);
    }
  }
  return out;
}

/* JavaScript do jogo a partir de um HTML arbitrário. Recebe o texto em vez
   de reler o arquivo porque `audit_pr155/performance_benchmark.js` injeta
   uma fonte alternativa em `audit_pr135/harness.js`.
   O resultado termina sempre em quebra de linha, para que a suíte possa
   concatenar o seu bridge de exports (`__t`) sem correr o risco de um
   comentário de linha final engolir o append. */
function extractGameSource(html) {
  const parts = collectSources(String(html));
  if (!parts.length) throw new Error('script não encontrado em index.html');
  let src = parts.join('\n;\n');
  if (!/\n$/.test(src)) src += '\n';
  return src;
}

/* JavaScript do jogo tal como está no repositório, pronto para o `vm`. */
function readGameSource() {
  if (sourceCache === null) sourceCache = extractGameSource(readGameHtml());
  return sourceCache;
}

/* Executa o código do jogo num contexto vm já criado pela suíte.
   `options` é repassado ao vm (ex.: `{timeout:20000}`); o `filename`
   padrão mantém os stack traces apontando para index.html. */
function runGameSource(src, context, options) {
  return vm.runInContext(src, context, Object.assign({ filename: SOURCE_LABEL }, options || {}));
}

module.exports = {
  ROOT,
  GAME_HTML_PATH,
  SOURCE_LABEL,
  readGameHtml,
  extractGameSource,
  readGameSource,
  runGameSource
};

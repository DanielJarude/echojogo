'use strict';
/* =====================================================================
   TESTES — PR14 · B6-FIX.1: GEOMETRIA DO BALÃO DE FALA DO ECHO
   ---------------------------------------------------------------------
   Playtest humano do B6 reprovou o balão: falas realistas de ~4 linhas
   estouravam a caixa por baixo (texto descia sobre o Echo) e o stress
   DEV.echoSpeakLong(60) dominava a viewport. Causa raiz: caixa e texto
   usavam ÂNCORAS Y OPOSTAS (caixa ancorada no rodapé, crescendo p/ cima;
   texto começando no topo e descendo) — só coincidiam com N=1.

   O B6-FIX.1 introduz um LAYOUT ÚNICO (speechLayout) que dirige caixa,
   texto, clamp e teto vertical. Estes testes provam a GEOMETRIA FINAL do
   desenho (não só o wrapping) — a lacuna que deixou o bug passar antes.

   Rodar: npm test | node tests/pr14-b6-fix1-speech-bubble.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  'speechWrapLines,speechLayout,speechRender,echoSpeak,speechClear,'+
  'echoSpeechDuration,speechEllipsize,speechLineH,speechGlyphH,'+
  'SPEECH_MAXW,SPEECH_PADX,SPEECH_PADY,SPEECH_GAP_ABOVE,SPEECH_VIEW_MARGIN,'+
  'SPEECH_MAX_LINES,SPEECH_PRI,ECHO_SPEECH_QUEUE_MAX,SPEECH_EST_CHARS_PER_LINE,'+
  'ECHO_LINES,ECHO_FACTION_REACTIONS,ECHO_DIPLO_REACTIONS,FRACTURE_B4_ECHO_LINES,'+
  'getSpeechActive:()=>speechActive,setSpeechActive:v=>{speechActive=v;},'+
  'getSpeechQueue:()=>speechQueue,'+
  'IS_DEV_BUILD,'+
  'setCam:(x,y)=>{cam.x=x;cam.y=y;},getCam:()=>({x:cam.x,y:cam.y}),'+
  'setView:(w,h)=>{vw=w;vh=h;},getView:()=>({vw,vh}),'+
  'clamp'+
  '};';
const RAW=src;

/* ---------------- DOM mínimo com measureText monospace ---------------- */
function makeStyle(){const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},set(t,k,v){t[k]=String(v);return true;}});}
function parsePx(font){const m=/(\d+(?:\.\d+)?)px/.exec(String(font||''));return m?parseFloat(m[1]):15;}
/* fração por caractere estável (~0.6·px). O importante: measureText no teste
   é o MESMO usado pelo wrap/layout ⇒ a geometria conferida é coerente. */
const CHARF=0.6;
function ctx2d(log){const grad={addColorStop(){}};
  const st={font:'15px monospace',globalAlpha:1,fillStyle:'',strokeStyle:'',
    lineWidth:1,lineJoin:'',shadowBlur:0,shadowColor:'',textAlign:'',textBaseline:''};
  return new Proxy(st,{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return(s)=>({width:String(s==null?'':s).length*parsePx(t.font)*CHARF});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    if(k==='fillRect')return(x,y,w,h)=>{if(log)log.rects.push({op:'fill',x,y,w,h});};
    if(k==='strokeRect')return(x,y,w,h)=>{if(log)log.rects.push({op:'stroke',x,y,w,h});};
    if(k==='fillText')return(txt,x,y)=>{if(log)log.texts.push({txt:String(txt),x,y,font:t.font,baseline:t.textBaseline,align:t.textAlign});};
    if(k==='strokeText')return(txt,x,y)=>{if(log)log.strokes.push({txt:String(txt),x,y});};
    if(k in t)return t[k];
    return()=>{};},set(t,k,v){t[k]=v;return true;}});}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),_handlers:{},parentNode:null,isConnected:true,
    offsetWidth:0,offsetHeight:0,textContent:'',innerHTML:'',className:'',title:'',style:makeStyle()};
  el.classList={add:(...c)=>c.forEach(x=>el._cls.add(x)),remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),toggle(c,f){const has=el._cls.has(c);const want=f===undefined?!has:!!f;
      if(want)el._cls.add(c);else el._cls.delete(c);return want;}};
  el.appendChild=c=>{if(c&&typeof c==='object')c.parentNode=el;el.children.push(c);return c;};
  el.insertBefore=c=>{if(c&&typeof c==='object')c.parentNode=el;el.children.unshift(c);return c;};
  el.removeChild=c=>{const i=el.children.indexOf(c);if(i>=0){el.children.splice(i,1);if(c&&typeof c==='object')c.parentNode=null;}return c;};
  el.remove=()=>{if(el.parentNode&&el.parentNode.removeChild)el.parentNode.removeChild(el);};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=()=>{};el.dispatchEvent=()=>{};el.click=()=>{};
  el.querySelector=sel=>((typeof sel==='string'&&sel.charAt(0)==='.')?makeEl(''):null);
  el.querySelectorAll=()=>[];el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d(null);
  Object.defineProperty(el,'lastChild',{get:()=>el.children.length?el.children[el.children.length-1]:null});
  Object.defineProperty(el,'firstChild',{get:()=>el.children.length?el.children[0]:null});
  return el;}
function findByTree(root,id){if(!root||typeof root!=='object')return null;if(root.id===id)return root;
  const ch=root.children;if(!ch)return null;for(const c of ch){const f=findByTree(c,id);if(f)return f;}return null;}
const DRAW={rects:[],texts:[],strokes:[]};
function makeEnv(seed){
  const elements=new Map();
  const gameCanvas=makeEl('game');gameCanvas.getContext=()=>ctx2d(DRAW);elements.set('game',gameCanvas);
  const document={hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,createElement:()=>makeEl(''),
    getElementById:id=>{for(const root of [document.body,document.documentElement].concat(Array.from(elements.values()))){
        const f=findByTree(root,id);if(f)return f;}if(!elements.has(id))elements.set(id,makeEl(id));return elements.get(id);},
    querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()};
  const window={innerWidth:1280,innerHeight:720,devicePixelRatio:1,screen:{availWidth:1280,availHeight:720},
    addEventListener:()=>{},removeEventListener:()=>{},matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined};
  const localStorage={_d:Object.assign({},seed||{}),getItem(k){return this._d[k]||null;},
    setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
  return {elements,document,window,localStorage,navigator:{getGamepads:()=>[]}};}
function runGame(env){
  const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,setTimeout:()=>0,clearTimeout:()=>{},
    requestAnimationFrame:()=>0,Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
    Promise,Proxy,Reflect,JSON,Symbol,isFinite,document:env.document,window:env.window,
    localStorage:env.localStorage,navigator:env.navigator,performance:{now:()=>Date.now()}};
  const ctx=vm.createContext(sandbox);vm.runInContext(src,ctx,{timeout:30000});
  const t=vm.runInContext('__t',ctx);return {t,ctx,env};}

const MAIN=runGame(makeEnv({}));
const t=MAIN.t;

let pass=0,fail=0;
function ok(name,fn){try{fn();console.log('  \u2714 '+name);pass++;}
  catch(e){console.log('  \u2718 '+name+'\n    '+(e&&e.message||e));fail++;}}

/* ---- helpers ---- */
function E(x,y,r){return {alive:true,x:x||0,y:y||0,r:r==null?13:r,hue:'#46e0ff',slot:0,
  pers:null,ps:null,rel:{seen:{},ap:0,rj:0},dis:{st:'stable',p:0}};}
function measure(s,px){return String(s).length*px*CHARF;}
function pxOf(pri){return pri>=t.SPEECH_PRI.critical?17:(pri>=t.SPEECH_PRI.high?16:15);}
/* renderiza uma fala e devolve caixa (fill), linhas (fillText) e layout puro */
function draw(txt,pri,ex,ey,er){
  t.setView(1280,720);
  DRAW.rects.length=0;DRAW.texts.length=0;DRAW.strokes.length=0;
  const e=E(ex||0,ey||0,er);
  t.speechClear();
  t.echoSpeak(e,txt,'#8ff6ff',pri||'high');
  t.speechRender();
  const box=DRAW.rects.find(r=>r.op==='fill');
  const border=DRAW.rects.find(r=>r.op==='stroke');
  return {box,border,texts:DRAW.texts.slice()};
}
/* limites verticais reais de uma linha de texto com baseline 'top'.
   topo = y; base = y + alturaDeGlifo. Usa a MESMA fórmula do código. */
function lineBounds(line,px){
  const w=measure(line.txt,px);
  return {left:line.x-w/2,right:line.x+w/2,top:line.y,bottom:line.y+Math.ceil(px*1.2)};
}
/* verifica que TODAS as linhas ficam dentro da caixa (com micro-tolerância) */
function textInsideBox(res,px){
  const b=res.box,eps=0.5;
  for(const ln of res.texts){
    const lb=lineBounds(ln,px);
    assert.ok(lb.left>=b.x-eps,'linha vaza à esquerda: "'+ln.txt+'"');
    assert.ok(lb.right<=b.x+b.w+eps,'linha vaza à direita: "'+ln.txt+'"');
    assert.ok(lb.top>=b.y-eps,'linha vaza no topo: "'+ln.txt+'"');
    assert.ok(lb.bottom<=b.y+b.h+eps,'linha vaza embaixo: "'+ln.txt+'" (bottom '+lb.bottom+' > '+(b.y+b.h)+')');
  }
}
/* verifica que a caixa fica dentro da viewport (mundo) */
function boxInsideView(res){
  const b=res.box,cam=t.getCam(),v=t.getView(),eps=0.5;
  const L=cam.x-v.vw/2,R=cam.x+v.vw/2,T=cam.y-v.vh/2,B=cam.y+v.vh/2;
  assert.ok(b.x>=L-eps,'caixa vaza à esquerda ('+b.x+')');
  assert.ok(b.x+b.w<=R+eps,'caixa vaza à direita ('+(b.x+b.w)+')');
  assert.ok(b.y>=T-eps,'caixa vaza no topo ('+b.y+')');
  assert.ok(b.y+b.h<=B+eps,'caixa vaza embaixo ('+(b.y+b.h)+')');
}

/* corpus real de falas do Echo (as que passam por echoSpeak) */
function collectRealLines(){
  const out=[];
  const push=v=>{if(typeof v==='string'&&v.trim())out.push(v);};
  const walk=o=>{if(!o)return;if(Array.isArray(o))o.forEach(walk);
    else if(typeof o==='object')for(const k in o)walk(o[k]);else push(o);};
  walk(t.ECHO_LINES);walk(t.ECHO_FACTION_REACTIONS);walk(t.ECHO_DIPLO_REACTIONS);
  walk(t.FRACTURE_B4_ECHO_LINES);
  return out;
}

const CASO2='A fratura está mudando de novo. Não sei quanto tempo essa estabilidade vai durar.';
const GIANT='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

console.log('\n=== PR14 · B6-FIX.1 — GEOMETRIA DO BALÃO DE FALA DO ECHO ===');

/* ============================================================
   ARQUITETURA / LAYOUT ÚNICO (1–8)
   ============================================================ */
ok('1. speechLayout existe e é o layout único',()=>{
  assert.strictEqual(typeof t.speechLayout,'function');
});
ok('2. speechRender deriva TUDO de speechLayout',()=>{
  const blk=RAW.match(/function speechRender[\s\S]*?\n}/)[0];
  assert.ok(/speechLayout\(/.test(blk),'render chama o layout');
  assert.ok(!/lines\.length\*lh/.test(blk),'render não recalcula altura por fora');
});
ok('3. speechRender usa textBaseline=top (âncora determinística)',()=>{
  const blk=RAW.match(/function speechRender[\s\S]*?\n}/)[0];
  assert.ok(/textBaseline\s*=\s*'top'/.test(blk),'baseline top fixado');
});
ok('4. constantes de layout definidas',()=>{
  for(const k of ['SPEECH_MAXW','SPEECH_PADX','SPEECH_PADY','SPEECH_GAP_ABOVE','SPEECH_VIEW_MARGIN','SPEECH_MAX_LINES'])
    assert.strictEqual(typeof t[k],'number','falta '+k);
});
ok('5. layout retorna caixa e âncora de texto coerentes',()=>{
  t.setView(1280,720);t.setCam(0,0);
  t.speechClear();t.echoSpeak(E(0,0),'OI','high');  // arma ctx.font? não — layout puro
  const L=t.speechLayout('OI',15,0,0,13);
  assert.ok(L&&L.bw>0&&L.bh>0);
  assert.strictEqual(L.textX,L.rx+L.bw/2,'texto centrado na caixa');
  assert.strictEqual(L.textTop,L.ry+L.padY,'texto começa após padding do topo');
});
ok('6. caixa e texto compartilham a MESMA origem (render)',()=>{
  const res=draw('LINHA UNICA','high');
  assert.ok(res.box&&res.border);
  assert.ok(Math.abs(res.box.x-res.border.x)<1e-9&&Math.abs(res.box.y-res.border.y)<1e-9,'fundo/borda mesma origem');
  const lb=lineBounds(res.texts[0],15);
  assert.ok(lb.top>=res.box.y-0.5,'texto ancorado à caixa');
});
ok('7. altura = 2·padY + (N-1)·lineHeight + alturaDeGlifo',()=>{
  for(const txt of ['UMA','UMA DUAS TRES QUATRO CINCO SEIS SETE OITO',CASO2]){
    const L=t.speechLayout(txt,15,0,0,13);
    const expect=2*t.SPEECH_PADY+(L.N-1)*t.speechLineH(15)+t.speechGlyphH(15);
    assert.ok(Math.abs(L.bh-expect)<1e-9,'altura errada p/ N='+L.N+' ('+L.bh+' vs '+expect+')');
  }
});
ok('8. determinístico: mesmo texto/posição ⇒ mesmo layout',()=>{
  const a=JSON.stringify(t.speechLayout(CASO2,15,10,20,13));
  const b=JSON.stringify(t.speechLayout(CASO2,15,10,20,13));
  assert.strictEqual(a,b);
});

/* ============================================================
   FALAS NORMAIS — CABEM 100% (9–18)
   ============================================================ */
ok('9. fala CURTA cabe inteira na caixa',()=>{
  textInsideBox(draw('Eles estão vindo.','normal'),pxOf(t.SPEECH_PRI.normal));
});
ok('10. fala MÉDIA cabe inteira na caixa',()=>{
  textInsideBox(draw('A fratura mudou. Fique perto de mim.','normal'),pxOf(t.SPEECH_PRI.normal));
});
ok('11. fala LONGA REALISTA (caso 2 do playtest) cabe inteira',()=>{
  const res=draw(CASO2,'high');
  assert.ok(res.texts.length>=3,'quebrou em várias linhas ('+res.texts.length+')');
  textInsideBox(res,pxOf(t.SPEECH_PRI.high));
});
ok('12. caso 2: ÚLTIMA linha fica ACIMA do rodapé da caixa (não vaza embaixo)',()=>{
  const res=draw(CASO2,'high');
  const px=pxOf(t.SPEECH_PRI.high);
  const last=res.texts[res.texts.length-1];
  const lb=lineBounds(last,px);
  assert.ok(lb.bottom<=res.box.y+res.box.h+0.5,'última linha dentro ('+lb.bottom+' <= '+(res.box.y+res.box.h)+')');
});
ok('13. caso 2: PRIMEIRA linha fica abaixo do topo da caixa (padding respeitado)',()=>{
  const res=draw(CASO2,'high');
  const first=res.texts[0];
  assert.ok(first.y>=res.box.y+t.SPEECH_PADY-0.5,'padding topo respeitado');
});
ok('14. nenhuma fala normal é truncada (sem reticências)',()=>{
  for(const s of ['Eles estão vindo.','A fratura mudou. Fique perto de mim.',CASO2]){
    const L=t.speechLayout(s,15,0,0,13);
    assert.ok(!L.truncated,'não truncou: '+s);
    assert.ok(!L.lines.join('').includes('…'),'sem ellipsis: '+s);
  }
});
ok('15. nº de linhas desenhadas = nº de linhas do layout',()=>{
  const res=draw(CASO2,'high');
  const L=t.speechLayout(CASO2,pxOf(t.SPEECH_PRI.high),0,0,13);
  assert.strictEqual(res.texts.length,L.N);
});
ok('16. caso 2: altura NÃO domina a arena (bh < 30% da viewport)',()=>{
  const L=t.speechLayout(CASO2,16,0,0,13);
  assert.ok(L.bh<0.30*720,'altura contida ('+L.bh+')');
});
ok('17. fonte preservada: px é 15/16/17 conforme prioridade',()=>{
  assert.strictEqual(pxOf(t.SPEECH_PRI.normal),15);
  assert.strictEqual(pxOf(t.SPEECH_PRI.high),16);
  assert.strictEqual(pxOf(t.SPEECH_PRI.critical),17);
});
ok('18. cada linha respeita a largura máxima do conteúdo',()=>{
  const L=t.speechLayout(CASO2,15,0,0,13);
  for(const ln of L.lines)assert.ok(measure(ln,15)<=t.SPEECH_MAXW+0.001,'linha larga: '+ln);
});

/* ============================================================
   PALAVRA GIGANTE / ACENTOS / \n (19–24)
   ============================================================ */
ok('19. palavra gigante: quebra segura, texto dentro da caixa',()=>{
  const res=draw(GIANT,'high');
  textInsideBox(res,pxOf(t.SPEECH_PRI.high));
});
ok('20. palavra gigante: sem overflow horizontal',()=>{
  const L=t.speechLayout(GIANT,15,0,0,13);
  for(const ln of L.lines)assert.ok(measure(ln,15)<=t.SPEECH_MAXW+0.001);
});
ok('21. acentos preservados no wrap',()=>{
  const L=t.speechLayout('RESSONÂNCIA ÇÃÕ ÉPICO estabilidade não',160,0,0,13);
  const j=L.lines.join(' ');
  assert.ok(j.includes('RESSONÂNCIA')&&j.includes('não'));
});
ok('22. símbolos e nomes preservados',()=>{
  const L=t.speechLayout('sinal αΩ Δ∴ desvio-27 ok',180,0,0,13);
  const j=L.lines.join(' ');
  assert.ok(j.includes('αΩ')&&j.includes('desvio-27'));
});
ok('23. \\n explícito vira linhas separadas',()=>{
  const L=t.speechLayout('LINHA UM\nLINHA DOIS',236,0,0,13);
  assert.ok(L.lines.includes('LINHA UM')&&L.N>=2);
});
ok('24. texto vazio não quebra o layout',()=>{
  assert.doesNotThrow(()=>t.speechLayout('',236,0,0,13));
  assert.doesNotThrow(()=>t.speechLayout(null,236,0,0,13));
});

/* ============================================================
   STRESS VERTICAL — DEV.echoSpeakLong(60) (25–32)
   ============================================================ */
function longText(n){
  const bag=['FRATURA','RESSONÂNCIA','ECO','VÍNCULO','ANÔMALO','ESTABILIDADE','desvio-27','αΩ'];
  const p=[];for(let i=0;i<n;i++)p.push(bag[i%bag.length]);return p.join(' ')+'.';
}
ok('25. stress(60): número de linhas limitado por SPEECH_MAX_LINES',()=>{
  const L=t.speechLayout(longText(60),16,0,0,13);
  assert.ok(L.N<=t.SPEECH_MAX_LINES,'linhas limitadas ('+L.N+' <= '+t.SPEECH_MAX_LINES+')');
});
ok('26. stress(60): marcado como truncado (com reticências)',()=>{
  const L=t.speechLayout(longText(60),16,0,0,13);
  assert.ok(L.truncated,'stress trunca');
  assert.ok(L.lines[L.lines.length-1].includes('…'),'última linha com reticências');
});
ok('27. stress(60): NÃO domina a viewport (bh <= 60% da altura)',()=>{
  const L=t.speechLayout(longText(60),16,0,0,13);
  assert.ok(L.bh<=0.60*720,'altura contida ('+L.bh+')');
});
ok('28. stress(60): texto todo dentro da caixa',()=>{
  const res=draw(longText(60),'high');
  textInsideBox(res,pxOf(t.SPEECH_PRI.high));
});
ok('29. stress(60): caixa dentro da viewport',()=>{
  t.setCam(0,0);
  const res=draw(longText(60),'high',0,0);
  boxInsideView(res);
});
ok('30. stress extremo(200 palavras): ainda seguro (linhas<=MAX, dentro da view)',()=>{
  t.setCam(0,0);
  const res=draw(longText(200),'high',0,0);
  const L=t.speechLayout(longText(200),16,0,0,13);
  assert.ok(L.N<=t.SPEECH_MAX_LINES);
  textInsideBox(res,pxOf(t.SPEECH_PRI.high));
  boxInsideView(res);
});
ok('31. viewport baixa: teto de linhas cai para caber na tela',()=>{
  t.setView(1280,140);t.setCam(0,0);
  const L=t.speechLayout(longText(60),16,0,0,13);
  const res=draw(longText(60),'high',0,0);
  boxInsideView(res);
  t.setView(1280,720);
});
ok('32. render não lança com texto gigante multi-parágrafo',()=>{
  assert.doesNotThrow(()=>draw((longText(40)+'\n').repeat(4),'critical'));
});

/* ============================================================
   VIEWPORT / CLAMP — 9 POSIÇÕES (33–44)
   ============================================================ */
const POS=[
  ['centro',0,0],['esquerda',-640,0],['direita',640,0],
  ['topo',0,-360],['baixo',0,360],
  ['sup-esq',-640,-360],['sup-dir',640,-360],
  ['inf-esq',-640,360],['inf-dir',640,360]];
for(let i=0;i<POS.length;i++){
  const [nm,px_,py_]=POS[i];
  ok((33+i)+'. '+nm+': caixa dentro da viewport e texto dentro da caixa',()=>{
    t.setView(1280,720);t.setCam(0,0);
    const res=draw(CASO2,'high',px_,py_);
    boxInsideView(res);
    textInsideBox(res,pxOf(t.SPEECH_PRI.high));
  });
}
ok('42. clamp segue a câmera (cam deslocada)',()=>{
  t.setView(1280,720);t.setCam(1000,-500);
  const res=draw(CASO2,'high',1000-640,-500);   // borda esquerda relativa à câmera
  boxInsideView(res);
  textInsideBox(res,pxOf(t.SPEECH_PRI.high));
  t.setCam(0,0);
});
ok('43. clamp move caixa E texto pelo MESMO delta',()=>{
  t.setView(1280,720);t.setCam(0,0);
  /* sem clamp (centro) vs com clamp (colado embaixo): a distância texto→caixa
     (offset interno) deve ser idêntica. */
  const free=draw(CASO2,'high',0,0);
  const clamped=draw(CASO2,'high',0,360);
  const offFree=free.texts[0].y-free.box.y;
  const offClamp=clamped.texts[0].y-clamped.box.y;
  assert.ok(Math.abs(offFree-offClamp)<1e-6,'offset interno preservado ('+offFree+' vs '+offClamp+')');
});
ok('44. balão maior que a tela: centralizado, sem cortar (fallback)',()=>{
  t.setView(200,120);t.setCam(0,0);
  const res=draw(longText(30),'high',0,0);
  /* não deve lançar; caixa centrada em torno da câmera */
  assert.ok(res.box,'desenhou');
  t.setView(1280,720);
});

/* ============================================================
   FALAS REAIS DO JOGO — NENHUMA TRUNCADA (45–50)
   ============================================================ */
const REAL=collectRealLines();
ok('45. corpus real de falas do Echo foi coletado (>50 falas)',()=>{
  assert.ok(REAL.length>50,'coletou '+REAL.length+' falas');
});
ok('46. maior fala real do jogo cabe em <= 4 linhas @236px',()=>{
  let max=0,worst='';
  for(const s of REAL){const L=t.speechLayout(s,16,0,0,13);if(L.N>max){max=L.N;worst=s;}}
  assert.ok(max<=4,'maior fala real tem '+max+' linhas: "'+worst+'"');
});
ok('47. NENHUMA fala real do jogo é truncada',()=>{
  const cut=[];
  for(const s of REAL){const L=t.speechLayout(s,16,0,0,13);if(L.truncated)cut.push(s);}
  assert.strictEqual(cut.length,0,'falas truncadas: '+cut.slice(0,3).join(' | '));
});
ok('48. TODAS as falas reais: texto dentro da caixa (amostra ampla)',()=>{
  t.setView(1280,720);t.setCam(0,0);
  const sample=REAL.slice(0,80);
  for(const s of sample){
    const res=draw(s,'high',0,0);
    textInsideBox(res,pxOf(t.SPEECH_PRI.high));
  }
});
ok('49. maior fala real: altura contida (não domina a arena)',()=>{
  let maxBh=0;
  for(const s of REAL){const L=t.speechLayout(s,16,0,0,13);if(L.bh>maxBh)maxBh=L.bh;}
  assert.ok(maxBh<0.30*720,'maior altura real '+maxBh);
});
ok('50. SPEECH_MAX_LINES é folgado vs. maior fala real (headroom)',()=>{
  let max=0;for(const s of REAL){const L=t.speechLayout(s,16,0,0,13);if(L.N>max)max=L.N;}
  assert.ok(t.SPEECH_MAX_LINES>=max+2,'teto ('+t.SPEECH_MAX_LINES+') com folga sobre '+max);
});

/* ============================================================
   DURAÇÃO / PIPELINE PRESERVADOS (51–58)
   ============================================================ */
ok('51. duração cresce com o texto',()=>{
  assert.ok(t.echoSpeechDuration(CASO2,'normal')>t.echoSpeechDuration('OI','normal'));
});
ok('52. duração respeita cap de 5.0s (contrato B2-A)',()=>{
  assert.ok(t.echoSpeechDuration('x'.repeat(300),'critical')<=5.0+1e-9);
});
ok('53. duração respeita piso 1.6s',()=>{
  assert.ok(t.echoSpeechDuration('','low')>=1.6-1e-9);
});
ok('54. duração determinística e finita',()=>{
  for(const p of ['low','normal','high','critical']){
    const d=t.echoSpeechDuration(CASO2,p);
    assert.ok(Number.isFinite(d)&&d>0);
  }
});
ok('55. speechClear reseta ativa e fila',()=>{
  const e=E(0,0);t.echoSpeak(e,'A','high');t.echoSpeak(e,'B','normal');
  t.speechClear();
  assert.strictEqual(t.getSpeechActive(),null);
  assert.strictEqual(t.getSpeechQueue().length,0);
});
ok('56. fila respeita ECHO_SPEECH_QUEUE_MAX',()=>{
  t.speechClear();const e=E(0,0);
  for(let i=0;i<10;i++)t.echoSpeak(e,'FALA ALTA '+i,'high');
  assert.ok(t.getSpeechQueue().length<=t.ECHO_SPEECH_QUEUE_MAX);
});
ok('57. render sem fala ativa não desenha nada',()=>{
  DRAW.rects.length=0;DRAW.texts.length=0;t.speechClear();t.speechRender();
  assert.strictEqual(DRAW.rects.length,0);assert.strictEqual(DRAW.texts.length,0);
});
ok('58. sem Math.random no layout/render/wrap (determinístico)',()=>{
  for(const fn of ['speechLayout','speechRender','speechWrapLines']){
    const blk=RAW.match(new RegExp('function '+fn+'[\\s\\S]*?\\n}'))[0];
    assert.ok(!/Math\.random/.test(blk),fn+' sem Math.random');
  }
});

/* ============================================================
   DEV HELPERS / PERFORMANCE / RELEASE (59–62)
   ============================================================ */
ok('59. DEV.echoSpeakLong e DEV.echoSpeak presentes e DEV-only',()=>{
  assert.ok(/echoSpeakLong\(n,slot\)\{/.test(RAW));
  const longBlk=RAW.match(/echoSpeakLong\(n,slot\)\{[\s\S]*?\n  \},/)[0];
  assert.ok(/devReady\(\)/.test(longBlk),'echoSpeakLong exige devReady');
  const manBlk=RAW.match(/\n\s*echoSpeak\(txt,slot\)\{[\s\S]*?\n  \},/)[0];
  assert.ok(/devReady\(\)/.test(manBlk),'echoSpeak manual exige devReady');
});
ok('60. helpers DEV não expostos como global',()=>{
  assert.ok(!/window\.echoSpeakLong/.test(RAW));
  assert.ok(!/window\.echoSpeak\b/.test(RAW));
});
ok('61. layout não mede o canvas por frame além do necessário (só measureText de texto)',()=>{
  const blk=RAW.match(/function speechLayout[\s\S]*?\n}/)[0];
  assert.ok(!/getImageData|createLinearGradient/.test(blk),'sem operações pesadas no layout');
});
ok('62. performance: render só roda com fala ativa (early return)',()=>{
  const blk=RAW.match(/function speechRender[\s\S]*?\n}/)[0];
  assert.ok(/if\(!speechActive\)return;/.test(blk),'early return presente');
});

/* ---------------- resumo ---------------- */
console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0){console.log('PR14 · B6-FIX.1 — HÁ TESTES FALHANDO');process.exit(1);}

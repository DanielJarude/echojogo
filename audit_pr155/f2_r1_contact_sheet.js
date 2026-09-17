/* PR15.5-F2-R1 · CONTACT SHEET DE AUDITORIA VISUAL (§56)
   Ferramenta TEMPORÁRIA de auditoria — NÃO é asset de produção e nada
   em index.html depende dela. Reproduz o stream de comandos Canvas dos
   quatro operadores do Grupo A como SVG para inspeção humana, sem
   adicionar nenhuma dependência ao projeto.

   Uso:  node audit_pr155/f2_r1_contact_sheet.js [saida.svg]

   Bandas geradas:
     A0 · 1:1 absoluto (r=14 — exatamente o tamanho de jogo)
     A  · escala real, paleta real, com arma
     B  · escala real, monocromático, sem arma, sem HUD
     C  · inspeção 2×
     D  · octantes de mira 0/90/180/270°
     E  · portrait do character select (mesma fonte estrutural) */
const fs=require('fs'),vm=require('vm');
const {sandbox,T}=require('../audit_pr135/harness.js');
const run=s=>vm.runInContext(s,sandbox);run('DEV_MODE=true;sandboxRun=true;');
// Reproduz o stream Canvas em SVG para auditoria (sem dependências).
function capture(expr){sandbox.__ctxLog=[];try{run(expr);}finally{const x=sandbox.__ctxLog;sandbox.__ctxLog=null;return x;}}
function toSVG(log,cx,cy,scale){
  let out='',st={fill:'#888',stroke:'#888',lw:1,alpha:1},stack=[],tf=[1,0,0,1,0,0],path=[],cur=null;
  const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const P=(x,y)=>[tf[0]*x+tf[2]*y+tf[4],tf[1]*x+tf[3]*y+tf[5]];
  const em=(f)=>{if(!path.length)return;
    let d='';for(const s of path)d+=s;
    out+='<path d="'+d+'" fill="'+(f?st.fill:'none')+'" stroke="'+(f?'none':st.stroke)+'" stroke-width="'+(f?0:st.lw)+'" fill-opacity="'+st.alpha+'" stroke-opacity="'+st.alpha+'"/>';};
  for(const [op,a] of log){
    if(op==='save'){stack.push([tf.slice(),Object.assign({},st)]);}
    else if(op==='restore'){const s=stack.pop();if(s){tf=s[0];st=s[1];}}
    else if(op==='translate')tf=mul(tf,[1,0,0,1,a[0],a[1]]);
    else if(op==='scale')tf=mul(tf,[a[0],0,0,a[1],0,0]);
    else if(op==='rotate'){const c=Math.cos(a[0]),s=Math.sin(a[0]);tf=mul(tf,[c,s,-s,c,0,0]);}
    else if(op==='set:fillStyle')st.fill=typeof a[0]==='string'?a[0]:'#888';
    else if(op==='set:strokeStyle')st.stroke=typeof a[0]==='string'?a[0]:'#888';
    else if(op==='set:lineWidth')st.lw=a[0];
    else if(op==='set:globalAlpha')st.alpha=a[0];
    else if(op==='beginPath')path=[];
    else if(op==='moveTo'){const p=P(a[0],a[1]);path.push('M'+p[0].toFixed(2)+' '+p[1].toFixed(2));}
    else if(op==='lineTo'){const p=P(a[0],a[1]);path.push('L'+p[0].toFixed(2)+' '+p[1].toFixed(2));}
    else if(op==='closePath')path.push('Z');
    else if(op==='rect'||op==='roundRect'||op==='fillRect'){
      const [x,y,w,h]=a;const c=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(q=>P(q[0],q[1]));
      const seg='M'+c.map(q=>q[0].toFixed(2)+' '+q[1].toFixed(2)).join('L')+'Z';
      if(op==='fillRect'){path=[seg];em(1);path=[];}else path.push(seg);}
    else if(op==='arc'){const [x,y,rr,s0,s1]=a;const N=16;let s='';
      for(let i=0;i<=N;i++){const t=s0+(s1-s0)*i/N;const p=P(x+Math.cos(t)*rr,y+Math.sin(t)*rr);s+=(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2);}
      path.push(s+(Math.abs(s1-s0)>6.2?'Z':''));}
    else if(op==='ellipse'){const [x,y,rx,ry]=a;const N=18;let s='';
      for(let i=0;i<=N;i++){const t=i/N*Math.PI*2;const p=P(x+Math.cos(t)*rx,y+Math.sin(t)*ry);s+=(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2);}
      path.push(s+'Z');}
    else if(op==='fill')em(1);
    else if(op==='stroke')em(0);
  }
  return out;
}
const IDS=['vector','wraith','bulwark','pyre'];
const MONO='{body:"#8a8a8a",dark:"#4a4a4a",edge:"#c8c8c8",glow:"#b0b0b0",visor:"#e8e8e8",head:"#8a8a8a",wep:"#aaa"}';
function palOf(id){const C=T.CHARS.find(c=>c.id===id);const p=C.pal;
  return `{body:"${p.body}",dark:"${p.dark}",edge:"${p.edge}",glow:"${p.glow}",visor:"${p.visor}",head:"${p.head}",wep:"${p.glow}"}`;}
let rows='';
function band(title,mk,cell,scale){
  let cells='';
  IDS.forEach((id,i)=>{
    const log=mk(id);
    cells+='<g transform="translate('+(i*cell)+',0)">'+
      '<rect width="'+cell+'" height="'+cell+'" fill="#0a1016" stroke="#1d2b38"/>'+
      '<g transform="translate('+(cell/2)+','+(cell/2)+') scale('+scale+') translate(-500,-400)">'+toSVG(log)+'</g>'+
      '<text x="6" y="14" fill="#5d7a8c" font-family="monospace" font-size="10">'+id.toUpperCase()+'</text></g>';
  });
  rows+='<g transform="translate(0,'+ROW+')"><text x="0" y="-8" fill="#9ff3ff" font-family="monospace" font-size="12">'+title+'</text>'+cells+'</g>';
  ROW+=cell+34;
}
let ROW=30;
band('A0 · 1:1 ABSOLUTO (r=14 — exatamente como aparece no jogo)',
  id=>capture(`drawUnit(500,400,0,14,${palOf(id)},{wi:0,walk:.4,phase:0,visual:getOperatorVisual("${id}")})`),56,1);
band('A · ESCALA REAL DE GAMEPLAY (r=14, paleta real, com arma)',
  id=>capture(`drawUnit(500,400,0,14,${palOf(id)},{wi:0,walk:.4,phase:0,visual:getOperatorVisual("${id}")})`),120,1.6);
band('B · ESCALA REAL, MONOCROMÁTICO, SEM ARMA, SEM HUD',
  id=>{run('globalThis.__w=drawWeaponSprite;drawWeaponSprite=function(){}');
    try{return capture(`drawUnit(500,400,0,14,${MONO},{wi:0,walk:.4,phase:0,visual:getOperatorVisual("${id}")})`);}
    finally{run('drawWeaponSprite=globalThis.__w');}},120,1.6);
band('C · INSPEÇÃO 2× (paleta real)',
  id=>capture(`drawUnit(500,400,0,14,${palOf(id)},{wi:0,walk:.4,phase:0,visual:getOperatorVisual("${id}")})`),200,3.2);
// octantes
for(const oc of [0,2,4,6]){
  band('D · AIM '+(oc*45)+'° (monocromático, sem arma)',
    id=>{run('globalThis.__w=drawWeaponSprite;drawWeaponSprite=function(){}');
      try{return capture(`drawUnit(500,400,${oc*Math.PI/4},14,${MONO},{wi:0,walk:.4,phase:0,visual:getOperatorVisual("${id}")})`);}
      finally{run('drawWeaponSprite=globalThis.__w');}},110,1.5);
}
// portraits
let pc='';
IDS.forEach((id,i)=>{
  const svg=vm.runInContext('charPortrait(CHARS.find(c=>c.id==="'+id+'"),96)',sandbox);
  const inner=svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  pc+='<g transform="translate('+(i*120)+',0)"><rect width="120" height="120" fill="#0a1016" stroke="#1d2b38"/>'+
    '<g transform="translate(12,12) scale(2.4)">'+inner+'</g>'+
    '<text x="6" y="14" fill="#5d7a8c" font-family="monospace" font-size="10">'+id.toUpperCase()+'</text></g>';
});
rows+='<g transform="translate(0,'+ROW+')"><text x="0" y="-8" fill="#9ff3ff" font-family="monospace" font-size="12">E · PORTRAIT / CHARACTER SELECT (mesma fonte estrutural)</text>'+pc+'</g>';
ROW+=150;
const W=900,H=ROW+20;
fs.writeFileSync(process.argv[2]||'/tmp/pr15-5-f2-r1-sheet.svg','<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><rect width="'+W+'" height="'+H+'" fill="#04070d"/><g transform="translate(20,20)">'+rows+'</g></svg>');
console.log('written',W,H);

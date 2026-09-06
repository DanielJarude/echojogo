'use strict';
/* =====================================================================
   PR13.5 · B5.5 — AUDITORIA & SIMULAÇÃO DA ECONOMIA DE ◆ MEMÓRIA
   ---------------------------------------------------------------------
   NÃO altera gameplay. Mede a recompensa REAL (fórmula de onVictory)
   contra os preços REAIS do META_SHOP e projeta marcos de progressão
   para a economia ATUAL e para cenários candidatos de reward.

   Perfis de run (A/B/C) derivam de dados REAIS do jogo:
     · total de inimigos das ondas 1..20 = Σ waveComp (harness);
     · nível pela curva real de XP (xpNext' = floor(xpNext*1.32+6));
     · moedas finais por faixa observável (renda bruta ≈ 2.4–3.3k,
       o jogador gasta na loja — sobra típica 100–600);
     · bônus de final EXATOS de onVictory (liber 25 … exilio 15).

   O script também simula a compra GREEDY do META_SHOP (mais barato
   primeiro) para converter reward → nº de vitórias até cada marco.
   ===================================================================== */
const {T}=require('./harness.js');

/* ---- dados reais coletados do jogo ---- */
const META_SHOP=[                                   // espelho EXATO de index.html
  {id:'spd',   cost:60,max:5},
  {id:'reroll',cost:80,max:3},
  {id:'vault', cost:45,max:4}
];
const META_FULL=META_SHOP.reduce((a,m)=>a+m.cost*m.max,0);   // 720

/* inimigos totais por waveComp (medido no harness) */
let ENEMIES=0;
for(let w=1;w<=20;w++){T.setWave(w);const c=T.waveComp(w);
  for(const t of T.WAVE_KEYS)ENEMIES+=Math.max(0,Math.round(c[t]||0));}

/* curva real de XP → nível dado XP total */
function levelForXP(xp){let need=20,lv=1;
  while(xp>=need&&lv<40){xp-=need;lv++;need=Math.floor(need*1.32+6);}
  return lv;}
/* XP bruto ≈ inimigos × xp médio (EDEFS 3..20, tanques raros → ~6.5) */
const XP_RUN=Math.round(ENEMIES*6.5);

/* bônus de final EXATOS (onVictory) */
const END_BONUS={liber:25,tirano:18,dueto:22,refugio:20,silencio:18,exilio:15};

/* ---- FÓRMULAS CANDIDATAS ----
   current: a de produção hoje (onVictory).
   As opções preservam a FORMA (qualidade da run importa) e os bônus de
   final (identidade); mudam a ESCALA e, na OPT3, acrescentam UM fator de
   decaimento por vitórias prévias (meta.wins já persistido).        */
const FORMULAS={
  CURRENT:{nm:'ATUAL',
    f:s=>s.wave*4+s.kills*.8+s.level*3+s.coins*.22+s.items*12+s.bonus+30},
  OPT1:{nm:'MODERADO (escala ≈×.45)',
    f:s=>s.wave*2+s.kills*.35+s.level*2+s.coins*.12+s.items*8+s.bonus+20},
  OPT2:{nm:'CONTIDO (escala ≈×.3)',
    f:s=>s.wave*1.5+s.kills*.25+s.level*1.5+s.coins*.09+s.items*6+s.bonus+15},
  OPT3:{nm:'ENXUTO+DECAIMENTO (base ≈×.25, ×.8^wins piso .5)',
    f:s=>(s.wave*1.2+s.kills*.18+s.level*1.2+s.coins*.07+s.items*5+s.bonus+12)*
         Math.max(.5,Math.pow(.8,s.winsBefore))},
  OPT4:{nm:'ENXUTO puro (escala ≈×.25)',
    f:s=>s.wave*1.2+s.kills*.18+s.level*1.2+s.coins*.07+s.items*5+s.bonus+12}
};

/* perfis de vitória (frações do total real de inimigos/XP) */
const PROFILES=[
  {id:'A',nm:'iniciante (vitória apertada)', killFrac:.55,coins:120,items:4,ending:'exilio'},
  {id:'B',nm:'típico',                        killFrac:.75,coins:300,items:5,ending:'liber'},
  {id:'C',nm:'dominante',                     killFrac:.90,coins:550,items:7,ending:'refugio'}
];
for(const p of PROFILES){
  p.wave=20;p.kills=Math.round(ENEMIES*p.killFrac);
  p.level=levelForXP(Math.round(XP_RUN*p.killFrac));
  p.bonus=END_BONUS[p.ending]||0;
}

/* vitórias até marcos, comprando greedy (mais barato primeiro) */
function milestones(rewardOf){
  const spendOrder=()=>{
    const a=[];for(const m of META_SHOP)for(let i=0;i<m.max;i++)a.push(m.cost);
    return a.sort((x,y)=>x-y);};
  const runTo=target=>{let m=0,w=0;
    while(m<target&&w<500){m+=rewardOf(w);w++;}
    return m>=target?w:null;};
  const buyTo=target=>{let m=0,w=0,spent=0;const so=spendOrder();
    while(spent<target&&w<500){m+=rewardOf(w);
      while(so.length&&m>=so[0]){m-=so[0];spent+=so[0];so.shift();}
      w++;}
    return spent>=target?w:null;};
  return {runTo100:runTo(META_FULL),buyTo50:buyTo(Math.floor(META_FULL*.5)),
          buyTo100:buyTo(META_FULL)};
}

console.log('=== ECONOMIA ◆ MEMÓRIA — PR13.5 B5.5 ===');
console.log('inimigos/run(waveComp)=',ENEMIES,'· XP bruto≈',XP_RUN,'· META_SHOP total=',META_FULL);
console.log('');
console.log('--- reward por perfil (base, SEM decaimento p/ comparação) ---');
for(const k in FORMULAS){
  const F=FORMULAS[k];
  const row=PROFILES.map(p=>{
    const v=F.f({wave:p.wave,kills:p.kills,level:p.level,coins:p.coins,items:p.items,bonus:p.bonus,winsBefore:0});
    return p.id+'='+Math.round(v);
  }).join('  ');
  console.log(k.padEnd(8),F.nm.padEnd(42),row,' | %meta(1ª vitória B)=',(Math.round(F.f({wave:20,kills:PROFILES[1].kills,level:PROFILES[1].level,coins:PROFILES[1].coins,items:PROFILES[1].items,bonus:PROFILES[1].bonus,winsBefore:0}))/META_FULL*100).toFixed(0)+'%');
}
console.log('');
console.log('--- marcos (vitórias) por fórmula: compra greedy entre vitórias ---');
for(const k in FORMULAS){
  if(k==='OPT4')continue; // OPT3 ⊃ OPT4 (mesma base); OPT4 citado na doc
  const F=FORMULAS[k];
  // primeira vitória do perfil B
  const fw=Math.round(F.f({wave:20,kills:PROFILES[1].kills,level:PROFILES[1].level,coins:PROFILES[1].coins,items:PROFILES[1].items,bonus:PROFILES[1].bonus,winsBefore:0}));
  const M=milestones(w=>Math.round(F.f({wave:20,kills:PROFILES[1].kills,level:PROFILES[1].level,coins:PROFILES[1].coins,items:PROFILES[1].items,bonus:PROFILES[1].bonus,winsBefore:w})));
  console.log(k.padEnd(8),'1ª vitória(B)=',fw,
    '· 50% meta=',M.buyTo50,'vitórias · 100% meta(comprando)=',M.buyTo100,
    '· 100% meta(acumulando)=',M.runTo100,'vitórias');
}
console.log('');
console.log('--- farm D: acumulado em 10 vitórias repetidas (perfil B) ---');
for(const k in FORMULAS){
  if(k==='OPT4')continue;
  const F=FORMULAS[k];let acc=0;
  for(let w=0;w<10;w++)acc+=Math.round(F.f({wave:20,kills:PROFILES[1].kills,level:PROFILES[1].level,coins:PROFILES[1].coins,items:PROFILES[1].items,bonus:PROFILES[1].bonus,winsBefore:w}));
  console.log(k.padEnd(8),'10 vitórias =',acc,'◆ =',(acc/META_FULL*100).toFixed(0)+'% da meta');
}
console.log('');
console.log('--- sensibilidade: 1ª vitória compra o quê (perfil A/B/C)? ---');
for(const k of ['CURRENT','OPT2','OPT3']){
  const F=FORMULAS[k];
  for(const p of PROFILES){
    const v=Math.round(F.f({wave:p.wave,kills:p.kills,level:p.level,coins:p.coins,items:p.items,bonus:p.bonus,winsBefore:0}));
    console.log(k.padEnd(8),p.id,'1ª vitória=',v,'◆ →',v>=185?'vault+spd (2 upgrades)':v>=60?'1 upgrade':'nada ainda');
  }
}

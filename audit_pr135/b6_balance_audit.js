'use strict';
/* =====================================================================
   PR13.5 B6 — AUDITORIA DE BALANCEAMENTO
   ---------------------------------------------------------------------
   Consome b6_run_sim.js (proxy determinístico) e emite as tabelas
   agregadas exigidas pelo bloco: armas, builds, operadores, temas,
   minibosses, Paradoxo, sobrevivência, economia.

   LIMITAÇÃO CENTRAL (repetida de propósito): tudo aqui é PROXY.
   Números absolutos não são "dificuldade real". O que tem valor é a
   COMPARAÇÃO relativa entre linhas da mesma tabela, porque todas
   compartilham exatamente os mesmos coeficientes.
   ===================================================================== */
const path=require('path');
const S=require(path.join(__dirname,'b6_run_sim.js'));
const {T,sandbox}=S;

const SEED=+(process.argv[2]||20260905);
const N=+(process.argv[3]||1000);
const only=(process.argv[4]||'').toLowerCase();
const want=k=>!only||only===k||only==='all';

function bar(v,max,w){const n=Math.max(0,Math.min(w,Math.round(v/max*w)));return '█'.repeat(n)+'·'.repeat(w-n);}
function pad(s,n){s=String(s);return s.length>=n?s.slice(0,n):s+' '.repeat(n-s.length);}
function rpad(s,n){s=String(s);return s.length>=n?s:' '.repeat(n-s.length)+s;}
const f=S.fmt;

/* ===================================================================
   B6-B — ARMAS (DPS efetivo em 3 cenários de multidão)
   =================================================================== */
function auditWeapons(){
  console.log('\n================ B6-B · ARMAS ================');
  console.log('DPS efetivo = dmg × cadência × crit × uptime(classe) × multi-alvo(crowd).');
  console.log('Player de referência: VECTOR base (dmg×1, crit .05, critMul 1.8). Sem itens.\n');
  const p=S.buildPlayer('vector',{});
  const rows=[];
  for(const w of T.WEAPONS){
    const solo=S.playerDps(p,w,1);      // 1 alvo (boss/miniboss)
    const grp =S.playerDps(p,w,12);     // grupo médio
    const horde=S.playerDps(p,w,40);    // horda late
    const ctl=S.controlValue(w,12);
    /* VALOR TOTAL = dano + controle convertido. 1.0 de uptime de controle
       vale ~0,5 do DPS mediano em segurança (heurística declarada). */
    rows.push({id:w.id,nm:w.nm,cls:S.weaponClass(w),rar:w.rar,range:w.range,
      solo,grp,horde,ctl,mix:(solo*.35+grp*.4+horde*.25)});
  }
  const dpsMed=S.stats(rows.map(r=>r.mix)).med;
  for(const r of rows)r.val=r.mix+r.ctl*dpsMed*.5;
  rows.sort((a,b)=>b.val-a.val);
  const mx=rows[0].val;
  const st=S.stats(rows.map(r=>r.val));
  console.log(pad('ARMA',26)+pad('CLASSE',8)+'R '+rpad('SOLO',7)+rpad('GRUPO',7)+rpad('HORDA',7)+
    rpad('DPSmix',8)+rpad('CTL',6)+rpad('VALOR',7)+'  PERFIL');
  for(const r of rows)
    console.log(pad(r.nm,26)+pad(r.cls,8)+r.rar+' '+rpad(f(r.solo,0),7)+rpad(f(r.grp,0),7)+
      rpad(f(r.horde,0),7)+rpad(f(r.mix,0),8)+rpad(f(r.ctl*100,0)+'%',6)+rpad(f(r.val,0),7)+
      '  '+bar(r.val,mx,16));
  console.log(`\nVALOR: min=${f(st.min,0)} p10=${f(st.p10,0)} mediana=${f(st.med,0)} média=${f(st.avg,0)} p90=${f(st.p90,0)} max=${f(st.max,0)}`);
  console.log(`RAZÃO max/mediana = ${f(st.max/st.med,2)}×   ·   mediana/min = ${f(st.med/st.min,2)}×`);
  /* outlier = fora de [med/2, med*2] */
  const hi=rows.filter(r=>r.val>st.med*2),lo=rows.filter(r=>r.val<st.med/2);
  console.log('OUTLIERS ALTOS (>2× mediana): '+(hi.map(r=>r.nm+' '+f(r.val,0)).join(' | ')||'nenhum'));
  console.log('OUTLIERS BAIXOS (<0,5× mediana): '+(lo.map(r=>r.nm+' '+f(r.val,0)).join(' | ')||'nenhum'));
  return {rows,st,hi,lo};
}

/* ===================================================================
   B6-B/H — BUILDS × OPERADORES (run completa)
   =================================================================== */
/* Builds PLAUSÍVEIS: todo jogador real compra dano em algum momento. Um
   "curso" 100% defensivo não é uma build, é um erro de jogo — medir isso
   produziria um falso outlier "tank inviável". Cada curso mistura a
   identidade da build com um mínimo ofensivo. */
const BUILDS={
  A_melee   :{weapon:'glaive', course:['dmg','hp','vamp','dmg2','sprint'],        nm:'A · MELEE'},
  B_ranged  :{weapon:'plasma', course:['dmg','rate','range','dmg2','rate2'],      nm:'B · RANGED PADRÃO'},
  C_crit    :{weapon:'sniper', course:['crit','critd','critx','dmg','dmg2'],      nm:'C · CRIT'},
  D_rate    :{weapon:'gatling',course:['rate','rate2','dmg','rate','omni'],       nm:'D · CADÊNCIA'},
  E_tank    :{weapon:'shotgun',course:['hp','dmg','hp','dmg2','rate'],            nm:'E · SHIELD/TANK'},
  F_sustain :{weapon:'scythe', course:['vamp','dmg','hp','vamp','dmg2'],          nm:'F · SUSTAIN/LIFESTEAL'},
  G_proc    :{weapon:'tesla',  course:['aoe','pierce','dmg','pierce2','dmg2'],    nm:'G · PROC/ÁREA'},
  H_mixed   :{weapon:'homing', course:['dmg','rate','crit','range2','omni'],      nm:'H · MISTA'}
};
const OPS=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];

function runMany(char,b,n,seedBase){
  const surv=[],hp=[],time=[],lvl=[],deep=[],mar=[],tak=[];
  for(let i=0;i<n;i++){
    const r=S.simRun({char,weapon:b.weapon,echoes:2,seed:seedBase+i*7919,
      plan:{course:b.course}});
    surv.push(r.died?0:1);hp.push(r.finalHp);time.push(r.totalTime);
    lvl.push(r.finalLevel);deep.push(r.died?r.diedWave:21);
    mar.push(r.margin);tak.push(r.totalTaken);
  }
  return {surv:surv.reduce((a,c)=>a+c,0)/n,hp:S.stats(hp),time:S.stats(time),
    lvl:S.stats(lvl),deep:S.stats(deep),margin:S.stats(mar),taken:S.stats(tak)};
}

function auditBuilds(){
  console.log('\n================ B6-B/H · BUILDS × OPERADORES ================');
  console.log(`N=${N} runs por célula. Taxa de sobrevivência é PROXY (SKILL=${S.SKILL} global e idêntico p/ todos).\n`);
  const grid={};
  console.log('Célula = MARGEM mediana (menor % de HP atingido na run). <=0% = morreu.');
  console.log('A margem é CONTÍNUA: distingue "passou raspando" de "passou folgado".\n');
  console.log(pad('BUILD',24)+OPS.map(o=>rpad(o.slice(0,7),8)).join('')+rpad('MÉDIA',9));
  for(const bk of Object.keys(BUILDS)){
    const b=BUILDS[bk];const line=[];let sum=0;
    grid[bk]={};
    for(const op of OPS){
      const r=runMany(op,b,N,SEED+bk.length*131+op.length*17);
      grid[bk][op]=r;line.push(rpad(f(r.margin.med*100,0)+'%',8));sum+=r.margin.med;
    }
    console.log(pad(b.nm,24)+line.join('')+rpad(f(sum/OPS.length*100,0)+'%',9));
  }
  /* médias por eixo */
  console.log('\n-- POR OPERADOR (média das 8 builds) --');
  const byOp={};
  for(const op of OPS){let s=0,t=0,h=0,m=0;for(const bk of Object.keys(BUILDS)){
    s+=grid[bk][op].surv;t+=grid[bk][op].time.avg;h+=grid[bk][op].hp.avg;m+=grid[bk][op].margin.med;}
    byOp[op]={surv:s/8,time:t/8,hp:h/8,margin:m/8};}
  const opv=Object.values(byOp).map(x=>x.margin);const ost=S.stats(opv);
  const omx=Math.max(...opv,.001);
  for(const op of OPS)
    console.log(pad(op,12)+'margem='+rpad(f(byOp[op].margin*100,1)+'%',8)+' surv='+rpad(f(byOp[op].surv*100,0)+'%',6)+
      ' t='+rpad(f(byOp[op].time,0)+'s',7)+' HPfim='+rpad(f(byOp[op].hp,0),5)+' '+bar(byOp[op].margin,omx,18));
  console.log(`spread operadores (margem): ${f(ost.min*100,1)}% … ${f(ost.max*100,1)}%  (Δ=${f((ost.max-ost.min)*100,1)} p.p.)`);

  console.log('\n-- POR BUILD (média dos 8 operadores) --');
  const byB={};
  for(const bk of Object.keys(BUILDS)){let s=0,t=0,m=0;for(const op of OPS){
    s+=grid[bk][op].surv;t+=grid[bk][op].time.avg;m+=grid[bk][op].margin.med;}
    byB[bk]={surv:s/8,time:t/8,margin:m/8};}
  const bv=Object.values(byB).map(x=>x.margin);const bst=S.stats(bv);
  const bmx=Math.max(...bv,.001);
  for(const bk of Object.keys(BUILDS))
    console.log(pad(BUILDS[bk].nm,24)+'margem='+rpad(f(byB[bk].margin*100,1)+'%',8)+' surv='+
      rpad(f(byB[bk].surv*100,0)+'%',6)+' t='+rpad(f(byB[bk].time,0)+'s',7)+' '+bar(byB[bk].margin,bmx,18));
  console.log(`spread builds (margem): ${f(bst.min*100,1)}% … ${f(bst.max*100,1)}%  (Δ=${f((bst.max-bst.min)*100,1)} p.p.)`);
  return {grid,byOp,byB,ost,bst};
}

/* ===================================================================
   B6-E — FRACTURE THEMES
   =================================================================== */
function auditThemes(){
  console.log('\n================ B6-E · FRACTURE THEMES ================');
  const sim=sandbox.eval?null:null;
  let res=null;
  try{
    // fractureSimulate é interno; reexecutamos via source no contexto do sandbox
    res=require('vm').runInContext(
      'fractureSimulate({seeds:'+Math.min(600,N)+',waveMin:1,waveMax:19,intensity:100})',
      sandbox);
  }catch(e){console.log('fractureSimulate indisponível: '+e.message);return null;}
  console.log(`seeds=${res.seeds} ondas ${res.waveMin}–${res.waveMax} intensidade=${res.intensity} (${res.stage}) budget=${res.budget}\n`);
  console.log(pad('TEMA',14)+rpad('ENT/onda',9)+rpad('vs BASE',9)+rpad('TIPOS',7)+
    rpad('CAPhit',8)+rpad('OVER',6)+rpad('MONO',7)+'  PERFIL');
  const ents=[];
  for(const id of res.themes){
    const r=res.per[id];const n=r.entityN;
    ents.push(r.entityAvg);
    console.log(pad(r.themeNm||id,14)+rpad(f(r.entityAvg,2),9)+
      rpad(f(r.entityAvg/r.baseFitEntityAvg,3)+'×',9)+
      rpad(f(r.kindAvg,2),7)+rpad(f(r.budgetHits/n*100,0)+'%',8)+
      rpad(f(r.budgetOver/n*100,0)+'%',6)+rpad(f(r.extremes/n*100,0)+'%',7)+
      '  '+bar(r.entityAvg,Math.max(...res.themes.map(t=>res.per[t].entityAvg)),18));
  }
  const st=S.stats(ents);
  console.log(`\nentidades/onda: min=${f(st.min,2)} mediana=${f(st.med,2)} max=${f(st.max,2)}  spread=${f((st.max/st.min-1)*100,1)}%`);
  /* composição: share por arquétipo (identidade do tema) */
  console.log('\n-- IDENTIDADE (share % do arquétipo dominante do tema) --');
  for(const id of res.themes){
    const r=res.per[id];
    const top=Object.keys(r.share).sort((a,b)=>r.share[b]-r.share[a]).slice(0,4);
    console.log(pad(r.themeNm||id,14)+top.map(k=>k+' '+f(r.share[k]*100,0)+'%').join('  '));
  }
  return {res,st};
}

/* ===================================================================
   B6-F — MINIBOSSES
   =================================================================== */
function auditMinibosses(){
  console.log('\n================ B6-F · MINIBOSSES ================');
  console.log('TTK proxy contra a build baseline no PODER ESPERADO daquela onda.');
  console.log('EHP = HP × (1 + plates×0.06) — placas somam mitigação/tempo de quebra.\n');
  const waves=[5,10,15];
  const out={};
  for(const wv of waves){
    // poder do jogador na onda wv: roda a run baseline e lê o dpsOut daquela onda
    const base=S.simRun({char:'vector',weapon:'plasma',echoes:2,seed:SEED,plan:{course:['dmg','rate','crit']}});
    const dps=base.rows[wv-1].dpsOut;
    console.log(`--- ONDA ${wv} (dpsOut de referência = ${dps}) ---`);
    console.log(pad('MINIBOSS',26)+rpad('HP',7)+rpad('EHP',8)+rpad('TTK',7)+rpad('DMG',6)+
      rpad('SPD',6)+rpad('HAZ',5)+'  PERFIL');
    const ttks=[];
    for(const m of T.MINIBOSS){
      const s=S.minibossStats(m.id,wv,2);
      const ehp=s.hp*(1+s.plates*.06);
      const ttk=ehp/dps;
      ttks.push(ttk);
      out[m.id]=out[m.id]||{};out[m.id][wv]={...s,ehp,ttk};
    }
    const mx=Math.max(...ttks);
    let i=0;
    for(const m of T.MINIBOSS){
      const o=out[m.id][wv];
      console.log(pad(m.nm,26)+rpad(o.hp,7)+rpad(f(o.ehp,0),8)+rpad(f(o.ttk,1)+'s',7)+
        rpad(o.dmg,6)+rpad(f(o.spd,0),6)+rpad(o.sk.length,5)+'  '+bar(o.ttk,mx,18));
      i++;
    }
    const st=S.stats(ttks);
    console.log(`TTK: min=${f(st.min,1)}s mediana=${f(st.med,1)}s max=${f(st.max,1)}s  razão max/min=${f(st.max/st.min,2)}×\n`);
  }
  return out;
}

/* ===================================================================
   B6-G — O PARADOXO
   =================================================================== */
function auditParadox(){
  console.log('\n================ B6-G · O PARADOXO ================');
  console.log(pad('CENÁRIO',22)+rpad('HP BOSS',9)+rpad('dpsOut',8)+rpad('TTK',8)+rpad('ONDA19 poolHP',15)+rpad('RAZÃO',8));
  const rows=[];
  for(const bk of Object.keys(BUILDS)){
    const b=BUILDS[bk];
    const r=S.simRun({char:'vector',weapon:b.weapon,echoes:2,seed:SEED,plan:{course:b.course}});
    const w19=r.rows[18],w20=r.rows[19];
    rows.push({nm:b.nm,hp:w20.poolHp,dps:w20.dpsOut,ttk:w20.tWave,w19:w19.poolHp,
      ratio:w20.poolHp/w19.poolHp});
    console.log(pad(b.nm,22)+rpad(w20.poolHp,9)+rpad(w20.dpsOut,8)+rpad(f(w20.tWave,1)+'s',8)+
      rpad(w19.poolHp,15)+rpad(f(w20.poolHp/w19.poolHp,3)+'×',8));
  }
  const st=S.stats(rows.map(r=>r.ttk));
  console.log(`\nTTK do PARADOXO: min=${f(st.min,1)}s mediana=${f(st.med,1)}s max=${f(st.max,1)}s`);
  console.log(`Pool de HP do boss vs pool da onda 19: ${f(S.stats(rows.map(r=>r.ratio)).med*100,1)}% (mediana)`);
  console.log('RESSALVA: o boss tem 2 fases, intro invulnerável, feixes/spiral/gravidade e');
  console.log('janelas em que ele NÃO é atacável. O proxy ignora tudo isso, então o TTK real');
  console.log('é substancialmente maior. O número útil aqui é a RAZÃO com a onda 19.');
  return {rows,st};
}

/* ===================================================================
   B6-J — SOBREVIVÊNCIA
   =================================================================== */
function auditSurvival(){
  console.log('\n================ B6-J · SOBREVIVÊNCIA ================');
  console.log(pad('OPERADOR',12)+rpad('maxHp',7)+rpad('shMax',7)+rpad('shReg',7)+rpad('shDel',7)+
    rpad('EHP/60s',9)+rpad('speed',7)+rpad('dashCd',8)+rpad('dashUp',8));
  const rows=[];
  for(const c of T.CHARS){
    // EHP em 60s = hp + escudo inicial + regen de escudo sustentada
    const cycles=60/Math.max(.5,(c.shieldDelay+c.shieldMax/Math.max(.1,c.shieldRegen)));
    const ehp=c.hp+c.shieldMax*(1+cycles);
    const dashUp=1/Math.max(.1,c.dashCd);
    rows.push({id:c.id,ehp,dashUp});
    console.log(pad(c.id,12)+rpad(c.hp,7)+rpad(c.shieldMax,7)+rpad(c.shieldRegen,7)+
      rpad(c.shieldDelay,7)+rpad(f(ehp,0),9)+rpad(c.speed,7)+rpad(c.dashCd,8)+rpad(f(dashUp,2)+'/s',8));
  }
  const st=S.stats(rows.map(r=>r.ehp));
  console.log(`\nEHP/60s: min=${f(st.min,0)} mediana=${f(st.med,0)} max=${f(st.max,0)}  razão max/min=${f(st.max/st.min,2)}×`);
  /* combos de sustain: existe algo imortal? */
  console.log('\n-- COMBOS DE SUSTAIN (regen+lifesteal+escudo vs incDPS da onda 19) --');
  const ws19=S.waveStats(19);
  const combos=[
    {nm:'baseline vector',   char:'vector',  course:['dmg','rate','crit']},
    {nm:'tank puro',         char:'bulwark', course:['hp','hp','hp','hp','hp']},
    {nm:'lifesteal máx',     char:'revenant',course:['vamp','vamp','vamp','vamp','vamp']},
    {nm:'tank+lifesteal',    char:'bulwark', course:['hp','vamp','hp','vamp','hp']},
    {nm:'tank+dano',         char:'bulwark', course:['hp','dmg2','hp','dmg2','omni']}
  ];
  console.log(pad('COMBO',22)+rpad('sustain/s',11)+rpad('incDPS19',10)+rpad('NET',8)+'  VEREDITO');
  for(const c of combos){
    const p=S.buildPlayer(c.char,{});
    for(let i=0;i<8;i++){const id=c.course[i%c.course.length];
      const u=T.UPGRADES.find(x=>x.id===id);if(u){u.apply(p);try{T.smRefresh(p);}catch(e){}}}
    const w=T.WEAPONS.find(x=>x.id==='plasma');
    const dps=S.playerDps(p,w,ws19.count);
    const sus=S.sustainPerSec(p,dps),inc=S.incomingDps(p,ws19);
    const net=inc-sus;
    console.log(pad(c.nm,22)+rpad(f(sus,1),11)+rpad(f(inc,1),10)+rpad(f(net,1),8)+'  '+
      (net<=0?'⚠ SUSTAIN ≥ DANO (candidato a imortal)':'ok — perde HP sob pressão'));
  }
  return {rows,st};
}

/* ===================================================================
   B6-C — ITENS / ATTUNEMENT
   =================================================================== */
function auditItems(){
  console.log('\n================ B6-C · ITENS & ATTUNEMENT ================');
  const tagc={};for(const it of T.ITEMS){for(const t of (T.itemTags(it)||[]))tagc[t]=(tagc[t]||0)+1;}
  const top=Object.keys(tagc).sort((a,b)=>tagc[b]-tagc[a]).slice(0,14);
  console.log('tags mais frequentes: '+top.map(t=>t+'='+tagc[t]).join('  '));
  console.log('\n-- ESTADOS DE SINTONIA (multiplicadores vigentes) --');
  for(const s of T.ATTUNE_STATES)
    console.log('  '+pad(s.lab,14)+'score≥'+rpad(f(s.min,2),6)+'  combate ×'+f(s.mul,3)+'  economia ×'+f(s.eco,3));
  const mul=T.ATTUNE_STATES.map(s=>s.mul);
  console.log(`  spread combate: ${f(Math.min(...mul),3)}…${f(Math.max(...mul),3)} → ${f((Math.max(...mul)/Math.min(...mul)-1)*100,1)}% de ponta a ponta`);
  /* distribuição de afinidade moral dos itens */
  console.log('\n-- AFINIDADE MORAL DOS ITENS (Violence-heavy? dívida do B4) --');
  const axis={};
  for(const it of T.ITEMS){
    let aff=null;try{aff=T.getItemMoralAffinity(it.id);}catch(e){}
    if(!aff)continue;
    for(const k in aff){if(!aff[k])continue;axis[k]=axis[k]||{pos:0,neg:0};
      if(aff[k]>0)axis[k].pos++;else axis[k].neg++;}
  }
  for(const k in axis)console.log('  '+pad(k,12)+'positivo='+rpad(axis[k].pos,4)+'  negativo='+rpad(axis[k].neg,4)+
    '  total='+(axis[k].pos+axis[k].neg));
  /* hooks/procs sem número: quantos itens não expõem stat direto */
  let procs=0;
  for(const it of T.ITEMS){
    const s=String(it.apply||'');
    if(!/sm(Mul|Flat|Add|AddPct)|maxHp|shieldMax|speed|coins/.test(s))procs++;
  }
  console.log(`\nitens sem stat direto (hook/proc/condicional): ${procs}/${T.ITEMS.length} — dívida conhecida do B4`);
  return {tagc,axis,procs};
}

/* ===================================================================
   MAIN
   =================================================================== */
console.log('#'.repeat(70));
console.log('# PR13.5 B6 — AUDITORIA DE BALANCEAMENTO');
console.log(`# seed=${SEED}  N=${N}  SKILL=${S.SKILL}  HEAL/onda=${S.HEAL_PER_WAVE}  lojas/onda=${S.SHOPS_PER_WAVE}`);
console.log('# PROXY determinístico — NÃO substitui playtest humano.');
console.log('#'.repeat(70));
S.setSeed(SEED);
const R={};
if(want('weapons'))  R.weapons  =auditWeapons();
if(want('items'))    R.items    =auditItems();
if(want('themes'))   R.themes   =auditThemes();
if(want('miniboss')) R.miniboss =auditMinibosses();
if(want('paradox'))  R.paradox  =auditParadox();
if(want('survival')) R.survival =auditSurvival();
if(want('builds'))   R.builds   =auditBuilds();
console.log('\n'+'#'.repeat(70));
console.log('# FIM DA AUDITORIA');
console.log('#'.repeat(70));
module.exports=R;

'use strict';
/* =====================================================================
   PR13.5 B6 — SIMULADOR DE RUN (proxy determinístico)
   ---------------------------------------------------------------------
   NÃO altera o jogo. Carrega o index.html real via harness e mede a
   CURVA DA RUN usando as MESMAS funções do jogo:
     · waveComp / waveCompFit / EDEFS / diffHp/diffDmg/diffSpd/diffXp
     · WEAPONS / UPGRADES / ITEMS / CHARS / MINIBOSS
     · smMul/smFlat/calcDamageMul (pipeline real de stats)

   LIMITAÇÕES (declaradas — isto NÃO é playtest):
     · não simula posicionamento, mira, dash, i-frames nem hitbox;
     · uptime de dano é um COEFICIENTE por classe de arma, não medido;
     · dano recebido é modelado como pressão agregada (contatos/s),
       não como eventos discretos de colisão;
     · o resultado serve para COMPARAR builds/temas/ondas entre si,
       nunca como valor absoluto de dificuldade.
   ===================================================================== */
const path=require('path');
const ROOT=process.argv[2]&&process.argv[2][0]==='/'?process.argv[2]:path.join(__dirname,'..');
const {sandbox,T}=require(path.join(ROOT,'audit_pr135','harness.js'));

/* ---------------- RNG determinístico (LCG, igual ao dos outros scripts) --- */
function seedRng(seed){let s=(seed>>>0)||1;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function setSeed(seed){sandbox.Math.random=seedRng(seed);}

/* ---------------- espelhos LOCAIS das curvas do jogo ---------------------
   São reimplementações 1:1 apenas para o proxy; a suíte de teste B6
   compara estes espelhos contra o comportamento real exportado, então
   qualquer divergência futura no index.html quebra o teste. */
const diffHp =n=>{const k=n-1;return 1+.155*k+.014*k*k;};
const diffDmg=n=>1+.062*(n-1);
const diffSpd=n=>Math.min(1.62,1+.021*(n-1));
const diffXp =n=>1+.05*(n-1);
const eliteChance=n=>n<5?0:Math.min(.30,(n-4)*.028);
const ENEMY_BUDGET=46;

/* EDEFS extraído do source (não é exportado pelo harness) */
const EDEFS=(function(){
  const src=require('fs').readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/\r\n?/g,'\n');
  const i=src.indexOf('const EDEFS={');
  const body=src.slice(i);
  let depth=0,end=-1;
  for(let k=body.indexOf('{');k<body.length;k++){
    if(body[k]==='{')depth++;
    else if(body[k]==='}'){depth--;if(depth===0){end=k+1;break;}}
  }
  const obj=body.slice(body.indexOf('{'),end);
  // eslint-disable-next-line no-new-func
  return new Function('return '+obj)();
})();
const ELITE={hpMul:2.6,dmgMul:1.5,xpMul:2.4};   // multiplicadores de elite (proxy)

/* ---------------- composição da onda (usa o pipeline real) ---------------- */
function waveEnemies(n){
  const c=T.waveComp(n);
  const list=[];
  for(const k of T.WAVE_KEYS){
    const q=Math.max(0,Math.round(c[k]||0));
    if(!q)continue;
    if(k==='elite'){
      // elite = chaser reforçado (proxy) — o jogo promove um comum
      for(let i=0;i<q;i++)list.push({type:'elite',base:EDEFS.chaser,elite:true});
    }else if(EDEFS[k]){
      for(let i=0;i<q;i++)list.push({type:k,base:EDEFS[k],elite:false});
    }
  }
  return list;
}
function waveStats(n){
  const list=waveEnemies(n);
  let hp=0,dmg=0,xp=0,count=0,spdSum=0;
  const ec=eliteChance(n);
  for(const e of list){
    const em=e.elite?ELITE:{hpMul:1,dmgMul:1,xpMul:1};
    // promoção probabilística dos comuns (esperança, não sorteio)
    const pm=e.elite?1:ec;
    const hpM=e.elite?em.hpMul:(1+pm*(ELITE.hpMul-1));
    const dgM=e.elite?em.dmgMul:(1+pm*(ELITE.dmgMul-1));
    const xpM=e.elite?em.xpMul:(1+pm*(ELITE.xpMul-1));
    hp +=e.base.hp *diffHp(n)*hpM;
    dmg+=e.base.dmg*diffDmg(n)*dgM;
    xp +=Math.round(e.base.xp*diffXp(n))*xpM;
    spdSum+=e.base.spd*diffSpd(n);
    count++;
  }
  return {n,count,hpTotal:hp,dmgSum:dmg,xpTotal:xp,spdAvg:count?spdSum/count:0,
    hpAvg:count?hp/count:0,dmgAvg:count?dmg/count:0};
}

/* ---------------- miniboss / boss (fórmulas reais) ------------------------ */
function minibossStats(defId,n,echoN){
  const def=T.MINIBOSS.find(m=>m.id===defId)||T.MINIBOSS[0];
  const scale=1+(n-5)*.08;
  const hp=Math.round((520+n*54)*def.hp*scale*(1+.08*(echoN|0)));
  return {id:def.id,nm:def.nm,hp,dmg:Math.round((20+n*1.1)*def.hp),
    spd:(96+n*2)*def.spd,plates:def.plates,r:def.r,sk:Object.keys(def.sk)};
}
function bossStats(echoN){return {hp:2200+((echoN|0)*380),dmg:34,spd:82,r:66};}

/* ---------------- DPS proxy do jogador ----------------------------------- */
/* uptime = fração do tempo em que a arma está efetivamente entregando dano.
   Derivado da CLASSE, não da build — documentado como heurística. */
const UPTIME={melee:.55,beam:.72,ranged:.80,burst:.68,area:.74};
function weaponClass(w){
  if(w.melee)return 'melee';
  if(w.beam)return 'beam';
  if((w.aoe||0)>0)return 'area';
  if(w.interval>=.7)return 'burst';
  return 'ranged';
}
/* multi-alvo efetivo: quantos inimigos um único disparo atinge em média.
   Melee usa a GEOMETRIA real (reach × arc), não um chute por classe. */
function multiTarget(w,crowd){
  let m=1;
  if(w.melee){
    /* área varrida ~ (arc/2)·reach², normalizada pela arena povoada */
    const sweep=(w.arc||1.2)*Math.pow(w.reach||w.range||100,2)/2;
    m=Math.min(4.0,1+sweep/26000*(1+crowd*.045));
  }
  if((w.aoe||0)>0)m=Math.max(m,Math.min(4.0,1+(w.aoe/70)*(1+crowd*.03)));
  if(w.chain)m*=1+(w.chain*.78)*Math.min(1,crowd/6);      // TESLA: corrente
  if(w.contagion)m*=1+Math.min(1.4,crowd*.05);            // PRAGA: contágio
  if(w.bounce)m*=1+Math.min(1.5,(w.bounce||0)*.35);       // RICOCHETE
  if(w.split)m*=1+(w.split||0)*.30;
  if(w.pierce||w.basePierce)m*=1+Math.min(2,(w.basePierce||w.pierce||0))*.55;
  return m;
}
/* multiplicadores de EFEITO da própria arma que o DPS bruto não vê */
function weaponFxMul(w,crowd){
  let m=1;
  /* FEIXE: rampa até rampMax no mesmo alvo — só vale contra alvo único
     que fica parado tempo suficiente (boss/tank), não contra horda */
  if(w.beam&&w.rampMax)m*=1+(w.rampMax-1)*(crowd<=2?.62:.22);
  /* DoT (queimadura): pow por segundo × duração, empilhável */
  if(w.fx&&w.fx.k==='burn')m*=1+Math.min(2.4,(w.fx.pow*w.fx.dur)/(w.dmg/(w.interval))*.28);
  /* CORROSÃO: +pow de vulnerabilidade por camada, satura em ~6 camadas */
  if(w.fx&&w.fx.k==='corrode')m*=1+Math.min(.72,w.fx.pow*6);
  /* CHOQUE/GELO NÃO entram aqui: controle é dano EVITADO, não dano dado.
     Ele é medido à parte em controlValue() — inflar o DPS de uma arma de
     controle é justamente o erro que produziria um nerf arbitrário. */
  /* lifesteal embutido não é DPS: entra em sustainPerSec */
  return m;
}
function playerDps(p,w,crowd){
  const cls=weaponClass(w);
  const rate=(p.fireRateMul||1);
  const shots=(w.count||1)/(w.interval/rate);
  const crit=Math.min(1,(p.crit||0)+(w.crit||0)),cm=(p.critMul||1.8);
  const critM=1+crit*(cm-1);
  const pierceM=1+Math.min(4,(p.pierce||0))*.42;
  const dmgMul=T.calcDamageMul(p);
  const raw=shots*w.dmg*dmgMul*critM;
  return raw*UPTIME[cls]*multiTarget(w,crowd)*pierceM*weaponFxMul(w,crowd);
}

/* VALOR DE CONTROLE: fração do tempo em que a arma mantém o alvo
   neutralizado (congelado/atordoado) ou lento. É a métrica correta para
   julgar CRIOGÊNICO e TESLA — que pagam DPS por segurança. */
function controlValue(w,crowd){
  if(!w.fx)return 0;
  const shots=(w.count||1)/w.interval;
  if(w.fx.k==='chill'){
    /* chillP acumula pow por acerto e CONGELA (stun 1.5s) ao chegar em 1 */
    const hitsToFreeze=Math.ceil(1/Math.max(.01,w.fx.pow));
    const cycle=hitsToFreeze/shots+1.5;
    const uptimeStun=1.5/cycle;
    const slow=Math.min(1,w.fx.pow*hitsToFreeze*.5)*.34;   // lentidão média
    return Math.min(1,(uptimeStun+slow)*Math.min(1,1+crowd*.02));
  }
  if(w.fx.k==='shock')return Math.min(1,w.fx.dur*shots*.10);
  return 0;
}

/* ---------------- pressão de dano recebido (proxy) ------------------------ */
/* contatos por segundo cresce com densidade e velocidade média; mitigado por
   speed do jogador e dash uptime. */
function incomingDps(p,ws){
  const density=ws.count/ENEMY_BUDGET;
  const mob=(ws.spdAvg/240);
  const contacts=1.35*density*mob;                 // toques/s
  const evade=Math.min(.72,(p.speed/335-1)*.45+ (2.1/Math.max(.4,p.dashCdMax))*.11);
  const raw=contacts*ws.dmgAvg*(1-evade);
  return Math.max(0,raw*(p.dmgTakenMul||1)*(1-SKILL));
}
/* SKILL: fração do dano evitável que um jogador competente evita (dash,
   i-frames, kiting, posicionamento). O proxy não simula nada disso, então
   ele entra como coeficiente ÚNICO e global, CALIBRADO uma vez para que a
   build baseline (VECTOR/plasma/curso genérico) termine a run à beira da
   morte — o alvo declarado de design do roguelite. Ele é o mesmo para
   TODAS as builds/temas/operadores, logo NÃO enviesa comparações. */
const SKILL=Number(process.env.B6_SKILL||0.84);   /* CALIBRADO: ver B6-K */
/* cura entre ondas (kits, eventos, reparos): valor ABSOLUTO, não fração
   do maxHp. Usar fração era um erro — normalizava os operadores entre si
   e apagava a diferença entre BULWARK (185 HP) e REVENANT (66 HP), que é
   exatamente o que a auditoria de sobrevivência precisa enxergar. */
const HEAL_PER_WAVE=Number(process.env.B6_HEAL||14);

/* sustain efetivo por segundo */
function sustainPerSec(p,dpsOut){
  const sh=(p.shieldMax>0)?(p.shieldRegen||0):0;   // regen de escudo (flat/s)
  const rg=(p.regen||0);
  const ls=(p.globalLifesteal||0)*dpsOut*.25;      // lifesteal só converte parte
  return sh+rg+ls;
}

/* ---------------- construtor de build ------------------------------------ */
function buildPlayer(charId,plan){
  /* makePlayer recebe o ID do operador (string), NÃO um índice. Passar
     índice cai silenciosamente em CHARS[0] e faz todos os 8 operadores
     medirem idêntico — bug real encontrado na 1ª passagem do B6. */
  if(!T.CHARS.some(c=>c.id===charId))throw new Error('operador inexistente: '+charId);
  const p=T.makePlayer(charId,true);
  T.setPlayer(p);
  for(const uid of (plan.upgrades||[])){
    const u=T.UPGRADES.find(x=>x.id===uid);
    if(u){u.apply(p);(p.upgLog=p.upgLog||[]).push(u.id);}
  }
  for(const iid of (plan.items||[])){
    const it=T.itemById(iid);
    if(it){if(p.items.indexOf(it.id)<0)p.items.push(it.id);it.apply(p);}
  }
  try{T.applyMoralTuning(p);}catch(e){}
  try{T.smRefresh(p);}catch(e){}
  return p;
}

/* ---------------- PROGRESSÃO DA RUN --------------------------------------
   Um jogador real NÃO chega na onda 20 com a build inicial. Ele ganha:
     · 1 recompensa de nível a cada level-up (levelUpReward, 6 opções);
     · ~1,3 compras de loja por onda (medido em eco_metrics: ~1,2–1,5).
   O proxy aplica esse crescimento com o PIPELINE REAL (smMul/apply),
   seguindo o `plan` da build quando ele existe, e caindo num plano
   genérico quando não. Sem isso, a curva mede um jogador impossível. */
const LEVEL_REWARDS=[
  p=>T.smMul(p,'damage','sim.level.dmg','NV DANO',1.12),
  p=>T.smMul(p,'fireRate','sim.level.rate','NV CADÊNCIA',1.09),
  p=>{p.maxHp+=18;},
  p=>{p.dashCdMax*=.92;},
  p=>T.smMul(p,'speed','sim.level.spd','NV VELOCIDADE',1.05),
  p=>{}                                  // reparo imediato: não muda stats
];
function applyLevelReward(p,rnd){
  const f=LEVEL_REWARDS[Math.floor(rnd()*LEVEL_REWARDS.length)%LEVEL_REWARDS.length];
  try{f(p);T.smRefresh(p);}catch(e){}
}
/* compras de loja: consome a fila do plano; se acabar, repete o "core"
   da build (mantém a identidade em vez de virar build genérica) */
function applyShopPick(p,queue,rnd){
  if(!queue.length)return null;
  const id=queue.shift();
  const u=T.UPGRADES.find(x=>x.id===id);
  if(u){try{u.apply(p);(p.upgLog=p.upgLog||[]).push(u.id);T.smRefresh(p);}catch(e){}return id;}
  const it=T.itemById(id);
  if(it){try{if(p.items.indexOf(it.id)<0)p.items.push(it.id);it.apply(p);
    T.applyMoralTuning(p);T.smRefresh(p);}catch(e){}return id;}
  return null;
}
const SHOPS_PER_WAVE=1.3;                 // medido em eco_metrics (perfis A/B/C)

/* ---------------- simulação de uma run ----------------------------------- */
function simRun(opts){
  opts=opts||{};
  const plan=opts.plan||{};
  const rnd=opts.rnd||seedRng(opts.seed||1234);
  const p=buildPlayer(opts.char||'vector',plan);
  const w=T.WEAPONS.find(x=>x.id===(opts.weapon||'plasma'))||T.WEAPONS[0];
  const echoN=opts.echoes==null?2:opts.echoes;
  /* fila de progressão: o "curso" da build repetido até 26 picks (20 ondas
     × 1,3). É assim que uma build de crit continua sendo de crit no late. */
  const course=(plan.course&&plan.course.length)?plan.course:['dmg','rate','crit'];
  const queue=[];
  while(queue.length<28)for(const id of course)queue.push(id);
  const rows=[];
  let hp=p.maxHp,shield=p.shieldMax,totalTime=0,xp=0,level=1,xpNext=20;
  let died=false,diedWave=0,shopAcc=0,picks=0;
  let minHpFrac=1,totalTaken=0;

  for(let n=1;n<=20;n++){
    /* --- progressão ANTES da onda (loja acontece entre ondas) --- */
    if(n>1){
      shopAcc+=SHOPS_PER_WAVE;
      while(shopAcc>=1){shopAcc-=1;if(applyShopPick(p,queue,rnd))picks++;}
    }
    const isMini=T.MINI_WAVES.indexOf(n)>=0;
    const isBoss=n===20;
    const ws=waveStats(n);
    /* CROWD EFETIVO: o Paradoxo e os mini-chefes são ALVO ÚNICO. Usar a
       densidade da onda contra eles inflaria o DPS multi-alvo — foi um
       erro real detectado na 1ª passagem do B6 e está corrigido aqui. */
    const crowd=isBoss?1:(isMini?2:ws.count);
    let dpsOut=playerDps(p,w,crowd);
    /* Ecos contribuem: ECHO_MUL do jogo, arma base, cadência reduzida */
    dpsOut+=echoN*(w.dmg*0.34/(w.interval/0.62))*0.45;
    let poolHp=ws.hpTotal;
    if(isMini)poolHp+=minibossStats(opts.miniboss||'herald',n,echoN).hp;
    if(isBoss)poolHp=bossStats(echoN).hp;

    const tWave=poolHp/Math.max(1,dpsOut);
    let inc=incomingDps(p,ws);
    if(isMini)inc*=1.35;
    if(isBoss)inc=Math.max(inc, (bossStats(echoN).dmg*0.9));
    const sus=sustainPerSec(p,dpsOut);
    const net=Math.max(0,inc-sus);
    const dmgTaken=net*tWave;

    // aplica ao pool efetivo (escudo primeiro)
    let rem=dmgTaken;
    const shAbs=Math.min(shield,rem);shield-=shAbs;rem-=shAbs;
    hp-=rem;
    totalTaken+=dmgTaken;
    minHpFrac=Math.min(minHpFrac,hp/p.maxHp);
    if(hp<=0&&!died){died=true;diedWave=n;}
    // recuperação entre ondas: escudo recarrega inteiro; HP recupera a
    // fração HEAL_PER_WAVE (kits/eventos/reparos) sem passar do teto
    shield=p.shieldMax;
    if(hp>0)hp=Math.min(p.maxHp,hp+HEAL_PER_WAVE);

    // XP e level
    const gain=isBoss?0:ws.xpTotal;
    xp+=gain;
    while(xp>=xpNext){xp-=xpNext;level++;xpNext=Math.floor(xpNext*1.32+6);
      applyLevelReward(p,rnd);
      hp=Math.min(p.maxHp,hp+10);}

    totalTime+=tWave;
    rows.push({wave:n,kind:isBoss?'BOSS':(isMini?'MINI':'NORMAL'),
      enemies:ws.count,poolHp:Math.round(poolHp),dpsOut:Math.round(dpsOut),
      tWave:+tWave.toFixed(2),incDps:+inc.toFixed(1),sustain:+sus.toFixed(1),
      dmgTaken:Math.round(dmgTaken),hp:Math.round(Math.max(0,hp)),
      level,xpTotal:Math.round(ws.xpTotal)});
  }
  return {char:opts.char||'vector',weapon:w.id,plan,rows,picks,
    totalTime:+totalTime.toFixed(1),died,diedWave,
    /* MARGEM: menor fração de HP alcançada na run. É a métrica CONTÍNUA
       da auditoria — a taxa de sobrevivência binária satura em 0%/100% e
       não distingue "passou raspando" de "passou folgado". */
    margin:+minHpFrac.toFixed(3),totalTaken:Math.round(totalTaken),
    finalHp:Math.round(Math.max(0,hp)),finalLevel:level,
    maxHp:p.maxHp,shieldMax:p.shieldMax,speed:Math.round(p.speed),
    dmgMul:+T.calcDamageMul(p).toFixed(3),rateMul:+(p.fireRateMul||1).toFixed(3),
    crit:+(p.crit||0).toFixed(3),critMul:+(p.critMul||0).toFixed(2)};
}

/* ---------------- agregação estatística ---------------------------------- */
function stats(arr){
  if(!arr.length)return {n:0};
  const s=[...arr].sort((a,b)=>a-b);
  const q=f=>s[Math.min(s.length-1,Math.max(0,Math.round(f*(s.length-1))))];
  const sum=s.reduce((a,b)=>a+b,0);
  return {n:s.length,min:s[0],p10:q(.10),med:q(.50),avg:sum/s.length,p90:q(.90),max:s[s.length-1]};
}
function fmt(x,d){return (x==null||!isFinite(x))?'-':(+x).toFixed(d==null?1:d);}

module.exports={setSeed,seedRng,EDEFS,ELITE,ENEMY_BUDGET,SKILL,HEAL_PER_WAVE,SHOPS_PER_WAVE,
  diffHp,diffDmg,diffSpd,diffXp,eliteChance,
  waveEnemies,waveStats,minibossStats,bossStats,
  weaponClass,UPTIME,multiTarget,weaponFxMul,controlValue,playerDps,incomingDps,sustainPerSec,
  buildPlayer,simRun,stats,fmt,T,sandbox};

/* ---------------- execução direta ---------------------------------------- */
if(require.main===module){
  setSeed(+(process.argv[3]||20260905));
  console.log('# B6 — CURVA DA RUN (baseline: VECTOR / plasma / sem itens / 2 Ecos)');
  const base=simRun({char:'vector',weapon:'plasma',echoes:2,plan:{}});
  console.log('wave | tipo   | inim | poolHP | dpsOut | t(s) | incDPS | sust | dano | HP  | NV');
  for(const r of base.rows)
    console.log([String(r.wave).padStart(4),r.kind.padEnd(6),String(r.enemies).padStart(4),
      String(r.poolHp).padStart(6),String(r.dpsOut).padStart(6),fmt(r.tWave,1).padStart(4),
      fmt(r.incDps,1).padStart(6),fmt(r.sustain,1).padStart(4),String(r.dmgTaken).padStart(4),
      String(r.hp).padStart(3),String(r.level).padStart(2)].join(' | '));
  console.log(`\nTOTAL: t=${base.totalTime}s  HPfinal=${base.finalHp}  NV=${base.finalLevel}  morreu=${base.died?('onda '+base.diedWave):'não'}`);
}

'use strict';
const {T}=require('./harness');
console.log('id | nm | hpMult | spdMult | r | plates | sk | hp@5 | hp@15');
for(const mb of T.MINIBOSS){
  const h5=Math.round((520+5*54)*mb.hp*(1+(5-5)*.08));
  const h15=Math.round((520+15*54)*mb.hp*(1+(15-5)*.08));
  console.log([mb.id,mb.nm,mb.hp,mb.spd,mb.r,mb.plates,Object.keys(mb.sk).join(','),h5,h15].join(' | '));
}
const has={shoot:()=>true,dash:()=>true,summon:m=>m.sk.summon===1||m.id==='herald',aoe:m=>!!(m.sk.nova||m.sk.quake||m.sk.drain||m.sk.burst),shield:m=>!!(m.sk.shieldUp||m.sk.reflect),debuff:m=>!!(m.sk.curse||m.sk.corrode||m.sk.drain),teleport:m=>!!m.sk.blink,drain:m=>!!m.sk.drain,summon2:m=>!!(m.sk.summon||m.sk.swarmSpawn==1),heal:m=>!!m.sk.heal,reflect:m=>!!m.sk.reflect,unique:m=>(m.id==='herald'||m.id==='furnace'||m.id==='sentinel'||m.id==='brood'||m.id==='duelist'||m.id==='colossus'||m.id==='oracle'||m.id==='leech')};
console.log('\ncounts:');
for(const key of ['shoot','dash','summon','summon2','aoe','shield','debuff','teleport','drain','heal','reflect']){
  const n=T.MINIBOSS.filter(m=>has[key](m)).length;
  console.log(key+'='+n);
}
console.log('unique-ish abilities actually coded: herald fractures, furnace trail+nova, sentinel shield/reflect, brood swarm+heal, duelist blink+short telegraph, colossus quake+sleep, oracle curse, leech drain+corrode+summon');

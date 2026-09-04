'use strict';
const {T}=require('./harness');
console.log('id | nm | tag | melee | beam | range | reach | speed | life | aoe | ranged?');
for(const w of T.WEAPONS){
  const isMelee=!!w.melee,isBeam=!!w.beam,isRanged=!isMelee&&!isBeam;
  console.log([w.id,w.nm,w.tag,isMelee?'Y':'-',isBeam?'Y':'-',w.range||0,w.reach||0,w.speed||0,w.life||0,w.aoe||0,isRanged?'Y':'-'].map(x=>x).join(' | '));
}
console.log('\ncounts: melee='+T.WEAPONS.filter(w=>w.melee).length+' beam='+T.WEAPONS.filter(w=>w.beam).length+' ranged='+T.WEAPONS.filter(w=>!w.melee&&!w.beam).length);
// range distribution
const ranges=T.WEAPONS.map(w=>w.range||600).sort((a,b)=>a-b);
console.log('ranges min/median/max =',ranges[0],ranges[Math.floor(ranges.length/2)],ranges[ranges.length-1]);
console.log('\nconsumers of rangeMul (static evidence):');
console.log('  weaponRange def = x/(def.range||600)*src.rangeMul');
console.log('  fireMelee reach = def.reach*(src.rangeMul||1)');
console.log('  fireBeam range  = def.range*(src.rangeMul||1)');
console.log('  projectile maxDist = (def.range||600)*rng (rng=src.rangeMul||1)');
console.log('  render ring (player) uses weaponRange; HUD uses weaponRange; TAB uses smGet(p,"range")');

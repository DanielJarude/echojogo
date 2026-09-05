'use strict';
const {T}=require('./harness');
console.log('id | nm | tag | melee | beam | range | reach | speed | life | aoe | ranged?');
for(const w of T.WEAPONS){
  const isMelee=!!w.melee,isBeam=!!w.beam,isRanged=!isMelee&&!isBeam;
  console.log([w.id,w.nm,w.tag,isMelee?'Y':'-',isBeam?'Y':'-',w.range||0,w.reach||0,w.speed||0,w.life||0,w.aoe||0,isRanged?'Y':'-'].join(' | '));
}
console.log('\ncounts: melee='+T.WEAPONS.filter(w=>w.melee).length+' beam='+T.WEAPONS.filter(w=>w.beam).length+' ranged='+T.WEAPONS.filter(w=>!w.melee&&!w.beam).length);
const ranges=T.WEAPONS.map(w=>w.range||600).sort((a,b)=>a-b);
console.log('ranges min/median/max =',ranges[0],ranges[Math.floor(ranges.length/2)],ranges[ranges.length-1]);
console.log('\nconsumers of rangeMul after B2 (static evidence):');
console.log('  weaponRange base = fixa por tipo; multiplicador = srcRangeMul(src,kind) (melee→meleeRange; ranged/beam→rangedRange)');
console.log('  fireMelee reach = def.reach * srcRangeMul(src,"melee")');
console.log('  fireBeam range  = def.range * srcRangeMul(src,"ranged")');
console.log('  projectile maxDist = (def.range||600)*rng; rng=srcRangeMul(src,"ranged")');
console.log('  render ring (player) usa weaponRange; HUD usa weaponRange; TAB usa smGet(p,"meleeRange") e smGet(p,"rangedRange")');
console.log('  Echo/equipamento segue usando e.rangeMul (fallback legado); inimigos/boss não usam meleeRange/rangedRange.');

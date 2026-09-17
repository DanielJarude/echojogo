const fs=require('fs'),assert=require('assert');const s=fs.readFileSync('index.html','utf8');let p=0,f=0;function ok(n,x){try{x();p++;console.log('[ok  ] '+n+' ✔')}catch(e){f++;console.error('[FAIL] '+n+' → '+e.message)}}
const ids=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];
ok('R4 eight distinct face profiles',()=>{assert.strictEqual((s.match(/face:\{shape:/g)||[]).length,8);for(const id of ids)assert(s.includes('  '+id+':Object.freeze'))});
ok('R4 head dimensions and angles vary',()=>{assert.strictEqual(new Set((s.match(/width:\d+,height:\d+,cx:\d+,angle:-?\d+/g)||[])).size,8)});
ok('R4 skin separated from operator palette',()=>{assert.strictEqual((s.match(/skin:'#[0-9a-f]+',eyeGap/g)||[]).length,8)});
ok('R4 eyes and jaw are facial regions',()=>{assert(s.includes('brow')&&s.includes('eyes')&&s.includes('jaw')&&s.includes('nose bridge'))});
ok('R4 expressions vary',()=>{for(const x of ['calm','predatory','steady','severe','focused','wary','absent','hollow'])assert(s.includes("expr:'"+x+"'"))});
ok('R4 face-only generic construction',()=>{assert(s.includes('stepped skull'));assert(s.includes('shoulders and neck'));assert(!s.includes('drawVectorFace'))});
ok('R4 ECHO-0 impossible face and REVENANT rebuilt face',()=>{assert(s.includes("shape:'fragment'")&&s.includes("shape:'long'"))});
ok('R4 deterministic cached portrait',()=>assert(s.includes('face-r3|')&&s.includes('_vPortC.set(key,svg)')));
ok('R4 pixel hard edges and 64 resolution',()=>assert(s.includes('viewBox="0 0 64 64"')&&s.includes('crispEdges')));
ok('R4 gameplay remains separate',()=>assert(s.includes('function drawUnit')&&!/drawUnit[\s\S]{0,2500}face-r3/.test(s)));
ok('R4 mechanics anchors preserved',()=>assert(s.includes('src.r+6')&&s.includes('src.r+10')));
ok('R4 no new dependencies',()=>assert(!s.includes('three.js')));
console.log(`R4 checks: ${p} passaram · ${f} falharam`);if(f)process.exitCode=1;

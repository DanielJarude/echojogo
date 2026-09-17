const fs=require('fs'),assert=require('assert');const s=fs.readFileSync('index.html','utf8');let p=0,f=0;function ok(n,x){try{x();p++;console.log('[ok  ] '+n+' ✔')}catch(e){f++;console.error('[FAIL] '+n+' → '+e.message)}}
const ids=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];
ok('R3 generic facial renderer',()=>{assert(s.includes('function charPortraitBuild'));assert(s.includes('stepped skull'));for(const id of ids)assert(!s.includes('draw'+id[0].toUpperCase()+id.slice(1)+'Face'))});
ok('R3 eight face profiles',()=>assert.strictEqual((s.match(/face:\{shape:/g)||[]).length,4));
ok('R3 head shoulders neck anatomy',()=>{for(const x of ['shoulders and neck','brow','eyes','nose bridge','mid-face','jaw'])assert(s.includes(x))});
ok('R3 facial variation',()=>{for(const x of ['angular','wedge','collar','round','square','irregular','fragment','long','calm','predatory','steady','severe','focused','wary','absent','hollow'])assert(s.includes("'"+x+"'"))});
ok('R3 pixel hard edge at larger resolution',()=>assert(s.includes('viewBox="0 0 64 64"')&&s.includes('shape-rendering="crispEdges"')));
ok('R3 masks do not replace all face structure',()=>{assert(s.includes('top+4,w,22,skin'));assert(s.includes('brow'))});
ok('R3 ECHO-0 fragmented face',()=>assert(s.includes("shape:'fragment'")&&s.includes("visor:'core'")));
ok('R3 REVENANT reconstructed face',()=>assert(s.includes("shape:'long'")&&s.includes("visor:'dead'")));
ok('R3 deterministic cache',()=>assert(s.includes("face-r3|'+C.id+'|'+S")&&s.includes('_vPortC.set(key,svg)')));
ok('R3 gameplay architecture untouched',()=>{assert(s.includes('function drawUnit'));assert(!/drawUnit[\s\S]{0,2500}face-r3/.test(s))});
ok('R3 mechanics and anchors',()=>assert(s.includes('src.r+6')&&s.includes('src.r+10')));
ok('R3 profiles immutable and no dependency',()=>{assert(s.includes('Object.freeze(OPERATOR_VISUALS)'));assert(!s.includes('three'));});
console.log(`R3 checks: ${p} passaram · ${f} falharam`);if(f)process.exitCode=1;

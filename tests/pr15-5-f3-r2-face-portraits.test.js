const fs=require('fs'),assert=require('assert');const s=fs.readFileSync('index.html','utf8');let p=0,f=0;function ok(n,x){try{x();p++;console.log('[ok  ] '+n+' ✔')}catch(e){f++;console.error('[FAIL] '+n+' → '+e.message)}}
const ids=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];
ok('R2 base and canonical ids',()=>ids.forEach(id=>assert(s.includes("'"+id+"'"))));
ok('R2 face data is profile-owned and declarative',()=>{assert.strictEqual((s.match(/face:\{shape:/g)||[]).length,8);assert(/face:vFreeze\(over\.face\)/.test(s))});
ok('R2 generic face builder, no individual renderers',()=>{assert(s.includes('function charPortraitBuild'));for(const id of ids)assert(!s.includes('draw'+id[0].toUpperCase()+id.slice(1)+'Face'))});
ok('R2 pixel presentation',()=>assert(s.includes('shape-rendering="crispEdges"')&&s.includes('image-rendering:pixelated')));
ok('R2 eight head signatures',()=>{const shapes=['angular','wedge','collar','round','square','irregular','fragment','long'];for(const x of shapes)assert(s.includes("shape:'"+x+"'"))});
ok('R2 equipment framing signatures',()=>{for(const x of ['axis','fin','wall','tank','grid','cache','orbit','spine'])assert(s.includes("frame:'"+x+"'"))});
ok('R2 expression signatures',()=>{for(const x of ['calm','predatory','steady','severe','focused','wary','absent','hollow'])assert(s.includes("expr:'"+x+"'"))});
ok('R2 ECHO-0 and REVENANT not generic human faces',()=>{assert(s.includes("shape:'fragment'"));assert(s.includes("shape:'long'"));assert(s.includes("visor:'core'"));assert(s.includes("visor:'dead'"))});
ok('R2 deterministic cache',()=>assert(s.includes("face-r3|'+C.id+'|'+S")&&s.includes('_vPortC.set(key,svg)')));
ok('R2 mechanics anchors remain',()=>assert(s.includes('src.r+6')&&s.includes('src.r+10')));
ok('R2 immutable visual profiles',()=>assert(s.includes('Object.freeze(OPERATOR_VISUALS)')));
ok('R2 gameplay renderer preserved architecturally',()=>{assert(s.includes('function drawUnit'));assert(s.includes('function charPortraitBuild'));assert(!/drawUnit[\s\S]{0,2000}faceportrait/.test(s))});
ok('R2 no external assets or dependencies',()=>assert(!s.includes('PR15_5_F3_R2_FACE_PORTRAITS_AUDIT.png')));
console.log(`R2 checks: ${p} passaram · ${f} falharam`);if(f)process.exitCode=1;

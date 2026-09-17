const fs=require('fs'),assert=require('assert');const s=fs.readFileSync('index.html','utf8');let p=0,f=0;function ok(n,x){try{x();p++;console.log('[ok  ] '+n+' ✔')}catch(e){f++;console.error('[FAIL] '+n+' → '+e.message)}}
const ids=['vector','pyre','nomad','echo0'];
ok('R5 prototype is limited to four approved direction probes',()=>{for(const id of ids)assert(s.includes('  '+id+':Object.freeze'));assert.strictEqual((s.match(/face:\{r5:true/g)||[]).length,4)});
ok('R5 portraits are upright and centered',()=>{assert(s.includes('R5 prototype: centered, upright'));assert(!s.includes("rotate('+F.angle"))});
ok('R5 removes internal square panel',()=>{assert(s.includes("let g='';"));assert(s.includes('R5 prototype: centered, upright'))});
ok('R5 uses layered character illustration paths',()=>{assert(s.includes('Q 18 44 25 43'));assert(s.includes('mid-face'));assert(s.includes('operator-specific equipment is framing'))});
ok('R5 four visual directions',()=>{for(const x of ['vector','pyre','nomad','echo0'])assert(s.includes("C.id==='"+x+"'"))});
ok('R5 gameplay remains untouched',()=>{assert(s.includes('function drawUnit'));assert(!/drawUnit[\s\S]{0,2500}r5portrait/.test(s))});
ok('R5 no external assets/dependencies',()=>assert(!s.includes('.png')&&!s.includes('three.js')));
ok('R5 deterministic cache',()=>assert(s.includes("face-r3|'+C.id+'|'+S")&&s.includes('_vPortC.set(key,svg)')));
console.log(`R5 prototype checks: ${p} passaram · ${f} falharam`);if(f)process.exitCode=1;

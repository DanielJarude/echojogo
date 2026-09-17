/* PR15.5-F3: declarative full-cast contract. Historical F1/F2 tests intentionally
   retain their pre-F3 expectations; this suite records the new approved contract. */
const fs=require('fs'),assert=require('assert');
const s=fs.readFileSync('index.html','utf8');
const ok=(name,fn)=>{try{fn();console.log('[ok  ] '+name+' ✔');}catch(e){console.error('[FAIL] '+name+' → '+e.message);process.exitCode=1;}};
const ids=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];
ok('F3 canonical cast and HARDEN id',()=>{assert.deepStrictEqual((s.match(/const OPERATOR_VISUAL_IDS=Object\.freeze\(\s*\[([^\]]+)/)||[])[1].match(/'[^']+'/g).map(x=>x.slice(1,-1)),ids);assert(!s.includes("id:'harden'"));});
ok('F3 all eight use declarative builds and portraits',()=>{assert.strictEqual((s.match(/build:\{/g)||[]).length,8);assert.strictEqual((s.match(/portrait:\{/g)||[]).length,8);for(const id of ids)assert(s.includes('  '+id+':Object.freeze'),id);});
ok('F3 shared architecture and no operator renderers',()=>{assert(s.includes('function charPortraitBuild'));assert(s.includes('function drawOperatorBuild'));for(const n of ['drawHarden','drawNomad','drawEcho0','drawRevenant'])assert(!s.includes(n));});
ok('F3 generic immutability and deterministic renderer',()=>{assert(s.includes('Object.freeze(OPERATOR_VISUALS)'));assert(!s.slice(s.indexOf('const OPERATOR_VISUAL_OVERRIDES'),s.indexOf('const OPERATOR_VISUALS')).match(/Math\.random|Date\.now|performance\.now/));});
ok('F3 explicit Vector/Pyre and approved cast documentation',()=>{assert(s.includes('VECTOR  — atlético'));assert(s.includes('PYRE    — industrial'));assert(fs.existsSync('PR15_5_F3_FULL_OPERATOR_CAST.md'));});

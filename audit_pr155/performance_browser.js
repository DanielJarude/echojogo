'use strict';
/* Opcional: requer Playwright fora das dependências do jogo.
   NODE_PATH=<ferramentas>/node_modules ECHO_CHROMIUM=<executável> node
     audit_pr155/performance_browser.js [--ref <commit>] --json <resultado>
   Chromium headless, rasterização + readback intrusivo: NÃO mede FPS Electron.
   RAF automático é suspenso apenas na fixture. Nenhuma alteração no release. */
const fs=require('fs'),path=require('path'),os=require('os');
const {pathToFileURL}=require('url');
const {chromium}=require('playwright');
const {readSource}=require('./performance_benchmark');
(async()=>{
  const args=process.argv.slice(2),arg=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'echo-audit1-'));
  const file=path.join(dir,'index.html');fs.writeFileSync(file,readSource(arg('--ref')));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.ECHO_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};let seed=155;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};Date.now=()=>1700000000000;');
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(()=>{DEV_MODE=true;sandboxRun=true;});
    for(const name of ['performance_scenarios.js','performance_probe.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,name),'utf8')});
    const results=await page.evaluate(async()=>{
      const results=[];
      const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
      function seed(){let x=155;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
      const blurDescriptor=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'shadowBlur');
      for(const s of __ECHO_AUDIT_FIXTURES.scenarios){
        seed();__ECHO_AUDIT_FIXTURES.prepare(s.id);resize();render();ctx.getImageData(0,0,cv.width,cv.height);
        const submit=[],flush=[],total=[];
        let image;
        for(let i=0;i<7;i++){
          const a=performance.now();render();const b=performance.now();
          image=ctx.getImageData(0,0,cv.width,cv.height);const c=performance.now();
          submit.push(b-a);flush.push(c-b);total.push(c-a);
        }
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',image.data))].map(x=>x.toString(16).padStart(2,'0')).join('');
        let withoutBlur=null;
        if(['D','F','H'].includes(s.id)){
          Object.defineProperty(ctx,'shadowBlur',{configurable:true,get(){return 0;},set(){blurDescriptor.set.call(ctx,0);}});
          seed();__ECHO_AUDIT_FIXTURES.prepare(s.id);render();ctx.getImageData(0,0,cv.width,cv.height);
          const times=[];
          for(let i=0;i<7;i++){const a=performance.now();render();ctx.getImageData(0,0,cv.width,cv.height);times.push(performance.now()-a);}
          withoutBlur=median(times);delete ctx.shadowBlur;
        }
        seed();__ECHO_AUDIT_FIXTURES.prepare(s.id);__ECHO_PERF_AUDIT1.start();
        for(let i=0;i<8;i++)loop(1000+(i+1)*1000/60);
        const sections=__ECHO_PERF_AUDIT1.snapshot().secoes;__ECHO_PERF_AUDIT1.stop();
        results.push({id:s.id,nome:s.nome,submissaoMedianaMs:median(submit),flushLeituraMedianaMs:median(flush),renderComLeituraMedianaMs:median(total),semBlurDiagnosticoMedianaMs:withoutBlur,hashPixels:hash,secoes:sections});
      }
      return results;
    });
    const quality=[];
    for(const [width,height] of [[960,540],[1920,1080],[3840,2160]]){
      await page.setViewportSize({width,height});
      for(const q of [0,1,2])quality.push(await page.evaluate(q=>{cfg.quality=q;applyCfg();resize();return {viewport:[vw,vh],qualidade:q,renderQuality,dpr,buffer:[cv.width,cv.height]};},q));
    }
    const report={ambiente:'Chromium headless / SwiftShader / 1280×720. 7 amostras fixas por cenário. SemBlur é ablação de diagnóstico, NÃO otimização entregue. Readback inclui raster e cópia CPU; tempos inclusivos da sonda não isolam GPU/GC.',cenarios:results,qualidade:quality,erros:errors};
    if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(report,null,2)+'\n');
    console.log(report.ambiente);
    console.table(results.map(s=>({cenário:s.id,submissão:s.submissaoMedianaMs.toFixed(2),flushLeitura:s.flushLeituraMedianaMs.toFixed(2),totalLeitura:s.renderComLeituraMedianaMs.toFixed(2),semBlur:s.semBlurDiagnosticoMedianaMs?.toFixed(2)||'—'})));
    console.log('Erros JavaScript:',errors.length);
    if(errors.length)process.exitCode=1;
  }finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

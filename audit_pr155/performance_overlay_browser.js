'use strict';
/* Verificação opcional de UI real: mesmos requisitos externos de Playwright
   de performance_browser.js. RAF suspenso na fixture; números são sintéticos,
   não FPS de hardware. --screenshots <diretório fora do Git> é opcional. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
(async()=>{
  const args=process.argv.slice(2),shot=args.includes('--screenshots')?args[args.indexOf('--screenshots')+1]:null;
  if(shot)fs.mkdirSync(shot,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.ECHO_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--no-zygote','--single-process']});
  let checks=0;
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript('requestAnimationFrame=()=>0;cancelAnimationFrame=()=>{};');
    for(const [width,height] of [[960,540],[1280,720],[1920,1080]]){
      await page.setViewportSize({width,height});
      for(const [name,action] of [
        ['combate',''],['evento',"openEvent('survivor')"],['loja','openShop()'],
        ['TAB','sheetShow()'],['pausa','pauseGame()'],['DEV','devOpenPanel()'],
        ['configurações',"pauseGame();openCodex('config')"],['laboratório','sbPanelToggle()']
      ]){
        await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href);
        const r=await page.evaluate(action=>{
          DEV_MODE=true;sandboxRun=true;hideOverlay();startRun({noEchoes:true,freshMeta:true});
          bannerT=0;bannerEl.classList.remove('show');metricsSetEnabled(true);resize();render();
          eval(action);metricsTick(0);for(let i=1;i<=15;i++)metricsTick(i*1000/60);
          const box=metricsPanel.getBoundingClientRect();
          const css=getComputedStyle(metricsPanel);
          const visible=!metricsPanel.hidden&&css.display!=='none';
          const overflow=[...metricsPanel.querySelectorAll('dt,dd')].some(e=>{const r=e.getBoundingClientRect();return r.left<box.left||r.right>box.right||e.scrollWidth>e.clientWidth;});
          const intersections=[...document.querySelectorAll('#modal .card,#sheet .ssect,#sandboxp .ssect,#devpanel,.cfgrow,.pbtn')].filter(e=>{
            const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left<box.right&&r.right>box.left&&r.top<box.bottom&&r.bottom>box.top;
          }).map(e=>e.id||e.className);
          const result={state,visivel:visible,dock:metricsDocked,posicao:[box.x,box.y,box.width,box.height],dentro:box.x>=0&&box.y>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,overflow,conflitos:intersections,zIndex:css.zIndex};
          // OFF deve vencer inclusive a regra display:flex da faixa compacta.
          metricsSetEnabled(false);result.off=getComputedStyle(metricsPanel).display==='none';
          metricsSetEnabled(true);metricsTick(1000);for(let i=1;i<=15;i++)metricsTick(1000+i*1000/60);
          return result;
        },action);
        assert.ok(r.visivel&&r.dentro&&!r.overflow&&r.off,JSON.stringify(r));
        assert.strictEqual(r.conflitos.length,0,JSON.stringify(r));assert.strictEqual(r.zIndex,'84');
        checks++;console.log('APROVADO — '+width+'×'+height+' '+name+' '+JSON.stringify(r));
        if(shot&&width===960&&['evento','TAB','DEV','combate'].includes(name)){await page.waitForTimeout(450);await page.screenshot({path:path.join(shot,name+'.png')});}
      }
    }
    assert.deepStrictEqual(errors,[]);checks++;
    console.log('Resultado: '+checks+' verificações de navegador aprovadas; 0 falhas. Sem medição de FPS Electron.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

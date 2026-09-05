'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];
src+='\n;globalThis.__t={'+
  'ECHO_LINES,PERSONALITIES,MORAL_AFFINITY,MORAL_BALANCE,ITEMS,UPGRADES,WEAPONS,MINIBOSS,'+
  'SM_STATS,SM_ORDER,UNLOCKS,BASE_WEAPONS,BASE_ITEMS,BASE_UPGRADES,CHARS,ECHO_SPEAK_INTERVAL,'+
  'SPEECH_PRI,ECHO_SPEECH_QUEUE_MAX,echoSpeechDuration,speechClear,speechTick,'+
  'speechActive:()=>speechActive,speechQueue:()=>speechQueue,'+
  'FTEXT_SPEAK,FTEXT_SIZE,FTEXT_MAX,MAX_WAVE,MINI_WAVES,MORAL_AFF_LEVELS,EV_KINDS,WAVE_KEYS,'+
  'makePlayer,startRun,setChar,itemById,itemTags,itemHasTag,rollShop,pickWeighted,pickWeightedMoral,'+
  'rarityWeight,moralShopWeight,shopWeaponPool,isItemUnlocked,isUpgUnlocked,isWeaponUnlocked,'+
  'waveComp,applyMoral,mEff,priceUpg,priceItem,repairCost,giveItem,ownsItem,'+
  'getMoralProfile,calcMoralAffinityMatch,getItemMoralAffinity,moralTuneFactor,moralAffinityLevel,'+
  'applyMoralTuning,countAttunedItems,smGet,smRefresh,smBreakdown,calcDamageMul,'+
  'smMul,smAdd,smFlat,smAddPct,smRemoveId,smRemoveSource,'+
  'fireMelee,fireBeam,fireWeaponFrom,updateProjectiles,weaponRange,srcRangeMul,migrateLegacyRangeMods,'+
  'getProjectiles:()=>projectiles,setProjectiles:a=>{projectiles=a;},'+
  'getSwings:()=>swings,setSwings:a=>{swings=a;},'+
  'getEnemies:()=>enemies,setEnemies:a=>{enemies=a;},'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},makeEcho,echoSpeak,echoReact,'+
  'getSpeakCd:()=>_echoSpeakCd,setSpeakCd:v=>{_echoSpeakCd=v;},'+
  'getEchoSpeakCd:()=>_echoSpeakCd,'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);},'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getFtexts:()=>ftexts,setFtexts:a=>{ftexts=a;},'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getMoral:()=>moral,setMoral:mm=>{moral=mm;},'+
  'getProg:()=>prog,setProg:p=>{prog=p;},'+
  'getShopOffers:()=>shopOffers,getShopItems:()=>shopItems,getShopGuns:()=>shopGuns,'+
  'MINIBOSS_VISUALS,MINIBOSS_RENDERERS,MINIBOSS_PHASE2_TITLE,minibossVisual,drawMiniBoss,drawEnemy,drawBoss,updateMiniBoss,spawnMiniBoss,pickMiniBoss,miniBossHUD,clearMiniBossHUD,getMiniBoss:()=>miniBoss,setMiniBoss:v=>{miniBoss=v;},getBoss:()=>boss,setRunTime:v=>{runTime=v;},'+
  'ATTUNE_STATES,ATTUNE_FIELD_ITEMS,attuneFieldMul,smHas,isMoralTuneModId,moralAffinityTagHTML,attunementScore,attunementState,attunementStateFor,attunementMul,attunementInfo,calcAttunementPlan,isAttuneModId,attuneIsEconomic,'+
  'SHOP_RECENT_MAX,SHOP_REPEAT_LAST_W,SHOP_REPEAT_PENULT_W,shopRecentReset,shopRepeatWeight,shopOfferSeen,shopMarkBought,shopWaveMul,rerollBaseCost,incomeCoinCap,moralMarketMul,shopSurchargeMul,MORAL_MARKET_K,SHOP_SURCHARGE_CAP,echoRangeField,echoEqInit,echoEqRefresh,pickWeightedAny,'+
  'getShopRecent:()=>shopRecent.map(e=>({id:e.id,seq:e.seq,now:shopRollSeq,bought:e.bought})),'+
  'smBuildCheckpoint,captureCheckpoint,resumeRun,activateSlot,clearActiveRun,hasActiveRun,getActiveRun:()=>activeRun,'+
  'getCurSlot:()=>curSlot,setCurSlot:v=>{curSlot=v;},'+
  'setShopLock:v=>{shopLock=v;},'+
  'setSandboxRun:v=>{sandboxRun=v;},'+
  'resetShopVars:()=>{shopOffers=[];shopItems=[];shopGuns=[];rerollCost=rerollBaseCost();shopLock=null;shopRecentReset();},'+
  'grantItemInternal,itemStateInit,updateHUD,getMeta:()=>meta'+
  '};';
function makeStyle(){const store={};return new Proxy(store,{get(t,k){return k in t?t[k]:'';},set(t,k,v){t[k]=String(v);return true;}});}
function ctx2d(){const grad={addColorStop(){}};const numProps=new Set(['globalAlpha','lineWidth','shadowBlur','font','fillStyle','strokeStyle','lineCap','textAlign','imageSmoothingEnabled']);return new Proxy({},{get(t,k){if(k==='canvas')return{width:0,height:0};if(k==='measureText')return()=>({width:0});if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;if(numProps.has(k))return 1;return(...args)=>{const L=globalThis.__ctxLog;if(L)L.push([k,args]);};},set(t,k,v){const L=globalThis.__ctxLog;if(L)L.push(['set:'+k,[v]]);return true;}});}
function makeEl(id){const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,_cls:new Set(),isConnected:true,offsetWidth:0,offsetHeight:0,textContent:'',innerHTML:'',className:'',title:'',style:makeStyle()};el.classList={add:(...c)=>c.forEach(x=>el._cls.add(x)),remove:(...c)=>c.forEach(x=>el._cls.delete(x)),contains:c=>el._cls.has(c),toggle:(c,f)=>{if(f===undefined){if(el._cls.has(c)){el._cls.delete(c);return false;}el._cls.add(c);return true;}if(f)el._cls.add(c);else el._cls.delete(c);return !!f;}};el.appendChild=c=>{el.children.push(c);return c;};el.remove=()=>{};el.addEventListener=()=>{};el.removeEventListener=()=>{};el.querySelector=()=>null;el.querySelectorAll=()=>[];el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];el.getContext=()=>ctx2d();return el;}
const elements=new Map();
const document={hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),fullscreenElement:null,webkitFullscreenElement:null,createElement:()=>makeEl(''),getElementById:id=>{if(!elements.has(id))elements.set(id,makeEl(id));return elements.get(id);},querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()};
const window={innerWidth:1280,innerHeight:720,devicePixelRatio:1,screen:{availWidth:1280,availHeight:720},addEventListener:()=>{},removeEventListener:()=>{},matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),AudioContext:undefined,webkitAudioContext:undefined,open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined};
const store=new Map();
const sandbox={window,document,console,Math,JSON,Date,Array,Object,Set,Map,Number,String,Boolean,Promise,RegExp,Error,Proxy,Reflect,Symbol,parseInt,parseFloat,isNaN,navigator:{getGamepads:()=>[],userAgent:'node'},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v));},removeItem:k=>{store.delete(k);}},performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},__t:null};
sandbox.globalThis=sandbox;
sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;
vm.createContext(sandbox);
vm.runInContext(src,sandbox,{filename:'index.html'});
const T=sandbox.__t;
T.unlockAll();
module.exports={sandbox,T,vm};

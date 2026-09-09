'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
/* B5-B-FIX.1: fonte normalizada para LF — checkouts Windows (autocrlf) trazem
   CRLF e quebravam buscas textuais com '\n' literal nas suítes. Toda
   auditoria textual deve usar `SRC` daqui, nunca reler o arquivo cru. */
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/\r\n?/g,'\n');
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
  'MB_UPDATERS,MB_HAZARD_CAP,MB_BROOD_CAP,mbHazardAdd,mbInitState,mbChildren,MINIBOSS_VISUALS,MINIBOSS_RENDERERS,MINIBOSS_PHASE2_TITLE,minibossVisual,drawMiniBoss,drawEnemy,drawBoss,updateMiniBoss,spawnMiniBoss,pickMiniBoss,miniBossHUD,clearMiniBossHUD,getMiniBoss:()=>miniBoss,setMiniBoss:v=>{miniBoss=v;},getBoss:()=>boss,setRunTime:v=>{runTime=v;},'+
  'ATTUNE_STATES,ATTUNE_FIELD_ITEMS,attuneFieldMul,smHas,isMoralTuneModId,moralAffinityTagHTML,attunementScore,attunementState,attunementStateFor,attunementMul,attunementInfo,calcAttunementPlan,isAttuneModId,attuneIsEconomic,'+
  'SHOP_RECENT_MAX,SHOP_REPEAT_LAST_W,SHOP_REPEAT_PENULT_W,shopRecentReset,shopRepeatWeight,shopOfferSeen,shopMarkBought,shopWaveMul,rerollBaseCost,incomeCoinCap,moralMarketMul,shopSurchargeMul,MORAL_MARKET_K,SHOP_SURCHARGE_CAP,echoRangeField,echoEqInit,echoEqRefresh,pickWeightedAny,'+
  /* PR14.5 B2: Perfil de Build + Sintonia de compatibilidade + famílias */
  'BUILD_ARCH,BUILD_AFFINITY,buildProfile,buildProfileSummary,buildCompat,buildShopWeight,buildHasAffinity,attunementReasons,itemFamily,itemFamilyName,itemFamilies,familyBlocker,ITEM_FAMILIES,rerollCap,'+
  'setBuildProfileOverride:v=>{_bpOverride=v;},getBuildProfileOverride:()=>_bpOverride,'+
  'getBuildProfileCache:()=>_bpCache,getBuildProfileKey:()=>_bpKey,'+
  /* PR14.5 B3: calibrações/facção/reworks */
  'toRomanRank,upgRankOf,UPG_ADVANCED,UPG_ELITE,upgDescHTML,upgRankSpan,lensChargeMul,fpIndicatorTick,'+
  'getShopVisitN:()=>shopVisitN,getShopBoughtAtVisit:()=>shopBoughtAtVisit,'+
  'getShopBoughtIds:()=>shopBoughtIds,'+
  'getShopRecent:()=>shopRecent.map(e=>({id:e.id,seq:e.seq,now:shopRollSeq,bought:e.bought})),'+
  'smBuildCheckpoint,captureCheckpoint,resumeRun,activateSlot,clearActiveRun,hasActiveRun,getActiveRun:()=>activeRun,'+
  'getCurSlot:()=>curSlot,setCurSlot:v=>{curSlot=v;},'+
  'setShopLock:v=>{shopLock=v;},'+
  'setSandboxRun:v=>{sandboxRun=v;},'+
  'resetShopVars:()=>{shopOffers=[];shopItems=[];shopGuns=[];rerollCost=rerollBaseCost();shopLock=null;shopRecentReset();},'+
  /* B5.5: preview de stats, economia meta e ganchos de vitória */
  'shopItemPreview,shopUpgPreview,shopImpactHTML,previewDisplayRows,'+
  'smPreviewCarrier,smPreviewDryRun,smPreviewRows,shopEffectChip,previewStatValue,'+
  'PREVIEW_STATS,metaVictoryDecay,onVictory,showVictory,loadMeta,saveMeta,'+
  'META_SHOP,renderShopOp,grantWeapon,'+
  'getVictoryData:()=>victoryData,setVictoryData:v=>{victoryData=v;},'+
  'getBossVictoryTimers:()=>bossVictoryTimers,'+
  'getDevTainted:()=>devTainted,setDevTainted:v=>{devTainted=v;},'+
  'getFracRun:()=>fracRun,'+
  'grantItemInternal,itemStateInit,updateHUD,getMeta:()=>meta'+
  /* PR15·b1: Memória Temporal e Assinatura de Run */
  ','+
  'PR15_DEATH_CAUSES,pr15SanitizeCause,pr15RunIsValid,pr15ValidityReason,pr15QueuePush,pr15ResetCause,'+
  'pr15NoteDamage,pr15CauseOf,pr15ProjectileCause,pr15ResolveCause,pr15CauseCtxSnapshot,'+
  'pr15BuildSignature,pr15CommitSig,pr15SanitizeRecord,pr15SlotIdNext,pr15SanitizeCause,'+
  'getEchoQueue:()=>echoQueue,setEchoQueue:a=>{echoQueue=a;},'+
  'getKills:()=>kills,setKills:v=>{kills=v;},'+
  'getRecorder:()=>recorder,setRecorder:a=>{recorder=a;},'+
  'getPr15Abort:()=>!!(pr15Ctx&&pr15Ctx.abort),setPr15Abort:v=>{pr15Ctx.abort=!!v;},'+
  'getSlotSeq:()=>{try{return (smRoot&&smRoot.slots&&curSlot>=1&&smRoot.slots[curSlot])?(smRoot.slots[curSlot].seq|0):0;}catch(e){return 0;}},'+
  'saveEchoes,loadEchoes,abortRun,onPlayerDeath,saveProg,saveMeta'+
  /* PR15·b2: Director de Memórias Temporais */
  ','+
  'PR15_MEM_CFG,PR15_MEM_STATUS,PR15_MEM_SOURCES,PR15_MEM_RESONANCE,'+
  'pr15MemSeedFor,pr15MemRng,pr15MemRunSeed,pr15MemSlot,pr15MemRunKey,'+
  'pr15MemIsEligible,pr15MemCandidates,pr15MemResonance,pr15MemMakeEncounter,'+
  'pr15MemPickSource,pr15MemFresh,pr15MemBuildPlan,pr15MemBeginRun,pr15MemEndRun,'+
  'pr15MemForgetRun,pr15MemWaveBusy,pr15MemCooldownBusy,pr15MemOnWave,'+
  'pr15MemSanEnc,pr15MemSanitize,pr15MemPack,pr15MemUnpack,pr15MemSnapshot,'+
  'pr15DevMemoryState,pr15DevMemoryCandidates,pr15DevMemorySchedule,pr15DevMemoryForce,'+
  'pr15MemSandboxContextStart,pr15MemSandboxTearDown,pr15MemoryKitBoot,'+
  'getPr15MemRun:()=>pr15MemRun,setPr15MemRun:v=>{pr15MemRun=v;},'+
  'fractureGetSeed,fractureGetThemeId,fractureSetSeed,fractureEnsureTheme,'+
  'fractureBeginRun,fractureEndRun,fractureRunPack,fractureRunUnpack,'+
  'getFractureRun:()=>fractureRun,setFractureRun:v=>{fractureRun=v;},'+
  'getEvMem:()=>evMem,setEvMem:v=>{evMem=v;},'+
  'getBeacon:()=>beacon,setBeacon:v=>{beacon=v;},'+
  'getFactionPresenceRun:()=>factionPresenceRun,setFactionPresenceRun:v=>{factionPresenceRun=v;},'+
  'getSmRestoring:()=>smRestoring,setSmRestoring:v=>{smRestoring=v;},'+
  'spawnWave,captureCheckpoint,smClearSlotSave,smCommit,getSmRoot:()=>smRoot,'+
  'getMaxWave:()=>MAX_WAVE,devTaint,getDevMode:()=>DEV_MODE,setDevMode:v=>{DEV_MODE=v;},'+
  'getDEV:()=>DEV,fractureHash32,fractureRng'+
  '};';
function makeStyle(){const store={setProperty(k,v){store[k]=String(v);return v;}};return new Proxy(store,{get(t,k){return k in t?t[k]:'';},set(t,k,v){t[k]=String(v);return true;}});}
function ctx2d(){const grad={addColorStop(){}};const numProps=new Set(['globalAlpha','lineWidth','shadowBlur','font','fillStyle','strokeStyle','lineCap','textAlign','imageSmoothingEnabled']);return new Proxy({},{get(t,k){if(k==='canvas')return{width:0,height:0};if(k==='measureText')return()=>({width:0});if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;if(numProps.has(k))return 1;return(...args)=>{const L=globalThis.__ctxLog;if(L)L.push([k,args]);};},set(t,k,v){const L=globalThis.__ctxLog;if(L)L.push(['set:'+k,[v]]);return true;}});}
function makeEl(id){const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,_cls:new Set(),isConnected:true,offsetWidth:0,offsetHeight:0,textContent:'',className:'',title:'',style:makeStyle(),_html:''};
Object.defineProperty(el,'innerHTML',{get(){return el._html;},set(v){el._html=String(v);/* semântica browser: limpar innerHTML remove os filhos */if(el._html==='')el.children.length=0;}});
el.classList={add:(...c)=>c.forEach(x=>el._cls.add(x)),remove:(...c)=>c.forEach(x=>el._cls.delete(x)),contains:c=>el._cls.has(c),toggle:(c,f)=>{if(f===undefined){if(el._cls.has(c)){el._cls.delete(c);return false;}el._cls.add(c);return true;}if(f)el._cls.add(c);else el._cls.delete(c);return !!f;}};
el.appendChild=c=>{el.children.push(c);return c;};
el.remove=()=>{};
el._ev={};el.addEventListener=(t,fn)=>{(el._ev[t]=el._ev[t]||[]).push(fn);};   /* B5.5: registra p/ simular clique */
el.removeEventListener=()=>{};
el.querySelector=()=>null;
el.querySelectorAll=()=>[];
el.closest=()=>null;
el.focus=()=>{};
el.blur=()=>{};
el.setAttribute=(k,v)=>{el.dataset[k]=v;};
el.getAttribute=k=>el.dataset[k];
el.getContext=()=>ctx2d();
Object.defineProperty(el,'lastChild',{get:()=>el.children.length?el.children[el.children.length-1]:null});
return el;}
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
module.exports={sandbox,T,vm,SRC:html,normalizeSource:s=>String(s).replace(/\r\n?/g,'\n')};

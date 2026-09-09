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
  'VISUAL_STATES,VISUAL_EASING,ENEMY_VISUAL_PROFILES,VISUAL_NEUTRAL_POSE,EDEFS,'+
  'visualFinite,visualClamp01,visualPeek,visualState,visualReset,visualTimelineStart,visualTimelineCancel,visualTimelineProgress,visualTimelineTick,visualAttackObserve,visualAttackTrigger,visualAttackIdle,visualAttackCancel,visualNotify,visualNotifyHurt,visualNotifyWeaponFire,visualPose,visualPoseCompose,enemyVisualProfile,weaponVisualProfile,weaponVisualProfileBuild,WEAPON_VISUAL_PROFILE_CACHE,visualHurtPose,visualEnemyAttackPose,drawCommonAttackCue,drawSingularInfluence,visualWeaponRecoil,'+
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
  'fireMelee,fireBeam,fireWeaponFrom,updateProjectiles,weaponRange,srcRangeMul,migrateLegacyRangeMods,damageEnemy,spawnEnemy,updateEnemy,updatePlayer,drawWeaponSprite,'+
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
  /* PR15·b3: Presença Temporal Física */
  ','+
  'PR15_PRES_CFG,PR15_PRES_TOTAL,PR15_PRES_PHASES,PR15_PRES_RES_VIS,PR15_PRES_SRC_VIS,'+
  'pr15PresFresh,pr15PresAlreadyDone,pr15PresMarkDone,pr15PresStatusOf,'+
  'pr15PresResolveMemory,pr15PresReadVisual,pr15PresSpotBlocked,pr15PresPos,'+
  'pr15PresSpawn,pr15PresBurst,pr15PresUpdate,pr15PresMove,pr15PresGhostCapFor,'+
  'pr15PresGhostTick,pr15PresLeave,pr15PresEnd,pr15PresClear,pr15PresReset,'+
  'pr15PresOnWave,pr15PresPack,pr15PresSanAct,pr15PresSanitize,pr15PresUnpack,'+
  'pr15PresRebuild,pr15PresVisualState,pr15PresPalette,pr15PresSilhouetteWi,'+
  'pr15PresDraw,pr15PresSnapshot,pr15PresenceKitBoot,'+
  'pr15DevPresenceState,pr15DevPresenceSpawn,pr15DevPresenceEnd,pr15DevPresenceVisual,'+
  'pr15PresSandboxContextStart,pr15PresSandboxTearDown,'+
  'getPr15Presence:()=>pr15Presence,setPr15Presence:v=>{pr15Presence=v;},'+
  'getPr15PresRun:()=>pr15PresRun,setPr15PresRun:v=>{pr15PresRun=v;},'+
  'getMiniBossRef:()=>miniBoss,setBoss:v=>{boss=v;},setMiniBossRef:v=>{miniBoss=v;},'+
  'getFactionPresenceEntity:()=>factionPresenceEntity,'+
  'setFactionPresenceEntity:v=>{factionPresenceEntity=v;},'+
  'ARENA,drawUnit,updateAllies,drawWorldExtras,inView,'+
  'updateEcho,drawEchoEntity,damageEcho,regenEchoShield,pickTarget,echoAllied,'+
  'pr15MemIsEligible,getParts:()=>parts,getRunTime:()=>runTime,'+
  'getSandboxRun:()=>sandboxRun,'+
  'sandboxStart,sandboxExit,sandboxRestart,sandboxEndToSetup,sandboxCloseSetup,'+
  'setActiveRun:v=>{activeRun=v;}'+
  /* PR15·b4: Intenção + interação + significado das memórias temporais */
  ','+
  'PR15_INTENT_CFG,PR15_INTENTS,PR15_INTENT_LIST,PR15_VARIANTS,PR15_ISTATES,'+
  'PR15_BUDGET_KEYS,PR15_INTENT_LABEL,PR15_VARIANT_LABEL,PR15_INTENT_VIS,'+
  'PR15_INTENT_REASONS,PR15_INTENT_SIGNALS,PR15_LEGACY_MODS,PR15_LEGACY_FALLBACK,'+
  'pr15IntentFresh,pr15IntentBudLeft,pr15IntentSpend,pr15IntentAlreadyResolved,'+
  'pr15IntentMarkResolved,pr15MoralAxis,pr15MoralDistance,pr15IntentFactionNet,'+
  'pr15IntentFracturePressure,pr15IntentContext,pr15IntentSignalsFor,pr15IntentScores,'+
  'pr15IntentRng,pr15IntentDecide,pr15IntentRngVar,pr15IntentVariant,'+
  'pr15IntentAttach,pr15IntentVisState,pr15IntentAnnounce,pr15IntentGuard,'+
  'pr15IntentAddMod,pr15IntentGrantRes,pr15IntentGrantHeal,pr15IntentGrantShield,'+
  'pr15IntentGrantMoral,pr15IntentFactionReact,pr15IntentEchoReact,pr15IntentMsg,'+
  'pr15IntentPlayerDist,pr15IntentZone,pr15IntentPulse,pr15IntentLegacy,'+
  'pr15IntentPressure,pr15IntentTrial,pr15IntentScarOffer,pr15IntentScarAccept,pr15IntentTradeOffer,'+
  'pr15IntentTrade,pr15IntentUnstable,pr15IntentLobes,pr15IntentChoice,'+
  'pr15IntentInteractLabel,pr15IntentOfferable,pr15IntentTryInteract,'+
  'pr15IntentUpdate,pr15IntentClear,pr15IntentDraw,pr15IntentEdge,'+
  'pr15IntentNodeDist,pr15IntentNodeOf,'+
  'pr15IntentSnapshot,pr15IntentExplain,pr15IntentPack,pr15IntentSanRes,'+
  'pr15IntentSanitize,pr15IntentUnpack,pr15IntentRebuild,pr15IntentReset,'+
  'pr15DevIntentState,pr15DevIntentExplain,pr15DevIntentForce,'+
  'pr15DevIntentForceVariant,pr15DevPresenceIntentState,'+
  'pr15DevSyntheticMemory,pr15DevRealMemory,pr15DevIntentSpawn,pr15DevIntentClearAll,'+
  'pr15DevIntentCommand,pr15DevIntentSection,PR15_DEV_VARIANT_SHORT,'+
  'pr15DevIntentToggleApply,pr15IntentGuardPersistent,getPr15DevApplyEffects:()=>pr15DevApplyEffects,'+
  'pr15IntentSandboxContextStart,pr15IntentSandboxTearDown,pr15IntentKitBoot,'+
  'getPr15IntentRun:()=>pr15IntentRun,setPr15IntentRun:v=>{pr15IntentRun=v;},'+
  'getPr15IntentForce:()=>pr15IntentForce,setPr15IntentForce:v=>{pr15IntentForce=v;},'+
  'getEchoesRef:()=>echoes,setKillsV:v=>{kills=v;},getKillsV:()=>kills,'+
  'getMoralRef:()=>moral,fracFresh,getFracRunRef:()=>fracRun,setFracRunRef:v=>{fracRun=v;},'+
  'addResidues,spendResidues,getResidues,factionEmit,factionHasPact,fracRival,fracKnows,'+
  'fracApplyDelta,FACTION_IDS,FACTION_GRID,FRACTIONS,FRACTION_BY_ID,'+
  'BUILD_ARCH_IDS,buildProfileSummary,getMoralProfile,applyMoral,applyMoralTuning,'+
  'smAdd,smRemoveId,smHas,smGet,getSmMods:()=>(player&&player.sm)?player.sm.slice():[],'+
  'render,cam,getCam:()=>cam,setCam:v=>{cam.x=v.x;cam.y=v.y;},'+
  'getVw:()=>vw,getVh:()=>vh,getCtxLog:()=>globalThis.__ctxLog,'+
  'getRunTimeRef:()=>runTime,getToastsEl:()=>toastsEl,getBannerEl:()=>bannerEl,'+
  'fractureMakeSeed,fractureEnsureTheme,fractureGetIntensity,'+
  'spawnParticles,floatText,spawnRing,getPartsRef:()=>parts,'+
  'getEchoSpeechActive:()=>speechActive,getEchoSpeechQueue:()=>speechQueue,'+
  'setEchoSpeechClock:v=>{_speechClock=v;},'+
  'AUDIO,sandboxStart,sandboxExit,devEnable,devDisable'+
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

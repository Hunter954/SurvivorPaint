(() => {
  'use strict';

  // ============================================================
  // RABISCO SURVIVORS CO-OP
  // Cliente Canvas 2D + multiplayer via HTTP polling.
  // Sem bibliotecas externas: pronto para Railway/GitHub.
  // ============================================================

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, CX = W / 2, CY = H / 2;
  const $ = id => document.getElementById(id);

  const ui = {
    menu: $('menuOverlay'), lobby: $('lobbyOverlay'), level: $('levelOverlay'), chest: $('chestOverlay'),
    wait: $('waitOverlay'), manualPause: $('manualPauseOverlay'), down: $('downOverlay'), gameOver: $('gameOverOverlay'),
    name: $('nameInput'), soloBtn: $('soloBtn'), createRoomBtn: $('createRoomBtn'), joinBox: $('joinBox'),
    joinCode: $('joinRoomCode'), joinBtn: $('joinRoomBtn'), lobbyCode: $('lobbyCode'), inviteLink: $('inviteLink'),
    copyInvite: $('copyInviteBtn'), shareInvite: $('shareInviteBtn'), lobbyPlayers: $('lobbyPlayers'),
    lobbyMessage: $('lobbyMessage'), startRoom: $('startRoomBtn'), leaveRoom: $('leaveRoomBtn'),
    levelChoices: $('levelChoices'), chestReward: $('chestReward'), chestContinue: $('chestContinueBtn'),
    waitMessage: $('waitMessage'), reviveLabel: $('reviveLabel'), gameOverTitle: $('gameOverTitle'),
    runSummary: $('runSummary'), restartHint: $('restartHint'), restartBtn: $('restartBtn'), menuBtn: $('menuBtn'),
    coins: $('coinsLabel'), bestTime: $('bestTimeLabel'), metaShop: $('metaShop'), resetSave: $('resetSaveBtn'),
    toast: $('toast'), joystick: $('joystick'), stick: $('stick'), dashBtn: $('dashBtn')
  };

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const PALETTE = ['#2563eb','#dc2626','#16a34a','#9333ea','#f97316','#ec4899','#0891b2','#eab308'];

  let audioCtx = null;
  function resumeAudio() { if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }
  function tone(freq, dur=.06, type='square', gain=.012, delay=0) { if (!audioCtx) return; const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+dur); }
  function sfxPickup(){tone(520,.05);tone(760,.08,'square',.01,.05)}
  function sfxShot(){tone(165,.035,'square',.008)}
  function sfxBoom(){tone(82,.15,'sawtooth',.018);tone(48,.22,'square',.011,.03)}
  function sfxLevel(){tone(640,.07,'square',.015);tone(880,.11,'square',.012,.06)}
  function sfxHurt(){tone(120,.08,'sawtooth',.018)}

  // --------------------------- SAVE / META ---------------------------
  const SAVE_KEY = 'rabiscoSurvivorsCoopSaveV2';
  const metaDefs = {
    hp:{name:'CORAÇÃO GROSSO',desc:'+8% vida máxima',max:5,baseCost:60},
    damage:{name:'TINTA FORTE',desc:'+6% dano',max:5,baseCost:70},
    speed:{name:'TÊNIS RISCADO',desc:'+4% velocidade',max:5,baseCost:60},
    luck:{name:'TREVO TORTO',desc:'+4% crítico',max:5,baseCost:75},
    armor:{name:'PAPELÃO',desc:'+1 armadura a cada 2 níveis',max:5,baseCost:80},
    xp:{name:'CADERNO',desc:'+5% XP recebido',max:5,baseCost:65}
  };
  function defaultSave(){return{coins:0,bestTime:0,bestLevel:1,totalKills:0,wins:0,claimedRuns:[],meta:{hp:0,damage:0,speed:0,luck:0,armor:0,xp:0}}}
  function loadSave(){try{const r=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');const d=defaultSave();return r?{...d,...r,meta:{...d.meta,...(r.meta||{})},claimedRuns:Array.isArray(r.claimedRuns)?r.claimedRuns:[]}:d}catch{return defaultSave()}}
  let save=loadSave();
  function persistSave(){localStorage.setItem(SAVE_KEY,JSON.stringify(save))}
  function metaCost(k){return Math.round(metaDefs[k].baseCost*Math.pow(1.55,save.meta[k]||0))}
  function renderMetaShop(){ui.coins.textContent=save.coins;ui.bestTime.textContent=fmtTime(save.bestTime);ui.metaShop.innerHTML='';Object.entries(metaDefs).forEach(([k,d])=>{const lv=save.meta[k]||0,c=metaCost(k),row=document.createElement('div');row.className='meta-row';row.innerHTML=`<div><b>${d.name} ${'★'.repeat(lv)}${'☆'.repeat(d.max-lv)}</b><div class="desc">${d.desc}</div></div>`;const b=document.createElement('button');b.textContent=lv>=d.max?'MAX':`${c} 🪙`;b.disabled=lv>=d.max||save.coins<c;b.onclick=()=>{if(save.coins<c||lv>=d.max)return;save.coins-=c;save.meta[k]++;persistSave();renderMetaShop();sfxPickup()};row.appendChild(b);ui.metaShop.appendChild(row)})}

  // --------------------------- BUILD / ARMAS ---------------------------
  const MAX_WEAPON_SLOTS = 8, MAX_PASSIVE_SLOTS = 8;
  const passiveDefs = {
    glove:{name:'LUVA DE BORRACHA',icon:'G',max:5,color:'#2563eb',desc:'-6,5% recarga por nível.'},
    ink:{name:'POTE DE TINTA',icon:'T',max:5,color:'#9333ea',desc:'+9% dano por nível.'},
    boots:{name:'TÊNIS RISCADO',icon:'>',max:5,color:'#16a34a',desc:'+6,5% movimento e dash melhor.'},
    armor:{name:'COLETE DE PAPELÃO',icon:'▣',max:5,color:'#78716c',desc:'+1 armadura por nível.'},
    magnet:{name:'ÍMÃ TORTO',icon:'U',max:5,color:'#0891b2',desc:'+8% alcance dos efeitos elétricos.'},
    heart:{name:'CORAÇÃO RABISCADO',icon:'♥',max:5,color:'#dc2626',desc:'+12% vida e regeneração.'},
    lens:{name:'LENTE QUEBRADA',icon:'◎',max:5,color:'#eab308',desc:'+6% chance crítica.'},
    notebook:{name:'CADERNO DE XP',icon:'▤',max:5,color:'#0f766e',desc:'+10% XP recebido.'},
    ruler:{name:'RÉGUA TORTA',icon:'—',max:5,color:'#f97316',desc:'+10% área por nível.'},
    spring:{name:'MOLA DE CANETA',icon:'S',max:5,color:'#ec4899',desc:'+10% velocidade dos projéteis; níveis altos dão quantidade.'},
    palette:{name:'PALETA MOLHADA',icon:'P',max:5,color:'#7c3aed',desc:'+12% duração de poças, trilhas e minas.'}
  };

  const weaponDefs = {
    rifle:{name:'RIFLE DE RABISCO',icon:'↗',color:'#2563eb',required:'glove',evolved:'RISCADORA TURBO',desc:'Tiros retos, rápidos e perfurantes.'},
    shotgun:{name:'ESPINGARDA TORTA',icon:'≋',color:'#f97316',required:'lens',evolved:'TEMPESTADE DE GIZ',desc:'Cone de projéteis que limpa a frente.'},
    inkBomb:{name:'BOMBA DE TINTA',icon:'●',color:'#9333ea',required:'ink',evolved:'DILÚVIO DE TINTA',desc:'Cai no chão, espirra tinta colorida e causa DPS.'},
    scripture:{name:'PÁGINAS GIRATÓRIAS',icon:'▤',color:'#eab308',required:'heart',evolved:'ENCICLOPÉDIA GIRATÓRIA',desc:'Páginas orbitam como uma bíblia rotatória.'},
    axe:{name:'MACHADO DO CÉU',icon:'Y',color:'#dc2626',required:'ruler',evolved:'MACHADO METEORO',desc:'Machados despencam do céu e explodem no impacto.'},
    boomerang:{name:'LÁPIS BUMERANGUE',icon:'✎',color:'#16a34a',required:'boots',evolved:'LÁPIS INFINITO',desc:'Vai, perfura e volta para sua mão.'},
    orbit:{name:'COMPASSO MALUCO',icon:'◌',color:'#78716c',required:'armor',evolved:'ÓRBITA DO CAOS',desc:'Pontas de compasso giram ao redor do jogador.'},
    lightning:{name:'RAIO DE CANETA',icon:'ϟ',color:'#0891b2',required:'magnet',evolved:'LINHA DE CHOQUE',desc:'Riscos elétricos pulam entre inimigos.'},
    eraserMine:{name:'MINA DE BORRACHA',icon:'▭',color:'#ec4899',required:'notebook',evolved:'BORRACHA NUCLEAR',desc:'Deixa borrachas no chão que detonam ao contato.'},
    paintTrail:{name:'ROLO DE TINTA',icon:'≈',color:'#7c3aed',required:'palette',evolved:'ASFALTO DE GUACHE',desc:'Ao andar, deixa uma trilha de tinta que machuca.'},
    scissors:{name:'TESOURA VOADORA',icon:'X',color:'#0f766e',required:'spring',evolved:'TESOURA FANTASMA',desc:'Tesouras teleguiadas caçam o inimigo mais próximo.'},
    bird:{name:'PASSARINHO ALIADO',icon:'V',color:'#dc2626',required:'palette',evolved:'ESQUADRÃO DE POMBOS',desc:'Invoca aves amigas que bicam os inimigos.'}
  };

  let build;
  function resetBuild(){
    build={damageMult:1,cooldownMult:1,areaMult:1,durationMult:1,projectileSpeed:1,critChance:.05,critDamage:1.8,amountBonus:0,runDamage:0,runCooldown:0,
      weapons:{},passives:{},orbitAngle:0,birdAngle:0,runArea:0};
    Object.keys(weaponDefs).forEach(k=>build.weapons[k]={level:0,evolved:false,cd:0});
    Object.keys(passiveDefs).forEach(k=>build.passives[k]=0);
    build.weapons.rifle.level=1;
    recalcBuild(false);
  }
  function activeWeaponCount(){return Object.values(build.weapons).filter(w=>w.level>0).length}
  function activePassiveCount(){return Object.values(build.passives).filter(v=>v>0).length}
  function recalcBuild(sync=true){
    const p=build.passives;
    build.damageMult=(1+save.meta.damage*.06)*(1+p.ink*.09)*(1+build.runDamage);
    build.cooldownMult=clamp((1-p.glove*.065)*(1-build.runCooldown),.42,1);
    build.areaMult=(1+p.ruler*.10)*(1+build.runArea);
    build.durationMult=1+p.palette*.12;
    build.projectileSpeed=1+p.spring*.10;
    build.amountBonus=Math.floor(p.spring/3);
    build.critChance=clamp(.05+save.meta.luck*.04+p.lens*.06,.05,.72);
    if(sync)syncStats();
  }
  function calcServerStats(){
    const p=build.passives;
    return {
      maxHp:Math.round(100*(1+save.meta.hp*.08)*(1+p.heart*.12)),
      speed:235*(1+save.meta.speed*.04)*(1+p.boots*.065),
      armor:Math.floor(save.meta.armor/2)+p.armor,
      regen:p.heart*.17,
      xpGain:(1+save.meta.xp*.05)*(1+p.notebook*.10),
      dashCooldown:Math.max(1.8,4*(1-p.boots*.055)),
      buildLabel:Object.entries(build.weapons).filter(([,w])=>w.level>0).sort((a,b)=>b[1].level-a[1].level).slice(0,3).map(([k,w])=>`${w.evolved?weaponDefs[k].evolved:weaponDefs[k].name} Lv.${w.level}`).join(' · ')
    };
  }

  function saveBuildSession(){if(!net.runId)return;try{sessionStorage.setItem('rabiscoBuild',JSON.stringify({runId:net.runId,weapons:build.weapons,passives:build.passives,runDamage:build.runDamage,runCooldown:build.runCooldown,runArea:build.runArea}))}catch{}}
  function loadBuildSession(runId){try{const r=JSON.parse(sessionStorage.getItem('rabiscoBuild')||'null');if(!r||r.runId!==runId)return false;resetBuild();for(const k of Object.keys(build.weapons))if(r.weapons&&r.weapons[k])build.weapons[k]={...build.weapons[k],...r.weapons[k],cd:0};for(const k of Object.keys(build.passives))if(Number.isFinite(r.passives&&r.passives[k]))build.passives[k]=r.passives[k];build.runDamage=Number(r.runDamage||0);build.runCooldown=Number(r.runCooldown||0);build.runArea=Number(r.runArea||0);recalcBuild(false);return true}catch{return false}}

  // --------------------------- NETWORK ---------------------------
  const net={roomId:'',playerId:'',token:'',state:null,connected:false,polling:false,runId:'',lastEventSeq:0,lastStateAt:0,errorCount:0};
  const SESSION_KEY='rabiscoCoopSessionV2';
  function authPayload(extra={}){return{roomId:net.roomId,playerId:net.playerId,token:net.token,...extra}}
  async function api(path,body=null,method='POST'){
    const opts={method,headers:{'Content-Type':'application/json'}};if(body)opts.body=JSON.stringify(body);
    const r=await fetch(path,opts);const j=await r.json().catch(()=>({ok:false,error:'RESPOSTA_INVALIDA'}));if(!r.ok||j.ok===false)throw new Error(j.error||`HTTP_${r.status}`);return j;
  }
  function storeSession(){try{sessionStorage.setItem(SESSION_KEY,JSON.stringify({roomId:net.roomId,playerId:net.playerId,token:net.token}))}catch{}}
  function clearSession(){try{sessionStorage.removeItem(SESSION_KEY)}catch{}net.roomId=net.playerId=net.token='';net.connected=false;net.state=null;net.runId='';net.lastEventSeq=0}
  function humanError(code){return({SALA_NAO_ENCONTRADA:'Sala não encontrada ou expirou.',SESSAO_INVALIDA:'Sua sessão nessa sala expirou.',SALA_CHEIA:'A sala já tem 4 jogadores.',RUN_JA_COMECOU:'Essa run já começou. Aguarde a próxima.',SO_HOST_INICIA:'Só o host pode iniciar.',SO_HOST_REINICIA:'Só o host pode reiniciar.',SO_HOST_PAUSA:'Só o host pode pausar.'})[code]||String(code).replaceAll('_',' ')}
  function toast(text){ui.toast.textContent=text;ui.toast.classList.add('visible');clearTimeout(toast.t);toast.t=setTimeout(()=>ui.toast.classList.remove('visible'),2200)}

  async function createRoom(startSolo=false){
    resumeAudio();const name=sanitizeLocalName();
    setBusy(true);
    try{const j=await api('/api/room/create',{name});applySession(j);await syncStats();startPolling();history.replaceState({},'',`${location.pathname}?room=${j.roomId}`);if(startSolo){await api('/api/room/start',authPayload());toast('Run solo iniciada!')}else toast('Sala criada. Copie o link!')}
    catch(e){toast(humanError(e.message))}finally{setBusy(false)}
  }
  async function joinRoom(code){
    resumeAudio();const name=sanitizeLocalName();setBusy(true);
    try{const j=await api('/api/room/join',{roomId:code,name});applySession(j);await syncStats();startPolling();history.replaceState({},'',`${location.pathname}?room=${j.roomId}`);toast('Entrou na sala!')}
    catch(e){toast(humanError(e.message))}finally{setBusy(false)}
  }
  function applySession(j){net.roomId=j.roomId;net.playerId=j.playerId;net.token=j.token;net.connected=true;storeSession();ui.menu.classList.remove('visible');showLobbySkeleton()}
  function setBusy(v){ui.soloBtn.disabled=v;ui.createRoomBtn.disabled=v;ui.joinBtn.disabled=v}
  function sanitizeLocalName(){const name=(ui.name.value||'Jogador').trim().slice(0,18)||'Jogador';localStorage.setItem('rabiscoNickname',name);return name}
  async function syncStats(){if(!net.roomId||!net.playerId)return;try{await api('/api/stats',authPayload(calcServerStats()));saveBuildSession()}catch{}}

  function startPolling(){if(net.polling)return;net.polling=true;(async function loop(){while(net.polling&&net.roomId){try{const q=new URLSearchParams(authPayload());const r=await fetch(`/api/state?${q}`,{cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'STATE_ERROR');net.connected=true;net.errorCount=0;handleState(j.room)}catch(e){net.errorCount++;if(net.errorCount===2)toast('Reconectando à sala...');if(net.errorCount>15){toast(humanError(e.message));net.polling=false;clearSession();showMenu();break}}await new Promise(r=>setTimeout(r,90))}})()}
  function stopPolling(){net.polling=false}

  async function tryReconnect(){
    const queryRoom=(new URLSearchParams(location.search).get('room')||'').toUpperCase();
    if(queryRoom){ui.joinBox.classList.remove('hidden');ui.joinCode.textContent=queryRoom}
    try{const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(!s||!s.roomId||!s.playerId||!s.token)return;if(queryRoom&&s.roomId!==queryRoom)return;net.roomId=s.roomId;net.playerId=s.playerId;net.token=s.token;net.connected=true;startPolling();ui.menu.classList.remove('visible');showLobbySkeleton()}catch{}
  }

  function showMenu(){hideAllOverlays();ui.menu.classList.add('visible');renderMetaShop();const q=(new URLSearchParams(location.search).get('room')||'').toUpperCase();if(q){ui.joinBox.classList.remove('hidden');ui.joinCode.textContent=q}else ui.joinBox.classList.add('hidden')}
  function showLobbySkeleton(){hideAllOverlays();ui.lobby.classList.add('visible');ui.lobbyCode.textContent=net.roomId;const link=`${location.origin}${location.pathname}?room=${net.roomId}`;ui.inviteLink.value=link;ui.lobbyPlayers.innerHTML='<div class="lobby-message">Conectando...</div>'}
  function hideAllOverlays(){[ui.menu,ui.lobby,ui.level,ui.chest,ui.wait,ui.manualPause,ui.down,ui.gameOver].forEach(x=>x.classList.remove('visible'))}

  function handleState(room){
    net.state=room;net.lastStateAt=performance.now();
    if(net.runId!==room.runId){
      net.runId=room.runId;net.lastEventSeq=0;resetLocalEffects();if(room.mode==='running'){if(!loadBuildSession(room.runId))resetBuild();syncStats();resumeAudio();toast('Nova run! Sobrevivam juntos.')}
    }
    updateRenderTargets(room);
    processEvents(room.events||[]);
    if(room.mode==='lobby'){renderLobby(room);return}
    if(room.mode==='running'){
      ui.menu.classList.remove('visible');ui.lobby.classList.remove('visible');ui.gameOver.classList.remove('visible');
      const me=getMe();if(!me)return;
      handleRewardUI(room,me);
      ui.manualPause.classList.toggle('visible',!!room.manualPaused);
      ui.down.classList.toggle('visible',!me.alive&&!room.rewardPaused&&!room.manualPaused);
      if(!me.alive)ui.reviveLabel.textContent=`Revive ${Math.round(clamp(me.reviveProgress/3,0,1)*100)}%`;
      return;
    }
    if(room.mode==='ended'){hideRewardOverlays();ui.down.classList.remove('visible');ui.manualPause.classList.remove('visible');showGameOver(room)}
  }

  function renderLobby(room){
    hideAllOverlays();ui.lobby.classList.add('visible');ui.lobbyCode.textContent=room.id;ui.inviteLink.value=`${location.origin}${location.pathname}?room=${room.id}`;
    ui.lobbyPlayers.innerHTML='';room.players.forEach((p,i)=>{const d=document.createElement('div');d.className='player-card';d.style.setProperty('--pc',p.color);d.style.setProperty('--r',`${[-.5,.3,-.2,.45][i]||0}deg`);d.innerHTML=`<div class="player-dot"></div><div><b>${escapeHtml(p.name)}</b><div class="status">${p.id===room.hostId?'HOST · ':''}${p.connected?'ONLINE':'RECONECTANDO'}</div></div><b>${p.id===net.playerId?'VOCÊ':''}</b>`;ui.lobbyPlayers.appendChild(d)});
    const host=room.hostId===net.playerId;ui.startRoom.style.display=host?'block':'none';ui.lobbyMessage.textContent=host?'Quando todo mundo entrar, aperte INICIAR RUN.':'Aguardando o host iniciar a run.';
  }

  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

  // --------------------------- REWARDS ---------------------------
  let rewardKind=null,rewardAckPending=false,currentChoices=[],chestApplied=false;
  function hideRewardOverlays(){ui.level.classList.remove('visible');ui.chest.classList.remove('visible');ui.wait.classList.remove('visible');rewardKind=null}
  function handleRewardUI(room,me){
    if(rewardAckPending)return;
    if(me.pendingLevelups>0){ui.wait.classList.remove('visible');ui.chest.classList.remove('visible');if(rewardKind!=='level')openLevelUp();return}
    if(me.pendingChests>0){ui.wait.classList.remove('visible');ui.level.classList.remove('visible');if(rewardKind!=='chest')openChest();return}
    if(room.rewardPaused){ui.level.classList.remove('visible');ui.chest.classList.remove('visible');rewardKind=null;const waiting=room.players.filter(p=>p.pendingLevelups>0||p.pendingChests>0).map(p=>p.name);ui.waitMessage.textContent=`${waiting.join(', ')} está escolhendo uma evolução...`;ui.wait.classList.add('visible')}
    else{hideRewardOverlays()}
  }

  function optionPool(){
    const pool=[],wc=activeWeaponCount(),pc=activePassiveCount();
    Object.entries(build.weapons).forEach(([k,w])=>{if(w.level===0){if(wc<MAX_WEAPON_SLOTS)pool.push({type:'weapon',key:k,new:true,weight:1.25})}else if(w.level<8)pool.push({type:'weapon',key:k,new:false,weight:2.2})});
    Object.entries(build.passives).forEach(([k,lv])=>{if(lv===0){if(pc<MAX_PASSIVE_SLOTS)pool.push({type:'passive',key:k,new:true,weight:1.25})}else if(lv<passiveDefs[k].max)pool.push({type:'passive',key:k,new:false,weight:1.7})});
    if(pool.length<3){pool.push({type:'stat',key:'damage',weight:1},{type:'stat',key:'cooldown',weight:1},{type:'stat',key:'area',weight:1})}
    return pool;
  }
  function pickUnique(pool,n){const src=[...pool],out=[];while(src.length&&out.length<n){const total=src.reduce((s,o)=>s+o.weight,0);let r=Math.random()*total,idx=0;for(;idx<src.length;idx++){r-=src[idx].weight;if(r<=0)break}out.push(src.splice(Math.min(idx,src.length-1),1)[0])}return out}
  function openLevelUp(){rewardKind='level';currentChoices=pickUnique(optionPool(),3);ui.levelChoices.innerHTML='';currentChoices.forEach((o,i)=>{const d=document.createElement('div');d.className='choice';d.style.setProperty('--r',`${[-.55,.15,.52][i]}deg`);let title,icon,color,lev,desc,tag;if(o.type==='weapon'){const w=build.weapons[o.key],def=weaponDefs[o.key];title=def.name;icon=def.icon;color=def.color;lev=o.new?'NOVA ARMA':`Lv.${w.level} → Lv.${w.level+1}`;desc=weaponDesc(o.key,w.level+1);tag='ARMA'}else if(o.type==='passive'){const lv=build.passives[o.key],def=passiveDefs[o.key];title=def.name;icon=def.icon;color=def.color;lev=o.new?'NOVO PASSIVO':`Lv.${lv} → Lv.${lv+1}`;desc=def.desc;tag='PASSIVO'}else{title=o.key==='damage'?'RABISCO MAIS FORTE':o.key==='cooldown'?'MÃO MAIS RÁPIDA':'DESENHO MAIOR';icon='+';color='#111';lev='BÔNUS DA RUN';desc=o.key==='damage'?'+10% dano nesta run.':o.key==='cooldown'?'-6% recarga nesta run.':'+8% área nesta run.';tag='BÔNUS'}d.style.setProperty('--c',color);d.innerHTML=`<div class="num">${i+1}</div><div class="icon">${icon}</div><span class="tag">${tag}</span><h3>${title}</h3><div class="level">${lev}</div><p>${desc}</p>`;d.onclick=()=>chooseLevel(i);ui.levelChoices.appendChild(d)});ui.level.classList.add('visible');sfxLevel()}
  function weaponDesc(k,lv){const d={rifle:'Mais dano, cadência e perfuração.',shotgun:'Mais chumbos, dano e abertura do cone.',inkBomb:'Poças maiores, duram mais e causam mais DPS.',scripture:'Mais páginas e órbita maior.',axe:'Mais machados, impacto maior e dano alto.',boomerang:'Mais lápis, mais perfuração e velocidade.',orbit:'Mais pontas de compasso e alcance.',lightning:'Mais alvos, alcance e frequência.',eraserMine:'Mais minas, raio e dano.',paintTrail:'Trilha mais grossa e duradoura.',scissors:'Mais tesouras teleguiadas e crítico.',bird:'Mais passarinhos aliados e bicadas.'};return `${d[k]} Nível ${lv}.`}
  async function chooseLevel(i){if(rewardKind!=='level'||rewardAckPending||!currentChoices[i])return;const o=currentChoices[i];if(o.type==='weapon')build.weapons[o.key].level=Math.min(8,build.weapons[o.key].level+1);else if(o.type==='passive')build.passives[o.key]=Math.min(passiveDefs[o.key].max,build.passives[o.key]+1);else if(o.key==='damage')build.runDamage+=.10;else if(o.key==='cooldown')build.runCooldown+=.06;else build.runArea+=.08;recalcBuild(false);saveBuildSession();syncStats();ui.level.classList.remove('visible');rewardKind=null;rewardAckPending=true;sfxPickup();try{await api('/api/reward/ack',authPayload({kind:'level'}))}catch{}setTimeout(()=>rewardAckPending=false,120)}

  function eligibleEvolutions(){return Object.entries(build.weapons).filter(([k,w])=>w.level>=8&&!w.evolved&&(build.passives[weaponDefs[k].required]||0)>=3).map(([k])=>k)}
  function openChest(){rewardKind='chest';chestApplied=false;const evo=eligibleEvolutions();let html='';if(evo.length){const k=evo[randi(0,evo.length-1)],d=weaponDefs[k];build.weapons[k].evolved=true;html=`<div class="reward-icon" style="--c:${d.color}">${d.icon}</div><b>${d.name}</b><br>EVOLUIU PARA<br><div class="evolved" style="--c:${d.color}">${d.evolved}</div><p>Versão absurda liberada para o resto da run.</p>`}else{const owned=[];Object.entries(build.weapons).forEach(([k,w])=>{if(w.level>0&&w.level<8)owned.push({type:'weapon',key:k})});Object.entries(build.passives).forEach(([k,lv])=>{if(lv>0&&lv<passiveDefs[k].max)owned.push({type:'passive',key:k})});if(owned.length){const o=owned[randi(0,owned.length-1)];if(o.type==='weapon'){build.weapons[o.key].level++;const d=weaponDefs[o.key];html=`<div class="reward-icon" style="--c:${d.color}">${d.icon}</div><b>${d.name}</b><br>+1 NÍVEL GRÁTIS<p>Chegando ao nível 8 + passivo correto, o próximo baú pode evoluir.</p>`}else{build.passives[o.key]++;const d=passiveDefs[o.key];html=`<div class="reward-icon" style="--c:${d.color}">${d.icon}</div><b>${d.name}</b><br>+1 NÍVEL GRÁTIS<p>${d.desc}</p>`}}else{build.runDamage+=.12;html=`<div class="reward-icon">+</div><b>TINTA EXTRA</b><br>+12% DANO<p>Inventário cheio: o rabisco ficou mais forte.</p>`}}recalcBuild(false);saveBuildSession();syncStats();chestApplied=true;ui.chestReward.innerHTML=html;ui.chest.classList.add('visible');sfxLevel()}
  async function closeChest(){if(rewardKind!=='chest'||rewardAckPending)return;ui.chest.classList.remove('visible');rewardKind=null;rewardAckPending=true;sfxPickup();try{await api('/api/reward/ack',authPayload({kind:'chest'}))}catch{}setTimeout(()=>rewardAckPending=false,120)}

  // --------------------------- RENDER INTERPOLATION ---------------------------
  const renderEnemies=new Map(),renderPlayers=new Map();
  const camera={x:0,y:0};
  function updateRenderTargets(room){
    const seenE=new Set();for(const e of room.enemies){seenE.add(e.id);let r=renderEnemies.get(e.id);if(!r){r={...e,tx:e.x,ty:e.y};renderEnemies.set(e.id,r)}else Object.assign(r,e,{tx:e.x,ty:e.y})}for(const id of renderEnemies.keys())if(!seenE.has(id))renderEnemies.delete(id);
    const seenP=new Set();for(const p of room.players){seenP.add(p.id);let r=renderPlayers.get(p.id);if(!r){r={...p,tx:p.x,ty:p.y};renderPlayers.set(p.id,r)}else Object.assign(r,p,{tx:p.x,ty:p.y})}for(const id of renderPlayers.keys())if(!seenP.has(id))renderPlayers.delete(id);
  }
  function interpolate(dt){for(const e of renderEnemies.values()){e.x=lerp(e.x,e.tx,clamp(dt*13,0,1));e.y=lerp(e.y,e.ty,clamp(dt*13,0,1))}for(const p of renderPlayers.values()){p.x=lerp(p.x,p.tx,clamp(dt*18,0,1));p.y=lerp(p.y,p.ty,clamp(dt*18,0,1))}const me=renderPlayers.get(net.playerId);if(me){camera.x=lerp(camera.x,me.x,clamp(dt*12,0,1));camera.y=lerp(camera.y,me.y,clamp(dt*12,0,1))}}
  function worldToScreen(x,y){return{x:CX+(x-camera.x),y:CY+(y-camera.y)}}
  function screenToWorld(x,y){return{x:camera.x+(x-CX),y:camera.y+(y-CY)}}
  function onScreen(x,y,pad=150){const s=worldToScreen(x,y);return s.x>-pad&&s.x<W+pad&&s.y>-pad&&s.y<H+pad}
  function getMe(){return net.state&&net.state.players.find(p=>p.id===net.playerId)}
  function getMeRender(){return renderPlayers.get(net.playerId)||getMe()}
  function nearbyEnemies(x,y,range=99999){return[...renderEnemies.values()].filter(e=>e.hp>0&&dist(x,y,e.x,e.y)<=range+e.radius).sort((a,b)=>dist(x,y,a.x,a.y)-dist(x,y,b.x,b.y))}
  function nearestEnemy(x,y,range=99999){return nearbyEnemies(x,y,range)[0]||null}

  // --------------------------- LOCAL COMBAT ---------------------------
  const bullets=[],lobs=[],inkZones=[],axes=[],mines=[],trailZones=[],scissors=[],boomerangs=[],particles=[],floating=[],fxLines=[],remoteZones=[],impactFx=[];
  const damageQueue=new Map();let fxQueue=[],combatFlushTimer=0,trailTimer=0;
  function resetLocalEffects(){[bullets,lobs,inkZones,axes,mines,trailZones,scissors,boomerangs,particles,floating,fxLines,remoteZones,impactFx].forEach(a=>a.length=0);damageQueue.clear();fxQueue=[];combatFlushTimer=0;trailTimer=0;renderEnemies.clear();renderPlayers.clear();camera.x=camera.y=0}
  function crit(base){const c=Math.random()<build.critChance;return{damage:base*build.damageMult*(c?build.critDamage:1),crit:c}}
  function queueDamage(enemy,amount,kind=''){if(!enemy||amount<=0)return;damageQueue.set(enemy.id,(damageQueue.get(enemy.id)||0)+amount);floating.push({x:enemy.x+rand(-8,8),y:enemy.y-enemy.radius-10,text:`${Math.round(amount)}`,life:.55,color:weaponDefs[kind]&&weaponDefs[kind].color||'#111'})}
  function queueFx(fx){if(fxQueue.length<16)fxQueue.push(fx)}
  async function flushCombat(dt){combatFlushTimer-=dt;if(combatFlushTimer>0||(!damageQueue.size&&!fxQueue.length))return;combatFlushTimer=.06;const hits=[...damageQueue.entries()].slice(0,80).map(([id,damage])=>({id,damage}));damageQueue.clear();const fx=fxQueue.splice(0,8);api('/api/combat',authPayload({hits,fx})).catch(()=>{})}
  function effectiveCd(base,me){let m=build.cooldownMult;if(me&&me.buffHaste>0)m*=.72;return Math.max(.08,base*m)}

  function fireRifle(w,me){const lv=w.level,amount=1+build.amountBonus+(me.buffDouble>0?1:0)+(w.evolved?1:0),base=17+lv*5.1+(w.evolved?15:0),speed=(600+lv*24)*(w.evolved?1.12:1)*build.projectileSpeed,pierce=1+Math.floor(lv/3)+(w.evolved?4:0);for(let i=0;i<amount;i++){const a=currentAim()+((i-(amount-1)/2)*.045);const cr=crit(base);bullets.push({x:me.x+Math.cos(a)*28,y:me.y+Math.sin(a)*28,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:4+(w.evolved?1:0),damage:cr.damage,pierce,life:1.8,hit:new Set(),color:weaponDefs.rifle.color,kind:'rifle'});queueFx({type:'shot',x:me.x,y:me.y,a,weapon:'rifle'})}w.cd=effectiveCd(w.evolved?.19:Math.max(.24,.52-lv*.032),me);sfxShot()}
  function fireShotgun(w,me){const lv=w.level,pellets=4+Math.floor(lv*.75)+build.amountBonus+(me.buffDouble>0?2:0)+(w.evolved?5:0),spread=w.evolved?.58:.46,base=12+lv*3.4+(w.evolved?8:0),a0=currentAim();for(let i=0;i<pellets;i++){const t=pellets===1?0:(i/(pellets-1)-.5),a=a0+t*spread+rand(-.018,.018),cr=crit(base);bullets.push({x:me.x+Math.cos(a)*26,y:me.y+Math.sin(a)*26,vx:Math.cos(a)*(480+lv*14)*build.projectileSpeed,vy:Math.sin(a)*(480+lv*14)*build.projectileSpeed,r:4,damage:cr.damage,pierce:w.evolved?2:1,life:.9,hit:new Set(),color:weaponDefs.shotgun.color,kind:'shotgun'})}queueFx({type:'shot',x:me.x,y:me.y,a:a0,weapon:'shotgun',count:pellets});w.cd=effectiveCd(w.evolved?.62:Math.max(.82,1.45-lv*.055),me);sfxShot()}
  function fireInkBomb(w,me){const lv=w.level,target=nearestEnemy(me.x,me.y,580)||{x:screenToWorld(pointer.x,pointer.y).x,y:screenToWorld(pointer.x,pointer.y).y},count=1+(lv>=6?1:0)+build.amountBonus+(me.buffDouble>0?1:0)+(w.evolved?1:0);for(let i=0;i<count;i++){const tx=target.x+rand(-65,65),ty=target.y+rand(-65,65),color=PALETTE[randi(0,PALETTE.length-1)];lobs.push({sx:me.x,sy:me.y,tx,ty,t:0,dur:.62+rand(-.06,.08),color,lv,evolved:w.evolved})}w.cd=effectiveCd(w.evolved?1.25:Math.max(1.55,3.05-lv*.15),me)}
  function makeInkZone(x,y,lv,evolved,color,remote=false){const radius=(58+lv*8+(evolved?28:0))*build.areaMult,duration=(4.4+lv*.45+(evolved?3:0))*build.durationMult,zone={x,y,radius,life:duration,maxLife:duration,tick:0,damage:(8+lv*2.7+(evolved?11:0))*build.damageMult,color,seed:rand(1,9999),remote};(remote?remoteZones:inkZones).push(zone);if(!remote)queueFx({type:'inkZone',x,y,r:radius,duration,color});sfxBoom()}
  function fireAxe(w,me){const lv=w.level,targets=nearbyEnemies(me.x,me.y,700),count=1+Math.floor(lv/3)+build.amountBonus+(me.buffDouble>0?1:0)+(w.evolved?2:0);for(let i=0;i<count;i++){const t=targets[i%Math.max(1,targets.length)]||{x:me.x+rand(-300,300),y:me.y+rand(-240,240)};axes.push({x:t.x+rand(-45,45),y:t.y+rand(-35,35),t:.72+i*.08,max:.72+i*.08,lv,evolved:w.evolved,color:weaponDefs.axe.color,seed:rand(1,9999)})}w.cd=effectiveCd(w.evolved?.95:Math.max(1.2,2.55-lv*.12),me)}
  function fireBoomerang(w,me){const lv=w.level,count=1+Math.floor(lv/4)+build.amountBonus+(me.buffDouble>0?1:0)+(w.evolved?2:0),a0=currentAim();for(let i=0;i<count;i++){const a=a0+(i-(count-1)/2)*.20,sp=(360+lv*18)*build.projectileSpeed;boomerangs.push({x:me.x,y:me.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,age:0,life:w.evolved?2.0:1.55,damage:(18+lv*4.5+(w.evolved?16:0))*build.damageMult,hit:new Map(),color:weaponDefs.boomerang.color,seed:rand(1,9999)})}queueFx({type:'boomerang',x:me.x,y:me.y,a:a0,weapon:'boomerang',count});w.cd=effectiveCd(w.evolved?.78:Math.max(1.05,2.15-lv*.10),me)}
  function fireLightning(w,me){const lv=w.level,range=(340+lv*38+(w.evolved?180:0))*(1+build.passives.magnet*.08),count=2+Math.floor(lv/2)+build.amountBonus+(me.buffDouble>0?2:0)+(w.evolved?5:0),targets=nearbyEnemies(me.x,me.y,range).slice(0,count);let lx=me.x,ly=me.y;for(const e of targets){const cr=crit((20+lv*5+(w.evolved?18:0)));queueDamage(e,cr.damage,'lightning');fxLines.push({x1:lx,y1:ly,x2:e.x,y2:e.y,life:.18,color:weaponDefs.lightning.color,seed:rand(1,9999)});lx=e.x;ly=e.y}if(targets.length)queueFx({type:'lightning',x:me.x,y:me.y,x2:targets[targets.length-1].x,y2:targets[targets.length-1].y,count:targets.length,color:weaponDefs.lightning.color});w.cd=effectiveCd(w.evolved?.58:Math.max(.82,1.95-lv*.09),me)}
  function dropMine(w,me){const lv=w.level,minesNow=mines.length,maxM=2+Math.floor(lv/2)+(w.evolved?4:0);if(minesNow<maxM){mines.push({x:me.x,y:me.y,arm:.45,life:(7+lv*.4)*build.durationMult,lv,evolved:w.evolved,color:weaponDefs.eraserMine.color,seed:rand(1,9999)});queueFx({type:'mine',x:me.x,y:me.y,r:(70+lv*7)*build.areaMult,color:weaponDefs.eraserMine.color})}w.cd=effectiveCd(w.evolved?1.1:Math.max(1.55,3.8-lv*.18),me)}
  function fireScissors(w,me){const lv=w.level,count=1+Math.floor(lv/3)+build.amountBonus+(me.buffDouble>0?1:0)+(w.evolved?2:0),targets=nearbyEnemies(me.x,me.y,800);for(let i=0;i<count;i++){const t=targets[i%Math.max(1,targets.length)];if(!t)break;scissors.push({x:me.x,y:me.y,targetId:t.id,vx:0,vy:0,speed:(380+lv*24)*build.projectileSpeed,life:2.4,damage:(22+lv*5+(w.evolved?15:0))*build.damageMult,hit:new Set(),color:weaponDefs.scissors.color,seed:rand(1,9999)})}w.cd=effectiveCd(w.evolved?.72:Math.max(1.0,2.15-lv*.10),me)}

  const contactTimers={scripture:0,orbit:0,bird:0};
  function updateAutoWeapons(dt,me){
    if(!me||!me.alive||!net.state||net.state.mode!=='running'||net.state.rewardPaused||net.state.manualPaused)return;
    build.orbitAngle+=dt*(1.8+build.weapons.orbit.level*.06);build.birdAngle+=dt*1.45;
    for(const [k,w] of Object.entries(build.weapons)){if(w.level<=0)continue;w.cd=Math.max(0,w.cd-dt);if(w.cd>0)continue;if(k==='rifle')fireRifle(w,me);else if(k==='shotgun')fireShotgun(w,me);else if(k==='inkBomb')fireInkBomb(w,me);else if(k==='axe')fireAxe(w,me);else if(k==='boomerang')fireBoomerang(w,me);else if(k==='lightning')fireLightning(w,me);else if(k==='eraserMine')dropMine(w,me);else if(k==='scissors')fireScissors(w,me);else if(k==='scripture'||k==='orbit'||k==='paintTrail'||k==='bird')w.cd=.1}

    // Páginas giratórias.
    const sw=build.weapons.scripture;if(sw.level>0){contactTimers.scripture-=dt;if(contactTimers.scripture<=0){contactTimers.scripture=sw.evolved?.11:.17;const count=2+Math.floor(sw.level/2)+build.amountBonus+(sw.evolved?4:0),radius=(74+sw.level*5+(sw.evolved?28:0))*build.areaMult;for(let i=0;i<count;i++){const a=build.orbitAngle+i*TAU/count,x=me.x+Math.cos(a)*radius,y=me.y+Math.sin(a)*radius;for(const e of nearbyEnemies(x,y,25)){queueDamage(e,(7+sw.level*2.1+(sw.evolved?7:0))*build.damageMult,'scripture')}}}}
    // Compasso.
    const ow=build.weapons.orbit;if(ow.level>0){contactTimers.orbit-=dt;if(contactTimers.orbit<=0){contactTimers.orbit=ow.evolved?.09:.15;const count=1+Math.floor((ow.level+1)/2)+build.amountBonus+(ow.evolved?3:0),radius=(116+ow.level*6)*build.areaMult;for(let i=0;i<count;i++){const a=-build.orbitAngle*1.35+i*TAU/count,x=me.x+Math.cos(a)*radius,y=me.y+Math.sin(a)*radius;for(const e of nearbyEnemies(x,y,28)){queueDamage(e,(9+ow.level*2.5+(ow.evolved?9:0))*build.damageMult,'orbit')}}}}
    // Rolo de tinta: só enquanto se move.
    const tw=build.weapons.paintTrail;if(tw.level>0){trailTimer-=dt;const moving=Math.hypot(currentMove().x,currentMove().y)>.15;if(moving&&trailTimer<=0){trailTimer=tw.evolved?.16:Math.max(.22,.48-tw.level*.025);const color=PALETTE[randi(0,PALETTE.length-1)],radius=(32+tw.level*4+(tw.evolved?16:0))*build.areaMult,duration=(2.8+tw.level*.25+(tw.evolved?2.4:0))*build.durationMult;trailZones.push({x:me.x,y:me.y,radius,life:duration,maxLife:duration,tick:0,damage:(5+tw.level*1.8+(tw.evolved?6:0))*build.damageMult,color,seed:rand(1,9999)});if(Math.random()<.5)queueFx({type:'trail',x:me.x,y:me.y,r:radius,duration,color})}}
    // Passarinho aliado: bica alvo automaticamente.
    const bw=build.weapons.bird;if(bw.level>0){contactTimers.bird-=dt;if(contactTimers.bird<=0){contactTimers.bird=bw.evolved?.34:Math.max(.48,.95-bw.level*.055);const count=1+Math.floor(bw.level/3)+build.amountBonus+(bw.evolved?3:0),targets=nearbyEnemies(me.x,me.y,660);for(let i=0;i<count;i++){const e=targets[i%Math.max(1,targets.length)];if(!e)break;queueDamage(e,(18+bw.level*4.2+(bw.evolved?15:0))*build.damageMult,'bird');fxLines.push({x1:me.x+Math.cos(build.birdAngle+i)*65,y1:me.y+Math.sin(build.birdAngle+i)*45,x2:e.x,y2:e.y,life:.22,color:weaponDefs.bird.color,seed:rand(1,9999)});queueFx({type:'bird',x:me.x,y:me.y,x2:e.x,y2:e.y,color:weaponDefs.bird.color})}}}
  }

  function updateLocalCombat(dt){
    const me=getMeRender();if(!me)return;
    updateAutoWeapons(dt,me);
    for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.life-=dt;if(b.life<=0){bullets.splice(i,1);continue}b.x+=b.vx*dt;b.y+=b.vy*dt;for(const e of nearbyEnemies(b.x,b.y,45)){if(b.hit.has(e.id))continue;if(dist(b.x,b.y,e.x,e.y)<b.r+e.radius){b.hit.add(e.id);queueDamage(e,b.damage,b.kind);b.pierce--;if(b.pierce<=0){b.life=0;break}}}}
    for(let i=lobs.length-1;i>=0;i--){const l=lobs[i];l.t+=dt;const q=clamp(l.t/l.dur,0,1);l.x=lerp(l.sx,l.tx,q);l.y=lerp(l.sy,l.ty,q)-Math.sin(q*Math.PI)*120;if(q>=1){makeInkZone(l.tx,l.ty,l.lv,l.evolved,l.color);lobs.splice(i,1)}}
    for(let i=axes.length-1;i>=0;i--){const a=axes[i];a.t-=dt;if(a.t<=0){const radius=(58+a.lv*7+(a.evolved?34:0))*build.areaMult,base=(30+a.lv*7+(a.evolved?24:0));for(const e of nearbyEnemies(a.x,a.y,radius)){const cr=crit(base*(1-clamp(dist(a.x,a.y,e.x,e.y)/radius,0,.75)*.3));queueDamage(e,cr.damage,'axe')}impactFx.push({x:a.x,y:a.y,r:radius,life:.45,color:a.color,seed:a.seed});queueFx({type:'axe',x:a.x,y:a.y,r:radius,color:a.color});sfxBoom();axes.splice(i,1)}}
    for(let i=boomerangs.length-1;i>=0;i--){const b=boomerangs[i];b.age+=dt;b.life-=dt;if(b.life<=0){boomerangs.splice(i,1);continue}if(b.age>.62){let dx=me.x-b.x,dy=me.y-b.y,d=Math.max(1,Math.hypot(dx,dy));b.vx=lerp(b.vx,dx/d*520*build.projectileSpeed,clamp(dt*4,0,1));b.vy=lerp(b.vy,dy/d*520*build.projectileSpeed,clamp(dt*4,0,1));if(d<28&&b.age>1) {boomerangs.splice(i,1);continue}}b.x+=b.vx*dt;b.y+=b.vy*dt;for(const e of nearbyEnemies(b.x,b.y,38)){const last=b.hit.get(e.id)||0;if(b.age-last<.35)continue;if(dist(b.x,b.y,e.x,e.y)<e.radius+12){b.hit.set(e.id,b.age);queueDamage(e,b.damage,'boomerang')}}}
    for(let i=scissors.length-1;i>=0;i--){const s=scissors[i];s.life-=dt;if(s.life<=0){scissors.splice(i,1);continue}const e=renderEnemies.get(s.targetId)||nearestEnemy(s.x,s.y,700);if(e){s.targetId=e.id;let dx=e.x-s.x,dy=e.y-s.y,d=Math.max(1,Math.hypot(dx,dy)),tvx=dx/d*s.speed,tvy=dy/d*s.speed;s.vx=lerp(s.vx,tvx,clamp(dt*8,0,1));s.vy=lerp(s.vy,tvy,clamp(dt*8,0,1));if(d<e.radius+12&&!s.hit.has(e.id)){s.hit.add(e.id);const cr=crit(s.damage/build.damageMult);queueDamage(e,cr.damage,'scissors');s.life=0;queueFx({type:'scissor',x:s.x,y:s.y,x2:e.x,y2:e.y,color:s.color})}}s.x+=s.vx*dt;s.y+=s.vy*dt}
    updateDamageZones(inkZones,dt,'inkBomb');updateDamageZones(trailZones,dt,'paintTrail');
    for(let i=mines.length-1;i>=0;i--){const m=mines[i];m.arm-=dt;m.life-=dt;const near=m.arm<=0?nearestEnemy(m.x,m.y,(70+m.lv*7)*build.areaMult):null;if(near||m.life<=0){const radius=(72+m.lv*8+(m.evolved?35:0))*build.areaMult,base=(28+m.lv*7+(m.evolved?25:0));for(const e of nearbyEnemies(m.x,m.y,radius)){const cr=crit(base);queueDamage(e,cr.damage,'eraserMine')}impactFx.push({x:m.x,y:m.y,r:radius,life:.5,color:m.color,seed:m.seed});queueFx({type:'mine',x:m.x,y:m.y,r:radius,color:m.color});sfxBoom();mines.splice(i,1)}}
    for(const z of remoteZones)z.life-=dt;for(let i=remoteZones.length-1;i>=0;i--)if(remoteZones[i].life<=0)remoteZones.splice(i,1);
    for(const f of fxLines)f.life-=dt;for(let i=fxLines.length-1;i>=0;i--)if(fxLines[i].life<=0)fxLines.splice(i,1);
    for(const f of impactFx)f.life-=dt;for(let i=impactFx.length-1;i>=0;i--)if(impactFx[i].life<=0)impactFx.splice(i,1);
    for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.gravity||0)*dt;p.rot=(p.rot||0)+(p.vr||0)*dt}for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);
    for(const f of floating){f.life-=dt;f.y-=24*dt}for(let i=floating.length-1;i>=0;i--)if(floating[i].life<=0)floating.splice(i,1);
    flushCombat(dt);
  }
  function updateDamageZones(arr,dt,kind){for(let i=arr.length-1;i>=0;i--){const z=arr[i];z.life-=dt;z.tick-=dt;if(z.life<=0){arr.splice(i,1);continue}if(z.tick<=0){z.tick=kind==='inkBomb'?.32:.28;for(const e of nearbyEnemies(z.x,z.y,z.radius)){const fall=1-clamp(dist(z.x,z.y,e.x,e.y)/z.radius,0,.8)*.22;queueDamage(e,z.damage*fall,kind)}}}}

  // --------------------------- EVENTS / REMOTE FX ---------------------------
  let bigMessage='',bigMessageSub='',bigMessageLife=0,screenShake=0,hitFlash=0;
  function showBig(text,sub=''){bigMessage=text;bigMessageSub=sub;bigMessageLife=2.4}
  function processEvents(events){for(const e of events){if(e.seq<=net.lastEventSeq)continue;net.lastEventSeq=Math.max(net.lastEventSeq,e.seq);if(e.type==='enemyDead'){for(let i=0;i<7;i++)particles.push({x:e.x,y:e.y,vx:rand(-150,150),vy:rand(-180,60),life:rand(.45,.9),gravity:110,rot:rand(0,TAU),vr:rand(-5,5),size:rand(3,8),color:e.color||'#111',kind:'feather'});if(e.boss)showBig(`${e.name} CAIU!`,'BAÚ PARA TODO MUNDO')}else if(e.type==='bossSpawn'){showBig(e.name,'CHEFE NO RABISCO!');screenShake=7}else if(e.type==='playerDown'){if(e.playerId===net.playerId){showBig('VOCÊ CAIU!','UM AMIGO PODE TE REVIVER');sfxHurt()}else showBig(`${e.name} CAIU!`,'FIQUE PERTO PARA REVIVER')}else if(e.type==='playerRevived'){showBig('REVIVE!','DE VOLTA PARA O CAOS');sfxPickup()}else if(e.type==='playerHit'&&e.playerId===net.playerId){hitFlash=.5;screenShake=Math.max(screenShake,5);sfxHurt()}else if(e.type==='pickupCollected'){showBig(pickupLabel(e.kind),'POWER-UP DA EQUIPE');sfxPickup();if(e.kind==='nuke')screenShake=12}else if(e.type==='hostChanged'){toast(`${e.name} virou o host.`)}else if(e.type==='combatFx'&&e.playerId!==net.playerId){processRemoteCombatFx(e)}}}
  function pickupLabel(k){return({heal:'CURA DE TINTA',double:'TIRO DUPLO',haste:'MÃO TURBO',nuke:'BORRACHA NUCLEAR',coin:'MOEDAS',shield:'ESCUDO DE PAPEL'})[k]||'POWER-UP'}
  function processRemoteCombatFx(e){const c=e.paintColor||e.color||'#111';if(e.fxType==='inkZone'||e.fxType==='trail'){remoteZones.push({x:e.x,y:e.y,radius:e.r||60,life:e.duration||4,maxLife:e.duration||4,color:c,seed:e.seq,remote:true})}else if(e.fxType==='axe'||e.fxType==='mine'){impactFx.push({x:e.x,y:e.y,r:e.r||70,life:.45,color:c,seed:e.seq})}else if(e.fxType==='lightning'||e.fxType==='bird'||e.fxType==='scissor'){fxLines.push({x1:e.x,y1:e.y,x2:e.x2||e.x,y2:e.y2||e.y,life:.2,color:c,seed:e.seq})}else if(e.fxType==='shot'||e.fxType==='boomerang'){const a=e.a||0;fxLines.push({x1:e.x,y1:e.y,x2:e.x+Math.cos(a)*85,y2:e.y+Math.sin(a)*85,life:.1,color:c,seed:e.seq})}}

  // --------------------------- INPUT ---------------------------
  const keys=new Set();const pointer={x:CX+260,y:CY,active:true};const touchMove={x:0,y:0,active:false,pointerId:null};
  function canvasPoint(clientX,clientY){const r=canvas.getBoundingClientRect();return{x:clamp((clientX-r.left)*(W/r.width),0,W),y:clamp((clientY-r.top)*(H/r.height),0,H)}}
  function currentMove(){let x=0,y=0;if(keys.has('KeyA')||keys.has('ArrowLeft'))x--;if(keys.has('KeyD')||keys.has('ArrowRight'))x++;if(keys.has('KeyW')||keys.has('ArrowUp'))y--;if(keys.has('KeyS')||keys.has('ArrowDown'))y++;x+=touchMove.x;y+=touchMove.y;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m}return{x,y}}
  function currentAim(){const me=getMeRender();if(!me)return 0;if(pointer.active)return Math.atan2(pointer.y-CY,pointer.x-CX);const e=nearestEnemy(me.x,me.y,800);return e?Math.atan2(e.y-me.y,e.x-me.x):(me.aim||0)}
  async function dash(){const me=getMe();if(!me||!me.alive)return;const m=currentMove();try{await api('/api/dash',authPayload({dx:m.x,dy:m.y}))}catch{}}
  let inputSending=false;setInterval(async()=>{if(inputSending||!net.connected||!net.state||net.state.mode!=='running')return;inputSending=true;const m=currentMove();try{await api('/api/input',authPayload({dx:m.x,dy:m.y,aim:currentAim()}))}catch{}finally{inputSending=false}},55);

  window.addEventListener('keydown',e=>{keys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Space'&&!e.repeat)dash();if(e.code==='KeyP'&&!e.repeat&&net.state&&net.state.hostId===net.playerId)api('/api/room/pause',authPayload()).catch(err=>toast(humanError(err.message)));if(rewardKind==='level'&&['Digit1','Digit2','Digit3'].includes(e.code))chooseLevel(Number(e.code.slice(-1))-1)});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const p=canvasPoint(e.clientX,e.clientY);pointer.x=p.x;pointer.y=p.y;pointer.active=true});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){const p=canvasPoint(e.clientX,e.clientY);pointer.x=p.x;pointer.y=p.y;pointer.active=false}else pointer.active=true;resumeAudio()});
  ui.dashBtn.addEventListener('pointerdown',e=>{e.preventDefault();dash();resumeAudio()});
  ui.joystick.addEventListener('pointerdown',e=>{touchMove.active=true;touchMove.pointerId=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);updateJoystick(e)});ui.joystick.addEventListener('pointermove',e=>{if(touchMove.active&&e.pointerId===touchMove.pointerId)updateJoystick(e)});ui.joystick.addEventListener('pointerup',releaseJoy);ui.joystick.addEventListener('pointercancel',releaseJoy);
  function updateJoystick(e){const r=ui.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),m=Math.min(42,d),nx=d?dx/d:0,ny=d?dy/d:0;touchMove.x=nx*(m/42);touchMove.y=ny*(m/42);ui.stick.style.transform=`translate(${nx*m}px,${ny*m}px)`}
  function releaseJoy(){touchMove.active=false;touchMove.x=touchMove.y=0;ui.stick.style.transform='translate(0px,0px)'}

  // --------------------------- DRAW HELPERS ---------------------------
  function hashNoise(v){const x=Math.sin(v*12.9898)*43758.5453;return(x-Math.floor(x))*2-1}
  function wobbleLine(x1,y1,x2,y2,width=2.5,seed=1,alpha=1,color='#111'){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);const mx=(x1+x2)/2,my=(y1+y2)/2;ctx.quadraticCurveTo(mx+hashNoise(seed)*3,my+hashNoise(seed+7)*3,x2,y2);ctx.stroke();ctx.restore()}
  function roughCircle(x,y,r,width=2.5,seed=1,fill=null,alpha=1,color='#111'){ctx.save();ctx.globalAlpha=alpha;if(fill){ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x+hashNoise(seed)*1.2,y+hashNoise(seed+3)*1.2,r*(1+hashNoise(seed+2)*.035),r*(1+hashNoise(seed+5)*.04),hashNoise(seed+9)*.035,0,TAU);ctx.fill()}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.ellipse(x,y,r*(1+hashNoise(seed)*.025),r*(1+hashNoise(seed+2)*.03),hashNoise(seed+4)*.03,0,TAU);ctx.stroke();ctx.restore()}
  function drawText(text,x,y,size=18,align='left',weight=800,alpha=1,color='#111'){ctx.save();ctx.globalAlpha=alpha;ctx.font=`${weight} ${size}px "Comic Sans MS","Segoe Print",cursive`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore()}
  function roughStar(x,y,ro,ri,rot,seed,fill='#fff',color='#111'){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.beginPath();for(let i=0;i<10;i++){const r=(i%2?ri:ro)*(1+hashNoise(seed+i)*.08),a=i*Math.PI/5-Math.PI/2;const px=Math.cos(a)*r,py=Math.sin(a)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.stroke();ctx.restore()}
  function paintSplat(x,y,r,color,seed,alpha=.35){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();const n=18;for(let i=0;i<n;i++){const a=i*TAU/n,rr=r*(.72+Math.abs(hashNoise(seed+i*17))*.46);const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.closePath();ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<5;i++){const a=hashNoise(seed+i*23)*TAU,rr=r*(1.05+Math.abs(hashNoise(seed+i*31))*.7),dot=r*(.06+Math.abs(hashNoise(seed+i*11))*.08);ctx.beginPath();ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,dot,0,TAU);ctx.fill();ctx.stroke()}ctx.restore()}

  function drawBackground(){ctx.fillStyle='#fffdf5';ctx.fillRect(0,0,W,H);const cell=150,minX=Math.floor((camera.x-CX)/cell)-1,maxX=Math.floor((camera.x+CX)/cell)+1,minY=Math.floor((camera.y-CY)/cell)-1,maxY=Math.floor((camera.y+CY)/cell)+1;for(let gx=minX;gx<=maxX;gx++)for(let gy=minY;gy<=maxY;gy++){const wx=gx*cell,wy=gy*cell,s=worldToScreen(wx,wy),seed=gx*92821+gy*68917;if(Math.abs(hashNoise(seed))>.42)wobbleLine(s.x-12+hashNoise(seed+1)*40,s.y+hashNoise(seed+2)*40,s.x+12+hashNoise(seed+3)*40,s.y+hashNoise(seed+4)*40,1.2,seed,.13,'#111');if(Math.abs(hashNoise(seed+9))>.82){const c=PALETTE[Math.abs((gx+gy*3))%PALETTE.length];roughCircle(s.x+hashNoise(seed+11)*55,s.y+hashNoise(seed+12)*55,4+Math.abs(hashNoise(seed+13))*6,1,seed+14,null,.11,c)}}}

  function drawEnemy(e,now){if(!onScreen(e.x,e.y,190))return;const s=worldToScreen(e.x,e.y),z=e.size||1,flap=Math.sin(now*7+e.id*.7)*12*z;ctx.save();ctx.translate(s.x,s.y);const me=getMeRender();if(me&&me.x<e.x)ctx.scale(-1,1);const accent=e.isBoss?e.color:e.elite?'#dc2626':e.type==='owl'?'#9333ea':'#111';roughCircle(5*z,3*z,8*z,2.4,e.seed+1,'#fff',1,accent);roughCircle(15*z,0,5*z,2.1,e.seed+2,'#fff',1,accent);wobbleLine(19*z,0,30*z,-2*z,2,e.seed+3,1,accent);ctx.beginPath();ctx.moveTo(4*z,2*z);ctx.quadraticCurveTo(-8*z,-14*z-flap,-28*z,-9*z-flap*.25);ctx.quadraticCurveTo(-46*z,-7*z,-57*z,-1*z);ctx.moveTo(4*z,2*z);ctx.quadraticCurveTo(17*z,-13*z+flap,36*z,-8*z+flap*.25);ctx.quadraticCurveTo(49*z,-6*z,60*z,-2*z);ctx.strokeStyle=accent;ctx.lineWidth=Math.max(2,2.5*z);ctx.lineCap='round';ctx.stroke();roughCircle(16*z,-1*z,1.2*z,1.2,e.seed+9,accent,1,accent);if(e.elite&&!e.isBoss)roughStar(0,-27*z,7*z,3*z,now,e.seed+12,'#fff','#dc2626');ctx.restore();if(e.elite||e.isBoss){const bw=e.isBoss?170:72,bh=e.isBoss?10:7,x=s.x-bw/2,y=s.y-e.radius-30;ctx.fillStyle='#fff';ctx.fillRect(x,y,bw,bh);ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.strokeRect(x,y,bw,bh);ctx.fillStyle=accent;ctx.fillRect(x+2,y+2,(bw-4)*clamp(e.hp/e.maxHp,0,1),bh-4);if(e.isBoss)drawText(e.name,s.x,y-13,13,'center',900,1,accent)}}

  function drawPlayer(p,isMe,now){if(!onScreen(p.x,p.y,130))return;const s=worldToScreen(p.x,p.y),moving=Math.hypot((p.tx||p.x)-p.x,(p.ty||p.y)-p.y)>.2,bob=moving?Math.sin(now*9+p.id.length)*2.7:Math.sin(now*3)*.6,a=p.aim||0;ctx.save();ctx.translate(s.x,s.y+bob);ctx.globalAlpha=p.alive?1:.38;ctx.beginPath();ctx.ellipse(0,20,24,8,0,0,TAU);ctx.strokeStyle='rgba(17,17,17,.2)';ctx.lineWidth=2;ctx.stroke();const stride=moving?Math.sin(now*10)*7:0;wobbleLine(-5,10,-8-stride,28,3,901,1,p.color);wobbleLine(6,10,8+stride,28,3,902,1,p.color);roughCircle(0,-3,14,3,903,'#fff',1,p.color);wobbleLine(-11,-13,-13,8,3,904,1,p.color);wobbleLine(11,-13,13,8,3,905,1,p.color);roughCircle(0,-30,12,3,906,'#fff',1,p.color);wobbleLine(-10,-35,9,-36,2.5,907,1,p.color);wobbleLine(0,-7,Math.cos(a)*14,-8+Math.sin(a)*14,3,909,1,p.color);wobbleLine(Math.cos(a)*14,-8+Math.sin(a)*14,Math.cos(a)*48,-8+Math.sin(a)*48,4,910,1,p.color);ctx.restore();drawText(p.name,s.x,s.y-58,isMe?13:11,'center',900,1,p.color);if(p.shield>0)roughCircle(s.x,s.y,34,2.3,944,null,.6,p.color);if(!p.alive){drawText('CAÍDO',s.x,s.y+46,12,'center',1000,1,'#dc2626');const pct=clamp(p.reviveProgress/3,0,1);ctx.fillStyle='#fff';ctx.fillRect(s.x-35,s.y+58,70,7);ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.strokeRect(s.x-35,s.y+58,70,7);ctx.fillStyle='#16a34a';ctx.fillRect(s.x-33,s.y+60,66*pct,3)}}

  function drawZones(){for(const z of [...remoteZones,...inkZones,...trailZones]){if(!onScreen(z.x,z.y,z.radius+60))continue;const s=worldToScreen(z.x,z.y),alpha=.18+.22*clamp(z.life/Math.min(1.2,z.maxLife||1),0,1);paintSplat(s.x,s.y,z.radius,z.color,z.seed,alpha);if(z===inkZones[0]){} }}
  function drawPickups(now){if(!net.state)return;for(const p of net.state.pickups||[]){if(!onScreen(p.x,p.y,80))continue;const s=worldToScreen(p.x,p.y),bob=Math.sin(now*3+p.seed)*5,c=({heal:'#dc2626',double:'#2563eb',haste:'#16a34a',nuke:'#9333ea',coin:'#eab308',shield:'#0891b2'})[p.kind]||'#111';roughStar(s.x,s.y+bob,20,9,now*.7,p.seed,'#fff',c);drawText(({heal:'♥',double:'×2',haste:'>>',nuke:'!',coin:'$',shield:'O'})[p.kind]||'?',s.x,s.y+bob+1,p.kind==='double'?11:14,'center',1000,1,c)}}
  function drawProjectiles(now){for(const b of bullets){if(!onScreen(b.x,b.y,60))continue;const s=worldToScreen(b.x,b.y),a=Math.atan2(b.vy,b.vx);wobbleLine(s.x-Math.cos(a)*8,s.y-Math.sin(a)*8,s.x+Math.cos(a)*9,s.y+Math.sin(a)*9,2.4,b.life*100,1,b.color)}for(const l of lobs){const s=worldToScreen(l.x||l.sx,l.y||l.sy);roughCircle(s.x,s.y,8,2,l.t*100,'#fff',1,l.color);wobbleLine(s.x-5,s.y-8,s.x+5,s.y-12,2,l.t*101,1,l.color)}for(const a of axes){const q=clamp(a.t/a.max,0,1),wy=a.y-520*q,s=worldToScreen(a.x,wy);ctx.save();ctx.translate(s.x,s.y);ctx.rotate((1-q)*4+a.seed);wobbleLine(0,-18,0,18,5,a.seed,1,'#78350f');wobbleLine(-14,-18,14,-18,7,a.seed+1,1,a.color);ctx.restore()}for(const b of boomerangs){const s=worldToScreen(b.x,b.y);ctx.save();ctx.translate(s.x,s.y);ctx.rotate(b.age*8);wobbleLine(-15,0,15,0,4,b.seed,1,b.color);wobbleLine(12,0,17,-6,3,b.seed+1,1,b.color);ctx.restore()}for(const s0 of scissors){const s=worldToScreen(s0.x,s0.y),a=Math.atan2(s0.vy,s0.vx);ctx.save();ctx.translate(s.x,s.y);ctx.rotate(a);wobbleLine(-12,-6,12,6,3,s0.seed,1,s0.color);wobbleLine(-12,6,12,-6,3,s0.seed+1,1,s0.color);roughCircle(-11,0,4,2,s0.seed+2,'#fff',1,s0.color);ctx.restore()}for(const m of mines){if(!onScreen(m.x,m.y,60))continue;const s=worldToScreen(m.x,m.y);ctx.save();ctx.translate(s.x,s.y);ctx.rotate(hashNoise(m.seed)*.08);ctx.fillStyle='#fff';ctx.fillRect(-15,-9,30,18);ctx.strokeStyle=m.color;ctx.lineWidth=3;ctx.strokeRect(-15,-9,30,18);wobbleLine(-12,0,12,0,2,m.seed,1,m.color);drawText('E',0,0,10,'center',1000,1,m.color);ctx.restore()}}
  function drawOrbitWeapons(me,now){if(!me||!me.alive)return;const sw=build.weapons.scripture;if(sw.level>0){const count=2+Math.floor(sw.level/2)+build.amountBonus+(sw.evolved?4:0),radius=(74+sw.level*5+(sw.evolved?28:0))*build.areaMult;for(let i=0;i<count;i++){const a=build.orbitAngle+i*TAU/count,s=worldToScreen(me.x+Math.cos(a)*radius,me.y+Math.sin(a)*radius);ctx.save();ctx.translate(s.x,s.y);ctx.rotate(a+.4);ctx.fillStyle='#fff';ctx.fillRect(-10,-14,20,28);ctx.strokeStyle=weaponDefs.scripture.color;ctx.lineWidth=3;ctx.strokeRect(-10,-14,20,28);wobbleLine(-6,-6,6,-6,1.5,i+3,1,weaponDefs.scripture.color);wobbleLine(-6,0,6,0,1.5,i+7,1,weaponDefs.scripture.color);ctx.restore()}}const ow=build.weapons.orbit;if(ow.level>0){const count=1+Math.floor((ow.level+1)/2)+build.amountBonus+(ow.evolved?3:0),radius=(116+ow.level*6)*build.areaMult;for(let i=0;i<count;i++){const a=-build.orbitAngle*1.35+i*TAU/count,s=worldToScreen(me.x+Math.cos(a)*radius,me.y+Math.sin(a)*radius);wobbleLine(s.x-Math.cos(a)*18,s.y-Math.sin(a)*18,s.x+Math.cos(a)*18,s.y+Math.sin(a)*18,4,i+99,1,weaponDefs.orbit.color);roughCircle(s.x,s.y,4,2,i+100,'#fff',1,weaponDefs.orbit.color)}}const bw=build.weapons.bird;if(bw.level>0){const count=1+Math.floor(bw.level/3)+build.amountBonus+(bw.evolved?3:0);for(let i=0;i<count;i++){const a=build.birdAngle+i*TAU/count,x=me.x+Math.cos(a)*65,y=me.y+Math.sin(a)*42,s=worldToScreen(x,y),fl=Math.sin(now*10+i)*7;ctx.save();ctx.translate(s.x,s.y);ctx.beginPath();ctx.moveTo(0,2);ctx.quadraticCurveTo(-10,-8-fl,-22,-1);ctx.moveTo(0,2);ctx.quadraticCurveTo(10,-8+fl,22,-1);ctx.strokeStyle=weaponDefs.bird.color;ctx.lineWidth=3;ctx.stroke();ctx.restore()}}}
  function drawFx(){for(const f of fxLines){const a=clamp(f.life/.22,0,1),s1=worldToScreen(f.x1,f.y1),s2=worldToScreen(f.x2,f.y2);wobbleLine(s1.x,s1.y,s2.x,s2.y,3.5,f.seed,a,f.color);wobbleLine(s1.x+3,s1.y-2,s2.x-2,s2.y+3,1.5,f.seed+9,a*.7,f.color)}for(const f of impactFx){if(!onScreen(f.x,f.y,f.r+60))continue;const s=worldToScreen(f.x,f.y),a=clamp(f.life/.5,0,1);ctx.save();ctx.globalAlpha=a;for(let i=0;i<3;i++)roughCircle(s.x,s.y,f.r*(.55+i*.18),2.5,f.seed+i,null,a,f.color);for(let i=0;i<10;i++){const ang=i*TAU/10+f.seed;wobbleLine(s.x+Math.cos(ang)*f.r*.2,s.y+Math.sin(ang)*f.r*.2,s.x+Math.cos(ang)*f.r,s.y+Math.sin(ang)*f.r,2,f.seed+i,a,f.color)}ctx.restore()}}
  function drawEnemyBullets(){if(!net.state)return;for(const b of net.state.enemyBullets||[]){if(!onScreen(b.x,b.y,50))continue;const s=worldToScreen(b.x,b.y);roughStar(s.x,s.y,b.r+2,3,performance.now()/500,b.id,'#fff',b.color||'#111')}}
  function drawParticles(){for(const p of particles){if(!onScreen(p.x,p.y,80))continue;const s=worldToScreen(p.x,p.y);ctx.save();ctx.globalAlpha=clamp(p.life*1.5,0,1);ctx.translate(s.x,s.y);ctx.rotate(p.rot||0);wobbleLine(-p.size,0,p.size,0,2,p.size*99,1,p.color||'#111');ctx.restore()}for(const f of floating){if(!onScreen(f.x,f.y,80))continue;const s=worldToScreen(f.x,f.y);drawText(f.text,s.x,s.y,15,'center',900,clamp(f.life*1.8,0,1),f.color||'#111')}}
  function drawCrosshair(){if(!net.state||net.state.mode!=='running'||!pointer.active)return;const x=pointer.x,y=pointer.y;ctx.save();ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,13,0,TAU);ctx.stroke();wobbleLine(x-22,y,x-7,y,2,1);wobbleLine(x+7,y,x+22,y,2,2);wobbleLine(x,y-22,x,y-7,2,3);wobbleLine(x,y+7,x,y+22,2,4);ctx.restore()}

  function drawHud(){if(!net.state||net.state.mode==='lobby')return;const room=net.state,me=getMe();if(!me)return;ctx.save();ctx.fillStyle='rgba(255,253,245,.9)';ctx.fillRect(14,14,405,110);ctx.strokeStyle='#111';ctx.lineWidth=3;ctx.strokeRect(14,14,405,110);drawText(`SALA ${room.id} · ${fmtTime(room.elapsed)} / ${fmtTime(room.duration)}`,28,33,16,'left',1000);drawText(`NÍVEL ${me.level}   AVES ${room.teamKills}   SUAS KILLS ${me.kills}`,28,57,13,'left',900);ctx.fillStyle='#fff';ctx.fillRect(28,74,260,16);ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.strokeRect(28,74,260,16);ctx.fillStyle=me.hp/me.maxHp<.3?'#dc2626':me.color;ctx.fillRect(30,76,256*clamp(me.hp/me.maxHp,0,1),12);drawText(`${Math.ceil(me.hp)} / ${Math.round(me.maxHp)}`,298,82,12,'left',1000);ctx.fillStyle='#fff';ctx.fillRect(28,99,260,10);ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.strokeRect(28,99,260,10);ctx.fillStyle='#9333ea';ctx.fillRect(30,101,256*clamp(me.xp/me.xpNeed,0,1),6);drawText(`XP ${Math.floor(me.xp)}/${me.xpNeed}`,298,104,11,'left',900);
    const buffs=[];if(me.buffDouble>0)buffs.push(`×2 ${me.buffDouble.toFixed(0)}s`);if(me.buffHaste>0)buffs.push(`TURBO ${me.buffHaste.toFixed(0)}s`);if(me.shield>0)buffs.push(`ESCUDO ${me.shield.toFixed(0)}s`);if(buffs.length)drawText(buffs.join(' · '),W-20,28,14,'right',1000,1,'#2563eb');
    const weapons=Object.entries(build.weapons).filter(([,w])=>w.level>0);let x=16,y=H-35;for(const [k,w] of weapons){const d=weaponDefs[k],label=`${d.icon} ${w.evolved?'★ ':''}${w.level}`;ctx.font='900 13px "Comic Sans MS"';const ww=Math.max(52,ctx.measureText(label).width+18);ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(x,y-18,ww,28);ctx.strokeStyle=d.color;ctx.lineWidth=3;ctx.strokeRect(x,y-18,ww,28);drawText(label,x+ww/2,y-4,13,'center',1000,1,d.color);x+=ww+7;if(x>W-180){x=16;y-=35}}
    ctx.restore();
  }
  function drawMessages(){if(bigMessageLife<=0)return;const a=clamp(bigMessageLife/.35,0,1);drawText(bigMessage,CX,116,34,'center',1000,a,'#111');if(bigMessageSub)drawText(bigMessageSub,CX,148,15,'center',900,a,'#9333ea')}

  function draw(now){
    ctx.save();if(screenShake>0)ctx.translate(rand(-screenShake,screenShake),rand(-screenShake,screenShake));drawBackground();drawZones();drawPickups(now);drawProjectiles(now);drawFx();drawEnemyBullets();for(const e of renderEnemies.values())drawEnemy(e,now);const me=getMeRender();if(me)drawOrbitWeapons(me,now);for(const p of renderPlayers.values())drawPlayer(p,p.id===net.playerId,now);drawParticles();drawCrosshair();drawHud();drawMessages();if(hitFlash>0){ctx.fillStyle=`rgba(220,38,38,${hitFlash*.18})`;ctx.fillRect(0,0,W,H)}ctx.restore();
  }

  // --------------------------- GAME OVER / CLAIM ---------------------------
  let shownEndRun='',shownEarned=0;
  function claimRun(room,me){if(!me||!room.runId||save.claimedRuns.includes(room.runId))return 0;const earned=Math.floor(me.runCoins+room.teamKills/14+me.level*2+(room.victory?120:0));save.coins+=earned;save.bestTime=Math.max(save.bestTime,room.elapsed);save.bestLevel=Math.max(save.bestLevel,me.level);save.totalKills+=me.kills;if(room.victory)save.wins++;save.claimedRuns.push(room.runId);if(save.claimedRuns.length>30)save.claimedRuns=save.claimedRuns.slice(-30);persistSave();renderMetaShop();return earned}
  function showGameOver(room){const me=getMe();if(!me)return;hideAllOverlays();ui.gameOver.classList.add('visible');if(shownEndRun!==room.runId){shownEndRun=room.runId;shownEarned=claimRun(room,me)}const earned=shownEarned;ui.gameOverTitle.textContent=room.victory?'VOCÊS SOBREVIVERAM!':'FIM DA RUN';ui.runSummary.innerHTML=`<div><b>Tempo</b><br>${fmtTime(room.elapsed)}</div><div><b>Nível</b><br>${me.level}</div><div><b>Aves da equipe</b><br>${room.teamKills}</div><div><b>Suas kills</b><br>${me.kills}</div><div><b>Seu dano</b><br>${Math.round(me.damage).toLocaleString('pt-BR')}</div><div><b>Moedas</b><br>${earned?`+${earned}`:'já coletadas'} 🪙</div>`;const host=room.hostId===net.playerId;ui.restartBtn.style.display=host?'block':'none';ui.restartHint.textContent=host?'Você é o host: pode iniciar outra run com a mesma galera.':'Aguardando o host iniciar outra run.';shownEndRun=room.runId}

  // --------------------------- UI BUTTONS ---------------------------
  ui.soloBtn.onclick=()=>createRoom(true);ui.createRoomBtn.onclick=()=>createRoom(false);ui.joinBtn.onclick=()=>joinRoom(ui.joinCode.textContent.trim());ui.startRoom.onclick=()=>api('/api/room/start',authPayload()).catch(e=>toast(humanError(e.message)));ui.restartBtn.onclick=()=>api('/api/room/restart',authPayload()).catch(e=>toast(humanError(e.message)));ui.chestContinue.onclick=closeChest;
  ui.copyInvite.onclick=async()=>{try{await navigator.clipboard.writeText(ui.inviteLink.value);toast('Link copiado!')}catch{ui.inviteLink.select();document.execCommand('copy');toast('Link copiado!')}};
  ui.shareInvite.onclick=async()=>{if(navigator.share){try{await navigator.share({title:'Rabisco Survivors CO-OP',text:'Entra na minha sala para ajudar na run!',url:ui.inviteLink.value})}catch{}}else ui.copyInvite.click()};
  ui.leaveRoom.onclick=()=>{stopPolling();clearSession();history.replaceState({},'',location.pathname);showMenu()};
  ui.menuBtn.onclick=()=>{stopPolling();clearSession();history.replaceState({},'',location.pathname);showMenu()};
  ui.resetSave.onclick=()=>{if(confirm('Zerar moedas, recordes e melhorias permanentes deste navegador?')){save=defaultSave();persistSave();renderMetaShop();toast('Progresso local zerado.')}};

  // --------------------------- FRAME ---------------------------
  let last=performance.now();
  function frame(nowMs){const dt=Math.min(.033,(nowMs-last)/1000||0);last=nowMs;interpolate(dt);if(bigMessageLife>0)bigMessageLife-=dt;if(screenShake>0)screenShake=Math.max(0,screenShake-dt*22);if(hitFlash>0)hitFlash=Math.max(0,hitFlash-dt*2.6);if(net.state&&net.state.mode==='running'&&!net.state.rewardPaused&&!net.state.manualPaused)updateLocalCombat(dt);draw(nowMs/1000);requestAnimationFrame(frame)}

  // --------------------------- BOOT ---------------------------
  resetBuild();renderMetaShop();ui.name.value=localStorage.getItem('rabiscoNickname')||'';showMenu();tryReconnect();requestAnimationFrame(frame);
})();

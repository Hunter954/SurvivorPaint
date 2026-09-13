(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;
  const ARENA_TOP = 171;
  const ARENA_BOTTOM = 240;
  ctx.imageSmoothingEnabled = false;

  const $ = id => document.getElementById(id);
  const ui = {
    shell: $('gameShell'),
    menu: $('menuOverlay'),
    play: $('playBtn'),
    pause: $('pauseOverlay'),
    pauseBtn: $('pauseBtn'),
    resume: $('resumeBtn'),
    restartPause: $('restartPauseBtn'),
    menuPause: $('menuPauseBtn'),
    result: $('resultOverlay'),
    resultEyebrow: $('resultEyebrow'),
    resultTitle: $('resultTitle'),
    resultStats: $('resultStats'),
    again: $('againBtn'),
    menuResult: $('menuResultBtn'),
    iosHelp: $('iosHelpBtn'),
    iosInstall: $('iosInstallOverlay'),
    iosInstallClose: $('iosInstallCloseBtn'),
    joystick: $('joystick'),
    stick: $('stick'),
    punch: $('punchBtn'),
    kick: $('kickBtn'),
    toast: $('toast'),
    fade: $('fadeLayer')
  };

  const nav = typeof navigator === 'undefined' ? {} : navigator;
  const IS_IOS = /iPad|iPhone|iPod/i.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
  const IS_STANDALONE = Boolean(nav.standalone) || Boolean(matchMedia('(display-mode: standalone)').matches);
  document.body?.classList.add(IS_IOS ? 'ios-device' : 'standard-device');
  if (IS_STANDALONE) document.body?.classList.add('standalone-mode');

  function updateViewportSize() {
    const viewport = window.visualViewport;
    const height = Math.round(viewport?.height || window.innerHeight || 270);
    const width = Math.round(viewport?.width || window.innerWidth || 480);
    document.documentElement.style?.setProperty('--app-height', `${height}px`);
    document.documentElement.style?.setProperty('--app-width', `${width}px`);
  }
  updateViewportSize();
  window.visualViewport?.addEventListener('resize', updateViewportSize);
  window.visualViewport?.addEventListener('scroll', updateViewportSize);
  window.addEventListener('resize', updateViewportSize);
  window.addEventListener('orientationchange', () => setTimeout(updateViewportSize, 120));

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6);
  const sign = v => (v < 0 ? -1 : 1);
  const pad = v => String(Math.floor(v)).padStart(2, '0');
  const formatTime = seconds => `${pad(seconds / 60)}:${pad(seconds % 60)}`;

  const STAGES = [
    {
      name: 'AVENIDA BRASIL', zone: 'CENTRO • FOZ DO IGUAÇU', kind: 'avenidaBrasil', plate: ['AV. BRASIL', 'CENTRO'], sky: ['#56bfe5', '#97d9eb', '#d9eff0'],
      stores: [
        { x: 0, w: 120, color: '#e5ebe5', trim: '#219b54', sign: 'FARMÁCIA', awning: '#f5f5ee' },
        { x: 120, w: 126, color: '#edd2a8', trim: '#bf712b', sign: 'CAFÉ BRASIL', awning: '#7d301f' },
        { x: 246, w: 118, color: '#d5e2eb', trim: '#246ca0', sign: 'BANCO', awning: '#e9edf1' },
        { x: 364, w: 116, color: '#efc1a4', trim: '#c64632', sign: 'LOJAS', awning: '#fff0d9' }
      ]
    },
    {
      name: 'RUA ALMIRANTE BARROSO', zone: 'CENTRO • FOZ DO IGUAÇU', kind: 'almirante', plate: ['R. ALMIRANTE', 'BARROSO'], sky: ['#f0a164', '#f7c78d', '#fbe1b4'],
      stores: [
        { x: 0, w: 132, color: '#d9d0e8', trim: '#684496', sign: 'GALERIA', awning: '#ece4f5' },
        { x: 132, w: 122, color: '#e8d3ba', trim: '#9f5736', sign: 'HOTEL FOZ', awning: '#5c3026' },
        { x: 254, w: 116, color: '#c7dfcf', trim: '#236d45', sign: 'LANCHES', awning: '#f0e2b6' },
        { x: 370, w: 110, color: '#d5dfef', trim: '#3c5d9b', sign: 'LOTÉRICA', awning: '#e3e9f5' }
      ]
    },
    {
      name: 'PRAÇA DA BÍBLIA', zone: 'FOZ DO IGUAÇU • PARANÁ', kind: 'bibleSquare', plate: ['PRAÇA DA', 'BÍBLIA'], sky: ['#5eadd0', '#9bd3e3', '#e2eef0'], plaza: true, stores: []
    },
    {
      name: 'AV. JORGE SCHIMMELPFENG', zone: 'CATEDRAL SÃO JOÃO BATISTA', kind: 'cathedral', plate: ['AV. JORGE', 'SCHIMMELPFENG'], sky: ['#4b7695', '#88abc0', '#d2d8d5'], stores: []
    },
    {
      name: 'PRAÇA DA PAZ', zone: 'CENTRO • FOZ DO IGUAÇU', kind: 'peaceSquare', plate: ['PRAÇA', 'DA PAZ'], sky: ['#283463', '#685687', '#e68d72'], plaza: true, final: true, stores: []
    }
  ];

  // Dez adversários adultos, fictícios e visualmente apresentados como lutadores.
  const FIGHTER_DEFS = [
    { name: 'FAIXA', skin: '#c9865b', shirt: '#ba2839', pants: '#273241', hair: '#251811', accessory: 'bandana', hp: 48, speed: 34, damage: 7 },
    { name: 'LUVAS', skin: '#8d5739', shirt: '#2782bf', pants: '#20293a', hair: '#141414', accessory: 'gloves', hp: 52, speed: 31, damage: 8 },
    { name: 'MOICANO', skin: '#e0a274', shirt: '#632f86', pants: '#202428', hair: '#d93346', accessory: 'mohawk', hp: 57, speed: 37, damage: 8 },
    { name: 'JAQUETA', skin: '#a96845', shirt: '#dd7b26', pants: '#293c57', hair: '#251b19', accessory: 'jacket', hp: 60, speed: 34, damage: 9 },
    { name: 'BONÉ', skin: '#efbd91', shirt: '#39865a', pants: '#343442', hair: '#473124', accessory: 'cap', hp: 64, speed: 39, damage: 9 },
    { name: 'CAPUZ', skin: '#75452f', shirt: '#4d5d73', pants: '#1f2630', hair: '#191919', accessory: 'hood', hp: 68, speed: 35, damage: 10 },
    { name: 'COLETE', skin: '#d49368', shirt: '#323b45', pants: '#42516b', hair: '#39271d', accessory: 'vest', hp: 75, speed: 32, damage: 11 },
    { name: 'ATLETA', skin: '#9b6041', shirt: '#e6b52e', pants: '#1c3654', hair: '#1b1512', accessory: 'headband', hp: 78, speed: 44, damage: 11 },
    { name: 'MÁSCARA', skin: '#d7a078', shirt: '#3e314f', pants: '#242333', hair: '#171317', accessory: 'mask', hp: 86, speed: 40, damage: 12 },
    { name: 'CAMPEÃO', skin: '#8c5437', shirt: '#8b2635', pants: '#151b25', hair: '#111111', accessory: 'champion', hp: 125, speed: 35, damage: 14, scale: 1.12 }
  ];

  const keys = new Set();
  const touchMove = { x: 0, y: 0, pointerId: null };
  let mode = 'menu';
  let stageIndex = 0;
  let player = null;
  let enemies = [];
  let particles = [];
  let floaters = [];
  let elapsed = 0;
  let knockouts = 0;
  let score = 0;
  let combo = 0;
  let comboTimer = 0;
  let shake = 0;
  let flash = 0;
  let stageBanner = 0;
  let stageClear = false;
  let stageClearAnnounced = false;
  let transition = null;
  let gameOverDelay = 0;
  let demoClock = 0;
  let lastFrame = performance.now();
  let toastTimer = 0;
  let audioContext = null;

  function makePlayer() {
    return {
      name: 'DARLON', x: 58, y: 211, hp: 100, maxHp: 100, speed: 78, facing: 1,
      state: 'idle', stateTime: 0, hitDone: false, invuln: 0, flash: 0, vx: 0, vy: 0
    };
  }

  function makeEnemy(defIndex, slot) {
    const def = FIGHTER_DEFS[defIndex];
    return {
      id: `${stageIndex}-${defIndex}`, defIndex, def,
      x: slot === 0 ? 300 : 407, y: slot === 0 ? 204 : 226,
      hp: def.hp, maxHp: def.hp, facing: -1,
      state: 'rest', stateTime: 0, hitDone: false, attackCooldown: .7 + slot * .25,
      invuln: 0, flash: 0, knockVx: 0, rise: 0, defeated: false
    };
  }

  function setState(actor, state) {
    if (actor.state === state) return;
    actor.state = state;
    actor.stateTime = 0;
    actor.hitDone = false;
  }

  function loadStage(index) {
    stageIndex = index;
    player.x = 54;
    player.y = 211;
    player.facing = 1;
    player.invuln = 1;
    setState(player, 'idle');
    enemies = [makeEnemy(index * 2, 0), makeEnemy(index * 2 + 1, 1)];
    particles = [];
    floaters = [];
    stageBanner = 2.35;
    stageClear = false;
    stageClearAnnounced = false;
    showToast(`${STAGES[index].name} · ${STAGES[index].zone}`, 1.7);
  }

  function resetRun() {
    player = makePlayer();
    elapsed = 0;
    knockouts = 0;
    score = 0;
    combo = 0;
    comboTimer = 0;
    shake = 0;
    flash = 0;
    transition = null;
    gameOverDelay = 0;
    ui.fade.style.opacity = '0';
    loadStage(0);
  }

  function showToast(message, duration = 1.2) {
    ui.toast.textContent = message;
    ui.toast.classList.add('visible');
    toastTimer = duration;
  }

  function hideOverlays() {
    ui.menu.classList.remove('visible');
    ui.pause.classList.remove('visible');
    ui.result.classList.remove('visible');
    ui.iosInstall.classList.remove('visible');
  }

  async function requestLandscape() {
    if (!matchMedia('(pointer: coarse)').matches) return false;
    const root = document.documentElement;
    document.body?.classList.add('pseudo-fullscreen');
    updateViewportSize();

    // O Safari do iPhone não expõe a Fullscreen API para páginas comuns.
    // Em modo instalado, as metas/manifest removem as barras; no Safari,
    // ocupamos todo o visualViewport e tentamos recolher a barra ao rolar 1px.
    if (IS_IOS) {
      const tuckBrowserChrome = () => {
        window.scrollTo?.(0, 1);
        updateViewportSize();
      };
      setTimeout(tuckBrowserChrome, 80);
      setTimeout(tuckBrowserChrome, 420);
      return IS_STANDALONE;
    }

    let enteredFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    try {
      if (!enteredFullscreen) {
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (request) {
          await request.call(root, { navigationUI: 'hide' });
          enteredFullscreen = true;
        }
      }
    } catch (_) { /* Alguns navegadores móveis não permitem fullscreen. */ }
    try {
      if (enteredFullscreen && screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (_) { /* O aviso de rotação continua como fallback. */ }
    updateViewportSize();
    return enteredFullscreen;
  }

  async function startGame() {
    resumeAudio();
    await requestLandscape();
    hideOverlays();
    ui.shell.classList.add('playing');
    mode = 'playing';
    resetRun();
    if (IS_IOS && !IS_STANDALONE) showToast('IPHONE: FULLSCREEN REAL PELO ÍCONE DA TELA DE INÍCIO', 3.8);
  }

  function backToMenu() {
    mode = 'menu';
    transition = null;
    ui.fade.style.opacity = '0';
    ui.shell.classList.remove('playing');
    hideOverlays();
    ui.menu.classList.add('visible');
    resetInput();
  }

  function pauseGame() {
    if (mode !== 'playing' || transition) return;
    mode = 'paused';
    resetInput();
    ui.pause.classList.add('visible');
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    mode = 'playing';
    ui.pause.classList.remove('visible');
    lastFrame = performance.now();
  }

  function finishGame(victory) {
    mode = victory ? 'victory' : 'over';
    resetInput();
    ui.fade.style.opacity = '0';
    const finalScore = Math.max(0, Math.round(score + knockouts * 100 + stageIndex * 250 + player.hp * 3));
    const best = Number(localStorage.getItem('missaoFozBest') || 0);
    if (finalScore > best) localStorage.setItem('missaoFozBest', String(finalScore));
    ui.resultEyebrow.textContent = victory ? 'MISSÃO CUMPRIDA' : 'FIM DE JOGO';
    ui.resultTitle.textContent = victory ? 'FOZ LIBERADA!' : 'TENTE DE NOVO';
    ui.resultStats.innerHTML = `
      <div><b>${knockouts}/10</b><span>LUTAS VENCIDAS</span></div>
      <div><b>${formatTime(elapsed)}</b><span>TEMPO</span></div>
      <div><b>${finalScore}</b><span>PONTOS</span></div>`;
    ui.result.classList.add('visible');
    ui.shell.classList.remove('playing');
    victory ? sfxVictory() : sfxLose();
  }

  function beginStageExit() {
    if (transition) return;
    transition = { phase: 'out', t: 0, next: stageIndex + 1 };
    resetInput();
    sfxDoor();
  }

  function updateTransition(dt) {
    if (!transition) return false;
    const duration = .42;
    transition.t += dt;
    if (transition.phase === 'out') {
      ui.fade.style.opacity = String(clamp(transition.t / duration, 0, 1));
      if (transition.t >= duration) {
        if (transition.next >= STAGES.length) {
          transition = null;
          finishGame(true);
          return true;
        }
        player.hp = Math.min(player.maxHp, player.hp + 12);
        loadStage(transition.next);
        transition.phase = 'in';
        transition.t = 0;
      }
    } else {
      ui.fade.style.opacity = String(1 - clamp(transition.t / duration, 0, 1));
      if (transition.t >= duration) {
        transition = null;
        ui.fade.style.opacity = '0';
      }
    }
    return true;
  }

  function currentMove() {
    let x = touchMove.x;
    let y = touchMove.y;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  function attackPlayer(kind) {
    if (mode !== 'playing' || transition || !player || player.state === 'hurt' || player.state === 'ko') return;
    if (player.state === 'punch' || player.state === 'kick') return;
    setState(player, kind);
    kind === 'punch' ? sfxWhoosh(150) : sfxWhoosh(95);
  }

  function wakeEnemy(enemy) {
    if (enemy.state !== 'rest') return;
    setState(enemy, 'stand');
    enemy.rise = 0;
    addFloater(enemy.x, enemy.y - 32, '!', '#ffd800', 1.1);
    sfxAlert();
  }

  function performPlayerHit(kind) {
    const range = kind === 'kick' ? 43 : 34;
    const damage = kind === 'kick' ? 22 : 14;
    const verticalRange = kind === 'kick' ? 18 : 15;
    let candidates = enemies
      .filter(enemy => !enemy.defeated && Math.abs(enemy.x - player.x) <= range && Math.abs(enemy.y - player.y) <= verticalRange)
      .filter(enemy => (enemy.x - player.x) * player.facing >= -5)
      .sort((a, b) => distance(player, a) - distance(player, b));

    const resting = candidates.filter(enemy => enemy.state === 'rest' || enemy.state === 'stand');
    resting.forEach(wakeEnemy);
    candidates = candidates.filter(enemy => !['rest', 'stand', 'ko'].includes(enemy.state));
    const maxTargets = kind === 'kick' ? 2 : 1;
    candidates.slice(0, maxTargets).forEach((enemy, index) => {
      if (enemy.invuln > 0) return;
      enemy.hp = Math.max(0, enemy.hp - damage);
      enemy.invuln = .1;
      enemy.flash = .12;
      enemy.knockVx = player.facing * (kind === 'kick' ? 72 : 44);
      combo += 1;
      comboTimer = 1.45;
      score += damage * (1 + Math.min(combo, 12) * .08);
      hitBurst(enemy.x + player.facing * 4, enemy.y - 24, kind === 'kick' ? '#ff7a36' : '#ffe04b', kind === 'kick' ? 10 : 7);
      addFloater(enemy.x, enemy.y - 40 - index * 7, kind === 'kick' ? 'POW!' : 'PÁ!', '#ffffff', .62);
      shake = Math.max(shake, kind === 'kick' ? 4 : 2.4);
      sfxHit(kind === 'kick');
      if (enemy.hp <= 0) knockOutEnemy(enemy);
      else setState(enemy, 'hurt');
    });
  }

  function knockOutEnemy(enemy) {
    enemy.defeated = true;
    setState(enemy, 'ko');
    enemy.knockVx = player.facing * 86;
    knockouts += 1;
    score += 75;
    addFloater(enemy.x, enemy.y - 44, 'NOCAUTE!', '#ffd800', 1.05);
    hitBurst(enemy.x, enemy.y - 22, '#ffd800', 16);
    shake = 5;
    sfxKnockout();
  }

  function damagePlayer(amount, enemy) {
    if (player.invuln > 0 || player.state === 'ko') return;
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = .65;
    player.flash = .16;
    player.vx = sign(player.x - enemy.x) * 58;
    combo = 0;
    comboTimer = 0;
    hitBurst(player.x, player.y - 24, '#ef334c', 9);
    addFloater(player.x, player.y - 42, `-${amount}`, '#ffb0b8', .7);
    shake = 4;
    flash = .12;
    sfxHurt();
    if (player.hp <= 0) {
      setState(player, 'ko');
      gameOverDelay = .85;
    } else {
      setState(player, 'hurt');
    }
  }

  function updatePlayer(dt) {
    player.stateTime += dt;
    player.invuln = Math.max(0, player.invuln - dt);
    player.flash = Math.max(0, player.flash - dt);

    if (player.state === 'ko') return;
    if (player.state === 'hurt') {
      player.x += player.vx * dt;
      player.vx *= Math.pow(.02, dt);
      if (player.stateTime > .34) setState(player, 'idle');
      return;
    }

    const attackDef = player.state === 'punch'
      ? { hitAt: .12, duration: .34 }
      : player.state === 'kick'
        ? { hitAt: .19, duration: .52 }
        : null;

    if (attackDef) {
      if (!player.hitDone && player.stateTime >= attackDef.hitAt) {
        player.hitDone = true;
        performPlayerHit(player.state);
      }
      if (player.stateTime >= attackDef.duration) setState(player, 'idle');
    }

    const movement = currentMove();
    const attacking = player.state === 'punch' || player.state === 'kick';
    const speedScale = attacking ? .22 : 1;
    player.x += movement.x * player.speed * speedScale * dt;
    player.y += movement.y * player.speed * .62 * speedScale * dt;
    player.x = clamp(player.x, 18, stageClear ? 467 : 462);
    player.y = clamp(player.y, ARENA_TOP + 18, ARENA_BOTTOM);
    if (Math.abs(movement.x) > .08) player.facing = movement.x < 0 ? -1 : 1;
    if (!attacking) setState(player, Math.hypot(movement.x, movement.y) > .08 ? 'walk' : 'idle');

    if (stageClear && player.x > 453) beginStageExit();
  }

  function updateEnemy(enemy, dt) {
    enemy.stateTime += dt;
    enemy.invuln = Math.max(0, enemy.invuln - dt);
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    if (enemy.state === 'ko') {
      enemy.x += enemy.knockVx * dt;
      enemy.knockVx *= Math.pow(.015, dt);
      enemy.x = clamp(enemy.x, 18, 464);
      return;
    }
    if (enemy.state === 'rest') {
      if (distance(player, enemy) < 92 || enemies.some(other => other !== enemy && ['chase', 'attack', 'hurt'].includes(other.state) && distance(other, enemy) < 88)) wakeEnemy(enemy);
      return;
    }
    if (enemy.state === 'stand') {
      enemy.rise = clamp(enemy.stateTime / .56, 0, 1);
      if (enemy.stateTime >= .56) setState(enemy, 'chase');
      return;
    }
    if (enemy.state === 'hurt') {
      enemy.x += enemy.knockVx * dt;
      enemy.knockVx *= Math.pow(.01, dt);
      enemy.x = clamp(enemy.x, 18, 462);
      if (enemy.stateTime >= .29) setState(enemy, 'chase');
      return;
    }
    if (enemy.state === 'attack') {
      if (!enemy.hitDone && enemy.stateTime >= .2) {
        enemy.hitDone = true;
        if (Math.abs(player.x - enemy.x) < 30 && Math.abs(player.y - enemy.y) < 14) damagePlayer(enemy.def.damage, enemy);
      }
      if (enemy.stateTime >= .5) {
        enemy.attackCooldown = .65 + Math.random() * .5;
        setState(enemy, 'chase');
      }
      return;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy * 1.7) || 1;
    enemy.facing = dx < 0 ? -1 : 1;
    if (d < 31 && Math.abs(dy) < 14 && enemy.attackCooldown <= 0) {
      setState(enemy, 'attack');
      sfxWhoosh(80);
      return;
    }
    const speed = enemy.def.speed;
    if (d > 24) {
      enemy.x += (dx / d) * speed * dt;
      enemy.y += (dy * 1.7 / d) * speed * .55 * dt;
      enemy.x = clamp(enemy.x, 19, 461);
      enemy.y = clamp(enemy.y, ARENA_TOP + 18, ARENA_BOTTOM);
    }
  }

  function separateFighters() {
    const active = [player, ...enemies.filter(enemy => !enemy.defeated && enemy.state !== 'rest')];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        const dx = b.x - a.x;
        const dy = (b.y - a.y) * 1.4;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 16) {
          const push = (16 - d) * .16;
          a.x -= (dx / d) * push;
          b.x += (dx / d) * push;
          a.y -= (dy / d) * push * .25;
          b.y += (dy / d) * push * .25;
        }
      }
    }
  }

  function updateEffects(dt) {
    particles.forEach(particle => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= Math.pow(.12, dt);
    });
    particles = particles.filter(particle => particle.life > 0);
    floaters.forEach(floater => {
      floater.life -= dt;
      floater.y -= 15 * dt;
    });
    floaters = floaters.filter(floater => floater.life > 0);
  }

  function update(dt) {
    demoClock += dt;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) ui.toast.classList.remove('visible');
    }
    if (mode !== 'playing') return;
    elapsed += dt;
    shake = Math.max(0, shake - dt * 18);
    flash = Math.max(0, flash - dt);
    stageBanner = Math.max(0, stageBanner - dt);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (updateTransition(dt)) {
      updateEffects(dt);
      return;
    }
    if (gameOverDelay > 0) {
      gameOverDelay -= dt;
      updateEffects(dt);
      if (gameOverDelay <= 0) finishGame(false);
      return;
    }
    updatePlayer(dt);
    enemies.forEach(enemy => updateEnemy(enemy, dt));
    separateFighters();
    updateEffects(dt);

    if (!stageClear && enemies.every(enemy => enemy.defeated)) {
      stageClear = true;
      if (!stageClearAnnounced) {
        stageClearAnnounced = true;
        showToast(stageIndex === STAGES.length - 1 ? 'SIGA ATÉ O FINAL!' : 'CAMINHO LIVRE →', 1.7);
        sfxClear();
      }
    }
  }

  function addFloater(x, y, text, color, life) {
    floaters.push({ x, y, text, color, life, maxLife: life });
  }

  function hitBurst(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 18 + Math.random() * 46;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        gravity: 65, life: .25 + Math.random() * .3, maxLife: .55,
        color: i % 3 === 0 ? '#ffffff' : color, size: 1 + Math.floor(Math.random() * 3)
      });
    }
  }

  function dustBurst(x, y) {
    for (let i = 0; i < 5; i++) {
      particles.push({ x: x + (Math.random() - .5) * 10, y, vx: (Math.random() - .5) * 18, vy: -8 - Math.random() * 10, gravity: 24, life: .25, maxLife: .25, color: '#a8a095', size: 2 });
    }
  }

  function box(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function outlinedBox(x, y, width, height, color, outline = '#101218') {
    box(x - 1, y - 1, width + 2, height + 2, outline);
    box(x, y, width, height, color);
  }

  function text(value, x, y, size, color = '#ffffff', align = 'left') {
    ctx.save();
    ctx.font = `900 ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#07090d';
    ctx.fillText(value, Math.round(x + 1), Math.round(y + 1));
    ctx.fillStyle = color;
    ctx.fillText(value, Math.round(x), Math.round(y));
    ctx.restore();
  }

  function drawCloud(x, y, color) {
    box(x, y, 28, 4, color); box(x + 5, y - 4, 18, 4, color); box(x + 10, y - 7, 9, 3, color);
  }

  function drawPalm(x, baseY, scale = 1) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(baseY)); ctx.scale(scale, scale);
    box(-2, -47, 5, 47, '#503a28');
    box(-1, -47, 3, 47, '#8a6640');
    box(-21, -52, 22, 4, '#174f39'); box(0, -52, 23, 4, '#174f39');
    box(-17, -58, 18, 4, '#21734c'); box(0, -58, 17, 4, '#21734c');
    box(-8, -64, 7, 13, '#2a8a55'); box(1, -64, 7, 13, '#2a8a55');
    box(-21, -49, 8, 3, '#2a8a55'); box(14, -49, 9, 3, '#2a8a55');
    ctx.restore();
  }

  function drawTree(x, baseY, scale = 1, dark = false) {
    const trunk = dark ? '#523a2b' : '#68472f';
    const leafA = dark ? '#194735' : '#216a43';
    const leafB = dark ? '#236046' : '#2f8a50';
    ctx.save(); ctx.translate(Math.round(x), Math.round(baseY)); ctx.scale(scale, scale);
    box(-3, -35, 7, 35, trunk);
    box(-2, -35, 3, 35, '#916342');
    box(-18, -47, 36, 18, leafA);
    box(-13, -55, 27, 11, leafB);
    box(-23, -42, 14, 11, leafB);
    box(10, -44, 14, 12, leafB);
    box(-8, -59, 17, 8, leafA);
    ctx.restore();
  }

  function drawLamp(x, baseY, double = false) {
    box(x - 1, baseY - 49, 3, 49, '#303842');
    box(x - 4, baseY - 52, 9, 4, '#1b232c');
    box(x - 3, baseY - 51, 7, 3, '#ffe78a');
    if (double) {
      box(x - 14, baseY - 47, 14, 3, '#303842');
      box(x + 2, baseY - 47, 14, 3, '#303842');
      box(x - 17, baseY - 50, 8, 4, '#1b232c');
      box(x + 11, baseY - 50, 8, 4, '#1b232c');
      box(x - 16, baseY - 49, 6, 2, '#ffe78a');
      box(x + 12, baseY - 49, 6, 2, '#ffe78a');
    }
  }

  function drawStreetPlate(stage, x = 392, y = 127) {
    const width = 80;
    outlinedBox(x, y, width, 22, '#176387');
    box(x + 3, y + 3, width - 6, 2, '#56b4ce');
    text(stage.plate[0], x + width / 2, y + 10, stage.plate[0].length > 12 ? 5 : 6, '#ffffff', 'center');
    text(stage.plate[1], x + width / 2, y + 18, 6, '#ffffff', 'center');
    box(x + 38, y + 22, 4, 15, '#343d48');
  }

  function drawTrafficLight(x, baseY) {
    box(x, baseY - 60, 4, 60, '#323b45');
    box(x - 1, baseY - 61, 32, 4, '#323b45');
    outlinedBox(x + 24, baseY - 65, 11, 25, '#151a21');
    box(x + 27, baseY - 61, 5, 5, '#e53a45');
    box(x + 27, baseY - 54, 5, 5, '#e8b92f');
    box(x + 27, baseY - 47, 5, 5, '#35b767');
  }

  function drawCar(x, baseY, color = '#e7b62c') {
    outlinedBox(x, baseY - 15, 56, 13, color);
    outlinedBox(x + 11, baseY - 25, 31, 11, color);
    box(x + 14, baseY - 23, 12, 8, '#8fc2d4');
    box(x + 28, baseY - 23, 11, 8, '#6c9eb2');
    box(x + 3, baseY - 11, 7, 3, '#f4e0a0');
    box(x + 48, baseY - 11, 6, 3, '#d23b3b');
    outlinedBox(x + 8, baseY - 5, 10, 8, '#1a1f26');
    outlinedBox(x + 39, baseY - 5, 10, 8, '#1a1f26');
  }

  function drawCityBus(x, baseY) {
    outlinedBox(x, baseY - 38, 91, 34, '#e8e4d9');
    box(x + 2, baseY - 36, 87, 9, '#267b59');
    box(x + 3, baseY - 25, 13, 15, '#78adbf');
    for (let i = 0; i < 4; i++) box(x + 20 + i * 15, baseY - 25, 12, 12, i % 2 ? '#6798ad' : '#8ec0ce');
    box(x + 80, baseY - 25, 7, 20, '#3f7180');
    box(x + 34, baseY - 34, 27, 5, '#173b2c');
    text('FOZ', x + 47, baseY - 30, 5, '#ffffff', 'center');
    outlinedBox(x + 12, baseY - 8, 11, 9, '#1a1f26');
    outlinedBox(x + 68, baseY - 8, 11, 9, '#1a1f26');
  }

  function drawStore(store, index) {
    const x = store.x;
    const y = 58 + (index % 2) * 4;
    const height = 101 - (index % 2) * 4;
    box(x, y, store.w, height, '#202936');
    box(x + 2, y + 2, store.w - 4, height - 4, store.color);
    box(x, y, store.w, 8, store.trim);
    box(x + 4, y + 21, store.w - 8, 16, '#121721');
    box(x + 6, y + 23, store.w - 12, 12, store.trim);
    const fontSize = store.sign.length > 10 ? 7 : 8;
    text(store.sign, x + store.w / 2, y + 32, fontSize, '#ffffff', 'center');
    const windows = Math.max(2, Math.floor(store.w / 42));
    const gap = (store.w - 13) / windows;
    for (let i = 0; i < windows; i++) {
      const wx = x + 7 + i * gap;
      box(wx - 1, y + 45, 28, 40, '#18212b');
      box(wx + 1, y + 47, 24, 36, '#75acc1');
      box(wx + 3, y + 49, 9, 16, '#a7d5df');
      box(wx + 14, y + 49, 8, 8, '#d3edf0');
      box(wx + 12, y + 47, 2, 36, '#263a47');
    }
    box(x, y + 87, store.w, 5, store.awning || store.trim);
    for (let stripe = x + 4; stripe < x + store.w - 3; stripe += 14) box(stripe, y + 87, 7, 5, 'rgba(255,255,255,.28)');
    for (let bx = x + 6; bx < x + store.w - 4; bx += 19) box(bx, y + 9, 10, 2, 'rgba(0,0,0,.12)');
  }

  function drawBench(x, y) {
    outlinedBox(x, y, 42, 5, '#7c4c2a');
    outlinedBox(x + 3, y + 8, 36, 4, '#996039');
    box(x + 5, y + 12, 3, 9, '#28313a'); box(x + 34, y + 12, 3, 9, '#28313a');
  }

  function drawSkyline(stage, clock) {
    const bands = stage.sky;
    box(0, 0, W, 62, bands[0]);
    box(0, 38, W, 42, bands[1]);
    box(0, 72, W, 55, bands[2]);
    const sunset = stage.kind === 'peaceSquare';
    const sunX = sunset ? 392 : 421;
    const sunY = sunset ? 49 : 27;
    box(sunX - 8, sunY - 8, 16, 16, sunset ? '#ffb057' : '#ffe36b');
    box(sunX - 11, sunY - 4, 22, 8, sunset ? '#ffb057' : '#ffe36b');
    drawCloud((clock * 3 + 35) % 530 - 30, 28, 'rgba(255,255,255,.72)');
    drawCloud((clock * 2 + 280) % 560 - 35, 44, 'rgba(255,255,255,.52)');
    for (let x = 0; x < W; x += 31) {
      const height = 17 + ((x * 7 + stageIndex * 11) % 27);
      box(x, 61 - height, 27, height + 41, sunset ? '#3c3a59' : '#7893a1');
      for (let yy = 67 - height; yy < 84; yy += 8) {
        for (let xx = x + 4; xx < x + 24; xx += 8) box(xx, yy, 3, 4, sunset ? '#efb05d' : '#bfd5d9');
      }
    }
  }

  function drawStreetSurface(clock, plaza = false) {
    if (plaza) {
      box(0, 148, W, 122, '#c8c0b3');
      box(0, 148, W, 5, '#e7e0d4');
      for (let y = 157; y < H; y += 13) {
        box(0, y, W, 1, '#a79f94');
        const offset = ((y / 13) % 2) * 17;
        for (let x = offset; x < W; x += 34) box(x, y - 12, 1, 12, '#b1a99e');
      }
      for (let x = 0; x < W; x += 68) box(x, 250, 34, 3, '#ddd5c8');
      return;
    }

    box(0, 156, W, 44, '#c7c1b5');
    box(0, 157, W, 3, '#f0ece3');
    for (let x = -10; x < W; x += 24) {
      box(x, 163, 12, 3, '#ded8cc');
      box(x + 12, 166, 12, 3, '#a8a39b');
      box(x, 169, 12, 3, '#a8a39b');
      box(x + 12, 172, 12, 3, '#ded8cc');
    }
    box(0, 195, W, 7, '#e4d3b9');
    box(0, 199, W, 71, '#4b5159');
    box(0, 203, W, 2, '#252a31');
    for (let x = ((-clock * 8) % 80) - 20; x < W; x += 80) box(x, 252, 38, 3, '#d9c45c');
    for (let x = 0; x < W; x += 32) box(x, 235 + ((x / 32) % 2) * 5, 14, 1, '#555c65');
  }

  function drawBibleMonument(cx, baseY) {
    // Monumento em livro aberto para deixar a Praça da Bíblia inequívoca.
    outlinedBox(cx - 45, baseY - 15, 90, 15, '#b9b4aa');
    outlinedBox(cx - 37, baseY - 24, 74, 10, '#ddd8cd');
    box(cx - 4, baseY - 59, 8, 37, '#a9a39a');
    box(cx - 41, baseY - 58, 37, 30, '#171a20');
    box(cx + 4, baseY - 58, 37, 30, '#171a20');
    box(cx - 38, baseY - 55, 34, 24, '#f3eee2');
    box(cx + 4, baseY - 55, 34, 24, '#f3eee2');
    box(cx - 34, baseY - 51, 27, 2, '#b5afa5');
    box(cx - 31, baseY - 46, 24, 2, '#c6c0b6');
    box(cx + 8, baseY - 51, 27, 2, '#b5afa5');
    box(cx + 8, baseY - 46, 24, 2, '#c6c0b6');
    box(cx - 4, baseY - 57, 8, 28, '#d5b23a');
    text('BÍBLIA', cx, baseY - 17, 7, '#3a342b', 'center');
  }

  function drawCathedral() {
    // Silhueta inspirada na Catedral São João Batista: torre, cruz e telhados vermelhos.
    box(119, 103, 243, 56, '#d7c6aa');
    box(124, 108, 233, 51, '#eee1c9');
    box(197, 69, 60, 90, '#d9c6a7');
    box(202, 74, 50, 85, '#f0dfc2');
    box(218, 42, 20, 33, '#c47b4f');
    box(222, 38, 12, 8, '#d69462');
    box(227, 29, 2, 12, '#f2e6cc');
    box(223, 33, 10, 2, '#f2e6cc');
    box(215, 84, 23, 25, '#5b4437');
    box(219, 88, 15, 17, '#89a5af');
    box(125, 94, 78, 13, '#9b4e35');
    box(253, 94, 104, 13, '#9b4e35');
    box(137, 88, 52, 9, '#bd6846');
    box(269, 88, 75, 9, '#bd6846');
    for (const x of [144, 174, 273, 309, 338]) {
      outlinedBox(x, 119, 15, 29, '#6e4f40');
      box(x + 3, 122, 9, 22, '#779aa7');
    }
    outlinedBox(216, 119, 22, 40, '#6a4631');
    text('SÃO JOÃO BATISTA', 282, 155, 6, '#4a3428', 'center');
  }

  function drawPeaceMonument(cx, baseY) {
    outlinedBox(cx - 47, baseY - 13, 94, 13, '#d8d6cf');
    outlinedBox(cx - 34, baseY - 22, 68, 10, '#f0eee7');
    box(cx - 9, baseY - 75, 18, 54, '#d7d7d3');
    box(cx - 6, baseY - 77, 12, 55, '#f3f2ec');
    box(cx - 4, baseY - 81, 8, 7, '#d7bd52');
    box(cx - 7, baseY - 86, 14, 7, '#2d7fa8');
    box(cx - 4, baseY - 89, 8, 4, '#4ba3c8');
    text('PAZ', cx, baseY - 15, 7, '#3e4650', 'center');
  }

  function drawFozLetters(x, y) {
    const letters = [['F','#e8ba2b'],['O','#df533e'],['Z','#3b9d66'],['D','#478cc4'],['O','#e8ba2b'],['I','#df533e'],['G','#3b9d66'],['U','#478cc4'],['A','#e8ba2b'],['Ç','#df533e'],['U','#3b9d66']];
    letters.forEach(([letter, color], index) => text(letter, x + index * 10, y, 10, color, 'center'));
  }

  function drawStage(stage, clock = elapsed) {
    drawSkyline(stage, clock);

    if (stage.kind === 'avenidaBrasil') {
      stage.stores.forEach(drawStore);
      drawStreetSurface(clock, false);
      drawPalm(25, 196, .68);
      drawTrafficLight(321, 196);
      drawCar(244, 195, '#e5b72b');
      drawStreetPlate(stage, 392, 126);
      box(87, 181, 3, 17, '#303842'); box(81, 178, 15, 4, '#222932'); box(83, 176, 11, 2, '#f1cc35');
    } else if (stage.kind === 'almirante') {
      stage.stores.forEach(drawStore);
      drawStreetSurface(clock, false);
      drawCityBus(273, 198);
      drawStreetPlate(stage, 391, 121);
      drawTrafficLight(37, 196);
      // Faixa de pedestres típica de cruzamento central.
      for (let x = 4; x < 132; x += 19) box(x, 207, 12, 47, '#d8d9d5');
      outlinedBox(167, 169, 34, 12, '#1e6e8d');
      text('PONTO', 184, 178, 6, '#ffffff', 'center');
      box(182, 181, 4, 17, '#343d48');
    } else if (stage.kind === 'bibleSquare') {
      drawStreetSurface(clock, true);
      box(0, 132, W, 19, '#3d8a51');
      box(0, 143, W, 8, '#65a95f');
      drawTree(54, 165, .95);
      drawTree(425, 165, .95);
      drawTree(116, 161, .7);
      drawTree(364, 161, .7);
      drawBibleMonument(240, 160);
      drawBench(117, 172);
      drawBench(321, 172);
      drawLamp(178, 173, true);
      drawLamp(301, 173, true);
      drawStreetPlate(stage, 389, 118);
      box(23, 225, 70, 10, '#3c824c'); box(28, 220, 60, 6, '#59a35e');
      box(386, 232, 72, 10, '#3c824c'); box(391, 227, 62, 6, '#59a35e');
    } else if (stage.kind === 'cathedral') {
      drawCathedral();
      drawStreetSurface(clock, false);
      drawTree(73, 194, .78, true);
      drawTree(402, 194, .78, true);
      drawLamp(101, 195);
      drawLamp(379, 195);
      drawStreetPlate(stage, 390, 120);
      drawCar(28, 196, '#b9c1c9');
      for (let x = 207; x < 280; x += 14) box(x, 208, 8, 45, '#d8d9d5');
    } else {
      drawStreetSurface(clock, true);
      box(0, 133, W, 18, '#285e42');
      box(0, 144, W, 7, '#437f4d');
      drawTree(50, 169, .92, true);
      drawTree(430, 169, .92, true);
      drawPalm(115, 171, .66);
      drawPalm(365, 171, .66);
      drawPeaceMonument(240, 163);
      drawFozLetters(190, 158);
      drawBench(96, 179);
      drawBench(342, 179);
      drawLamp(157, 181, true);
      drawLamp(323, 181, true);
      drawStreetPlate(stage, 390, 119);
      box(17, 223, 82, 12, '#276943'); box(24, 218, 68, 7, '#3f9857');
      box(381, 233, 82, 12, '#276943'); box(388, 228, 68, 7, '#3f9857');
    }
  }

  function actorPalette(actor, isPlayer) {
    if (isPlayer) return { skin: '#c68658', shirt: '#11151c', pants: '#11151c', hair: '#211810', accent: '#ffd800' };
    return { skin: actor.def.skin, shirt: actor.def.shirt, pants: actor.def.pants, hair: actor.def.hair, accent: '#f1f2f4' };
  }

  function drawShadow(actor, width = 22) {
    const alpha = actor.state === 'ko' ? .18 : .28;
    ctx.globalAlpha = alpha;
    box(actor.x - width / 2, actor.y - 3, width, 5, '#07090d');
    ctx.globalAlpha = 1;
  }

  function drawRestingFighter(enemy) {
    const p = actorPalette(enemy, false);
    drawShadow(enemy, 29);
    ctx.save();
    ctx.translate(Math.round(enemy.x), Math.round(enemy.y));
    ctx.scale(enemy.facing, 1);
    // Posição sentada de espera, com luvas erguidas: adversário, não civil indefeso.
    outlinedBox(-5, -21, 11, 11, p.shirt);
    outlinedBox(-4, -31, 9, 9, p.skin);
    box(-5, -33, 11, 4, p.hair);
    outlinedBox(4, -19, 6, 6, p.skin);
    outlinedBox(-10, -18, 6, 6, p.skin);
    outlinedBox(-3, -10, 13, 6, p.pants);
    outlinedBox(7, -6, 13, 5, p.pants);
    box(18, -5, 5, 5, '#171b21');
    drawAccessory(enemy, p, -4, -31);
    ctx.restore();
    text('...', enemy.x, enemy.y - 38 + Math.sin(demoClock * 3) * 2, 7, '#ffffff', 'center');
  }

  function drawAccessory(actor, palette, headX, headY) {
    if (!actor.def) return;
    const type = actor.def.accessory;
    if (type === 'bandana' || type === 'headband') {
      box(headX - 1, headY + 2, 11, 2, type === 'bandana' ? '#ffdb36' : '#f1f1f1');
      if (type === 'bandana') box(headX + 9, headY + 3, 4, 2, '#ffdb36');
    } else if (type === 'mohawk') {
      box(headX + 3, headY - 5, 4, 6, actor.def.hair);
      box(headX + 1, headY - 3, 8, 3, actor.def.hair);
    } else if (type === 'cap') {
      box(headX - 1, headY - 2, 11, 4, '#173f2a'); box(headX + 8, headY + 1, 5, 2, '#173f2a');
    } else if (type === 'hood') {
      box(headX - 2, headY - 2, 13, 3, actor.def.shirt); box(headX - 2, headY, 3, 9, actor.def.shirt); box(headX + 8, headY, 3, 9, actor.def.shirt);
    } else if (type === 'mask') {
      box(headX, headY + 5, 9, 4, '#22232b'); box(headX + 2, headY + 5, 2, 1, '#f0f0f0'); box(headX + 6, headY + 5, 2, 1, '#f0f0f0');
    } else if (type === 'champion') {
      box(headX - 1, headY - 1, 11, 3, '#d5b128'); box(headX + 1, headY - 4, 2, 3, '#d5b128'); box(headX + 5, headY - 5, 2, 4, '#d5b128'); box(headX + 9, headY - 4, 2, 3, '#d5b128');
    }
  }

  function drawStandingFighter(actor, isPlayer) {
    const p = actorPalette(actor, isPlayer);
    const walk = actor.state === 'walk' || actor.state === 'chase';
    const frame = Math.floor(actor.stateTime * 9) % 4;
    const step = walk ? (frame < 2 ? -2 : 2) : 0;
    const bob = walk ? (frame % 2) : 0;
    const punch = actor.state === 'punch' || (!isPlayer && actor.state === 'attack');
    const kick = actor.state === 'kick';
    const hurt = actor.state === 'hurt';
    const scale = actor.def && actor.def.scale ? actor.def.scale : 1;
    drawShadow(actor, 22 * scale);

    ctx.save();
    ctx.translate(Math.round(actor.x), Math.round(actor.y - bob));
    ctx.scale(actor.facing * scale, scale);
    if (hurt) ctx.rotate(-actor.facing * .08);
    if (actor.state === 'stand') {
      const rise = clamp(actor.rise, 0, 1);
      ctx.translate(0, (1 - rise) * 10);
      ctx.scale(1, .72 + rise * .28);
    }
    if (actor.flash > 0 && Math.floor(actor.flash * 60) % 2 === 0) ctx.globalAlpha = .45;

    // Perna de trás.
    if (!kick) {
      outlinedBox(-6 - step, -13, 6, 13, p.pants);
      outlinedBox(-8 - step, -2, 9, 4, '#14171c');
    } else {
      outlinedBox(-6, -13, 6, 13, p.pants);
      outlinedBox(-8, -2, 9, 4, '#14171c');
    }

    // Braço de trás.
    outlinedBox(-9, -27, 6, 14, isPlayer ? '#11151c' : p.shirt);
    outlinedBox(-9, -16, 6, 6, p.skin);

    // Tronco e roupa.
    outlinedBox(-6, -29, 13, 17, p.shirt);
    if (isPlayer) {
      box(-2, -28, 5, 12, '#f5f4ef');
      box(0, -27, 2, 10, p.accent);
      box(-5, -28, 3, 14, '#171c24'); box(3, -28, 3, 14, '#171c24');
      box(-6, -13, 13, 2, '#090c12');
    } else if (actor.def.accessory === 'jacket' || actor.def.accessory === 'vest') {
      box(-1, -28, 2, 15, '#d8d9d8');
      box(-5, -28, 3, 14, actor.def.accessory === 'vest' ? '#161a20' : '#7b3f21');
      box(3, -28, 3, 14, actor.def.accessory === 'vest' ? '#161a20' : '#7b3f21');
    }

    // Perna da frente e chute.
    if (kick && actor.stateTime > .11 && actor.stateTime < .36) {
      outlinedBox(2, -13, 8, 6, p.pants);
      outlinedBox(8, -13, 13, 6, p.pants);
      outlinedBox(19, -14, 7, 7, '#14171c');
    } else {
      outlinedBox(2 + step, -13, 6, 13, p.pants);
      outlinedBox(1 + step, -2, 9, 4, '#14171c');
    }

    // Cabeça, cabelo e rosto.
    outlinedBox(-5, -39, 11, 11, p.skin);
    box(-6, -41, 12, 4, p.hair);
    box(-6, -39, 3, 5, p.hair);
    box(4, -38, 3, 3, p.skin);
    if (isPlayer) {
      box(-5, -36, 5, 3, '#11151c'); box(1, -36, 5, 3, '#11151c'); box(0, -35, 2, 1, '#11151c');
      box(-3, -35, 2, 1, '#b8d7e8'); box(3, -35, 2, 1, '#b8d7e8');
      box(-2, -30, 7, 2, '#39251c');
    } else {
      box(2, -35, 2, 1, '#151515');
      drawAccessory(actor, p, -5, -39);
    }

    // Braço da frente: guarda, soco ou ataque.
    if (punch && actor.stateTime > .08 && actor.stateTime < .3) {
      outlinedBox(5, -27, 11, 6, isPlayer ? '#11151c' : p.shirt);
      outlinedBox(15, -27, 8, 6, p.skin);
      if (!isPlayer && (actor.def.accessory === 'gloves' || actor.def.accessory === 'champion')) box(18, -27, 6, 6, actor.def.accessory === 'gloves' ? '#296ac1' : '#d62f42');
    } else {
      outlinedBox(5, -27, 6, 13, isPlayer ? '#11151c' : p.shirt);
      outlinedBox(5, -17, 6, 7, p.skin);
      if (!isPlayer && actor.def.accessory === 'gloves') box(5, -16, 6, 6, '#296ac1');
    }

    ctx.restore();
  }

  function drawKnockedOut(actor, isPlayer) {
    const p = actorPalette(actor, isPlayer);
    drawShadow(actor, 34);
    ctx.save();
    ctx.translate(Math.round(actor.x), Math.round(actor.y));
    ctx.scale(actor.facing, 1);
    outlinedBox(-18, -9, 20, 8, p.shirt);
    outlinedBox(-24, -8, 9, 8, p.skin);
    box(-25, -10, 10, 3, p.hair);
    outlinedBox(1, -8, 15, 6, p.pants);
    outlinedBox(14, -7, 8, 5, '#14171c');
    outlinedBox(-8, -4, 10, 5, p.skin);
    if (isPlayer) box(-21, -5, 5, 2, '#11151c');
    ctx.restore();
    if (!isPlayer) {
      const orbit = demoClock * 4;
      for (let i = 0; i < 3; i++) {
        const a = orbit + i * 2.094;
        text('★', actor.x + Math.cos(a) * 10, actor.y - 22 + Math.sin(a) * 3, 6, '#ffd800', 'center');
      }
    }
  }

  function drawActor(actor, isPlayer = false) {
    if (actor.state === 'rest') drawRestingFighter(actor);
    else if (actor.state === 'ko') drawKnockedOut(actor, isPlayer);
    else drawStandingFighter(actor, isPlayer);

    if (!isPlayer && !actor.defeated && !['rest', 'stand'].includes(actor.state)) {
      const width = 28;
      box(actor.x - width / 2 - 1, actor.y - 50, width + 2, 5, '#080a0f');
      box(actor.x - width / 2, actor.y - 49, width * (actor.hp / actor.maxHp), 3, actor.hp / actor.maxHp < .35 ? '#ef334c' : '#ffd800');
      text(actor.def.name, actor.x, actor.y - 53, 5, '#ffffff', 'center');
    }
  }

  function drawEffects() {
    particles.forEach(particle => {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      box(particle.x, particle.y, particle.size, particle.size, particle.color);
    });
    ctx.globalAlpha = 1;
    floaters.forEach(floater => {
      ctx.globalAlpha = clamp(floater.life / floater.maxLife, 0, 1);
      text(floater.text, floater.x, floater.y, floater.text.length > 5 ? 7 : 9, floater.color, 'center');
    });
    ctx.globalAlpha = 1;
  }

  function drawExit() {
    if (!stageClear) return;
    const pulse = Math.floor(demoClock * 5) % 2;
    const x = 456 + pulse * 2;
    box(x, 179, 17, 42, 'rgba(255,216,0,.2)');
    text('→', x + 6, 201, 20, '#ffd800', 'center');
    text(stageIndex === STAGES.length - 1 ? 'FINAL' : 'SIGA', x + 3, 175, 6, '#ffffff', 'center');
  }

  function drawHud() {
    box(7, 7, 142, 27, 'rgba(5,7,12,.84)');
    text('DARLON', 12, 16, 7, '#ffffff');
    text(`${Math.ceil(player.hp)}/${player.maxHp}`, 143, 16, 6, '#ffffff', 'right');
    box(11, 21, 132, 8, '#191d24');
    box(12, 22, 130 * (player.hp / player.maxHp), 6, player.hp > 30 ? '#4bd17c' : '#ef334c');
    box(12, 22, 130 * (player.hp / player.maxHp), 2, 'rgba(255,255,255,.35)');

    box(176, 7, 128, 25, 'rgba(5,7,12,.78)');
    text(`FASE ${stageIndex + 1}/5`, 240, 16, 7, '#ffd800', 'center');
    text(STAGES[stageIndex].name, 240, 26, 6, '#ffffff', 'center');

    const remaining = enemies.filter(enemy => !enemy.defeated).length;
    box(326, 7, 108, 25, 'rgba(5,7,12,.78)');
    text('ADVERSÁRIOS', 332, 16, 6, '#aeb6c5');
    text(String(remaining), 424, 27, 14, remaining ? '#ffdf35' : '#4bd17c', 'right');
    text(formatTime(elapsed), 332, 27, 7, '#ffffff');

    if (combo > 1 && comboTimer > 0) {
      text(`${combo}x COMBO`, 240, 54, 12 + Math.min(combo, 7), '#ffd800', 'center');
    }
  }

  function drawStageBanner() {
    if (stageBanner <= 0) return;
    const alpha = stageBanner > 1.9 ? (2.35 - stageBanner) / .45 : stageBanner < .45 ? stageBanner / .45 : 1;
    ctx.globalAlpha = clamp(alpha, 0, 1);
    box(112, 91, 256, 51, 'rgba(5,7,12,.88)');
    box(112, 91, 6, 51, '#ffd800');
    text(`FASE ${stageIndex + 1}`, 132, 108, 7, '#ffd800');
    text(STAGES[stageIndex].name, 240, 126, 15, '#ffffff', 'center');
    text(STAGES[stageIndex].zone, 240, 137, 6, '#aeb6c5', 'center');
    ctx.globalAlpha = 1;
  }

  function drawGame() {
    const sx = shake > 0 ? Math.round((Math.random() - .5) * shake) : 0;
    const sy = shake > 0 ? Math.round((Math.random() - .5) * shake * .5) : 0;
    ctx.save();
    ctx.translate(sx, sy);
    drawStage(STAGES[stageIndex]);
    drawExit();
    const actors = [...enemies.map(enemy => ({ actor: enemy, player: false })), { actor: player, player: true }]
      .sort((a, b) => a.actor.y - b.actor.y);
    actors.forEach(item => drawActor(item.actor, item.player));
    drawEffects();
    ctx.restore();
    drawHud();
    drawStageBanner();
    if (flash > 0) {
      ctx.globalAlpha = flash * 2.6;
      box(0, 0, W, H, '#ef334c');
      ctx.globalAlpha = 1;
    }
  }

  function drawAttract() {
    drawStage(STAGES[0], demoClock);
    const cycle = demoClock % 2.4;
    const hero = { x: 384, y: 218, facing: 1, state: cycle < .5 ? 'walk' : cycle < 1.25 ? 'punch' : 'idle', stateTime: cycle, flash: 0 };
    const rival = { x: 431, y: 218, facing: -1, state: cycle > .5 && cycle < 1.1 ? 'hurt' : 'chase', stateTime: cycle, flash: cycle > .5 && cycle < .64 ? .1 : 0, def: FIGHTER_DEFS[0], hp: 48, maxHp: 48, defeated: false };
    drawActor(rival, false);
    drawActor(hero, true);
    box(331, 239, 139, 18, 'rgba(5,7,12,.8)');
    text('PIXEL BRAWLER • MOBILE', 400, 251, 7, '#ffd800', 'center');
  }

  function render() {
    if (mode === 'menu' || !player) drawAttract();
    else drawGame();
  }

  function frame(now) {
    const dt = Math.min(.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function resetInput() {
    keys.clear();
    touchMove.x = 0;
    touchMove.y = 0;
    touchMove.pointerId = null;
    ui.stick.style.transform = 'translate(-50%, -50%)';
    ui.punch.classList.remove('pressed');
    ui.kick.classList.remove('pressed');
  }

  function updateJoystick(event) {
    const rect = ui.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const max = rect.width * .31;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    touchMove.x = clamp(dx / max, -1, 1);
    touchMove.y = clamp(dy / max, -1, 1);
    ui.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function releaseJoystick(event) {
    if (touchMove.pointerId !== event.pointerId) return;
    touchMove.pointerId = null;
    touchMove.x = 0;
    touchMove.y = 0;
    ui.stick.style.transform = 'translate(-50%, -50%)';
  }

  function bindActionButton(button, kind) {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('pressed');
      resumeAudio();
      attackPlayer(kind);
    });
    const release = () => button.classList.remove('pressed');
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  }

  ui.joystick.addEventListener('pointerdown', event => {
    event.preventDefault();
    touchMove.pointerId = event.pointerId;
    ui.joystick.setPointerCapture?.(event.pointerId);
    updateJoystick(event);
  });
  ui.joystick.addEventListener('pointermove', event => {
    if (touchMove.pointerId === event.pointerId) updateJoystick(event);
  });
  ui.joystick.addEventListener('pointerup', releaseJoystick);
  ui.joystick.addEventListener('pointercancel', releaseJoystick);
  bindActionButton(ui.punch, 'punch');
  bindActionButton(ui.kick, 'kick');

  window.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      if (event.code === 'KeyJ' || event.code === 'KeyZ' || event.code === 'Space') attackPlayer('punch');
      if (event.code === 'KeyK' || event.code === 'KeyX') attackPlayer('kick');
      if (event.code === 'Escape' || event.code === 'KeyP') mode === 'paused' ? resumeGame() : pauseGame();
      if (event.code === 'Enter' && mode === 'menu') startGame();
    }
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { if (mode === 'playing') pauseGame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pauseGame(); });
  document.addEventListener('contextmenu', event => event.preventDefault());

  ui.play.addEventListener('click', startGame);
  ui.iosHelp.addEventListener('click', () => ui.iosInstall.classList.add('visible'));
  ui.iosInstallClose.addEventListener('click', () => ui.iosInstall.classList.remove('visible'));
  ui.pauseBtn.addEventListener('click', pauseGame);
  ui.resume.addEventListener('click', resumeGame);
  ui.restartPause.addEventListener('click', () => { ui.pause.classList.remove('visible'); mode = 'playing'; resetRun(); });
  ui.menuPause.addEventListener('click', backToMenu);
  ui.again.addEventListener('click', async () => { await requestLandscape(); hideOverlays(); ui.shell.classList.add('playing'); mode = 'playing'; resetRun(); });
  ui.menuResult.addEventListener('click', backToMenu);

  document.addEventListener('fullscreenchange', updateViewportSize);
  document.addEventListener('webkitfullscreenchange', updateViewportSize);

  if ('serviceWorker' in nav) {
    window.addEventListener('load', () => {
      nav.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  function resumeAudio() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === 'suspended') audioContext.resume();
  }

  function tone(frequency, duration = .05, type = 'square', volume = .025, delay = 0) {
    if (!audioContext) return;
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function sfxWhoosh(freq) { tone(freq, .045, 'sawtooth', .013); }
  function sfxHit(heavy) { tone(heavy ? 72 : 98, heavy ? .12 : .07, 'square', heavy ? .05 : .035); tone(heavy ? 150 : 205, .04, 'sawtooth', .018, .015); }
  function sfxHurt() { tone(80, .14, 'sawtooth', .04); tone(55, .18, 'square', .025, .03); }
  function sfxAlert() { tone(420, .055, 'square', .025); tone(620, .08, 'square', .02, .06); }
  function sfxKnockout() { tone(110, .09, 'square', .04); tone(73, .16, 'square', .04, .08); tone(380, .08, 'square', .02, .18); }
  function sfxClear() { tone(390, .06, 'square', .025); tone(520, .07, 'square', .025, .07); tone(780, .12, 'square', .025, .14); }
  function sfxDoor() { tone(220, .08, 'square', .018); tone(165, .12, 'square', .018, .08); }
  function sfxLose() { tone(180, .12, 'square', .025); tone(130, .18, 'square', .025, .13); tone(88, .25, 'square', .025, .3); }
  function sfxVictory() { [392, 523, 659, 784].forEach((frequency, i) => tone(frequency, .18, 'square', .025, i * .11)); }

  requestAnimationFrame(frame);
})();

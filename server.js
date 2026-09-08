'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const ROOM_MAX_PLAYERS = 4;
const RUN_DURATION = 8 * 60;
const TICK_MS = 50;

const rooms = new Map();
let globalEnemyId = 1;
let globalBulletId = 1;
let globalPickupId = 1;

const ENEMIES = {
  sparrow: { name: 'Pardal', hp: 24, speed: 88, damage: 9, radius: 18, xp: 2, value: 1, size: .72 },
  swift: { name: 'Andorinha', hp: 18, speed: 142, damage: 8, radius: 15, xp: 2, value: 1, size: .58 },
  crow: { name: 'Corvo', hp: 62, speed: 82, damage: 13, radius: 23, xp: 4, value: 2, size: .95 },
  diver: { name: 'Mergulhador', hp: 82, speed: 112, damage: 15, radius: 22, xp: 5, value: 2, size: .88 },
  goose: { name: 'Ganso Rabiscado', hp: 132, speed: 60, damage: 19, radius: 31, xp: 8, value: 3, size: 1.25 },
  tank: { name: 'Albatroz', hp: 260, speed: 48, damage: 25, radius: 38, xp: 14, value: 5, size: 1.55 },
  mosquito: { name: 'Mosquito do Paint', hp: 12, speed: 190, damage: 6, radius: 11, xp: 1, value: 1, size: .43 },
  owl: { name: 'Coruja Caneta', hp: 178, speed: 68, damage: 21, radius: 34, xp: 11, value: 4, size: 1.35 }
};

const BOSSES = [
  { t: 120, name: 'REI CORVO', hp: 2900, speed: 57, damage: 28, radius: 65, size: 2.25, color: '#7c3aed' },
  { t: 240, name: 'CONDOR DE PAPEL', hp: 7200, speed: 52, damage: 35, radius: 78, size: 2.65, color: '#dc2626' },
  { t: 360, name: 'GANSO DO FIM', hp: 15000, speed: 47, damage: 42, radius: 88, size: 3.0, color: '#f97316' },
  { t: 450, name: 'FÊNIX DO PAINT', hp: 30000, speed: 55, damage: 50, radius: 98, size: 3.35, color: '#ec4899', final: true }
];

const PLAYER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea'];
const PICKUP_KINDS = ['heal', 'double', 'haste', 'nuke', 'coin', 'shield'];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function id(bytes = 9) { return crypto.randomBytes(bytes).toString('base64url'); }

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tries = 0; tries < 50; tries++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet[randi(0, alphabet.length - 1)];
    if (!rooms.has(code)) return code;
  }
  return id(5).slice(0, 6).toUpperCase();
}

function sanitizeName(name) {
  const v = String(name || 'Jogador').trim().replace(/[<>\r\n]/g, '').slice(0, 18);
  return v || 'Jogador';
}

function createPlayer(name, slot) {
  return {
    id: id(6),
    token: id(18),
    name: sanitizeName(name),
    color: PLAYER_COLORS[slot % PLAYER_COLORS.length],
    x: slot * 46 - 70,
    y: 0,
    aim: 0,
    inputX: 0,
    inputY: 0,
    speed: 235,
    maxHp: 100,
    hp: 100,
    armor: 0,
    regen: 0,
    xpGain: 1,
    dashCooldownMax: 4,
    dashCooldown: 0,
    dashActive: 0,
    dashDirX: 1,
    dashDirY: 0,
    invuln: 0,
    hurtCd: 0,
    alive: true,
    reviveProgress: 0,
    level: 1,
    xp: 0,
    xpNeed: 12,
    pendingLevelups: 0,
    pendingChests: 0,
    kills: 0,
    damage: 0,
    runCoins: 0,
    buffDoubleUntil: 0,
    buffHasteUntil: 0,
    shieldUntil: 0,
    buildLabel: 'Rifle Lv.1',
    lastSeen: Date.now(),
    joinedAt: Date.now(),
    connected: true,
    combatWindowAt: Date.now(),
    combatWindowCount: 0
  };
}

function createRoom(name) {
  const code = makeRoomCode();
  const room = {
    id: code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hostId: null,
    mode: 'lobby',
    players: new Map(),
    enemies: new Map(),
    enemyBullets: new Map(),
    pickups: new Map(),
    elapsed: 0,
    duration: RUN_DURATION,
    spawnTimer: .2,
    eliteTimer: 20,
    bossFlags: new Set(),
    teamKills: 0,
    runId: id(10),
    eventSeq: 0,
    events: [],
    manualPaused: false,
    endedReason: '',
    victory: false
  };
  const p = createPlayer(name, 0);
  room.players.set(p.id, p);
  room.hostId = p.id;
  rooms.set(code, room);
  return { room, player: p };
}

function addEvent(room, event) {
  const e = { seq: ++room.eventSeq, ts: Date.now(), ...event };
  room.events.push(e);
  if (room.events.length > 90) room.events.splice(0, room.events.length - 90);
}

function addPlayer(room, name) {
  if (room.mode !== 'lobby') throw new Error('RUN_JA_COMECOU');
  if (room.players.size >= ROOM_MAX_PLAYERS) throw new Error('SALA_CHEIA');
  const p = createPlayer(name, room.players.size);
  room.players.set(p.id, p);
  addEvent(room, { type: 'playerJoin', playerId: p.id, name: p.name, color: p.color });
  room.updatedAt = Date.now();
  return p;
}

function resetRun(room) {
  room.mode = 'running';
  room.elapsed = 0;
  room.spawnTimer = .25;
  room.eliteTimer = 18;
  room.bossFlags = new Set();
  room.enemies.clear();
  room.enemyBullets.clear();
  room.pickups.clear();
  room.teamKills = 0;
  room.runId = id(10);
  room.eventSeq = 0;
  room.events = [];
  room.manualPaused = false;
  room.endedReason = '';
  room.victory = false;
  let i = 0;
  for (const p of room.players.values()) {
    p.x = (i % 2) * 52 - 26;
    p.y = Math.floor(i / 2) * 52 - 26;
    p.inputX = p.inputY = 0;
    p.aim = 0;
    p.hp = p.maxHp;
    p.alive = true;
    p.reviveProgress = 0;
    p.level = 1;
    p.xp = 0;
    p.xpNeed = 12;
    p.pendingLevelups = 0;
    p.pendingChests = 0;
    p.kills = 0;
    p.damage = 0;
    p.runCoins = 0;
    p.buffDoubleUntil = 0;
    p.buffHasteUntil = 0;
    p.shieldUntil = 0;
    p.dashCooldown = 0;
    p.dashActive = 0;
    p.invuln = 1.5;
    p.hurtCd = 0;
    i++;
  }
  addEvent(room, { type: 'runStart', runId: room.runId });
  room.updatedAt = Date.now();
}

function activePlayers(room) {
  const now = Date.now();
  return [...room.players.values()].filter(p => {
    p.connected = now - p.lastSeen < 9000;
    return p.connected;
  });
}

function alivePlayers(room) {
  return activePlayers(room).filter(p => p.alive);
}

function rewardPaused(room) {
  return activePlayers(room).some(p => p.pendingLevelups > 0 || p.pendingChests > 0);
}

function addXp(player, raw) {
  player.xp += raw * clamp(player.xpGain || 1, .5, 3);
  let guard = 0;
  while (player.xp >= player.xpNeed && guard++ < 10) {
    player.xp -= player.xpNeed;
    player.level++;
    player.pendingLevelups++;
    player.xpNeed = Math.round(12 + Math.pow(player.level, 1.36) * 5.7);
  }
}

function chooseEnemyType(t) {
  const pool = ['sparrow', 'sparrow', 'swift', 'mosquito'];
  if (t > 35) pool.push('crow', 'crow');
  if (t > 85) pool.push('diver', 'owl');
  if (t > 145) pool.push('goose', 'crow');
  if (t > 235) pool.push('tank', 'owl', 'goose');
  if (t > 340) pool.push('tank', 'diver', 'mosquito', 'owl');
  return pool[randi(0, pool.length - 1)];
}

function randomAliveAnchor(room) {
  const alive = alivePlayers(room);
  return alive.length ? alive[randi(0, alive.length - 1)] : null;
}

function spawnEnemy(room, type = null, elite = false) {
  const anchor = randomAliveAnchor(room);
  if (!anchor) return;
  type = type || chooseEnemyType(room.elapsed);
  const def = ENEMIES[type];
  const a = rand(0, Math.PI * 2);
  const rr = rand(600, 850);
  const playersScale = 1 + Math.max(0, activePlayers(room).length - 1) * .58;
  const diff = 1 + room.elapsed / 430;
  const hp = def.hp * diff * playersScale * (elite ? 5.0 : 1);
  const e = {
    id: globalEnemyId++, type, name: elite ? `ELITE ${def.name}` : def.name,
    x: anchor.x + Math.cos(a) * rr, y: anchor.y + Math.sin(a) * rr,
    hp, maxHp: hp, speed: def.speed * (1 + Math.min(.42, room.elapsed / 1000)) * (elite ? .92 : 1),
    damage: def.damage * (1 + room.elapsed / 700) * (elite ? 1.65 : 1),
    radius: def.radius * (elite ? 1.25 : 1), xp: def.xp * (elite ? 7 : 1), value: def.value * (elite ? 8 : 1),
    size: def.size * (elite ? 1.35 : 1), elite, isBoss: false, seed: rand(1, 99999), phase: rand(0, Math.PI * 2),
    shootCd: rand(1.4, 2.8), contactKey: ''
  };
  room.enemies.set(e.id, e);
}

function spawnBoss(room, def) {
  const anchor = randomAliveAnchor(room);
  if (!anchor) return;
  const a = rand(0, Math.PI * 2);
  const playersScale = 1 + Math.max(0, activePlayers(room).length - 1) * .72;
  const hp = def.hp * playersScale;
  const e = {
    id: globalEnemyId++, type: 'boss', name: def.name,
    x: anchor.x + Math.cos(a) * 760, y: anchor.y + Math.sin(a) * 760,
    hp, maxHp: hp, speed: def.speed, damage: def.damage, radius: def.radius, xp: 100,
    value: 40, size: def.size, elite: false, isBoss: true, final: !!def.final, color: def.color,
    seed: rand(1, 99999), phase: rand(0, Math.PI * 2), shootCd: .8
  };
  room.enemies.set(e.id, e);
  addEvent(room, { type: 'bossSpawn', enemyId: e.id, name: e.name, x: e.x, y: e.y, color: e.color });
}

function spawnPickup(room, x, y, forced = null) {
  const kind = forced || PICKUP_KINDS[randi(0, PICKUP_KINDS.length - 1)];
  const p = { id: globalPickupId++, x, y, kind, seed: rand(1, 9999), phase: rand(0, 6.28) };
  room.pickups.set(p.id, p);
  addEvent(room, { type: 'pickupSpawn', pickupId: p.id, kind, x, y });
}

function damagePlayer(room, p, amount, sourceX, sourceY) {
  if (!p.alive || p.invuln > 0 || room.elapsed < (p.shieldUntil || 0)) return;
  const reduced = Math.max(1, amount - p.armor * 1.65);
  p.hp -= reduced;
  p.hurtCd = .45;
  p.invuln = .18;
  addEvent(room, { type: 'playerHit', playerId: p.id, damage: reduced, x: p.x, y: p.y, sourceX, sourceY });
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    p.reviveProgress = 0;
    p.inputX = p.inputY = 0;
    addEvent(room, { type: 'playerDown', playerId: p.id, name: p.name, x: p.x, y: p.y });
  }
}

function killEnemy(room, e, killer) {
  if (!room.enemies.has(e.id)) return;
  room.enemies.delete(e.id);
  room.teamKills++;
  if (killer) {
    killer.kills++;
    killer.runCoins += e.value;
  }
  for (const p of room.players.values()) {
    if (p.connected) {
      addXp(p, e.xp);
      p.runCoins += e.isBoss ? 20 : e.elite ? 6 : (Math.random() < .06 ? 1 : 0);
      if (e.elite || e.isBoss) p.pendingChests++;
    }
  }
  addEvent(room, { type: 'enemyDead', enemyId: e.id, x: e.x, y: e.y, elite: e.elite, boss: e.isBoss, name: e.name, color: e.color || '#111' });
  if (e.isBoss) addEvent(room, { type: 'bossDead', name: e.name, x: e.x, y: e.y, color: e.color || '#111' });
  if (!e.elite && !e.isBoss && Math.random() < .018) spawnPickup(room, e.x, e.y);
  if (e.elite && Math.random() < .45) spawnPickup(room, e.x + rand(-35, 35), e.y + rand(-35, 35));
}

function applyPickup(room, pickup, collector) {
  room.pickups.delete(pickup.id);
  const t = room.elapsed;
  switch (pickup.kind) {
    case 'heal':
      for (const p of room.players.values()) if (p.connected && p.alive) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .32);
      break;
    case 'double':
      for (const p of room.players.values()) if (p.connected) p.buffDoubleUntil = Math.max(p.buffDoubleUntil, t + 12);
      break;
    case 'haste':
      for (const p of room.players.values()) if (p.connected) p.buffHasteUntil = Math.max(p.buffHasteUntil, t + 12);
      break;
    case 'shield':
      for (const p of room.players.values()) if (p.connected && p.alive) p.shieldUntil = Math.max(p.shieldUntil, t + 7);
      break;
    case 'coin':
      for (const p of room.players.values()) if (p.connected) p.runCoins += 20;
      break;
    case 'nuke': {
      const victims = [...room.enemies.values()];
      for (const e of victims) {
        const dmg = Math.max(e.maxHp * .42, 90);
        e.hp -= dmg;
        if (e.hp <= 0) killEnemy(room, e, collector);
      }
      break;
    }
  }
  addEvent(room, { type: 'pickupCollected', kind: pickup.kind, playerId: collector.id, x: pickup.x, y: pickup.y });
}

function nearestAlivePlayer(room, x, y) {
  let best = null, bd = Infinity;
  for (const p of alivePlayers(room)) {
    const d = dist(x, y, p.x, p.y);
    if (d < bd) { best = p; bd = d; }
  }
  return best ? { p: best, d: bd } : null;
}

function tickRoom(room, dt) {
  const now = Date.now();
  for (const p of room.players.values()) {
    p.connected = now - p.lastSeen < 9000;
    if (!p.connected && now - p.lastSeen > 15000) {
      p.inputX = p.inputY = 0;
      p.pendingLevelups = 0;
      p.pendingChests = 0;
    }
  }

  if (room.mode !== 'running') return;
  if (room.manualPaused || rewardPaused(room)) return;

  const alive = alivePlayers(room);
  if (!alive.length) {
    room.mode = 'ended';
    room.endedReason = 'Todos os jogadores caíram.';
    room.victory = false;
    addEvent(room, { type: 'runEnd', victory: false, reason: room.endedReason });
    return;
  }

  room.elapsed += dt;
  if (room.elapsed >= room.duration) {
    room.elapsed = room.duration;
    room.mode = 'ended';
    room.victory = true;
    room.endedReason = 'Vocês sobreviveram até o fim.';
    addEvent(room, { type: 'runEnd', victory: true, reason: room.endedReason });
    return;
  }

  for (const p of room.players.values()) {
    if (!p.connected) continue;
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.dashActive = Math.max(0, p.dashActive - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    if (!p.alive) continue;
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    const speedBuff = room.elapsed < p.buffHasteUntil ? 1.22 : 1;
    let mx = p.inputX, my = p.inputY;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    if (p.dashActive > 0) {
      p.x += p.dashDirX * p.speed * 3.25 * dt;
      p.y += p.dashDirY * p.speed * 3.25 * dt;
      p.invuln = Math.max(p.invuln, .12);
    } else {
      p.x += mx * p.speed * speedBuff * dt;
      p.y += my * p.speed * speedBuff * dt;
    }
  }

  // Revival: fique perto por 3 segundos.
  for (const target of room.players.values()) {
    if (!target.connected || target.alive) continue;
    let rescuer = null;
    for (const p of alivePlayers(room)) {
      if (p.id !== target.id && dist(p.x, p.y, target.x, target.y) < 78) { rescuer = p; break; }
    }
    if (rescuer) target.reviveProgress += dt;
    else target.reviveProgress = Math.max(0, target.reviveProgress - dt * 1.25);
    if (target.reviveProgress >= 3) {
      target.alive = true;
      target.hp = Math.max(1, target.maxHp * .38);
      target.invuln = 2;
      target.reviveProgress = 0;
      addEvent(room, { type: 'playerRevived', playerId: target.id, by: rescuer && rescuer.id, x: target.x, y: target.y });
    }
  }

  // Bosses.
  for (const def of BOSSES) {
    if (room.elapsed >= def.t && !room.bossFlags.has(def.t)) {
      room.bossFlags.add(def.t);
      spawnBoss(room, def);
    }
  }

  // Hordas.
  room.spawnTimer -= dt;
  if (room.spawnTimer <= 0) {
    const nPlayers = alive.length;
    const cap = 120 + nPlayers * 45;
    if (room.enemies.size < cap) {
      let count = 1 + Math.floor(room.elapsed / 155) + Math.max(0, nPlayers - 1);
      if (room.elapsed > 400) count++;
      count = Math.min(7, count);
      for (let i = 0; i < count; i++) spawnEnemy(room);
    }
    room.spawnTimer = Math.max(.16, .67 - room.elapsed * .00078 - Math.max(0, alive.length - 1) * .045);
  }

  room.eliteTimer -= dt;
  if (room.eliteTimer <= 0) {
    spawnEnemy(room, null, true);
    room.eliteTimer = Math.max(14, 25 - room.elapsed / 55) + rand(-2, 3);
  }

  for (const e of room.enemies.values()) {
    e.phase += dt * (4 + e.speed / 55);
    const targetInfo = nearestAlivePlayer(room, e.x, e.y);
    if (!targetInfo) continue;
    const target = targetInfo.p;
    let dx = target.x - e.x, dy = target.y - e.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    dx /= d; dy /= d;
    const wiggle = Math.sin(e.phase * .65 + e.seed) * (e.type === 'swift' || e.type === 'mosquito' ? 30 : 10);
    const px = -dy, py = dx;
    e.x += (dx * e.speed + px * wiggle) * dt;
    e.y += (dy * e.speed + py * wiggle) * dt;

    e.shootCd -= dt;
    if ((e.isBoss || e.elite || e.type === 'owl') && e.shootCd <= 0 && d < 720) {
      const count = e.isBoss ? 5 : e.type === 'owl' ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const a = Math.atan2(target.y - e.y, target.x - e.x) + (i - (count - 1) / 2) * (e.isBoss ? .16 : .12);
        const sp = e.isBoss ? 250 : e.type === 'owl' ? 220 : 185;
        const b = { id: globalBulletId++, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: e.isBoss ? 8 : 6, damage: e.damage * .55, life: 4, color: e.color || '#111' };
        room.enemyBullets.set(b.id, b);
      }
      e.shootCd = e.isBoss ? 1.25 : e.type === 'owl' ? 2.1 : 2.7;
    }

    for (const p of alivePlayers(room)) {
      if (p.hurtCd <= 0 && dist(e.x, e.y, p.x, p.y) < e.radius + 20) damagePlayer(room, p, e.damage, e.x, e.y);
    }
  }

  for (const b of [...room.enemyBullets.values()]) {
    b.life -= dt;
    if (b.life <= 0) { room.enemyBullets.delete(b.id); continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    for (const p of alivePlayers(room)) {
      if (dist(b.x, b.y, p.x, p.y) < b.r + 18) {
        room.enemyBullets.delete(b.id);
        damagePlayer(room, p, b.damage, b.x, b.y);
        break;
      }
    }
  }

  for (const pickup of [...room.pickups.values()]) {
    pickup.phase += dt * 2;
    for (const p of alivePlayers(room)) {
      if (dist(pickup.x, pickup.y, p.x, p.y) < 38) {
        applyPickup(room, pickup, p);
        break;
      }
    }
  }

  room.updatedAt = Date.now();
}

function snapshot(room, viewerId) {
  const now = Date.now();
  const rewardWait = rewardPaused(room);
  return {
    id: room.id,
    hostId: room.hostId,
    mode: room.mode,
    runId: room.runId,
    elapsed: room.elapsed,
    duration: room.duration,
    teamKills: room.teamKills,
    manualPaused: room.manualPaused,
    rewardPaused: rewardWait,
    victory: room.victory,
    endedReason: room.endedReason,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, aim: p.aim,
      hp: p.hp, maxHp: p.maxHp, armor: p.armor, alive: p.alive, reviveProgress: p.reviveProgress,
      level: p.level, xp: p.xp, xpNeed: p.xpNeed, pendingLevelups: p.pendingLevelups,
      pendingChests: p.pendingChests, kills: p.kills, damage: p.damage, runCoins: p.runCoins,
      connected: now - p.lastSeen < 9000,
      buffDouble: Math.max(0, p.buffDoubleUntil - room.elapsed),
      buffHaste: Math.max(0, p.buffHasteUntil - room.elapsed),
      shield: Math.max(0, p.shieldUntil - room.elapsed),
      dashCooldown: p.dashCooldown, buildLabel: p.buildLabel
    })),
    enemies: [...room.enemies.values()].map(e => ({
      id: e.id, type: e.type, name: e.name, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
      radius: e.radius, size: e.size, elite: e.elite, isBoss: e.isBoss, color: e.color || '#111', seed: e.seed
    })),
    enemyBullets: [...room.enemyBullets.values()].map(b => ({ id: b.id, x: b.x, y: b.y, r: b.r, color: b.color })),
    pickups: [...room.pickups.values()],
    events: room.events.slice(-50),
    viewerId
  };
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}

function authRoom(bodyOrQuery) {
  const roomId = String(bodyOrQuery.roomId || '').toUpperCase();
  const playerId = String(bodyOrQuery.playerId || '');
  const token = String(bodyOrQuery.token || '');
  const room = rooms.get(roomId);
  if (!room) throw new Error('SALA_NAO_ENCONTRADA');
  const player = room.players.get(playerId);
  if (!player || player.token !== token) throw new Error('SESSAO_INVALIDA');
  player.lastSeen = Date.now();
  player.connected = true;
  return { room, player };
}

function canCombat(player) {
  const now = Date.now();
  if (now - player.combatWindowAt > 1000) {
    player.combatWindowAt = now;
    player.combatWindowCount = 0;
  }
  player.combatWindowCount++;
  return player.combatWindowCount <= 80;
}

function sanitizeFx(fx, player) {
  if (!fx || typeof fx !== 'object') return null;
  const allowed = new Set(['shot', 'inkZone', 'axe', 'lightning', 'mine', 'trail', 'scissor', 'bird', 'boom', 'boomerang']);
  if (!allowed.has(fx.type)) return null;
  const out = { type: 'combatFx', fxType: fx.type, playerId: player.id, color: player.color };
  for (const k of ['x', 'y', 'x2', 'y2', 'a', 'r', 'duration', 'count']) {
    if (Number.isFinite(Number(fx[k]))) out[k] = clamp(Number(fx[k]), -100000, 100000);
  }
  if (typeof fx.color === 'string' && /^#[0-9a-f]{6}$/i.test(fx.color)) out.paintColor = fx.color;
  if (typeof fx.weapon === 'string') out.weapon = fx.weapon.slice(0, 24);
  return out;
}

async function handleApi(req, res, urlObj) {
  try {
    if (req.method === 'GET' && urlObj.pathname === '/api/health') {
      return json(res, 200, { ok: true, rooms: rooms.size, uptime: process.uptime() });
    }

    if (req.method === 'GET' && urlObj.pathname === '/api/state') {
      const q = Object.fromEntries(urlObj.searchParams.entries());
      const { room, player } = authRoom(q);
      return json(res, 200, { ok: true, room: snapshot(room, player.id) });
    }

    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    const body = await readBody(req);

    if (urlObj.pathname === '/api/room/create') {
      const { room, player } = createRoom(body.name);
      return json(res, 200, { ok: true, roomId: room.id, playerId: player.id, token: player.token, hostId: room.hostId });
    }

    if (urlObj.pathname === '/api/room/join') {
      const roomId = String(body.roomId || '').toUpperCase();
      const room = rooms.get(roomId);
      if (!room) throw new Error('SALA_NAO_ENCONTRADA');
      const player = addPlayer(room, body.name);
      return json(res, 200, { ok: true, roomId: room.id, playerId: player.id, token: player.token, hostId: room.hostId });
    }

    if (urlObj.pathname === '/api/room/start') {
      const { room, player } = authRoom(body);
      if (room.hostId !== player.id) throw new Error('SO_HOST_INICIA');
      if (room.mode !== 'lobby' && room.mode !== 'ended') throw new Error('SALA_OCUPADA');
      resetRun(room);
      return json(res, 200, { ok: true, runId: room.runId });
    }

    if (urlObj.pathname === '/api/room/restart') {
      const { room, player } = authRoom(body);
      if (room.hostId !== player.id) throw new Error('SO_HOST_REINICIA');
      if (room.mode !== 'ended') throw new Error('RUN_AINDA_ATIVA');
      resetRun(room);
      return json(res, 200, { ok: true, runId: room.runId });
    }

    if (urlObj.pathname === '/api/room/pause') {
      const { room, player } = authRoom(body);
      if (room.hostId !== player.id) throw new Error('SO_HOST_PAUSA');
      if (room.mode !== 'running') throw new Error('RUN_NAO_ATIVA');
      room.manualPaused = !room.manualPaused;
      addEvent(room, { type: 'pause', paused: room.manualPaused, by: player.id });
      return json(res, 200, { ok: true, paused: room.manualPaused });
    }

    if (urlObj.pathname === '/api/input') {
      const { room, player } = authRoom(body);
      if (room.mode !== 'running') return json(res, 200, { ok: true });
      let dx = clamp(Number(body.dx || 0), -1, 1);
      let dy = clamp(Number(body.dy || 0), -1, 1);
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      player.inputX = dx;
      player.inputY = dy;
      player.aim = Number.isFinite(Number(body.aim)) ? Number(body.aim) : player.aim;
      return json(res, 200, { ok: true });
    }

    if (urlObj.pathname === '/api/dash') {
      const { room, player } = authRoom(body);
      if (room.mode !== 'running' || rewardPaused(room) || room.manualPaused || !player.alive) return json(res, 200, { ok: false });
      if (player.dashCooldown > 0 || player.dashActive > 0) return json(res, 200, { ok: false, cooldown: player.dashCooldown });
      let dx = Number(body.dx || 0), dy = Number(body.dy || 0);
      let m = Math.hypot(dx, dy);
      if (m < .1) { dx = Math.cos(player.aim); dy = Math.sin(player.aim); m = 1; }
      player.dashDirX = dx / m; player.dashDirY = dy / m;
      player.dashActive = .18;
      player.dashCooldown = player.dashCooldownMax;
      player.invuln = .26;
      addEvent(room, { type: 'dash', playerId: player.id, x: player.x, y: player.y, dx: player.dashDirX, dy: player.dashDirY });
      return json(res, 200, { ok: true });
    }

    if (urlObj.pathname === '/api/stats') {
      const { player } = authRoom(body);
      const oldMax = player.maxHp;
      player.maxHp = clamp(Number(body.maxHp || player.maxHp), 70, 600);
      player.speed = clamp(Number(body.speed || player.speed), 150, 520);
      player.armor = clamp(Number(body.armor || player.armor), 0, 35);
      player.regen = clamp(Number(body.regen || player.regen), 0, 12);
      player.xpGain = clamp(Number(body.xpGain || player.xpGain), .75, 3);
      player.dashCooldownMax = clamp(Number(body.dashCooldown || player.dashCooldownMax), 1, 6);
      if (player.maxHp > oldMax) player.hp = Math.min(player.maxHp, player.hp + (player.maxHp - oldMax));
      if (typeof body.buildLabel === 'string') player.buildLabel = body.buildLabel.slice(0, 80);
      return json(res, 200, { ok: true });
    }

    if (urlObj.pathname === '/api/reward/ack') {
      const { room, player } = authRoom(body);
      if (body.kind === 'level' && player.pendingLevelups > 0) player.pendingLevelups--;
      if (body.kind === 'chest' && player.pendingChests > 0) player.pendingChests--;
      addEvent(room, { type: 'rewardAck', playerId: player.id, kind: String(body.kind || '') });
      return json(res, 200, { ok: true, pendingLevelups: player.pendingLevelups, pendingChests: player.pendingChests });
    }

    if (urlObj.pathname === '/api/combat') {
      const { room, player } = authRoom(body);
      if (room.mode !== 'running' || rewardPaused(room) || room.manualPaused || !player.alive || !canCombat(player)) return json(res, 200, { ok: true });
      const hits = Array.isArray(body.hits) ? body.hits.slice(0, 80) : [];
      const seen = new Set();
      for (const h of hits) {
        const enemyId = Number(h.id);
        if (!Number.isFinite(enemyId) || seen.has(enemyId)) continue;
        seen.add(enemyId);
        const e = room.enemies.get(enemyId);
        if (!e) continue;
        const damage = clamp(Number(h.damage || 0), 0, 100000);
        if (damage <= 0) continue;
        e.hp -= damage;
        player.damage += damage;
        if (e.hp <= 0) killEnemy(room, e, player);
      }
      const fxList = Array.isArray(body.fx) ? body.fx.slice(0, 8) : body.fx ? [body.fx] : [];
      for (const fx of fxList) {
        const safe = sanitizeFx(fx, player);
        if (safe) addEvent(room, safe);
      }
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { ok: false, error: 'API_NOT_FOUND' });
  } catch (err) {
    const code = String(err && err.message || 'ERRO_INTERNO');
    const map = {
      SALA_NAO_ENCONTRADA: 404, SESSAO_INVALIDA: 401, SALA_CHEIA: 409, RUN_JA_COMECOU: 409,
      SO_HOST_INICIA: 403, SO_HOST_REINICIA: 403, SO_HOST_PAUSA: 403, RUN_AINDA_ATIVA: 409,
      RUN_NAO_ATIVA: 409, SALA_OCUPADA: 409, INVALID_JSON: 400, BODY_TOO_LARGE: 413
    };
    return json(res, map[code] || 400, { ok: false, error: code });
  }
}

function serveStatic(req, res, urlObj) {
  let pathname = decodeURIComponent(urlObj.pathname);
  if (pathname === '/') pathname = '/index.html';
  const safe = path.normalize(pathname).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const type = ({ '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json; charset=utf-8' })[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (urlObj.pathname.startsWith('/api/')) return handleApi(req, res, urlObj);
  return serveStatic(req, res, urlObj);
});

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = clamp((now - lastTick) / 1000, .01, .1);
  lastTick = now;
  for (const room of rooms.values()) tickRoom(room, dt);

  for (const [code, room] of rooms) {
    const age = now - room.updatedAt;
    const noActive = !activePlayers(room).length;
    if ((room.mode === 'lobby' && age > 2 * 60 * 60 * 1000) || (noActive && age > 20 * 60 * 1000)) rooms.delete(code);
    if (room.players.size) {
      const host = room.players.get(room.hostId);
      if (!host || now - host.lastSeen > 30000) {
        const next = activePlayers(room)[0];
        if (next && next.id !== room.hostId) {
          room.hostId = next.id;
          addEvent(room, { type: 'hostChanged', playerId: next.id, name: next.name });
        }
      }
    }
  }
}, TICK_MS).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Rabisco Survivors CO-OP rodando em http://localhost:${PORT}`);
});

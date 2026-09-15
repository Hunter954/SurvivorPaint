'use strict';

// Smoke test sem dependências: executa o cliente em um DOM/Canvas mínimo e
// percorre menu, início, movimento, ataques, pausa, retomada e reinício.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const windowListeners = new Map();
const elements = new Map();
let queuedFrame = null;
let drawCalls = 0;
let spriteDrawCalls = 0;
const heroWalkFrames = new Set();
const heroCelebrationFrames = new Set();
const supporterFrames = new Set();
const spriteSourceRects = [];
const loadedImages = new Set();
const drawnTexts = [];
const noop = () => {};

const canvasContext = new Proxy({ imageSmoothingEnabled: false }, {
  get(target, property) {
    if (property in target) return target[property];
    if (property === 'fillRect') return () => { drawCalls += 1; };
    if (property === 'fillText') return value => { drawCalls += 1; drawnTexts.push(String(value)); };
    if (property === 'drawImage') return (...args) => {
      drawCalls += 1;
      if (args.length !== 9) return;
      spriteDrawCalls += 1;
      const [image, sourceX, sourceY, sourceWidth, sourceHeight] = args;
      spriteSourceRects.push({ sourceX, sourceY, sourceWidth, sourceHeight });
      if (image.src?.includes('/hero.png')) {
        const col = Math.floor(sourceX / 128);
        const row = Math.floor(sourceY / 128);
        const frame = row * 4 + col;
        if (frame >= 2 && frame <= 5) heroWalkFrames.add(frame);
      }
      if (image.src?.includes('/supporters.png')) {
        const col = Math.floor(sourceX / 128);
        const row = Math.floor(sourceY / 128);
        supporterFrames.add(row * 4 + col);
      }
      if (image.src?.includes('/hero-celebrate.png')) {
        heroCelebrationFrames.add(Math.floor(sourceX / 128));
      }
    };
    if (property === 'measureText') return value => ({ width: String(value).length * 6 });
    return noop;
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});

function makeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name)
  };
}

function makeElement(id) {
  if (elements.has(id)) return elements.get(id);
  const listeners = new Map();
  const element = {
    id,
    style: {},
    classList: makeClassList(),
    textContent: '',
    innerHTML: '',
    addEventListener(type, listener) {
      const bucket = listeners.get(type) || [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    dispatch(type, detail = {}) {
      const event = { preventDefault: noop, pointerId: 1, clientX: 50, clientY: 50, ...detail };
      for (const listener of listeners.get(type) || []) listener(event);
    },
    setPointerCapture: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  };
  if (id === 'game') {
    element.width = 480;
    element.height = 270;
    element.getContext = () => canvasContext;
  }
  elements.set(id, element);
  return element;
}

function addWindowListener(type, listener) {
  const bucket = windowListeners.get(type) || [];
  bucket.push(listener);
  windowListeners.set(type, bucket);
}

global.window = {
  addEventListener: addWindowListener,
  AudioContext: null,
  webkitAudioContext: null,
  innerWidth: 844,
  innerHeight: 390,
  scrollTo: noop,
  visualViewport: { width: 844, height: 390, addEventListener: noop }
};
global.document = {
  getElementById: makeElement,
  addEventListener: (type, listener) => addWindowListener(`document:${type}`, listener),
  body: makeElement('body'),
  documentElement: { style: { setProperty: noop } },
  hidden: false,
  fullscreenElement: null
};
Object.defineProperty(global, 'navigator', {
  configurable: true,
  value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5, standalone: false }
});
global.matchMedia = query => ({ matches: query.includes('pointer: coarse') });
global.screen = { orientation: {} };
global.localStorage = { getItem: () => null, setItem: noop };
global.requestAnimationFrame = callback => { queuedFrame = callback; return 1; };
global.Image = class {
  constructor() { this.onload = null; this.onerror = null; this.naturalWidth = 512; this.naturalHeight = 512; }
  set src(value) { this._src = value; loadedImages.add(value); if (this.onload) this.onload(); }
  get src() { return this._src; }
};

function tick(time) {
  assert(queuedFrame, 'o cliente deve manter o loop de animação ativo');
  const frame = queuedFrame;
  queuedFrame = null;
  frame(time);
}

function key(type, code) {
  const event = { code, repeat: false, preventDefault: noop };
  for (const listener of windowListeners.get(type) || []) listener(event);
}

async function run() {
  const source = fs.readFileSync(require.resolve('../public/game.js'), 'utf8');
  const instrumentedSource = source.replace(
    '  requestAnimationFrame(frame);\n})();',
    `  window.__MISSAO_FOZ_TEST__ = {
    startFinalCelebration,
    goToCouncil: () => loadStage(STAGES.length - 1),
    enterCouncil,
    stageArea: () => stageArea,
    enemyCount: () => enemies.length,
    transitionPhase: () => transition?.phase || null,
    celebrationTime: () => finalCelebration
  };

  requestAnimationFrame(frame);
})();`
  );
  assert.notStrictEqual(instrumentedSource, source, 'o cliente deve aceitar a instrumentação isolada do smoke test');
  vm.runInThisContext(instrumentedSource, { filename: 'public/game.js' });

  tick(16);
  makeElement('playBtn').dispatch('click');
  await Promise.resolve();
  for (let frame = 1; frame <= 30; frame++) tick(16 + frame * 16);

  key('keydown', 'ArrowRight');
  for (let frame = 31; frame <= 230; frame++) {
    if (frame % 30 === 0) key('keydown', 'KeyJ');
    if (frame % 48 === 0) key('keydown', 'KeyK');
    tick(16 + frame * 16);
  }
  key('keyup', 'ArrowRight');

  makeElement('joystick').dispatch('pointerdown', { clientX: 95, clientY: 50 });
  for (let frame = 231; frame <= 255; frame++) tick(16 + frame * 16);
  makeElement('joystick').dispatch('pointerup');
  makeElement('punchBtn').dispatch('pointerdown');
  makeElement('punchBtn').dispatch('pointerup');
  makeElement('kickBtn').dispatch('pointerdown');
  makeElement('kickBtn').dispatch('pointerup');
  for (let frame = 256; frame <= 290; frame++) tick(16 + frame * 16);

  makeElement('pauseBtn').dispatch('click');
  assert(makeElement('pauseOverlay').classList.contains('visible'), 'o botão de pausa deve abrir o overlay');
  makeElement('resumeBtn').dispatch('click');
  assert(!makeElement('pauseOverlay').classList.contains('visible'), 'continuar deve fechar o overlay');
  makeElement('pauseBtn').dispatch('click');
  makeElement('restartPauseBtn').dispatch('click');
  for (let frame = 291; frame <= 315; frame++) tick(16 + frame * 16);

  const hooks = window.__MISSAO_FOZ_TEST__;
  let timelineFrame = 315;
  const advance = count => {
    for (let i = 0; i < count; i++) {
      timelineFrame += 1;
      tick(16 + timelineFrame * 16);
    }
  };

  hooks.goToCouncil();
  advance(1);
  assert.strictEqual(hooks.stageArea(), 'exterior', 'a sexta fase deve começar diante da Câmara');
  assert.strictEqual(hooks.enemyCount(), 0, 'a fachada deve funcionar como área de entrada, sem combate');
  assert(drawnTexts.includes('OBJETIVO • ENTRE PELA PORTA'), 'o HUD deve explicar como entrar na Câmara');
  hooks.enterCouncil();
  assert.strictEqual(hooks.transitionPhase(), 'council-out', 'a porta deve iniciar um fade para o interior');
  advance(14);
  const councilFade = Number(makeElement('fadeLayer').style.opacity);
  assert(councilFade > .1 && councilFade < .9, 'a entrada na Câmara deve usar fade gradual');
  advance(14);
  assert.strictEqual(hooks.stageArea(), 'interior', 'a transição deve carregar o plenário');
  assert.strictEqual(hooks.enemyCount(), 2, 'o plenário deve receber os dois oponentes de terno');
  assert.strictEqual(hooks.transitionPhase(), 'council-in', 'o plenário deve ser revelado com fade-in');
  advance(28);
  assert.strictEqual(hooks.transitionPhase(), null, 'a entrada no plenário deve concluir sem travar');

  hooks.startFinalCelebration();
  assert.strictEqual(hooks.transitionPhase(), 'celebration-out', 'a comemoração deve começar com fade-out');
  advance(22);
  const entryFade = Number(makeElement('fadeLayer').style.opacity);
  assert(entryFade > .1 && entryFade < .9, 'o fade de entrada deve progredir de forma gradual');
  advance(26);
  assert.strictEqual(hooks.transitionPhase(), 'celebration-in', 'a roda de comemoração deve surgir atrás da tela escura');
  assert(hooks.celebrationTime() > 0, 'a animação de comemoração deve iniciar no ponto escuro da transição');
  assert.strictEqual(hooks.stageArea(), 'exterior', 'a comemoração final deve voltar à fachada da Câmara');
  advance(46);
  assert.strictEqual(hooks.transitionPhase(), null, 'o fade-in deve terminar antes da comemoração continuar');
  assert.strictEqual(makeElement('fadeLayer').style.opacity, '0', 'a comemoração deve ficar totalmente visível');

  let guard = 0;
  while (hooks.transitionPhase() !== 'celebration-result-out' && guard < 380) {
    advance(1);
    guard += 1;
  }
  assert.strictEqual(hooks.transitionPhase(), 'celebration-result-out', 'o encerramento deve usar um novo fade-out');
  advance(22);
  const resultFadeOut = Number(makeElement('fadeLayer').style.opacity);
  assert(resultFadeOut > .1 && resultFadeOut < .9, 'o fade para o resultado deve ser gradual');

  guard = 0;
  while (!makeElement('resultOverlay').classList.contains('visible') && guard < 60) {
    advance(1);
    guard += 1;
  }
  assert(makeElement('resultOverlay').classList.contains('visible'), 'a tela de vitória deve aparecer atrás do fade');
  assert.strictEqual(hooks.transitionPhase(), 'result-in', 'a tela de vitória deve ser revelada com fade-in');
  advance(22);
  const resultFadeIn = Number(makeElement('fadeLayer').style.opacity);
  assert(resultFadeIn > .1 && resultFadeIn < .9, 'a revelação do resultado deve ser gradual');
  advance(28);
  assert.strictEqual(hooks.transitionPhase(), null, 'a transição final deve concluir sem permanecer travada');
  assert.strictEqual(makeElement('fadeLayer').style.opacity, '0', 'o resultado deve terminar totalmente visível');

  assert(!makeElement('gameShell').classList.contains('playing'), 'os controles de jogo devem ser ocultados após a vitória');
  assert(!makeElement('menuOverlay').classList.contains('visible'), 'o menu deve estar oculto durante a partida');
  assert(document.body.classList.contains('ios-device'), 'o cliente deve detectar o iPhone');
  assert(document.body.classList.contains('pseudo-fullscreen'), 'o fallback de tela cheia do iPhone deve ser ativado');
  assert(spriteDrawCalls > 100, 'as folhas raster devem ser desenhadas no Canvas');
  assert.strictEqual(heroWalkFrames.size, 4, 'a caminhada do protagonista deve percorrer os quatro quadros alternados');
  assert.strictEqual(heroCelebrationFrames.size, 4, 'a comemoração deve percorrer os quatro quadros do protagonista');
  assert(supporterFrames.size >= 8, 'a torcida inicial deve alternar os dois quadros de quatro apoiadores diferentes');
  assert(drawnTexts.includes('1444'), 'placas e bandeiras da torcida devem exibir o número 1444');
  assert(makeElement('resultStats').innerHTML.includes('/12'), 'o resultado deve contabilizar os doze oponentes');
  assert([...loadedImages].some(src => src.includes('/supporters.png?v=5.4.0')), 'a folha da torcida 5.4 deve ser carregada');
  assert([...loadedImages].some(src => src.includes('/hero-celebrate.png?v=5.4.0')), 'a animação final 5.4 deve ser carregada');
  assert([...loadedImages].some(src => src.includes('/assessor.png?v=5.4.0')), 'o assessor deve usar a nova folha de sprites');
  assert([...loadedImages].some(src => src.includes('/lider.png?v=5.4.0')), 'o líder deve usar a nova folha de sprites');
  for (const stage of ['avenida-brasil', 'almirante-barroso', 'praca-biblia', 'catedral-sao-joao', 'praca-paz', 'camara-municipal', 'camara-plenario']) {
    assert([...loadedImages].some(src => src.includes(`/assets/stages/${stage}.png?v=5.4.0`)), `o cenário ${stage} 5.4 deve ser carregado`);
  }
  assert(spriteSourceRects.every(rect => (
    rect.sourceX % 128 === 2 && rect.sourceY % 128 === 2 &&
    rect.sourceWidth === 124 && rect.sourceHeight === 124 &&
    rect.sourceX + rect.sourceWidth <= 512 && rect.sourceY + rect.sourceHeight <= 512
  )), 'cada desenho deve ficar dentro da célula da folha, sem capturar fragmentos vizinhos');
  assert(drawCalls > 5000, 'o Canvas deve desenhar cenário, HUD e sprites');
  console.log(`Smoke test OK: ${drawCalls} operações de desenho em ${timelineFrame} frames.`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

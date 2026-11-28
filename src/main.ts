import Phaser from 'phaser';
import { APP_VERSION, GameController } from './game/controller.ts';
import { WorldScene } from './scenes/WorldScene.ts';
import { GameUiRenderer } from './ui/gameUi.ts';
import './ui/styles.css';

export interface LingoWildDiagnostics {
  readonly version: string;
  readonly bootDurationMs: number;
  readonly getTileClientCenter: (tileX: number, tileY: number) => { x: number; y: number } | null;
  readonly getMovementTelemetry: () => ReturnType<WorldScene['getMovementTelemetry']>;
  readonly getSnapshot: () => {
    readonly regionId: string;
    readonly playerPos: { readonly x: number; readonly y: number; readonly facing: string };
    readonly stepCount: number;
    readonly partyCount: number;
    readonly caughtCount: number;
    readonly discoveredCount: number;
    readonly activeModal: string;
    readonly hasActiveDialogue: boolean;
    readonly hasActiveBattle: boolean;
    readonly mainStoryCompleted: boolean;
    readonly gleamingCount: number;
    readonly rematchCount: number;
    readonly tracesCount: number;
    readonly uiLanguage: string;
    readonly learningLanguage: string;
    readonly contentLanguage: string;
    readonly hskLevel: string;
    readonly difficulty: string;
    readonly guidanceMode: string;
    readonly onboardingStep: string | null;
    readonly fps: number;
  };
}

declare global {
  interface Window {
    __LINGOWILD_DIAGNOSTICS__?: LingoWildDiagnostics;
  }
}

const bootStart = performance.now();

const creaturesUrl = new URL('./assets/sprites/creatures.png', window.location.href).toString();
const companionsUrl = new URL('./assets/sprites/companions.png', window.location.href).toString();
const itemsUrl = new URL('./assets/sprites/items.png', window.location.href).toString();
document.documentElement.style.setProperty('--creatures-sheet-url', `url("${creaturesUrl}")`);
document.documentElement.style.setProperty('--companions-sheet-url', `url("${companionsUrl}")`);
document.documentElement.style.setProperty('--items-sheet-url', `url("${itemsUrl}")`);

const rootEl = document.getElementById('lingowild-root');
const viewportEl = document.getElementById('phaser-viewport');
const overlayEl = document.getElementById('ui-overlay');

if (!rootEl || !viewportEl || !overlayEl) {
  throw new Error('Missing required LingoWild DOM mount containers');
}

const controller = new GameController();
controller.startPlaytimeClock();

const worldScene = new WorldScene(controller);

function selectOptimalPhaserRenderer(): number {
  if (typeof navigator !== 'undefined' && /HeadlessChrome/i.test(navigator.userAgent)) {
    return Phaser.CANVAS;
  }
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl') ?? probe.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) {
      return Phaser.CANVAS;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) {
      return Phaser.CANVAS;
    }
  } catch {
    return Phaser.CANVAS;
  }
  return Phaser.AUTO;
}

const phaserGame = new Phaser.Game({
  type: selectOptimalPhaserRenderer(),
  parent: viewportEl,
  width: Math.max(320, viewportEl.clientWidth || window.innerWidth),
  height: Math.max(240, viewportEl.clientHeight || window.innerHeight),
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1b2820',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  audio: {
    noAudio: true,
  },
  banner: false,
  scene: [worldScene],
});

const syncViewportResize = () => {
  const w = Math.max(240, viewportEl.clientWidth);
  const h = Math.max(240, viewportEl.clientHeight);
  if (phaserGame.scale && (phaserGame.scale.width !== w || phaserGame.scale.height !== h)) {
    phaserGame.scale.resize(w, h);
  }
};

if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => syncViewportResize());
  ro.observe(viewportEl);
}
window.addEventListener('resize', syncViewportResize);

new GameUiRenderer(rootEl, overlayEl, controller);

const bootDurationMs = Math.round(performance.now() - bootStart);

window.__LINGOWILD_DIAGNOSTICS__ = {
  version: APP_VERSION,
  bootDurationMs,
  getTileClientCenter: (tileX, tileY) => worldScene.getTileClientCenter(tileX, tileY),
  getMovementTelemetry: () => worldScene.getMovementTelemetry(),
  getSnapshot: () => ({
    regionId: controller.state.regionId,
    playerPos: { ...controller.state.playerPos },
    stepCount: controller.state.stepCount,
    partyCount: controller.state.party.length,
    caughtCount: controller.state.caughtSpecies.length,
    discoveredCount: controller.state.discoveredSpecies.length,
    activeModal: controller.activeModal,
    hasActiveDialogue: controller.activeDialogue !== null,
    hasActiveBattle: controller.activeBattle !== null,
    mainStoryCompleted: Boolean(controller.state.flags.main_story_completed),
    gleamingCount: controller.state.gleamingSpecies.length,
    rematchCount: controller.state.rematchCleared.length,
    tracesCount: controller.state.discoveredTraces.length,
    uiLanguage: controller.state.settings.uiLanguage ?? 'vi',
    learningLanguage: controller.state.settings.learningLanguage ?? 'en',
    contentLanguage: controller.state.settings.contentLanguage ?? 'bilingual',
    hskLevel: controller.state.settings.hskLevel ?? 'HSK2',
    difficulty: controller.state.settings.difficulty ?? 'relaxed',
    guidanceMode: controller.state.settings.guidanceMode ?? 'full',
    onboardingStep: controller.activeOnboardingPrompt?.id ?? null,
    fps: worldScene.measuredFps,
  }),
};

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

window.addEventListener('beforeunload', () => {
  controller.stopPlaytimeClock();
});
void phaserGame;

import Phaser from 'phaser';
import { MAPS_BY_ID } from '../data/maps.ts';
import { NPCS } from '../data/npcs.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import { getNpcQuestMarker } from '../domain/navigation.ts';
import type {
  BattleSpeedMode,
  Direction,
  ElementType,
  MapDecoration,
  RegionId,
  RegionMapDefinition,
  TimeOfDay,
} from '../domain/types.ts';
import { getTileAt, isPropVisible } from '../domain/world.ts';
import type { BattleVisualCue, GameController } from '../game/controller.ts';
import {
  getNpcsInRegion,
  worldPointToTile,
  type MovementVisualSnapshot,
} from '../game/movement.ts';

const DIR_IDLE_COL: Readonly<Record<Direction, number>> = {
  down: 1,
  up: 4,
  left: 7,
  right: 10,
};

const DIR_WALK_COLS: Readonly<Record<Direction, readonly [number, number, number, number]>> = {
  down: [0, 1, 2, 1],
  up: [3, 4, 5, 4],
  left: [6, 7, 8, 7],
  right: [9, 10, 11, 10],
};

const TIME_TINT: Readonly<Record<TimeOfDay, { color: number; alpha: number }>> = {
  morning: { color: 0xffe8ba, alpha: 0.06 },
  day: { color: 0xffffff, alpha: 0 },
  dusk: { color: 0xd97538, alpha: 0.19 },
  night: { color: 0x10223d, alpha: 0.34 },
};

const ELEMENT_VFX_FRAME: Readonly<Record<ElementType, number>> = {
  leaf: 0,
  water: 1,
  ember: 2,
  stone: 3,
  gale: 4,
  spark: 5,
  neutral: 6,
};

const REGION_BATTLE_BG_FRAME: Readonly<Record<RegionId, number>> = {
  mosslight_hub: 0,
  whisperwood: 1,
  reedwater_fen: 2,
  terracotta_ridge: 3,
  starfall_sanctuary: 4,
};

const REGION_PARTICLE_COLOR: Readonly<Record<RegionId, number>> = {
  mosslight_hub: 0xfff0a6,
  whisperwood: 0xc4f59d,
  reedwater_fen: 0xc7f7ff,
  terracotta_ridge: 0xffe094,
  starfall_sanctuary: 0xfff5b8,
};

function speedFactor(mode: BattleSpeedMode): number {
  if (mode === 'instant') return 0;
  if (mode === 'fast') return 0.52;
  return 1;
}

export class WorldScene extends Phaser.Scene {
  private readonly controller: GameController;
  private renderedRegion: RegionId | null = null;
  private groundLayer!: Phaser.GameObjects.Container;
  private shadowLayer!: Phaser.GameObjects.Container;
  private navLayer!: Phaser.GameObjects.Container;
  private clickPathGraphics!: Phaser.GameObjects.Graphics;
  private objectLayer!: Phaser.GameObjects.Container;
  private canopyLayer!: Phaser.GameObjects.Container;
  private ambientLayer!: Phaser.GameObjects.Container;
  private markerLayer!: Phaser.GameObjects.Container;
  private lightGlowLayer!: Phaser.GameObjects.Container;
  private lastTrailSignature = '';
  private lastMarkerSignature = '';
  private lastClickPathVersion = -1;
  private camCenterX = 0;
  private camCenterY = 0;
  private camInitialized = false;
  private clickPulsePhase = 0;
  private battleContainer!: Phaser.GameObjects.Container;
  private battleUnderfill!: Phaser.GameObjects.Rectangle;
  private battleBgSprite!: Phaser.GameObjects.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private companionShadow!: Phaser.GameObjects.Ellipse;
  private companionGleamRing!: Phaser.GameObjects.Arc;
  private companionSprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private timeOverlay!: Phaser.GameObjects.Rectangle;
  private regionFadeRect!: Phaser.GameObjects.Rectangle;

  private animatedTiles: Array<{
    sprite: Phaser.GameObjects.Sprite;
    frames: ReadonlyArray<number | string>;
  }> = [];
  private ambientMotes: Array<{
    dot: Phaser.GameObjects.Arc;
    vx: number;
    vy: number;
  }> = [];
  private mistBands: Array<{
    cloud: Phaser.GameObjects.Ellipse;
    vx: number;
  }> = [];
  private propSprites = new Map<string, Phaser.GameObjects.Sprite>();

  private enemyShadow!: Phaser.GameObjects.Ellipse;
  private playerBattleShadow!: Phaser.GameObjects.Ellipse;
  private enemyBattleSprite!: Phaser.GameObjects.Sprite;
  private playerBattleSprite!: Phaser.GameObjects.Sprite;
  private gleamingAuraSprite!: Phaser.GameObjects.Sprite;
  private vfxSprite!: Phaser.GameObjects.Sprite;
  private damagePopupText!: Phaser.GameObjects.Text;

  private animCycleStep = 0;
  private lastVisualCueId = 0;
  private wasInBattle = false;
  private enemyHomePos = { x: 240, y: 92 };
  private playerHomePos = { x: 96, y: 156 };
  private unsubscribe: (() => void) | null = null;
  public measuredFps = 60;
  public lastFrameDeltaMs = 16.67;

  public constructor(controller: GameController) {
    super('WorldScene');
    this.controller = controller;
  }

  public preload(): void {
    this.load.spritesheet('tileset', './assets/sprites/tileset.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.image('structures', './assets/sprites/structures.png');
    this.load.spritesheet('battle-bg', './assets/sprites/battle-bg.png', {
      frameWidth: 384,
      frameHeight: 216,
    });
    this.load.spritesheet('characters', './assets/sprites/characters.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('creatures', './assets/sprites/creatures.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
    this.load.spritesheet('companions', './assets/sprites/companions.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('items', './assets/sprites/items.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('vfx', './assets/sprites/vfx.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  private registerStructureFrames(): void {
    const tex = this.textures.get('structures');
    if (!tex || tex.has('lodge_roof')) return;
    tex.add('lodge_roof', 0, 0, 0, 80, 32);
    tex.add('lodge_body', 0, 0, 32, 80, 48);
    tex.add('cabin_roof', 0, 80, 0, 32, 16);
    tex.add('cabin_body', 0, 80, 16, 32, 32);
    tex.add('stall_awning', 0, 112, 0, 80, 32);
    tex.add('stall_counter', 0, 112, 32, 80, 48);
    tex.add('arch_top', 0, 192, 0, 64, 32);
    tex.add('arch_base', 0, 192, 32, 64, 32);
    tex.add('fountain_0', 0, 0, 80, 48, 48);
    tex.add('fountain_1', 0, 48, 80, 48, 48);
    tex.add('fountain_2', 0, 96, 80, 48, 48);
    tex.add('bench_back', 0, 144, 80, 48, 16);
    tex.add('bench_seat', 0, 144, 96, 48, 16);
    tex.add('fallen_log', 0, 192, 80, 48, 16);
    tex.add('statue_top', 0, 192, 96, 32, 16);
    tex.add('statue_base', 0, 192, 112, 32, 32);
    tex.add('waterfall_3x3', 0, 0, 128, 48, 48);
    tex.add('tree_cluster_2x2', 0, 48, 128, 32, 32);
  }

  public create(): void {
    this.registerStructureFrames();
    this.groundLayer = this.add.container(0, 0).setDepth(1);
    this.shadowLayer = this.add.container(0, 0).setDepth(3);
    this.navLayer = this.add.container(0, 0).setDepth(4);
    this.clickPathGraphics = this.add.graphics().setDepth(4.5);
    this.objectLayer = this.add.container(0, 0).setDepth(5);
    this.companionShadow = this.add.ellipse(8, 14, 10, 4, 0x0e1410, 0.28).setDepth(8);
    this.companionGleamRing = this.add
      .circle(8, 8, 9.5, 0xffe880, 0.34)
      .setStrokeStyle(1, 0xfff8c9, 0.75)
      .setDepth(8.5)
      .setVisible(false);
    this.companionSprite = this.add
      .sprite(0, 0, 'companions', 0)
      .setOrigin(0, 0)
      .setDepth(9)
      .setVisible(false);
    this.playerShadow = this.add.ellipse(8, 15, 11, 4.5, 0x0e1410, 0.32).setDepth(9);
    this.playerSprite = this.add.sprite(0, 0, 'characters', 1).setOrigin(0, 0).setDepth(10);
    this.canopyLayer = this.add.container(0, 0).setDepth(15);
    this.ambientLayer = this.add.container(0, 0).setDepth(18);
    this.markerLayer = this.add.container(0, 0).setDepth(20);

    this.timeOverlay = this.add
      .rectangle(0, 0, 2048, 2048, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(22);

    this.lightGlowLayer = this.add.container(0, 0).setDepth(24);

    this.regionFadeRect = this.add
      .rectangle(0, 0, 2048, 2048, 0x101812, 0)
      .setOrigin(0, 0)
      .setDepth(28);

    this.createBattleLayer();
    this.rebuildRegionMap(this.controller.state.regionId, false);
    this.syncFromController();
    this.applyMovementVisuals(this.controller.movement.getSnapshot(), 0, true);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.controller.state.settings.clickToMove === false) return;
      if (this.controller.isOverworldLocked()) return;
      if (!pointer.wasTouch && pointer.button !== 0) return;
      const rawEvent = pointer.event as Event | undefined;
      if (rawEvent && rawEvent.target && rawEvent.target !== this.game.canvas) {
        return;
      }
      const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tile = worldPointToTile(worldPt.x, worldPt.y, 16);
      this.controller.requestClickToMove(tile.x, tile.y);
    });

    const onBattleUiLayout = () => {
      if (
        this.controller.activeBattle &&
        !this.tweens.isTweening(this.playerBattleSprite) &&
        !this.tweens.isTweening(this.enemyBattleSprite)
      ) {
        this.enterOrLayoutBattleCamera();
      }
    };
    window.addEventListener('lingowild:battle-ui-layout', onBattleUiLayout);

    this.scale.on('resize', () => {
      if (this.controller.activeBattle) {
        this.enterOrLayoutBattleCamera();
      } else {
        this.configureWorldCamera(true);
      }
    });

    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => {
        if (this.controller.state.settings.reducedMotion) return;
        this.animCycleStep = (this.animCycleStep + 1) % 6;
        for (const item of this.animatedTiles) {
          const nextFrame = item.frames[this.animCycleStep % item.frames.length];
          if (nextFrame !== undefined) {
            item.sprite.setFrame(nextFrame);
          }
        }
        this.refreshCompanionAppearance();
        this.refreshBattleCreatureFrames();
      },
    });

    this.unsubscribe = this.controller.subscribe(() => {
      this.syncFromController();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('lingowild:battle-ui-layout', onBattleUiLayout);
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    });
  }

  public override update(_time: number, delta: number): void {
    this.lastFrameDeltaMs = delta;
    if (this.game.loop.actualFps > 0) {
      this.measuredFps = Math.round(this.game.loop.actualFps);
    }

    const clampedDt = Math.max(0, Math.min(delta, 50));
    if (!this.controller.activeBattle) {
      const moveSnap = this.controller.tickMovement(clampedDt);
      this.applyMovementVisuals(moveSnap, clampedDt, false);
    }

    if (!this.controller.state.settings.reducedMotion && !this.controller.activeBattle) {
      const map = MAPS_BY_ID[this.controller.state.regionId];
      const maxW = map.width * 16;
      const maxH = map.height * 16;
      const dt = clampedDt * 0.001;
      for (const m of this.ambientMotes) {
        m.dot.x += m.vx * dt;
        m.dot.y += m.vy * dt;
        if (m.dot.x < 0) m.dot.x += maxW;
        if (m.dot.x > maxW) m.dot.x -= maxW;
        if (m.dot.y < 0) m.dot.y += maxH;
        if (m.dot.y > maxH) m.dot.y -= maxH;
      }
      for (const band of this.mistBands) {
        band.cloud.x += band.vx * dt;
        if (band.cloud.x > maxW + 140) {
          band.cloud.x = -160;
        }
      }
    }
  }

  public getTileClientCenter(tileX: number, tileY: number): { x: number; y: number } | null {
    if (!this.game.canvas) return null;
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const worldX = tileX * 16 + 8;
    const worldY = tileY * 16 + 8;
    const scaleX = rect.width / Math.max(1, this.scale.width);
    const scaleY = rect.height / Math.max(1, this.scale.height);
    const camLocalX = (worldX - cam.worldView.x) * cam.zoom;
    const camLocalY = (worldY - cam.worldView.y) * cam.zoom;
    return {
      x: rect.left + camLocalX * scaleX,
      y: rect.top + camLocalY * scaleY,
    };
  }

  public getMovementTelemetry(): {
    readonly visualX: number;
    readonly visualY: number;
    readonly spriteX: number;
    readonly spriteY: number;
    readonly companionSpriteX: number;
    readonly companionSpriteY: number;
    readonly camScrollX: number;
    readonly camScrollY: number;
    readonly camZoom: number;
    readonly isMoving: boolean;
    readonly activePathLength: number;
    readonly isRunning: boolean;
    readonly lastFrameDeltaMs: number;
  } {
    const snap = this.controller.movement.getSnapshot();
    const cam = this.cameras.main;
    return {
      visualX: Number(snap.visualX.toFixed(3)),
      visualY: Number(snap.visualY.toFixed(3)),
      spriteX: Number(this.playerSprite.x.toFixed(2)),
      spriteY: Number(this.playerSprite.y.toFixed(2)),
      companionSpriteX: Number(this.companionSprite.x.toFixed(2)),
      companionSpriteY: Number(this.companionSprite.y.toFixed(2)),
      camScrollX: Number(cam.scrollX.toFixed(2)),
      camScrollY: Number(cam.scrollY.toFixed(2)),
      camZoom: cam.zoom,
      isMoving: snap.isMoving,
      activePathLength: snap.activePath.length,
      isRunning: snap.isRunning,
      lastFrameDeltaMs: Number(this.lastFrameDeltaMs.toFixed(2)),
    };
  }

  private configureWorldCamera(snapNow: boolean = false): void {
    const cam = this.cameras.main;
    const map = MAPS_BY_ID[this.controller.state.regionId];
    const worldW = map.width * 16;
    const worldH = map.height * 16;
    const viewW = Math.max(240, this.scale.width);
    const viewH = Math.max(240, this.scale.height);

    const minCoverZoom = Math.max(viewW / worldW, viewH / worldH);
    const crispZoom = Math.max(2, Math.min(3.5, Math.ceil(minCoverZoom * 2) / 2));

    cam.stopFollow();
    cam.setBounds(0, 0, worldW, worldH);
    cam.setZoom(crispZoom);
    cam.roundPixels = false;

    if (snapNow || !this.camInitialized) {
      const snap = this.controller.movement.getSnapshot();
      this.updateSmoothWorldCamera(snap.visualX * 16 + 8, snap.visualY * 16 + 8, 0, true);
    }
  }

  private updateSmoothWorldCamera(
    targetWorldX: number,
    targetWorldY: number,
    deltaMs: number,
    instant: boolean,
  ): void {
    const cam = this.cameras.main;
    const map = MAPS_BY_ID[this.controller.state.regionId];
    const worldW = map.width * 16;
    const worldH = map.height * 16;
    const viewWorldW = this.scale.width / cam.zoom;
    const viewWorldH = this.scale.height / cam.zoom;
    const halfW = viewWorldW * 0.5;
    const halfH = viewWorldH * 0.5;

    const clampedTargetX =
      worldW <= viewWorldW ? worldW * 0.5 : Phaser.Math.Clamp(targetWorldX, halfW, worldW - halfW);
    const clampedTargetY =
      worldH <= viewWorldH ? worldH * 0.5 : Phaser.Math.Clamp(targetWorldY, halfH, worldH - halfH);

    if (instant || !this.camInitialized || this.controller.state.settings.reducedMotion) {
      this.camCenterX = clampedTargetX;
      this.camCenterY = clampedTargetY;
      this.camInitialized = true;
    } else {
      // Frame-rate-independent exponential smoothing identical across 30/60/120 Hz
      const dtSec = Math.max(0, Math.min(deltaMs, 50)) * 0.001;
      const alpha = 1 - Math.exp(-15 * dtSec);
      this.camCenterX += (clampedTargetX - this.camCenterX) * alpha;
      this.camCenterY += (clampedTargetY - this.camCenterY) * alpha;
      if (Math.abs(clampedTargetX - this.camCenterX) < 0.05) this.camCenterX = clampedTargetX;
      if (Math.abs(clampedTargetY - this.camCenterY) < 0.05) this.camCenterY = clampedTargetY;
    }

    const rawScrollX = this.camCenterX - cam.width * 0.5;
    const rawScrollY = this.camCenterY - cam.height * 0.5;
    // Snap scroll to exact screen pixels (1 / zoom world increments) for crisp pixel art without 3px stair-step jitter
    cam.setScroll(
      Math.round(rawScrollX * cam.zoom) / cam.zoom,
      Math.round(rawScrollY * cam.zoom) / cam.zoom,
    );
  }

  private applyMovementVisuals(
    snap: MovementVisualSnapshot,
    deltaMs: number,
    snapCamera: boolean,
  ): void {
    const px = snap.visualX * 16;
    const py = snap.visualY * 16;
    this.playerSprite.setPosition(px, py);
    this.playerShadow.setPosition(px + 8, py + 15);

    if (snap.isMoving && !this.controller.state.settings.reducedMotion) {
      const walkCols = DIR_WALK_COLS[snap.facing];
      const frameIdx = Math.floor(snap.walkCyclePhase) % 4;
      this.playerSprite.setFrame(walkCols[frameIdx]!);
    } else {
      this.playerSprite.setFrame(DIR_IDLE_COL[snap.facing]);
    }

    const fx = snap.companionVisualX * 16;
    const fy = snap.companionVisualY * 16;
    this.companionSprite.setPosition(fx, fy);
    this.companionShadow.setPosition(fx + 8, fy + 14);
    this.companionGleamRing.setPosition(fx + 8, fy + 8);

    this.updateSmoothWorldCamera(px + 8, py + 8, deltaMs, snapCamera);
    this.renderClickPathOverlay(snap, deltaMs);
  }

  private renderClickPathOverlay(snap: MovementVisualSnapshot, deltaMs: number): void {
    const hasVisual =
      snap.activePath.length > 0 || snap.activeGoal !== null || snap.blockedMarker !== null;
    if (!hasVisual && this.lastClickPathVersion === snap.pathVersion) {
      return;
    }

    if (!this.controller.state.settings.reducedMotion && hasVisual) {
      this.clickPulsePhase = (this.clickPulsePhase + deltaMs * 0.006) % (Math.PI * 2);
    } else if (!hasVisual && this.lastClickPathVersion !== snap.pathVersion) {
      this.clickPathGraphics.clear();
      this.lastClickPathVersion = snap.pathVersion;
      return;
    }

    this.lastClickPathVersion = snap.pathVersion;
    this.clickPathGraphics.clear();
    if (!hasVisual || this.controller.activeBattle) return;

    const pulse = this.controller.state.settings.reducedMotion
      ? 0.5
      : 0.5 + 0.5 * Math.sin(this.clickPulsePhase);

    // Distinct cool aqua-cyan stepping markers for player-chosen click-to-move (distinct from golden quest trail!)
    for (let i = 0; i < snap.activePath.length; i++) {
      const pt = snap.activePath[i]!;
      const cx = pt.x * 16 + 8;
      const cy = pt.y * 16 + 10;
      const alpha = Math.max(0.32, 0.72 - i * 0.015);
      this.clickPathGraphics.fillStyle(0x57e3ff, alpha);
      this.clickPathGraphics.lineStyle(1, 0x164459, alpha);
      this.clickPathGraphics.fillCircle(cx, cy, i === snap.activePath.length - 1 ? 2.8 : 2.0);
      this.clickPathGraphics.strokeCircle(cx, cy, i === snap.activePath.length - 1 ? 2.8 : 2.0);
    }

    if (snap.activeGoal) {
      const gx = snap.activeGoal.x * 16 + 8;
      const gy = snap.activeGoal.y * 16 + 9;
      const isInteractable =
        snap.activeGoal.kind === 'npc' ||
        snap.activeGoal.kind === 'prop' ||
        snap.activeGoal.kind === 'portal';
      const ringColor = isInteractable ? 0x62f2b6 : 0x57e3ff;
      const radius = 5.5 + pulse * 1.6;
      this.clickPathGraphics.fillStyle(ringColor, 0.16 + pulse * 0.08);
      this.clickPathGraphics.lineStyle(1.4, ringColor, 0.85);
      this.clickPathGraphics.fillCircle(gx, gy, radius);
      this.clickPathGraphics.strokeCircle(gx, gy, radius);
    }

    if (snap.blockedMarker) {
      const bx = snap.blockedMarker.x * 16 + 8;
      const by = snap.blockedMarker.y * 16 + 8;
      const alpha = Math.max(0.15, Math.min(1, snap.blockedMarker.remainingMs / 520));
      this.clickPathGraphics.lineStyle(1.8, 0xe85a3c, alpha);
      this.clickPathGraphics.beginPath();
      this.clickPathGraphics.moveTo(bx - 4, by - 4);
      this.clickPathGraphics.lineTo(bx + 4, by + 4);
      this.clickPathGraphics.moveTo(bx + 4, by - 4);
      this.clickPathGraphics.lineTo(bx - 4, by + 4);
      this.clickPathGraphics.strokePath();
    }
  }

  private enterOrLayoutBattleCamera(): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.removeBounds();
    cam.setZoom(1);
    cam.setScroll(0, 0);

    const w = Math.max(300, this.scale.width);
    const h = Math.max(260, this.scale.height);
    const isShortLandscape = h < 500;
    const isCompact = w < 560 || isShortLandscape;
    const spriteScale = isShortLandscape ? 1.65 : isCompact ? 2.15 : 2.75;

    let hudBottom = Math.round(h * (isShortLandscape ? 0.13 : 0.11));
    let deckTop = Math.round(h * (isShortLandscape ? 0.59 : isCompact ? 0.6 : 0.64));
    if (typeof document !== 'undefined' && this.game.canvas) {
      const canvasRect = this.game.canvas.getBoundingClientRect();
      if (canvasRect.height > 0) {
        const hudEl = document.querySelector('.lw-battle-hud');
        if (hudEl) {
          const hr = hudEl.getBoundingClientRect();
          if (hr.height > 0) {
            hudBottom = Math.max(38, Math.round(hr.bottom - canvasRect.top));
          }
        }
        const deckEl = document.querySelector('[data-testid="battle-deck"]');
        if (deckEl) {
          const dr = deckEl.getBoundingClientRect();
          if (dr.height > 0) {
            deckTop = Math.min(
              h - 72,
              Math.max(hudBottom + 108, Math.round(dr.top - canvasRect.top)),
            );
          }
        }
      }
    }

    this.battleUnderfill.setPosition(0, 0).setSize(w, h);

    // Cover-scale the 384x216 artist pixel battle background and keep both pads strictly above deckTop
    const bgFrame = REGION_BATTLE_BG_FRAME[this.controller.state.regionId];
    const stageTop = hudBottom + 6;
    const stageBottom = Math.max(stageTop + 96, deckTop - 8);
    const scaleCover = Math.max(w / 384, (stageBottom + 36) / 216);
    const bgDisplayW = Math.round(384 * scaleCover);
    const bgDisplayH = Math.round(216 * scaleCover);
    const bgCenterX = Math.round(w * 0.5);

    const shadowMargin = Math.round(7 * spriteScale);
    const desiredPadPlayerY = Math.min(
      stageBottom - shadowMargin,
      Math.round(stageTop + (stageBottom - stageTop) * 0.85),
    );
    const bgTop = Math.min(0, Math.round(desiredPadPlayerY - bgDisplayH * 0.79));
    const bgCenterY = Math.round(bgTop + bgDisplayH * 0.5);

    this.battleBgSprite
      .setFrame(bgFrame)
      .setPosition(bgCenterX, bgCenterY)
      .setDisplaySize(bgDisplayW, bgDisplayH);

    const bgLeft = bgCenterX - bgDisplayW * 0.5;

    // Align creature feet onto the pixel-art combatant rings at (0.71, 0.56) and (0.28, 0.79), clamped inside visible stage
    const padEnemyX = Math.round(bgLeft + bgDisplayW * 0.71);
    const padEnemyY = Math.round(bgTop + bgDisplayH * 0.56);
    const padPlayerX = Math.round(bgLeft + bgDisplayW * 0.28);
    const padPlayerY = Math.min(
      stageBottom - shadowMargin,
      Math.round(bgTop + bgDisplayH * 0.79),
    );

    const minEnemyY = stageTop + Math.round(18 * spriteScale);
    const maxPlayerY = stageBottom - Math.round(21 * spriteScale);

    const enemyX = Phaser.Math.Clamp(padEnemyX, Math.round(w * 0.58), Math.round(w * 0.84));
    const enemyY = Phaser.Math.Clamp(
      padEnemyY - Math.round(16 * spriteScale),
      minEnemyY,
      Math.max(minEnemyY, maxPlayerY - Math.round(14 * spriteScale)),
    );
    const playerX = Phaser.Math.Clamp(padPlayerX, Math.round(w * 0.16), Math.round(w * 0.42));
    const playerY = Phaser.Math.Clamp(
      padPlayerY - Math.round(16 * spriteScale),
      minEnemyY + Math.round(10 * spriteScale),
      Math.max(minEnemyY + Math.round(10 * spriteScale), maxPlayerY),
    );

    this.enemyHomePos = { x: enemyX, y: enemyY };
    this.playerHomePos = { x: playerX, y: playerY };

    this.enemyShadow
      .setPosition(enemyX, enemyY + Math.round(17 * spriteScale))
      .setSize(Math.round(30 * spriteScale), Math.round(8 * spriteScale));
    this.playerBattleShadow
      .setPosition(playerX, playerY + Math.round(18 * spriteScale))
      .setSize(Math.round(34 * spriteScale), Math.round(9 * spriteScale));

    this.enemyBattleSprite.setPosition(enemyX, enemyY).setScale(spriteScale);
    this.playerBattleSprite.setPosition(playerX, playerY).setScale(spriteScale * 1.05);
    this.gleamingAuraSprite.setPosition(enemyX, enemyY - Math.round(8 * spriteScale));

    if (this.game.canvas) {
      this.game.canvas.dataset.playerBottomY = String(Math.round(playerY + 21 * spriteScale));
      this.game.canvas.dataset.enemyTopY = String(Math.round(enemyY - 19 * spriteScale));
    }
  }

  private createBattleLayer(): void {
    this.battleContainer = this.add.container(0, 0).setDepth(40).setVisible(false);
    this.battleUnderfill = this.add.rectangle(0, 0, 1280, 820, 0x1a261e, 1).setOrigin(0, 0);
    this.battleBgSprite = this.add.sprite(192, 108, 'battle-bg', 0).setOrigin(0.5, 0.5);
    this.enemyShadow = this.add.ellipse(248, 112, 84, 22, 0x0b120d, 0.36);
    this.playerBattleShadow = this.add.ellipse(98, 168, 96, 24, 0x0b120d, 0.38);
    this.enemyBattleSprite = this.add.sprite(248, 86, 'creatures', 0);
    this.playerBattleSprite = this.add.sprite(98, 140, 'creatures', 0).setFlipX(true);
    this.gleamingAuraSprite = this.add
      .sprite(248, 72, 'vfx', 8)
      .setScale(1.8)
      .setAlpha(0.85)
      .setVisible(false);
    this.vfxSprite = this.add.sprite(0, 0, 'vfx', 0).setScale(2.2).setVisible(false);
    this.damagePopupText = this.add
      .text(0, 0, '', {
        fontFamily: 'Segoe UI, Tahoma, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#fff8dc',
        stroke: '#231f1a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.battleContainer.add([
      this.battleUnderfill,
      this.battleBgSprite,
      this.enemyShadow,
      this.playerBattleShadow,
      this.enemyBattleSprite,
      this.playerBattleSprite,
      this.gleamingAuraSprite,
      this.vfxSprite,
      this.damagePopupText,
    ]);
  }

  private pickShoreOrWaterFrame(map: RegionMapDefinition, x: number, y: number): number {
    const isWaterLike = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
      const k = getTileAt(map, tx, ty);
      return k === 'water' || k === 'bridge' || k === 'reed_marsh';
    };
    const mask =
      (isWaterLike(x, y - 1) ? 1 : 0) |
      (isWaterLike(x + 1, y) ? 2 : 0) |
      (isWaterLike(x, y + 1) ? 4 : 0) |
      (isWaterLike(x - 1, y) ? 8 : 0);
    return mask === 15 ? 7 : 96 + mask;
  }

  private pickRoadFrame(map: RegionMapDefinition, x: number, y: number): number {
    const isRoadLike = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
      const k = getTileAt(map, tx, ty);
      return k === 'path' || k === 'bridge' || k === 'stone_floor' || k === 'portal';
    };
    const mask =
      (isRoadLike(x, y - 1) ? 1 : 0) |
      (isRoadLike(x + 1, y) ? 2 : 0) |
      (isRoadLike(x, y + 1) ? 4 : 0) |
      (isRoadLike(x - 1, y) ? 8 : 0);
    return 80 + mask;
  }

  private pickCanyonRoadFrame(map: RegionMapDefinition, x: number, y: number): number {
    const isRoadLike = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
      const k = getTileAt(map, tx, ty);
      return k === 'path' || k === 'bridge' || k === 'stone_floor' || k === 'portal';
    };
    const mask =
      (isRoadLike(x, y - 1) ? 1 : 0) |
      (isRoadLike(x + 1, y) ? 2 : 0) |
      (isRoadLike(x, y + 1) ? 4 : 0) |
      (isRoadLike(x - 1, y) ? 8 : 0);
    return 128 + mask;
  }

  private pickBoardwalkFrame(map: RegionMapDefinition, x: number, y: number): number {
    const isWalk = (tx: number, ty: number): boolean => {
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
      const k = getTileAt(map, tx, ty);
      return k === 'path' || k === 'bridge' || k === 'stone_floor' || k === 'portal';
    };
    const ns = isWalk(x, y - 1) || isWalk(x, y + 1);
    const ew = isWalk(x - 1, y) || isWalk(x + 1, y);
    if (ns && ew) return 120;
    if (ns) return 119;
    return 112;
  }

  private pickTreeFramesForBiome(
    regionId: RegionId,
    x: number,
    y: number,
  ): readonly [number, number] {
    const hash = (x * 7 + y * 13) % 3;
    if (regionId === 'starfall_sanctuary') return [42, 43];
    if (regionId === 'terracotta_ridge') return [40, 41];
    if (regionId === 'reedwater_fen') return hash === 0 ? [38, 39] : [36, 37];
    return hash === 0 ? [38, 39] : [36, 37];
  }

  private addWarmLightHalo(px: number, py: number, radius: number, color: number = 0xffcb70): void {
    const outer = this.add.circle(px, py, radius, color, 0.14);
    const inner = this.add.circle(px, py, radius * 0.52, 0xfff2b8, 0.2);
    this.lightGlowLayer.add([outer, inner]);
  }

  private rebuildRegionMap(regionId: RegionId, playFade: boolean): void {
    this.renderedRegion = regionId;
    this.groundLayer.removeAll(true);
    this.shadowLayer.removeAll(true);
    this.objectLayer.removeAll(true);
    this.canopyLayer.removeAll(true);
    this.ambientLayer.removeAll(true);
    this.lightGlowLayer.removeAll(true);
    this.animatedTiles = [];
    this.ambientMotes = [];
    this.mistBands = [];
    this.propSprites.clear();

    const map = MAPS_BY_ID[regionId];
    const baseGroundFrame =
      regionId === 'terracotta_ridge'
        ? 27
        : regionId === 'starfall_sanctuary'
          ? 78
          : regionId === 'reedwater_fen'
            ? 113
            : 0;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const px = x * 16;
        const py = y * 16;
        const kind = getTileAt(map, x, y);
        const hash = (x * 31 + y * 17) & 3;

        if (kind === 'grass') {
          const grassFrame =
            regionId === 'terracotta_ridge'
              ? 27
              : regionId === 'reedwater_fen' && (x * 19 + y * 7) % 5 === 0
                ? 113
                : (x + y) % 4 === 0
                  ? 1
                  : 0;
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', grassFrame).setOrigin(0, 0));
        } else if (kind === 'flowers') {
          const flFrame = 2 + ((x + y) % 3);
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', flFrame).setOrigin(0, 0));
        } else if (kind === 'tall_grass') {
          const tg = this.add.sprite(px, py, 'tileset', 5).setOrigin(0, 0);
          this.groundLayer.add(tg);
          this.animatedTiles.push({ sprite: tg, frames: [5, 6] });
        } else if (kind === 'water') {
          const wFrame = this.pickShoreOrWaterFrame(map, x, y);
          const ws = this.add.sprite(px, py, 'tileset', wFrame).setOrigin(0, 0);
          this.groundLayer.add(ws);
          if (wFrame === 7) {
            this.animatedTiles.push({ sprite: ws, frames: [7, 8] });
          }
        } else if (kind === 'path') {
          const pFrame =
            regionId === 'terracotta_ridge'
              ? this.pickCanyonRoadFrame(map, x, y)
              : regionId === 'reedwater_fen'
                ? this.pickBoardwalkFrame(map, x, y)
                : this.pickRoadFrame(map, x, y);
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', pFrame).setOrigin(0, 0));
        } else if (kind === 'bridge') {
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', 26).setOrigin(0, 0));
        } else if (kind === 'sand') {
          this.groundLayer.add(
            this.add.sprite(px, py, 'tileset', hash === 0 ? 28 : 27).setOrigin(0, 0),
          );
        } else if (kind === 'stone_floor') {
          const stoneFrame =
            regionId === 'starfall_sanctuary'
              ? 78
              : regionId === 'whisperwood' || regionId === 'reedwater_fen'
                ? 79
                : 29;
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', stoneFrame).setOrigin(0, 0));
        } else if (kind === 'reed_marsh') {
          const rm = this.add.sprite(px, py, 'tileset', 30).setOrigin(0, 0);
          this.groundLayer.add(rm);
          this.animatedTiles.push({ sprite: rm, frames: [30, 31] });
        } else if (kind === 'wall') {
          if (regionId === 'terracotta_ridge') {
            this.groundLayer.add(this.add.sprite(px, py, 'tileset', 32).setOrigin(0, 0));
          } else {
            const wallUnder = regionId === 'starfall_sanctuary' ? 78 : 0;
            this.groundLayer.add(this.add.sprite(px, py, 'tileset', wallUnder).setOrigin(0, 0));
            const [topF, botF] = this.pickTreeFramesForBiome(regionId, x, y);
            if (y === 0) {
              this.objectLayer.add(this.add.sprite(px, py, 'tileset', topF).setOrigin(0, 0));
            } else {
              this.shadowLayer.add(this.add.ellipse(px + 9, py + 14, 15, 6, 0x0c140e, 0.25));
              this.objectLayer.add(this.add.sprite(px, py, 'tileset', botF).setOrigin(0, 0));
              this.canopyLayer.add(
                this.add.sprite(px, (y - 1) * 16, 'tileset', topF).setOrigin(0, 0),
              );
            }
          }
        } else if (kind === 'cliff') {
          const aboveIsCliff = y > 0 && getTileAt(map, x, y - 1) === 'cliff';
          this.groundLayer.add(
            this.add.sprite(px, py, 'tileset', aboveIsCliff ? 33 : 34).setOrigin(0, 0),
          );
        } else if (kind === 'tree') {
          this.groundLayer.add(
            this.add
              .sprite(px, py, 'tileset', regionId === 'terracotta_ridge' ? 27 : 0)
              .setOrigin(0, 0),
          );
          this.shadowLayer.add(this.add.ellipse(px + 9, py + 14, 15, 6, 0x0c140e, 0.25));
          if (hash === 3 && x > 2 && y > 2 && x < map.width - 3 && y < map.height - 3) {
            this.objectLayer.add(this.add.sprite(px, py, 'tileset', 44).setOrigin(0, 0));
          } else {
            const [topF, botF] = this.pickTreeFramesForBiome(regionId, x, y);
            this.objectLayer.add(this.add.sprite(px, py, 'tileset', botF).setOrigin(0, 0));
            if (y > 0) {
              this.canopyLayer.add(
                this.add.sprite(px, (y - 1) * 16, 'tileset', topF).setOrigin(0, 0),
              );
            }
          }
        } else if (kind === 'portal') {
          const pUnder =
            regionId === 'terracotta_ridge'
              ? this.pickCanyonRoadFrame(map, x, y)
              : regionId === 'reedwater_fen'
                ? this.pickBoardwalkFrame(map, x, y)
                : this.pickRoadFrame(map, x, y);
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', pUnder).setOrigin(0, 0));
          this.objectLayer.add(this.add.sprite(px, py, 'tileset', 73).setOrigin(0, 0));
        } else if (kind === 'campfire') {
          const adjStone =
            getTileAt(map, x - 1, y) === 'stone_floor' ||
            getTileAt(map, x + 1, y) === 'stone_floor';
          const cfFloor = adjStone
            ? regionId === 'starfall_sanctuary'
              ? 78
              : 29
            : baseGroundFrame === 78
              ? 0
              : baseGroundFrame;
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', cfFloor).setOrigin(0, 0));
          const isSanctuary = regionId === 'starfall_sanctuary';
          const cf = this.add
            .sprite(px, py, 'tileset', isSanctuary ? 54 : 52)
            .setOrigin(0, 0);
          this.objectLayer.add(cf);
          this.animatedTiles.push({
            sprite: cf,
            frames: isSanctuary ? [54, 55] : [52, 53],
          });
          this.addWarmLightHalo(
            px + 8,
            py + 8,
            34,
            isSanctuary ? 0x8fd3ff : 0xffbe66,
          );
        } else if (kind === 'shrine') {
          const shFloor = regionId === 'starfall_sanctuary' ? 78 : 29;
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', shFloor).setOrigin(0, 0));
          this.objectLayer.add(this.add.sprite(px, py, 'tileset', 57).setOrigin(0, 0));
          if (y > 0) {
            this.canopyLayer.add(
              this.add.sprite(px, (y - 1) * 16, 'tileset', 56).setOrigin(0, 0),
            );
          }
          this.addWarmLightHalo(px + 8, py + 4, 28, 0x9ee6ff);
        }
      }
    }

    for (const dec of map.decorations ?? []) {
      this.renderMapDecoration(dec);
    }

    for (const prop of map.props) {
      if (prop.kind === 'campfire' || prop.kind === 'shrine') {
        const underlying = getTileAt(map, prop.x, prop.y);
        if (underlying === prop.kind) continue;
      }
      let frame = 48;
      if (prop.kind === 'overlook') {
        frame = 49;
      } else if (prop.kind === 'chest') {
        frame = this.controller.state.openedProps.includes(prop.id) ? 51 : 50;
      } else if (prop.kind === 'campfire') {
        frame = regionId === 'starfall_sanctuary' ? 54 : 52;
      } else if (prop.kind === 'shrine') {
        frame = 57;
      } else if (prop.kind === 'supply_post') {
        frame = 60;
      } else if (prop.kind === 'trace') {
        frame = 77;
        this.addWarmLightHalo(prop.x * 16 + 8, prop.y * 16 + 8, 18, 0xffe98a);
      }
      const pSprite = this.add.sprite(prop.x * 16, prop.y * 16, 'tileset', frame).setOrigin(0, 0);
      pSprite.setVisible(isPropVisible(prop, this.controller.state));
      this.propSprites.set(prop.id, pSprite);
      this.objectLayer.add(pSprite);
    }

    const npcsHere = NPCS.filter((n) => n.regionId === regionId);
    for (const npc of npcsHere) {
      this.shadowLayer.add(
        this.add.ellipse(npc.x * 16 + 8, npc.y * 16 + 15, 11, 4, 0x0c140e, 0.28),
      );
      const row = Math.min(5, npc.spriteVariant + 1);
      const frame = row * 12 + DIR_IDLE_COL[npc.facing];
      const nSprite = this.add.sprite(npc.x * 16, npc.y * 16, 'characters', frame).setOrigin(0, 0);
      this.objectLayer.add(nSprite);
    }

    this.buildBiomeAtmosphere(regionId, map);

    const worldW = map.width * 16;
    const worldH = map.height * 16;
    this.timeOverlay.setSize(worldW + 128, worldH + 128);
    this.regionFadeRect.setSize(worldW + 128, worldH + 128);

    if (!this.controller.activeBattle) {
      this.configureWorldCamera(true);
    }

    if (playFade && !this.controller.state.settings.reducedMotion) {
      this.regionFadeRect.setAlpha(0.72);
      this.tweens.killTweensOf(this.regionFadeRect);
      this.tweens.add({
        targets: this.regionFadeRect,
        alpha: 0,
        duration: 250,
        ease: 'Quad.easeOut',
      });
    }
  }

  private buildBiomeAtmosphere(regionId: RegionId, map: RegionMapDefinition): void {
    const worldW = map.width * 16;
    const worldH = map.height * 16;

    // Whisperwood: golden dappled sunbeams piercing the layered canopy!
    if (regionId === 'whisperwood') {
      const g = this.add.graphics();
      g.fillStyle(0xfff4b2, 0.065);
      for (const [bx, by] of [
        [108, 44],
        [248, 72],
        [368, 128],
        [176, 224],
        [318, 256],
      ] as const) {
        g.fillPoints(
          [
            new Phaser.Geom.Point(bx, by),
            new Phaser.Geom.Point(bx + 36, by),
            new Phaser.Geom.Point(bx + 68, by + 92),
            new Phaser.Geom.Point(bx + 24, by + 92),
          ],
          true,
        );
      }
      this.ambientLayer.add(g);
    }

    // Reedwater Fen: drifting soft translucent marsh mist clouds!
    if (regionId === 'reedwater_fen') {
      for (let i = 0; i < 6; i++) {
        const mw = 172 + (i % 3) * 52;
        const mh = 26 + (i % 2) * 12;
        const mx = ((i * 97) % worldW) + 40;
        const my = 48 + i * 54;
        const cloud = this.add.ellipse(mx, my, mw, mh, 0xdff7f4, 0.11);
        this.ambientLayer.add(cloud);
        this.mistBands.push({ cloud, vx: 6 + (i % 3) * 2.5 });
      }
    }

    // Floating regional motes (fireflies, forest pollen, marsh glow, canyon dust, starlight)
    const particleColor = REGION_PARTICLE_COLOR[regionId];
    for (let i = 0; i < 16; i++) {
      const mx = (i * 73) % worldW;
      const my = (i * 59) % worldH;
      const dot = this.add.circle(mx, my, i % 3 === 0 ? 1.6 : 1.1, particleColor, 0.56);
      this.ambientLayer.add(dot);
      this.ambientMotes.push({
        dot,
        vx: (i % 2 === 0 ? 1 : -1) * (4 + (i % 5)),
        vy: -3 - (i % 4),
      });
    }
  }

  private renderMapDecoration(dec: MapDecoration): void {
    const px = dec.x * 16;
    const py = dec.y * 16;
    switch (dec.kind) {
      case 'cottage_lodge': {
        this.shadowLayer.add(this.add.ellipse(px + 42, py + 44, 84, 16, 0x0c140e, 0.28));
        this.objectLayer.add(this.add.sprite(px, py, 'structures', 'lodge_body').setOrigin(0, 0));
        this.canopyLayer.add(
          this.add.sprite(px, py - 32, 'structures', 'lodge_roof').setOrigin(0, 0),
        );
        this.addWarmLightHalo(px + 20, py + 28, 22, 0xffd27d);
        this.addWarmLightHalo(px + 60, py + 28, 22, 0xffd27d);
        break;
      }
      case 'cottage_greenhouse':
      case 'tent_sage': {
        this.shadowLayer.add(this.add.ellipse(px + 17, py + 29, 34, 10, 0x0c140e, 0.26));
        this.objectLayer.add(this.add.sprite(px, py, 'structures', 'cabin_body').setOrigin(0, 0));
        this.canopyLayer.add(
          this.add.sprite(px, py - 16, 'structures', 'cabin_roof').setOrigin(0, 0),
        );
        break;
      }
      case 'market_stall': {
        this.shadowLayer.add(this.add.ellipse(px + 40, py + 42, 82, 14, 0x0c140e, 0.25));
        this.objectLayer.add(
          this.add.sprite(px, py, 'structures', 'stall_counter').setOrigin(0, 0),
        );
        this.canopyLayer.add(
          this.add.sprite(px, py - 32, 'structures', 'stall_awning').setOrigin(0, 0),
        );
        break;
      }
      case 'sanctuary_gate': {
        this.shadowLayer.add(this.add.ellipse(px + 32, py + 30, 66, 12, 0x090e1a, 0.32));
        this.objectLayer.add(this.add.sprite(px, py, 'structures', 'arch_base').setOrigin(0, 0));
        this.canopyLayer.add(
          this.add.sprite(px, py - 32, 'structures', 'arch_top').setOrigin(0, 0),
        );
        break;
      }
      case 'fountain_plaza': {
        this.shadowLayer.add(this.add.ellipse(px + 24, py + 42, 50, 14, 0x0c140e, 0.25));
        const ftn = this.add.sprite(px, py, 'structures', 'fountain_0').setOrigin(0, 0);
        this.objectLayer.add(ftn);
        this.animatedTiles.push({
          sprite: ftn,
          frames: ['fountain_0', 'fountain_1', 'fountain_2'],
        });
        break;
      }
      case 'bench_wood': {
        this.objectLayer.add(this.add.sprite(px, py, 'structures', 'bench_seat').setOrigin(0, 0));
        this.canopyLayer.add(
          this.add.sprite(px, py - 16, 'structures', 'bench_back').setOrigin(0, 0),
        );
        break;
      }
      case 'fallen_log': {
        this.shadowLayer.add(this.add.ellipse(px + 24, py + 14, 48, 7, 0x0c140e, 0.26));
        this.objectLayer.add(this.add.sprite(px, py, 'structures', 'fallen_log').setOrigin(0, 0));
        break;
      }
      case 'waterfall_cliff': {
        this.objectLayer.add(
          this.add.sprite(px, py, 'structures', 'waterfall_3x3').setOrigin(0, 0),
        );
        for (let dx = 0; dx < 3; dx++) {
          const splash = this.add
            .sprite(px + dx * 16, py + 32, 'tileset', 117)
            .setOrigin(0, 0)
            .setAlpha(0.85);
          this.objectLayer.add(splash);
          this.animatedTiles.push({ sprite: splash, frames: [117, 118] });
        }
        break;
      }
      case 'barrel_cluster': {
        const f = (dec.x + dec.y) % 2 === 0 ? 115 : 116;
        this.shadowLayer.add(this.add.ellipse(px + 8, py + 14, 14, 5, 0x0c140e, 0.24));
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', f).setOrigin(0, 0));
        break;
      }
      case 'flower_box':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 114).setOrigin(0, 0));
        break;
      case 'shrub':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 44).setOrigin(0, 0));
        break;
      case 'boat_moored':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 61).setOrigin(0, 0));
        break;
      case 'fence_h':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 62).setOrigin(0, 0));
        break;
      case 'fence_v':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 63).setOrigin(0, 0));
        break;
      case 'lantern_post':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 74).setOrigin(0, 0));
        this.addWarmLightHalo(px + 8, py + 6, 26, 0xffcf75);
        break;
      case 'lily_pad':
        this.groundLayer.add(this.add.sprite(px, py, 'tileset', 46).setOrigin(0, 0));
        break;
      case 'boulder':
        this.shadowLayer.add(this.add.ellipse(px + 8, py + 14, 15, 5, 0x0c140e, 0.25));
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 47).setOrigin(0, 0));
        break;
      case 'stump':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 45).setOrigin(0, 0));
        break;
      case 'ruin_pillar':
        if ((dec.width ?? 1) >= 2) {
          this.shadowLayer.add(this.add.ellipse(px + 16, py + 30, 32, 9, 0x090e1a, 0.3));
          this.objectLayer.add(
            this.add.sprite(px, py, 'structures', 'statue_base').setOrigin(0, 0),
          );
          this.canopyLayer.add(
            this.add.sprite(px, py - 16, 'structures', 'statue_top').setOrigin(0, 0),
          );
        } else {
          this.objectLayer.add(this.add.sprite(px, py, 'tileset', 76).setOrigin(0, 0));
          this.canopyLayer.add(this.add.sprite(px, py - 16, 'tileset', 75).setOrigin(0, 0));
        }
        break;
      case 'tree_cluster':
        this.shadowLayer.add(this.add.ellipse(px + 16, py + 28, 30, 10, 0x0c140e, 0.28));
        this.canopyLayer.add(
          this.add.sprite(px, py, 'structures', 'tree_cluster_2x2').setOrigin(0, 0),
        );
        break;
    }
  }

  private refreshCompanionAppearance(): void {
    const state = this.controller.state;
    const lead = state.party[0];
    const dist =
      Math.abs(this.controller.followerPos.x - state.playerPos.x) +
      Math.abs(this.controller.followerPos.y - state.playerPos.y);
    const shouldShow =
      state.settings.showFollower !== false && Boolean(lead) && dist >= 1 && dist <= 2;

    if (!shouldShow || !lead) {
      this.companionSprite.setVisible(false);
      this.companionShadow.setVisible(false);
      this.companionGleamRing.setVisible(false);
      return;
    }

    const sp = SPECIES_BY_ID[lead.speciesId];
    if (!sp) return;

    const frame = (sp.dexNumber - 1) * 2 + (this.animCycleStep % 2);
    this.companionSprite.setFrame(frame).setVisible(true);
    this.companionShadow.setVisible(true);
    if (lead.isRareVariant) {
      this.companionSprite.setTint(0xfff4a8);
      this.companionGleamRing.setVisible(true);
    } else {
      this.companionSprite.clearTint();
      this.companionGleamRing.setVisible(false);
    }
  }

  private rebuildNavigationOverlay(): void {
    const state = this.controller.state;
    const guidance = state.settings.guidanceMode ?? 'full';
    const nav = this.controller.navigationPlan;
    const inBattle = Boolean(this.controller.activeBattle);
    const dest = nav.destinationInCurrentRegion;
    const nearby = nav.nearbyInteractable;

    const firstWp = nav.waypoints[0];
    const trailSig = `${inBattle}|${guidance}|${state.regionId}|${nav.active}|${dest?.x ?? -1},${dest?.y ?? -1}|${nav.waypoints.length}|${firstWp?.x ?? -1},${firstWp?.y ?? -1}`;
    if (trailSig !== this.lastTrailSignature) {
      this.lastTrailSignature = trailSig;
      this.navLayer.removeAll(true);

      if (!inBattle && guidance === 'full' && nav.active) {
        for (let i = 0; i < nav.waypoints.length; i++) {
          const pt = nav.waypoints[i]!;
          const px = pt.x * 16 + 8;
          const py = pt.y * 16 + 10;
          const alpha = Math.max(0.28, 0.68 - i * 0.015);
          const dot = this.add
            .circle(px, py, i === 0 ? 2.8 : 2.1, 0xffe478, alpha)
            .setStrokeStyle(1, 0x4f3616, alpha * 0.9);
          this.navLayer.add(dot);
        }
        if (dest) {
          const ring = this.add
            .circle(dest.x * 16 + 8, dest.y * 16 + 10, 7, 0xffdf6b, 0.2)
            .setStrokeStyle(1.4, 0xfff5b5, 0.9);
          this.navLayer.add(ring);
        }
      }
    }

    // Separate marker signature so NPC Phaser.Text badges are NEVER destroyed/rebuilt on routine walking steps!
    const markerSig = `${inBattle}|${guidance}|${state.regionId}|${nearby?.id ?? ''}|${Object.keys(state.quests).length}|${state.defeatedTrainers.length}|${Boolean(state.flags.has_starter)}|${Boolean(state.flags.warden_sylvan_cleared)}|${Boolean(state.flags.warden_mirella_cleared)}|${Boolean(state.flags.warden_kaelen_cleared)}|${Boolean(state.flags.sanctuary_harmony_restored)}`;
    if (markerSig !== this.lastMarkerSignature) {
      this.lastMarkerSignature = markerSig;
      this.markerLayer.removeAll(true);

      if (!inBattle && guidance !== 'off') {
        const npcsHere = getNpcsInRegion(state.regionId);
        for (const npc of npcsHere) {
          const marker = getNpcQuestMarker({
            npc,
            state,
            quests: QUESTS,
            speciesById: SPECIES_BY_ID,
          });
          if (marker === 'none') continue;
          const mx = npc.x * 16 + 8;
          const my = npc.y * 16 - 5;
          const bgColor = marker === 'new_quest' ? 0xf5c842 : 0x3b8c52;
          const textColor = marker === 'new_quest' ? '#2c1f0a' : '#fffaf0';
          const badge = this.add
            .circle(mx, my, 5.2, bgColor, 0.96)
            .setStrokeStyle(1, 0x261d14, 0.95);
          const glyph = this.add
            .text(mx, my, marker === 'new_quest' ? '!' : '?', {
              fontFamily: 'Segoe UI, Tahoma, sans-serif',
              fontSize: '9px',
              fontStyle: 'bold',
              color: textColor,
            })
            .setOrigin(0.5, 0.5);
          this.markerLayer.add([badge, glyph]);
        }

        if (nearby) {
          const bx = nearby.x * 16 + 8;
          const by = nearby.y * 16 - 6;
          const bubble = this.add
            .circle(bx, by, 4.5, 0xfff8e1, 0.95)
            .setStrokeStyle(1, 0x5e442c, 0.95);
          const dot = this.add.circle(bx, by, 1.5, 0xba5b38, 1);
          this.markerLayer.add([bubble, dot]);
        }
      }
    }
  }

  private syncFromController(): void {
    const state = this.controller.state;
    const regionChanged = this.renderedRegion !== state.regionId;
    if (regionChanged) {
      this.lastTrailSignature = '';
      this.lastMarkerSignature = '';
      this.lastClickPathVersion = -1;
      this.rebuildRegionMap(state.regionId, true);
    }

    const map = MAPS_BY_ID[state.regionId];
    for (const prop of map.props) {
      const sp = this.propSprites.get(prop.id);
      if (!sp) continue;
      sp.setVisible(isPropVisible(prop, state));
      if (prop.kind === 'chest') {
        sp.setFrame(state.openedProps.includes(prop.id) ? 51 : 50);
      }
    }

    this.refreshCompanionAppearance();
    this.rebuildNavigationOverlay();
    if (regionChanged || !this.controller.movement.isCurrentlyStepping()) {
      this.applyMovementVisuals(this.controller.movement.getSnapshot(), 0, regionChanged);
    }

    const tint = TIME_TINT[state.timeOfDay];
    this.timeOverlay.setFillStyle(tint.color, tint.alpha);
    this.lightGlowLayer.setAlpha(
      state.timeOfDay === 'night'
        ? 1
        : state.timeOfDay === 'dusk'
          ? 0.72
          : state.timeOfDay === 'morning'
            ? 0.25
            : 0.14,
    );

    const battle = this.controller.activeBattle;
    if (battle) {
      if (!this.wasInBattle) {
        this.wasInBattle = true;
        this.clickPathGraphics.clear();
        this.battleContainer.setVisible(true);
        this.enterOrLayoutBattleCamera();
      }
      this.refreshBattleCreatureFrames();
      if (
        this.controller.lastBattleVisual &&
        this.controller.lastBattleVisual.id !== this.lastVisualCueId
      ) {
        this.lastVisualCueId = this.controller.lastBattleVisual.id;
        this.playBattleVisualCue(this.controller.lastBattleVisual);
      }
    } else if (this.wasInBattle) {
      this.wasInBattle = false;
      this.battleContainer.setVisible(false);
      this.gleamingAuraSprite.setVisible(false);
      this.vfxSprite.setVisible(false);
      this.damagePopupText.setVisible(false);
      this.configureWorldCamera(true);
    }
  }

  private refreshBattleCreatureFrames(): void {
    const battle = this.controller.activeBattle;
    if (!battle) return;
    const toggle = this.animCycleStep % 2;
    const playerCreature = battle.playerParty[battle.activePlayerIndex];
    const enemyCreature = battle.enemyParty[battle.activeEnemyIndex];
    if (playerCreature) {
      const pSpec = SPECIES_BY_ID[playerCreature.speciesId];
      if (pSpec) {
        const baseFrame = (pSpec.dexNumber - 1) * 2;
        this.playerBattleSprite.setFrame(baseFrame + toggle);
        this.playerBattleSprite.setAlpha(playerCreature.currentHp > 0 ? 1 : 0.35);
        if (playerCreature.isRareVariant) {
          this.playerBattleSprite.setTint(0xfff5b2);
        } else {
          this.playerBattleSprite.clearTint();
        }
      }
    }
    if (enemyCreature) {
      const eSpec = SPECIES_BY_ID[enemyCreature.speciesId];
      if (eSpec) {
        const baseFrame = (eSpec.dexNumber - 1) * 2;
        this.enemyBattleSprite.setFrame(baseFrame + toggle);
        this.enemyBattleSprite.setAlpha(
          battle.outcome === 'captured' ? 0.18 : enemyCreature.currentHp > 0 ? 1 : 0.28,
        );
        if (enemyCreature.isRareVariant) {
          this.enemyBattleSprite.setTint(0xfff5b2);
          this.gleamingAuraSprite
            .setVisible(battle.outcome === 'ongoing')
            .setAngle((this.animCycleStep * 30) % 360);
        } else {
          this.enemyBattleSprite.clearTint();
          this.gleamingAuraSprite.setVisible(false);
        }
      }
    }
  }

  private playBattleVisualCue(cue: BattleVisualCue): void {
    const state = this.controller.state;
    const mode = state.settings.battleSpeed ?? 'normal';
    const factor = state.settings.reducedMotion ? 0 : speedFactor(mode);
    if (factor === 0) {
      return;
    }

    this.tweens.killTweensOf([
      this.playerBattleSprite,
      this.enemyBattleSprite,
      this.vfxSprite,
      this.damagePopupText,
    ]);
    this.playerBattleSprite.setPosition(this.playerHomePos.x, this.playerHomePos.y);
    this.enemyBattleSprite.setPosition(this.enemyHomePos.x, this.enemyHomePos.y);

    if (cue.kind === 'player_attack' || cue.kind === 'enemy_attack') {
      const isPlayer = cue.kind === 'player_attack';
      const attacker = isPlayer ? this.playerBattleSprite : this.enemyBattleSprite;
      const defender = isPlayer ? this.enemyBattleSprite : this.playerBattleSprite;
      const startPos = isPlayer ? this.playerHomePos : this.enemyHomePos;
      const targetPos = isPlayer ? this.enemyHomePos : this.playerHomePos;

      this.tweens.add({
        targets: attacker,
        x: startPos.x + (isPlayer ? 28 : -28),
        y: startPos.y + (isPlayer ? -10 : 10),
        yoyo: true,
        duration: Math.round(115 * factor),
      });

      const vfxFrame = ELEMENT_VFX_FRAME[cue.element ?? 'neutral'];
      this.vfxSprite
        .setFrame(vfxFrame)
        .setPosition(startPos.x, startPos.y)
        .setAlpha(1)
        .setScale(cue.isSuperEffective ? 2.7 : 2.1)
        .setVisible(true);

      this.tweens.add({
        targets: this.vfxSprite,
        x: targetPos.x,
        y: targetPos.y,
        duration: Math.round(180 * factor),
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: this.vfxSprite,
            scale: cue.isSuperEffective ? 3.3 : 2.4,
            alpha: 0,
            duration: Math.round(120 * factor),
            onComplete: () => this.vfxSprite.setVisible(false),
          });
        },
      });

      this.tweens.add({
        targets: defender,
        x: targetPos.x + (isPlayer ? 10 : -10),
        alpha: 0.35,
        yoyo: true,
        repeat: 1,
        delay: Math.round(140 * factor),
        duration: Math.round(75 * factor),
      });

      if (cue.damage !== undefined && cue.damage > 0) {
        this.damagePopupText
          .setText(cue.isSuperEffective ? `-${cue.damage}!` : `-${cue.damage}`)
          .setColor(cue.isSuperEffective ? '#ffd86b' : '#fff8dc')
          .setPosition(targetPos.x, targetPos.y - 28)
          .setAlpha(1)
          .setVisible(true);
        this.tweens.add({
          targets: this.damagePopupText,
          y: targetPos.y - 64,
          alpha: 0,
          delay: Math.round(140 * factor),
          duration: Math.round(420 * factor),
          onComplete: () => this.damagePopupText.setVisible(false),
        });
      }
      return;
    }

    if (cue.kind === 'capture_success' || cue.kind === 'capture_break') {
      const pulses = Math.max(1, cue.shakes ?? 1);
      this.vfxSprite
        .setFrame(7)
        .setPosition(this.playerHomePos.x, this.playerHomePos.y - 12)
        .setScale(2.1)
        .setAlpha(1)
        .setAngle(0)
        .setVisible(true);

      this.tweens.add({
        targets: this.vfxSprite,
        x: this.enemyHomePos.x,
        y: this.enemyHomePos.y - 8,
        duration: Math.round(210 * factor),
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: this.vfxSprite,
            angle: { from: -16, to: 16 },
            yoyo: true,
            repeat: pulses,
            duration: Math.round(95 * factor),
            onComplete: () => {
              this.vfxSprite.setAngle(0);
              if (cue.kind === 'capture_success') {
                this.vfxSprite.setFrame(9).setScale(2.4);
                this.damagePopupText
                  .setText('Bonded!')
                  .setColor('#a8f0a5')
                  .setPosition(this.enemyHomePos.x, this.enemyHomePos.y - 34)
                  .setAlpha(1)
                  .setVisible(true);
                this.tweens.add({
                  targets: [this.vfxSprite, this.damagePopupText],
                  y: '-=22',
                  alpha: 0,
                  duration: Math.round(340 * factor),
                  onComplete: () => {
                    this.vfxSprite.setVisible(false);
                    this.damagePopupText.setVisible(false);
                  },
                });
              } else {
                this.vfxSprite.setVisible(false);
                this.tweens.add({
                  targets: this.enemyBattleSprite,
                  scaleX: this.enemyBattleSprite.scaleX * 1.18,
                  scaleY: this.enemyBattleSprite.scaleY * 1.18,
                  yoyo: true,
                  duration: Math.round(120 * factor),
                });
              }
            },
          });
        },
      });
      return;
    }

    if (cue.kind === 'heal') {
      this.vfxSprite
        .setFrame(8)
        .setPosition(this.playerHomePos.x, this.playerHomePos.y)
        .setScale(2.0)
        .setAlpha(0.95)
        .setVisible(true);
      this.tweens.add({
        targets: this.vfxSprite,
        y: this.playerHomePos.y - 28,
        alpha: 0,
        duration: Math.round(300 * factor),
        onComplete: () => this.vfxSprite.setVisible(false),
      });
    }
  }
}

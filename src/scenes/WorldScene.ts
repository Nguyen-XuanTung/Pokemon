import Phaser from 'phaser';
import { MAPS_BY_ID } from '../data/maps.ts';
import { NPCS } from '../data/npcs.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
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
  morning: { color: 0xffe6b8, alpha: 0.07 },
  day: { color: 0xffffff, alpha: 0 },
  dusk: { color: 0xd97538, alpha: 0.2 },
  night: { color: 0x10223d, alpha: 0.36 },
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

const REGION_ARENA_PALETTE: Readonly<
  Record<
    RegionId,
    {
      skyTop: number;
      skyHorizon: number;
      distantHill: number;
      groundMain: number;
      groundRim: number;
      padFill: number;
      padBorder: number;
      particleColor: number;
    }
  >
> = {
  mosslight_hub: {
    skyTop: 0x4f8464,
    skyHorizon: 0x93bf8a,
    distantHill: 0x355c42,
    groundMain: 0x497a49,
    groundRim: 0x325936,
    padFill: 0xc9ab7d,
    padBorder: 0x7d613e,
    particleColor: 0xf7e699,
  },
  whisperwood: {
    skyTop: 0x284d38,
    skyHorizon: 0x5c8c62,
    distantHill: 0x1d3b2a,
    groundMain: 0x3a6b42,
    groundRim: 0x254a2c,
    padFill: 0x8fb36d,
    padBorder: 0x466b38,
    particleColor: 0xbaf299,
  },
  reedwater_fen: {
    skyTop: 0x2c5c6e,
    skyHorizon: 0x7bb0b8,
    distantHill: 0x224654,
    groundMain: 0x366d78,
    groundRim: 0x224b54,
    padFill: 0x8cc4b8,
    padBorder: 0x3d736e,
    particleColor: 0xc7f7ff,
  },
  terracotta_ridge: {
    skyTop: 0x8c442b,
    skyHorizon: 0xe09b63,
    distantHill: 0x69311f,
    groundMain: 0xb86642,
    groundRim: 0x804126,
    padFill: 0xe3b888,
    padBorder: 0x8f5534,
    particleColor: 0xffe094,
  },
  starfall_sanctuary: {
    skyTop: 0x162238,
    skyHorizon: 0x354d73,
    distantHill: 0x223352,
    groundMain: 0x2d3f5e,
    groundRim: 0x1c2940,
    padFill: 0x8ea4c9,
    padBorder: 0x52688f,
    particleColor: 0xfff5b8,
  },
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
  private objectLayer!: Phaser.GameObjects.Container;
  private canopyLayer!: Phaser.GameObjects.Container;
  private ambientLayer!: Phaser.GameObjects.Container;
  private battleContainer!: Phaser.GameObjects.Container;
  private battleSceneryGraphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private timeOverlay!: Phaser.GameObjects.Rectangle;
  private regionFadeRect!: Phaser.GameObjects.Rectangle;

  private animatedTiles: Array<{
    sprite: Phaser.GameObjects.Sprite;
    frameA: number;
    frameB: number;
  }> = [];
  private ambientMotes: Array<{
    dot: Phaser.GameObjects.Arc;
    vx: number;
    vy: number;
  }> = [];
  private propSprites = new Map<string, Phaser.GameObjects.Sprite>();

  private enemyPlatform!: Phaser.GameObjects.Ellipse;
  private playerPlatform!: Phaser.GameObjects.Ellipse;
  private enemyBattleSprite!: Phaser.GameObjects.Sprite;
  private playerBattleSprite!: Phaser.GameObjects.Sprite;
  private vfxSprite!: Phaser.GameObjects.Sprite;
  private damagePopupText!: Phaser.GameObjects.Text;

  private animFrameToggle = 0;
  private lastStepRendered = -1;
  private lastVisualCueId = 0;
  private wasInBattle = false;
  private enemyHomePos = { x: 240, y: 92 };
  private playerHomePos = { x: 96, y: 156 };
  private unsubscribe: (() => void) | null = null;
  public measuredFps = 60;

  public constructor(controller: GameController) {
    super('WorldScene');
    this.controller = controller;
  }

  public preload(): void {
    this.load.spritesheet('tileset', './assets/sprites/tileset.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('characters', './assets/sprites/characters.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('creatures', './assets/sprites/creatures.png', {
      frameWidth: 48,
      frameHeight: 48,
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

  public create(): void {
    this.groundLayer = this.add.container(0, 0).setDepth(1);
    this.objectLayer = this.add.container(0, 0).setDepth(5);
    this.playerSprite = this.add.sprite(0, 0, 'characters', 1).setOrigin(0, 0).setDepth(10);
    this.canopyLayer = this.add.container(0, 0).setDepth(15);
    this.ambientLayer = this.add.container(0, 0).setDepth(18);

    this.timeOverlay = this.add
      .rectangle(0, 0, 2048, 2048, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(22);

    this.regionFadeRect = this.add
      .rectangle(0, 0, 2048, 2048, 0x101812, 0)
      .setOrigin(0, 0)
      .setDepth(28);

    this.createBattleLayer();
    this.rebuildRegionMap(this.controller.state.regionId, false);
    this.syncFromController();

    this.scale.on('resize', () => {
      if (this.controller.activeBattle) {
        this.enterOrLayoutBattleCamera();
      } else {
        this.configureWorldCamera();
      }
    });

    this.time.addEvent({
      delay: 460,
      loop: true,
      callback: () => {
        if (this.controller.state.settings.reducedMotion) return;
        this.animFrameToggle = 1 - this.animFrameToggle;
        for (const item of this.animatedTiles) {
          item.sprite.setFrame(this.animFrameToggle === 0 ? item.frameA : item.frameB);
        }
        this.refreshBattleCreatureFrames();
      },
    });

    this.unsubscribe = this.controller.subscribe(() => {
      this.syncFromController();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    });
  }

  public override update(_time: number, delta: number): void {
    if (this.game.loop.actualFps > 0) {
      this.measuredFps = Math.round(this.game.loop.actualFps);
    }
    if (!this.controller.state.settings.reducedMotion && !this.controller.activeBattle) {
      const map = MAPS_BY_ID[this.controller.state.regionId];
      const maxW = map.width * 16;
      const maxH = map.height * 16;
      const dt = delta * 0.001;
      for (const m of this.ambientMotes) {
        m.dot.x += m.vx * dt;
        m.dot.y += m.vy * dt;
        if (m.dot.x < 0) m.dot.x += maxW;
        if (m.dot.x > maxW) m.dot.x -= maxW;
        if (m.dot.y < 0) m.dot.y += maxH;
        if (m.dot.y > maxH) m.dot.y -= maxH;
      }
    }
  }

  private configureWorldCamera(): void {
    const cam = this.cameras.main;
    const map = MAPS_BY_ID[this.controller.state.regionId];
    const worldW = map.width * 16;
    const worldH = map.height * 16;
    const viewW = Math.max(240, this.scale.width);
    const viewH = Math.max(240, this.scale.height);

    const minCoverZoom = Math.max(viewW / worldW, viewH / worldH);
    const crispZoom = Math.max(2, Math.min(3.5, Math.ceil(minCoverZoom * 2) / 2));

    cam.setBounds(0, 0, worldW, worldH);
    cam.setZoom(crispZoom);
    const lerp = this.controller.state.settings.reducedMotion ? 1 : 0.18;
    cam.startFollow(this.playerSprite, true, lerp, lerp);
  }

  private enterOrLayoutBattleCamera(): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.removeBounds();
    cam.setZoom(1);
    cam.setScroll(0, 0);

    const w = Math.max(300, this.scale.width);
    const h = Math.max(260, this.scale.height);
    const isCompact = w < 520 || h < 460;
    const spriteScale = isCompact ? 2.1 : 3.0;

    // Frame creatures cleanly in the upper-middle arena band above the battle deck
    const arenaTop = Math.round(h * 0.08);
    const arenaBottom = Math.round(h * 0.56);
    const spanH = Math.max(120, arenaBottom - arenaTop);

    const enemyX = Math.round(w * (isCompact ? 0.72 : 0.7));
    const enemyY = Math.round(arenaTop + spanH * 0.34);
    const playerX = Math.round(w * (isCompact ? 0.28 : 0.3));
    const playerY = Math.round(arenaTop + spanH * 0.72);

    this.enemyHomePos = { x: enemyX, y: enemyY };
    this.playerHomePos = { x: playerX, y: playerY };

    this.drawRegionalBattleBackdrop(w, h, this.controller.state.regionId);

    const pal = REGION_ARENA_PALETTE[this.controller.state.regionId];
    const padScale = isCompact ? 0.8 : 1.15;
    this.enemyPlatform
      .setPosition(enemyX, enemyY + Math.round(20 * spriteScale * 0.42))
      .setSize(Math.round(118 * padScale), Math.round(32 * padScale))
      .setFillStyle(pal.padFill, 1)
      .setStrokeStyle(3, pal.padBorder, 1);

    this.playerPlatform
      .setPosition(playerX, playerY + Math.round(21 * spriteScale * 0.42))
      .setSize(Math.round(134 * padScale), Math.round(36 * padScale))
      .setFillStyle(pal.padFill, 1)
      .setStrokeStyle(3, pal.padBorder, 1);

    this.enemyBattleSprite.setPosition(enemyX, enemyY).setScale(spriteScale);
    this.playerBattleSprite.setPosition(playerX, playerY).setScale(spriteScale * 1.05);
  }

  private drawRegionalBattleBackdrop(w: number, h: number, regionId: RegionId): void {
    const pal = REGION_ARENA_PALETTE[regionId];
    const g = this.battleSceneryGraphics;
    g.clear();

    const horizonY = Math.round(h * 0.34);
    g.fillStyle(pal.skyTop, 1);
    g.fillRect(0, 0, w, Math.round(horizonY * 0.6));
    g.fillStyle(pal.skyHorizon, 1);
    g.fillRect(0, Math.round(horizonY * 0.6), w, Math.round(horizonY * 0.45));

    // Distant biome silhouettes so every region has unmistakable combat atmosphere
    g.fillStyle(pal.distantHill, 1);
    if (regionId === 'terracotta_ridge') {
      for (let sx = 0; sx < w; sx += 96) {
        g.fillRect(sx + 8, horizonY - 46, 68, 48);
        g.fillRect(sx + 22, horizonY - 62, 40, 18);
      }
    } else if (regionId === 'starfall_sanctuary') {
      for (let sx = 24; sx < w; sx += 110) {
        g.fillRect(sx, horizonY - 58, 14, 58);
        g.fillRect(sx + 44, horizonY - 58, 14, 58);
        g.fillRect(sx - 4, horizonY - 66, 66, 10);
      }
      g.fillStyle(0xfff4b8, 0.85);
      for (let st = 18; st < w; st += 53) {
        g.fillRect(st, 16 + ((st * 17) % Math.max(24, horizonY - 44)), 3, 3);
      }
    } else if (regionId === 'whisperwood') {
      for (let sx = -10; sx < w + 30; sx += 54) {
        g.fillTriangle(sx, horizonY + 4, sx + 28, horizonY - 58, sx + 56, horizonY + 4);
      }
    } else if (regionId === 'reedwater_fen') {
      for (let sx = 0; sx < w; sx += 72) {
        g.fillEllipse(sx + 36, horizonY, 92, 34);
      }
      g.fillStyle(0x9be0d8, 0.35);
      g.fillRect(0, horizonY - 6, w, 12);
    } else {
      for (let sx = -20; sx < w + 40; sx += 88) {
        g.fillEllipse(sx + 44, horizonY + 4, 116, 48);
      }
    }

    // Ground plane & subtle horizon rim
    g.fillStyle(pal.groundRim, 1);
    g.fillRect(0, horizonY, w, 8);
    g.fillStyle(pal.groundMain, 1);
    g.fillRect(0, horizonY + 8, w, h - horizonY);
  }

  private createBattleLayer(): void {
    this.battleContainer = this.add.container(0, 0).setDepth(40).setVisible(false);
    this.battleSceneryGraphics = this.add.graphics();
    this.enemyPlatform = this.add.ellipse(248, 112, 112, 30, 0xc7a77b, 1);
    this.playerPlatform = this.add.ellipse(98, 168, 124, 34, 0xc7a77b, 1);
    this.enemyBattleSprite = this.add.sprite(248, 86, 'creatures', 0);
    this.playerBattleSprite = this.add.sprite(98, 140, 'creatures', 0).setFlipX(true);
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
      this.battleSceneryGraphics,
      this.enemyPlatform,
      this.playerPlatform,
      this.enemyBattleSprite,
      this.playerBattleSprite,
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

  private rebuildRegionMap(regionId: RegionId, playFade: boolean): void {
    this.renderedRegion = regionId;
    this.groundLayer.removeAll(true);
    this.objectLayer.removeAll(true);
    this.canopyLayer.removeAll(true);
    this.ambientLayer.removeAll(true);
    this.animatedTiles = [];
    this.ambientMotes = [];
    this.propSprites.clear();

    const map = MAPS_BY_ID[regionId];
    const baseGroundFrame =
      regionId === 'terracotta_ridge' ? 27 : regionId === 'starfall_sanctuary' ? 29 : 0;

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
              : (x + y) % 5 === 0
                ? 1
                : 0;
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', grassFrame).setOrigin(0, 0));
        } else if (kind === 'flowers') {
          const flFrame = 2 + ((x + y) % 3);
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', flFrame).setOrigin(0, 0));
        } else if (kind === 'tall_grass') {
          const tg = this.add.sprite(px, py, 'tileset', 5).setOrigin(0, 0);
          this.groundLayer.add(tg);
          this.animatedTiles.push({ sprite: tg, frameA: 5, frameB: 6 });
        } else if (kind === 'water') {
          const wFrame = this.pickShoreOrWaterFrame(map, x, y);
          const ws = this.add.sprite(px, py, 'tileset', wFrame).setOrigin(0, 0);
          this.groundLayer.add(ws);
          if (wFrame === 7) {
            this.animatedTiles.push({ sprite: ws, frameA: 7, frameB: 8 });
          }
        } else if (kind === 'path') {
          const pFrame = regionId === 'terracotta_ridge' ? 28 : this.pickRoadFrame(map, x, y);
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', pFrame).setOrigin(0, 0));
        } else if (kind === 'bridge') {
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', 26).setOrigin(0, 0));
        } else if (kind === 'sand') {
          this.groundLayer.add(
            this.add.sprite(px, py, 'tileset', hash === 0 ? 28 : 27).setOrigin(0, 0),
          );
        } else if (kind === 'stone_floor') {
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', 29).setOrigin(0, 0));
        } else if (kind === 'reed_marsh') {
          const rm = this.add.sprite(px, py, 'tileset', 30).setOrigin(0, 0);
          this.groundLayer.add(rm);
          this.animatedTiles.push({ sprite: rm, frameA: 30, frameB: 31 });
        } else if (kind === 'wall') {
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', 32).setOrigin(0, 0));
        } else if (kind === 'cliff') {
          const aboveIsCliff = y > 0 && getTileAt(map, x, y - 1) === 'cliff';
          this.groundLayer.add(
            this.add.sprite(px, py, 'tileset', aboveIsCliff ? 33 : 34).setOrigin(0, 0),
          );
        } else if (kind === 'tree') {
          this.groundLayer.add(
            this.add.sprite(px, py, 'tileset', baseGroundFrame === 29 ? 0 : baseGroundFrame).setOrigin(0, 0),
          );
          if (hash === 3 && x > 1 && y > 1 && x < map.width - 2 && y < map.height - 2) {
            // Mix occasional berry shrubs & stumps along inner woodland edges for organic variety
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
          const pUnder = regionId === 'terracotta_ridge' ? 28 : this.pickRoadFrame(map, x, y);
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', pUnder).setOrigin(0, 0));
          this.objectLayer.add(this.add.sprite(px, py, 'tileset', 73).setOrigin(0, 0));
        } else if (kind === 'campfire') {
          const adjStone =
            getTileAt(map, x - 1, y) === 'stone_floor' ||
            getTileAt(map, x + 1, y) === 'stone_floor';
          const cfFloor = adjStone ? 29 : baseGroundFrame;
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', cfFloor).setOrigin(0, 0));
          const isSanctuary = regionId === 'starfall_sanctuary';
          const cf = this.add
            .sprite(px, py, 'tileset', isSanctuary ? 54 : 52)
            .setOrigin(0, 0);
          this.objectLayer.add(cf);
          this.animatedTiles.push({
            sprite: cf,
            frameA: isSanctuary ? 54 : 52,
            frameB: isSanctuary ? 55 : 53,
          });
        } else if (kind === 'shrine') {
          this.groundLayer.add(this.add.sprite(px, py, 'tileset', 29).setOrigin(0, 0));
          this.objectLayer.add(this.add.sprite(px, py, 'tileset', 57).setOrigin(0, 0));
          if (y > 0) {
            this.canopyLayer.add(
              this.add.sprite(px, (y - 1) * 16, 'tileset', 56).setOrigin(0, 0),
            );
          }
        }
      }
    }

    for (const dec of map.decorations ?? []) {
      this.renderMapDecoration(dec);
    }

    for (const prop of map.props) {
      if (prop.kind === 'campfire' || prop.kind === 'shrine') {
        // Already rendered on map tile, unless placed on plain ground
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
        this.canopyLayer.add(
          this.add.sprite((prop.x - 1) * 16, (prop.y - 1) * 16, 'tileset', 58).setOrigin(0, 0),
        );
        this.canopyLayer.add(
          this.add.sprite(prop.x * 16, (prop.y - 1) * 16, 'tileset', 59).setOrigin(0, 0),
        );
      }
      const pSprite = this.add.sprite(prop.x * 16, prop.y * 16, 'tileset', frame).setOrigin(0, 0);
      pSprite.setVisible(isPropVisible(prop, this.controller.state));
      this.propSprites.set(prop.id, pSprite);
      this.objectLayer.add(pSprite);
    }

    const npcsHere = NPCS.filter((n) => n.regionId === regionId);
    for (const npc of npcsHere) {
      const row = Math.min(5, npc.spriteVariant + 1);
      const frame = row * 12 + DIR_IDLE_COL[npc.facing];
      const nSprite = this.add.sprite(npc.x * 16, npc.y * 16, 'characters', frame).setOrigin(0, 0);
      this.objectLayer.add(nSprite);
    }

    // Spawn subtle floating biome motes (pollen, fireflies, canyon dust, or starlight)
    const pal = REGION_ARENA_PALETTE[regionId];
    for (let i = 0; i < 14; i++) {
      const mx = ((i * 73) % (map.width * 16));
      const my = ((i * 59) % (map.height * 16));
      const dot = this.add.circle(mx, my, i % 3 === 0 ? 1.6 : 1.1, pal.particleColor, 0.55);
      this.ambientLayer.add(dot);
      this.ambientMotes.push({
        dot,
        vx: (i % 2 === 0 ? 1 : -1) * (4 + (i % 5)),
        vy: -3 - (i % 4),
      });
    }

    const worldW = map.width * 16;
    const worldH = map.height * 16;
    this.timeOverlay.setSize(worldW + 128, worldH + 128);
    this.regionFadeRect.setSize(worldW + 128, worldH + 128);

    if (!this.controller.activeBattle) {
      this.configureWorldCamera();
    }

    if (playFade && !this.controller.state.settings.reducedMotion) {
      this.regionFadeRect.setAlpha(0.75);
      this.tweens.killTweensOf(this.regionFadeRect);
      this.tweens.add({
        targets: this.regionFadeRect,
        alpha: 0,
        duration: 260,
        ease: 'Quad.easeOut',
      });
    }
  }

  private renderMapDecoration(dec: MapDecoration): void {
    const px = dec.x * 16;
    const py = dec.y * 16;
    switch (dec.kind) {
      case 'cottage_lodge': {
        // 3x2 cottage + 3-wide pitched roof on canopy layer above
        this.canopyLayer.add(this.add.sprite(px, py - 16, 'tileset', 64).setOrigin(0, 0));
        this.canopyLayer.add(this.add.sprite(px + 16, py - 16, 'tileset', 65).setOrigin(0, 0));
        this.canopyLayer.add(this.add.sprite(px + 32, py - 16, 'tileset', 66).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 69).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px + 16, py, 'tileset', 70).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px + 32, py, 'tileset', 72).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px, py + 16, 'tileset', 69).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px + 16, py + 16, 'tileset', 71).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px + 32, py + 16, 'tileset', 72).setOrigin(0, 0));
        break;
      }
      case 'cottage_greenhouse':
      case 'tent_sage': {
        this.canopyLayer.add(this.add.sprite(px, py, 'tileset', 67).setOrigin(0, 0));
        this.canopyLayer.add(this.add.sprite(px + 16, py, 'tileset', 68).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px, py + 16, 'tileset', 70).setOrigin(0, 0));
        this.objectLayer.add(this.add.sprite(px + 16, py + 16, 'tileset', 71).setOrigin(0, 0));
        break;
      }
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
        break;
      case 'lily_pad':
        this.groundLayer.add(this.add.sprite(px, py, 'tileset', 46).setOrigin(0, 0));
        break;
      case 'boulder':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 47).setOrigin(0, 0));
        break;
      case 'stump':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 45).setOrigin(0, 0));
        break;
      case 'ruin_pillar':
        this.objectLayer.add(this.add.sprite(px, py, 'tileset', 76).setOrigin(0, 0));
        this.canopyLayer.add(this.add.sprite(px, py - 16, 'tileset', 75).setOrigin(0, 0));
        break;
    }
  }

  private syncFromController(): void {
    const state = this.controller.state;
    if (this.renderedRegion !== state.regionId) {
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

    const walkCols = DIR_WALK_COLS[state.playerPos.facing];
    const playerCol = walkCols[state.stepCount % 4]!;
    this.playerSprite.setFrame(playerCol);

    const targetX = state.playerPos.x * 16;
    const targetY = state.playerPos.y * 16;
    if (
      state.settings.reducedMotion ||
      Math.abs(this.playerSprite.x - targetX) > 24 ||
      Math.abs(this.playerSprite.y - targetY) > 24 ||
      this.lastStepRendered < 0
    ) {
      this.playerSprite.setPosition(targetX, targetY);
    } else if (this.lastStepRendered !== state.stepCount) {
      this.tweens.killTweensOf(this.playerSprite);
      this.tweens.add({
        targets: this.playerSprite,
        x: targetX,
        y: targetY,
        duration: 92,
        ease: 'Linear',
      });
    }
    this.lastStepRendered = state.stepCount;

    const tint = TIME_TINT[state.timeOfDay];
    this.timeOverlay.setFillStyle(tint.color, tint.alpha);

    const battle = this.controller.activeBattle;
    if (battle) {
      if (!this.wasInBattle) {
        this.wasInBattle = true;
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
      this.vfxSprite.setVisible(false);
      this.damagePopupText.setVisible(false);
      this.configureWorldCamera();
    }
  }

  private refreshBattleCreatureFrames(): void {
    const battle = this.controller.activeBattle;
    if (!battle) return;
    const playerCreature = battle.playerParty[battle.activePlayerIndex];
    const enemyCreature = battle.enemyParty[battle.activeEnemyIndex];
    if (playerCreature) {
      const pSpec = SPECIES_BY_ID[playerCreature.speciesId];
      if (pSpec) {
        const baseFrame = (pSpec.dexNumber - 1) * 2;
        this.playerBattleSprite.setFrame(baseFrame + this.animFrameToggle);
        this.playerBattleSprite.setAlpha(playerCreature.currentHp > 0 ? 1 : 0.35);
      }
    }
    if (enemyCreature) {
      const eSpec = SPECIES_BY_ID[enemyCreature.speciesId];
      if (eSpec) {
        const baseFrame = (eSpec.dexNumber - 1) * 2;
        this.enemyBattleSprite.setFrame(baseFrame + this.animFrameToggle);
        this.enemyBattleSprite.setAlpha(
          battle.outcome === 'captured' ? 0.18 : enemyCreature.currentHp > 0 ? 1 : 0.28,
        );
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
        x: startPos.x + (isPlayer ? 26 : -26),
        y: startPos.y + (isPlayer ? -10 : 10),
        yoyo: true,
        duration: Math.round(115 * factor),
      });

      const vfxFrame = ELEMENT_VFX_FRAME[cue.element ?? 'neutral'];
      this.vfxSprite
        .setFrame(vfxFrame)
        .setPosition(startPos.x, startPos.y)
        .setAlpha(1)
        .setScale(cue.isSuperEffective ? 2.6 : 2.0)
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
            scale: cue.isSuperEffective ? 3.2 : 2.4,
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
          y: targetPos.y - 62,
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
                  duration: Math.round(320 * factor),
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
        .setFrame(0)
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

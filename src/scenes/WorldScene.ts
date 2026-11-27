import Phaser from 'phaser';
import { MAPS_BY_ID } from '../data/maps.ts';
import { NPCS } from '../data/npcs.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import type { Direction, RegionId, TileKind, TimeOfDay } from '../domain/types.ts';
import { getTileAt, isPropVisible } from '../domain/world.ts';
import type { GameController } from '../game/controller.ts';

const TILE_FRAME_BY_KIND: Readonly<Record<TileKind, number>> = {
  grass: 0,
  flowers: 1,
  path: 2,
  tall_grass: 3,
  water: 4,
  wall: 5,
  tree: 6,
  cliff: 7,
  bridge: 8,
  sand: 9,
  stone_floor: 10,
  reed_marsh: 11,
  portal: 12,
  campfire: 13,
  shrine: 14,
};

const DIR_TO_FRAME_OFFSET: Readonly<Record<Direction, number>> = {
  down: 0,
  up: 2,
  left: 4,
  right: 6,
};

const TIME_TINT: Readonly<Record<TimeOfDay, { color: number; alpha: number }>> = {
  morning: { color: 0xffe4b5, alpha: 0.08 },
  day: { color: 0xffffff, alpha: 0 },
  dusk: { color: 0xd97b43, alpha: 0.2 },
  night: { color: 0x162944, alpha: 0.36 },
};

const BIOME_SKY_COLOR: Readonly<Record<RegionId, number>> = {
  mosslight_hub: 0x5c8a58,
  whisperwood: 0x3b6944,
  reedwater_fen: 0x3f7582,
  terracotta_ridge: 0xb86b43,
  starfall_sanctuary: 0x24344d,
};

export class WorldScene extends Phaser.Scene {
  private readonly controller: GameController;
  private renderedRegion: RegionId | null = null;
  private mapContainer!: Phaser.GameObjects.Container;
  private battleContainer!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private timeOverlay!: Phaser.GameObjects.Rectangle;
  private waterSprites: Phaser.GameObjects.Sprite[] = [];
  private propSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private enemyBattleSprite!: Phaser.GameObjects.Sprite;
  private playerBattleSprite!: Phaser.GameObjects.Sprite;
  private battleSkyBg!: Phaser.GameObjects.Rectangle;
  private enemyPlatform!: Phaser.GameObjects.Ellipse;
  private playerPlatform!: Phaser.GameObjects.Ellipse;
  private animFrameToggle = 0;
  private lastStepRendered = -1;
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
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('items', './assets/sprites/items.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  public create(): void {
    this.mapContainer = this.add.container(0, 0).setDepth(1);
    this.playerSprite = this.add.sprite(0, 0, 'characters', 0).setOrigin(0, 0).setDepth(10);

    this.timeOverlay = this.add
      .rectangle(0, 0, 352, 256, 0x000000, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(20);

    this.createBattleLayer();

    this.rebuildRegionMap(this.controller.state.regionId);
    this.syncFromController();

    this.time.addEvent({
      delay: 480,
      loop: true,
      callback: () => {
        if (this.controller.state.settings.reducedMotion) return;
        this.animFrameToggle = 1 - this.animFrameToggle;
        const waterFrame = this.animFrameToggle === 0 ? 4 : 19;
        for (const ws of this.waterSprites) {
          ws.setFrame(waterFrame);
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

  public override update(): void {
    if (this.game.loop.actualFps > 0) {
      this.measuredFps = Math.round(this.game.loop.actualFps);
    }
  }

  private createBattleLayer(): void {
    this.battleContainer = this.add.container(0, 0).setDepth(40).setVisible(false);
    this.battleSkyBg = this.add.rectangle(0, 0, 352, 256, 0x3b6944, 1).setOrigin(0, 0);
    const horizonBand = this.add.rectangle(0, 108, 352, 148, 0x4b774a, 1).setOrigin(0, 0);
    this.enemyPlatform = this.add.ellipse(248, 106, 98, 28, 0xc7a77b, 1);
    this.playerPlatform = this.add.ellipse(98, 158, 108, 32, 0xc7a77b, 1);
    this.enemyBattleSprite = this.add.sprite(248, 76, 'creatures', 0).setScale(2.4);
    this.playerBattleSprite = this.add.sprite(98, 124, 'creatures', 0).setScale(2.5).setFlipX(true);

    this.battleContainer.add([
      this.battleSkyBg,
      horizonBand,
      this.enemyPlatform,
      this.playerPlatform,
      this.enemyBattleSprite,
      this.playerBattleSprite,
    ]);
  }

  private rebuildRegionMap(regionId: RegionId): void {
    this.renderedRegion = regionId;
    this.mapContainer.removeAll(true);
    this.waterSprites = [];
    this.propSprites.clear();

    const map = MAPS_BY_ID[regionId];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const kind = getTileAt(map, x, y);
        const frame = TILE_FRAME_BY_KIND[kind];
        const tileSprite = this.add.sprite(x * 16, y * 16, 'tileset', frame).setOrigin(0, 0);
        this.mapContainer.add(tileSprite);
        if (kind === 'water') {
          this.waterSprites.push(tileSprite);
        }
      }
    }

    for (const prop of map.props) {
      let frame = 15;
      if (prop.kind === 'chest') {
        frame = this.controller.state.openedProps.includes(prop.id) ? 17 : 16;
      } else if (prop.kind === 'campfire') {
        frame = 13;
      } else if (prop.kind === 'shrine') {
        frame = 14;
      } else if (prop.kind === 'supply_post') {
        frame = 18;
      }
      const pSprite = this.add.sprite(prop.x * 16, prop.y * 16, 'tileset', frame).setOrigin(0, 0);
      pSprite.setVisible(isPropVisible(prop, this.controller.state));
      this.propSprites.set(prop.id, pSprite);
      this.mapContainer.add(pSprite);
    }

    const npcsHere = NPCS.filter((n) => n.regionId === regionId);
    for (const npc of npcsHere) {
      const row = Math.min(5, npc.spriteVariant + 1);
      const frame = row * 8 + DIR_TO_FRAME_OFFSET[npc.facing];
      const nSprite = this.add.sprite(npc.x * 16, npc.y * 16, 'characters', frame).setOrigin(0, 0);
      this.mapContainer.add(nSprite);
    }
  }

  private syncFromController(): void {
    const state = this.controller.state;
    if (this.renderedRegion !== state.regionId) {
      this.rebuildRegionMap(state.regionId);
    }

    const map = MAPS_BY_ID[state.regionId];
    for (const prop of map.props) {
      const sp = this.propSprites.get(prop.id);
      if (!sp) continue;
      sp.setVisible(isPropVisible(prop, state));
      if (prop.kind === 'chest') {
        sp.setFrame(state.openedProps.includes(prop.id) ? 17 : 16);
      }
    }

    const walkCycle = state.stepCount % 2;
    const playerFrame = DIR_TO_FRAME_OFFSET[state.playerPos.facing] + walkCycle;
    this.playerSprite.setFrame(playerFrame);

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
        duration: 95,
        ease: 'Linear',
      });
    }
    this.lastStepRendered = state.stepCount;

    const tint = TIME_TINT[state.timeOfDay];
    this.timeOverlay.setFillStyle(tint.color, tint.alpha);

    const battle = this.controller.activeBattle;
    if (battle) {
      this.battleContainer.setVisible(true);
      this.battleSkyBg.setFillStyle(BIOME_SKY_COLOR[state.regionId], 1);
      this.refreshBattleCreatureFrames();
      this.playBattleFeedbackTween();
    } else {
      this.battleContainer.setVisible(false);
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
          battle.outcome === 'captured' ? 0.2 : enemyCreature.currentHp > 0 ? 1 : 0.3,
        );
      }
    }
  }

  private playBattleFeedbackTween(): void {
    if (this.controller.state.settings.reducedMotion) return;
    const anim = this.controller.lastBattleAnim;
    if (anim === 'none') return;
    this.controller.lastBattleAnim = 'none';

    if (anim === 'player_attack') {
      this.tweens.add({
        targets: this.playerBattleSprite,
        x: 114,
        yoyo: true,
        duration: 90,
      });
      this.tweens.add({
        targets: this.enemyBattleSprite,
        alpha: 0.35,
        yoyo: true,
        repeat: 1,
        duration: 70,
        delay: 75,
      });
    } else if (anim === 'capture') {
      this.tweens.add({
        targets: this.enemyBattleSprite,
        scaleX: 1.5,
        scaleY: 1.5,
        yoyo: true,
        duration: 160,
      });
    }
  }
}

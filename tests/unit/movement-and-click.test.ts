import { describe, expect, it } from 'vitest';
import { MAPS_BY_ID } from '../../src/data/maps.ts';
import { NPCS } from '../../src/data/npcs.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { planClickToMove } from '../../src/domain/navigation.ts';
import { SaveRepository, type StorageAdapter } from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';
import { isTileWalkable } from '../../src/domain/world.ts';
import {
  GAME_SAVE_VALIDATION_REGISTRY,
  GameController,
} from '../../src/game/controller.ts';
import {
  RUN_STEP_DURATION_MS,
  WALK_STEP_DURATION_MS,
  worldPointToTile,
} from '../../src/game/movement.ts';

class MemoryStorage implements StorageAdapter {
  private readonly store = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  public removeItem(key: string): void {
    this.store.delete(key);
  }
}

function createReadyController(seed: number = 2026): GameController {
  const controller = new GameController(
    new SaveRepository(new MemoryStorage(), GAME_SAVE_VALIDATION_REGISTRY),
  );
  controller.startNewGame(seed, { skipTutorial: true });
  // Complete Rowan intro and choose Mosskit
  controller.advanceDialogue();
  controller.advanceDialogue();
  controller.selectDialogueChoice(controller.activeDialogue!.node.lines[2]!.choices![0]!);
  controller.advanceDialogue();
  controller.advanceDialogue();
  return controller;
}

describe('Unified smooth movement coordinator across 30/60/120 Hz and input edge cases', () => {
  it('moves continuously without dead pauses when holding a key across 30Hz, 60Hz, and 120Hz frame rates', () => {
    for (const hz of [30, 60, 120] as const) {
      const ctrl = createReadyController(100 + hz);
      // Move up 1 tile to clear row y=12 (long open road x=1..28 in Mosslight Hub)
      ctrl.movePlayer('up');
      expect(ctrl.state.playerPos).toEqual({ x: 15, y: 12, facing: 'up' });

      const dt = 1000 / hz;
      const startX = ctrl.state.playerPos.x;
      const startSteps = ctrl.state.stepCount;
      const visualXSamples: number[] = [];

      ctrl.pressMoveInput('key:ArrowLeft', 'left');
      // Immediate first-step response on press!
      expect(ctrl.state.playerPos.x).toBe(startX - 1);

      // Simulate 1000ms continuous hold at target Hz
      const frames = Math.round(hz * 1.0);
      for (let f = 0; f < frames; f++) {
        const snap = ctrl.tickMovement(dt);
        visualXSamples.push(snap.visualX);
      }
      ctrl.releaseMoveInput('key:ArrowLeft');

      // Finish landing smoothly onto integer tile
      for (let f = 0; f < Math.ceil(hz * 0.25); f++) {
        ctrl.tickMovement(dt);
      }

      const finalSnap = ctrl.movement.getSnapshot();
      expect(finalSnap.isMoving).toBe(false);
      expect(finalSnap.visualX).toBe(ctrl.state.playerPos.x);
      expect(Number.isInteger(ctrl.state.playerPos.x)).toBe(true);

      const tilesMoved = startX - ctrl.state.playerPos.x;
      // 1000ms / 165ms/tile -> ~6-7 tiles consistently across 30, 60, and 120 Hz!
      expect(tilesMoved).toBeGreaterThanOrEqual(6);
      expect(tilesMoved).toBeLessThanOrEqual(8);
      expect(ctrl.state.stepCount - startSteps).toBe(tilesMoved);

      // Verify monotonic smooth visual motion (never jumped backward or stalled mid-glide)
      for (let i = 1; i < visualXSamples.length; i++) {
        expect(visualXSamples[i]!).toBeLessThanOrEqual(visualXSamples[i - 1]! + 1e-6);
      }
    }
  });

  it('never doubles steps when holding multiple keys, never clips diagonally, and switches direction smoothly', () => {
    const ctrl = createReadyController(202);
    ctrl.movePlayer('up'); // (15, 12)
    const startX = ctrl.state.playerPos.x;

    // Hold ArrowLeft + KeyA + touch:left simultaneously for 500ms
    ctrl.pressMoveInput('key:ArrowLeft', 'left');
    ctrl.pressMoveInput('key:KeyA', 'left');
    ctrl.pressMoveInput('touch:left', 'left');
    for (let i = 0; i < 30; i++) {
      ctrl.tickMovement(16.67);
    }
    const movedDual = startX - ctrl.state.playerPos.x;
    // 500ms / 165ms = ~3-4 steps, NEVER 9-12 doubled steps!
    expect(movedDual).toBeGreaterThanOrEqual(3);
    expect(movedDual).toBeLessThanOrEqual(4);

    // Press ArrowUp while still holding left -> immediately turns up at next tile boundary, never diagonal!
    const xBeforeTurn = ctrl.state.playerPos.x;
    const yBeforeTurn = ctrl.state.playerPos.y;
    ctrl.pressMoveInput('key:ArrowUp', 'up');
    for (let i = 0; i < 15; i++) {
      const prev = { ...ctrl.state.playerPos };
      ctrl.tickMovement(16.67);
      const manhattanDelta =
        Math.abs(ctrl.state.playerPos.x - prev.x) + Math.abs(ctrl.state.playerPos.y - prev.y);
      expect(manhattanDelta).toBeLessThanOrEqual(1);
    }
    expect(ctrl.state.playerPos.y).toBeLessThan(yBeforeTurn);
    expect(ctrl.state.playerPos.x).toBe(xBeforeTurn);

    // Release ArrowUp -> resumes left cleanly because left sources are still held
    ctrl.releaseMoveInput('key:ArrowUp');
    const xAfterUpRelease = ctrl.state.playerPos.x;
    for (let i = 0; i < 15; i++) {
      ctrl.tickMovement(16.67);
    }
    expect(ctrl.state.playerPos.x).toBeLessThan(xAfterUpRelease);

    // Release all sources -> stops cleanly on integer tile
    ctrl.releaseMoveInput('key:ArrowLeft');
    ctrl.releaseMoveInput('key:KeyA');
    ctrl.releaseMoveInput('touch:left');
    for (let i = 0; i < 20; i++) ctrl.tickMovement(16.67);
    expect(ctrl.movement.isCurrentlyStepping()).toBe(false);
  });

  it('clamps huge frame deltas after tab freeze/switch and stops immediately on blur or menu open', () => {
    const ctrl = createReadyController(303);
    ctrl.movePlayer('up'); // (15, 12)
    const startX = ctrl.state.playerPos.x;

    ctrl.pressMoveInput('key:ArrowLeft', 'left');
    // Simulate a 4-second browser freeze/background spike in a single tick
    ctrl.tickMovement(4000);
    // Clamped to MAX_FRAME_DELTA_MS (50ms) -> still on the 1st tile, zero burst/teleport!
    expect(startX - ctrl.state.playerPos.x).toBe(1);

    // Blur cancels held movement immediately
    ctrl.cancelMovementInputs('blur');
    for (let i = 0; i < 25; i++) ctrl.tickMovement(16.67);
    expect(startX - ctrl.state.playerPos.x).toBe(1);
    expect(ctrl.movement.isCurrentlyStepping()).toBe(false);

    // Opening Journal while moving cancels held input
    ctrl.pressMoveInput('key:ArrowLeft', 'left');
    const xWhenOpeningMenu = ctrl.state.playerPos.x;
    ctrl.openJournal('quests');
    for (let i = 0; i < 20; i++) ctrl.tickMovement(16.67);
    ctrl.closeModal();
    for (let i = 0; i < 20; i++) ctrl.tickMovement(16.67);
    expect(ctrl.state.playerPos.x).toBe(xWhenOpeningMenu);
  });

  it('supports Walk vs Run speed while keeping step counts strictly per tile traversed and keeping companion locked to player trail', () => {
    const walkCtrl = createReadyController(404);
    walkCtrl.movePlayer('up'); // (15, 12)
    walkCtrl.updateSettings({ movementSpeed: 'walk' });

    const runCtrl = createReadyController(404);
    runCtrl.movePlayer('up'); // (15, 12)
    runCtrl.updateSettings({ movementSpeed: 'run' });

    expect(walkCtrl.movement.getStepDurationMs()).toBe(WALK_STEP_DURATION_MS);
    expect(runCtrl.movement.getStepDurationMs()).toBe(RUN_STEP_DURATION_MS);

    walkCtrl.pressMoveInput('key:ArrowLeft', 'left');
    runCtrl.pressMoveInput('key:ArrowLeft', 'left');
    for (let i = 0; i < 45; i++) {
      const ws = walkCtrl.tickMovement(16.67);
      const rs = runCtrl.tickMovement(16.67);
      // Companion always stays within 1 tile of player along exact path!
      expect(Math.hypot(ws.visualX - ws.companionVisualX, ws.visualY - ws.companionVisualY)).toBeLessThanOrEqual(
        1.45,
      );
      expect(Math.hypot(rs.visualX - rs.companionVisualX, rs.visualY - rs.companionVisualY)).toBeLessThanOrEqual(
        1.45,
      );
    }
    walkCtrl.releaseMoveInput('key:ArrowLeft');
    runCtrl.releaseMoveInput('key:ArrowLeft');
    for (let i = 0; i < 20; i++) {
      walkCtrl.tickMovement(16.67);
      runCtrl.tickMovement(16.67);
    }

    const walkDist = 15 - walkCtrl.state.playerPos.x;
    const runDist = 15 - runCtrl.state.playerPos.x;
    expect(runDist).toBeGreaterThan(walkDist);
    // Step counts strictly match tiles traversed (not frame count!)
    expect(walkCtrl.state.stepCount).toBe(1 + walkDist);
    expect(runCtrl.state.stepCount).toBe(1 + runDist);
    // Companion sits directly behind player
    expect(runCtrl.followerPos.x).toBe(runCtrl.state.playerPos.x + 1);
    expect(runCtrl.followerPos.y).toBe(runCtrl.state.playerPos.y);
  });
});

describe('Click-to-move pathfinding, smart interaction, obstacles, portals, and interruption safety', () => {
  it('converts world coordinates to grid tiles and navigates around obstacles to walkable tiles', () => {
    expect(worldPointToTile(16 * 15 + 8, 16 * 13 + 4)).toEqual({ x: 15, y: 13 });
    const ctrl = createReadyController(505);

    // Click around obstacles in Mosslight Hub to walkable tile (10, 10)
    const plan = ctrl.requestClickToMove(10, 10);
    expect(plan.ok).toBe(true);
    expect(plan.waypoints.length).toBeGreaterThan(4);

    // Every intermediate tile must be strictly walkable
    const map = MAPS_BY_ID.mosslight_hub;
    const npcsInHub = NPCS.filter((n) => n.regionId === 'mosslight_hub');
    for (const pt of plan.waypoints) {
      expect(isTileWalkable({ map, npcsInRegion: npcsInHub, state: ctrl.state, x: pt.x, y: pt.y })).toBe(
        true,
      );
    }

    // Tick until arrival
    for (let i = 0; i < 300 && ctrl.movement.hasActiveAutoPath(); i++) {
      ctrl.tickMovement(16.67);
    }
    for (let i = 0; i < 20; i++) ctrl.tickMovement(16.67);
    expect(ctrl.state.playerPos.x).toBe(10);
    expect(ctrl.state.playerPos.y).toBe(10);
  });

  it('walks to NPC, chest, signpost, and campfire, faces them, and triggers interaction exactly once', () => {
    const ctrl = createReadyController(606);

    // 1. Click Scout Mai at (16, 15)
    const npcPlan = ctrl.requestClickToMove(16, 15);
    expect(npcPlan.ok).toBe(true);
    expect(npcPlan.goal?.kind).toBe('npc');
    for (let i = 0; i < 120 && !ctrl.activeDialogue; i++) {
      ctrl.tickMovement(16.67);
    }
    expect(ctrl.activeDialogue).not.toBeNull();
    expect(ctrl.activeDialogue?.node.speaker).toContain('Mai');
    expect(Math.abs(ctrl.state.playerPos.x - 16) + Math.abs(ctrl.state.playerPos.y - 15)).toBe(1);
    expect(ctrl.movement.hasActiveAutoPath()).toBe(false);
    ctrl.advanceDialogue();
    expect(ctrl.activeDialogue).toBeNull();

    // 2. Click Basin Trail Signpost at (11, 13)
    const signPlan = ctrl.requestClickToMove(11, 13);
    expect(signPlan.ok).toBe(true);
    expect(signPlan.goal?.kind).toBe('prop');
    for (let i = 0; i < 180 && !ctrl.activeDialogue; i++) {
      ctrl.tickMovement(16.67);
    }
    expect(ctrl.activeDialogue).not.toBeNull();
    ctrl.advanceDialogue();

    // 3. Click Greenhouse chest at (5, 3) -> opens once and awards +40 tokens!
    const tokensBefore = ctrl.state.tokens;
    const chestPlan = ctrl.requestClickToMove(5, 3);
    expect(chestPlan.ok).toBe(true);
    for (let i = 0; i < 360 && !ctrl.state.openedProps.includes('hub_garden_chest'); i++) {
      ctrl.tickMovement(16.67);
    }
    expect(ctrl.state.openedProps).toContain('hub_garden_chest');
    expect(ctrl.state.tokens).toBe(tokensBefore + 40);

    // 4. Click Mosslight Campfire at (13, 9) -> walks adjacent & opens campfire interaction!
    const campPlan = ctrl.requestClickToMove(13, 9);
    expect(campPlan.ok).toBe(true);
    for (let i = 0; i < 360 && !ctrl.activeDialogue; i++) {
      ctrl.tickMovement(16.67);
    }
    expect(ctrl.activeDialogue).not.toBeNull();
    expect(ctrl.activeDialogue?.node.id).toContain('campfire');
  });

  it('transitions unlocked portals, explains locked portals, and rejects water/trees without clipping', () => {
    const ctrl = createReadyController(707);

    // 1. Clicking blocking tree (0, 0) or water rejects cleanly without moving
    const startPos = { ...ctrl.state.playerPos };
    const blocked = ctrl.requestClickToMove(0, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('blocked_tile');
    expect(ctrl.state.playerPos).toEqual(startPos);

    // 2. Clicking locked Reedwater Fen East Portal (31, 12) walks up and triggers lock explanation dialogue!
    const lockedPortalPlan = ctrl.requestClickToMove(31, 12);
    expect(lockedPortalPlan.ok).toBe(true);
    expect(lockedPortalPlan.goal?.kind).toBe('portal');
    for (let i = 0; i < 420 && !ctrl.activeDialogue; i++) {
      ctrl.tickMovement(16.67);
    }
    expect(ctrl.state.regionId).toBe('mosslight_hub');
    expect(ctrl.activeDialogue).not.toBeNull();
    ctrl.advanceDialogue();

    // 3. Clicking unlocked Whisperwood West Portal (0, 12) transitions region cleanly!
    const openPortalPlan = ctrl.requestClickToMove(0, 12);
    expect(openPortalPlan.ok).toBe(true);
    for (let i = 0; i < 650 && ctrl.state.regionId === 'mosslight_hub'; i++) {
      ctrl.tickMovement(16.67);
    }
    expect(ctrl.state.regionId).toBe('whisperwood');
    expect(ctrl.movement.hasActiveAutoPath()).toBe(false);
  });

  it('replaces old click target smoothly, cancels on manual input, stops on wild encounter without resuming after battle, and respects clickToMove setting', () => {
    const ctrl = createReadyController(808);

    // Start walking toward (5, 12), then immediately re-target (22, 12) mid-walk
    ctrl.requestClickToMove(5, 12);
    for (let i = 0; i < 15; i++) ctrl.tickMovement(16.67);
    ctrl.requestClickToMove(22, 12);
    for (let i = 0; i < 360 && ctrl.movement.hasActiveAutoPath(); i++) {
      ctrl.tickMovement(16.67);
    }
    for (let i = 0; i < 20; i++) ctrl.tickMovement(16.67);
    expect(ctrl.state.playerPos.x).toBe(22);
    expect(ctrl.state.playerPos.y).toBe(12);

    // Manual key input cancels click-to-move immediately
    ctrl.requestClickToMove(5, 12);
    expect(ctrl.movement.hasActiveAutoPath()).toBe(true);
    ctrl.pressMoveInput('key:ArrowUp', 'up');
    expect(ctrl.movement.hasActiveAutoPath()).toBe(false);
    ctrl.releaseMoveInput('key:ArrowUp');
    for (let i = 0; i < 20; i++) ctrl.tickMovement(16.67);

    // Wild encounter mid-walk stops auto-walk permanently (does NOT resume after battle!)
    ctrl.requestClickToMove(5, 12);
    expect(ctrl.movement.hasActiveAutoPath()).toBe(true);
    ctrl.startWildEncounter('dewgrub', 3);
    expect(ctrl.movement.hasActiveAutoPath()).toBe(false);
    const posAtBattle = { ...ctrl.state.playerPos };
    ctrl.submitBattleAction({ kind: 'flee' });
    ctrl.finishAndCloseBattle();
    for (let i = 0; i < 40; i++) ctrl.tickMovement(16.67);
    expect(ctrl.state.playerPos).toEqual(posAtBattle);

    // Disabling clickToMove prevents click movement
    ctrl.updateSettings({ clickToMove: false });
    const disabledPlan = ctrl.requestClickToMove(10, 12);
    expect(disabledPlan.ok).toBe(false);
    expect(ctrl.movement.hasActiveAutoPath()).toBe(false);

    // Pure planner rejects out-of-bounds cleanly
    const oob = planClickToMove({
      state: createInitialGameState(1),
      map: MAPS_BY_ID.mosslight_hub,
      npcsInRegion: NPCS.filter((n) => n.regionId === 'mosslight_hub'),
      speciesById: SPECIES_BY_ID,
      tileX: -1,
      tileY: 5,
    });
    expect(oob.ok).toBe(false);
    expect(oob.reason).toBe('out_of_bounds');
  });
});

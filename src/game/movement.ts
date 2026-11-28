import { MAPS_BY_ID } from '../data/maps.ts';
import { NPCS } from '../data/npcs.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import {
  directionBetweenAdjacentTiles,
  planClickToMove,
  type ClickMoveGoal,
  type ClickMovePlan,
  type GridPoint,
} from '../domain/navigation.ts';
import type { Direction, GameState, NpcDefinition, RegionId } from '../domain/types.ts';
import { getTileAt, isTileWalkable } from '../domain/world.ts';

export const WALK_STEP_DURATION_MS = 165;
export const RUN_STEP_DURATION_MS = 110;
export const REDUCED_MOTION_HOLD_CADENCE_MS = 140;
export const MAX_FRAME_DELTA_MS = 50;
const BUFFER_WINDOW_MS = 240;
const WALK_IDLE_GRACE_MS = 75;
const BLOCKED_FEEDBACK_MS = 520;
const BLOCKED_TOAST_COOLDOWN_MS = 900;

export interface MovementStepResult {
  readonly kind: 'moved' | 'blocked' | 'portal_entered' | 'portal_blocked' | 'wild_encounter' | 'locked';
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly followerFromX: number;
  readonly followerFromY: number;
  readonly followerToX: number;
  readonly followerToY: number;
}

export interface MovementHost {
  readonly state: GameState;
  readonly followerPos: { x: number; y: number; facing: Direction };
  isOverworldLocked(): boolean;
  executeGridStep(direction: Direction): MovementStepResult;
  interactAtGridTarget(targetX: number, targetY: number): void;
  notifyBlockedPortal(portalBlockedDialogueId: string | undefined, fallbackEn: string, fallbackVi: string): void;
  pushMovementNotice(messageEn: string, messageVi: string): void;
  emitMovementVisualOnly(): void;
}

export interface BlockedTileMarker {
  readonly x: number;
  readonly y: number;
  readonly remainingMs: number;
}

export interface MovementVisualSnapshot {
  readonly visualX: number;
  readonly visualY: number;
  readonly companionVisualX: number;
  readonly companionVisualY: number;
  readonly facing: Direction;
  readonly isMoving: boolean;
  readonly walkCyclePhase: number;
  readonly stepProgress: number;
  readonly activePath: ReadonlyArray<GridPoint>;
  readonly activeGoal: ClickMoveGoal | null;
  readonly blockedMarker: BlockedTileMarker | null;
  readonly pathVersion: number;
  readonly isRunning: boolean;
}

const NPCS_BY_REGION_CACHE: Readonly<Record<RegionId, ReadonlyArray<NpcDefinition>>> = {
  mosslight_hub: NPCS.filter((n) => n.regionId === 'mosslight_hub'),
  whisperwood: NPCS.filter((n) => n.regionId === 'whisperwood'),
  reedwater_fen: NPCS.filter((n) => n.regionId === 'reedwater_fen'),
  terracotta_ridge: NPCS.filter((n) => n.regionId === 'terracotta_ridge'),
  starfall_sanctuary: NPCS.filter((n) => n.regionId === 'starfall_sanctuary'),
};

export function getNpcsInRegion(regionId: RegionId): ReadonlyArray<NpcDefinition> {
  return NPCS_BY_REGION_CACHE[regionId];
}

export function worldPointToTile(worldX: number, worldY: number, tileSize: number = 16): GridPoint {
  return {
    x: Math.floor(worldX / tileSize),
    y: Math.floor(worldY / tileSize),
  };
}

export class MovementCoordinator {
  private readonly host: MovementHost;

  private readonly heldSources = new Map<string, Direction>();
  private readonly directionOrder: Direction[] = [];
  private sprintHeld = false;

  private bufferedDir: Direction | null = null;
  private bufferedAtMs = -9999;

  private activePath: GridPoint[] = [];
  private activeGoal: ClickMoveGoal | null = null;
  private pendingInteractGoal: ClickMoveGoal | null = null;
  private pathVersion = 0;

  private isStepping = false;
  private stepElapsedMs = 0;
  private currentStepDurationMs = WALK_STEP_DURATION_MS;
  private fromX: number;
  private fromY: number;
  private toX: number;
  private toY: number;

  private followerFromX: number;
  private followerFromY: number;
  private followerToX: number;
  private followerToY: number;

  private walkCyclePhase = 0;
  private walkIdleGraceMs = 0;
  private clockMs = 0;
  private lastBlockedToastMs = -9999;
  private blockedMarker: { x: number; y: number; remainingMs: number } | null = null;
  private lastRegionId: RegionId;

  public constructor(host: MovementHost) {
    this.host = host;
    this.fromX = host.state.playerPos.x;
    this.fromY = host.state.playerPos.y;
    this.toX = host.state.playerPos.x;
    this.toY = host.state.playerPos.y;
    this.followerFromX = host.followerPos.x;
    this.followerFromY = host.followerPos.y;
    this.followerToX = host.followerPos.x;
    this.followerToY = host.followerPos.y;
    this.lastRegionId = host.state.regionId;
  }

  public isRunningActive(): boolean {
    return this.host.state.settings.movementSpeed === 'run' || this.sprintHeld;
  }

  public getStepDurationMs(): number {
    if (this.host.state.settings.reducedMotion) {
      return this.isRunningActive() ? RUN_STEP_DURATION_MS : REDUCED_MOTION_HOLD_CADENCE_MS;
    }
    return this.isRunningActive() ? RUN_STEP_DURATION_MS : WALK_STEP_DURATION_MS;
  }

  public setSprintModifier(active: boolean): void {
    this.sprintHeld = active;
  }

  public getActiveHeldDirection(): Direction | null {
    for (let i = this.directionOrder.length - 1; i >= 0; i--) {
      const dir = this.directionOrder[i]!;
      for (const held of this.heldSources.values()) {
        if (held === dir) return dir;
      }
    }
    return null;
  }

  public hasActiveAutoPath(): boolean {
    return this.activePath.length > 0 || this.pendingInteractGoal !== null;
  }

  public isCurrentlyStepping(): boolean {
    return this.isStepping;
  }

  public syncExternalPosition(): void {
    const px = this.host.state.playerPos.x;
    const py = this.host.state.playerPos.y;
    const fx = this.host.followerPos.x;
    const fy = this.host.followerPos.y;
    const regionChanged = this.lastRegionId !== this.host.state.regionId;
    const jumped = Math.abs(px - this.toX) > 1 || Math.abs(py - this.toY) > 1 || regionChanged;

    if (jumped) {
      this.fromX = px;
      this.fromY = py;
      this.toX = px;
      this.toY = py;
      this.followerFromX = fx;
      this.followerFromY = fy;
      this.followerToX = fx;
      this.followerToY = fy;
      this.isStepping = false;
      this.stepElapsedMs = 0;
      this.walkIdleGraceMs = 0;
      this.lastRegionId = this.host.state.regionId;
      if (regionChanged) {
        this.clearAutoPath();
        this.bufferedDir = null;
      }
    } else if (!this.isStepping && (px !== this.toX || py !== this.toY)) {
      // External code (e.g., direct controller.movePlayer() call in unit tests) moved 1 tile
      this.fromX = px;
      this.fromY = py;
      this.toX = px;
      this.toY = py;
      this.followerFromX = fx;
      this.followerFromY = fy;
      this.followerToX = fx;
      this.followerToY = fy;
    }
  }

  public pressDirection(sourceId: string, direction: Direction): boolean {
    if (this.host.isOverworldLocked()) {
      return false;
    }
    this.syncExternalPosition();

    // Manual input always supersedes click-to-move cleanly
    this.clearAutoPath();

    const alreadyHeldSameSource = this.heldSources.get(sourceId) === direction;
    this.heldSources.set(sourceId, direction);
    const existingIdx = this.directionOrder.indexOf(direction);
    if (existingIdx >= 0) {
      this.directionOrder.splice(existingIdx, 1);
    }
    this.directionOrder.push(direction);

    if (alreadyHeldSameSource) {
      return false;
    }

    if (this.isStepping) {
      if (this.host.state.settings.reducedMotion) {
        // In reduced-motion mode there is no visual glide; discrete fresh taps respond immediately
        this.finishStepSilently();
        return this.beginStep(direction, 0);
      }
      // Single-slot turn/next-step buffer (never accumulates an unbounded queue)
      this.bufferedDir = direction;
      this.bufferedAtMs = this.clockMs;
      return false;
    }

    return this.beginStep(direction, 0);
  }

  public releaseDirection(sourceId: string): void {
    const prevDir = this.heldSources.get(sourceId);
    if (!prevDir) return;
    this.heldSources.delete(sourceId);

    const stillHeld = Array.from(this.heldSources.values()).includes(prevDir);
    if (!stillHeld) {
      const idx = this.directionOrder.indexOf(prevDir);
      if (idx >= 0) {
        this.directionOrder.splice(idx, 1);
      }
    }
  }

  public clearAllInputs(
    reason: 'modal' | 'dialogue' | 'battle' | 'region' | 'blur' | 'manual' | 'reset',
  ): void {
    this.heldSources.clear();
    this.directionOrder.length = 0;
    this.sprintHeld = false;
    this.bufferedDir = null;
    this.clearAutoPath();

    if (reason === 'battle' || reason === 'region' || reason === 'reset') {
      const px = this.host.state.playerPos.x;
      const py = this.host.state.playerPos.y;
      const fx = this.host.followerPos.x;
      const fy = this.host.followerPos.y;
      this.fromX = px;
      this.fromY = py;
      this.toX = px;
      this.toY = py;
      this.followerFromX = fx;
      this.followerFromY = fy;
      this.followerToX = fx;
      this.followerToY = fy;
      this.isStepping = false;
      this.stepElapsedMs = 0;
      this.walkIdleGraceMs = 0;
      this.lastRegionId = this.host.state.regionId;
    }
  }

  public clearAutoPath(): void {
    if (this.activePath.length > 0 || this.activeGoal !== null || this.pendingInteractGoal !== null) {
      this.activePath = [];
      this.activeGoal = null;
      this.pendingInteractGoal = null;
      this.pathVersion += 1;
    }
  }

  public requestClickToMove(tileX: number, tileY: number): ClickMovePlan {
    if (this.host.state.settings.clickToMove === false || this.host.isOverworldLocked()) {
      return {
        ok: false,
        goal: null,
        waypoints: [],
        immediateInteract: false,
      };
    }

    this.syncExternalPosition();
    const map = MAPS_BY_ID[this.host.state.regionId];
    const npcsInRegion = getNpcsInRegion(this.host.state.regionId);
    const plan = planClickToMove({
      state: this.host.state,
      map,
      npcsInRegion,
      speciesById: SPECIES_BY_ID,
      tileX,
      tileY,
    });

    if (!plan.ok) {
      if (plan.reason !== 'out_of_bounds') {
        this.blockedMarker = { x: tileX, y: tileY, remainingMs: BLOCKED_FEEDBACK_MS };
        this.pathVersion += 1;
      }
      if (plan.immediateBlockedPortal) {
        this.clearAutoPath();
        this.host.notifyBlockedPortal(
          plan.immediateBlockedPortal.blockedDialogueId,
          plan.reasonEn ?? plan.immediateBlockedPortal.labelEn,
          plan.reasonVi ?? plan.immediateBlockedPortal.labelVi,
        );
      } else if (
        (plan.reason === 'blocked_tile' || plan.reason === 'unreachable') &&
        this.clockMs - this.lastBlockedToastMs >= BLOCKED_TOAST_COOLDOWN_MS &&
        plan.reasonEn &&
        plan.reasonVi
      ) {
        this.lastBlockedToastMs = this.clockMs;
        this.host.pushMovementNotice(plan.reasonEn, plan.reasonVi);
      }
      return plan;
    }

    this.blockedMarker = null;
    this.bufferedDir = null;

    if (plan.reason === 'same_tile') {
      this.clearAutoPath();
      return plan;
    }

    if (plan.immediateInteract && plan.goal) {
      this.activePath = [];
      this.activeGoal = plan.goal;
      this.pathVersion += 1;
      if (this.isStepping && !this.host.state.settings.reducedMotion) {
        this.pendingInteractGoal = plan.goal;
      } else {
        this.finishStepSilently();
        this.executeGoalInteraction(plan.goal);
      }
      return plan;
    }

    this.activePath = [...plan.waypoints];
    this.activeGoal = plan.goal;
    this.pendingInteractGoal = null;
    this.pathVersion += 1;

    if (!this.isStepping) {
      this.advanceAutoPath(0);
    }
    return plan;
  }

  public tick(deltaMs: number): MovementVisualSnapshot {
    const dt = Math.max(0, Math.min(deltaMs, MAX_FRAME_DELTA_MS));
    this.clockMs += dt;

    if (this.blockedMarker) {
      this.blockedMarker.remainingMs -= dt;
      if (this.blockedMarker.remainingMs <= 0) {
        this.blockedMarker = null;
        this.pathVersion += 1;
      }
    }

    if (this.host.isOverworldLocked()) {
      if (this.heldSources.size > 0 || this.hasActiveAutoPath()) {
        this.clearAllInputs('modal');
      }
      this.syncExternalPosition();
      return this.buildSnapshot();
    }

    this.syncExternalPosition();

    if (this.isStepping) {
      this.stepElapsedMs += dt;
      const reduced = this.host.state.settings.reducedMotion;
      if (!reduced && this.currentStepDurationMs > 0) {
        this.walkCyclePhase = (this.walkCyclePhase + (dt / this.currentStepDurationMs) * 2) % 4;
      }
      this.walkIdleGraceMs = WALK_IDLE_GRACE_MS;

      if (this.stepElapsedMs >= this.currentStepDurationMs) {
        const carryMs = reduced
          ? 0
          : Math.min(this.stepElapsedMs - this.currentStepDurationMs, this.currentStepDurationMs * 0.85);
        this.finishStepSilently();
        this.triggerNextContinuousAction(carryMs);
      }
    } else {
      if (this.walkIdleGraceMs > 0) {
        this.walkIdleGraceMs = Math.max(0, this.walkIdleGraceMs - dt);
      }
      this.triggerNextContinuousAction(0);
    }

    return this.buildSnapshot();
  }

  public getSnapshot(): MovementVisualSnapshot {
    return this.buildSnapshot();
  }

  private finishStepSilently(): void {
    this.fromX = this.toX;
    this.fromY = this.toY;
    this.followerFromX = this.followerToX;
    this.followerFromY = this.followerToY;
    this.isStepping = false;
    this.stepElapsedMs = 0;
  }

  private triggerNextContinuousAction(carryMs: number): void {
    if (this.host.isOverworldLocked()) {
      this.clearAllInputs('modal');
      return;
    }

    // 1. Complete any pending adjacent click-to-move interaction once tile glide finished
    if (this.pendingInteractGoal) {
      const goal = this.pendingInteractGoal;
      this.pendingInteractGoal = null;
      this.executeGoalInteraction(goal);
      return;
    }

    // 2. Single-slot buffered direction (fresh turn pressed during previous tile)
    if (this.bufferedDir) {
      const dir = this.bufferedDir;
      const fresh = this.clockMs - this.bufferedAtMs <= BUFFER_WINDOW_MS;
      this.bufferedDir = null;
      if (fresh) {
        this.beginStep(dir, carryMs);
        return;
      }
    }

    // 3. Active held manual key or touch button (continuous, zero pause between tiles)
    const heldDir = this.getActiveHeldDirection();
    if (heldDir) {
      this.beginStep(heldDir, carryMs);
      return;
    }

    // 4. Click-to-move path continuation or arrival interaction
    if (this.activePath.length > 0 || this.activeGoal !== null) {
      this.advanceAutoPath(carryMs);
    }
  }

  private advanceAutoPath(carryMs: number): void {
    if (this.activePath.length === 0) {
      if (
        this.activeGoal &&
        (this.activeGoal.kind === 'npc' || this.activeGoal.kind === 'prop')
      ) {
        const goal = this.activeGoal;
        const dist =
          Math.abs(goal.x - this.host.state.playerPos.x) +
          Math.abs(goal.y - this.host.state.playerPos.y);
        if (dist === 1) {
          this.executeGoalInteraction(goal);
          return;
        }
      }
      this.clearAutoPath();
      return;
    }

    const nextPt = this.activePath[0]!;
    const px = this.host.state.playerPos.x;
    const py = this.host.state.playerPos.y;
    let dir = directionBetweenAdjacentTiles(px, py, nextPt.x, nextPt.y);

    // Validate the next waypoint is still adjacent and walkable (or is our intended target portal)
    const map = MAPS_BY_ID[this.host.state.regionId];
    const npcsInRegion = getNpcsInRegion(this.host.state.regionId);
    const isTargetPortalStep =
      this.activeGoal?.kind === 'portal' &&
      nextPt.x === this.activeGoal.x &&
      nextPt.y === this.activeGoal.y;
    const nextTileKind = getTileAt(map, nextPt.x, nextPt.y);
    const waypointStillValid =
      dir !== null &&
      (isTargetPortalStep ||
        (nextTileKind !== 'portal' &&
          isTileWalkable({
            map,
            npcsInRegion,
            state: this.host.state,
            x: nextPt.x,
            y: nextPt.y,
          })));

    if (!waypointStillValid) {
      // Automatically recalculate route around changed obstacles!
      if (!this.recalculateActiveAutoPath()) {
        return;
      }
      const recalculatedNext = this.activePath[0];
      if (!recalculatedNext) {
        this.advanceAutoPath(0);
        return;
      }
      dir = directionBetweenAdjacentTiles(
        this.host.state.playerPos.x,
        this.host.state.playerPos.y,
        recalculatedNext.x,
        recalculatedNext.y,
      );
      if (!dir) {
        this.clearAutoPath();
        return;
      }
    }

    if (!dir) {
      this.clearAutoPath();
      return;
    }

    this.activePath.shift();
    this.pathVersion += 1;

    const moved = this.beginStep(dir, carryMs);
    if (!moved) {
      // If step hit a locked portal or encounter or battle, beginStep already handled clearing path
      if (this.activeGoal && !this.host.isOverworldLocked()) {
        this.recalculateActiveAutoPath();
      }
    }
  }

  private recalculateActiveAutoPath(): boolean {
    if (!this.activeGoal) {
      this.clearAutoPath();
      return false;
    }
    const goal = this.activeGoal;
    const map = MAPS_BY_ID[this.host.state.regionId];
    const npcsInRegion = getNpcsInRegion(this.host.state.regionId);
    const replan = planClickToMove({
      state: this.host.state,
      map,
      npcsInRegion,
      speciesById: SPECIES_BY_ID,
      tileX: goal.x,
      tileY: goal.y,
    });
    if (!replan.ok) {
      this.clearAutoPath();
      if (replan.reasonEn && replan.reasonVi) {
        this.host.pushMovementNotice(replan.reasonEn, replan.reasonVi);
      }
      return false;
    }
    this.activePath = [...replan.waypoints];
    this.activeGoal = replan.goal;
    this.pathVersion += 1;
    if (replan.immediateInteract && replan.goal) {
      this.executeGoalInteraction(replan.goal);
      return false;
    }
    return true;
  }

  private executeGoalInteraction(goal: ClickMoveGoal): void {
    this.clearAutoPath();
    if (goal.kind !== 'npc' && goal.kind !== 'prop') {
      return;
    }
    const px = this.host.state.playerPos.x;
    const py = this.host.state.playerPos.y;
    const face = directionBetweenAdjacentTiles(px, py, goal.x, goal.y);
    if (face) {
      this.host.state.playerPos.facing = face;
    }
    this.host.interactAtGridTarget(goal.x, goal.y);
  }

  private beginStep(direction: Direction, carryMs: number): boolean {
    const result = this.host.executeGridStep(direction);
    if (result.kind === 'locked') {
      this.clearAllInputs('modal');
      return false;
    }
    if (result.kind === 'blocked') {
      this.fromX = result.fromX;
      this.fromY = result.fromY;
      this.toX = result.toX;
      this.toY = result.toY;
      this.isStepping = false;
      this.stepElapsedMs = 0;
      this.walkIdleGraceMs = 0;
      return false;
    }
    if (result.kind === 'portal_blocked') {
      this.clearAllInputs('dialogue');
      this.fromX = result.fromX;
      this.fromY = result.fromY;
      this.toX = result.toX;
      this.toY = result.toY;
      this.isStepping = false;
      this.stepElapsedMs = 0;
      return false;
    }
    if (result.kind === 'portal_entered') {
      this.clearAllInputs('region');
      this.lastRegionId = this.host.state.regionId;
      return false;
    }
    if (result.kind === 'wild_encounter') {
      // Snap cleanly to the encounter tile and cancel any auto-walk or held inputs so player never auto-walks after battle!
      this.clearAllInputs('battle');
      return false;
    }

    // Normal tile movement succeeded!
    this.fromX = result.fromX;
    this.fromY = result.fromY;
    this.toX = result.toX;
    this.toY = result.toY;
    this.followerFromX = result.followerFromX;
    this.followerFromY = result.followerFromY;
    this.followerToX = result.followerToX;
    this.followerToY = result.followerToY;

    this.currentStepDurationMs = this.getStepDurationMs();
    this.isStepping = true;
    this.stepElapsedMs = Math.max(0, Math.min(carryMs, this.currentStepDurationMs * 0.85));
    this.walkIdleGraceMs = WALK_IDLE_GRACE_MS;

    // If this was the final tile of an NPC/prop click-to-move, queue single interaction for arrival!
    if (
      this.activeGoal &&
      (this.activeGoal.kind === 'npc' || this.activeGoal.kind === 'prop') &&
      this.activePath.length === 0
    ) {
      const distAfter =
        Math.abs(this.activeGoal.x - this.toX) + Math.abs(this.activeGoal.y - this.toY);
      if (distAfter === 1) {
        this.pendingInteractGoal = this.activeGoal;
      }
    }

    return true;
  }

  private buildSnapshot(): MovementVisualSnapshot {
    const reduced = this.host.state.settings.reducedMotion;
    const progress =
      !this.isStepping || reduced || this.currentStepDurationMs <= 0
        ? 1
        : Math.max(0, Math.min(1, this.stepElapsedMs / this.currentStepDurationMs));

    const visualX = this.fromX + (this.toX - this.fromX) * progress;
    const visualY = this.fromY + (this.toY - this.fromY) * progress;
    const companionVisualX =
      this.followerFromX + (this.followerToX - this.followerFromX) * progress;
    const companionVisualY =
      this.followerFromY + (this.followerToY - this.followerFromY) * progress;

    return {
      visualX,
      visualY,
      companionVisualX,
      companionVisualY,
      facing: this.host.state.playerPos.facing,
      isMoving: this.isStepping || this.walkIdleGraceMs > 0,
      walkCyclePhase: this.walkCyclePhase,
      stepProgress: progress,
      activePath: this.activePath,
      activeGoal: this.activeGoal,
      blockedMarker: this.blockedMarker ? { ...this.blockedMarker } : null,
      pathVersion: this.pathVersion,
      isRunning: this.isRunningActive(),
    };
  }
}

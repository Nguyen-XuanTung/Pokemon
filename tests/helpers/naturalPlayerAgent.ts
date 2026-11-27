import { ITEMS_BY_ID } from '../../src/data/items.ts';
import { MAPS_BY_ID } from '../../src/data/maps.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { NPCS } from '../../src/data/npcs.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { getTypeMultiplier } from '../../src/domain/elements.ts';
import type { Direction, GameState } from '../../src/domain/types.ts';
import { getTileAt, isTileWalkable, offsetByDirection } from '../../src/domain/world.ts';
import type { GameController } from '../../src/game/controller.ts';

const DIRECTIONS: ReadonlyArray<Direction> = ['up', 'down', 'left', 'right'];

const CHARM_PRIORITY = ['star_charm', 'amber_charm', 'reed_charm', 'moss_charm'] as const;
const HEAL_PRIORITY = ['nectar_flask', 'orchard_salve', 'dew_tonic'] as const;

/**
 * Pure read-only BFS pathfinder over the current region grid.
 * Never mutates state; avoids stepping onto portals unless the portal itself is the destination.
 */
export function findWalkPath(
  state: GameState,
  targetX: number,
  targetY: number,
): Direction[] | null {
  if (state.playerPos.x === targetX && state.playerPos.y === targetY) {
    return [];
  }
  const map = MAPS_BY_ID[state.regionId];
  const npcsInRegion = NPCS.filter((n) => n.regionId === state.regionId);

  const visited = new Set<string>([`${state.playerPos.x},${state.playerPos.y}`]);
  const queue: Array<{ x: number; y: number; path: Direction[] }> = [
    { x: state.playerPos.x, y: state.playerPos.y, path: [] },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dir of DIRECTIONS) {
      const nxt = offsetByDirection(cur.x, cur.y, dir);
      const key = `${nxt.x},${nxt.y}`;
      if (visited.has(key)) continue;

      const isTarget = nxt.x === targetX && nxt.y === targetY;
      const tile = getTileAt(map, nxt.x, nxt.y);

      if (tile === 'portal') {
        if (isTarget) {
          return [...cur.path, dir];
        }
        continue;
      }

      if (isTileWalkable({ map, npcsInRegion, state, x: nxt.x, y: nxt.y })) {
        const nextPath = [...cur.path, dir];
        if (isTarget) {
          return nextPath;
        }
        visited.add(key);
        queue.push({ x: nxt.x, y: nxt.y, path: nextPath });
      }
    }
  }
  return null;
}

export function findAdjacentStandTile(
  state: GameState,
  objectX: number,
  objectY: number,
): { standX: number; standY: number; faceDir: Direction; path: Direction[] } | null {
  const candidates: Array<{
    standX: number;
    standY: number;
    faceDir: Direction;
    path: Direction[];
  }> = [];

  const pairs: ReadonlyArray<[number, number, Direction]> = [
    [objectX, objectY + 1, 'up'],
    [objectX, objectY - 1, 'down'],
    [objectX + 1, objectY, 'left'],
    [objectX - 1, objectY, 'right'],
  ];

  const map = MAPS_BY_ID[state.regionId];
  const npcsInRegion = NPCS.filter((n) => n.regionId === state.regionId);

  for (const [sx, sy, faceDir] of pairs) {
    if (!isTileWalkable({ map, npcsInRegion, state, x: sx, y: sy })) continue;
    if (getTileAt(map, sx, sy) === 'portal') continue;
    const path = findWalkPath(state, sx, sy);
    if (path !== null) {
      candidates.push({ standX: sx, standY: sy, faceDir, path });
    }
  }

  candidates.sort((a, b) => a.path.length - b.path.length);
  return candidates[0] ?? null;
}

export interface BattlePolicyOptions {
  readonly tryCaptureNewSpecies?: boolean;
  readonly preferFleeWild?: boolean;
  readonly onCapturedCallback?: (info: {
    speciesId: string;
    level: number;
    maxHp: number;
    ownedBefore: number;
  }) => void;
}

function getBestAvailableCharm(state: GameState): string | null {
  for (const id of CHARM_PRIORITY) {
    const slot = state.inventory.find((s) => s.itemId === id && s.quantity > 0);
    if (slot) return id;
  }
  return null;
}

function getBestHealItem(state: GameState): string | null {
  for (const id of HEAL_PRIORITY) {
    const slot = state.inventory.find((s) => s.itemId === id && s.quantity > 0);
    if (slot && ITEMS_BY_ID[id]) return id;
  }
  return null;
}

/**
 * Resolves an active battle strictly through `submitBattleAction` and `finishAndCloseBattle`.
 */
export function playOutActiveBattleNaturally(
  controller: GameController,
  policy: BattlePolicyOptions = {},
): void {
  if (!controller.activeBattle) return;

  const initialEnemy = controller.activeBattle.enemyParty[0]!;
  const initialSnapshot = {
    speciesId: initialEnemy.speciesId,
    level: initialEnemy.level,
    maxHp: initialEnemy.maxHp,
    ownedBefore: controller.state.party.length + controller.state.sanctuaryBox.length,
  };

  let safety = 0;
  while (controller.activeBattle && controller.activeBattle.outcome === 'ongoing' && safety < 90) {
    safety += 1;
    const battle = controller.activeBattle;
    const active = battle.playerParty[battle.activePlayerIndex]!;
    const foe = battle.enemyParty[battle.activeEnemyIndex]!;
    const foeSpec = SPECIES_BY_ID[foe.speciesId]!;
    const activeSpec = SPECIES_BY_ID[active.speciesId]!;

    // 1. Heal in-battle if boss/trainer fight and active partner drops below 55% HP
    if (battle.kind === 'trainer' && active.currentHp < active.maxHp * 0.55) {
      const healId = getBestHealItem(controller.state);
      if (healId) {
        controller.submitBattleAction({ kind: 'item', itemId: healId });
        continue;
      }
    }

    // 2. Switch to a healthier elemental counter during trainer/boss battles if current matchup is poor
    if (battle.kind === 'trainer') {
      const foeVsCurrent = getTypeMultiplier(foeSpec.element, activeSpec.element);
      if (foeVsCurrent > 1.2 && active.currentHp < active.maxHp * 0.75) {
        const betterIdx = battle.playerParty.findIndex((cand, idx) => {
          if (idx === battle.activePlayerIndex || cand.currentHp <= cand.maxHp * 0.45) return false;
          const cSpec = SPECIES_BY_ID[cand.speciesId]!;
          const offense = cand.moves.some((m) => {
            const md = MOVES_BY_ID[m.moveId];
            return md && m.pp > 0 && md.power > 0 && getTypeMultiplier(md.element, foeSpec.element) > 1.1;
          });
          return offense && getTypeMultiplier(foeSpec.element, cSpec.element) <= 1;
        });
        if (betterIdx >= 0) {
          controller.submitBattleAction({ kind: 'switch', partyIndex: betterIdx });
          continue;
        }
      }
    }

    // 3. Wild encounter capture logic when encountering an unbonded species
    if (
      battle.kind === 'wild' &&
      policy.tryCaptureNewSpecies &&
      !controller.state.caughtSpecies.includes(foe.speciesId)
    ) {
      const charmId = getBestAvailableCharm(controller.state);
      if (charmId) {
        const hpRatio = foe.currentHp / Math.max(1, foe.maxHp);
        // Sleep move if available and foe is awake
        const sleepMoveIdx = active.moves.findIndex((m) => {
          const md = MOVES_BY_ID[m.moveId];
          return md && m.pp > 0 && md.power === 0 && md.statusEffect?.status === 'sleep';
        });
        if (foe.status === null && sleepMoveIdx >= 0 && hpRatio > 0.35) {
          controller.submitBattleAction({ kind: 'move', moveIndex: sleepMoveIdx });
          continue;
        }
        // Chip HP gently if still high and we have a gentle move unlikely to KO
        if (hpRatio > 0.62 && active.level <= foe.level + 4) {
          const gentleIdx = active.moves.findIndex((m) => {
            const md = MOVES_BY_ID[m.moveId];
            return (
              md &&
              m.pp > 0 &&
              md.power > 0 &&
              md.power <= 45 &&
              getTypeMultiplier(md.element, foeSpec.element) <= 1
            );
          });
          if (gentleIdx >= 0) {
            controller.submitBattleAction({ kind: 'move', moveIndex: gentleIdx });
            continue;
          }
        }
        controller.submitBattleAction({ kind: 'item', itemId: charmId });
        continue;
      }
    }

    // 4. Optional wild flee when commuting with low HP
    if (battle.kind === 'wild' && policy.preferFleeWild) {
      controller.submitBattleAction({ kind: 'flee' });
      continue;
    }

    // 5. Pick highest expected damage move
    let bestMoveIdx = 0;
    let bestScore = -1;
    active.moves.forEach((slot, idx) => {
      const mDef = MOVES_BY_ID[slot.moveId];
      if (!mDef || slot.pp <= 0) return;
      const stab = mDef.element === activeSpec.element ? 1.2 : 1;
      const eff = getTypeMultiplier(mDef.element, foeSpec.element);
      const score = mDef.power * stab * eff;
      if (score > bestScore) {
        bestScore = score;
        bestMoveIdx = idx;
      }
    });
    controller.submitBattleAction({ kind: 'move', moveIndex: bestMoveIdx });
  }

  const finalOutcome = controller.activeBattle?.outcome;
  controller.finishAndCloseBattle();

  if (finalOutcome === 'captured' && policy.onCapturedCallback) {
    policy.onCapturedCallback(initialSnapshot);
  }

  // Advance any trainer post-battle dialogue naturally
  closeAnyOpenDialogueNaturally(controller);
}

export function closeAnyOpenDialogueNaturally(controller: GameController): void {
  let guard = 0;
  while (controller.activeDialogue && guard < 30) {
    guard += 1;
    const dlg = controller.activeDialogue;
    const line = dlg.node.lines[dlg.lineIndex];
    if (!line) break;
    if (line.choices && line.choices.length > 0) {
      // Pick the non-battle / leave / continue option by default when closing general dialogues
      const lastChoice = line.choices[line.choices.length - 1]!;
      controller.selectDialogueChoice(lastChoice);
    } else {
      controller.advanceDialogue();
    }
  }
}

export function walkNaturallyToTile(
  controller: GameController,
  targetX: number,
  targetY: number,
  battlePolicy: BattlePolicyOptions = { tryCaptureNewSpecies: true },
): void {
  const startRegion = controller.state.regionId;
  let guard = 0;
  while (
    controller.state.regionId === startRegion &&
    (controller.state.playerPos.x !== targetX || controller.state.playerPos.y !== targetY) &&
    guard < 400
  ) {
    guard += 1;
    if (controller.activeBattle) {
      playOutActiveBattleNaturally(controller, battlePolicy);
      continue;
    }
    if (controller.activeDialogue) {
      closeAnyOpenDialogueNaturally(controller);
      continue;
    }
    if (controller.activeModal !== 'none') {
      controller.closeModal();
    }
    const path = findWalkPath(controller.state, targetX, targetY);
    if (!path || path.length === 0) {
      throw new Error(
        `No natural walkable path in ${controller.state.regionId} from (${controller.state.playerPos.x},${controller.state.playerPos.y}) to (${targetX},${targetY})`,
      );
    }
    controller.movePlayer(path[0]!);
    if (controller.activeBattle) {
      playOutActiveBattleNaturally(controller, battlePolicy);
    }
  }
}

export function walkAdjacentAndFace(
  controller: GameController,
  objectX: number,
  objectY: number,
  battlePolicy: BattlePolicyOptions = { tryCaptureNewSpecies: true },
): void {
  const adj = findAdjacentStandTile(controller.state, objectX, objectY);
  if (!adj) {
    throw new Error(
      `Object at (${objectX},${objectY}) in ${controller.state.regionId} has no reachable adjacent tile from (${controller.state.playerPos.x},${controller.state.playerPos.y})`,
    );
  }
  walkNaturallyToTile(controller, adj.standX, adj.standY, battlePolicy);
  if (controller.state.playerPos.facing !== adj.faceDir) {
    // Stepping toward the blocking object turns the player to face it naturally
    controller.movePlayer(adj.faceDir);
    if (controller.activeBattle) {
      playOutActiveBattleNaturally(controller, battlePolicy);
    }
  }
}

export function restAtCampfireNaturally(
  controller: GameController,
  campfireX: number,
  campfireY: number,
): void {
  walkAdjacentAndFace(controller, campfireX, campfireY, { preferFleeWild: true });
  controller.interactFacing();
  // Campfire line 0 executes heal_party immediately; select "Leave" (last choice)
  closeAnyOpenDialogueNaturally(controller);
}

export function interactAndAcceptFirstChoiceNaturally(
  controller: GameController,
  targetX: number,
  targetY: number,
  battlePolicy: BattlePolicyOptions = { tryCaptureNewSpecies: true },
): void {
  walkAdjacentAndFace(controller, targetX, targetY, battlePolicy);
  controller.interactFacing();
  let guard = 0;
  while (controller.activeDialogue && guard < 25) {
    guard += 1;
    const dlg = controller.activeDialogue;
    const line = dlg.node.lines[dlg.lineIndex]!;
    if (line.choices && line.choices.length > 0) {
      controller.selectDialogueChoice(line.choices[0]!);
    } else {
      controller.advanceDialogue();
    }
  }
  if (controller.activeBattle) {
    playOutActiveBattleNaturally(controller, battlePolicy);
  }
}

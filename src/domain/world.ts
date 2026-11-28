import type { SeededRng } from './rng.ts';
import type {
  Direction,
  EncounterEntry,
  GameState,
  NpcDefinition,
  PortalDefinition,
  RegionMapDefinition,
  SpeciesDefinition,
  TileKind,
  TimeOfDay,
  WorldPropDefinition,
} from './types.ts';

const CHAR_TO_TILE: Readonly<Record<string, TileKind>> = {
  '.': 'grass',
  ',': 'flowers',
  '=': 'path',
  '"': 'tall_grass',
  '~': 'water',
  '#': 'wall',
  'T': 'tree',
  '^': 'cliff',
  'B': 'bridge',
  ':': 'sand',
  '_': 'stone_floor',
  ';': 'reed_marsh',
  'P': 'portal',
  'C': 'campfire',
  'S': 'shrine',
};

const BLOCKING_TILES: ReadonlySet<TileKind> = new Set<TileKind>([
  'water',
  'wall',
  'tree',
  'cliff',
  'campfire',
  'shrine',
]);

export const TIME_CYCLE: ReadonlyArray<TimeOfDay> = ['morning', 'day', 'dusk', 'night'];

export function parseMapGrid(map: RegionMapDefinition): TileKind[][] {
  const grid: TileKind[][] = [];
  for (let y = 0; y < map.height; y++) {
    const rowStr = map.rows[y] ?? '';
    const row: TileKind[] = [];
    for (let x = 0; x < map.width; x++) {
      const ch = rowStr[x] ?? '#';
      row.push(CHAR_TO_TILE[ch] ?? 'grass');
    }
    grid.push(row);
  }
  return grid;
}

export function getTileAt(map: RegionMapDefinition, x: number, y: number): TileKind {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return 'wall';
  }
  const rowStr = map.rows[y];
  if (!rowStr) return 'wall';
  const ch = rowStr[x] ?? '#';
  return CHAR_TO_TILE[ch] ?? 'wall';
}

export function offsetByDirection(
  x: number,
  y: number,
  dir: Direction,
): { x: number; y: number } {
  if (dir === 'up') return { x, y: y - 1 };
  if (dir === 'down') return { x, y: y + 1 };
  if (dir === 'left') return { x: x - 1, y };
  return { x: x + 1, y };
}

export function nextTimeOfDay(current: TimeOfDay): TimeOfDay {
  const idx = TIME_CYCLE.indexOf(current);
  const nextIdx = (idx + 1) % TIME_CYCLE.length;
  return TIME_CYCLE[nextIdx] ?? 'day';
}

export function isPropVisible(prop: WorldPropDefinition, state: GameState): boolean {
  if (prop.requiredFlag && !state.flags[prop.requiredFlag]) {
    return false;
  }
  if (prop.requiredTime && state.timeOfDay !== prop.requiredTime) {
    return false;
  }
  return true;
}

export function isTileWalkable(params: {
  map: RegionMapDefinition;
  npcsInRegion: ReadonlyArray<NpcDefinition>;
  state: GameState;
  x: number;
  y: number;
}): boolean {
  const { map, npcsInRegion, state, x, y } = params;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return false;
  }
  const tile = getTileAt(map, x, y);
  if (BLOCKING_TILES.has(tile)) {
    return false;
  }
  for (const npc of npcsInRegion) {
    if (npc.x === x && npc.y === y) {
      return false;
    }
  }
  for (const prop of map.props) {
    if (prop.x === x && prop.y === y && isPropVisible(prop, state)) {
      return false;
    }
  }
  if (map.decorations) {
    for (const dec of map.decorations) {
      if (!dec.blocking) continue;
      const w = dec.width ?? 1;
      const h = dec.height ?? 1;
      if (x >= dec.x && x < dec.x + w && y >= dec.y && y < dec.y + h) {
        return false;
      }
    }
  }
  return true;
}

export type StepOutcome =
  | { readonly kind: 'blocked' }
  | { readonly kind: 'portal_blocked'; readonly portal: PortalDefinition }
  | { readonly kind: 'portal_entered'; readonly portal: PortalDefinition }
  | {
      readonly kind: 'wild_encounter';
      readonly speciesId: string;
      readonly level: number;
      readonly isRareVariant?: boolean;
    }
  | { readonly kind: 'moved' };

export function rollWildEncounter(
  encounters: ReadonlyArray<EncounterEntry>,
  timeOfDay: TimeOfDay,
  rng: SeededRng,
  hasRegionalTrace: boolean = false,
): { speciesId: string; level: number; isRareVariant: boolean } | null {
  if (encounters.length === 0) return null;
  const weighted = encounters.map((entry) => {
    let bonus = entry.timeBonus?.includes(timeOfDay) ? 1.8 : 1;
    if (hasRegionalTrace && (entry.isRareSpot || entry.timeBonus?.includes(timeOfDay))) {
      bonus *= 1.9;
    }
    return {
      item: entry,
      weight: Math.max(1, Math.round(entry.weight * bonus)),
    };
  });
  const picked = rng.weightedPick(weighted);
  const level = rng.nextInt(picked.minLevel, picked.maxLevel);
  const gleamingChance = hasRegionalTrace ? 0.1 : 1 / 28;
  const isRareVariant = rng.chance(gleamingChance);
  return { speciesId: picked.speciesId, level, isRareVariant };
}

export function attemptPlayerStep(params: {
  state: GameState;
  map: RegionMapDefinition;
  npcsInRegion: ReadonlyArray<NpcDefinition>;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
  direction: Direction;
  rng: SeededRng;
}): StepOutcome {
  const { state, map, npcsInRegion, speciesById, direction, rng } = params;
  state.playerPos.facing = direction;
  const target = offsetByDirection(state.playerPos.x, state.playerPos.y, direction);

  const portal = map.portals.find((p) => p.x === target.x && p.y === target.y);
  if (portal) {
    if (portal.requiredFlag && !state.flags[portal.requiredFlag]) {
      return { kind: 'portal_blocked', portal };
    }
    if (portal.requiredLeadElement) {
      const lead = state.party[0];
      const leadSpec = lead ? speciesById[lead.speciesId] : undefined;
      if (!leadSpec || leadSpec.element !== portal.requiredLeadElement) {
        return { kind: 'portal_blocked', portal };
      }
    }
    state.regionId = portal.targetRegion;
    state.playerPos.x = portal.targetX;
    state.playerPos.y = portal.targetY;
    state.playerPos.facing = portal.targetFacing;
    state.flags[`visited_${portal.targetRegion}`] = true;
    state.stepCount += 1;
    return { kind: 'portal_entered', portal };
  }

  if (!isTileWalkable({ map, npcsInRegion, state, x: target.x, y: target.y })) {
    return { kind: 'blocked' };
  }

  state.playerPos.x = target.x;
  state.playerPos.y = target.y;
  state.stepCount += 1;
  if (state.stepCount % 48 === 0) {
    state.timeOfDay = nextTimeOfDay(state.timeOfDay);
  }
  if (state.wardStepsRemaining > 0) {
    state.wardStepsRemaining -= 1;
  }

  const steppedTile = getTileAt(map, target.x, target.y);
  const isEncounterPatch = steppedTile === 'tall_grass' || steppedTile === 'reed_marsh';
  if (
    isEncounterPatch &&
    state.party.some((c) => c.currentHp > 0) &&
    state.wardStepsRemaining === 0 &&
    map.encounterRate > 0 &&
    rng.chance(map.encounterRate)
  ) {
    const hasTrace = map.props.some(
      (p) =>
        p.kind === 'trace' &&
        (state.discoveredTraces.includes(p.id) || Boolean(p.setsFlag && state.flags[p.setsFlag])),
    );
    const rolled = rollWildEncounter(map.encounters, state.timeOfDay, rng, hasTrace);
    if (rolled) {
      return {
        kind: 'wild_encounter',
        speciesId: rolled.speciesId,
        level: rolled.level,
        isRareVariant: rolled.isRareVariant,
      };
    }
  }

  return { kind: 'moved' };
}

export function resolveNpcDialogueId(npc: NpcDefinition, state: GameState): string {
  if (npc.conditionalDialogues) {
    for (const rule of npc.conditionalDialogues) {
      if (rule.requiredFlag && !state.flags[rule.requiredFlag]) continue;
      if (rule.forbiddenFlag && state.flags[rule.forbiddenFlag]) continue;
      if (rule.questId && rule.questState) {
        const progress = state.quests[rule.questId];
        const actual = progress ? progress.status : 'not_started';
        if (actual !== rule.questState) continue;
      }
      return rule.dialogueId;
    }
  }
  if (npc.trainerBattle && !state.defeatedTrainers.includes(npc.trainerBattle.id)) {
    return npc.trainerBattle.preBattleDialogueId;
  }
  if (npc.trainerBattle && state.defeatedTrainers.includes(npc.trainerBattle.id)) {
    return npc.trainerBattle.defeatDialogueId;
  }
  return npc.defaultDialogueId;
}

export type FacingInteraction =
  | { readonly kind: 'none' }
  | { readonly kind: 'npc'; readonly npc: NpcDefinition; readonly dialogueId: string }
  | { readonly kind: 'prop'; readonly prop: WorldPropDefinition };

export function inspectFacingTile(params: {
  state: GameState;
  map: RegionMapDefinition;
  npcsInRegion: ReadonlyArray<NpcDefinition>;
}): FacingInteraction {
  const { state, map, npcsInRegion } = params;
  const target = offsetByDirection(
    state.playerPos.x,
    state.playerPos.y,
    state.playerPos.facing,
  );
  const npc = npcsInRegion.find((n) => n.x === target.x && n.y === target.y);
  if (npc) {
    return {
      kind: 'npc',
      npc,
      dialogueId: resolveNpcDialogueId(npc, state),
    };
  }
  const prop = map.props.find(
    (p) => p.x === target.x && p.y === target.y && isPropVisible(p, state),
  );
  if (prop) {
    return { kind: 'prop', prop };
  }
  return { kind: 'none' };
}

import type {
  CreatureInstance,
  MoveDefinition,
  MoveSlot,
  RegionId,
  SpeciesDefinition,
} from './types.ts';

export const MAX_PARTY_SIZE = 6;
export const MAX_ACTIVE_MOVES = 4;
export const MAX_CREATURE_LEVEL = 40;

export function expRequiredForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_CREATURE_LEVEL, Math.floor(level)));
  if (clamped <= 1) return 0;
  return Math.floor(8 * Math.pow(clamped, 2.35));
}

export function computeStatsForLevel(
  species: SpeciesDefinition,
  level: number,
): { maxHp: number; atk: number; def: number; spd: number } {
  const lv = Math.max(1, Math.min(MAX_CREATURE_LEVEL, Math.floor(level)));
  const maxHp = Math.floor(species.baseStats.hp * 0.65 + (species.baseStats.hp * lv) / 18 + lv + 10);
  const atk = Math.floor(species.baseStats.atk * 0.45 + (species.baseStats.atk * lv) / 22 + 5);
  const def = Math.floor(species.baseStats.def * 0.45 + (species.baseStats.def * lv) / 22 + 5);
  const spd = Math.floor(species.baseStats.spd * 0.45 + (species.baseStats.spd * lv) / 22 + 5);
  return { maxHp, atk, def, spd };
}

export function buildInitialMoves(
  species: SpeciesDefinition,
  level: number,
  movesById: Readonly<Record<string, MoveDefinition>>,
): MoveSlot[] {
  const eligible = species.learnset
    .filter((entry) => entry.level <= level)
    .map((entry) => entry.moveId);
  const selectedIds = eligible.slice(-MAX_ACTIVE_MOVES);
  if (selectedIds.length === 0 && species.learnset[0]) {
    selectedIds.push(species.learnset[0].moveId);
  }
  const slots: MoveSlot[] = [];
  for (const moveId of selectedIds) {
    const def = movesById[moveId];
    if (!def) continue;
    slots.push({
      moveId: def.id,
      pp: def.maxPp,
      maxPp: def.maxPp,
    });
  }
  return slots;
}

export function createCreatureInstance(params: {
  uid: string;
  species: SpeciesDefinition;
  level: number;
  bondedRegion: RegionId;
  movesById: Readonly<Record<string, MoveDefinition>>;
  nickname?: string;
  isRareVariant?: boolean;
}): CreatureInstance {
  const level = Math.max(1, Math.min(MAX_CREATURE_LEVEL, Math.floor(params.level)));
  const computed = computeStatsForLevel(params.species, level);
  return {
    uid: params.uid,
    speciesId: params.species.id,
    nickname: params.nickname,
    ...(params.isRareVariant ? { isRareVariant: true } : {}),
    level,
    exp: expRequiredForLevel(level),
    currentHp: computed.maxHp,
    maxHp: computed.maxHp,
    stats: {
      atk: computed.atk,
      def: computed.def,
      spd: computed.spd,
    },
    moves: buildInitialMoves(params.species, level, params.movesById),
    status: null,
    statusTurns: 0,
    bondedRegion: params.bondedRegion,
  };
}

export function healCreatureFully(
  creature: CreatureInstance,
  movesById: Readonly<Record<string, MoveDefinition>>,
): void {
  creature.currentHp = creature.maxHp;
  creature.status = null;
  creature.statusTurns = 0;
  for (const slot of creature.moves) {
    const def = movesById[slot.moveId];
    slot.maxPp = def ? def.maxPp : slot.maxPp;
    slot.pp = slot.maxPp;
  }
}

export interface ExpGainResult {
  readonly expGained: number;
  readonly levelsGained: number;
  readonly newLevel: number;
  readonly learnedMoveIds: string[];
  readonly evolvedFromSpeciesId?: string;
  readonly evolvedToSpeciesId?: string;
}

export function awardCreatureExperience(params: {
  creature: CreatureInstance;
  expGain: number;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
  movesById: Readonly<Record<string, MoveDefinition>>;
}): ExpGainResult {
  const { creature, expGain, speciesById, movesById } = params;
  if (creature.level >= MAX_CREATURE_LEVEL || expGain <= 0) {
    return {
      expGained: 0,
      levelsGained: 0,
      newLevel: creature.level,
      learnedMoveIds: [],
    };
  }

  const initialSpecies = speciesById[creature.speciesId];
  if (!initialSpecies) {
    throw new Error(`Unknown species: ${creature.speciesId}`);
  }
  let currentSpecies: SpeciesDefinition = initialSpecies;

  creature.exp += Math.floor(expGain);
  let levelsGained = 0;
  const learnedMoveIds: string[] = [];
  let evolvedFromSpeciesId: string | undefined;
  let evolvedToSpeciesId: string | undefined;

  while (
    creature.level < MAX_CREATURE_LEVEL &&
    creature.exp >= expRequiredForLevel(creature.level + 1)
  ) {
    creature.level += 1;
    levelsGained += 1;

    const evoSpec = currentSpecies.evolvesTo;
    if (evoSpec && creature.level >= evoSpec.level) {
      const nextSpecies: SpeciesDefinition | undefined = speciesById[evoSpec.speciesId];
      if (nextSpecies) {
        evolvedFromSpeciesId = evolvedFromSpeciesId ?? currentSpecies.id;
        evolvedToSpeciesId = nextSpecies.id;
        creature.speciesId = nextSpecies.id;
        currentSpecies = nextSpecies;
      }
    }

    const oldMaxHp = creature.maxHp;
    const updatedStats = computeStatsForLevel(currentSpecies, creature.level);
    creature.maxHp = updatedStats.maxHp;
    creature.stats = {
      atk: updatedStats.atk,
      def: updatedStats.def,
      spd: updatedStats.spd,
    };
    const hpDelta = Math.max(1, updatedStats.maxHp - oldMaxHp);
    if (creature.currentHp > 0) {
      creature.currentHp = Math.min(creature.maxHp, creature.currentHp + hpDelta);
    }

    for (const learnEntry of currentSpecies.learnset) {
      if (learnEntry.level === creature.level) {
        const alreadyHas = creature.moves.some((m) => m.moveId === learnEntry.moveId);
        const moveDef = movesById[learnEntry.moveId];
        if (!alreadyHas && moveDef) {
          const newSlot: MoveSlot = {
            moveId: moveDef.id,
            pp: moveDef.maxPp,
            maxPp: moveDef.maxPp,
          };
          if (creature.moves.length < MAX_ACTIVE_MOVES) {
            creature.moves.push(newSlot);
          } else {
            creature.moves[0] = newSlot;
          }
          learnedMoveIds.push(moveDef.id);
        }
      }
    }
  }

  return {
    expGained: Math.floor(expGain),
    levelsGained,
    newLevel: creature.level,
    learnedMoveIds,
    evolvedFromSpeciesId,
    evolvedToSpeciesId,
  };
}

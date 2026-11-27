import {
  createCreatureInstance,
  healCreatureFully,
  MAX_PARTY_SIZE,
} from './creatures.ts';
import type {
  CreatureInstance,
  GameSettings,
  GameState,
  ItemDefinition,
  MoveDefinition,
  RegionId,
  SpeciesDefinition,
} from './types.ts';

export function createDefaultSettings(): GameSettings {
  return {
    cefrBand: 'A2',
    supportMode: 'contextual',
    bgmVolume: 0.45,
    sfxVolume: 0.65,
    muted: false,
    highContrast: false,
    reducedMotion: false,
    battleSpeed: 'normal',
    textScale: 'normal',
    touchControls: 'auto',
    keyMap: {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      interact: 'Space',
      cancel: 'Escape',
      journal: 'KeyJ',
    },
  };
}

export function createInitialGameState(seed: number = 0x5eed2026): GameState {
  return {
    schemaVersion: 1,
    seedState: seed >>> 0 || 0x5eed2026,
    playTimeSeconds: 0,
    stepCount: 0,
    timeOfDay: 'morning',
    regionId: 'mosslight_hub',
    playerPos: {
      x: 15,
      y: 13,
      facing: 'up',
    },
    starterChosen: null,
    party: [],
    sanctuaryBox: [],
    discoveredSpecies: [],
    caughtSpecies: [],
    inventory: [
      { itemId: 'moss_charm', quantity: 6 },
      { itemId: 'dew_tonic', quantity: 4 },
      { itemId: 'clear_herb', quantity: 2 },
    ],
    tokens: 180,
    wardStepsRemaining: 0,
    flags: {
      visited_mosslight_hub: true,
    },
    defeatedTrainers: [],
    openedProps: [],
    quests: {
      q01_first_partner: {
        questId: 'q01_first_partner',
        status: 'active',
        rewardClaimed: false,
      },
    },
    lexicon: {},
    stats: {
      battlesWon: 0,
      wildCaught: 0,
      wordsGlossed: 0,
      campReviewsCompleted: 0,
      fledCount: 0,
    },
    settings: createDefaultSettings(),
  };
}

export function addItemToState(state: GameState, itemId: string, quantity: number): void {
  if (quantity <= 0) return;
  const existing = state.inventory.find((s) => s.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.inventory.push({ itemId, quantity });
  }
}

export function getItemQuantity(state: GameState, itemId: string): number {
  return state.inventory.find((s) => s.itemId === itemId)?.quantity ?? 0;
}

export function markSpeciesDiscovered(state: GameState, speciesId: string): void {
  if (!state.discoveredSpecies.includes(speciesId)) {
    state.discoveredSpecies.push(speciesId);
  }
}

export function markSpeciesCaught(state: GameState, speciesId: string): void {
  markSpeciesDiscovered(state, speciesId);
  if (!state.caughtSpecies.includes(speciesId)) {
    state.caughtSpecies.push(speciesId);
  }
}

export function chooseStarterPartner(params: {
  state: GameState;
  species: SpeciesDefinition;
  movesById: Readonly<Record<string, MoveDefinition>>;
}): CreatureInstance {
  const { state, species, movesById } = params;
  const uid = `starter_${species.id}_${state.stepCount + 1}`;
  const starter = createCreatureInstance({
    uid,
    species,
    level: 6,
    bondedRegion: 'mosslight_hub',
    movesById,
  });
  state.starterChosen = species.id;
  state.party.push(starter);
  markSpeciesCaught(state, species.id);
  state.flags.has_starter = true;
  return starter;
}

export function registerCapturedWildkin(
  state: GameState,
  captured: CreatureInstance,
  bondedRegion: RegionId,
): 'party' | 'sanctuary' {
  captured.bondedRegion = bondedRegion;
  captured.uid = `wild_${captured.speciesId}_${state.stats.wildCaught + 1}_${state.stepCount}`;
  markSpeciesCaught(state, captured.speciesId);
  state.stats.wildCaught += 1;

  if (state.party.length < MAX_PARTY_SIZE) {
    state.party.push(captured);
    return 'party';
  }
  state.sanctuaryBox.push(captured);
  return 'sanctuary';
}

export function healPartyInState(
  state: GameState,
  movesById: Readonly<Record<string, MoveDefinition>>,
): void {
  for (const creature of state.party) {
    healCreatureFully(creature, movesById);
  }
}

export function swapPartySlots(state: GameState, indexA: number, indexB: number): boolean {
  const a = state.party[indexA];
  const b = state.party[indexB];
  if (!a || !b || indexA === indexB) return false;
  state.party[indexA] = b;
  state.party[indexB] = a;
  return true;
}

export function swapPartyWithSanctuary(
  state: GameState,
  partyIndex: number,
  sanctuaryIndex: number,
): boolean {
  const partyMember = state.party[partyIndex];
  const boxMember = state.sanctuaryBox[sanctuaryIndex];
  if (!partyMember || !boxMember) return false;
  state.party[partyIndex] = boxMember;
  state.sanctuaryBox[sanctuaryIndex] = partyMember;
  return true;
}

export function buySupplyItem(params: {
  state: GameState;
  item: ItemDefinition;
  quantity: number;
}): { readonly ok: boolean; readonly messageEn: string; readonly messageVi: string } {
  const { state, item, quantity } = params;
  if (quantity <= 0 || item.price <= 0) {
    return {
      ok: false,
      messageEn: 'This item cannot be exchanged here.',
      messageVi: 'Vật phẩm này không thể đổi tại trạm tiếp tế.',
    };
  }
  const totalCost = item.price * quantity;
  if (state.tokens < totalCost) {
    return {
      ok: false,
      messageEn: `You need ${totalCost} Field Tokens (have ${state.tokens}).`,
      messageVi: `Bạn cần ${totalCost} Huy hiệu thực địa (hiện có ${state.tokens}).`,
    };
  }
  state.tokens -= totalCost;
  addItemToState(state, item.id, quantity);
  return {
    ok: true,
    messageEn: `Received ${quantity}x ${item.nameEn}!`,
    messageVi: `Đã nhận ${quantity} ${item.nameVi}!`,
  };
}

export function useFieldItem(params: {
  state: GameState;
  item: ItemDefinition;
  targetPartyIndex?: number;
}): { readonly ok: boolean; readonly messageEn: string; readonly messageVi: string } {
  const { state, item, targetPartyIndex } = params;
  const invSlot = state.inventory.find((s) => s.itemId === item.id && s.quantity > 0);
  if (!invSlot) {
    return {
      ok: false,
      messageEn: `No ${item.nameEn} remaining.`,
      messageVi: `Đã hết ${item.nameVi}.`,
    };
  }

  if (item.wardSteps) {
    invSlot.quantity -= 1;
    state.wardStepsRemaining = Math.max(state.wardStepsRemaining, item.wardSteps);
    return {
      ok: true,
      messageEn: `Lit the ${item.nameEn}! Shy wild creatures will keep their distance for ${item.wardSteps} steps.`,
      messageVi: `Đã thắp ${item.nameVi}! Sinh vật nhút nhát sẽ tránh đường trong ${item.wardSteps} bước.`,
    };
  }

  if (item.category === 'charm' || item.category === 'key') {
    return {
      ok: false,
      messageEn: `${item.nameEn} is used automatically in its proper moment.`,
      messageVi: `${item.nameVi} chỉ dùng đúng ngữ cảnh tương ứng.`,
    };
  }

  const target = state.party[targetPartyIndex ?? 0];
  if (!target) {
    return {
      ok: false,
      messageEn: 'You have no partner in your party yet.',
      messageVi: 'Bạn chưa có sinh vật đồng hành trong đội.',
    };
  }

  let applied = false;
  if (item.healAmount && target.currentHp < target.maxHp) {
    target.currentHp = Math.min(target.maxHp, target.currentHp + item.healAmount);
    applied = true;
  }
  if (item.curesStatus && target.status !== null) {
    if (item.curesStatus === 'all' || target.status === item.curesStatus) {
      target.status = null;
      target.statusTurns = 0;
      applied = true;
    }
  }
  if (item.ppRestore) {
    for (const slot of target.moves) {
      if (slot.pp < slot.maxPp) {
        slot.pp = Math.min(slot.maxPp, slot.pp + item.ppRestore);
        applied = true;
      }
    }
  }

  if (!applied) {
    return {
      ok: false,
      messageEn: 'Your partner is already in peak condition!',
      messageVi: 'Bạn đồng hành đã ở trạng thái sung sức nhất!',
    };
  }

  invSlot.quantity -= 1;
  return {
    ok: true,
    messageEn: `Used ${item.nameEn} successfully!`,
    messageVi: `Đã sử dụng ${item.nameVi} thành công!`,
  };
}

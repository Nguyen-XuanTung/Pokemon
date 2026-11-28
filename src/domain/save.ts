import { MAX_ACTIVE_MOVES, MAX_CREATURE_LEVEL, MAX_PARTY_SIZE } from './creatures.ts';
import type { GameState } from './types.ts';

export const SAVE_SCHEMA_VERSION = 2;
export const LEGACY_SAVE_SCHEMA_VERSION = 1;
export const PRIMARY_SAVE_KEY = 'lingowild_save_v1';
export const BACKUP_SAVE_KEY = 'lingowild_save_v1_backup';
export const MAX_SAVE_BYTES = 262_144;
export const MAX_SANCTUARY_SIZE = 240;
export const MAX_ITEM_STACK = 999;
export const MAX_TOKENS = 999_999;
export const MAX_WARD_STEPS = 500;
export const MAX_PLAY_TIME_SECONDS = 31_536_000;
export const MAX_STEP_COUNT = 10_000_000;

const SAVE_MAGIC = 'LINGOWILD_SAVE';

export interface SaveValidationRegistry {
  readonly validSpeciesIds: ReadonlySet<string>;
  readonly starterSpeciesIds: ReadonlySet<string>;
  readonly validMoveIds: ReadonlySet<string>;
  readonly validItemIds: ReadonlySet<string>;
  readonly validQuestIds: ReadonlySet<string>;
  readonly validWordIds: ReadonlySet<string>;
  readonly mapBounds: Readonly<Record<string, { readonly width: number; readonly height: number }>>;
  readonly regionSpawns?: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  readonly isPositionSafe?: (regionId: string, x: number, y: number, state: GameState) => boolean;
}

export interface SaveEnvelope {
  readonly magic: typeof SAVE_MAGIC;
  readonly version: 1 | 2;
  readonly sequence: number;
  readonly savedAtMs: number;
  readonly savedAtIso: string;
  readonly checksum: number;
  readonly state: GameState;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function computeFnv1aChecksum(payload: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const VALID_REGIONS = new Set([
  'mosslight_hub',
  'whisperwood',
  'reedwater_fen',
  'terracotta_ridge',
  'starfall_sanctuary',
]);

const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2']);
const VALID_SUPPORT = new Set(['immersion', 'contextual', 'bilingual']);
const VALID_BATTLE_SPEED = new Set(['normal', 'fast', 'instant']);
const VALID_TEXT_SCALE = new Set(['normal', 'large']);
const VALID_TOUCH = new Set(['auto', 'always', 'off']);
const VALID_TIME = new Set(['morning', 'day', 'dusk', 'night']);
const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);
const VALID_STATUS = new Set(['burn', 'poison', 'sleep', 'paralyze']);
const REQUIRED_KEYMAP_FIELDS = [
  'up',
  'down',
  'left',
  'right',
  'interact',
  'cancel',
  'journal',
] as const;

function isIntInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function validateStringList(
  candidate: unknown,
  maxLen: number,
  validSet?: ReadonlySet<string>,
): boolean {
  if (!Array.isArray(candidate) || candidate.length > maxLen) return false;
  const seen = new Set<string>();
  for (const item of candidate) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 80) return false;
    if (seen.has(item)) return false;
    if (validSet && !validSet.has(item)) return false;
    seen.add(item);
  }
  return true;
}

function validateCreatureInstance(
  candidate: unknown,
  seenUids: Set<string>,
  registry?: SaveValidationRegistry,
): boolean {
  if (!isPlainObject(candidate)) return false;
  if (typeof candidate.uid !== 'string' || candidate.uid.length === 0 || candidate.uid.length > 80) {
    return false;
  }
  if (seenUids.has(candidate.uid)) return false;
  seenUids.add(candidate.uid);

  if (typeof candidate.speciesId !== 'string' || candidate.speciesId.length === 0) return false;
  if (registry && !registry.validSpeciesIds.has(candidate.speciesId)) return false;

  if (
    candidate.nickname !== undefined &&
    (typeof candidate.nickname !== 'string' ||
      candidate.nickname.length === 0 ||
      candidate.nickname.length > 32)
  ) {
    return false;
  }
  if (candidate.isRareVariant !== undefined && typeof candidate.isRareVariant !== 'boolean') {
    return false;
  }
  if (!isIntInRange(candidate.level, 1, MAX_CREATURE_LEVEL)) return false;
  if (!isIntInRange(candidate.exp, 0, 2_000_000)) return false;
  if (!isIntInRange(candidate.maxHp, 1, 999)) return false;
  if (!isIntInRange(candidate.currentHp, 0, candidate.maxHp)) return false;

  if (!isPlainObject(candidate.stats)) return false;
  if (
    !isIntInRange(candidate.stats.atk, 1, 999) ||
    !isIntInRange(candidate.stats.def, 1, 999) ||
    !isIntInRange(candidate.stats.spd, 1, 999)
  ) {
    return false;
  }

  if (
    !Array.isArray(candidate.moves) ||
    candidate.moves.length < 1 ||
    candidate.moves.length > MAX_ACTIVE_MOVES
  ) {
    return false;
  }
  const seenMoves = new Set<string>();
  for (const slot of candidate.moves) {
    if (!isPlainObject(slot)) return false;
    if (typeof slot.moveId !== 'string' || slot.moveId.length === 0) return false;
    if (seenMoves.has(slot.moveId)) return false;
    seenMoves.add(slot.moveId);
    if (registry && !registry.validMoveIds.has(slot.moveId)) return false;
    if (!isIntInRange(slot.maxPp, 1, 99)) return false;
    if (!isIntInRange(slot.pp, 0, slot.maxPp)) return false;
  }

  if (
    candidate.status !== null &&
    (typeof candidate.status !== 'string' || !VALID_STATUS.has(candidate.status))
  ) {
    return false;
  }
  if (!isIntInRange(candidate.statusTurns, 0, 10)) return false;
  if (typeof candidate.bondedRegion !== 'string' || !VALID_REGIONS.has(candidate.bondedRegion)) {
    return false;
  }
  return true;
}

export function validateGameStateShape(
  candidate: unknown,
  registry?: SaveValidationRegistry,
): candidate is GameState {
  if (!isPlainObject(candidate)) return false;
  if (
    candidate.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION &&
    candidate.schemaVersion !== SAVE_SCHEMA_VERSION
  ) {
    return false;
  }
  if (!isIntInRange(candidate.seedState, 0, 0xffffffff)) return false;
  if (
    typeof candidate.playTimeSeconds !== 'number' ||
    !Number.isFinite(candidate.playTimeSeconds) ||
    candidate.playTimeSeconds < 0 ||
    candidate.playTimeSeconds > MAX_PLAY_TIME_SECONDS
  ) {
    return false;
  }
  if (!isIntInRange(candidate.stepCount, 0, MAX_STEP_COUNT)) return false;
  if (typeof candidate.timeOfDay !== 'string' || !VALID_TIME.has(candidate.timeOfDay)) return false;
  if (typeof candidate.regionId !== 'string' || !VALID_REGIONS.has(candidate.regionId)) return false;

  if (!isPlainObject(candidate.playerPos)) return false;
  const bounds = registry?.mapBounds[candidate.regionId] ?? { width: 64, height: 64 };
  if (
    !isIntInRange(candidate.playerPos.x, 0, bounds.width - 1) ||
    !isIntInRange(candidate.playerPos.y, 0, bounds.height - 1) ||
    typeof candidate.playerPos.facing !== 'string' ||
    !VALID_DIRS.has(candidate.playerPos.facing)
  ) {
    return false;
  }

  if (candidate.starterChosen !== null) {
    if (typeof candidate.starterChosen !== 'string' || candidate.starterChosen.length === 0) {
      return false;
    }
    if (registry) {
      if (!registry.validSpeciesIds.has(candidate.starterChosen)) return false;
      if (
        registry.starterSpeciesIds.size > 0 &&
        !registry.starterSpeciesIds.has(candidate.starterChosen)
      ) {
        return false;
      }
    }
  }

  if (!Array.isArray(candidate.party) || candidate.party.length > MAX_PARTY_SIZE) return false;
  if (!Array.isArray(candidate.sanctuaryBox) || candidate.sanctuaryBox.length > MAX_SANCTUARY_SIZE) {
    return false;
  }
  const seenUids = new Set<string>();
  for (const member of candidate.party) {
    if (!validateCreatureInstance(member, seenUids, registry)) return false;
  }
  for (const member of candidate.sanctuaryBox) {
    if (!validateCreatureInstance(member, seenUids, registry)) return false;
  }

  if (!Array.isArray(candidate.discoveredSpecies) || !Array.isArray(candidate.caughtSpecies)) {
    return false;
  }
  const discoveredSet = new Set<string>();
  for (const spId of candidate.discoveredSpecies) {
    if (typeof spId !== 'string' || discoveredSet.has(spId)) return false;
    if (registry && !registry.validSpeciesIds.has(spId)) return false;
    discoveredSet.add(spId);
  }
  const caughtSet = new Set<string>();
  for (const spId of candidate.caughtSpecies) {
    if (typeof spId !== 'string' || caughtSet.has(spId)) return false;
    if (registry && !registry.validSpeciesIds.has(spId)) return false;
    if (!discoveredSet.has(spId)) return false;
    caughtSet.add(spId);
  }

  if (
    candidate.gleamingSpecies !== undefined &&
    !validateStringList(candidate.gleamingSpecies, 60, registry?.validSpeciesIds)
  ) {
    return false;
  }
  if (candidate.rematchCleared !== undefined && !validateStringList(candidate.rematchCleared, 30)) {
    return false;
  }
  if (
    candidate.discoveredTraces !== undefined &&
    !validateStringList(candidate.discoveredTraces, 100)
  ) {
    return false;
  }
  if (candidate.readLoreIds !== undefined && !validateStringList(candidate.readLoreIds, 250)) {
    return false;
  }

  if (!Array.isArray(candidate.inventory) || candidate.inventory.length > 100) return false;
  const seenItems = new Set<string>();
  for (const slot of candidate.inventory) {
    if (!isPlainObject(slot)) return false;
    if (typeof slot.itemId !== 'string' || slot.itemId.length === 0) return false;
    if (seenItems.has(slot.itemId)) return false;
    seenItems.add(slot.itemId);
    if (registry && !registry.validItemIds.has(slot.itemId)) return false;
    if (!isIntInRange(slot.quantity, 0, MAX_ITEM_STACK)) return false;
  }

  if (!isIntInRange(candidate.tokens, 0, MAX_TOKENS)) return false;
  if (!isIntInRange(candidate.wardStepsRemaining, 0, MAX_WARD_STEPS)) return false;

  if (!isPlainObject(candidate.flags)) return false;
  for (const [flagKey, flagVal] of Object.entries(candidate.flags)) {
    if (flagKey.length === 0 || flagKey.length > 80 || typeof flagVal !== 'boolean') {
      return false;
    }
  }

  if (!Array.isArray(candidate.defeatedTrainers) || candidate.defeatedTrainers.length > 100) {
    return false;
  }
  for (const tr of candidate.defeatedTrainers) {
    if (typeof tr !== 'string' || tr.length === 0 || tr.length > 64) return false;
  }

  if (!Array.isArray(candidate.openedProps) || candidate.openedProps.length > 250) {
    return false;
  }
  for (const pr of candidate.openedProps) {
    if (typeof pr !== 'string' || pr.length === 0 || pr.length > 64) return false;
  }

  if (!isPlainObject(candidate.quests)) return false;
  for (const [qKey, qVal] of Object.entries(candidate.quests)) {
    if (registry && !registry.validQuestIds.has(qKey)) return false;
    if (!isPlainObject(qVal)) return false;
    if (qVal.questId !== qKey) return false;
    if (qVal.status !== 'active' && qVal.status !== 'completed') return false;
    if (typeof qVal.rewardClaimed !== 'boolean') return false;
  }

  if (!isPlainObject(candidate.lexicon)) return false;
  for (const [wKey, wVal] of Object.entries(candidate.lexicon)) {
    if (registry && !registry.validWordIds.has(wKey)) return false;
    if (!isPlainObject(wVal)) return false;
    if (wVal.wordId !== wKey) return false;
    if (!isIntInRange(wVal.exposures, 0, 1_000_000)) return false;
    if (!isIntInRange(wVal.glossLookups, 0, 1_000_000)) return false;
    if (typeof wVal.savedByPlayer !== 'boolean') return false;
    if (!isIntInRange(wVal.mastery, 0, 3)) return false;
    if (!isIntInRange(wVal.lastSeenStep, 0, MAX_STEP_COUNT)) return false;
    if (wVal.lastSeenAtMs !== undefined && !isIntInRange(wVal.lastSeenAtMs, 0, 9_999_999_999_999)) {
      return false;
    }
    if (
      wVal.nextReviewStep !== undefined &&
      !isIntInRange(wVal.nextReviewStep, 0, MAX_STEP_COUNT + 10_000)
    ) {
      return false;
    }
    if (
      wVal.nextReviewAtMs !== undefined &&
      !isIntInRange(wVal.nextReviewAtMs, 0, 9_999_999_999_999)
    ) {
      return false;
    }
    if (wVal.correctReviews !== undefined && !isIntInRange(wVal.correctReviews, 0, 100_000)) {
      return false;
    }
    if (wVal.lapses !== undefined && !isIntInRange(wVal.lapses, 0, 100_000)) {
      return false;
    }
    if (!Array.isArray(wVal.contextsSeen) || wVal.contextsSeen.length > 60) return false;
    for (const ctx of wVal.contextsSeen) {
      if (typeof ctx !== 'string' || ctx.length > 64) return false;
    }
  }

  if (!isPlainObject(candidate.stats)) return false;
  if (
    !isIntInRange(candidate.stats.battlesWon, 0, 1_000_000) ||
    !isIntInRange(candidate.stats.wildCaught, 0, 1_000_000) ||
    !isIntInRange(candidate.stats.wordsGlossed, 0, 1_000_000) ||
    !isIntInRange(candidate.stats.campReviewsCompleted, 0, 1_000_000) ||
    !isIntInRange(candidate.stats.fledCount, 0, 1_000_000)
  ) {
    return false;
  }

  if (!isPlainObject(candidate.settings)) return false;
  const s = candidate.settings;
  if (typeof s.cefrBand !== 'string' || !VALID_CEFR.has(s.cefrBand)) return false;
  if (typeof s.supportMode !== 'string' || !VALID_SUPPORT.has(s.supportMode)) return false;
  if (
    typeof s.bgmVolume !== 'number' ||
    !Number.isFinite(s.bgmVolume) ||
    s.bgmVolume < 0 ||
    s.bgmVolume > 1
  ) {
    return false;
  }
  if (
    typeof s.sfxVolume !== 'number' ||
    !Number.isFinite(s.sfxVolume) ||
    s.sfxVolume < 0 ||
    s.sfxVolume > 1
  ) {
    return false;
  }
  if (typeof s.muted !== 'boolean') return false;
  if (typeof s.highContrast !== 'boolean') return false;
  if (typeof s.reducedMotion !== 'boolean') return false;
  if (
    s.battleSpeed !== undefined &&
    (typeof s.battleSpeed !== 'string' || !VALID_BATTLE_SPEED.has(s.battleSpeed))
  ) {
    return false;
  }
  if (s.showFollower !== undefined && typeof s.showFollower !== 'boolean') {
    return false;
  }
  if (typeof s.textScale !== 'string' || !VALID_TEXT_SCALE.has(s.textScale)) return false;
  if (typeof s.touchControls !== 'string' || !VALID_TOUCH.has(s.touchControls)) return false;

  if (!isPlainObject(s.keyMap)) return false;
  for (const field of REQUIRED_KEYMAP_FIELDS) {
    const val = s.keyMap[field];
    if (typeof val !== 'string' || val.length === 0 || val.length > 32) {
      return false;
    }
  }

  return true;
}

function relocatePlayerToSafeTile(
  state: GameState,
  registry?: SaveValidationRegistry,
): boolean {
  if (!registry) return false;
  const bounds = registry.mapBounds[state.regionId];
  if (!bounds) return false;

  const origX = state.playerPos.x;
  const origY = state.playerPos.y;
  const inBounds =
    Number.isInteger(origX) &&
    Number.isInteger(origY) &&
    origX >= 0 &&
    origX < bounds.width &&
    origY >= 0 &&
    origY < bounds.height;

  if (inBounds && (!registry.isPositionSafe || registry.isPositionSafe(state.regionId, origX, origY, state))) {
    return false;
  }

  const clampedX = Math.max(0, Math.min(bounds.width - 1, Math.floor(origX)));
  const clampedY = Math.max(0, Math.min(bounds.height - 1, Math.floor(origY)));

  if (registry.isPositionSafe) {
    for (let radius = 0; radius <= 8; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = clampedX + dx;
          const ny = clampedY + dy;
          if (nx < 0 || ny < 0 || nx >= bounds.width || ny >= bounds.height) continue;
          if (registry.isPositionSafe(state.regionId, nx, ny, state)) {
            state.playerPos.x = nx;
            state.playerPos.y = ny;
            return true;
          }
        }
      }
    }
  }

  const fallback = registry.regionSpawns?.[state.regionId] ?? {
    x: Math.min(15, bounds.width - 1),
    y: Math.min(13, bounds.height - 1),
  };
  state.playerPos.x = fallback.x;
  state.playerPos.y = fallback.y;
  return true;
}

export function migrateAndNormalizeSaveState(
  rawCandidate: unknown,
  envelopeVersion: number,
  registry?: SaveValidationRegistry,
): { readonly ok: true; readonly state: GameState; readonly migrated: boolean } | { readonly ok: false } {
  if (!isPlainObject(rawCandidate)) return { ok: false };
  const cloned = structuredClone(rawCandidate);
  const isLegacy =
    envelopeVersion === LEGACY_SAVE_SCHEMA_VERSION ||
    cloned.schemaVersion === LEGACY_SAVE_SCHEMA_VERSION;

  let migrated = false;

  if (isLegacy) {
    // Allow legacy 1.0/1.1 coordinates slightly outside resized/reshaped maps to clamp cleanly before validation
    if (
      typeof cloned.regionId === 'string' &&
      VALID_REGIONS.has(cloned.regionId) &&
      isPlainObject(cloned.playerPos) &&
      typeof cloned.playerPos.x === 'number' &&
      Number.isInteger(cloned.playerPos.x) &&
      cloned.playerPos.x >= 0 &&
      cloned.playerPos.x < 64 &&
      typeof cloned.playerPos.y === 'number' &&
      Number.isInteger(cloned.playerPos.y) &&
      cloned.playerPos.y >= 0 &&
      cloned.playerPos.y < 64
    ) {
      const bounds = registry?.mapBounds[cloned.regionId];
      if (bounds && (cloned.playerPos.x >= bounds.width || cloned.playerPos.y >= bounds.height)) {
        const spawn = registry?.regionSpawns?.[cloned.regionId] ?? {
          x: Math.min(cloned.playerPos.x, bounds.width - 1),
          y: Math.min(cloned.playerPos.y, bounds.height - 1),
        };
        cloned.playerPos.x = spawn.x;
        cloned.playerPos.y = spawn.y;
        migrated = true;
      }
    }

    // Prune only obsolete lexicon IDs removed across 1.0 -> 1.2 vocabulary curation while keeping valid records intact
    if (registry && isPlainObject(cloned.lexicon)) {
      for (const wordKey of Object.keys(cloned.lexicon)) {
        if (!registry.validWordIds.has(wordKey)) {
          delete cloned.lexicon[wordKey];
          migrated = true;
        }
      }
    }
    cloned.schemaVersion = SAVE_SCHEMA_VERSION;
    migrated = true;
  }

  if (!validateGameStateShape(cloned, registry)) {
    return { ok: false };
  }

  cloned.schemaVersion = SAVE_SCHEMA_VERSION;
  cloned.settings.battleSpeed = cloned.settings.battleSpeed ?? 'normal';
  cloned.settings.showFollower = cloned.settings.showFollower ?? true;
  cloned.gleamingSpecies = cloned.gleamingSpecies ?? [];
  cloned.rematchCleared = cloned.rematchCleared ?? [];
  cloned.discoveredTraces = cloned.discoveredTraces ?? [];
  cloned.readLoreIds = cloned.readLoreIds ?? [];

  if (relocatePlayerToSafeTile(cloned, registry)) {
    migrated = true;
  }

  return { ok: true, state: cloned, migrated };
}

export function serializeSaveEnvelope(
  state: GameState,
  sequence: number = 1,
  version: 1 | 2 = SAVE_SCHEMA_VERSION,
): string {
  const stateJson = JSON.stringify(state);
  const checksum = computeFnv1aChecksum(stateJson);
  const nowMs = Date.now();
  const envelope: SaveEnvelope = {
    magic: SAVE_MAGIC,
    version,
    sequence,
    savedAtMs: nowMs,
    savedAtIso: new Date(nowMs).toISOString(),
    checksum,
    state,
  };
  const serialized = JSON.stringify(envelope);
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > MAX_SAVE_BYTES) {
    throw new Error(`Save payload exceeds limit (${byteLength} > ${MAX_SAVE_BYTES} bytes)`);
  }
  return serialized;
}

export type ParseSaveResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly sequence: number;
      readonly savedAtMs: number;
      readonly savedAtIso: string;
      readonly migratedFromLegacy: boolean;
    }
  | { readonly ok: false; readonly reason: string };

export function deserializeSaveEnvelope(
  raw: string,
  registry?: SaveValidationRegistry,
): ParseSaveResult {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, reason: 'Empty save payload' };
  }
  const byteLength = new TextEncoder().encode(raw).byteLength;
  if (byteLength > MAX_SAVE_BYTES) {
    return { ok: false, reason: 'Save file exceeds maximum allowed size' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'Invalid JSON syntax' };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, reason: 'Root save value must be an object' };
  }
  if (parsed.magic !== SAVE_MAGIC) {
    return { ok: false, reason: 'Missing LingoWild save header' };
  }
  if (
    parsed.version !== LEGACY_SAVE_SCHEMA_VERSION &&
    parsed.version !== SAVE_SCHEMA_VERSION
  ) {
    return { ok: false, reason: `Unsupported save schema version: ${String(parsed.version)}` };
  }
  if (typeof parsed.checksum !== 'number') {
    return { ok: false, reason: 'Missing integrity checksum' };
  }

  // Verify checksum against exact original state JSON before applying schema migration
  const expectedChecksum = computeFnv1aChecksum(JSON.stringify(parsed.state));
  if (expectedChecksum !== (parsed.checksum >>> 0)) {
    return { ok: false, reason: 'Save checksum mismatch (data corrupted or modified)' };
  }

  const normalized = migrateAndNormalizeSaveState(parsed.state, parsed.version, registry);
  if (!normalized.ok) {
    return { ok: false, reason: 'Save state failed deep schema and reference validation' };
  }

  const sequence =
    typeof parsed.sequence === 'number' && Number.isInteger(parsed.sequence) && parsed.sequence >= 0
      ? parsed.sequence
      : 0;
  const savedAtMs =
    typeof parsed.savedAtMs === 'number' && Number.isFinite(parsed.savedAtMs)
      ? parsed.savedAtMs
      : 0;

  return {
    ok: true,
    state: normalized.state,
    sequence,
    savedAtMs,
    savedAtIso: typeof parsed.savedAtIso === 'string' ? parsed.savedAtIso : '',
    migratedFromLegacy: normalized.migrated,
  };
}

export interface SaveOperationResult {
  readonly ok: boolean;
  readonly usedMemoryFallback: boolean;
  readonly conflictWithNewerTab?: boolean;
  readonly warning?: string;
}

export class SaveRepository {
  private readonly storage: StorageAdapter | null;
  private readonly registry?: SaveValidationRegistry;
  private memorySlot: string | null = null;
  private nextSequence = 1;
  private lastSyncedStorageSequence = 0;
  public hasMultiTabConflict = false;

  public constructor(storage?: StorageAdapter | null, registry?: SaveValidationRegistry) {
    this.registry = registry;
    if (storage !== undefined) {
      this.storage = storage;
    } else if (typeof window !== 'undefined') {
      try {
        this.storage = window.localStorage;
      } catch {
        this.storage = null;
      }
    } else {
      this.storage = null;
    }

    const existingRaw = this.safeGet(PRIMARY_SAVE_KEY);
    if (existingRaw) {
      const parsed = deserializeSaveEnvelope(existingRaw, this.registry);
      if (parsed.ok) {
        this.lastSyncedStorageSequence = parsed.sequence;
        this.nextSequence = parsed.sequence + 1;
      }
    }
  }

  public save(
    state: GameState,
    options?: { readonly resolveTabConflict?: 'overwrite' },
  ): SaveOperationResult {
    if (!validateGameStateShape(state, this.registry)) {
      return {
        ok: false,
        usedMemoryFallback: false,
        warning: 'Refused to save invalid game state.',
      };
    }

    const previousPrimary = this.safeGet(PRIMARY_SAVE_KEY);
    const parsedExistingPrimary = previousPrimary
      ? deserializeSaveEnvelope(previousPrimary, this.registry)
      : null;

    // Detect if another open browser tab wrote newer progress since this tab last synced
    if (
      parsedExistingPrimary?.ok &&
      parsedExistingPrimary.sequence > this.lastSyncedStorageSequence &&
      options?.resolveTabConflict !== 'overwrite'
    ) {
      this.hasMultiTabConflict = true;
      const localSeq = this.nextSequence++;
      try {
        this.memorySlot = serializeSaveEnvelope(state, localSeq);
      } catch {
        // ignore serialization error in fallback
      }
      return {
        ok: true,
        usedMemoryFallback: true,
        conflictWithNewerTab: true,
        warning:
          'Newer progress was saved in another browser tab. Open Settings to load the newer tab save or export a JSON copy.',
      };
    }

    if (parsedExistingPrimary?.ok && parsedExistingPrimary.sequence >= this.nextSequence) {
      this.nextSequence = parsedExistingPrimary.sequence + 1;
    }
    const seq = this.nextSequence++;
    let serialized: string;
    try {
      serialized = serializeSaveEnvelope(state, seq);
    } catch (err) {
      return {
        ok: false,
        usedMemoryFallback: false,
        warning: err instanceof Error ? err.message : 'Serialization failed',
      };
    }

    this.memorySlot = serialized;

    if (!this.storage) {
      return {
        ok: true,
        usedMemoryFallback: true,
        warning:
          'Browser storage unavailable; progress is kept in session memory. Export JSON to keep a file copy.',
      };
    }

    const previousBackup = this.safeGet(BACKUP_SAVE_KEY);
    try {
      if (previousPrimary && parsedExistingPrimary?.ok) {
        this.storage.setItem(BACKUP_SAVE_KEY, previousPrimary);
      }
      this.storage.setItem(PRIMARY_SAVE_KEY, serialized);
      this.lastSyncedStorageSequence = seq;
      this.hasMultiTabConflict = false;
      return { ok: true, usedMemoryFallback: false };
    } catch {
      try {
        this.storage.removeItem(BACKUP_SAVE_KEY);
        this.storage.setItem(PRIMARY_SAVE_KEY, serialized);
        this.lastSyncedStorageSequence = seq;
        this.hasMultiTabConflict = false;
        return {
          ok: true,
          usedMemoryFallback: false,
          warning: 'Storage nearly full; backup slot cleared to preserve primary save.',
        };
      } catch {
        // Restore previous backup best-effort so a failed write never destroys an intact backup!
        if (previousBackup !== null) {
          try {
            this.storage.setItem(BACKUP_SAVE_KEY, previousBackup);
          } catch {
            // quota prevented restoring backup too; primary and memorySlot remain intact
          }
        }
        return {
          ok: true,
          usedMemoryFallback: true,
          warning:
            'Browser storage quota exceeded; newer session kept in memory. Please export save file.',
        };
      }
    }
  }

  public syncFromNewerStorage(): {
    readonly ok: boolean;
    readonly state: GameState | null;
    readonly sequence: number;
  } {
    const rawPrimary = this.safeGet(PRIMARY_SAVE_KEY);
    if (!rawPrimary) return { ok: false, state: null, sequence: this.lastSyncedStorageSequence };
    const parsed = deserializeSaveEnvelope(rawPrimary, this.registry);
    if (!parsed.ok) return { ok: false, state: null, sequence: this.lastSyncedStorageSequence };
    this.memorySlot = rawPrimary;
    this.lastSyncedStorageSequence = parsed.sequence;
    this.nextSequence = Math.max(this.nextSequence, parsed.sequence + 1);
    this.hasMultiTabConflict = false;
    return { ok: true, state: parsed.state, sequence: parsed.sequence };
  }

  public load(): {
    readonly state: GameState | null;
    readonly recoveredFromBackup: boolean;
    readonly usedNewerMemoryFallback?: boolean;
    readonly migratedFromLegacy?: boolean;
    readonly warning?: string;
  } {
    const rawMemory = this.memorySlot;
    const rawPrimary = this.safeGet(PRIMARY_SAVE_KEY);

    const parsedMemory = rawMemory ? deserializeSaveEnvelope(rawMemory, this.registry) : null;
    const parsedPrimary = rawPrimary ? deserializeSaveEnvelope(rawPrimary, this.registry) : null;

    if (parsedMemory?.ok && parsedPrimary?.ok) {
      this.lastSyncedStorageSequence = Math.max(
        this.lastSyncedStorageSequence,
        parsedPrimary.sequence,
      );
      const memoryIsNewer =
        parsedMemory.sequence > parsedPrimary.sequence ||
        (parsedMemory.sequence === parsedPrimary.sequence &&
          parsedMemory.savedAtMs > parsedPrimary.savedAtMs);
      if (memoryIsNewer) {
        return {
          state: parsedMemory.state,
          recoveredFromBackup: false,
          usedNewerMemoryFallback: true,
          migratedFromLegacy: parsedMemory.migratedFromLegacy,
          warning: 'Loaded newer in-memory session progress.',
        };
      }
      return {
        state: parsedPrimary.state,
        recoveredFromBackup: false,
        migratedFromLegacy: parsedPrimary.migratedFromLegacy,
      };
    }

    if (parsedPrimary?.ok) {
      this.lastSyncedStorageSequence = Math.max(
        this.lastSyncedStorageSequence,
        parsedPrimary.sequence,
      );
      return {
        state: parsedPrimary.state,
        recoveredFromBackup: false,
        migratedFromLegacy: parsedPrimary.migratedFromLegacy,
      };
    }

    if (parsedMemory?.ok) {
      return {
        state: parsedMemory.state,
        recoveredFromBackup: false,
        usedNewerMemoryFallback: true,
        migratedFromLegacy: parsedMemory.migratedFromLegacy,
      };
    }

    if (rawPrimary) {
      const failReason = parsedPrimary && !parsedPrimary.ok ? parsedPrimary.reason : 'corrupted';
      const rawBackup = this.safeGet(BACKUP_SAVE_KEY);
      if (rawBackup) {
        const parsedBackup = deserializeSaveEnvelope(rawBackup, this.registry);
        if (parsedBackup.ok) {
          this.lastSyncedStorageSequence = Math.max(
            this.lastSyncedStorageSequence,
            parsedBackup.sequence,
          );
          return {
            state: parsedBackup.state,
            recoveredFromBackup: true,
            migratedFromLegacy: parsedBackup.migratedFromLegacy,
            warning: `Primary save was damaged (${failReason}). Restored clean backup automatically.`,
          };
        }
      }
      return {
        state: null,
        recoveredFromBackup: false,
        warning: `Saved data was unreadable (${failReason}). Starting fresh without overwriting backup.`,
      };
    }

    const rawBackupOnly = this.safeGet(BACKUP_SAVE_KEY);
    if (rawBackupOnly) {
      const parsedBackup = deserializeSaveEnvelope(rawBackupOnly, this.registry);
      if (parsedBackup.ok) {
        this.lastSyncedStorageSequence = Math.max(
          this.lastSyncedStorageSequence,
          parsedBackup.sequence,
        );
        return {
          state: parsedBackup.state,
          recoveredFromBackup: true,
          migratedFromLegacy: parsedBackup.migratedFromLegacy,
          warning: 'Primary save missing; restored from backup slot.',
        };
      }
    }

    return { state: null, recoveredFromBackup: false };
  }

  public hasValidSave(): boolean {
    const loaded = this.load();
    return loaded.state !== null;
  }

  public exportJson(state: GameState): string {
    return serializeSaveEnvelope(state, this.nextSequence);
  }

  public importJson(rawJson: string): {
    readonly ok: boolean;
    readonly state?: GameState;
    readonly migratedFromLegacy?: boolean;
    readonly error?: string;
  } {
    const parsed = deserializeSaveEnvelope(rawJson, this.registry);
    if (!parsed.ok) {
      // Never mutate primary, backup, or memorySlot on invalid import!
      return { ok: false, error: parsed.reason };
    }
    const saveRes = this.save(parsed.state, { resolveTabConflict: 'overwrite' });
    if (!saveRes.ok) {
      return { ok: false, error: saveRes.warning ?? 'Could not persist imported save' };
    }
    return {
      ok: true,
      state: parsed.state,
      migratedFromLegacy: parsed.migratedFromLegacy,
    };
  }

  private safeGet(key: string): string | null {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }
}

import type { GameState } from './types.ts';

export const SAVE_SCHEMA_VERSION = 1;
export const PRIMARY_SAVE_KEY = 'lingowild_save_v1';
export const BACKUP_SAVE_KEY = 'lingowild_save_v1_backup';
export const MAX_SAVE_BYTES = 262_144;

const SAVE_MAGIC = 'LINGOWILD_SAVE';

export interface SaveEnvelope {
  readonly magic: typeof SAVE_MAGIC;
  readonly version: typeof SAVE_SCHEMA_VERSION;
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
const VALID_TIME = new Set(['morning', 'day', 'dusk', 'night']);
const VALID_DIRS = new Set(['up', 'down', 'left', 'right']);

export function validateGameStateShape(candidate: unknown): candidate is GameState {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Record<string, unknown>;
  if (s.schemaVersion !== SAVE_SCHEMA_VERSION) return false;
  if (typeof s.seedState !== 'number' || !Number.isFinite(s.seedState)) return false;
  if (typeof s.playTimeSeconds !== 'number' || s.playTimeSeconds < 0) return false;
  if (typeof s.stepCount !== 'number' || s.stepCount < 0) return false;
  if (typeof s.timeOfDay !== 'string' || !VALID_TIME.has(s.timeOfDay)) return false;
  if (typeof s.regionId !== 'string' || !VALID_REGIONS.has(s.regionId)) return false;
  if (!s.playerPos || typeof s.playerPos !== 'object') return false;
  const pos = s.playerPos as Record<string, unknown>;
  if (
    typeof pos.x !== 'number' ||
    typeof pos.y !== 'number' ||
    typeof pos.facing !== 'string' ||
    !VALID_DIRS.has(pos.facing)
  ) {
    return false;
  }
  if (!Array.isArray(s.party) || s.party.length > 6) return false;
  for (const member of s.party) {
    if (!member || typeof member !== 'object') return false;
    const m = member as Record<string, unknown>;
    if (
      typeof m.uid !== 'string' ||
      typeof m.speciesId !== 'string' ||
      typeof m.level !== 'number' ||
      typeof m.currentHp !== 'number' ||
      typeof m.maxHp !== 'number' ||
      !Array.isArray(m.moves)
    ) {
      return false;
    }
  }
  if (!Array.isArray(s.sanctuaryBox)) return false;
  if (!Array.isArray(s.discoveredSpecies) || !Array.isArray(s.caughtSpecies)) return false;
  if (!Array.isArray(s.inventory)) return false;
  if (typeof s.tokens !== 'number' || s.tokens < 0) return false;
  if (!s.flags || typeof s.flags !== 'object') return false;
  if (!s.quests || typeof s.quests !== 'object') return false;
  if (!s.lexicon || typeof s.lexicon !== 'object') return false;
  if (!s.settings || typeof s.settings !== 'object') return false;
  const settings = s.settings as Record<string, unknown>;
  if (
    typeof settings.cefrBand !== 'string' ||
    !VALID_CEFR.has(settings.cefrBand) ||
    typeof settings.supportMode !== 'string' ||
    !VALID_SUPPORT.has(settings.supportMode)
  ) {
    return false;
  }
  return true;
}

export function serializeSaveEnvelope(state: GameState): string {
  const stateJson = JSON.stringify(state);
  const checksum = computeFnv1aChecksum(stateJson);
  const envelope: SaveEnvelope = {
    magic: SAVE_MAGIC,
    version: SAVE_SCHEMA_VERSION,
    savedAtIso: new Date().toISOString(),
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
  | { readonly ok: true; readonly state: GameState; readonly savedAtIso: string }
  | { readonly ok: false; readonly reason: string };

export function deserializeSaveEnvelope(raw: string): ParseSaveResult {
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
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'Root save value must be an object' };
  }
  const env = parsed as Record<string, unknown>;
  if (env.magic !== SAVE_MAGIC) {
    return { ok: false, reason: 'Missing LingoWild save header' };
  }
  if (env.version !== SAVE_SCHEMA_VERSION) {
    return { ok: false, reason: `Unsupported save schema version: ${String(env.version)}` };
  }
  if (typeof env.checksum !== 'number') {
    return { ok: false, reason: 'Missing integrity checksum' };
  }
  if (!validateGameStateShape(env.state)) {
    return { ok: false, reason: 'Save state failed structural validation' };
  }
  const expectedChecksum = computeFnv1aChecksum(JSON.stringify(env.state));
  if (expectedChecksum !== (env.checksum >>> 0)) {
    return { ok: false, reason: 'Save checksum mismatch (data corrupted or modified)' };
  }
  return {
    ok: true,
    state: structuredClone(env.state),
    savedAtIso: typeof env.savedAtIso === 'string' ? env.savedAtIso : '',
  };
}

export interface SaveOperationResult {
  readonly ok: boolean;
  readonly usedMemoryFallback: boolean;
  readonly warning?: string;
}

export class SaveRepository {
  private readonly storage: StorageAdapter | null;
  private memorySlot: string | null = null;

  public constructor(storage?: StorageAdapter | null) {
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
  }

  public save(state: GameState): SaveOperationResult {
    let serialized: string;
    try {
      serialized = serializeSaveEnvelope(state);
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
        warning: 'Browser storage unavailable; progress is kept in session memory. Export JSON to keep a file copy.',
      };
    }

    const previousPrimary = this.safeGet(PRIMARY_SAVE_KEY);
    try {
      if (previousPrimary) {
        const prevValid = deserializeSaveEnvelope(previousPrimary);
        if (prevValid.ok) {
          this.storage.setItem(BACKUP_SAVE_KEY, previousPrimary);
        }
      }
      this.storage.setItem(PRIMARY_SAVE_KEY, serialized);
      return { ok: true, usedMemoryFallback: false };
    } catch {
      try {
        this.storage.removeItem(BACKUP_SAVE_KEY);
        this.storage.setItem(PRIMARY_SAVE_KEY, serialized);
        return {
          ok: true,
          usedMemoryFallback: false,
          warning: 'Storage nearly full; backup slot cleared to preserve primary save.',
        };
      } catch {
        return {
          ok: true,
          usedMemoryFallback: true,
          warning: 'Browser storage quota exceeded; session kept in memory. Please export save file.',
        };
      }
    }
  }

  public load(): {
    readonly state: GameState | null;
    readonly recoveredFromBackup: boolean;
    readonly warning?: string;
  } {
    const rawPrimary = this.safeGet(PRIMARY_SAVE_KEY) ?? this.memorySlot;
    if (rawPrimary) {
      const parsedPrimary = deserializeSaveEnvelope(rawPrimary);
      if (parsedPrimary.ok) {
        return { state: parsedPrimary.state, recoveredFromBackup: false };
      }
      const rawBackup = this.safeGet(BACKUP_SAVE_KEY);
      if (rawBackup) {
        const parsedBackup = deserializeSaveEnvelope(rawBackup);
        if (parsedBackup.ok) {
          return {
            state: parsedBackup.state,
            recoveredFromBackup: true,
            warning: `Primary save was damaged (${parsedPrimary.reason}). Restored clean backup automatically.`,
          };
        }
      }
      return {
        state: null,
        recoveredFromBackup: false,
        warning: `Saved data was unreadable (${parsedPrimary.reason}). Starting fresh without overwriting backup.`,
      };
    }

    const rawBackupOnly = this.safeGet(BACKUP_SAVE_KEY);
    if (rawBackupOnly) {
      const parsedBackup = deserializeSaveEnvelope(rawBackupOnly);
      if (parsedBackup.ok) {
        return {
          state: parsedBackup.state,
          recoveredFromBackup: true,
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
    return serializeSaveEnvelope(state);
  }

  public importJson(rawJson: string): {
    readonly ok: boolean;
    readonly state?: GameState;
    readonly error?: string;
  } {
    const parsed = deserializeSaveEnvelope(rawJson);
    if (!parsed.ok) {
      return { ok: false, error: parsed.reason };
    }
    const saveRes = this.save(parsed.state);
    if (!saveRes.ok) {
      return { ok: false, error: saveRes.warning ?? 'Could not persist imported save' };
    }
    return { ok: true, state: parsed.state };
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

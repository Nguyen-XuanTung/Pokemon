import { describe, expect, it } from 'vitest';
import { DIALOGUES_BY_ID } from '../../src/data/dialogues.ts';
import { LEXICON_INDEX } from '../../src/data/lexicon.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { createCreatureInstance } from '../../src/domain/creatures.ts';
import {
  buildCampfireReviewSet,
  buildContextualReencounterEcho,
  computeWordReencounterPriority,
  recordCampfireRecall,
  recordSentenceExposure,
  recordWordLookup,
  resolveDialogueLineForLevel,
  resolveSenseForContext,
  toggleWordSaved,
  tokenizeEnglishText,
} from '../../src/domain/learning.ts';
import {
  BACKUP_SAVE_KEY,
  MAX_SAVE_BYTES,
  PRIMARY_SAVE_KEY,
  SaveRepository,
  serializeSaveEnvelope,
  validateGameStateShape,
  type StorageAdapter,
} from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';
import {
  GAME_SAVE_VALIDATION_REGISTRY,
  GameController,
} from '../../src/game/controller.ts';

class MockStorage implements StorageAdapter {
  public readonly map = new Map<string, string>();
  public quotaLimitBytes = Infinity;

  public getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    let total = value.length;
    for (const [k, v] of this.map.entries()) {
      if (k !== key) total += v.length;
    }
    if (total > this.quotaLimitBytes) {
      throw new Error('QuotaExceededError');
    }
    this.map.set(key, value);
  }

  public removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('Deep save schema validation, import protection, and memory fallback precedence', () => {
  it('saves, exports, imports, and automatically recovers from corrupted primary slot using backup', () => {
    const storage = new MockStorage();
    const repo = new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY);

    const state1 = createInitialGameState(101);
    state1.tokens = 250;
    expect(repo.save(state1).ok).toBe(true);

    const state2 = structuredClone(state1);
    state2.tokens = 500;
    expect(repo.save(state2).ok).toBe(true);
    expect(storage.getItem(BACKUP_SAVE_KEY)).not.toBeNull();

    // Clear in-memory cache via fresh repo instance and corrupt primary save JSON
    storage.map.set(PRIMARY_SAVE_KEY, '{corrupted_json!!!');
    const freshRepo = new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY);
    const recovered = freshRepo.load();
    expect(recovered.recoveredFromBackup).toBe(true);
    expect(recovered.state?.tokens).toBe(250);
  });

  it('validates all nested structures, numeric bounds, map coordinates, and foreign keys', () => {
    const base = createInitialGameState(2026);
    base.starterChosen = 'mosskit';
    const starter = createCreatureInstance({
      uid: 'p_mosskit_1',
      species: SPECIES_BY_ID.mosskit!,
      level: 6,
      bondedRegion: 'mosslight_hub',
      movesById: MOVES_BY_ID,
    });
    const reserve = createCreatureInstance({
      uid: 'box_reedhop_1',
      species: SPECIES_BY_ID.reedhop!,
      level: 8,
      bondedRegion: 'reedwater_fen',
      movesById: MOVES_BY_ID,
    });
    base.party = [starter];
    base.sanctuaryBox = [reserve];
    base.discoveredSpecies = ['mosskit', 'reedhop'];
    base.caughtSpecies = ['mosskit', 'reedhop'];
    base.quests.q01_first_partner = {
      questId: 'q01_first_partner',
      status: 'completed',
      rewardClaimed: true,
    };
    base.lexicon.lex_valley = {
      wordId: 'lex_valley',
      exposures: 3,
      glossLookups: 1,
      savedByPlayer: true,
      mastery: 1,
      lastSeenStep: 5,
      contextsSeen: ['hub_starter'],
    };

    expect(validateGameStateShape(base, GAME_SAVE_VALIDATION_REGISTRY)).toBe(true);

    const expectInvalidMutation = (mutate: (draft: typeof base) => void) => {
      const copy = structuredClone(base);
      mutate(copy);
      expect(validateGameStateShape(copy, GAME_SAVE_VALIDATION_REGISTRY)).toBe(false);
    };

    // Coordinate out of bounds on 32x24 map
    expectInvalidMutation((d) => {
      d.playerPos.x = 32;
    });
    expectInvalidMutation((d) => {
      d.playerPos.y = -1;
    });

    // Non-starter species in starterChosen
    expectInvalidMutation((d) => {
      d.starterChosen = 'solacern';
    });

    // Invalid speciesId, moveId, currentHp > maxHp, pp > maxPp, duplicate UID across party & box
    expectInvalidMutation((d) => {
      d.party[0]!.speciesId = 'nonexistent_wildkin';
    });
    expectInvalidMutation((d) => {
      d.party[0]!.moves[0]!.moveId = 'unknown_laser';
    });
    expectInvalidMutation((d) => {
      d.party[0]!.currentHp = d.party[0]!.maxHp + 1;
    });
    expectInvalidMutation((d) => {
      d.party[0]!.moves[0]!.pp = d.party[0]!.moves[0]!.maxPp + 1;
    });
    expectInvalidMutation((d) => {
      d.sanctuaryBox[0]!.uid = d.party[0]!.uid;
    });

    // Caught species missing from discoveredSpecies
    expectInvalidMutation((d) => {
      d.caughtSpecies.push('kindlet');
    });

    // Invalid inventory itemId or stack overflow
    expectInvalidMutation((d) => {
      d.inventory.push({ itemId: 'fake_potion', quantity: 1 });
    });
    expectInvalidMutation((d) => {
      d.inventory[0]!.quantity = 5000;
    });

    // Invalid quest key / status
    expectInvalidMutation((d) => {
      d.quests.unknown_quest_99 = {
        questId: 'unknown_quest_99',
        status: 'active',
        rewardClaimed: false,
      };
    });

    // Invalid lexicon wordId or mastery > 3
    expectInvalidMutation((d) => {
      d.lexicon.lex_fake_word = {
        wordId: 'lex_fake_word',
        exposures: 1,
        glossLookups: 0,
        savedByPlayer: false,
        mastery: 0,
        lastSeenStep: 1,
        contextsSeen: [],
      };
    });
    expectInvalidMutation((d) => {
      (d.lexicon.lex_valley as unknown as { mastery: number }).mastery = 4;
    });

    // Invalid settings volume or missing keyMap binding
    expectInvalidMutation((d) => {
      d.settings.bgmVolume = 1.5;
    });
    expectInvalidMutation((d) => {
      d.settings.keyMap.interact = '';
    });
  });

  it('never overwrites or loses an existing valid save when importing invalid files', () => {
    const storage = new MockStorage();
    const repo = new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY);
    const controller = new GameController(repo);
    controller.startNewGame(777);
    controller.state.tokens = 432;
    controller.persistState();

    const validSnapshotBefore = structuredClone(controller.state);

    // 1. Malformed JSON
    expect(controller.importSaveFileContent('{bad_json').ok).toBe(false);
    // 2. Tampered checksum
    const exported = controller.exportSaveFileContent();
    const tampered = exported.replace('"tokens":432', '"tokens":999999');
    expect(controller.importSaveFileContent(tampered).ok).toBe(false);
    // 3. Valid checksum but invalid foreign key inside state
    const badState = createInitialGameState(99);
    badState.inventory.push({ itemId: 'nonexistent_relic', quantity: 1 });
    const badEnvelope = serializeSaveEnvelope(badState, 99);
    expect(controller.importSaveFileContent(badEnvelope).ok).toBe(false);
    // 4. Oversized payload
    expect(controller.importSaveFileContent('x'.repeat(MAX_SAVE_BYTES + 64)).ok).toBe(false);

    // Active controller state and persisted storage remain 100% intact
    expect(controller.state.tokens).toBe(432);
    expect(controller.state.seedState).toBe(validSnapshotBefore.seedState);
    const reloaded = new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY).load();
    expect(reloaded.state?.tokens).toBe(432);
  });

  it('prefers in-memory fallback when memorySlot holds newer progress than PRIMARY_SAVE_KEY', () => {
    const storage = new MockStorage();
    const repo = new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY);

    const olderState = createInitialGameState(300);
    olderState.tokens = 210;
    olderState.stepCount = 12;
    const firstSave = repo.save(olderState);
    expect(firstSave.ok).toBe(true);
    expect(firstSave.usedMemoryFallback).toBe(false);

    // Simulate quota exhaustion mid-session so primary localStorage keeps olderState (seq 1)
    // while memorySlot receives newerState (seq 2)
    storage.quotaLimitBytes = 64;
    const newerState = structuredClone(olderState);
    newerState.tokens = 845;
    newerState.stepCount = 68;
    const secondSave = repo.save(newerState);
    expect(secondSave.ok).toBe(true);
    expect(secondSave.usedMemoryFallback).toBe(true);

    // Primary storage still contains olderState (210 tokens), yet repo.load() must return newerState (845 tokens)
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toContain('"tokens":210');
    const loaded = repo.load();
    expect(loaded.usedNewerMemoryFallback).toBe(true);
    expect(loaded.state?.tokens).toBe(845);
    expect(loaded.state?.stepCount).toBe(68);
  });
});

describe('Adaptive English engine: exposures vs mastery, phrases, polysemy, CEFR variants, and spaced re-encounter', () => {
  it('never equates passive exposure count with mastery', () => {
    const state = createInitialGameState(12);
    const sentence = 'Glowing lanterns guided tired scouts safely across wooden bridges.';

    for (let i = 0; i < 40; i++) {
      recordSentenceExposure(state, sentence, `ctx_${i}`, LEXICON_INDEX, 1_000_000 + i * 1000);
    }

    expect(state.lexicon.lex_lantern?.exposures).toBe(40);
    // Passive seeing must NEVER auto-promote mastery!
    expect(state.lexicon.lex_lantern?.mastery).toBe(0);

    // Only active voluntary recall updates mastery
    recordCampfireRecall(state, 'lex_lantern', true, 2_000_000);
    expect(state.lexicon.lex_lantern?.mastery).toBe(1);
    recordCampfireRecall(state, 'lex_lantern', false, 2_100_000);
    expect(state.lexicon.lex_lantern?.mastery).toBe(0);
    expect(state.lexicon.lex_lantern?.lapses).toBe(1);
  });

  it('tokenizes multi-word phrases greedily and resolves polysemous word senses by gameplay context', () => {
    const tokens = tokenizeEnglishText(
      'Watch out on steep slopes, and take your time beside the clear spring!',
      LEXICON_INDEX,
    );
    const matchedIds = tokens.filter((t) => t.entry).map((t) => t.entry!.id);
    expect(matchedIds).toContain('lex_phrase_watch_out');
    expect(matchedIds).toContain('lex_phrase_take_your_time');

    const barkEntry = LEXICON_INDEX.byId.lex_bark!;
    const treeSense = resolveSenseForContext(
      barkEntry,
      'world_clue',
      'Shellglow hides beneath rough oak bark by day.',
    );
    const foxSense = resolveSenseForContext(
      barkEntry,
      'warden_chat',
      'Cinderfox barks a sharp warning echo.',
    );
    expect(treeSense.primary.meaningVi).toContain('vỏ cây');
    expect(foxSense.primary.meaningVi).toContain('sủa');
    expect(treeSense.otherSenses.length).toBeGreaterThanOrEqual(1);
  });

  it('adapts dialogue lines by CEFR band and schedules looked-up words to reappear in fresh contexts', () => {
    const guideNode = DIALOGUES_BY_ID.rowan_guide_whisperwood!;
    const line0 = guideNode.lines[0]!;
    const a1 = resolveDialogueLineForLevel(line0, 'A1');
    const b2 = resolveDialogueLineForLevel(line0, 'B2');
    expect(a1.en).not.toBe(b2.en);
    expect(b2.en.length).toBeGreaterThan(a1.en.length);

    const state = createInitialGameState(95);
    state.stepCount = 10;
    recordWordLookup(state, 'lex_bark', 'sign_clue', 1_000_000);
    recordWordLookup(state, 'lex_bark', 'forest_chat', 1_005_000);
    expect(toggleWordSaved(state, 'lex_bark', 1_006_000)).toBe(true);

    // Advance steps past nextReviewStep (10 + 10 = 20)
    state.stepCount = 25;
    expect(computeWordReencounterPriority(state.lexicon.lex_bark!, state, 1_500_000)).toBeGreaterThan(
      20,
    );

    const echo = buildContextualReencounterEcho(
      state,
      'whisperwood',
      LEXICON_INDEX,
      1_500_000,
    );
    expect(echo).not.toBeNull();
    expect(echo?.wordId).toBe('lex_bark');
    expect(echo?.en.toLowerCase()).toContain('bark');

    const prompts = buildCampfireReviewSet(state, LEXICON_INDEX, 3, 1_500_000);
    expect(prompts[0]?.entry.id).toBe('lex_bark');
  });
});

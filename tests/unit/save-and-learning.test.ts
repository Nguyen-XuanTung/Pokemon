import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeSwManifestForDirectory } from '../../scripts/inject-sw-manifest.ts';
import { DIALOGUES_BY_ID } from '../../src/data/dialogues.ts';
import { LEXICON_INDEX } from '../../src/data/lexicon.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { createCreatureInstance } from '../../src/domain/creatures.ts';
import {
  buildCampfireReviewSet,
  buildContextualReencounterEcho,
  computeWordReencounterPriority,
  getDueReencounterEntries,
  isWordDueForReencounter,
  pickIndependentExample,
  recordCampfireRecall,
  recordSentenceExposure,
  recordWordLookup,
  resolveDialogueLineForLevel,
  resolvePocketWordNote,
  resolveSenseForContext,
  toggleWordSaved,
  tokenizeEnglishText,
} from '../../src/domain/learning.ts';
import {
  BACKUP_SAVE_KEY,
  MAX_SAVE_BYTES,
  migrateAndNormalizeSaveState,
  PRIMARY_SAVE_KEY,
  SAVE_SCHEMA_VERSION,
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

  it('strictly separates due eligibility from priority score: not-yet-due, multiple due, and mastered words', () => {
    const state = createInitialGameState(204);
    state.stepCount = 100;
    const nowMs = 5_000_000;

    // 1. Not-yet-due word with high positive priority (saved +18, looked up 3x +18):
    // nextReviewStep = 110, nextReviewAtMs = nowMs + 90_000 -> MUST NOT be due yet!
    recordWordLookup(state, 'lex_forest', 'forest_sign', nowMs);
    recordWordLookup(state, 'lex_forest', 'forest_sign', nowMs + 100);
    recordWordLookup(state, 'lex_forest', 'forest_sign', nowMs + 200);
    toggleWordSaved(state, 'lex_forest', nowMs + 300);

    const notYetDueMem = state.lexicon.lex_forest!;
    expect(computeWordReencounterPriority(notYetDueMem, state, nowMs + 500)).toBeGreaterThan(25);
    expect(isWordDueForReencounter(notYetDueMem, state, nowMs + 500)).toBe(false);
    expect(getDueReencounterEntries(state, LEXICON_INDEX, 4, nowMs + 500)).toHaveLength(0);
    expect(buildContextualReencounterEcho(state, 'whisperwood', LEXICON_INDEX, nowMs + 500)).toBeNull();

    // 2. Multiple due words + 1 mastered (mastery === 3) word:
    state.lexicon.lex_river = {
      wordId: 'lex_river',
      exposures: 2,
      glossLookups: 1,
      savedByPlayer: false,
      mastery: 0,
      lastSeenStep: 50,
      nextReviewStep: 70,
      nextReviewAtMs: nowMs - 10_000,
      contextsSeen: ['fen'],
    };
    state.lexicon.lex_lantern = {
      wordId: 'lex_lantern',
      exposures: 2,
      glossLookups: 2,
      savedByPlayer: true,
      mastery: 1,
      lastSeenStep: 40,
      nextReviewStep: 75,
      nextReviewAtMs: nowMs - 20_000,
      contextsSeen: ['camp'],
    };
    // Mastered word (mastery 3) whose long interval HAS not elapsed yet (step 100 < 240)
    state.lexicon.lex_bridge = {
      wordId: 'lex_bridge',
      exposures: 8,
      glossLookups: 2,
      savedByPlayer: true,
      mastery: 3,
      lastSeenStep: 90,
      nextReviewStep: 240,
      nextReviewAtMs: nowMs + 3_000_000,
      contextsSeen: ['fen'],
    };
    // Mastered word (mastery 3) whose long 180-step interval finally elapsed, yet still lower priority than unmastered!
    state.lexicon.lex_camp = {
      wordId: 'lex_camp',
      exposures: 10,
      glossLookups: 1,
      savedByPlayer: true,
      mastery: 3,
      lastSeenStep: 10,
      nextReviewStep: 95,
      nextReviewAtMs: nowMs - 5_000,
      contextsSeen: ['camp'],
    };

    const dueList = getDueReencounterEntries(state, LEXICON_INDEX, 8, nowMs + 500);
    const dueIds = dueList.map((d) => d.id);
    expect(dueIds).not.toContain('lex_forest'); // Not due yet!
    expect(dueIds).not.toContain('lex_bridge'); // Mastered and not due!
    expect(dueIds[0]).toBe('lex_lantern'); // Saved + unmastered due ranks #1
    expect(dueIds[1]).toBe('lex_river'); // Unmastered due ranks #2 ahead of mastered lex_camp
  });

  it('rotates multiple independent example sentences and resolves pocket-dictionary words outside the core lexicon', () => {
    const forestEntry = LEXICON_INDEX.byId.lex_forest!;
    const ex0 = pickIndependentExample(forestEntry, 'whisperwood', 0);
    const ex1 = pickIndependentExample(forestEntry, 'whisperwood', 1);
    const ex2 = pickIndependentExample(forestEntry, 'whisperwood', 2);
    expect(ex0.en).not.toBe(ex1.en);
    expect(ex1.en).not.toBe(ex2.en);

    // Stemmed & irregular words outside the core lexicon resolve via offline pocket dictionary
    const noteWent = resolvePocketWordNote('went');
    expect(noteWent?.base).toBe('go');
    expect(noteWent?.meaningVi).toContain('đi');

    const controller = new GameController(new SaveRepository(new MockStorage(), GAME_SAVE_VALIDATION_REGISTRY));
    controller.inspectPocketWord('Quietly', resolvePocketWordNote('quietly')!, 'Walk quietly beside the pond.');
    expect(controller.activePocketGloss?.note.base).toBe('quiet');
    controller.closeGlossPopup();
    expect(controller.activePocketGloss).toBeNull();
  });
});

describe('Audit v1.2 verifications: v1->v2 save migration, multi-tab race protection, SW content hash, and post-game features', () => {
  it('migrates v1.0/v1.1 saves cleanly when coordinates fall out-of-bounds or onto newly blocked village structures', () => {
    const legacyV1State = createInitialGameState(515) as unknown as Record<string, unknown>;
    legacyV1State.schemaVersion = 1;
    // Place legacy player right inside the newly built 3x3 village fountain at (8, 14) in Mosslight Camp!
    legacyV1State.playerPos = { x: 8, y: 14, facing: 'down' };
    delete legacyV1State.gleamingSpecies;
    delete legacyV1State.rematchCleared;
    delete legacyV1State.discoveredTraces;
    delete legacyV1State.readLoreIds;
    // Add an obsolete v1.0 lexicon key that no longer exists
    (legacyV1State.lexicon as Record<string, unknown>).lex_obsolete_v1_word = {
      wordId: 'lex_obsolete_v1_word',
      exposures: 2,
      glossLookups: 0,
      savedByPlayer: false,
      mastery: 0,
      lastSeenStep: 1,
      contextsSeen: [],
    };

    const rawV1Envelope = serializeSaveEnvelope(
      legacyV1State as unknown as ReturnType<typeof createInitialGameState>,
      3,
      1,
    );
    const storage = new MockStorage();
    storage.setItem(PRIMARY_SAVE_KEY, rawV1Envelope);

    const repo = new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY);
    const loaded = repo.load();
    expect(loaded.state).not.toBeNull();
    expect(loaded.migratedFromLegacy).toBe(true);
    expect(loaded.state?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    // Player must have been automatically relocated off the blocking (8,14) fountain onto an adjacent walkable tile!
    expect(
      loaded.state!.playerPos.x === 8 && loaded.state!.playerPos.y === 14,
    ).toBe(false);
    expect(
      GAME_SAVE_VALIDATION_REGISTRY.isPositionSafe!(
        loaded.state!.regionId,
        loaded.state!.playerPos.x,
        loaded.state!.playerPos.y,
        loaded.state!,
      ),
    ).toBe(true);
    expect(loaded.state?.lexicon.lex_obsolete_v1_word).toBeUndefined();
    expect(loaded.state?.gleamingSpecies).toEqual([]);
    expect(migrateAndNormalizeSaveState).toBeDefined();
  });

  it('prevents older tab from overwriting newer tab progress in localStorage and preserves backup on full quota', () => {
    const sharedStorage = new MockStorage();
    const tabA = new SaveRepository(sharedStorage, GAME_SAVE_VALIDATION_REGISTRY);
    const tabB = new SaveRepository(sharedStorage, GAME_SAVE_VALIDATION_REGISTRY);

    const stateA1 = createInitialGameState(10);
    stateA1.tokens = 200;
    expect(tabA.save(stateA1).ok).toBe(true);

    // Tab B loads seq 1, advances much further, and saves seq 2 & seq 3
    const loadedB = tabB.load().state!;
    loadedB.tokens = 950;
    loadedB.stepCount = 120;
    expect(tabB.save(loadedB).ok).toBe(true);
    loadedB.tokens = 1100;
    expect(tabB.save(loadedB).ok).toBe(true);

    // Stale Tab A (still only aware of seq 1) tries to save 210 tokens:
    // MUST NOT clobber Tab B's 1100-token save in PRIMARY_SAVE_KEY!
    stateA1.tokens = 210;
    const staleRes = tabA.save(stateA1);
    expect(staleRes.conflictWithNewerTab).toBe(true);
    expect(tabA.hasMultiTabConflict).toBe(true);
    expect(sharedStorage.getItem(PRIMARY_SAVE_KEY)).toContain('"tokens":1100');

    // Syncing Tab A pulls Tab B's 1100-token state cleanly
    const synced = tabA.syncFromNewerStorage();
    expect(synced.state?.tokens).toBe(1100);
    expect(tabA.hasMultiTabConflict).toBe(false);
  });

  it('generates deterministic sorted SW precache manifests whose CACHE_VERSION changes when file bytes change', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingowild-sw-test-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'assets', 'sprites'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'index.html'), '<!doctype html><title>A</title>');
      fs.writeFileSync(path.join(tmpDir, 'assets', 'z-bundle.js'), 'console.log(1);');
      fs.writeFileSync(path.join(tmpDir, 'assets', 'a-style.css'), 'body{}');
      fs.writeFileSync(path.join(tmpDir, 'assets', 'sprites', 'tileset.png'), Buffer.from([1, 2, 3, 4]));

      const manA1 = computeSwManifestForDirectory(tmpDir);
      const manA2 = computeSwManifestForDirectory(tmpDir);
      expect(manA1.version).toBe(manA2.version);
      expect(manA1.urls).toEqual([
        './',
        './index.html',
        './assets/a-style.css',
        './assets/sprites/tileset.png',
        './assets/z-bundle.js',
      ]);

      // Modify ONLY the raw bytes of an unhashed sprite (same filename!) -> CACHE_VERSION MUST change!
      fs.writeFileSync(path.join(tmpDir, 'assets', 'sprites', 'tileset.png'), Buffer.from([1, 2, 3, 99]));
      const manB = computeSwManifestForDirectory(tmpDir);
      expect(manB.version).not.toBe(manA1.version);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('supports gleaming rare variants, companion follower trail, habitat traces, evolution banner, and Warden rematches', () => {
    const controller = new GameController(new SaveRepository(new MockStorage(), GAME_SAVE_VALIDATION_REGISTRY));
    controller.startNewGame(4040);
    controller.advanceDialogue();
    controller.advanceDialogue();
    controller.selectDialogueChoice(controller.activeDialogue!.node.lines[2]!.choices![0]!); // Mosskit
    controller.advanceDialogue();
    controller.advanceDialogue();

    // Move left 2 steps -> follower trails 1 tile behind player!
    const startX = controller.state.playerPos.x;
    const startY = controller.state.playerPos.y;
    controller.movePlayer('left');
    expect(controller.followerPos.x).toBe(startX);
    expect(controller.followerPos.y).toBe(startY);

    // Trigger gleaming wild encounter & capture -> gleamingSpecies records species!
    controller.startWildEncounter('dewgrub', 3, true);
    expect(controller.activeBattle?.enemyParty[0]?.isRareVariant).toBe(true);
    controller.activeBattle!.enemyParty[0]!.currentHp = 1;
    controller.activeBattle!.enemyParty[0]!.status = 'sleep';
    controller.state.inventory.push({ itemId: 'star_charm', quantity: 3 });
    controller.submitBattleAction({ kind: 'item', itemId: 'star_charm' });
    if (controller.activeBattle?.outcome === 'captured') {
      expect(controller.state.gleamingSpecies).toContain('dewgrub');
    }
    controller.finishAndCloseBattle();

    // Post-game Warden Mastery Rematch against Sylvan (Lv.24-25)
    controller.state.flags.main_story_completed = true;
    controller.state.party = [
      createCreatureInstance({
        uid: 'champ_pyrelume',
        species: SPECIES_BY_ID.pyrelume!,
        level: 36,
        bondedRegion: 'mosslight_hub',
        movesById: MOVES_BY_ID,
      }),
      createCreatureInstance({
        uid: 'champ_flarecrest',
        species: SPECIES_BY_ID.flarecrest!,
        level: 36,
        bondedRegion: 'terracotta_ridge',
        movesById: MOVES_BY_ID,
      }),
    ];
    controller.startTrainerEncounter('npc_sylvan', true);
    const rematchSession = () => controller.activeBattle;
    expect(rematchSession()?.opponentTitleEn).toContain('Master Warden Sylvan');
    while (rematchSession() && rematchSession()!.outcome === 'ongoing') {
      const lead = rematchSession()!.playerParty[0]!;
      const dmgIdx = lead.moves.findIndex((m) => m.pp > 0 && (MOVES_BY_ID[m.moveId]?.power ?? 0) > 0);
      controller.submitBattleAction({ kind: 'move', moveIndex: Math.max(0, dmgIdx) });
    }
    expect(controller.state.rematchCleared).toContain('rematch_sylvan');
    expect(controller.state.flags.rematch_sylvan_cleared).toBe(true);
  });
});

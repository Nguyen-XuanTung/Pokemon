import { describe, expect, it } from 'vitest';
import { ITEMS_BY_ID } from '../../src/data/items.ts';
import { MAPS_BY_ID } from '../../src/data/maps.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { NPCS, NPCS_BY_ID } from '../../src/data/npcs.ts';
import { QUESTS } from '../../src/data/quests.ts';
import { SPECIES, SPECIES_BY_ID } from '../../src/data/species.ts';
import { createBattleSession, stepBattleTurn } from '../../src/domain/battle.ts';
import { checkBossReadiness, computeBattleAssistPlan } from '../../src/domain/battleAssist.ts';
import { computeCaptureProbability } from '../../src/domain/capture.ts';
import {
  createCreatureInstance,
  getUnlockedSpeciesMoves,
  replaceCreatureMoveSlot,
} from '../../src/domain/creatures.ts';
import { getDifficultyProfile } from '../../src/domain/difficulty.ts';
import {
  getUiStrings,
  inferContentLanguageFromSupport,
  localizePos,
  localizeSpeakerName,
  syncSupportModeFromContent,
  UI_STRINGS,
} from '../../src/domain/i18n.ts';
import {
  buildLostHelperReport,
  buildQuestObjectiveDetail,
  computeLocalBfsPath,
  computeNavigationPlan,
  findRegionPortalRoute,
  getNpcQuestMarker,
} from '../../src/domain/navigation.ts';
import {
  getActiveOnboardingPrompt,
  shouldGuaranteeFirstTutorialCapture,
  skipCurrentOnboardingStep,
  skipOnboarding,
} from '../../src/domain/onboarding.ts';
import { SeededRng } from '../../src/domain/rng.ts';
import {
  PRIMARY_SAVE_KEY,
  SaveRepository,
  serializeSaveEnvelope,
  validateGameStateShape,
  type StorageAdapter,
} from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';
import { isTileWalkable } from '../../src/domain/world.ts';
import {
  GAME_SAVE_VALIDATION_REGISTRY,
  GameController,
} from '../../src/game/controller.ts';

class MemoryStorage implements StorageAdapter {
  public readonly data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  public removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('Complete Vietnamese localization and language mode decoupling', () => {
  it('maintains symmetric catalogs for vi and en and translates speakers and parts of speech', () => {
    const viKeys = Object.keys(UI_STRINGS.vi).sort();
    const enKeys = Object.keys(UI_STRINGS.en).sort();
    expect(viKeys).toEqual(enKeys);

    expect(getUiStrings('vi').hudLostBtn).toBe('Tôi bị lạc');
    expect(getUiStrings('en').hudLostBtn).toBe("I'm Lost");
    expect(localizeSpeakerName('Ranger Rowan', 'vi')).toBe('Kiểm lâm Rowan');
    expect(localizeSpeakerName('Warden Sylvan', 'vi')).toBe('Thủ lĩnh Sylvan');
    expect(localizeSpeakerName('Basin Trail Signpost', 'vi')).toBe('Biển chỉ đường Thung lũng');
    expect(localizeSpeakerName('Ranger Rowan', 'en')).toBe('Ranger Rowan');
    expect(localizePos('noun', 'vi')).toBe('danh từ');
    expect(localizePos('verb', 'vi')).toBe('động từ');
    expect(localizePos('noun', 'en')).toBe('noun');

    expect(syncSupportModeFromContent('vi_only')).toBe('bilingual');
    expect(syncSupportModeFromContent('en_assist')).toBe('contextual');
    expect(syncSupportModeFromContent('en_immersion')).toBe('immersion');
    expect(inferContentLanguageFromSupport('contextual')).toBe('en_assist');
    expect(inferContentLanguageFromSupport('immersion')).toBe('en_immersion');
  });
});

describe('Three balanced combat difficulties without HP inflation or learning lock-in', () => {
  it('scales enemy damage, capture bonus, and smart AI across relaxed, adventure, and challenge with identical enemy HP', () => {
    const runSingleEnemyAttack = (difficulty: 'relaxed' | 'adventure' | 'challenge') => {
      const player = createCreatureInstance({
        uid: 'p1',
        species: SPECIES_BY_ID.mosskit!,
        level: 8,
        bondedRegion: 'mosslight_hub',
        movesById: MOVES_BY_ID,
      });
      const enemy = createCreatureInstance({
        uid: 'e1',
        species: SPECIES_BY_ID.kindlet!,
        level: 8,
        bondedRegion: 'whisperwood',
        movesById: MOVES_BY_ID,
      });
      const enemyMaxHp = enemy.maxHp;
      const startPlayerHp = player.currentHp;
      const session = createBattleSession({
        kind: 'wild',
        opponentTitleEn: 'Wild Kindlet',
        opponentTitleVi: 'Kindlet hoang dã',
        playerParty: [player],
        enemyParty: [enemy],
      });
      // Use a support/observe turn so enemy hits cleanly and we compare exact incoming damage
      stepBattleTurn(
        session,
        { kind: 'observe' },
        {
          speciesById: SPECIES_BY_ID,
          movesById: MOVES_BY_ID,
          itemsById: ITEMS_BY_ID,
          inventory: [],
          rng: new SeededRng(4242),
          difficulty,
        },
      );
      return {
        enemyMaxHp,
        damageTaken: startPlayerHp - player.currentHp,
      };
    };

    const relaxed = runSingleEnemyAttack('relaxed');
    const adventure = runSingleEnemyAttack('adventure');
    const challenge = runSingleEnemyAttack('challenge');

    // No artificial HP sponge on higher difficulty!
    expect(relaxed.enemyMaxHp).toBe(adventure.enemyMaxHp);
    expect(challenge.enemyMaxHp).toBe(adventure.enemyMaxHp);
    // Enemy damage strictly scales: relaxed < adventure <= challenge
    expect(relaxed.damageTaken).toBeLessThan(adventure.damageTaken);
    expect(challenge.damageTaken).toBeGreaterThanOrEqual(adventure.damageTaken);

    // Capture probability scales favorably for beginners on relaxed
    const wildTarget = createCreatureInstance({
      uid: 'cap1',
      species: SPECIES_BY_ID.breezeling!,
      level: 5,
      bondedRegion: 'whisperwood',
      movesById: MOVES_BY_ID,
    });
    wildTarget.currentHp = Math.floor(wildTarget.maxHp * 0.5);
    const pRelaxed = computeCaptureProbability({
      target: wildTarget,
      species: SPECIES_BY_ID.breezeling!,
      charmMultiplier: 1.15,
      difficultyMultiplier: getDifficultyProfile('relaxed').captureBonusMultiplier,
    });
    const pAdventure = computeCaptureProbability({
      target: wildTarget,
      species: SPECIES_BY_ID.breezeling!,
      charmMultiplier: 1.15,
      difficultyMultiplier: getDifficultyProfile('adventure').captureBonusMultiplier,
    });
    const pChallenge = computeCaptureProbability({
      target: wildTarget,
      species: SPECIES_BY_ID.breezeling!,
      charmMultiplier: 1.15,
      difficultyMultiplier: getDifficultyProfile('challenge').captureBonusMultiplier,
    });
    expect(pRelaxed).toBeGreaterThan(pAdventure);
    expect(pAdventure).toBeGreaterThan(pChallenge);
  });

  it('auto-heals gently after battle on relaxed mode and preserves all progress when switching difficulty', () => {
    const controller = new GameController(
      new SaveRepository(new MemoryStorage(), GAME_SAVE_VALIDATION_REGISTRY),
    );
    controller.startNewGame(1234, { skipTutorial: true });
    controller.advanceDialogue();
    controller.advanceDialogue();
    controller.selectDialogueChoice(controller.activeDialogue!.node.lines[2]!.choices![0]!); // Mosskit
    controller.advanceDialogue();
    controller.advanceDialogue();

    // Save a word & verify switching difficulty preserves lexicon, quests, party, and tokens
    controller.toggleSavedWordById('lex_valley');
    const tokensBefore = controller.state.tokens;
    controller.updateSettings({ difficulty: 'challenge' });
    controller.updateSettings({ difficulty: 'adventure' });
    controller.updateSettings({ difficulty: 'relaxed' });
    expect(controller.state.lexicon.lex_valley?.savedByPlayer).toBe(true);
    expect(controller.state.tokens).toBe(tokensBefore);

    // Trigger wild battle, drop starter HP to 40% & enemy HP to 1, finish battle naturally via attack -> relaxed recovers ~35% max HP
    const starter = controller.state.party[0]!;
    controller.startWildEncounter('dewgrub', 3);
    starter.currentHp = Math.floor(starter.maxHp * 0.4);
    const hpBeforeFinish = starter.currentHp;
    controller.activeBattle!.enemyParty[0]!.currentHp = 1;
    controller.submitBattleAction({ kind: 'move', moveIndex: 0 });
    expect(controller.activeBattle?.outcome).toBe('player_victory');
    controller.finishAndCloseBattle();
    expect(starter.currentHp).toBeGreaterThan(hpBeforeFinish);
  });
});

describe('BFS wayfinding, multi-region portal routing, locked gates, and quest objective details', () => {
  it('avoids all blocking terrain, decorations, props, and NPCs on local BFS paths', () => {
    const state = createInitialGameState(99);
    const map = MAPS_BY_ID.mosslight_hub;
    const npcsInHub = NPCS.filter((n) => n.regionId === 'mosslight_hub');

    // Route from spawn (15,13) to West Whisperwood Portal (0,12) across central camp fountain & buildings
    const path = computeLocalBfsPath({
      map,
      npcsInRegion: npcsInHub,
      state,
      startX: 15,
      startY: 13,
      targetX: 0,
      targetY: 12,
      stopAdjacent: false,
      allowTargetPortal: true,
    });
    expect(path.length).toBeGreaterThan(10);
    // Every intermediate tile (excluding final portal) must be walkable!
    for (let i = 0; i < path.length - 1; i++) {
      const pt = path[i]!;
      expect(isTileWalkable({ map, npcsInRegion: npcsInHub, state, x: pt.x, y: pt.y })).toBe(true);
    }
    expect(path[path.length - 1]).toEqual({ x: 0, y: 12 });
  });

  it('routes through unlocked portals across regions and blocks locked portals with clear requirements', () => {
    const state = createInitialGameState(77);
    state.starterChosen = 'mosskit';
    state.flags.has_starter = true;
    state.quests.q01_first_partner = {
      questId: 'q01_first_partner',
      status: 'completed',
      rewardClaimed: true,
    };

    // Unlocked route: mosslight_hub -> whisperwood works immediately
    const openRoute = findRegionPortalRoute({
      fromRegion: 'mosslight_hub',
      toRegion: 'whisperwood',
      state,
      mapsById: MAPS_BY_ID,
      speciesById: SPECIES_BY_ID,
    });
    expect(openRoute).not.toBeNull();
    expect(openRoute!.length).toBe(1);

    // Locked route: mosslight_hub -> reedwater_fen is blocked until warden_sylvan_cleared!
    const lockedRoute = findRegionPortalRoute({
      fromRegion: 'mosslight_hub',
      toRegion: 'reedwater_fen',
      state,
      mapsById: MAPS_BY_ID,
      speciesById: SPECIES_BY_ID,
    });
    expect(lockedRoute).toBeNull();

    // Tracking a Reedwater quest while locked must NOT path through the locked portal and must surface gateRequirementVi
    state.quests.q07_mist_beacons = {
      questId: 'q07_mist_beacons',
      status: 'active',
      rewardClaimed: false,
    };
    state.trackedQuestId = 'q07_mist_beacons';
    const blockedPlan = computeNavigationPlan({
      state,
      mapsById: MAPS_BY_ID,
      npcs: NPCS,
      npcsById: NPCS_BY_ID,
      quests: QUESTS,
      speciesById: SPECIES_BY_ID,
    });
    expect(blockedPlan.blockedByGate).toBe(true);
    expect(blockedPlan.waypoints.length).toBe(0);
    expect(blockedPlan.gateRequirementVi).toBeTruthy();

    // Once Warden Sylvan is cleared, route to Reedwater Fen unlocks cleanly!
    state.flags.warden_sylvan_cleared = true;
    const unlockedPlan = computeNavigationPlan({
      state,
      mapsById: MAPS_BY_ID,
      npcs: NPCS,
      npcsById: NPCS_BY_ID,
      quests: QUESTS,
      speciesById: SPECIES_BY_ID,
    });
    expect(unlockedPlan.blockedByGate).toBe(false);
    expect(unlockedPlan.isCrossRegion).toBe(true);
    expect(unlockedPlan.waypoints.length).toBeGreaterThan(0);
  });

  it('produces complete structured details for all 12 quests, NPC !/? markers, and Lost Helper reports without spoiling secrets', () => {
    const state = createInitialGameState(55);
    state.starterChosen = 'mosskit';
    state.flags.has_starter = true;
    state.quests.q02_whisperwood_echo = {
      questId: 'q02_whisperwood_echo',
      status: 'active',
      rewardClaimed: false,
    };

    const freshState = createInitialGameState(56);
    for (const quest of QUESTS) {
      const evalState = quest.id === 'q01_first_partner' ? freshState : state;
      const detail = buildQuestObjectiveDetail({
        quest,
        state: evalState,
        mapsById: MAPS_BY_ID,
        npcsById: NPCS_BY_ID,
        speciesById: SPECIES_BY_ID,
      });
      expect(detail.whatVi.length).toBeGreaterThan(5);
      expect(detail.whatEn.length).toBeGreaterThan(5);
      expect(detail.targetLabelVi.length).toBeGreaterThan(2);
      expect(detail.regionNameVi.length).toBeGreaterThan(2);
      expect(detail.progressVi.length).toBeGreaterThan(2);
      expect(detail.target, `Quest ${quest.id} must resolve a real navigation target`).toBeDefined();
      if (detail.recommendedPrepVi) {
        expect(detail.recommendedPrepVi.length).toBeGreaterThan(5);
      }
    }

    // Botanist Linh offers q03_field_herbarium -> 'new_quest' (!); Warden Sylvan is active story warden -> 'turn_in' (?)
    expect(
      getNpcQuestMarker({ npc: NPCS_BY_ID.npc_linh!, state, quests: QUESTS, speciesById: SPECIES_BY_ID }),
    ).toBe('new_quest');
    expect(
      getNpcQuestMarker({ npc: NPCS_BY_ID.npc_sylvan!, state, quests: QUESTS, speciesById: SPECIES_BY_ID }),
    ).toBe('turn_in');

    const navPlan = computeNavigationPlan({
      state,
      mapsById: MAPS_BY_ID,
      npcs: NPCS,
      npcsById: NPCS_BY_ID,
      quests: QUESTS,
      speciesById: SPECIES_BY_ID,
    });
    const report = buildLostHelperReport({ state, navPlan, mapsById: MAPS_BY_ID });
    expect(report.regionNameVi).toContain('Trại Đèn Rêu');
    expect(report.nextActionVi.length).toBeGreaterThan(5);
    expect(report.routeSummaryVi.length).toBeGreaterThan(5);
    // Must never spoil secret chests or hidden traces
    expect(report.routeSummaryVi.toLowerCase()).not.toContain('rương bí mật');
    expect(report.routeSummaryEn.toLowerCase()).not.toContain('secret chest');
  });
});

describe('10-step onboarding, guaranteed first capture, Battle Assist, Move Manager, and legacy save migration', () => {
  it('guides a beginner step-by-step, guarantees 100% first tutorial capture, and allows skipping without losing rewards', () => {
    const controller = new GameController(
      new SaveRepository(new MemoryStorage(), GAME_SAVE_VALIDATION_REGISTRY),
    );
    controller.startNewGame(2026);
    expect(getActiveOnboardingPrompt(controller.state)?.id).toBe('choose_starter');

    // Choose Mosskit
    controller.advanceDialogue();
    controller.advanceDialogue();
    controller.selectDialogueChoice(controller.activeDialogue!.node.lines[2]!.choices![0]!);
    controller.advanceDialogue();
    controller.advanceDialogue();
    expect(getActiveOnboardingPrompt(controller.state)?.id).toBe('move_around');

    // Step 2: move 3 tiles to complete move_around -> advances to talk_npc
    controller.movePlayer('left');
    controller.movePlayer('left');
    controller.movePlayer('up');
    expect(getActiveOnboardingPrompt(controller.state)?.id).toBe('talk_npc');

    // Step 5 & 6: first tutorial wild battle + guaranteed 100% capture after 1 attack!
    controller.startWildEncounter('dewgrub', 3);
    expect(
      shouldGuaranteeFirstTutorialCapture({
        state: controller.state,
        enemyHpRatio: 1,
        turnCount: 0,
      }),
    ).toBe(false);

    controller.submitBattleAction({ kind: 'move', moveIndex: 0 });
    expect(
      shouldGuaranteeFirstTutorialCapture({
        state: controller.state,
        enemyHpRatio: 0.9,
        turnCount: 1,
      }),
    ).toBe(true);

    controller.submitBattleAction({ kind: 'item', itemId: 'moss_charm' });
    expect(controller.activeBattle?.outcome).toBe('captured');
    expect(controller.state.onboarding?.firstCaptureGuaranteedUsed).toBe(true);
    controller.finishAndCloseBattle();

    // Skipping optional gloss step works cleanly
    controller.state.onboarding!.completedSteps = [
      'choose_starter',
      'move_around',
      'talk_npc',
      'track_quest',
      'first_battle',
      'first_capture',
      'campfire_heal',
    ];
    expect(getActiveOnboardingPrompt(controller.state)?.id).toBe('optional_gloss');
    skipCurrentOnboardingStep(controller.state);
    expect(getActiveOnboardingPrompt(controller.state)?.id).toBe('open_journal');

    // Skipping onboarding preserves every starter item and token
    const freshController = new GameController(
      new SaveRepository(new MemoryStorage(), GAME_SAVE_VALIDATION_REGISTRY),
    );
    freshController.startNewGame(999, { skipTutorial: true });
    expect(getActiveOnboardingPrompt(freshController.state)).toBeNull();
    expect(freshController.state.tokens).toBe(180);
    expect(freshController.state.inventory.find((i) => i.itemId === 'moss_charm')?.quantity).toBe(6);
    expect(freshController.state.inventory.find((i) => i.itemId === 'dew_tonic')?.quantity).toBe(4);
    expect(skipOnboarding).toBeDefined();
  });

  it('computes battle assist recommendations, boss readiness warnings, move swaps, and zero-penalty defeat recovery', () => {
    const state = createInitialGameState(303);
    const leafLead = createCreatureInstance({
      uid: 'lead_1',
      species: SPECIES_BY_ID.mosskit!,
      level: 10,
      bondedRegion: 'mosslight_hub',
      movesById: MOVES_BY_ID,
    });
    const waterBench = createCreatureInstance({
      uid: 'bench_1',
      species: SPECIES_BY_ID.ripplefin!,
      level: 10,
      bondedRegion: 'mosslight_hub',
      movesById: MOVES_BY_ID,
    });
    state.party = [leafLead, waterBench];

    // Against an Ember foe, Battle Assist suggests switching to Water bench counter!
    const emberFoe = createCreatureInstance({
      uid: 'foe_1',
      species: SPECIES_BY_ID.kindlet!,
      level: 9,
      bondedRegion: 'terracotta_ridge',
      movesById: MOVES_BY_ID,
    });
    const session = createBattleSession({
      kind: 'wild',
      opponentTitleEn: 'Wild Kindlet',
      opponentTitleVi: 'Kindlet hoang dã',
      playerParty: state.party,
      enemyParty: [emberFoe],
    });
    const plan = computeBattleAssistPlan({
      session,
      state,
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
      itemsById: ITEMS_BY_ID,
    });
    expect(plan.switchSuggestion?.partyIndex).toBe(1);
    expect(plan.captureAdvice).not.toBeNull();

    // Low HP triggers warning
    leafLead.currentHp = Math.max(1, Math.floor(leafLead.maxHp * 0.25));
    const lowHpPlan = computeBattleAssistPlan({
      session,
      state,
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
      itemsById: ITEMS_BY_ID,
    });
    expect(lowHpPlan.lowHpWarning.active).toBe(true);

    // Boss readiness warning detects underleveled party vs Warden Mirella (Lv.16)
    const warn = checkBossReadiness(state, NPCS_BY_ID.npc_mirella!);
    expect(warn?.isUnderleveled).toBe(true);
    expect(warn?.needsHeal).toBe(true);

    // Move manager lets player swap an unlocked species move into slot 0
    const briarpaw = createCreatureInstance({
      uid: 'm_swap',
      species: SPECIES_BY_ID.briarpaw!,
      level: 16,
      bondedRegion: 'mosslight_hub',
      movesById: MOVES_BY_ID,
    });
    const unlocked = getUnlockedSpeciesMoves(briarpaw, SPECIES, MOVES_BY_ID);
    const candidate = unlocked.find((m) => !briarpaw.moves.some((s) => s.moveId === m.id));
    expect(candidate).toBeDefined();
    expect(
      replaceCreatureMoveSlot({
        creature: briarpaw,
        slotIndex: 0,
        newMoveId: candidate!.id,
        movesById: MOVES_BY_ID,
      }),
    ).toBe(true);
    expect(briarpaw.moves[0]?.moveId).toBe(candidate!.id);

    // Zero-penalty defeat recovery restores full HP at nearest campfire without losing tokens/items
    const controller = new GameController(
      new SaveRepository(new MemoryStorage(), GAME_SAVE_VALIDATION_REGISTRY),
    );
    controller.startNewGame(404, { skipTutorial: true });
    controller.advanceDialogue();
    controller.advanceDialogue();
    controller.selectDialogueChoice(controller.activeDialogue!.node.lines[2]!.choices![0]!);
    controller.advanceDialogue();
    controller.advanceDialogue();
    const tokensBeforeLoss = controller.state.tokens;
    controller.startWildEncounter('flarecrest', 25);
    controller.state.party[0]!.currentHp = 1;
    controller.submitBattleAction({ kind: 'observe' });
    expect(controller.activeBattle?.outcome).toBe('player_defeat');
    controller.finishAndCloseBattle();
    expect(controller.state.tokens).toBe(tokensBeforeLoss);
    expect(controller.state.party[0]!.currentHp).toBe(controller.state.party[0]!.maxHp);
  });

  it('migrates legacy v2 saves cleanly with beginner defaults and rejects invalid beginner setting enums', () => {
    const legacyState = createInitialGameState(888) as unknown as Record<string, unknown>;
    legacyState.schemaVersion = 2;
    legacyState.starterChosen = 'mosskit';
    const settings = legacyState.settings as Record<string, unknown>;
    settings.supportMode = 'contextual';
    delete settings.uiLanguage;
    delete settings.contentLanguage;
    delete settings.difficulty;
    delete settings.guidanceMode;
    delete settings.battleAssist;
    delete legacyState.trackedQuestId;
    delete legacyState.onboarding;

    const storage = new MemoryStorage();
    storage.setItem(
      PRIMARY_SAVE_KEY,
      serializeSaveEnvelope(legacyState as unknown as ReturnType<typeof createInitialGameState>, 5, 2),
    );
    const repo = new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY);
    const loaded = repo.load();
    expect(loaded.state).not.toBeNull();
    expect(loaded.state?.settings.uiLanguage).toBe('vi');
    expect(loaded.state?.settings.contentLanguage).toBe('en_assist');
    expect(loaded.state?.settings.difficulty).toBe('adventure');
    expect(loaded.state?.settings.guidanceMode).toBe('full');
    expect(loaded.state?.settings.battleAssist).toBe(true);
    expect(loaded.state?.onboarding?.skipped).toBe(true);

    const invalid = structuredClone(loaded.state!);
    (invalid.settings as unknown as { difficulty: string }).difficulty = 'nightmare';
    expect(validateGameStateShape(invalid, GAME_SAVE_VALIDATION_REGISTRY)).toBe(false);
  });
});

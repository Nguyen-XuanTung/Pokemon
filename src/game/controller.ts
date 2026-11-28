import { SoundEngine } from '../audio/soundEngine.ts';
import { DIALOGUES_BY_ID } from '../data/dialogues.ts';
import { ITEMS, ITEMS_BY_ID } from '../data/items.ts';
import { LEXICON_INDEX } from '../data/lexicon.ts';
import { MAPS, MAPS_BY_ID } from '../data/maps.ts';
import { MOVES_BY_ID } from '../data/moves.ts';
import { NPCS, NPCS_BY_ID } from '../data/npcs.ts';
import type { PocketWordNote } from '../data/pocket-dict.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES, SPECIES_BY_ID } from '../data/species.ts';
import {
  createBattleSession,
  stepBattleTurn,
  type BattleEventLog,
  type BattleSession,
  type PlayerBattleAction,
} from '../domain/battle.ts';
import { checkBossReadiness, type BossReadinessCheck } from '../domain/battleAssist.ts';
import { createCreatureInstance, replaceCreatureMoveSlot } from '../domain/creatures.ts';
import { getDifficultyProfile } from '../domain/difficulty.ts';
import {
  inferContentLanguageFromSupport,
  syncSupportModeFromContent,
} from '../domain/i18n.ts';
import {
  buildCampfireReviewSet,
  buildContextualReencounterEcho,
  recordCampfireRecall,
  recordSentenceExposure,
  recordWordLookup,
  resolveDialogueLineForLevel,
  toggleWordSaved,
  type CampfireReviewPrompt,
} from '../domain/learning.ts';
import {
  buildLostHelperReport,
  computeNavigationPlan,
  type LostHelperReport,
  type NavigationPlan,
} from '../domain/navigation.ts';
import {
  ensureOnboardingState,
  getActiveOnboardingPrompt,
  restartOnboarding,
  shouldGuaranteeFirstTutorialCapture,
  skipCurrentOnboardingStep,
  skipOnboarding,
  syncOnboardingProgress,
  type OnboardingStepPrompt,
} from '../domain/onboarding.ts';
import { startQuest, syncQuestsWithState, type QuestSyncNotification } from '../domain/quests.ts';
import { SeededRng } from '../domain/rng.ts';
import { SaveRepository, type SaveValidationRegistry } from '../domain/save.ts';
import {
  addItemToState,
  buySupplyItem,
  chooseStarterPartner,
  createInitialGameState,
  healPartyInState,
  markSpeciesDiscovered,
  registerCapturedWildkin,
  swapPartySlots,
  swapPartyWithSanctuary,
  useFieldItem,
} from '../domain/state.ts';
import type {
  DialogueAction,
  DialogueChoice,
  DialogueNode,
  Direction,
  ElementType,
  GameSettings,
  GameState,
  LexiconEntry,
  NpcDefinition,
} from '../domain/types.ts';
import {
  attemptPlayerStep,
  inspectFacingTile,
  isTileWalkable,
  nextTimeOfDay,
  offsetByDirection,
} from '../domain/world.ts';

const OPPOSITE_DIR: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const GAME_SAVE_VALIDATION_REGISTRY: SaveValidationRegistry = {
  validSpeciesIds: new Set(SPECIES.map((s) => s.id)),
  starterSpeciesIds: new Set(SPECIES.filter((s) => s.isStarter).map((s) => s.id)),
  validMoveIds: new Set(Object.keys(MOVES_BY_ID)),
  validItemIds: new Set(Object.keys(ITEMS_BY_ID)),
  validQuestIds: new Set(QUESTS.map((q) => q.id)),
  validWordIds: new Set(Object.keys(LEXICON_INDEX.byId)),
  mapBounds: Object.fromEntries(MAPS.map((m) => [m.id, { width: m.width, height: m.height }])),
  regionSpawns: Object.fromEntries(
    MAPS.map((m) => [m.id, { x: m.spawnX, y: m.spawnY }]),
  ) as SaveValidationRegistry['regionSpawns'],
  isPositionSafe: (regionId, x, y, state) => {
    const map = (MAPS_BY_ID as Readonly<Record<string, (typeof MAPS)[number]>>)[regionId];
    if (!map) return false;
    const npcsInRegion = NPCS.filter((n) => n.regionId === regionId);
    return isTileWalkable({ map, npcsInRegion, state, x, y });
  },
};

export interface ActiveDialogueState {
  readonly node: DialogueNode;
  lineIndex: number;
  resolvedEn: string;
  resolvedVi: string;
  echoEn?: string;
  echoVi?: string;
  revealViOverride: boolean;
  speechNoteVi: string;
}

export interface BattleVisualCue {
  readonly id: number;
  readonly kind: 'player_attack' | 'enemy_attack' | 'capture_success' | 'capture_break' | 'heal';
  readonly element?: ElementType;
  readonly damage?: number;
  readonly isSuperEffective?: boolean;
  readonly shakes?: number;
}

export interface ToastBanner {
  readonly id: number;
  readonly messageEn: string;
  readonly messageVi: string;
}

export type ActiveModal =
  | 'none'
  | 'title'
  | 'journal'
  | 'supply_post'
  | 'camp_review'
  | 'ending_banner'
  | 'lost_helper';

export interface MoveLearnNotice {
  readonly partyIndex: number;
  readonly speciesId: string;
  readonly moveId: string;
  readonly replacedMoveId?: string;
  readonly triggeredAtStep: number;
}

export type JournalTab =
  | 'quests'
  | 'map'
  | 'team'
  | 'bag'
  | 'compendium'
  | 'lexicon'
  | 'settings';

export interface PocketGlossState {
  readonly surface: string;
  readonly note: PocketWordNote;
  readonly sentenceEn: string;
}

export interface EvolutionCelebrationState {
  readonly fromSpeciesId: string;
  readonly toSpeciesId: string;
  readonly newLevel: number;
  readonly triggeredAtStep: number;
}

export class GameController {
  public state: GameState;
  public readonly rng: SeededRng;
  public readonly saveRepo: SaveRepository;
  public readonly sound: SoundEngine;

  public activeModal: ActiveModal = 'title';
  public journalTab: JournalTab = 'quests';
  public activeDialogue: ActiveDialogueState | null = null;
  public activeBattle: BattleSession | null = null;
  public activeTrainerNpc: NpcDefinition | null = null;
  public activeBattleIsRematch = false;
  public battleLogs: BattleEventLog[] = [];
  public lastBattleAnim: 'none' | 'player_attack' | 'enemy_attack' | 'capture' | 'heal' = 'none';
  public lastBattleVisual: BattleVisualCue | null = null;
  public activeGlossEntry: LexiconEntry | null = null;
  public activePocketGloss: PocketGlossState | null = null;
  public activeGlossContextTag: string = '';
  public activeGlossSentenceEn: string = '';
  public activeGlossNoteVi: string = '';
  public activeEvolution: EvolutionCelebrationState | null = null;
  public activeMoveLearnBanner: MoveLearnNotice | null = null;
  public pendingBossWarning: BossReadinessCheck | null = null;
  public navigationPlan!: NavigationPlan;
  public activeOnboardingPrompt: OnboardingStepPrompt | null = null;
  public followerPos: { x: number; y: number; facing: Direction };
  public campPrompts: CampfireReviewPrompt[] = [];
  public campPromptIndex = 0;
  public toasts: ToastBanner[] = [];
  public statusNotice: string = '';

  private nextToastId = 1;
  private nextVisualCueId = 1;
  private readonly listeners = new Set<() => void>();
  private playTimerId: number | null = null;

  public constructor(saveRepo?: SaveRepository) {
    this.saveRepo = saveRepo ?? new SaveRepository(undefined, GAME_SAVE_VALIDATION_REGISTRY);
    this.sound = new SoundEngine();
    const loaded = this.saveRepo.load();
    if (loaded.state) {
      this.state = loaded.state;
      if (loaded.warning) {
        this.statusNotice = loaded.warning;
      }
    } else {
      this.state = createInitialGameState();
      if (loaded.warning) {
        this.statusNotice = loaded.warning;
      }
    }
    this.rng = new SeededRng(this.state.seedState);
    this.followerPos = this.computeDefaultFollowerPos();
    this.refreshGuidanceAndNavigation();
    this.sound.configure({
      bgmVolume: this.state.settings.bgmVolume,
      sfxVolume: this.state.settings.sfxVolume,
      muted: this.state.settings.muted,
    });
  }

  public refreshGuidanceAndNavigation(): void {
    this.activeOnboardingPrompt = getActiveOnboardingPrompt(this.state);
    this.navigationPlan = computeNavigationPlan({
      state: this.state,
      mapsById: MAPS_BY_ID,
      npcs: NPCS,
      npcsById: NPCS_BY_ID,
      quests: QUESTS,
      speciesById: SPECIES_BY_ID,
      overrideTarget: this.activeOnboardingPrompt?.overrideTarget ?? null,
    });
  }

  private computeDefaultFollowerPos(): { x: number; y: number; facing: Direction } {
    const map = MAPS_BY_ID[this.state.regionId];
    const behind = offsetByDirection(
      this.state.playerPos.x,
      this.state.playerPos.y,
      OPPOSITE_DIR[this.state.playerPos.facing],
    );
    const npcsInRegion = NPCS.filter((n) => n.regionId === this.state.regionId);
    if (isTileWalkable({ map, npcsInRegion, state: this.state, x: behind.x, y: behind.y })) {
      return { x: behind.x, y: behind.y, facing: this.state.playerPos.facing };
    }
    return { ...this.state.playerPos };
  }

  public startPlaytimeClock(): void {
    if (typeof window === 'undefined' || this.playTimerId !== null) return;
    this.playTimerId = window.setInterval(() => {
      if (this.activeModal !== 'title') {
        this.state.playTimeSeconds += 1;
      }
    }, 1000);
  }

  public stopPlaytimeClock(): void {
    if (typeof window !== 'undefined' && this.playTimerId !== null) {
      window.clearInterval(this.playTimerId);
      this.playTimerId = null;
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emitChange(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  public startNewGame(
    seed: number = Date.now() >>> 0,
    options?: { readonly skipTutorial?: boolean },
  ): void {
    const prevSettings = structuredClone(this.state.settings);
    this.state = createInitialGameState(seed);
    this.state.settings = prevSettings;
    if (options?.skipTutorial) {
      skipOnboarding(this.state);
    }
    this.rng.setSeedState(this.state.seedState);
    this.activeBattle = null;
    this.activeTrainerNpc = null;
    this.activeBattleIsRematch = false;
    this.activeDialogue = null;
    this.activeGlossEntry = null;
    this.activePocketGloss = null;
    this.activeEvolution = null;
    this.activeMoveLearnBanner = null;
    this.pendingBossWarning = null;
    this.lastBattleVisual = null;
    this.followerPos = this.computeDefaultFollowerPos();
    this.activeModal = 'none';
    this.refreshGuidanceAndNavigation();
    this.sound.unlock();
    this.syncRegionMusic();
    this.persistState();
    this.openDialogueById('rowan_intro_choose_starter');
    this.emitChange();
  }

  public continueSavedGame(): void {
    const loaded = this.saveRepo.load();
    if (loaded.state) {
      this.state = loaded.state;
      this.rng.setSeedState(this.state.seedState);
      this.followerPos = this.computeDefaultFollowerPos();
      if (loaded.warning) {
        this.pushToast('Save Restored', loaded.warning);
      }
    }
    this.activeModal = 'none';
    this.refreshGuidanceAndNavigation();
    this.sound.unlock();
    this.sound.configure({
      bgmVolume: this.state.settings.bgmVolume,
      sfxVolume: this.state.settings.sfxVolume,
      muted: this.state.settings.muted,
    });
    this.syncRegionMusic();
    this.emitChange();
  }

  public persistState(): void {
    this.state.seedState = this.rng.getSeedState();
    const res = this.saveRepo.save(this.state);
    if (res.warning) {
      this.statusNotice = res.warning;
    }
  }

  public movePlayer(direction: Direction): void {
    if (
      this.activeModal !== 'none' ||
      this.activeDialogue !== null ||
      this.activeBattle !== null
    ) {
      return;
    }
    this.sound.unlock();
    const prevX = this.state.playerPos.x;
    const prevY = this.state.playerPos.y;
    const map = MAPS_BY_ID[this.state.regionId];
    const npcsInRegion = NPCS.filter((n) => n.regionId === this.state.regionId);
    const step = attemptPlayerStep({
      state: this.state,
      map,
      npcsInRegion,
      speciesById: SPECIES_BY_ID,
      direction,
      rng: this.rng,
    });

    if (step.kind === 'blocked') {
      this.refreshGuidanceAndNavigation();
      this.emitChange();
      return;
    }

    this.sound.playSfx('step');
    if (this.state.starterChosen) {
      ensureOnboardingState(this.state).stepsMovedSinceStarter += 1;
    }
    if (
      this.activeEvolution &&
      this.state.stepCount - this.activeEvolution.triggeredAtStep >= 3
    ) {
      this.activeEvolution = null;
    }
    if (
      this.activeMoveLearnBanner &&
      this.state.stepCount - this.activeMoveLearnBanner.triggeredAtStep >= 4
    ) {
      this.activeMoveLearnBanner = null;
    }

    if (step.kind === 'portal_blocked') {
      this.refreshGuidanceAndNavigation();
      if (step.portal.blockedDialogueId) {
        this.openDialogueById(step.portal.blockedDialogueId);
      } else {
        this.pushToast(step.portal.labelEn, step.portal.labelVi);
      }
      this.emitChange();
      return;
    }

    if (step.kind === 'portal_entered') {
      this.followerPos = this.computeDefaultFollowerPos();
      const destMap = MAPS_BY_ID[this.state.regionId];
      this.pushToast(`Entered ${destMap.nameEn}`, `Đã tới ${destMap.nameVi}`);
      this.syncQuestsAndNotify();
      this.refreshGuidanceAndNavigation();
      this.syncRegionMusic();
      this.persistState();
      this.emitChange();
      return;
    }

    this.followerPos = { x: prevX, y: prevY, facing: direction };

    if (step.kind === 'wild_encounter') {
      const ob = ensureOnboardingState(this.state);
      if (
        !ob.skipped &&
        !ob.firstCaptureGuaranteedUsed &&
        this.state.stats.wildCaught === 0 &&
        this.state.regionId === 'whisperwood'
      ) {
        const gentleSpecies = this.state.starterChosen === 'ripplefin' ? 'breezeling' : 'dewgrub';
        this.startWildEncounter(gentleSpecies, 3, false);
      } else {
        this.startWildEncounter(step.speciesId, step.level, Boolean(step.isRareVariant));
      }
      this.refreshGuidanceAndNavigation();
      this.emitChange();
      return;
    }

    this.refreshGuidanceAndNavigation();
    this.emitChange();
  }

  public interactFacing(): void {
    this.sound.unlock();
    if (this.activeDialogue) {
      this.advanceDialogue();
      return;
    }
    if (this.activeModal !== 'none' || this.activeBattle !== null) {
      return;
    }
    const map = MAPS_BY_ID[this.state.regionId];
    const npcsInRegion = NPCS.filter((n) => n.regionId === this.state.regionId);
    let hit = inspectFacingTile({
      state: this.state,
      map,
      npcsInRegion,
    });

    if (hit.kind === 'none' && this.navigationPlan.nearbyInteractable) {
      this.state.playerPos.facing = this.navigationPlan.nearbyInteractable.direction;
      hit = inspectFacingTile({
        state: this.state,
        map,
        npcsInRegion,
      });
    }

    if (hit.kind === 'npc') {
      this.sound.playSfx('select');
      if (this.state.starterChosen && hit.npc.id !== 'npc_rowan') {
        this.state.flags.onboarding_talked_npc = true;
      }
      const isBossRematch = Boolean(
        this.state.flags.main_story_completed && hit.npc.rematchBattle,
      );
      const needsBossClear = Boolean(
        hit.npc.trainerBattle?.isBoss &&
          !this.state.defeatedTrainers.includes(hit.npc.trainerBattle.id),
      );
      this.pendingBossWarning =
        needsBossClear || isBossRematch
          ? checkBossReadiness(this.state, hit.npc, isBossRematch)
          : null;
      this.openDialogueById(hit.dialogueId);
      this.refreshGuidanceAndNavigation();
      this.emitChange();
      return;
    }

    if (hit.kind === 'prop') {
      const prop = hit.prop;
      this.sound.playSfx('select');
      this.pendingBossWarning = null;
      if (this.state.starterChosen && prop.kind === 'sign') {
        this.state.flags.onboarding_talked_npc = true;
      }
      if (prop.kind === 'chest') {
        if (this.state.openedProps.includes(prop.id)) {
          this.pushToast('Empty supply chest.', 'Chiếc rương này đã được mở.');
          this.emitChange();
          return;
        }
        this.state.openedProps.push(prop.id);
        if (prop.rewardItemId && prop.rewardQuantity) {
          addItemToState(this.state, prop.rewardItemId, prop.rewardQuantity);
        }
        if (prop.rewardTokens) {
          this.state.tokens += prop.rewardTokens;
        }
        if (prop.setsFlag) {
          this.state.flags[prop.setsFlag] = true;
        }
        const itemDef = prop.rewardItemId ? ITEMS_BY_ID[prop.rewardItemId] : undefined;
        const itemLabelEn = itemDef ? `${prop.rewardQuantity ?? 1}x ${itemDef.nameEn}` : 'supplies';
        const itemLabelVi = itemDef ? `${prop.rewardQuantity ?? 1} ${itemDef.nameVi}` : 'vật phẩm';
        this.sound.playSfx('quest');
        this.pushToast(
          `Found ${itemLabelEn} (+${prop.rewardTokens ?? 0} Tokens)!`,
          `Nhận được ${itemLabelVi} (+${prop.rewardTokens ?? 0} Huy hiệu)!`,
        );
        this.syncQuestsAndNotify();
        this.persistState();
        this.emitChange();
        return;
      }

      if (prop.kind === 'trace') {
        const firstTime = !this.state.discoveredTraces.includes(prop.id);
        if (firstTime) {
          this.state.discoveredTraces.push(prop.id);
          if (prop.traceSpeciesId) {
            markSpeciesDiscovered(this.state, prop.traceSpeciesId);
          }
          this.sound.playSfx('quest');
          this.pushToast(
            `Habitat Trace Logged: ${prop.labelEn}`,
            `Đã ghi nhận dấu vết sinh cảnh: ${prop.labelVi}`,
          );
        }
      }

      if (prop.setsFlag) {
        this.state.flags[prop.setsFlag] = true;
        this.syncQuestsAndNotify();
        this.persistState();
      }
      if (prop.dialogueId) {
        if (
          prop.id === 'sanctuary_celestial_altar' &&
          !this.state.flags.sanctuary_harmony_restored
        ) {
          this.pushToast(
            'Speak with Elder Keeper Astraea before approaching the Celestial Altar.',
            'Hãy vượt qua bài khảo nghiệm của Trưởng lão Astraea trước khi kích hoạt Bệ Tinh Tú.',
          );
          this.emitChange();
          return;
        }
        this.openDialogueById(prop.dialogueId);
      }
      this.emitChange();
    }
  }

  private activateDialogueLine(node: DialogueNode, lineIndex: number): void {
    const line = node.lines[lineIndex];
    if (!line) {
      this.activeDialogue = null;
      return;
    }
    const resolved = resolveDialogueLineForLevel(line, this.state.settings.cefrBand);
    const echo = line.includeReencounterEcho
      ? buildContextualReencounterEcho(this.state, this.state.regionId, LEXICON_INDEX)
      : null;

    this.activeDialogue = {
      node,
      lineIndex,
      resolvedEn: resolved.en,
      resolvedVi: resolved.vi,
      echoEn: echo?.en,
      echoVi: echo?.vi,
      revealViOverride: false,
      speechNoteVi: '',
    };

    recordSentenceExposure(this.state, resolved.en, node.contextTag, LEXICON_INDEX);
    if (echo) {
      recordSentenceExposure(this.state, echo.en, `${node.contextTag}_echo`, LEXICON_INDEX);
    }
    if (line.action) {
      this.executeDialogueAction(line.action);
    }
  }

  public openDialogueById(dialogueId: string): void {
    const node = DIALOGUES_BY_ID[dialogueId];
    if (!node) return;
    if (
      (dialogueId.startsWith('lore_') ||
        dialogueId.startsWith('logbook_') ||
        dialogueId.startsWith('journal_tale_') ||
        dialogueId.startsWith('field_story_') ||
        node.contextTag === 'ranger_dispatch') &&
      !this.state.readLoreIds.includes(dialogueId)
    ) {
      this.state.readLoreIds.push(dialogueId);
    }
    this.activateDialogueLine(node, 0);
  }

  public advanceDialogue(): void {
    if (!this.activeDialogue) return;
    const { node, lineIndex } = this.activeDialogue;
    const currentLine = node.lines[lineIndex];
    if (!currentLine) {
      this.activeDialogue = null;
      this.emitChange();
      return;
    }
    if (currentLine.choices && currentLine.choices.length > 0) {
      return;
    }
    const nextIdx = lineIndex + 1;
    if (nextIdx < node.lines.length) {
      this.activateDialogueLine(node, nextIdx);
    } else {
      const finishedNodeId = node.id;
      this.activeDialogue = null;
      this.pendingBossWarning = null;
      if (finishedNodeId === 'finale_credits_summary' && !this.state.flags.seen_ending_banner) {
        this.state.flags.seen_ending_banner = true;
        this.activeModal = 'ending_banner';
      }
      this.refreshGuidanceAndNavigation();
      this.persistState();
    }
    this.emitChange();
  }

  public selectDialogueChoice(choice: DialogueChoice): void {
    this.sound.playSfx('select');
    const prevDialogue = this.activeDialogue;
    this.activeDialogue = null;
    this.pendingBossWarning = null;
    if (choice.action) {
      this.executeDialogueAction(choice.action);
    }
    if (choice.nextDialogueId && this.activeBattle === null && this.activeModal === 'none') {
      this.openDialogueById(choice.nextDialogueId);
    } else if (prevDialogue && !choice.action) {
      this.persistState();
    }
    this.refreshGuidanceAndNavigation();
    this.emitChange();
  }

  public toggleDialogueVietnameseAssist(): void {
    if (!this.activeDialogue) return;
    this.activeDialogue.revealViOverride = !this.activeDialogue.revealViOverride;
    this.emitChange();
  }

  public speakActiveDialogueSentence(): void {
    if (!this.activeDialogue) return;
    const fullText = this.activeDialogue.echoEn
      ? `${this.activeDialogue.resolvedEn} ${this.activeDialogue.echoEn}`
      : this.activeDialogue.resolvedEn;
    const res = this.sound.speakEnglishSentence(fullText);
    this.activeDialogue.speechNoteVi = res.fallbackMessageVi;
    this.emitChange();
  }

  public openEndingBanner(): void {
    this.activeModal = 'ending_banner';
    this.emitChange();
  }

  public startWildEncounter(
    speciesId: string,
    level: number,
    isRareVariant: boolean = false,
  ): void {
    const spec = SPECIES_BY_ID[speciesId];
    if (!spec || this.state.party.length === 0) return;
    markSpeciesDiscovered(this.state, spec.id);
    const wildEnemy = createCreatureInstance({
      uid: `foe_${spec.id}_${this.state.stepCount}`,
      species: spec,
      level,
      bondedRegion: this.state.regionId,
      movesById: MOVES_BY_ID,
      isRareVariant,
    });
    this.activeTrainerNpc = null;
    this.activeBattleIsRematch = false;
    const gleamPrefixEn = isRareVariant ? 'Gleaming ' : '';
    const gleamSuffixVi = isRareVariant ? ' Ánh Sao' : '';
    this.activeBattle = createBattleSession({
      kind: 'wild',
      isBoss: false,
      opponentTitleEn: `Wild ${gleamPrefixEn}${spec.name}`,
      opponentTitleVi: `${spec.name}${gleamSuffixVi} hoang dã`,
      rewardTokens: Math.max(12, level * (isRareVariant ? 5 : 3)),
      playerParty: this.state.party,
      enemyParty: [wildEnemy],
    });
    this.battleLogs = [
      {
        kind: 'text',
        messageEn: isRareVariant
          ? `A rare gleaming ${spec.name} (${spec.titleEn}) sparkled into view!`
          : `A wild ${spec.name} (${spec.titleEn}) stepped out from the brush!`,
        messageVi: isRareVariant
          ? `Một ${spec.name} biến thể Ánh Sao quý hiếm lấp lánh xuất hiện!`
          : `Một ${spec.name} (${spec.titleVi}) xuất hiện từ bụi cỏ!`,
      },
    ];
    recordSentenceExposure(
      this.state,
      this.battleLogs[0]!.messageEn,
      'battle_intro',
      LEXICON_INDEX,
    );
    this.lastBattleAnim = 'none';
    this.lastBattleVisual = null;
    this.sound.playTrack('wild_battle');
    this.syncQuestsAndNotify();
  }

  public startTrainerEncounter(npcId: string, isRematch: boolean = false): void {
    const npc = NPCS_BY_ID[npcId];
    const battleSpec = isRematch && npc?.rematchBattle ? npc.rematchBattle : npc?.trainerBattle;
    if (!npc || !battleSpec || this.state.party.length === 0) return;
    if (this.state.party.every((c) => c.currentHp <= 0)) {
      healPartyInState(this.state, MOVES_BY_ID);
    }
    const specList = battleSpec.party;
    const enemyParty = specList.map((entry, idx) => {
      const sp = SPECIES_BY_ID[entry.speciesId]!;
      markSpeciesDiscovered(this.state, sp.id);
      return createCreatureInstance({
        uid: `trainer_${npc.id}_${isRematch ? 'rematch_' : ''}${idx}`,
        species: sp,
        level: entry.level,
        bondedRegion: npc.regionId,
        movesById: MOVES_BY_ID,
      });
    });

    this.activeTrainerNpc = npc;
    this.activeBattleIsRematch = Boolean(isRematch && npc.rematchBattle);
    this.activeBattle = createBattleSession({
      kind: 'trainer',
      isBoss: battleSpec.isBoss,
      opponentTitleEn: battleSpec.titleEn,
      opponentTitleVi: battleSpec.titleVi,
      rewardTokens: battleSpec.rewardTokens,
      playerParty: this.state.party,
      enemyParty,
    });
    const firstEnemySpec = SPECIES_BY_ID[enemyParty[0]!.speciesId]!;
    this.battleLogs = [
      {
        kind: 'text',
        messageEn: `${battleSpec.titleEn} sent out ${firstEnemySpec.name}!`,
        messageVi: `${battleSpec.titleVi} đưa ${firstEnemySpec.name} ra sân!`,
      },
    ];
    this.lastBattleAnim = 'none';
    this.lastBattleVisual = null;
    this.sound.playTrack(battleSpec.isBoss ? 'boss_battle' : 'wild_battle');
    this.syncQuestsAndNotify();
  }

  public submitBattleAction(action: PlayerBattleAction): void {
    if (!this.activeBattle || this.activeBattle.outcome !== 'ongoing') return;

    let usedCharm = false;
    if (action.kind === 'item') {
      const def = ITEMS_BY_ID[action.itemId];
      if (def?.category === 'charm') {
        usedCharm = true;
        this.sound.playSfx('chime');
        this.lastBattleAnim = 'capture';
      } else {
        this.sound.playSfx('heal');
        this.lastBattleAnim = 'heal';
      }
    } else if (action.kind === 'move') {
      this.state.flags.onboarding_fought_once = true;
      this.lastBattleAnim = 'player_attack';
    } else {
      this.sound.playSfx('select');
      this.lastBattleAnim = 'none';
    }

    const activeEnemy = this.activeBattle.enemyParty[this.activeBattle.activeEnemyIndex];
    const guaranteedCapture =
      usedCharm &&
      this.activeBattle.kind === 'wild' &&
      Boolean(activeEnemy) &&
      shouldGuaranteeFirstTutorialCapture({
        state: this.state,
        enemyHpRatio: activeEnemy!.currentHp / Math.max(1, activeEnemy!.maxHp),
        turnCount: this.activeBattle.turnCount,
      });

    const turnLogs = stepBattleTurn(this.activeBattle, action, {
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
      itemsById: ITEMS_BY_ID,
      inventory: this.state.inventory,
      rng: this.rng,
      difficulty: this.state.settings.difficulty,
      guaranteedCapture,
    });

    if (guaranteedCapture && turnLogs.some((l) => l.kind === 'capture' && l.captured)) {
      ensureOnboardingState(this.state).firstCaptureGuaranteedUsed = true;
    }

    for (const log of turnLogs) {
      recordSentenceExposure(this.state, log.messageEn, 'battle_log', LEXICON_INDEX);
      if (log.kind === 'damage') {
        if (log.isSuperEffective || log.messageEn.includes('natural weakness')) {
          this.sound.playSfx('super_hit');
        } else {
          this.sound.playSfx('hit');
        }
      }
    }

    const cueId = this.nextVisualCueId++;
    if (usedCharm) {
      const capLog = [...turnLogs].reverse().find((l) => l.kind === 'capture' && l.shakes !== undefined);
      if (capLog) {
        this.lastBattleVisual = {
          id: cueId,
          kind: capLog.captured ? 'capture_success' : 'capture_break',
          shakes: capLog.shakes,
        };
      }
    } else if (action.kind === 'move') {
      const pDmg = turnLogs.find((l) => l.kind === 'damage' && l.actor === 'player');
      const pMove = turnLogs.find((l) => l.kind === 'move' && l.actor === 'player');
      if (pDmg || pMove) {
        this.lastBattleVisual = {
          id: cueId,
          kind: 'player_attack',
          element: pDmg?.element ?? pMove?.element,
          damage: pDmg?.damage,
          isSuperEffective: pDmg?.isSuperEffective,
        };
      } else {
        const eDmg = turnLogs.find((l) => l.kind === 'damage' && l.actor === 'enemy');
        if (eDmg) {
          this.lastBattleVisual = {
            id: cueId,
            kind: 'enemy_attack',
            element: eDmg.element,
            damage: eDmg.damage,
            isSuperEffective: eDmg.isSuperEffective,
          };
        }
      }
    } else if (action.kind === 'item') {
      this.lastBattleVisual = { id: cueId, kind: 'heal' };
    } else {
      const eDmg = turnLogs.find((l) => l.kind === 'damage' && l.actor === 'enemy');
      if (eDmg) {
        this.lastBattleVisual = {
          id: cueId,
          kind: 'enemy_attack',
          element: eDmg.element,
          damage: eDmg.damage,
          isSuperEffective: eDmg.isSuperEffective,
        };
      }
    }

    this.battleLogs = turnLogs.length > 0 ? turnLogs : this.battleLogs;

    if (this.activeBattle.outcome !== 'ongoing') {
      this.concludeBattleSession();
    }
    this.emitChange();
  }

  public finishAndCloseBattle(): void {
    if (!this.activeBattle || this.activeBattle.outcome === 'ongoing') return;
    const outcome = this.activeBattle.outcome;
    const defeatedTrainer = this.activeTrainerNpc;
    const wasRematch = this.activeBattleIsRematch;
    const wasAltarSolacern =
      Boolean(this.state.flags.main_story_completed) &&
      Boolean(this.state.flags.met_altar_solacern) &&
      !this.state.flags.seen_ending_banner &&
      defeatedTrainer === null;

    this.activeBattle = null;
    this.activeTrainerNpc = null;
    this.activeBattleIsRematch = false;
    this.lastBattleAnim = 'none';
    this.lastBattleVisual = null;
    this.syncRegionMusic();

    if (outcome === 'player_victory' && defeatedTrainer) {
      const spec =
        wasRematch && defeatedTrainer.rematchBattle
          ? defeatedTrainer.rematchBattle
          : defeatedTrainer.trainerBattle;
      if (spec) {
        this.openDialogueById(spec.defeatDialogueId);
      }
    } else if (wasAltarSolacern) {
      this.state.flags.seen_ending_banner = true;
      this.activeModal = 'ending_banner';
    }
    this.refreshGuidanceAndNavigation();
    this.persistState();
    this.emitChange();
  }

  public dismissEvolutionBanner(): void {
    this.activeEvolution = null;
    this.emitChange();
  }

  public dismissMoveLearnBanner(): void {
    this.activeMoveLearnBanner = null;
    this.emitChange();
  }

  private concludeBattleSession(): void {
    if (!this.activeBattle) return;
    const session = this.activeBattle;
    const diffProfile = getDifficultyProfile(this.state.settings.difficulty);

    for (const expRes of session.expResults) {
      if (expRes.learnedMoveIds.length > 0) {
        const activeIdx = session.activePlayerIndex;
        const activePartner = session.playerParty[activeIdx];
        if (activePartner) {
          const lastLearned = expRes.learnedMoveIds[expRes.learnedMoveIds.length - 1]!;
          const repRec = expRes.replacedMoves?.find((r) => r.learnedMoveId === lastLearned);
          this.activeMoveLearnBanner = {
            partyIndex: activeIdx,
            speciesId: activePartner.speciesId,
            moveId: lastLearned,
            replacedMoveId: repRec?.replacedMoveId,
            triggeredAtStep: this.state.stepCount,
          };
        }
      }
      if (expRes.evolvedToSpeciesId) {
        this.state.caughtSpecies.includes(expRes.evolvedToSpeciesId) ||
          this.state.caughtSpecies.push(expRes.evolvedToSpeciesId);
        markSpeciesDiscovered(this.state, expRes.evolvedToSpeciesId);
        const preEvo = SPECIES.find((s) => s.evolvesTo?.speciesId === expRes.evolvedToSpeciesId);
        if (preEvo) {
          this.activeEvolution = {
            fromSpeciesId: preEvo.id,
            toSpeciesId: expRes.evolvedToSpeciesId,
            newLevel: expRes.newLevel,
            triggeredAtStep: this.state.stepCount,
          };
          this.sound.playSfx('caught');
        }
      }
    }

    const applyRelaxedPostBattleCare = () => {
      if (diffProfile.postBattleHealRatio <= 0) return;
      for (const member of this.state.party) {
        if (member.currentHp > 0 && member.currentHp < member.maxHp) {
          member.currentHp = Math.min(
            member.maxHp,
            member.currentHp + Math.max(4, Math.round(member.maxHp * diffProfile.postBattleHealRatio)),
          );
        }
      }
    };

    if (session.outcome === 'captured' && session.capturedCreature) {
      this.sound.playSfx('caught');
      applyRelaxedPostBattleCare();
      const destination = registerCapturedWildkin(
        this.state,
        session.capturedCreature,
        this.state.regionId,
      );
      if (
        session.capturedCreature.isRareVariant &&
        !this.state.gleamingSpecies.includes(session.capturedCreature.speciesId)
      ) {
        this.state.gleamingSpecies.push(session.capturedCreature.speciesId);
      }
      const sp = SPECIES_BY_ID[session.capturedCreature.speciesId];
      this.state.tokens += Math.max(10, Math.round(session.rewardTokens * 0.7));
      this.battleLogs.push({
        kind: 'capture',
        messageEn:
          destination === 'party'
            ? `${sp?.name ?? 'Partner'} joined your active team!`
            : `${sp?.name ?? 'Partner'} was sent safely to your Sanctuary reserve!`,
        messageVi:
          destination === 'party'
            ? `${sp?.name ?? 'Bạn mới'} đã gia nhập đội hình chính!`
            : `${sp?.name ?? 'Bạn mới'} đã chuyển về Khu bảo tồn dự bị!`,
      });
      this.syncQuestsAndNotify();
      this.refreshGuidanceAndNavigation();
      this.persistState();
      return;
    }

    if (session.outcome === 'player_victory') {
      this.state.stats.battlesWon += 1;
      this.state.tokens += session.rewardTokens;
      applyRelaxedPostBattleCare();
      const activeSpec =
        this.activeBattleIsRematch && this.activeTrainerNpc?.rematchBattle
          ? this.activeTrainerNpc.rematchBattle
          : this.activeTrainerNpc?.trainerBattle;
      if (activeSpec) {
        if (this.activeBattleIsRematch) {
          if (!this.state.rematchCleared.includes(activeSpec.id)) {
            this.state.rematchCleared.push(activeSpec.id);
          }
        } else if (!this.state.defeatedTrainers.includes(activeSpec.id)) {
          this.state.defeatedTrainers.push(activeSpec.id);
        }
        const firstClear = !this.state.flags[activeSpec.setsFlag];
        this.state.flags[activeSpec.setsFlag] = true;
        if (activeSpec.rewardItemId && (firstClear || this.activeBattleIsRematch)) {
          const qty = this.activeBattleIsRematch && !firstClear ? 1 : (activeSpec.rewardQuantity ?? 1);
          addItemToState(this.state, activeSpec.rewardItemId, qty);
          const itemDef = ITEMS_BY_ID[activeSpec.rewardItemId];
          if (itemDef) {
            this.battleLogs.push({
              kind: 'victory',
              messageEn: `Received ${qty}x ${itemDef.nameEn} and ${activeSpec.rewardTokens} Field Tokens!`,
              messageVi: `Nhận được ${qty} ${itemDef.nameVi} và ${activeSpec.rewardTokens} Huy hiệu thực địa!`,
            });
          }
        }
        this.sound.playSfx('quest');
      } else {
        this.battleLogs.push({
          kind: 'victory',
          messageEn: `Earned ${session.rewardTokens} Field Tokens.`,
          messageVi: `Nhận được ${session.rewardTokens} Huy hiệu thực địa.`,
        });
      }
      this.syncQuestsAndNotify();
      this.persistState();
      return;
    }

    if (session.outcome === 'fled') {
      this.state.stats.fledCount += 1;
      this.persistState();
      return;
    }

    if (session.outcome === 'player_defeat') {
      healPartyInState(this.state, MOVES_BY_ID);
      const currentMap = MAPS_BY_ID[this.state.regionId];
      const localCampfire = currentMap.props.find((p) => p.kind === 'campfire');
      if (localCampfire) {
        const npcsHere = NPCS.filter((n) => n.regionId === this.state.regionId);
        const safeAdjacent = (
          [
            { x: localCampfire.x, y: localCampfire.y + 1 },
            { x: localCampfire.x - 1, y: localCampfire.y },
            { x: localCampfire.x + 1, y: localCampfire.y },
            { x: localCampfire.x, y: localCampfire.y - 1 },
          ] as const
        ).find((pt) =>
          isTileWalkable({
            map: currentMap,
            npcsInRegion: npcsHere,
            state: this.state,
            x: pt.x,
            y: pt.y,
          }),
        );
        if (safeAdjacent) {
          this.state.playerPos = { x: safeAdjacent.x, y: safeAdjacent.y, facing: 'up' };
          this.followerPos = this.computeDefaultFollowerPos();
        }
      } else {
        const hub = MAPS_BY_ID.mosslight_hub;
        this.state.regionId = 'mosslight_hub';
        this.state.playerPos = { x: hub.spawnX, y: hub.spawnY, facing: 'up' };
        this.followerPos = { x: hub.spawnX, y: hub.spawnY + 1, facing: 'up' };
      }
      this.pushToast(
        'Party fully healed at the nearest campfire with zero penalty!',
        'Đội hình đã hồi đầy máu tại lửa trại gần nhất và không bị phạt!',
      );
      this.refreshGuidanceAndNavigation();
      this.persistState();
    }
  }

  public inspectGlossWord(entry: LexiconEntry, contextTag: string, sentenceEn: string = ''): void {
    this.sound.playSfx('gloss');
    recordWordLookup(this.state, entry.id, contextTag);
    this.activePocketGloss = null;
    this.activeGlossEntry = entry;
    this.activeGlossContextTag = contextTag;
    this.activeGlossSentenceEn = sentenceEn;
    this.activeGlossNoteVi = '';
    this.refreshGuidanceAndNavigation();
    this.emitChange();
  }

  public inspectPocketWord(
    surface: string,
    note: PocketWordNote,
    sentenceEn: string = '',
  ): void {
    this.sound.playSfx('gloss');
    this.state.stats.wordsGlossed += 1;
    this.activeGlossEntry = null;
    this.activePocketGloss = { surface, note, sentenceEn };
    this.activeGlossNoteVi = '';
    this.refreshGuidanceAndNavigation();
    this.emitChange();
  }

  public closeGlossPopup(): void {
    this.activeGlossEntry = null;
    this.activePocketGloss = null;
    this.activeGlossContextTag = '';
    this.activeGlossSentenceEn = '';
    this.activeGlossNoteVi = '';
    this.emitChange();
  }

  public pronounceActiveGloss(): void {
    if (this.activeGlossEntry) {
      const res = this.sound.speakEnglishWord(
        this.activeGlossEntry.word,
        this.activeGlossEntry.phonetic,
      );
      this.activeGlossNoteVi = res.fallbackMessageVi;
      this.emitChange();
      return;
    }
    if (this.activePocketGloss) {
      const res = this.sound.speakEnglishWord(this.activePocketGloss.surface, '');
      this.activeGlossNoteVi = res.fallbackMessageVi;
      this.emitChange();
    }
  }

  public syncNewerTabSave(): void {
    const res = this.saveRepo.syncFromNewerStorage();
    if (res.state) {
      this.state = res.state;
      this.rng.setSeedState(this.state.seedState);
      this.followerPos = this.computeDefaultFollowerPos();
      this.pushToast(
        'Synced latest progress from newer tab.',
        'Đã đồng bộ tiến trình mới nhất từ tab khác.',
      );
      this.emitChange();
    }
  }

  public toggleSaveActiveGloss(): void {
    if (!this.activeGlossEntry) return;
    toggleWordSaved(this.state, this.activeGlossEntry.id);
    this.persistState();
    this.emitChange();
  }

  public toggleSavedWordById(wordId: string): void {
    toggleWordSaved(this.state, wordId);
    this.persistState();
    this.emitChange();
  }

  public openJournal(tab: JournalTab = 'quests'): void {
    if (this.activeModal === 'title' || this.activeBattle !== null) return;
    this.sound.playSfx('select');
    this.state.flags.onboarding_opened_journal = true;
    this.journalTab = tab;
    this.activeModal = 'journal';
    this.refreshGuidanceAndNavigation();
    this.emitChange();
  }

  public openLostHelper(): void {
    if (this.activeModal === 'title' || this.activeBattle !== null) return;
    this.sound.playSfx('select');
    this.refreshGuidanceAndNavigation();
    this.activeModal = 'lost_helper';
    this.emitChange();
  }

  public getLostHelperReport(): LostHelperReport {
    return buildLostHelperReport({
      state: this.state,
      navPlan: this.navigationPlan,
      mapsById: MAPS_BY_ID,
    });
  }

  public setTrackedQuest(questId: string | null): void {
    this.state.trackedQuestId = questId;
    if (questId && this.state.settings.guidanceMode === 'off') {
      this.state.settings.guidanceMode = 'full';
    }
    this.refreshGuidanceAndNavigation();
    this.persistState();
    this.emitChange();
  }

  public skipOnboardingGuide(): void {
    skipOnboarding(this.state);
    this.refreshGuidanceAndNavigation();
    this.persistState();
    this.emitChange();
  }

  public skipOnboardingStep(): void {
    skipCurrentOnboardingStep(this.state);
    this.refreshGuidanceAndNavigation();
    this.persistState();
    this.emitChange();
  }

  public restartOnboardingGuide(): void {
    restartOnboarding(this.state);
    this.refreshGuidanceAndNavigation();
    this.persistState();
    this.emitChange();
  }

  public swapCreatureMove(partyIndex: number, slotIndex: number, newMoveId: string): boolean {
    const member = this.state.party[partyIndex];
    if (!member) return false;
    const ok = replaceCreatureMoveSlot({
      creature: member,
      slotIndex,
      newMoveId,
      movesById: MOVES_BY_ID,
    });
    if (ok) {
      this.sound.playSfx('select');
      this.persistState();
      this.emitChange();
    }
    return ok;
  }

  public closeModal(): void {
    if (this.activeModal === 'title') return;
    this.activeModal = 'none';
    this.emitChange();
  }

  public openCampfireReview(): void {
    this.campPrompts = buildCampfireReviewSet(this.state, LEXICON_INDEX, 4);
    this.campPromptIndex = 0;
    this.activeModal = 'camp_review';
    this.emitChange();
  }

  public answerCampfirePrompt(chosenWordId: string): {
    readonly matched: boolean;
    readonly target: LexiconEntry | null;
  } {
    const prompt = this.campPrompts[this.campPromptIndex];
    if (!prompt) return { matched: false, target: null };
    const matched = chosenWordId === prompt.entry.id;
    recordCampfireRecall(this.state, prompt.entry.id, matched);
    this.sound.playSfx(matched ? 'heal' : 'select');
    this.persistState();
    this.emitChange();
    return { matched, target: prompt.entry };
  }

  public nextCampfirePrompt(): void {
    if (this.campPromptIndex + 1 < this.campPrompts.length) {
      this.campPromptIndex += 1;
    } else {
      this.activeModal = 'none';
      this.pushToast(
        'Warm review session complete! Enjoy the trail.',
        'Hoàn tất buổi ôn từ nhẹ nhàng bên lửa trại!',
      );
    }
    this.emitChange();
  }

  public makePartyLead(partyIndex: number): void {
    if (swapPartySlots(this.state, 0, partyIndex)) {
      this.sound.playSfx('select');
      this.persistState();
      this.emitChange();
    }
  }

  public swapPartyAndReserve(partyIndex: number, sanctuaryIndex: number): void {
    if (swapPartyWithSanctuary(this.state, partyIndex, sanctuaryIndex)) {
      this.sound.playSfx('select');
      this.persistState();
      this.emitChange();
    }
  }

  public useBagItemInField(itemId: string, targetPartyIndex: number = 0): void {
    const def = ITEMS_BY_ID[itemId];
    if (!def) return;
    const res = useFieldItem({
      state: this.state,
      item: def,
      targetPartyIndex,
    });
    if (res.ok) {
      this.sound.playSfx('heal');
      this.persistState();
    }
    this.pushToast(res.messageEn, res.messageVi);
    this.emitChange();
  }

  public purchaseItem(itemId: string, quantity: number = 1): void {
    const def = ITEMS_BY_ID[itemId];
    if (!def) return;
    const res = buySupplyItem({ state: this.state, item: def, quantity });
    if (res.ok) {
      this.sound.playSfx('quest');
      this.persistState();
    }
    this.pushToast(res.messageEn, res.messageVi);
    this.emitChange();
  }

  public updateSettings(patch: Partial<GameSettings>): void {
    const nextSettings: GameSettings = {
      ...this.state.settings,
      ...patch,
      keyMap: patch.keyMap
        ? { ...this.state.settings.keyMap, ...patch.keyMap }
        : this.state.settings.keyMap,
    };
    if (patch.contentLanguage && !patch.supportMode) {
      nextSettings.supportMode = syncSupportModeFromContent(patch.contentLanguage);
    } else if (patch.supportMode && !patch.contentLanguage) {
      nextSettings.contentLanguage = inferContentLanguageFromSupport(patch.supportMode);
    }
    if (patch.difficulty && patch.battleAssist === undefined && this.activeModal === 'title') {
      nextSettings.battleAssist = getDifficultyProfile(patch.difficulty).defaultBattleAssist;
    }
    this.state.settings = nextSettings;
    if (patch.cefrBand && this.activeDialogue) {
      const currentLine = this.activeDialogue.node.lines[this.activeDialogue.lineIndex];
      if (currentLine) {
        const resolved = resolveDialogueLineForLevel(currentLine, this.state.settings.cefrBand);
        this.activeDialogue.resolvedEn = resolved.en;
        this.activeDialogue.resolvedVi = resolved.vi;
      }
    }
    this.sound.configure({
      bgmVolume: this.state.settings.bgmVolume,
      sfxVolume: this.state.settings.sfxVolume,
      muted: this.state.settings.muted,
    });
    this.refreshGuidanceAndNavigation();
    this.persistState();
    this.emitChange();
  }

  public exportSaveFileContent(): string {
    this.state.seedState = this.rng.getSeedState();
    return this.saveRepo.exportJson(this.state);
  }

  public importSaveFileContent(rawJson: string): { readonly ok: boolean; readonly error?: string } {
    const res = this.saveRepo.importJson(rawJson);
    if (!res.ok || !res.state) {
      return { ok: false, error: res.error ?? 'Invalid save file' };
    }
    this.state = res.state;
    this.rng.setSeedState(this.state.seedState);
    this.activeBattle = null;
    this.activeDialogue = null;
    this.activeModal = 'none';
    this.followerPos = this.computeDefaultFollowerPos();
    this.refreshGuidanceAndNavigation();
    this.sound.configure({
      bgmVolume: this.state.settings.bgmVolume,
      sfxVolume: this.state.settings.sfxVolume,
      muted: this.state.settings.muted,
    });
    this.syncRegionMusic();
    this.pushToast('Save file imported successfully!', 'Đã nhập tệp lưu thành công!');
    this.emitChange();
    return { ok: true };
  }

  private executeDialogueAction(action: DialogueAction): void {
    switch (action.kind) {
      case 'choose_starter': {
        if (!this.state.starterChosen) {
          const sp = SPECIES_BY_ID[action.speciesId];
          if (sp) {
            chooseStarterPartner({
              state: this.state,
              species: sp,
              movesById: MOVES_BY_ID,
            });
            this.followerPos = this.computeDefaultFollowerPos();
            this.sound.playSfx('caught');
            this.syncQuestsAndNotify();
            this.refreshGuidanceAndNavigation();
            this.persistState();
          }
        }
        break;
      }
      case 'start_quest': {
        if (startQuest(this.state, action.questId)) {
          const q = QUESTS.find((x) => x.id === action.questId);
          if (q) {
            this.sound.playSfx('quest');
            this.pushToast(`Quest Started: ${q.titleEn}`, `Nhiệm vụ mới: ${q.titleVi}`);
          }
        }
        this.syncQuestsAndNotify();
        this.refreshGuidanceAndNavigation();
        this.persistState();
        break;
      }
      case 'complete_quest': {
        this.syncQuestsAndNotify();
        this.refreshGuidanceAndNavigation();
        this.persistState();
        break;
      }
      case 'set_flag': {
        const wasMainComplete = Boolean(this.state.flags.main_story_completed);
        this.state.flags[action.flag] = true;
        this.syncQuestsAndNotify();
        this.refreshGuidanceAndNavigation();
        if (action.flag === 'main_story_completed' && !wasMainComplete) {
          this.sound.playSfx('caught');
          this.pushToast(
            'Main Story Complete: Basin Harmony Restored!',
            'Hoàn thành cốt truyện chính: Thung Lũng Rêu Xanh đã hòa hợp!',
          );
        }
        this.persistState();
        break;
      }
      case 'heal_party': {
        healPartyInState(this.state, MOVES_BY_ID);
        this.state.flags.onboarding_healed_campfire = true;
        syncOnboardingProgress(this.state);
        this.sound.playSfx('heal');
        this.refreshGuidanceAndNavigation();
        this.persistState();
        break;
      }
      case 'open_camp_review': {
        this.activeDialogue = null;
        this.openCampfireReview();
        break;
      }
      case 'open_supply_post': {
        this.activeDialogue = null;
        this.activeModal = 'supply_post';
        break;
      }
      case 'give_item': {
        if (!this.state.flags[action.onceFlag]) {
          this.state.flags[action.onceFlag] = true;
          addItemToState(this.state, action.itemId, action.quantity);
          this.persistState();
        }
        break;
      }
      case 'start_trainer_battle': {
        this.startTrainerEncounter(action.npcId, Boolean(action.isRematch));
        break;
      }
      case 'trigger_wild_encounter': {
        if (!action.onceFlag || !this.state.flags[action.onceFlag]) {
          if (action.onceFlag) {
            this.state.flags[action.onceFlag] = true;
          }
          this.startWildEncounter(
            action.speciesId,
            action.level,
            Boolean(action.guaranteedRareVariant),
          );
        } else {
          this.pushToast(
            'Guardian Solacern gazes peacefully across the sanctuary.',
            'Linh lộc Solacern hiền hòa dõi mắt khắp thánh địa.',
          );
        }
        break;
      }
      case 'cycle_time_of_day': {
        this.state.timeOfDay = nextTimeOfDay(this.state.timeOfDay);
        this.persistState();
        break;
      }
    }
  }

  private syncQuestsAndNotify(): void {
    const events: QuestSyncNotification[] = syncQuestsWithState(
      this.state,
      QUESTS,
      SPECIES_BY_ID,
      (itemId, qty) => addItemToState(this.state, itemId, qty),
    );
    for (const ev of events) {
      if (ev.event === 'completed') {
        this.sound.playSfx('quest');
        this.pushToast(`Quest Completed: ${ev.titleEn}`, `Hoàn thành: ${ev.titleVi}`);
      } else {
        this.pushToast(`New Objective: ${ev.titleEn}`, `Mục tiêu mới: ${ev.titleVi}`);
      }
    }
  }

  public syncRegionMusic(): void {
    const map = MAPS_BY_ID[this.state.regionId];
    this.sound.playTrack(map.bgmTrack);
  }

  public pushToast(messageEn: string, messageVi: string): void {
    const id = this.nextToastId++;
    this.toasts.push({ id, messageEn, messageVi });
    if (this.toasts.length > 2) {
      this.toasts.shift();
    }
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
        this.emitChange();
      }, 3600);
    }
  }

  public getShopItems() {
    return ITEMS.filter((item) => item.price > 0);
  }

  public getAllSpecies() {
    return SPECIES;
  }
}

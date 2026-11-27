import { SoundEngine } from '../audio/soundEngine.ts';
import { DIALOGUES_BY_ID } from '../data/dialogues.ts';
import { ITEMS, ITEMS_BY_ID } from '../data/items.ts';
import { LEXICON_INDEX } from '../data/lexicon.ts';
import { MAPS_BY_ID } from '../data/maps.ts';
import { MOVES_BY_ID } from '../data/moves.ts';
import { NPCS, NPCS_BY_ID } from '../data/npcs.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES, SPECIES_BY_ID } from '../data/species.ts';
import {
  createBattleSession,
  stepBattleTurn,
  type BattleEventLog,
  type BattleSession,
  type PlayerBattleAction,
} from '../domain/battle.ts';
import { createCreatureInstance } from '../domain/creatures.ts';
import {
  buildCampfireReviewSet,
  recordCampfireRecall,
  recordSentenceExposure,
  recordWordLookup,
  toggleWordSaved,
  type CampfireReviewPrompt,
} from '../domain/learning.ts';
import { startQuest, syncQuestsWithState, type QuestSyncNotification } from '../domain/quests.ts';
import { SeededRng } from '../domain/rng.ts';
import { SaveRepository } from '../domain/save.ts';
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
  GameSettings,
  GameState,
  LexiconEntry,
  NpcDefinition,
} from '../domain/types.ts';
import {
  attemptPlayerStep,
  inspectFacingTile,
  nextTimeOfDay,
} from '../domain/world.ts';

export interface ActiveDialogueState {
  readonly node: DialogueNode;
  lineIndex: number;
  revealViOverride: boolean;
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
  | 'ending_banner';

export type JournalTab =
  | 'quests'
  | 'team'
  | 'bag'
  | 'compendium'
  | 'lexicon'
  | 'settings';

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
  public battleLogs: BattleEventLog[] = [];
  public lastBattleAnim: 'none' | 'player_attack' | 'enemy_attack' | 'capture' | 'heal' = 'none';
  public activeGlossEntry: LexiconEntry | null = null;
  public activeGlossNoteVi: string = '';
  public campPrompts: CampfireReviewPrompt[] = [];
  public campPromptIndex = 0;
  public toasts: ToastBanner[] = [];
  public statusNotice: string = '';

  private nextToastId = 1;
  private readonly listeners = new Set<() => void>();
  private playTimerId: number | null = null;

  public constructor(saveRepo?: SaveRepository) {
    this.saveRepo = saveRepo ?? new SaveRepository();
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
    this.sound.configure({
      bgmVolume: this.state.settings.bgmVolume,
      sfxVolume: this.state.settings.sfxVolume,
      muted: this.state.settings.muted,
    });
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

  public startNewGame(seed: number = Date.now() >>> 0): void {
    const prevSettings = structuredClone(this.state.settings);
    this.state = createInitialGameState(seed);
    this.state.settings = prevSettings;
    this.rng.setSeedState(this.state.seedState);
    this.activeBattle = null;
    this.activeTrainerNpc = null;
    this.activeDialogue = null;
    this.activeGlossEntry = null;
    this.activeModal = 'none';
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
      if (loaded.warning) {
        this.pushToast('Save Restored', loaded.warning);
      }
    }
    this.activeModal = 'none';
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
      this.emitChange();
      return;
    }

    this.sound.playSfx('step');

    if (step.kind === 'portal_blocked') {
      if (step.portal.blockedDialogueId) {
        this.openDialogueById(step.portal.blockedDialogueId);
      } else {
        this.pushToast(step.portal.labelEn, step.portal.labelVi);
      }
      this.emitChange();
      return;
    }

    if (step.kind === 'portal_entered') {
      const destMap = MAPS_BY_ID[this.state.regionId];
      this.pushToast(`Entered ${destMap.nameEn}`, `Đã tới ${destMap.nameVi}`);
      this.syncQuestsAndNotify();
      this.syncRegionMusic();
      this.persistState();
      this.emitChange();
      return;
    }

    if (step.kind === 'wild_encounter') {
      this.startWildEncounter(step.speciesId, step.level);
      this.emitChange();
      return;
    }

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
    const hit = inspectFacingTile({
      state: this.state,
      map,
      npcsInRegion,
    });

    if (hit.kind === 'npc') {
      this.sound.playSfx('select');
      this.openDialogueById(hit.dialogueId);
      this.emitChange();
      return;
    }

    if (hit.kind === 'prop') {
      const prop = hit.prop;
      this.sound.playSfx('select');
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

  public openDialogueById(dialogueId: string): void {
    const node = DIALOGUES_BY_ID[dialogueId];
    if (!node) return;
    this.activeDialogue = {
      node,
      lineIndex: 0,
      revealViOverride: false,
    };
    const firstLine = node.lines[0];
    if (firstLine) {
      recordSentenceExposure(this.state, firstLine.en, node.contextTag, LEXICON_INDEX);
      if (firstLine.action) {
        this.executeDialogueAction(firstLine.action);
      }
    }
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
      this.activeDialogue.lineIndex = nextIdx;
      this.activeDialogue.revealViOverride = false;
      const nextLine = node.lines[nextIdx]!;
      recordSentenceExposure(this.state, nextLine.en, node.contextTag, LEXICON_INDEX);
      if (nextLine.action) {
        this.executeDialogueAction(nextLine.action);
      }
    } else {
      this.activeDialogue = null;
      this.persistState();
    }
    this.emitChange();
  }

  public selectDialogueChoice(choice: DialogueChoice): void {
    this.sound.playSfx('select');
    const prevDialogue = this.activeDialogue;
    this.activeDialogue = null;
    if (choice.action) {
      this.executeDialogueAction(choice.action);
    }
    if (choice.nextDialogueId && this.activeBattle === null && this.activeModal === 'none') {
      this.openDialogueById(choice.nextDialogueId);
    } else if (prevDialogue && !choice.action) {
      this.persistState();
    }
    this.emitChange();
  }

  public toggleDialogueVietnameseAssist(): void {
    if (!this.activeDialogue) return;
    this.activeDialogue.revealViOverride = !this.activeDialogue.revealViOverride;
    this.emitChange();
  }

  public startWildEncounter(speciesId: string, level: number): void {
    const spec = SPECIES_BY_ID[speciesId];
    if (!spec || this.state.party.length === 0) return;
    markSpeciesDiscovered(this.state, spec.id);
    const wildEnemy = createCreatureInstance({
      uid: `foe_${spec.id}_${this.state.stepCount}`,
      species: spec,
      level,
      bondedRegion: this.state.regionId,
      movesById: MOVES_BY_ID,
    });
    this.activeTrainerNpc = null;
    this.activeBattle = createBattleSession({
      kind: 'wild',
      isBoss: false,
      opponentTitleEn: `Wild ${spec.name}`,
      opponentTitleVi: `${spec.name} hoang dã`,
      rewardTokens: Math.max(12, level * 3),
      playerParty: this.state.party,
      enemyParty: [wildEnemy],
    });
    this.battleLogs = [
      {
        kind: 'text',
        messageEn: `A wild ${spec.name} (${spec.titleEn}) stepped out from the brush!`,
        messageVi: `Một ${spec.name} (${spec.titleVi}) xuất hiện từ bụi cỏ!`,
      },
    ];
    recordSentenceExposure(
      this.state,
      this.battleLogs[0]!.messageEn,
      'battle_intro',
      LEXICON_INDEX,
    );
    this.lastBattleAnim = 'none';
    this.sound.playTrack('wild_battle');
    this.syncQuestsAndNotify();
  }

  public startTrainerEncounter(npcId: string): void {
    const npc = NPCS_BY_ID[npcId];
    if (!npc?.trainerBattle || this.state.party.length === 0) return;
    if (this.state.party.every((c) => c.currentHp <= 0)) {
      healPartyInState(this.state, MOVES_BY_ID);
    }
    const specList = npc.trainerBattle.party;
    const enemyParty = specList.map((entry, idx) => {
      const sp = SPECIES_BY_ID[entry.speciesId]!;
      markSpeciesDiscovered(this.state, sp.id);
      return createCreatureInstance({
        uid: `trainer_${npc.id}_${idx}`,
        species: sp,
        level: entry.level,
        bondedRegion: npc.regionId,
        movesById: MOVES_BY_ID,
      });
    });

    this.activeTrainerNpc = npc;
    this.activeBattle = createBattleSession({
      kind: 'trainer',
      isBoss: npc.trainerBattle.isBoss,
      opponentTitleEn: npc.trainerBattle.titleEn,
      opponentTitleVi: npc.trainerBattle.titleVi,
      rewardTokens: npc.trainerBattle.rewardTokens,
      playerParty: this.state.party,
      enemyParty,
    });
    const firstEnemySpec = SPECIES_BY_ID[enemyParty[0]!.speciesId]!;
    this.battleLogs = [
      {
        kind: 'text',
        messageEn: `${npc.trainerBattle.titleEn} sent out ${firstEnemySpec.name}!`,
        messageVi: `${npc.trainerBattle.titleVi} đưa ${firstEnemySpec.name} ra sân!`,
      },
    ];
    this.lastBattleAnim = 'none';
    this.sound.playTrack(npc.trainerBattle.isBoss ? 'boss_battle' : 'wild_battle');
    this.syncQuestsAndNotify();
  }

  public submitBattleAction(action: PlayerBattleAction): void {
    if (!this.activeBattle || this.activeBattle.outcome !== 'ongoing') return;

    if (action.kind === 'item') {
      const def = ITEMS_BY_ID[action.itemId];
      if (def?.category === 'charm') {
        this.sound.playSfx('chime');
        this.lastBattleAnim = 'capture';
      } else {
        this.sound.playSfx('heal');
        this.lastBattleAnim = 'heal';
      }
    } else if (action.kind === 'move') {
      this.lastBattleAnim = 'player_attack';
    } else {
      this.sound.playSfx('select');
      this.lastBattleAnim = 'none';
    }

    const turnLogs = stepBattleTurn(this.activeBattle, action, {
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
      itemsById: ITEMS_BY_ID,
      inventory: this.state.inventory,
      rng: this.rng,
    });

    for (const log of turnLogs) {
      recordSentenceExposure(this.state, log.messageEn, 'battle_log', LEXICON_INDEX);
      if (log.kind === 'damage') {
        if (log.messageEn.includes('natural weakness')) {
          this.sound.playSfx('super_hit');
        } else {
          this.sound.playSfx('hit');
        }
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
    this.activeBattle = null;
    this.activeTrainerNpc = null;
    this.lastBattleAnim = 'none';
    this.syncRegionMusic();

    if (outcome === 'player_victory' && defeatedTrainer?.trainerBattle) {
      this.openDialogueById(defeatedTrainer.trainerBattle.defeatDialogueId);
    }
    this.persistState();
    this.emitChange();
  }

  private concludeBattleSession(): void {
    if (!this.activeBattle) return;
    const session = this.activeBattle;

    for (const expRes of session.expResults) {
      if (expRes.evolvedToSpeciesId) {
        this.state.caughtSpecies.includes(expRes.evolvedToSpeciesId) ||
          this.state.caughtSpecies.push(expRes.evolvedToSpeciesId);
        markSpeciesDiscovered(this.state, expRes.evolvedToSpeciesId);
      }
    }

    if (session.outcome === 'captured' && session.capturedCreature) {
      this.sound.playSfx('caught');
      const destination = registerCapturedWildkin(
        this.state,
        session.capturedCreature,
        this.state.regionId,
      );
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
      this.persistState();
      return;
    }

    if (session.outcome === 'player_victory') {
      this.state.stats.battlesWon += 1;
      this.state.tokens += session.rewardTokens;
      if (this.activeTrainerNpc?.trainerBattle) {
        const tb = this.activeTrainerNpc.trainerBattle;
        if (!this.state.defeatedTrainers.includes(tb.id)) {
          this.state.defeatedTrainers.push(tb.id);
        }
        this.state.flags[tb.setsFlag] = true;
        if (tb.rewardItemId) {
          addItemToState(this.state, tb.rewardItemId, tb.rewardQuantity ?? 1);
          const itemDef = ITEMS_BY_ID[tb.rewardItemId];
          if (itemDef) {
            this.battleLogs.push({
              kind: 'victory',
              messageEn: `Received ${tb.rewardQuantity ?? 1}x ${itemDef.nameEn} and ${tb.rewardTokens} Field Tokens!`,
              messageVi: `Nhận được ${tb.rewardQuantity ?? 1} ${itemDef.nameVi} và ${tb.rewardTokens} Huy hiệu thực địa!`,
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
      this.state.regionId = 'mosslight_hub';
      this.state.playerPos = { x: 11, y: 8, facing: 'up' };
      this.persistState();
    }
  }

  public inspectGlossWord(entry: LexiconEntry, contextTag: string): void {
    this.sound.playSfx('gloss');
    recordWordLookup(this.state, entry.id, contextTag);
    this.activeGlossEntry = entry;
    this.activeGlossNoteVi = '';
    this.emitChange();
  }

  public closeGlossPopup(): void {
    this.activeGlossEntry = null;
    this.activeGlossNoteVi = '';
    this.emitChange();
  }

  public pronounceActiveGloss(): void {
    if (!this.activeGlossEntry) return;
    const res = this.sound.speakEnglishWord(
      this.activeGlossEntry.word,
      this.activeGlossEntry.phonetic,
    );
    this.activeGlossNoteVi = res.fallbackMessageVi;
    this.emitChange();
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
    this.journalTab = tab;
    this.activeModal = 'journal';
    this.emitChange();
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
    this.state.settings = {
      ...this.state.settings,
      ...patch,
      keyMap: patch.keyMap
        ? { ...this.state.settings.keyMap, ...patch.keyMap }
        : this.state.settings.keyMap,
    };
    this.sound.configure({
      bgmVolume: this.state.settings.bgmVolume,
      sfxVolume: this.state.settings.sfxVolume,
      muted: this.state.settings.muted,
    });
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
            this.sound.playSfx('caught');
            this.syncQuestsAndNotify();
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
        this.persistState();
        break;
      }
      case 'complete_quest': {
        this.syncQuestsAndNotify();
        this.persistState();
        break;
      }
      case 'set_flag': {
        const wasMainComplete = Boolean(this.state.flags.main_story_completed);
        this.state.flags[action.flag] = true;
        this.syncQuestsAndNotify();
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
        this.sound.playSfx('heal');
        this.persistState();
        break;
      }
      case 'open_camp_review': {
        this.openCampfireReview();
        break;
      }
      case 'open_supply_post': {
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
        this.startTrainerEncounter(action.npcId);
        break;
      }
      case 'trigger_wild_encounter': {
        if (!action.onceFlag || !this.state.flags[action.onceFlag]) {
          if (action.onceFlag) {
            this.state.flags[action.onceFlag] = true;
          }
          this.startWildEncounter(action.speciesId, action.level);
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
    if (this.toasts.length > 3) {
      this.toasts.shift();
    }
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
        this.emitChange();
      }, 4200);
    }
  }

  public getShopItems() {
    return ITEMS.filter((item) => item.price > 0);
  }

  public getAllSpecies() {
    return SPECIES;
  }
}

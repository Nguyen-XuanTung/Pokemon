export type ElementType = 'leaf' | 'water' | 'ember' | 'stone' | 'gale' | 'spark' | 'neutral';

export type CombatElement = Exclude<ElementType, 'neutral'>;

export type StatusId = 'burn' | 'poison' | 'sleep' | 'paralyze';

export type CefrBand = 'A1' | 'A2' | 'B1' | 'B2';

export type LanguageSupportMode = 'immersion' | 'contextual' | 'bilingual';

export type BattleSpeedMode = 'normal' | 'fast' | 'instant';

export type TimeOfDay = 'morning' | 'day' | 'dusk' | 'night';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type RegionId =
  | 'mosslight_hub'
  | 'whisperwood'
  | 'reedwater_fen'
  | 'terracotta_ridge'
  | 'starfall_sanctuary';

export type TileKind =
  | 'grass'
  | 'path'
  | 'tall_grass'
  | 'water'
  | 'wall'
  | 'tree'
  | 'cliff'
  | 'bridge'
  | 'sand'
  | 'stone_floor'
  | 'flowers'
  | 'reed_marsh'
  | 'portal'
  | 'campfire'
  | 'shrine';

export type SpeciesRarity = 'common' | 'uncommon' | 'rare' | 'mythic';

export type CombatRole = 'striker' | 'bulwark' | 'swift' | 'tactician' | 'guardian';

export interface BaseStats {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly spd: number;
}

export interface MoveStatusEffect {
  readonly status: StatusId;
  readonly chance: number;
}

export interface MoveStatEffect {
  readonly target: 'self' | 'foe';
  readonly stat: 'atk' | 'def' | 'spd';
  readonly stages: number;
}

export interface MoveDefinition {
  readonly id: string;
  readonly name: string;
  readonly element: ElementType;
  readonly category: 'physical' | 'special' | 'support';
  readonly power: number;
  readonly accuracy: number;
  readonly maxPp: number;
  readonly priority: number;
  readonly statusEffect?: MoveStatusEffect;
  readonly statEffect?: MoveStatEffect;
  readonly healRatio?: number;
  readonly drainRatio?: number;
  readonly descriptionEn: string;
  readonly descriptionVi: string;
}

export interface SpeciesEvolution {
  readonly speciesId: string;
  readonly level: number;
}

export interface LearnsetEntry {
  readonly level: number;
  readonly moveId: string;
}

export interface SpeciesDefinition {
  readonly id: string;
  readonly dexNumber: number;
  readonly name: string;
  readonly titleEn: string;
  readonly titleVi: string;
  readonly element: CombatElement;
  readonly stage: 1 | 2 | 3;
  readonly rarity: SpeciesRarity;
  readonly combatRole: CombatRole;
  readonly isStarter?: boolean;
  readonly evolvesTo?: SpeciesEvolution;
  readonly baseStats: BaseStats;
  readonly catchRate: number;
  readonly expYield: number;
  readonly learnset: ReadonlyArray<LearnsetEntry>;
  readonly habitatIds: ReadonlyArray<RegionId>;
  readonly preferredTime?: ReadonlyArray<TimeOfDay>;
  readonly fieldNoteEn: string;
  readonly fieldNoteVi: string;
  readonly traitWords: ReadonlyArray<string>;
}

export interface MoveSlot {
  moveId: string;
  pp: number;
  maxPp: number;
}

export interface CreatureInstance {
  uid: string;
  speciesId: string;
  nickname?: string;
  isRareVariant?: boolean;
  level: number;
  exp: number;
  currentHp: number;
  maxHp: number;
  stats: {
    atk: number;
    def: number;
    spd: number;
  };
  moves: MoveSlot[];
  status: StatusId | null;
  statusTurns: number;
  bondedRegion: RegionId;
}

export type ItemCategory = 'charm' | 'tonic' | 'remedy' | 'lantern' | 'key';

export interface ItemDefinition {
  readonly id: string;
  readonly nameEn: string;
  readonly nameVi: string;
  readonly category: ItemCategory;
  readonly price: number;
  readonly captureMultiplier?: number;
  readonly healAmount?: number;
  readonly curesStatus?: StatusId | 'all';
  readonly ppRestore?: number;
  readonly wardSteps?: number;
  readonly descriptionEn: string;
  readonly descriptionVi: string;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export interface EncounterEntry {
  readonly speciesId: string;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly weight: number;
  readonly isRareSpot?: boolean;
  readonly timeBonus?: ReadonlyArray<TimeOfDay>;
}

export interface PortalDefinition {
  readonly x: number;
  readonly y: number;
  readonly targetRegion: RegionId;
  readonly targetX: number;
  readonly targetY: number;
  readonly targetFacing: Direction;
  readonly requiredFlag?: string;
  readonly requiredLeadElement?: CombatElement;
  readonly blockedDialogueId?: string;
  readonly labelEn: string;
  readonly labelVi: string;
}

export type PropKind =
  | 'sign'
  | 'chest'
  | 'campfire'
  | 'shrine'
  | 'supply_post'
  | 'overlook'
  | 'trace';

export interface WorldPropDefinition {
  readonly id: string;
  readonly kind: PropKind;
  readonly x: number;
  readonly y: number;
  readonly labelEn: string;
  readonly labelVi: string;
  readonly dialogueId?: string;
  readonly rewardItemId?: string;
  readonly rewardQuantity?: number;
  readonly rewardTokens?: number;
  readonly setsFlag?: string;
  readonly requiredFlag?: string;
  readonly requiredTime?: TimeOfDay;
  readonly traceSpeciesId?: string;
}

export type MapDecorKind =
  | 'cottage_lodge'
  | 'cottage_greenhouse'
  | 'market_stall'
  | 'fountain_plaza'
  | 'tent_sage'
  | 'boat_moored'
  | 'fence_h'
  | 'fence_v'
  | 'lantern_post'
  | 'bench_wood'
  | 'barrel_cluster'
  | 'flower_box'
  | 'fallen_log'
  | 'waterfall_cliff'
  | 'sanctuary_gate'
  | 'shrub'
  | 'lily_pad'
  | 'boulder'
  | 'stump'
  | 'ruin_pillar';

export interface MapDecoration {
  readonly kind: MapDecorKind;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly blocking?: boolean;
}

export interface TrainerPartySpec {
  readonly speciesId: string;
  readonly level: number;
}

export interface TrainerBattleSpec {
  readonly id: string;
  readonly isBoss: boolean;
  readonly titleEn: string;
  readonly titleVi: string;
  readonly party: ReadonlyArray<TrainerPartySpec>;
  readonly rewardTokens: number;
  readonly rewardItemId?: string;
  readonly rewardQuantity?: number;
  readonly setsFlag: string;
  readonly preBattleDialogueId: string;
  readonly defeatDialogueId: string;
}

export interface ConditionalDialogueRule {
  readonly requiredFlag?: string;
  readonly forbiddenFlag?: string;
  readonly questId?: string;
  readonly questState?: 'not_started' | 'active' | 'completed';
  readonly dialogueId: string;
}

export interface NpcDefinition {
  readonly id: string;
  readonly name: string;
  readonly roleEn: string;
  readonly roleVi: string;
  readonly spriteVariant: number;
  readonly regionId: RegionId;
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
  readonly defaultDialogueId: string;
  readonly conditionalDialogues?: ReadonlyArray<ConditionalDialogueRule>;
  readonly trainerBattle?: TrainerBattleSpec;
  readonly rematchBattle?: TrainerBattleSpec;
}

export interface RegionMapDefinition {
  readonly id: RegionId;
  readonly nameEn: string;
  readonly nameVi: string;
  readonly subtitleEn: string;
  readonly subtitleVi: string;
  readonly paletteTheme: 'hub' | 'forest' | 'fen' | 'ridge' | 'sanctuary';
  readonly bgmTrack: 'hub' | 'forest' | 'fen' | 'ridge' | 'sanctuary';
  readonly width: number;
  readonly height: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly encounterRate: number;
  readonly rows: ReadonlyArray<string>;
  readonly portals: ReadonlyArray<PortalDefinition>;
  readonly props: ReadonlyArray<WorldPropDefinition>;
  readonly decorations?: ReadonlyArray<MapDecoration>;
  readonly encounters: ReadonlyArray<EncounterEntry>;
}

export type QuestCondition =
  | { readonly kind: 'flag'; readonly flag: string }
  | { readonly kind: 'caught_count'; readonly count: number }
  | { readonly kind: 'caught_species'; readonly speciesId: string }
  | { readonly kind: 'caught_element'; readonly element: CombatElement; readonly count: number }
  | { readonly kind: 'discovered_count'; readonly count: number }
  | { readonly kind: 'visited_region'; readonly regionId: RegionId }
  | { readonly kind: 'defeated_trainer'; readonly trainerId: string };

export interface QuestStepDefinition {
  readonly id: string;
  readonly descriptionEn: string;
  readonly descriptionVi: string;
  readonly condition: QuestCondition;
}

export interface QuestDefinition {
  readonly id: string;
  readonly titleEn: string;
  readonly titleVi: string;
  readonly isMainStory: boolean;
  readonly regionId: RegionId;
  readonly giverNpcId: string;
  readonly prerequisiteFlag?: string;
  readonly autoStartOnFlag?: string;
  readonly summaryEn: string;
  readonly summaryVi: string;
  readonly steps: ReadonlyArray<QuestStepDefinition>;
  readonly rewards: {
    readonly tokens: number;
    readonly items?: ReadonlyArray<{ readonly itemId: string; readonly quantity: number }>;
    readonly setsFlag?: string;
  };
}

export type DialogueAction =
  | { readonly kind: 'choose_starter'; readonly speciesId: string }
  | { readonly kind: 'start_quest'; readonly questId: string }
  | { readonly kind: 'complete_quest'; readonly questId: string }
  | { readonly kind: 'set_flag'; readonly flag: string }
  | { readonly kind: 'heal_party' }
  | { readonly kind: 'open_camp_review' }
  | { readonly kind: 'open_supply_post' }
  | { readonly kind: 'give_item'; readonly itemId: string; readonly quantity: number; readonly onceFlag: string }
  | { readonly kind: 'start_trainer_battle'; readonly npcId: string; readonly isRematch?: boolean }
  | { readonly kind: 'trigger_wild_encounter'; readonly speciesId: string; readonly level: number; readonly onceFlag?: string; readonly guaranteedRareVariant?: boolean }
  | { readonly kind: 'cycle_time_of_day' };

export interface DialogueChoice {
  readonly labelEn: string;
  readonly labelVi: string;
  readonly action?: DialogueAction;
  readonly nextDialogueId?: string;
}

export interface DialogueLevelVariant {
  readonly en: string;
  readonly vi: string;
}

export interface DialogueLine {
  readonly en: string;
  readonly vi: string;
  readonly variants?: Partial<Record<CefrBand, DialogueLevelVariant>>;
  readonly includeReencounterEcho?: boolean;
  readonly focusWords?: ReadonlyArray<string>;
  readonly action?: DialogueAction;
  readonly choices?: ReadonlyArray<DialogueChoice>;
}

export interface DialogueNode {
  readonly id: string;
  readonly speaker: string;
  readonly speakerRoleVi?: string;
  readonly cefr: CefrBand;
  readonly regionId: RegionId;
  readonly contextTag: string;
  readonly lines: ReadonlyArray<DialogueLine>;
}

export interface PolysemySense {
  readonly senseId: string;
  readonly contextHints: ReadonlyArray<string>;
  readonly pos: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  readonly meaningVi: string;
  readonly exampleEn: string;
  readonly exampleVi: string;
}

export interface LexiconExamplePair {
  readonly en: string;
  readonly vi: string;
}

export interface LexiconEntry {
  readonly id: string;
  readonly word: string;
  readonly forms: ReadonlyArray<string>;
  readonly pos: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  readonly cefr: CefrBand;
  readonly phonetic: string;
  readonly meaningVi: string;
  readonly exampleEn: string;
  readonly exampleVi: string;
  readonly examples?: ReadonlyArray<LexiconExamplePair>;
  readonly topic: string;
  readonly senses?: ReadonlyArray<PolysemySense>;
}

export interface WordMemoryRecord {
  wordId: string;
  exposures: number;
  glossLookups: number;
  savedByPlayer: boolean;
  mastery: 0 | 1 | 2 | 3;
  lastSeenStep: number;
  lastSeenAtMs?: number;
  nextReviewStep?: number;
  nextReviewAtMs?: number;
  correctReviews?: number;
  lapses?: number;
  contextsSeen: string[];
}

export interface QuestProgress {
  questId: string;
  status: 'active' | 'completed';
  rewardClaimed: boolean;
}

export interface KeyBindingMap {
  up: string;
  down: string;
  left: string;
  right: string;
  interact: string;
  cancel: string;
  journal: string;
}

export interface GameSettings {
  cefrBand: CefrBand;
  supportMode: LanguageSupportMode;
  bgmVolume: number;
  sfxVolume: number;
  muted: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  battleSpeed?: BattleSpeedMode;
  showFollower?: boolean;
  textScale: 'normal' | 'large';
  touchControls: 'auto' | 'always' | 'off';
  keyMap: KeyBindingMap;
}

export interface PlayerStats {
  battlesWon: number;
  wildCaught: number;
  wordsGlossed: number;
  campReviewsCompleted: number;
  fledCount: number;
}

export interface GameState {
  schemaVersion: 1 | 2;
  seedState: number;
  playTimeSeconds: number;
  stepCount: number;
  timeOfDay: TimeOfDay;
  regionId: RegionId;
  playerPos: {
    x: number;
    y: number;
    facing: Direction;
  };
  starterChosen: string | null;
  party: CreatureInstance[];
  sanctuaryBox: CreatureInstance[];
  discoveredSpecies: string[];
  caughtSpecies: string[];
  gleamingSpecies: string[];
  rematchCleared: string[];
  discoveredTraces: string[];
  readLoreIds: string[];
  inventory: InventorySlot[];
  tokens: number;
  wardStepsRemaining: number;
  flags: Record<string, boolean>;
  defeatedTrainers: string[];
  openedProps: string[];
  quests: Record<string, QuestProgress>;
  lexicon: Record<string, WordMemoryRecord>;
  stats: PlayerStats;
  settings: GameSettings;
}

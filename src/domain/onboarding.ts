import type { NavigationTargetSpec } from './navigation.ts';
import type { GameState, OnboardingState, OnboardingStepId } from './types.ts';

export const ONBOARDING_SEQUENCE: ReadonlyArray<OnboardingStepId> = [
  'choose_starter',
  'move_around',
  'talk_npc',
  'track_quest',
  'first_battle',
  'first_capture',
  'campfire_heal',
  'optional_gloss',
  'open_journal',
  'free_explore',
];

export interface OnboardingStepPrompt {
  readonly id: OnboardingStepId;
  readonly index: number;
  readonly total: number;
  readonly titleEn: string;
  readonly titleVi: string;
  readonly hintEn: string;
  readonly hintVi: string;
  readonly hudActionEn: string;
  readonly hudActionVi: string;
  readonly skippableStep: boolean;
  readonly highlightButtonTestId?: string;
  readonly overrideTarget?: NavigationTargetSpec;
}

export interface OnboardingQuickGuideEntry {
  readonly stepNumber: number;
  readonly titleEn: string;
  readonly titleVi: string;
  readonly summaryEn: string;
  readonly summaryVi: string;
}

export function getOnboardingQuickGuideEntries(): ReadonlyArray<OnboardingQuickGuideEntry> {
  return [
    {
      stepNumber: 1,
      titleEn: 'Choose your partner',
      titleVi: 'Chọn bạn đồng hành đầu tiên',
      summaryEn: 'Talk to Ranger Rowan and pick Mosskit (Leaf), Kindlet (Ember), or Ripplefin (Water).',
      summaryVi: 'Trò chuyện cùng Kiểm lâm Rowan để chọn Mosskit (Lá rừng), Kindlet (Lửa ấm) hoặc Ripplefin (Suối nước).',
    },
    {
      stepNumber: 2,
      titleEn: 'Move and follow the glowing path',
      titleVi: 'Di chuyển theo vệt sáng và la bàn',
      summaryEn: 'Use Arrow keys, WASD, or the touch D-pad to follow the golden dots and top-left arrow.',
      summaryVi: 'Dùng phím mũi tên, WASD hoặc phím chữ thập để đi theo các chấm sáng vàng và mũi tên góc trên trái.',
    },
    {
      stepNumber: 3,
      titleEn: 'Talk and interact',
      titleVi: 'Tương tác với nhân vật và vật thể',
      summaryEn: 'Stand next to a character, sign, chest, or campfire and press Space, Enter, or click Interact.',
      summaryVi: 'Đứng cạnh nhân vật, biển chỉ đường, rương đồ hay lửa trại rồi nhấn Space, Enter hoặc bấm nút Tương tác.',
    },
    {
      stepNumber: 4,
      titleEn: 'Battle with Battle Assist',
      titleVi: 'Chiến đấu cùng Trợ giúp chiến thuật',
      summaryEn: 'Read the single highlighted recommendation in battle: weaken a wild foe first, heal when low, or switch for element advantage.',
      summaryVi: 'Làm theo gợi ý duy nhất đang sáng viền trong trận: đánh yếu đối thủ trước khi bắt, hồi máu khi thấp máu hoặc đổi hệ khắc chế.',
    },
    {
      stepNumber: 5,
      titleEn: 'Bond with wild creatures',
      titleVi: 'Thu phục sinh vật hoang dã',
      summaryEn: 'Open Chimes & Bag and use a Moss Charm after weakening the wild creature (your first guided capture is 100% guaranteed).',
      summaryVi: 'Mở thẻ Chuông và Túi rồi chọn Chuông Rêu sau khi làm yếu sinh vật hoang (lần thu phục hướng dẫn đầu tiên luôn thành công 100%).',
    },
    {
      stepNumber: 6,
      titleEn: 'Heal free at campfires',
      titleVi: 'Hồi đầy máu miễn phí tại lửa trại',
      summaryEn: 'Interact with any glowing campfire to restore full HP and move uses at zero cost. Losing a battle never removes tokens.',
      summaryVi: 'Tương tác với bất kỳ lửa trại nào để hồi đầy máu và lượt chiêu miễn phí. Thua trận không bao giờ bị trừ huy hiệu.',
    },
    {
      stepNumber: 7,
      titleEn: 'Optional English word lookup',
      titleVi: 'Tra từ tiếng Anh tự nguyện',
      summaryEn: 'Tap any underlined English word in dialogue to see its Vietnamese meaning and hear pronunciation, or switch content to Vietnamese only anytime.',
      summaryVi: 'Chạm từ tiếng Anh gạch chân trong hội thoại để xem nghĩa và nghe phát âm, hoặc đổi sang Tiếng Việt hoàn toàn trong Cài đặt.',
    },
    {
      stepNumber: 8,
      titleEn: 'Track quests, manage moves, and use I am Lost',
      titleVi: 'Theo dõi nhiệm vụ, đổi chiêu và nút Tôi bị lạc',
      summaryEn: 'Press J or open Field Journal to switch tracked quests or swap moves in Team, or click I am Lost anytime for instant directions.',
      summaryVi: 'Nhấn J hoặc mở Sổ thực địa để chọn nhiệm vụ Dẫn đường, đổi chiêu trong Đội hình, hoặc bấm Tôi bị lạc bất kỳ lúc nào.',
    },
  ];
}

export function ensureOnboardingState(state: GameState): OnboardingState {
  if (!state.onboarding) {
    const started = Boolean(state.starterChosen);
    state.onboarding = {
      currentStep: started ? 'free_explore' : 'choose_starter',
      completedSteps: started ? ['choose_starter'] : [],
      skipped: started,
      completed: started,
      stepsMovedSinceStarter: started ? 5 : 0,
      firstCaptureGuaranteedUsed: state.stats.wildCaught > 0,
    };
  }
  return state.onboarding;
}

export function isStepDoneForState(step: OnboardingStepId, state: GameState): boolean {
  const ob = ensureOnboardingState(state);
  if (ob.completedSteps.includes(step)) return true;
  switch (step) {
    case 'choose_starter':
      return Boolean(state.starterChosen && state.party.length > 0);
    case 'move_around':
      return (
        ob.stepsMovedSinceStarter >= 2 ||
        Boolean(state.flags.onboarding_talked_npc || state.flags.visited_whisperwood)
      );
    case 'talk_npc':
      return Boolean(state.flags.onboarding_talked_npc || state.flags.visited_whisperwood);
    case 'track_quest':
      return Boolean(state.flags.visited_whisperwood || state.regionId === 'whisperwood');
    case 'first_battle':
      return Boolean(
        state.flags.onboarding_fought_once ||
          state.stats.battlesWon > 0 ||
          state.stats.wildCaught > 0,
      );
    case 'first_capture':
      return state.stats.wildCaught >= 1;
    case 'campfire_heal':
      return Boolean(state.flags.onboarding_healed_campfire || state.flags.warden_sylvan_cleared);
    case 'optional_gloss':
      return Boolean(state.stats.wordsGlossed >= 1 || state.flags.onboarding_skipped_gloss);
    case 'open_journal':
      return Boolean(state.flags.onboarding_opened_journal);
    case 'free_explore':
      return ob.completed;
  }
}

export function syncOnboardingProgress(state: GameState): OnboardingState {
  const ob = ensureOnboardingState(state);
  if (ob.skipped || ob.completed) {
    return ob;
  }

  for (const step of ONBOARDING_SEQUENCE) {
    if (step === 'free_explore') break;
    if (isStepDoneForState(step, state) && !ob.completedSteps.includes(step)) {
      ob.completedSteps.push(step);
    }
  }

  const nextPending = ONBOARDING_SEQUENCE.find(
    (s) => s !== 'free_explore' && !ob.completedSteps.includes(s),
  );
  if (!nextPending) {
    ob.currentStep = 'free_explore';
    if (!ob.completedSteps.includes('free_explore')) {
      ob.completedSteps.push('free_explore');
    }
    ob.completed = true;
  } else {
    ob.currentStep = nextPending;
  }
  return ob;
}

export function skipOnboarding(state: GameState): void {
  const ob = ensureOnboardingState(state);
  ob.skipped = true;
  ob.completed = true;
  ob.currentStep = 'free_explore';
}

export function skipCurrentOnboardingStep(state: GameState): void {
  const ob = ensureOnboardingState(state);
  if (ob.skipped || ob.completed) return;
  if (ob.currentStep === 'optional_gloss') {
    state.flags.onboarding_skipped_gloss = true;
  }
  if (!ob.completedSteps.includes(ob.currentStep)) {
    ob.completedSteps.push(ob.currentStep);
  }
  syncOnboardingProgress(state);
}

export function restartOnboarding(state: GameState): void {
  // Clear only onboarding-progress tracking flags while preserving 100% of items, party, quests, and story flags
  delete state.flags.onboarding_talked_npc;
  delete state.flags.onboarding_fought_once;
  delete state.flags.onboarding_healed_campfire;
  delete state.flags.onboarding_skipped_gloss;
  delete state.flags.onboarding_opened_journal;

  const doneBase: OnboardingStepId[] = state.starterChosen ? ['choose_starter'] : [];
  if (state.flags.visited_whisperwood) {
    doneBase.push('move_around', 'talk_npc', 'track_quest');
  }
  if (state.stats.wildCaught > 0) {
    doneBase.push('first_battle', 'first_capture');
  }

  state.onboarding = {
    currentStep: state.starterChosen ? 'move_around' : 'choose_starter',
    completedSteps: doneBase,
    skipped: false,
    completed: false,
    stepsMovedSinceStarter: 0,
    firstCaptureGuaranteedUsed: state.stats.wildCaught > 0,
  };
  syncOnboardingProgress(state);
}

export function shouldGuaranteeFirstTutorialCapture(params: {
  state: GameState;
  enemyHpRatio: number;
  turnCount: number;
}): boolean {
  const ob = ensureOnboardingState(params.state);
  if (ob.skipped || ob.firstCaptureGuaranteedUsed || params.state.stats.wildCaught > 0) {
    return false;
  }
  // BattleSession starts at turnCount = 1; guarantee 100% right after 1 player turn (turnCount >= 2) or enemy HP <= 85%
  return params.enemyHpRatio <= 0.85 || params.turnCount >= 2;
}

export function getActiveOnboardingPrompt(state: GameState): OnboardingStepPrompt | null {
  const ob = syncOnboardingProgress(state);
  if (ob.skipped || ob.completed) {
    return null;
  }
  const idx = ONBOARDING_SEQUENCE.indexOf(ob.currentStep) + 1;
  const total = ONBOARDING_SEQUENCE.length;

  switch (ob.currentStep) {
    case 'choose_starter':
      return {
        id: 'choose_starter',
        index: idx,
        total,
        titleEn: 'Choose your first partner',
        titleVi: 'Chọn bạn đồng hành đầu tiên',
        hintEn: 'Walk to Ranger Rowan above you and press Space or click Next to pick Mosskit, Kindlet, or Ripplefin.',
        hintVi: 'Gặp Kiểm lâm Rowan ngay phía trước rồi bấm Tiếp theo để chọn Mosskit, Kindlet hoặc Ripplefin.',
        hudActionEn: 'Talk to Ranger Rowan and pick your first partner.',
        hudActionVi: 'Nói chuyện với Kiểm lâm Rowan để chọn bạn đồng hành đầu tiên.',
        skippableStep: false,
        overrideTarget: {
          regionId: 'mosslight_hub',
          x: 15,
          y: 8,
          kind: 'npc',
          labelEn: 'Ranger Rowan',
          labelVi: 'Kiểm lâm Rowan',
        },
      };
    case 'move_around':
      return {
        id: 'move_around',
        index: idx,
        total,
        titleEn: 'Walk along the golden path',
        titleVi: 'Làm quen bước đi theo đường sáng',
        hintEn: 'Press Arrow keys, WASD, or the touch D-pad to walk a few steps south toward Scout Mai.',
        hintVi: 'Bấm phím mũi tên, WASD hoặc phím chữ thập đi vài bước theo vệt sáng xuống gặp Trinh sát Mai.',
        hudActionEn: 'Walk south along the golden dots toward Scout Mai.',
        hudActionVi: 'Đi theo vệt sáng vàng xuống phía Nam tới chỗ Trinh sát Mai.',
        skippableStep: false,
        overrideTarget: {
          regionId: 'mosslight_hub',
          x: 16,
          y: 15,
          kind: 'npc',
          labelEn: 'Scout Mai',
          labelVi: 'Trinh sát Mai',
        },
      };
    case 'talk_npc':
      return {
        id: 'talk_npc',
        index: idx,
        total,
        titleEn: 'Talk to Scout Mai',
        titleVi: 'Trò chuyện cùng Trinh sát Mai',
        hintEn: 'Stand beside Scout Mai (golden ring) and press Space, Enter, or click the Interact button below.',
        hintVi: 'Đứng cạnh Trinh sát Mai (có vòng sáng vàng) rồi nhấn Space, Enter hoặc bấm nút Tương tác.',
        hudActionEn: 'Stand beside Scout Mai and press Space or click Interact.',
        hudActionVi: 'Đứng cạnh Trinh sát Mai rồi nhấn Space hoặc bấm Tương tác.',
        skippableStep: false,
        highlightButtonTestId: 'btn-nearby-interact',
        overrideTarget: {
          regionId: 'mosslight_hub',
          x: 16,
          y: 15,
          kind: 'npc',
          labelEn: 'Scout Mai',
          labelVi: 'Trinh sát Mai',
        },
      };
    case 'track_quest':
      return {
        id: 'track_quest',
        index: idx,
        total,
        titleEn: 'Follow the trail west to Whisperwood',
        titleVi: 'Theo đường sáng sang Rừng Thầm',
        hintEn: 'Use the Left arrow key or D-pad to follow the golden dots west out of Mosslight Camp into Whisperwood Glen.',
        hintVi: 'Đi theo vệt sáng vàng về hướng Tây ra khỏi cổng làng Trại Đèn Rêu để vào Thung Lũng Rừng Thầm.',
        hudActionEn: 'Follow the golden trail west to enter Whisperwood Glen.',
        hudActionVi: 'Đi theo vệt sáng hướng Tây qua cổng làng sang Thung Lũng Rừng Thầm.',
        skippableStep: false,
        overrideTarget: {
          regionId: 'mosslight_hub',
          x: 0,
          y: 12,
          kind: 'portal',
          labelEn: 'West Trail to Whisperwood Glen',
          labelVi: 'Cổng Tây sang Thung Lũng Rừng Thầm',
        },
      };
    case 'first_battle':
      return {
        id: 'first_battle',
        index: idx,
        total,
        titleEn: 'Step into tall grass for your first battle',
        titleVi: 'Thử trận chiến đầu tiên trong cỏ cao',
        hintEn: 'Walk onto the marked Whisperwood tall grass nearby. In battle, click the single highlighted move to weaken the wild creature.',
        hintVi: 'Bước vào bụi cỏ cao có vòng sáng vàng gần lối vào. Khi vào trận, bấm chiêu có nhãn Khuyên dùng để làm yếu đối thủ 1 lượt.',
        hudActionEn: 'Step into the nearby Whisperwood tall grass to start a gentle battle.',
        hudActionVi: 'Bước vào bụi cỏ cao Rừng Thầm để bắt đầu trận làm quen cấp 3.',
        skippableStep: false,
        overrideTarget: {
          regionId: 'whisperwood',
          x: 27,
          y: 8,
          kind: 'tall_grass',
          labelEn: 'Whisperwood Tall Grass',
          labelVi: 'Bụi cỏ cao Rừng Thầm',
        },
      };
    case 'first_capture':
      return {
        id: 'first_capture',
        index: idx,
        total,
        titleEn: 'Bond with your first wild creature',
        titleVi: 'Thu phục sinh vật đầu tiên',
        hintEn: 'After 1 attack in tall grass, open the highlighted Chimes & Bag tab and click Moss Charm (100% guaranteed!).',
        hintVi: 'Sau 1 lượt đánh trong trận, bấm thẻ Chuông và Túi (đang sáng viền) rồi chọn Chuông Rêu để thu phục chắc chắn 100%.',
        hudActionEn: 'Weaken a wild creature once, then open Chimes & Bag to use Moss Charm.',
        hudActionVi: 'Đánh 1 lượt rồi mở thẻ Chuông và Túi dùng Chuông Rêu (bắt chắc chắn 100%).',
        skippableStep: false,
        overrideTarget: {
          regionId: 'whisperwood',
          x: 27,
          y: 8,
          kind: 'tall_grass',
          labelEn: 'Whisperwood Tall Grass',
          labelVi: 'Bụi cỏ cao Rừng Thầm',
        },
      };
    case 'campfire_heal':
      return {
        id: 'campfire_heal',
        index: idx,
        total,
        titleEn: 'Heal free beside the campfire',
        titleVi: 'Hồi đầy máu miễn phí tại lửa trại',
        hintEn: 'Follow the golden path to the nearby Glen Campfire, stand beside it, and press Space or click Interact to restore full HP.',
        hintVi: 'Đi theo vệt sáng tới Lửa Trại Trảng Rừng ngay gần đó rồi nhấn Space hoặc bấm nút Tương tác để hồi đầy máu miễn phí.',
        hudActionEn: 'Walk to Glen Clearing Campfire and press Space or Interact to heal.',
        hudActionVi: 'Tới Lửa Trại Trảng Rừng gần đó và nhấn Tương tác để hồi đầy máu.',
        skippableStep: true,
        highlightButtonTestId: 'btn-nearby-interact',
        overrideTarget: {
          regionId: 'whisperwood',
          x: 24,
          y: 9,
          kind: 'prop',
          labelEn: 'Glen Clearing Campfire',
          labelVi: 'Lửa Trại Trảng Rừng',
        },
      };
    case 'optional_gloss': {
      const signTarget: NavigationTargetSpec =
        state.regionId === 'mosslight_hub'
          ? {
              regionId: 'mosslight_hub',
              x: 11,
              y: 13,
              kind: 'prop',
              labelEn: 'Basin Trail Signpost',
              labelVi: 'Biển chỉ đường Thung lũng',
            }
          : {
              regionId: 'whisperwood',
              x: 28,
              y: 11,
              kind: 'prop',
              labelEn: 'Whisperwood Trail Sign',
              labelVi: 'Biển chỉ dẫn Rừng Thầm',
            };
      return {
        id: 'optional_gloss',
        index: idx,
        total,
        titleEn: 'Optional: tap an underlined English word',
        titleVi: 'Tùy chọn: thử chạm từ tiếng Anh để tra nghĩa',
        hintEn: 'Read the nearby trail sign and tap any underlined English word to hear it, or click Skip Step anytime.',
        hintVi: 'Đọc biển chỉ dẫn gần đó rồi chạm một từ tiếng Anh gạch chân để xem nghĩa, hoặc bấm Bỏ qua bước này.',
        hudActionEn: 'Optional: read a sign and tap an underlined English word, or click Skip Step.',
        hudActionVi: 'Tùy chọn: đọc biển chỉ dẫn để thử tra từ tiếng Anh, hoặc bấm Bỏ qua bước này.',
        skippableStep: true,
        overrideTarget: signTarget,
      };
    }
    case 'open_journal':
      return {
        id: 'open_journal',
        index: idx,
        total,
        titleEn: 'Open your Field Journal',
        titleVi: 'Mở Sổ thực địa để xem nhiệm vụ và đội hình',
        hintEn: 'Press J or click the highlighted Field Journal button at the top-right to view quests, team moves, and settings.',
        hintVi: 'Nhấn phím J hoặc bấm nút Sổ thực địa đang sáng viền ở góc trên phải để xem nhiệm vụ, đổi chiêu và cài đặt.',
        hudActionEn: 'Press J or click the highlighted Field Journal button at the top-right.',
        hudActionVi: 'Nhấn phím J hoặc bấm nút Sổ thực địa đang sáng viền ở góc trên phải.',
        skippableStep: true,
        highlightButtonTestId: 'btn-open-journal',
      };
    case 'free_explore':
      return null;
  }
}

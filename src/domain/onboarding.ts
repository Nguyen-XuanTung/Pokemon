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
  readonly skippableStep: boolean;
  readonly overrideTarget?: NavigationTargetSpec;
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
      return ob.stepsMovedSinceStarter >= 3 || Boolean(state.flags.visited_whisperwood);
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
  state.onboarding = {
    currentStep: state.starterChosen ? 'move_around' : 'choose_starter',
    completedSteps: state.starterChosen ? ['choose_starter'] : [],
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
  return params.enemyHpRatio <= 0.85 || params.turnCount >= 1;
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
        hintEn: 'Talk to Ranger Rowan and pick Mosskit, Kindlet, or Ripplefin.',
        hintVi: 'Trò chuyện với Trưởng đoàn Rowan để chọn Mosskit, Kindlet hoặc Ripplefin.',
        skippableStep: false,
        overrideTarget: {
          regionId: 'mosslight_hub',
          x: 15,
          y: 8,
          kind: 'npc',
          labelEn: 'Ranger Rowan',
          labelVi: 'Trưởng đoàn Rowan',
        },
      };
    case 'move_around':
      return {
        id: 'move_around',
        index: idx,
        total,
        titleEn: 'Try moving along the path',
        titleVi: 'Làm quen bước đi',
        hintEn: 'Use arrow keys, WASD, or the touch D-pad to walk a few steps toward Scout Mai.',
        hintVi: 'Dùng phím mũi tên, WASD hoặc cụm phím cảm ứng đi vài bước dọc theo đường sáng.',
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
        titleEn: 'Talk to a village Ranger',
        titleVi: 'Tương tác với nhân vật',
        hintEn: 'Stand next to Scout Mai or any villager and press Space / Enter (or tap Act).',
        hintVi: 'Đứng cạnh Trinh sát Mai (hoặc biển chỉ đường) rồi nhấn Space / Enter hoặc nút Tương tác.',
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
    case 'track_quest':
      return {
        id: 'track_quest',
        index: idx,
        total,
        titleEn: 'Follow the glowing trail west',
        titleVi: 'Theo đường dẫn sang Rừng Thầm',
        hintEn: 'Follow the golden trail west across the village to enter Whisperwood Glen.',
        hintVi: 'Đi theo vệt sáng vàng về hướng Tây tới cổng làng để bước vào Thung Lũng Rừng Thầm.',
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
        titleEn: 'Enter tall grass for a gentle first battle',
        titleVi: 'Thử trận chiến đầu tiên',
        hintEn: 'Step into the nearby tall grass in Whisperwood Glen and try a recommended move.',
        hintVi: 'Bước vào bụi cỏ cao ngay gần lối vào Rừng Thầm và chọn một chiêu thức khuyên dùng.',
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
        hintEn: 'Weaken a wild creature once, then open Chimes & Bag and use a Moss Charm (100% guaranteed!).',
        hintVi: 'Đánh giảm máu sinh vật hoang 1 lượt rồi mở thẻ Chuông và Túi chọn Chuông Rêu (bảo đảm thành công!).',
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
        titleEn: 'Rest beside the clearing campfire',
        titleVi: 'Hồi phục đội hình tại lửa trại',
        hintEn: 'Walk to the warm Glen Campfire nearby and interact to restore all HP and move uses.',
        hintVi: 'Đi theo vệt sáng tới Lửa Trại Trảng Rừng gần đó và nhấn Tương tác để hồi đầy máu miễn phí.',
        skippableStep: true,
        overrideTarget: {
          regionId: 'whisperwood',
          x: 24,
          y: 9,
          kind: 'prop',
          labelEn: 'Glen Clearing Campfire',
          labelVi: 'Lửa Trại Trảng Rừng',
        },
      };
    case 'optional_gloss':
      return {
        id: 'optional_gloss',
        index: idx,
        total,
        titleEn: 'Optional: tap any underlined English word',
        titleVi: 'Tùy chọn: thử chạm từ tiếng Anh để tra nghĩa',
        hintEn: 'Talk to a sign or Ranger and tap any underlined English word, or skip this optional step.',
        hintVi: 'Chạm một từ tiếng Anh gạch chân trong hộp thoại để xem nghĩa và nghe phát âm, hoặc bấm Bỏ qua bước này.',
        skippableStep: true,
      };
    case 'open_journal':
      return {
        id: 'open_journal',
        index: idx,
        total,
        titleEn: 'Open your Field Journal',
        titleVi: 'Mở Sổ thực địa',
        hintEn: 'Press J or click Journal at the top-right to view quests, your team, and settings.',
        hintVi: 'Nhấn phím J hoặc nút Sổ thực địa ở góc trên phải để xem nhiệm vụ, đội hình và cài đặt.',
        skippableStep: true,
      };
    case 'free_explore':
      return null;
  }
}

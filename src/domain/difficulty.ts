import type { DifficultyMode } from './types.ts';

export interface DifficultyProfile {
  readonly id: DifficultyMode;
  readonly playerDamageMultiplier: number;
  readonly enemyDamageMultiplier: number;
  readonly captureBonusMultiplier: number;
  readonly expMultiplier: number;
  readonly postBattleHealRatio: number;
  readonly smartBossAi: boolean;
  readonly smartAllOpponentAi: boolean;
  readonly defaultBattleAssist: boolean;
}

export const DIFFICULTY_PROFILES: Readonly<Record<DifficultyMode, DifficultyProfile>> = {
  relaxed: {
    id: 'relaxed',
    playerDamageMultiplier: 1.15,
    enemyDamageMultiplier: 0.72,
    captureBonusMultiplier: 1.45,
    expMultiplier: 1.25,
    postBattleHealRatio: 0.35,
    smartBossAi: false,
    smartAllOpponentAi: false,
    defaultBattleAssist: true,
  },
  adventure: {
    id: 'adventure',
    playerDamageMultiplier: 1,
    enemyDamageMultiplier: 1,
    captureBonusMultiplier: 1,
    expMultiplier: 1,
    postBattleHealRatio: 0,
    smartBossAi: true,
    smartAllOpponentAi: false,
    defaultBattleAssist: true,
  },
  challenge: {
    id: 'challenge',
    playerDamageMultiplier: 0.94,
    enemyDamageMultiplier: 1.18,
    captureBonusMultiplier: 0.9,
    expMultiplier: 0.92,
    postBattleHealRatio: 0,
    smartBossAi: true,
    smartAllOpponentAi: true,
    defaultBattleAssist: false,
  },
};

export function getDifficultyProfile(mode: DifficultyMode | undefined): DifficultyProfile {
  if (mode === 'relaxed' || mode === 'challenge') {
    return DIFFICULTY_PROFILES[mode];
  }
  return DIFFICULTY_PROFILES.adventure;
}

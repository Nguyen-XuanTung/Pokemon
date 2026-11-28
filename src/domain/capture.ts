import type { SeededRng } from './rng.ts';
import type { CreatureInstance, SpeciesDefinition, StatusId } from './types.ts';

export interface CaptureAttemptResult {
  readonly probability: number;
  readonly shakes: 1 | 2 | 3;
  readonly captured: boolean;
}

export function getStatusCaptureBonus(status: StatusId | null): number {
  if (status === 'sleep') return 1.55;
  if (status === 'paralyze') return 1.35;
  if (status === 'burn' || status === 'poison') return 1.2;
  return 1;
}

export function computeCaptureProbability(params: {
  target: CreatureInstance;
  species: SpeciesDefinition;
  charmMultiplier: number;
  difficultyMultiplier?: number;
  guaranteedSuccess?: boolean;
}): number {
  if (params.guaranteedSuccess) {
    return 1;
  }
  const { target, species, charmMultiplier, difficultyMultiplier = 1 } = params;
  const maxHp = Math.max(1, target.maxHp);
  const currentHp = Math.max(1, Math.min(maxHp, target.currentHp));
  const hpFactor = (3 * maxHp - 2 * currentHp) / (3 * maxHp);
  const statusBonus = getStatusCaptureBonus(target.status);
  const baseNormalized = species.catchRate / 255;
  const raw = baseNormalized * hpFactor * charmMultiplier * statusBonus * difficultyMultiplier * 1.15;
  return Math.max(0.06, Math.min(0.98, raw));
}

export function resolveCaptureAttempt(params: {
  target: CreatureInstance;
  species: SpeciesDefinition;
  charmMultiplier: number;
  difficultyMultiplier?: number;
  guaranteedSuccess?: boolean;
  rng: SeededRng;
}): CaptureAttemptResult {
  if (params.guaranteedSuccess) {
    return {
      probability: 1,
      shakes: 3,
      captured: true,
    };
  }
  const probability = computeCaptureProbability(params);
  const roll = params.rng.nextFloat();
  if (roll < probability) {
    return {
      probability,
      shakes: 3,
      captured: true,
    };
  }
  const missMargin = (roll - probability) / Math.max(0.02, 1 - probability);
  const shakes: 1 | 2 = missMargin < 0.45 ? 2 : 1;
  return {
    probability,
    shakes,
    captured: false,
  };
}

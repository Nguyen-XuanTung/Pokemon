import type { CombatElement, ElementType } from './types.ts';

export const COMBAT_ELEMENTS: ReadonlyArray<CombatElement> = [
  'leaf',
  'water',
  'ember',
  'stone',
  'gale',
  'spark',
];

export const ELEMENT_LABELS: Readonly<
  Record<ElementType, { readonly en: string; readonly vi: string; readonly color: string }>
> = {
  leaf: { en: 'Leaf', vi: 'Lá rừng', color: '#4d8b55' },
  water: { en: 'Water', vi: 'Suối nước', color: '#3b7a8c' },
  ember: { en: 'Ember', vi: 'Lửa ấm', color: '#c85a32' },
  stone: { en: 'Stone', vi: 'Đá núi', color: '#8a6f52' },
  gale: { en: 'Gale', vi: 'Gió mây', color: '#5b8a7a' },
  spark: { en: 'Spark', vi: 'Tia chớp', color: '#c79a2b' },
  neutral: { en: 'Neutral', vi: 'Cơ bản', color: '#70685f' },
};

const SUPER_EFFECTIVE_TARGETS: Readonly<Record<CombatElement, ReadonlyArray<CombatElement>>> = {
  leaf: ['water', 'stone'],
  water: ['ember', 'stone'],
  ember: ['leaf', 'gale'],
  stone: ['gale', 'spark'],
  gale: ['leaf', 'spark'],
  spark: ['water', 'ember'],
};

export function getTypeMultiplier(attackElement: ElementType, defenderElement: CombatElement): number {
  if (attackElement === 'neutral') {
    return 1;
  }
  if (SUPER_EFFECTIVE_TARGETS[attackElement].includes(defenderElement)) {
    return 1.5;
  }
  if (SUPER_EFFECTIVE_TARGETS[defenderElement].includes(attackElement)) {
    return 0.67;
  }
  return 1;
}

export function describeEffectiveness(multiplier: number): {
  readonly tag: 'super' | 'resisted' | 'normal';
  readonly messageEn: string;
  readonly messageVi: string;
} {
  if (multiplier > 1.1) {
    return {
      tag: 'super',
      messageEn: 'It strikes a natural weakness!',
      messageVi: 'Đòn đánh trúng điểm khắc chế tự nhiên!',
    };
  }
  if (multiplier < 0.9) {
    return {
      tag: 'resisted',
      messageEn: 'The target resists the element.',
      messageVi: 'Đối phương kháng được nguyên tố này.',
    };
  }
  return {
    tag: 'normal',
    messageEn: '',
    messageVi: '',
  };
}

export function getElementStrengthsAndWeaknesses(element: CombatElement): {
  readonly strongAgainst: ReadonlyArray<CombatElement>;
  readonly weakTo: ReadonlyArray<CombatElement>;
} {
  const strongAgainst = SUPER_EFFECTIVE_TARGETS[element];
  const weakTo = COMBAT_ELEMENTS.filter((candidate) =>
    SUPER_EFFECTIVE_TARGETS[candidate].includes(element),
  );
  return { strongAgainst, weakTo };
}

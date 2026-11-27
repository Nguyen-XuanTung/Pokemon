import { describe, expect, it } from 'vitest';
import {
  COMBAT_ELEMENTS,
  describeEffectiveness,
  getElementStrengthsAndWeaknesses,
  getTypeMultiplier,
} from '../../src/domain/elements.ts';
import { SeededRng } from '../../src/domain/rng.ts';

describe('SeededRng determinism and distribution', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = new SeededRng(123456);
    const b = new SeededRng(123456);
    const seqA = Array.from({ length: 20 }, () => a.nextInt(1, 1000));
    const seqB = Array.from({ length: 20 }, () => b.nextInt(1, 1000));
    expect(seqA).toEqual(seqB);
  });

  it('restores exact continuation when seed state is serialized', () => {
    const rng = new SeededRng(999);
    rng.nextFloat();
    rng.nextFloat();
    const savedState = rng.getSeedState();
    const expected = [rng.nextFloat(), rng.nextFloat(), rng.nextFloat()];

    const clone = new SeededRng(1);
    clone.setSeedState(savedState);
    expect([clone.nextFloat(), clone.nextFloat(), clone.nextFloat()]).toEqual(expected);
  });

  it('picks items proportionally by weight', () => {
    const rng = new SeededRng(2026);
    let rareCount = 0;
    for (let i = 0; i < 500; i++) {
      const picked = rng.weightedPick([
        { item: 'common', weight: 90 },
        { item: 'rare', weight: 10 },
      ]);
      if (picked === 'rare') rareCount += 1;
    }
    expect(rareCount).toBeGreaterThan(25);
    expect(rareCount).toBeLessThan(85);
  });
});

describe('Elemental balance matrix', () => {
  it('gives every combat element exactly 2 strengths and 2 weaknesses with zero mutual super-effective pairs', () => {
    for (const el of COMBAT_ELEMENTS) {
      const { strongAgainst, weakTo } = getElementStrengthsAndWeaknesses(el);
      expect(strongAgainst).toHaveLength(2);
      expect(weakTo).toHaveLength(2);
      for (const target of strongAgainst) {
        expect(getTypeMultiplier(el, target)).toBe(1.5);
        expect(getTypeMultiplier(target, el)).toBe(0.67);
      }
    }
  });

  it('preserves the classic starter triangle leaf > water > ember > leaf', () => {
    expect(getTypeMultiplier('leaf', 'water')).toBe(1.5);
    expect(getTypeMultiplier('water', 'ember')).toBe(1.5);
    expect(getTypeMultiplier('ember', 'leaf')).toBe(1.5);
    expect(describeEffectiveness(1.5).tag).toBe('super');
    expect(describeEffectiveness(0.67).tag).toBe('resisted');
    expect(describeEffectiveness(1).tag).toBe('normal');
  });
});

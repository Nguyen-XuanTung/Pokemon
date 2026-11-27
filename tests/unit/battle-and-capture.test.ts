import { describe, expect, it } from 'vitest';
import { ITEMS_BY_ID } from '../../src/data/items.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { createBattleSession, stepBattleTurn } from '../../src/domain/battle.ts';
import { computeCaptureProbability } from '../../src/domain/capture.ts';
import { awardCreatureExperience, createCreatureInstance, expRequiredForLevel } from '../../src/domain/creatures.ts';
import { SeededRng } from '../../src/domain/rng.ts';

describe('Capture probability and non-quiz bonding', () => {
  it('increases capture probability monotonically with lower HP, sleep status, and stronger charms', () => {
    const spec = SPECIES_BY_ID.reedhop!;
    const healthy = createCreatureInstance({
      uid: 'w1',
      species: spec,
      level: 10,
      bondedRegion: 'reedwater_fen',
      movesById: MOVES_BY_ID,
    });
    const fullHpProb = computeCaptureProbability({
      target: healthy,
      species: spec,
      charmMultiplier: 1.1,
    });

    const lowHp = { ...healthy, currentHp: Math.max(1, Math.floor(healthy.maxHp * 0.15)) };
    const lowHpProb = computeCaptureProbability({
      target: lowHp,
      species: spec,
      charmMultiplier: 1.1,
    });

    const sleepingLowHp = { ...lowHp, status: 'sleep' as const };
    const sleepProb = computeCaptureProbability({
      target: sleepingLowHp,
      species: spec,
      charmMultiplier: 1.1,
    });

    const starCharmProb = computeCaptureProbability({
      target: sleepingLowHp,
      species: spec,
      charmMultiplier: 3.1,
    });

    expect(lowHpProb).toBeGreaterThan(fullHpProb);
    expect(sleepProb).toBeGreaterThan(lowHpProb);
    expect(starCharmProb).toBeGreaterThanOrEqual(sleepProb);
  });

  it('blocks capturing already-partnered trainer creatures without consuming charms', () => {
    const player = createCreatureInstance({
      uid: 'p1',
      species: SPECIES_BY_ID.mosskit!,
      level: 8,
      bondedRegion: 'mosslight_hub',
      movesById: MOVES_BY_ID,
    });
    const enemy = createCreatureInstance({
      uid: 'e1',
      species: SPECIES_BY_ID.breezeling!,
      level: 5,
      bondedRegion: 'whisperwood',
      movesById: MOVES_BY_ID,
    });
    const inventory = [{ itemId: 'moss_charm', quantity: 3 }];
    const session = createBattleSession({
      kind: 'trainer',
      opponentTitleEn: 'Scout Elena',
      opponentTitleVi: 'Elena',
      playerParty: [player],
      enemyParty: [enemy],
    });
    stepBattleTurn(
      session,
      { kind: 'item', itemId: 'moss_charm' },
      {
        speciesById: SPECIES_BY_ID,
        movesById: MOVES_BY_ID,
        itemsById: ITEMS_BY_ID,
        inventory,
        rng: new SeededRng(42),
      },
    );
    expect(inventory[0]?.quantity).toBe(3);
    expect(session.outcome).toBe('ongoing');
  });
});

describe('Turn-based combat, statuses, leveling, and 3-stage evolution', () => {
  it('resolves elemental combat turns, awards experience, and evolves Mosskit -> Briarpaw -> Verdantag', () => {
    const partner = createCreatureInstance({
      uid: 'starter_1',
      species: SPECIES_BY_ID.mosskit!,
      level: 5,
      bondedRegion: 'mosslight_hub',
      movesById: MOVES_BY_ID,
    });
    const wildWater = createCreatureInstance({
      uid: 'wild_1',
      species: SPECIES_BY_ID.reedhop!,
      level: 4,
      bondedRegion: 'reedwater_fen',
      movesById: MOVES_BY_ID,
    });

    const session = createBattleSession({
      kind: 'wild',
      opponentTitleEn: 'Wild Reedhop',
      opponentTitleVi: 'Reedhop',
      playerParty: [partner],
      enemyParty: [wildWater],
    });

    const rng = new SeededRng(777);
    let safety = 0;
    while (session.outcome === 'ongoing' && safety < 20) {
      stepBattleTurn(
        session,
        { kind: 'move', moveIndex: 1 }, // vine_snap (super effective vs water)
        {
          speciesById: SPECIES_BY_ID,
          movesById: MOVES_BY_ID,
          itemsById: ITEMS_BY_ID,
          inventory: [],
          rng,
        },
      );
      safety += 1;
    }
    expect(session.outcome).toBe('player_victory');

    // Award enough EXP to reach level 10 (Briarpaw) and then level 20 (Verdantag)
    const evo1 = awardCreatureExperience({
      creature: partner,
      expGain: expRequiredForLevel(10) - partner.exp + 5,
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
    });
    expect(evo1.evolvedToSpeciesId).toBe('briarpaw');
    expect(partner.speciesId).toBe('briarpaw');

    const evo2 = awardCreatureExperience({
      creature: partner,
      expGain: expRequiredForLevel(20) - partner.exp + 5,
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
    });
    expect(evo2.evolvedToSpeciesId).toBe('verdantag');
    expect(partner.speciesId).toBe('verdantag');
    expect(partner.level).toBeGreaterThanOrEqual(20);
  });
});

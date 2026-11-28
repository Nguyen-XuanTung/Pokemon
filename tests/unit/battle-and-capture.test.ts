import { describe, expect, it } from 'vitest';
import { ITEMS_BY_ID } from '../../src/data/items.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { createBattleSession, stepBattleTurn } from '../../src/domain/battle.ts';
import { computeCaptureProbability } from '../../src/domain/capture.ts';
import { awardCreatureExperience, createCreatureInstance, expRequiredForLevel } from '../../src/domain/creatures.ts';
import { SeededRng } from '../../src/domain/rng.ts';
import { buySupplyItem, createInitialGameState, useFieldItem } from '../../src/domain/state.ts';

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

    // Leveling Lotusbell to Lv.24 learns Lullaby Pollen while preserving Tidal Crest (power 80) in slot 0
    const lotus = createCreatureInstance({
      uid: 'lotus_1',
      species: SPECIES_BY_ID.lotusbell!,
      level: 21,
      bondedRegion: 'reedwater_fen',
      movesById: MOVES_BY_ID,
    });
    lotus.moves = [
      { moveId: 'tidal_crest', pp: 10, maxPp: 10 },
      { moveId: 'river_dive', pp: 14, maxPp: 14 },
      { moveId: 'soothing_rain', pp: 10, maxPp: 10 },
      { moveId: 'spore_drift', pp: 12, maxPp: 12 },
    ];
    awardCreatureExperience({
      creature: lotus,
      expGain: expRequiredForLevel(24) - lotus.exp + 5,
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
    });
    expect(lotus.moves[0]?.moveId).toBe('tidal_crest');
    expect(lotus.moves.some((m) => m.moveId === 'lullaby_pollen')).toBe(true);
  });

  it('validates field item usage (tonics, herbs, tea, ward lanterns) and supply post token bounds', () => {
    const state = createInitialGameState(404);
    const partner = createCreatureInstance({
      uid: 'field_p1',
      species: SPECIES_BY_ID.mosskit!,
      level: 8,
      bondedRegion: 'mosslight_hub',
      movesById: MOVES_BY_ID,
    });
    state.party = [partner];
    state.inventory = [
      { itemId: 'dew_tonic', quantity: 2 },
      { itemId: 'clear_herb', quantity: 1 },
      { itemId: 'breeze_tea', quantity: 1 },
      { itemId: 'calm_lantern', quantity: 1 },
      { itemId: 'moss_charm', quantity: 1 },
    ];

    // Full HP/PP/clean status rejects tonic waste
    expect(useFieldItem({ state, item: ITEMS_BY_ID.dew_tonic! }).ok).toBe(false);
    // Charm cannot be used outside wild battle
    expect(useFieldItem({ state, item: ITEMS_BY_ID.moss_charm! }).ok).toBe(false);

    // Damage HP, apply status, reduce PP, then use each field item
    partner.currentHp = Math.max(1, partner.maxHp - 15);
    expect(useFieldItem({ state, item: ITEMS_BY_ID.dew_tonic! }).ok).toBe(true);
    expect(partner.currentHp).toBe(partner.maxHp);

    partner.status = 'poison';
    expect(useFieldItem({ state, item: ITEMS_BY_ID.clear_herb! }).ok).toBe(true);
    expect(partner.status).toBeNull();

    partner.moves[0]!.pp = 0;
    expect(useFieldItem({ state, item: ITEMS_BY_ID.breeze_tea! }).ok).toBe(true);
    expect(partner.moves[0]!.pp).toBeGreaterThan(0);

    expect(useFieldItem({ state, item: ITEMS_BY_ID.calm_lantern! }).ok).toBe(true);
    expect(state.wardStepsRemaining).toBe(45);

    // Supply post purchase checks token balance and rejects priceless key items
    expect(buySupplyItem({ state, item: ITEMS_BY_ID.reed_ferry_pass!, quantity: 1 }).ok).toBe(false);
    expect(buySupplyItem({ state, item: ITEMS_BY_ID.star_charm!, quantity: 10 }).ok).toBe(false);
    expect(buySupplyItem({ state, item: ITEMS_BY_ID.dew_tonic!, quantity: 2 }).ok).toBe(true);
  });
});

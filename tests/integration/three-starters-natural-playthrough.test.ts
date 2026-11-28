import { describe, expect, it } from 'vitest';
import { QUESTS } from '../../src/data/quests.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { getTypeMultiplier } from '../../src/domain/elements.ts';
import { SaveRepository, type StorageAdapter } from '../../src/domain/save.ts';
import type { CombatElement } from '../../src/domain/types.ts';
import { GAME_SAVE_VALIDATION_REGISTRY, GameController } from '../../src/game/controller.ts';
import {
  closeAnyOpenDialogueNaturally,
  interactAndAcceptFirstChoiceNaturally,
  playOutActiveBattleNaturally,
  restAtCampfireNaturally,
  walkAdjacentAndFace,
  walkNaturallyToTile,
} from '../helpers/naturalPlayerAgent.ts';

class InMemoryBrowserStorage implements StorageAdapter {
  public readonly map = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  public removeItem(key: string): void {
    this.map.delete(key);
  }
}

function partyNeedsCampfireRest(controller: GameController): boolean {
  return controller.state.party.some((p) => {
    const lowHp = p.currentHp < p.maxHp * 0.8;
    const lowPp = p.moves.every((m) => m.pp <= 1);
    return lowHp || lowPp;
  });
}

function findBestCounterIndex(controller: GameController, bossElement: CombatElement): number {
  let bestIdx = -1;
  let bestMult = 1;
  controller.state.party.forEach((member, idx) => {
    const sp = SPECIES_BY_ID[member.speciesId]!;
    const mult = getTypeMultiplier(sp.element, bossElement);
    if (mult > bestMult || (mult === bestMult && mult > 1 && bestIdx < 0)) {
      bestMult = mult;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function ensureCounterInActiveParty(
  controller: GameController,
  bossElement: CombatElement,
): void {
  const alreadyInParty = controller.state.party.some((m) => {
    const sp = SPECIES_BY_ID[m.speciesId]!;
    return getTypeMultiplier(sp.element, bossElement) > 1.1;
  });
  if (alreadyInParty) return;

  const boxIdx = controller.state.sanctuaryBox.findIndex((m) => {
    const sp = SPECIES_BY_ID[m.speciesId]!;
    return getTypeMultiplier(sp.element, bossElement) > 1.1;
  });
  if (boxIdx >= 0 && controller.state.party.length > 1) {
    // Never swap our Mosslight starter out into the reserve box
    let targetPartySlot = controller.state.party.length - 1;
    if (controller.state.party[targetPartySlot]?.bondedRegion === 'mosslight_hub') {
      targetPartySlot = Math.max(0, targetPartySlot - 1);
    }
    controller.swapPartyAndReserve(targetPartySlot, boxIdx);
  }
}

function putBestElementLead(controller: GameController, targetElement: CombatElement): void {
  ensureCounterInActiveParty(controller, targetElement);
  let bestIdx = 0;
  let bestScore = -1;
  controller.state.party.forEach((member, idx) => {
    const sp = SPECIES_BY_ID[member.speciesId]!;
    const mult = getTypeMultiplier(sp.element, targetElement);
    const score = member.level * 10 + (mult > 1.1 ? 65 : mult < 0.9 ? -40 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });
  if (bestIdx > 0) {
    controller.makePartyLead(bestIdx);
  }
}

function trainInGrassNaturally(params: {
  controller: GameController;
  tileA: readonly [number, number];
  tileB: readonly [number, number];
  campfire: readonly [number, number];
  targetLeadLevel: number;
  minCaughtCount: number;
  requiredElement?: CombatElement;
  bossElementToCounter?: CombatElement;
  mustTrainPredicate?: () => boolean;
  onCapturedCallback?: (info: {
    speciesId: string;
    level: number;
    maxHp: number;
    ownedBefore: number;
  }) => void;
}): void {
  const {
    controller,
    tileA,
    tileB,
    campfire,
    targetLeadLevel,
    minCaughtCount,
    requiredElement,
    bossElementToCounter,
    mustTrainPredicate,
    onCapturedCallback,
  } = params;

  const hasRequiredElement = (): boolean => {
    if (!requiredElement) return true;
    return controller.state.caughtSpecies.some(
      (id) => SPECIES_BY_ID[id]?.element === requiredElement,
    );
  };

  const targetRegion = controller.state.regionId;
  let loops = 0;
  while (loops < 480) {
    loops += 1;
    // If a wild battle ever fainted our Lv.5 starter back to Mosslight Camp, walk back into targetRegion naturally
    if (controller.state.regionId === 'mosslight_hub' && targetRegion === 'whisperwood') {
      walkNaturallyToTile(controller, 0, 12);
    } else if (
      controller.state.regionId === 'mosslight_hub' &&
      targetRegion === 'starfall_sanctuary'
    ) {
      walkNaturallyToTile(controller, 15, 0);
    }
    if (bossElementToCounter) {
      ensureCounterInActiveParty(controller, bossElementToCounter);
    }

    const starterIdx = controller.state.party.findIndex(
      (p) => p.bondedRegion === 'mosslight_hub',
    );
    const starterReady =
      starterIdx < 0 || controller.state.party[starterIdx]!.level >= targetLeadLevel;

    const trainedMembers = controller.state.party.filter((c) => c.level >= targetLeadLevel).length;
    const counterIdx = bossElementToCounter
      ? findBestCounterIndex(controller, bossElementToCounter)
      : -1;
    const counterReady =
      !bossElementToCounter ||
      (counterIdx >= 0 && controller.state.party[counterIdx]!.level >= targetLeadLevel - 1);

    const extraReady = !mustTrainPredicate || mustTrainPredicate();
    const enoughCaught = controller.state.caughtSpecies.length >= minCaughtCount;
    if (
      starterReady &&
      trainedMembers >= Math.min(2, controller.state.party.length) &&
      counterReady &&
      extraReady &&
      enoughCaught &&
      hasRequiredElement()
    ) {
      break;
    }

    // Train starter to targetLeadLevel first in every region so it never falls behind, then counter/second partner
    if (starterIdx > 0 && !starterReady) {
      controller.makePartyLead(starterIdx);
    } else if (counterIdx > 0 && controller.state.party[counterIdx]!.level < targetLeadLevel) {
      controller.makePartyLead(counterIdx);
    } else if (starterIdx < 0 || starterReady) {
      const underIdx = controller.state.party.findIndex(
        (m, idx) => idx > 0 && idx < 2 && m.level < targetLeadLevel,
      );
      if (underIdx > 0) {
        controller.makePartyLead(underIdx);
      }
    }

    if (partyNeedsCampfireRest(controller)) {
      restAtCampfireNaturally(controller, campfire[0], campfire[1]);
    }

    const dest = loops % 2 === 0 ? tileA : tileB;
    walkNaturallyToTile(controller, dest[0], dest[1], {
      tryCaptureNewSpecies: true,
      onCapturedCallback,
    });
  }

  restAtCampfireNaturally(controller, campfire[0], campfire[1]);
}

function runCompleteUnassistedPlaythrough(
  starterChoiceIndex: 0 | 1 | 2,
  expectedStarterId: 'mosskit' | 'kindlet' | 'ripplefin',
  expectedFinalEvoId: 'verdantag' | 'pyrelume' | 'tidecrest',
  seed: number,
): void {
  const storage = new InMemoryBrowserStorage();
  const controller = new GameController(
    new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY),
  );

  // Start New Game via real UI controller entrypoint ONLY
  controller.startNewGame(seed);
  expect(controller.activeDialogue?.node.id).toBe('rowan_intro_choose_starter');

  // Advance Rowan intro lines and pick starter choice
  controller.advanceDialogue();
  controller.advanceDialogue();
  const starterChoice = controller.activeDialogue!.node.lines[2]!.choices![starterChoiceIndex]!;
  controller.selectDialogueChoice(starterChoice);
  closeAnyOpenDialogueNaturally(controller);
  expect(controller.state.starterChosen).toBe(expectedStarterId);

  let verifiedReloadCapture = false;
  const verifyCaptureAndReload = (info: {
    speciesId: string;
    level: number;
    maxHp: number;
    ownedBefore: number;
  }) => {
    const allOwned = [...controller.state.party, ...controller.state.sanctuaryBox];
    expect(allOwned.length).toBe(info.ownedBefore + 1);
    const newest = allOwned[allOwned.length - 1]!;
    expect(newest.speciesId).toBe(info.speciesId);
    expect(newest.level).toBe(info.level);
    expect(newest.maxHp).toBe(info.maxHp);

    // Reload from persistent SaveRepository on the first wild capture to prove exact reload fidelity
    if (!verifiedReloadCapture) {
      verifiedReloadCapture = true;
      const reloaded = new GameController(
        new SaveRepository(storage, GAME_SAVE_VALIDATION_REGISTRY),
      );
      reloaded.continueSavedGame();
      const reloadedOwned = [...reloaded.state.party, ...reloaded.state.sanctuaryBox];
      expect(reloadedOwned.length).toBe(allOwned.length);
      const reloadedMatch = reloadedOwned.find((c) => c.uid === newest.uid);
      expect(reloadedMatch).toBeDefined();
      expect(reloadedMatch?.speciesId).toBe(newest.speciesId);
      expect(reloadedMatch?.level).toBe(newest.level);
      expect(reloadedMatch?.maxHp).toBe(newest.maxHp);
      expect(reloadedMatch?.stats).toEqual(newest.stats);
      expect(reloadedMatch?.moves).toEqual(newest.moves);
    }
  };

  // --- ACT 0: Mosslight Camp ---
  // Open Greenhouse chest (5,3) for natural tonics + tokens
  walkAdjacentAndFace(controller, 5, 3);
  controller.interactFacing();
  // Talk to Botanist Linh (9,9) to start q03_field_herbarium
  walkAdjacentAndFace(controller, 9, 9);
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);
  expect(controller.state.quests.q03_field_herbarium?.status).toBe('active');

  // Walk through West Portal (0,12) into Whisperwood Glen
  walkNaturallyToTile(controller, 0, 12);
  expect(controller.state.regionId).toBe('whisperwood');

  // --- ACT 1: Whisperwood Glen ---
  // Collect Brookside chest (6,20 -> +4 Moss Charms) & Hidden Fern chest (26,20 -> +2 Orchard Salves)
  walkAdjacentAndFace(controller, 26, 20, { preferFleeWild: true });
  controller.interactFacing();
  walkAdjacentAndFace(controller, 6, 20, { preferFleeWild: true });
  controller.interactFacing();

  // Talk to Woodcarver Haru (15,16) and read Hollow Trunk Clue (12,17)
  walkAdjacentAndFace(controller, 15, 16, { preferFleeWild: true });
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);
  walkAdjacentAndFace(controller, 12, 17, { preferFleeWild: true });
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);

  // Train in Whisperwood tall grass near Glen Clearing Campfire (24,9), catching Leaf & Gale allies
  trainInGrassNaturally({
    controller,
    tileA: [26, 7],
    tileB: [27, 8],
    campfire: [24, 9],
    targetLeadLevel: 10,
    minCaughtCount: 3,
    requiredElement: 'leaf',
    bossElementToCounter: 'leaf',
    onCapturedCallback: verifyCaptureAndReload,
  });
  expect(verifiedReloadCapture).toBe(true);

  // Friendly match with Scout Elena (20,7)
  interactAndAcceptFirstChoiceNaturally(controller, 20, 7);
  expect(controller.state.flags.defeated_elena).toBe(true);
  restAtCampfireNaturally(controller, 24, 9);

  // Put best anti-Leaf lead forward and challenge Warden Sylvan (8,5)
  putBestElementLead(controller, 'leaf');
  interactAndAcceptFirstChoiceNaturally(controller, 8, 5);
  expect(controller.state.flags.warden_sylvan_cleared).toBe(true);
  restAtCampfireNaturally(controller, 24, 9);

  // Enter Reedwater Fen via Whisperwood northern creek portal (16,0)
  walkNaturallyToTile(controller, 16, 0, { preferFleeWild: true });
  expect(controller.state.regionId).toBe('reedwater_fen');

  // --- ACT 2: Reedwater Fen ---
  restAtCampfireNaturally(controller, 5, 10);
  // Open Woven Reed Chest (3,5 -> +4 Reed Charms) & Lotus Chest (28,20 -> +2 Breeze Tea)
  walkAdjacentAndFace(controller, 3, 5);
  controller.interactFacing();
  walkAdjacentAndFace(controller, 28, 20);
  controller.interactFacing();

  // Talk to Ferrywoman Sora (13,15) and light Misty Channel Lantern Post (22,15)
  walkAdjacentAndFace(controller, 13, 15);
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);
  walkAdjacentAndFace(controller, 22, 15);
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);

  // Train in Reedwater reed marsh near Lantern Pier Campfire (5,10) until Lv.15 & Water + Spark bonded
  trainInGrassNaturally({
    controller,
    tileA: [7, 10],
    tileB: [8, 10],
    campfire: [5, 10],
    targetLeadLevel: 15,
    minCaughtCount: 6,
    requiredElement: 'spark',
    bossElementToCounter: 'water',
  });
  // Also make sure we bonded at least one Water partner in Reedwater Fen to counter Terracotta Ridge!
  trainInGrassNaturally({
    controller,
    tileA: [7, 10],
    tileB: [8, 10],
    campfire: [5, 10],
    targetLeadLevel: 15,
    minCaughtCount: 6,
    requiredElement: 'water',
  });
  expect(controller.state.quests.q07_mist_beacons?.status).toBe('completed');

  // Challenge Angler Noah (12,7) & Warden Mirella (27,4)
  interactAndAcceptFirstChoiceNaturally(controller, 12, 7);
  restAtCampfireNaturally(controller, 5, 10);
  putBestElementLead(controller, 'water');
  interactAndAcceptFirstChoiceNaturally(controller, 27, 4);
  expect(controller.state.flags.warden_mirella_cleared).toBe(true);
  restAtCampfireNaturally(controller, 5, 10);

  // Cross East Canyon Steps (31,18) into Terracotta Ridge
  walkNaturallyToTile(controller, 31, 18, { preferFleeWild: true });
  expect(controller.state.regionId).toBe('terracotta_ridge');

  // --- ACT 3: Terracotta Ridge ---
  restAtCampfireNaturally(controller, 15, 5);
  // Open Kiln Mason Chest (3,20 -> +4 Amber Charms) & Cliff Strongbox (29,10 -> +2 Nectar Flasks)
  walkAdjacentAndFace(controller, 3, 20);
  controller.interactFacing();
  walkAdjacentAndFace(controller, 29, 10);
  controller.interactFacing();

  // Talk to Potter Amara (9,18) & inspect Ancient Kiln Tablet (5,17)
  walkAdjacentAndFace(controller, 9, 18);
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);
  walkAdjacentAndFace(controller, 5, 17);
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);

  // Train near Windbreak Campfire (15,5) until Lv.20 & Stone + Water counter ready
  trainInGrassNaturally({
    controller,
    tileA: [8, 2],
    tileB: [9, 2],
    campfire: [15, 5],
    targetLeadLevel: 20,
    minCaughtCount: 9,
    requiredElement: 'stone',
    bossElementToCounter: 'ember',
  });
  expect(controller.state.quests.q09_ancient_kiln?.status).toBe('completed');

  // Challenge Diego (12,10) & Warden Kaelen (27,18)
  interactAndAcceptFirstChoiceNaturally(controller, 12, 10);
  restAtCampfireNaturally(controller, 15, 5);
  putBestElementLead(controller, 'ember');
  interactAndAcceptFirstChoiceNaturally(controller, 27, 18);
  expect(controller.state.flags.warden_kaelen_cleared).toBe(true);
  restAtCampfireNaturally(controller, 15, 5);

  // Ascend High Summit Pass (31,6) into Starfall Sanctuary
  walkNaturallyToTile(controller, 31, 6, { preferFleeWild: true });
  expect(controller.state.regionId).toBe('starfall_sanctuary');

  // --- ACT 4: Starfall Sanctuary & Finale ---
  restAtCampfireNaturally(controller, 15, 16);
  // Open Observatory Starlight Vault (27,3 -> +3 Star Charms, +170 Tokens)
  walkAdjacentAndFace(controller, 27, 3);
  controller.interactFacing();

  // Visit Mosslight Supply Post naturally via South Arch (15,23) to buy extra flasks & charms with earned tokens
  walkNaturallyToTile(controller, 15, 23, { preferFleeWild: true });
  expect(controller.state.regionId).toBe('mosslight_hub');
  walkAdjacentAndFace(controller, 21, 8);
  controller.interactFacing();
  expect(controller.activeModal).toBe('supply_post');
  controller.purchaseItem('star_charm', 2);
  controller.purchaseItem('nectar_flask', 5);
  controller.purchaseItem('clear_herb', 2);
  controller.closeModal();
  // Return north through North Arch (15,0) into Starfall Sanctuary
  walkNaturallyToTile(controller, 15, 0);
  expect(controller.state.regionId).toBe('starfall_sanctuary');

  // Talk to Archivist Lyra (12,15) and read all 3 Star Pillars (9,10), (22,10), (20,4)
  walkAdjacentAndFace(controller, 12, 15);
  controller.interactFacing();
  closeAnyOpenDialogueNaturally(controller);
  for (const [px, py] of [
    [9, 10],
    [22, 10],
    [20, 4],
  ] as const) {
    walkAdjacentAndFace(controller, px, py);
    controller.interactFacing();
    closeAnyOpenDialogueNaturally(controller);
  }
  expect(controller.state.quests.q10_starlight_inscriptions?.status).toBe('completed');

  // Bring original Mosslight starter partner into Slot 0 before final Sanctuary training so it evolves to Stage 3 naturally
  const starterBoxIdx = controller.state.sanctuaryBox.findIndex(
    (p) => p.bondedRegion === 'mosslight_hub',
  );
  if (starterBoxIdx >= 0) {
    controller.swapPartyAndReserve(0, starterBoxIdx);
  } else {
    const starterPartyIdx = controller.state.party.findIndex(
      (p) => p.bondedRegion === 'mosslight_hub',
    );
    if (starterPartyIdx > 0) {
      controller.makePartyLead(starterPartyIdx);
    }
  }

  // Train in Starfall Sanctuary grass until Lv.24 (evolves starter to Stage 3!) and 12+ species bonded
  trainInGrassNaturally({
    controller,
    tileA: [11, 17],
    tileB: [11, 18],
    campfire: [15, 16],
    targetLeadLevel: 24,
    minCaughtCount: 12,
    mustTrainPredicate: () => {
      const st = controller.state.party.find((p) => p.bondedRegion === 'mosslight_hub');
      if (st && st.level < 21) {
        const idx = controller.state.party.indexOf(st);
        if (idx > 0) controller.makePartyLead(idx);
        return false;
      }
      return controller.state.caughtSpecies.includes(expectedFinalEvoId);
    },
  });
  expect(controller.state.caughtSpecies).toContain(expectedFinalEvoId);
  expect(controller.state.quests.q12_basin_naturalist?.status).toBe('completed');

  // Challenge Sentinel Orin (19,15), rest, and pass Elder Keeper Astraea's Final Sanctuary Trial (15,5)
  interactAndAcceptFirstChoiceNaturally(controller, 19, 15);
  restAtCampfireNaturally(controller, 15, 16);
  putBestElementLead(controller, 'water');
  interactAndAcceptFirstChoiceNaturally(controller, 15, 5);
  expect(controller.state.flags.sanctuary_harmony_restored).toBe(true);

  // Walk around Astraea to Celestial Harmony Altar (15,3) and awaken Basin Harmony!
  walkAdjacentAndFace(controller, 15, 3, { preferFleeWild: true });
  controller.interactFacing();
  expect(controller.activeDialogue?.node.id).toBe('shrine_starfall_altar');
  controller.selectDialogueChoice(controller.activeDialogue!.node.lines[0]!.choices![0]!);
  expect(controller.state.flags.main_story_completed).toBe(true);

  // Choose peaceful celebration ending & verify Ending Banner modal opens cleanly
  controller.selectDialogueChoice(controller.activeDialogue!.node.lines[1]!.choices![1]!);
  closeAnyOpenDialogueNaturally(controller);
  expect(controller.activeModal).toBe('ending_banner');
  controller.closeModal();

  // Verify all 12 quests completed and zero forced reviews/quizzes occurred!
  for (const q of QUESTS) {
    expect(controller.state.quests[q.id]?.status).toBe('completed');
  }
  expect(controller.state.stats.campReviewsCompleted).toBe(0);
  expect(controller.state.tokens).toBeGreaterThanOrEqual(0);
  expect(playOutActiveBattleNaturally).toBeDefined();
}

describe('Real-action full playthroughs from New Game to Ending for all three starters', () => {
  it(
    'completes the entire game naturally starting with Mosskit (Leaf)',
    { timeout: 30_000 },
    () => {
      runCompleteUnassistedPlaythrough(0, 'mosskit', 'verdantag', 202601);
    },
  );

  it(
    'completes the entire game naturally starting with Kindlet (Ember)',
    { timeout: 30_000 },
    () => {
      runCompleteUnassistedPlaythrough(1, 'kindlet', 'pyrelume', 202602);
    },
  );

  it(
    'completes the entire game naturally starting with Ripplefin (Water)',
    { timeout: 30_000 },
    () => {
      runCompleteUnassistedPlaythrough(2, 'ripplefin', 'tidecrest', 202603);
    },
  );
});

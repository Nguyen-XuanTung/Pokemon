import { describe, expect, it } from 'vitest';
import { ITEMS_BY_ID } from '../../src/data/items.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { QUESTS } from '../../src/data/quests.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { awardCreatureExperience, expRequiredForLevel } from '../../src/domain/creatures.ts';
import { SaveRepository } from '../../src/domain/save.ts';
import { GameController, type ActiveDialogueState } from '../../src/game/controller.ts';

import { getTypeMultiplier } from '../../src/domain/elements.ts';

function winActiveBattleQuickly(controller: GameController): void {
  let guard = 0;
  while (controller.activeBattle && controller.activeBattle.outcome === 'ongoing' && guard < 80) {
    const active = controller.activeBattle.playerParty[controller.activeBattle.activePlayerIndex]!;
    const foe = controller.activeBattle.enemyParty[controller.activeBattle.activeEnemyIndex]!;
    const foeSpec = SPECIES_BY_ID[foe.speciesId]!;
    if (active.currentHp < active.maxHp * 0.45) {
      const salveSlot = controller.state.inventory.find(
        (s) => s.itemId === 'nectar_flask' && s.quantity > 0,
      );
      if (salveSlot) {
        controller.submitBattleAction({ kind: 'item', itemId: 'nectar_flask' });
        guard += 1;
        continue;
      }
    }
    let bestIdx = 0;
    let bestScore = -1;
    active.moves.forEach((slot, idx) => {
      const mDef = MOVES_BY_ID[slot.moveId];
      if (!mDef || slot.pp <= 0) return;
      const score = mDef.power * getTypeMultiplier(mDef.element, foeSpec.element);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    controller.submitBattleAction({ kind: 'move', moveIndex: bestIdx });
    guard += 1;
  }
  expect(controller.activeBattle?.outcome).toBe('player_victory');
  controller.finishAndCloseBattle();
}

describe('Complete LingoWild main story and 12-quest integration playthrough', () => {
  it('completes the entire main storyline and all 12 quests from starter selection to Starfall Sanctuary without any mandatory quiz', () => {
    const controller = new GameController(new SaveRepository(null));
    controller.startNewGame(20261127);

    // 1. Choose Mosskit with Ranger Rowan -> completes q01_first_partner & starts q02, q04
    expect(controller.activeDialogue?.node.id).toBe('rowan_intro_choose_starter');
    const starterChoice = controller.activeDialogue!.node.lines[2]!.choices![0]!;
    controller.activeDialogue!.lineIndex = 2;
    controller.selectDialogueChoice(starterChoice);
    expect(controller.state.starterChosen).toBe('mosskit');
    expect(controller.state.quests.q01_first_partner?.status).toBe('completed');
    expect(controller.state.quests.q02_whisperwood_echo?.status).toBe('active');

    // Start Botanist Linh's compendium quest (q03)
    controller.openDialogueById('linh_intro_herbarium');
    controller.advanceDialogue();
    expect(controller.state.quests.q03_field_herbarium?.status).toBe('active');

    // Verify East Gate is gated before defeating Warden Sylvan
    controller.state.playerPos = { x: 20, y: 8, facing: 'right' };
    controller.movePlayer('right');
    expect(controller.state.regionId).toBe('mosslight_hub');
    controller.activeDialogue = null;

    // Walk through West Gate into Whisperwood Glen
    controller.state.playerPos = { x: 1, y: 8, facing: 'left' };
    controller.movePlayer('left');
    expect(controller.state.regionId).toBe('whisperwood');

    // Start Haru quest (q06) and inspect Hollow Trunk Clue
    controller.openDialogueById('haru_quest_intro');
    controller.advanceDialogue();
    controller.advanceDialogue();
    controller.state.playerPos = { x: 8, y: 11, facing: 'down' };
    controller.interactFacing(); // Inspects ww_dusk_sign -> sets read_dusk_hollow_clue
    controller.activeDialogue = null;
    expect(controller.state.quests.q06_lantern_cocoon?.status).toBe('completed');

    // Train starter to level 24 (evolves to Verdantag) and stock supplies for bosses
    const starter = controller.state.party[0]!;
    awardCreatureExperience({
      creature: starter,
      expGain: expRequiredForLevel(25),
      speciesById: SPECIES_BY_ID,
      movesById: MOVES_BY_ID,
    });
    expect(starter.speciesId).toBe('verdantag');
    controller.state.tokens += 3000;
    controller.purchaseItem('star_charm', 8);
    controller.purchaseItem('nectar_flask', 8);
    expect(ITEMS_BY_ID.star_charm).toBeDefined();

    // Catch diverse wild species across all 6 elements (satisfying q03, q04, q07 spark, q09 stone, q12 12 species!)
    const wildTargetIds = [
      'breezeling',
      'dewgrub',
      'voltkit',
      'reedhop',
      'glimmerfin',
      'clayback',
      'kilnshell',
      'sunskink',
      'starhoot',
      'kindlet',
      'ripplefin',
    ];
    for (const spId of wildTargetIds) {
      controller.startWildEncounter(spId, 4);
      const foe = controller.activeBattle!.enemyParty[0]!;
      foe.currentHp = 1;
      foe.status = 'sleep';
      let attempts = 0;
      while (controller.activeBattle && controller.activeBattle.outcome === 'ongoing' && attempts < 10) {
        if (
          (controller.state.inventory.find((i) => i.itemId === 'star_charm')?.quantity ?? 0) === 0
        ) {
          controller.state.inventory.push({ itemId: 'star_charm', quantity: 5 });
        }
        controller.submitBattleAction({ kind: 'item', itemId: 'star_charm' });
        attempts += 1;
      }
      controller.finishAndCloseBattle();
    }
    expect(controller.state.caughtSpecies.length).toBeGreaterThanOrEqual(12);
    expect(controller.state.sanctuaryBox.length).toBeGreaterThan(0);
    expect(controller.state.quests.q03_field_herbarium?.status).toBe('completed');
    expect(controller.state.quests.q04_first_bond?.status).toBe('completed');

    // Defeat Boss 1: Warden Sylvan -> completes q02 & starts q05 & q12
    controller.startTrainerEncounter('npc_sylvan');
    winActiveBattleQuickly(controller);
    controller.activeDialogue = null;
    expect(controller.state.flags.warden_sylvan_cleared).toBe(true);
    expect(controller.state.quests.q02_whisperwood_echo?.status).toBe('completed');
    expect(controller.state.quests.q12_basin_naturalist?.status).toBe('completed');

    // Enter Reedwater Fen via northern creek shortcut (11, 0)
    controller.state.playerPos = { x: 11, y: 1, facing: 'up' };
    controller.movePlayer('up');
    expect(controller.state.regionId).toBe('reedwater_fen');

    // Start Sora quest (q07) and light fen beacon at (14, 11)
    controller.openDialogueById('sora_quest_intro');
    controller.activeDialogue = null;
    controller.state.playerPos = { x: 14, y: 10, facing: 'down' };
    controller.interactFacing();
    controller.activeDialogue = null;
    expect(controller.state.quests.q07_mist_beacons?.status).toBe('completed');

    // Defeat Boss 2: Warden Mirella -> completes q05 & starts q08
    controller.startTrainerEncounter('npc_mirella');
    winActiveBattleQuickly(controller);
    controller.activeDialogue = null;
    expect(controller.state.flags.warden_mirella_cleared).toBe(true);
    expect(controller.state.quests.q05_fen_current?.status).toBe('completed');

    // Cross East Steps into Terracotta Ridge (21, 12)
    controller.state.playerPos = { x: 20, y: 12, facing: 'right' };
    controller.movePlayer('right');
    expect(controller.state.regionId).toBe('terracotta_ridge');

    // Start Amara quest (q09) and inspect Ancient Kiln at (5, 12)
    controller.openDialogueById('amara_quest_intro');
    controller.advanceDialogue();
    controller.activeDialogue = null;
    controller.state.playerPos = { x: 5, y: 11, facing: 'down' };
    controller.interactFacing();
    controller.activeDialogue = null;
    expect(controller.state.quests.q09_ancient_kiln?.status).toBe('completed');

    // Defeat Boss 3: Warden Kaelen -> completes q08 & starts q11
    controller.startTrainerEncounter('npc_kaelen');
    winActiveBattleQuickly(controller);
    controller.activeDialogue = null;
    expect(controller.state.flags.warden_kaelen_cleared).toBe(true);
    expect(controller.state.quests.q08_ridge_beacon?.status).toBe('completed');

    // Ascend to Starfall Sanctuary via High Summit Pass (20, 4)
    controller.state.playerPos = { x: 19, y: 4, facing: 'right' };
    controller.movePlayer('right');
    expect(controller.state.regionId).toBe('starfall_sanctuary');

    // Start Lyra quest (q10) and read West (7,5), East (14,5), North (14,3) Star Pillars
    controller.openDialogueById('lyra_quest_intro');
    controller.advanceDialogue();
    controller.activeDialogue = null;
    for (const [px, py, facing] of [
      [8, 5, 'left'], // facing left -> (7,5)
      [13, 5, 'right'], // facing right -> (14,5)
      [13, 3, 'right'], // facing right -> (14,3)
    ] as const) {
      controller.state.playerPos = {
        x: px,
        y: py,
        facing,
      };
      controller.interactFacing();
      controller.activeDialogue = null;
    }
    expect(controller.state.quests.q10_starlight_inscriptions?.status).toBe('completed');

    // Rest at Starlight Brazier campfire (10, 11) before Final Sanctuary Trial
    controller.state.playerPos = { x: 10, y: 12, facing: 'up' };
    controller.interactFacing();
    controller.activeDialogue = null;

    // Pass Elder Keeper Astraea Final Sanctuary Trial
    controller.startTrainerEncounter('npc_astraea');
    winActiveBattleQuickly(controller);
    controller.activeDialogue = null;
    expect(controller.state.flags.sanctuary_harmony_restored).toBe(true);

    // Resonate Celestial Harmony Altar at (10, 3) -> triggers main_story_completed!
    controller.state.playerPos = { x: 10, y: 4, facing: 'up' };
    controller.interactFacing();
    const altarDlg = controller.activeDialogue as ActiveDialogueState | null;
    expect(altarDlg?.node.id).toBe('shrine_starfall_altar');
    controller.selectDialogueChoice(altarDlg!.node.lines[0]!.choices![0]!);
    expect(controller.state.flags.main_story_completed).toBe(true);
    expect(controller.state.quests.q11_starfall_harmony?.status).toBe('completed');

    // Verify ALL 12 quests are completed!
    for (const q of QUESTS) {
      expect(controller.state.quests[q.id]?.status).toBe('completed');
    }
    expect(controller.state.stats.wordsGlossed).toBe(0); // Proves 0 forced gloss/quiz lookups needed!
  });
});

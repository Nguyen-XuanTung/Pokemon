import { describe, expect, it } from 'vitest';
import { DIALOGUES_BY_ID } from '../../src/data/dialogues.ts';
import { ZH_LEXICON_INDEX } from '../../src/data/zh-lexicon.ts';
import { SaveRepository, type StorageAdapter } from '../../src/domain/save.ts';
import { GAME_SAVE_VALIDATION_REGISTRY, GameController } from '../../src/game/controller.ts';

class MemoryStorage implements StorageAdapter {
  private readonly map = new Map<string, string>();
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

describe('Chinese HSK 2 Full Flow & Multilingual Switch Integration', () => {
  it('completes starter onboarding, click-to-move interactions, Chinese glossing, wild battle, campfire review, and lossless EN<->ZH switching', () => {
    const repo = new SaveRepository(new MemoryStorage(), GAME_SAVE_VALIDATION_REGISTRY);
    const controller = new GameController(repo);
    controller.updateSettings({ learningLanguage: 'zh', hskLevel: 'HSK2' });
    controller.startNewGame(130042, { skipTutorial: true });

    // Rowan intro dialogue resolved in HSK 2 Simplified Chinese
    expect(controller.activeDialogue).not.toBeNull();
    expect(controller.activeDialogue?.resolvedZh).toContain('苔灯营地');
    expect(Object.keys(controller.state.lexiconZh ?? {}).length).toBeGreaterThan(0);

    // Inspect a Chinese word & save to Chinese notebook
    const huanying = ZH_LEXICON_INDEX.byHanzi['欢迎']!;
    controller.inspectZhGlossWord(huanying, 'hub_starter', controller.activeDialogue!.resolvedZh);
    controller.toggleSaveActiveGloss();
    expect(controller.state.lexiconZh?.[huanying.id]?.savedByPlayer).toBe(true);
    controller.closeGlossPopup();

    // Advance intro & choose Ripplefin
    controller.advanceDialogue();
    controller.advanceDialogue();
    const starterChoice = controller.activeDialogue!.node.lines[2]!.choices![2]!;
    controller.selectDialogueChoice(starterChoice);
    controller.advanceDialogue();
    controller.advanceDialogue();
    expect(controller.state.starterChosen).toBe('ripplefin');
    expect(controller.activeDialogue).toBeNull();

    // Click-to-move to Campfire (13, 9) and open Chinese Campfire Review
    const campPlan = controller.requestClickToMove(13, 9);
    expect(campPlan.ok).toBe(true);
    for (let i = 0; i < 80 && !controller.activeDialogue; i++) {
      controller.tickMovement(40);
    }
    expect(controller.activeDialogue?.node.id).toBe('prop_hub_campfire');
    expect(controller.activeDialogue?.resolvedZh).toContain('篝火');

    const reviewChoice = controller.activeDialogue!.node.lines[0]!.choices![0]!;
    controller.selectDialogueChoice(reviewChoice);
    expect(controller.activeModal).toBe('camp_review');
    expect(controller.zhCampPrompts.length).toBeGreaterThan(0);
    const firstPrompt = controller.zhCampPrompts[0]!;
    const res = controller.answerZhCampfirePrompt(firstPrompt.entry.id);
    expect(res.matched).toBe(true);
    controller.closeModal();

    // Click-to-move to West Portal (0, 12) -> enters Whisperwood
    const portalPlan = controller.requestClickToMove(0, 12);
    expect(portalPlan.ok).toBe(true);
    for (let i = 0; i < 120 && controller.state.regionId === 'mosslight_hub'; i++) {
      controller.tickMovement(40);
    }
    expect(controller.state.regionId).toBe('whisperwood');

    // Wild battle in Chinese produces Simplified Chinese battle logs
    controller.startWildEncounter('dewgrub', 3, false);
    expect(controller.activeBattle).not.toBeNull();
    expect(controller.battleLogs[0]?.messageZh).toContain('露虫');
    controller.submitBattleAction({ kind: 'observe' });
    expect(controller.battleLogs.some((l) => l.messageZh?.includes('观察笔记'))).toBe(true);
    controller.submitBattleAction({ kind: 'item', itemId: 'moss_charm' });
    while (controller.activeBattle?.outcome === 'ongoing') {
      controller.submitBattleAction({ kind: 'move', moveIndex: 0 });
    }
    controller.finishAndCloseBattle();
    expect(controller.activeBattle).toBeNull();

    // Live switch to English, inspect an English dialogue, switch back to Chinese -> zero loss!
    const tokensBefore = controller.state.tokens;
    const partyCountBefore = controller.state.party.length;
    controller.updateSettings({ learningLanguage: 'en', cefrBand: 'B1' });
    controller.openDialogueById('sign_whisperwood_entry');
    expect(controller.activeDialogue?.resolvedEn.length).toBeGreaterThan(10);
    expect(Object.keys(controller.state.lexicon).length).toBeGreaterThan(0);
    controller.advanceDialogue();

    controller.updateSettings({ learningLanguage: 'zh', hskLevel: 'HSK1' });
    controller.openDialogueById('astraea_pre_trial');
    expect(controller.activeDialogue?.resolvedZh).toContain('树林');
    expect(controller.state.tokens).toBe(tokensBefore);
    expect(controller.state.party.length).toBe(partyCountBefore);
    expect(controller.state.lexiconZh?.[huanying.id]?.savedByPlayer).toBe(true);
    expect(Object.keys(controller.state.lexicon).length).toBeGreaterThan(0);
    expect(DIALOGUES_BY_ID['finale_credits_summary']).toBeDefined();
  });
});

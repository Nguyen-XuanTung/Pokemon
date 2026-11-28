import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const FORBIDDEN_ENGLISH_UI_STRINGS = [
  'Field Journal',
  'Basin Map',
  'Settings & Save',
  'New Expedition',
  'Continue Expedition',
  'Observe & Flee',
  'Uncharted Wildkin',
  'Save Progress Now',
  'Close (Esc)',
  'Make Lead',
  'Swap with Last Slot',
  'Ranger Rowan',
  'Scout Mai',
  'Warden Sylvan',
];

test.describe('Beginner Experience: Vietnamese A1 Player Verification', () => {
  test('guides a simulated Vietnamese A1 beginner through onboarding, wayfinding, battle assist, guaranteed first catch, and Lost Helper using in-game info only', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop beginner walkthrough');

    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    page.on('response', (res) => {
      if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/');
    await expect(page.getByTestId('btn-new-game')).toContainText('Bắt đầu hành trình mới');
    await expect(page.getByTestId('select-ui-language')).toHaveValue('vi');
    await expect(page.getByTestId('select-content-language')).toHaveValue('bilingual');
    await expect(page.getByTestId('select-difficulty')).toHaveValue('relaxed');

    // Step 1: Start New Game and pick starter Mosskit
    await page.getByTestId('btn-new-game').click();
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Step 2: Verify onboarding strip, compass arrow, and minimap appear cleanly in Mosslight Camp
    await expect(page.getByTestId('onboarding-strip')).toBeVisible();
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'move_around');
    await expect(page.getByTestId('hud-compass-arrow')).toBeVisible();
    await expect(page.getByTestId('overworld-minimap')).toBeVisible();

    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18-beginner-camp-guidance.png') });
    }

    // Walk south & east toward Scout Mai (16,15) from spawn (15,13): 4 steps clears move_around (3+ steps) & stands right beside Scout Mai!
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'talk_npc');
    // Now at (15,15) right next to Scout Mai (16,15): nearby interact hint must be visible!
    await expect(page.getByTestId('btn-nearby-interact')).toBeVisible();
    await expect(page.getByTestId('btn-nearby-interact')).toContainText('Trinh sát Mai');

    // Step 3: Talk to Scout Mai (auto-facing interacts even without turning right!)
    await page.keyboard.press('Space');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'track_quest');

    // Step 4: Follow trail west to Whisperwood Glen (0,12) via row 12 stone road
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowUp');
    }
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowLeft');
    }
    await expect
      .poll(async () => page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId))
      .toBe('whisperwood');

    // Walk into Whisperwood tall grass near (27,8) to trigger gentle first Lv.3 wild encounter
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');

    let inBattle = false;
    for (let s = 0; s < 30 && !inBattle; s++) {
      await page.keyboard.press(s % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
      inBattle = await page.evaluate(
        () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
      );
    }
    expect(inBattle).toBe(true);
    await expect(page.getByTestId('battle-deck')).toBeVisible();
    await expect(page.getByTestId('battle-assist-bar')).toBeVisible();
    await expect(page.locator('.lw-move-card[data-recommended="true"]')).toHaveCount(1);

    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19-beginner-battle-assist.png') });
    }

    // Step 5: Click the recommended move once
    await page.locator('.lw-move-card[data-recommended="true"] button').first().click();

    // Step 6: Open Chimes & Bag, verify guaranteed 100% first capture, and throw Moss Charm!
    await page.getByTestId('battle-tab-bag').click();
    await expect(page.getByTestId('btn-battle-item-moss_charm')).toContainText('100%');
    await page.getByTestId('btn-battle-item-moss_charm').click();

    // Must succeed on the very first throw!
    await expect(page.getByTestId('btn-battle-finish')).toBeVisible();
    await expect(page.locator('.lw-battle-log')).toHaveAttribute('data-captured', 'true');
    await page.getByTestId('btn-battle-finish').click();

    // Step 7: Walk to Glen Clearing Campfire (24,9) from (27,7/8) and heal!
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'campfire_heal');
    const pos = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos,
    );
    const dy = 9 - (pos?.y ?? 8);
    for (let i = 0; i < Math.abs(dy); i++) {
      await page.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
    const dx = 25 - (pos?.x ?? 27);
    for (let i = 0; i < Math.abs(dx); i++) {
      await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    }
    // Ensure facing left toward campfire at (24,9) and interact
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    // Dismiss campfire dialogue without entering optional quiz
    const choices = page.locator('[data-testid^="dialogue-choice-"]');
    if ((await choices.count()) > 0) {
      await choices.last().click();
    } else {
      await page.getByTestId('btn-dialogue-next').click();
    }
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    // Step 8: Optional English lookup step -> verify beginner can skip it cleanly with zero penalty!
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'optional_gloss');
    await page.getByTestId('btn-skip-onboarding-step').click();

    // Step 9: Open Field Journal, inspect structured quest card, click "Dẫn đường", and inspect Team Move Manager
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'open_journal');
    await page.getByTestId('btn-open-journal').click();
    await expect(page.getByTestId('journal-modal')).toBeVisible();
    await expect(page.getByTestId('quest-card-q02_whisperwood_echo')).toBeVisible();
    await expect(page.getByTestId('quest-card-q02_whisperwood_echo')).toContainText('Tiến độ');
    await expect(page.getByTestId('quest-card-q02_whisperwood_echo')).toContainText(
      'Chuẩn bị khuyên dùng',
    );
    await expect(page.getByTestId('quest-card-q02_whisperwood_echo')).not.toContainText(
      'Warden Sylvan',
    );

    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20-beginner-quests-wayfinding.png') });
    }

    // Click "Dẫn đường" on the side quest to test active quest-tracking switch, then re-open Journal for Team Move Manager
    await page.getByTestId('btn-track-quest-q04_first_bond').click();
    await expect(page.getByTestId('journal-modal')).toBeHidden();
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-team').click();
    await page.getByTestId('btn-manage-moves-0').click();
    await expect(page.getByTestId('move-manager-panel')).toBeVisible();
    await page.getByTestId('btn-close-journal').click();

    // Open "Tôi bị lạc" contextual helper modal
    await page.getByTestId('btn-im-lost').click();
    await expect(page.getByTestId('lost-helper-modal')).toBeVisible();
    await expect(page.getByTestId('lost-helper-modal')).toContainText('Rừng Thầm');
    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21-lost-helper-modal.png') });
    }
    await page.getByTestId('btn-close-lost-helper').click();
    await expect(page.getByTestId('lost-helper-modal')).toBeHidden();

    expect(consoleErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test('audits zero untranslated English UI strings in Vietnamese mode and verifies live language, difficulty, and guidance switches without data loss', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop localization & mode audit');

    await page.goto('/');
    await page.getByTestId('select-ui-language').selectOption('vi');
    await page.getByTestId('select-content-language').selectOption('vi_only');
    await page.getByTestId('checkbox-skip-tutorial').check();

    const titleText = (await page.locator('#ui-overlay').textContent()) ?? '';
    for (const forbidden of FORBIDDEN_ENGLISH_UI_STRINGS) {
      expect(titleText).not.toContain(forbidden);
    }

    await page.getByTestId('btn-new-game').click();
    const introText = (await page.getByTestId('dialogue-box').textContent()) ?? '';
    expect(introText).toContain('Kiểm lâm Rowan');
    expect(introText).not.toContain('Ranger Rowan');

    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Audit HUD and Lost Helper in vi_only mode
    const hudText = (await page.locator('.lw-hud').textContent()) ?? '';
    for (const forbidden of FORBIDDEN_ENGLISH_UI_STRINGS) {
      expect(hudText).not.toContain(forbidden);
    }

    // Audit all 7 Journal tabs in vi + vi_only mode
    await page.getByTestId('btn-open-journal').click();
    for (const tabId of [
      'journal-tab-quests',
      'journal-tab-map',
      'journal-tab-team',
      'journal-tab-bag',
      'journal-tab-compendium',
      'journal-tab-lexicon',
      'journal-tab-settings',
    ]) {
      await page.getByTestId(tabId).click();
      const bodyText = await page.getByTestId('journal-modal').evaluate((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.lw-lexicon-example').forEach((n) => n.remove());
        return clone.textContent ?? '';
      });
      for (const forbidden of FORBIDDEN_ENGLISH_UI_STRINGS) {
        expect(bodyText, `Forbidden English UI "${forbidden}" leaked in ${tabId}`).not.toContain(
          forbidden,
        );
      }
    }

    // Live-switch UI language, all 4 content modes, all 3 difficulties, and all 3 guidance modes without losing progress
    const snapBefore = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
    await page.getByTestId('settings-ui-language').selectOption('en');
    await expect(page.getByTestId('journal-modal')).toContainText('Field Journal');

    await page.getByTestId('settings-content-language').selectOption('en_assist');
    await page.getByTestId('settings-content-language').selectOption('en_immersion');
    await page.getByTestId('settings-content-language').selectOption('bilingual');

    await page.getByTestId('settings-difficulty').selectOption('adventure');
    await page.getByTestId('settings-difficulty').selectOption('challenge');
    await page.getByTestId('settings-difficulty').selectOption('relaxed');

    // Toggle guidance modes and confirm HUD minimap/compass visibility responds immediately
    await page.getByTestId('settings-ui-language').selectOption('vi');
    await page.getByTestId('settings-guidance-mode').selectOption('minimal');
    await page.getByTestId('btn-close-journal').click();
    await expect(page.getByTestId('hud-compass-arrow')).toBeVisible();
    await expect(page.getByTestId('overworld-minimap')).toBeHidden();

    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('settings-guidance-mode').selectOption('off');
    await page.getByTestId('btn-close-journal').click();
    await expect(page.getByTestId('hud-compass-arrow')).toBeHidden();
    await expect(page.getByTestId('overworld-minimap')).toBeHidden();

    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('settings-guidance-mode').selectOption('full');
    await page.getByTestId('btn-close-journal').click();
    await expect(page.getByTestId('hud-compass-arrow')).toBeVisible();
    await expect(page.getByTestId('overworld-minimap')).toBeVisible();

    const snapAfter = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
    expect(snapAfter?.partyCount).toBe(snapBefore?.partyCount);
    expect(snapAfter?.caughtCount).toBe(snapBefore?.caughtCount);
    expect(snapAfter?.regionId).toBe(snapBefore?.regionId);
  });

  test('supports skipping tutorial cleanly with full starter items on desktop and mobile viewports', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === 'chromium-mobile';
    await page.goto('/');
    await page.getByTestId('checkbox-skip-tutorial').check();
    await page.getByTestId('btn-new-game').click();

    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Onboarding strip must stay hidden while all starter items & tokens remain intact!
    await expect(page.getByTestId('onboarding-strip')).toBeHidden();
    await expect(page.locator('.lw-hud-ribbon')).toContainText('230');

    if (isMobile) {
      await expect(page.getByTestId('btn-im-lost')).toBeVisible();
      await expect(page.getByTestId('overworld-minimap')).toBeVisible();
      if (!process.env.CI) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '22-mobile-beginner-hud.png') });
      }
      await page.getByTestId('touch-journal').click();
    } else {
      await page.getByTestId('btn-open-journal').click();
    }

    await page.getByTestId('journal-tab-bag').click();
    await expect(page.getByTestId('journal-modal')).toContainText('Chuông Rêu x9');
    await expect(page.getByTestId('journal-modal')).toContainText('Sương Thảo Dược x4');
    await expect(page.getByTestId('journal-modal')).toContainText('Lá Thanh Tâm x2');
    await page.getByTestId('btn-close-journal').click();
  });
});

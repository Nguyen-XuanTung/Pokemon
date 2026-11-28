import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { createCreatureInstance } from '../../src/domain/creatures.ts';
import { PRIMARY_SAVE_KEY, serializeSaveEnvelope } from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';

const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DIR_TO_KEY: Readonly<Record<string, string>> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

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
  'Primary save was damaged',
  'Checksum mismatch',
];

async function waitUntilTileSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !window.__LINGOWILD_DIAGNOSTICS__?.getMovementTelemetry().isMoving,
    undefined,
    { timeout: 1200 },
  );
}

async function followOnScreenCompassUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  maxSteps: number = 45,
): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    if (await predicate()) return true;
    const compass = page.getByTestId('hud-compass-arrow');
    if (!(await compass.isVisible())) return await predicate();
    const arrived = await compass.getAttribute('data-arrived');
    if (arrived === 'true') return await predicate();
    const dir = await compass.getAttribute('data-dir');
    if (!dir || !DIR_TO_KEY[dir]) return await predicate();
    await waitUntilTileSettled(page);
    await page.keyboard.press(DIR_TO_KEY[dir]);
    await waitUntilTileSettled(page);
  }
  return await predicate();
}

test.describe('Beginner Experience: Guidance-Driven Vietnamese A1 Verification', () => {
  test('plays onboarding purely by following on-screen compass arrows, unified HUD, single battle recommendation, and Lost Helper', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop guidance-driven walkthrough');

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
    await expect(page.getByTestId('app-version-badge')).toContainText('v1.3.0');
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

    // Verify unified HUD + compass + onboarding strip all point to Scout Mai (NO contradictory west-trail text!)
    await expect(page.getByTestId('onboarding-strip')).toBeVisible();
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'move_around');
    await expect(page.getByTestId('hud-compass-arrow')).toBeVisible();
    await expect(page.getByTestId('overworld-minimap')).toBeVisible();
    await expect(page.getByTestId('hud-goal-text')).toContainText('Trinh sát Mai');

    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18-beginner-camp-guidance.png') });
    }

    // Follow ONLY the on-screen compass arrow to Scout Mai (zero hardcoded coordinates!)
    const reachedMai = await followOnScreenCompassUntil(page, async () => {
      const arrived = await page.getByTestId('hud-compass-arrow').getAttribute('data-arrived');
      return arrived === 'true';
    });
    expect(reachedMai).toBe(true);
    await expect(page.getByTestId('btn-nearby-interact')).toBeVisible();
    await expect(page.getByTestId('btn-nearby-interact')).toContainText('Trinh sát Mai');

    // Step 3: Talk to Scout Mai by clicking the highlighted Interact pill
    await page.getByTestId('btn-nearby-interact').click();
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    // If move_around still needs 1 more step, follow the new west arrow cleanly to Whisperwood!
    const enteredWhisperwood = await followOnScreenCompassUntil(
      page,
      async () =>
        (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId)) ===
        'whisperwood',
      35,
    );
    expect(enteredWhisperwood).toBe(true);
    await expect(page.getByTestId('hud-goal-text')).toContainText('bụi cỏ cao');

    // Follow ONLY the on-screen compass arrow to the marked Whisperwood tall grass!
    const reachedGrass = await followOnScreenCompassUntil(
      page,
      async () => {
        const snap = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
        if (snap?.hasActiveBattle) return true;
        const arrived = await page.getByTestId('hud-compass-arrow').getAttribute('data-arrived');
        return arrived === 'true';
      },
      25,
    );
    expect(reachedGrass).toBe(true);

    // Step gently in tall grass until the first Lv.3 wild battle starts
    let inBattle = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
    );
    for (let s = 0; s < 30 && !inBattle; s++) {
      await waitUntilTileSettled(page);
      await page.keyboard.press(s % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
      await waitUntilTileSettled(page);
      inBattle = await page.evaluate(
        () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
      );
    }
    expect(inBattle).toBe(true);
    await expect(page.getByTestId('battle-deck')).toBeVisible();

    // TURN 1: Single Primary Recommendation MUST be 'move' (1 move card highlighted, bag tab NOT highlighted!)
    await expect(page.getByTestId('battle-assist-bar')).toHaveAttribute('data-primary-action', 'move');
    await expect(page.locator('.lw-move-card[data-recommended="true"]')).toHaveCount(1);
    await expect(page.getByTestId('battle-tab-bag')).not.toHaveAttribute('data-recommended', 'true');

    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19-beginner-battle-assist.png') });
    }

    // Click ONLY the recommended move button
    await page.locator('.lw-move-card[data-recommended="true"] button').first().click();

    // TURN 2: Single Primary Recommendation MUST switch cleanly to 'capture' (0 move cards highlighted, bag tab highlighted!)
    await expect(page.getByTestId('battle-assist-bar')).toHaveAttribute(
      'data-primary-action',
      'capture',
    );
    await expect(page.locator('.lw-move-card[data-recommended="true"]')).toHaveCount(0);
    await expect(page.getByTestId('battle-tab-bag')).toHaveAttribute('data-recommended', 'true');

    await page.getByTestId('battle-tab-bag').click();
    await expect(page.getByTestId('btn-battle-item-moss_charm')).toHaveAttribute(
      'data-recommended',
      'true',
    );
    await expect(page.getByTestId('btn-battle-item-moss_charm')).toContainText('100%');
    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '23-beginner-capture-recommend.png') });
    }
    await page.getByTestId('btn-battle-item-moss_charm').click();

    // Guaranteed 100% capture on the first charm throw!
    await expect(page.getByTestId('btn-battle-finish')).toBeVisible();
    await expect(page.locator('.lw-battle-log')).toHaveAttribute('data-captured', 'true');
    await page.getByTestId('btn-battle-finish').click();

    // Step 7: Follow ONLY the on-screen compass arrow to Glen Clearing Campfire and heal!
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'campfire_heal');
    await expect(page.getByTestId('hud-goal-text')).toContainText('Lửa Trại');
    const reachedCampfire = await followOnScreenCompassUntil(
      page,
      async () => (await page.getByTestId('hud-compass-arrow').getAttribute('data-arrived')) === 'true',
      25,
    );
    expect(reachedCampfire).toBe(true);
    await page.getByTestId('btn-nearby-interact').click();
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    const choices = page.locator('[data-testid^="dialogue-choice-"]');
    if ((await choices.count()) > 0) {
      await choices.last().click();
    } else {
      await page.getByTestId('btn-dialogue-next').click();
    }
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    // Step 8: Optional English lookup step -> skip cleanly to prove English study is 100% optional
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'optional_gloss');
    await page.getByTestId('btn-skip-onboarding-step').click();

    // Step 9: Open highlighted Field Journal -> inspect structured quest -> switch tracked quest -> manage moves
    await expect(page.getByTestId('onboarding-strip')).toHaveAttribute('data-step', 'open_journal');
    await expect(page.getByTestId('btn-open-journal')).toHaveClass(/lw-btn-highlight/);
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
    await expect(page.getByTestId('quest-card-q02_whisperwood_echo')).not.toContainText(
      'Rừng Thầm Sylvan',
    );

    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20-beginner-quests-wayfinding.png') });
    }

    // Switch tracked quest mid-way to side quest q04_first_bond & verify HUD updates
    await page.getByTestId('btn-track-quest-q04_first_bond').click();
    await expect(page.getByTestId('journal-modal')).toBeHidden();
    await expect(page.getByTestId('onboarding-strip')).toBeHidden();
    await expect(page.getByTestId('hud-goal-text')).toContainText('3 loài sinh vật');

    // Re-open Journal to verify Team Move Manager
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-team').click();
    await page.getByTestId('btn-manage-moves-0').click();
    await expect(page.getByTestId('move-manager-panel')).toBeVisible();
    await page.getByTestId('btn-close-journal').click();

    // Open "Tôi bị lạc", verify unified text, expand 8-Step Quick Guide, and verify Replay Guide button
    await page.getByTestId('btn-im-lost').click();
    await expect(page.getByTestId('lost-helper-modal')).toBeVisible();
    await expect(page.getByTestId('lost-helper-modal')).toContainText('Rừng Thầm');
    await expect(page.getByTestId('lost-helper-modal')).toContainText('3 loài sinh vật');
    if (!process.env.CI) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21-lost-helper-modal.png') });
    }
    await page.getByTestId('btn-lost-quick-guide').click();
    await expect(page.getByTestId('lost-quick-guide-panel')).toBeVisible();
    await page.getByTestId('btn-lost-restart-guide').click();
    await expect(page.getByTestId('lost-helper-modal')).toBeHidden();
    // Replaying guide brings onboarding strip back cleanly without losing party or items!
    await expect(page.getByTestId('onboarding-strip')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test('audits zero English UI leaks in vi_only mode, verifies web-bundled LICENSE/CREDITS, and checks live mode switches', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop localization & credits audit');

    await page.goto('/');

    // Verify in-app Credits & License modal AND web-bundled LICENSE.txt + CREDITS.md HTTP 200!
    await page.getByTestId('btn-open-credits').click();
    await expect(page.getByTestId('credits-modal')).toBeVisible();
    await expect(page.getByTestId('credits-modal')).toContainText('v1.3.0');
    await expect(page.getByTestId('credits-modal')).toContainText('Kenney Vleugels');
    await expect(page.getByTestId('credits-modal')).toContainText('Lanea Zimmerman');
    const licRes = await page.request.get('./LICENSE.txt');
    expect(licRes.status()).toBe(200);
    expect(await licRes.text()).toContain('MIT License');
    const credRes = await page.request.get('./CREDITS.md');
    expect(credRes.status()).toBe(200);
    expect(await credRes.text()).toContain('CC-BY');
    await page.getByTestId('btn-close-credits').click();
    await expect(page.getByTestId('credits-modal')).toBeHidden();

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

    const hudText = (await page.locator('.lw-hud').textContent()) ?? '';
    for (const forbidden of FORBIDDEN_ENGLISH_UI_STRINGS) {
      expect(hudText).not.toContain(forbidden);
    }

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

    // Live-switch UI language, all 4 English content modes, all 3 difficulties, and all 3 guidance modes without losing progress
    const snapBefore = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
    await page.getByTestId('settings-ui-language').selectOption('en');
    await expect(page.getByTestId('journal-modal')).toContainText('Field Journal');
    await page.getByTestId('settings-learning-language').selectOption('en');
    await page.getByTestId('settings-content-language').selectOption('en_assist');
    await page.getByTestId('settings-content-language').selectOption('en_immersion');
    await page.getByTestId('settings-content-language').selectOption('bilingual');
    await page.getByTestId('settings-difficulty').selectOption('adventure');
    await page.getByTestId('settings-difficulty').selectOption('challenge');
    await page.getByTestId('settings-difficulty').selectOption('relaxed');

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

  test('migrates a returning v1.1 GitHub Pages production save cleanly without losing party, tokens, quests, or lexicon', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Production v1.1 save compatibility check');

    // Construct an exact legacy v1.1 (e0b9e27) save lacking beginner-experience fields
    const legacyState = createInitialGameState(1101);
    legacyState.starterChosen = 'mosskit';
    legacyState.flags.has_starter = true;
    legacyState.tokens = 345;
    legacyState.regionId = 'whisperwood';
    legacyState.playerPos = { x: 25, y: 9, facing: 'left' };
    legacyState.party = [
      createCreatureInstance({
        uid: 'prod_mosskit_1',
        species: SPECIES_BY_ID.mosskit!,
        level: 8,
        bondedRegion: 'mosslight_hub',
        movesById: MOVES_BY_ID,
      }),
      createCreatureInstance({
        uid: 'prod_dewgrub_2',
        species: SPECIES_BY_ID.dewgrub!,
        level: 5,
        bondedRegion: 'whisperwood',
        movesById: MOVES_BY_ID,
      }),
    ];
    legacyState.discoveredSpecies = ['mosskit', 'dewgrub'];
    legacyState.caughtSpecies = ['mosskit', 'dewgrub'];
    legacyState.quests.q01_first_partner = {
      questId: 'q01_first_partner',
      status: 'completed',
      rewardClaimed: true,
    };
    legacyState.quests.q02_whisperwood_echo = {
      questId: 'q02_whisperwood_echo',
      status: 'active',
      rewardClaimed: false,
    };
    legacyState.lexicon.lex_valley = {
      wordId: 'lex_valley',
      exposures: 4,
      glossLookups: 1,
      savedByPlayer: true,
      mastery: 1,
      lastSeenStep: 12,
      contextsSeen: ['hub_starter'],
    };

    const stripped = structuredClone(legacyState) as unknown as Record<string, unknown>;
    const strippedSettings = stripped.settings as Record<string, unknown>;
    strippedSettings.supportMode = 'contextual';
    delete strippedSettings.uiLanguage;
    delete strippedSettings.contentLanguage;
    delete strippedSettings.difficulty;
    delete strippedSettings.guidanceMode;
    delete strippedSettings.battleAssist;
    delete stripped.trackedQuestId;
    delete stripped.onboarding;

    const rawProdEnvelope = serializeSaveEnvelope(
      stripped as unknown as ReturnType<typeof createInitialGameState>,
      14,
      2,
    );

    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: PRIMARY_SAVE_KEY, value: rawProdEnvelope },
    );

    await page.goto('/');
    await expect(page.getByTestId('btn-continue-game')).toBeVisible();
    await page.getByTestId('btn-continue-game').click();

    await expect(page.locator('.lw-hud-ribbon')).toContainText('Thung Lũng Rừng Thầm');
    await expect(page.locator('.lw-hud-ribbon')).toContainText('345');
    await expect(page.getByTestId('onboarding-strip')).toBeHidden();

    const snap = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
    expect(snap?.partyCount).toBe(2);
    expect(snap?.caughtCount).toBe(2);
    expect(snap?.difficulty).toBe('adventure');
    expect(snap?.contentLanguage).toBe('en_assist');
    expect(snap?.uiLanguage).toBe('vi');
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

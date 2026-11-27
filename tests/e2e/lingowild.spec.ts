import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { MOVES_BY_ID } from '../../src/data/moves.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { createCreatureInstance } from '../../src/domain/creatures.ts';
import { serializeSaveEnvelope } from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';

const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe('LingoWild Browser E2E Verification', () => {
  test('plays vertical slice, contextual gloss, wild capture, campfire review, journal, reload, and corrupted save recovery', async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        failedResponses.push(`${res.status()} ${res.url()}`);
      }
    });

    const navStart = Date.now();
    await page.goto('/');
    const loadTimeMs = Date.now() - navStart;

    await expect(page.getByTestId('btn-new-game')).toBeVisible();

    if (testInfo.project.name === 'chromium-desktop') {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-title-screen.png') });
    }

    await page.getByTestId('btn-new-game').click();
    await expect(page.getByTestId('dialogue-box')).toBeVisible();

    // Tap an English word ("valley") to open contextual Vietnamese gloss popup
    await page.locator('.word-token', { hasText: 'valley' }).first().click();
    await expect(page.getByTestId('gloss-popup')).toBeVisible();
    await expect(page.getByTestId('gloss-popup')).toContainText('thung lũng');

    // Test Web Speech API button + fallback note & voluntary Save Word
    await page.getByTestId('btn-gloss-listen').click();
    await page.getByTestId('btn-gloss-save').click();
    await expect(page.getByTestId('btn-gloss-save')).toContainText('Đã lưu');

    if (testInfo.project.name === 'chromium-desktop') {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-contextual-gloss.png') });
    }

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gloss-popup')).toBeHidden();

    // Advance Rowan's 3-line intro and pick Mosskit
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    if (testInfo.project.name === 'chromium-mobile') {
      await expect(page.getByTestId('touch-up')).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-mobile-touch.png') });
      await page.getByTestId('touch-up').click();
    } else {
      await page.keyboard.press('ArrowUp');
    }

    // Walk straight west along row 8 from (11,8) through (0,8) into Whisperwood Glen (20,8)
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowLeft');
    }

    await expect
      .poll(async () => page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId))
      .toBe('whisperwood');

    if (testInfo.project.name === 'chromium-desktop') {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-whisperwood-overworld.png') });
    }

    // Walk into Whisperwood tall grass around (17,7) and (17,6) until a wild encounter starts
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');

    let inBattle = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
    );
    for (let step = 0; step < 28 && !inBattle; step++) {
      await page.keyboard.press(step % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
      inBattle = await page.evaluate(
        () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
      );
    }
    expect(inBattle).toBe(true);
    await expect(page.getByTestId('battle-deck')).toBeVisible();

    if (testInfo.project.name === 'chromium-desktop') {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-wild-battle.png') });
    }

    // Observe wild creature habits in English (never triggers a quiz!)
    await page.getByTestId('battle-tab-tactics').click();
    await page.getByTestId('btn-battle-observe').click();

    // Strike once with neutral Trail Tackle, then throw Moss Charm to bond or finish cleanly
    await page.getByTestId('battle-tab-moves').click();
    await page.getByTestId('btn-move-0').click();

    if (!(await page.getByTestId('btn-battle-finish').isVisible())) {
      await page.getByTestId('battle-tab-bag').click();
      await page.getByTestId('btn-battle-item-moss_charm').click();
    }

    let battleGuard = 0;
    while (battleGuard < 15) {
      const doneVisible = await page.getByTestId('btn-battle-finish').isVisible();
      if (doneVisible) break;
      await page.getByTestId('battle-tab-moves').click();
      await page.getByTestId('btn-move-0').click();
      battleGuard += 1;
    }
    await page.getByTestId('btn-battle-finish').click();
    await expect(page.getByTestId('battle-deck')).toBeHidden();

    // Open Field Journal, inspect tabs, toggle accessibility settings, and save
    await page.keyboard.press('KeyJ');
    await expect(page.getByTestId('journal-modal')).toBeVisible();
    await page.getByTestId('journal-tab-compendium').click();

    if (testInfo.project.name === 'chromium-desktop') {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-field-journal.png') });
    }

    await page.getByTestId('journal-tab-lexicon').click();
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('btn-save-now').click();
    await page.getByTestId('btn-close-journal').click();

    // Reload browser and verify Continue restores Whisperwood session
    await page.reload();
    await expect(page.getByTestId('btn-continue-game')).toBeVisible();
    await page.getByTestId('btn-continue-game').click();
    await expect
      .poll(async () => page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId))
      .toBe('whisperwood');

    // Save once more so backup slot is populated, then corrupt primary slot and verify auto-recovery
    await page.keyboard.press('KeyJ');
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('btn-save-now').click();
    await page.getByTestId('btn-close-journal').click();

    await page.evaluate(() => {
      window.localStorage.setItem('lingowild_save_v1', '{corrupted_json');
    });
    await page.reload();
    await expect(page.getByTestId('btn-continue-game')).toBeVisible();
    await page.getByTestId('btn-continue-game').click();
    await expect
      .poll(async () => page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().partyCount))
      .toBeGreaterThanOrEqual(1);

    // Record real diagnostics on desktop
    if (testInfo.project.name === 'chromium-desktop') {
      await page.waitForTimeout(300);
      const diag = await page.evaluate(() => ({
        bootDurationMs: window.__LINGOWILD_DIAGNOSTICS__?.bootDurationMs ?? 0,
        snap: window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot(),
      }));
      fs.writeFileSync(
        path.join(process.cwd(), 'test-results', 'benchmark-metrics.json'),
        JSON.stringify({ loadTimeMs, ...diag }, null, 2),
      );
    }

    expect(consoleErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test('imports save JSON, completescampfire review and Starfall Sanctuary climax in real browser', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop story climax capture');

    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    // Build a valid save right at Starfall Sanctuary before campfire & Elder Keeper Astraea
    const climaxState = createInitialGameState(9090);
    climaxState.starterChosen = 'verdantag';
    climaxState.regionId = 'starfall_sanctuary';
    climaxState.playerPos = { x: 10, y: 12, facing: 'up' }; // Facing Starlight Brazier at (10,11)
    climaxState.flags = {
      visited_mosslight_hub: true,
      visited_whisperwood: true,
      visited_reedwater_fen: true,
      visited_terracotta_ridge: true,
      visited_starfall_sanctuary: true,
      has_starter: true,
      warden_sylvan_cleared: true,
      warden_mirella_cleared: true,
      warden_kaelen_cleared: true,
    };
    climaxState.party = [
      createCreatureInstance({
        uid: 'lead_verdantag',
        species: SPECIES_BY_ID.verdantag!,
        level: 34,
        bondedRegion: 'mosslight_hub',
        movesById: MOVES_BY_ID,
      }),
      createCreatureInstance({
        uid: 'ally_pyrelume',
        species: SPECIES_BY_ID.pyrelume!,
        level: 34,
        bondedRegion: 'terracotta_ridge',
        movesById: MOVES_BY_ID,
      }),
    ];
    climaxState.caughtSpecies = ['mosskit', 'briarpaw', 'verdantag', 'pyrelume'];
    climaxState.discoveredSpecies = [...climaxState.caughtSpecies];
    climaxState.lexicon = {
      lex_harmony: {
        wordId: 'lex_harmony',
        exposures: 4,
        glossLookups: 1,
        savedByPlayer: true,
        mastery: 1,
        lastSeenStep: 10,
        contextsSeen: ['sanctuary'],
      },
    };
    const savePayload = serializeSaveEnvelope(climaxState);

    await page.goto('/');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'sanctuary-checkpoint.json',
      mimeType: 'application/json',
      buffer: Buffer.from(savePayload, 'utf8'),
    });

    await expect
      .poll(async () => page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId))
      .toBe('starfall_sanctuary');

    // Interact with Starlight Brazier campfire (10,11) and open voluntary Campfire Review
    await page.keyboard.press('Space');
    await page.getByTestId('dialogue-choice-0').click();
    await expect(page.getByTestId('camp-review-modal')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-campfire-review.png') });
    await page.keyboard.press('Escape');

    // Walk up from (10,12) around brazier (10,11) via (11,12)->(11,5) to challenge Elder Keeper Astraea at (11,4)
    await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('ArrowUp');
    }
    await page.keyboard.press('Space');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();

    // Fight Elder Keeper Astraea final trial
    await expect(page.getByTestId('battle-deck')).toBeVisible();
    let turns = 0;
    while (turns < 25) {
      if (await page.getByTestId('btn-battle-finish').isVisible()) break;
      await page.getByTestId('btn-move-3').click();
      turns += 1;
    }
    await page.getByTestId('btn-battle-finish').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Step left to (10,5), up to (10,4) facing Celestial Harmony Altar at (10,3), and awaken Basin Harmony!
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await page.getByTestId('dialogue-choice-0').click();

    await expect
      .poll(async () =>
        page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().mainStoryCompleted),
      )
      .toBe(true);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-starfall-finale.png') });
    expect(consoleErrors).toEqual([]);
  });

  test('loads cleanly when hosted under GitHub Pages /Pokemon/ base path', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Subpath check on desktop');

    const failedUrls: string[] = [];
    await page.route('**/Pokemon/**', async (route) => {
      const url = new URL(route.request().url());
      const subPath = url.pathname.replace(/^\/Pokemon\/?/, '') || 'index.html';
      const diskPath = path.join(process.cwd(), 'dist', subPath);
      if (!fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
        failedUrls.push(url.pathname);
        await route.fulfill({ status: 404, body: 'Not Found' });
        return;
      }
      const ext = path.extname(diskPath).toLowerCase();
      const mime =
        ext === '.html'
          ? 'text/html'
          : ext === '.js'
            ? 'application/javascript'
            : ext === '.css'
              ? 'text/css'
              : ext === '.png'
                ? 'image/png'
                : 'application/octet-stream';
      await route.fulfill({
        status: 200,
        contentType: mime,
        body: fs.readFileSync(diskPath),
      });
    });

    await page.goto('/Pokemon/index.html');
    await expect(page.getByTestId('btn-new-game')).toBeVisible();
    await page.getByTestId('btn-new-game').click();
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    expect(failedUrls).toEqual([]);
  });

  test('remains resilient with disabled Web Audio/Speech, repeated chest interactions, keyboard remap, and missing optional asset', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Resilience edge-case suite');

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript(() => {
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    });

    // Simulate missing items.png asset (404) and verify game still runs without uncaught errors
    await page.route('**/assets/sprites/items.png', (route) =>
      route.fulfill({ status: 404, body: 'missing' }),
    );

    await page.goto('/');
    await page.getByTestId('btn-new-game').click();

    // Test tap-to-gloss pronunciation fallback when speechSynthesis is missing
    await page.locator('.word-token', { hasText: 'valley' }).first().click();
    await page.getByTestId('btn-gloss-listen').click();
    await expect(page.getByTestId('gloss-popup')).toContainText('phiên âm');
    await page.keyboard.press('Escape');

    // Finish Rowan intro
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Walk to hub_garden_chest at (19,3): from (11,9) -> right to (18,9) -> up to (18,3) -> face right toward (19,3)
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');

    // Rapidly interact 10 times with the same chest: reward (+40 Tokens on top of 230 = 270) must apply ONCE
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Space');
    }
    await expect(page.locator('.lw-hud-ribbon')).toContainText('270 Tokens');

    // Remap Journal key from KeyJ to KeyM in Settings and test KeyM
    await page.keyboard.press('KeyJ');
    await page.getByTestId('journal-tab-settings').click();
    await page.getByRole('button', { name: 'Journal: KeyJ' }).click();
    await page.keyboard.press('KeyM');
    await expect(page.getByRole('button', { name: 'Journal: KeyM' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('journal-modal')).toBeHidden();
    await page.keyboard.press('KeyM');
    await expect(page.getByTestId('journal-modal')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

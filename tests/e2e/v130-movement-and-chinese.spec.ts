import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PRIMARY_SAVE_KEY, serializeSaveEnvelope } from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';
import { createCreatureInstance } from '../../src/domain/creatures.ts';
import { SPECIES_BY_ID } from '../../src/data/species.ts';
import { MOVES_BY_ID } from '../../src/data/moves.ts';

async function clickTile(page: Page, tileX: number, tileY: number): Promise<void> {
  const pt = await page.evaluate(
    ({ x, y }) => window.__LINGOWILD_DIAGNOSTICS__?.getTileClientCenter(x, y) ?? null,
    { x: tileX, y: tileY },
  );
  expect(pt, `Tile (${tileX},${tileY}) should project inside viewport`).not.toBeNull();
  await page.mouse.click(pt!.x, pt!.y);
}

async function waitUntilAutoPathIdle(page: Page, timeoutMs: number = 10_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const tel = window.__LINGOWILD_DIAGNOSTICS__?.getMovementTelemetry();
      return Boolean(tel && !tel.isMoving && tel.activePathLength === 0);
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function startFreshGameSkipTutorial(
  page: Page,
  opts?: { learningLanguage?: 'en' | 'zh' | 'none'; hskLevel?: 'HSK1' | 'HSK2' | 'HSK3' },
): Promise<void> {
  await page.goto('/');
  if (opts?.learningLanguage) {
    await page.getByTestId('select-learning-language').selectOption(opts.learningLanguage);
  }
  if (opts?.hskLevel && opts.learningLanguage === 'zh') {
    await page.getByTestId('select-hsk-level').selectOption(opts.hskLevel);
  }
  await page.getByTestId('checkbox-skip-tutorial').check();
  await page.getByTestId('btn-new-game').click();
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await page.getByTestId('btn-dialogue-next').click();
  await page.getByTestId('btn-dialogue-next').click();
  await page.getByTestId('dialogue-choice-0').click(); // Mosskit
  await page.getByTestId('btn-dialogue-next').click();
  await page.getByTestId('btn-dialogue-next').click();
  await expect(page.getByTestId('dialogue-box')).toBeHidden();
}

test.describe('LingoWild v1.3.0: Click-to-Move, Smooth Movement & Chinese HSK Learning', () => {
  test('verifies full click-to-move interaction suite, UI isolation, resize accuracy, and settings toggle', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop click-to-move verification');
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    await startFreshGameSkipTutorial(page, { learningLanguage: 'en' });

    // 1. Click UI / HUD / Minimap must NOT trigger overworld movement
    const posBeforeUiClick = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos,
    );
    await page.getByTestId('overworld-minimap').click();
    await expect(page.getByTestId('journal-modal')).toBeVisible();
    await page.getByTestId('btn-close-journal').click();
    const posAfterUiClick = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos,
    );
    expect(posAfterUiClick).toEqual(posBeforeUiClick);

    // 2. Click empty tile (13, 12) -> auto-walks cleanly and lands exactly on (13, 12)
    await clickTile(page, 13, 12);
    await waitUntilAutoPathIdle(page);
    const posEmpty = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos,
    );
    expect(posEmpty?.x).toBe(13);
    expect(posEmpty?.y).toBe(12);

    // 3. Click Signpost at (11, 13) -> auto-walks adjacent & opens sign dialogue once
    await clickTile(page, 11, 13);
    await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId('dialogue-box')).toContainText('Whisperwood');
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    // 4. Click Campfire at (13, 9) -> auto-walks adjacent & opens campfire dialogue
    await clickTile(page, 13, 9);
    await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 7000 });
    await page.locator('[data-testid^="dialogue-choice-"]').last().click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    // 5. Click NPC Scout Mai at (16, 15) -> walks around campfire/plaza and speaks ONCE
    await clickTile(page, 16, 15);
    await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 8000 });
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    // 6. Click blocked Water tile at (10, 17) -> rejected cleanly, player does NOT clip onto water
    await clickTile(page, 10, 17);
    await page.waitForTimeout(260);
    const posAfterWater = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos,
    );
    expect(posAfterWater?.x).not.toBe(10);
    expect(posAfterWater?.y).not.toBe(17);

    // 7. Re-target mid-walk + cancel by manual keyboard press
    await clickTile(page, 12, 12);
    await page.waitForTimeout(180);
    await clickTile(page, 19, 12); // Re-target right away
    await page.waitForTimeout(180);
    await page.keyboard.press('ArrowUp'); // Manual input cancels auto-path immediately!
    await page.waitForTimeout(250);
    const telAfterManual = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getMovementTelemetry(),
    );
    expect(telAfterManual?.activePathLength).toBe(0);

    // 8. Click Locked East Portal (31, 12) after moving close -> opens gate explanation
    await clickTile(page, 28, 12);
    await waitUntilAutoPathIdle(page, 12_000);
    await clickTile(page, 31, 12);
    await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 6000 });
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();
    const stillInHub = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId,
    );
    expect(stillInHub).toBe('mosslight_hub');

    // 9. Resize viewport dynamically and verify click-to-move coordinate accuracy still hits exact tile
    await page.setViewportSize({ width: 960, height: 600 });
    await page.waitForTimeout(200);
    await clickTile(page, 24, 12);
    await waitUntilAutoPathIdle(page, 8000);
    const posAfterResize = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos,
    );
    expect(posAfterResize?.x).toBe(24);
    expect(posAfterResize?.y).toBe(12);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(160);

    // 10. Toggle clickToMove OFF in Settings -> clicking map no longer starts auto-path
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('settings-click-to-move').uncheck();
    await page.getByTestId('btn-close-journal').click();
    await clickTile(page, 21, 12);
    await page.waitForTimeout(260);
    const posDisabled = await page.evaluate(
      () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos,
    );
    expect(posDisabled?.x).toBe(24);

    // Re-enable clickToMove, walk to West Portal (0, 12) and transition cleanly into Whisperwood!
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('settings-click-to-move').check();
    await page.getByTestId('settings-movement-speed').selectOption('run');
    await page.getByTestId('btn-close-journal').click();

    await clickTile(page, 14, 12);
    await waitUntilAutoPathIdle(page, 8000);
    await clickTile(page, 4, 12);
    await waitUntilAutoPathIdle(page, 8000);
    await clickTile(page, 0, 12);
    await expect
      .poll(async () => page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId), {
        timeout: 8000,
      })
      .toBe('whisperwood');

    // 11. Click-to-move into tall grass until wild battle interrupts -> must NOT auto-resume after closing battle!
    await clickTile(page, 27, 12);
    await waitUntilAutoPathIdle(page, 6000);
    let hitBattle = false;
    for (let attempt = 0; attempt < 6 && !hitBattle; attempt++) {
      await clickTile(page, 27, attempt % 2 === 0 ? 6 : 11);
      await page.waitForTimeout(900);
      hitBattle = await page.evaluate(
        () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
      );
    }
    if (hitBattle) {
      await page.getByTestId('battle-tab-tactics').click();
      await page.getByTestId('btn-battle-flee').click();
      const finishBtn = page.getByTestId('btn-battle-finish');
      if (await finishBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await finishBtn.click();
      }
      await page.waitForTimeout(350);
      const telAfterBattle = await page.evaluate(
        () => window.__LINGOWILD_DIAGNOSTICS__?.getMovementTelemetry(),
      );
      expect(telAfterBattle?.activePathLength).toBe(0);
      expect(telAfterBattle?.isMoving).toBe(false);
    }

    expect(consoleErrors).toEqual([]);
  });

  test('verifies continuous smooth hold-key & touch movement, direction reversal, walk vs run speed, and records v1.3.0 benchmark', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === 'chromium-mobile';
    await startFreshGameSkipTutorial(page, { learningLanguage: 'en' });

    // Move up 1 tile to open central horizontal lane y=12 (x=1..30 clear!)
    await page.keyboard.press('ArrowUp');
    await waitUntilAutoPathIdle(page);

    if (isMobile) {
      // Mobile continuous touch hold + tap-to-move on canvas in portrait & landscape
      const xStart = (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos.x)) ?? 15;
      await page.getByTestId('touch-left').dispatchEvent('pointerdown', { pointerId: 7 });
      await page.waitForTimeout(1050);
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 })));
      await waitUntilAutoPathIdle(page);
      const xAfter = (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos.x)) ?? 15;
      expect(xStart - xAfter).toBeGreaterThanOrEqual(5);

      // Tap canvas in portrait to walk back right
      await clickTile(page, xAfter + 3, 12);
      await waitUntilAutoPathIdle(page);
      const xPortraitClick = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos.x);
      expect(xPortraitClick).toBe(xAfter + 3);

      // Rotate to landscape (915x412) and tap canvas again
      await page.setViewportSize({ width: 915, height: 412 });
      await page.waitForTimeout(200);
      await clickTile(page, xAfter + 1, 12);
      await waitUntilAutoPathIdle(page);
      const xLandClick = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos.x);
      expect(xLandClick).toBe(xAfter + 1);
      return;
    }

    // Desktop: measure continuous keyboard hold smoothness + DOM mutation count + walk vs run
    await page.evaluate(() => {
      const overlay = document.getElementById('ui-overlay');
      (window as unknown as Record<string, unknown>).__v130_mutations = 0;
      if (overlay) {
        const mo = new MutationObserver((recs) => {
          for (const r of recs) {
            // Count full overlay childList wipes or touch-pad teardown
            if (r.target === overlay && r.type === 'childList') {
              const winRec = window as unknown as Record<string, number>;
              winRec.__v130_mutations = (winRec.__v130_mutations ?? 0) + 1;
            }
          }
        });
        mo.observe(overlay, { childList: true });
      }
      const samples: Array<{ t: number; x: number; y: number; vx: number; vy: number }> = [];
      (window as unknown as Record<string, unknown>).__v130_samples = samples;
      (window as unknown as Record<string, unknown>).__v130_recording = true;
      const tick = () => {
        if (!(window as unknown as Record<string, boolean>).__v130_recording) return;
        const snap = window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot();
        const tel = window.__LINGOWILD_DIAGNOSTICS__?.getMovementTelemetry();
        if (snap && tel) {
          samples.push({
            t: performance.now(),
            x: snap.playerPos.x,
            y: snap.playerPos.y,
            vx: tel.visualX,
            vy: tel.visualY,
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // Hold ArrowLeft for 1500ms (walk speed ~165ms/tile -> ~8-9 tiles continuously!)
    const tWalkStart = await page.evaluate(() => performance.now());
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(1500);
    // Crisp immediate direction reversal without releasing first: press ArrowRight while reversing
    await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(1500);
    // Hold Shift (run speed ~110ms/tile) + ArrowLeft for 1200ms
    const tRunStart = await page.evaluate(() => performance.now());
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(1200);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ShiftLeft');
    await waitUntilAutoPathIdle(page);

    const bench = await page.evaluate(
      ({ walkStart, runStart }) => {
        (window as unknown as Record<string, boolean>).__v130_recording = false;
        const samples =
          (
            window as unknown as Record<
              string,
              Array<{ t: number; x: number; y: number; vx: number; vy: number }>
            >
          ).__v130_samples ?? [];
        const overlayRootWipes = (window as unknown as Record<string, number>).__v130_mutations ?? 0;
        const tileTransitions: Array<{ t: number; phase: 'walk' | 'run' }> = [];
        let prevX = samples[0]?.x ?? 0;
        let prevY = samples[0]?.y ?? 0;
        for (const s of samples) {
          if (s.x !== prevX || s.y !== prevY) {
            tileTransitions.push({ t: s.t, phase: s.t >= runStart ? 'run' : 'walk' });
            prevX = s.x;
            prevY = s.y;
          }
        }
        const walkIntervals: number[] = [];
        const runIntervals: number[] = [];
        for (let i = 1; i < tileTransitions.length; i++) {
          const prev = tileTransitions[i - 1]!;
          const cur = tileTransitions[i]!;
          const dt = Math.round(cur.t - prev.t);
          if (cur.phase === 'walk' && prev.phase === 'walk' && prev.t >= walkStart) {
            walkIntervals.push(dt);
          } else if (cur.phase === 'run' && prev.phase === 'run') {
            runIntervals.push(dt);
          }
        }
        const frameDeltas: number[] = [];
        for (let i = 1; i < samples.length; i++) {
          const d = Math.hypot(
            samples[i]!.vx - samples[i - 1]!.vx,
            samples[i]!.vy - samples[i - 1]!.vy,
          );
          if (d > 0.01) frameDeltas.push(d);
        }
        const stats = (arr: number[]) =>
          arr.length === 0
            ? { count: 0, meanMs: 0, minMs: 0, maxMs: 0 }
            : {
                count: arr.length,
                meanMs: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
                minMs: Math.min(...arr),
                maxMs: Math.max(...arr),
              };
        return {
          totalTilesMoved: tileTransitions.length,
          walk: stats(walkIntervals),
          run: stats(runIntervals),
          walkIntervalsMs: walkIntervals,
          runIntervalsMs: runIntervals,
          overlayRootWipes,
          smoothVisualFrames: frameDeltas.length,
        };
      },
      { walkStart: tWalkStart, runStart: tRunStart },
    );

    // Must move many tiles continuously (vs v1.2.0 baseline where keyboard hold moved only 1 tile!)
    expect(bench.totalTilesMoved).toBeGreaterThanOrEqual(20);
    // Run phase must be measurably faster per tile than walk phase
    expect(bench.run.meanMs).toBeLessThan(bench.walk.meanMs);
    // Zero full overlay root wipes during pure overworld walking (vs 36 mutations in v1.2.0!)
    expect(bench.overlayRootWipes).toBe(0);
    // Visual coordinates interpolate smoothly across frames
    expect(bench.smoothVisualFrames).toBeGreaterThanOrEqual(60);

    // Test blur safety: holding a key then blurring window must immediately stop movement
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await waitUntilAutoPathIdle(page);
    const posAtBlur = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos);
    await page.waitForTimeout(450);
    const posAfterBlur = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos);
    expect(posAfterBlur).toEqual(posAtBlur);
    await page.keyboard.up('ArrowRight');

    fs.mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });
    fs.writeFileSync(
      path.join(process.cwd(), 'test-results', 'v130-movement-benchmark.json'),
      JSON.stringify(bench, null, 2),
    );
  });

  test('verifies full Chinese HSK 2 workflow: Pinyin above/below, 10-field gloss, Mandarin voice safety, campfire review, live language switch, and v1.2.0 save migration', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop Chinese HSK 2 learning suite');

    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    // Mock speechSynthesis with ONLY English voices to prove we NEVER read Chinese with an English voice!
    await page.addInitScript(() => {
      (window as unknown as Record<string, number>).__speakCallCount = 0;
      const fakeSynth = {
        getVoices: () => [{ lang: 'en-US', name: 'English Mock Voice', default: true }],
        speak: () => {
          const winRec = window as unknown as Record<string, number>;
          winRec.__speakCallCount = (winRec.__speakCallCount ?? 0) + 1;
        },
        cancel: () => {},
        addEventListener: () => {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });
    });

    await page.goto('/');
    await page.getByTestId('select-learning-language').selectOption('zh');
    await expect(page.getByTestId('select-hsk-level')).toHaveValue('HSK2');
    await expect(page.getByTestId('select-zh-study-mode')).toHaveValue('hanzi_pinyin_vi');
    await page.getByTestId('checkbox-skip-tutorial').check();
    await page.getByTestId('btn-new-game').click();

    // 1. Verify HSK 2 dialogue with segmented Hanzi, Pinyin above, and Vietnamese translation
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await expect(page.getByTestId('dialogue-level-badge')).toContainText('HSK 2');
    await expect(page.getByTestId('dialogue-zh-text')).toBeVisible();
    await expect(page.locator('.zh-token .zh-pinyin').first()).toBeVisible();
    await expect(page.getByTestId('dialogue-vi-translation')).toBeVisible();

    // 2. Test Mandarin Listen fallback when ONLY English voice exists: must NOT call speak()!
    await page.getByTestId('btn-dialogue-listen').click();
    await expect(page.getByTestId('dialogue-speech-note')).toContainText('zh-CN');
    const speakCalls = await page.evaluate(
      () => (window as unknown as Record<string, number>).__speakCallCount,
    );
    expect(speakCalls).toBe(0);

    // 3. Toggle Pinyin & Translation cleanly inside dialogue
    await page.getByTestId('btn-toggle-pinyin').click();
    await expect(page.locator('.zh-token .zh-pinyin')).toHaveCount(0);
    await page.getByTestId('btn-toggle-pinyin').click();
    await expect(page.locator('.zh-token .zh-pinyin').first()).toBeVisible();

    await page.getByTestId('btn-toggle-vi').click();
    await expect(page.getByTestId('dialogue-vi-translation')).toBeHidden();
    await page.getByTestId('btn-toggle-vi').click();
    await expect(page.getByTestId('dialogue-vi-translation')).toBeVisible();

    // 4. Tap Proper Noun ("苔灯营地") -> verify Proper Noun card (excluded from HSK)
    await page.locator('.zh-token-proper').first().click();
    await expect(page.getByTestId('gloss-popup')).toBeVisible();
    await expect(page.getByTestId('gloss-popup')).toHaveAttribute('data-gloss-lang', 'zh_proper');
    await expect(page.getByTestId('gloss-popup')).toContainText('Tên riêng');
    await page.getByTestId('btn-gloss-close').click();

    // 5. Tap HSK word ("欢迎") -> verify 10-field Chinese gloss popup & save to Chinese notebook!
    await page.locator('.zh-token[data-hanzi="欢迎"]').first().click();
    await expect(page.getByTestId('gloss-popup')).toBeVisible();
    await expect(page.getByTestId('gloss-popup')).toHaveAttribute('data-gloss-lang', 'zh');
    await expect(page.getByTestId('gloss-popup')).toContainText('huānyíng');
    await expect(page.getByTestId('gloss-popup')).toContainText('HSK2');
    await expect(page.getByTestId('gloss-popup')).toContainText('hoan nghênh');
    await page.getByTestId('btn-gloss-listen').click();
    await expect(page.getByTestId('gloss-speech-note')).toContainText('zh-CN');
    await page.getByTestId('btn-gloss-save').click();
    await expect(page.getByTestId('btn-gloss-save')).toContainText('Đã lưu');
    await page.getByTestId('btn-gloss-close').click();

    // Finish Rowan intro & pick starter
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    // 6. Click Campfire (13, 9) -> open voluntary Chinese campfire review -> answer 1 card & exit freely
    await clickTile(page, 13, 9);
    await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 7000 });
    await page.getByTestId('dialogue-choice-0').click(); // Voluntary review
    await expect(page.getByTestId('camp-review-modal')).toBeVisible();
    await page.getByTestId('camp-choice-0').click();
    await expect(page.getByTestId('btn-camp-next')).toBeVisible();
    await page.locator('[data-testid="camp-review-modal"] header button').click();
    await expect(page.getByTestId('camp-review-modal')).toBeHidden();

    // 7. Live-switch learning language zh -> en -> zh and verify BOTH notebooks + progress preserved!
    const snapZh = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
    const hudBeforeSwitch = await page.locator('.lw-hud-ribbon').textContent();
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-lexicon').click();
    await expect(page.getByTestId('lexicon-notebook-zh')).toBeVisible();
    await page.getByTestId('lexicon-filter-saved').click();
    await expect(page.getByTestId('journal-modal')).toContainText('欢迎');

    // Switch Pinyin position to below, then switch to English
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('settings-pinyin-position').selectOption('below');
    await page.getByTestId('settings-learning-language').selectOption('en');
    await page.getByTestId('btn-close-journal').click();

    // Interact with Signpost (11,13) in English and save an English word!
    await clickTile(page, 11, 13);
    await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 7000 });
    await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-learning-lang', 'en');
    await page.locator('.word-token').first().click();
    await expect(page.getByTestId('gloss-popup')).toBeVisible();
    await page.getByTestId('btn-gloss-save').click();
    await page.getByTestId('btn-gloss-close').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Switch back to Chinese -> confirm BOTH English & Chinese notebooks AND party/tokens are intact!
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('settings-learning-language').selectOption('zh');
    await page.getByTestId('journal-tab-lexicon').click();
    await expect(page.getByTestId('lexicon-notebook-zh')).toBeVisible();
    await page.getByTestId('lexicon-filter-saved').click();
    await expect(page.getByTestId('journal-modal')).toContainText('欢迎');
    await page.getByTestId('lexicon-notebook-en').click();
    await page.getByTestId('lexicon-filter-saved').click();
    await expect(page.getByTestId('journal-modal')).not.toContainText('Chưa có mục từ nào');
    await page.getByTestId('btn-close-journal').click();

    const snapAfterSwitch = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
    const tokensMatch = hudBeforeSwitch?.match(/\d+\s+Huy hiệu/)?.[0];
    expect(tokensMatch).toBeTruthy();
    expect(snapAfterSwitch?.partyCount).toBe(snapZh?.partyCount);
    expect(snapAfterSwitch?.caughtCount).toBe(snapZh?.caughtCount);
    expect(snapAfterSwitch?.regionId).toBe(snapZh?.regionId);
    expect(snapAfterSwitch?.learningLanguage).toBe('zh');
    await expect(page.locator('.lw-hud-ribbon')).toContainText(tokensMatch!);

    // Verify Pinyin below class renders properly when opening Signpost in Chinese
    await clickTile(page, 11, 13);
    await expect(page.getByTestId('dialogue-box')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.zh-token-below').first()).toBeVisible();
    await page.getByTestId('btn-dialogue-next').click();

    expect(consoleErrors).toEqual([]);
  });

  test('migrates a real v1.2.0 save cleanly to v1.3.0 in browser localStorage and supports switching to Chinese', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop v1.2.0 browser migration');
    const state = createInitialGameState(1300);
    state.starterChosen = 'kindlet';
    state.flags.has_starter = true;
    state.tokens = 415;
    state.regionId = 'mosslight_hub';
    state.playerPos = { x: 15, y: 12, facing: 'down' };
    state.party = [
      createCreatureInstance({
        uid: 'v120_kindlet',
        species: SPECIES_BY_ID.kindlet!,
        level: 7,
        bondedRegion: 'mosslight_hub',
        movesById: MOVES_BY_ID,
      }),
    ];
    state.discoveredSpecies = ['kindlet'];
    state.caughtSpecies = ['kindlet'];
    state.lexicon.lex_camp = {
      wordId: 'lex_camp',
      exposures: 5,
      glossLookups: 2,
      savedByPlayer: true,
      mastery: 2,
      lastSeenStep: 20,
      contextsSeen: ['hub_starter'],
    };

    const rawObj = structuredClone(state) as unknown as Record<string, unknown>;
    rawObj.schemaVersion = 2;
    delete rawObj.lexiconZh;
    const rawSettings = rawObj.settings as Record<string, unknown>;
    delete rawSettings.learningLanguage;
    delete rawSettings.hskLevel;
    delete rawSettings.zhStudyMode;
    delete rawSettings.showPinyin;
    delete rawSettings.pinyinPosition;
    delete rawSettings.showZhTranslation;
    delete rawSettings.clickToMove;
    delete rawSettings.movementSpeed;

    const envelope = serializeSaveEnvelope(
      rawObj as unknown as ReturnType<typeof createInitialGameState>,
      19,
      2,
    );

    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: PRIMARY_SAVE_KEY, value: envelope },
    );

    await page.goto('/');
    await expect(page.getByTestId('btn-continue-game')).toBeVisible();
    await page.getByTestId('btn-continue-game').click();
    await expect(page.locator('.lw-hud-ribbon')).toContainText('415');
    await expect(page.locator('.lw-hud-ribbon')).toContainText('Kindlet');

    const migratedSnap = await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot());
    expect(migratedSnap?.learningLanguage).toBe('en');
    expect(migratedSnap?.hskLevel).toBe('HSK2');

    // Switch migrated save live to Chinese HSK 2 and verify old English saved word stays intact
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('settings-learning-language').selectOption('zh');
    await page.getByTestId('journal-tab-lexicon').click();
    await page.getByTestId('lexicon-notebook-en').click();
    await page.getByTestId('lexicon-filter-saved').click();
    await expect(page.getByTestId('journal-modal')).toContainText('camp');
  });
});

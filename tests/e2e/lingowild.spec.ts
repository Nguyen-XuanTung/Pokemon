import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Direction } from '../../src/domain/types.ts';

const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function stepDirection(page: Page, dir: Direction, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByTestId(`touch-${dir}`).click();
  } else {
    const keyMap: Record<Direction, string> = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    await page.keyboard.press(keyMap[dir]);
  }
}

async function triggerInteract(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByTestId('touch-interact').click();
  } else {
    await page.keyboard.press('Space');
  }
}

async function openJournalUi(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByTestId('touch-journal').click();
  } else {
    await page.getByTestId('btn-open-journal').click();
  }
}

test.describe('LingoWild Browser E2E Verification', () => {
  test('verifies vertical slice, wild capture reload fidelity, and mobile portrait + landscape touch ergonomics without keyboard', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === 'chromium-mobile';
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

    if (!isMobile) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-title-screen.png') });
    }

    await page.getByTestId('btn-new-game').click();
    await expect(page.getByTestId('dialogue-box')).toBeVisible();

    // Tap an English word ("valley") to open contextual Vietnamese gloss popup
    await page.locator('.word-token', { hasText: 'valley' }).first().click();
    await expect(page.getByTestId('gloss-popup')).toBeVisible();
    await expect(page.getByTestId('gloss-popup')).toContainText('thung lũng');

    await page.getByTestId('btn-gloss-listen').click();
    await page.getByTestId('btn-gloss-save').click();
    await expect(page.getByTestId('btn-gloss-save')).toContainText('Đã lưu');

    if (!isMobile) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-contextual-gloss.png') });
    }

    // Close gloss slip via UI button (works identically on mobile & desktop without keyboard!)
    await page.getByTestId('gloss-popup').getByRole('button', { name: 'Đóng' }).click();
    await expect(page.getByTestId('gloss-popup')).toBeHidden();

    // Tap a word outside the core lexicon ("Across") to verify offline Pocket Word Assist!
    await page.locator('.word-token-pocket', { hasText: 'Across' }).first().click();
    await expect(page.getByTestId('gloss-popup')).toBeVisible();
    await expect(page.getByTestId('gloss-popup')).toContainText('băng qua');
    await page.getByTestId('gloss-popup').getByRole('button', { name: 'Đóng' }).click();
    await expect(page.getByTestId('gloss-popup')).toBeHidden();

    // Advance Rowan's 3-line intro and pick Mosskit
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    if (isMobile) {
      // Verify mobile portrait viewport (412x915): zero dead space above canvas & SVG D-pad instead of U/D/L/R
      const vp = page.viewportSize()!;
      const canvasBox = await page.locator('#phaser-viewport canvas').boundingBox();
      expect(canvasBox).not.toBeNull();
      expect(canvasBox!.y).toBeLessThanOrEqual(2);
      expect(Math.abs(canvasBox!.width - vp.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(canvasBox!.height - vp.height)).toBeLessThanOrEqual(2);

      for (const dir of ['up', 'down', 'left', 'right'] as const) {
        const btn = page.getByTestId(`touch-${dir}`);
        await expect(btn).toBeVisible();
        await expect(btn.locator('svg')).toHaveCount(1);
        const txt = (await btn.textContent())?.trim() ?? '';
        expect(['U', 'D', 'L', 'R']).not.toContain(txt);
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-mobile-portrait.png') });
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-mosslight-camp.png') });
    }

    // Walk from Mosslight spawn (15,13) left 3 tiles to (12,13), inspect Basin Signpost (11,13) via touch/key interact,
    // then step up to row 12 and west 12 tiles into Whisperwood Glen (0,12)
    if (isMobile) {
      // Verify mobile hold-to-walk: holding pointerdown on touch-left moves multiple tiles continuously!
      const xBeforeHold =
        (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos.x)) ??
        15;
      await page.getByTestId('touch-left').dispatchEvent('pointerdown', { pointerId: 1 });
      await page.waitForTimeout(340);
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 })));
      const xAfterHold =
        (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos.x)) ??
        15;
      expect(xBeforeHold - xAfterHold).toBeGreaterThanOrEqual(2);
      // Walk any remaining step to (12,13) facing Signpost (11,13)
      while (
        ((await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().playerPos.x)) ??
          12) > 12
      ) {
        await stepDirection(page, 'left', true);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        await stepDirection(page, 'left', false);
      }
    }
    await triggerInteract(page, isMobile);
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await page.getByTestId('btn-dialogue-next').click();
    await expect(page.getByTestId('dialogue-box')).toBeHidden();

    await stepDirection(page, 'up', isMobile);
    for (let i = 0; i < 12; i++) {
      await stepDirection(page, 'left', isMobile);
    }

    await expect
      .poll(async () => page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId))
      .toBe('whisperwood');

    if (isMobile) {
      // Verify toast notification stays in top strip and never covers center play area
      const toastEl = page.locator('.lw-toast').first();
      if (await toastEl.isVisible()) {
        const tBox = await toastEl.boundingBox();
        const vp = page.viewportSize()!;
        expect(tBox!.y + tBox!.height).toBeLessThan(vp.height * 0.25);
      }

      // Test mobile landscape orientation (915x412) with touch controls only and verify 1:1 unstretched canvas buffer
      await page.setViewportSize({ width: 915, height: 412 });
      await page.waitForTimeout(180);
      const landBox = await page.locator('#phaser-viewport canvas').boundingBox();
      expect(Math.abs(landBox!.width - 915)).toBeLessThanOrEqual(2);
      expect(Math.abs(landBox!.height - 412)).toBeLessThanOrEqual(2);
      const bufferSize = await page.locator('#phaser-viewport canvas').evaluate((el) => ({
        w: (el as HTMLCanvasElement).width,
        h: (el as HTMLCanvasElement).height,
      }));
      expect(Math.abs(bufferSize.w - 915)).toBeLessThanOrEqual(2);
      expect(Math.abs(bufferSize.h - 412)).toBeLessThanOrEqual(2);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-mobile-landscape.png') });
      // Restore portrait for remaining steps
      await page.setViewportSize({ width: 412, height: 915 });
      await page.waitForTimeout(100);
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-whisperwood-overworld.png') });
    }

    // Walk into Whisperwood tall grass at (27,8)/(27,7) from spawn (30,12) — clear of sign at (28,11)!
    const partyCountBefore =
      (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().partyCount)) ?? 1;

    for (let i = 0; i < 3; i++) {
      await stepDirection(page, 'left', isMobile);
    }
    for (let i = 0; i < 4; i++) {
      await stepDirection(page, 'up', isMobile);
    }

    let capturedSpeciesName = '';
    let captureDone = false;

    for (let attemptLoop = 0; attemptLoop < 6 && !captureDone; attemptLoop++) {
      let inBattle = await page.evaluate(
        () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
      );
      for (let step = 0; step < 30 && !inBattle; step++) {
        await stepDirection(page, step % 2 === 0 ? 'up' : 'down', isMobile);
        inBattle = await page.evaluate(
          () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().hasActiveBattle ?? false,
        );
      }
      expect(inBattle).toBe(true);
      await expect(page.getByTestId('battle-deck')).toBeVisible();

      if (!isMobile && attemptLoop === 0) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-wild-battle.png') });
      }

      const enemyHeader = (await page.locator('.lw-plate-enemy strong').textContent()) ?? '';
      // Format: "Wild <SpeciesName> Lv.<N>"
      const match = enemyHeader.match(/^Wild\s+([A-Za-z]+)\s+Lv\.(\d+)/);
      capturedSpeciesName = match?.[1] ?? '';

      // Observe habits once on first battle
      if (attemptLoop === 0) {
        await page.getByTestId('battle-tab-tactics').click();
        await page.getByTestId('btn-battle-observe').click();
      }

      // Throw Moss Charm repeatedly until captured (or battle ends)
      for (let throwTurn = 0; throwTurn < 5; throwTurn++) {
        if (await page.getByTestId('btn-battle-finish').isVisible()) break;
        await page.getByTestId('battle-tab-bag').click();
        const charmBtn = page.getByTestId('btn-battle-item-moss_charm');
        if (!(await charmBtn.isVisible())) {
          await page.getByTestId('battle-tab-tactics').click();
          await page.getByTestId('btn-battle-flee').click();
          break;
        }
        await charmBtn.click();
      }

      if (await page.getByTestId('btn-battle-finish').isVisible()) {
        const logText = (await page.locator('.lw-battle-log').textContent()) ?? '';
        if (logText.includes('joined your')) {
          captureDone = true;
        }
        await page.getByTestId('btn-battle-finish').click();
      }
    }

    expect(captureDone).toBe(true);
    expect(capturedSpeciesName.length).toBeGreaterThan(0);

    // Verify owned party count increased by +1 and inspect exact team row before reload
    const partyCountAfter =
      (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().partyCount)) ?? 0;
    expect(partyCountAfter).toBe(partyCountBefore + 1);

    await openJournalUi(page, isMobile);
    await expect(page.getByTestId('journal-modal')).toBeVisible();

    if (!isMobile) {
      await page.getByTestId('journal-tab-map').click();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-field-journal-map.png') });
      await page.getByTestId('journal-tab-compendium').click();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-field-journal-compendium.png') });
      await page.getByTestId('journal-tab-lexicon').click();
      await expect(page.getByTestId('lexicon-filter-mastered')).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14-field-journal-lexicon.png') });
    }

    await page.getByTestId('journal-tab-team').click();
    const teamTextBeforeReload = (await page.locator('.lw-notebook-body').textContent()) ?? '';
    expect(teamTextBeforeReload).toContain(capturedSpeciesName);

    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('btn-save-now').click();
    await page.getByTestId('btn-close-journal').click();

    // Reload browser and verify captured species, count, and exact stats persist identically!
    await page.reload();
    await expect(page.getByTestId('btn-continue-game')).toBeVisible();
    await page.getByTestId('btn-continue-game').click();

    const partyCountReloaded =
      (await page.evaluate(() => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().partyCount)) ?? 0;
    expect(partyCountReloaded).toBe(partyCountAfter);

    await openJournalUi(page, isMobile);
    await page.getByTestId('journal-tab-team').click();
    const teamTextAfterReload = (await page.locator('.lw-notebook-body').textContent()) ?? '';
    expect(teamTextAfterReload).toBe(teamTextBeforeReload);
    await page.getByTestId('btn-close-journal').click();

    if (!isMobile) {
      await page.waitForTimeout(250);
      const diag = await page.evaluate(() => ({
        bootDurationMs: window.__LINGOWILD_DIAGNOSTICS__?.bootDurationMs ?? 0,
        snap: window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot(),
      }));
      fs.mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });
      fs.writeFileSync(
        path.join(process.cwd(), 'test-results', 'benchmark-metrics.json'),
        JSON.stringify({ loadTimeMs, ...diag }, null, 2),
      );
    }

    expect(consoleErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test('verifies service worker cache scoping, subresource 503 safety, mid-session network loss, and offline reload', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Service worker lifecycle suite');

    // Cold cache first load -> registers sw.js and precaches LingoWild assets
    await page.goto('/');
    await expect(page.getByTestId('btn-new-game')).toBeVisible();

    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    // Seed an unrelated origin cache AND a stale old lingowild-cache-legacy-v0, then reload so SW controls page
    await page.evaluate(async () => {
      const foreign = await caches.open('other-app-unrelated-cache-v1');
      await foreign.put('/other-app-item', new Response('keep-me'));
      const legacy = await caches.open('lingowild-cache-legacy-v0');
      await legacy.put('/legacy-item', new Response('purge-me'));
    });

    await page.reload();
    await expect(page.getByTestId('btn-new-game')).toBeVisible();

    // Verify SW controls the page and ONLY manages lingowild-cache-*
    const cacheStatus = await page.evaluate(async () => {
      const keys = await caches.keys();
      return {
        controlled: Boolean(navigator.serviceWorker.controller),
        keys,
      };
    });
    expect(cacheStatus.controlled).toBe(true);
    expect(cacheStatus.keys).toContain('other-app-unrelated-cache-v1');
    expect(cacheStatus.keys.some((k) => k.startsWith('lingowild-cache-'))).toBe(true);

    // Start a session online, then cut network mid-session!
    await page.getByTestId('btn-new-game').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-1').click(); // Kindlet
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    await context.setOffline(true);

    // Verify failed uncached JS, CSS, and PNG subresource requests NEVER receive index.html!
    const subresourceCheck = await page.evaluate(async () => {
      const targets = [
        './assets/nonexistent-module.js',
        './assets/nonexistent-style.css',
        './assets/sprites/nonexistent-image.png',
      ];
      const results: Array<{ status: number; bodySnippet: string }> = [];
      for (const url of targets) {
        const res = await fetch(url);
        const txt = await res.text();
        results.push({ status: res.status, bodySnippet: txt.slice(0, 80) });
      }
      return results;
    });

    for (const item of subresourceCheck) {
      expect(item.status).toBeGreaterThanOrEqual(400);
      expect(item.bodySnippet.toLowerCase()).not.toContain('<!doctype html');
      expect(item.bodySnippet.toLowerCase()).not.toContain('<html');
    }

    // Continue playing mid-session while offline and save
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('KeyJ');
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('btn-save-now').click();
    await page.getByTestId('btn-close-journal').click();

    // Offline reload after first load: app must load completely from precache and restore Kindlet session!
    await page.reload();
    await expect(page.getByTestId('btn-continue-game')).toBeVisible();
    await page.getByTestId('btn-continue-game').click();
    await expect(page.locator('.lw-hud-ribbon')).toContainText('Kindlet');

    await context.setOffline(false);
  });

  test('protects valid save from invalid JSON import, handles subpath hosting, chest idempotency, key remap, and speech fallback', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop resilience & subpath suite');

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript(() => {
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    });

    await page.goto('/');
    await page.getByTestId('btn-new-game').click();

    // Test speech fallback on both single word and full sentence Listen button
    await page.getByTestId('btn-dialogue-listen').click();
    await expect(page.getByTestId('dialogue-box')).toContainText('Trình duyệt');
    await page.locator('.word-token', { hasText: 'valley' }).first().click();
    await page.getByTestId('btn-gloss-listen').click();
    await expect(page.getByTestId('gloss-popup')).toContainText('phiên âm');
    await page.keyboard.press('Escape');

    // Finish Rowan intro (180 + 50 quest q01 reward = 230 Tokens)
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Walk from (15,13) to Greenhouse chest (5,3): up to (15,12), left to (5,12), up to (5,4) facing (5,3)
    await page.keyboard.press('ArrowUp');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');

    // Rapidly interact 8 times with chest (5,3): +40 Tokens must apply ONCE (230 + 40 = 270T)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Space');
    }
    await expect(page.locator('.lw-hud-ribbon')).toContainText('270T');

    // Attempt to import an invalid save file and verify the 270T valid save is NOT overwritten!
    await page.keyboard.press('KeyJ');
    await page.getByTestId('journal-tab-settings').click();
    await page.getByTestId('input-import-save').setInputFiles({
      name: 'corrupted-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"magic":"LINGOWILD_SAVE","version":1,"checksum":123,"state":{}}', 'utf8'),
    });

    // Remap Journal key from KeyJ to KeyK and verify KeyK works
    await page.getByRole('button', { name: 'Journal: KeyJ' }).click();
    await page.keyboard.press('KeyK');
    await expect(page.getByRole('button', { name: 'Journal: KeyK' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyK');
    await expect(page.getByTestId('journal-modal')).toBeVisible();
    await page.keyboard.press('Escape');

    // Reload and verify our valid 270T save survived the rejected import!
    await page.reload();
    await expect(page.getByTestId('btn-continue-game')).toBeVisible();
    await page.getByTestId('btn-continue-game').click();
    await expect(page.locator('.lw-hud-ribbon')).toContainText('270T');
    expect(pageErrors).toEqual([]);
  });

  test('loads cleanly when hosted under GitHub Pages /Pokemon/ base path', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Subpath check in fresh context');

    const failedSubpathUrls: string[] = [];
    await page.route('**/Pokemon/**', async (route) => {
      const url = new URL(route.request().url());
      const subPath = url.pathname.replace(/^\/Pokemon\/?/, '') || 'index.html';
      const diskPath = path.join(process.cwd(), 'dist', subPath);
      if (!fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
        failedSubpathUrls.push(url.pathname);
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
    expect(failedSubpathUrls).toEqual([]);
  });

  test('upgrades service worker cleanly from Version A to Version B and resolves offline navigation fallback chain', async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'SW A->B upgrade check');

    const distDir = path.join(process.cwd(), 'dist');
    const distSwRaw = fs.readFileSync(path.join(distDir, 'sw.js'), 'utf8');
    let serveVersion = 'v3-upgrade-a';

    const mimeByExt: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.webmanifest': 'application/manifest+json',
    };

    const swServer = http.createServer((req, res) => {
      const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (urlObj.pathname === '/sw.js') {
        const body = distSwRaw.replace(
          /const CACHE_VERSION = '[^']+';/,
          `const CACHE_VERSION = '${serveVersion}';`,
        );
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(body);
        return;
      }
      const cleanPath = decodeURIComponent(urlObj.pathname).replace(/^\/+/, '') || 'index.html';
      const diskPath = path.resolve(distDir, cleanPath);
      if (!diskPath.startsWith(distDir) || !fs.existsSync(diskPath) || fs.statSync(diskPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(diskPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeByExt[ext] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(fs.readFileSync(diskPath));
    });

    await new Promise<void>((resolve) => swServer.listen(0, '127.0.0.1', () => resolve()));
    const addr = swServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const origin = `http://127.0.0.1:${port}`;

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    try {
      await page.goto(origin);
      await expect(page.getByTestId('btn-new-game')).toBeVisible();
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.reload();

      const keysDuringA = await page.evaluate(() => caches.keys());
      expect(keysDuringA).toContain('lingowild-cache-v3-upgrade-a');

      // Switch origin SW to Version B, trigger real browser SW update, and verify Version A cache is purged!
      serveVersion = 'v3-upgrade-b';
      await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          });
          void reg?.update();
          setTimeout(() => resolve(), 3000);
        });
      });
      await page.reload();

      const keysDuringB = await page.evaluate(() => caches.keys());
      expect(keysDuringB).toContain('lingowild-cache-v3-upgrade-b');
      expect(keysDuringB).not.toContain('lingowild-cache-v3-upgrade-a');

      // Go offline and navigate to an uncached sub-route document (/unlisted-offline-route)
      // so cache.match(req) resolves to undefined and exercises the awaited ./index.html fallback!
      await context.setOffline(true);
      await page.goto(`${origin}/unlisted-offline-route`);
      await expect(page.getByTestId('btn-new-game')).toBeVisible();
      await context.setOffline(false);
    } finally {
      await context.close();
      swServer.close();
    }
  });
});

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';

const DIST_DIR = path.join(process.cwd(), 'dist');
const VIDEO_DIR = path.join(process.cwd(), 'docs', 'videos');
const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
const TMP_DIR = path.join(VIDEO_DIR, '.tmp-v130');

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function startDistStaticServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');
      const cleanPath = decodeURIComponent(urlObj.pathname).replace(/^\/+/, '') || 'index.html';
      const fullPath = path.resolve(DIST_DIR, cleanPath);
      if (
        !fullPath.startsWith(DIST_DIR) ||
        !fs.existsSync(fullPath) ||
        fs.statSync(fullPath).isDirectory()
      ) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(fs.readFileSync(fullPath));
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Could not bind static server'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function clickTile(page: Page, tileX: number, tileY: number): Promise<void> {
  const pt = await page.evaluate(
    ({ x, y }) => window.__LINGOWILD_DIAGNOSTICS__?.getTileClientCenter(x, y) ?? null,
    { x: tileX, y: tileY },
  );
  if (!pt) {
    throw new Error(`Tile (${tileX},${tileY}) could not be projected to viewport`);
  }
  await page.mouse.move(pt.x, pt.y, { steps: 6 });
  await page.waitForTimeout(140);
  await page.mouse.click(pt.x, pt.y);
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

async function startSkipTutorial(
  page: Page,
  baseUrl: string,
  opts?: { learningLanguage?: 'en' | 'zh' | 'none'; hskLevel?: 'HSK1' | 'HSK2' | 'HSK3' },
): Promise<void> {
  await page.goto(baseUrl);
  await page.getByTestId('btn-new-game').waitFor({ state: 'visible' });
  if (opts?.learningLanguage) {
    await page.getByTestId('select-learning-language').selectOption(opts.learningLanguage);
    await page.waitForTimeout(350);
  }
  if (opts?.hskLevel && opts.learningLanguage === 'zh') {
    await page.getByTestId('select-hsk-level').selectOption(opts.hskLevel);
    await page.waitForTimeout(250);
  }
  await page.getByTestId('checkbox-skip-tutorial').check();
  await page.waitForTimeout(450);
  await page.getByTestId('btn-new-game').click();
  await page.getByTestId('dialogue-box').waitFor({ state: 'visible' });
  await page.waitForTimeout(450);
  await page.getByTestId('btn-dialogue-next').click();
  await page.waitForTimeout(350);
  await page.getByTestId('btn-dialogue-next').click();
  await page.waitForTimeout(350);
  await page.getByTestId('dialogue-choice-0').click();
  await page.waitForTimeout(450);
  await page.getByTestId('btn-dialogue-next').click();
  await page.waitForTimeout(350);
  await page.getByTestId('btn-dialogue-next').click();
  await page.getByTestId('dialogue-box').waitFor({ state: 'hidden' });
  await page.waitForTimeout(500);
}

async function recordScenario(
  targetFilename: string,
  run: (page: Page) => Promise<void>,
): Promise<{ file: string; sizeKb: number; durationSec: number }> {
  const scenarioTmp = path.join(TMP_DIR, targetFilename.replace(/\.webm$/, ''));
  fs.rmSync(scenarioTmp, { recursive: true, force: true });
  fs.mkdirSync(scenarioTmp, { recursive: true });

  const startedAt = Date.now();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: scenarioTmp,
      size: { width: 960, height: 540 },
    },
  });
  const page = await context.newPage();
  const videoHandle = page.video();

  try {
    await run(page);
  } finally {
    await context.close();
    await browser.close();
  }

  if (!videoHandle) {
    throw new Error(`No video recorded for ${targetFilename}`);
  }
  const recordedPath = await videoHandle.path();
  const targetPath = path.join(VIDEO_DIR, targetFilename);
  fs.copyFileSync(recordedPath, targetPath);
  const sizeKb = Math.round((fs.statSync(targetPath).size / 1024) * 10) / 10;
  const durationSec = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
  return { file: targetPath, sizeKb, durationSec };
}

async function main(): Promise<void> {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const { server, baseUrl } = await startDistStaticServer();
  const results: Array<{ file: string; sizeKb: number; durationSec: number }> = [];

  try {
    // Video 1: Click-to-move navigating around obstacles, smart interactions, blocked tile & portal transition
    results.push(
      await recordScenario('v130-click-to-move.webm', async (page) => {
        await startSkipTutorial(page, baseUrl, { learningLanguage: 'en' });

        // Click across the plaza around fountain/campfire to capture aqua click-to-move path screenshot
        await clickTile(page, 6, 12);
        await page.waitForTimeout(320);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '24-v130-click-to-move-path.png'),
        });
        await waitUntilAutoPathIdle(page);
        await page.waitForTimeout(350);

        // Click blocked water tile (10, 17) to show terracotta X rejection
        await clickTile(page, 10, 17);
        await page.waitForTimeout(750);

        // Click Signpost (11, 13) -> auto-walks adjacent and opens sign
        await clickTile(page, 11, 13);
        await page.getByTestId('dialogue-box').waitFor({ state: 'visible', timeout: 8000 });
        await page.waitForTimeout(900);
        await page.getByTestId('btn-dialogue-next').click();
        await page.getByTestId('dialogue-box').waitFor({ state: 'hidden' });

        // Click NPC Scout Mai (16, 15) -> auto-walks around obstacle & interacts once
        await clickTile(page, 16, 15);
        await page.getByTestId('dialogue-box').waitFor({ state: 'visible', timeout: 8000 });
        await page.waitForTimeout(900);
        await page.getByTestId('btn-dialogue-next').click();
        await page.getByTestId('dialogue-box').waitFor({ state: 'hidden' });

        // Click West Portal (0, 12) -> auto-walks all the way west and transitions into Whisperwood Glen!
        await clickTile(page, 4, 12);
        await waitUntilAutoPathIdle(page, 10_000);
        await clickTile(page, 0, 12);
        await page.waitForFunction(
          () => window.__LINGOWILD_DIAGNOSTICS__?.getSnapshot().regionId === 'whisperwood',
          undefined,
          { timeout: 8000 },
        );
        await page.waitForTimeout(1200);
      }),
    );

    // Video 2: Continuous smooth hold-key walking, instant direction reversal, and Shift running
    results.push(
      await recordScenario('v130-smooth-movement.webm', async (page) => {
        await startSkipTutorial(page, baseUrl, { learningLanguage: 'en' });
        await page.keyboard.press('ArrowUp');
        await waitUntilAutoPathIdle(page);
        await page.waitForTimeout(400);

        // Continuous walk left along central avenue
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(1600);
        // Instant reversal to walk right
        await page.keyboard.down('ArrowRight');
        await page.keyboard.up('ArrowLeft');
        await page.waitForTimeout(2100);
        await page.keyboard.up('ArrowRight');
        await waitUntilAutoPathIdle(page);
        await page.waitForTimeout(500);

        // Shift + hold left to demonstrate smooth running speed
        await page.keyboard.down('ShiftLeft');
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(1400);
        // Smooth vertical turn while running
        await page.keyboard.down('ArrowUp');
        await page.keyboard.up('ArrowLeft');
        await page.waitForTimeout(550);
        await page.keyboard.down('ArrowRight');
        await page.keyboard.up('ArrowUp');
        await page.waitForTimeout(900);
        await page.keyboard.up('ArrowRight');
        await page.keyboard.up('ShiftLeft');
        await waitUntilAutoPathIdle(page);
        await page.waitForTimeout(900);
      }),
    );

    // Video 3: Chinese HSK 2 dialogue, Pinyin above/below, 10-field gloss lookup, Mandarin TTS & campfire review
    results.push(
      await recordScenario('v130-chinese-hsk2.webm', async (page) => {
        await page.goto(baseUrl);
        await page.getByTestId('btn-new-game').waitFor({ state: 'visible' });
        await page.waitForTimeout(600);
        await page.getByTestId('select-learning-language').selectOption('zh');
        await page.waitForTimeout(900);
        await page.getByTestId('checkbox-skip-tutorial').check();
        await page.waitForTimeout(400);
        await page.getByTestId('btn-new-game').click();

        await page.getByTestId('dialogue-box').waitFor({ state: 'visible' });
        await page.waitForTimeout(1200);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '25-v130-chinese-hsk2-dialogue.png'),
        });

        // Toggle Pinyin off and on, then tap HSK 2 word "欢迎" for 10-field gloss
        await page.getByTestId('btn-toggle-pinyin').click();
        await page.waitForTimeout(700);
        await page.getByTestId('btn-toggle-pinyin').click();
        await page.waitForTimeout(700);

        await page.locator('.zh-token[data-hanzi="欢迎"]').first().click();
        await page.getByTestId('gloss-popup').waitFor({ state: 'visible' });
        await page.waitForTimeout(1100);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '26-v130-chinese-gloss-popup.png'),
        });
        await page.getByTestId('btn-gloss-listen').click();
        await page.waitForTimeout(900);
        await page.getByTestId('btn-gloss-save').click();
        await page.waitForTimeout(800);
        await page.getByTestId('btn-gloss-close').click();

        // Tap Proper Noun "苔灯营地"
        await page.locator('.zh-token-proper').first().click();
        await page.getByTestId('gloss-popup').waitFor({ state: 'visible' });
        await page.waitForTimeout(1000);
        await page.getByTestId('btn-gloss-close').click();

        // Finish intro and choose Mosskit
        await page.getByTestId('btn-dialogue-next').click();
        await page.waitForTimeout(500);
        await page.getByTestId('btn-dialogue-next').click();
        await page.waitForTimeout(500);
        await page.getByTestId('dialogue-choice-0').click();
        await page.waitForTimeout(500);
        await page.getByTestId('btn-dialogue-next').click();
        await page.waitForTimeout(400);
        await page.getByTestId('btn-dialogue-next').click();
        await page.getByTestId('dialogue-box').waitFor({ state: 'hidden' });

        // Click Campfire (13, 9) and open voluntary Chinese campfire review
        await clickTile(page, 13, 9);
        await page.getByTestId('dialogue-box').waitFor({ state: 'visible', timeout: 7000 });
        await page.waitForTimeout(700);
        await page.getByTestId('dialogue-choice-0').click();
        await page.getByTestId('camp-review-modal').waitFor({ state: 'visible' });
        await page.waitForTimeout(1200);
        await page.getByTestId('camp-choice-0').click();
        await page.waitForTimeout(1100);
        await page.locator('[data-testid="camp-review-modal"] header button').click();
        await page.waitForTimeout(600);
      }),
    );

    // Video 4: Live switching learning language (Chinese <-> English) without losing party, tokens, or either notebook
    results.push(
      await recordScenario('v130-language-switch.webm', async (page) => {
        await startSkipTutorial(page, baseUrl, { learningLanguage: 'zh', hskLevel: 'HSK2' });

        // Click Signpost in Chinese and save a Chinese word
        await clickTile(page, 11, 13);
        await page.getByTestId('dialogue-box').waitFor({ state: 'visible', timeout: 7000 });
        await page.waitForTimeout(700);
        await page.locator('.zh-token:not(.zh-token-proper)').first().click();
        await page.getByTestId('gloss-popup').waitFor({ state: 'visible' });
        await page.waitForTimeout(700);
        await page.getByTestId('btn-gloss-save').click();
        await page.waitForTimeout(500);
        await page.getByTestId('btn-gloss-close').click();
        await page.getByTestId('btn-dialogue-next').click();
        await page.getByTestId('dialogue-box').waitFor({ state: 'hidden' });

        // Open Settings -> capture v1.3.0 multilingual + movement Settings screenshot -> switch to English
        await page.getByTestId('btn-open-journal').click();
        await page.getByTestId('journal-tab-settings').click();
        await page.waitForTimeout(900);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '27-v130-multilingual-settings.png'),
        });
        await page.getByTestId('settings-learning-language').selectOption('en');
        await page.waitForTimeout(800);
        await page.getByTestId('btn-close-journal').click();

        // Interact with Signpost in English and save an English word
        await page.keyboard.press('Space');
        await page.getByTestId('dialogue-box').waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForTimeout(900);
        await page.locator('.word-token').first().click();
        await page.getByTestId('gloss-popup').waitFor({ state: 'visible' });
        await page.waitForTimeout(800);
        await page.getByTestId('btn-gloss-save').click();
        await page.waitForTimeout(500);
        await page.getByTestId('btn-gloss-close').click();
        await page.getByTestId('btn-dialogue-next').click();

        // Switch back to Chinese and open BOTH notebooks in Field Journal
        await page.getByTestId('btn-open-journal').click();
        await page.getByTestId('journal-tab-settings').click();
        await page.waitForTimeout(500);
        await page.getByTestId('settings-learning-language').selectOption('zh');
        await page.waitForTimeout(600);
        await page.getByTestId('journal-tab-lexicon').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('lexicon-filter-saved').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('lexicon-notebook-en').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('lexicon-filter-saved').click();
        await page.waitForTimeout(1200);
      }),
    );

    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    for (const r of results) {
      console.log(`Recorded ${path.relative(process.cwd(), r.file)} (${r.durationSec}s, ${r.sizeKb} KB)`);
    }
  } finally {
    server.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

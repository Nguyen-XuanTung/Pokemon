import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { MAPS_BY_ID } from '../src/data/maps.ts';
import { NPCS } from '../src/data/npcs.ts';
import type { Direction, RegionId } from '../src/domain/types.ts';
import { getTileAt, offsetByDirection } from '../src/domain/world.ts';

const DIST_DIR = path.join(process.cwd(), 'dist');
const OUT_DIR = path.join(process.cwd(), 'docs', 'videos');
const TMP_DIR = path.join(OUT_DIR, '.tmp-recording');
const TARGET_VIDEO = path.join(OUT_DIR, 'lingowild-gameplay.webm');

const DIRECTIONS: ReadonlyArray<Direction> = ['up', 'down', 'left', 'right'];
const DIR_KEY: Readonly<Record<Direction, string>> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};
const BLOCKING_TILES = new Set(['water', 'wall', 'tree', 'cliff', 'campfire', 'shrine']);

interface Snap {
  readonly regionId: RegionId;
  readonly playerPos: { readonly x: number; readonly y: number; readonly facing: string };
  readonly hasActiveDialogue: boolean;
  readonly hasActiveBattle: boolean;
  readonly caughtCount: number;
}

async function readSnap(page: Page): Promise<Snap> {
  return (await page.evaluate(() => {
    const diag = (
      window as unknown as {
        __LINGOWILD_DIAGNOSTICS__?: { getSnapshot: () => Snap };
      }
    ).__LINGOWILD_DIAGNOSTICS__;
    if (!diag) {
      throw new Error('Missing __LINGOWILD_DIAGNOSTICS__');
    }
    return diag.getSnapshot();
  })) as Snap;
}

function findBfsPath(
  regionId: RegionId,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): Direction[] {
  if (startX === targetX && startY === targetY) return [];
  const map = MAPS_BY_ID[regionId];
  const blocked = new Set<string>();
  for (const n of NPCS) {
    if (n.regionId === regionId) blocked.add(`${n.x},${n.y}`);
  }
  for (const p of map.props) {
    blocked.add(`${p.x},${p.y}`);
  }
  for (const d of map.decorations ?? []) {
    if (!d.blocking) continue;
    const w = d.width ?? 1;
    const h = d.height ?? 1;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        blocked.add(`${d.x + dx},${d.y + dy}`);
      }
    }
  }

  const visited = new Set<string>([`${startX},${startY}`]);
  const queue: Array<{ x: number; y: number; path: Direction[] }> = [
    { x: startX, y: startY, path: [] },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dir of DIRECTIONS) {
      const nxt = offsetByDirection(cur.x, cur.y, dir);
      const key = `${nxt.x},${nxt.y}`;
      if (visited.has(key)) continue;
      if (nxt.x < 0 || nxt.y < 0 || nxt.x >= map.width || nxt.y >= map.height) continue;

      const isDest = nxt.x === targetX && nxt.y === targetY;
      const tile = getTileAt(map, nxt.x, nxt.y);
      if (tile === 'portal') {
        if (isDest) return [...cur.path, dir];
        continue;
      }
      if (BLOCKING_TILES.has(tile) || blocked.has(key)) continue;
      const nextPath = [...cur.path, dir];
      if (isDest) return nextPath;
      visited.add(key);
      queue.push({ x: nxt.x, y: nxt.y, path: nextPath });
    }
  }
  throw new Error(`No video walk path in ${regionId} from (${startX},${startY}) to (${targetX},${targetY})`);
}

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function startDistStaticServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url ?? '/', 'http://127.0.0.1');
      const cleanPath = decodeURIComponent(urlObj.pathname).replace(/^\/+/, '') || 'index.html';
      const fullPath = path.resolve(DIST_DIR, cleanPath);
      if (!fullPath.startsWith(DIST_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
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
        reject(new Error('Could not bind ephemeral static server port'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function dismissDialogueSmoothly(page: Page, pauseMs: number = 950): Promise<void> {
  let safety = 0;
  while (safety < 16) {
    safety += 1;
    const snap = await readSnap(page);
    if (!snap.hasActiveDialogue) return;
    await page.waitForTimeout(pauseMs);
    const nextBtn = page.getByTestId('btn-dialogue-next');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      continue;
    }
    const choices = page.locator('[data-testid^="dialogue-choice-"]');
    const count = await choices.count();
    if (count > 0) {
      await choices.nth(count - 1).click();
    }
  }
}

async function playShowcaseBattle(page: Page, tryBond: boolean): Promise<boolean> {
  const beforeCaught = (await readSnap(page)).caughtCount;
  let turn = 0;
  while (turn < 20) {
    turn += 1;
    const snap = await readSnap(page);
    if (!snap.hasActiveBattle) {
      return snap.caughtCount > beforeCaught;
    }

    const finishBtn = page.getByTestId('btn-battle-finish');
    if (await finishBtn.isVisible()) {
      await page.waitForTimeout(1100);
      await finishBtn.click();
      await dismissDialogueSmoothly(page, 800);
      return (await readSnap(page)).caughtCount > beforeCaught;
    }

    await page.waitForTimeout(950);

    if (!tryBond) {
      await page.getByTestId('battle-tab-tactics').click();
      await page.waitForTimeout(450);
      const fleeBtn = page.getByTestId('btn-battle-flee');
      if (await fleeBtn.isVisible()) {
        await fleeBtn.click();
        continue;
      }
    }

    if (turn === 1) {
      await page.getByTestId('battle-tab-tactics').click();
      await page.waitForTimeout(700);
      const observeBtn = page.getByTestId('btn-battle-observe');
      if (await observeBtn.isVisible()) {
        await observeBtn.click();
        continue;
      }
    }

    await page.getByTestId('battle-tab-bag').click();
    await page.waitForTimeout(750);
    const charmBtn = page.getByTestId('btn-battle-item-moss_charm');
    if (await charmBtn.isVisible()) {
      await charmBtn.click();
      continue;
    }

    await page.getByTestId('battle-tab-moves').click();
    await page.waitForTimeout(550);
    await page.getByTestId('btn-move-0').click();
  }
  return false;
}

async function walkHumanPacedTo(
  page: Page,
  targetX: number,
  targetY: number,
  stepDelayMs: number = 210,
  tryBondWild: boolean = false,
): Promise<boolean> {
  const startRegion = (await readSnap(page)).regionId;
  let bondedAny = false;
  let guard = 0;
  while (guard < 160) {
    guard += 1;
    const snap = await readSnap(page);
    if (snap.hasActiveBattle) {
      if (await playShowcaseBattle(page, tryBondWild && !bondedAny)) {
        bondedAny = true;
      }
      continue;
    }
    if (snap.hasActiveDialogue) {
      await dismissDialogueSmoothly(page, 850);
      continue;
    }
    if (snap.regionId !== startRegion) return bondedAny;
    if (snap.playerPos.x === targetX && snap.playerPos.y === targetY) return bondedAny;

    const path = findBfsPath(
      snap.regionId,
      snap.playerPos.x,
      snap.playerPos.y,
      targetX,
      targetY,
    );
    for (const step of path) {
      await page.keyboard.press(DIR_KEY[step]);
      await page.waitForTimeout(stepDelayMs);
      const cur = await readSnap(page);
      if (cur.hasActiveBattle || cur.hasActiveDialogue || cur.regionId !== startRegion) {
        break;
      }
    }
  }
  return bondedAny;
}

async function walkAdjacentAndInspect(
  page: Page,
  objX: number,
  objY: number,
  stepDelayMs: number = 210,
): Promise<void> {
  const snap = await readSnap(page);
  const candidates: Array<{ sx: number; sy: number; face: Direction; len: number }> = [];
  for (const [sx, sy, face] of [
    [objX, objY + 1, 'up'],
    [objX, objY - 1, 'down'],
    [objX + 1, objY, 'left'],
    [objX - 1, objY, 'right'],
  ] as const) {
    try {
      const p = findBfsPath(snap.regionId, snap.playerPos.x, snap.playerPos.y, sx, sy);
      candidates.push({ sx, sy, face, len: p.length });
    } catch {
      // unreachable side
    }
  }
  candidates.sort((a, b) => a.len - b.len);
  const best = candidates[0]!;
  await walkHumanPacedTo(page, best.sx, best.sy, stepDelayMs, false);
  const cur = await readSnap(page);
  if (cur.playerPos.facing !== best.face) {
    await page.keyboard.press(DIR_KEY[best.face]);
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const { server, baseUrl } = await startDistStaticServer();
  const startedAt = Date.now();
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: TMP_DIR,
        size: { width: 960, height: 540 },
      },
    });
    const page = await context.newPage();
    const videoHandle = page.video();

    // 1. Title screen showcase (0s - 6s)
    await page.goto(baseUrl);
    await page.getByTestId('btn-new-game').waitFor({ state: 'visible' });
    await page.waitForTimeout(2400);
    await page.getByTestId('btn-new-game').click();

    // 2. Rowan intro + contextual lexicon gloss + pocket word assist + Mosskit starter (6s - 22s)
    await page.getByTestId('dialogue-box').waitFor({ state: 'visible' });
    await page.waitForTimeout(1600);
    const valleyToken = page.locator('.word-token', { hasText: 'valley' }).first();
    if (await valleyToken.isVisible()) {
      await valleyToken.click();
      await page.getByTestId('gloss-popup').waitFor({ state: 'visible' });
      await page.waitForTimeout(2200);
      const saveWordBtn = page.getByTestId('btn-gloss-save');
      if (await saveWordBtn.isVisible()) {
        await saveWordBtn.click();
        await page.waitForTimeout(900);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    await page.getByTestId('btn-dialogue-next').click();
    await page.waitForTimeout(1400);

    const plainToken = page.locator('.word-token:not(.is-glossary)').first();
    if (await plainToken.isVisible()) {
      await plainToken.click();
      await page.waitForTimeout(1800);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(450);
    }

    await page.getByTestId('btn-dialogue-next').click();
    await page.waitForTimeout(1500);
    await page.getByTestId('dialogue-choice-0').click();
    await dismissDialogueSmoothly(page, 1300);

    // 3. Mosslight Camp village tour with Companion Follower trotting behind (22s - 46s)
    await page.waitForTimeout(900);
    await walkAdjacentAndInspect(page, 11, 13, 220);
    await dismissDialogueSmoothly(page, 1300);

    // Open Greenhouse chest (5,3)
    await walkAdjacentAndInspect(page, 5, 3, 190);
    await dismissDialogueSmoothly(page, 1100);

    // Visit Supply Post market stall (21,8)
    await walkAdjacentAndInspect(page, 21, 8, 190);
    await page.getByTestId('supply-post-modal').waitFor({ state: 'visible' });
    await page.waitForTimeout(1600);
    await page.getByTestId('btn-buy-moss_charm').click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Visit South Brook Overlook (19,16) where saved word re-encounters naturally
    await walkAdjacentAndInspect(page, 19, 16, 190);
    await dismissDialogueSmoothly(page, 1500);

    // 4. Enter Whisperwood Glen (0,12) -> inspect Habitat Trace -> Wild Capture Battle (46s - 82s)
    await walkHumanPacedTo(page, 0, 12, 185, false);
    await page.waitForTimeout(1600);

    // Inspect Luminous Bark Habitat Trace (18,18)
    await walkAdjacentAndInspect(page, 18, 18, 195);
    await dismissDialogueSmoothly(page, 1600);

    // Walk into Whisperwood tall grass near (26,7)/(27,8) and bond a wild creature!
    let bonded = await walkHumanPacedTo(page, 26, 7, 210, true);
    for (let step = 0; step < 18 && !bonded; step++) {
      const destX = step % 2 === 0 ? 27 : 26;
      const destY = step % 2 === 0 ? 8 : 7;
      bonded = await walkHumanPacedTo(page, destX, destY, 220, true);
    }

    // Rest at Glen Clearing Campfire (24,9) and briefly preview Optional Word Practice
    await walkAdjacentAndInspect(page, 24, 9, 200);
    const campPracticeChoice = page.getByTestId('dialogue-choice-0');
    if (await campPracticeChoice.isVisible()) {
      await page.waitForTimeout(1100);
      await campPracticeChoice.click();
      await page.getByTestId('camp-review-modal').waitFor({ state: 'visible' });
      await page.waitForTimeout(2600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      await dismissDialogueSmoothly(page, 900);
    }

    // 5. Full Field Journal tour: Map, Mystery-Silhouette Compendium, Team, Quests, Lexicon (82s - 102s)
    await page.keyboard.press('KeyJ');
    await page.getByTestId('journal-modal').waitFor({ state: 'visible' });
    for (const tabId of [
      'journal-tab-map',
      'journal-tab-compendium',
      'journal-tab-team',
      'journal-tab-quests',
      'journal-tab-lexicon',
    ]) {
      await page.getByTestId(tabId).click();
      await page.waitForTimeout(2600);
    }
    await page.getByTestId('btn-close-journal').click();
    await page.waitForTimeout(1400);

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    await context.close();
    await browser.close();

    if (!videoHandle) {
      throw new Error('Playwright did not produce a video handle');
    }
    const recordedPath = await videoHandle.path();
    fs.copyFileSync(recordedPath, TARGET_VIDEO);
    fs.rmSync(TMP_DIR, { recursive: true, force: true });

    const sizeKb = (fs.statSync(TARGET_VIDEO).size / 1024).toFixed(1);
    console.log(
      `Recorded real gameplay video (${elapsedSec}s, ${sizeKb} KB) -> ${TARGET_VIDEO}`,
    );
  } finally {
    server.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

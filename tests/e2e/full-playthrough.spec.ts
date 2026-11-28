import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { MAPS_BY_ID } from '../../src/data/maps.ts';
import { NPCS } from '../../src/data/npcs.ts';
import type { Direction, RegionId } from '../../src/domain/types.ts';
import { getTileAt, offsetByDirection } from '../../src/domain/world.ts';

const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DIRECTIONS: ReadonlyArray<Direction> = ['up', 'down', 'left', 'right'];
const DIR_KEY: Readonly<Record<Direction, string>> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};
const BLOCKING_TILES = new Set(['water', 'wall', 'tree', 'cliff', 'campfire', 'shrine']);

interface BrowserSnap {
  readonly regionId: RegionId;
  readonly playerPos: { readonly x: number; readonly y: number; readonly facing: string };
  readonly partyCount: number;
  readonly caughtCount: number;
  readonly discoveredCount: number;
  readonly activeModal: string;
  readonly hasActiveDialogue: boolean;
  readonly hasActiveBattle: boolean;
  readonly mainStoryCompleted: boolean;
}

async function readSnap(page: Page): Promise<BrowserSnap> {
  return (await page.evaluate(
    () => window.__LINGOWILD_DIAGNOSTICS__!.getSnapshot(),
  )) as BrowserSnap;
}

function computeReadOnlyBfsPath(
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
  throw new Error(`No browser walk path in ${regionId} from (${startX},${startY}) to (${targetX},${targetY})`);
}

async function resolveBrowserBattle(
  page: Page,
  opts: {
    tryCapture?: boolean;
    fleeWild?: boolean;
    captureElement?: string;
    screenshotPath?: string;
  } = {},
): Promise<boolean> {
  let guard = 0;
  let switchedCount = 0;
  let charmsThrown = 0;
  let tookScreenshot = false;
  const caughtBefore = (await readSnap(page)).caughtCount;
  while (guard < 85) {
    guard += 1;
    const snap = await readSnap(page);
    if (!snap.hasActiveBattle) return snap.caughtCount > caughtBefore;

    if (opts.screenshotPath && !tookScreenshot) {
      tookScreenshot = true;
      await expect(page.getByTestId('battle-deck')).toBeVisible();
      await page.screenshot({ path: opts.screenshotPath });
    }

    const domState = await page.evaluate(() => {
      const finishVisible = Boolean(document.querySelector('[data-testid="btn-battle-finish"]'));
      const enemyPlate = document.querySelector('.lw-plate-enemy');
      const enemyStrong = enemyPlate?.querySelector('strong')?.textContent ?? '';
      const enemyFull = enemyPlate?.textContent ?? '';
      const enemyEl = enemyPlate?.querySelector('.lw-badge-element')?.textContent?.trim() ?? '';
      const playerFull = document.querySelector('.lw-combatant-plate')?.textContent ?? '';
      const moveTexts = Array.from(document.querySelectorAll('.lw-move-card')).map(
        (el) => el.textContent ?? '',
      );
      const movesTabActive =
        document
          .querySelector('[data-testid="battle-tab-moves"]')
          ?.classList.contains('lw-btn-primary') ?? false;
      return {
        finishVisible,
        isWild: enemyStrong.startsWith('Wild '),
        alreadyBonded: enemyFull.includes('Bonded'),
        enemyElement: enemyEl,
        playerFull,
        moveTexts,
        movesTabActive,
      };
    });

    if (domState.finishVisible) {
      await page.getByTestId('btn-battle-finish').click();
      await dismissAnyDialogue(page);
      return (await readSnap(page)).caughtCount > caughtBefore;
    }

    const { isWild, alreadyBonded, enemyElement, playerFull: playerPlateFoot } = domState;

    let switchedAwayFromMoves = false;

    if (isWild && opts.fleeWild) {
      await page.getByTestId('battle-tab-tactics').click();
      switchedAwayFromMoves = true;
      const fleeBtn = page.getByTestId('btn-battle-flee');
      if (await fleeBtn.isVisible()) {
        await fleeBtn.click();
        continue;
      }
    }

    const matchesWantedElement = !opts.captureElement || enemyElement === opts.captureElement;
    if (isWild && opts.tryCapture && !alreadyBonded && matchesWantedElement && charmsThrown < 3) {
      await page.getByTestId('battle-tab-bag').click();
      switchedAwayFromMoves = true;
      const charmBtn = page
        .locator('[data-testid^="btn-battle-item-"][class*="lw-btn-moss"]')
        .first();
      if (await charmBtn.isVisible()) {
        charmsThrown += 1;
        await charmBtn.click();
        continue;
      }
    }

    // Cure turn-blocking sleep/paralysis in trainer battles so Astraloom's dusk_lull never locks out turns
    if (
      !isWild &&
      (playerPlateFoot.includes('SLEEP') || playerPlateFoot.includes('PARALYZE'))
    ) {
      await page.getByTestId('battle-tab-bag').click();
      switchedAwayFromMoves = true;
      const herbBtn = page.getByTestId('btn-battle-item-clear_herb');
      if (await herbBtn.isVisible()) {
        await herbBtn.click();
        continue;
      }
    }

    // Read exact HP from player plate and use strongest tonic first (nectar_flask +180 > orchard_salve +85 > dew_tonic +35)
    const hpNumbers = playerPlateFoot.match(/HP\s+(\d+)\/(\d+)/);
    const curHp = hpNumbers ? Number(hpNumbers[1]) : 100;
    const maxHp = hpNumbers ? Number(hpNumbers[2]) : 100;
    const healThreshold = isWild ? 0.35 : 0.62;
    if (curHp <= maxHp * healThreshold) {
      await page.getByTestId('battle-tab-bag').click();
      switchedAwayFromMoves = true;
      let usedTonic = false;
      for (const itemId of ['nectar_flask', 'orchard_salve', 'dew_tonic']) {
        const btn = page.getByTestId(`btn-battle-item-${itemId}`);
        if (await btn.isVisible()) {
          await btn.click();
          usedTonic = true;
          break;
        }
      }
      if (usedTonic) continue;
      if (isWild) {
        await page.getByTestId('battle-tab-tactics').click();
        const fleeBtn = page.getByTestId('btn-battle-flee');
        if (await fleeBtn.isVisible()) {
          await fleeBtn.click();
          continue;
        }
      }
    }

    let moveTexts = domState.moveTexts;
    if (!domState.movesTabActive || switchedAwayFromMoves) {
      await page.getByTestId('battle-tab-moves').click();
      moveTexts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.lw-move-card')).map((el) => el.textContent ?? ''),
      );
    }

    // Prefer a move tagged "Effective" with remaining PP, else highest-index learned move with PP
    let chosenIdx = 0;
    let bestScore = -999;
    for (let i = 0; i < moveTexts.length; i++) {
      const cardText = moveTexts[i] ?? '';
      if (cardText.includes('(0/')) continue;
      let score = i * 5;
      if (cardText.includes('Support')) {
        score -= 500;
      } else if (cardText.includes('Effective')) {
        score += 100;
      } else if (cardText.includes('Resisted')) {
        score -= 60;
      }
      if (score > bestScore) {
        bestScore = score;
        chosenIdx = i;
      }
    }

    // If in a trainer battle and all our active partner's attacks are Resisted, switch only to a trained teammate (within 3 levels)
    if (!isWild && bestScore < -20 && switchedCount < 2) {
      const playerPlateTxt =
        (await page.locator('.lw-combatant-plate').first().textContent()) ?? '';
      const leadLvMatch = playerPlateTxt.match(/Lv\.(\d+)/);
      const leadLv = leadLvMatch ? Number(leadLvMatch[1]) : 1;
      await page.getByTestId('battle-tab-team').click();
      const teamCards = page.locator('.lw-move-card');
      const tCount = await teamCards.count();
      let switched = false;
      for (let ti = 0; ti < tCount; ti++) {
        const card = teamCards.nth(ti);
        const txt = (await card.textContent()) ?? '';
        const lvMatch = txt.match(/Lv\.(\d+)/);
        const memberLv = lvMatch ? Number(lvMatch[1]) : 1;
        const btn = card.locator('button:not([disabled])').first();
        if (memberLv >= Math.max(12, leadLv - 4) && (await btn.isVisible())) {
          switchedCount += 1;
          switched = true;
          await btn.click();
          break;
        }
      }
      if (switched) continue;
      await page.getByTestId('battle-tab-moves').click();
    }

    await page.getByTestId(`btn-move-${chosenIdx}`).click();
  }
  return false;
}

async function dismissAnyDialogue(page: Page, chooseFirst: boolean = false): Promise<void> {
  let guard = 0;
  while (guard < 25) {
    guard += 1;
    const snap = await readSnap(page);
    if (!snap.hasActiveDialogue) return;

    const nextBtn = page.getByTestId('btn-dialogue-next');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      continue;
    }

    const choices = page.locator('[data-testid^="dialogue-choice-"]');
    const cCount = await choices.count();
    if (cCount > 0) {
      if (chooseFirst) {
        await choices.first().click();
      } else {
        await choices.nth(cCount - 1).click();
      }
    }
  }
}

async function walkBrowserTo(
  page: Page,
  targetX: number,
  targetY: number,
  battleOpts: { tryCapture?: boolean; fleeWild?: boolean; captureElement?: string } = {
    tryCapture: true,
  },
): Promise<boolean> {
  const initialSnap = await readSnap(page);
  const startRegion = initialSnap.regionId;
  let caughtAny = false;
  let guard = 0;

  while (guard < 350) {
    guard += 1;
    const snap = await readSnap(page);
    if (snap.hasActiveBattle) {
      if (await resolveBrowserBattle(page, battleOpts)) caughtAny = true;
      continue;
    }
    if (snap.hasActiveDialogue) {
      await dismissAnyDialogue(page, false);
      continue;
    }
    if (snap.regionId !== startRegion) return caughtAny;
    if (snap.playerPos.x === targetX && snap.playerPos.y === targetY) return caughtAny;

    const path = computeReadOnlyBfsPath(
      snap.regionId,
      snap.playerPos.x,
      snap.playerPos.y,
      targetX,
      targetY,
    );
    const map = MAPS_BY_ID[snap.regionId];
    let simX = snap.playerPos.x;
    let simY = snap.playerPos.y;
    for (const step of path) {
      await page.keyboard.press(DIR_KEY[step]);
      const nxt = offsetByDirection(simX, simY, step);
      simX = nxt.x;
      simY = nxt.y;
      const landedKind = getTileAt(map, simX, simY);
      // Pause batching immediately on encounter tiles or portals to check battle/region state
      if (
        landedKind === 'tall_grass' ||
        landedKind === 'reed_marsh' ||
        landedKind === 'portal'
      ) {
        break;
      }
    }
  }
  return caughtAny;
}

async function walkBrowserAdjacentAndInteract(
  page: Page,
  objX: number,
  objY: number,
  chooseFirstChoice: boolean = false,
  battleOpts: { tryCapture?: boolean; fleeWild?: boolean; screenshotPath?: string } = {
    tryCapture: true,
  },
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
      const p = computeReadOnlyBfsPath(snap.regionId, snap.playerPos.x, snap.playerPos.y, sx, sy);
      candidates.push({ sx, sy, face, len: p.length });
    } catch {
      // unreachable side
    }
  }
  candidates.sort((a, b) => a.len - b.len);
  const best = candidates[0]!;
  await walkBrowserTo(page, best.sx, best.sy, battleOpts);
  const afterWalk = await readSnap(page);
  if (afterWalk.playerPos.facing !== best.face) {
    await page.keyboard.press(DIR_KEY[best.face]);
    if ((await readSnap(page)).hasActiveBattle) {
      await resolveBrowserBattle(page, battleOpts);
    }
  }
  await page.keyboard.press('Space');
  await dismissAnyDialogue(page, chooseFirstChoice);
  if ((await readSnap(page)).hasActiveBattle) {
    await resolveBrowserBattle(page, battleOpts);
  }
}

async function getLeadHudStatus(
  page: Page,
): Promise<{ level: number; curHp: number; maxHp: number }> {
  const txt = (await page.locator('.lw-badge-lead').textContent()) ?? '';
  const lvMatch = txt.match(/Lv\.(\d+)/);
  const hpMatch = txt.match(/\((\d+)\/(\d+)\)/);
  return {
    level: lvMatch ? Number(lvMatch[1]) : 1,
    curHp: hpMatch ? Number(hpMatch[1]) : 100,
    maxHp: hpMatch ? Number(hpMatch[2]) : 100,
  };
}

async function makePartyElementLeadViaUi(page: Page, elementText: string): Promise<boolean> {
  await page.getByTestId('btn-open-journal').click();
  await page.getByTestId('journal-tab-team').click();
  let partyRow = page
    .locator('.lw-list-row', { hasText: elementText })
    .filter({ hasNotText: 'Swap with Last Slot' })
    .first();
  if ((await partyRow.count()) === 0) {
    const reserveRow = page
      .locator('.lw-list-row', { hasText: elementText })
      .filter({ hasText: 'Swap with Last Slot' })
      .first();
    if ((await reserveRow.count()) > 0) {
      await reserveRow.getByRole('button', { name: 'Swap with Last Slot' }).click();
      partyRow = page
        .locator('.lw-list-row', { hasText: elementText })
        .filter({ hasNotText: 'Swap with Last Slot' })
        .first();
    }
  }
  let promoted = false;
  if ((await partyRow.count()) > 0) {
    const makeLeadBtn = partyRow.getByRole('button', { name: 'Make Lead' });
    if (await makeLeadBtn.isVisible()) {
      await makeLeadBtn.click();
    }
    promoted = true;
  }
  await page.getByTestId('btn-close-journal').click();
  return promoted;
}

async function trainBrowserNearCampfire(
  page: Page,
  grassA: readonly [number, number],
  grassB: readonly [number, number],
  campfire: readonly [number, number],
  targetLevel: number,
  maxCaughtBeforePureTrain: number = 2,
  requiredCaptureElement?: string,
): Promise<void> {
  const expectedRegion = (await readSnap(page)).regionId;
  let caughtRequiredElement = !requiredCaptureElement;
  let loops = 0;
  while (loops < 480) {
    loops += 1;
    const snap = await readSnap(page);
    expect(snap.regionId).toBe(expectedRegion);
    const hud = await getLeadHudStatus(page);
    if (
      hud.level >= targetLevel &&
      snap.caughtCount >= maxCaughtBeforePureTrain &&
      caughtRequiredElement
    ) {
      break;
    }

    if (hud.curHp < hud.maxHp * 0.72 || loops % 24 === 0) {
      await walkBrowserAdjacentAndInteract(page, campfire[0], campfire[1], false, {
        fleeWild: true,
      });
    }
    const dest = loops % 2 === 0 ? grassA : grassB;
    const wantElementNow = Boolean(requiredCaptureElement && !caughtRequiredElement);
    const shouldTryCapture = wantElementNow || snap.caughtCount < maxCaughtBeforePureTrain;
    const didCatch = await walkBrowserTo(page, dest[0], dest[1], {
      tryCapture: shouldTryCapture,
      captureElement: wantElementNow ? requiredCaptureElement : undefined,
    });
    if (didCatch && wantElementNow) {
      caughtRequiredElement = true;
    }
  }
  await walkBrowserAdjacentAndInteract(page, campfire[0], campfire[1], false, { fleeWild: true });
}

test.use({ trace: 'off' });

test.describe('Unassisted Full Browser Playthrough (New Game to Ending)', () => {

  test('plays from Title Screen New Expedition to Starfall Sanctuary Ending using real browser inputs only', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Full playthrough runs on desktop');
    test.setTimeout(900_000);

    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await page.goto('/');
    await page.getByTestId('btn-new-game').click();

    // Choose Mosskit (Forest Leaf starter) via real dialogue clicks
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('dialogue-choice-0').click();
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    // Set Battle Animation Pace to Instant via real Settings UI dropdown
    await page.getByTestId('btn-open-journal').click();
    await page.getByTestId('journal-tab-settings').click();
    const speedSelect = page
      .locator('.lw-list-row', { hasText: 'Battle Animation Pace' })
      .locator('select');
    await speedSelect.selectOption('instant');
    await page.getByTestId('btn-close-journal').click();

    // Open Mosslight chest (5,3) and enter Whisperwood Glen via (0,12)
    await walkBrowserAdjacentAndInteract(page, 5, 3);
    await walkBrowserTo(page, 0, 12);
    expect((await readSnap(page)).regionId).toBe('whisperwood');

    // Open Whisperwood chests (26,20) & (6,20), catch 1 woodland partner & train to Lv.11 (Briarpaw!), defeat Sylvan (8,5)
    await walkBrowserAdjacentAndInteract(page, 26, 20, false, { fleeWild: true });
    await walkBrowserAdjacentAndInteract(page, 6, 20, false, { fleeWild: true });
    await trainBrowserNearCampfire(page, [26, 7], [27, 8], [24, 9], 11, 2);
    await walkBrowserAdjacentAndInteract(page, 8, 5, true, { fleeWild: true });
    expect((await readSnap(page)).regionId).toBe('whisperwood');

    // Enter Reedwater Fen via Whisperwood north shortcut (16,0)
    await walkBrowserTo(page, 16, 0, { fleeWild: true });
    expect((await readSnap(page)).regionId).toBe('reedwater_fen');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-reedwater-fen.png') });

    // Open Reedwater chest (3,5), catch guaranteed Water partner & train Briarpaw to Lv.16, defeat Mirella (27,4)
    await walkBrowserAdjacentAndInteract(page, 3, 5, false, { fleeWild: true });
    await trainBrowserNearCampfire(page, [7, 10], [8, 10], [5, 10], 16, 3, 'Water');
    await walkBrowserAdjacentAndInteract(page, 27, 4, true, { fleeWild: true });
    expect((await readSnap(page)).regionId).toBe('reedwater_fen');

    // Enter Terracotta Ridge via (31,18), open chests (3,20) & (29,10)
    await walkBrowserTo(page, 31, 18, { fleeWild: true });
    expect((await readSnap(page)).regionId).toBe('terracotta_ridge');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-terracotta-ridge.png') });
    await walkBrowserAdjacentAndInteract(page, 3, 20, false, { fleeWild: true });
    await walkBrowserAdjacentAndInteract(page, 29, 10, false, { fleeWild: true });

    // Hop north (15,0) to Mosslight Supply Post (21,8) to stock Nectar Flasks with earned tokens!
    await walkBrowserTo(page, 15, 0, { fleeWild: true });
    expect((await readSnap(page)).regionId).toBe('mosslight_hub');
    await walkBrowserAdjacentAndInteract(page, 21, 8, true);
    await expect(page.getByTestId('supply-post-modal')).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.getByTestId('btn-buy-nectar_flask').click();
    }
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('btn-buy-clear_herb').click();
    }
    await page.keyboard.press('Escape');
    await walkBrowserTo(page, 15, 23);
    expect((await readSnap(page)).regionId).toBe('terracotta_ridge');

    // Promote caught Water partner to Lead via real Journal Team UI, train to Lv.21 (Lotusbell / Tidecrest!), defeat Kaelen (27,18)
    const promotedWater = await makePartyElementLeadViaUi(page, '(Water |');
    expect(promotedWater).toBe(true);
    await trainBrowserNearCampfire(page, [21, 2], [22, 2], [15, 5], 21, 3);
    await walkBrowserAdjacentAndInteract(page, 27, 18, true, {
      fleeWild: true,
      screenshotPath: path.join(SCREENSHOT_DIR, '15-terracotta-boss-battle.png'),
    });
    expect((await readSnap(page)).regionId).toBe('terracotta_ridge');

    // Ascend High Summit Pass (31,6) into Starfall Sanctuary
    await walkBrowserTo(page, 31, 6, { fleeWild: true });
    expect((await readSnap(page)).regionId).toBe('starfall_sanctuary');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16-starfall-sanctuary.png') });

    // Capture Campfire Review screenshot at Starlight Brazier (15,16) then close without answering!
    await walkBrowserTo(page, 15, 17, { fleeWild: true });
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await page.getByTestId('dialogue-choice-0').click();
    await expect(page.getByTestId('camp-review-modal')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-campfire-review.png') });
    await page.keyboard.press('Escape');

    // Open Sanctuary Vault chest (27,3), train Water lead to Lv.23, put Briarpaw in front against Astraea's Water opener, and defeat Astraea (15,5)
    await walkBrowserAdjacentAndInteract(page, 27, 3, false, { fleeWild: true });
    await trainBrowserNearCampfire(page, [11, 17], [11, 18], [15, 16], 23, 3);
    await makePartyElementLeadViaUi(page, 'Briarpaw');
    await walkBrowserAdjacentAndInteract(page, 15, 5, true, {
      fleeWild: true,
      screenshotPath: path.join(SCREENSHOT_DIR, '17-starfall-final-trial.png'),
    });
    expect((await readSnap(page)).regionId).toBe('starfall_sanctuary');

    // Walk around Astraea (15,5) to Celestial Harmony Altar (15,3) and complete the story!
    await walkBrowserTo(page, 15, 4, { fleeWild: true });
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await page.getByTestId('dialogue-choice-0').click(); // Awaken Basin Harmony
    await page.getByTestId('btn-dialogue-next').click(); // Advance awakening line 1 -> Solacern choice
    await page.getByTestId('dialogue-choice-1').click(); // Peaceful celebration
    await page.getByTestId('btn-dialogue-next').click();
    await page.getByTestId('btn-dialogue-next').click();

    await expect(page.getByTestId('ending-banner-modal')).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-starfall-ending.png') });

    const finalSnap = await readSnap(page);
    expect(finalSnap.mainStoryCompleted).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});

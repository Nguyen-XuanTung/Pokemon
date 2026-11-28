import { DIALOGUES, DIALOGUES_BY_ID } from '../src/data/dialogues.ts';
import { ITEMS, ITEMS_BY_ID } from '../src/data/items.ts';
import { LEXICON_ENTRIES, LEXICON_INDEX } from '../src/data/lexicon.ts';
import { MAPS, MAPS_BY_ID } from '../src/data/maps.ts';
import { MOVES, MOVES_BY_ID } from '../src/data/moves.ts';
import { NPCS } from '../src/data/npcs.ts';
import { QUESTS } from '../src/data/quests.ts';
import { SPECIES, SPECIES_BY_ID } from '../src/data/species.ts';
import { ZH_DIALOGUES_BY_ID } from '../src/data/zh-dialogues.ts';
import { CHINESE_PROPER_NOUNS, ZH_LEXICON_ENTRIES, ZH_LEXICON_INDEX } from '../src/data/zh-lexicon.ts';
import { ITEMS_ZH, MAPS_ZH, MOVES_ZH, NPCS_ZH, QUESTS_ZH, SPECIES_ZH } from '../src/data/zh-world-content.ts';
import { tokenizeChineseText } from '../src/domain/chinese.ts';
import { COMBAT_ELEMENTS, getElementStrengthsAndWeaknesses } from '../src/domain/elements.ts';
import { tokenizeEnglishText } from '../src/domain/learning.ts';
import { getTileAt, offsetByDirection } from '../src/domain/world.ts';
import type { Direction } from '../src/domain/types.ts';

const errors: string[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    errors.push(message);
  }
}

function checkNoForbiddenStyle(text: string, label: string): void {
  if (/[\u2013\u2014]/.test(text)) {
    errors.push(`${label}: contains forbidden en-dash or em-dash`);
  }
  if (/[\u{1F300}-\u{1FAFF}]/u.test(text)) {
    errors.push(`${label}: contains forbidden emoji`);
  }
}

function checkPureAsciiEnglish(text: string, label: string): void {
  if (/[^\x20-\x7E]/.test(text)) {
    errors.push(`${label}: contains non-ASCII character in English text: "${text}"`);
  }
}

// 1. Species & Starters
assert(SPECIES.length >= 30, `Expected >= 30 species, got ${SPECIES.length}`);
const starters = SPECIES.filter((s) => s.isStarter);
assert(starters.length === 3, `Expected 3 starters, got ${starters.length}`);
const seenSpeciesIds = new Set<string>();
const seenDexNumbers = new Set<number>();
for (const sp of SPECIES) {
  assert(!seenSpeciesIds.has(sp.id), `Duplicate species id: ${sp.id}`);
  seenSpeciesIds.add(sp.id);
  assert(!seenDexNumbers.has(sp.dexNumber), `Duplicate dexNumber: ${sp.dexNumber}`);
  seenDexNumbers.add(sp.dexNumber);
  checkPureAsciiEnglish(sp.fieldNoteEn, `species.${sp.id}.fieldNoteEn`);
  checkNoForbiddenStyle(sp.fieldNoteVi, `species.${sp.id}.fieldNoteVi`);
  checkNoForbiddenStyle(sp.titleVi, `species.${sp.id}.titleVi`);
  assert(
    ['common', 'uncommon', 'rare', 'mythic'].includes(sp.rarity),
    `Species ${sp.id} has invalid rarity ${sp.rarity}`,
  );
  assert(
    ['striker', 'bulwark', 'swift', 'tactician', 'guardian'].includes(sp.combatRole),
    `Species ${sp.id} has invalid combatRole ${sp.combatRole}`,
  );
  if (sp.evolvesTo) {
    assert(
      Boolean(SPECIES_BY_ID[sp.evolvesTo.speciesId]),
      `Species ${sp.id} evolves into unknown ${sp.evolvesTo.speciesId}`,
    );
  }
  assert(sp.learnset.length >= 3, `Species ${sp.id} should have >= 3 learnset moves`);
  for (const lm of sp.learnset) {
    assert(Boolean(MOVES_BY_ID[lm.moveId]), `Species ${sp.id} references unknown move ${lm.moveId}`);
  }
}

// 2. Moves & Type Chart Balance
assert(MOVES.length >= 40, `Expected >= 40 moves, got ${MOVES.length}`);
const seenMoveIds = new Set<string>();
for (const mv of MOVES) {
  assert(!seenMoveIds.has(mv.id), `Duplicate move id: ${mv.id}`);
  seenMoveIds.add(mv.id);
  checkPureAsciiEnglish(mv.descriptionEn, `move.${mv.id}.descriptionEn`);
  checkNoForbiddenStyle(mv.descriptionVi, `move.${mv.id}.descriptionVi`);
}
for (const el of COMBAT_ELEMENTS) {
  const { strongAgainst, weakTo } = getElementStrengthsAndWeaknesses(el);
  assert(strongAgainst.length === 2, `Element ${el} should beat 2 elements, got ${strongAgainst.length}`);
  assert(weakTo.length === 2, `Element ${el} should be weak to 2 elements, got ${weakTo.length}`);
}

// 3. Items
assert(ITEMS.length >= 10, `Expected >= 10 items, got ${ITEMS.length}`);
for (const item of ITEMS) {
  checkPureAsciiEnglish(item.descriptionEn, `item.${item.id}.descriptionEn`);
  checkNoForbiddenStyle(item.descriptionVi, `item.${item.id}.descriptionVi`);
}

// 4. Maps & BFS Reachability
assert(MAPS.length === 5, `Expected 5 maps (1 hub + 4 regions), got ${MAPS.length}`);
const BLOCKING_KINDS = new Set(['water', 'wall', 'tree', 'cliff', 'campfire', 'shrine']);
const DIRECTIONS: ReadonlyArray<Direction> = ['up', 'down', 'left', 'right'];

for (const map of MAPS) {
  assert(map.rows.length === map.height, `Map ${map.id} row count ${map.rows.length} != ${map.height}`);
  for (let y = 0; y < map.height; y++) {
    const row = map.rows[y]!;
    assert(row.length === map.width, `Map ${map.id} row ${y} width ${row.length} != ${map.width}`);
  }

  const npcsHere = NPCS.filter((n) => n.regionId === map.id);
  const blockedCoords = new Set<string>();
  for (const npc of npcsHere) {
    blockedCoords.add(`${npc.x},${npc.y}`);
    const npcTile = getTileAt(map, npc.x, npc.y);
    assert(!BLOCKING_KINDS.has(npcTile), `NPC ${npc.id} placed on blocking tile ${npcTile} at (${npc.x},${npc.y})`);
  }
  for (const prop of map.props) {
    blockedCoords.add(`${prop.x},${prop.y}`);
  }
  for (const dec of map.decorations ?? []) {
    if (!dec.blocking) continue;
    const w = dec.width ?? 1;
    const h = dec.height ?? 1;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        blockedCoords.add(`${dec.x + dx},${dec.y + dy}`);
      }
    }
  }

  const isWalkableForBfs = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const tile = getTileAt(map, x, y);
    if (BLOCKING_KINDS.has(tile)) return false;
    if (blockedCoords.has(`${x},${y}`)) return false;
    return true;
  };

  assert(
    isWalkableForBfs(map.spawnX, map.spawnY),
    `Map ${map.id} spawn (${map.spawnX},${map.spawnY}) is not walkable!`,
  );

  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: map.spawnX, y: map.spawnY }];
  visited.add(`${map.spawnX},${map.spawnY}`);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dir of DIRECTIONS) {
      const nxt = offsetByDirection(cur.x, cur.y, dir);
      const key = `${nxt.x},${nxt.y}`;
      if (visited.has(key)) continue;
      if (isWalkableForBfs(nxt.x, nxt.y)) {
        visited.add(key);
        queue.push(nxt);
      }
    }
  }

  const hasAdjacentReachable = (tx: number, ty: number): boolean =>
    DIRECTIONS.some((dir) => {
      const adj = offsetByDirection(tx, ty, dir);
      return visited.has(`${adj.x},${adj.y}`);
    });

  for (const portal of map.portals) {
    assert(
      hasAdjacentReachable(portal.x, portal.y),
      `Map ${map.id} portal to ${portal.targetRegion} at (${portal.x},${portal.y}) is unreachable!`,
    );
    const destMap = MAPS_BY_ID[portal.targetRegion];
    assert(Boolean(destMap), `Portal target region ${portal.targetRegion} missing`);
    if (destMap) {
      const destTile = getTileAt(destMap, portal.targetX, portal.targetY);
      assert(
        !BLOCKING_KINDS.has(destTile) && destTile !== 'portal',
        `Portal from ${map.id} lands on invalid tile ${destTile} at ${destMap.id} (${portal.targetX},${portal.targetY})`,
      );
    }
    if (portal.blockedDialogueId) {
      assert(
        Boolean(DIALOGUES_BY_ID[portal.blockedDialogueId]),
        `Portal missing blockedDialogueId ${portal.blockedDialogueId}`,
      );
    }
  }

  for (const npc of npcsHere) {
    assert(
      hasAdjacentReachable(npc.x, npc.y),
      `NPC ${npc.id} in ${map.id} at (${npc.x},${npc.y}) has no reachable adjacent tile!`,
    );
  }

  for (const prop of map.props) {
    assert(
      hasAdjacentReachable(prop.x, prop.y),
      `Prop ${prop.id} in ${map.id} at (${prop.x},${prop.y}) has no reachable adjacent tile!`,
    );
    if (prop.dialogueId) {
      assert(
        Boolean(DIALOGUES_BY_ID[prop.dialogueId]),
        `Prop ${prop.id} references missing dialogue ${prop.dialogueId}`,
      );
    }
    if (prop.rewardItemId) {
      assert(
        Boolean(ITEMS_BY_ID[prop.rewardItemId]),
        `Prop ${prop.id} references missing item ${prop.rewardItemId}`,
      );
    }
    if (prop.kind === 'trace') {
      assert(
        Boolean(prop.traceSpeciesId && SPECIES_BY_ID[prop.traceSpeciesId]),
        `Trace prop ${prop.id} must reference a valid traceSpeciesId`,
      );
    }
  }

  for (const enc of map.encounters) {
    assert(Boolean(SPECIES_BY_ID[enc.speciesId]), `Map ${map.id} encounter unknown ${enc.speciesId}`);
  }
}

// 5. NPCs, Bosses & Post-Game Warden Rematches
assert(NPCS.length >= 15, `Expected >= 15 NPCs, got ${NPCS.length}`);
const bosses = NPCS.filter((n) => n.trainerBattle?.isBoss);
const rematches = NPCS.filter((n) => Boolean(n.rematchBattle));
assert(bosses.length >= 3, `Expected >= 3 bosses, got ${bosses.length}`);
assert(rematches.length >= 4, `Expected >= 4 post-game Warden rematches, got ${rematches.length}`);
for (const npc of NPCS) {
  assert(
    Boolean(DIALOGUES_BY_ID[npc.defaultDialogueId]),
    `NPC ${npc.id} missing defaultDialogueId ${npc.defaultDialogueId}`,
  );
  for (const cond of npc.conditionalDialogues ?? []) {
    assert(
      Boolean(DIALOGUES_BY_ID[cond.dialogueId]),
      `NPC ${npc.id} missing conditional dialogue ${cond.dialogueId}`,
    );
  }
  for (const spec of [npc.trainerBattle, npc.rematchBattle]) {
    if (!spec) continue;
    assert(
      Boolean(DIALOGUES_BY_ID[spec.preBattleDialogueId]),
      `Trainer ${npc.id} (${spec.id}) missing preBattleDialogueId`,
    );
    assert(
      Boolean(DIALOGUES_BY_ID[spec.defeatDialogueId]),
      `Trainer ${npc.id} (${spec.id}) missing defeatDialogueId`,
    );
    for (const member of spec.party) {
      assert(
        Boolean(SPECIES_BY_ID[member.speciesId]),
        `Trainer ${npc.id} (${spec.id}) has unknown party species ${member.speciesId}`,
      );
    }
  }
}

// 6. Quests
assert(QUESTS.length >= 12, `Expected >= 12 quests, got ${QUESTS.length}`);
for (const q of QUESTS) {
  checkPureAsciiEnglish(q.summaryEn, `quest.${q.id}.summaryEn`);
  checkNoForbiddenStyle(q.summaryVi, `quest.${q.id}.summaryVi`);
  assert(q.steps.length >= 1, `Quest ${q.id} has no steps`);
  for (const item of q.rewards.items ?? []) {
    assert(Boolean(ITEMS_BY_ID[item.itemId]), `Quest ${q.id} rewards unknown item ${item.itemId}`);
  }
}

// 7. Lexicon (300+ curated entries, A1-B2)
assert(
  LEXICON_ENTRIES.length >= 300,
  `Expected >= 300 lexicon entries, got ${LEXICON_ENTRIES.length}`,
);
const seenLexIds = new Set<string>();
const seenExampleEn = new Set<string>();
const cefrCounts = { A1: 0, A2: 0, B1: 0, B2: 0 };
let phraseCount = 0;
let polysemyCount = 0;
let multiExampleCount = 0;
for (const lex of LEXICON_ENTRIES) {
  assert(!seenLexIds.has(lex.id), `Duplicate lexicon id: ${lex.id}`);
  seenLexIds.add(lex.id);
  assert(!seenExampleEn.has(lex.exampleEn), `Duplicate lexicon example sentence: ${lex.exampleEn}`);
  seenExampleEn.add(lex.exampleEn);
  if (lex.examples && lex.examples.length >= 1) {
    multiExampleCount += 1;
    for (const ex of lex.examples) {
      assert(!seenExampleEn.has(ex.en), `Duplicate secondary lexicon example: ${ex.en}`);
      seenExampleEn.add(ex.en);
      checkPureAsciiEnglish(ex.en, `lexicon.${lex.id}.examples.en`);
      checkNoForbiddenStyle(ex.vi, `lexicon.${lex.id}.examples.vi`);
    }
  }
  cefrCounts[lex.cefr] += 1;
  if (lex.pos === 'phrase') phraseCount += 1;
  if (lex.senses && lex.senses.length >= 2) {
    polysemyCount += 1;
    for (const sense of lex.senses) {
      assert(sense.contextHints.length >= 1, `Lexicon ${lex.id} sense ${sense.senseId} missing contextHints`);
      checkPureAsciiEnglish(sense.exampleEn, `lexicon.${lex.id}.${sense.senseId}.exampleEn`);
      checkNoForbiddenStyle(sense.meaningVi, `lexicon.${lex.id}.${sense.senseId}.meaningVi`);
      checkNoForbiddenStyle(sense.exampleVi, `lexicon.${lex.id}.${sense.senseId}.exampleVi`);
    }
  }
  checkPureAsciiEnglish(lex.word, `lexicon.${lex.id}.word`);
  checkPureAsciiEnglish(lex.exampleEn, `lexicon.${lex.id}.exampleEn`);
  checkNoForbiddenStyle(lex.meaningVi, `lexicon.${lex.id}.meaningVi`);
  checkNoForbiddenStyle(lex.exampleVi, `lexicon.${lex.id}.exampleVi`);
}
assert(phraseCount >= 15, `Expected >= 15 multi-word phrases, got ${phraseCount}`);
assert(polysemyCount >= 5, `Expected >= 5 polysemous entries, got ${polysemyCount}`);
for (const band of ['A1', 'A2', 'B1', 'B2'] as const) {
  assert(cefrCounts[band] >= 25, `Expected >= 25 ${band} words, got ${cefrCounts[band]}`);
}

// 8. Dialogues (150+ contextual dialogues + CEFR adaptive variants)
assert(DIALOGUES.length >= 150, `Expected >= 150 dialogues, got ${DIALOGUES.length}`);
const seenDlgIds = new Set<string>();
let adaptiveVariantDialogues = 0;
for (const dlg of DIALOGUES) {
  assert(!seenDlgIds.has(dlg.id), `Duplicate dialogue id: ${dlg.id}`);
  seenDlgIds.add(dlg.id);
  let hasVariant = false;
  for (const line of dlg.lines) {
    checkPureAsciiEnglish(line.en, `dialogue.${dlg.id}.en`);
    checkNoForbiddenStyle(line.vi, `dialogue.${dlg.id}.vi`);
    if (line.variants) {
      hasVariant = true;
      for (const [band, v] of Object.entries(line.variants)) {
        if (!v) continue;
        checkPureAsciiEnglish(v.en, `dialogue.${dlg.id}.variants.${band}.en`);
        checkNoForbiddenStyle(v.vi, `dialogue.${dlg.id}.variants.${band}.vi`);
      }
    }
    for (const fw of line.focusWords ?? []) {
      const matched =
        Boolean(LEXICON_INDEX.bySurface[fw.toLowerCase()]) || Boolean(LEXICON_INDEX.byId[fw]);
      assert(matched, `Dialogue ${dlg.id} focusWord "${fw}" not found in lexicon`);
    }
    for (const ch of line.choices ?? []) {
      checkPureAsciiEnglish(ch.labelEn, `dialogue.${dlg.id}.choice.labelEn`);
      checkNoForbiddenStyle(ch.labelVi, `dialogue.${dlg.id}.choice.labelVi`);
      if (ch.nextDialogueId) {
        assert(
          Boolean(DIALOGUES_BY_ID[ch.nextDialogueId]),
          `Dialogue ${dlg.id} choice points to missing ${ch.nextDialogueId}`,
        );
      }
    }
  }
  if (hasVariant) adaptiveVariantDialogues += 1;
}
assert(
  adaptiveVariantDialogues >= 18,
  `Expected >= 18 dialogues with CEFR level variants, got ${adaptiveVariantDialogues}`,
);
assert(
  multiExampleCount >= 20,
  `Expected >= 20 lexicon entries with multiple independent examples, got ${multiExampleCount}`,
);

// 9. Measure Dialogue Word Lookup Coverage (Core Lexicon + Offline Pocket Dictionary + Proper Nouns)
const properNouns = new Set<string>([
  ...SPECIES.flatMap((s) => [s.name.toLowerCase(), `${s.name.toLowerCase()}s`]),
  ...NPCS.flatMap((n) => n.name.toLowerCase().split(/\s+/)),
]);
let totalWordTokens = 0;
let coveredWordTokens = 0;
for (const dlg of DIALOGUES) {
  for (const line of dlg.lines) {
    const tokens = tokenizeEnglishText(line.en, LEXICON_INDEX);
    for (const tok of tokens) {
      if (!tok.isWord || tok.normalized.length <= 1) continue;
      totalWordTokens += 1;
      if (tok.entry || tok.pocketNote || properNouns.has(tok.normalized)) {
        coveredWordTokens += 1;
      }
    }
  }
}
const coveragePct = totalWordTokens > 0 ? (coveredWordTokens / totalWordTokens) * 100 : 100;
assert(
  coveragePct >= 90,
  `Expected >= 90% dialogue word tap-lookup coverage, got ${coveragePct.toFixed(1)}%`,
);

// 10. Chinese Multilingual Content, HSK 2.0 Lexicon & Tap-Lookup Coverage
const zhHskCounts = { HSK1: 0, HSK2: 0, HSK3: 0, HSK4: 0, domain: 0 };
const seenZhIds = new Set<string>();
for (const entry of ZH_LEXICON_ENTRIES) {
  assert(entry.id.startsWith('zh:'), `Chinese lexicon id ${entry.id} must be namespaced with "zh:"`);
  assert(!seenZhIds.has(entry.id), `Duplicate Chinese lexicon id: ${entry.id}`);
  seenZhIds.add(entry.id);
  checkNoForbiddenStyle(entry.meaningVi, `zhLexicon.${entry.id}.meaningVi`);
  checkNoForbiddenStyle(entry.exampleVi, `zhLexicon.${entry.id}.exampleVi`);
  if (entry.hsk) {
    zhHskCounts[entry.hsk] += 1;
  } else {
    zhHskCounts.domain += 1;
  }
}
assert(zhHskCounts.HSK1 === 150, `Expected 150 HSK 1 entries, got ${zhHskCounts.HSK1}`);
assert(zhHskCounts.HSK2 === 150, `Expected 150 HSK 2 entries, got ${zhHskCounts.HSK2}`);
assert(zhHskCounts.HSK3 === 298, `Expected 298 unique HSK 3 headwords (+2 polyphones), got ${zhHskCounts.HSK3}`);
assert(CHINESE_PROPER_NOUNS.length >= 50, `Expected >= 50 Chinese proper nouns, got ${CHINESE_PROPER_NOUNS.length}`);

// Every world entity has Chinese localization
for (const sp of SPECIES) {
  const zh = SPECIES_ZH[sp.id];
  assert(Boolean(zh?.nameZh && zh.titleZh && zh.fieldNoteZh), `Missing Chinese content for species ${sp.id}`);
}
for (const mv of MOVES) {
  const zh = MOVES_ZH[mv.id];
  assert(Boolean(zh?.nameZh && zh.descriptionZh), `Missing Chinese content for move ${mv.id}`);
}
for (const item of ITEMS) {
  const zh = ITEMS_ZH[item.id];
  assert(Boolean(zh?.nameZh && zh.descriptionZh), `Missing Chinese content for item ${item.id}`);
}
for (const q of QUESTS) {
  const zh = QUESTS_ZH[q.id];
  assert(Boolean(zh?.titleZh && zh.summaryZh), `Missing Chinese content for quest ${q.id}`);
  for (const step of q.steps) {
    assert(Boolean(zh?.stepsZh[step.id]), `Missing Chinese quest step ${q.id}.${step.id}`);
  }
}
for (const map of MAPS) {
  const zh = MAPS_ZH[map.id];
  assert(Boolean(zh?.nameZh && zh.subtitleZh), `Missing Chinese content for map ${map.id}`);
  assert(
    (zh?.portalLabelsZh.length ?? 0) === map.portals.length,
    `Map ${map.id} Chinese portal label count mismatch`,
  );
  for (const prop of map.props) {
    assert(Boolean(zh?.propLabelsZh[prop.id]), `Missing Chinese prop label for ${map.id}.${prop.id}`);
  }
}
for (const npc of NPCS) {
  const zh = NPCS_ZH[npc.id];
  assert(Boolean(zh?.nameZh && zh.roleZh), `Missing Chinese content for NPC ${npc.id}`);
}

// Every single dialogue line and choice has Chinese content + measure actual in-game HSK usage & lookup coverage
let zhHskVariantDialogues = 0;
let zhTotalCjkChars = 0;
let zhCoveredCjkChars = 0;
const zhInGameDistinctWordIds = new Set<string>();
const zhInGameHskCounts = { HSK1: 0, HSK2: 0, HSK3: 0, HSK4: 0, domain: 0 };
const recordZhTextCoverage = (text: string, tag: string) => {
  const tokens = tokenizeChineseText(text, ZH_LEXICON_INDEX, tag);
  for (const tok of tokens) {
    if (!tok.isWord) continue;
    const len = tok.raw.length;
    zhTotalCjkChars += len;
    if (tok.entry || tok.properNoun) {
      zhCoveredCjkChars += len;
    }
    if (tok.entry && !zhInGameDistinctWordIds.has(tok.entry.id)) {
      zhInGameDistinctWordIds.add(tok.entry.id);
      if (tok.entry.hsk) {
        zhInGameHskCounts[tok.entry.hsk] += 1;
      } else {
        zhInGameHskCounts.domain += 1;
      }
    }
  }
};

for (const dlg of DIALOGUES) {
  const zhNode = ZH_DIALOGUES_BY_ID[dlg.id];
  assert(Boolean(zhNode), `Missing Chinese dialogue translation for ${dlg.id}`);
  if (!zhNode) continue;
  assert(zhNode.speakerZh.trim().length > 0, `Empty speakerZh for dialogue ${dlg.id}`);
  assert(
    zhNode.lines.length === dlg.lines.length,
    `Chinese dialogue ${dlg.id} line count ${zhNode.lines.length} != ${dlg.lines.length}`,
  );
  let hasZhVar = false;
  dlg.lines.forEach((line, idx) => {
    const zhLine = zhNode.lines[idx];
    if (!zhLine) return;
    assert(zhLine.zh.trim().length > 0, `Empty zh text at ${dlg.id}[${idx}]`);
    recordZhTextCoverage(zhLine.zh, `dlg:${dlg.id}`);
    if (zhLine.variants) {
      hasZhVar = true;
      for (const variantZh of Object.values(zhLine.variants)) {
        if (variantZh) {
          recordZhTextCoverage(variantZh, `dlg:${dlg.id}`);
        }
      }
    }
    if (line.choices && line.choices.length > 0) {
      assert(
        (zhLine.choicesZh?.length ?? 0) === line.choices.length,
        `Chinese dialogue ${dlg.id}[${idx}] choice count mismatch`,
      );
    }
  });
  if (hasZhVar) zhHskVariantDialogues += 1;
}

for (const sp of Object.values(SPECIES_ZH)) {
  recordZhTextCoverage(sp.fieldNoteZh, 'species');
}
for (const mv of Object.values(MOVES_ZH)) {
  recordZhTextCoverage(mv.descriptionZh, 'move');
}
for (const item of Object.values(ITEMS_ZH)) {
  recordZhTextCoverage(item.descriptionZh, 'item');
}
for (const q of Object.values(QUESTS_ZH)) {
  recordZhTextCoverage(q.summaryZh, 'quest');
  for (const s of Object.values(q.stepsZh)) {
    recordZhTextCoverage(s, 'quest');
  }
}

assert(
  zhHskVariantDialogues >= 40,
  `Expected >= 40 dialogues with HSK level variants, got ${zhHskVariantDialogues}`,
);
const zhCoveragePct = zhTotalCjkChars > 0 ? (zhCoveredCjkChars / zhTotalCjkChars) * 100 : 100;
assert(
  zhCoveragePct >= 75,
  `Expected >= 75% Chinese CJK character lookup coverage, got ${zhCoveragePct.toFixed(1)}%`,
);

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `Data validation passed: ${SPECIES.length} species, ${MOVES.length} moves, ${ITEMS.length} items, ${MAPS.length} maps, ${NPCS.length} NPCs (${bosses.length} bosses, ${rematches.length} rematches), ${QUESTS.length} quests, ${LEXICON_ENTRIES.length} EN lexicon (${multiExampleCount} multi-example, A1:${cefrCounts.A1}, A2:${cefrCounts.A2}, B1:${cefrCounts.B1}, B2:${cefrCounts.B2}), ${ZH_LEXICON_ENTRIES.length} ZH dictionary (HSK1:${zhHskCounts.HSK1}, HSK2:${zhHskCounts.HSK2}, HSK3:${zhHskCounts.HSK3}+2poly, HSK4_suppl:${zhHskCounts.HSK4}, domain:${zhHskCounts.domain}; in-game distinct: ${zhInGameDistinctWordIds.size} [HSK1:${zhInGameHskCounts.HSK1}, HSK2:${zhInGameHskCounts.HSK2}, HSK3:${zhInGameHskCounts.HSK3}, HSK4:${zhInGameHskCounts.HSK4}, domain:${zhInGameHskCounts.domain}]), ${DIALOGUES.length} dialogues (EN:${coveragePct.toFixed(1)}% / ZH:${zhCoveragePct.toFixed(1)}% lookup coverage, ${zhHskVariantDialogues} HSK-variant dialogues).`,
);

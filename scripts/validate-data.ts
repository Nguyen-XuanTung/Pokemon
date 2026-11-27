import { DIALOGUES, DIALOGUES_BY_ID } from '../src/data/dialogues.ts';
import { ITEMS, ITEMS_BY_ID } from '../src/data/items.ts';
import { LEXICON_ENTRIES, LEXICON_INDEX } from '../src/data/lexicon.ts';
import { MAPS, MAPS_BY_ID } from '../src/data/maps.ts';
import { MOVES, MOVES_BY_ID } from '../src/data/moves.ts';
import { NPCS } from '../src/data/npcs.ts';
import { QUESTS } from '../src/data/quests.ts';
import { SPECIES, SPECIES_BY_ID } from '../src/data/species.ts';
import { COMBAT_ELEMENTS, getElementStrengthsAndWeaknesses } from '../src/domain/elements.ts';
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
  }

  for (const enc of map.encounters) {
    assert(Boolean(SPECIES_BY_ID[enc.speciesId]), `Map ${map.id} encounter unknown ${enc.speciesId}`);
  }
}

// 5. NPCs & Bosses
assert(NPCS.length >= 15, `Expected >= 15 NPCs, got ${NPCS.length}`);
const bosses = NPCS.filter((n) => n.trainerBattle?.isBoss);
assert(bosses.length >= 3, `Expected >= 3 bosses, got ${bosses.length}`);
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
  if (npc.trainerBattle) {
    assert(
      Boolean(DIALOGUES_BY_ID[npc.trainerBattle.preBattleDialogueId]),
      `Trainer ${npc.id} missing preBattleDialogueId`,
    );
    assert(
      Boolean(DIALOGUES_BY_ID[npc.trainerBattle.defeatDialogueId]),
      `Trainer ${npc.id} missing defeatDialogueId`,
    );
    for (const member of npc.trainerBattle.party) {
      assert(
        Boolean(SPECIES_BY_ID[member.speciesId]),
        `Trainer ${npc.id} has unknown party species ${member.speciesId}`,
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
for (const lex of LEXICON_ENTRIES) {
  assert(!seenLexIds.has(lex.id), `Duplicate lexicon id: ${lex.id}`);
  seenLexIds.add(lex.id);
  assert(!seenExampleEn.has(lex.exampleEn), `Duplicate lexicon example sentence: ${lex.exampleEn}`);
  seenExampleEn.add(lex.exampleEn);
  cefrCounts[lex.cefr] += 1;
  checkPureAsciiEnglish(lex.word, `lexicon.${lex.id}.word`);
  checkPureAsciiEnglish(lex.exampleEn, `lexicon.${lex.id}.exampleEn`);
  checkNoForbiddenStyle(lex.meaningVi, `lexicon.${lex.id}.meaningVi`);
  checkNoForbiddenStyle(lex.exampleVi, `lexicon.${lex.id}.exampleVi`);
}
for (const band of ['A1', 'A2', 'B1', 'B2'] as const) {
  assert(cefrCounts[band] >= 25, `Expected >= 25 ${band} words, got ${cefrCounts[band]}`);
}

// 8. Dialogues (150+ contextual dialogues)
assert(DIALOGUES.length >= 150, `Expected >= 150 dialogues, got ${DIALOGUES.length}`);
const seenDlgIds = new Set<string>();
for (const dlg of DIALOGUES) {
  assert(!seenDlgIds.has(dlg.id), `Duplicate dialogue id: ${dlg.id}`);
  seenDlgIds.add(dlg.id);
  for (const line of dlg.lines) {
    checkPureAsciiEnglish(line.en, `dialogue.${dlg.id}.en`);
    checkNoForbiddenStyle(line.vi, `dialogue.${dlg.id}.vi`);
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
}

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `Data validation passed: ${SPECIES.length} species, ${MOVES.length} moves, ${ITEMS.length} items, ${MAPS.length} maps, ${NPCS.length} NPCs (${bosses.length} bosses), ${QUESTS.length} quests, ${LEXICON_ENTRIES.length} lexicon entries (A1:${cefrCounts.A1}, A2:${cefrCounts.A2}, B1:${cefrCounts.B1}, B2:${cefrCounts.B2}), ${DIALOGUES.length} dialogues.`,
);

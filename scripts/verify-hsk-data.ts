import fs from 'node:fs';
import path from 'node:path';
import { ZH_LEXICON_ENTRIES, ZH_LEXICON_HSK1, ZH_LEXICON_HSK2, ZH_LEXICON_HSK3 } from '../src/data/zh-lexicon.ts';

/**
 * Reproducible HSK 2.0 (Hanban 2012) lexicon verification & cleaning audit script.
 * - Verifies exact 150 HSK 1 + 150 HSK 2 + 298 HSK 3 headwords (+ 2 official HSK 3 polyphonic senses 还 huán / 长 zhǎng = 600 cumulative).
 * - Verifies tone-marked Pinyin orthography (no raw tone digits, no invalid tone placement like `zùi` or `jìe`).
 * - Verifies every entry has Vietnamese meaning, Simplified Hanzi example containing the headword, example Pinyin, and Vietnamese translation.
 * - Cross-checks official HSK 2.0 CSV files if provided in `--ref-dir <path>`.
 */

const errors: string[] = [];

function fail(msg: string): void {
  errors.push(msg);
}

// Mandarin pinyin orthography check:
// - Must not contain numeric tones [1-5]
// - Must not contain invalid vowel tone-placement patterns (`ìe`, `ùo`, `ùi`, `íu`, `ào` is ok, `oà` is wrong, etc.)
const BAD_PINYIN_PATTERNS: ReadonlyArray<{ re: RegExp; desc: string }> = [
  { re: /[0-9]/, desc: 'raw tone digit' },
  { re: /[īíǐì]u/i, desc: 'tone on i in iu (must go on u)' },
  { re: /[ūúǔù]i/i, desc: 'tone on u in ui (must go on i)' },
  { re: /[īíǐì]a/i, desc: 'tone on i in ia (must go on a)' },
  { re: /[īíǐì]e/i, desc: 'tone on i in ie (must go on e)' },
  { re: /[īíǐì]o/i, desc: 'tone on i in io (must go on o)' },
  { re: /[ūúǔù]a/i, desc: 'tone on u in ua (must go on a)' },
  { re: /[ūúǔù]o/i, desc: 'tone on u in uo (must go on o)' },
  { re: /[ūúǔù]e/i, desc: 'tone on u in ue (must go on e)' },
  { re: /[aāáǎà][īíǐìūúǔù]/i, desc: 'tone on second vowel after a' },
  { re: /[eēéěè][īíǐìūúǔù]/i, desc: 'tone on second vowel after e' },
  { re: /[oōóǒò][ūúǔù]/i, desc: 'tone on u after o' },
];

function checkPinyin(pinyin: string, label: string): void {
  if (!pinyin.trim()) {
    fail(`${label}: empty pinyin`);
    return;
  }
  for (const rule of BAD_PINYIN_PATTERNS) {
    if (rule.re.test(pinyin)) {
      fail(`${label}: invalid pinyin "${pinyin}" (${rule.desc})`);
    }
  }
}

const seenIds = new Set<string>();
const seenHanzi = new Map<string, string>();

for (const entry of ZH_LEXICON_ENTRIES) {
  if (seenIds.has(entry.id)) {
    fail(`Duplicate Chinese lexicon id: ${entry.id}`);
  }
  seenIds.add(entry.id);
  if (!entry.id.startsWith('zh:')) {
    fail(`Chinese lexicon id must be namespaced with "zh:": ${entry.id}`);
  }
  if (seenHanzi.has(entry.hanzi)) {
    fail(`Duplicate Hanzi "${entry.hanzi}" in ${entry.id} and ${seenHanzi.get(entry.hanzi)}`);
  }
  seenHanzi.set(entry.hanzi, entry.id);

  checkPinyin(entry.pinyin, `${entry.id}.pinyin`);
  checkPinyin(entry.examplePinyin, `${entry.id}.examplePinyin`);

  if (!entry.meaningVi.trim()) fail(`${entry.id}: empty meaningVi`);
  if (!entry.exampleZh.trim()) fail(`${entry.id}: empty exampleZh`);
  if (!entry.exampleVi.trim()) fail(`${entry.id}: empty exampleVi`);
  if (/[\u2013\u2014]/.test(`${entry.meaningVi} ${entry.exampleVi}`)) {
    fail(`${entry.id}: contains forbidden en-dash or em-dash`);
  }
  if (/[\u{1F300}-\u{1FAFF}]/u.test(`${entry.meaningVi} ${entry.exampleVi} ${entry.exampleZh}`)) {
    fail(`${entry.id}: contains forbidden emoji`);
  }
  const hasWordInExample =
    entry.exampleZh.includes(entry.hanzi) ||
    (entry.variants ?? []).some((v) => entry.exampleZh.includes(v));
  if (!hasWordInExample) {
    fail(`${entry.id} (${entry.hanzi}): exampleZh "${entry.exampleZh}" does not contain headword`);
  }

  for (const s of entry.senses ?? []) {
    checkPinyin(s.pinyin, `${entry.id}.${s.senseId}.pinyin`);
    checkPinyin(s.examplePinyin, `${entry.id}.${s.senseId}.examplePinyin`);
    if (s.contextHints.length === 0) {
      fail(`${entry.id}.${s.senseId}: empty contextHints`);
    }
    if (!s.exampleZh.includes(entry.hanzi)) {
      fail(`${entry.id}.${s.senseId}: exampleZh "${s.exampleZh}" does not contain ${entry.hanzi}`);
    }
  }
}

if (ZH_LEXICON_HSK1.length !== 150) {
  fail(`Expected 150 HSK1 entries, got ${ZH_LEXICON_HSK1.length}`);
}
if (ZH_LEXICON_HSK2.length !== 150) {
  fail(`Expected 150 HSK2 entries, got ${ZH_LEXICON_HSK2.length}`);
}
if (ZH_LEXICON_HSK3.length !== 298) {
  fail(`Expected 298 new HSK3 headwords (+2 polyphonic HSK3 readings = 300), got ${ZH_LEXICON_HSK3.length}`);
}

// Verify official HSK 3 polyphonic second readings 还(huán) & 长(zhǎng)
const haiEntry = ZH_LEXICON_HSK2.find((e) => e.hanzi === '还');
if (!haiEntry?.senses?.some((s) => s.pinyin === 'huán')) {
  fail('HSK 2/3 polyphone 还 missing HSK 3 reading huán');
}
const changEntry = ZH_LEXICON_HSK2.find((e) => e.hanzi === '长');
if (!changEntry?.senses?.some((s) => s.pinyin === 'zhǎng')) {
  fail('HSK 2/3 polyphone 长 missing HSK 3 reading zhǎng');
}

// Optional cross-check against official sawcordwell/HSK-Vocab CSV files
const refIdx = process.argv.indexOf('--ref-dir');
if (refIdx >= 0 && process.argv[refIdx + 1]) {
  const refDir = process.argv[refIdx + 1]!;
  const parseSaw = (file: string): string[] =>
    fs
      .readFileSync(path.join(refDir, file), 'utf8')
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.split(',')[1]!.trim().replace(/（.*?）/g, ''));

  const ref1 = new Set(parseSaw('saw_hsk_1.csv'));
  const ref2All = new Set(parseSaw('saw_hsk_2.csv'));
  const ref3All = new Set(parseSaw('saw_hsk_3.csv'));
  const ref4All = new Set(parseSaw('saw_hsk_4.csv'));

  const our1 = new Set(ZH_LEXICON_HSK1.map((e) => e.hanzi));
  const our2 = new Set(ZH_LEXICON_HSK2.map((e) => e.hanzi));
  const our3 = new Set(ZH_LEXICON_HSK3.map((e) => e.hanzi));

  for (const w of ref1) {
    if (!our1.has(w)) fail(`Missing official HSK 1 word: ${w}`);
  }
  for (const w of ref2All) {
    if (!ref1.has(w) && !our2.has(w)) fail(`Missing official HSK 2 word: ${w}`);
  }
  for (const w of ref3All) {
    if (!ref2All.has(w) && !our3.has(w)) fail(`Missing official HSK 3 word: ${w}`);
  }
  // Verify every entry tagged hsk: 'HSK4' truly belongs to official HSK 4 (and not HSK 1-3!)
  for (const entry of ZH_LEXICON_ENTRIES) {
    if (entry.hsk === 'HSK4' && (!ref4All.has(entry.hanzi) || ref3All.has(entry.hanzi))) {
      fail(`Entry ${entry.id} (${entry.hanzi}) is tagged HSK4 but is not an official HSK 4 exclusive word`);
    }
  }
}

if (errors.length > 0) {
  console.error(`HSK verification failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const byHsk = {
  HSK1: ZH_LEXICON_ENTRIES.filter((e) => e.hsk === 'HSK1').length,
  HSK2: ZH_LEXICON_ENTRIES.filter((e) => e.hsk === 'HSK2').length,
  HSK3: ZH_LEXICON_ENTRIES.filter((e) => e.hsk === 'HSK3').length,
  HSK4: ZH_LEXICON_ENTRIES.filter((e) => e.hsk === 'HSK4').length,
  unmarkedDomain: ZH_LEXICON_ENTRIES.filter((e) => !e.hsk).length,
};
console.log(
  `HSK 2.0 verification passed: ${ZH_LEXICON_ENTRIES.length} total Chinese entries (HSK1:${byHsk.HSK1}, HSK2:${byHsk.HSK2}, HSK3:${byHsk.HSK3}+2 polyphones=300, HSK4_suppl:${byHsk.HSK4}, domain:${byHsk.unmarkedDomain}).`,
);

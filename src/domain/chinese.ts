import {
  computeWordReencounterPriority,
  isWordDueForReencounter,
  REVIEW_STEP_INTERVALS,
  REVIEW_TIME_INTERVALS_MS,
} from './learning.ts';
import type {
  ChineseHskTag,
  ChineseLexiconEntry,
  ChinesePos,
  ChineseProperNoun,
  ChineseSense,
  GameState,
  HskLevel,
  RegionId,
  WordMemoryRecord,
} from './types.ts';

export interface ChineseTextToken {
  readonly raw: string;
  readonly isWord: boolean;
  readonly entry?: ChineseLexiconEntry;
  readonly properNoun?: ChineseProperNoun;
  readonly resolvedPinyin: string;
  readonly resolvedPos?: ChinesePos;
  readonly resolvedMeaningVi?: string;
}

interface TrieNode {
  readonly children: Map<string, TrieNode>;
  entry?: ChineseLexiconEntry;
  properNoun?: ChineseProperNoun;
}

export interface ChineseLexiconIndex {
  readonly byId: Readonly<Record<string, ChineseLexiconEntry>>;
  readonly byHanzi: Readonly<Record<string, ChineseLexiconEntry>>;
  readonly properByHanzi: Readonly<Record<string, ChineseProperNoun>>;
  readonly entries: ReadonlyArray<ChineseLexiconEntry>;
  readonly properNouns: ReadonlyArray<ChineseProperNoun>;
  readonly trieRoot: TrieNode;
  readonly maxWordLen: number;
}

const HSK_RANK: Readonly<Record<ChineseHskTag, number>> = {
  HSK1: 1,
  HSK2: 2,
  HSK3: 3,
  HSK4: 4,
};

const CJK_CHAR_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const CJK_RUN_RE = /[\u3400-\u9FFF\uF900-\uFAFF]+|[^\u3400-\u9FFF\uF900-\uFAFF]+/g;

let cachedIntlSegmenter: Intl.Segmenter | null | undefined;

function getNativeZhSegmenter(): Intl.Segmenter | null {
  if (cachedIntlSegmenter !== undefined) return cachedIntlSegmenter;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      cachedIntlSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
      return cachedIntlSegmenter;
    }
  } catch {
    // Fall back to pure Trie FMM when Intl.Segmenter is unavailable
  }
  cachedIntlSegmenter = null;
  return null;
}

function insertTrie(
  root: TrieNode,
  word: string,
  payload: { entry?: ChineseLexiconEntry; properNoun?: ChineseProperNoun },
): void {
  let node = root;
  for (const ch of word) {
    let next = node.children.get(ch);
    if (!next) {
      next = { children: new Map() };
      node.children.set(ch, next);
    }
    node = next;
  }
  if (payload.properNoun && !node.properNoun) {
    node.properNoun = payload.properNoun;
  }
  if (payload.entry && !node.entry) {
    node.entry = payload.entry;
  }
}

export function createChineseLexiconIndex(
  entries: ReadonlyArray<ChineseLexiconEntry>,
  properNouns: ReadonlyArray<ChineseProperNoun>,
): ChineseLexiconIndex {
  const byId: Record<string, ChineseLexiconEntry> = {};
  const byHanzi: Record<string, ChineseLexiconEntry> = {};
  const properByHanzi: Record<string, ChineseProperNoun> = {};
  const trieRoot: TrieNode = { children: new Map() };
  let maxWordLen = 1;

  for (const pn of properNouns) {
    properByHanzi[pn.hanzi] = pn;
    maxWordLen = Math.max(maxWordLen, pn.hanzi.length);
    insertTrie(trieRoot, pn.hanzi, { properNoun: pn });
  }

  for (const entry of entries) {
    byId[entry.id] = entry;
    if (!byHanzi[entry.hanzi]) {
      byHanzi[entry.hanzi] = entry;
    }
    maxWordLen = Math.max(maxWordLen, entry.hanzi.length);
    insertTrie(trieRoot, entry.hanzi, { entry });
    for (const v of entry.variants ?? []) {
      if (!byHanzi[v]) {
        byHanzi[v] = entry;
      }
      maxWordLen = Math.max(maxWordLen, v.length);
      insertTrie(trieRoot, v, { entry });
    }
  }

  return {
    byId,
    byHanzi,
    properByHanzi,
    entries,
    properNouns,
    trieRoot,
    maxWordLen,
  };
}

export function resolveChineseSenseForContext(
  entry: ChineseLexiconEntry,
  contextTag: string,
  surroundingSentenceZh: string = '',
  prevToken: string = '',
  nextToken: string = '',
): {
  readonly primary: {
    readonly pinyin: string;
    readonly pos: ChinesePos;
    readonly meaningVi: string;
    readonly exampleZh: string;
    readonly examplePinyin: string;
    readonly exampleVi: string;
  };
  readonly otherSenses: ReadonlyArray<ChineseSense>;
} {
  if (!entry.senses || entry.senses.length === 0) {
    return {
      primary: {
        pinyin: entry.pinyin,
        pos: entry.pos,
        meaningVi: entry.meaningVi,
        exampleZh: entry.exampleZh,
        examplePinyin: entry.examplePinyin,
        exampleVi: entry.exampleVi,
      },
      otherSenses: [],
    };
  }

  const localWindow = `${prevToken}${entry.hanzi}${nextToken}`;
  const fullContext = `${contextTag} ${localWindow} ${surroundingSentenceZh}`.toLowerCase();

  let chosen = entry.senses[0]!;
  let bestScore = -1;

  for (const sense of entry.senses) {
    let score = 0;
    for (const hint of sense.contextHints) {
      const h = hint.toLowerCase();
      if (localWindow.toLowerCase().includes(h)) {
        score += 3;
      } else if (fullContext.includes(h)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      chosen = sense;
    }
  }

  const others = entry.senses.filter((s) => s.senseId !== chosen.senseId);
  return {
    primary: {
      pinyin: chosen.pinyin,
      pos: chosen.pos,
      meaningVi: chosen.meaningVi,
      exampleZh: chosen.exampleZh,
      examplePinyin: chosen.examplePinyin,
      exampleVi: chosen.exampleVi,
    },
    otherSenses: others,
  };
}

interface TrieHit {
  readonly len: number;
  readonly entry?: ChineseLexiconEntry;
  readonly properNoun?: ChineseProperNoun;
}

function collectTrieHits(run: string, start: number, root: TrieNode): TrieHit[] {
  const hits: TrieHit[] = [];
  let node: TrieNode | undefined = root;
  for (let i = start; i < run.length; i++) {
    const ch = run[i]!;
    node = node.children.get(ch);
    if (!node) break;
    if (node.properNoun || node.entry) {
      hits.push({
        len: i - start + 1,
        entry: node.entry,
        properNoun: node.properNoun,
      });
    }
  }
  return hits;
}

function segmentCjkRun(
  run: string,
  index: ChineseLexiconIndex,
  useIntlSegmenter: boolean,
): Array<{ raw: string; entry?: ChineseLexiconEntry; properNoun?: ChineseProperNoun }> {
  const segSpans = new Map<number, number>();
  if (useIntlSegmenter) {
    const segmenter = getNativeZhSegmenter();
    if (segmenter) {
      for (const part of segmenter.segment(run)) {
        if (part.isWordLike) {
          segSpans.set(part.index, part.segment.length);
        }
      }
    }
  }

  const out: Array<{ raw: string; entry?: ChineseLexiconEntry; properNoun?: ChineseProperNoun }> = [];
  let pos = 0;
  while (pos < run.length) {
    const hits = collectTrieHits(run, pos, index.trieRoot);
    const intlLen = segSpans.get(pos) ?? 1;

    if (hits.length > 0) {
      // Pick longest Trie hit, with overlap-ambiguity tie-breaker via Intl.Segmenter
      let chosen = hits[hits.length - 1]!;

      // Always keep proper nouns intact as a single unit
      const properHit = [...hits].reverse().find((h) => Boolean(h.properNoun));
      if (properHit && properHit.len >= chosen.len) {
        chosen = properHit;
      } else if (chosen.len >= 2 && intlLen > 0 && intlLen < chosen.len) {
        // Check if Intl.Segmenter prefers a cleaner split where BOTH parts exist in dictionary
        const shorterHit = hits.find((h) => h.len === intlLen);
        if (shorterHit) {
          const nextPos = pos + shorterHit.len;
          const afterShorter = collectTrieHits(run, nextPos, index.trieRoot);
          const afterLonger = collectTrieHits(run, pos + chosen.len, index.trieRoot);
          const shorterLeadsToMulti = afterShorter.some((h) => h.len >= 2);
          const longerStrandsUnknown =
            pos + chosen.len < run.length && afterLonger.length === 0;
          if (shorterLeadsToMulti && longerStrandsUnknown) {
            chosen = shorterHit;
          }
        }
      }

      const raw = run.slice(pos, pos + chosen.len);
      out.push({ raw, entry: chosen.entry, properNoun: chosen.properNoun });
      pos += chosen.len;
      continue;
    }

    // No dictionary match at pos: if Intl.Segmenter grouped a multi-char chunk whose second char IS in dictionary, emit 1 char so the rest stays tappable!
    if (intlLen > 1) {
      let innerKnownAt = -1;
      for (let k = 1; k < intlLen; k++) {
        if (collectTrieHits(run, pos + k, index.trieRoot).length > 0) {
          innerKnownAt = k;
          break;
        }
      }
      const stepLen = innerKnownAt > 0 ? innerKnownAt : intlLen;
      out.push({ raw: run.slice(pos, pos + stepLen) });
      pos += stepLen;
    } else {
      out.push({ raw: run[pos]! });
      pos += 1;
    }
  }
  return out;
}

export function tokenizeChineseText(
  text: string,
  index: ChineseLexiconIndex,
  contextTag: string = '',
  options?: { readonly useIntlSegmenter?: boolean },
): ChineseTextToken[] {
  const useIntl = options?.useIntlSegmenter ?? true;
  const rawRuns = text.match(CJK_RUN_RE) ?? [text];
  const prelim: Array<{
    raw: string;
    isWord: boolean;
    entry?: ChineseLexiconEntry;
    properNoun?: ChineseProperNoun;
  }> = [];

  for (const run of rawRuns) {
    if (!CJK_CHAR_RE.test(run)) {
      prelim.push({ raw: run, isWord: false });
      continue;
    }
    const pieces = segmentCjkRun(run, index, useIntl);
    for (const piece of pieces) {
      prelim.push({
        raw: piece.raw,
        isWord: true,
        entry: piece.entry,
        properNoun: piece.properNoun,
      });
    }
  }

  return prelim.map((tok, idx) => {
    if (!tok.isWord) {
      return { raw: tok.raw, isWord: false, resolvedPinyin: '' };
    }
    if (tok.properNoun) {
      return {
        raw: tok.raw,
        isWord: true,
        properNoun: tok.properNoun,
        resolvedPinyin: tok.properNoun.pinyin,
        resolvedMeaningVi: tok.properNoun.nameVi,
      };
    }
    if (tok.entry) {
      const prevRaw = prelim[idx - 1]?.raw ?? '';
      const nextRaw = prelim[idx + 1]?.raw ?? '';
      const resolved = resolveChineseSenseForContext(
        tok.entry,
        contextTag,
        text,
        prevRaw,
        nextRaw,
      );
      return {
        raw: tok.raw,
        isWord: true,
        entry: tok.entry,
        resolvedPinyin: resolved.primary.pinyin,
        resolvedPos: resolved.primary.pos,
        resolvedMeaningVi: resolved.primary.meaningVi,
      };
    }
    return {
      raw: tok.raw,
      isWord: true,
      resolvedPinyin: '',
    };
  });
}

export function ensureChineseLexiconState(state: GameState): Record<string, WordMemoryRecord> {
  if (!state.lexiconZh) {
    state.lexiconZh = {};
  }
  return state.lexiconZh;
}

export function shouldHighlightChineseToken(
  entry: ChineseLexiconEntry | undefined,
  state: GameState,
): boolean {
  if (!entry) return false;
  const lexZh = ensureChineseLexiconState(state);
  const mem = lexZh[entry.id];
  if (state.settings.zhStudyMode === 'zh_immersion') {
    return Boolean(mem?.savedByPlayer);
  }
  if (mem?.savedByPlayer || (mem?.glossLookups ?? 0) >= 2) {
    return true;
  }
  if (mem && mem.mastery >= 3) {
    return false;
  }
  if (!entry.hsk) return false;
  const targetHsk: HskLevel = state.settings.hskLevel ?? 'HSK2';
  return HSK_RANK[entry.hsk] >= HSK_RANK[targetHsk];
}

function getOrCreateChineseMemory(
  state: GameState,
  wordId: string,
  nowMs: number = Date.now(),
): WordMemoryRecord {
  const lexZh = ensureChineseLexiconState(state);
  const existing = lexZh[wordId];
  if (existing) return existing;
  const fresh: WordMemoryRecord = {
    wordId,
    exposures: 0,
    glossLookups: 0,
    savedByPlayer: false,
    mastery: 0,
    lastSeenStep: state.stepCount,
    lastSeenAtMs: nowMs,
    nextReviewStep: state.stepCount + REVIEW_STEP_INTERVALS[0],
    nextReviewAtMs: nowMs + REVIEW_TIME_INTERVALS_MS[0],
    correctReviews: 0,
    lapses: 0,
    contextsSeen: [],
  };
  lexZh[wordId] = fresh;
  return fresh;
}

export function recordChineseSentenceExposure(
  state: GameState,
  textZh: string,
  contextTag: string,
  index: ChineseLexiconIndex,
  nowMs: number = Date.now(),
): void {
  const seenInLine = new Set<string>();
  const tokens = tokenizeChineseText(textZh, index, contextTag);
  for (const token of tokens) {
    if (!token.entry || seenInLine.has(token.entry.id)) continue;
    seenInLine.add(token.entry.id);
    const mem = getOrCreateChineseMemory(state, token.entry.id, nowMs);
    mem.exposures += 1;
    mem.lastSeenStep = state.stepCount;
    mem.lastSeenAtMs = nowMs;
    if (contextTag && !mem.contextsSeen.includes(contextTag) && mem.contextsSeen.length < 40) {
      mem.contextsSeen.push(contextTag);
    }
  }
}

export function recordChineseWordLookup(
  state: GameState,
  wordId: string,
  contextTag: string,
  nowMs: number = Date.now(),
): WordMemoryRecord {
  const mem = getOrCreateChineseMemory(state, wordId, nowMs);
  mem.glossLookups += 1;
  mem.lastSeenStep = state.stepCount;
  mem.lastSeenAtMs = nowMs;
  mem.nextReviewStep = state.stepCount + 10;
  mem.nextReviewAtMs = nowMs + REVIEW_TIME_INTERVALS_MS[0];
  if (contextTag && !mem.contextsSeen.includes(contextTag) && mem.contextsSeen.length < 40) {
    mem.contextsSeen.push(contextTag);
  }
  state.stats.zhWordsGlossed = (state.stats.zhWordsGlossed ?? 0) + 1;
  return mem;
}

export function toggleChineseWordSaved(
  state: GameState,
  wordId: string,
  nowMs: number = Date.now(),
): boolean {
  const mem = getOrCreateChineseMemory(state, wordId, nowMs);
  mem.savedByPlayer = !mem.savedByPlayer;
  if (mem.savedByPlayer) {
    mem.nextReviewStep = Math.min(
      mem.nextReviewStep ?? state.stepCount + 12,
      state.stepCount + 12,
    );
    mem.nextReviewAtMs = Math.min(
      mem.nextReviewAtMs ?? nowMs + REVIEW_TIME_INTERVALS_MS[0],
      nowMs + REVIEW_TIME_INTERVALS_MS[0],
    );
  }
  return mem.savedByPlayer;
}

export function getDueChineseReencounterEntries(
  state: GameState,
  index: ChineseLexiconIndex,
  limit: number = 4,
  nowMs: number = Date.now(),
): ChineseLexiconEntry[] {
  const lexZh = ensureChineseLexiconState(state);
  const dueItems = Object.values(lexZh)
    .filter((mem) => isWordDueForReencounter(mem, state, nowMs))
    .map((mem) => ({
      mem,
      entry: index.byId[mem.wordId],
      priority: computeWordReencounterPriority(mem, state, nowMs),
    }))
    .filter(
      (item): item is { mem: WordMemoryRecord; entry: ChineseLexiconEntry; priority: number } =>
        item.entry !== undefined,
    );

  dueItems.sort((a, b) => {
    const aMastered = a.mem.mastery >= 3 ? 1 : 0;
    const bMastered = b.mem.mastery >= 3 ? 1 : 0;
    if (aMastered !== bMastered) return aMastered - bMastered;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.entry.id.localeCompare(b.entry.id);
  });

  return dueItems.slice(0, limit).map((x) => x.entry);
}

const REGION_ZH_SCENERY_TEMPLATES: Readonly<
  Record<RegionId, { readonly prefixZh: string; readonly prefixVi: string }>
> = {
  mosslight_hub: {
    prefixZh: '在苔灯营地，护林员记录：',
    prefixVi: 'Quanh Trại Đèn Rêu, kiểm lâm ghi nhận:',
  },
  whisperwood: {
    prefixZh: '在低语林的小路上，你看到一条新笔记：',
    prefixVi: 'Dọc lối rêu Rừng Thầm, bạn bắt gặp ngữ cảnh mới:',
  },
  reedwater_fen: {
    prefixZh: '在清芦湿地的木桥边，笔记写着：',
    prefixVi: 'Trên cầu ván Đầm Sậy mờ sương, sổ tay ghi lại:',
  },
  terracotta_ridge: {
    prefixZh: '在红土山脊的阳光下，侦察记录写着：',
    prefixVi: 'Trên Đèo Đất Nung đầy nắng, nhật ký trinh sát chép:',
  },
  starfall_sanctuary: {
    prefixZh: '在星落圣地的石门下，石碑刻着：',
    prefixVi: 'Dưới vòm đá Thánh Địa Sao Rơi, dòng văn bia khắc:',
  },
};

export function buildChineseContextualReencounterEcho(
  state: GameState,
  regionId: RegionId,
  index: ChineseLexiconIndex,
  nowMs: number = Date.now(),
): { readonly zh: string; readonly vi: string; readonly wordId: string } | null {
  const lexZh = ensureChineseLexiconState(state);
  const due = getDueChineseReencounterEntries(state, index, 8, nowMs).filter(
    (e) =>
      ((lexZh[e.id]?.glossLookups ?? 0) > 0 ||
        lexZh[e.id]?.savedByPlayer ||
        (lexZh[e.id]?.lapses ?? 0) > 0) &&
      (lexZh[e.id]?.mastery ?? 0) < 3,
  );
  const chosen = due[0];
  if (!chosen) return null;

  const mem = lexZh[chosen.id];
  if (mem) {
    mem.nextReviewStep = state.stepCount + REVIEW_STEP_INTERVALS[mem.mastery];
    mem.nextReviewAtMs = nowMs + REVIEW_TIME_INTERVALS_MS[mem.mastery];
    mem.lastSeenAtMs = nowMs;
  }

  const framing = REGION_ZH_SCENERY_TEMPLATES[regionId];
  return {
    wordId: chosen.id,
    zh: `${framing.prefixZh}${chosen.exampleZh}`,
    vi: `${framing.prefixVi} ${chosen.exampleVi}`,
  };
}

export type ChineseCampfirePromptMode = 'hanzi_to_vi' | 'hanzi_to_pinyin' | 'listen_to_hanzi';

export interface ChineseCampfireReviewPrompt {
  readonly entry: ChineseLexiconEntry;
  readonly mode: ChineseCampfirePromptMode;
  readonly promptSentenceZh: string;
  readonly promptSentencePinyin: string;
  readonly promptSentenceVi: string;
  readonly isDueNow: boolean;
  readonly choices: ReadonlyArray<{ readonly wordId: string; readonly label: string }>;
}

export function buildChineseCampfireReviewSet(
  state: GameState,
  index: ChineseLexiconIndex,
  maxItems: number = 4,
  nowMs: number = Date.now(),
): ChineseCampfireReviewPrompt[] {
  const lexZh = ensureChineseLexiconState(state);
  const dueEntries = getDueChineseReencounterEntries(state, index, maxItems, nowMs);
  const dueIds = new Set(dueEntries.map((e) => e.id));
  const chosen: Array<{ entry: ChineseLexiconEntry; isDueNow: boolean }> = dueEntries.map(
    (entry) => ({ entry, isDueNow: true }),
  );

  if (chosen.length < maxItems) {
    const optionalExtras = Object.values(lexZh)
      .filter(
        (mem) =>
          !dueIds.has(mem.wordId) &&
          mem.mastery < 3 &&
          (mem.savedByPlayer || mem.glossLookups > 0 || (mem.lapses ?? 0) > 0),
      )
      .map((mem) => ({
        mem,
        entry: index.byId[mem.wordId],
        score: computeWordReencounterPriority(mem, state, nowMs),
      }))
      .filter(
        (x): x is { mem: WordMemoryRecord; entry: ChineseLexiconEntry; score: number } =>
          x.entry !== undefined,
      )
      .sort((a, b) => b.score - a.score);

    for (const extra of optionalExtras) {
      if (chosen.length >= maxItems) break;
      chosen.push({ entry: extra.entry, isDueNow: false });
    }
  }

  if (chosen.length === 0) {
    const targetHsk = state.settings.hskLevel ?? 'HSK2';
    for (const fallback of index.entries) {
      if (fallback.hsk === targetHsk) {
        chosen.push({ entry: fallback, isDueNow: false });
      }
      if (chosen.length >= Math.min(3, maxItems)) break;
    }
  }

  const modes: ReadonlyArray<ChineseCampfirePromptMode> = [
    'hanzi_to_vi',
    'hanzi_to_pinyin',
    'listen_to_hanzi',
  ];

  const prompts: ChineseCampfireReviewPrompt[] = [];
  chosen.forEach(({ entry: target, isDueNow }, idx) => {
    const mode = modes[idx % modes.length]!;
    const distractors: ChineseLexiconEntry[] = [];
    for (const other of index.entries) {
      if (
        other.id === target.id ||
        other.meaningVi === target.meaningVi ||
        other.pinyin === target.pinyin
      ) {
        continue;
      }
      if (other.hsk === target.hsk || other.pos === target.pos || distractors.length < 3) {
        distractors.push(other);
      }
      if (distractors.length >= 3) break;
    }

    const formatChoice = (item: ChineseLexiconEntry): { readonly wordId: string; readonly label: string } => {
      if (mode === 'hanzi_to_pinyin') {
        return { wordId: item.id, label: item.pinyin };
      }
      if (mode === 'listen_to_hanzi') {
        return { wordId: item.id, label: `${item.hanzi} (${item.meaningVi})` };
      }
      return { wordId: item.id, label: item.meaningVi };
    };

    const rawChoices = [formatChoice(target), ...distractors.slice(0, 3).map(formatChoice)];
    const shift = (target.hanzi.charCodeAt(0) + idx) % rawChoices.length;
    const rotated = [...rawChoices.slice(shift), ...rawChoices.slice(0, shift)];

    prompts.push({
      entry: target,
      mode,
      promptSentenceZh: target.exampleZh,
      promptSentencePinyin: target.examplePinyin,
      promptSentenceVi: target.exampleVi,
      isDueNow,
      choices: rotated,
    });
  });

  return prompts;
}

export function recordChineseCampfireRecall(
  state: GameState,
  wordId: string,
  rememberedWell: boolean,
  nowMs: number = Date.now(),
): WordMemoryRecord {
  const mem = getOrCreateChineseMemory(state, wordId, nowMs);
  if (rememberedWell) {
    mem.correctReviews = (mem.correctReviews ?? 0) + 1;
    mem.mastery = Math.min(3, mem.mastery + 1) as 0 | 1 | 2 | 3;
    mem.nextReviewStep = state.stepCount + REVIEW_STEP_INTERVALS[mem.mastery];
    mem.nextReviewAtMs = nowMs + REVIEW_TIME_INTERVALS_MS[mem.mastery];
  } else {
    mem.lapses = (mem.lapses ?? 0) + 1;
    if (mem.mastery > 0) {
      mem.mastery = (mem.mastery - 1) as 0 | 1 | 2 | 3;
    }
    mem.nextReviewStep = state.stepCount + 10;
    mem.nextReviewAtMs = nowMs + REVIEW_TIME_INTERVALS_MS[0];
  }
  mem.lastSeenStep = state.stepCount;
  mem.lastSeenAtMs = nowMs;
  state.stats.zhCampReviewsCompleted = (state.stats.zhCampReviewsCompleted ?? 0) + 1;
  return mem;
}

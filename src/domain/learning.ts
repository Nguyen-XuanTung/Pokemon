import { IRREGULAR_BASES, POCKET_DICT, type PocketWordNote } from '../data/pocket-dict.ts';
import type {
  CefrBand,
  DialogueLine,
  GameState,
  LexiconEntry,
  PolysemySense,
  RegionId,
  WordMemoryRecord,
} from './types.ts';

export interface TextToken {
  readonly raw: string;
  readonly normalized: string;
  readonly isWord: boolean;
  readonly entry?: LexiconEntry;
  readonly pocketNote?: PocketWordNote;
}

export interface LexiconIndex {
  readonly byId: Readonly<Record<string, LexiconEntry>>;
  readonly bySurface: Readonly<Record<string, LexiconEntry>>;
  readonly phrasesByFirstWord: Readonly<
    Record<string, ReadonlyArray<{ readonly words: ReadonlyArray<string>; readonly entry: LexiconEntry }>>
  >;
  readonly entries: ReadonlyArray<LexiconEntry>;
}

const CEFR_RANK: Readonly<Record<CefrBand, number>> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
};

export const REVIEW_STEP_INTERVALS: Readonly<Record<0 | 1 | 2 | 3, number>> = {
  0: 14,
  1: 32,
  2: 75,
  3: 180,
};

export const REVIEW_TIME_INTERVALS_MS: Readonly<Record<0 | 1 | 2 | 3, number>> = {
  0: 2 * 60_000,
  1: 6 * 60_000,
  2: 20 * 60_000,
  3: 60 * 60_000,
};

export function createLexiconIndex(entries: ReadonlyArray<LexiconEntry>): LexiconIndex {
  const byId: Record<string, LexiconEntry> = {};
  const bySurface: Record<string, LexiconEntry> = {};
  const phrasesMap: Record<
    string,
    Array<{ readonly words: ReadonlyArray<string>; readonly entry: LexiconEntry }>
  > = {};

  const registerPhraseOrWord = (surface: string, entry: LexiconEntry): void => {
    const cleaned = surface.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!cleaned) return;
    if (!bySurface[cleaned]) {
      bySurface[cleaned] = entry;
    }
    if (cleaned.includes(' ')) {
      const words = cleaned.split(' ').filter(Boolean);
      const first = words[0];
      if (!first || words.length < 2) return;
      const list = phrasesMap[first] ?? (phrasesMap[first] = []);
      list.push({ words, entry });
    }
  };

  for (const entry of entries) {
    byId[entry.id] = entry;
    registerPhraseOrWord(entry.word, entry);
    for (const form of entry.forms) {
      registerPhraseOrWord(form, entry);
    }
  }

  for (const list of Object.values(phrasesMap)) {
    list.sort((a, b) => b.words.length - a.words.length);
  }

  return { byId, bySurface, phrasesByFirstWord: phrasesMap, entries };
}

function candidateStems(normalized: string): string[] {
  const candidates: string[] = [normalized];
  const cleanContraction = normalized.replace(/'(s|d|ll|re|ve|m|t)$/, '');
  if (cleanContraction && cleanContraction !== normalized) {
    candidates.push(cleanContraction);
  }
  const irr = IRREGULAR_BASES[normalized] ?? IRREGULAR_BASES[cleanContraction];
  if (irr) candidates.push(irr);

  if (normalized.endsWith('ies') && normalized.length > 4) {
    candidates.push(normalized.slice(0, -3) + 'y');
  }
  if (normalized.endsWith('ied') && normalized.length > 4) {
    candidates.push(normalized.slice(0, -3) + 'y');
  }
  if (normalized.endsWith('ing') && normalized.length > 5) {
    const base = normalized.slice(0, -3);
    candidates.push(base, base + 'e');
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      candidates.push(base.slice(0, -1));
    }
  }
  if (normalized.endsWith('ed') && normalized.length > 4) {
    const base = normalized.slice(0, -2);
    candidates.push(base, normalized.slice(0, -1));
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      candidates.push(base.slice(0, -1));
    }
  }
  if (normalized.endsWith('ly') && normalized.length > 4) {
    const base = normalized.slice(0, -2);
    candidates.push(base, base + 'e');
    if (base.endsWith('i')) candidates.push(base.slice(0, -1) + 'y');
  }
  if (normalized.endsWith('er') && normalized.length > 4) {
    candidates.push(normalized.slice(0, -2), normalized.slice(0, -1));
  }
  if (normalized.endsWith('est') && normalized.length > 5) {
    candidates.push(normalized.slice(0, -3), normalized.slice(0, -2));
  }
  if (normalized.endsWith('es') && normalized.length > 4) {
    candidates.push(normalized.slice(0, -2));
  }
  if (normalized.endsWith('s') && normalized.length > 3) {
    candidates.push(normalized.slice(0, -1));
  }
  return candidates;
}

function lookupWithStemming(
  normalized: string,
  bySurface: Readonly<Record<string, LexiconEntry>>,
): LexiconEntry | undefined {
  for (const stem of candidateStems(normalized)) {
    const found = bySurface[stem];
    if (found) return found;
  }
  return undefined;
}

export function resolvePocketWordNote(normalized: string): PocketWordNote | undefined {
  for (const stem of candidateStems(normalized)) {
    const hit = POCKET_DICT[stem];
    if (hit) {
      return { base: stem, posVi: hit.posVi, meaningVi: hit.meaningVi };
    }
  }
  return undefined;
}

export function tokenizeEnglishText(text: string, index: LexiconIndex): TextToken[] {
  const rawParts = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?|[^A-Za-z]+/g) ?? [text];
  const tokens: TextToken[] = [];

  let i = 0;
  while (i < rawParts.length) {
    const current = rawParts[i]!;
    if (!/^[A-Za-z]/.test(current)) {
      tokens.push({ raw: current, normalized: '', isWord: false });
      i += 1;
      continue;
    }

    const firstLower = current.toLowerCase();
    const candidatePhrases = index.phrasesByFirstWord[firstLower];
    let matchedPhrase: { spanCount: number; combinedRaw: string; entry: LexiconEntry } | null = null;

    if (candidatePhrases) {
      for (const phraseSpec of candidatePhrases) {
        const neededWords = phraseSpec.words.length;
        const lastRawIdx = i + (neededWords - 1) * 2;
        if (lastRawIdx >= rawParts.length) continue;

        let ok = true;
        let combined = current;
        for (let wIdx = 1; wIdx < neededWords; wIdx++) {
          const sep = rawParts[i + wIdx * 2 - 1]!;
          const nextWord = rawParts[i + wIdx * 2]!;
          if (!/^\s+$/.test(sep) || nextWord.toLowerCase() !== phraseSpec.words[wIdx]) {
            ok = false;
            break;
          }
          combined += sep + nextWord;
        }
        if (ok) {
          matchedPhrase = {
            spanCount: neededWords * 2 - 1,
            combinedRaw: combined,
            entry: phraseSpec.entry,
          };
          break;
        }
      }
    }

    if (matchedPhrase) {
      tokens.push({
        raw: matchedPhrase.combinedRaw,
        normalized: matchedPhrase.combinedRaw.toLowerCase().replace(/\s+/g, ' '),
        isWord: true,
        entry: matchedPhrase.entry,
      });
      i += matchedPhrase.spanCount;
      continue;
    }

    const entry = lookupWithStemming(firstLower, index.bySurface);
    const pocketNote = entry ? undefined : resolvePocketWordNote(firstLower);
    tokens.push({
      raw: current,
      normalized: firstLower,
      isWord: true,
      entry,
      pocketNote,
    });
    i += 1;
  }

  return tokens;
}

export function resolveDialogueLineForLevel(
  line: DialogueLine,
  targetBand: CefrBand,
): { readonly en: string; readonly vi: string } {
  if (!line.variants) {
    return { en: line.en, vi: line.vi };
  }
  const exact = line.variants[targetBand];
  if (exact) return exact;

  const fallbackOrder: Record<CefrBand, ReadonlyArray<CefrBand>> = {
    A1: ['A2', 'B1', 'B2'],
    A2: ['A1', 'B1', 'B2'],
    B1: ['B2', 'A2', 'A1'],
    B2: ['B1', 'A2', 'A1'],
  };
  for (const candidate of fallbackOrder[targetBand]) {
    const found = line.variants[candidate];
    if (found) return found;
  }
  return { en: line.en, vi: line.vi };
}

export function resolveSenseForContext(
  entry: LexiconEntry,
  contextTag: string,
  surroundingSentenceEn?: string,
): {
  readonly primary: {
    readonly pos: string;
    readonly meaningVi: string;
    readonly exampleEn: string;
    readonly exampleVi: string;
  };
  readonly otherSenses: ReadonlyArray<PolysemySense>;
} {
  if (!entry.senses || entry.senses.length === 0) {
    return {
      primary: {
        pos: entry.pos,
        meaningVi: entry.meaningVi,
        exampleEn: entry.exampleEn,
        exampleVi: entry.exampleVi,
      },
      otherSenses: [],
    };
  }

  const hay = `${contextTag} ${surroundingSentenceEn ?? ''}`.toLowerCase();
  let chosen = entry.senses[0]!;
  for (const sense of entry.senses) {
    if (sense.contextHints.some((hint) => hay.includes(hint.toLowerCase()))) {
      chosen = sense;
      break;
    }
  }
  const others = entry.senses.filter((s) => s.senseId !== chosen.senseId);
  return {
    primary: {
      pos: chosen.pos,
      meaningVi: chosen.meaningVi,
      exampleEn: chosen.exampleEn,
      exampleVi: chosen.exampleVi,
    },
    otherSenses: others,
  };
}

export function pickIndependentExample(
  entry: LexiconEntry,
  contextTag: string,
  rotationIndex: number = 0,
): { readonly en: string; readonly vi: string } {
  if (entry.senses && entry.senses.length > 0) {
    const resolved = resolveSenseForContext(entry, contextTag);
    return { en: resolved.primary.exampleEn, vi: resolved.primary.exampleVi };
  }
  const pool = [{ en: entry.exampleEn, vi: entry.exampleVi }, ...(entry.examples ?? [])];
  const chosen = pool[Math.abs(rotationIndex) % pool.length]!;
  return chosen;
}

export function shouldHighlightToken(
  entry: LexiconEntry | undefined,
  state: GameState,
  focusWords?: ReadonlyArray<string>,
): boolean {
  if (!entry) return false;
  const mem = state.lexicon[entry.id];
  if (state.settings.supportMode === 'immersion') {
    return Boolean(mem?.savedByPlayer);
  }
  if (mem?.savedByPlayer || (mem?.glossLookups ?? 0) >= 2) {
    return true;
  }
  if (mem && mem.mastery >= 3) {
    return false;
  }
  if (focusWords?.some((w) => w.toLowerCase() === entry.word.toLowerCase() || w === entry.id)) {
    return true;
  }
  const userRank = CEFR_RANK[state.settings.cefrBand];
  const wordRank = CEFR_RANK[entry.cefr];
  return wordRank >= userRank;
}

function getOrCreateMemory(
  state: GameState,
  wordId: string,
  nowMs: number = Date.now(),
): WordMemoryRecord {
  const existing = state.lexicon[wordId];
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
  state.lexicon[wordId] = fresh;
  return fresh;
}

export function recordSentenceExposure(
  state: GameState,
  textEn: string,
  contextTag: string,
  index: LexiconIndex,
  nowMs: number = Date.now(),
): void {
  const seenInLine = new Set<string>();
  const tokens = tokenizeEnglishText(textEn, index);
  for (const token of tokens) {
    if (!token.entry || seenInLine.has(token.entry.id)) continue;
    seenInLine.add(token.entry.id);
    const mem = getOrCreateMemory(state, token.entry.id, nowMs);
    // Exposure strictly counts passive encounters and never auto-promotes mastery or delays due review!
    mem.exposures += 1;
    mem.lastSeenStep = state.stepCount;
    mem.lastSeenAtMs = nowMs;
    if (contextTag && !mem.contextsSeen.includes(contextTag) && mem.contextsSeen.length < 40) {
      mem.contextsSeen.push(contextTag);
    }
  }
}

export function recordWordLookup(
  state: GameState,
  wordId: string,
  contextTag: string,
  nowMs: number = Date.now(),
): WordMemoryRecord {
  const mem = getOrCreateMemory(state, wordId, nowMs);
  mem.glossLookups += 1;
  mem.lastSeenStep = state.stepCount;
  mem.lastSeenAtMs = nowMs;
  // Schedule re-encounter after a meaningful gap (10 steps or 2 minutes), never immediately on same step
  mem.nextReviewStep = state.stepCount + 10;
  mem.nextReviewAtMs = nowMs + REVIEW_TIME_INTERVALS_MS[0];
  if (contextTag && !mem.contextsSeen.includes(contextTag) && mem.contextsSeen.length < 40) {
    mem.contextsSeen.push(contextTag);
  }
  state.stats.wordsGlossed += 1;
  return mem;
}

export function toggleWordSaved(
  state: GameState,
  wordId: string,
  nowMs: number = Date.now(),
): boolean {
  const mem = getOrCreateMemory(state, wordId, nowMs);
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

/**
 * Strictly determines whether a word has reached its scheduled re-encounter threshold by steps OR time.
 * A positive priority score NEVER makes an un-due word eligible before its interval!
 */
export function isWordDueForReencounter(
  mem: WordMemoryRecord,
  state: GameState,
  nowMs: number = Date.now(),
): boolean {
  const hasHistory =
    mem.exposures > 0 || mem.glossLookups > 0 || mem.savedByPlayer || (mem.lapses ?? 0) > 0;
  if (!hasHistory) return false;

  const dueStepThreshold =
    mem.nextReviewStep !== undefined
      ? mem.nextReviewStep
      : mem.lastSeenStep + REVIEW_STEP_INTERVALS[mem.mastery];
  const isDueBySteps = state.stepCount >= dueStepThreshold;

  let isDueByTime = false;
  if (mem.nextReviewAtMs !== undefined) {
    isDueByTime = nowMs >= mem.nextReviewAtMs;
  } else if (mem.lastSeenAtMs !== undefined) {
    isDueByTime = nowMs - mem.lastSeenAtMs >= REVIEW_TIME_INTERVALS_MS[mem.mastery];
  }

  return isDueBySteps || isDueByTime;
}

/**
 * Ranks urgency among words. Must always be paired with `isWordDueForReencounter` when selecting due items.
 */
export function computeWordReencounterPriority(
  mem: WordMemoryRecord,
  state: GameState,
  nowMs: number = Date.now(),
): number {
  const dueStepThreshold =
    mem.nextReviewStep !== undefined
      ? mem.nextReviewStep
      : mem.lastSeenStep + REVIEW_STEP_INTERVALS[mem.mastery];
  const overdueSteps = Math.max(0, state.stepCount - dueStepThreshold);
  const isDue = isWordDueForReencounter(mem, state, nowMs);

  let score = 0;
  if (mem.savedByPlayer) score += 16;
  score += Math.min(24, mem.glossLookups * 6);
  score += Math.min(27, (mem.lapses ?? 0) * 9);
  if (isDue) score += 15 + Math.min(20, Math.floor(overdueSteps / 4));
  // Mastered words (mastery === 3) carry a strong penalty so active learning words take precedence
  score -= mem.mastery === 3 ? 34 : mem.mastery * 9;
  return score;
}

export function getDueReencounterEntries(
  state: GameState,
  index: LexiconIndex,
  limit: number = 4,
  nowMs: number = Date.now(),
): LexiconEntry[] {
  const dueItems = Object.values(state.lexicon)
    .filter((mem) => isWordDueForReencounter(mem, state, nowMs))
    .map((mem) => ({
      mem,
      entry: index.byId[mem.wordId],
      priority: computeWordReencounterPriority(mem, state, nowMs),
    }))
    .filter(
      (item): item is { mem: WordMemoryRecord; entry: LexiconEntry; priority: number } =>
        item.entry !== undefined,
    );

  // Unmastered due words always rank ahead of already-mastered due words, then by priority descending
  dueItems.sort((a, b) => {
    const aMastered = a.mem.mastery >= 3 ? 1 : 0;
    const bMastered = b.mem.mastery >= 3 ? 1 : 0;
    if (aMastered !== bMastered) return aMastered - bMastered;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.entry.id.localeCompare(b.entry.id);
  });

  return dueItems.slice(0, limit).map((t) => t.entry);
}

const REGION_SCENERY_TEMPLATES: Readonly<
  Record<RegionId, { readonly prefixEn: string; readonly prefixVi: string }>
> = {
  mosslight_hub: {
    prefixEn: 'Around Mosslight Camp, Rangers note:',
    prefixVi: 'Quanh Trại Đèn Rêu, kiểm lâm ghi nhận:',
  },
  whisperwood: {
    prefixEn: 'Along the mossy Whisperwood trail, you spot a fresh clue:',
    prefixVi: 'Dọc lối rêu Rừng Thầm, bạn bắt gặp ngữ cảnh mới:',
  },
  reedwater_fen: {
    prefixEn: 'Across the misty Reedwater boardwalks, a field note reads:',
    prefixVi: 'Trên cầu ván Đầm Sậy mờ sương, sổ tay ghi lại:',
  },
  terracotta_ridge: {
    prefixEn: 'High on sunlit Terracotta Ridge, a scout log remarks:',
    prefixVi: 'Trên Đèo Đất Nung đầy nắng, nhật ký trinh sát chép:',
  },
  starfall_sanctuary: {
    prefixEn: 'Beneath the starlit sanctuary arches, an inscription shares:',
    prefixVi: 'Dưới vòm đá Thánh Địa Sao Rơi, dòng văn bia khắc:',
  },
};

export function buildContextualReencounterEcho(
  state: GameState,
  regionId: RegionId,
  index: LexiconIndex,
  nowMs: number = Date.now(),
): { readonly en: string; readonly vi: string; readonly wordId: string } | null {
  const due = getDueReencounterEntries(state, index, 8, nowMs).filter(
    (e) =>
      ((state.lexicon[e.id]?.glossLookups ?? 0) > 0 ||
        state.lexicon[e.id]?.savedByPlayer ||
        (state.lexicon[e.id]?.lapses ?? 0) > 0) &&
      (state.lexicon[e.id]?.mastery ?? 0) < 3,
  );
  const chosen = due[0];
  if (!chosen) return null;

  const mem = state.lexicon[chosen.id];
  const rotation = (mem?.contextsSeen.length ?? 0) + 1;
  if (mem) {
    // Advance both step and wall-clock due thresholds so the same word never repeats back-to-back
    mem.nextReviewStep = state.stepCount + REVIEW_STEP_INTERVALS[mem.mastery];
    mem.nextReviewAtMs = nowMs + REVIEW_TIME_INTERVALS_MS[mem.mastery];
    mem.lastSeenAtMs = nowMs;
  }

  const framing = REGION_SCENERY_TEMPLATES[regionId];
  const freshExample = pickIndependentExample(chosen, regionId, rotation);
  return {
    wordId: chosen.id,
    en: `${framing.prefixEn} ${freshExample.en}`,
    vi: `${framing.prefixVi} ${freshExample.vi}`,
  };
}

export interface CampfireReviewPrompt {
  readonly entry: LexiconEntry;
  readonly promptSentenceEn: string;
  readonly promptSentenceVi: string;
  readonly isDueNow: boolean;
  readonly choices: ReadonlyArray<{ readonly wordId: string; readonly meaningVi: string }>;
}

export function buildCampfireReviewSet(
  state: GameState,
  index: LexiconIndex,
  maxItems: number = 4,
  nowMs: number = Date.now(),
): CampfireReviewPrompt[] {
  // 1. First take words that are genuinely due right now (unmastered due words ranked ahead of mastered)
  const dueEntries = getDueReencounterEntries(state, index, maxItems, nowMs);
  const dueIds = new Set(dueEntries.map((e) => e.id));
  const chosen: Array<{ entry: LexiconEntry; isDueNow: boolean }> = dueEntries.map((entry) => ({
    entry,
    isDueNow: true,
  }));

  // 2. Only if the player voluntarily opened Campfire Review with fewer than maxItems due, fill remaining slots with unmastered saved/looked-up words (never spamming already-mastered words that aren't due!)
  if (chosen.length < maxItems) {
    const optionalExtras = Object.values(state.lexicon)
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
        (x): x is { mem: WordMemoryRecord; entry: LexiconEntry; score: number } =>
          x.entry !== undefined,
      )
      .sort((a, b) => b.score - a.score);

    for (const extra of optionalExtras) {
      if (chosen.length >= maxItems) break;
      chosen.push({ entry: extra.entry, isDueNow: false });
    }
  }

  // 3. Brand-new game fallback when player opens Campfire Review before looking up any words
  if (chosen.length === 0) {
    for (const fallback of index.entries) {
      if (fallback.cefr === state.settings.cefrBand) {
        chosen.push({ entry: fallback, isDueNow: false });
      }
      if (chosen.length >= Math.min(3, maxItems)) break;
    }
  }

  const prompts: CampfireReviewPrompt[] = [];
  for (const { entry: target, isDueNow } of chosen) {
    const mem = state.lexicon[target.id];
    const ex = pickIndependentExample(
      target,
      state.regionId,
      (mem?.correctReviews ?? 0) + (mem?.lapses ?? 0) + 1,
    );

    const distractors: Array<{ wordId: string; meaningVi: string }> = [];
    for (const other of index.entries) {
      if (other.id === target.id || other.meaningVi === target.meaningVi) continue;
      if (other.pos === target.pos || distractors.length < 3) {
        distractors.push({ wordId: other.id, meaningVi: other.meaningVi });
      }
      if (distractors.length >= 3) break;
    }
    const rawChoices = [
      { wordId: target.id, meaningVi: target.meaningVi },
      ...distractors.slice(0, 3),
    ];
    const shift = target.word.length % rawChoices.length;
    const rotated = [...rawChoices.slice(shift), ...rawChoices.slice(0, shift)];
    prompts.push({
      entry: target,
      promptSentenceEn: ex.en,
      promptSentenceVi: ex.vi,
      isDueNow,
      choices: rotated,
    });
  }
  return prompts;
}

export function recordCampfireRecall(
  state: GameState,
  wordId: string,
  rememberedWell: boolean,
  nowMs: number = Date.now(),
): WordMemoryRecord {
  const mem = getOrCreateMemory(state, wordId, nowMs);
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
  state.stats.campReviewsCompleted += 1;
  return mem;
}

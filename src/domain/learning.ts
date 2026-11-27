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

const REVIEW_STEP_INTERVALS: Readonly<Record<0 | 1 | 2 | 3, number>> = {
  0: 14,
  1: 32,
  2: 75,
  3: 160,
};

const REVIEW_TIME_INTERVALS_MS: Readonly<Record<0 | 1 | 2 | 3, number>> = {
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

function lookupWithStemming(
  normalized: string,
  bySurface: Readonly<Record<string, LexiconEntry>>,
): LexiconEntry | undefined {
  const exact = bySurface[normalized];
  if (exact) return exact;

  if (normalized.endsWith('ies') && normalized.length > 4) {
    const yForm = normalized.slice(0, -3) + 'y';
    if (bySurface[yForm]) return bySurface[yForm];
  }
  if (normalized.endsWith('ing') && normalized.length > 5) {
    const base = normalized.slice(0, -3);
    if (bySurface[base]) return bySurface[base];
    if (bySurface[base + 'e']) return bySurface[base + 'e'];
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      const dedup = base.slice(0, -1);
      if (bySurface[dedup]) return bySurface[dedup];
    }
  }
  if (normalized.endsWith('ed') && normalized.length > 4) {
    const base = normalized.slice(0, -2);
    if (bySurface[base]) return bySurface[base];
    const baseD = normalized.slice(0, -1);
    if (bySurface[baseD]) return bySurface[baseD];
  }
  if (normalized.endsWith('es') && normalized.length > 4) {
    const base = normalized.slice(0, -2);
    if (bySurface[base]) return bySurface[base];
  }
  if (normalized.endsWith('s') && normalized.length > 3) {
    const base = normalized.slice(0, -1);
    if (bySurface[base]) return bySurface[base];
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
    tokens.push({
      raw: current,
      normalized: firstLower,
      isWord: true,
      entry,
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

function getOrCreateMemory(state: GameState, wordId: string, nowMs: number = Date.now()): WordMemoryRecord {
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
    // Exposure strictly counts passive encounters and never auto-promotes mastery!
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
  // Frequently looked-up words are scheduled to reappear soon in fresh contexts
  mem.nextReviewStep = state.stepCount + 10;
  if (contextTag && !mem.contextsSeen.includes(contextTag) && mem.contextsSeen.length < 40) {
    mem.contextsSeen.push(contextTag);
  }
  state.stats.wordsGlossed += 1;
  return mem;
}

export function toggleWordSaved(state: GameState, wordId: string, nowMs: number = Date.now()): boolean {
  const mem = getOrCreateMemory(state, wordId, nowMs);
  mem.savedByPlayer = !mem.savedByPlayer;
  if (mem.savedByPlayer) {
    mem.nextReviewStep = Math.min(mem.nextReviewStep ?? state.stepCount + 12, state.stepCount + 12);
  }
  return mem.savedByPlayer;
}

export function computeWordReencounterPriority(
  mem: WordMemoryRecord,
  state: GameState,
  nowMs: number = Date.now(),
): number {
  const dueStep = mem.nextReviewStep ?? 0;
  const isDueBySteps = state.stepCount >= dueStep;
  const elapsedMs = Math.max(0, nowMs - (mem.lastSeenAtMs ?? 0));
  const isDueByTime = elapsedMs >= REVIEW_TIME_INTERVALS_MS[mem.mastery];

  let score = 0;
  if (mem.savedByPlayer) score += 18;
  score += Math.min(24, mem.glossLookups * 6);
  score += Math.min(20, (mem.lapses ?? 0) * 7);
  if (isDueBySteps) score += 14;
  if (isDueByTime) score += 10;
  score -= mem.mastery * 8;
  return score;
}

export function getDueReencounterEntries(
  state: GameState,
  index: LexiconIndex,
  limit: number = 4,
  nowMs: number = Date.now(),
): LexiconEntry[] {
  const tracked = Object.values(state.lexicon)
    .filter((m) => m.savedByPlayer || m.glossLookups > 0 || (m.lapses ?? 0) > 0 || m.mastery < 3)
    .map((mem) => ({
      mem,
      entry: index.byId[mem.wordId],
      priority: computeWordReencounterPriority(mem, state, nowMs),
    }))
    .filter(
      (item): item is { mem: WordMemoryRecord; entry: LexiconEntry; priority: number } =>
        item.entry !== undefined && item.priority > 0,
    );

  tracked.sort((a, b) => b.priority - a.priority);
  return tracked.slice(0, limit).map((t) => t.entry);
}

const REGION_SCENERY_TEMPLATES: Readonly<
  Record<RegionId, { readonly prefixEn: string; readonly prefixVi: string }>
> = {
  mosslight_hub: {
    prefixEn: 'Around Mosslight Camp, Rangers remind you:',
    prefixVi: 'Quanh Trại Đèn Rêu, kiểm lâm nhắn nhủ:',
  },
  whisperwood: {
    prefixEn: 'Along the mossy Whisperwood trail, you notice a familiar clue:',
    prefixVi: 'Dọc lối rêu Rừng Thầm, bạn bắt gặp lại từ quen trong ngữ cảnh mới:',
  },
  reedwater_fen: {
    prefixEn: 'Across the misty Reedwater boardwalks, a field note recalls:',
    prefixVi: 'Trên cầu ván Đầm Sậy mờ sương, sổ tay gợi lại ngữ cảnh:',
  },
  terracotta_ridge: {
    prefixEn: 'High on sunlit Terracotta Ridge, a scout observation echoes:',
    prefixVi: 'Trên Đèo Đất Nung đầy nắng, ghi chép trinh sát nhắc lại:',
  },
  starfall_sanctuary: {
    prefixEn: 'Beneath the starlit sanctuary arches, an inscription reflects:',
    prefixVi: 'Dưới vòm đá Thánh Địa Sao Rơi, dòng ghi chú soi chiếu:',
  },
};

export function buildContextualReencounterEcho(
  state: GameState,
  regionId: RegionId,
  index: LexiconIndex,
  nowMs: number = Date.now(),
): { readonly en: string; readonly vi: string; readonly wordId: string } | null {
  const due = getDueReencounterEntries(state, index, 6, nowMs).filter(
    (e) => (state.lexicon[e.id]?.glossLookups ?? 0) > 0 || state.lexicon[e.id]?.savedByPlayer,
  );
  const chosen = due[0];
  if (!chosen) return null;

  const mem = state.lexicon[chosen.id];
  if (mem) {
    // Advance nextReviewStep so we don't repeat the same word on every consecutive step
    mem.nextReviewStep = state.stepCount + REVIEW_STEP_INTERVALS[mem.mastery];
    mem.lastSeenAtMs = nowMs;
  }

  const framing = REGION_SCENERY_TEMPLATES[regionId];
  const sense = resolveSenseForContext(chosen, regionId);
  return {
    wordId: chosen.id,
    en: `${framing.prefixEn} ${sense.primary.exampleEn}`,
    vi: `${framing.prefixVi} ${sense.primary.exampleVi}`,
  };
}

export interface CampfireReviewPrompt {
  readonly entry: LexiconEntry;
  readonly promptSentenceEn: string;
  readonly promptSentenceVi: string;
  readonly choices: ReadonlyArray<{ readonly wordId: string; readonly meaningVi: string }>;
}

export function buildCampfireReviewSet(
  state: GameState,
  index: LexiconIndex,
  maxItems: number = 4,
  nowMs: number = Date.now(),
): CampfireReviewPrompt[] {
  const prioritized = Object.values(state.lexicon)
    .map((mem) => ({
      mem,
      entry: index.byId[mem.wordId],
      score: computeWordReencounterPriority(mem, state, nowMs) + mem.exposures,
    }))
    .filter(
      (x): x is { mem: WordMemoryRecord; entry: LexiconEntry; score: number } =>
        x.entry !== undefined,
    );

  prioritized.sort((a, b) => b.score - a.score);

  const chosen = prioritized.slice(0, maxItems).map((c) => c.entry);
  if (chosen.length === 0) {
    for (const fallback of index.entries) {
      if (fallback.cefr === state.settings.cefrBand) {
        chosen.push(fallback);
      }
      if (chosen.length >= Math.min(3, maxItems)) break;
    }
  }

  const prompts: CampfireReviewPrompt[] = [];
  for (const target of chosen) {
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
      promptSentenceEn: target.exampleEn,
      promptSentenceVi: target.exampleVi,
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
  } else {
    mem.lapses = (mem.lapses ?? 0) + 1;
    if (mem.mastery > 0) {
      mem.mastery = (mem.mastery - 1) as 0 | 1 | 2 | 3;
    }
    mem.nextReviewStep = state.stepCount + 10;
  }
  mem.lastSeenStep = state.stepCount;
  mem.lastSeenAtMs = nowMs;
  state.stats.campReviewsCompleted += 1;
  return mem;
}

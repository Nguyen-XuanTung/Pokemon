import type {
  CefrBand,
  GameState,
  LexiconEntry,
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
  readonly entries: ReadonlyArray<LexiconEntry>;
}

const CEFR_RANK: Readonly<Record<CefrBand, number>> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
};

export function createLexiconIndex(entries: ReadonlyArray<LexiconEntry>): LexiconIndex {
  const byId: Record<string, LexiconEntry> = {};
  const bySurface: Record<string, LexiconEntry> = {};

  for (const entry of entries) {
    byId[entry.id] = entry;
    const baseKey = entry.word.trim().toLowerCase();
    bySurface[baseKey] = entry;
    for (const form of entry.forms) {
      const formKey = form.trim().toLowerCase();
      if (formKey && !bySurface[formKey]) {
        bySurface[formKey] = entry;
      }
    }
  }

  return { byId, bySurface, entries };
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
  const parts = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?|[^A-Za-z]+/g) ?? [text];
  const tokens: TextToken[] = [];
  for (const raw of parts) {
    const isWord = /^[A-Za-z]/.test(raw);
    if (!isWord) {
      tokens.push({ raw, normalized: '', isWord: false });
      continue;
    }
    const normalized = raw.toLowerCase();
    const entry = lookupWithStemming(normalized, index.bySurface);
    tokens.push({
      raw,
      normalized,
      isWord: true,
      entry,
    });
  }
  return tokens;
}

export function shouldHighlightToken(
  entry: LexiconEntry | undefined,
  state: GameState,
  focusWords?: ReadonlyArray<string>,
): boolean {
  if (!entry) return false;
  if (state.settings.supportMode === 'immersion') {
    const mem = state.lexicon[entry.id];
    return Boolean(mem?.savedByPlayer);
  }
  if (focusWords?.some((w) => w.toLowerCase() === entry.word.toLowerCase() || w === entry.id)) {
    return true;
  }
  const userRank = CEFR_RANK[state.settings.cefrBand];
  const wordRank = CEFR_RANK[entry.cefr];
  const mem = state.lexicon[entry.id];
  if (mem?.savedByPlayer) return true;
  if (mem && mem.mastery >= 3) return false;
  return wordRank >= userRank;
}

function getOrCreateMemory(state: GameState, wordId: string): WordMemoryRecord {
  const existing = state.lexicon[wordId];
  if (existing) return existing;
  const fresh: WordMemoryRecord = {
    wordId,
    exposures: 0,
    glossLookups: 0,
    savedByPlayer: false,
    mastery: 0,
    lastSeenStep: state.stepCount,
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
): void {
  const seenInLine = new Set<string>();
  const tokens = tokenizeEnglishText(textEn, index);
  for (const token of tokens) {
    if (!token.entry || seenInLine.has(token.entry.id)) continue;
    seenInLine.add(token.entry.id);
    const mem = getOrCreateMemory(state, token.entry.id);
    mem.exposures += 1;
    mem.lastSeenStep = state.stepCount;
    if (contextTag && !mem.contextsSeen.includes(contextTag)) {
      mem.contextsSeen.push(contextTag);
      if (mem.contextsSeen.length >= 3 && mem.mastery === 0) {
        mem.mastery = 1;
      }
    }
  }
}

export function recordWordLookup(
  state: GameState,
  wordId: string,
  contextTag: string,
): WordMemoryRecord {
  const mem = getOrCreateMemory(state, wordId);
  mem.glossLookups += 1;
  mem.lastSeenStep = state.stepCount;
  if (contextTag && !mem.contextsSeen.includes(contextTag)) {
    mem.contextsSeen.push(contextTag);
  }
  state.stats.wordsGlossed += 1;
  return mem;
}

export function toggleWordSaved(state: GameState, wordId: string): boolean {
  const mem = getOrCreateMemory(state, wordId);
  mem.savedByPlayer = !mem.savedByPlayer;
  return mem.savedByPlayer;
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
): CampfireReviewPrompt[] {
  const candidates = Object.values(state.lexicon)
    .map((mem) => ({ mem, entry: index.byId[mem.wordId] }))
    .filter((x): x is { mem: WordMemoryRecord; entry: LexiconEntry } => x.entry !== undefined);

  candidates.sort((a, b) => {
    if (a.mem.savedByPlayer !== b.mem.savedByPlayer) {
      return a.mem.savedByPlayer ? -1 : 1;
    }
    if (a.mem.mastery !== b.mem.mastery) {
      return a.mem.mastery - b.mem.mastery;
    }
    return b.mem.glossLookups - a.mem.glossLookups;
  });

  const chosen = candidates.slice(0, maxItems).map((c) => c.entry);
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
): WordMemoryRecord {
  const mem = getOrCreateMemory(state, wordId);
  if (rememberedWell) {
    mem.mastery = Math.min(3, mem.mastery + 1) as 0 | 1 | 2 | 3;
  } else if (mem.mastery > 1) {
    mem.mastery = (mem.mastery - 1) as 0 | 1 | 2 | 3;
  }
  mem.lastSeenStep = state.stepCount;
  state.stats.campReviewsCompleted += 1;
  return mem;
}

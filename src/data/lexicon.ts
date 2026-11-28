import { createLexiconIndex } from '../domain/learning.ts';
import type { LexiconEntry } from '../domain/types.ts';
import { LEXICON_CREATURES } from './lexicon-creatures.ts';
import { LEXICON_EXPEDITION } from './lexicon-expedition.ts';
import { LEXICON_NATURE } from './lexicon-nature.ts';
import { LEXICON_TACTICS } from './lexicon-tactics.ts';

export const LEXICON_ENTRIES: ReadonlyArray<LexiconEntry> = [
  ...LEXICON_NATURE,
  ...LEXICON_EXPEDITION,
  ...LEXICON_CREATURES,
  ...LEXICON_TACTICS,
];

export const LEXICON_INDEX = createLexiconIndex(LEXICON_ENTRIES);

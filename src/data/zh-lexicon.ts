import { createChineseLexiconIndex } from '../domain/chinese.ts';
import type { ChineseLexiconEntry } from '../domain/types.ts';
import { CHINESE_PROPER_NOUNS, ZH_LEXICON_EXTRA } from './zh-lexicon-extra.ts';
import { ZH_LEXICON_HSK1 } from './zh-lexicon-hsk1.ts';
import { ZH_LEXICON_HSK2 } from './zh-lexicon-hsk2.ts';
import { ZH_LEXICON_HSK3 } from './zh-lexicon-hsk3.ts';

export const ZH_LEXICON_ENTRIES: ReadonlyArray<ChineseLexiconEntry> = [
  ...ZH_LEXICON_HSK1,
  ...ZH_LEXICON_HSK2,
  ...ZH_LEXICON_HSK3,
  ...ZH_LEXICON_EXTRA,
];

export const ZH_LEXICON_INDEX = createChineseLexiconIndex(
  ZH_LEXICON_ENTRIES,
  CHINESE_PROPER_NOUNS,
);

export { CHINESE_PROPER_NOUNS, ZH_LEXICON_HSK1, ZH_LEXICON_HSK2, ZH_LEXICON_HSK3, ZH_LEXICON_EXTRA };

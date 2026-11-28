import type { DialogueLine, HskLevel } from '../domain/types.ts';
import { ZH_DIALOGUES_FIELDNOTES } from './zh-dialogues-fieldnotes.ts';
import {
  ZH_DIALOGUES_STORY,
  type DialogueLineZhTranslation,
  type DialogueNodeZhTranslation,
} from './zh-dialogues-story.ts';
import { ZH_DIALOGUES_WORLD } from './zh-dialogues-world.ts';

export type { DialogueLineZhTranslation, DialogueNodeZhTranslation };

export const ZH_DIALOGUES_BY_ID: Readonly<Record<string, DialogueNodeZhTranslation>> = {
  ...ZH_DIALOGUES_STORY,
  ...ZH_DIALOGUES_WORLD,
  ...ZH_DIALOGUES_FIELDNOTES,
};

export function resolveChineseDialogueLine(
  dialogueId: string,
  lineIndex: number,
  hskLevel: HskLevel,
  fallbackLine: DialogueLine,
): {
  readonly zh: string;
  readonly vi: string;
  readonly choicesZh?: ReadonlyArray<string>;
} {
  const nodeZh = ZH_DIALOGUES_BY_ID[dialogueId];
  const lineZh = nodeZh?.lines[lineIndex];
  if (!lineZh) {
    return { zh: fallbackLine.vi, vi: fallbackLine.vi };
  }

  let zh = lineZh.zh;
  if (lineZh.variants) {
    const exact = lineZh.variants[hskLevel];
    if (exact) {
      zh = exact;
    } else if (hskLevel === 'HSK1') {
      zh = lineZh.variants.HSK1 ?? lineZh.variants.HSK2 ?? lineZh.zh;
    } else if (hskLevel === 'HSK2') {
      zh = lineZh.variants.HSK2 ?? lineZh.zh;
    } else {
      zh = lineZh.variants.HSK3 ?? lineZh.zh;
    }
  }

  return {
    zh,
    vi: fallbackLine.vi,
    choicesZh: lineZh.choicesZh,
  };
}

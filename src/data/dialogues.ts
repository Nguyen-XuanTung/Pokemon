import type { DialogueNode } from '../domain/types.ts';
import { DIALOGUES_FIELDNOTES } from './dialogues-fieldnotes.ts';
import { DIALOGUES_STORY } from './dialogues-story.ts';
import { DIALOGUES_WORLD } from './dialogues-world.ts';

export const DIALOGUES: ReadonlyArray<DialogueNode> = [
  ...DIALOGUES_STORY,
  ...DIALOGUES_WORLD,
  ...DIALOGUES_FIELDNOTES,
];

export const DIALOGUES_BY_ID: Readonly<Record<string, DialogueNode>> = Object.fromEntries(
  DIALOGUES.map((d) => [d.id, d]),
);

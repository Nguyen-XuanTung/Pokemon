import { ITEMS } from '../data/items.ts';
import { LEXICON_INDEX } from '../data/lexicon.ts';
import { shouldHighlightToken, tokenizeEnglishText } from '../domain/learning.ts';
import type { CombatRole, SpeciesRarity } from '../domain/types.ts';
import type { GameController } from '../game/controller.ts';

export const RARITY_LABELS: Readonly<Record<SpeciesRarity, { en: string; vi: string; color: string }>> = {
  common: { en: 'Common', vi: 'Phổ biến', color: '#6b7a65' },
  uncommon: { en: 'Uncommon', vi: 'Ít gặp', color: '#3b7a8c' },
  rare: { en: 'Rare', vi: 'Hiếm', color: '#b85d3b' },
  mythic: { en: 'Mythic', vi: 'Huyền thoại', color: '#9c6b19' },
};

export const ROLE_LABELS: Readonly<Record<CombatRole, { en: string; vi: string }>> = {
  striker: { en: 'Striker', vi: 'Mũi nhọn' },
  bulwark: { en: 'Bulwark', vi: 'Lá chắn' },
  swift: { en: 'Swift Scout', vi: 'Tốc chiến' },
  tactician: { en: 'Tactician', vi: 'Khống chế' },
  guardian: { en: 'Guardian', vi: 'Hộ vệ' },
};

export function el(tag: string, className: string, textContent?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}

export interface CreatureSpriteOptions {
  readonly large?: boolean;
  readonly silhouette?: boolean;
  readonly gleaming?: boolean;
}

export function createCreatureSpriteSpan(
  dexNumber: number,
  optionsOrLarge: boolean | CreatureSpriteOptions = false,
): HTMLElement {
  const opts: CreatureSpriteOptions =
    typeof optionsOrLarge === 'boolean' ? { large: optionsOrLarge } : optionsOrLarge;
  const classes = ['sprite-creature'];
  if (opts.large) classes.push('sprite-creature-lg');
  if (opts.silhouette) classes.push('sprite-creature-silhouette');
  if (opts.gleaming) classes.push('sprite-creature-gleaming');
  const span = el('span', classes.join(' '));
  const frameIdx = (dexNumber - 1) * 2;
  const col = frameIdx % 10;
  const row = Math.floor(frameIdx / 10);
  span.style.backgroundPosition = `${-col * 48}px ${-row * 48}px`;
  return span;
}

export function createItemSpriteSpan(itemId: string): HTMLElement {
  const idx = Math.max(0, ITEMS.findIndex((i) => i.id === itemId));
  const span = el('span', 'sprite-item');
  span.style.backgroundPosition = `${-idx * 16}px 0px`;
  return span;
}

export function renderInteractiveEnglish(
  controller: GameController,
  text: string,
  contextTag: string,
  focusWords?: ReadonlyArray<string>,
): DocumentFragment {
  const frag = document.createDocumentFragment();
  const tokens = tokenizeEnglishText(text, LEXICON_INDEX);
  for (const tok of tokens) {
    if (!tok.isWord || (!tok.entry && !tok.pocketNote)) {
      frag.appendChild(document.createTextNode(tok.raw));
      continue;
    }
    if (tok.entry) {
      const highlighted = shouldHighlightToken(tok.entry, controller.state, focusWords);
      const btn = el(
        'button',
        highlighted ? 'word-token word-token-focus lw-interactive' : 'word-token lw-interactive',
        tok.raw,
      ) as HTMLButtonElement;
      btn.type = 'button';
      btn.title = `${tok.entry.word}: ${tok.entry.meaningVi}`;
      const entryRef = tok.entry;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        controller.inspectGlossWord(entryRef, contextTag, text);
      });
      frag.appendChild(btn);
      continue;
    }
    if (tok.pocketNote) {
      const noteRef = tok.pocketNote;
      const btn = el(
        'button',
        'word-token word-token-pocket lw-interactive',
        tok.raw,
      ) as HTMLButtonElement;
      btn.type = 'button';
      btn.title = `${noteRef.base}: ${noteRef.meaningVi}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        controller.inspectPocketWord(tok.raw, noteRef, text);
      });
      frag.appendChild(btn);
    }
  }
  return frag;
}

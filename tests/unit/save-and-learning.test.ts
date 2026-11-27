import { describe, expect, it } from 'vitest';
import { LEXICON_INDEX } from '../../src/data/lexicon.ts';
import {
  buildCampfireReviewSet,
  recordCampfireRecall,
  recordSentenceExposure,
  recordWordLookup,
  toggleWordSaved,
  tokenizeEnglishText,
} from '../../src/domain/learning.ts';
import {
  BACKUP_SAVE_KEY,
  MAX_SAVE_BYTES,
  PRIMARY_SAVE_KEY,
  SaveRepository,
  type StorageAdapter,
} from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';

class MockStorage implements StorageAdapter {
  public readonly map = new Map<string, string>();
  public quotaLimitBytes = Infinity;

  public getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    let total = value.length;
    for (const [k, v] of this.map.entries()) {
      if (k !== key) total += v.length;
    }
    if (total > this.quotaLimitBytes) {
      throw new Error('QuotaExceededError');
    }
    this.map.set(key, value);
  }

  public removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('SaveRepository integrity, corruption recovery, and quota handling', () => {
  it('saves, exports, imports, and automatically recovers from corrupted primary slot using backup', () => {
    const storage = new MockStorage();
    const repo = new SaveRepository(storage);

    const state1 = createInitialGameState(101);
    state1.tokens = 250;
    expect(repo.save(state1).ok).toBe(true);

    const state2 = structuredClone(state1);
    state2.tokens = 500;
    expect(repo.save(state2).ok).toBe(true);
    expect(storage.getItem(BACKUP_SAVE_KEY)).not.toBeNull();

    // Corrupt primary save JSON
    storage.map.set(PRIMARY_SAVE_KEY, '{corrupted_json!!!');
    const recovered = repo.load();
    expect(recovered.recoveredFromBackup).toBe(true);
    expect(recovered.state?.tokens).toBe(250);
  });

  it('rejects tampered checksums and oversized import payloads safely', () => {
    const storage = new MockStorage();
    const repo = new SaveRepository(storage);
    const clean = createInitialGameState(55);
    const exported = repo.exportJson(clean);

    const tampered = exported.replace('"tokens":180', '"tokens":999999');
    expect(repo.importJson(tampered).ok).toBe(false);

    const huge = 'x'.repeat(MAX_SAVE_BYTES + 100);
    expect(repo.importJson(huge).ok).toBe(false);
  });

  it('handles storage quota exceeded gracefully with memory fallback instead of crashing', () => {
    const storage = new MockStorage();
    storage.quotaLimitBytes = 100; // Tiny quota to trigger QuotaExceededError
    const repo = new SaveRepository(storage);
    const state = createInitialGameState(88);
    const res = repo.save(state);
    expect(res.ok).toBe(true);
    expect(res.usedMemoryFallback).toBe(true);
    expect(repo.load().state?.seedState).toBe(state.seedState);
  });
});

describe('Contextual English tokenizer and voluntary Campfire Review', () => {
  it('matches inflected English words to base lexicon entries and tracks familiarity across contexts', () => {
    const state = createInitialGameState(12);
    const sentence = 'Glowing lanterns guided tired scouts safely across wooden bridges.';
    const tokens = tokenizeEnglishText(sentence, LEXICON_INDEX);
    const matchedWords = tokens.filter((t) => t.entry).map((t) => t.entry!.word);
    expect(matchedWords).toContain('glow');
    expect(matchedWords).toContain('lantern');
    expect(matchedWords).toContain('guide');
    expect(matchedWords).toContain('tired');
    expect(matchedWords).toContain('scout');
    expect(matchedWords).toContain('safe');
    expect(matchedWords).toContain('bridge');

    recordSentenceExposure(state, sentence, 'ctx_1', LEXICON_INDEX);
    recordSentenceExposure(state, sentence, 'ctx_2', LEXICON_INDEX);
    recordSentenceExposure(state, sentence, 'ctx_3', LEXICON_INDEX);
    expect(state.lexicon.lex_lantern?.mastery).toBe(1);

    recordWordLookup(state, 'lex_lantern', 'ctx_lookup');
    expect(toggleWordSaved(state, 'lex_lantern')).toBe(true);

    const prompts = buildCampfireReviewSet(state, LEXICON_INDEX, 3);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]?.entry.id).toBe('lex_lantern');

    recordCampfireRecall(state, 'lex_lantern', true);
    expect(state.lexicon.lex_lantern?.mastery).toBe(2);
  });
});

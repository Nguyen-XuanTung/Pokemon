import { describe, expect, it } from 'vitest';
import {
  CHINESE_PROPER_NOUNS,
  ZH_LEXICON_ENTRIES,
  ZH_LEXICON_INDEX,
} from '../../src/data/zh-lexicon.ts';
import {
  buildChineseCampfireReviewSet,
  buildChineseContextualReencounterEcho,
  recordChineseCampfireRecall,
  recordChineseSentenceExposure,
  recordChineseWordLookup,
  resolveChineseSenseForContext,
  shouldHighlightChineseToken,
  toggleChineseWordSaved,
  tokenizeChineseText,
} from '../../src/domain/chinese.ts';
import {
  deserializeSaveEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSaveEnvelope,
} from '../../src/domain/save.ts';
import { createInitialGameState } from '../../src/domain/state.ts';
import { GAME_SAVE_VALIDATION_REGISTRY } from '../../src/game/controller.ts';

describe('Chinese HSK 2.0 lexicon & segmentation engine', () => {
  it('covers 100% HSK 1, HSK 2, and HSK 3 with unique zh:* IDs and clean Pinyin', () => {
    const hsk1 = ZH_LEXICON_ENTRIES.filter((e) => e.hsk === 'HSK1');
    const hsk2 = ZH_LEXICON_ENTRIES.filter((e) => e.hsk === 'HSK2');
    const hsk3 = ZH_LEXICON_ENTRIES.filter((e) => e.hsk === 'HSK3');
    expect(hsk1.length).toBe(150);
    expect(hsk2.length).toBe(150);
    // 298 unique HSK 3 headwords + 2 official HSK 3 polyphonic readings (还 huán, 长 zhǎng) on HSK 2 entries
    expect(hsk3.length).toBe(298);

    const haiEntry = ZH_LEXICON_INDEX.byHanzi['还'];
    const changEntry = ZH_LEXICON_INDEX.byHanzi['长'];
    expect(haiEntry?.senses?.some((s) => s.pinyin === 'huán')).toBe(true);
    expect(changEntry?.senses?.some((s) => s.pinyin === 'zhǎng')).toBe(true);

    const idSet = new Set<string>();
    for (const entry of ZH_LEXICON_ENTRIES) {
      expect(entry.id.startsWith('zh:')).toBe(true);
      expect(idSet.has(entry.id)).toBe(false);
      idSet.add(entry.id);
      expect(entry.pinyin.trim().length).toBeGreaterThan(0);
      expect(entry.meaningVi.trim().length).toBeGreaterThan(0);
    }
    expect(CHINESE_PROPER_NOUNS.length).toBeGreaterThanOrEqual(50);
  });

  it('segments sentences accurately with both Intl.Segmenter and pure Trie FMM fallback', () => {
    const sample = '你好！请去苔灯营地找罗文，谢谢，不客气，没关系，为什么不一起出发？';
    const withIntl = tokenizeChineseText(sample, ZH_LEXICON_INDEX, 'test:intro', {
      useIntlSegmenter: true,
    });
    const fallbackOnly = tokenizeChineseText(sample, ZH_LEXICON_INDEX, 'test:intro', {
      useIntlSegmenter: false,
    });

    for (const tokens of [withIntl, fallbackOnly]) {
      const raws = tokens.filter((t) => t.isWord).map((t) => t.raw);
      expect(raws).toContain('你好');
      expect(raws).toContain('苔灯营地');
      expect(raws).toContain('罗文');
      expect(raws).toContain('不客气');
      expect(raws).toContain('没关系');
      expect(raws).toContain('为什么');
      expect(raws).toContain('一起');
      expect(raws).toContain('出发');

      const properCamp = tokens.find((t) => t.raw === '苔灯营地');
      expect(properCamp?.properNoun?.category).toBe('region');
      expect(properCamp?.resolvedPinyin).toBe('Táidēng Yíngdì');

      const properRowan = tokens.find((t) => t.raw === '罗文');
      expect(properRowan?.properNoun?.category).toBe('npc');
    }
  });

  it('disambiguates polyphones and polysemous words using surrounding Chinese context', () => {
    const haiEntry = ZH_LEXICON_INDEX.byHanzi['还']!;
    const stillSense = resolveChineseSenseForContext(
      haiEntry,
      'dialogue',
      '营地里还有几位朋友在等你。',
      '里',
      '有',
    );
    expect(stillSense.primary.pinyin).toBe('hái');
    expect(stillSense.otherSenses.some((s) => s.pinyin === 'huán')).toBe(true);

    const returnSense = resolveChineseSenseForContext(
      haiEntry,
      'dialogue',
      '请把这把钥匙还给护林员。',
      '钥匙',
      '给',
    );
    expect(returnSense.primary.pinyin).toBe('huán');

    const changEntry = ZH_LEXICON_INDEX.byHanzi['长']!;
    const longSense = resolveChineseSenseForContext(
      changEntry,
      'dialogue',
      '这条路很长，请带好草药。',
      '很',
      '，',
    );
    expect(longSense.primary.pinyin).toBe('cháng');

    const growSense = resolveChineseSenseForContext(
      changEntry,
      'dialogue',
      '经过照顾，小伙伴长大了不少。',
      '伙伴',
      '大',
    );
    expect(growSense.primary.pinyin).toBe('zhǎng');

    const zhiEntry = ZH_LEXICON_INDEX.byHanzi['只']!;
    const onlySense = resolveChineseSenseForContext(
      zhiEntry,
      'dialogue',
      '目前只差最后一枚徽章。',
      '目前',
      '差',
    );
    expect(onlySense.primary.pinyin).toBe('zhǐ');

    const animalMwSense = resolveChineseSenseForContext(
      zhiEntry,
      'dialogue',
      '草丛里有一只可爱的小伙伴。',
      '一',
      '可爱',
    );
    expect(animalMwSense.primary.pinyin).toBe('zhī');

    const deEntry = ZH_LEXICON_INDEX.byHanzi['得']!;
    const mustSense = resolveChineseSenseForContext(
      deEntry,
      'dialogue',
      '我们得先回篝火恢复体力。',
      '我们',
      '先',
    );
    expect(mustSense.primary.pinyin).toBe('děi');
  });

  it('keeps English and Chinese vocabulary notebooks strictly isolated across language switches', () => {
    const state = createInitialGameState(42);
    state.settings.learningLanguage = 'en';
    state.lexicon['lantern'] = {
      wordId: 'lantern',
      exposures: 3,
      glossLookups: 1,
      savedByPlayer: true,
      mastery: 1,
      lastSeenStep: 5,
      nextReviewStep: 20,
      contextsSeen: ['dlg:rowan_intro'],
    };

    // Switch to Chinese HSK 2
    state.settings.learningLanguage = 'zh';
    state.settings.hskLevel = 'HSK2';
    recordChineseSentenceExposure(
      state,
      '你好，欢迎来到苔灯营地，请准备出发。',
      'dlg:rowan_intro',
      ZH_LEXICON_INDEX,
      10_000,
    );
    const zhId = ZH_LEXICON_INDEX.byHanzi['准备']!.id;
    recordChineseWordLookup(state, zhId, 'dlg:rowan_intro', 10_500);
    toggleChineseWordSaved(state, zhId, 11_000);

    expect(state.lexicon['lantern']?.savedByPlayer).toBe(true);
    expect(state.lexicon[zhId]).toBeUndefined();
    expect(state.lexiconZh?.[zhId]?.savedByPlayer).toBe(true);
    expect(state.lexiconZh?.['lantern']).toBeUndefined();

    // Highlight respects HSK level & saved status
    const hsk1Word = ZH_LEXICON_INDEX.byHanzi['你好']!;
    const hsk2Word = ZH_LEXICON_INDEX.byHanzi['准备']!;
    expect(shouldHighlightChineseToken(hsk1Word, state)).toBe(false);
    expect(shouldHighlightChineseToken(hsk2Word, state)).toBe(true);

    // Advance steps to trigger contextual re-encounter echo & voluntary campfire review
    state.stepCount = 40;
    const echo = buildChineseContextualReencounterEcho(
      state,
      'mosslight_hub',
      ZH_LEXICON_INDEX,
      200_000,
    );
    expect(echo).not.toBeNull();
    expect(echo?.wordId).toBe(zhId);

    const prompts = buildChineseCampfireReviewSet(state, ZH_LEXICON_INDEX, 3, 200_000);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]?.choices.some((c) => c.wordId === prompts[0]?.entry.id)).toBe(true);
    expect(['hanzi_to_vi', 'hanzi_to_pinyin', 'listen_to_hanzi']).toContain(prompts[0]?.mode);

    const updatedMem = recordChineseCampfireRecall(state, zhId, true, 205_000);
    expect(updatedMem.mastery).toBe(1);
    expect(state.stats.zhCampReviewsCompleted).toBe(1);

    // Switch back to English and verify nothing in Chinese notebook was lost
    state.settings.learningLanguage = 'en';
    expect(state.lexiconZh?.[zhId]?.mastery).toBe(1);
    expect(state.lexicon['lantern']?.savedByPlayer).toBe(true);
  });

  it('migrates v1.2.0 schemaVersion=2 saves to schemaVersion=3 cleanly and preserves all fields', () => {
    const base = createInitialGameState(99123);
    base.regionId = 'whisperwood';
    base.playerPos = { x: 25, y: 9, facing: 'left' };
    base.stepCount = 84;
    base.tokens = 210;
    base.flags.has_starter = true;
    base.openedProps = ['hub_garden_chest'];
    base.lexicon.lex_valley = {
      wordId: 'lex_valley',
      exposures: 4,
      glossLookups: 2,
      savedByPlayer: true,
      mastery: 2,
      lastSeenStep: 50,
      nextReviewStep: 90,
      contextsSeen: ['dlg:rowan_intro'],
    };

    // Strip all v1.3.0 fields to match an exact v1.2.0 (schemaVersion=2) production save
    const legacyV2 = structuredClone(base) as unknown as Record<string, unknown>;
    legacyV2.schemaVersion = 2;
    delete legacyV2.lexiconZh;
    const legacySettings = legacyV2.settings as Record<string, unknown>;
    legacySettings.contentLanguage = 'bilingual';
    legacySettings.difficulty = 'adventure';
    delete legacySettings.learningLanguage;
    delete legacySettings.hskLevel;
    delete legacySettings.zhStudyMode;
    delete legacySettings.showPinyin;
    delete legacySettings.pinyinPosition;
    delete legacySettings.showZhTranslation;
    delete legacySettings.clickToMove;
    delete legacySettings.movementSpeed;

    const v2Envelope = serializeSaveEnvelope(
      legacyV2 as unknown as ReturnType<typeof createInitialGameState>,
      7,
      2,
    );

    const parsed = deserializeSaveEnvelope(v2Envelope, GAME_SAVE_VALIDATION_REGISTRY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const migrated = parsed.state;
    expect(parsed.migratedFromLegacy).toBe(true);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.regionId).toBe('whisperwood');
    expect(migrated.tokens).toBe(210);
    expect(migrated.lexicon['lex_valley']?.savedByPlayer).toBe(true);
    expect(migrated.lexiconZh).toEqual({});
    expect(migrated.settings.learningLanguage).toBe('en');
    expect(migrated.settings.hskLevel).toBe('HSK2');
    expect(migrated.settings.clickToMove).toBe(true);
    expect(migrated.settings.movementSpeed).toBe('walk');
    expect(migrated.settings.showPinyin).toBe(true);
    expect(migrated.settings.pinyinPosition).toBe('above');

    // Roundtrip v3 export/import with Chinese vocabulary & settings
    migrated.settings.learningLanguage = 'zh';
    migrated.settings.hskLevel = 'HSK2';
    migrated.settings.pinyinPosition = 'below';
    migrated.settings.movementSpeed = 'run';
    recordChineseWordLookup(migrated, ZH_LEXICON_INDEX.byHanzi['准备']!.id, 'dlg:test', 1000);

    const exported = serializeSaveEnvelope(migrated, 8);
    const reimported = deserializeSaveEnvelope(exported, GAME_SAVE_VALIDATION_REGISTRY);
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(reimported.state.settings.learningLanguage).toBe('zh');
    expect(reimported.state.settings.pinyinPosition).toBe('below');
    expect(reimported.state.settings.movementSpeed).toBe('run');
    expect(reimported.state.lexiconZh?.[ZH_LEXICON_INDEX.byHanzi['准备']!.id]?.glossLookups).toBe(1);
    expect(reimported.state.lexicon['lex_valley']?.savedByPlayer).toBe(true);

    // Corrupted checksum must be cleanly rejected
    const tampered = exported.replace('"tokens":210', '"tokens":999');
    const tamperedRes = deserializeSaveEnvelope(tampered, GAME_SAVE_VALIDATION_REGISTRY);
    expect(tamperedRes.ok).toBe(false);
  });
});

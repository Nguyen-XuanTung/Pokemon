import type {
  BattleSpeedMode,
  CefrBand,
  ContentLanguageMode,
  DifficultyMode,
  Direction,
  GuidanceMode,
  HskLevel,
  LanguageSupportMode,
  LearningLanguage,
  MovementSpeedMode,
  PinyinPosition,
  StatusId,
  TimeOfDay,
  UiLanguage,
  ZhStudyMode,
} from './types.ts';

export interface UiCatalog {
  readonly appTagline: string;
  readonly offlineBadge: string;
  readonly titleDesc: string;
  readonly starterRoleSummary: Readonly<Record<'mosskit' | 'kindlet' | 'ripplefin', string>>;
  readonly labelUiLanguage: string;
  readonly labelLearningLanguage: string;
  readonly labelContentLanguage: string;
  readonly labelEnglishBand: string;
  readonly labelHskLevel: string;
  readonly labelZhStudyMode: string;
  readonly labelShowPinyin: string;
  readonly labelPinyinPosition: string;
  readonly labelShowZhTranslation: string;
  readonly labelClickToMove: string;
  readonly labelMovementSpeed: string;
  readonly labelDifficulty: string;
  readonly labelGuidanceMode: string;
  readonly uiLanguageOptions: Readonly<Record<UiLanguage, string>>;
  readonly learningLanguageOptions: Readonly<Record<LearningLanguage, string>>;
  readonly contentLanguageOptions: Readonly<Record<ContentLanguageMode, string>>;
  readonly cefrOptions: Readonly<Record<CefrBand, string>>;
  readonly hskOptions: Readonly<Record<HskLevel, string>>;
  readonly zhStudyModeOptions: Readonly<Record<ZhStudyMode, string>>;
  readonly pinyinPositionOptions: Readonly<Record<PinyinPosition, string>>;
  readonly movementSpeedOptions: Readonly<Record<MovementSpeedMode, string>>;
  readonly difficultyOptions: Readonly<Record<DifficultyMode, string>>;
  readonly difficultyDescriptions: Readonly<Record<DifficultyMode, string>>;
  readonly guidanceOptions: Readonly<Record<GuidanceMode, string>>;
  readonly btnContinueGame: string;
  readonly btnNewGame: string;
  readonly btnImportSave: string;
  readonly checkboxSkipTutorialTitle: string;
  readonly importErrorPrefix: string;
  readonly hudRibbonTooltip: string;
  readonly hudMapBtn: string;
  readonly hudInteractBtn: string;
  readonly hudLostBtn: string;
  readonly hudJournalBtn: string;
  readonly hudPostGameSummary: (rematches: number, traces: number) => string;
  readonly hudDistanceSteps: (steps: number, dirLabel: string) => string;
  readonly hudCrossRegionHint: (portalLabel: string) => string;
  readonly hudNearbyPrompt: (targetName: string, isTouch: boolean) => string;
  readonly timeLabels: Readonly<Record<TimeOfDay, string>>;
  readonly directionLabels: Readonly<Record<Direction, string>>;
  readonly statusLabels: Readonly<Record<StatusId, string>>;
  readonly tokensShort: (count: number) => string;
  readonly levelShort: (level: number) => string;
  readonly hpLabel: (cur: number, max: number) => string;
  readonly dialogueListenBtn: string;
  readonly dialogueShowVi: string;
  readonly dialogueHideVi: string;
  readonly dialogueShowPinyin: string;
  readonly dialogueHidePinyin: string;
  readonly dialogueNext: string;
  readonly dialogueClose: string;
  readonly dialogueBandBadge: (band: CefrBand) => string;
  readonly dialogueHskBadge: (level: HskLevel) => string;
  readonly glossCloseBtn: string;
  readonly glossQuickMeaning: string;
  readonly glossContextMeaning: string;
  readonly glossOtherMeaning: (pos: string, meaning: string) => string;
  readonly glossOtherReading: (pinyin: string, pos: string, meaning: string) => string;
  readonly glossProperNounBadge: string;
  readonly glossProperNounNote: string;
  readonly glossListenBtn: string;
  readonly glossSaveBtn: string;
  readonly glossSavedBtn: string;
  readonly touchBagBtn: string;
  readonly touchActBtn: string;
  readonly touchMoveAria: (dir: Direction) => string;
  readonly evoTitle: (fromName: string, toName: string, level: number) => string;
  readonly evoSubtitle: (fromName: string, toName: string, titleLocal: string) => string;
  readonly evoDismissBtn: string;
  readonly moveLearnedBannerTitle: (creatureName: string, moveName: string) => string;
  readonly moveLearnedBannerBody: (moveDesc: string, replacedName?: string) => string;
  readonly moveLearnedManageBtn: string;
  readonly moveLearnedDismissBtn: string;
  readonly lostModalTitle: string;
  readonly lostModalClose: string;
  readonly lostWhereYouAre: (regionName: string) => string;
  readonly lostNextAction: string;
  readonly lostTargetLabel: string;
  readonly lostDirectionLabel: string;
  readonly lostHealAdvice: string;
  readonly lostEnableGuidanceBtn: string;
  readonly lostTrackMainBtn: string;
  readonly lostQuickGuideBtn: string;
  readonly lostHideQuickGuideBtn: string;
  readonly lostRestartGuideBtn: string;
  readonly hudArrivedBadge: string;
  readonly hudLockedBadge: string;
  readonly hudUnreachableBadge: string;
  readonly creditsBtn: string;
  readonly creditsModalTitle: string;
  readonly creditsCloseBtn: string;
  readonly creditsVersionLine: (ver: string) => string;
  readonly creditsLicenseSummary: string;
  readonly creditsThirdPartyTitle: string;
  readonly creditsViewLicenseLink: string;
  readonly creditsViewCreditsLink: string;
  readonly onboardingHeader: (stepNum: number, total: number) => string;
  readonly onboardingSkipBtn: string;
  readonly onboardingSkipStepBtn: string;
  readonly battleWildPrefix: (name: string) => string;
  readonly battleFoePrefix: (name: string) => string;
  readonly battleGleamingBadge: string;
  readonly battleBondedBadge: string;
  readonly battleTurnHeader: (turn: number, title: string, role: string) => string;
  readonly battleSpeedYouFirst: string;
  readonly battleSpeedFoeFirst: string;
  readonly battleRiskBadge: string;
  readonly battleSpeedLabels: Readonly<Record<BattleSpeedMode, string>>;
  readonly battleContinueBtn: string;
  readonly battleTabMoves: string;
  readonly battleTabBagWild: (pct: number) => string;
  readonly battleTabBagPlain: string;
  readonly battleTabTeam: (count: number, suggestSwitch: boolean) => string;
  readonly battleTabTactics: string;
  readonly battleSupportTag: string;
  readonly battleEffectiveTag: string;
  readonly battleResistedTag: string;
  readonly battleRecommendedTag: string;
  readonly battleKoRiskTag: string;
  readonly battleNoItems: string;
  readonly battleBondEstimate: (pct: number) => string;
  readonly battleBondGuaranteed: string;
  readonly battleCountersFoe: string;
  readonly battleObserveBtn: string;
  readonly battleFleeBtn: string;
  readonly battleAssistTitle: string;
  readonly battleLowHpAlert: (cur: number, max: number) => string;
  readonly battleSwitchTip: (partnerName: string, elName: string) => string;
  readonly battleCaptureReadyTip: (pct: number, guaranteed: boolean) => string;
  readonly battleCaptureWeakenTip: (pct: number) => string;
  readonly battleElementExplain: (moveEl: string, foeEl: string, mult: number) => string;
  readonly bossWarningBanner: (
    bossName: string,
    teamMaxLv: number,
    recLv: number,
    needsHeal: boolean,
    needsTonics: boolean,
    counterElementsText: string,
  ) => string;
  readonly journalHeader: (caught: number, tokens: number) => string;
  readonly journalCloseBtn: string;
  readonly journalTabs: Readonly<{
    quests: string;
    map: string;
    team: string;
    bag: string;
    compendium: string;
    lexicon: string;
    settings: string;
  }>;
  readonly questMasteryTitle: string;
  readonly questMasteryStats: (
    traces: number,
    secrets: number,
    rematches: number,
    gleaming: number,
    lore: number,
  ) => string;
  readonly questMainTag: string;
  readonly questFieldTag: string;
  readonly questActiveBadge: string;
  readonly questDoneBadge: string;
  readonly questTrackingBadge: string;
  readonly questTrackBtn: string;
  readonly questFieldWhat: string;
  readonly questFieldTarget: string;
  readonly questFieldRegion: string;
  readonly questFieldProgress: string;
  readonly questFieldUnmet: string;
  readonly questFieldPrep: string;
  readonly mapIntro: string;
  readonly mapDirections: Readonly<Record<'north' | 'west' | 'center' | 'east' | 'south', string>>;
  readonly mapHereBadge: (x: number, y: number) => string;
  readonly mapGatedBadge: string;
  readonly mapResonantBadge: string;
  readonly mapHabitatsInfo: (speciesCount: number, traceFound: boolean) => string;
  readonly teamHeader: (count: number) => string;
  readonly teamLeadTag: string;
  readonly teamFinalForm: string;
  readonly teamEvolvesHint: (level: number, nextName: string) => string;
  readonly teamStatsLine: (hp: number, maxHp: number, atk: number, def: number, spd: number) => string;
  readonly teamMakeLeadBtn: string;
  readonly teamUseTonicBtn: string;
  readonly teamManageMovesBtn: string;
  readonly teamCloseMovesBtn: string;
  readonly teamMoveGuideIntro: string;
  readonly teamActiveMovesTitle: string;
  readonly teamAvailableMovesTitle: string;
  readonly teamReplaceSlotLabel: (slotNum: number, moveName: string) => string;
  readonly teamReserveHeader: (count: number) => string;
  readonly teamSwapReserveBtn: string;
  readonly bagUseBtn: string;
  readonly bagEmpty: string;
  readonly compendiumStats: (discovered: number, bonded: number, gleaming: number) => string;
  readonly compendiumUncharted: (dex: string) => string;
  readonly compendiumHabitat: (names: string) => string;
  readonly compendiumActiveTime: (times: string) => string;
  readonly compendiumBondedTag: string;
  readonly compendiumSightedTag: string;
  readonly compendiumEvoLine: (level: number, nextName: string) => string;
  readonly compendiumReadStoryBtn: string;
  readonly compendiumUnlockHint: (names: string) => string;
  readonly lexiconFilters: Readonly<{
    encountered: (n: number) => string;
    saved: (n: number) => string;
    mastered: (n: number) => string;
    due: (n: number) => string;
    all: (n: number) => string;
    dispatches: (n: number) => string;
  }>;
  readonly lexiconReadTag: string;
  readonly lexiconUnreadTag: string;
  readonly lexiconReadNoteBtn: string;
  readonly lexiconEmpty: string;
  readonly lexiconStatsLine: (exp: number, lookups: number, mastery: number) => string;
  readonly lexiconListenBtn: string;
  readonly lexiconSaveBtn: string;
  readonly lexiconSavedBtn: string;
  readonly lexiconNotebookEn: string;
  readonly lexiconNotebookZh: string;
  readonly campZhPromptHanziToVi: string;
  readonly campZhPromptHanziToPinyin: string;
  readonly campZhPromptListenToHanzi: string;
  readonly campZhListenBtn: string;
  readonly settingsBattleSpeedLabel: string;
  readonly settingsBattleSpeedOptions: Readonly<Record<BattleSpeedMode, string>>;
  readonly settingsTouchLabel: string;
  readonly settingsTouchOptions: Readonly<Record<'auto' | 'always' | 'off', string>>;
  readonly settingsTextScaleLabel: string;
  readonly settingsTextScaleOptions: Readonly<Record<'normal' | 'large', string>>;
  readonly settingsBattleAssistLabel: string;
  readonly settingsShowFollowerLabel: string;
  readonly settingsHighContrastLabel: string;
  readonly settingsReducedMotionLabel: string;
  readonly settingsMuteLabel: string;
  readonly settingsBgmLabel: string;
  readonly settingsSfxLabel: string;
  readonly settingsKeyMapHeader: string;
  readonly settingsKeyLabels: Readonly<Record<'up' | 'down' | 'left' | 'right' | 'interact' | 'journal', string>>;
  readonly settingsPressKey: (label: string) => string;
  readonly settingsSaveHeader: string;
  readonly settingsMultiTabWarning: string;
  readonly settingsSaveNowBtn: string;
  readonly settingsExportBtn: string;
  readonly settingsImportBtn: string;
  readonly settingsSyncTabBtn: string;
  readonly settingsTutorialHeader: string;
  readonly settingsRestartTutorialBtn: string;
  readonly settingsSkipTutorialBtn: string;
  readonly supplyHeader: (tokens: number) => string;
  readonly supplyCloseBtn: string;
  readonly supplyPriceOwned: (price: number, owned: number) => string;
  readonly supplyBuyBtn: string;
  readonly campHeader: string;
  readonly campSkipBtn: string;
  readonly campEmpty: string;
  readonly campCardCounter: (cur: number, total: number, due: boolean) => string;
  readonly campNextBtn: string;
  readonly campFeedbackCorrect: (word: string, meaning: string, sentenceVi: string) => string;
  readonly campFeedbackGentle: (word: string, meaning: string, sentenceVi: string) => string;
  readonly endingHeader: string;
  readonly endingLead: string;
  readonly endingSub: string;
  readonly endingStats: (
    steps: number,
    caught: number,
    questsDone: number,
    questsTotal: number,
    rematches: number,
    wordsSeen: number,
    wordsMastered: number,
  ) => string;
  readonly endingContinueBtn: string;
  readonly minimapTitle: string;
}

export const UI_STRINGS: Readonly<Record<UiLanguage, UiCatalog>> = {
  vi: {
    appTagline: 'CHUYẾN THÁM HIỂM THUNG LŨNG RÊU XANH',
    offlineBadge: 'Nhập vai ngoại tuyến',
    titleDesc:
      'Khám phá năm vùng sinh thái sống động, kết bạn ba mươi loài sinh vật đi theo sau bước chân và làm quen tiếng Anh hoặc tiếng Trung tự nhiên theo tốc độ của bạn. Mọi hỗ trợ tra từ và ôn tập đều hoàn toàn tự nguyện.',
    starterRoleSummary: {
      mosskit: 'Hệ Lá rừng | Cân bằng',
      kindlet: 'Hệ Lửa ấm | Tốc chiến',
      ripplefin: 'Hệ Suối nước | Vững chãi',
    },
    labelUiLanguage: 'Ngôn ngữ giao diện:',
    labelLearningLanguage: 'Ngôn ngữ đang học:',
    labelContentLanguage: 'Chế độ hỗ trợ tiếng Anh:',
    labelEnglishBand: 'Mức tiếng Anh:',
    labelHskLevel: 'Cấp độ tiếng Trung (HSK 2.0):',
    labelZhStudyMode: 'Chế độ học tiếng Trung:',
    labelShowPinyin: 'Hiển thị phiên âm Pinyin:',
    labelPinyinPosition: 'Vị trí Pinyin:',
    labelShowZhTranslation: 'Hiện nghĩa tiếng Việt kèm theo:',
    labelClickToMove: 'Chạm hoặc nhấp chuột bản đồ để tự di chuyển:',
    labelMovementSpeed: 'Tốc độ di chuyển:',
    labelDifficulty: 'Độ khó chiến đấu:',
    labelGuidanceMode: 'Mức dẫn đường:',
    uiLanguageOptions: {
      vi: 'Tiếng Việt',
      en: 'Tiếng Anh',
    },
    learningLanguageOptions: {
      en: 'Tiếng Anh (CEFR A1-B2)',
      zh: 'Tiếng Trung giản thể (HSK 1-3)',
      none: 'Không học ngoại ngữ (Chỉ tiếng Việt)',
    },
    contentLanguageOptions: {
      vi_only: 'Tiếng Việt hoàn toàn',
      bilingual: 'Song ngữ Anh Việt',
      en_assist: 'Tiếng Anh có trợ giúp tra cứu',
      en_immersion: 'Đắm chìm trong tiếng Anh',
    },
    cefrOptions: {
      A1: 'A1 Mới bắt đầu',
      A2: 'A2 Sơ cấp',
      B1: 'B1 Trung cấp',
      B2: 'B2 Nâng cao',
    },
    hskOptions: {
      HSK1: 'HSK 1 (Sơ cấp nhập môn)',
      HSK2: 'HSK 2 (Sơ cấp căn bản)',
      HSK3: 'HSK 3 (Sơ trung cấp)',
    },
    zhStudyModeOptions: {
      hanzi_pinyin_vi: 'Chữ Hán + Pinyin + Nghĩa Việt',
      hanzi_pinyin: 'Chữ Hán + Pinyin (Ấn để xem nghĩa)',
      hanzi_assist: 'Chữ Hán (Chạm từng từ tra Pinyin và nghĩa)',
      zh_immersion: 'Đắm chìm tiếng Trung (Chỉ chữ Hán)',
      vi_only: 'Chỉ tiếng Việt',
    },
    pinyinPositionOptions: {
      above: 'Phía trên chữ Hán',
      below: 'Phía dưới chữ Hán',
    },
    movementSpeedOptions: {
      walk: 'Đi bộ tiêu chuẩn (giữ Shift để chạy)',
      run: 'Chạy nhanh liên tục',
    },
    difficultyOptions: {
      relaxed: 'Thư giãn (Khuyên dùng cho người mới)',
      adventure: 'Phiêu lưu (Cân bằng chuẩn)',
      challenge: 'Thử thách (Chiến thuật cao)',
    },
    difficultyDescriptions: {
      relaxed: 'Giảm sát thương nhận vào, tăng tỷ lệ thu phục, tự hồi nhẹ sau trận và bật sẵn gợi ý chiến thuật.',
      adventure: 'Cân bằng tiêu chuẩn giữa khám phá, luyện cấp và tương khắc nguyên tố.',
      challenge: 'Đối thủ ra đòn thông minh hơn, đòi hỏi phối hợp đội hình và tương khắc tốt.',
    },
    guidanceOptions: {
      full: 'Đầy đủ (Đường chỉ dẫn, bản đồ nhỏ và mũi tên)',
      minimal: 'Tối giản (Chỉ mũi tên và dấu nhiệm vụ)',
      off: 'Tắt (Tự khám phá)',
    },
    btnContinueGame: 'Tiếp tục hành trình',
    btnNewGame: 'Bắt đầu hành trình mới',
    btnImportSave: 'Nhập tệp lưu (.json)',
    checkboxSkipTutorialTitle: 'Tôi đã quen thể loại nhập vai này, bỏ qua hướng dẫn mở đầu',
    importErrorPrefix: 'Không thể nhập tệp lưu: ',
    hudRibbonTooltip: 'Chạm để mở chi tiết nhiệm vụ trong Sổ thực địa',
    hudMapBtn: 'Bản đồ',
    hudInteractBtn: 'Tương tác',
    hudLostBtn: 'Tôi bị lạc',
    hudJournalBtn: 'Sổ thực địa',
    hudPostGameSummary: (rematches, traces) =>
      `Hậu cốt truyện: Tái đấu thủ lĩnh ${rematches}/4 | Dấu vết sinh cảnh ${traces}/4`,
    hudDistanceSteps: (steps, dirLabel) => `Hướng ${dirLabel}, còn khoảng ${steps} bước`,
    hudCrossRegionHint: (portalLabel) => `Đi tới lối chuyển vùng: ${portalLabel}`,
    hudNearbyPrompt: (targetName, isTouch) =>
      isTouch
        ? `Chạm nút Tương tác để gặp ${targetName}`
        : `Nhấn Space hoặc Enter để tương tác với ${targetName}`,
    timeLabels: {
      morning: 'Sáng',
      day: 'Trưa',
      dusk: 'Hoàng hôn',
      night: 'Đêm',
    },
    directionLabels: {
      up: 'Bắc',
      down: 'Nam',
      left: 'Tây',
      right: 'Đông',
    },
    statusLabels: {
      burn: 'BỎNG',
      poison: 'ĐỘC',
      sleep: 'NGỦ ÊM',
      paralyze: 'TÊ LIỆT',
    },
    tokensShort: (count) => `${count} Huy hiệu`,
    levelShort: (level) => `Cấp ${level}`,
    hpLabel: (cur, max) => `Máu ${cur}/${max}`,
    dialogueListenBtn: 'Nghe đọc',
    dialogueShowVi: 'Xem nghĩa Việt',
    dialogueHideVi: 'Ẩn nghĩa Việt',
    dialogueShowPinyin: 'Hiện Pinyin',
    dialogueHidePinyin: 'Ẩn Pinyin',
    dialogueNext: 'Tiếp theo',
    dialogueClose: 'Đóng hội thoại',
    dialogueBandBadge: (band) => `Mức ${band}`,
    dialogueHskBadge: (level) => `${level.replace('HSK', 'HSK ')}`,
    glossCloseBtn: 'Đóng',
    glossQuickMeaning: 'Nghĩa nhanh:',
    glossContextMeaning: 'Nghĩa trong câu:',
    glossOtherMeaning: (pos, meaning) => `Nghĩa khác (${pos}): ${meaning}`,
    glossOtherReading: (pinyin, pos, meaning) => `Âm/nghĩa khác (${pinyin}, ${pos}): ${meaning}`,
    glossProperNounBadge: 'Tên riêng',
    glossProperNounNote: 'Tên riêng trong thế giới game, không tính vào danh sách từ HSK.',
    glossListenBtn: 'Nghe phát âm',
    glossSaveBtn: 'Lưu vào sổ từ',
    glossSavedBtn: 'Đã lưu sổ từ',
    touchBagBtn: 'Sổ tay',
    touchActBtn: 'Chọn',
    touchMoveAria: (dir) => {
      const m: Record<Direction, string> = {
        up: 'Đi lên',
        down: 'Đi xuống',
        left: 'Sang trái',
        right: 'Sang phải',
      };
      return m[dir];
    },
    evoTitle: (fromName, toName, level) =>
      `Tiến hóa! ${fromName} đã trưởng thành thành ${toName} ở cấp ${level}!`,
    evoSubtitle: (fromName, toName, titleLocal) =>
      `${fromName} đã tiến hóa rực rỡ thành ${toName} (${titleLocal}).`,
    evoDismissBtn: 'Tuyệt vời',
    moveLearnedBannerTitle: (creatureName, moveName) =>
      `${creatureName} vừa học chiêu mới: ${moveName}`,
    moveLearnedBannerBody: (moveDesc, replacedName) =>
      replacedName
        ? `${moveDesc} Đã tạm thay thế ô chiêu ${replacedName}. Bạn có thể đổi lại bộ chiêu bất kỳ lúc nào.`
        : `${moveDesc} Chiêu mới đã được thêm vào danh sách chiêu thức.`,
    moveLearnedManageBtn: 'Xem và đổi chiêu',
    moveLearnedDismissBtn: 'Đã hiểu',
    lostModalTitle: 'Trợ giúp định hướng',
    lostModalClose: 'Đóng',
    lostWhereYouAre: (regionName) => `Vị trí hiện tại: ${regionName}`,
    lostNextAction: 'Việc cần làm tiếp theo:',
    lostTargetLabel: 'Điểm đến đang theo dõi:',
    lostDirectionLabel: 'Đường đi ngắn nhất:',
    lostHealAdvice: 'Đội hình đang mất nhiều máu. Nên ghé lửa trại gần nhất hoặc dùng Sương Thảo Dược trước khi đi tiếp.',
    lostEnableGuidanceBtn: 'Bật đường dẫn đầy đủ',
    lostTrackMainBtn: 'Theo dõi nhiệm vụ chính',
    lostQuickGuideBtn: 'Xem nhanh 8 bước cho người mới',
    lostHideQuickGuideBtn: 'Ẩn hướng dẫn nhanh',
    lostRestartGuideBtn: 'Bật lại gợi ý từng bước',
    hudArrivedBadge: 'Đã tới nơi',
    hudLockedBadge: 'Đang khóa',
    hudUnreachableBadge: 'Cần mở đường',
    creditsBtn: 'Giấy phép và Ghi công',
    creditsModalTitle: 'Giấy phép và Ghi công tài nguyên',
    creditsCloseBtn: 'Đóng',
    creditsVersionLine: (ver) => `Phiên bản phát hành: LingoWild v${ver} (Chạy ngoại tuyến phía trình duyệt)`,
    creditsLicenseSummary:
      'Mã nguồn TypeScript, âm thanh tổng hợp Web Audio, dữ liệu hội thoại song ngữ, 30 loài sinh vật và đồng hành vẽ riêng phát hành theo giấy phép MIT. Các gói hình ảnh mở bên thứ ba giữ nguyên giấy phép gốc của từng tác giả (CC0 1.0, CC-BY 3.0 và CC-BY 4.0).',
    creditsThirdPartyTitle: 'Ghi công tài nguyên đồ họa và thư viện mã mở:',
    creditsViewLicenseLink: 'Mở tệp LICENSE.txt',
    creditsViewCreditsLink: 'Mở tệp CREDITS.md đầy đủ',
    onboardingHeader: (stepNum, total) => `Hướng dẫn nhập môn (${stepNum}/${total})`,
    onboardingSkipBtn: 'Bỏ qua hướng dẫn',
    onboardingSkipStepBtn: 'Bỏ qua bước này',
    battleWildPrefix: (name) => `Hoang dã ${name}`,
    battleFoePrefix: (name) => `Đối thủ ${name}`,
    battleGleamingBadge: 'Ánh sao',
    battleBondedBadge: 'Đã kết bạn',
    battleTurnHeader: (turn, title, role) => `Lượt ${turn} | ${title} (${role})`,
    battleSpeedYouFirst: 'Bạn ra đòn trước',
    battleSpeedFoeFirst: 'Đối thủ ra đòn trước',
    battleRiskBadge: 'Cảnh báo: Đối thủ khắc chế 1,5x',
    battleSpeedLabels: {
      normal: 'Nhịp: 1x',
      fast: 'Nhịp: 2x Nhanh',
      instant: 'Nhịp: Tức thì',
    },
    battleContinueBtn: 'Tiếp tục hành trình (Space)',
    battleTabMoves: 'Chiêu thức',
    battleTabBagWild: (pct) => (pct > 0 ? `Chuông và Túi (~${pct}%)` : 'Chuông và Túi'),
    battleTabBagPlain: 'Túi đồ',
    battleTabTeam: (count, suggestSwitch) =>
      suggestSwitch ? `Đội hình (${count}) [Nên đổi]` : `Đội hình (${count})`,
    battleTabTactics: 'Quan sát và Rút lui',
    battleSupportTag: 'Hỗ trợ',
    battleEffectiveTag: 'Khắc chế 1,5x',
    battleResistedTag: 'Bị kháng 0,67x',
    battleRecommendedTag: 'Khuyên dùng',
    battleKoRiskTag: 'Dễ đánh ngất',
    battleNoItems: 'Không còn vật phẩm dùng trong trận.',
    battleBondEstimate: (pct) => ` | Tỷ lệ ~${pct}%`,
    battleBondGuaranteed: ' | Bảo đảm 100%',
    battleCountersFoe: 'Khắc chế đối thủ',
    battleObserveBtn: 'Quan sát tập tính',
    battleFleeBtn: 'Rút lui an toàn',
    battleAssistTitle: 'Gợi ý chiến thuật:',
    battleLowHpAlert: (cur, max) =>
      `Máu đang thấp (${cur}/${max}). Hãy mở Túi đồ dùng Sương Thảo Dược hoặc đổi bạn đồng hành khác.`,
    battleSwitchTip: (partnerName, elName) =>
      `Nên đổi sang ${partnerName} (hệ ${elName}) để khắc chế đối thủ dễ hơn.`,
    battleCaptureReadyTip: (pct, guaranteed) =>
      guaranteed
        ? 'Thời điểm hoàn hảo! Mở thẻ Chuông và Túi rồi chọn Chuông Rêu để kết bạn chắc chắn 100%.'
        : `Có thể thu phục ngay! Mở thẻ Chuông và Túi để dùng chuông (tỷ lệ ước tính ~${pct}%).`,
    battleCaptureWeakenTip: (pct) =>
      `Đánh giảm bớt máu đối thủ trước rồi hãy dùng chuông để tăng tỷ lệ thu phục (hiện tại ~${pct}%).`,
    battleElementExplain: (moveEl, foeEl, mult) =>
      mult > 1.05
        ? `Hệ ${moveEl} khắc chế hệ ${foeEl}, gây sát thương gấp 1,5 lần.`
        : mult < 0.95
          ? `Hệ ${foeEl} kháng hệ ${moveEl}, sát thương giảm còn 0,67 lần.`
          : `Hệ ${moveEl} gây sát thương bình thường lên hệ ${foeEl}.`,
    bossWarningBanner: (bossName, teamMaxLv, recLv, needsHeal, needsTonics, counterElementsText) => {
      const parts: string[] = [
        `Chuẩn bị trước trận gặp ${bossName}: đội hình hiện cao nhất cấp ${teamMaxLv} (khuyên dùng từ cấp ${recLv})`,
      ];
      if (counterElementsText) {
        parts.push(`nên mang bạn hệ ${counterElementsText}`);
      }
      if (needsHeal) {
        parts.push('hãy hồi đầy máu tại lửa trại gần nhất');
      }
      if (needsTonics) {
        parts.push('nên mang ít nhất 2 bình hồi máu trong Túi đồ');
      }
      return `${parts.join('; ')}.`;
    },
    journalHeader: (caught, tokens) => `Sổ Thực Địa | Đã kết bạn: ${caught}/30 | ${tokens} Huy hiệu`,
    journalCloseBtn: 'Đóng (Esc)',
    journalTabs: {
      quests: 'Nhiệm vụ',
      map: 'Bản đồ vùng',
      team: 'Đội hình',
      bag: 'Túi đồ',
      compendium: 'Bách khoa (30)',
      lexicon: 'Từ vựng',
      settings: 'Cài đặt và Lưu',
    },
    questMasteryTitle: 'Tiến độ khám phá toàn thung lũng',
    questMasteryStats: (traces, secrets, rematches, gleaming, lore) =>
      `Dấu vết sinh cảnh: ${traces}/4 | Rương ẩn: ${secrets}/4 | Tái đấu thủ lĩnh: ${rematches}/4 | Ánh sao: ${gleaming} | Ghi chép đã đọc: ${lore}`,
    questMainTag: '[Chính] ',
    questFieldTag: '[Phụ] ',
    questActiveBadge: 'Đang làm',
    questDoneBadge: 'Hoàn thành',
    questTrackingBadge: 'Đang dẫn đường',
    questTrackBtn: 'Dẫn đường',
    questFieldWhat: 'Việc cần làm:',
    questFieldTarget: 'Cần tìm:',
    questFieldRegion: 'Khu vực:',
    questFieldProgress: 'Tiến độ:',
    questFieldUnmet: 'Điều kiện chưa mở:',
    questFieldPrep: 'Chuẩn bị khuyên dùng:',
    mapIntro: 'Bản đồ năm vùng sinh thái liên thông quanh Trại Đèn Rêu.',
    mapDirections: {
      north: 'Đỉnh phía Bắc',
      west: 'Rừng phía Tây',
      center: 'Làng trung tâm',
      east: 'Đầm phía Đông',
      south: 'Đèo phía Nam',
    },
    mapHereBadge: (x, y) => `Bạn ở đây (${x},${y})`,
    mapGatedBadge: 'Chưa mở lối',
    mapResonantBadge: 'Đã cộng hưởng',
    mapHabitatsInfo: (speciesCount, traceFound) =>
      `Sinh cảnh hoang dã: ${speciesCount} loài | Dấu vết: ${traceFound ? 'Đã ghi nhận' : 'Chưa khảo sát'}`,
    teamHeader: (count) => `Đội hình hiện tại (${count}/6) | Bạn đầu đội sẽ bước đi theo sau bạn`,
    teamLeadTag: '[Dẫn đầu] ',
    teamFinalForm: ' | Cấp tiến hóa cuối',
    teamEvolvesHint: (level, nextName) => ` | Tiến hóa cấp ${level} thành ${nextName}`,
    teamStatsLine: (hp, maxHp, atk, def, spd) =>
      `Máu ${hp}/${maxHp} | Công ${atk} Thủ ${def} Tốc ${spd}`,
    teamMakeLeadBtn: 'Đưa lên đầu',
    teamUseTonicBtn: 'Dùng Nước Sương',
    teamManageMovesBtn: 'Chiêu thức',
    teamCloseMovesBtn: 'Thu gọn chiêu',
    teamMoveGuideIntro:
      'Mỗi sinh vật mang tối đa 4 chiêu. Nên giữ ít nhất 2 chiêu tấn công mạnh và 1 chiêu hỗ trợ hoặc gây ngủ để dễ thu phục.',
    teamActiveMovesTitle: '4 chiêu đang trang bị:',
    teamAvailableMovesTitle: 'Chiêu đã học có thể thay vào:',
    teamReplaceSlotLabel: (slotNum, moveName) => `Thay vào ô ${slotNum} (${moveName})`,
    teamReserveHeader: (count) => `Khu bảo tồn dự bị (${count} bạn đồng hành)`,
    teamSwapReserveBtn: 'Đổi với ô cuối đội',
    bagUseBtn: 'Sử dụng',
    bagEmpty: 'Túi đồ hiện chưa có vật phẩm nào.',
    compendiumStats: (discovered, bonded, gleaming) =>
      `Đã gặp: ${discovered}/30 | Đã kết bạn: ${bonded}/30 | Biến thể Ánh sao: ${gleaming}/30`,
    compendiumUncharted: (dex) => `#${dex} Sinh vật chưa khám phá`,
    compendiumHabitat: (names) => `Vùng sống: ${names}`,
    compendiumActiveTime: (times) => `Thường gặp vào: ${times}`,
    compendiumBondedTag: '[Đã kết bạn]',
    compendiumSightedTag: '[Đã gặp]',
    compendiumEvoLine: (level, nextName) => `Tiến hóa ở cấp ${level} thành ${nextName}`,
    compendiumReadStoryBtn: 'Đọc truyện thực địa',
    compendiumUnlockHint: (names) => `Vùng sống: ${names} (Dùng chuông thu phục để mở ghi chép chi tiết)`,
    lexiconFilters: {
      encountered: (n) => `Đã gặp (${n})`,
      saved: (n) => `Đã lưu (${n})`,
      mastered: (n) => `Thành thạo (${n})`,
      due: (n) => `Đến hạn ôn (${n})`,
      all: (n) => `Tất cả (${n})`,
      dispatches: (n) => `Thư thực địa (${n})`,
    },
    lexiconReadTag: '[Đã đọc] ',
    lexiconUnreadTag: '[Chưa đọc] ',
    lexiconReadNoteBtn: 'Đọc ghi chép',
    lexiconEmpty: 'Chưa có mục từ nào ở bộ lọc này. Hãy trò chuyện và khám phá thêm.',
    lexiconStatsLine: (exp, lookups, mastery) =>
      `Đã gặp ${exp} lần | Tra nghĩa ${lookups} lần | Mức nhớ ${mastery}/3`,
    lexiconListenBtn: 'Nghe',
    lexiconSaveBtn: 'Lưu',
    lexiconSavedBtn: 'Đã lưu',
    lexiconNotebookEn: 'Sổ từ Tiếng Anh',
    lexiconNotebookZh: 'Sổ từ Tiếng Trung (HSK)',
    campZhPromptHanziToVi: 'Chọn nghĩa tiếng Việt đúng với từ chữ Hán này:',
    campZhPromptHanziToPinyin: 'Chọn phiên âm Pinyin đúng với từ chữ Hán này:',
    campZhPromptListenToHanzi: 'Nghe phát âm hoặc xem Pinyin rồi chọn chữ Hán tương ứng:',
    campZhListenBtn: 'Nghe phát âm tiếng Trung',
    settingsBattleSpeedLabel: 'Tốc độ hoạt ảnh chiến đấu:',
    settingsBattleSpeedOptions: {
      normal: '1x Chuẩn',
      fast: '2x Nhanh',
      instant: 'Tức thì',
    },
    settingsTouchLabel: 'Cụm phím điều khiển cảm ứng:',
    settingsTouchOptions: {
      auto: 'Tự động trên màn hình cảm ứng',
      always: 'Luôn hiển thị',
      off: 'Ẩn',
    },
    settingsTextScaleLabel: 'Cỡ chữ hiển thị:',
    settingsTextScaleOptions: {
      normal: 'Cỡ chuẩn',
      large: 'Chữ lớn dễ đọc',
    },
    settingsBattleAssistLabel: 'Bật gợi ý chiến thuật và cảnh báo trong trận:',
    settingsShowFollowerLabel: 'Hiển thị sinh vật dẫn đầu đi theo sau:',
    settingsHighContrastLabel: 'Chế độ độ tương phản cao:',
    settingsReducedMotionLabel: 'Giảm hiệu ứng chuyển động:',
    settingsMuteLabel: 'Tắt toàn bộ âm thanh:',
    settingsBgmLabel: 'Âm lượng nhạc nền',
    settingsSfxLabel: 'Âm lượng hiệu ứng',
    settingsKeyMapHeader: 'Đổi phím điều khiển',
    settingsKeyLabels: {
      up: 'Lên',
      down: 'Xuống',
      left: 'Trái',
      right: 'Phải',
      interact: 'Tương tác',
      journal: 'Sổ thực địa',
    },
    settingsPressKey: (label) => `Nhấn phím mới cho ${label}...`,
    settingsSaveHeader: 'Lưu trữ và sao lưu an toàn',
    settingsMultiTabWarning:
      'Phát hiện một thẻ trình duyệt khác vừa lưu tiến trình mới hơn. Bấm Đồng bộ để tải bản mới nhất trước khi lưu đè.',
    settingsSaveNowBtn: 'Lưu ngay',
    settingsExportBtn: 'Xuất tệp lưu (.json)',
    settingsImportBtn: 'Nhập tệp lưu (.json)',
    settingsSyncTabBtn: 'Đồng bộ từ thẻ mới hơn',
    settingsTutorialHeader: 'Hướng dẫn người mới',
    settingsRestartTutorialBtn: 'Mở lại hướng dẫn nhập môn',
    settingsSkipTutorialBtn: 'Ẩn hướng dẫn nhập môn',
    supplyHeader: (tokens) => `Quầy Tiếp Tế Thực Địa | Hiện có: ${tokens} Huy hiệu`,
    supplyCloseBtn: 'Đóng',
    supplyPriceOwned: (price, owned) => `${price} Huy hiệu (Trong túi: ${owned})`,
    supplyBuyBtn: 'Đổi 1 cái',
    campHeader: 'Ôn từ nhẹ nhàng bên lửa trại (Tự nguyện, không phạt)',
    campSkipBtn: 'Dừng bất kỳ lúc nào',
    campEmpty: 'Chưa có từ nào trong danh sách. Hãy đọc biển chỉ đường hoặc trò chuyện trước nhé.',
    campCardCounter: (cur, total, due) =>
      `Thẻ ${cur}/${total} | ${due ? 'Từ đến hạn gặp lại' : 'Khởi động nhẹ'}`,
    campNextBtn: 'Thẻ tiếp theo',
    campFeedbackCorrect: (word, meaning, sentenceVi) =>
      `Chính xác! "${word}" nghĩa là "${meaning}". (${sentenceVi})`,
    campFeedbackGentle: (word, meaning, sentenceVi) =>
      `Gợi nhớ nhẹ nhàng: "${word}" có nghĩa là "${meaning}". (${sentenceVi})`,
    endingHeader: 'Hoàn Tất Cốt Truyện Thung Lũng Rêu Xanh',
    endingLead:
      'Cả bốn phiến Đá Cộng Hưởng đã ngân vang hòa hợp dưới bầu trời Thánh Địa Sao Rơi!',
    endingSub:
      'Hậu cốt truyện nay đã mở: bạn có thể thách đấu tái đấu bậc thầy với bốn Thủ lĩnh, săn dấu vết biến thể Ánh sao và thu phục trọn 30 loài.',
    endingStats: (steps, caught, questsDone, questsTotal, rematches, wordsSeen, wordsMastered) =>
      `Bước đi: ${steps} | Đã kết bạn: ${caught}/30 | Nhiệm vụ: ${questsDone}/${questsTotal} | Tái đấu: ${rematches}/4 | Từ đã gặp: ${wordsSeen} (Thành thạo: ${wordsMastered})`,
    endingContinueBtn: 'Tiếp tục khám phá hậu cốt truyện',
    minimapTitle: 'Bản đồ nhỏ',
  },
  en: {
    appTagline: 'VERDANT BASIN EXPEDITION',
    offlineBadge: 'Offline Pixel RPG',
    titleDesc:
      'Explore five living regions, bond with thirty Wildkin companions who walk behind you, and pick up English or Chinese naturally at your own pace. All lookup and review tools stay completely optional.',
    starterRoleSummary: {
      mosskit: 'Leaf | Balanced',
      kindlet: 'Ember | Swift Striker',
      ripplefin: 'Water | Sturdy Bulwark',
    },
    labelUiLanguage: 'Interface language:',
    labelLearningLanguage: 'Learning language:',
    labelContentLanguage: 'English support mode:',
    labelEnglishBand: 'English level band:',
    labelHskLevel: 'Chinese level (HSK 2.0):',
    labelZhStudyMode: 'Chinese study mode:',
    labelShowPinyin: 'Show Pinyin:',
    labelPinyinPosition: 'Pinyin position:',
    labelShowZhTranslation: 'Show Vietnamese translation:',
    labelClickToMove: 'Click or tap map to move automatically:',
    labelMovementSpeed: 'Movement speed:',
    labelDifficulty: 'Battle difficulty:',
    labelGuidanceMode: 'Navigation guidance:',
    uiLanguageOptions: {
      vi: 'Vietnamese',
      en: 'English',
    },
    learningLanguageOptions: {
      en: 'English (CEFR A1-B2)',
      zh: 'Simplified Chinese (HSK 1-3)',
      none: 'No foreign language (Vietnamese only)',
    },
    contentLanguageOptions: {
      vi_only: 'Vietnamese only',
      bilingual: 'Bilingual English and Vietnamese',
      en_assist: 'English with word lookup',
      en_immersion: 'English immersion',
    },
    cefrOptions: {
      A1: 'A1 Beginner',
      A2: 'A2 Elementary',
      B1: 'B1 Intermediate',
      B2: 'B2 Upper Intermediate',
    },
    hskOptions: {
      HSK1: 'HSK 1 (Introductory)',
      HSK2: 'HSK 2 (Elementary)',
      HSK3: 'HSK 3 (Pre-Intermediate)',
    },
    zhStudyModeOptions: {
      hanzi_pinyin_vi: 'Hanzi + Pinyin + Vietnamese',
      hanzi_pinyin: 'Hanzi + Pinyin (Tap for meaning)',
      hanzi_assist: 'Hanzi (Tap any word for Pinyin & meaning)',
      zh_immersion: 'Chinese immersion (Hanzi only)',
      vi_only: 'Vietnamese only',
    },
    pinyinPositionOptions: {
      above: 'Above Hanzi',
      below: 'Below Hanzi',
    },
    movementSpeedOptions: {
      walk: 'Standard walk (hold Shift to run)',
      run: 'Continuous run',
    },
    difficultyOptions: {
      relaxed: 'Relaxed (Recommended for beginners)',
      adventure: 'Adventure (Standard balance)',
      challenge: 'Challenge (Tactical opponents)',
    },
    difficultyDescriptions: {
      relaxed: 'Lower enemy damage, boosted bonding odds, gentle post-battle recovery, and tactical tips on.',
      adventure: 'Original balanced progression across wild bonding and Warden trials.',
      challenge: 'Smarter opponent move selection that rewards type strategy without bloated HP.',
    },
    guidanceOptions: {
      full: 'Full (Ground trail, minimap, and compass)',
      minimal: 'Minimal (Compass and quest icons only)',
      off: 'Off (Free exploration)',
    },
    btnContinueGame: 'Continue Expedition',
    btnNewGame: 'New Expedition',
    btnImportSave: 'Import Save (.json)',
    checkboxSkipTutorialTitle: 'I already know monster RPGs, skip the introductory guide',
    importErrorPrefix: 'Save import error: ',
    hudRibbonTooltip: 'Tap to inspect active quest details in Field Journal',
    hudMapBtn: 'Map',
    hudInteractBtn: 'Interact',
    hudLostBtn: "I'm Lost",
    hudJournalBtn: 'Journal',
    hudPostGameSummary: (rematches, traces) =>
      `Post-Game Mastery: Wardens ${rematches}/4 | Traces ${traces}/4`,
    hudDistanceSteps: (steps, dirLabel) => `Head ${dirLabel}, about ${steps} steps away`,
    hudCrossRegionHint: (portalLabel) => `Travel via exit: ${portalLabel}`,
    hudNearbyPrompt: (targetName, isTouch) =>
      isTouch ? `Tap Act to interact with ${targetName}` : `Press Space or Enter for ${targetName}`,
    timeLabels: {
      morning: 'Morning',
      day: 'Day',
      dusk: 'Dusk',
      night: 'Night',
    },
    directionLabels: {
      up: 'North',
      down: 'South',
      left: 'West',
      right: 'East',
    },
    statusLabels: {
      burn: 'BURN',
      poison: 'POISON',
      sleep: 'SLEEP',
      paralyze: 'PARALYZE',
    },
    tokensShort: (count) => `${count}T`,
    levelShort: (level) => `Lv.${level}`,
    hpLabel: (cur, max) => `HP ${cur}/${max}`,
    dialogueListenBtn: 'Listen',
    dialogueShowVi: 'Show Vietnamese',
    dialogueHideVi: 'Hide Vietnamese',
    dialogueShowPinyin: 'Show Pinyin',
    dialogueHidePinyin: 'Hide Pinyin',
    dialogueNext: 'Next',
    dialogueClose: 'Close',
    dialogueBandBadge: (band) => `Band ${band}`,
    dialogueHskBadge: (level) => `${level.replace('HSK', 'HSK ')}`,
    glossCloseBtn: 'Close',
    glossQuickMeaning: 'Quick meaning:',
    glossContextMeaning: 'Meaning in context:',
    glossOtherMeaning: (pos, meaning) => `Other sense (${pos}): ${meaning}`,
    glossOtherReading: (pinyin, pos, meaning) => `Other reading (${pinyin}, ${pos}): ${meaning}`,
    glossProperNounBadge: 'Proper Noun',
    glossProperNounNote: 'In-world proper noun; excluded from HSK study list.',
    glossListenBtn: 'Listen',
    glossSaveBtn: 'Save Word',
    glossSavedBtn: 'Saved',
    touchBagBtn: 'Journal',
    touchActBtn: 'Act',
    touchMoveAria: (dir) => `Move ${dir}`,
    evoTitle: (fromName, toName, level) =>
      `Evolution! ${fromName} grew into ${toName} at Lv.${level}!`,
    evoSubtitle: (fromName, toName, titleLocal) =>
      `${fromName} evolved into ${toName} (${titleLocal}).`,
    evoDismissBtn: 'Celebrate',
    moveLearnedBannerTitle: (creatureName, moveName) =>
      `${creatureName} learned a new move: ${moveName}`,
    moveLearnedBannerBody: (moveDesc, replacedName) =>
      replacedName
        ? `${moveDesc} Replaced ${replacedName}. You can swap moves anytime in your Team tab.`
        : `${moveDesc} Added directly to active moves.`,
    moveLearnedManageBtn: 'Manage Moves',
    moveLearnedDismissBtn: 'Got It',
    lostModalTitle: 'Trail Orientation Helper',
    lostModalClose: 'Close',
    lostWhereYouAre: (regionName) => `Current Region: ${regionName}`,
    lostNextAction: 'Recommended next step:',
    lostTargetLabel: 'Tracked destination:',
    lostDirectionLabel: 'Shortest clear route:',
    lostHealAdvice: 'Your party is low on health. Visit the nearest campfire or use a Dew Tonic first.',
    lostEnableGuidanceBtn: 'Enable Full Guidance',
    lostTrackMainBtn: 'Track Main Story Quest',
    lostQuickGuideBtn: 'View 8-Step Quick Guide',
    lostHideQuickGuideBtn: 'Hide Quick Guide',
    lostRestartGuideBtn: 'Replay Step-by-Step Guide',
    hudArrivedBadge: 'Arrived',
    hudLockedBadge: 'Locked',
    hudUnreachableBadge: 'Path Blocked',
    creditsBtn: 'Licenses & Credits',
    creditsModalTitle: 'Licenses & Asset Attributions',
    creditsCloseBtn: 'Close',
    creditsVersionLine: (ver) => `Release Version: LingoWild v${ver} (Offline Web Edition)`,
    creditsLicenseSummary:
      'TypeScript source code, synthesized Web Audio, original bilingual dialogue and lexicon, and custom creature/companion sprites are licensed under MIT. Third-party open pixel art packs retain their original author licenses (CC0 1.0, CC-BY 3.0, and CC-BY 4.0).',
    creditsThirdPartyTitle: 'Third-party pixel art and open-source libraries:',
    creditsViewLicenseLink: 'Open LICENSE.txt',
    creditsViewCreditsLink: 'Open full CREDITS.md',
    onboardingHeader: (stepNum, total) => `Beginner Guide (${stepNum}/${total})`,
    onboardingSkipBtn: 'Skip Guide',
    onboardingSkipStepBtn: 'Skip Step',
    battleWildPrefix: (name) => `Wild ${name}`,
    battleFoePrefix: (name) => `Foe ${name}`,
    battleGleamingBadge: 'Gleaming',
    battleBondedBadge: 'Bonded',
    battleTurnHeader: (turn, title, role) => `Turn ${turn} | ${title} (${role})`,
    battleSpeedYouFirst: 'Speed: You act first',
    battleSpeedFoeFirst: 'Speed: Foe acts first',
    battleRiskBadge: 'Risk: Foe has 1.5x advantage',
    battleSpeedLabels: {
      normal: 'Pace: 1x',
      fast: 'Pace: 2x Fast',
      instant: 'Pace: Instant',
    },
    battleContinueBtn: 'Continue Expedition (Space)',
    battleTabMoves: 'Moves',
    battleTabBagWild: (pct) => (pct > 0 ? `Chimes & Bag (~${pct}%)` : 'Chimes & Bag'),
    battleTabBagPlain: 'Bag',
    battleTabTeam: (count, suggestSwitch) =>
      suggestSwitch ? `Team (${count}) [Switch Tip]` : `Team (${count})`,
    battleTabTactics: 'Observe & Flee',
    battleSupportTag: 'Support',
    battleEffectiveTag: '1.5x Effective',
    battleResistedTag: '0.67x Resisted',
    battleRecommendedTag: 'Recommended',
    battleKoRiskTag: 'KO Risk',
    battleNoItems: 'No battle items remaining in bag.',
    battleBondEstimate: (pct) => ` | Bond ~${pct}%`,
    battleBondGuaranteed: ' | Guaranteed 100%',
    battleCountersFoe: 'Counters Foe',
    battleObserveBtn: 'Observe Habits (Field Note)',
    battleFleeBtn: 'Step Back Safely (Flee)',
    battleAssistTitle: 'Tactical Tip:',
    battleLowHpAlert: (cur, max) =>
      `Low health (${cur}/${max}). Open Bag to use a Dew Tonic or switch to a healthy partner.`,
    battleSwitchTip: (partnerName, elName) =>
      `Switch tip: ${partnerName} (${elName}) has a type advantage here.`,
    battleCaptureReadyTip: (pct, guaranteed) =>
      guaranteed
        ? 'Great moment! Open Chimes & Bag and throw a Moss Charm for a guaranteed first bond.'
        : `Ready to bond! Open Chimes & Bag to throw a chime (~${pct}% chance).`,
    battleCaptureWeakenTip: (pct) =>
      `Lower the wild creature health first to raise bonding odds (currently ~${pct}%).`,
    battleElementExplain: (moveEl, foeEl, mult) =>
      mult > 1.05
        ? `${moveEl} counters ${foeEl} for 1.5x damage.`
        : mult < 0.95
          ? `${foeEl} resists ${moveEl} (0.67x damage).`
          : `${moveEl} deals standard damage to ${foeEl}.`,
    bossWarningBanner: (bossName, teamMaxLv, recLv, needsHeal, needsTonics, counterElementsText) => {
      const parts: string[] = [
        `Prep before ${bossName}: highest partner is Lv.${teamMaxLv} (recommended Lv.${recLv}+)`,
      ];
      if (counterElementsText) {
        parts.push(`bring ${counterElementsText} partners`);
      }
      if (needsHeal) {
        parts.push('heal at the nearest campfire first');
      }
      if (needsTonics) {
        parts.push('carry at least 2 healing tonics');
      }
      return `${parts.join('; ')}.`;
    },
    journalHeader: (caught, tokens) => `Field Journal | Bonded: ${caught}/30 | Tokens: ${tokens}`,
    journalCloseBtn: 'Close (Esc)',
    journalTabs: {
      quests: 'Quests',
      map: 'Basin Map',
      team: 'Team',
      bag: 'Bag',
      compendium: 'Wildkin (30)',
      lexicon: 'Lexicon',
      settings: 'Settings & Save',
    },
    questMasteryTitle: 'Expedition & Post-Game Mastery',
    questMasteryStats: (traces, secrets, rematches, gleaming, lore) =>
      `Habitat Traces: ${traces}/4 | Secret Caches: ${secrets}/4 | Warden Rematches: ${rematches}/4 | Gleaming: ${gleaming} | Notes Read: ${lore}`,
    questMainTag: '[Main] ',
    questFieldTag: '[Field] ',
    questActiveBadge: 'Active',
    questDoneBadge: 'Completed',
    questTrackingBadge: 'Guiding',
    questTrackBtn: 'Guide Me',
    questFieldWhat: 'Next action:',
    questFieldTarget: 'Find:',
    questFieldRegion: 'Region:',
    questFieldProgress: 'Progress:',
    questFieldUnmet: 'Requirement:',
    questFieldPrep: 'Recommended prep:',
    mapIntro: 'Verdant Basin Regional Atlas showing all five interconnected regions.',
    mapDirections: {
      north: 'North Summit',
      west: 'West Woodland',
      center: 'Central Village',
      east: 'East Wetland',
      south: 'South Canyon',
    },
    mapHereBadge: (x, y) => `Here (${x},${y})`,
    mapGatedBadge: 'Gated',
    mapResonantBadge: 'Resonant',
    mapHabitatsInfo: (speciesCount, traceFound) =>
      `Wild habitats: ${speciesCount} species | Trace: ${traceFound ? 'Logged' : 'Unchecked'}`,
    teamHeader: (count) => `Active Expedition Team (${count}/6) | Lead walks behind you`,
    teamLeadTag: '[Lead] ',
    teamFinalForm: ' | Final Form',
    teamEvolvesHint: (level, nextName) => ` | Evolves Lv.${level} -> ${nextName}`,
    teamStatsLine: (hp, maxHp, atk, def, spd) =>
      `HP ${hp}/${maxHp} | ATK ${atk} DEF ${def} SPD ${spd}`,
    teamMakeLeadBtn: 'Make Lead',
    teamUseTonicBtn: 'Use Dew Tonic',
    teamManageMovesBtn: 'Moves',
    teamCloseMovesBtn: 'Hide Moves',
    teamMoveGuideIntro:
      'Each partner holds up to 4 active moves. Keep strong elemental attacks paired with 1 support or sleep move for bonding.',
    teamActiveMovesTitle: 'Equipped moves (4 slots):',
    teamAvailableMovesTitle: 'Unlocked moves you can swap in:',
    teamReplaceSlotLabel: (slotNum, moveName) => `Replace slot ${slotNum} (${moveName})`,
    teamReserveHeader: (count) => `Sanctuary Reserve (${count} partners)`,
    teamSwapReserveBtn: 'Swap with Last Slot',
    bagUseBtn: 'Use',
    bagEmpty: 'Your bag is currently empty.',
    compendiumStats: (discovered, bonded, gleaming) =>
      `Discovered: ${discovered}/30 | Bonded: ${bonded}/30 | Gleaming: ${gleaming}/30`,
    compendiumUncharted: (dex) => `#${dex} Uncharted Wildkin`,
    compendiumHabitat: (names) => `Habitat: ${names}`,
    compendiumActiveTime: (times) => `Active time: ${times}`,
    compendiumBondedTag: '[Bonded]',
    compendiumSightedTag: '[Sighted]',
    compendiumEvoLine: (level, nextName) => `Evolution: Lv.${level} -> ${nextName}`,
    compendiumReadStoryBtn: 'Read Field Story',
    compendiumUnlockHint: (names) => `Habitat: ${names} (Bond with a chime to unlock ecological notes)`,
    lexiconFilters: {
      encountered: (n) => `Encountered (${n})`,
      saved: (n) => `Saved (${n})`,
      mastered: (n) => `Mastered (${n})`,
      due: (n) => `Due Now (${n})`,
      all: (n) => `All (${n})`,
      dispatches: (n) => `Field Advisories (${n})`,
    },
    lexiconReadTag: '[Read] ',
    lexiconUnreadTag: '[Unread] ',
    lexiconReadNoteBtn: 'Read Note',
    lexiconEmpty: 'No entries match this filter yet. Explore trails and chat with Rangers naturally.',
    lexiconStatsLine: (exp, lookups, mastery) =>
      `Encountered ${exp}x | Lookups ${lookups}x | Mastery ${mastery}/3`,
    lexiconListenBtn: 'Listen',
    lexiconSaveBtn: 'Save',
    lexiconSavedBtn: 'Saved',
    lexiconNotebookEn: 'English Notebook',
    lexiconNotebookZh: 'Chinese Notebook (HSK)',
    campZhPromptHanziToVi: 'Choose the Vietnamese meaning for this Chinese word:',
    campZhPromptHanziToPinyin: 'Choose the correct Pinyin for this Chinese word:',
    campZhPromptListenToHanzi: 'Listen or read the Pinyin, then pick the matching Hanzi:',
    campZhListenBtn: 'Listen in Mandarin',
    settingsBattleSpeedLabel: 'Battle animation pace:',
    settingsBattleSpeedOptions: {
      normal: 'Normal (1x)',
      fast: 'Fast (2x)',
      instant: 'Instant',
    },
    settingsTouchLabel: 'Touch D-pad controls:',
    settingsTouchOptions: {
      auto: 'Auto on touch devices',
      always: 'Always show',
      off: 'Hidden',
    },
    settingsTextScaleLabel: 'Text size:',
    settingsTextScaleOptions: {
      normal: 'Normal',
      large: 'Large readable text',
    },
    settingsBattleAssistLabel: 'Show tactical recommendations and battle alerts:',
    settingsShowFollowerLabel: 'Show lead companion walking behind you:',
    settingsHighContrastLabel: 'High contrast mode:',
    settingsReducedMotionLabel: 'Reduced motion:',
    settingsMuteLabel: 'Mute all audio:',
    settingsBgmLabel: 'Music volume',
    settingsSfxLabel: 'Effects volume',
    settingsKeyMapHeader: 'Keyboard remap',
    settingsKeyLabels: {
      up: 'Up',
      down: 'Down',
      left: 'Left',
      right: 'Right',
      interact: 'Interact',
      journal: 'Journal',
    },
    settingsPressKey: (label) => `Press key for ${label}...`,
    settingsSaveHeader: 'Save and backup',
    settingsMultiTabWarning:
      'Newer progress was saved in another browser tab. Sync first before overwriting.',
    settingsSaveNowBtn: 'Save Progress Now',
    settingsExportBtn: 'Export Save (.json)',
    settingsImportBtn: 'Import Save (.json)',
    settingsSyncTabBtn: 'Sync Newer Tab Save',
    settingsTutorialHeader: 'Beginner guide',
    settingsRestartTutorialBtn: 'Restart Beginner Guide',
    settingsSkipTutorialBtn: 'Hide Beginner Guide',
    supplyHeader: (tokens) => `Expedition Supply Post | Tokens: ${tokens}`,
    supplyCloseBtn: 'Close',
    supplyPriceOwned: (price, owned) => `${price} Tokens (Bag: ${owned})`,
    supplyBuyBtn: 'Exchange 1x',
    campHeader: 'Campfire Word Practice (Optional, no penalty)',
    campSkipBtn: 'Finish Anytime',
    campEmpty: 'No words queued yet. Read signs and talk to Rangers first.',
    campCardCounter: (cur, total, due) =>
      `Card ${cur} of ${total} | ${due ? 'Due for Re-encounter' : 'Optional Warm-up'}`,
    campNextBtn: 'Next Card',
    campFeedbackCorrect: (word, meaning, sentenceVi) =>
      `Correct! "${word}" means "${meaning}". (${sentenceVi})`,
    campFeedbackGentle: (word, meaning, sentenceVi) =>
      `Gentle reminder: "${word}" means "${meaning}". (${sentenceVi})`,
    endingHeader: 'Verdant Basin Harmony Restored',
    endingLead:
      'All four Resonance Stones sing together beneath Starfall Sanctuary. Thank you for exploring Verdant Basin!',
    endingSub:
      'Post-game mastery is now unlocked: challenge all four Wardens to mastery rematches, track gleaming variants, and bond with all 30 species.',
    endingStats: (steps, caught, questsDone, questsTotal, rematches, wordsSeen, wordsMastered) =>
      `Steps: ${steps} | Bonded: ${caught}/30 | Quests: ${questsDone}/${questsTotal} | Warden Rematches: ${rematches}/4 | Words Seen: ${wordsSeen} (Mastered: ${wordsMastered})`,
    endingContinueBtn: 'Continue Post-Game Exploration',
    minimapTitle: 'Minimap',
  },
};

export function getUiStrings(lang: UiLanguage | undefined): UiCatalog {
  return UI_STRINGS[lang === 'en' ? 'en' : 'vi'];
}

export function pickText(lang: UiLanguage | undefined, en: string, vi: string): string {
  return lang === 'en' ? en : vi;
}

export function syncSupportModeFromContent(content: ContentLanguageMode): LanguageSupportMode {
  if (content === 'en_immersion') return 'immersion';
  if (content === 'en_assist') return 'contextual';
  return 'bilingual';
}

export function inferContentLanguageFromSupport(
  support: LanguageSupportMode | undefined,
): ContentLanguageMode {
  if (support === 'immersion') return 'en_immersion';
  if (support === 'contextual') return 'en_assist';
  return 'bilingual';
}

const POS_VI_MAP: Readonly<Record<string, string>> = {
  noun: 'danh từ',
  verb: 'động từ',
  adj: 'tính từ',
  adjective: 'tính từ',
  adv: 'trạng từ',
  adverb: 'trạng từ',
  prep: 'giới từ',
  phrase: 'cụm từ',
  interj: 'thán từ',
  conj: 'liên từ',
  mw: 'lượng từ',
  pron: 'đại từ',
  num: 'số từ',
  part: 'trợ từ',
};

export function localizePos(pos: string, lang: UiLanguage | undefined): string {
  if (lang === 'en') return pos;
  return POS_VI_MAP[pos.toLowerCase()] ?? pos;
}

const SPEAKER_EXACT_VI: Readonly<Record<string, string>> = {
  'Ancient Kiln Tablet': 'Bia lò gốm cổ',
  'Basin Atlas Note': 'Ghi chép bản đồ thung lũng',
  'Basin Trail Signpost': 'Biển chỉ đường Thung lũng',
  'Campfire Rest': 'Nghỉ chân bên lửa trại',
  'Canyon Crest Overlook': 'Đài ngắm đỉnh hẻm núi',
  'Canyon Rope Station': 'Trạm dây thừng hẻm núi',
  'Canyon Wind Warning Sign': 'Biển cảnh báo gió hẻm núi',
  'Celestial Harmony Altar': 'Đàn Hòa Âm Ánh Sao',
  'Celestial Terrace Overlook': 'Đài ngắm sân thềm ánh sao',
  'East Star Pillar': 'Cột đá sao phía Đông',
  'Epigraphy Summary': 'Tổng hợp văn bia cổ',
  'Expedition Supply Counter': 'Quầy tiếp tế thám hiểm',
  'Fen Waterway Guide': 'Chỉ dẫn luồng nước đầm lầy',
  'Fern Glade Overlook': 'Đài ngắm trảng dương xỉ',
  'Ferry Gatekeeper Sign': 'Biển cổng bến đò',
  'Field Expedition Chronicle': 'Biên niên thám hiểm thực địa',
  'Glen Clearing Campfire': 'Lửa trại bãi trống rừng',
  'Hollow Trunk Clue': 'Manh mối thân cây rỗng',
  'Lantern Pier Campfire': 'Lửa trại bến đèn lồng',
  'Lotus Basin Overlook': 'Đài ngắm hồ sen',
  'Misty Channel Lantern Post': 'Cột đèn kênh sương',
  'Mosslight Campfire': 'Lửa trại Trại Đèn Rêu',
  'North Harmony Stele': 'Bia Hòa Âm phía Bắc',
  'Rowan Field Board': 'Bảng thực địa của Rowan',
  'Sanctuary Seal Arch': 'Cổng phong ấn thánh địa',
  'South Brook Overlook': 'Đài ngắm suối phía Nam',
  'Starlight Brazier': 'Đài lửa ánh sao',
  'Sunforge Resonance Beacon': 'Đài cộng hưởng Lò Mặt Trời',
  'Sunken Tide Arch': 'Cổng Thủy Triều Chìm',
  'Trail Etiquette Card': 'Thẻ quy tắc đường mòn',
  'Trail Notice': 'Thông báo đường mòn',
  'West Star Pillar': 'Cột đá sao phía Tây',
  'Wetland Acoustic Note': 'Ghi chép âm thanh đầm lầy',
  'Whispering Oak Stone': 'Đá Sồi Thì Thầm',
  'Whisperwood Ranger Notice': 'Thông báo Kiểm lâm Rừng Thầm',
  'Windbreak Campfire': 'Lửa trại chắn gió',
  'Habitat Trace: Whisperwood': 'Dấu vết sinh cảnh: Rừng Thầm',
  'Habitat Trace: Reedwater': 'Dấu vết sinh cảnh: Đầm Sậy',
  'Habitat Trace: Terracotta': 'Dấu vết sinh cảnh: Đèo Gốm Đỏ',
  'Habitat Trace: Starfall': 'Dấu vết sinh cảnh: Thánh Địa Sao Rơi',
};

const SPEAKER_PREFIX_VI: ReadonlyArray<readonly [string, string]> = [
  ['Elder Keeper ', 'Trưởng lão '],
  ['Ranger ', 'Kiểm lâm '],
  ['Scout ', 'Trinh sát '],
  ['Botanist ', 'Nhà thực vật '],
  ['Quartermaster ', 'Quản kho '],
  ['Woodcarver ', 'Thợ chạm gỗ '],
  ['Warden ', 'Thủ lĩnh '],
  ['Ferrywoman ', 'Người lái đò '],
  ['Angler ', 'Người câu cá '],
  ['Potter ', 'Nghệ nhân gốm '],
  ['Mountaineer ', 'Người leo núi '],
  ['Archivist ', 'Người lưu trữ '],
  ['Starwatcher ', 'Người ngắm sao '],
  ['Field Study ', 'Hồ sơ thực địa '],
  ['Field Advisory ', 'Lưu ý thực địa '],
  ['Expedition Tale: ', 'Chuyện thám hiểm: '],
  ['Camp Logbook: Entry ', 'Nhật ký trại: Mục '],
  ['Woodland Logbook: Entry ', 'Nhật ký rừng: Mục '],
  ['Wetland Logbook: Entry ', 'Nhật ký đầm lầy: Mục '],
  ['Canyon Logbook: Entry ', 'Nhật ký hẻm núi: Mục '],
  ['Observatory Chronicle: Entry ', 'Biên niên đài quan sát: Mục '],
  ['Artisan Note: ', 'Ghi chú chế tác: '],
  ['Greenhouse Note: ', 'Ghi chú nhà kính: '],
  ['History Note: ', 'Ghi chú lịch sử: '],
  ['Naturalist Note: ', 'Ghi chú tự nhiên: '],
  ['Pottery Craft Note', 'Ghi chú nghề gốm'],
  ['Ranger Note: ', 'Ghi chú kiểm lâm: '],
  ['Scout Gear Note: ', 'Ghi chú trang bị trinh sát: '],
];

export function localizeSpeakerName(speaker: string, lang: UiLanguage | undefined): string {
  if (lang === 'en') return speaker;
  const exact = SPEAKER_EXACT_VI[speaker];
  if (exact) return exact;
  for (const [prefix, viPrefix] of SPEAKER_PREFIX_VI) {
    if (speaker.startsWith(prefix)) {
      return `${viPrefix}${speaker.slice(prefix.length)}`;
    }
  }
  return speaker;
}

export function localizeSaveNotice(raw: string, lang: UiLanguage | undefined): string {
  if (!raw || lang === 'en') return raw;
  const lower = raw.toLowerCase();
  if (lower.includes('checksum')) return 'Mã kiểm tra tệp lưu không khớp (tệp đã bị sửa hoặc hỏng).';
  if (lower.includes('oversized') || lower.includes('too large') || lower.includes('max size')) {
    return 'Tệp lưu vượt quá dung lượng cho phép.';
  }
  if (lower.includes('invalid json') || lower.includes('unexpected token')) {
    return 'Tệp lưu không đúng định dạng JSON.';
  }
  if (lower.includes('invalid save') || lower.includes('invalid game state') || lower.includes('invalid state')) {
    return 'Cấu trúc dữ liệu bên trong tệp lưu không hợp lệ.';
  }
  if (lower.includes('newer') && lower.includes('tab')) {
    return 'Đã phát hiện bản lưu mới hơn ở thẻ trình duyệt khác.';
  }
  if (lower.includes('primary save was damaged') || lower.includes('restored clean backup')) {
    return 'Bản lưu chính gặp lỗi và đã được khôi phục tự động từ bản sao lưu an toàn.';
  }
  if (lower.includes('primary save missing')) {
    return 'Không thấy bản lưu chính; đã khôi phục tự động từ bản sao lưu.';
  }
  if (lower.includes('storage nearly full')) {
    return 'Bộ nhớ trình duyệt sắp đầy; hệ thống đã ưu tiên bảo toàn bản lưu chính.';
  }
  if (lower.includes('loaded newer in-memory')) {
    return 'Đã nạp tiến trình mới hơn từ bộ nhớ phiên hiện tại.';
  }
  if (lower.includes('unreadable')) {
    return 'Dữ liệu lưu cũ không thể đọc được. Bắt đầu phiên mới và giữ nguyên bản dự phòng.';
  }
  return raw;
}

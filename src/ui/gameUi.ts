import { MAPS_BY_ID } from '../data/maps.ts';
import { MOVES_BY_ID } from '../data/moves.ts';
import { NPCS } from '../data/npcs.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import { resolveChineseSenseForContext } from '../domain/chinese.ts';
import { ELEMENT_LABELS } from '../domain/elements.ts';
import {
  getUiStrings,
  localizePos,
  localizeSaveNotice,
  localizeSpeakerName,
  pickText,
} from '../domain/i18n.ts';
import { pickIndependentExample, resolveSenseForContext } from '../domain/learning.ts';
import { getNpcQuestMarker, isPortalUnlocked } from '../domain/navigation.ts';
import type {
  CefrBand,
  ContentLanguageMode,
  DifficultyMode,
  Direction,
  HskLevel,
  LearningLanguage,
  PinyinPosition,
  UiLanguage,
  ZhStudyMode,
} from '../domain/types.ts';
import { getTileAt } from '../domain/world.ts';
import { APP_VERSION, type GameController } from '../game/controller.ts';
import { buildBattleView, type BattleDeckTab } from './battleView.ts';
import {
  buildCampReviewModal,
  buildCreditsModal,
  buildEndingBannerModal,
  buildJournalModal,
  buildLostHelperModal,
  buildSupplyPostModal,
  type JournalViewState,
} from './journalView.ts';
import {
  createCreatureSpriteSpan,
  el,
  renderInteractiveChinese,
  renderInteractiveEnglish,
} from './uiHelpers.ts';

const DPAD_ARROW_SVG: Readonly<Record<Direction, string>> = {
  up: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 5l7 8h-4v6H9v-6H5z"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 19l-7-8h4V5h6v6h4z"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M5 12l8-7v4h6v6h-6v4z"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M19 12l-8 7v-4H5V9h6V5z"/></svg>',
};

const COMPASS_ARROW_SVG: Readonly<Record<Direction, string>> = {
  up: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M8 2l5 6H9.5v6h-3V8H3z"/></svg>',
  down: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M8 14l-5-6h3.5V2h3v6H13z"/></svg>',
  left: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M2 8l6-5v3.5h6v3H8V13z"/></svg>',
  right: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M14 8l-6 5V9.5H2v-3h6V3z"/></svg>',
};

export class GameUiRenderer {
  private readonly rootEl: HTMLElement;
  private readonly overlayEl: HTMLElement;
  private readonly controller: GameController;
  private battleTab: BattleDeckTab = 'moves';
  private wasInBattle = false;
  private skipTutorialOnTitle = false;
  private heldTouchDir: Direction | null = null;
  private activeTouchPointerId: number | null = null;
  private lastPointerStepAt = -9999;
  private overworldShellMounted = false;
  private owTopSlot: HTMLElement | null = null;
  private owMinimapSlot: HTMLElement | null = null;
  private owMinimapCanvas: HTMLCanvasElement | null = null;
  private owNearbySlot: HTMLElement | null = null;
  private owTouchSlot: HTMLElement | null = null;
  private owTouchUiLang: UiLanguage | null = null;
  private owLastNearbySig = '';
  private minimapTerrainCache = new Map<string, HTMLCanvasElement>();
  private readonly journalState: JournalViewState = {
    lexiconFilter: 'encountered',
    campAnsweredCurrent: false,
    campAnsweredMessageVi: '',
    awaitingKeyRebind: null,
    managingMovesPartyIndex: null,
  };

  public constructor(rootEl: HTMLElement, overlayEl: HTMLElement, controller: GameController) {
    this.rootEl = rootEl;
    this.overlayEl = overlayEl;
    this.controller = controller;

    this.bindKeyboardAndPointerControls();
    this.controller.subscribe(() => {
      this.render();
    });
    this.render();
  }

  private resolveDirectionForKeyCode(code: string): Direction | null {
    const km = this.controller.state.settings.keyMap;
    if (code === km.up) return 'up';
    if (code === km.down) return 'down';
    if (code === km.left) return 'left';
    if (code === km.right) return 'right';
    if (code === km.interact || code === km.cancel || code === km.journal) return null;
    if (code === 'KeyW' || code === 'ArrowUp') return 'up';
    if (code === 'KeyS' || code === 'ArrowDown') return 'down';
    if (code === 'KeyA' || code === 'ArrowLeft') return 'left';
    if (code === 'KeyD' || code === 'ArrowRight') return 'right';
    return null;
  }

  private updateTouchButtonActiveVisuals(): void {
    if (!this.owTouchSlot) return;
    const buttons = this.owTouchSlot.querySelectorAll<HTMLButtonElement>('.lw-dpad-btn');
    for (const btn of buttons) {
      const dir = btn.dataset.dir;
      btn.dataset.active = String(Boolean(dir && this.heldTouchDir === dir));
    }
  }

  private startTouchMove(dir: Direction, pointerId: number): void {
    if (this.heldTouchDir && this.heldTouchDir !== dir) {
      this.controller.releaseMoveInput(`touch:${this.heldTouchDir}`);
    }
    this.heldTouchDir = dir;
    this.activeTouchPointerId = pointerId;
    this.lastPointerStepAt = performance.now();
    this.controller.pressMoveInput(`touch:${dir}`, dir);
    this.updateTouchButtonActiveVisuals();
  }

  private stopTouchMove(pointerId?: number): void {
    if (pointerId !== undefined && this.activeTouchPointerId !== null && pointerId !== this.activeTouchPointerId) {
      return;
    }
    if (this.heldTouchDir) {
      this.controller.releaseMoveInput(`touch:${this.heldTouchDir}`);
      this.heldTouchDir = null;
    }
    this.activeTouchPointerId = null;
    this.updateTouchButtonActiveVisuals();
  }

  private bindKeyboardAndPointerControls(): void {
    window.addEventListener('pointerup', (e) => this.stopTouchMove(e.pointerId));
    window.addEventListener('pointercancel', (e) => this.stopTouchMove(e.pointerId));
    window.addEventListener('blur', () => {
      this.stopTouchMove();
      this.controller.cancelMovementInputs('blur');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopTouchMove();
        this.controller.cancelMovementInputs('blur');
      }
    });

    window.addEventListener('keyup', (ev) => {
      if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
        this.controller.setSprintInput(false);
        return;
      }
      this.controller.releaseMoveInput(`key:${ev.code}`);
    });

    window.addEventListener('keydown', (ev) => {
      if (this.journalState.awaitingKeyRebind) {
        ev.preventDefault();
        const keyField = this.journalState.awaitingKeyRebind;
        this.journalState.awaitingKeyRebind = null;
        this.controller.updateSettings({
          keyMap: {
            ...this.controller.state.settings.keyMap,
            [keyField]: ev.code,
          },
        });
        return;
      }

      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      const km = this.controller.state.settings.keyMap;
      const code = ev.code;

      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        this.controller.setSprintInput(true);
        return;
      }

      if (code === km.cancel || code === 'Escape') {
        if (
          this.controller.activeGlossEntry ||
          this.controller.activePocketGloss ||
          this.controller.activeZhGlossEntry ||
          this.controller.activeZhProperGloss
        ) {
          ev.preventDefault();
          this.controller.closeGlossPopup();
          return;
        }
        if (this.controller.activeEvolution) {
          ev.preventDefault();
          this.controller.dismissEvolutionBanner();
          return;
        }
        if (this.controller.activeMoveLearnBanner) {
          ev.preventDefault();
          this.controller.dismissMoveLearnBanner();
          return;
        }
        if (this.controller.activeModal !== 'none' && this.controller.activeModal !== 'title') {
          ev.preventDefault();
          this.controller.closeModal();
          return;
        }
      }

      if (code === km.journal) {
        if (this.controller.activeModal === 'journal') {
          ev.preventDefault();
          this.controller.closeModal();
          return;
        }
        if (this.controller.activeModal === 'none' && !this.controller.activeBattle) {
          ev.preventDefault();
          this.controller.openJournal('quests');
          return;
        }
      }

      if (code === 'KeyM' && this.controller.activeModal === 'none' && !this.controller.activeBattle) {
        ev.preventDefault();
        this.controller.openJournal('map');
        return;
      }

      if (
        this.controller.activeBattle &&
        this.controller.activeBattle.outcome === 'ongoing' &&
        this.controller.activeModal === 'none' &&
        this.battleTab === 'moves'
      ) {
        const moveIdx =
          code === 'Digit1'
            ? 0
            : code === 'Digit2'
              ? 1
              : code === 'Digit3'
                ? 2
                : code === 'Digit4'
                  ? 3
                  : -1;
        const activePlayer =
          this.controller.activeBattle.playerParty[this.controller.activeBattle.activePlayerIndex];
        if (moveIdx >= 0 && activePlayer && moveIdx < activePlayer.moves.length) {
          ev.preventDefault();
          this.controller.submitBattleAction({ kind: 'move', moveIndex: moveIdx });
          return;
        }
      }

      if (code === km.interact || code === 'Enter') {
        if (this.controller.activeBattle && this.controller.activeBattle.outcome !== 'ongoing') {
          ev.preventDefault();
          this.controller.finishAndCloseBattle();
          return;
        }
        if (this.controller.activeDialogue) {
          const activeTag = (document.activeElement as HTMLElement | null)?.classList;
          if (activeTag?.contains('word-token') || activeTag?.contains('lw-btn')) {
            return;
          }
          ev.preventDefault();
          this.controller.advanceDialogue();
          return;
        }
        if (this.controller.activeModal === 'none' && !this.controller.activeBattle) {
          ev.preventDefault();
          this.controller.cancelMovementInputs('manual');
          this.controller.interactFacing();
          return;
        }
      }

      const dir = this.resolveDirectionForKeyCode(code);
      if (
        dir &&
        this.controller.activeModal === 'none' &&
        !this.controller.activeBattle &&
        !this.controller.activeDialogue
      ) {
        ev.preventDefault();
        // Ignore OS key-repeat events! Continuous movement is driven smoothly by MovementCoordinator.tick(delta).
        if (ev.repeat) {
          return;
        }
        this.controller.pressMoveInput(`key:${code}`, dir);
      }
    });
  }

  private resetOverworldShell(): void {
    this.overworldShellMounted = false;
    this.owTopSlot = null;
    this.owMinimapSlot = null;
    this.owMinimapCanvas = null;
    this.owNearbySlot = null;
    this.owTouchSlot = null;
    this.owTouchUiLang = null;
    this.owLastNearbySig = '';
  }

  private renderPureOverworldIncremental(): void {
    const { settings } = this.controller.state;
    const uiLang: UiLanguage = settings.uiLanguage === 'en' ? 'en' : 'vi';
    const guidance = settings.guidanceMode ?? 'full';

    if (!this.overworldShellMounted) {
      this.overlayEl.replaceChildren();
      this.owTopSlot = el('div', 'lw-top-bar-group');
      this.owMinimapSlot = el('div', '');
      this.owMinimapCanvas = null;

      const bottomStack = el('div', 'lw-bottom-stack');
      this.owNearbySlot = el('div', '');
      this.owTouchSlot = this.buildTouchPad();
      this.owTouchUiLang = uiLang;
      this.owLastNearbySig = '';
      bottomStack.append(this.owNearbySlot, this.owTouchSlot);

      this.overlayEl.append(this.owTopSlot, this.owMinimapSlot, bottomStack);
      this.overworldShellMounted = true;
    }

    // 1. Update top HUD & transient banners
    if (this.owTopSlot) {
      this.owTopSlot.replaceChildren();
      this.owTopSlot.appendChild(this.buildTopHud());
      if (this.controller.activeEvolution) {
        this.owTopSlot.appendChild(this.buildEvolutionBanner());
      } else if (this.controller.activeMoveLearnBanner) {
        this.owTopSlot.appendChild(this.buildMoveLearnBanner());
      } else if (this.controller.toasts.length > 0) {
        this.owTopSlot.appendChild(this.buildToastStack());
      }
      if (this.controller.activeOnboardingPrompt) {
        this.owTopSlot.appendChild(this.buildOnboardingStrip());
      }
    }

    // 2. Incrementally redraw minimap using cached region terrain canvas (zero DOM teardown!)
    if (this.owMinimapSlot) {
      if (guidance === 'full') {
        if (!this.owMinimapCanvas || !this.owMinimapSlot.firstChild) {
          const widget = this.buildMinimapWidget();
          this.owMinimapCanvas = widget.querySelector('canvas');
          this.owMinimapSlot.replaceChildren(widget);
        } else {
          this.paintMinimapCanvas(this.owMinimapCanvas);
        }
      } else if (this.owMinimapSlot.firstChild) {
        this.owMinimapSlot.replaceChildren();
        this.owMinimapCanvas = null;
      }
    }

    // 3. Patch nearby interactable pill ONLY when target or highlight state changes
    if (this.owNearbySlot) {
      const nearby = guidance !== 'off' ? this.controller.navigationPlan.nearbyInteractable : null;
      const highlight =
        this.controller.activeOnboardingPrompt?.highlightButtonTestId === 'btn-nearby-interact';
      const sig = `${uiLang}|${nearby?.id ?? ''}|${highlight}|${settings.touchControls}`;
      if (sig !== this.owLastNearbySig) {
        this.owLastNearbySig = sig;
        this.owNearbySlot.replaceChildren();
        if (nearby) {
          this.owNearbySlot.appendChild(this.buildNearbyPromptBar());
        }
      }
    }

    // 4. Keep touch D-pad permanently mounted during walking so touch hold pointer events NEVER drop!
    if (this.owTouchSlot && this.owTouchUiLang !== uiLang) {
      const parent = this.owTouchSlot.parentElement;
      const replacement = this.buildTouchPad();
      if (parent) {
        parent.replaceChild(replacement, this.owTouchSlot);
      }
      this.owTouchSlot = replacement;
      this.owTouchUiLang = uiLang;
    }
    this.updateTouchButtonActiveVisuals();
  }

  public render(): void {
    const { settings } = this.controller.state;
    this.rootEl.dataset.highContrast = String(settings.highContrast);
    this.rootEl.dataset.reducedMotion = String(settings.reducedMotion);
    this.rootEl.dataset.textScale = settings.textScale;
    this.rootEl.dataset.touch = settings.touchControls;
    this.rootEl.dataset.uiLang = settings.uiLanguage === 'en' ? 'en' : 'vi';

    const locked =
      this.controller.activeModal !== 'none' ||
      this.controller.activeBattle !== null ||
      this.controller.activeDialogue !== null;

    if (locked) {
      this.stopTouchMove();
    }

    const inBattleNow = Boolean(this.controller.activeBattle);
    if (inBattleNow && !this.wasInBattle) {
      this.battleTab = 'moves';
    }
    this.wasInBattle = inBattleNow;

    // Fast-path incremental overworld rendering: avoids tearing down touch D-pad & minimap on every step!
    const hasGloss = Boolean(
      this.controller.activeGlossEntry ||
        this.controller.activePocketGloss ||
        this.controller.activeZhGlossEntry ||
        this.controller.activeZhProperGloss,
    );
    const isPureOverworld = !locked && !hasGloss;
    if (isPureOverworld) {
      this.renderPureOverworldIncremental();
      return;
    }

    this.resetOverworldShell();
    this.overlayEl.replaceChildren();

    if (this.controller.activeModal === 'title') {
      this.overlayEl.appendChild(this.buildTitleModal());
      return;
    }

    if (this.controller.activeModal === 'credits' && !this.controller.state.starterChosen && !this.controller.activeBattle) {
      this.overlayEl.appendChild(buildCreditsModal(this.controller));
      return;
    }

    if (this.controller.activeBattle) {
      this.overlayEl.appendChild(
        buildBattleView(this.controller, this.battleTab, (tab) => {
          this.battleTab = tab;
          this.render();
        }),
      );
    } else {
      const topGroup = el('div', 'lw-top-bar-group');
      topGroup.appendChild(this.buildTopHud());

      if (this.controller.activeEvolution) {
        topGroup.appendChild(this.buildEvolutionBanner());
      } else if (this.controller.activeMoveLearnBanner) {
        topGroup.appendChild(this.buildMoveLearnBanner());
      } else if (this.controller.toasts.length > 0) {
        topGroup.appendChild(this.buildToastStack());
      }

      if (
        this.controller.activeOnboardingPrompt &&
        this.controller.activeModal === 'none' &&
        !this.controller.activeDialogue
      ) {
        topGroup.appendChild(this.buildOnboardingStrip());
      }
      this.overlayEl.appendChild(topGroup);

      if (
        (settings.guidanceMode ?? 'full') === 'full' &&
        this.controller.activeModal === 'none' &&
        !this.controller.activeDialogue
      ) {
        this.overlayEl.appendChild(this.buildMinimapWidget());
      }

      if (this.controller.activeDialogue) {
        this.overlayEl.appendChild(this.buildDialogueBox());
      } else if (this.controller.activeModal === 'none') {
        const bottomStack = el('div', 'lw-bottom-stack');
        if (
          (settings.guidanceMode ?? 'full') !== 'off' &&
          this.controller.navigationPlan.nearbyInteractable
        ) {
          bottomStack.appendChild(this.buildNearbyPromptBar());
        }
        bottomStack.appendChild(this.buildTouchPad());
        this.overlayEl.appendChild(bottomStack);
      }
    }

    if (hasGloss) {
      this.overlayEl.appendChild(this.buildGlossSlip());
    }

    if (this.controller.activeModal === 'journal') {
      this.overlayEl.appendChild(
        buildJournalModal(this.controller, this.journalState, () => this.render()),
      );
    } else if (this.controller.activeModal === 'supply_post') {
      this.overlayEl.appendChild(buildSupplyPostModal(this.controller));
    } else if (this.controller.activeModal === 'camp_review') {
      this.overlayEl.appendChild(
        buildCampReviewModal(this.controller, this.journalState, () => this.render()),
      );
    } else if (this.controller.activeModal === 'ending_banner') {
      this.overlayEl.appendChild(buildEndingBannerModal(this.controller));
    } else if (this.controller.activeModal === 'lost_helper') {
      this.overlayEl.appendChild(buildLostHelperModal(this.controller));
    } else if (this.controller.activeModal === 'credits') {
      this.overlayEl.appendChild(buildCreditsModal(this.controller));
    }

    if (this.controller.activeBattle && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('lingowild:battle-ui-layout'));
    }
  }

  private buildTitleModal(): HTMLElement {
    const s = this.controller.state.settings;
    const uiLang: UiLanguage = s.uiLanguage === 'en' ? 'en' : 'vi';
    const contentLang = s.contentLanguage ?? 'bilingual';
    const difficulty = s.difficulty ?? 'relaxed';
    const t = getUiStrings(uiLang);

    const backdrop = el('div', 'lw-modal-backdrop lw-title-backdrop lw-interactive');
    const card = el('section', 'lw-notebook lw-title-card');

    const header = el('header', 'lw-notebook-header lw-title-banner');
    const titleWrap = el('div', '');
    titleWrap.appendChild(el('div', 'lw-title-kicker', t.appTagline));
    titleWrap.appendChild(el('strong', 'lw-title-heading', 'LingoWild'));
    header.appendChild(titleWrap);
    const badgeWrap = el('div', 'lw-hud-actions');
    const verBadge = el('span', 'lw-badge', `v${APP_VERSION}`);
    verBadge.setAttribute('data-testid', 'app-version-badge');
    badgeWrap.append(verBadge, el('span', 'lw-badge', t.offlineBadge));
    header.appendChild(badgeWrap);
    card.appendChild(header);

    const body = el('div', 'lw-notebook-body');

    const starterTrio = el('div', 'lw-starter-showcase');
    for (const [dex, id, name, elKey] of [
      [1, 'mosskit', 'Mosskit', 'leaf'],
      [4, 'kindlet', 'Kindlet', 'ember'],
      [7, 'ripplefin', 'Ripplefin', 'water'],
    ] as const) {
      const item = el('div', 'lw-starter-plaque');
      item.appendChild(createCreatureSpriteSpan(dex));
      item.appendChild(el('strong', '', name));
      const badge = el(
        'span',
        'lw-badge lw-badge-element',
        pickText(uiLang, ELEMENT_LABELS[elKey].en, ELEMENT_LABELS[elKey].vi),
      );
      badge.style.background = ELEMENT_LABELS[elKey].color;
      item.appendChild(badge);
      item.appendChild(el('span', 'lw-hud-quest', t.starterRoleSummary[id]));
      starterTrio.appendChild(item);
    }
    body.appendChild(starterTrio);

    body.appendChild(el('p', 'lw-title-desc', t.titleDesc));

    if (this.controller.statusNotice) {
      body.appendChild(
        el('p', 'lw-battle-log', localizeSaveNotice(this.controller.statusNotice, uiLang)),
      );
    }

    const prefsGrid = el('div', 'lw-title-prefs');
    const addPrefSelect = (
      label: string,
      current: string,
      options: ReadonlyArray<[string, string]>,
      testId: string,
      onChange: (val: string) => void,
    ) => {
      const row = el('div', 'lw-list-row');
      row.appendChild(el('span', '', label));
      const sel = document.createElement('select');
      sel.setAttribute('data-testid', testId);
      for (const [val, lbl] of options) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = lbl;
        opt.selected = current === val;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => onChange(sel.value));
      row.appendChild(sel);
      prefsGrid.appendChild(row);
    };

    const learningLang: LearningLanguage = s.learningLanguage ?? 'en';

    addPrefSelect(
      t.labelUiLanguage,
      uiLang,
      [
        ['vi', t.uiLanguageOptions.vi],
        ['en', t.uiLanguageOptions.en],
      ],
      'select-ui-language',
      (v) => this.controller.updateSettings({ uiLanguage: v as UiLanguage }),
    );

    addPrefSelect(
      t.labelLearningLanguage,
      learningLang,
      [
        ['en', t.learningLanguageOptions.en],
        ['zh', t.learningLanguageOptions.zh],
        ['none', t.learningLanguageOptions.none],
      ],
      'select-learning-language',
      (v) => this.controller.updateSettings({ learningLanguage: v as LearningLanguage }),
    );

    if (learningLang === 'en') {
      addPrefSelect(
        t.labelContentLanguage,
        contentLang,
        [
          ['vi_only', t.contentLanguageOptions.vi_only],
          ['bilingual', t.contentLanguageOptions.bilingual],
          ['en_assist', t.contentLanguageOptions.en_assist],
          ['en_immersion', t.contentLanguageOptions.en_immersion],
        ],
        'select-content-language',
        (v) => this.controller.updateSettings({ contentLanguage: v as ContentLanguageMode }),
      );

      if (contentLang !== 'vi_only') {
        addPrefSelect(
          t.labelEnglishBand,
          s.cefrBand,
          [
            ['A1', t.cefrOptions.A1],
            ['A2', t.cefrOptions.A2],
            ['B1', t.cefrOptions.B1],
            ['B2', t.cefrOptions.B2],
          ],
          'select-cefr-band',
          (v) => this.controller.updateSettings({ cefrBand: v as CefrBand }),
        );
      }
    } else if (learningLang === 'zh') {
      addPrefSelect(
        t.labelHskLevel,
        s.hskLevel ?? 'HSK2',
        [
          ['HSK1', t.hskOptions.HSK1],
          ['HSK2', t.hskOptions.HSK2],
          ['HSK3', t.hskOptions.HSK3],
        ],
        'select-hsk-level',
        (v) => this.controller.updateSettings({ hskLevel: v as HskLevel }),
      );

      addPrefSelect(
        t.labelZhStudyMode,
        s.zhStudyMode ?? 'hanzi_pinyin_vi',
        [
          ['hanzi_pinyin_vi', t.zhStudyModeOptions.hanzi_pinyin_vi],
          ['hanzi_pinyin', t.zhStudyModeOptions.hanzi_pinyin],
          ['hanzi_assist', t.zhStudyModeOptions.hanzi_assist],
          ['zh_immersion', t.zhStudyModeOptions.zh_immersion],
          ['vi_only', t.zhStudyModeOptions.vi_only],
        ],
        'select-zh-study-mode',
        (v) => this.controller.updateSettings({ zhStudyMode: v as ZhStudyMode }),
      );

      addPrefSelect(
        t.labelPinyinPosition,
        s.pinyinPosition ?? 'above',
        [
          ['above', t.pinyinPositionOptions.above],
          ['below', t.pinyinPositionOptions.below],
        ],
        'select-pinyin-position',
        (v) => this.controller.updateSettings({ pinyinPosition: v as PinyinPosition }),
      );
    }

    addPrefSelect(
      t.labelDifficulty,
      difficulty,
      [
        ['relaxed', t.difficultyOptions.relaxed],
        ['adventure', t.difficultyOptions.adventure],
        ['challenge', t.difficultyOptions.challenge],
      ],
      'select-difficulty',
      (v) => this.controller.updateSettings({ difficulty: v as DifficultyMode }),
    );

    const diffHint = el('div', 'lw-hud-quest', t.difficultyDescriptions[difficulty]);
    diffHint.style.padding = '4px 8px';
    prefsGrid.appendChild(diffHint);

    const skipRow = el('label', 'lw-list-row lw-checkbox-label');
    const skipInput = document.createElement('input');
    skipInput.type = 'checkbox';
    skipInput.checked = this.skipTutorialOnTitle;
    skipInput.setAttribute('data-testid', 'checkbox-skip-tutorial');
    skipInput.addEventListener('change', () => {
      this.skipTutorialOnTitle = skipInput.checked;
    });
    skipRow.append(el('span', '', t.checkboxSkipTutorialTitle), skipInput);
    prefsGrid.appendChild(skipRow);

    body.appendChild(prefsGrid);

    const btnRow = el('div', 'lw-choice-list lw-title-actions');
    if (this.controller.saveRepo.hasValidSave()) {
      const contBtn = el('button', 'lw-btn lw-btn-primary', t.btnContinueGame);
      contBtn.setAttribute('data-testid', 'btn-continue-game');
      contBtn.addEventListener('click', () => this.controller.continueSavedGame());
      btnRow.appendChild(contBtn);
    }

    const newBtn = el('button', 'lw-btn lw-btn-moss', t.btnNewGame);
    newBtn.setAttribute('data-testid', 'btn-new-game');
    newBtn.addEventListener('click', () =>
      this.controller.startNewGame(0x5eed2026, { skipTutorial: this.skipTutorialOnTitle }),
    );
    btnRow.appendChild(newBtn);

    const importLabel = el('label', 'lw-btn', t.btnImportSave);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      void f.text().then((txt) => {
        const res = this.controller.importSaveFileContent(txt);
        if (!res.ok) {
          this.controller.statusNotice = `${t.importErrorPrefix}${localizeSaveNotice(res.error ?? '', uiLang)}`;
          this.render();
        }
      });
    });
    importLabel.appendChild(fileInput);
    btnRow.appendChild(importLabel);

    const creditsBtn = el('button', 'lw-btn lw-btn-sm', t.creditsBtn);
    creditsBtn.setAttribute('data-testid', 'btn-open-credits');
    creditsBtn.addEventListener('click', () => this.controller.openCreditsModal());
    btnRow.appendChild(creditsBtn);

    body.appendChild(btnRow);
    card.appendChild(body);
    backdrop.appendChild(card);
    return backdrop;
  }

  private buildTopHud(): HTMLElement {
    const state = this.controller.state;
    const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const guidance = state.settings.guidanceMode ?? 'full';
    const t = getUiStrings(uiLang);
    const map = MAPS_BY_ID[state.regionId];
    const nav = this.controller.navigationPlan;

    const hud = el('header', 'lw-hud');

    const ribbon = el('div', 'lw-hud-ribbon lw-interactive');
    ribbon.title = t.hudRibbonTooltip;
    ribbon.addEventListener('click', () => this.controller.openJournal('quests'));

    const titleRow = el('div', 'lw-hud-title');
    titleRow.appendChild(el('span', 'lw-region-name', pickText(uiLang, map.nameEn, map.nameVi)));
    titleRow.appendChild(el('span', 'lw-badge', t.timeLabels[state.timeOfDay]));
    titleRow.appendChild(el('span', 'lw-badge', t.tokensShort(state.tokens)));

    const lead = state.party[0];
    if (lead) {
      const sp = SPECIES_BY_ID[lead.speciesId];
      const gleamPrefix = lead.isRareVariant ? '* ' : '';
      const leadBadge = el(
        'span',
        'lw-badge lw-badge-lead',
        `${gleamPrefix}${sp?.name ?? lead.speciesId} ${t.levelShort(lead.level)} (${lead.currentHp}/${lead.maxHp})`,
      );
      leadBadge.dataset.level = String(lead.level);
      leadBadge.dataset.hp = String(lead.currentHp);
      leadBadge.dataset.maxHp = String(lead.maxHp);
      titleRow.appendChild(leadBadge);
    }
    ribbon.appendChild(titleRow);

    if (nav.goalSource === 'onboarding' || nav.goalSource === 'quest') {
      const qRow = el('div', 'lw-hud-quest-row');
      qRow.dataset.goalSource = nav.goalSource;
      if (guidance !== 'off') {
        if (nav.blockedByGate) {
          const lockPill = el('span', 'lw-compass-pill', t.hudLockedBadge);
          lockPill.setAttribute('data-testid', 'hud-compass-arrow');
          lockPill.dataset.blocked = 'true';
          qRow.appendChild(lockPill);
        } else if (nav.unreachable) {
          const unreachPill = el('span', 'lw-compass-pill', t.hudUnreachableBadge);
          unreachPill.setAttribute('data-testid', 'hud-compass-arrow');
          unreachPill.dataset.unreachable = 'true';
          qRow.appendChild(unreachPill);
        } else if (nav.arrivedAtTarget) {
          const arrivedPill = el('span', 'lw-compass-pill lw-badge-eff-good', t.hudArrivedBadge);
          arrivedPill.setAttribute('data-testid', 'hud-compass-arrow');
          arrivedPill.dataset.arrived = 'true';
          arrivedPill.dataset.steps = '0';
          if (nav.firstStepDir) arrivedPill.dataset.dir = nav.firstStepDir;
          qRow.appendChild(arrivedPill);
        } else if (nav.firstStepDir) {
          const compass = el('span', 'lw-compass-pill');
          compass.setAttribute('data-testid', 'hud-compass-arrow');
          compass.dataset.dir = nav.firstStepDir;
          compass.dataset.steps = String(nav.distanceSteps);
          compass.dataset.arrived = 'false';
          compass.innerHTML = COMPASS_ARROW_SVG[nav.firstStepDir];
          compass.appendChild(
            document.createTextNode(
              nav.distanceSteps > 0
                ? ` ${t.directionLabels[nav.firstStepDir]} (${nav.distanceSteps})`
                : ` ${t.directionLabels[nav.firstStepDir]}`,
            ),
          );
          qRow.appendChild(compass);
        }
      }
      const unifiedAction = pickText(uiLang, nav.activeGoalActionEn, nav.activeGoalActionVi);
      const objectiveText = nav.blockedByGate
        ? pickText(uiLang, nav.gateRequirementEn ?? unifiedAction, nav.gateRequirementVi ?? unifiedAction)
        : nav.unreachable
          ? pickText(
              uiLang,
              nav.unreachableReasonEn ?? unifiedAction,
              nav.unreachableReasonVi ?? unifiedAction,
            )
          : nav.isCrossRegion && nav.nextPortalLabelVi
            ? `${unifiedAction} (${t.hudCrossRegionHint(pickText(uiLang, nav.nextPortalLabelEn ?? '', nav.nextPortalLabelVi))})`
            : unifiedAction;
      const qTextEl = el('div', 'lw-hud-quest lw-hud-quest-clamp', objectiveText);
      qTextEl.setAttribute('data-testid', 'hud-goal-text');
      qRow.appendChild(qTextEl);
      ribbon.appendChild(qRow);
    } else if (state.flags.main_story_completed) {
      ribbon.appendChild(
        el(
          'div',
          'lw-hud-quest lw-hud-quest-clamp',
          t.hudPostGameSummary(state.rematchCleared.length, state.discoveredTraces.length),
        ),
      );
    }
    hud.appendChild(ribbon);

    const highlightTargetId = this.controller.activeOnboardingPrompt?.highlightButtonTestId;

    const actions = el('div', 'lw-hud-actions lw-interactive');
    const lostBtn = el('button', 'lw-btn lw-btn-moss lw-btn-sm', t.hudLostBtn);
    lostBtn.setAttribute('data-testid', 'btn-im-lost');
    lostBtn.addEventListener('click', () => this.controller.openLostHelper());

    const mapBtn = el('button', 'lw-btn lw-btn-sm', t.hudMapBtn);
    mapBtn.setAttribute('data-testid', 'btn-open-map');
    mapBtn.addEventListener('click', () => this.controller.openJournal('map'));

    const interactBtn = el('button', 'lw-btn lw-btn-sm lw-hide-xs', t.hudInteractBtn);
    interactBtn.setAttribute('data-testid', 'btn-hud-interact');
    interactBtn.addEventListener('click', () => this.controller.interactFacing());

    const journalBtn = el(
      'button',
      highlightTargetId === 'btn-open-journal'
        ? 'lw-btn lw-btn-primary lw-btn-sm lw-btn-highlight'
        : 'lw-btn lw-btn-primary lw-btn-sm',
      t.hudJournalBtn,
    );
    journalBtn.setAttribute('data-testid', 'btn-open-journal');
    journalBtn.addEventListener('click', () => this.controller.openJournal('quests'));

    actions.append(lostBtn, mapBtn, interactBtn, journalBtn);
    hud.appendChild(actions);

    return hud;
  }

  private buildOnboardingStrip(): HTMLElement {
    const prompt = this.controller.activeOnboardingPrompt!;
    const uiLang: UiLanguage = this.controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const t = getUiStrings(uiLang);

    const wrap = el('div', 'lw-toast-stack');
    const strip = el('div', 'lw-onboarding-strip lw-interactive');
    strip.setAttribute('data-testid', 'onboarding-strip');
    strip.dataset.step = prompt.id;

    const copy = el('div', 'lw-onboarding-copy');
    const head = el('div', 'lw-hud-title');
    head.appendChild(el('span', 'lw-badge lw-badge-eff-good', t.onboardingHeader(prompt.index, prompt.total)));
    head.appendChild(el('strong', '', pickText(uiLang, prompt.titleEn, prompt.titleVi)));
    copy.appendChild(head);
    copy.appendChild(el('div', 'lw-hud-quest', pickText(uiLang, prompt.hintEn, prompt.hintVi)));
    strip.appendChild(copy);

    const btns = el('div', 'lw-hud-actions');
    if (prompt.skippableStep) {
      const skipStepBtn = el('button', 'lw-btn lw-btn-sm', t.onboardingSkipStepBtn);
      skipStepBtn.setAttribute('data-testid', 'btn-skip-onboarding-step');
      skipStepBtn.addEventListener('click', () => this.controller.skipOnboardingStep());
      btns.appendChild(skipStepBtn);
    }
    const skipAllBtn = el('button', 'lw-btn lw-btn-sm', t.onboardingSkipBtn);
    skipAllBtn.setAttribute('data-testid', 'btn-skip-onboarding');
    skipAllBtn.addEventListener('click', () => this.controller.skipOnboardingGuide());
    btns.appendChild(skipAllBtn);
    strip.appendChild(btns);

    wrap.appendChild(strip);
    return wrap;
  }

  private getCachedMinimapTerrain(regionId: keyof typeof MAPS_BY_ID): HTMLCanvasElement {
    const existing = this.minimapTerrainCache.get(regionId);
    if (existing) return existing;
    const map = MAPS_BY_ID[regionId];
    const cell = 3;
    const offscreen = document.createElement('canvas');
    offscreen.width = map.width * cell;
    offscreen.height = map.height * cell;
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const tile = getTileAt(map, x, y);
          let color = '#6ca14f';
          if (tile === 'water') color = '#3c85a6';
          else if (tile === 'wall' || tile === 'cliff') color = '#4d3a2c';
          else if (tile === 'tree') color = '#35663a';
          else if (tile === 'path' || tile === 'bridge') color = '#c49b6c';
          else if (tile === 'sand') color = '#d6b47e';
          else if (tile === 'stone_floor') color = '#9a9fa3';
          else if (tile === 'tall_grass' || tile === 'reed_marsh') color = '#4a8540';
          else if (tile === 'campfire') color = '#f28c38';
          else if (tile === 'shrine') color = '#7dd8f0';
          ctx.fillStyle = color;
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
    this.minimapTerrainCache.set(regionId, offscreen);
    return offscreen;
  }

  private paintMinimapCanvas(canvas: HTMLCanvasElement): void {
    const state = this.controller.state;
    const map = MAPS_BY_ID[state.regionId];
    const nav = this.controller.navigationPlan;
    const cell = 3;
    if (canvas.width !== map.width * cell || canvas.height !== map.height * cell) {
      canvas.width = map.width * cell;
      canvas.height = map.height * cell;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const terrain = this.getCachedMinimapTerrain(state.regionId);
    ctx.drawImage(terrain, 0, 0);

    for (const portal of map.portals) {
      const unlocked = isPortalUnlocked(portal, state, SPECIES_BY_ID);
      ctx.fillStyle = unlocked ? '#57e3ff' : '#7a7570';
      ctx.fillRect(portal.x * cell, portal.y * cell, cell + 1, cell + 1);
    }

    // Quest BFS waypoints (gold)
    ctx.fillStyle = '#ffe570';
    for (const pt of nav.waypoints) {
      ctx.fillRect(pt.x * cell + 1, pt.y * cell + 1, 2, 2);
    }

    // Player click-to-move waypoints (aqua cyan, distinct from gold quest trail)
    const moveSnap = this.controller.movement.getSnapshot();
    if (moveSnap.activePath.length > 0) {
      ctx.fillStyle = '#57e3ff';
      for (const pt of moveSnap.activePath) {
        ctx.fillRect(pt.x * cell + 1, pt.y * cell + 1, 2, 2);
      }
    }

    for (const npc of NPCS) {
      if (npc.regionId !== state.regionId) continue;
      const marker = getNpcQuestMarker({ npc, state, quests: QUESTS, speciesById: SPECIES_BY_ID });
      if (marker !== 'none') {
        ctx.fillStyle = marker === 'new_quest' ? '#ffd23f' : '#4ee075';
        ctx.fillRect(npc.x * cell, npc.y * cell, cell, cell);
      }
    }

    if (nav.destinationInCurrentRegion) {
      ctx.fillStyle = '#ff9c24';
      ctx.fillRect(
        nav.destinationInCurrentRegion.x * cell - 1,
        nav.destinationInCurrentRegion.y * cell - 1,
        cell + 2,
        cell + 2,
      );
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(state.playerPos.x * cell - 1, state.playerPos.y * cell - 1, cell + 2, cell + 2);
    ctx.fillStyle = '#d94b2b';
    ctx.fillRect(state.playerPos.x * cell, state.playerPos.y * cell, cell, cell);
  }

  private buildMinimapWidget(): HTMLElement {
    const state = this.controller.state;
    const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const t = getUiStrings(uiLang);

    const box = el('button', 'lw-minimap-card lw-interactive') as HTMLButtonElement;
    box.type = 'button';
    box.title = t.minimapTitle;
    box.setAttribute('data-testid', 'overworld-minimap');
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      this.controller.openJournal('map');
    });

    const canvas = document.createElement('canvas');
    this.paintMinimapCanvas(canvas);
    box.appendChild(canvas);
    return box;
  }

  private buildNearbyPromptBar(): HTMLElement {
    const nearby = this.controller.navigationPlan.nearbyInteractable!;
    const uiLang: UiLanguage = this.controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const t = getUiStrings(uiLang);
    const isTouch =
      this.controller.state.settings.touchControls === 'always' ||
      (typeof window !== 'undefined' && window.innerWidth <= 960);

    const shouldHighlightNearby =
      this.controller.activeOnboardingPrompt?.highlightButtonTestId === 'btn-nearby-interact';
    const wrap = el('div', 'lw-nearby-wrap');
    const btn = el(
      'button',
      shouldHighlightNearby
        ? 'lw-nearby-pill lw-interactive lw-btn-highlight'
        : 'lw-nearby-pill lw-interactive',
      t.hudNearbyPrompt(pickText(uiLang, nearby.labelEn, nearby.labelVi), isTouch),
    ) as HTMLButtonElement;
    btn.type = 'button';
    btn.setAttribute('data-testid', 'btn-nearby-interact');
    btn.addEventListener('click', () => this.controller.interactFacing());
    wrap.appendChild(btn);
    return wrap;
  }

  private buildEvolutionBanner(): HTMLElement {
    const evo = this.controller.activeEvolution!;
    const uiLang: UiLanguage = this.controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const t = getUiStrings(uiLang);
    const fromSp = SPECIES_BY_ID[evo.fromSpeciesId];
    const toSp = SPECIES_BY_ID[evo.toSpeciesId];
    const wrap = el('div', 'lw-toast-stack');
    const card = el('div', 'lw-evolution-banner lw-interactive');
    card.setAttribute('data-testid', 'evolution-banner');

    if (fromSp && toSp) {
      const pair = el('div', 'lw-evolution-sprites');
      pair.appendChild(createCreatureSpriteSpan(fromSp.dexNumber));
      pair.appendChild(el('strong', 'lw-evolution-arrow', '->'));
      pair.appendChild(createCreatureSpriteSpan(toSp.dexNumber, { gleaming: true }));
      card.appendChild(pair);

      const copy = el('div', '');
      copy.appendChild(el('strong', '', t.evoTitle(fromSp.name, toSp.name, evo.newLevel)));
      copy.appendChild(
        el(
          'div',
          'lw-hud-quest',
          t.evoSubtitle(fromSp.name, toSp.name, pickText(uiLang, toSp.titleEn, toSp.titleVi)),
        ),
      );
      card.appendChild(copy);
    }

    const okBtn = el('button', 'lw-btn lw-btn-moss lw-btn-sm', t.evoDismissBtn);
    okBtn.setAttribute('data-testid', 'btn-dismiss-evolution');
    okBtn.addEventListener('click', () => this.controller.dismissEvolutionBanner());
    card.appendChild(okBtn);
    wrap.appendChild(card);
    return wrap;
  }

  private buildMoveLearnBanner(): HTMLElement {
    const notice = this.controller.activeMoveLearnBanner!;
    const uiLang: UiLanguage = this.controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const t = getUiStrings(uiLang);
    const sp = SPECIES_BY_ID[notice.speciesId];
    const moveDef = MOVES_BY_ID[notice.moveId];
    const replacedDef = notice.replacedMoveId ? MOVES_BY_ID[notice.replacedMoveId] : undefined;

    const wrap = el('div', 'lw-toast-stack');
    const card = el('div', 'lw-evolution-banner lw-interactive');
    card.setAttribute('data-testid', 'move-learn-banner');

    if (sp && moveDef) {
      card.appendChild(createCreatureSpriteSpan(sp.dexNumber));
      const copy = el('div', '');
      const moveName = uiLang === 'en' ? moveDef.name : (moveDef.nameVi ?? moveDef.name);
      const replacedName = replacedDef
        ? uiLang === 'en'
          ? replacedDef.name
          : (replacedDef.nameVi ?? replacedDef.name)
        : undefined;
      copy.appendChild(el('strong', '', t.moveLearnedBannerTitle(sp.name, moveName)));
      copy.appendChild(
        el(
          'div',
          'lw-hud-quest',
          t.moveLearnedBannerBody(
            pickText(uiLang, moveDef.descriptionEn, moveDef.descriptionVi),
            replacedName,
          ),
        ),
      );
      card.appendChild(copy);
    }

    const btns = el('div', 'lw-hud-actions');
    const manageBtn = el('button', 'lw-btn lw-btn-primary lw-btn-sm', t.moveLearnedManageBtn);
    manageBtn.addEventListener('click', () => {
      this.journalState.managingMovesPartyIndex = notice.partyIndex;
      this.controller.dismissMoveLearnBanner();
      this.controller.openJournal('team');
    });
    const okBtn = el('button', 'lw-btn lw-btn-sm', t.moveLearnedDismissBtn);
    okBtn.addEventListener('click', () => this.controller.dismissMoveLearnBanner());
    btns.append(manageBtn, okBtn);
    card.appendChild(btns);
    wrap.appendChild(card);
    return wrap;
  }

  private buildToastStack(): HTMLElement {
    const uiLang: UiLanguage = this.controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const stack = el('div', 'lw-toast-stack');
    const latest = this.controller.toasts.slice(-1);
    for (const toast of latest) {
      const item = el('div', 'lw-toast');
      item.appendChild(el('span', 'lw-toast-en', pickText(uiLang, toast.messageEn, toast.messageVi)));
      stack.appendChild(item);
    }
    return stack;
  }

  private buildDialogueBox(): HTMLElement {
    const dlg = this.controller.activeDialogue!;
    const line = dlg.node.lines[dlg.lineIndex]!;
    const settings = this.controller.state.settings;
    const uiLang: UiLanguage = settings.uiLanguage === 'en' ? 'en' : 'vi';
    const learningLang: LearningLanguage = settings.learningLanguage ?? 'en';
    const contentLang = settings.contentLanguage ?? 'bilingual';
    const zhMode: ZhStudyMode = settings.zhStudyMode ?? 'hanzi_pinyin_vi';
    const isZhActive = learningLang === 'zh' && zhMode !== 'vi_only';
    const isViOnly =
      learningLang === 'none' ||
      (learningLang === 'en' && contentLang === 'vi_only') ||
      (learningLang === 'zh' && zhMode === 'vi_only');
    const showPinyinNow = dlg.revealPinyinOverride ?? settings.showPinyin !== false;
    const showZhViDefault =
      settings.showZhTranslation !== false && zhMode !== 'zh_immersion' && zhMode !== 'hanzi_pinyin' && zhMode !== 'hanzi_assist';
    const showZhViNow = dlg.revealViOverride ? !showZhViDefault : showZhViDefault;
    const t = getUiStrings(uiLang);

    const box = el('section', 'lw-dialogue-box lw-interactive');
    box.setAttribute('data-testid', 'dialogue-box');
    box.dataset.learningLang = learningLang;

    const top = el('div', 'lw-dialogue-top');
    const leftMeta = el('div', 'lw-hud-title');
    const speakerBase = localizeSpeakerName(dlg.node.speaker, uiLang);
    const speakerLabel = isZhActive
      ? `${dlg.speakerZh} (${speakerBase})`
      : uiLang === 'vi' && dlg.node.speakerRoleVi && !speakerBase.includes(dlg.node.speakerRoleVi)
        ? `${speakerBase} | ${dlg.node.speakerRoleVi}`
        : speakerBase;
    leftMeta.appendChild(el('span', 'lw-speaker-tag', speakerLabel));
    if (isZhActive) {
      const hskBadge = el('span', 'lw-badge', t.dialogueHskBadge(settings.hskLevel ?? 'HSK2'));
      hskBadge.setAttribute('data-testid', 'dialogue-level-badge');
      leftMeta.appendChild(hskBadge);
    } else if (!isViOnly) {
      const cefrBadge = el('span', 'lw-badge', t.dialogueBandBadge(settings.cefrBand));
      cefrBadge.setAttribute('data-testid', 'dialogue-level-badge');
      leftMeta.appendChild(cefrBadge);
    }
    top.appendChild(leftMeta);

    const rightControls = el('div', 'lw-hud-actions');
    if (isZhActive) {
      const listenLineBtn = el('button', 'lw-btn lw-btn-sm', t.dialogueListenBtn);
      listenLineBtn.setAttribute('data-testid', 'btn-dialogue-listen');
      listenLineBtn.addEventListener('click', () => this.controller.speakActiveDialogueSentence());
      rightControls.appendChild(listenLineBtn);

      const pinyinBtn = el(
        'button',
        'lw-btn lw-btn-sm',
        showPinyinNow ? t.dialogueHidePinyin : t.dialogueShowPinyin,
      );
      pinyinBtn.setAttribute('data-testid', 'btn-toggle-pinyin');
      pinyinBtn.addEventListener('click', () => this.controller.toggleDialoguePinyinAssist());
      rightControls.appendChild(pinyinBtn);

      const viBtn = el(
        'button',
        'lw-btn lw-btn-sm',
        showZhViNow ? t.dialogueHideVi : t.dialogueShowVi,
      );
      viBtn.setAttribute('data-testid', 'btn-toggle-vi');
      viBtn.addEventListener('click', () => this.controller.toggleDialogueVietnameseAssist());
      rightControls.appendChild(viBtn);
    } else if (!isViOnly) {
      const listenLineBtn = el('button', 'lw-btn lw-btn-sm', t.dialogueListenBtn);
      listenLineBtn.setAttribute('data-testid', 'btn-dialogue-listen');
      listenLineBtn.addEventListener('click', () => this.controller.speakActiveDialogueSentence());
      rightControls.appendChild(listenLineBtn);

      if (contentLang !== 'bilingual') {
        const viBtn = el(
          'button',
          'lw-btn lw-btn-sm',
          dlg.revealViOverride ? t.dialogueHideVi : t.dialogueShowVi,
        );
        viBtn.setAttribute('data-testid', 'btn-toggle-vi');
        viBtn.addEventListener('click', () => this.controller.toggleDialogueVietnameseAssist());
        rightControls.appendChild(viBtn);
      }
    }
    top.appendChild(rightControls);
    box.appendChild(top);

    const bossWarn = this.controller.pendingBossWarning;
    if (
      bossWarn &&
      settings.battleAssist !== false &&
      (bossWarn.isUnderleveled || bossWarn.needsHeal || bossWarn.needsTonics) &&
      dlg.lineIndex === 0
    ) {
      const counterText = bossWarn.counterElements
        .map((c) => pickText(uiLang, ELEMENT_LABELS[c].en, ELEMENT_LABELS[c].vi))
        .join(', ');
      const warnEl = el(
        'div',
        'lw-battle-assist-bar lw-boss-warn-bar',
        t.bossWarningBanner(
          pickText(uiLang, bossWarn.bossNameEn, bossWarn.bossNameVi),
          bossWarn.maxPartyLevel,
          bossWarn.recommendedLevel,
          bossWarn.needsHeal,
          bossWarn.needsTonics,
          counterText,
        ),
      );
      warnEl.setAttribute('data-testid', 'boss-readiness-warning');
      box.appendChild(warnEl);
    }

    if (isViOnly) {
      box.appendChild(el('div', 'lw-dialogue-en', dlg.resolvedVi));
      if (dlg.echoVi) {
        box.appendChild(el('div', 'lw-dialogue-echo', dlg.echoVi));
      }
    } else if (isZhActive) {
      const zhPara = el('div', 'lw-dialogue-en lw-dialogue-zh');
      zhPara.setAttribute('data-testid', 'dialogue-zh-text');
      zhPara.appendChild(
        renderInteractiveChinese(this.controller, dlg.resolvedZh, dlg.node.contextTag, {
          showPinyin: showPinyinNow,
          pinyinPosition: settings.pinyinPosition ?? 'above',
        }),
      );
      box.appendChild(zhPara);

      if (dlg.echoZh) {
        const echoBox = el('div', 'lw-dialogue-echo');
        const echoZhRow = el('div', 'lw-dialogue-zh');
        echoZhRow.appendChild(
          renderInteractiveChinese(this.controller, dlg.echoZh, `${dlg.node.contextTag}_echo`, {
            showPinyin: showPinyinNow,
            pinyinPosition: settings.pinyinPosition ?? 'above',
          }),
        );
        echoBox.appendChild(echoZhRow);
        if (showZhViNow && dlg.echoVi) {
          echoBox.appendChild(el('div', 'lw-hud-quest', dlg.echoVi));
        }
        box.appendChild(echoBox);
      }

      if (showZhViNow) {
        const viLine = el('div', 'lw-dialogue-vi', dlg.resolvedVi);
        viLine.setAttribute('data-testid', 'dialogue-vi-translation');
        box.appendChild(viLine);
      }
    } else {
      const enPara = el('div', 'lw-dialogue-en');
      enPara.appendChild(
        renderInteractiveEnglish(
          this.controller,
          dlg.resolvedEn,
          dlg.node.contextTag,
          line.focusWords,
        ),
      );
      box.appendChild(enPara);

      if (dlg.echoEn) {
        const echoBox = el('div', 'lw-dialogue-echo');
        echoBox.appendChild(
          renderInteractiveEnglish(this.controller, dlg.echoEn, `${dlg.node.contextTag}_echo`),
        );
        if ((contentLang === 'bilingual' || dlg.revealViOverride) && dlg.echoVi) {
          echoBox.appendChild(el('div', 'lw-hud-quest', dlg.echoVi));
        }
        box.appendChild(echoBox);
      }

      if (contentLang === 'bilingual' || dlg.revealViOverride) {
        const viLine = el('div', 'lw-dialogue-vi', dlg.resolvedVi);
        viLine.setAttribute('data-testid', 'dialogue-vi-translation');
        box.appendChild(viLine);
      }
    }

    if (dlg.speechNoteVi) {
      const speechNote = el('div', 'lw-hud-quest', dlg.speechNoteVi);
      speechNote.setAttribute('data-testid', 'dialogue-speech-note');
      box.appendChild(speechNote);
    }

    if (line.choices && line.choices.length > 0) {
      const isStarterChoice = line.choices.some((c) => c.action?.kind === 'choose_starter');
      const choicesWrap = el(
        'div',
        isStarterChoice ? 'lw-starter-choice-grid' : 'lw-choice-list',
      );
      line.choices.forEach((choice, idx) => {
        const zhChoiceLabel = dlg.choicesZh?.[idx];
        if (choice.action?.kind === 'choose_starter') {
          const sp = SPECIES_BY_ID[choice.action.speciesId];
          const cBtn = el('button', 'lw-btn lw-starter-choice-btn');
          cBtn.setAttribute('data-testid', `dialogue-choice-${idx}`);
          if (sp) {
            cBtn.appendChild(createCreatureSpriteSpan(sp.dexNumber));
          }
          const txt = el('div', '');
          if (isZhActive && zhChoiceLabel) {
            txt.appendChild(el('strong', '', zhChoiceLabel));
            if (showZhViNow) {
              txt.appendChild(el('div', 'lw-hud-quest', pickText(uiLang, choice.labelEn, choice.labelVi)));
            }
          } else if (isViOnly || uiLang === 'vi') {
            txt.appendChild(el('strong', '', choice.labelVi));
            if (!isViOnly && contentLang === 'bilingual') {
              txt.appendChild(el('div', 'lw-hud-quest', choice.labelEn));
            }
          } else {
            txt.appendChild(el('strong', '', choice.labelEn));
            if (contentLang === 'bilingual') {
              txt.appendChild(el('div', 'lw-hud-quest', choice.labelVi));
            }
          }
          cBtn.appendChild(txt);
          cBtn.addEventListener('click', () => this.controller.selectDialogueChoice(choice));
          choicesWrap.appendChild(cBtn);
          return;
        }
        const label =
          isZhActive && zhChoiceLabel
            ? showZhViNow
              ? `${zhChoiceLabel} | ${pickText(uiLang, choice.labelEn, choice.labelVi)}`
              : zhChoiceLabel
            : isViOnly
              ? choice.labelVi
              : contentLang === 'bilingual'
                ? uiLang === 'vi'
                  ? choice.labelVi
                  : `${choice.labelEn} | ${choice.labelVi}`
                : choice.labelEn;
        const cBtn = el('button', idx === 0 ? 'lw-btn lw-btn-primary' : 'lw-btn', label);
        cBtn.setAttribute('data-testid', `dialogue-choice-${idx}`);
        cBtn.addEventListener('click', () => this.controller.selectDialogueChoice(choice));
        choicesWrap.appendChild(cBtn);
      });
      box.appendChild(choicesWrap);
    } else {
      const footer = el('div', 'lw-choice-list');
      const isLast = dlg.lineIndex + 1 >= dlg.node.lines.length;
      const nextBtn = el(
        'button',
        'lw-btn lw-btn-primary',
        isLast ? t.dialogueClose : t.dialogueNext,
      );
      nextBtn.setAttribute('data-testid', 'btn-dialogue-next');
      nextBtn.addEventListener('click', () => this.controller.advanceDialogue());
      footer.appendChild(nextBtn);
      box.appendChild(footer);
    }

    return box;
  }

  private buildGlossSlip(): HTMLElement {
    const uiLang: UiLanguage = this.controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const t = getUiStrings(uiLang);

    const slip = el('aside', 'lw-gloss-slip lw-interactive');
    slip.setAttribute('data-testid', 'gloss-popup');

    // 1. Chinese Proper Noun card (separated from HSK vocabulary)
    if (this.controller.activeZhProperGloss) {
      const pn = this.controller.activeZhProperGloss;
      slip.dataset.glossLang = 'zh_proper';
      const header = el('div', 'lw-gloss-header');
      const titleLeft = el('div', '');
      titleLeft.appendChild(el('span', 'lw-gloss-word', pn.hanzi));
      titleLeft.appendChild(el('span', 'lw-gloss-pinyin', pn.pinyin));
      titleLeft.appendChild(el('span', 'lw-badge', t.glossProperNounBadge));
      header.appendChild(titleLeft);

      const closeBtn = el('button', 'lw-btn lw-btn-sm', t.glossCloseBtn);
      closeBtn.setAttribute('data-testid', 'btn-gloss-close');
      closeBtn.addEventListener('click', () => this.controller.closeGlossPopup());
      header.appendChild(closeBtn);
      slip.appendChild(header);

      slip.appendChild(el('div', 'lw-gloss-meaning', `${pn.nameVi} (${pn.nameEn})`));
      slip.appendChild(el('div', 'lw-hud-quest', t.glossProperNounNote));
      if (this.controller.activeGlossNoteVi) {
        const noteEl = el('div', 'lw-hud-quest', this.controller.activeGlossNoteVi);
        noteEl.setAttribute('data-testid', 'gloss-speech-note');
        slip.appendChild(noteEl);
      }
      const actions = el('div', 'lw-choice-list');
      const listenBtn = el('button', 'lw-btn lw-btn-sm', t.glossListenBtn);
      listenBtn.setAttribute('data-testid', 'btn-gloss-listen');
      listenBtn.addEventListener('click', () => this.controller.pronounceActiveGloss());
      actions.appendChild(listenBtn);
      slip.appendChild(actions);
      return slip;
    }

    // 2. Full 10-field Chinese HSK / Dictionary Gloss card
    if (this.controller.activeZhGlossEntry) {
      const zhEntry = this.controller.activeZhGlossEntry;
      slip.dataset.glossLang = 'zh';
      const memZh = this.controller.state.lexiconZh?.[zhEntry.id];
      const resolvedSense = resolveChineseSenseForContext(
        zhEntry,
        this.controller.activeGlossContextTag,
        this.controller.activeZhGlossSentenceZh,
      );
      const displayPinyin = this.controller.activeZhGlossPinyin || resolvedSense.primary.pinyin;

      const header = el('div', 'lw-gloss-header');
      const titleLeft = el('div', '');
      titleLeft.appendChild(el('span', 'lw-gloss-word', zhEntry.hanzi));
      titleLeft.appendChild(el('span', 'lw-gloss-pinyin', displayPinyin));
      const posLabel = localizePos(resolvedSense.primary.pos, uiLang);
      const badgeText = zhEntry.hsk ? `${posLabel} | ${zhEntry.hsk}` : posLabel;
      titleLeft.appendChild(el('span', 'lw-badge', badgeText));
      header.appendChild(titleLeft);

      const closeBtn = el('button', 'lw-btn lw-btn-sm', t.glossCloseBtn);
      closeBtn.setAttribute('data-testid', 'btn-gloss-close');
      closeBtn.addEventListener('click', () => this.controller.closeGlossPopup());
      header.appendChild(closeBtn);
      slip.appendChild(header);

      slip.appendChild(
        el('div', 'lw-gloss-meaning', `${t.glossContextMeaning} ${resolvedSense.primary.meaningVi}`),
      );

      const exBox = el('div', 'lw-gloss-example');
      exBox.appendChild(el('div', '', resolvedSense.primary.exampleZh));
      const exPy = el('div', 'zh-pinyin', resolvedSense.primary.examplePinyin);
      exPy.style.marginTop = '2px';
      exPy.style.whiteSpace = 'normal';
      exBox.appendChild(exPy);
      const exVi = el('div', '', resolvedSense.primary.exampleVi);
      exVi.style.marginTop = '3px';
      exBox.appendChild(exVi);
      slip.appendChild(exBox);

      if (resolvedSense.otherSenses.length > 0) {
        const other = resolvedSense.otherSenses[0]!;
        slip.appendChild(
          el(
            'div',
            'lw-gloss-polysemy',
            t.glossOtherReading(other.pinyin, localizePos(other.pos, uiLang), other.meaningVi),
          ),
        );
      }

      if (this.controller.activeGlossNoteVi) {
        const noteEl = el('div', 'lw-hud-quest', this.controller.activeGlossNoteVi);
        noteEl.setAttribute('data-testid', 'gloss-speech-note');
        slip.appendChild(noteEl);
      }

      const actions = el('div', 'lw-choice-list');
      const listenBtn = el('button', 'lw-btn lw-btn-sm', t.glossListenBtn);
      listenBtn.setAttribute('data-testid', 'btn-gloss-listen');
      listenBtn.addEventListener('click', () => this.controller.pronounceActiveGloss());

      const isSaved = Boolean(memZh?.savedByPlayer);
      const saveBtn = el(
        'button',
        isSaved ? 'lw-btn lw-btn-moss lw-btn-sm' : 'lw-btn lw-btn-primary lw-btn-sm',
        isSaved ? t.glossSavedBtn : t.glossSaveBtn,
      );
      saveBtn.setAttribute('data-testid', 'btn-gloss-save');
      saveBtn.addEventListener('click', () => this.controller.toggleSaveActiveGloss());

      actions.append(listenBtn, saveBtn);
      slip.appendChild(actions);
      return slip;
    }

    if (this.controller.activePocketGloss && !this.controller.activeGlossEntry) {
      const pocket = this.controller.activePocketGloss;
      const header = el('div', 'lw-gloss-header');
      const titleLeft = el('div', '');
      titleLeft.appendChild(el('span', 'lw-gloss-word', pocket.surface.toLowerCase()));
      if (pocket.note.base !== pocket.surface.toLowerCase()) {
        titleLeft.appendChild(el('span', '', ` (-> ${pocket.note.base}) `));
      }
      titleLeft.appendChild(el('span', 'lw-badge', pocket.note.posVi));
      header.appendChild(titleLeft);

      const closeBtn = el('button', 'lw-btn lw-btn-sm', t.glossCloseBtn);
      closeBtn.setAttribute('data-testid', 'btn-gloss-close');
      closeBtn.addEventListener('click', () => this.controller.closeGlossPopup());
      header.appendChild(closeBtn);
      slip.appendChild(header);

      slip.appendChild(el('div', 'lw-gloss-meaning', `${t.glossQuickMeaning} ${pocket.note.meaningVi}`));
      if (pocket.sentenceEn) {
        slip.appendChild(el('div', 'lw-gloss-example', pocket.sentenceEn));
      }
      if (this.controller.activeGlossNoteVi) {
        slip.appendChild(el('div', 'lw-hud-quest', this.controller.activeGlossNoteVi));
      }
      const actions = el('div', 'lw-choice-list');
      const listenBtn = el('button', 'lw-btn lw-btn-sm', t.glossListenBtn);
      listenBtn.setAttribute('data-testid', 'btn-gloss-listen');
      listenBtn.addEventListener('click', () => this.controller.pronounceActiveGloss());
      actions.appendChild(listenBtn);
      slip.appendChild(actions);
      return slip;
    }

    const entry = this.controller.activeGlossEntry!;
    const mem = this.controller.state.lexicon[entry.id];
    const resolvedSense = resolveSenseForContext(
      entry,
      this.controller.activeGlossContextTag,
      this.controller.activeGlossSentenceEn,
    );

    const header = el('div', 'lw-gloss-header');
    const titleLeft = el('div', '');
    titleLeft.appendChild(el('span', 'lw-gloss-word', entry.word));
    titleLeft.appendChild(el('span', '', ` ${entry.phonetic} `));
    titleLeft.appendChild(
      el('span', 'lw-badge', `${localizePos(resolvedSense.primary.pos, uiLang)} | ${entry.cefr}`),
    );
    header.appendChild(titleLeft);

    const closeBtn = el('button', 'lw-btn lw-btn-sm', t.glossCloseBtn);
    closeBtn.setAttribute('data-testid', 'btn-gloss-close');
    closeBtn.addEventListener('click', () => this.controller.closeGlossPopup());
    header.appendChild(closeBtn);
    slip.appendChild(header);

    slip.appendChild(
      el('div', 'lw-gloss-meaning', `${t.glossContextMeaning} ${resolvedSense.primary.meaningVi}`),
    );

    const pickedEx =
      entry.senses && entry.senses.length > 0
        ? { en: resolvedSense.primary.exampleEn, vi: resolvedSense.primary.exampleVi }
        : pickIndependentExample(
            entry,
            this.controller.state.regionId,
            Math.max(0, (mem?.glossLookups ?? 1) - 1),
          );

    const exBox = el('div', 'lw-gloss-example');
    exBox.appendChild(el('div', '', pickedEx.en));
    const exVi = el('div', '', pickedEx.vi);
    exVi.style.marginTop = '3px';
    exBox.appendChild(exVi);
    slip.appendChild(exBox);

    if (resolvedSense.otherSenses.length > 0) {
      const otherSense = resolvedSense.otherSenses[0]!;
      slip.appendChild(
        el(
          'div',
          'lw-gloss-polysemy',
          t.glossOtherMeaning(localizePos(otherSense.pos, uiLang), otherSense.meaningVi),
        ),
      );
    }

    if (this.controller.activeGlossNoteVi) {
      slip.appendChild(el('div', 'lw-hud-quest', this.controller.activeGlossNoteVi));
    }

    const actions = el('div', 'lw-choice-list');
    const listenBtn = el('button', 'lw-btn lw-btn-sm', t.glossListenBtn);
    listenBtn.setAttribute('data-testid', 'btn-gloss-listen');
    listenBtn.addEventListener('click', () => this.controller.pronounceActiveGloss());

    const isSaved = Boolean(mem?.savedByPlayer);
    const saveBtn = el(
      'button',
      isSaved ? 'lw-btn lw-btn-moss lw-btn-sm' : 'lw-btn lw-btn-primary lw-btn-sm',
      isSaved ? t.glossSavedBtn : t.glossSaveBtn,
    );
    saveBtn.setAttribute('data-testid', 'btn-gloss-save');
    saveBtn.addEventListener('click', () => this.controller.toggleSaveActiveGloss());

    actions.append(listenBtn, saveBtn);
    slip.appendChild(actions);
    return slip;
  }

  private buildTouchPad(): HTMLElement {
    const uiLang: UiLanguage = this.controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
    const t = getUiStrings(uiLang);

    const wrap = el('div', 'lw-touch-controls');
    const dpad = el('div', 'lw-dpad lw-interactive');

    const cells: Array<Direction | 'center' | null> = [
      null,
      'up',
      null,
      'left',
      'center',
      'right',
      null,
      'down',
      null,
    ];

    for (const cell of cells) {
      if (cell === null) {
        dpad.appendChild(el('div', 'lw-dpad-empty'));
        continue;
      }
      if (cell === 'center') {
        dpad.appendChild(el('div', 'lw-dpad-hub'));
        continue;
      }
      const btn = el('button', `lw-dpad-btn lw-dpad-${cell}`) as HTMLButtonElement;
      btn.type = 'button';
      btn.innerHTML = DPAD_ARROW_SVG[cell];
      btn.dataset.dir = cell;
      btn.dataset.active = String(this.heldTouchDir === cell);
      btn.setAttribute('aria-label', t.touchMoveAria(cell));
      btn.setAttribute('data-testid', `touch-${cell}`);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startTouchMove(cell, e.pointerId);
      });
      btn.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        this.stopTouchMove(e.pointerId);
      });
      btn.addEventListener('pointercancel', (e) => {
        e.stopPropagation();
        this.stopTouchMove(e.pointerId);
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (performance.now() - this.lastPointerStepAt > 250) {
          this.controller.pressMoveInput(`touch_tap:${cell}`, cell);
          this.controller.releaseMoveInput(`touch_tap:${cell}`);
        }
      });
      dpad.appendChild(btn);
    }

    const actions = el('div', 'lw-touch-actions lw-interactive');
    const bagBtn = el('button', 'lw-btn lw-touch-pill', t.touchBagBtn) as HTMLButtonElement;
    bagBtn.type = 'button';
    bagBtn.setAttribute('data-testid', 'touch-journal');
    bagBtn.addEventListener('click', () => this.controller.openJournal('quests'));

    const actBtn = el(
      'button',
      'lw-btn lw-btn-primary lw-touch-circle',
      t.touchActBtn,
    ) as HTMLButtonElement;
    actBtn.type = 'button';
    actBtn.setAttribute('data-testid', 'touch-interact');
    actBtn.addEventListener('click', () => this.controller.interactFacing());

    actions.append(bagBtn, actBtn);
    wrap.append(dpad, actions);
    return wrap;
  }
}

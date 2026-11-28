import { MAPS_BY_ID } from '../data/maps.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import { ELEMENT_LABELS } from '../domain/elements.ts';
import { pickIndependentExample, resolveSenseForContext } from '../domain/learning.ts';
import { isQuestConditionMet } from '../domain/quests.ts';
import type { CefrBand, Direction } from '../domain/types.ts';
import type { GameController } from '../game/controller.ts';
import { buildBattleView, type BattleDeckTab } from './battleView.ts';
import {
  buildCampReviewModal,
  buildEndingBannerModal,
  buildJournalModal,
  buildSupplyPostModal,
  type JournalViewState,
} from './journalView.ts';
import { createCreatureSpriteSpan, el, renderInteractiveEnglish } from './uiHelpers.ts';

const DPAD_ARROW_SVG: Readonly<Record<Direction, string>> = {
  up: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 5l7 8h-4v6H9v-6H5z"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 19l-7-8h4V5h6v6h4z"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M5 12l8-7v4h6v6h-6v4z"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M19 12l-8 7v-4H5V9h6V5z"/></svg>',
};

export class GameUiRenderer {
  private readonly rootEl: HTMLElement;
  private readonly overlayEl: HTMLElement;
  private readonly controller: GameController;
  private battleTab: BattleDeckTab = 'moves';
  private wasInBattle = false;
  private heldTouchDir: Direction | null = null;
  private heldTouchTimer: number | null = null;
  private lastPointerStepAt = -9999;
  private readonly journalState: JournalViewState = {
    lexiconFilter: 'encountered',
    campAnsweredCurrent: false,
    campAnsweredMessageVi: '',
    awaitingKeyRebind: null,
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

  private startHoldWalk(dir: Direction): void {
    this.stopHoldWalk();
    this.heldTouchDir = dir;
    this.lastPointerStepAt = performance.now();
    this.controller.movePlayer(dir);
    if (typeof window !== 'undefined') {
      this.heldTouchTimer = window.setInterval(() => {
        if (
          this.controller.activeModal !== 'none' ||
          this.controller.activeBattle !== null ||
          this.controller.activeDialogue !== null ||
          !this.heldTouchDir
        ) {
          this.stopHoldWalk();
          return;
        }
        this.lastPointerStepAt = performance.now();
        this.controller.movePlayer(this.heldTouchDir);
      }, 135);
    }
  }

  private stopHoldWalk(): void {
    if (typeof window !== 'undefined' && this.heldTouchTimer !== null) {
      window.clearInterval(this.heldTouchTimer);
      this.heldTouchTimer = null;
    }
    this.heldTouchDir = null;
  }

  private bindKeyboardAndPointerControls(): void {
    window.addEventListener('pointerup', () => this.stopHoldWalk());
    window.addEventListener('pointercancel', () => this.stopHoldWalk());
    window.addEventListener('blur', () => this.stopHoldWalk());

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

      if (code === km.cancel || code === 'Escape') {
        if (this.controller.activeGlossEntry || this.controller.activePocketGloss) {
          ev.preventDefault();
          this.controller.closeGlossPopup();
          return;
        }
        if (this.controller.activeEvolution) {
          ev.preventDefault();
          this.controller.dismissEvolutionBanner();
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
          this.controller.interactFacing();
          return;
        }
      }

      let dir: Direction | null = null;
      if (code === km.up || code === 'KeyW') dir = 'up';
      else if (code === km.down || code === 'KeyS') dir = 'down';
      else if (code === km.left || code === 'KeyA') dir = 'left';
      else if (code === km.right || code === 'KeyD') dir = 'right';

      if (
        dir &&
        this.controller.activeModal === 'none' &&
        !this.controller.activeBattle &&
        !this.controller.activeDialogue
      ) {
        ev.preventDefault();
        this.controller.movePlayer(dir);
      }
    });
  }

  public render(): void {
    const { settings } = this.controller.state;
    this.rootEl.dataset.highContrast = String(settings.highContrast);
    this.rootEl.dataset.reducedMotion = String(settings.reducedMotion);
    this.rootEl.dataset.textScale = settings.textScale;
    this.rootEl.dataset.touch = settings.touchControls;

    if (
      this.controller.activeModal !== 'none' ||
      this.controller.activeBattle !== null ||
      this.controller.activeDialogue !== null
    ) {
      this.stopHoldWalk();
    }

    this.overlayEl.replaceChildren();

    if (this.controller.activeModal === 'title') {
      this.overlayEl.appendChild(this.buildTitleModal());
      return;
    }

    const inBattleNow = Boolean(this.controller.activeBattle);
    if (inBattleNow && !this.wasInBattle) {
      this.battleTab = 'moves';
    }
    this.wasInBattle = inBattleNow;

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
      } else if (this.controller.toasts.length > 0) {
        topGroup.appendChild(this.buildToastStack());
      }
      this.overlayEl.appendChild(topGroup);
      if (this.controller.activeDialogue) {
        this.overlayEl.appendChild(this.buildDialogueBox());
      } else if (this.controller.activeModal === 'none') {
        this.overlayEl.appendChild(this.buildTouchPad());
      }
    }

    if (this.controller.activeGlossEntry || this.controller.activePocketGloss) {
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
    }
  }

  private buildTitleModal(): HTMLElement {
    const backdrop = el('div', 'lw-modal-backdrop lw-title-backdrop lw-interactive');
    const card = el('section', 'lw-notebook lw-title-card');

    const header = el('header', 'lw-notebook-header lw-title-banner');
    const titleWrap = el('div', '');
    titleWrap.appendChild(el('div', 'lw-title-kicker', 'VERDANT BASIN EXPEDITION'));
    titleWrap.appendChild(el('strong', 'lw-title-heading', 'LingoWild'));
    header.appendChild(titleWrap);
    header.appendChild(el('span', 'lw-badge', 'Offline Pixel RPG'));
    card.appendChild(header);

    const body = el('div', 'lw-notebook-body');

    const starterTrio = el('div', 'lw-starter-showcase');
    for (const [dex, name, elKey, roleVi] of [
      [1, 'Mosskit', 'leaf', 'Hệ Lá | Cân bằng'],
      [4, 'Kindlet', 'ember', 'Hệ Lửa | Tốc chiến'],
      [7, 'Ripplefin', 'water', 'Hệ Nước | Vững chãi'],
    ] as const) {
      const item = el('div', 'lw-starter-plaque');
      item.appendChild(createCreatureSpriteSpan(dex));
      item.appendChild(el('strong', '', name));
      const badge = el('span', 'lw-badge lw-badge-element', ELEMENT_LABELS[elKey].en);
      badge.style.background = ELEMENT_LABELS[elKey].color;
      item.appendChild(badge);
      item.appendChild(el('span', 'lw-hud-quest', roleVi));
      starterTrio.appendChild(item);
    }
    body.appendChild(starterTrio);

    body.appendChild(
      el(
        'p',
        'lw-title-desc',
        'Khám phá năm vùng sinh thái sống động, kết bạn ba mươi loài Wildkin đi theo sau bước chân và tiếp thu tiếng Anh tự nhiên qua ngữ cảnh thực địa. Mọi tính năng tra từ và ôn tập đều hoàn toàn tự nguyện.',
      ),
    );

    if (this.controller.statusNotice) {
      body.appendChild(el('p', 'lw-battle-log', this.controller.statusNotice));
    }

    const prefsGrid = el('div', 'lw-title-prefs');
    const modeRow = el('div', 'lw-list-row');
    modeRow.appendChild(el('span', '', 'Chế độ hỗ trợ:'));
    const modeSelect = document.createElement('select');
    for (const [val, label] of [
      ['contextual', 'Ngữ cảnh (Chạm từ xem nghĩa)'],
      ['bilingual', 'Song ngữ đầy đủ'],
      ['immersion', 'Chỉ tiếng Anh'],
    ] as const) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      opt.selected = this.controller.state.settings.supportMode === val;
      modeSelect.appendChild(opt);
    }
    modeSelect.addEventListener('change', () => {
      this.controller.updateSettings({
        supportMode: modeSelect.value as 'immersion' | 'contextual' | 'bilingual',
      });
    });
    modeRow.appendChild(modeSelect);

    const cefrRow = el('div', 'lw-list-row');
    cefrRow.appendChild(el('span', '', 'Mức tiếng Anh:'));
    const cefrSelect = document.createElement('select');
    for (const [val, label] of [
      ['A1', 'A1 Cơ bản'],
      ['A2', 'A2 Sơ cấp'],
      ['B1', 'B1 Trung cấp'],
      ['B2', 'B2 Khá'],
    ] as const) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      opt.selected = this.controller.state.settings.cefrBand === val;
      cefrSelect.appendChild(opt);
    }
    cefrSelect.addEventListener('change', () => {
      this.controller.updateSettings({ cefrBand: cefrSelect.value as CefrBand });
    });
    cefrRow.appendChild(cefrSelect);

    prefsGrid.append(modeRow, cefrRow);
    body.appendChild(prefsGrid);

    const btnRow = el('div', 'lw-choice-list lw-title-actions');
    if (this.controller.saveRepo.hasValidSave()) {
      const contBtn = el('button', 'lw-btn lw-btn-primary', 'Tiếp tục hành trình (Continue)');
      contBtn.setAttribute('data-testid', 'btn-continue-game');
      contBtn.addEventListener('click', () => this.controller.continueSavedGame());
      btnRow.appendChild(contBtn);
    }

    const newBtn = el('button', 'lw-btn lw-btn-moss', 'Hành trình mới (New Expedition)');
    newBtn.setAttribute('data-testid', 'btn-new-game');
    newBtn.addEventListener('click', () => this.controller.startNewGame(0x5eed2026));
    btnRow.appendChild(newBtn);

    const importLabel = el('label', 'lw-btn', 'Nhập tệp lưu (.json)');
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
          this.controller.statusNotice = `Lỗi nhập tệp lưu: ${res.error ?? 'không hợp lệ'}`;
          this.render();
        }
      });
    });
    importLabel.appendChild(fileInput);
    btnRow.appendChild(importLabel);

    body.appendChild(btnRow);
    card.appendChild(body);
    backdrop.appendChild(card);
    return backdrop;
  }

  private buildTopHud(): HTMLElement {
    const state = this.controller.state;
    const map = MAPS_BY_ID[state.regionId];
    const hud = el('header', 'lw-hud');

    const ribbon = el('div', 'lw-hud-ribbon lw-interactive');
    ribbon.title = 'Tap to view active quest details in Field Journal';
    ribbon.addEventListener('click', () => this.controller.openJournal('quests'));

    const titleRow = el('div', 'lw-hud-title');
    titleRow.appendChild(el('span', 'lw-region-name', map.nameEn));

    const timeLabels: Record<string, string> = {
      morning: 'Morning',
      day: 'Day',
      dusk: 'Dusk',
      night: 'Night',
    };
    titleRow.appendChild(el('span', 'lw-badge', timeLabels[state.timeOfDay] ?? state.timeOfDay));
    titleRow.appendChild(el('span', 'lw-badge', `${state.tokens}T`));

    const lead = state.party[0];
    if (lead) {
      const sp = SPECIES_BY_ID[lead.speciesId];
      const gleamPrefix = lead.isRareVariant ? '* ' : '';
      titleRow.appendChild(
        el(
          'span',
          'lw-badge lw-badge-lead',
          `${gleamPrefix}${sp?.name ?? lead.speciesId} Lv.${lead.level} (${lead.currentHp}/${lead.maxHp})`,
        ),
      );
    }
    ribbon.appendChild(titleRow);

    const activeMainQuest = QUESTS.find(
      (q) => q.isMainStory && state.quests[q.id]?.status === 'active',
    );
    if (activeMainQuest) {
      const nextStep = activeMainQuest.steps.find(
        (st) => !isQuestConditionMet(st.condition, state, SPECIES_BY_ID),
      );
      const qLine = el(
        'div',
        'lw-hud-quest lw-hud-quest-clamp',
        state.settings.supportMode === 'bilingual'
          ? `${nextStep?.descriptionEn ?? activeMainQuest.titleEn} | ${nextStep?.descriptionVi ?? activeMainQuest.titleVi}`
          : nextStep?.descriptionEn ?? activeMainQuest.titleEn,
      );
      ribbon.appendChild(qLine);
    } else if (state.flags.main_story_completed) {
      ribbon.appendChild(
        el(
          'div',
          'lw-hud-quest lw-hud-quest-clamp',
          `Post-Game Mastery: Wardens ${state.rematchCleared.length}/4 | Traces ${state.discoveredTraces.length}/4`,
        ),
      );
    }
    hud.appendChild(ribbon);

    const actions = el('div', 'lw-hud-actions lw-interactive');
    const mapBtn = el('button', 'lw-btn lw-btn-sm', 'Map');
    mapBtn.setAttribute('data-testid', 'btn-open-map');
    mapBtn.addEventListener('click', () => this.controller.openJournal('map'));

    const interactBtn = el('button', 'lw-btn lw-btn-sm lw-hide-xs', 'Act');
    interactBtn.setAttribute('data-testid', 'btn-hud-interact');
    interactBtn.addEventListener('click', () => this.controller.interactFacing());

    const journalBtn = el('button', 'lw-btn lw-btn-primary lw-btn-sm', 'Journal');
    journalBtn.setAttribute('data-testid', 'btn-open-journal');
    journalBtn.addEventListener('click', () => this.controller.openJournal('quests'));

    actions.append(mapBtn, interactBtn, journalBtn);
    hud.appendChild(actions);

    return hud;
  }

  private buildEvolutionBanner(): HTMLElement {
    const evo = this.controller.activeEvolution!;
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
      copy.appendChild(
        el(
          'strong',
          '',
          `Evolution! ${fromSp.name} grew into ${toSp.name} at Lv.${evo.newLevel}!`,
        ),
      );
      copy.appendChild(
        el(
          'div',
          'lw-hud-quest',
          `Tiến hóa rực rỡ! ${fromSp.name} đã trưởng thành thành ${toSp.name} (${toSp.titleVi}).`,
        ),
      );
      card.appendChild(copy);
    }

    const okBtn = el('button', 'lw-btn lw-btn-moss lw-btn-sm', 'Celebrate');
    okBtn.setAttribute('data-testid', 'btn-dismiss-evolution');
    okBtn.addEventListener('click', () => this.controller.dismissEvolutionBanner());
    card.appendChild(okBtn);
    wrap.appendChild(card);
    return wrap;
  }

  private buildToastStack(): HTMLElement {
    const stack = el('div', 'lw-toast-stack');
    const latest = this.controller.toasts.slice(-1);
    for (const t of latest) {
      const item = el('div', 'lw-toast');
      item.appendChild(el('span', 'lw-toast-en', t.messageEn));
      if (this.controller.state.settings.supportMode === 'bilingual') {
        item.appendChild(el('span', 'lw-toast-vi', ` | ${t.messageVi}`));
      }
      stack.appendChild(item);
    }
    return stack;
  }

  private buildDialogueBox(): HTMLElement {
    const dlg = this.controller.activeDialogue!;
    const line = dlg.node.lines[dlg.lineIndex]!;
    const box = el('section', 'lw-dialogue-box lw-interactive');
    box.setAttribute('data-testid', 'dialogue-box');

    const top = el('div', 'lw-dialogue-top');
    const leftMeta = el('div', 'lw-hud-title');
    const speakerLabel = dlg.node.speakerRoleVi
      ? `${dlg.node.speaker} | ${dlg.node.speakerRoleVi}`
      : dlg.node.speaker;
    leftMeta.appendChild(el('span', 'lw-speaker-tag', speakerLabel));
    leftMeta.appendChild(
      el('span', 'lw-badge', `Band ${this.controller.state.settings.cefrBand}`),
    );
    top.appendChild(leftMeta);

    const rightControls = el('div', 'lw-hud-actions');
    const listenLineBtn = el('button', 'lw-btn lw-btn-sm', 'Listen');
    listenLineBtn.setAttribute('data-testid', 'btn-dialogue-listen');
    listenLineBtn.addEventListener('click', () => this.controller.speakActiveDialogueSentence());
    rightControls.appendChild(listenLineBtn);

    if (this.controller.state.settings.supportMode !== 'bilingual') {
      const viBtn = el(
        'button',
        'lw-btn lw-btn-sm',
        dlg.revealViOverride ? 'Ẩn dịch' : 'Dịch câu',
      );
      viBtn.setAttribute('data-testid', 'btn-toggle-vi');
      viBtn.addEventListener('click', () => this.controller.toggleDialogueVietnameseAssist());
      rightControls.appendChild(viBtn);
    }
    top.appendChild(rightControls);
    box.appendChild(top);

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
      if (this.controller.state.settings.supportMode === 'bilingual' || dlg.revealViOverride) {
        if (dlg.echoVi) {
          echoBox.appendChild(el('div', 'lw-hud-quest', dlg.echoVi));
        }
      }
      box.appendChild(echoBox);
    }

    if (this.controller.state.settings.supportMode === 'bilingual' || dlg.revealViOverride) {
      box.appendChild(el('div', 'lw-dialogue-vi', dlg.resolvedVi));
    }

    if (dlg.speechNoteVi) {
      box.appendChild(el('div', 'lw-hud-quest', dlg.speechNoteVi));
    }

    if (line.choices && line.choices.length > 0) {
      const isStarterChoice = line.choices.some((c) => c.action?.kind === 'choose_starter');
      const choicesWrap = el(
        'div',
        isStarterChoice ? 'lw-starter-choice-grid' : 'lw-choice-list',
      );
      line.choices.forEach((choice, idx) => {
        const label =
          this.controller.state.settings.supportMode === 'bilingual'
            ? `${choice.labelEn} (${choice.labelVi})`
            : choice.labelEn;
        if (choice.action?.kind === 'choose_starter') {
          const sp = SPECIES_BY_ID[choice.action.speciesId];
          const cBtn = el('button', 'lw-btn lw-starter-choice-btn');
          cBtn.setAttribute('data-testid', `dialogue-choice-${idx}`);
          if (sp) {
            cBtn.appendChild(createCreatureSpriteSpan(sp.dexNumber));
          }
          const txt = el('div', '');
          txt.appendChild(el('strong', '', choice.labelEn));
          txt.appendChild(el('div', 'lw-hud-quest', choice.labelVi));
          cBtn.appendChild(txt);
          cBtn.addEventListener('click', () => this.controller.selectDialogueChoice(choice));
          choicesWrap.appendChild(cBtn);
          return;
        }
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
        isLast ? 'Close / Tiếp tục' : 'Next / Tiếp',
      );
      nextBtn.setAttribute('data-testid', 'btn-dialogue-next');
      nextBtn.addEventListener('click', () => this.controller.advanceDialogue());
      footer.appendChild(nextBtn);
      box.appendChild(footer);
    }

    return box;
  }

  private buildGlossSlip(): HTMLElement {
    const slip = el('aside', 'lw-gloss-slip lw-interactive');
    slip.setAttribute('data-testid', 'gloss-popup');

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

      const closeBtn = el('button', 'lw-btn lw-btn-sm', 'Đóng');
      closeBtn.addEventListener('click', () => this.controller.closeGlossPopup());
      header.appendChild(closeBtn);
      slip.appendChild(header);

      slip.appendChild(el('div', 'lw-gloss-meaning', `Nghĩa nhanh: ${pocket.note.meaningVi}`));
      if (pocket.sentenceEn) {
        const exBox = el('div', 'lw-gloss-example', pocket.sentenceEn);
        slip.appendChild(exBox);
      }
      if (this.controller.activeGlossNoteVi) {
        slip.appendChild(el('div', 'lw-hud-quest', this.controller.activeGlossNoteVi));
      }
      const actions = el('div', 'lw-choice-list');
      const listenBtn = el('button', 'lw-btn lw-btn-sm', 'Nghe phát âm');
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
      el('span', 'lw-badge', `${resolvedSense.primary.pos} | ${entry.cefr}`),
    );
    header.appendChild(titleLeft);

    const closeBtn = el('button', 'lw-btn lw-btn-sm', 'Đóng');
    closeBtn.addEventListener('click', () => this.controller.closeGlossPopup());
    header.appendChild(closeBtn);
    slip.appendChild(header);

    slip.appendChild(el('div', 'lw-gloss-meaning', `Nghĩa ngữ cảnh: ${resolvedSense.primary.meaningVi}`));

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
          `Nghĩa khác (${otherSense.pos}): ${otherSense.meaningVi}`,
        ),
      );
    }

    if (this.controller.activeGlossNoteVi) {
      slip.appendChild(el('div', 'lw-hud-quest', this.controller.activeGlossNoteVi));
    }

    const actions = el('div', 'lw-choice-list');
    const listenBtn = el('button', 'lw-btn lw-btn-sm', 'Nghe phát âm');
    listenBtn.setAttribute('data-testid', 'btn-gloss-listen');
    listenBtn.addEventListener('click', () => this.controller.pronounceActiveGloss());

    const isSaved = Boolean(mem?.savedByPlayer);
    const saveBtn = el(
      'button',
      isSaved ? 'lw-btn lw-btn-moss lw-btn-sm' : 'lw-btn lw-btn-primary lw-btn-sm',
      isSaved ? 'Đã lưu Sổ từ' : 'Lưu từ (Save)',
    );
    saveBtn.setAttribute('data-testid', 'btn-gloss-save');
    saveBtn.addEventListener('click', () => this.controller.toggleSaveActiveGloss());

    actions.append(listenBtn, saveBtn);
    slip.appendChild(actions);
    return slip;
  }

  private buildTouchPad(): HTMLElement {
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
      btn.dataset.active = String(this.heldTouchDir === cell);
      btn.setAttribute('aria-label', `Move ${cell}`);
      btn.setAttribute('data-testid', `touch-${cell}`);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.startHoldWalk(cell);
      });
      btn.addEventListener('click', () => {
        if (performance.now() - this.lastPointerStepAt > 250) {
          this.controller.movePlayer(cell);
        }
      });
      dpad.appendChild(btn);
    }

    const actions = el('div', 'lw-touch-actions lw-interactive');
    const jBtn = el('button', 'lw-btn lw-touch-pill', 'Bag');
    jBtn.setAttribute('aria-label', 'Open Field Journal');
    jBtn.setAttribute('data-testid', 'touch-journal');
    jBtn.addEventListener('click', () => this.controller.openJournal('quests'));

    const actBtn = el('button', 'lw-btn lw-btn-primary lw-touch-circle', 'Act');
    actBtn.setAttribute('aria-label', 'Interact');
    actBtn.setAttribute('data-testid', 'touch-interact');
    actBtn.addEventListener('click', () => this.controller.interactFacing());

    actions.append(jBtn, actBtn);
    wrap.append(dpad, actions);
    return wrap;
  }
}

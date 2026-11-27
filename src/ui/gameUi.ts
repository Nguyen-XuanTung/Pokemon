import { ITEMS, ITEMS_BY_ID } from '../data/items.ts';
import { LEXICON_ENTRIES, LEXICON_INDEX } from '../data/lexicon.ts';
import { DIALOGUES } from '../data/dialogues.ts';
import { MAPS_BY_ID } from '../data/maps.ts';
import { MOVES_BY_ID } from '../data/moves.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import { computeCaptureProbability } from '../domain/capture.ts';
import { ELEMENT_LABELS } from '../domain/elements.ts';
import { shouldHighlightToken, tokenizeEnglishText } from '../domain/learning.ts';
import { isQuestConditionMet } from '../domain/quests.ts';
import type { Direction, KeyBindingMap } from '../domain/types.ts';
import type { GameController, JournalTab } from '../game/controller.ts';

export class GameUiRenderer {
  private readonly rootEl: HTMLElement;
  private readonly overlayEl: HTMLElement;
  private readonly controller: GameController;
  private battleTab: 'moves' | 'bag' | 'team' | 'tactics' = 'moves';
  private lexiconFilter: 'encountered' | 'saved' | 'all' | 'dispatches' = 'encountered';
  private campAnsweredMessageVi = '';
  private campAnsweredCurrent = false;
  private awaitingKeyRebind: keyof KeyBindingMap | null = null;

  public constructor(rootEl: HTMLElement, overlayEl: HTMLElement, controller: GameController) {
    this.rootEl = rootEl;
    this.overlayEl = overlayEl;
    this.controller = controller;

    this.bindKeyboardControls();
    this.controller.subscribe(() => {
      this.render();
    });
    this.render();
  }

  private bindKeyboardControls(): void {
    window.addEventListener('keydown', (ev) => {
      if (this.awaitingKeyRebind) {
        ev.preventDefault();
        const keyField = this.awaitingKeyRebind;
        this.awaitingKeyRebind = null;
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
        if (this.controller.activeGlossEntry) {
          ev.preventDefault();
          this.controller.closeGlossPopup();
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

      if (dir && this.controller.activeModal === 'none' && !this.controller.activeBattle && !this.controller.activeDialogue) {
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

    this.overlayEl.replaceChildren();

    if (this.controller.activeModal === 'title') {
      this.overlayEl.appendChild(this.buildTitleModal());
      return;
    }

    if (this.controller.activeBattle) {
      this.overlayEl.appendChild(this.buildBattleView());
    } else {
      this.overlayEl.appendChild(this.buildTopHud());
      if (this.controller.toasts.length > 0) {
        this.overlayEl.appendChild(this.buildToastStack());
      }
      if (this.controller.activeDialogue) {
        this.overlayEl.appendChild(this.buildDialogueBox());
      } else if (this.controller.activeModal === 'none') {
        this.overlayEl.appendChild(this.buildTouchPad());
      }
    }

    if (this.controller.activeGlossEntry) {
      this.overlayEl.appendChild(this.buildGlossSlip());
    }

    if (this.controller.activeModal === 'journal') {
      this.overlayEl.appendChild(this.buildJournalModal());
    } else if (this.controller.activeModal === 'supply_post') {
      this.overlayEl.appendChild(this.buildSupplyPostModal());
    } else if (this.controller.activeModal === 'camp_review') {
      this.overlayEl.appendChild(this.buildCampReviewModal());
    }
  }

  private createCreatureSpriteSpan(dexNumber: number, large: boolean = false): HTMLElement {
    const span = el('span', large ? 'sprite-creature sprite-creature-lg' : 'sprite-creature');
    const frameIdx = (dexNumber - 1) * 2;
    const col = frameIdx % 10;
    const row = Math.floor(frameIdx / 10);
    span.style.backgroundPosition = `${-col * 32}px ${-row * 32}px`;
    return span;
  }

  private createItemSpriteSpan(itemId: string): HTMLElement {
    const idx = Math.max(0, ITEMS.findIndex((i) => i.id === itemId));
    const span = el('span', 'sprite-item');
    span.style.backgroundPosition = `${-idx * 16}px 0px`;
    return span;
  }

  private renderInteractiveEnglish(
    text: string,
    contextTag: string,
    focusWords?: ReadonlyArray<string>,
  ): DocumentFragment {
    const frag = document.createDocumentFragment();
    const tokens = tokenizeEnglishText(text, LEXICON_INDEX);
    for (const tok of tokens) {
      if (!tok.isWord || !tok.entry) {
        frag.appendChild(document.createTextNode(tok.raw));
        continue;
      }
      const highlighted = shouldHighlightToken(tok.entry, this.controller.state, focusWords);
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
        this.controller.inspectGlossWord(entryRef, contextTag);
      });
      frag.appendChild(btn);
    }
    return frag;
  }

  private buildTitleModal(): HTMLElement {
    const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
    const card = el('section', 'lw-notebook');
    card.style.maxWidth = '560px';

    const header = el('header', 'lw-notebook-header');
    header.appendChild(el('strong', '', 'LingoWild | Sổ Thực Địa Thung Lũng Rêu Xanh'));
    card.appendChild(header);

    const body = el('div', 'lw-notebook-body');
    const introEn = el(
      'p',
      '',
      'Explore four living ecosystems, bond with thirty original Wildkin, and experience English naturally inside expedition clues and stories.',
    );
    const introVi = el(
      'p',
      '',
      'Khám phá bốn vùng sinh thái, thu phục ba mươi loài sinh vật nguyên bản và tiếp thu tiếng Anh tự nhiên qua ngữ cảnh hành trình. Không bao giờ bắt làm bài kiểm tra để được chơi tiếp.',
    );
    introVi.style.color = 'var(--ink-muted)';
    body.append(introEn, introVi);

    if (this.controller.statusNotice) {
      const warn = el('p', 'lw-battle-log', this.controller.statusNotice);
      body.appendChild(warn);
    }

    const modeRow = el('div', 'lw-list-row');
    modeRow.appendChild(el('span', '', 'Chế độ hỗ trợ ngôn ngữ:'));
    const modeSelect = document.createElement('select');
    for (const [val, label] of [
      ['contextual', 'Ngữ cảnh (Chạm từ xem nghĩa)'],
      ['bilingual', 'Song ngữ đầy đủ (Hiện sẵn tiếng Việt)'],
      ['immersion', 'Ngập tràn tiếng Anh'],
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
    body.appendChild(modeRow);

    const btnRow = el('div', 'lw-choice-list');
    btnRow.style.marginTop = '14px';

    if (this.controller.saveRepo.hasValidSave()) {
      const contBtn = el('button', 'lw-btn lw-btn-primary', 'Tiếp tục hành trình (Continue)');
      contBtn.setAttribute('data-testid', 'btn-continue-game');
      contBtn.addEventListener('click', () => this.controller.continueSavedGame());
      btnRow.appendChild(contBtn);
    }

    const newBtn = el('button', 'lw-btn lw-btn-moss', 'Bắt đầu hành trình mới (New Expedition)');
    newBtn.setAttribute('data-testid', 'btn-new-game');
    newBtn.addEventListener('click', () => this.controller.startNewGame(0x5eed2026));
    btnRow.appendChild(newBtn);

    const importLabel = el('label', 'lw-btn', 'Nhập tệp lưu JSON');
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
    const titleRow = el('div', 'lw-hud-title');
    titleRow.appendChild(el('span', '', `${map.nameEn} (${map.nameVi})`));

    const timeLabels: Record<string, string> = {
      morning: 'Morning / Sáng',
      day: 'Day / Trưa',
      dusk: 'Dusk / Chiều',
      night: 'Night / Đêm',
    };
    titleRow.appendChild(el('span', 'lw-badge', timeLabels[state.timeOfDay] ?? state.timeOfDay));
    titleRow.appendChild(el('span', 'lw-badge', `${state.tokens} Tokens`));

    const lead = state.party[0];
    if (lead) {
      const sp = SPECIES_BY_ID[lead.speciesId];
      titleRow.appendChild(
        el('span', 'lw-badge', `${sp?.name ?? lead.speciesId} Lv.${lead.level} (${lead.currentHp}/${lead.maxHp})`),
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
        'lw-hud-quest',
        state.settings.supportMode === 'bilingual'
          ? `${nextStep?.descriptionEn ?? activeMainQuest.titleEn} | ${nextStep?.descriptionVi ?? activeMainQuest.titleVi}`
          : nextStep?.descriptionEn ?? activeMainQuest.titleEn,
      );
      ribbon.appendChild(qLine);
    }
    hud.appendChild(ribbon);

    const actions = el('div', 'lw-hud-actions lw-interactive');
    const interactBtn = el('button', 'lw-btn', 'Interact (Space)');
    interactBtn.setAttribute('data-testid', 'btn-hud-interact');
    interactBtn.addEventListener('click', () => this.controller.interactFacing());
    const journalBtn = el('button', 'lw-btn lw-btn-primary', 'Journal (J)');
    journalBtn.setAttribute('data-testid', 'btn-open-journal');
    journalBtn.addEventListener('click', () => this.controller.openJournal('quests'));
    actions.append(interactBtn, journalBtn);
    hud.appendChild(actions);

    return hud;
  }

  private buildToastStack(): HTMLElement {
    const stack = el('div', 'lw-toast-stack');
    for (const t of this.controller.toasts) {
      const item = el('div', 'lw-toast');
      item.appendChild(el('div', '', t.messageEn));
      if (this.controller.state.settings.supportMode !== 'immersion') {
        const sub = el('div', '', t.messageVi);
        sub.style.color = 'var(--ink-muted)';
        item.appendChild(sub);
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
    const speakerLabel = dlg.node.speakerRoleVi
      ? `${dlg.node.speaker} | ${dlg.node.speakerRoleVi}`
      : dlg.node.speaker;
    top.appendChild(el('span', 'lw-speaker-tag', speakerLabel));

    const rightControls = el('div', 'lw-hud-actions');
    if (this.controller.state.settings.supportMode !== 'bilingual') {
      const viBtn = el(
        'button',
        'lw-btn',
        dlg.revealViOverride ? 'Ẩn dịch câu' : 'Dịch câu tiếng Việt',
      );
      viBtn.setAttribute('data-testid', 'btn-toggle-vi');
      viBtn.addEventListener('click', () => this.controller.toggleDialogueVietnameseAssist());
      rightControls.appendChild(viBtn);
    }
    top.appendChild(rightControls);
    box.appendChild(top);

    const enPara = el('div', 'lw-dialogue-en');
    enPara.appendChild(
      this.renderInteractiveEnglish(line.en, dlg.node.contextTag, line.focusWords),
    );
    box.appendChild(enPara);

    if (this.controller.state.settings.supportMode === 'bilingual' || dlg.revealViOverride) {
      box.appendChild(el('div', 'lw-dialogue-vi', line.vi));
    }

    if (line.choices && line.choices.length > 0) {
      const choicesWrap = el('div', 'lw-choice-list');
      line.choices.forEach((choice, idx) => {
        const label =
          this.controller.state.settings.supportMode === 'bilingual'
            ? `${choice.labelEn} (${choice.labelVi})`
            : choice.labelEn;
        const cBtn = el(
          'button',
          idx === 0 ? 'lw-btn lw-btn-primary' : 'lw-btn',
          label,
        );
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
        isLast ? 'Close / Tiếp tục (Space)' : 'Next / Tiếp (Space)',
      );
      nextBtn.setAttribute('data-testid', 'btn-dialogue-next');
      nextBtn.addEventListener('click', () => this.controller.advanceDialogue());
      footer.appendChild(nextBtn);
      box.appendChild(footer);
    }

    return box;
  }

  private buildGlossSlip(): HTMLElement {
    const entry = this.controller.activeGlossEntry!;
    const mem = this.controller.state.lexicon[entry.id];
    const slip = el('aside', 'lw-gloss-slip lw-interactive');
    slip.setAttribute('data-testid', 'gloss-popup');

    const header = el('div', 'lw-gloss-header');
    const titleLeft = el('div', '');
    titleLeft.appendChild(el('span', 'lw-gloss-word', entry.word));
    titleLeft.appendChild(el('span', '', ` ${entry.phonetic} `));
    titleLeft.appendChild(el('span', 'lw-badge', `${entry.pos} | ${entry.cefr}`));
    header.appendChild(titleLeft);

    const closeBtn = el('button', 'lw-btn', 'Đóng');
    closeBtn.addEventListener('click', () => this.controller.closeGlossPopup());
    header.appendChild(closeBtn);
    slip.appendChild(header);

    slip.appendChild(el('div', 'lw-gloss-meaning', `Nghĩa: ${entry.meaningVi}`));

    const exBox = el('div', 'lw-gloss-example');
    exBox.appendChild(el('div', '', entry.exampleEn));
    const exVi = el('div', '', entry.exampleVi);
    exVi.style.marginTop = '3px';
    exBox.appendChild(exVi);
    slip.appendChild(exBox);

    if (this.controller.activeGlossNoteVi) {
      const note = el('div', 'lw-hud-quest', this.controller.activeGlossNoteVi);
      note.style.marginBottom = '6px';
      slip.appendChild(note);
    }

    const actions = el('div', 'lw-choice-list');
    const listenBtn = el('button', 'lw-btn', 'Nghe phát âm (Listen)');
    listenBtn.setAttribute('data-testid', 'btn-gloss-listen');
    listenBtn.addEventListener('click', () => this.controller.pronounceActiveGloss());

    const isSaved = Boolean(mem?.savedByPlayer);
    const saveBtn = el(
      'button',
      isSaved ? 'lw-btn lw-btn-moss' : 'lw-btn lw-btn-primary',
      isSaved ? 'Đã lưu vào Sổ từ' : 'Lưu từ (Save Word)',
    );
    saveBtn.setAttribute('data-testid', 'btn-gloss-save');
    saveBtn.addEventListener('click', () => this.controller.toggleSaveActiveGloss());

    actions.append(listenBtn, saveBtn);
    slip.appendChild(actions);
    return slip;
  }

  private buildBattleView(): HTMLElement {
    const battle = this.controller.activeBattle!;
    const wrapper = el('div', 'lw-overlay');
    wrapper.style.position = 'static';
    wrapper.style.height = '100%';

    const enemy = battle.enemyParty[battle.activeEnemyIndex]!;
    const player = battle.playerParty[battle.activePlayerIndex]!;
    const enemySpec = SPECIES_BY_ID[enemy.speciesId]!;
    const playerSpec = SPECIES_BY_ID[player.speciesId]!;

    const topPlates = el('div', 'lw-battle-hud');
    topPlates.appendChild(
      this.buildCombatantPlate(player, `Partner: ${playerSpec.name}`, playerSpec.element, false),
    );
    topPlates.appendChild(
      this.buildCombatantPlate(
        enemy,
        `${battle.kind === 'wild' ? 'Wild' : 'Foe'}: ${enemySpec.name}`,
        enemySpec.element,
        true,
      ),
    );
    wrapper.appendChild(topPlates);

    const deck = el('section', 'lw-battle-deck lw-interactive');
    deck.setAttribute('data-testid', 'battle-deck');

    const logBox = el('div', 'lw-battle-log');
    for (const entry of this.controller.battleLogs.slice(-3)) {
      const lineDiv = el('div', '');
      lineDiv.appendChild(this.renderInteractiveEnglish(entry.messageEn, 'battle_log'));
      if (this.controller.state.settings.supportMode === 'bilingual') {
        const sub = el('div', '', entry.messageVi);
        sub.style.color = 'var(--ink-muted)';
        sub.style.fontSize = '0.84rem';
        lineDiv.appendChild(sub);
      }
      logBox.appendChild(lineDiv);
    }
    deck.appendChild(logBox);

    if (battle.outcome !== 'ongoing') {
      const finishBtn = el(
        'button',
        'lw-btn lw-btn-primary',
        'Continue Expedition / Tiếp tục hành trình (Space)',
      );
      finishBtn.setAttribute('data-testid', 'btn-battle-finish');
      finishBtn.addEventListener('click', () => this.controller.finishAndCloseBattle());
      deck.appendChild(finishBtn);
      wrapper.appendChild(deck);
      return wrapper;
    }

    const nav = el('div', 'lw-choice-list');
    nav.style.marginBottom = '8px';
    for (const [tabKey, label] of [
      ['moves', 'Moves / Chiêu thức'],
      ['bag', battle.kind === 'wild' ? 'Chimes & Bag / Thu phục & Túi' : 'Bag / Túi đồ'],
      ['team', `Team / Đội (${battle.playerParty.length})`],
      ['tactics', 'Observe & Flee / Quan sát'],
    ] as const) {
      const b = el(
        'button',
        this.battleTab === tabKey ? 'lw-btn lw-btn-primary' : 'lw-btn',
        label,
      );
      b.setAttribute('data-testid', `battle-tab-${tabKey}`);
      b.addEventListener('click', () => {
        this.battleTab = tabKey;
        this.render();
      });
      nav.appendChild(b);
    }
    deck.appendChild(nav);

    if (this.battleTab === 'moves') {
      const grid = el('div', 'lw-move-grid');
      player.moves.forEach((slot, idx) => {
        const mDef = MOVES_BY_ID[slot.moveId];
        if (!mDef) return;
        const elMeta = ELEMENT_LABELS[mDef.element];
        const card = el('div', 'lw-move-card');
        const head = el('div', 'lw-hud-title');
        const useMoveBtn = el(
          'button',
          'lw-btn lw-btn-primary',
          `${mDef.name} (${slot.pp}/${slot.maxPp})`,
        );
        useMoveBtn.setAttribute('data-testid', `btn-move-${idx}`);
        useMoveBtn.addEventListener('click', () =>
          this.controller.submitBattleAction({ kind: 'move', moveIndex: idx }),
        );
        const pill = el('span', 'lw-badge lw-badge-element', `${elMeta.en} | Pwr ${mDef.power}`);
        pill.style.background = elMeta.color;
        head.append(useMoveBtn, pill);
        card.appendChild(head);

        const desc = el('div', 'lw-hud-quest');
        desc.style.marginTop = '4px';
        desc.appendChild(this.renderInteractiveEnglish(mDef.descriptionEn, 'move_desc'));
        card.appendChild(desc);
        grid.appendChild(card);
      });
      deck.appendChild(grid);
    } else if (this.battleTab === 'bag') {
      const list = el('div', 'lw-move-grid');
      const usableItems = this.controller.state.inventory.filter((s) => {
        const def = ITEMS_BY_ID[s.itemId];
        return s.quantity > 0 && def && def.category !== 'key' && def.category !== 'lantern';
      });
      if (usableItems.length === 0) {
        list.appendChild(el('div', '', 'No battle items remaining in bag.'));
      }
      for (const slot of usableItems) {
        const def = ITEMS_BY_ID[slot.itemId]!;
        const card = el('div', 'lw-move-card');
        let extra = '';
        if (def.category === 'charm' && battle.kind === 'wild') {
          const pct = Math.round(
            computeCaptureProbability({
              target: enemy,
              species: enemySpec,
              charmMultiplier: def.captureMultiplier ?? 1,
            }) * 100,
          );
          extra = ` | Bond ~${pct}%`;
        }
        const row = el('div', 'lw-hud-title');
        row.appendChild(this.createItemSpriteSpan(def.id));
        const btn = el(
          'button',
          def.category === 'charm' ? 'lw-btn lw-btn-moss' : 'lw-btn',
          `${def.nameEn} x${slot.quantity}${extra}`,
        );
        btn.setAttribute('data-testid', `btn-battle-item-${def.id}`);
        btn.addEventListener('click', () =>
          this.controller.submitBattleAction({ kind: 'item', itemId: def.id }),
        );
        row.appendChild(btn);
        card.appendChild(row);
        list.appendChild(card);
      }
      deck.appendChild(list);
    } else if (this.battleTab === 'team') {
      const list = el('div', 'lw-move-grid');
      battle.playerParty.forEach((member, idx) => {
        const sp = SPECIES_BY_ID[member.speciesId]!;
        const card = el('div', 'lw-move-card');
        const row = el('div', 'lw-hud-title');
        row.appendChild(this.createCreatureSpriteSpan(sp.dexNumber));
        const btn = el(
          'button',
          'lw-btn',
          `${sp.name} Lv.${member.level} (${member.currentHp}/${member.maxHp})`,
        ) as HTMLButtonElement;
        btn.disabled = idx === battle.activePlayerIndex || member.currentHp <= 0;
        btn.addEventListener('click', () => {
          this.battleTab = 'moves';
          this.controller.submitBattleAction({ kind: 'switch', partyIndex: idx });
        });
        row.appendChild(btn);
        card.appendChild(row);
        list.appendChild(card);
      });
      deck.appendChild(list);
    } else {
      const actions = el('div', 'lw-choice-list');
      const obsBtn = el('button', 'lw-btn lw-btn-moss', 'Observe Habits (Read Field Note)');
      obsBtn.setAttribute('data-testid', 'btn-battle-observe');
      obsBtn.addEventListener('click', () =>
        this.controller.submitBattleAction({ kind: 'observe' }),
      );
      actions.appendChild(obsBtn);

      if (battle.kind === 'wild') {
        const fleeBtn = el('button', 'lw-btn', 'Step Back Safely (Flee)');
        fleeBtn.setAttribute('data-testid', 'btn-battle-flee');
        fleeBtn.addEventListener('click', () =>
          this.controller.submitBattleAction({ kind: 'flee' }),
        );
        actions.appendChild(fleeBtn);
      }
      deck.appendChild(actions);
    }

    wrapper.appendChild(deck);
    return wrapper;
  }

  private buildCombatantPlate(
    creature: { level: number; currentHp: number; maxHp: number; status: string | null; speciesId: string },
    name: string,
    element: keyof typeof ELEMENT_LABELS,
    isEnemy: boolean,
  ): HTMLElement {
    const plate = el('div', 'lw-combatant-plate');
    const top = el('div', 'lw-hud-title');
    top.appendChild(el('strong', '', `${name} Lv.${creature.level}`));
    const elMeta = ELEMENT_LABELS[element];
    const badge = el('span', 'lw-badge lw-badge-element', elMeta.en);
    badge.style.background = elMeta.color;
    top.appendChild(badge);
    if (creature.status) {
      top.appendChild(el('span', 'lw-badge', creature.status.toUpperCase()));
    }
    if (isEnemy && this.controller.state.caughtSpecies.includes(creature.speciesId)) {
      top.appendChild(el('span', 'lw-badge', 'Bonded'));
    }
    plate.appendChild(top);

    const ratio = Math.max(0, Math.min(100, Math.round((creature.currentHp / Math.max(1, creature.maxHp)) * 100)));
    const track = el('div', 'lw-hp-track');
    const fill = el('div', 'lw-hp-fill');
    fill.style.width = `${ratio}%`;
    fill.dataset.low = String(ratio <= 30);
    track.appendChild(fill);
    plate.appendChild(track);
    plate.appendChild(el('div', 'lw-hud-quest', `HP: ${creature.currentHp} / ${creature.maxHp}`));
    return plate;
  }

  private buildJournalModal(): HTMLElement {
    const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
    const notebook = el('section', 'lw-notebook');
    notebook.setAttribute('data-testid', 'journal-modal');

    const header = el('header', 'lw-notebook-header');
    header.appendChild(
      el(
        'strong',
        '',
        `Field Journal | Caught: ${this.controller.state.caughtSpecies.length}/30 | Tokens: ${this.controller.state.tokens}`,
      ),
    );
    const closeBtn = el('button', 'lw-btn', 'Close (Esc)');
    closeBtn.setAttribute('data-testid', 'btn-close-journal');
    closeBtn.addEventListener('click', () => this.controller.closeModal());
    header.appendChild(closeBtn);
    notebook.appendChild(header);

    const tabsRow = el('nav', 'lw-tabs');
    const tabDefs: ReadonlyArray<[JournalTab, string]> = [
      ['quests', 'Quests / Nhiệm vụ'],
      ['team', 'Team / Đội hình'],
      ['bag', 'Bag / Túi đồ'],
      ['compendium', 'Compendium / Sổ loài'],
      ['lexicon', 'Lexicon / Từ vựng'],
      ['settings', 'Settings & Save / Cài đặt'],
    ];
    for (const [key, label] of tabDefs) {
      const tb = el('button', 'lw-tab-btn', label);
      tb.setAttribute('aria-selected', String(this.controller.journalTab === key));
      tb.setAttribute('data-testid', `journal-tab-${key}`);
      tb.addEventListener('click', () => {
        this.controller.journalTab = key;
        this.render();
      });
      tabsRow.appendChild(tb);
    }
    notebook.appendChild(tabsRow);

    const body = el('div', 'lw-notebook-body');
    const tab = this.controller.journalTab;
    if (tab === 'quests') this.renderQuestsTab(body);
    else if (tab === 'team') this.renderTeamTab(body);
    else if (tab === 'bag') this.renderBagTab(body);
    else if (tab === 'compendium') this.renderCompendiumTab(body);
    else if (tab === 'lexicon') this.renderLexiconTab(body);
    else this.renderSettingsTab(body);

    notebook.appendChild(body);
    backdrop.appendChild(notebook);
    return backdrop;
  }

  private renderQuestsTab(container: HTMLElement): void {
    const state = this.controller.state;
    for (const q of QUESTS) {
      const prog = state.quests[q.id];
      if (!prog) continue;
      const card = el('div', 'lw-journal-entry');
      card.style.marginBottom = '8px';
      const head = el('div', 'lw-hud-title');
      head.appendChild(
        el('strong', '', `${q.isMainStory ? '[Main] ' : '[Field] '}${q.titleEn} | ${q.titleVi}`),
      );
      head.appendChild(
        el('span', 'lw-badge', prog.status === 'completed' ? 'Completed' : 'Active'),
      );
      card.appendChild(head);
      card.appendChild(el('div', 'lw-hud-quest', `${q.summaryEn} (${q.summaryVi})`));

      for (const st of q.steps) {
        const done = isQuestConditionMet(st.condition, state, SPECIES_BY_ID);
        const stepLine = el(
          'div',
          '',
          `${done ? '[x]' : '[ ]'} ${st.descriptionEn} (${st.descriptionVi})`,
        );
        stepLine.style.fontSize = '0.86rem';
        stepLine.style.marginTop = '3px';
        card.appendChild(stepLine);
      }
      container.appendChild(card);
    }
  }

  private renderTeamTab(container: HTMLElement): void {
    const state = this.controller.state;
    container.appendChild(el('h4', '', `Active Expedition Team (${state.party.length}/6)`));
    state.party.forEach((member, idx) => {
      const sp = SPECIES_BY_ID[member.speciesId]!;
      const row = el('div', 'lw-list-row');
      const left = el('div', 'lw-hud-title');
      left.appendChild(this.createCreatureSpriteSpan(sp.dexNumber));
      left.appendChild(
        el(
          'div',
          '',
          `${idx === 0 ? '[Lead] ' : ''}${sp.name} Lv.${member.level} | ${ELEMENT_LABELS[sp.element].en} | HP ${member.currentHp}/${member.maxHp} | ATK ${member.stats.atk} DEF ${member.stats.def} SPD ${member.stats.spd}`,
        ),
      );
      row.appendChild(left);

      const actions = el('div', 'lw-hud-actions');
      if (idx > 0) {
        const leadBtn = el('button', 'lw-btn', 'Make Lead');
        leadBtn.addEventListener('click', () => this.controller.makePartyLead(idx));
        actions.appendChild(leadBtn);
      }
      if (member.currentHp < member.maxHp) {
        const healBtn = el('button', 'lw-btn lw-btn-moss', 'Use Dew Tonic');
        healBtn.addEventListener('click', () =>
          this.controller.useBagItemInField('dew_tonic', idx),
        );
        actions.appendChild(healBtn);
      }
      row.appendChild(actions);
      container.appendChild(row);
    });

    if (state.sanctuaryBox.length > 0) {
      container.appendChild(
        el('h4', '', `Sanctuary Reserve (${state.sanctuaryBox.length} partners)`),
      );
      state.sanctuaryBox.forEach((boxMember, bIdx) => {
        const sp = SPECIES_BY_ID[boxMember.speciesId]!;
        const row = el('div', 'lw-list-row');
        const left = el('div', 'lw-hud-title');
        left.appendChild(this.createCreatureSpriteSpan(sp.dexNumber));
        left.appendChild(el('span', '', `${sp.name} Lv.${boxMember.level} (${ELEMENT_LABELS[sp.element].en})`));
        row.appendChild(left);

        const swapBtn = el('button', 'lw-btn', 'Swap with Slot 6');
        swapBtn.addEventListener('click', () =>
          this.controller.swapPartyAndReserve(Math.max(0, state.party.length - 1), bIdx),
        );
        row.appendChild(swapBtn);
        container.appendChild(row);
      });
    }
  }

  private renderBagTab(container: HTMLElement): void {
    const nonEmpty = this.controller.state.inventory.filter((s) => s.quantity > 0);
    for (const slot of nonEmpty) {
      const def = ITEMS_BY_ID[slot.itemId];
      if (!def) continue;
      const row = el('div', 'lw-list-row');
      const info = el('div', '');
      const titleLine = el('div', 'lw-hud-title');
      titleLine.appendChild(this.createItemSpriteSpan(def.id));
      titleLine.appendChild(el('strong', '', `${def.nameEn} (${def.nameVi}) x${slot.quantity}`));
      info.appendChild(titleLine);
      const desc = el('div', 'lw-hud-quest');
      desc.appendChild(this.renderInteractiveEnglish(def.descriptionEn, 'bag_item'));
      info.appendChild(desc);
      row.appendChild(info);

      if (def.category === 'tonic' || def.category === 'remedy' || def.category === 'lantern') {
        const useBtn = el('button', 'lw-btn lw-btn-moss', 'Use');
        useBtn.addEventListener('click', () => this.controller.useBagItemInField(def.id, 0));
        row.appendChild(useBtn);
      }
      container.appendChild(row);
    }
  }

  private renderCompendiumTab(container: HTMLElement): void {
    const state = this.controller.state;
    const grid = el('div', 'lw-species-grid');
    for (const sp of this.controller.getAllSpecies()) {
      const seen = state.discoveredSpecies.includes(sp.id);
      const caught = state.caughtSpecies.includes(sp.id);
      const card = el('div', 'lw-journal-entry');
      if (!seen) {
        card.appendChild(el('strong', '', `#${String(sp.dexNumber).padStart(2, '0')} ???`));
        card.appendChild(
          el('div', 'lw-hud-quest', `Habitat: ${sp.habitatIds.map((h) => MAPS_BY_ID[h].nameEn).join(', ')}`),
        );
      } else {
        const top = el('div', 'lw-hud-title');
        top.appendChild(this.createCreatureSpriteSpan(sp.dexNumber));
        top.appendChild(
          el(
            'strong',
            '',
            `#${String(sp.dexNumber).padStart(2, '0')} ${sp.name} ${caught ? '[Bonded]' : '[Seen]'}`,
          ),
        );
        card.appendChild(top);
        card.appendChild(el('div', 'lw-hud-quest', `${sp.titleEn} | ${sp.titleVi}`));
        const note = el('div', '');
        note.style.fontSize = '0.84rem';
        note.style.margin = '4px 0';
        note.appendChild(this.renderInteractiveEnglish(sp.fieldNoteEn, 'compendium'));
        card.appendChild(note);

        const storyBtn = el('button', 'lw-btn', 'Read Field Story');
        storyBtn.addEventListener('click', () => {
          this.controller.closeModal();
          this.controller.openDialogueById(`field_story_${sp.id}`);
          this.render();
        });
        card.appendChild(storyBtn);
      }
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }

  private renderLexiconTab(container: HTMLElement): void {
    const state = this.controller.state;
    const filterBar = el('div', 'lw-choice-list');
    filterBar.style.marginBottom = '10px';
    for (const [fKey, label] of [
      ['encountered', `Seen Words (${Object.keys(state.lexicon).length})`],
      [
        'saved',
        `Saved (${Object.values(state.lexicon).filter((m) => m.savedByPlayer).length})`,
      ],
      ['all', `Full Lexicon (${LEXICON_ENTRIES.length})`],
      ['dispatches', 'Field Advisories (24)'],
    ] as const) {
      const b = el(
        'button',
        this.lexiconFilter === fKey ? 'lw-btn lw-btn-primary' : 'lw-btn',
        label,
      );
      b.addEventListener('click', () => {
        this.lexiconFilter = fKey;
        this.render();
      });
      filterBar.appendChild(b);
    }
    container.appendChild(filterBar);

    if (this.lexiconFilter === 'dispatches') {
      const dispatches = DIALOGUES.filter((d) => d.contextTag === 'ranger_dispatch');
      for (const disp of dispatches) {
        const row = el('div', 'lw-list-row');
        row.appendChild(el('span', '', `${disp.speaker} (${disp.cefr})`));
        const readBtn = el('button', 'lw-btn', 'Read Note');
        readBtn.addEventListener('click', () => {
          this.controller.closeModal();
          this.controller.openDialogueById(disp.id);
          this.render();
        });
        row.appendChild(readBtn);
        container.appendChild(row);
      }
      return;
    }

    const items = LEXICON_ENTRIES.filter((entry) => {
      const mem = state.lexicon[entry.id];
      if (this.lexiconFilter === 'saved') return Boolean(mem?.savedByPlayer);
      if (this.lexiconFilter === 'encountered') return Boolean(mem);
      return true;
    }).slice(0, 80);

    if (items.length === 0) {
      container.appendChild(
        el('p', '', 'Explore trails and talk with Rangers to encounter words naturally!'),
      );
      return;
    }

    for (const entry of items) {
      const mem = state.lexicon[entry.id];
      const row = el('div', 'lw-list-row');
      const left = el('div', '');
      left.appendChild(
        el(
          'strong',
          '',
          `${entry.word} ${entry.phonetic} [${entry.cefr}] : ${entry.meaningVi} (Familiarity: ${mem?.mastery ?? 0}/3)`,
        ),
      );
      left.appendChild(el('div', 'lw-hud-quest', entry.exampleEn));
      row.appendChild(left);

      const acts = el('div', 'lw-hud-actions');
      const speakBtn = el('button', 'lw-btn', 'Listen');
      speakBtn.addEventListener('click', () =>
        this.controller.sound.speakEnglishWord(entry.word, entry.phonetic),
      );
      const saveBtn = el(
        'button',
        mem?.savedByPlayer ? 'lw-btn lw-btn-moss' : 'lw-btn',
        mem?.savedByPlayer ? 'Saved' : 'Save',
      );
      saveBtn.addEventListener('click', () => this.controller.toggleSavedWordById(entry.id));
      acts.append(speakBtn, saveBtn);
      row.appendChild(acts);
      container.appendChild(row);
    }
  }

  private renderSettingsTab(container: HTMLElement): void {
    const s = this.controller.state.settings;

    const addSelectRow = (
      label: string,
      current: string,
      options: ReadonlyArray<[string, string]>,
      onChange: (val: string) => void,
    ) => {
      const row = el('div', 'lw-list-row');
      row.appendChild(el('span', '', label));
      const sel = document.createElement('select');
      for (const [val, text] of options) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        opt.selected = current === val;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => onChange(sel.value));
      row.appendChild(sel);
      container.appendChild(row);
    };

    addSelectRow(
      'Highlight Target Level (Mức từ vựng gợi ý):',
      s.cefrBand,
      [
        ['A1', 'A1 (Beginner / Cơ bản)'],
        ['A2', 'A2 (Elementary / Sơ cấp)'],
        ['B1', 'B1 (Intermediate / Trung cấp)'],
        ['B2', 'B2 (Upper-Intermediate / Khá)'],
      ],
      (v) => this.controller.updateSettings({ cefrBand: v as 'A1' | 'A2' | 'B1' | 'B2' }),
    );

    addSelectRow(
      'Language Support Mode (Chế độ hỗ trợ):',
      s.supportMode,
      [
        ['contextual', 'Contextual (Chạm từ xem nghĩa)'],
        ['bilingual', 'Full Bilingual (Hiện sẵn phụ đề tiếng Việt)'],
        ['immersion', 'Immersion (Chỉ tiếng Anh, chạm từ khi cần)'],
      ],
      (v) =>
        this.controller.updateSettings({
          supportMode: v as 'immersion' | 'contextual' | 'bilingual',
        }),
    );

    addSelectRow(
      'Touch D-Pad Controls (Điều khiển cảm ứng):',
      s.touchControls,
      [
        ['auto', 'Auto (Tự động trên màn hình nhỏ)'],
        ['always', 'Always Show (Luôn hiện)'],
        ['off', 'Hidden (Ẩn)'],
      ],
      (v) => this.controller.updateSettings({ touchControls: v as 'auto' | 'always' | 'off' }),
    );

    addSelectRow(
      'Text Size (Cỡ chữ):',
      s.textScale,
      [
        ['normal', 'Normal (Chuẩn)'],
        ['large', 'Large (Chữ lớn dễ đọc)'],
      ],
      (v) => this.controller.updateSettings({ textScale: v as 'normal' | 'large' }),
    );

    const addCheckboxRow = (label: string, checked: boolean, onToggle: (next: boolean) => void) => {
      const row = el('div', 'lw-list-row');
      row.appendChild(el('span', '', label));
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', () => onToggle(input.checked));
      row.appendChild(input);
      container.appendChild(row);
    };

    addCheckboxRow('High Contrast Mode (Độ tương phản cao):', s.highContrast, (v) =>
      this.controller.updateSettings({ highContrast: v }),
    );
    addCheckboxRow('Reduced Motion (Giảm chuyển động):', s.reducedMotion, (v) =>
      this.controller.updateSettings({ reducedMotion: v }),
    );
    addCheckboxRow('Mute All Audio (Tắt toàn bộ âm thanh):', s.muted, (v) =>
      this.controller.updateSettings({ muted: v }),
    );

    const addSliderRow = (label: string, value: number, onInput: (v: number) => void) => {
      const row = el('div', 'lw-list-row');
      row.appendChild(el('span', '', `${label} (${Math.round(value * 100)}%)`));
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '100';
      range.value = String(Math.round(value * 100));
      range.addEventListener('change', () => onInput(Number(range.value) / 100));
      row.appendChild(range);
      container.appendChild(row);
    };

    addSliderRow('Music Volume (Âm lượng nhạc nền)', s.bgmVolume, (v) =>
      this.controller.updateSettings({ bgmVolume: v }),
    );
    addSliderRow('Effects Volume (Âm lượng hiệu ứng)', s.sfxVolume, (v) =>
      this.controller.updateSettings({ sfxVolume: v }),
    );

    container.appendChild(el('h4', '', 'Keyboard Remap (Đổi phím điều khiển)'));
    const rebindGrid = el('div', 'lw-choice-list');
    for (const [kField, label] of [
      ['up', 'Up'],
      ['down', 'Down'],
      ['left', 'Left'],
      ['right', 'Right'],
      ['interact', 'Interact'],
      ['journal', 'Journal'],
    ] as const) {
      const waiting = this.awaitingKeyRebind === kField;
      const b = el(
        'button',
        waiting ? 'lw-btn lw-btn-primary' : 'lw-btn',
        waiting ? `Press key for ${label}...` : `${label}: ${s.keyMap[kField]}`,
      );
      b.addEventListener('click', () => {
        this.awaitingKeyRebind = kField;
        this.render();
      });
      rebindGrid.appendChild(b);
    }
    container.appendChild(rebindGrid);

    container.appendChild(el('h4', '', 'Save & Backup (Lưu trữ an toàn)'));
    const saveRow = el('div', 'lw-choice-list');
    const saveNowBtn = el('button', 'lw-btn lw-btn-moss', 'Save Progress Now');
    saveNowBtn.setAttribute('data-testid', 'btn-save-now');
    saveNowBtn.addEventListener('click', () => {
      this.controller.persistState();
      this.controller.pushToast('Progress saved locally!', 'Đã lưu tiến trình vào trình duyệt!');
      this.render();
    });

    const exportBtn = el('button', 'lw-btn lw-btn-primary', 'Export Save (.json)');
    exportBtn.setAttribute('data-testid', 'btn-export-save');
    exportBtn.addEventListener('click', () => {
      const json = this.controller.exportSaveFileContent();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lingowild-save-step-${this.controller.state.stepCount}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const importLabel = el('label', 'lw-btn', 'Import Save (.json)');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.setAttribute('data-testid', 'input-import-save');
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      void f.text().then((txt) => {
        const res = this.controller.importSaveFileContent(txt);
        if (!res.ok) {
          this.controller.pushToast(
            `Import rejected: ${res.error ?? 'invalid'}`,
            `Từ chối tệp lưu lỗi: ${res.error ?? 'không hợp lệ'}`,
          );
          this.render();
        }
      });
    });
    importLabel.appendChild(fileInput);

    saveRow.append(saveNowBtn, exportBtn, importLabel);
    container.appendChild(saveRow);
  }

  private buildSupplyPostModal(): HTMLElement {
    const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
    const card = el('section', 'lw-notebook');
    card.style.maxWidth = '640px';
    card.setAttribute('data-testid', 'supply-post-modal');

    const header = el('header', 'lw-notebook-header');
    header.appendChild(
      el('strong', '', `Expedition Supply Post | Your Tokens: ${this.controller.state.tokens}`),
    );
    const closeBtn = el('button', 'lw-btn', 'Close');
    closeBtn.addEventListener('click', () => this.controller.closeModal());
    header.appendChild(closeBtn);
    card.appendChild(header);

    const body = el('div', 'lw-notebook-body');
    for (const item of this.controller.getShopItems()) {
      const owned =
        this.controller.state.inventory.find((s) => s.itemId === item.id)?.quantity ?? 0;
      const row = el('div', 'lw-list-row');
      const left = el('div', '');
      const titleLine = el('div', 'lw-hud-title');
      titleLine.appendChild(this.createItemSpriteSpan(item.id));
      titleLine.appendChild(
        el('strong', '', `${item.nameEn} (${item.nameVi}) | ${item.price} Tokens (Bag: ${owned})`),
      );
      left.appendChild(titleLine);
      left.appendChild(el('div', 'lw-hud-quest', item.descriptionEn));
      row.appendChild(left);

      const buyBtn = el('button', 'lw-btn lw-btn-primary', 'Exchange 1x');
      buyBtn.setAttribute('data-testid', `btn-buy-${item.id}`);
      buyBtn.addEventListener('click', () => this.controller.purchaseItem(item.id, 1));
      row.appendChild(buyBtn);
      body.appendChild(row);
    }

    card.appendChild(body);
    backdrop.appendChild(card);
    return backdrop;
  }

  private buildCampReviewModal(): HTMLElement {
    const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
    const card = el('section', 'lw-notebook');
    card.style.maxWidth = '580px';
    card.setAttribute('data-testid', 'camp-review-modal');

    const header = el('header', 'lw-notebook-header');
    header.appendChild(el('strong', '', 'Campfire Word Practice (Tự nguyện, không tính phạt)'));
    const skipBtn = el('button', 'lw-btn', 'Finish Anytime');
    skipBtn.addEventListener('click', () => {
      this.campAnsweredCurrent = false;
      this.campAnsweredMessageVi = '';
      this.controller.closeModal();
    });
    header.appendChild(skipBtn);
    card.appendChild(header);

    const body = el('div', 'lw-notebook-body');
    const prompt = this.controller.campPrompts[this.controller.campPromptIndex];
    if (!prompt) {
      body.appendChild(el('p', '', 'No words queued yet. Read signs and talk to Rangers first!'));
      card.appendChild(body);
      backdrop.appendChild(card);
      return backdrop;
    }

    body.appendChild(
      el(
        'div',
        'lw-hud-quest',
        `Card ${this.controller.campPromptIndex + 1} of ${this.controller.campPrompts.length}`,
      ),
    );
    const wordHeading = el('h3', '', `${prompt.entry.word} ${prompt.entry.phonetic}`);
    body.appendChild(wordHeading);
    body.appendChild(el('p', 'lw-battle-log', prompt.promptSentenceEn));

    const choices = el('div', 'lw-move-grid');
    for (const ch of prompt.choices) {
      const cBtn = el('button', 'lw-btn', ch.meaningVi) as HTMLButtonElement;
      cBtn.disabled = this.campAnsweredCurrent;
      cBtn.addEventListener('click', () => {
        const res = this.controller.answerCampfirePrompt(ch.wordId);
        this.campAnsweredCurrent = true;
        this.campAnsweredMessageVi = res.matched
          ? `Chính xác! "${prompt.entry.word}" nghĩa là "${prompt.entry.meaningVi}". (${prompt.promptSentenceVi})`
          : `Gợi nhớ nhẹ nhàng: "${prompt.entry.word}" có nghĩa là "${prompt.entry.meaningVi}". (${prompt.promptSentenceVi})`;
        this.render();
      });
      choices.appendChild(cBtn);
    }
    body.appendChild(choices);

    if (this.campAnsweredCurrent) {
      const fb = el('p', 'lw-battle-log', this.campAnsweredMessageVi);
      fb.style.marginTop = '10px';
      body.appendChild(fb);
      const nextBtn = el('button', 'lw-btn lw-btn-primary', 'Next Card / Tiếp tục');
      nextBtn.addEventListener('click', () => {
        this.campAnsweredCurrent = false;
        this.campAnsweredMessageVi = '';
        this.controller.nextCampfirePrompt();
      });
      body.appendChild(nextBtn);
    }

    card.appendChild(body);
    backdrop.appendChild(card);
    return backdrop;
  }

  private buildTouchPad(): HTMLElement {
    const wrap = el('div', 'lw-touch-controls');
    const dpad = el('div', 'lw-dpad lw-interactive');

    const cells: Array<{ dir?: Direction; label: string }> = [
      { label: '' },
      { dir: 'up', label: 'U' },
      { label: '' },
      { dir: 'left', label: 'L' },
      { label: '' },
      { dir: 'right', label: 'R' },
      { label: '' },
      { dir: 'down', label: 'D' },
      { label: '' },
    ];

    for (const c of cells) {
      if (!c.dir) {
        dpad.appendChild(el('div', ''));
        continue;
      }
      const btn = el('button', 'lw-dpad-btn', c.label);
      btn.setAttribute('aria-label', `Move ${c.dir}`);
      btn.setAttribute('data-testid', `touch-${c.dir}`);
      const d = c.dir;
      btn.addEventListener('click', () => this.controller.movePlayer(d));
      dpad.appendChild(btn);
    }

    const actions = el('div', 'lw-touch-actions lw-interactive');
    const actBtn = el('button', 'lw-btn lw-btn-primary lw-touch-circle', 'A');
    actBtn.setAttribute('aria-label', 'Interact');
    actBtn.setAttribute('data-testid', 'touch-interact');
    actBtn.addEventListener('click', () => this.controller.interactFacing());

    const jBtn = el('button', 'lw-btn lw-touch-circle', 'J');
    jBtn.setAttribute('aria-label', 'Open Field Journal');
    jBtn.setAttribute('data-testid', 'touch-journal');
    jBtn.addEventListener('click', () => this.controller.openJournal('quests'));

    actions.append(actBtn, jBtn);
    wrap.append(dpad, actions);
    return wrap;
  }
}

function el(tag: string, className: string, textContent?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}

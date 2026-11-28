import { DIALOGUES } from '../data/dialogues.ts';
import { ITEMS_BY_ID } from '../data/items.ts';
import { LEXICON_ENTRIES, LEXICON_INDEX } from '../data/lexicon.ts';
import { MAPS, MAPS_BY_ID } from '../data/maps.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import { ELEMENT_LABELS } from '../domain/elements.ts';
import { isWordDueForReencounter, pickIndependentExample } from '../domain/learning.ts';
import { isQuestConditionMet } from '../domain/quests.ts';
import type { BattleSpeedMode, KeyBindingMap, RegionId } from '../domain/types.ts';
import type { GameController, JournalTab } from '../game/controller.ts';
import {
  createCreatureSpriteSpan,
  createItemSpriteSpan,
  el,
  RARITY_LABELS,
  renderInteractiveEnglish,
  ROLE_LABELS,
} from './uiHelpers.ts';

export type LexiconFilter = 'encountered' | 'saved' | 'mastered' | 'due' | 'all' | 'dispatches';

export interface JournalViewState {
  lexiconFilter: LexiconFilter;
  campAnsweredCurrent: boolean;
  campAnsweredMessageVi: string;
  awaitingKeyRebind: keyof KeyBindingMap | null;
}

const SECRET_FLAGS = [
  'found_whisperwood_secret',
  'found_fen_secret',
  'found_ridge_secret',
  'found_sanctuary_secret',
] as const;

export function buildJournalModal(
  controller: GameController,
  viewState: JournalViewState,
  onRerender: () => void,
): HTMLElement {
  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const notebook = el('section', 'lw-notebook');
  notebook.setAttribute('data-testid', 'journal-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(
    el(
      'strong',
      '',
      `Field Journal | Bonded: ${controller.state.caughtSpecies.length}/30 | Tokens: ${controller.state.tokens}`,
    ),
  );
  const closeBtn = el('button', 'lw-btn lw-btn-sm', 'Close (Esc)');
  closeBtn.setAttribute('data-testid', 'btn-close-journal');
  closeBtn.addEventListener('click', () => controller.closeModal());
  header.appendChild(closeBtn);
  notebook.appendChild(header);

  const tabsRow = el('nav', 'lw-tabs');
  const tabDefs: ReadonlyArray<[JournalTab, string]> = [
    ['quests', 'Quests'],
    ['map', 'Basin Map'],
    ['team', 'Team'],
    ['bag', 'Bag'],
    ['compendium', 'Wildkin (30)'],
    ['lexicon', 'Lexicon'],
    ['settings', 'Settings & Save'],
  ];
  for (const [key, label] of tabDefs) {
    const tb = el('button', 'lw-tab-btn', label);
    tb.setAttribute('aria-selected', String(controller.journalTab === key));
    tb.setAttribute('data-testid', `journal-tab-${key}`);
    tb.addEventListener('click', () => {
      controller.journalTab = key;
      onRerender();
    });
    tabsRow.appendChild(tb);
  }
  notebook.appendChild(tabsRow);

  const body = el('div', 'lw-notebook-body');
  const tab = controller.journalTab;
  if (tab === 'quests') renderQuestsTab(controller, body);
  else if (tab === 'map') renderWorldMapTab(controller, body);
  else if (tab === 'team') renderTeamTab(controller, body);
  else if (tab === 'bag') renderBagTab(controller, body);
  else if (tab === 'compendium') renderCompendiumTab(controller, body, onRerender);
  else if (tab === 'lexicon') renderLexiconTab(controller, body, viewState, onRerender);
  else renderSettingsTab(controller, body, viewState, onRerender);

  notebook.appendChild(body);
  backdrop.appendChild(notebook);
  return backdrop;
}

function renderQuestsTab(controller: GameController, container: HTMLElement): void {
  const state = controller.state;

  const secretsFound = SECRET_FLAGS.filter((f) => Boolean(state.flags[f])).length;
  const masteryBanner = el('div', 'lw-journal-entry lw-mastery-card');
  masteryBanner.style.marginBottom = '10px';
  masteryBanner.appendChild(
    el('strong', '', 'Expedition & Post-Game Mastery | Tiến Độ Khám Phá Chuyên Sâu'),
  );
  masteryBanner.appendChild(
    el(
      'div',
      'lw-hud-quest',
      `Habitat Traces: ${state.discoveredTraces.length}/4 | Secret Caches: ${secretsFound}/4 | Warden Rematches: ${state.rematchCleared.length}/4 | Gleaming Variants: ${state.gleamingSpecies.length} | Chronicles Read: ${state.readLoreIds.length}`,
    ),
  );
  container.appendChild(masteryBanner);

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
    card.appendChild(el('div', 'lw-hud-quest', `${q.summaryEn} | ${q.summaryVi}`));

    for (const st of q.steps) {
      const done = isQuestConditionMet(st.condition, state, SPECIES_BY_ID);
      const stepLine = el(
        'div',
        'lw-quest-step',
        `${done ? '[x]' : '[ ]'} ${st.descriptionEn} | ${st.descriptionVi}`,
      );
      card.appendChild(stepLine);
    }
    container.appendChild(card);
  }
}

function renderWorldMapTab(controller: GameController, container: HTMLElement): void {
  const state = controller.state;
  container.appendChild(
    el(
      'p',
      'lw-hud-quest',
      'Verdant Basin Regional Atlas | Bản đồ năm vùng sinh thái liên thông quanh Trại Đèn Rêu.',
    ),
  );

  const layoutGrid = el('div', 'lw-atlas-compass');
  const nodeMeta: ReadonlyArray<{
    regionId: RegionId;
    slotClass: string;
    unlockFlag?: string;
    stoneFlag?: string;
    directionLabel: string;
  }> = [
    {
      regionId: 'starfall_sanctuary',
      slotClass: 'lw-atlas-north',
      unlockFlag: 'warden_kaelen_cleared',
      stoneFlag: 'main_story_completed',
      directionLabel: 'North Summit',
    },
    {
      regionId: 'whisperwood',
      slotClass: 'lw-atlas-west',
      unlockFlag: 'has_starter',
      stoneFlag: 'warden_sylvan_cleared',
      directionLabel: 'West Woodland',
    },
    {
      regionId: 'mosslight_hub',
      slotClass: 'lw-atlas-center',
      directionLabel: 'Central Village',
    },
    {
      regionId: 'reedwater_fen',
      slotClass: 'lw-atlas-east',
      unlockFlag: 'warden_sylvan_cleared',
      stoneFlag: 'warden_mirella_cleared',
      directionLabel: 'East Wetland',
    },
    {
      regionId: 'terracotta_ridge',
      slotClass: 'lw-atlas-south',
      unlockFlag: 'warden_mirella_cleared',
      stoneFlag: 'warden_kaelen_cleared',
      directionLabel: 'South Canyon',
    },
  ];

  for (const item of nodeMeta) {
    const map = MAPS_BY_ID[item.regionId];
    const isHere = state.regionId === item.regionId;
    const isUnlocked = !item.unlockFlag || Boolean(state.flags[item.unlockFlag]);
    const isHarmonized = item.stoneFlag ? Boolean(state.flags[item.stoneFlag]) : true;
    const traceProp = map.props.find((p) => p.kind === 'trace');
    const traceFound = traceProp ? state.discoveredTraces.includes(traceProp.id) : false;

    const card = el('div', `lw-atlas-card ${item.slotClass}`);
    if (isHere) card.dataset.current = 'true';

    const top = el('div', 'lw-hud-title');
    top.appendChild(el('span', 'lw-badge', item.directionLabel));
    if (isHere) {
      top.appendChild(
        el(
          'span',
          'lw-badge lw-badge-eff-good',
          `Here (${state.playerPos.x},${state.playerPos.y})`,
        ),
      );
    } else if (!isUnlocked) {
      top.appendChild(el('span', 'lw-badge', 'Gated'));
    } else if (item.stoneFlag && isHarmonized) {
      top.appendChild(el('span', 'lw-badge lw-badge-eff-good', 'Resonant'));
    }
    card.appendChild(top);

    card.appendChild(el('strong', '', `${map.nameEn} | ${map.nameVi}`));
    card.appendChild(el('div', 'lw-hud-quest', map.subtitleVi));

    const speciesHere = MAPS.find((m) => m.id === item.regionId)?.encounters.length ?? 0;
    if (speciesHere > 0) {
      card.appendChild(
        el(
          'div',
          'lw-hud-quest',
          `Wild habitats: ${speciesHere} species | Trace: ${traceFound ? 'Logged' : 'Unchecked'}`,
        ),
      );
    }
    layoutGrid.appendChild(card);
  }
  container.appendChild(layoutGrid);
}

function renderTeamTab(controller: GameController, container: HTMLElement): void {
  const state = controller.state;
  container.appendChild(
    el(
      'h4',
      '',
      `Active Expedition Team (${state.party.length}/6) | Lead walks behind you on the map`,
    ),
  );
  state.party.forEach((member, idx) => {
    const sp = SPECIES_BY_ID[member.speciesId]!;
    const row = el('div', 'lw-list-row');
    const left = el('div', 'lw-hud-title');
    left.appendChild(
      createCreatureSpriteSpan(sp.dexNumber, { gleaming: Boolean(member.isRareVariant) }),
    );
    const info = el('div', '');
    const gleamTag = member.isRareVariant ? ' [Gleaming]' : '';
    info.appendChild(
      el(
        'strong',
        '',
        `${idx === 0 ? '[Lead] ' : ''}${sp.name}${gleamTag} Lv.${member.level} (${ELEMENT_LABELS[sp.element].en} | ${ROLE_LABELS[sp.combatRole].en})`,
      ),
    );
    const evoHint = sp.evolvesTo
      ? ` | Evolves Lv.${sp.evolvesTo.level} -> ${SPECIES_BY_ID[sp.evolvesTo.speciesId]?.name ?? ''}`
      : ' | Final Form';
    info.appendChild(
      el(
        'div',
        'lw-hud-quest',
        `HP ${member.currentHp}/${member.maxHp} | ATK ${member.stats.atk} DEF ${member.stats.def} SPD ${member.stats.spd}${evoHint}`,
      ),
    );
    left.appendChild(info);
    row.appendChild(left);

    const actions = el('div', 'lw-hud-actions');
    if (idx > 0) {
      const leadBtn = el('button', 'lw-btn lw-btn-sm', 'Make Lead');
      leadBtn.addEventListener('click', () => controller.makePartyLead(idx));
      actions.appendChild(leadBtn);
    }
    if (member.currentHp < member.maxHp) {
      const healBtn = el('button', 'lw-btn lw-btn-moss lw-btn-sm', 'Use Dew Tonic');
      healBtn.addEventListener('click', () => controller.useBagItemInField('dew_tonic', idx));
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
      left.appendChild(
        createCreatureSpriteSpan(sp.dexNumber, { gleaming: Boolean(boxMember.isRareVariant) }),
      );
      left.appendChild(
        el('span', '', `${sp.name} Lv.${boxMember.level} (${ELEMENT_LABELS[sp.element].en})`),
      );
      row.appendChild(left);

      const swapBtn = el('button', 'lw-btn lw-btn-sm', 'Swap with Last Slot');
      swapBtn.addEventListener('click', () =>
        controller.swapPartyAndReserve(Math.max(0, state.party.length - 1), bIdx),
      );
      row.appendChild(swapBtn);
      container.appendChild(row);
    });
  }
}

function renderBagTab(controller: GameController, container: HTMLElement): void {
  const nonEmpty = controller.state.inventory.filter((s) => s.quantity > 0);
  for (const slot of nonEmpty) {
    const def = ITEMS_BY_ID[slot.itemId];
    if (!def) continue;
    const row = el('div', 'lw-list-row');
    const info = el('div', '');
    const titleLine = el('div', 'lw-hud-title');
    titleLine.appendChild(createItemSpriteSpan(def.id));
    titleLine.appendChild(el('strong', '', `${def.nameEn} (${def.nameVi}) x${slot.quantity}`));
    info.appendChild(titleLine);
    const desc = el('div', 'lw-hud-quest');
    desc.appendChild(renderInteractiveEnglish(controller, def.descriptionEn, 'bag_item'));
    info.appendChild(desc);
    row.appendChild(info);

    if (def.category === 'tonic' || def.category === 'remedy' || def.category === 'lantern') {
      const useBtn = el('button', 'lw-btn lw-btn-moss lw-btn-sm', 'Use');
      useBtn.addEventListener('click', () => controller.useBagItemInField(def.id, 0));
      row.appendChild(useBtn);
    }
    container.appendChild(row);
  }
}

function renderCompendiumTab(
  controller: GameController,
  container: HTMLElement,
  onRerender: () => void,
): void {
  const state = controller.state;
  container.appendChild(
    el(
      'p',
      'lw-hud-quest',
      `Discovered: ${state.discoveredSpecies.length}/30 | Bonded: ${state.caughtSpecies.length}/30 | Gleaming Variants: ${state.gleamingSpecies.length}/30`,
    ),
  );
  const grid = el('div', 'lw-species-grid');
  for (const sp of controller.getAllSpecies()) {
    const seen = state.discoveredSpecies.includes(sp.id);
    const caught = state.caughtSpecies.includes(sp.id);
    const hasGleaming = state.gleamingSpecies.includes(sp.id);
    const card = el('div', 'lw-journal-entry');
    if (!seen) {
      const top = el('div', 'lw-hud-title');
      top.appendChild(createCreatureSpriteSpan(sp.dexNumber, { silhouette: true }));
      const meta = el('div', '');
      meta.appendChild(
        el('strong', '', `#${String(sp.dexNumber).padStart(2, '0')} Uncharted Wildkin`),
      );
      meta.appendChild(
        el(
          'div',
          'lw-hud-quest',
          `Habitat: ${sp.habitatIds.map((h) => MAPS_BY_ID[h].nameEn).join(', ')}`,
        ),
      );
      if (sp.preferredTime && sp.preferredTime.length > 0) {
        meta.appendChild(
          el('div', 'lw-hud-quest', `Active time: ${sp.preferredTime.join(', ')}`),
        );
      }
      top.appendChild(meta);
      card.appendChild(top);
    } else {
      const top = el('div', 'lw-hud-title');
      top.appendChild(createCreatureSpriteSpan(sp.dexNumber, { gleaming: hasGleaming }));
      const meta = el('div', '');
      meta.appendChild(
        el(
          'strong',
          '',
          `#${String(sp.dexNumber).padStart(2, '0')} ${sp.name} ${caught ? '[Bonded]' : '[Sighted]'}`,
        ),
      );
      const tags = el('div', 'lw-hud-title');
      const rInfo = RARITY_LABELS[sp.rarity];
      const rBadge = el('span', 'lw-badge lw-badge-element', rInfo.en);
      rBadge.style.background = rInfo.color;
      tags.append(rBadge, el('span', 'lw-badge', ROLE_LABELS[sp.combatRole].en));
      if (hasGleaming) {
        tags.appendChild(el('span', 'lw-badge lw-badge-gleaming', 'Gleaming'));
      }
      meta.appendChild(tags);
      top.appendChild(meta);
      card.appendChild(top);

      card.appendChild(el('div', 'lw-hud-quest', `${sp.titleEn} | ${sp.titleVi}`));
      if (caught) {
        const note = el('div', 'lw-compendium-note');
        note.appendChild(renderInteractiveEnglish(controller, sp.fieldNoteEn, 'compendium'));
        card.appendChild(note);
        if (sp.evolvesTo) {
          const nextName = SPECIES_BY_ID[sp.evolvesTo.speciesId]?.name ?? sp.evolvesTo.speciesId;
          card.appendChild(
            el('div', 'lw-hud-quest', `Evolution: Lv.${sp.evolvesTo.level} -> ${nextName}`),
          );
        }
        const storyBtn = el('button', 'lw-btn lw-btn-sm', 'Read Field Story');
        storyBtn.addEventListener('click', () => {
          controller.closeModal();
          controller.openDialogueById(`field_story_${sp.id}`);
          onRerender();
        });
        card.appendChild(storyBtn);
      } else {
        card.appendChild(
          el(
            'div',
            'lw-hud-quest',
            `Habitat: ${sp.habitatIds.map((h) => MAPS_BY_ID[h].nameEn).join(', ')} (Bond with a chime to unlock full ecological notes)`,
          ),
        );
      }
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function renderLexiconTab(
  controller: GameController,
  container: HTMLElement,
  viewState: JournalViewState,
  onRerender: () => void,
): void {
  const state = controller.state;
  const encounteredCount = Object.keys(state.lexicon).length;
  const savedCount = Object.values(state.lexicon).filter((m) => m.savedByPlayer).length;
  const masteredCount = Object.values(state.lexicon).filter((m) => m.mastery >= 3).length;
  const dueCount = Object.values(state.lexicon).filter((m) =>
    isWordDueForReencounter(m, state),
  ).length;

  const filterBar = el('div', 'lw-choice-list');
  filterBar.style.marginBottom = '10px';
  for (const [fKey, label] of [
    ['encountered', `Encountered (${encounteredCount})`],
    ['saved', `Saved (${savedCount})`],
    ['mastered', `Mastered (${masteredCount})`],
    ['due', `Due Now (${dueCount})`],
    ['all', `All (${LEXICON_ENTRIES.length})`],
    ['dispatches', `Field Advisories (${DIALOGUES.filter((d) => d.contextTag === 'ranger_dispatch').length})`],
  ] as const) {
    const b = el(
      'button',
      viewState.lexiconFilter === fKey ? 'lw-btn lw-btn-primary lw-btn-sm' : 'lw-btn lw-btn-sm',
      label,
    );
    b.setAttribute('data-testid', `lexicon-filter-${fKey}`);
    b.addEventListener('click', () => {
      viewState.lexiconFilter = fKey;
      onRerender();
    });
    filterBar.appendChild(b);
  }
  container.appendChild(filterBar);

  if (viewState.lexiconFilter === 'dispatches') {
    const dispatches = DIALOGUES.filter((d) => d.contextTag === 'ranger_dispatch');
    for (const disp of dispatches) {
      const isRead = state.readLoreIds.includes(disp.id);
      const row = el('div', 'lw-list-row');
      row.appendChild(
        el('span', '', `${isRead ? '[Read] ' : '[Unread] '}${disp.speaker} (${disp.cefr})`),
      );
      const readBtn = el('button', 'lw-btn lw-btn-sm', 'Read Note');
      readBtn.addEventListener('click', () => {
        controller.closeModal();
        controller.openDialogueById(disp.id);
        onRerender();
      });
      row.appendChild(readBtn);
      container.appendChild(row);
    }
    return;
  }

  const items = LEXICON_ENTRIES.filter((entry) => {
    const mem = state.lexicon[entry.id];
    if (viewState.lexiconFilter === 'saved') return Boolean(mem?.savedByPlayer);
    if (viewState.lexiconFilter === 'mastered') return Boolean(mem && mem.mastery >= 3);
    if (viewState.lexiconFilter === 'due') {
      return Boolean(mem && isWordDueForReencounter(mem, state));
    }
    if (viewState.lexiconFilter === 'encountered') return Boolean(mem);
    return true;
  }).slice(0, 90);

  if (items.length === 0) {
    container.appendChild(
      el('p', '', 'No entries match this filter yet. Explore trails and chat with Rangers naturally!'),
    );
    return;
  }

  for (const entry of items) {
    const mem = state.lexicon[entry.id];
    const ex = pickIndependentExample(entry, state.regionId, mem?.exposures ?? 0);
    const row = el('div', 'lw-list-row');
    const left = el('div', '');
    const statusLabel =
      mem && mem.mastery >= 3
        ? ' [Mastered]'
        : mem?.savedByPlayer
          ? ' [Saved]'
          : mem
            ? ' [Encountered]'
            : '';
    left.appendChild(
      el(
        'strong',
        '',
        `${entry.word} ${entry.phonetic} [${entry.pos} | ${entry.cefr}] : ${entry.meaningVi}${statusLabel}`,
      ),
    );
    left.appendChild(
      el(
        'div',
        'lw-hud-quest',
        `Encountered ${mem?.exposures ?? 0}x | Lookups ${mem?.glossLookups ?? 0}x | Mastery ${mem?.mastery ?? 0}/3`,
      ),
    );
    left.appendChild(el('div', 'lw-hud-quest', ex.en));
    row.appendChild(left);

    const acts = el('div', 'lw-hud-actions');
    const speakBtn = el('button', 'lw-btn lw-btn-sm', 'Listen');
    speakBtn.addEventListener('click', () =>
      controller.sound.speakEnglishWord(entry.word, entry.phonetic),
    );
    const saveBtn = el(
      'button',
      mem?.savedByPlayer ? 'lw-btn lw-btn-moss lw-btn-sm' : 'lw-btn lw-btn-sm',
      mem?.savedByPlayer ? 'Saved' : 'Save',
    );
    saveBtn.addEventListener('click', () => controller.toggleSavedWordById(entry.id));
    acts.append(speakBtn, saveBtn);
    row.appendChild(acts);
    container.appendChild(row);
  }
}

function renderSettingsTab(
  controller: GameController,
  container: HTMLElement,
  viewState: JournalViewState,
  onRerender: () => void,
): void {
  const s = controller.state.settings;

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
    'Adaptive English Band (Mức hội thoại & gợi ý từ):',
    s.cefrBand,
    [
      ['A1', 'A1 (Cơ bản)'],
      ['A2', 'A2 (Sơ cấp)'],
      ['B1', 'B1 (Trung cấp)'],
      ['B2', 'B2 (Nâng cao)'],
    ],
    (v) => controller.updateSettings({ cefrBand: v as 'A1' | 'A2' | 'B1' | 'B2' }),
  );

  addSelectRow(
    'Language Support Mode (Chế độ hỗ trợ):',
    s.supportMode,
    [
      ['contextual', 'Contextual (Chạm từ xem nghĩa)'],
      ['bilingual', 'Bilingual (Hiện sẵn phụ đề tiếng Việt)'],
      ['immersion', 'Immersion (Chỉ tiếng Anh, chạm từ khi cần)'],
    ],
    (v) =>
      controller.updateSettings({
        supportMode: v as 'immersion' | 'contextual' | 'bilingual',
      }),
  );

  addSelectRow(
    'Battle Animation Pace (Nhịp hoạt ảnh chiến đấu):',
    s.battleSpeed ?? 'normal',
    [
      ['normal', 'Normal (1x Chuẩn)'],
      ['fast', 'Fast (2x Nhanh)'],
      ['instant', 'Instant (Bỏ qua hoạt ảnh)'],
    ],
    (v) => controller.updateSettings({ battleSpeed: v as BattleSpeedMode }),
  );

  addSelectRow(
    'Touch D-Pad Controls (Cụm điều khiển cảm ứng):',
    s.touchControls,
    [
      ['auto', 'Auto (Tự động trên thiết bị cảm ứng)'],
      ['always', 'Always Show (Luôn hiện)'],
      ['off', 'Hidden (Ẩn)'],
    ],
    (v) => controller.updateSettings({ touchControls: v as 'auto' | 'always' | 'off' }),
  );

  addSelectRow(
    'Text Size (Cỡ chữ):',
    s.textScale,
    [
      ['normal', 'Normal (Chuẩn)'],
      ['large', 'Large (Chữ lớn dễ đọc)'],
    ],
    (v) => controller.updateSettings({ textScale: v as 'normal' | 'large' }),
  );

  const addCheckboxRow = (
    label: string,
    checked: boolean,
    onToggle: (next: boolean) => void,
    testId?: string,
  ) => {
    const row = el('div', 'lw-list-row');
    row.appendChild(el('span', '', label));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    if (testId) input.setAttribute('data-testid', testId);
    input.addEventListener('change', () => onToggle(input.checked));
    row.appendChild(input);
    container.appendChild(row);
  };

  addCheckboxRow(
    'Show Companion Follower (Sinh vật dẫn đầu đi theo sau):',
    s.showFollower !== false,
    (v) => controller.updateSettings({ showFollower: v }),
    'checkbox-show-follower',
  );
  addCheckboxRow('High Contrast Mode (Độ tương phản cao):', s.highContrast, (v) =>
    controller.updateSettings({ highContrast: v }),
  );
  addCheckboxRow('Reduced Motion (Giảm chuyển động):', s.reducedMotion, (v) =>
    controller.updateSettings({ reducedMotion: v }),
  );
  addCheckboxRow('Mute All Audio (Tắt toàn bộ âm thanh):', s.muted, (v) =>
    controller.updateSettings({ muted: v }),
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
    controller.updateSettings({ bgmVolume: v }),
  );
  addSliderRow('Effects Volume (Âm lượng hiệu ứng)', s.sfxVolume, (v) =>
    controller.updateSettings({ sfxVolume: v }),
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
    const waiting = viewState.awaitingKeyRebind === kField;
    const b = el(
      'button',
      waiting ? 'lw-btn lw-btn-primary lw-btn-sm' : 'lw-btn lw-btn-sm',
      waiting ? `Press key for ${label}...` : `${label}: ${s.keyMap[kField]}`,
    );
    b.addEventListener('click', () => {
      viewState.awaitingKeyRebind = kField;
      onRerender();
    });
    rebindGrid.appendChild(b);
  }
  container.appendChild(rebindGrid);

  container.appendChild(el('h4', '', 'Save & Backup (Lưu trữ an toàn)'));
  if (controller.saveRepo.hasMultiTabConflict) {
    const conflictNote = el(
      'p',
      'lw-battle-log',
      'Phát hiện một tab khác vừa lưu tiến trình mới hơn. Bấm Đồng bộ để tải bản mới nhất trước khi lưu đè.',
    );
    container.appendChild(conflictNote);
  }
  const saveRow = el('div', 'lw-choice-list');
  const saveNowBtn = el('button', 'lw-btn lw-btn-moss', 'Save Progress Now');
  saveNowBtn.setAttribute('data-testid', 'btn-save-now');
  saveNowBtn.addEventListener('click', () => {
    controller.persistState();
    controller.pushToast('Progress saved locally!', 'Đã lưu tiến trình vào trình duyệt!');
    onRerender();
  });

  const exportBtn = el('button', 'lw-btn lw-btn-primary', 'Export Save (.json)');
  exportBtn.setAttribute('data-testid', 'btn-export-save');
  exportBtn.addEventListener('click', () => {
    const json = controller.exportSaveFileContent();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingowild-save-step-${controller.state.stepCount}.json`;
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
      const res = controller.importSaveFileContent(txt);
      if (!res.ok) {
        controller.pushToast(
          `Import rejected: ${res.error ?? 'invalid'}`,
          `Từ chối tệp lưu lỗi: ${res.error ?? 'không hợp lệ'}`,
        );
        onRerender();
      }
    });
  });
  importLabel.appendChild(fileInput);

  saveRow.append(saveNowBtn, exportBtn, importLabel);
  if (controller.saveRepo.hasMultiTabConflict) {
    const syncBtn = el('button', 'lw-btn lw-btn-primary', 'Sync Newer Tab Save');
    syncBtn.setAttribute('data-testid', 'btn-sync-newer-tab');
    syncBtn.addEventListener('click', () => {
      controller.syncNewerTabSave();
      onRerender();
    });
    saveRow.appendChild(syncBtn);
  }
  container.appendChild(saveRow);
  void LEXICON_INDEX;
}

export function buildSupplyPostModal(controller: GameController): HTMLElement {
  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const card = el('section', 'lw-notebook');
  card.style.maxWidth = '640px';
  card.setAttribute('data-testid', 'supply-post-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(
    el('strong', '', `Expedition Supply Post | Your Tokens: ${controller.state.tokens}`),
  );
  const closeBtn = el('button', 'lw-btn lw-btn-sm', 'Close');
  closeBtn.addEventListener('click', () => controller.closeModal());
  header.appendChild(closeBtn);
  card.appendChild(header);

  const body = el('div', 'lw-notebook-body');
  for (const item of controller.getShopItems()) {
    const owned = controller.state.inventory.find((s) => s.itemId === item.id)?.quantity ?? 0;
    const row = el('div', 'lw-list-row');
    const left = el('div', '');
    const titleLine = el('div', 'lw-hud-title');
    titleLine.appendChild(createItemSpriteSpan(item.id));
    titleLine.appendChild(
      el('strong', '', `${item.nameEn} (${item.nameVi}) | ${item.price} Tokens (Bag: ${owned})`),
    );
    left.appendChild(titleLine);
    left.appendChild(el('div', 'lw-hud-quest', item.descriptionEn));
    row.appendChild(left);

    const buyBtn = el('button', 'lw-btn lw-btn-primary lw-btn-sm', 'Exchange 1x');
    buyBtn.setAttribute('data-testid', `btn-buy-${item.id}`);
    buyBtn.addEventListener('click', () => controller.purchaseItem(item.id, 1));
    row.appendChild(buyBtn);
    body.appendChild(row);
  }

  card.appendChild(body);
  backdrop.appendChild(card);
  return backdrop;
}

export function buildCampReviewModal(
  controller: GameController,
  viewState: JournalViewState,
  onRerender: () => void,
): HTMLElement {
  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const card = el('section', 'lw-notebook');
  card.style.maxWidth = '580px';
  card.setAttribute('data-testid', 'camp-review-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(el('strong', '', 'Campfire Word Practice (Tự nguyện, không phạt)'));
  const skipBtn = el('button', 'lw-btn lw-btn-sm', 'Finish Anytime');
  skipBtn.addEventListener('click', () => {
    viewState.campAnsweredCurrent = false;
    viewState.campAnsweredMessageVi = '';
    controller.closeModal();
  });
  header.appendChild(skipBtn);
  card.appendChild(header);

  const body = el('div', 'lw-notebook-body');
  const prompt = controller.campPrompts[controller.campPromptIndex];
  if (!prompt) {
    body.appendChild(el('p', '', 'No words queued yet. Read signs and talk to Rangers first!'));
    card.appendChild(body);
    backdrop.appendChild(card);
    return backdrop;
  }

  const dueTag = prompt.isDueNow ? 'Due for Re-encounter' : 'Optional Warm-up';
  body.appendChild(
    el(
      'div',
      'lw-hud-quest',
      `Card ${controller.campPromptIndex + 1} of ${controller.campPrompts.length} | ${dueTag}`,
    ),
  );
  const wordHeading = el('h3', '', `${prompt.entry.word} ${prompt.entry.phonetic}`);
  body.appendChild(wordHeading);
  body.appendChild(el('p', 'lw-battle-log', prompt.promptSentenceEn));

  const choices = el('div', 'lw-move-grid');
  for (const ch of prompt.choices) {
    const cBtn = el('button', 'lw-btn', ch.meaningVi) as HTMLButtonElement;
    cBtn.disabled = viewState.campAnsweredCurrent;
    cBtn.addEventListener('click', () => {
      const res = controller.answerCampfirePrompt(ch.wordId);
      viewState.campAnsweredCurrent = true;
      viewState.campAnsweredMessageVi = res.matched
        ? `Chính xác! "${prompt.entry.word}" nghĩa là "${prompt.entry.meaningVi}". (${prompt.promptSentenceVi})`
        : `Gợi nhớ nhẹ nhàng: "${prompt.entry.word}" có nghĩa là "${prompt.entry.meaningVi}". (${prompt.promptSentenceVi})`;
      onRerender();
    });
    choices.appendChild(cBtn);
  }
  body.appendChild(choices);

  if (viewState.campAnsweredCurrent) {
    const fb = el('p', 'lw-battle-log', viewState.campAnsweredMessageVi);
    fb.style.marginTop = '10px';
    body.appendChild(fb);
    const nextBtn = el('button', 'lw-btn lw-btn-primary', 'Next Card / Tiếp tục');
    nextBtn.addEventListener('click', () => {
      viewState.campAnsweredCurrent = false;
      viewState.campAnsweredMessageVi = '';
      controller.nextCampfirePrompt();
    });
    body.appendChild(nextBtn);
  }

  card.appendChild(body);
  backdrop.appendChild(card);
  return backdrop;
}

export function buildEndingBannerModal(controller: GameController): HTMLElement {
  const state = controller.state;
  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const card = el('section', 'lw-notebook lw-ending-card');
  card.style.maxWidth = '620px';
  card.setAttribute('data-testid', 'ending-banner-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(el('strong', '', 'Verdant Basin Harmony Restored | Hoàn Tất Cốt Truyện'));
  card.appendChild(header);

  const body = el('div', 'lw-notebook-body');
  body.appendChild(
    el(
      'p',
      'lw-ending-lead',
      'All four Resonance Stones sing together beneath Starfall Sanctuary. Thank you for exploring Verdant Basin side by side with your Wildkin companions!',
    ),
  );
  body.appendChild(
    el(
      'p',
      'lw-hud-quest',
      'Cả bốn phiến Đá Cộng Hưởng đã ngân vang hòa hợp dưới bầu trời Thánh Địa Sao Rơi. Hậu truyện nay mở ra Tái Đấu Bậc Thầy cùng bốn Thủ lĩnh, săn dấu vết biến thể Ánh Sao và thu phục trọn 30 loài.',
    ),
  );

  const showcase = el('div', 'lw-ending-party');
  for (const member of state.party) {
    const sp = SPECIES_BY_ID[member.speciesId];
    if (!sp) continue;
    const chip = el('div', 'lw-ending-member');
    chip.appendChild(
      createCreatureSpriteSpan(sp.dexNumber, { gleaming: Boolean(member.isRareVariant) }),
    );
    chip.appendChild(el('strong', '', `${sp.name} Lv.${member.level}`));
    showcase.appendChild(chip);
  }
  body.appendChild(showcase);

  const completedQuests = Object.values(state.quests).filter((q) => q.status === 'completed').length;
  const masteredWords = Object.values(state.lexicon).filter((m) => m.mastery >= 3).length;
  const statsBox = el(
    'div',
    'lw-battle-log',
    `Steps: ${state.stepCount} | Bonded: ${state.caughtSpecies.length}/30 | Quests: ${completedQuests}/${QUESTS.length} | Warden Rematches: ${state.rematchCleared.length}/4 | Words Encountered: ${Object.keys(state.lexicon).length} (Mastered: ${masteredWords})`,
  );
  body.appendChild(statsBox);

  const closeBtn = el('button', 'lw-btn lw-btn-primary', 'Continue Post-Game Exploration / Khám phá hậu truyện');
  closeBtn.setAttribute('data-testid', 'btn-close-ending');
  closeBtn.addEventListener('click', () => controller.closeModal());
  body.appendChild(closeBtn);

  card.appendChild(body);
  backdrop.appendChild(card);
  return backdrop;
}

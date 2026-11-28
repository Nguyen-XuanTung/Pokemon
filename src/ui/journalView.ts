import { DIALOGUES } from '../data/dialogues.ts';
import { ITEMS_BY_ID } from '../data/items.ts';
import { LEXICON_ENTRIES, LEXICON_INDEX } from '../data/lexicon.ts';
import { MAPS, MAPS_BY_ID } from '../data/maps.ts';
import { MOVES_BY_ID } from '../data/moves.ts';
import { NPCS_BY_ID } from '../data/npcs.ts';
import { QUESTS } from '../data/quests.ts';
import { SPECIES, SPECIES_BY_ID } from '../data/species.ts';
import { getUnlockedSpeciesMoves } from '../domain/creatures.ts';
import { ELEMENT_LABELS } from '../domain/elements.ts';
import { getUiStrings, localizePos, localizeSpeakerName, pickText } from '../domain/i18n.ts';
import { isWordDueForReencounter, pickIndependentExample } from '../domain/learning.ts';
import { buildQuestObjectiveDetail, resolveTrackedQuest } from '../domain/navigation.ts';
import { isQuestConditionMet } from '../domain/quests.ts';
import type {
  BattleSpeedMode,
  CefrBand,
  ContentLanguageMode,
  DifficultyMode,
  GuidanceMode,
  KeyBindingMap,
  RegionId,
  UiLanguage,
} from '../domain/types.ts';
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
  managingMovesPartyIndex: number | null;
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
  const uiLang: UiLanguage = controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const notebook = el('section', 'lw-notebook');
  notebook.setAttribute('data-testid', 'journal-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(
    el('strong', '', t.journalHeader(controller.state.caughtSpecies.length, controller.state.tokens)),
  );
  const closeBtn = el('button', 'lw-btn lw-btn-sm', t.journalCloseBtn);
  closeBtn.setAttribute('data-testid', 'btn-close-journal');
  closeBtn.addEventListener('click', () => controller.closeModal());
  header.appendChild(closeBtn);
  notebook.appendChild(header);

  const tabsRow = el('nav', 'lw-tabs');
  const tabDefs: ReadonlyArray<[JournalTab, string]> = [
    ['quests', t.journalTabs.quests],
    ['map', t.journalTabs.map],
    ['team', t.journalTabs.team],
    ['bag', t.journalTabs.bag],
    ['compendium', t.journalTabs.compendium],
    ['lexicon', t.journalTabs.lexicon],
    ['settings', t.journalTabs.settings],
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
  else if (tab === 'team') renderTeamTab(controller, body, viewState, onRerender);
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
  const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  const secretsFound = SECRET_FLAGS.filter((f) => Boolean(state.flags[f])).length;
  const masteryBanner = el('div', 'lw-journal-entry lw-mastery-card');
  masteryBanner.style.marginBottom = '10px';
  masteryBanner.appendChild(el('strong', '', t.questMasteryTitle));
  masteryBanner.appendChild(
    el(
      'div',
      'lw-hud-quest',
      t.questMasteryStats(
        state.discoveredTraces.length,
        secretsFound,
        state.rematchCleared.length,
        state.gleamingSpecies.length,
        state.readLoreIds.length,
      ),
    ),
  );
  container.appendChild(masteryBanner);

  const tracked = resolveTrackedQuest(state, QUESTS);

  for (const q of QUESTS) {
    const prog = state.quests[q.id];
    if (!prog) continue;
    const detail = buildQuestObjectiveDetail({
      quest: q,
      state,
      mapsById: MAPS_BY_ID,
      npcsById: NPCS_BY_ID,
      speciesById: SPECIES_BY_ID,
    });
    const isTracked = tracked?.id === q.id && prog.status === 'active';

    const card = el('div', isTracked ? 'lw-journal-entry lw-quest-tracked' : 'lw-journal-entry');
    card.setAttribute('data-testid', `quest-card-${q.id}`);
    card.style.marginBottom = '8px';

    const headRow = el('div', 'lw-battle-header-row');
    const head = el('div', 'lw-hud-title');
    head.appendChild(
      el(
        'strong',
        '',
        `${q.isMainStory ? t.questMainTag : t.questFieldTag}${pickText(uiLang, q.titleEn, q.titleVi)}`,
      ),
    );
    head.appendChild(
      el(
        'span',
        prog.status === 'completed' ? 'lw-badge lw-badge-eff-good' : 'lw-badge',
        prog.status === 'completed' ? t.questDoneBadge : t.questActiveBadge,
      ),
    );
    if (isTracked) {
      head.appendChild(el('span', 'lw-badge lw-badge-gleaming', t.questTrackingBadge));
    }
    headRow.appendChild(head);

    if (prog.status === 'active' && !isTracked) {
      const guideBtn = el('button', 'lw-btn lw-btn-primary lw-btn-sm', t.questTrackBtn);
      guideBtn.setAttribute('data-testid', `btn-track-quest-${q.id}`);
      guideBtn.addEventListener('click', () => {
        controller.setTrackedQuest(q.id);
        controller.closeModal();
      });
      headRow.appendChild(guideBtn);
    }
    card.appendChild(headRow);

    if (prog.status === 'active') {
      const detailGrid = el('div', 'lw-quest-detail-grid');
      const addDetailRow = (label: string, value: string, danger: boolean = false) => {
        const line = el('div', danger ? 'lw-quest-detail-row lw-quest-detail-warn' : 'lw-quest-detail-row');
        line.appendChild(el('strong', '', `${label} `));
        line.appendChild(document.createTextNode(value));
        detailGrid.appendChild(line);
      };
      addDetailRow(t.questFieldWhat, pickText(uiLang, detail.whatEn, detail.whatVi));
      addDetailRow(t.questFieldTarget, pickText(uiLang, detail.targetLabelEn, detail.targetLabelVi));
      addDetailRow(t.questFieldRegion, pickText(uiLang, detail.regionNameEn, detail.regionNameVi));
      addDetailRow(t.questFieldProgress, pickText(uiLang, detail.progressEn, detail.progressVi));
      if (detail.unmetRequirementEn || detail.unmetRequirementVi) {
        addDetailRow(
          t.questFieldUnmet,
          pickText(uiLang, detail.unmetRequirementEn ?? '', detail.unmetRequirementVi ?? ''),
          true,
        );
      }
      if (detail.recommendedPrepEn || detail.recommendedPrepVi) {
        addDetailRow(
          t.questFieldPrep,
          pickText(uiLang, detail.recommendedPrepEn ?? '', detail.recommendedPrepVi ?? ''),
        );
      }
      card.appendChild(detailGrid);
    } else {
      card.appendChild(el('div', 'lw-hud-quest', pickText(uiLang, q.summaryEn, q.summaryVi)));
    }

    for (const st of q.steps) {
      const done = isQuestConditionMet(st.condition, state, SPECIES_BY_ID);
      const stepLine = el(
        'div',
        'lw-quest-step',
        `${done ? '[x]' : '[ ]'} ${pickText(uiLang, st.descriptionEn, st.descriptionVi)}`,
      );
      card.appendChild(stepLine);
    }
    container.appendChild(card);
  }
}

function renderWorldMapTab(controller: GameController, container: HTMLElement): void {
  const state = controller.state;
  const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  container.appendChild(el('p', 'lw-hud-quest', t.mapIntro));

  const layoutGrid = el('div', 'lw-atlas-compass');
  const nodeMeta: ReadonlyArray<{
    regionId: RegionId;
    slotClass: string;
    unlockFlag?: string;
    stoneFlag?: string;
    dirKey: 'north' | 'west' | 'center' | 'east' | 'south';
  }> = [
    {
      regionId: 'starfall_sanctuary',
      slotClass: 'lw-atlas-north',
      unlockFlag: 'warden_kaelen_cleared',
      stoneFlag: 'main_story_completed',
      dirKey: 'north',
    },
    {
      regionId: 'whisperwood',
      slotClass: 'lw-atlas-west',
      unlockFlag: 'has_starter',
      stoneFlag: 'warden_sylvan_cleared',
      dirKey: 'west',
    },
    {
      regionId: 'mosslight_hub',
      slotClass: 'lw-atlas-center',
      dirKey: 'center',
    },
    {
      regionId: 'reedwater_fen',
      slotClass: 'lw-atlas-east',
      unlockFlag: 'warden_sylvan_cleared',
      stoneFlag: 'warden_mirella_cleared',
      dirKey: 'east',
    },
    {
      regionId: 'terracotta_ridge',
      slotClass: 'lw-atlas-south',
      unlockFlag: 'warden_mirella_cleared',
      stoneFlag: 'warden_kaelen_cleared',
      dirKey: 'south',
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
    top.appendChild(el('span', 'lw-badge', t.mapDirections[item.dirKey]));
    if (isHere) {
      top.appendChild(
        el(
          'span',
          'lw-badge lw-badge-eff-good',
          t.mapHereBadge(state.playerPos.x, state.playerPos.y),
        ),
      );
    } else if (!isUnlocked) {
      top.appendChild(el('span', 'lw-badge', t.mapGatedBadge));
    } else if (item.stoneFlag && isHarmonized) {
      top.appendChild(el('span', 'lw-badge lw-badge-eff-good', t.mapResonantBadge));
    }
    card.appendChild(top);

    card.appendChild(el('strong', '', pickText(uiLang, map.nameEn, map.nameVi)));
    card.appendChild(el('div', 'lw-hud-quest', pickText(uiLang, map.subtitleEn, map.subtitleVi)));

    const speciesHere = MAPS.find((m) => m.id === item.regionId)?.encounters.length ?? 0;
    if (speciesHere > 0) {
      card.appendChild(el('div', 'lw-hud-quest', t.mapHabitatsInfo(speciesHere, traceFound)));
    }
    layoutGrid.appendChild(card);
  }
  container.appendChild(layoutGrid);
}

function renderTeamTab(
  controller: GameController,
  container: HTMLElement,
  viewState: JournalViewState,
  onRerender: () => void,
): void {
  const state = controller.state;
  const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  container.appendChild(el('h4', '', t.teamHeader(state.party.length)));
  state.party.forEach((member, idx) => {
    const sp = SPECIES_BY_ID[member.speciesId]!;
    const elLabel = pickText(uiLang, ELEMENT_LABELS[sp.element].en, ELEMENT_LABELS[sp.element].vi);
    const roleLabel = pickText(uiLang, ROLE_LABELS[sp.combatRole].en, ROLE_LABELS[sp.combatRole].vi);

    const wrap = el('div', 'lw-team-member-wrap');
    const row = el('div', 'lw-list-row');
    row.dataset.element = sp.element;
    row.dataset.isReserve = 'false';
    const left = el('div', 'lw-hud-title');
    left.appendChild(
      createCreatureSpriteSpan(sp.dexNumber, { gleaming: Boolean(member.isRareVariant) }),
    );
    const info = el('div', '');
    const gleamTag = member.isRareVariant ? ` [${t.battleGleamingBadge}]` : '';
    info.appendChild(
      el(
        'strong',
        '',
        `${idx === 0 ? t.teamLeadTag : ''}${sp.name}${gleamTag} ${t.levelShort(member.level)} (${elLabel} | ${roleLabel})`,
      ),
    );
    const evoHint = sp.evolvesTo
      ? t.teamEvolvesHint(sp.evolvesTo.level, SPECIES_BY_ID[sp.evolvesTo.speciesId]?.name ?? '')
      : t.teamFinalForm;
    info.appendChild(
      el(
        'div',
        'lw-hud-quest',
        `${t.teamStatsLine(member.currentHp, member.maxHp, member.stats.atk, member.stats.def, member.stats.spd)}${evoHint}`,
      ),
    );
    left.appendChild(info);
    row.appendChild(left);

    const actions = el('div', 'lw-hud-actions');
    if (idx > 0) {
      const leadBtn = el('button', 'lw-btn lw-btn-sm', t.teamMakeLeadBtn);
      leadBtn.dataset.action = 'make-lead';
      leadBtn.addEventListener('click', () => controller.makePartyLead(idx));
      actions.appendChild(leadBtn);
    }
    if (member.currentHp < member.maxHp) {
      const healBtn = el('button', 'lw-btn lw-btn-moss lw-btn-sm', t.teamUseTonicBtn);
      healBtn.addEventListener('click', () => controller.useBagItemInField('dew_tonic', idx));
      actions.appendChild(healBtn);
    }
    const isManaging = viewState.managingMovesPartyIndex === idx;
    const movesBtn = el(
      'button',
      isManaging ? 'lw-btn lw-btn-primary lw-btn-sm' : 'lw-btn lw-btn-sm',
      isManaging ? t.teamCloseMovesBtn : t.teamManageMovesBtn,
    );
    movesBtn.setAttribute('data-testid', `btn-manage-moves-${idx}`);
    movesBtn.addEventListener('click', () => {
      viewState.managingMovesPartyIndex = isManaging ? null : idx;
      onRerender();
    });
    actions.appendChild(movesBtn);
    row.appendChild(actions);
    wrap.appendChild(row);

    if (isManaging) {
      const panel = el('div', 'lw-journal-entry lw-move-manager');
      panel.setAttribute('data-testid', 'move-manager-panel');
      panel.appendChild(el('div', 'lw-hud-quest', t.teamMoveGuideIntro));
      panel.appendChild(el('strong', '', t.teamActiveMovesTitle));
      const activeGrid = el('div', 'lw-move-grid');
      activeGrid.style.margin = '6px 0';
      member.moves.forEach((slot, sIdx) => {
        const mDef = MOVES_BY_ID[slot.moveId];
        if (!mDef) return;
        const mCard = el('div', 'lw-move-card');
        const mEl = ELEMENT_LABELS[mDef.element];
        mCard.style.borderLeft = `4px solid ${mEl.color}`;
        const mName = uiLang === 'en' ? mDef.name : (mDef.nameVi ?? mDef.name);
        mCard.appendChild(
          el(
            'strong',
            '',
            `${sIdx + 1}. ${mName} (${pickText(uiLang, mEl.en, mEl.vi)}${mDef.power > 0 ? ` ${mDef.power}` : ` ${t.battleSupportTag}`})`,
          ),
        );
        mCard.appendChild(
          el('div', 'lw-hud-quest', pickText(uiLang, mDef.descriptionEn, mDef.descriptionVi)),
        );
        activeGrid.appendChild(mCard);
      });
      panel.appendChild(activeGrid);

      const unlocked = getUnlockedSpeciesMoves(member, SPECIES, MOVES_BY_ID).filter(
        (m) => !member.moves.some((s) => s.moveId === m.id),
      );
      if (unlocked.length > 0) {
        panel.appendChild(el('strong', '', t.teamAvailableMovesTitle));
        for (const cand of unlocked) {
          const candRow = el('div', 'lw-list-row');
          const cInfo = el('div', '');
          const cEl = ELEMENT_LABELS[cand.element];
          const cName = uiLang === 'en' ? cand.name : (cand.nameVi ?? cand.name);
          cInfo.appendChild(
            el(
              'strong',
              '',
              `${cName} (${pickText(uiLang, cEl.en, cEl.vi)}${cand.power > 0 ? ` ${cand.power}` : ` ${t.battleSupportTag}`})`,
            ),
          );
          cInfo.appendChild(
            el('div', 'lw-hud-quest', pickText(uiLang, cand.descriptionEn, cand.descriptionVi)),
          );
          candRow.appendChild(cInfo);

          const swapBtns = el('div', 'lw-choice-list');
          member.moves.forEach((slot, slotIdx) => {
            const existingDef = MOVES_BY_ID[slot.moveId];
            const existingName = existingDef
              ? uiLang === 'en'
                ? existingDef.name
                : (existingDef.nameVi ?? existingDef.name)
              : slot.moveId;
            const sBtn = el(
              'button',
              'lw-btn lw-btn-sm',
              t.teamReplaceSlotLabel(slotIdx + 1, existingName),
            );
            sBtn.addEventListener('click', () => {
              controller.swapCreatureMove(idx, slotIdx, cand.id);
              onRerender();
            });
            swapBtns.appendChild(sBtn);
          });
          candRow.appendChild(swapBtns);
          panel.appendChild(candRow);
        }
      }
      wrap.appendChild(panel);
    }

    container.appendChild(wrap);
  });

  if (state.sanctuaryBox.length > 0) {
    container.appendChild(el('h4', '', t.teamReserveHeader(state.sanctuaryBox.length)));
    state.sanctuaryBox.forEach((boxMember, bIdx) => {
      const sp = SPECIES_BY_ID[boxMember.speciesId]!;
      const elLabel = pickText(uiLang, ELEMENT_LABELS[sp.element].en, ELEMENT_LABELS[sp.element].vi);
      const row = el('div', 'lw-list-row');
      row.dataset.element = sp.element;
      row.dataset.isReserve = 'true';
      const left = el('div', 'lw-hud-title');
      left.appendChild(
        createCreatureSpriteSpan(sp.dexNumber, { gleaming: Boolean(boxMember.isRareVariant) }),
      );
      left.appendChild(
        el('span', '', `${sp.name} ${t.levelShort(boxMember.level)} (${elLabel})`),
      );
      row.appendChild(left);

      const swapBtn = el('button', 'lw-btn lw-btn-sm', t.teamSwapReserveBtn);
      swapBtn.dataset.action = 'swap-reserve';
      swapBtn.addEventListener('click', () =>
        controller.swapPartyAndReserve(Math.max(0, state.party.length - 1), bIdx),
      );
      row.appendChild(swapBtn);
      container.appendChild(row);
    });
  }
}

function renderBagTab(controller: GameController, container: HTMLElement): void {
  const uiLang: UiLanguage = controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const contentLang = controller.state.settings.contentLanguage ?? 'bilingual';
  const t = getUiStrings(uiLang);

  const nonEmpty = controller.state.inventory.filter((s) => s.quantity > 0);
  if (nonEmpty.length === 0) {
    container.appendChild(el('p', '', t.bagEmpty));
    return;
  }
  for (const slot of nonEmpty) {
    const def = ITEMS_BY_ID[slot.itemId];
    if (!def) continue;
    const row = el('div', 'lw-list-row');
    const info = el('div', '');
    const titleLine = el('div', 'lw-hud-title');
    titleLine.appendChild(createItemSpriteSpan(def.id));
    titleLine.appendChild(
      el('strong', '', `${pickText(uiLang, def.nameEn, def.nameVi)} x${slot.quantity}`),
    );
    info.appendChild(titleLine);
    const desc = el('div', 'lw-hud-quest');
    if (contentLang === 'vi_only' || uiLang === 'vi') {
      desc.textContent = def.descriptionVi;
    } else {
      desc.appendChild(renderInteractiveEnglish(controller, def.descriptionEn, 'bag_item'));
    }
    info.appendChild(desc);
    row.appendChild(info);

    if (def.category === 'tonic' || def.category === 'remedy' || def.category === 'lantern') {
      const useBtn = el('button', 'lw-btn lw-btn-moss lw-btn-sm', t.bagUseBtn);
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
  const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const contentLang = state.settings.contentLanguage ?? 'bilingual';
  const t = getUiStrings(uiLang);

  container.appendChild(
    el(
      'p',
      'lw-hud-quest',
      t.compendiumStats(
        state.discoveredSpecies.length,
        state.caughtSpecies.length,
        state.gleamingSpecies.length,
      ),
    ),
  );
  const grid = el('div', 'lw-species-grid');
  for (const sp of controller.getAllSpecies()) {
    const seen = state.discoveredSpecies.includes(sp.id);
    const caught = state.caughtSpecies.includes(sp.id);
    const hasGleaming = state.gleamingSpecies.includes(sp.id);
    const habitatNames = sp.habitatIds
      .map((h) => pickText(uiLang, MAPS_BY_ID[h].nameEn, MAPS_BY_ID[h].nameVi))
      .join(', ');
    const card = el('div', 'lw-journal-entry');
    if (!seen) {
      const top = el('div', 'lw-hud-title');
      top.appendChild(createCreatureSpriteSpan(sp.dexNumber, { silhouette: true }));
      const meta = el('div', '');
      meta.appendChild(
        el('strong', '', t.compendiumUncharted(String(sp.dexNumber).padStart(2, '0'))),
      );
      meta.appendChild(el('div', 'lw-hud-quest', t.compendiumHabitat(habitatNames)));
      if (sp.preferredTime && sp.preferredTime.length > 0) {
        const times = sp.preferredTime.map((tm) => t.timeLabels[tm]).join(', ');
        meta.appendChild(el('div', 'lw-hud-quest', t.compendiumActiveTime(times)));
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
          `#${String(sp.dexNumber).padStart(2, '0')} ${sp.name} ${caught ? t.compendiumBondedTag : t.compendiumSightedTag}`,
        ),
      );
      const tags = el('div', 'lw-hud-title');
      const rInfo = RARITY_LABELS[sp.rarity];
      const rBadge = el('span', 'lw-badge lw-badge-element', pickText(uiLang, rInfo.en, rInfo.vi));
      rBadge.style.background = rInfo.color;
      tags.append(
        rBadge,
        el(
          'span',
          'lw-badge',
          pickText(uiLang, ROLE_LABELS[sp.combatRole].en, ROLE_LABELS[sp.combatRole].vi),
        ),
      );
      if (hasGleaming) {
        tags.appendChild(el('span', 'lw-badge lw-badge-gleaming', t.battleGleamingBadge));
      }
      meta.appendChild(tags);
      top.appendChild(meta);
      card.appendChild(top);

      card.appendChild(el('div', 'lw-hud-quest', pickText(uiLang, sp.titleEn, sp.titleVi)));
      if (caught) {
        const note = el('div', 'lw-compendium-note');
        if (contentLang === 'vi_only') {
          note.textContent = sp.fieldNoteVi;
        } else {
          note.appendChild(renderInteractiveEnglish(controller, sp.fieldNoteEn, 'compendium'));
          if (contentLang === 'bilingual') {
            note.appendChild(el('div', 'lw-hud-quest', sp.fieldNoteVi));
          }
        }
        card.appendChild(note);
        if (sp.evolvesTo) {
          const nextName = SPECIES_BY_ID[sp.evolvesTo.speciesId]?.name ?? sp.evolvesTo.speciesId;
          card.appendChild(
            el('div', 'lw-hud-quest', t.compendiumEvoLine(sp.evolvesTo.level, nextName)),
          );
        }
        const storyBtn = el('button', 'lw-btn lw-btn-sm', t.compendiumReadStoryBtn);
        storyBtn.addEventListener('click', () => {
          controller.closeModal();
          controller.openDialogueById(`field_story_${sp.id}`);
          onRerender();
        });
        card.appendChild(storyBtn);
      } else {
        card.appendChild(el('div', 'lw-hud-quest', t.compendiumUnlockHint(habitatNames)));
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
  const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  const encounteredCount = Object.keys(state.lexicon).length;
  const savedCount = Object.values(state.lexicon).filter((m) => m.savedByPlayer).length;
  const masteredCount = Object.values(state.lexicon).filter((m) => m.mastery >= 3).length;
  const dueCount = Object.values(state.lexicon).filter((m) =>
    isWordDueForReencounter(m, state),
  ).length;
  const dispatchCount = DIALOGUES.filter((d) => d.contextTag === 'ranger_dispatch').length;

  const filterBar = el('div', 'lw-choice-list');
  filterBar.style.marginBottom = '10px';
  for (const [fKey, label] of [
    ['encountered', t.lexiconFilters.encountered(encounteredCount)],
    ['saved', t.lexiconFilters.saved(savedCount)],
    ['mastered', t.lexiconFilters.mastered(masteredCount)],
    ['due', t.lexiconFilters.due(dueCount)],
    ['all', t.lexiconFilters.all(LEXICON_ENTRIES.length)],
    ['dispatches', t.lexiconFilters.dispatches(dispatchCount)],
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
        el(
          'span',
          '',
          `${isRead ? t.lexiconReadTag : t.lexiconUnreadTag}${localizeSpeakerName(disp.speaker, uiLang)} (${disp.cefr})`,
        ),
      );
      const readBtn = el('button', 'lw-btn lw-btn-sm', t.lexiconReadNoteBtn);
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
    container.appendChild(el('p', '', t.lexiconEmpty));
    return;
  }

  for (const entry of items) {
    const mem = state.lexicon[entry.id];
    const ex = pickIndependentExample(entry, state.regionId, mem?.exposures ?? 0);
    const row = el('div', 'lw-list-row');
    const left = el('div', '');
    left.appendChild(
      el(
        'strong',
        '',
        `${entry.word} ${entry.phonetic} [${localizePos(entry.pos, uiLang)} | ${entry.cefr}] : ${entry.meaningVi}`,
      ),
    );
    left.appendChild(
      el(
        'div',
        'lw-hud-quest',
        t.lexiconStatsLine(mem?.exposures ?? 0, mem?.glossLookups ?? 0, mem?.mastery ?? 0),
      ),
    );
    left.appendChild(el('div', 'lw-hud-quest lw-lexicon-example', `${ex.en} | ${ex.vi}`));
    row.appendChild(left);

    const acts = el('div', 'lw-hud-actions');
    const speakBtn = el('button', 'lw-btn lw-btn-sm', t.lexiconListenBtn);
    speakBtn.addEventListener('click', () =>
      controller.sound.speakEnglishWord(entry.word, entry.phonetic),
    );
    const saveBtn = el(
      'button',
      mem?.savedByPlayer ? 'lw-btn lw-btn-moss lw-btn-sm' : 'lw-btn lw-btn-sm',
      mem?.savedByPlayer ? t.lexiconSavedBtn : t.lexiconSaveBtn,
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
  const uiLang: UiLanguage = s.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  const addSelectRow = (
    label: string,
    current: string,
    options: ReadonlyArray<[string, string]>,
    onChange: (val: string) => void,
    testId?: string,
  ) => {
    const row = el('div', 'lw-list-row');
    row.appendChild(el('span', '', label));
    const sel = document.createElement('select');
    if (testId) sel.setAttribute('data-testid', testId);
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
    t.labelUiLanguage,
    uiLang,
    [
      ['vi', t.uiLanguageOptions.vi],
      ['en', t.uiLanguageOptions.en],
    ],
    (v) => controller.updateSettings({ uiLanguage: v as UiLanguage }),
    'settings-ui-language',
  );

  addSelectRow(
    t.labelContentLanguage,
    s.contentLanguage ?? 'bilingual',
    [
      ['vi_only', t.contentLanguageOptions.vi_only],
      ['bilingual', t.contentLanguageOptions.bilingual],
      ['en_assist', t.contentLanguageOptions.en_assist],
      ['en_immersion', t.contentLanguageOptions.en_immersion],
    ],
    (v) => controller.updateSettings({ contentLanguage: v as ContentLanguageMode }),
    'settings-content-language',
  );

  addSelectRow(
    t.labelEnglishBand,
    s.cefrBand,
    [
      ['A1', t.cefrOptions.A1],
      ['A2', t.cefrOptions.A2],
      ['B1', t.cefrOptions.B1],
      ['B2', t.cefrOptions.B2],
    ],
    (v) => controller.updateSettings({ cefrBand: v as CefrBand }),
    'settings-cefr-band',
  );

  addSelectRow(
    t.labelDifficulty,
    s.difficulty ?? 'relaxed',
    [
      ['relaxed', t.difficultyOptions.relaxed],
      ['adventure', t.difficultyOptions.adventure],
      ['challenge', t.difficultyOptions.challenge],
    ],
    (v) => controller.updateSettings({ difficulty: v as DifficultyMode }),
    'settings-difficulty',
  );

  addSelectRow(
    t.labelGuidanceMode,
    s.guidanceMode ?? 'full',
    [
      ['full', t.guidanceOptions.full],
      ['minimal', t.guidanceOptions.minimal],
      ['off', t.guidanceOptions.off],
    ],
    (v) => controller.updateSettings({ guidanceMode: v as GuidanceMode }),
    'settings-guidance-mode',
  );

  addSelectRow(
    t.settingsBattleSpeedLabel,
    s.battleSpeed ?? 'normal',
    [
      ['normal', t.settingsBattleSpeedOptions.normal],
      ['fast', t.settingsBattleSpeedOptions.fast],
      ['instant', t.settingsBattleSpeedOptions.instant],
    ],
    (v) => controller.updateSettings({ battleSpeed: v as BattleSpeedMode }),
    'settings-battle-speed',
  );

  addSelectRow(
    t.settingsTouchLabel,
    s.touchControls,
    [
      ['auto', t.settingsTouchOptions.auto],
      ['always', t.settingsTouchOptions.always],
      ['off', t.settingsTouchOptions.off],
    ],
    (v) => controller.updateSettings({ touchControls: v as 'auto' | 'always' | 'off' }),
  );

  addSelectRow(
    t.settingsTextScaleLabel,
    s.textScale,
    [
      ['normal', t.settingsTextScaleOptions.normal],
      ['large', t.settingsTextScaleOptions.large],
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
    t.settingsBattleAssistLabel,
    s.battleAssist !== false,
    (v) => controller.updateSettings({ battleAssist: v }),
    'settings-battle-assist',
  );
  addCheckboxRow(
    t.settingsShowFollowerLabel,
    s.showFollower !== false,
    (v) => controller.updateSettings({ showFollower: v }),
    'checkbox-show-follower',
  );
  addCheckboxRow(t.settingsHighContrastLabel, s.highContrast, (v) =>
    controller.updateSettings({ highContrast: v }),
  );
  addCheckboxRow(
    t.settingsReducedMotionLabel,
    s.reducedMotion,
    (v) => controller.updateSettings({ reducedMotion: v }),
    'settings-reduced-motion',
  );
  addCheckboxRow(t.settingsMuteLabel, s.muted, (v) => controller.updateSettings({ muted: v }));

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

  addSliderRow(t.settingsBgmLabel, s.bgmVolume, (v) =>
    controller.updateSettings({ bgmVolume: v }),
  );
  addSliderRow(t.settingsSfxLabel, s.sfxVolume, (v) =>
    controller.updateSettings({ sfxVolume: v }),
  );

  container.appendChild(el('h4', '', t.settingsTutorialHeader));
  const tutRow = el('div', 'lw-choice-list');
  const restartTutBtn = el('button', 'lw-btn lw-btn-sm', t.settingsRestartTutorialBtn);
  restartTutBtn.setAttribute('data-testid', 'btn-restart-onboarding');
  restartTutBtn.addEventListener('click', () => {
    controller.restartOnboardingGuide();
    onRerender();
  });
  const skipTutBtn = el('button', 'lw-btn lw-btn-sm', t.settingsSkipTutorialBtn);
  skipTutBtn.addEventListener('click', () => {
    controller.skipOnboardingGuide();
    onRerender();
  });
  tutRow.append(restartTutBtn, skipTutBtn);
  container.appendChild(tutRow);

  container.appendChild(el('h4', '', t.settingsKeyMapHeader));
  const rebindGrid = el('div', 'lw-choice-list');
  for (const kField of ['up', 'down', 'left', 'right', 'interact', 'journal'] as const) {
    const label = t.settingsKeyLabels[kField];
    const waiting = viewState.awaitingKeyRebind === kField;
    const b = el(
      'button',
      waiting ? 'lw-btn lw-btn-primary lw-btn-sm' : 'lw-btn lw-btn-sm',
      waiting ? t.settingsPressKey(label) : `${label}: ${s.keyMap[kField]}`,
    );
    b.setAttribute('data-testid', `btn-rebind-${kField}`);
    b.addEventListener('click', () => {
      viewState.awaitingKeyRebind = kField;
      onRerender();
    });
    rebindGrid.appendChild(b);
  }
  container.appendChild(rebindGrid);

  container.appendChild(el('h4', '', t.settingsSaveHeader));
  if (controller.saveRepo.hasMultiTabConflict) {
    container.appendChild(el('p', 'lw-battle-log', t.settingsMultiTabWarning));
  }
  const saveRow = el('div', 'lw-choice-list');
  const saveNowBtn = el('button', 'lw-btn lw-btn-moss', t.settingsSaveNowBtn);
  saveNowBtn.setAttribute('data-testid', 'btn-save-now');
  saveNowBtn.addEventListener('click', () => {
    controller.persistState();
    controller.pushToast('Progress saved locally!', 'Đã lưu tiến trình vào trình duyệt!');
    onRerender();
  });

  const exportBtn = el('button', 'lw-btn lw-btn-primary', t.settingsExportBtn);
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

  const importLabel = el('label', 'lw-btn', t.settingsImportBtn);
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
    const syncBtn = el('button', 'lw-btn lw-btn-primary', t.settingsSyncTabBtn);
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
  const uiLang: UiLanguage = controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const card = el('section', 'lw-notebook');
  card.style.maxWidth = '640px';
  card.setAttribute('data-testid', 'supply-post-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(el('strong', '', t.supplyHeader(controller.state.tokens)));
  const closeBtn = el('button', 'lw-btn lw-btn-sm', t.supplyCloseBtn);
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
      el(
        'strong',
        '',
        `${pickText(uiLang, item.nameEn, item.nameVi)} | ${t.supplyPriceOwned(item.price, owned)}`,
      ),
    );
    left.appendChild(titleLine);
    left.appendChild(el('div', 'lw-hud-quest', pickText(uiLang, item.descriptionEn, item.descriptionVi)));
    row.appendChild(left);

    const buyBtn = el('button', 'lw-btn lw-btn-primary lw-btn-sm', t.supplyBuyBtn);
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
  const uiLang: UiLanguage = controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const card = el('section', 'lw-notebook');
  card.style.maxWidth = '580px';
  card.setAttribute('data-testid', 'camp-review-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(el('strong', '', t.campHeader));
  const skipBtn = el('button', 'lw-btn lw-btn-sm', t.campSkipBtn);
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
    body.appendChild(el('p', '', t.campEmpty));
    card.appendChild(body);
    backdrop.appendChild(card);
    return backdrop;
  }

  body.appendChild(
    el(
      'div',
      'lw-hud-quest',
      t.campCardCounter(controller.campPromptIndex + 1, controller.campPrompts.length, prompt.isDueNow),
    ),
  );
  body.appendChild(el('h3', '', `${prompt.entry.word} ${prompt.entry.phonetic}`));
  body.appendChild(el('p', 'lw-battle-log', prompt.promptSentenceEn));

  const choices = el('div', 'lw-move-grid');
  for (const ch of prompt.choices) {
    const cBtn = el('button', 'lw-btn', ch.meaningVi) as HTMLButtonElement;
    cBtn.disabled = viewState.campAnsweredCurrent;
    cBtn.addEventListener('click', () => {
      const res = controller.answerCampfirePrompt(ch.wordId);
      viewState.campAnsweredCurrent = true;
      viewState.campAnsweredMessageVi = res.matched
        ? t.campFeedbackCorrect(prompt.entry.word, prompt.entry.meaningVi, prompt.promptSentenceVi)
        : t.campFeedbackGentle(prompt.entry.word, prompt.entry.meaningVi, prompt.promptSentenceVi);
      onRerender();
    });
    choices.appendChild(cBtn);
  }
  body.appendChild(choices);

  if (viewState.campAnsweredCurrent) {
    const fb = el('p', 'lw-battle-log', viewState.campAnsweredMessageVi);
    fb.style.marginTop = '10px';
    body.appendChild(fb);
    const nextBtn = el('button', 'lw-btn lw-btn-primary', t.campNextBtn);
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
  const uiLang: UiLanguage = state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);

  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const card = el('section', 'lw-notebook lw-ending-card');
  card.style.maxWidth = '620px';
  card.setAttribute('data-testid', 'ending-banner-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(el('strong', '', t.endingHeader));
  card.appendChild(header);

  const body = el('div', 'lw-notebook-body');
  body.appendChild(el('p', 'lw-ending-lead', t.endingLead));
  body.appendChild(el('p', 'lw-hud-quest', t.endingSub));

  const showcase = el('div', 'lw-ending-party');
  for (const member of state.party) {
    const sp = SPECIES_BY_ID[member.speciesId];
    if (!sp) continue;
    const chip = el('div', 'lw-ending-member');
    chip.appendChild(
      createCreatureSpriteSpan(sp.dexNumber, { gleaming: Boolean(member.isRareVariant) }),
    );
    chip.appendChild(el('strong', '', `${sp.name} ${t.levelShort(member.level)}`));
    showcase.appendChild(chip);
  }
  body.appendChild(showcase);

  const completedQuests = Object.values(state.quests).filter((q) => q.status === 'completed').length;
  const masteredWords = Object.values(state.lexicon).filter((m) => m.mastery >= 3).length;
  body.appendChild(
    el(
      'div',
      'lw-battle-log',
      t.endingStats(
        state.stepCount,
        state.caughtSpecies.length,
        completedQuests,
        QUESTS.length,
        state.rematchCleared.length,
        Object.keys(state.lexicon).length,
        masteredWords,
      ),
    ),
  );

  const closeBtn = el('button', 'lw-btn lw-btn-primary', t.endingContinueBtn);
  closeBtn.setAttribute('data-testid', 'btn-close-ending');
  closeBtn.addEventListener('click', () => controller.closeModal());
  body.appendChild(closeBtn);

  card.appendChild(body);
  backdrop.appendChild(card);
  return backdrop;
}

export function buildLostHelperModal(controller: GameController): HTMLElement {
  const uiLang: UiLanguage = controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);
  const report = controller.getLostHelperReport();

  const backdrop = el('div', 'lw-modal-backdrop lw-interactive');
  const card = el('section', 'lw-notebook');
  card.style.maxWidth = '560px';
  card.setAttribute('data-testid', 'lost-helper-modal');

  const header = el('header', 'lw-notebook-header');
  header.appendChild(el('strong', '', t.lostModalTitle));
  const closeBtn = el('button', 'lw-btn lw-btn-sm', t.lostModalClose);
  closeBtn.setAttribute('data-testid', 'btn-close-lost-helper');
  closeBtn.addEventListener('click', () => controller.closeModal());
  header.appendChild(closeBtn);
  card.appendChild(header);

  const body = el('div', 'lw-notebook-body');
  body.appendChild(
    el(
      'p',
      'lw-ending-lead',
      t.lostWhereYouAre(pickText(uiLang, report.regionNameEn, report.regionNameVi)),
    ),
  );

  if (report.needsHealFirst) {
    body.appendChild(el('div', 'lw-battle-assist-bar lw-boss-warn-bar', t.lostHealAdvice));
  }

  const infoBox = el('div', 'lw-journal-entry');
  const addLine = (lbl: string, val: string) => {
    const row = el('div', 'lw-quest-detail-row');
    row.appendChild(el('strong', '', `${lbl} `));
    row.appendChild(document.createTextNode(val));
    infoBox.appendChild(row);
  };
  addLine(t.lostNextAction, pickText(uiLang, report.nextActionEn, report.nextActionVi));
  addLine(t.lostTargetLabel, pickText(uiLang, report.targetLabelEn, report.targetLabelVi));
  addLine(t.lostDirectionLabel, pickText(uiLang, report.routeSummaryEn, report.routeSummaryVi));
  if (report.recommendedPrepEn || report.recommendedPrepVi) {
    addLine(
      t.questFieldPrep,
      pickText(uiLang, report.recommendedPrepEn ?? '', report.recommendedPrepVi ?? ''),
    );
  }
  body.appendChild(infoBox);

  const actions = el('div', 'lw-choice-list');
  if (controller.state.settings.guidanceMode !== 'full') {
    const enableBtn = el('button', 'lw-btn lw-btn-moss', t.lostEnableGuidanceBtn);
    enableBtn.setAttribute('data-testid', 'btn-lost-enable-full');
    enableBtn.addEventListener('click', () => {
      controller.updateSettings({ guidanceMode: 'full' });
      controller.closeModal();
    });
    actions.appendChild(enableBtn);
  }
  const trackMainBtn = el('button', 'lw-btn lw-btn-primary', t.lostTrackMainBtn);
  trackMainBtn.setAttribute('data-testid', 'btn-lost-track-main');
  trackMainBtn.addEventListener('click', () => {
    controller.setTrackedQuest(null);
    controller.closeModal();
  });
  actions.appendChild(trackMainBtn);
  body.appendChild(actions);

  card.appendChild(body);
  backdrop.appendChild(card);
  return backdrop;
}

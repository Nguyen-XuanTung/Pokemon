import { ITEMS_BY_ID } from '../data/items.ts';
import { MOVES_BY_ID } from '../data/moves.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import type { StatStages } from '../domain/battle.ts';
import { computeBattleAssistPlan } from '../domain/battleAssist.ts';
import { computeCaptureProbability } from '../domain/capture.ts';
import { expRequiredForLevel } from '../domain/creatures.ts';
import { getDifficultyProfile } from '../domain/difficulty.ts';
import { ELEMENT_LABELS, getTypeMultiplier } from '../domain/elements.ts';
import { getUiStrings, pickText } from '../domain/i18n.ts';
import { shouldGuaranteeFirstTutorialCapture } from '../domain/onboarding.ts';
import type { BattleSpeedMode, CreatureInstance, UiLanguage } from '../domain/types.ts';
import type { GameController } from '../game/controller.ts';
import {
  createCreatureSpriteSpan,
  createItemSpriteSpan,
  el,
  renderInteractiveEnglish,
  ROLE_LABELS,
} from './uiHelpers.ts';

export type BattleDeckTab = 'moves' | 'bag' | 'team' | 'tactics';

const NEXT_SPEED: Readonly<Record<BattleSpeedMode, BattleSpeedMode>> = {
  normal: 'fast',
  fast: 'instant',
  instant: 'normal',
};

function effectiveCombatSpeed(creature: CreatureInstance, stages: StatStages): number {
  const stageMult = stages.spd >= 0 ? 1 + stages.spd * 0.25 : 1 / (1 - stages.spd * 0.25);
  const statusMult = creature.status === 'paralyze' ? 0.65 : 1;
  return creature.stats.spd * stageMult * statusMult;
}

function buildPartyOrbs(party: ReadonlyArray<CreatureInstance>): HTMLElement {
  const row = el('div', 'lw-party-orbs');
  for (let i = 0; i < 6; i++) {
    const member = party[i];
    const orb = el('span', 'lw-party-orb');
    if (!member) {
      orb.dataset.state = 'empty';
    } else if (member.currentHp <= 0) {
      orb.dataset.state = 'fainted';
    } else if (member.status) {
      orb.dataset.state = 'status';
    } else {
      orb.dataset.state = 'healthy';
    }
    row.appendChild(orb);
  }
  return row;
}

function buildCombatantPlate(
  controller: GameController,
  creature: CreatureInstance,
  stages: StatStages,
  party: ReadonlyArray<CreatureInstance>,
  displayName: string,
  speciesName: string,
  element: keyof typeof ELEMENT_LABELS,
  isEnemy: boolean,
  battleKind: 'wild' | 'trainer',
): HTMLElement {
  const uiLang: UiLanguage = controller.state.settings.uiLanguage === 'en' ? 'en' : 'vi';
  const t = getUiStrings(uiLang);
  const plate = el('div', isEnemy ? 'lw-combatant-plate lw-plate-enemy' : 'lw-combatant-plate');
  const bonded = isEnemy && controller.state.caughtSpecies.includes(creature.speciesId);

  plate.dataset.element = element;
  plate.dataset.speciesName = speciesName;
  plate.dataset.status = creature.status ?? 'none';
  plate.dataset.level = String(creature.level);
  plate.dataset.hp = String(creature.currentHp);
  plate.dataset.maxHp = String(creature.maxHp);
  if (isEnemy) {
    plate.dataset.battleKind = battleKind;
    plate.dataset.bonded = String(bonded);
  }

  const top = el('div', 'lw-hud-title');
  top.appendChild(el('strong', '', `${displayName} ${t.levelShort(creature.level)}`));
  const elMeta = ELEMENT_LABELS[element];
  const badge = el('span', 'lw-badge lw-badge-element', uiLang === 'en' ? elMeta.en : elMeta.vi);
  badge.style.background = elMeta.color;
  top.appendChild(badge);
  if (creature.isRareVariant) {
    top.appendChild(el('span', 'lw-badge lw-badge-gleaming', t.battleGleamingBadge));
  }
  if (creature.status) {
    top.appendChild(el('span', 'lw-badge lw-badge-status', t.statusLabels[creature.status]));
  }
  if (bonded) {
    top.appendChild(el('span', 'lw-badge', t.battleBondedBadge));
  }
  for (const [labelVi, labelEn, val] of [
    ['CÔNG', 'ATK', stages.atk],
    ['THỦ', 'DEF', stages.def],
    ['TỐC', 'SPD', stages.spd],
  ] as const) {
    if (val !== 0) {
      const lbl = uiLang === 'en' ? labelEn : labelVi;
      top.appendChild(el('span', 'lw-badge', `${lbl}${val > 0 ? `+${val}` : val}`));
    }
  }
  plate.appendChild(top);

  const ratio = Math.max(
    0,
    Math.min(100, Math.round((creature.currentHp / Math.max(1, creature.maxHp)) * 100)),
  );
  const track = el('div', 'lw-hp-track');
  const fill = el('div', 'lw-hp-fill');
  fill.style.width = `${ratio}%`;
  fill.dataset.low = String(ratio <= 30);
  fill.dataset.mid = String(ratio > 30 && ratio <= 60);
  track.appendChild(fill);
  plate.appendChild(track);

  if (!isEnemy) {
    const floorExp = expRequiredForLevel(creature.level);
    const nextExp = expRequiredForLevel(creature.level + 1);
    const expSpan = Math.max(1, nextExp - floorExp);
    const expPct =
      creature.level >= 30
        ? 100
        : Math.max(0, Math.min(100, Math.round(((creature.exp - floorExp) / expSpan) * 100)));
    const expTrack = el('div', 'lw-exp-track');
    const expFill = el('div', 'lw-exp-fill');
    expFill.style.width = `${expPct}%`;
    expTrack.appendChild(expFill);
    plate.appendChild(expTrack);
  }

  const foot = el('div', 'lw-plate-foot');
  foot.appendChild(el('span', 'lw-hud-quest', t.hpLabel(creature.currentHp, creature.maxHp)));
  foot.appendChild(buildPartyOrbs(party));
  plate.appendChild(foot);
  return plate;
}

export function buildBattleView(
  controller: GameController,
  battleTab: BattleDeckTab,
  onSelectTab: (tab: BattleDeckTab) => void,
): HTMLElement {
  const battle = controller.activeBattle!;
  const settings = controller.state.settings;
  const uiLang: UiLanguage = settings.uiLanguage === 'en' ? 'en' : 'vi';
  const contentLang = settings.contentLanguage ?? 'bilingual';
  const showAssist = settings.battleAssist !== false;
  const t = getUiStrings(uiLang);
  const diffProfile = getDifficultyProfile(settings.difficulty);

  const wrapper = el('div', 'lw-battle-shell');

  const enemy = battle.enemyParty[battle.activeEnemyIndex]!;
  const player = battle.playerParty[battle.activePlayerIndex]!;
  const enemySpec = SPECIES_BY_ID[enemy.speciesId]!;
  const playerSpec = SPECIES_BY_ID[player.speciesId]!;

  const topPlates = el('div', 'lw-battle-hud');
  topPlates.appendChild(
    buildCombatantPlate(
      controller,
      player,
      battle.playerStages,
      battle.playerParty,
      player.nickname ?? playerSpec.name,
      playerSpec.name,
      playerSpec.element,
      false,
      battle.kind,
    ),
  );
  topPlates.appendChild(
    buildCombatantPlate(
      controller,
      enemy,
      battle.enemyStages,
      battle.enemyParty,
      battle.kind === 'wild'
        ? t.battleWildPrefix(enemySpec.name)
        : t.battleFoePrefix(enemySpec.name),
      enemySpec.name,
      enemySpec.element,
      true,
      battle.kind,
    ),
  );
  wrapper.appendChild(topPlates);

  const deck = el('section', 'lw-battle-deck lw-interactive');
  deck.setAttribute('data-testid', 'battle-deck');

  const playerSpd = effectiveCombatSpeed(player, battle.playerStages);
  const enemySpd = effectiveCombatSpeed(enemy, battle.enemyStages);
  const enemyThreatMult = getTypeMultiplier(enemySpec.element, playerSpec.element);
  const assistPlan = computeBattleAssistPlan({
    session: battle,
    state: controller.state,
    speciesById: SPECIES_BY_ID,
    movesById: MOVES_BY_ID,
    itemsById: ITEMS_BY_ID,
  });

  const bestCharmPct = assistPlan.captureAdvice?.bestChancePct ?? 0;
  const guaranteedFirstCatch = Boolean(assistPlan.captureAdvice?.guaranteed);
  const hasBenchCounter = Boolean(assistPlan.switchSuggestion);

  const logHeader = el('div', 'lw-battle-header-row');
  const outlookWrap = el('div', 'lw-hud-title');
  outlookWrap.setAttribute('data-testid', 'battle-turn-outlook');
  outlookWrap.appendChild(
    el(
      'span',
      'lw-hud-quest',
      t.battleTurnHeader(
        battle.turnCount,
        pickText(uiLang, enemySpec.titleEn, enemySpec.titleVi),
        pickText(uiLang, ROLE_LABELS[enemySpec.combatRole].en, ROLE_LABELS[enemySpec.combatRole].vi),
      ),
    ),
  );
  outlookWrap.appendChild(
    el(
      'span',
      'lw-badge',
      playerSpd >= enemySpd ? t.battleSpeedYouFirst : t.battleSpeedFoeFirst,
    ),
  );
  if (enemyThreatMult > 1.1) {
    outlookWrap.appendChild(el('span', 'lw-badge lw-badge-danger', t.battleRiskBadge));
  }
  logHeader.appendChild(outlookWrap);

  const currentSpeed = settings.battleSpeed ?? 'normal';
  const speedBtn = el('button', 'lw-btn lw-btn-sm', t.battleSpeedLabels[currentSpeed]);
  speedBtn.setAttribute('data-testid', 'btn-battle-speed');
  speedBtn.addEventListener('click', () => {
    const next = NEXT_SPEED[controller.state.settings.battleSpeed ?? 'normal'];
    controller.updateSettings({ battleSpeed: next });
  });
  logHeader.appendChild(speedBtn);

  const narrativeCol = el('div', 'lw-battle-narrative-col');
  narrativeCol.appendChild(logHeader);

  const logBox = el('div', 'lw-battle-log');
  logBox.dataset.captured = String(battle.outcome === 'captured');
  for (const entry of controller.battleLogs.slice(-3)) {
    const lineDiv = el('div', 'lw-battle-log-line');
    if (contentLang === 'vi_only') {
      lineDiv.appendChild(document.createTextNode(entry.messageVi));
    } else {
      lineDiv.appendChild(renderInteractiveEnglish(controller, entry.messageEn, 'battle_log'));
      if (contentLang === 'bilingual') {
        lineDiv.appendChild(el('div', 'lw-battle-log-vi', entry.messageVi));
      }
    }
    logBox.appendChild(lineDiv);
  }
  narrativeCol.appendChild(logBox);

  if (showAssist && battle.outcome === 'ongoing') {
    const tipText = pickText(
      uiLang,
      assistPlan.primaryAction.reasonEn,
      assistPlan.primaryAction.reasonVi,
    );
    const assistBox = el('div', 'lw-battle-assist-bar');
    assistBox.setAttribute('data-testid', 'battle-assist-bar');
    assistBox.dataset.primaryAction = assistPlan.primaryAction.kind;
    assistBox.appendChild(el('strong', '', `${t.battleAssistTitle} `));
    assistBox.appendChild(document.createTextNode(tipText));
    narrativeCol.appendChild(assistBox);
  }

  if (battle.outcome !== 'ongoing') {
    deck.appendChild(narrativeCol);
    const finishBtn = el('button', 'lw-btn lw-btn-primary', t.battleContinueBtn);
    finishBtn.setAttribute('data-testid', 'btn-battle-finish');
    finishBtn.addEventListener('click', () => controller.finishAndCloseBattle());
    deck.appendChild(finishBtn);
    wrapper.appendChild(deck);
    return wrapper;
  }

  const columns = el('div', 'lw-battle-columns');
  columns.appendChild(narrativeCol);
  const commandCol = el('div', 'lw-battle-command-col');

  const bagLabel =
    battle.kind === 'wild'
      ? t.battleTabBagWild(guaranteedFirstCatch ? 100 : bestCharmPct)
      : t.battleTabBagPlain;
  const teamLabel = t.battleTabTeam(
    battle.playerParty.length,
    showAssist && assistPlan.primaryAction.kind === 'switch' && hasBenchCounter,
  );

  const primaryKind = assistPlan.primaryAction.kind;
  const bagTabRecommended =
    showAssist &&
    (primaryKind === 'capture' || (primaryKind === 'heal' && Boolean(assistPlan.primaryAction.itemId)));
  const teamTabRecommended = showAssist && primaryKind === 'switch';

  const nav = el('div', 'lw-choice-list lw-battle-tabs');
  for (const [tabKey, label, isRecTab] of [
    ['moves', t.battleTabMoves, false],
    ['bag', bagLabel, bagTabRecommended],
    ['team', teamLabel, teamTabRecommended],
    ['tactics', t.battleTabTactics, false],
  ] as const) {
    const cls = [
      'lw-btn',
      battleTab === tabKey ? 'lw-btn-primary' : '',
      isRecTab ? 'lw-btn-highlight' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const b = el('button', cls, label);
    b.setAttribute('data-testid', `battle-tab-${tabKey}`);
    if (isRecTab) {
      b.dataset.recommended = 'true';
    }
    b.addEventListener('click', () => onSelectTab(tabKey));
    nav.appendChild(b);
  }
  commandCol.appendChild(nav);

  if (battleTab === 'moves') {
    const grid = el('div', 'lw-move-grid');
    player.moves.forEach((slot, idx) => {
      const mDef = MOVES_BY_ID[slot.moveId];
      if (!mDef) return;
      const ann = assistPlan.moveAnnotations[idx];
      const elMeta = ELEMENT_LABELS[mDef.element];
      const elLabel = uiLang === 'en' ? elMeta.en : elMeta.vi;
      const mult = ann?.multiplier ?? (mDef.power > 0 ? getTypeMultiplier(mDef.element, enemySpec.element) : 1);
      const isRec = showAssist && Boolean(ann?.isRecommended);

      const card = el('div', isRec ? 'lw-move-card lw-move-card-recommended' : 'lw-move-card');
      card.style.borderLeft = `4px solid ${elMeta.color}`;
      card.dataset.category = mDef.power > 0 ? 'attack' : 'support';
      card.dataset.effectiveness = mult > 1.05 ? 'super' : mult < 0.95 ? 'resisted' : 'normal';
      card.dataset.recommended = String(isRec);

      const head = el('div', 'lw-hud-title');
      const moveLabel = uiLang === 'en' ? mDef.name : (mDef.nameVi ?? mDef.name);
      const useMoveBtn = el(
        'button',
        isRec ? 'lw-btn lw-btn-primary lw-btn-highlight' : 'lw-btn lw-btn-primary',
        `${moveLabel} (${slot.pp}/${slot.maxPp})`,
      );
      useMoveBtn.setAttribute('data-testid', `btn-move-${idx}`);
      useMoveBtn.addEventListener('click', () =>
        controller.submitBattleAction({ kind: 'move', moveIndex: idx }),
      );
      const pill = el(
        'span',
        'lw-badge lw-badge-element',
        mDef.power > 0 ? `${elLabel} ${mDef.power}` : `${elLabel} ${t.battleSupportTag}`,
      );
      pill.style.background = elMeta.color;
      head.append(useMoveBtn, pill);
      if (mult > 1.05) {
        head.appendChild(el('span', 'lw-badge lw-badge-eff-good', t.battleEffectiveTag));
      } else if (mult < 0.95) {
        head.appendChild(el('span', 'lw-badge', t.battleResistedTag));
      }
      if (showAssist && ann?.koRisk) {
        head.appendChild(el('span', 'lw-badge lw-badge-danger', t.battleKoRiskTag));
      }
      if (isRec) {
        head.appendChild(el('span', 'lw-badge lw-badge-gleaming', t.battleRecommendedTag));
      }
      card.appendChild(head);

      const desc = el('div', 'lw-hud-quest');
      desc.style.marginTop = '2px';
      if (contentLang === 'vi_only' || (uiLang === 'vi' && contentLang === 'bilingual')) {
        desc.textContent = mDef.descriptionVi;
      } else {
        desc.appendChild(renderInteractiveEnglish(controller, mDef.descriptionEn, 'move_desc'));
      }
      card.appendChild(desc);
      grid.appendChild(card);
    });
    commandCol.appendChild(grid);
  } else if (battleTab === 'bag') {
    const list = el('div', 'lw-move-grid');
    const usableItems = controller.state.inventory.filter((s) => {
      const def = ITEMS_BY_ID[s.itemId];
      return s.quantity > 0 && def && def.category !== 'key' && def.category !== 'lantern';
    });
    if (usableItems.length === 0) {
      list.appendChild(el('div', '', t.battleNoItems));
    }
    const guaranteed =
      battle.kind === 'wild' &&
      shouldGuaranteeFirstTutorialCapture({
        state: controller.state,
        enemyHpRatio: enemy.currentHp / Math.max(1, enemy.maxHp),
        turnCount: battle.turnCount,
      });

    const recommendedItemId =
      showAssist && assistPlan.primaryAction.kind === 'capture'
        ? assistPlan.primaryAction.charmId
        : showAssist && assistPlan.primaryAction.kind === 'heal'
          ? assistPlan.primaryAction.itemId
          : undefined;

    for (const slot of usableItems) {
      const def = ITEMS_BY_ID[slot.itemId]!;
      const isRecItem = Boolean(recommendedItemId && def.id === recommendedItemId);
      const card = el('div', isRecItem ? 'lw-move-card lw-move-card-recommended' : 'lw-move-card');
      card.dataset.recommended = String(isRecItem);
      let extra = '';
      if (def.category === 'charm' && battle.kind === 'wild') {
        if (guaranteed) {
          extra = t.battleBondGuaranteed;
        } else {
          const pct = Math.round(
            computeCaptureProbability({
              target: enemy,
              species: enemySpec,
              charmMultiplier: def.captureMultiplier ?? 1,
              difficultyMultiplier: diffProfile.captureBonusMultiplier,
            }) * 100,
          );
          extra = t.battleBondEstimate(pct);
        }
      }
      const row = el('div', 'lw-hud-title');
      row.appendChild(createItemSpriteSpan(def.id));
      const itemName = pickText(uiLang, def.nameEn, def.nameVi);
      const btnClass = [
        'lw-btn',
        def.category === 'charm' ? 'lw-btn-moss' : '',
        isRecItem ? 'lw-btn-highlight' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const btn = el('button', btnClass, `${itemName} x${slot.quantity}${extra}`);
      btn.setAttribute('data-testid', `btn-battle-item-${def.id}`);
      if (isRecItem) {
        btn.dataset.recommended = 'true';
      }
      btn.addEventListener('click', () =>
        controller.submitBattleAction({ kind: 'item', itemId: def.id }),
      );
      row.appendChild(btn);
      if (isRecItem) {
        row.appendChild(el('span', 'lw-badge lw-badge-gleaming', t.battleRecommendedTag));
      }
      card.appendChild(row);
      card.appendChild(el('div', 'lw-hud-quest', pickText(uiLang, def.descriptionEn, def.descriptionVi)));
      list.appendChild(card);
    }
    commandCol.appendChild(list);
  } else if (battleTab === 'team') {
    const list = el('div', 'lw-move-grid');
    const recommendedSwitchIdx =
      showAssist && assistPlan.primaryAction.kind === 'switch'
        ? assistPlan.primaryAction.partyIndex
        : -1;
    battle.playerParty.forEach((member, idx) => {
      const sp = SPECIES_BY_ID[member.speciesId]!;
      const matchMult = getTypeMultiplier(sp.element, enemySpec.element);
      const isRecSwitch = idx === recommendedSwitchIdx;
      const card = el('div', isRecSwitch ? 'lw-move-card lw-move-card-recommended' : 'lw-move-card');
      card.dataset.level = String(member.level);
      card.dataset.recommended = String(isRecSwitch);
      const row = el('div', 'lw-hud-title');
      row.appendChild(
        createCreatureSpriteSpan(sp.dexNumber, { gleaming: Boolean(member.isRareVariant) }),
      );
      const btnClass = [
        'lw-btn',
        matchMult > 1.1 && idx !== battle.activePlayerIndex ? 'lw-btn-moss' : '',
        isRecSwitch ? 'lw-btn-highlight' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const btn = el(
        'button',
        btnClass,
        `${sp.name} ${t.levelShort(member.level)} (${member.currentHp}/${member.maxHp})`,
      ) as HTMLButtonElement;
      btn.disabled = idx === battle.activePlayerIndex || member.currentHp <= 0;
      if (isRecSwitch) {
        btn.dataset.recommended = 'true';
      }
      btn.addEventListener('click', () => {
        onSelectTab('moves');
        controller.submitBattleAction({ kind: 'switch', partyIndex: idx });
      });
      row.appendChild(btn);
      if (isRecSwitch) {
        row.appendChild(el('span', 'lw-badge lw-badge-gleaming', t.battleRecommendedTag));
      } else if (matchMult > 1.1) {
        row.appendChild(el('span', 'lw-badge lw-badge-eff-good', t.battleCountersFoe));
      }
      card.appendChild(row);
      list.appendChild(card);
    });
    commandCol.appendChild(list);
  } else {
    const actions = el('div', 'lw-choice-list');
    const obsBtn = el('button', 'lw-btn lw-btn-moss', t.battleObserveBtn);
    obsBtn.setAttribute('data-testid', 'btn-battle-observe');
    obsBtn.addEventListener('click', () => controller.submitBattleAction({ kind: 'observe' }));
    actions.appendChild(obsBtn);

    if (battle.kind === 'wild') {
      const fleeBtn = el('button', 'lw-btn', t.battleFleeBtn);
      fleeBtn.setAttribute('data-testid', 'btn-battle-flee');
      fleeBtn.addEventListener('click', () => controller.submitBattleAction({ kind: 'flee' }));
      actions.appendChild(fleeBtn);
    }
    commandCol.appendChild(actions);
  }

  columns.appendChild(commandCol);
  deck.appendChild(columns);
  wrapper.appendChild(deck);
  return wrapper;
}

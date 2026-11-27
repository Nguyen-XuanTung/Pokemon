import { ITEMS_BY_ID } from '../data/items.ts';
import { MOVES_BY_ID } from '../data/moves.ts';
import { SPECIES_BY_ID } from '../data/species.ts';
import { computeCaptureProbability } from '../domain/capture.ts';
import { ELEMENT_LABELS, getTypeMultiplier } from '../domain/elements.ts';
import type { BattleSpeedMode, CreatureInstance } from '../domain/types.ts';
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

const SPEED_BADGE_TEXT: Readonly<Record<BattleSpeedMode, string>> = {
  normal: 'Pace: 1x',
  fast: 'Pace: 2x Fast',
  instant: 'Pace: Instant',
};

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
  party: ReadonlyArray<CreatureInstance>,
  name: string,
  element: keyof typeof ELEMENT_LABELS,
  isEnemy: boolean,
): HTMLElement {
  const plate = el('div', isEnemy ? 'lw-combatant-plate lw-plate-enemy' : 'lw-combatant-plate');
  const top = el('div', 'lw-hud-title');
  top.appendChild(el('strong', '', `${name} Lv.${creature.level}`));
  const elMeta = ELEMENT_LABELS[element];
  const badge = el('span', 'lw-badge lw-badge-element', elMeta.en);
  badge.style.background = elMeta.color;
  top.appendChild(badge);
  if (creature.status) {
    top.appendChild(el('span', 'lw-badge lw-badge-status', creature.status.toUpperCase()));
  }
  if (isEnemy && controller.state.caughtSpecies.includes(creature.speciesId)) {
    top.appendChild(el('span', 'lw-badge', 'Bonded'));
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

  const foot = el('div', 'lw-plate-foot');
  foot.appendChild(el('span', 'lw-hud-quest', `HP ${creature.currentHp}/${creature.maxHp}`));
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
      battle.playerParty,
      player.nickname ?? playerSpec.name,
      playerSpec.element,
      false,
    ),
  );
  topPlates.appendChild(
    buildCombatantPlate(
      controller,
      enemy,
      battle.enemyParty,
      `${battle.kind === 'wild' ? 'Wild' : 'Foe'} ${enemySpec.name}`,
      enemySpec.element,
      true,
    ),
  );
  wrapper.appendChild(topPlates);

  const deck = el('section', 'lw-battle-deck lw-interactive');
  deck.setAttribute('data-testid', 'battle-deck');

  const logHeader = el('div', 'lw-battle-header-row');
  logHeader.appendChild(
    el(
      'span',
      'lw-hud-quest',
      `Turn ${battle.turnCount} | ${enemySpec.titleEn} (${ROLE_LABELS[enemySpec.combatRole].en})`,
    ),
  );
  const currentSpeed = controller.state.settings.battleSpeed ?? 'normal';
  const speedBtn = el(
    'button',
    'lw-btn lw-btn-sm',
    SPEED_BADGE_TEXT[currentSpeed],
  );
  speedBtn.setAttribute('data-testid', 'btn-battle-speed');
  speedBtn.addEventListener('click', () => {
    const next = NEXT_SPEED[controller.state.settings.battleSpeed ?? 'normal'];
    controller.updateSettings({ battleSpeed: next });
  });
  logHeader.appendChild(speedBtn);
  deck.appendChild(logHeader);

  const logBox = el('div', 'lw-battle-log');
  for (const entry of controller.battleLogs.slice(-3)) {
    const lineDiv = el('div', 'lw-battle-log-line');
    lineDiv.appendChild(renderInteractiveEnglish(controller, entry.messageEn, 'battle_log'));
    if (controller.state.settings.supportMode === 'bilingual') {
      const sub = el('div', 'lw-battle-log-vi', entry.messageVi);
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
    finishBtn.addEventListener('click', () => controller.finishAndCloseBattle());
    deck.appendChild(finishBtn);
    wrapper.appendChild(deck);
    return wrapper;
  }

  const nav = el('div', 'lw-choice-list lw-battle-tabs');
  for (const [tabKey, label] of [
    ['moves', 'Moves'],
    ['bag', battle.kind === 'wild' ? 'Chimes & Bag' : 'Bag'],
    ['team', `Team (${battle.playerParty.length})`],
    ['tactics', 'Observe & Flee'],
  ] as const) {
    const b = el(
      'button',
      battleTab === tabKey ? 'lw-btn lw-btn-primary' : 'lw-btn',
      label,
    );
    b.setAttribute('data-testid', `battle-tab-${tabKey}`);
    b.addEventListener('click', () => onSelectTab(tabKey));
    nav.appendChild(b);
  }
  deck.appendChild(nav);

  if (battleTab === 'moves') {
    const grid = el('div', 'lw-move-grid');
    player.moves.forEach((slot, idx) => {
      const mDef = MOVES_BY_ID[slot.moveId];
      if (!mDef) return;
      const elMeta = ELEMENT_LABELS[mDef.element];
      const mult = mDef.power > 0 ? getTypeMultiplier(mDef.element, enemySpec.element) : 1;
      const card = el('div', 'lw-move-card');
      const head = el('div', 'lw-hud-title');
      const useMoveBtn = el(
        'button',
        'lw-btn lw-btn-primary',
        `${mDef.name} (${slot.pp}/${slot.maxPp})`,
      );
      useMoveBtn.setAttribute('data-testid', `btn-move-${idx}`);
      useMoveBtn.addEventListener('click', () =>
        controller.submitBattleAction({ kind: 'move', moveIndex: idx }),
      );
      const pill = el(
        'span',
        'lw-badge lw-badge-element',
        mDef.power > 0 ? `${elMeta.en} ${mDef.power}` : `${elMeta.en} Support`,
      );
      pill.style.background = elMeta.color;
      head.append(useMoveBtn, pill);
      if (mult > 1.05) {
        head.appendChild(el('span', 'lw-badge lw-badge-eff-good', 'Effective'));
      } else if (mult < 0.95) {
        head.appendChild(el('span', 'lw-badge', 'Resisted'));
      }
      card.appendChild(head);

      const desc = el('div', 'lw-hud-quest');
      desc.style.marginTop = '3px';
      desc.appendChild(renderInteractiveEnglish(controller, mDef.descriptionEn, 'move_desc'));
      card.appendChild(desc);
      grid.appendChild(card);
    });
    deck.appendChild(grid);
  } else if (battleTab === 'bag') {
    const list = el('div', 'lw-move-grid');
    const usableItems = controller.state.inventory.filter((s) => {
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
      row.appendChild(createItemSpriteSpan(def.id));
      const btn = el(
        'button',
        def.category === 'charm' ? 'lw-btn lw-btn-moss' : 'lw-btn',
        `${def.nameEn} x${slot.quantity}${extra}`,
      );
      btn.setAttribute('data-testid', `btn-battle-item-${def.id}`);
      btn.addEventListener('click', () =>
        controller.submitBattleAction({ kind: 'item', itemId: def.id }),
      );
      row.appendChild(btn);
      card.appendChild(row);
      list.appendChild(card);
    }
    deck.appendChild(list);
  } else if (battleTab === 'team') {
    const list = el('div', 'lw-move-grid');
    battle.playerParty.forEach((member, idx) => {
      const sp = SPECIES_BY_ID[member.speciesId]!;
      const card = el('div', 'lw-move-card');
      const row = el('div', 'lw-hud-title');
      row.appendChild(createCreatureSpriteSpan(sp.dexNumber));
      const btn = el(
        'button',
        'lw-btn',
        `${sp.name} Lv.${member.level} (${member.currentHp}/${member.maxHp})`,
      ) as HTMLButtonElement;
      btn.disabled = idx === battle.activePlayerIndex || member.currentHp <= 0;
      btn.addEventListener('click', () => {
        onSelectTab('moves');
        controller.submitBattleAction({ kind: 'switch', partyIndex: idx });
      });
      row.appendChild(btn);
      card.appendChild(row);
      list.appendChild(card);
    });
    deck.appendChild(list);
  } else {
    const actions = el('div', 'lw-choice-list');
    const obsBtn = el('button', 'lw-btn lw-btn-moss', 'Observe Habits (Field Note)');
    obsBtn.setAttribute('data-testid', 'btn-battle-observe');
    obsBtn.addEventListener('click', () => controller.submitBattleAction({ kind: 'observe' }));
    actions.appendChild(obsBtn);

    if (battle.kind === 'wild') {
      const fleeBtn = el('button', 'lw-btn', 'Step Back Safely (Flee)');
      fleeBtn.setAttribute('data-testid', 'btn-battle-flee');
      fleeBtn.addEventListener('click', () => controller.submitBattleAction({ kind: 'flee' }));
      actions.appendChild(fleeBtn);
    }
    deck.appendChild(actions);
  }

  wrapper.appendChild(deck);
  return wrapper;
}

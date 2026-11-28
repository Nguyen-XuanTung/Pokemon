import type { BattleSession } from './battle.ts';
import { computeCaptureProbability } from './capture.ts';
import { getDifficultyProfile } from './difficulty.ts';
import { ELEMENT_LABELS, getTypeMultiplier } from './elements.ts';
import { shouldGuaranteeFirstTutorialCapture } from './onboarding.ts';
import type {
  CombatElement,
  GameState,
  ItemDefinition,
  MoveDefinition,
  NpcDefinition,
  SpeciesDefinition,
} from './types.ts';

export interface MoveAssistAnnotation {
  readonly moveIndex: number;
  readonly multiplier: number;
  readonly effectiveness: 'super' | 'resisted' | 'normal';
  readonly isRecommended: boolean;
  readonly koRisk: boolean;
  readonly reasonEn: string;
  readonly reasonVi: string;
}

export type PrimaryBattleAction =
  | {
      readonly kind: 'heal';
      readonly itemId?: string;
      readonly moveIndex?: number;
      readonly reasonEn: string;
      readonly reasonVi: string;
    }
  | {
      readonly kind: 'capture';
      readonly charmId: string;
      readonly chancePct: number;
      readonly guaranteed: boolean;
      readonly reasonEn: string;
      readonly reasonVi: string;
    }
  | {
      readonly kind: 'switch';
      readonly partyIndex: number;
      readonly speciesName: string;
      readonly element: CombatElement;
      readonly reasonEn: string;
      readonly reasonVi: string;
    }
  | {
      readonly kind: 'move';
      readonly moveIndex: number;
      readonly koRiskWarning: boolean;
      readonly reasonEn: string;
      readonly reasonVi: string;
    };

export interface BattleAssistPlan {
  readonly primaryAction: PrimaryBattleAction;
  readonly recommendedMoveIndex: number;
  readonly recommendedReasonEn: string;
  readonly recommendedReasonVi: string;
  readonly moveAnnotations: ReadonlyArray<MoveAssistAnnotation>;
  readonly lowHpWarning: {
    readonly active: boolean;
    readonly currentHp: number;
    readonly maxHp: number;
    readonly hasHealingItem: boolean;
    readonly bestHealingItemId?: string;
  };
  readonly switchSuggestion: {
    readonly partyIndex: number;
    readonly speciesName: string;
    readonly element: CombatElement;
  } | null;
  readonly captureAdvice: {
    readonly bestCharmId: string;
    readonly bestChancePct: number;
    readonly guaranteed: boolean;
    readonly shouldWeakenFirst: boolean;
  } | null;
}

export interface BossReadinessCheck {
  readonly isUnderleveled: boolean;
  readonly needsHeal: boolean;
  readonly needsTonics: boolean;
  readonly maxPartyLevel: number;
  readonly recommendedLevel: number;
  readonly bossNameEn: string;
  readonly bossNameVi: string;
  readonly counterElements: ReadonlyArray<CombatElement>;
}

function estimateMaxSafeDamage(params: {
  attackerLevel: number;
  attackerAtk: number;
  defenderDef: number;
  movePower: number;
  typeMult: number;
  stab: number;
  playerDmgMult: number;
}): number {
  const { attackerLevel, attackerAtk, defenderDef, movePower, typeMult, stab, playerDmgMult } =
    params;
  if (movePower <= 0) return 0;
  const base = (((2 * attackerLevel) / 5 + 2) * movePower * (attackerAtk / Math.max(1, defenderDef))) / 18 + 3;
  return Math.ceil(base * typeMult * stab * playerDmgMult * 1.08);
}

export function computeBattleAssistPlan(params: {
  session: BattleSession;
  state: GameState;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
  movesById: Readonly<Record<string, MoveDefinition>>;
  itemsById: Readonly<Record<string, ItemDefinition>>;
}): BattleAssistPlan {
  const { session, state, speciesById, movesById, itemsById } = params;
  const player = session.playerParty[session.activePlayerIndex]!;
  const enemy = session.enemyParty[session.activeEnemyIndex]!;
  const playerSpec = speciesById[player.speciesId]!;
  const enemySpec = speciesById[enemy.speciesId]!;
  const diffProfile = getDifficultyProfile(state.settings.difficulty);

  const playerHpRatio = player.currentHp / Math.max(1, player.maxHp);
  const enemyHpRatio = enemy.currentHp / Math.max(1, enemy.maxHp);
  const isUnbondedWild = session.kind === 'wild' && !state.caughtSpecies.includes(enemy.speciesId);

  let bestHealingItemId: string | undefined;
  let bestHealAmt = 0;
  for (const slot of state.inventory) {
    const def = itemsById[slot.itemId];
    if (slot.quantity > 0 && def?.healAmount && def.healAmount > bestHealAmt) {
      bestHealAmt = def.healAmount;
      bestHealingItemId = def.id;
    }
  }
  const hasHealingItem = Boolean(bestHealingItemId);

  // 1. Evaluate capture readiness if wild battle
  let captureAdvice: BattleAssistPlan['captureAdvice'] = null;
  if (session.kind === 'wild') {
    const guaranteed = shouldGuaranteeFirstTutorialCapture({
      state,
      enemyHpRatio,
      turnCount: session.turnCount,
    });
    let bestCharmId = '';
    let bestPct = 0;
    for (const slot of state.inventory) {
      const def = itemsById[slot.itemId];
      if (slot.quantity > 0 && def?.category === 'charm') {
        const pct = Math.round(
          computeCaptureProbability({
            target: enemy,
            species: enemySpec,
            charmMultiplier: def.captureMultiplier ?? 1,
            difficultyMultiplier: diffProfile.captureBonusMultiplier,
            guaranteedSuccess: guaranteed,
          }) * 100,
        );
        if (pct > bestPct) {
          bestPct = pct;
          bestCharmId = def.id;
        }
      }
    }
    if (bestCharmId) {
      captureAdvice = {
        bestCharmId,
        bestChancePct: bestPct,
        guaranteed,
        shouldWeakenFirst: !guaranteed && enemyHpRatio > 0.55 && bestPct < 70,
      };
    }
  }

  // 2. Evaluate bench counter suggestion if foe counters active partner or active HP is low
  const enemyThreatMult = getTypeMultiplier(enemySpec.element, playerSpec.element);
  let switchSuggestion: BattleAssistPlan['switchSuggestion'] = null;
  if (enemyThreatMult > 1.1 || playerHpRatio <= 0.32) {
    let bestIdx = -1;
    let bestScore = -1;
    session.playerParty.forEach((member, idx) => {
      if (idx === session.activePlayerIndex || member.currentHp <= 0) return;
      const sp = speciesById[member.speciesId];
      if (!sp) return;
      const offMult = getTypeMultiplier(sp.element, enemySpec.element);
      const defMult = getTypeMultiplier(enemySpec.element, sp.element);
      const hpRatio = member.currentHp / Math.max(1, member.maxHp);
      const score = offMult * 40 - defMult * 22 + hpRatio * 20;
      if (score > bestScore && (offMult > 1.05 || (playerHpRatio <= 0.32 && hpRatio > 0.5))) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) {
      const m = session.playerParty[bestIdx]!;
      const sp = speciesById[m.speciesId]!;
      switchSuggestion = {
        partyIndex: bestIdx,
        speciesName: m.nickname ?? sp.name,
        element: sp.element,
      };
    }
  }

  // 3. Score each move with KO-risk awareness when catching unbonded wild creatures
  let bestMoveIdx = 0;
  let bestMoveScore = -Infinity;
  let healingMoveIdx = -1;
  const rawAnnotations: Array<{
    moveIndex: number;
    multiplier: number;
    effectiveness: 'super' | 'resisted' | 'normal';
    koRisk: boolean;
    score: number;
    reasonEn: string;
    reasonVi: string;
  }> = [];

  const isTutorialFirstCatchPending =
    isUnbondedWild &&
    state.stats.wildCaught === 0 &&
    Boolean(captureAdvice) &&
    !captureAdvice!.guaranteed;

  player.moves.forEach((slot, idx) => {
    const def = movesById[slot.moveId];
    if (!def || slot.pp <= 0) {
      rawAnnotations.push({
        moveIndex: idx,
        multiplier: 1,
        effectiveness: 'normal',
        koRisk: false,
        score: -999,
        reasonEn: 'No move uses left.',
        reasonVi: 'Đã hết lượt dùng chiêu này.',
      });
      return;
    }

    const mult = def.power > 0 ? getTypeMultiplier(def.element, enemySpec.element) : 1;
    const effectiveness: 'super' | 'resisted' | 'normal' =
      mult > 1.05 ? 'super' : mult < 0.95 ? 'resisted' : 'normal';
    const stab = def.element === playerSpec.element ? 1.2 : 1;
    const estMaxDmg = estimateMaxSafeDamage({
      attackerLevel: player.level,
      attackerAtk: player.stats.atk,
      defenderDef: enemy.stats.def,
      movePower: def.power,
      typeMult: mult,
      stab,
      playerDmgMult: diffProfile.playerDamageMultiplier,
    });
    const koRisk = Boolean(isUnbondedWild && captureAdvice && def.power > 0 && estMaxDmg >= enemy.currentHp);

    if (def.healRatio && healingMoveIdx < 0) {
      healingMoveIdx = idx;
    }

    let score = 0;
    let reasonEn = 'Reliable attack move.';
    let reasonVi = 'Chiêu tấn công ổn định.';

    if (def.healRatio && playerHpRatio <= 0.4) {
      score = 135;
      reasonEn = 'Restores health while your partner is running low.';
      reasonVi = 'Giúp hồi máu ngay khi bạn đồng hành đang thấp máu.';
    } else if (
      isUnbondedWild &&
      captureAdvice &&
      def.statusEffect?.status === 'sleep' &&
      enemy.status === null &&
      enemyHpRatio > 0.25
    ) {
      score = 132;
      reasonEn = 'Puts the wild creature to sleep to raise bonding odds safely without knocking it out.';
      reasonVi = 'Giúp sinh vật hoang ngủ êm để dễ thu phục hơn mà không làm nó ngất.';
    } else if (def.power > 0) {
      score = def.power * mult * stab + (def.drainRatio && playerHpRatio < 0.65 ? 25 : 0);
      if (koRisk) {
        // Penalize moves that could accidentally KO an unbonded wild target the player may want to catch
        score -= 75;
        reasonEn = 'Careful: this strong hit may knock out the wild creature before you can bond with it.';
        reasonVi = 'Cẩn thận: đòn đánh này khá mạnh, có thể làm sinh vật hoang ngất trước khi kịp thu phục.';
      } else if (isTutorialFirstCatchPending) {
        // Gentle first-catch nudge: prefer a clean non-KO hit to soften the Lv.3 creature
        score += 30;
        reasonEn = 'Weaken the wild creature once with this move, then use a Moss Charm next turn (100% guaranteed!).';
        reasonVi = 'Dùng chiêu này làm yếu sinh vật hoang 1 lượt; ngay lượt sau mở Chuông và Túi dùng Chuông Rêu sẽ thu phục chắc chắn 100%.';
      } else if (effectiveness === 'super') {
        const mEl = ELEMENT_LABELS[def.element];
        const fEl = ELEMENT_LABELS[enemySpec.element];
        reasonEn = `${mEl.en} counters ${fEl.en} for 1.5x damage.`;
        reasonVi = `Hệ ${mEl.vi} khắc chế hệ ${fEl.vi}, gây sát thương gấp 1,5 lần.`;
      } else if (effectiveness === 'resisted') {
        const mEl = ELEMENT_LABELS[def.element];
        const fEl = ELEMENT_LABELS[enemySpec.element];
        reasonEn = `${fEl.en} resists ${mEl.en} (0.67x damage). Try another element if available.`;
        reasonVi = `Hệ ${fEl.vi} kháng hệ ${mEl.vi} (chỉ còn 0,67 lần sát thương). Nên ưu tiên chiêu hệ khác nếu có.`;
      } else if (def.drainRatio) {
        reasonEn = 'Deals damage and restores some HP to your partner at the same time.';
        reasonVi = 'Vừa tấn công vừa hồi thêm máu cho bạn đồng hành.';
      } else if (isUnbondedWild && captureAdvice && captureAdvice.shouldWeakenFirst) {
        reasonEn = 'Softens the wild creature safely to raise your capture chance.';
        reasonVi = 'Giúp làm giảm máu sinh vật hoang an toàn để tăng tỷ lệ thu phục.';
      }
    } else {
      score = 22;
      reasonEn = 'Support move that boosts your team or weakens the opponent.';
      reasonVi = 'Chiêu hỗ trợ tăng sức mạnh cho đội hoặc làm giảm sức đối thủ.';
    }

    if (score > bestMoveScore) {
      bestMoveScore = score;
      bestMoveIdx = idx;
    }

    rawAnnotations.push({
      moveIndex: idx,
      multiplier: mult,
      effectiveness,
      koRisk,
      score,
      reasonEn,
      reasonVi,
    });
  });

  // 4. Select EXACTLY ONE PrimaryBattleAction (zero conflicting highlights!)
  const lowHpActive = playerHpRatio <= 0.35;
  const bestAnn = rawAnnotations[bestMoveIdx];
  const bestCharmDef = captureAdvice ? itemsById[captureAdvice.bestCharmId] : undefined;
  const bestHealDef = bestHealingItemId ? itemsById[bestHealingItemId] : undefined;

  let primaryAction: PrimaryBattleAction;

  if (lowHpActive && hasHealingItem && bestHealingItemId && bestHealDef) {
    primaryAction = {
      kind: 'heal',
      itemId: bestHealingItemId,
      reasonEn: `HP is low (${player.currentHp}/${player.maxHp}). Open Chimes & Bag and use ${bestHealDef.nameEn} to recover safely.`,
      reasonVi: `Máu đang thấp (${player.currentHp}/${player.maxHp}). Hãy mở thẻ Chuông và Túi rồi dùng ${bestHealDef.nameVi} để hồi máu ngay.`,
    };
  } else if (lowHpActive && healingMoveIdx >= 0) {
    primaryAction = {
      kind: 'heal',
      moveIndex: healingMoveIdx,
      reasonEn: `HP is low (${player.currentHp}/${player.maxHp}). Use the highlighted healing move now.`,
      reasonVi: `Máu đang thấp (${player.currentHp}/${player.maxHp}). Hãy dùng chiêu hồi máu đang sáng viền ngay.`,
    };
  } else if (
    isUnbondedWild &&
    captureAdvice &&
    bestCharmDef &&
    (captureAdvice.guaranteed ||
      (captureAdvice.bestChancePct >= 70 && enemyHpRatio <= 0.65) ||
      (bestAnn?.koRisk && captureAdvice.bestChancePct >= 45))
  ) {
    primaryAction = {
      kind: 'capture',
      charmId: captureAdvice.bestCharmId,
      chancePct: captureAdvice.bestChancePct,
      guaranteed: captureAdvice.guaranteed,
      reasonEn: captureAdvice.guaranteed
        ? `Ready to bond! Click the highlighted Chimes & Bag tab and use ${bestCharmDef.nameEn} for a 100% guaranteed capture.`
        : bestAnn?.koRisk
          ? `Another attack risks knocking out this wild creature. Open Chimes & Bag and throw ${bestCharmDef.nameEn} (~${captureAdvice.bestChancePct}%) now!`
          : `Great capture window (~${captureAdvice.bestChancePct}%)! Open Chimes & Bag and use ${bestCharmDef.nameEn}.`,
      reasonVi: captureAdvice.guaranteed
        ? `Thời điểm hoàn hảo! Bấm thẻ Chuông và Túi (đang sáng viền) rồi chọn ${bestCharmDef.nameVi} để thu phục chắc chắn 100%.`
        : bestAnn?.koRisk
          ? `Đánh thêm dễ làm sinh vật hoang ngất ngoài ý muốn. Hãy mở thẻ Chuông và Túi rồi ném ${bestCharmDef.nameVi} (~${captureAdvice.bestChancePct}%) ngay.`
          : `Tỷ lệ thu phục đã cao (~${captureAdvice.bestChancePct}%). Hãy mở thẻ Chuông và Túi rồi chọn ${bestCharmDef.nameVi}.`,
    };
  } else if (switchSuggestion && enemyThreatMult > 1.1) {
    const foeEl = ELEMENT_LABELS[enemySpec.element];
    const plEl = ELEMENT_LABELS[playerSpec.element];
    const swEl = ELEMENT_LABELS[switchSuggestion.element];
    primaryAction = {
      kind: 'switch',
      partyIndex: switchSuggestion.partyIndex,
      speciesName: switchSuggestion.speciesName,
      element: switchSuggestion.element,
      reasonEn: `Element disadvantage: ${foeEl.en} deals 1.5x damage to ${plEl.en}. Open Team and switch to ${switchSuggestion.speciesName} (${swEl.en}).`,
      reasonVi: `Bất lợi nguyên tố: hệ ${foeEl.vi} đánh vào hệ ${plEl.vi} mạnh gấp 1,5 lần. Hãy mở thẻ Đội hình để đổi sang ${switchSuggestion.speciesName} (hệ ${swEl.vi}).`,
    };
  } else {
    const koRiskWarning = Boolean(bestAnn?.koRisk);
    const enemyRiskPrefixVi =
      enemyThreatMult > 1.1
        ? `Lưu ý: đối thủ hệ ${ELEMENT_LABELS[enemySpec.element].vi} khắc chế bạn (gây sát thương gấp 1,5 lần). `
        : '';
    const enemyRiskPrefixEn =
      enemyThreatMult > 1.1
        ? `Careful: foe's ${ELEMENT_LABELS[enemySpec.element].en} deals 1.5x damage to you. `
        : '';
    primaryAction = {
      kind: 'move',
      moveIndex: bestMoveIdx,
      koRiskWarning,
      reasonEn: `${enemyRiskPrefixEn}${bestAnn?.reasonEn ?? 'Choose the highlighted move below.'}`,
      reasonVi: `${enemyRiskPrefixVi}${bestAnn?.reasonVi ?? 'Chọn chiêu thức có nhãn Khuyên dùng bên dưới.'}`,
    };
  }

  return {
    primaryAction,
    recommendedMoveIndex: bestMoveIdx,
    recommendedReasonEn: primaryAction.reasonEn,
    recommendedReasonVi: primaryAction.reasonVi,
    moveAnnotations: rawAnnotations.map((a) => ({
      moveIndex: a.moveIndex,
      multiplier: a.multiplier,
      effectiveness: a.effectiveness,
      koRisk: a.koRisk,
      isRecommended:
        (primaryAction.kind === 'move' && primaryAction.moveIndex === a.moveIndex) ||
        (primaryAction.kind === 'heal' && primaryAction.moveIndex === a.moveIndex),
      reasonEn: a.reasonEn,
      reasonVi: a.reasonVi,
    })),
    lowHpWarning: {
      active: lowHpActive,
      currentHp: player.currentHp,
      maxHp: player.maxHp,
      hasHealingItem,
      bestHealingItemId,
    },
    switchSuggestion,
    captureAdvice,
  };
}

const BOSS_COUNTER_ELEMENTS: Readonly<Record<string, ReadonlyArray<CombatElement>>> = {
  npc_sylvan: ['ember', 'gale'],
  npc_mirella: ['leaf', 'spark'],
  npc_kaelen: ['water', 'leaf'],
  npc_astraea: ['water', 'stone', 'ember'],
};

export function checkBossReadiness(
  state: GameState,
  bossNpc: NpcDefinition,
  isRematch: boolean = false,
): BossReadinessCheck | null {
  const spec = isRematch && bossNpc.rematchBattle ? bossNpc.rematchBattle : bossNpc.trainerBattle;
  if (!spec || !spec.isBoss) return null;

  const bossMaxLevel = Math.max(...spec.party.map((p) => p.level));
  const recommendedLevel = Math.max(1, bossMaxLevel - 1);
  const maxPartyLevel =
    state.party.length > 0 ? Math.max(...state.party.map((m) => m.level)) : 0;
  const totalCurHp = state.party.reduce((sum, m) => sum + m.currentHp, 0);
  const totalMaxHp = Math.max(1, state.party.reduce((sum, m) => sum + m.maxHp, 0));
  const needsHeal = totalCurHp / totalMaxHp < 0.7;

  const tonicCount = state.inventory
    .filter((s) => s.itemId === 'dew_tonic' || s.itemId === 'orchard_salve' || s.itemId === 'nectar_flask')
    .reduce((sum, s) => sum + s.quantity, 0);

  return {
    isUnderleveled: maxPartyLevel < recommendedLevel,
    needsHeal,
    needsTonics: tonicCount < 2,
    maxPartyLevel,
    recommendedLevel,
    bossNameEn: spec.titleEn,
    bossNameVi: spec.titleVi,
    counterElements: BOSS_COUNTER_ELEMENTS[bossNpc.id] ?? ['leaf', 'water'],
  };
}

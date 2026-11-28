import type { BattleSession } from './battle.ts';
import { computeCaptureProbability } from './capture.ts';
import { getDifficultyProfile } from './difficulty.ts';
import { getTypeMultiplier } from './elements.ts';
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
  readonly reasonEn: string;
  readonly reasonVi: string;
}

export interface BattleAssistPlan {
  readonly recommendedMoveIndex: number;
  readonly recommendedReasonEn: string;
  readonly recommendedReasonVi: string;
  readonly moveAnnotations: ReadonlyArray<MoveAssistAnnotation>;
  readonly lowHpWarning: {
    readonly active: boolean;
    readonly currentHp: number;
    readonly maxHp: number;
    readonly hasHealingItem: boolean;
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
  readonly maxPartyLevel: number;
  readonly recommendedLevel: number;
  readonly bossNameEn: string;
  readonly bossNameVi: string;
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
  const hasHealingItem = state.inventory.some((slot) => {
    const def = itemsById[slot.itemId];
    return slot.quantity > 0 && Boolean(def?.healAmount);
  });

  // Evaluate capture readiness if wild battle
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
        shouldWeakenFirst: !guaranteed && enemyHpRatio > 0.55 && bestPct < 65,
      };
    }
  }

  // Evaluate bench counter suggestion if foe counters active partner or active HP is low
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

  // Score each move for beginners
  let bestMoveIdx = 0;
  let bestMoveScore = -Infinity;
  const rawAnnotations: Array<{
    moveIndex: number;
    multiplier: number;
    effectiveness: 'super' | 'resisted' | 'normal';
    score: number;
    reasonEn: string;
    reasonVi: string;
  }> = [];

  player.moves.forEach((slot, idx) => {
    const def = movesById[slot.moveId];
    if (!def || slot.pp <= 0) {
      rawAnnotations.push({
        moveIndex: idx,
        multiplier: 1,
        effectiveness: 'normal',
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

    let score = 0;
    let reasonEn = 'Reliable attack move.';
    let reasonVi = 'Chiêu tấn công ổn định.';

    if (def.healRatio && playerHpRatio <= 0.45) {
      score = 135;
      reasonEn = 'Restores health while your partner is running low.';
      reasonVi = 'Giúp hồi máu ngay khi bạn đồng hành đang thấp máu.';
    } else if (
      session.kind === 'wild' &&
      !state.caughtSpecies.includes(enemy.speciesId) &&
      def.statusEffect?.status === 'sleep' &&
      enemy.status === null &&
      enemyHpRatio > 0.3
    ) {
      score = 128;
      reasonEn = 'Puts the wild creature to sleep and boosts bonding odds.';
      reasonVi = 'Giúp sinh vật hoang ngủ êm để tăng mạnh tỷ lệ thu phục.';
    } else if (def.power > 0) {
      score = def.power * mult * stab + (def.drainRatio && playerHpRatio < 0.65 ? 25 : 0);
      if (effectiveness === 'super') {
        reasonEn = 'Super effective (1.5x damage) against this foe element.';
        reasonVi = 'Khắc chế nguyên tố đối thủ, gây sát thương gấp 1,5 lần.';
      } else if (effectiveness === 'resisted') {
        reasonEn = 'Resisted (0.67x damage). Try another element if available.';
        reasonVi = 'Đối thủ kháng nguyên tố này (chỉ còn 0,67 lần sát thương).';
      } else if (def.drainRatio) {
        reasonEn = 'Deals damage and recovers health at the same time.';
        reasonVi = 'Vừa tấn công vừa hút máu hồi sức cho bản thân.';
      }
    } else {
      score = 22;
      reasonEn = 'Support move that shifts battle stats or status.';
      reasonVi = 'Chiêu hỗ trợ tăng chỉ số hoặc tạo trạng thái có lợi.';
    }

    if (score > bestMoveScore) {
      bestMoveScore = score;
      bestMoveIdx = idx;
    }

    rawAnnotations.push({
      moveIndex: idx,
      multiplier: mult,
      effectiveness,
      score,
      reasonEn,
      reasonVi,
    });
  });

  const bestAnn = rawAnnotations[bestMoveIdx];

  return {
    recommendedMoveIndex: bestMoveIdx,
    recommendedReasonEn: bestAnn?.reasonEn ?? 'Choose an attacking move.',
    recommendedReasonVi: bestAnn?.reasonVi ?? 'Chọn một chiêu tấn công phù hợp.',
    moveAnnotations: rawAnnotations.map((a) => ({
      moveIndex: a.moveIndex,
      multiplier: a.multiplier,
      effectiveness: a.effectiveness,
      isRecommended: a.moveIndex === bestMoveIdx && a.score > -900,
      reasonEn: a.reasonEn,
      reasonVi: a.reasonVi,
    })),
    lowHpWarning: {
      active: playerHpRatio <= 0.35,
      currentHp: player.currentHp,
      maxHp: player.maxHp,
      hasHealingItem,
    },
    switchSuggestion,
    captureAdvice,
  };
}

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

  return {
    isUnderleveled: maxPartyLevel < recommendedLevel,
    needsHeal,
    maxPartyLevel,
    recommendedLevel,
    bossNameEn: spec.titleEn,
    bossNameVi: spec.titleVi,
  };
}

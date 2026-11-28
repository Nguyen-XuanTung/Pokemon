import { ITEMS_ZH, MOVES_ZH, SPECIES_ZH } from '../data/zh-world-content.ts';
import {
  awardCreatureExperience,
  type ExpGainResult,
} from './creatures.ts';
import { resolveCaptureAttempt, type CaptureAttemptResult } from './capture.ts';
import { getDifficultyProfile } from './difficulty.ts';
import { describeEffectiveness, getTypeMultiplier } from './elements.ts';
import type { SeededRng } from './rng.ts';
import type {
  CreatureInstance,
  DifficultyMode,
  ElementType,
  InventorySlot,
  ItemDefinition,
  MoveDefinition,
  SpeciesDefinition,
  StatusId,
} from './types.ts';

export interface StatStages {
  atk: number;
  def: number;
  spd: number;
}

export interface BattleEventLog {
  readonly kind:
    | 'text'
    | 'move'
    | 'damage'
    | 'heal'
    | 'status'
    | 'switch'
    | 'capture'
    | 'faint'
    | 'exp'
    | 'flee'
    | 'victory'
    | 'defeat';
  readonly messageEn: string;
  readonly messageVi: string;
  readonly messageZh?: string;
  readonly actor?: 'player' | 'enemy';
  readonly element?: ElementType;
  readonly damage?: number;
  readonly isSuperEffective?: boolean;
  readonly isResisted?: boolean;
  readonly shakes?: number;
  readonly captured?: boolean;
}

export type PlayerBattleAction =
  | { readonly kind: 'move'; readonly moveIndex: number }
  | { readonly kind: 'switch'; readonly partyIndex: number }
  | { readonly kind: 'item'; readonly itemId: string; readonly targetPartyIndex?: number }
  | { readonly kind: 'observe' }
  | { readonly kind: 'flee' };

export type BattleOutcome =
  | 'ongoing'
  | 'player_victory'
  | 'captured'
  | 'fled'
  | 'player_defeat';

export interface BattleSession {
  readonly kind: 'wild' | 'trainer';
  readonly isBoss: boolean;
  readonly opponentTitleEn: string;
  readonly opponentTitleVi: string;
  readonly opponentTitleZh: string;
  readonly rewardTokens: number;
  readonly playerParty: CreatureInstance[];
  readonly enemyParty: CreatureInstance[];
  activePlayerIndex: number;
  activeEnemyIndex: number;
  playerStages: StatStages;
  enemyStages: StatStages;
  turnCount: number;
  fleeAttempts: number;
  outcome: BattleOutcome;
  capturedCreature?: CreatureInstance;
  lastCaptureAttempt?: CaptureAttemptResult;
  expResults: ExpGainResult[];
}

export interface BattleContextData {
  readonly speciesById: Readonly<Record<string, SpeciesDefinition>>;
  readonly movesById: Readonly<Record<string, MoveDefinition>>;
  readonly itemsById: Readonly<Record<string, ItemDefinition>>;
  readonly inventory: InventorySlot[];
  readonly rng: SeededRng;
  readonly difficulty?: DifficultyMode;
  readonly guaranteedCapture?: boolean;
}

function freshStages(): StatStages {
  return { atk: 0, def: 0, spd: 0 };
}

function stageMultiplier(stage: number): number {
  const clamped = Math.max(-4, Math.min(4, stage));
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

function getEffectiveSpeed(creature: CreatureInstance, stages: StatStages): number {
  const base = creature.stats.spd * stageMultiplier(stages.spd);
  return creature.status === 'paralyze' ? Math.max(1, Math.floor(base * 0.6)) : Math.floor(base);
}

function consumeInventoryItem(inventory: InventorySlot[], itemId: string): boolean {
  const slot = inventory.find((s) => s.itemId === itemId && s.quantity > 0);
  if (!slot) return false;
  slot.quantity -= 1;
  return true;
}

export function createBattleSession(params: {
  kind: 'wild' | 'trainer';
  isBoss?: boolean;
  opponentTitleEn: string;
  opponentTitleVi: string;
  opponentTitleZh?: string;
  rewardTokens?: number;
  playerParty: CreatureInstance[];
  enemyParty: CreatureInstance[];
}): BattleSession {
  const firstAlivePlayer = params.playerParty.findIndex((c) => c.currentHp > 0);
  const firstAliveEnemy = params.enemyParty.findIndex((c) => c.currentHp > 0);
  const firstEnemySpecId = params.enemyParty[firstAliveEnemy >= 0 ? firstAliveEnemy : 0]?.speciesId;
  const fallbackWildZh = firstEnemySpecId ? `野生${SPECIES_ZH[firstEnemySpecId]?.nameZh ?? ''}` : params.opponentTitleEn;
  return {
    kind: params.kind,
    isBoss: Boolean(params.isBoss),
    opponentTitleEn: params.opponentTitleEn,
    opponentTitleVi: params.opponentTitleVi,
    opponentTitleZh: params.opponentTitleZh ?? (params.kind === 'wild' ? fallbackWildZh : params.opponentTitleEn),
    rewardTokens: params.rewardTokens ?? 0,
    playerParty: params.playerParty,
    enemyParty: params.enemyParty,
    activePlayerIndex: firstAlivePlayer >= 0 ? firstAlivePlayer : 0,
    activeEnemyIndex: firstAliveEnemy >= 0 ? firstAliveEnemy : 0,
    playerStages: freshStages(),
    enemyStages: freshStages(),
    turnCount: 1,
    fleeAttempts: 0,
    outcome: 'ongoing',
    expResults: [],
  };
}

function selectEnemyMoveIndex(
  session: BattleSession,
  ctx: BattleContextData,
): number {
  const enemy = session.enemyParty[session.activeEnemyIndex];
  const player = session.playerParty[session.activePlayerIndex];
  if (!enemy || !player) return 0;
  const playerSpecies = ctx.speciesById[player.speciesId];
  const usable = enemy.moves
    .map((slot, idx) => ({ slot, idx, def: ctx.movesById[slot.moveId] }))
    .filter((entry) => entry.slot.pp > 0 && entry.def !== undefined);

  if (usable.length === 0) {
    return -1;
  }

  const profile = getDifficultyProfile(ctx.difficulty);
  if (((session.isBoss && profile.smartBossAi) || profile.smartAllOpponentAi) && playerSpecies) {
    const weighted = usable.map((entry) => {
      const def = entry.def!;
      let weight = 10;
      if (def.power > 0) {
        const mult = getTypeMultiplier(def.element, playerSpecies.element);
        weight = Math.round(def.power * mult * (profile.smartAllOpponentAi ? 1.35 : 1));
      } else if (def.healRatio && enemy.currentHp < enemy.maxHp * 0.48) {
        weight = 85;
      } else if (def.statusEffect && player.status === null) {
        weight = profile.smartAllOpponentAi ? 55 : 45;
      }
      return { item: entry.idx, weight: Math.max(5, weight) };
    });
    return ctx.rng.weightedPick(weighted);
  }

  return ctx.rng.pick(usable).idx;
}

function executeMove(params: {
  attacker: CreatureInstance;
  attackerStages: StatStages;
  defender: CreatureInstance;
  defenderStages: StatStages;
  moveIndex: number;
  isPlayerAttacker: boolean;
  ctx: BattleContextData;
  logs: BattleEventLog[];
}): void {
  const {
    attacker,
    attackerStages,
    defender,
    defenderStages,
    moveIndex,
    isPlayerAttacker,
    ctx,
    logs,
  } = params;
  if (attacker.currentHp <= 0 || defender.currentHp <= 0) return;

  const attackerSpecies = ctx.speciesById[attacker.speciesId];
  const defenderSpecies = ctx.speciesById[defender.speciesId];
  if (!attackerSpecies || !defenderSpecies) return;
  const attackerLabel = attacker.nickname ?? attackerSpecies.name;
  const defenderLabel = defender.nickname ?? defenderSpecies.name;
  const attackerZh = attacker.nickname ?? SPECIES_ZH[attacker.speciesId]?.nameZh ?? attackerSpecies.name;
  const defenderZh = defender.nickname ?? SPECIES_ZH[defender.speciesId]?.nameZh ?? defenderSpecies.name;

  if (attacker.status === 'sleep') {
    if (attacker.statusTurns > 0) {
      attacker.statusTurns -= 1;
      logs.push({
        kind: 'status',
        messageEn: `${attackerLabel} is resting peacefully and cannot act yet.`,
        messageVi: `${attackerLabel} đang say ngủ nên chưa thể hành động.`,
        messageZh: `${attackerZh}正在安静睡觉，暂时无法行动。`,
      });
      return;
    }
    attacker.status = null;
    logs.push({
      kind: 'status',
      messageEn: `${attackerLabel} woke up alert and ready!`,
      messageVi: `${attackerLabel} đã tỉnh giấc và sẵn sàng!`,
      messageZh: `${attackerZh}醒过来了，准备好行动！`,
    });
  }

  if (attacker.status === 'paralyze' && ctx.rng.chance(0.25)) {
    logs.push({
      kind: 'status',
      messageEn: `Static sparks hold ${attackerLabel} back this turn!`,
      messageVi: `Tĩnh điện khiến ${attackerLabel} khựng lại ở lượt này!`,
      messageZh: `${attackerZh}因为麻痹这一回合没能出手！`,
    });
    return;
  }

  let moveDef: MoveDefinition;
  const chosenSlot = moveIndex >= 0 ? attacker.moves[moveIndex] : undefined;
  if (chosenSlot && chosenSlot.pp > 0 && ctx.movesById[chosenSlot.moveId]) {
    chosenSlot.pp -= 1;
    moveDef = ctx.movesById[chosenSlot.moveId]!;
  } else {
    moveDef = {
      id: 'struggle_nudge',
      name: 'Wild Nudge',
      element: 'neutral',
      category: 'physical',
      power: 30,
      accuracy: 100,
      maxPp: 99,
      priority: 0,
      descriptionEn: 'A tired basic tackle when energy runs low.',
      descriptionVi: 'Cú húc cơ bản khi cạn năng lượng chiêu thức.',
    };
  }

  const moveNameZh = MOVES_ZH[moveDef.id]?.nameZh ?? '普通撞击';
  const actorSide: 'player' | 'enemy' = isPlayerAttacker ? 'player' : 'enemy';
  logs.push({
    kind: 'move',
    actor: actorSide,
    element: moveDef.element,
    messageEn: `${isPlayerAttacker ? '' : 'Foe '}${attackerLabel} uses ${moveDef.name}!`,
    messageVi: `${isPlayerAttacker ? '' : 'Đối phương '}${attackerLabel} dùng chiêu ${moveDef.nameVi ?? moveDef.name}!`,
    messageZh: `${isPlayerAttacker ? '' : '对手的'}${attackerZh}使出了${moveNameZh}！`,
  });

  if (moveDef.accuracy < 100 && !ctx.rng.chance(moveDef.accuracy / 100)) {
    logs.push({
      kind: 'text',
      actor: actorSide,
      messageEn: `${defenderLabel} stepped aside and avoided the move!`,
      messageVi: `${defenderLabel} khéo léo né được đòn đánh!`,
      messageZh: `${defenderZh}灵巧地躲开了这一招！`,
    });
    return;
  }

  if (moveDef.power > 0) {
    const atkEffective =
      attacker.stats.atk *
      stageMultiplier(attackerStages.atk) *
      (attacker.status === 'burn' && moveDef.category === 'physical' ? 0.78 : 1);
    const defEffective = Math.max(1, defender.stats.def * stageMultiplier(defenderStages.def));
    const stab = moveDef.element === attackerSpecies.element ? 1.2 : 1;
    const typeMult = getTypeMultiplier(moveDef.element, defenderSpecies.element);
    const variance = 0.9 + ctx.rng.nextFloat() * 0.14;
    const levelFactor = (2 * attacker.level) / 5 + 2;
    const profile = getDifficultyProfile(ctx.difficulty);
    const diffMult = isPlayerAttacker
      ? profile.playerDamageMultiplier
      : profile.enemyDamageMultiplier;
    const baseDamage = ((levelFactor * moveDef.power * (atkEffective / defEffective)) / 24 + 2);
    const damage = Math.max(1, Math.round(baseDamage * stab * typeMult * variance * diffMult));

    defender.currentHp = Math.max(0, defender.currentHp - damage);
    const eff = describeEffectiveness(typeMult);
    logs.push({
      kind: 'damage',
      actor: actorSide,
      element: moveDef.element,
      damage,
      isSuperEffective: typeMult > 1.05,
      isResisted: typeMult < 0.95,
      messageEn: `${defenderLabel} took ${damage} damage.${eff.messageEn ? ' ' + eff.messageEn : ''}`,
      messageVi: `${defenderLabel} mất ${damage} máu.${eff.messageVi ? ' ' + eff.messageVi : ''}`,
      messageZh: `${defenderZh}受到 ${damage} 点伤害。${eff.messageZh}`,
    });

    if (moveDef.drainRatio && attacker.currentHp > 0) {
      const drained = Math.max(1, Math.round(damage * moveDef.drainRatio));
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + drained);
      logs.push({
        kind: 'heal',
        messageEn: `${attackerLabel} absorbed ${drained} vitality!`,
        messageVi: `${attackerLabel} hấp thụ và hồi ${drained} máu!`,
        messageZh: `${attackerZh}吸取并恢复了 ${drained} 点体力！`,
      });
    }
  }

  if (moveDef.healRatio && attacker.currentHp > 0) {
    const restored = Math.max(1, Math.round(attacker.maxHp * moveDef.healRatio));
    attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + restored);
    logs.push({
      kind: 'heal',
      messageEn: `${attackerLabel} recovered ${restored} health!`,
      messageVi: `${attackerLabel} hồi phục ${restored} máu!`,
      messageZh: `${attackerZh}恢复了 ${restored} 点体力！`,
    });
  }

  if (moveDef.statEffect) {
    const targetStages = moveDef.statEffect.target === 'self' ? attackerStages : defenderStages;
    const targetName = moveDef.statEffect.target === 'self' ? attackerLabel : defenderLabel;
    const targetZh = moveDef.statEffect.target === 'self' ? attackerZh : defenderZh;
    const statKey = moveDef.statEffect.stat;
    targetStages[statKey] = Math.max(-4, Math.min(4, targetStages[statKey] + moveDef.statEffect.stages));
    const statLabelEn = statKey === 'atk' ? 'strength' : statKey === 'def' ? 'guard' : 'agility';
    const statLabelVi = statKey === 'atk' ? 'sức công' : statKey === 'def' ? 'sức thủ' : 'tốc độ';
    const statLabelZh = statKey === 'atk' ? '攻击' : statKey === 'def' ? '防御' : '速度';
    const rose = moveDef.statEffect.stages > 0;
    logs.push({
      kind: 'status',
      messageEn: `${targetName}'s ${statLabelEn} ${rose ? 'rose' : 'dropped'}!`,
      messageVi: `Chỉ số ${statLabelVi} của ${targetName} ${rose ? 'tăng lên' : 'giảm xuống'}!`,
      messageZh: `${targetZh}的${statLabelZh}${rose ? '提高了' : '降低了'}！`,
    });
  }

  if (moveDef.statusEffect && defender.currentHp > 0 && defender.status === null) {
    if (ctx.rng.chance(moveDef.statusEffect.chance)) {
      const applied: StatusId = moveDef.statusEffect.status;
      defender.status = applied;
      defender.statusTurns = applied === 'sleep' ? ctx.rng.nextInt(1, 2) : 0;
      const statusText: Record<StatusId, { en: string; vi: string; zh: string }> = {
        burn: {
          en: `${defenderLabel} was singed by warm embers!`,
          vi: `${defenderLabel} bị bỏng nhẹ bởi tàn lửa!`,
          zh: `${defenderZh}陷入了灼伤状态！`,
        },
        poison: {
          en: `${defenderLabel} was dusted with forest spores!`,
          vi: `${defenderLabel} bị dính bào tử độc!`,
          zh: `${defenderZh}沾上孢子中毒了！`,
        },
        sleep: {
          en: `${defenderLabel} drifted into a calm slumber!`,
          vi: `${defenderLabel} chìm vào giấc ngủ êm!`,
          zh: `${defenderZh}进入了安静的睡眠！`,
        },
        paralyze: {
          en: `${defenderLabel} tingles with static charge!`,
          vi: `${defenderLabel} bị tê liệt bởi tia điện!`,
          zh: `${defenderZh}被静电麻痹了！`,
        },
      };
      logs.push({
        kind: 'status',
        messageEn: statusText[applied].en,
        messageVi: statusText[applied].vi,
        messageZh: statusText[applied].zh,
      });
    }
  }
}

function applyEndOfTurnStatus(
  creature: CreatureInstance,
  ctx: BattleContextData,
  logs: BattleEventLog[],
): void {
  if (creature.currentHp <= 0 || !creature.status) return;
  const species = ctx.speciesById[creature.speciesId];
  const label = creature.nickname ?? species?.name ?? creature.speciesId;
  const labelZh = creature.nickname ?? SPECIES_ZH[creature.speciesId]?.nameZh ?? label;
  if (creature.status === 'burn' || creature.status === 'poison') {
    const chip = Math.max(1, Math.floor(creature.maxHp / 10));
    creature.currentHp = Math.max(0, creature.currentHp - chip);
    logs.push({
      kind: 'status',
      messageEn:
        creature.status === 'burn'
          ? `${label} lost ${chip} health from lingering embers.`
          : `${label} lost ${chip} health from forest spores.`,
      messageVi:
        creature.status === 'burn'
          ? `${label} mất ${chip} máu do vết bỏng.`
          : `${label} mất ${chip} máu do bào tử độc.`,
      messageZh:
        creature.status === 'burn'
          ? `${labelZh}因灼伤失去了 ${chip} 点体力。`
          : `${labelZh}因中毒失去了 ${chip} 点体力。`,
    });
  }
}

function handleEnemyFaintAndProgression(
  session: BattleSession,
  ctx: BattleContextData,
  logs: BattleEventLog[],
): boolean {
  const enemy = session.enemyParty[session.activeEnemyIndex];
  if (!enemy || enemy.currentHp > 0) return false;

  const enemySpecies = ctx.speciesById[enemy.speciesId];
  const enemyName = enemySpecies?.name ?? enemy.speciesId;
  const enemyNameZh = SPECIES_ZH[enemy.speciesId]?.nameZh ?? enemyName;
  logs.push({
    kind: 'faint',
    messageEn: `${enemyName} grew tired and stepped back!`,
    messageVi: `${enemyName} đã kiệt sức và lùi lại!`,
    messageZh: `${enemyNameZh}累了，退下了场地！`,
  });

  const activePlayer = session.playerParty[session.activePlayerIndex];
  if (activePlayer && activePlayer.currentHp > 0 && enemySpecies) {
    const profile = getDifficultyProfile(ctx.difficulty);
    const trainerBonus = session.kind === 'trainer' ? 1.35 : 1;
    const rawExp = Math.max(
      8,
      Math.round(((enemySpecies.expYield * enemy.level) / 4.2) * trainerBonus * profile.expMultiplier),
    );
    const expRes = awardCreatureExperience({
      creature: activePlayer,
      expGain: rawExp,
      speciesById: ctx.speciesById,
      movesById: ctx.movesById,
    });
    session.expResults.push(expRes);
    const playerName =
      activePlayer.nickname ?? ctx.speciesById[activePlayer.speciesId]?.name ?? activePlayer.speciesId;
    const playerNameZh =
      activePlayer.nickname ?? SPECIES_ZH[activePlayer.speciesId]?.nameZh ?? playerName;
    logs.push({
      kind: 'exp',
      messageEn: `${playerName} gained ${expRes.expGained} field experience!`,
      messageVi: `${playerName} nhận được ${expRes.expGained} điểm kinh nghiệm thực địa!`,
      messageZh: `${playerNameZh}获得了 ${expRes.expGained} 点野外经验！`,
    });
    if (expRes.levelsGained > 0) {
      logs.push({
        kind: 'exp',
        messageEn: `${playerName} grew to level ${expRes.newLevel}!`,
        messageVi: `${playerName} đã lên cấp ${expRes.newLevel}!`,
        messageZh: `${playerNameZh}升级到了 ${expRes.newLevel} 级！`,
      });
    }
    for (const moveId of expRes.learnedMoveIds) {
      const mDef = ctx.movesById[moveId];
      if (mDef) {
        logs.push({
          kind: 'exp',
          messageEn: `${playerName} learned ${mDef.name}!`,
          messageVi: `${playerName} học được chiêu mới ${mDef.nameVi ?? mDef.name}!`,
          messageZh: `${playerNameZh}学会了新招式${MOVES_ZH[mDef.id]?.nameZh ?? mDef.name}！`,
        });
      }
    }
    if (expRes.evolvedToSpeciesId) {
      const evolvedSpec = ctx.speciesById[expRes.evolvedToSpeciesId];
      if (evolvedSpec) {
        logs.push({
          kind: 'exp',
          messageEn: `Wonderful harmony! Your partner evolved into ${evolvedSpec.name}!`,
          messageVi: `Sự gắn kết tuyệt vời! Bạn đồng hành đã tiến hóa thành ${evolvedSpec.name}!`,
          messageZh: `太棒了！你的伙伴进化成了${SPECIES_ZH[evolvedSpec.id]?.nameZh ?? evolvedSpec.name}！`,
        });
      }
    }
  }

  const nextEnemyIdx = session.enemyParty.findIndex((c) => c.currentHp > 0);
  if (nextEnemyIdx < 0) {
    session.outcome = 'player_victory';
    logs.push({
      kind: 'victory',
      messageEn:
        session.kind === 'trainer'
          ? `You completed the match with ${session.opponentTitleEn}!`
          : `The wild encounter ended peacefully in victory!`,
      messageVi:
        session.kind === 'trainer'
          ? `Bạn đã chiến thắng cuộc so tài cùng ${session.opponentTitleVi}!`
          : `Cuộc chạm trán hoang dã khép lại với phần thắng thuộc về bạn!`,
      messageZh:
        session.kind === 'trainer'
          ? `你赢得了与${session.opponentTitleZh}的对战！`
          : `你顺利赢得了这场野外对战！`,
    });
    return true;
  }

  session.activeEnemyIndex = nextEnemyIdx;
  session.enemyStages = freshStages();
  const nextEnemy = session.enemyParty[nextEnemyIdx]!;
  const nextSpec = ctx.speciesById[nextEnemy.speciesId];
  const nextNameZh = SPECIES_ZH[nextEnemy.speciesId]?.nameZh ?? nextSpec?.name ?? nextEnemy.speciesId;
  logs.push({
    kind: 'switch',
    messageEn: `${session.opponentTitleEn} sent out ${nextSpec?.name ?? nextEnemy.speciesId}!`,
    messageVi: `${session.opponentTitleVi} đưa ${nextSpec?.name ?? nextEnemy.speciesId} ra sân!`,
    messageZh: `${session.opponentTitleZh}派出了${nextNameZh}！`,
  });
  return true;
}

function handlePlayerFaintCheck(
  session: BattleSession,
  ctx: BattleContextData,
  logs: BattleEventLog[],
): void {
  const player = session.playerParty[session.activePlayerIndex];
  if (!player || player.currentHp > 0) return;

  const spec = ctx.speciesById[player.speciesId];
  const label = player.nickname ?? spec?.name ?? player.speciesId;
  const labelZh = player.nickname ?? SPECIES_ZH[player.speciesId]?.nameZh ?? label;
  logs.push({
    kind: 'faint',
    messageEn: `${label} is exhausted and needs rest!`,
    messageVi: `${label} đã thấm mệt và cần nghỉ ngơi!`,
    messageZh: `${labelZh}累了，需要回营地休息！`,
  });

  const nextIdx = session.playerParty.findIndex((c) => c.currentHp > 0);
  if (nextIdx < 0) {
    session.outcome = 'player_defeat';
    logs.push({
      kind: 'defeat',
      messageEn: 'Your party is worn out. You hurry back to the nearest campfire to recover.',
      messageVi: 'Cả đội đã thấm mệt. Bạn quay về lửa trại gần nhất để hồi sức.',
      messageZh: '队伍体力耗尽了，你赶回最近的篝火旁免费恢复。',
    });
    return;
  }

  session.activePlayerIndex = nextIdx;
  session.playerStages = freshStages();
  const replacement = session.playerParty[nextIdx]!;
  const repSpec = ctx.speciesById[replacement.speciesId];
  const repZh = replacement.nickname ?? SPECIES_ZH[replacement.speciesId]?.nameZh ?? repSpec?.name ?? replacement.speciesId;
  logs.push({
    kind: 'switch',
    messageEn: `Go, ${replacement.nickname ?? repSpec?.name ?? replacement.speciesId}!`,
    messageVi: `Tiến lên nào, ${replacement.nickname ?? repSpec?.name ?? replacement.speciesId}!`,
    messageZh: `拜托你了，${repZh}！`,
  });
}

export function stepBattleTurn(
  session: BattleSession,
  action: PlayerBattleAction,
  ctx: BattleContextData,
): BattleEventLog[] {
  const logs: BattleEventLog[] = [];
  if (session.outcome !== 'ongoing') {
    return logs;
  }

  const player = session.playerParty[session.activePlayerIndex];
  const enemy = session.enemyParty[session.activeEnemyIndex];
  if (!player || !enemy) {
    session.outcome = 'player_defeat';
    return logs;
  }

  let playerTakesMoveTurn = false;
  let playerMoveIndex = 0;

  if (action.kind === 'flee') {
    if (session.kind === 'trainer') {
      logs.push({
        kind: 'text',
        messageEn: 'You cannot step away during an agreed Ranger trial!',
        messageVi: 'Không thể rút lui giữa cuộc thử sức chính thức cùng Kiểm lâm!',
        messageZh: '护林员试炼进行中无法撤退！',
      });
      return logs;
    }
    session.fleeAttempts += 1;
    const playerSpd = getEffectiveSpeed(player, session.playerStages);
    const enemySpd = Math.max(1, getEffectiveSpeed(enemy, session.enemyStages));
    const fleeProb = Math.min(0.98, 0.48 + (playerSpd / (playerSpd + enemySpd)) * 0.45 + session.fleeAttempts * 0.18);
    if (ctx.rng.chance(fleeProb)) {
      session.outcome = 'fled';
      logs.push({
        kind: 'flee',
        messageEn: 'You stepped back quietly along the trail and left safely.',
        messageVi: 'Bạn nhẹ nhàng lùi lại theo lối mòn và rời đi an toàn.',
        messageZh: '你沿着小路安静退后，安全离开了现场。',
      });
      return logs;
    }
    logs.push({
      kind: 'text',
      messageEn: 'Thick brush blocked your retreat this turn!',
      messageVi: 'Bụi rậm chắn lối khiến bạn chưa kịp rút lui ở lượt này!',
      messageZh: '草丛太密，这一回合暂时没能顺利撤退！',
    });
  } else if (action.kind === 'observe') {
    const enemySpec = ctx.speciesById[enemy.speciesId];
    if (enemySpec) {
      const zhSpec = SPECIES_ZH[enemySpec.id];
      logs.push({
        kind: 'text',
        messageEn: `Field note on ${enemySpec.name}: ${enemySpec.fieldNoteEn}`,
        messageVi: `Ghi chép về ${enemySpec.name}: ${enemySpec.fieldNoteVi}`,
        messageZh: `观察笔记（${zhSpec?.nameZh ?? enemySpec.name}）：${zhSpec?.fieldNoteZh ?? enemySpec.fieldNoteVi}`,
      });
    }
  } else if (action.kind === 'switch') {
    const candidate = session.playerParty[action.partyIndex];
    if (
      !candidate ||
      action.partyIndex === session.activePlayerIndex ||
      candidate.currentHp <= 0
    ) {
      logs.push({
        kind: 'text',
        messageEn: 'Choose a healthy partner who is not already active.',
        messageVi: 'Hãy chọn một bạn đồng hành còn khỏe đang ở hàng dự bị.',
        messageZh: '请选择一位体力充足且未上场的伙伴。',
      });
      return logs;
    }
    session.activePlayerIndex = action.partyIndex;
    session.playerStages = freshStages();
    const spec = ctx.speciesById[candidate.speciesId];
    const candZh = candidate.nickname ?? SPECIES_ZH[candidate.speciesId]?.nameZh ?? spec?.name ?? candidate.speciesId;
    logs.push({
      kind: 'switch',
      messageEn: `You called in ${candidate.nickname ?? spec?.name ?? candidate.speciesId}!`,
      messageVi: `Bạn đổi sang ${candidate.nickname ?? spec?.name ?? candidate.speciesId}!`,
      messageZh: `你换上了${candZh}！`,
    });
  } else if (action.kind === 'item') {
    const itemDef = ctx.itemsById[action.itemId];
    if (!itemDef) {
      return logs;
    }
    const itemZh = ITEMS_ZH[itemDef.id]?.nameZh ?? itemDef.nameVi;

    if (itemDef.category === 'charm') {
      if (session.kind === 'trainer') {
        logs.push({
          kind: 'text',
          messageEn: 'This Wildkin already has a dedicated Ranger partner!',
          messageVi: 'Sinh vật này đã có người đồng hành, không thể thu phục!',
          messageZh: '这位灵兽已经有护林员伙伴了，不能收服！',
        });
        return logs;
      }
      if (!consumeInventoryItem(ctx.inventory, itemDef.id)) {
        logs.push({
          kind: 'text',
          messageEn: `You have no ${itemDef.nameEn} left.`,
          messageVi: `Bạn đã hết ${itemDef.nameVi}.`,
          messageZh: `背包里已经没有${itemZh}了。`,
        });
        return logs;
      }
      const enemySpec = ctx.speciesById[enemy.speciesId]!;
      const enemyZh = SPECIES_ZH[enemySpec.id]?.nameZh ?? enemySpec.name;
      logs.push({
        kind: 'capture',
        messageEn: `You offered a ${itemDef.nameEn} toward ${enemySpec.name}...`,
        messageVi: `Bạn đưa ${itemDef.nameVi} về phía ${enemySpec.name}...`,
        messageZh: `你朝着${enemyZh}轻轻摇响了${itemZh}……`,
      });
      const diffProfile = getDifficultyProfile(ctx.difficulty);
      const result = resolveCaptureAttempt({
        target: enemy,
        species: enemySpec,
        charmMultiplier: itemDef.captureMultiplier ?? 1,
        difficultyMultiplier: diffProfile.captureBonusMultiplier,
        guaranteedSuccess: ctx.guaranteedCapture,
        rng: ctx.rng,
      });
      session.lastCaptureAttempt = result;
      if (result.captured) {
        session.outcome = 'captured';
        session.capturedCreature = structuredClone(enemy);
        logs.push({
          kind: 'capture',
          shakes: result.shakes,
          captured: true,
          messageEn: `Resonance chimed (${result.shakes} pulses)! ${enemySpec.name} joined your expedition!`,
          messageVi: `Chuông cộng hưởng ngân vang (${result.shakes} nhịp)! ${enemySpec.name} đã gia nhập hành trình của bạn!`,
          messageZh: `铃声清脆共鸣（${result.shakes} 次）！${enemyZh}开心地加入了你的队伍！`,
        });
        return logs;
      }
      logs.push({
        kind: 'capture',
        shakes: result.shakes,
        captured: false,
        messageEn: `So close (${result.shakes} pulse${result.shakes > 1 ? 's' : ''})! ${enemySpec.name} broke free. Lowering health or inducing sleep helps.`,
        messageVi: `Suýt thành công (${result.shakes} nhịp)! ${enemySpec.name} đã thoát ra. Giảm máu hoặc gây ngủ sẽ tăng tỷ lệ kết nối.`,
        messageZh: `差一点就成功了（${result.shakes} 次）！${enemyZh}挣脱了。先降低体力或让它睡眠会更容易收服。`,
      });
    } else {
      const targetIdx = action.targetPartyIndex ?? session.activePlayerIndex;
      const targetCreature = session.playerParty[targetIdx];
      if (!targetCreature || targetCreature.currentHp <= 0) {
        logs.push({
          kind: 'text',
          messageEn: 'That partner cannot use this item right now.',
          messageVi: 'Bạn đồng hành này hiện không thể dùng vật phẩm đó.',
          messageZh: '这位伙伴现在无法使用这个道具。',
        });
        return logs;
      }
      if (!consumeInventoryItem(ctx.inventory, itemDef.id)) {
        logs.push({
          kind: 'text',
          messageEn: `You have no ${itemDef.nameEn} left.`,
          messageVi: `Bạn đã hết ${itemDef.nameVi}.`,
          messageZh: `背包里已经没有${itemZh}了。`,
        });
        return logs;
      }
      const targetSpec = ctx.speciesById[targetCreature.speciesId];
      const targetLabel = targetCreature.nickname ?? targetSpec?.name ?? targetCreature.speciesId;
      const targetZh = targetCreature.nickname ?? SPECIES_ZH[targetCreature.speciesId]?.nameZh ?? targetLabel;
      if (itemDef.healAmount) {
        const before = targetCreature.currentHp;
        targetCreature.currentHp = Math.min(
          targetCreature.maxHp,
          targetCreature.currentHp + itemDef.healAmount,
        );
        const gained = targetCreature.currentHp - before;
        logs.push({
          kind: 'heal',
          messageEn: `${itemDef.nameEn} restored ${gained} health to ${targetLabel}.`,
          messageVi: `${itemDef.nameVi} giúp ${targetLabel} hồi ${gained} máu.`,
          messageZh: `${itemZh}为${targetZh}恢复了 ${gained} 点体力。`,
        });
      }
      if (itemDef.curesStatus) {
        if (itemDef.curesStatus === 'all' || targetCreature.status === itemDef.curesStatus) {
          targetCreature.status = null;
          targetCreature.statusTurns = 0;
          logs.push({
            kind: 'status',
            messageEn: `${targetLabel} feels refreshed and clear of status effects!`,
            messageVi: `${targetLabel} đã khỏi trạng thái bất lợi!`,
            messageZh: `${targetZh}清除了异常状态，精神焕发！`,
          });
        }
      }
      if (itemDef.ppRestore) {
        for (const slot of targetCreature.moves) {
          slot.pp = Math.min(slot.maxPp, slot.pp + itemDef.ppRestore);
        }
        logs.push({
          kind: 'heal',
          messageEn: `${targetLabel} restored move energy!`,
          messageVi: `${targetLabel} đã hồi năng lượng chiêu thức!`,
          messageZh: `${targetZh}恢复了招式能量！`,
        });
      }
    }
  } else if (action.kind === 'move') {
    playerTakesMoveTurn = true;
    playerMoveIndex = action.moveIndex;
  }

  const enemyMoveIndex = selectEnemyMoveIndex(session, ctx);
  const currentActivePlayer = session.playerParty[session.activePlayerIndex]!;
  const currentActiveEnemy = session.enemyParty[session.activeEnemyIndex]!;

  if (playerTakesMoveTurn) {
    const playerMoveSlot = currentActivePlayer.moves[playerMoveIndex];
    const playerMoveDef = playerMoveSlot ? ctx.movesById[playerMoveSlot.moveId] : undefined;
    const enemyMoveSlot = enemyMoveIndex >= 0 ? currentActiveEnemy.moves[enemyMoveIndex] : undefined;
    const enemyMoveDef = enemyMoveSlot ? ctx.movesById[enemyMoveSlot.moveId] : undefined;

    const pPrio = playerMoveDef?.priority ?? 0;
    const ePrio = enemyMoveDef?.priority ?? 0;
    const pSpd = getEffectiveSpeed(currentActivePlayer, session.playerStages);
    const eSpd = getEffectiveSpeed(currentActiveEnemy, session.enemyStages);
    const playerFirst =
      pPrio !== ePrio ? pPrio > ePrio : pSpd !== eSpd ? pSpd > eSpd : ctx.rng.chance(0.5);

    if (playerFirst) {
      executeMove({
        attacker: currentActivePlayer,
        attackerStages: session.playerStages,
        defender: currentActiveEnemy,
        defenderStages: session.enemyStages,
        moveIndex: playerMoveIndex,
        isPlayerAttacker: true,
        ctx,
        logs,
      });
      const enemyFainted = handleEnemyFaintAndProgression(session, ctx, logs);
      if (session.outcome !== 'ongoing') return logs;
      if (!enemyFainted) {
        executeMove({
          attacker: currentActiveEnemy,
          attackerStages: session.enemyStages,
          defender: currentActivePlayer,
          defenderStages: session.playerStages,
          moveIndex: enemyMoveIndex,
          isPlayerAttacker: false,
          ctx,
          logs,
        });
        handlePlayerFaintCheck(session, ctx, logs);
        if (session.outcome !== 'ongoing') return logs;
      }
    } else {
      executeMove({
        attacker: currentActiveEnemy,
        attackerStages: session.enemyStages,
        defender: currentActivePlayer,
        defenderStages: session.playerStages,
        moveIndex: enemyMoveIndex,
        isPlayerAttacker: false,
        ctx,
        logs,
      });
      handlePlayerFaintCheck(session, ctx, logs);
      if (session.outcome !== 'ongoing') return logs;
      if (currentActivePlayer.currentHp > 0) {
        executeMove({
          attacker: currentActivePlayer,
          attackerStages: session.playerStages,
          defender: currentActiveEnemy,
          defenderStages: session.enemyStages,
          moveIndex: playerMoveIndex,
          isPlayerAttacker: true,
          ctx,
          logs,
        });
        handleEnemyFaintAndProgression(session, ctx, logs);
        if (session.outcome !== 'ongoing') return logs;
      }
    }
  } else {
    executeMove({
      attacker: currentActiveEnemy,
      attackerStages: session.enemyStages,
      defender: currentActivePlayer,
      defenderStages: session.playerStages,
      moveIndex: enemyMoveIndex,
      isPlayerAttacker: false,
      ctx,
      logs,
    });
    handlePlayerFaintCheck(session, ctx, logs);
    if (session.outcome !== 'ongoing') return logs;
  }

  const endPlayer = session.playerParty[session.activePlayerIndex];
  const endEnemy = session.enemyParty[session.activeEnemyIndex];
  if (endPlayer) {
    applyEndOfTurnStatus(endPlayer, ctx, logs);
    handlePlayerFaintCheck(session, ctx, logs);
    if (session.outcome !== 'ongoing') return logs;
  }
  if (endEnemy) {
    applyEndOfTurnStatus(endEnemy, ctx, logs);
    handleEnemyFaintAndProgression(session, ctx, logs);
    if (session.outcome !== 'ongoing') return logs;
  }

  session.turnCount += 1;
  return logs;
}

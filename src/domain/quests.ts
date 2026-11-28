import type {
  GameState,
  QuestCondition,
  QuestDefinition,
  SpeciesDefinition,
} from './types.ts';

export function isQuestConditionMet(
  condition: QuestCondition,
  state: GameState,
  speciesById: Readonly<Record<string, SpeciesDefinition>>,
): boolean {
  switch (condition.kind) {
    case 'flag':
      return Boolean(state.flags[condition.flag]);
    case 'caught_count':
      return state.caughtSpecies.length >= condition.count;
    case 'caught_species':
      return state.caughtSpecies.includes(condition.speciesId);
    case 'caught_element': {
      let matching = 0;
      for (const specId of state.caughtSpecies) {
        if (speciesById[specId]?.element === condition.element) {
          matching += 1;
        }
      }
      return matching >= condition.count;
    }
    case 'discovered_count':
      return state.discoveredSpecies.length >= condition.count;
    case 'visited_region':
      return Boolean(state.flags[`visited_${condition.regionId}`]) || state.regionId === condition.regionId;
    case 'defeated_trainer':
      return state.defeatedTrainers.includes(condition.trainerId);
  }
}

export function startQuest(state: GameState, questId: string): boolean {
  if (state.quests[questId]) {
    return false;
  }
  state.quests[questId] = {
    questId,
    status: 'active',
    rewardClaimed: false,
  };
  return true;
}

export interface QuestSyncNotification {
  readonly questId: string;
  readonly event: 'started' | 'completed';
  readonly titleEn: string;
  readonly titleVi: string;
}

export function syncQuestsWithState(
  state: GameState,
  quests: ReadonlyArray<QuestDefinition>,
  speciesById: Readonly<Record<string, SpeciesDefinition>>,
  grantItem: (itemId: string, qty: number) => void,
): QuestSyncNotification[] {
  const notifications: QuestSyncNotification[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (const def of quests) {
      const existing = state.quests[def.id];
      if (!existing && def.autoStartOnFlag && state.flags[def.autoStartOnFlag]) {
        if (!def.prerequisiteFlag || state.flags[def.prerequisiteFlag]) {
          state.quests[def.id] = {
            questId: def.id,
            status: 'active',
            rewardClaimed: false,
          };
          notifications.push({
            questId: def.id,
            event: 'started',
            titleEn: def.titleEn,
            titleVi: def.titleVi,
          });
          changed = true;
        }
      }

      const progress = state.quests[def.id];
      if (progress && progress.status === 'active') {
        const allMet = def.steps.every((step) =>
          isQuestConditionMet(step.condition, state, speciesById),
        );
        if (allMet) {
          progress.status = 'completed';
          if (!progress.rewardClaimed) {
            progress.rewardClaimed = true;
            state.tokens += def.rewards.tokens;
            if (def.rewards.items) {
              for (const item of def.rewards.items) {
                grantItem(item.itemId, item.quantity);
              }
            }
            if (def.rewards.setsFlag) {
              state.flags[def.rewards.setsFlag] = true;
            }
          }
          notifications.push({
            questId: def.id,
            event: 'completed',
            titleEn: def.titleEn,
            titleVi: def.titleVi,
          });
          changed = true;
        }
      }
    }
  }

  return notifications;
}

import { localizeSpeakerName } from './i18n.ts';
import { isQuestConditionMet } from './quests.ts';
import type {
  Direction,
  GameState,
  NpcDefinition,
  PortalDefinition,
  PropKind,
  QuestDefinition,
  RegionId,
  RegionMapDefinition,
  SpeciesDefinition,
  WorldPropDefinition,
} from './types.ts';
import { getTileAt, isPropVisible, isTileWalkable, offsetByDirection } from './world.ts';

const CARDINAL_DIRS: ReadonlyArray<Direction> = ['up', 'down', 'left', 'right'];

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface NavigationTargetSpec {
  readonly regionId: RegionId;
  readonly x: number;
  readonly y: number;
  readonly kind: 'npc' | 'prop' | 'tall_grass' | 'portal';
  readonly labelEn: string;
  readonly labelVi: string;
}

export interface QuestObjectiveDetail {
  readonly questId: string;
  readonly titleEn: string;
  readonly titleVi: string;
  readonly isMainStory: boolean;
  readonly isCompleted: boolean;
  readonly whatEn: string;
  readonly whatVi: string;
  readonly targetLabelEn: string;
  readonly targetLabelVi: string;
  readonly regionId: RegionId;
  readonly regionNameEn: string;
  readonly regionNameVi: string;
  readonly progressEn: string;
  readonly progressVi: string;
  readonly unmetRequirementEn?: string;
  readonly unmetRequirementVi?: string;
  readonly recommendedPrepEn?: string;
  readonly recommendedPrepVi?: string;
  readonly recommendedLevel?: number;
  readonly target?: NavigationTargetSpec;
}

export interface NearbyInteractable {
  readonly kind: 'npc' | 'prop';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly direction: Direction;
  readonly labelEn: string;
  readonly labelVi: string;
  readonly directlyFacing: boolean;
}

export interface ActiveGuidanceOverride {
  readonly titleEn: string;
  readonly titleVi: string;
  readonly actionEn: string;
  readonly actionVi: string;
  readonly target?: NavigationTargetSpec | null;
}

export interface NavigationPlan {
  readonly active: boolean;
  readonly goalSource: 'onboarding' | 'quest' | 'postgame';
  readonly activeGoalTitleEn: string;
  readonly activeGoalTitleVi: string;
  readonly activeGoalActionEn: string;
  readonly activeGoalActionVi: string;
  readonly objective: QuestObjectiveDetail | null;
  readonly destinationInCurrentRegion: GridPoint | null;
  readonly destinationLabelEn: string;
  readonly destinationLabelVi: string;
  readonly destinationKind?: NavigationTargetSpec['kind'];
  readonly waypoints: ReadonlyArray<GridPoint>;
  readonly firstStepDir: Direction | null;
  readonly distanceSteps: number;
  readonly arrivedAtTarget: boolean;
  readonly unreachable: boolean;
  readonly unreachableReasonEn?: string;
  readonly unreachableReasonVi?: string;
  readonly isCrossRegion: boolean;
  readonly blockedByGate: boolean;
  readonly gateRequirementEn?: string;
  readonly gateRequirementVi?: string;
  readonly nextPortalLabelEn?: string;
  readonly nextPortalLabelVi?: string;
  readonly nearbyInteractable: NearbyInteractable | null;
}

export type NpcQuestMarker = 'new_quest' | 'turn_in' | 'none';

export interface LostHelperReport {
  readonly regionNameEn: string;
  readonly regionNameVi: string;
  readonly needsHealFirst: boolean;
  readonly nextActionEn: string;
  readonly nextActionVi: string;
  readonly targetLabelEn: string;
  readonly targetLabelVi: string;
  readonly routeSummaryEn: string;
  readonly routeSummaryVi: string;
  readonly recommendedPrepEn?: string;
  readonly recommendedPrepVi?: string;
}

export function isPortalUnlocked(
  portal: PortalDefinition,
  state: GameState,
  speciesById: Readonly<Record<string, SpeciesDefinition>>,
): boolean {
  if (portal.requiredFlag && !state.flags[portal.requiredFlag]) {
    return false;
  }
  if (portal.requiredLeadElement) {
    const lead = state.party[0];
    const leadSpec = lead ? speciesById[lead.speciesId] : undefined;
    if (!leadSpec || leadSpec.element !== portal.requiredLeadElement) {
      return false;
    }
  }
  return true;
}

function describeGateFlag(flag: string): { en: string; vi: string } {
  switch (flag) {
    case 'has_starter':
      return {
        en: 'Speak with Ranger Rowan in Mosslight Camp to choose your first partner.',
        vi: 'Nói chuyện với Trưởng đoàn Rowan tại Trại Đèn Rêu để chọn bạn đồng hành đầu tiên.',
      };
    case 'warden_sylvan_cleared':
      return {
        en: 'Pass Warden Sylvan trial in Whisperwood Glen to earn the Reed Ferry Pass.',
        vi: 'Vượt qua thử thách của Thủ lĩnh Sylvan tại Rừng Thầm để nhận Thẻ qua đò.',
      };
    case 'warden_mirella_cleared':
      return {
        en: 'Pass Warden Mirella trial in Reedwater Fen to earn the Sunforge Rope.',
        vi: 'Vượt qua thử thách của Thủ lĩnh Mirella tại Đầm Sậy để nhận Dây leo Đèo Nắng.',
      };
    case 'warden_kaelen_cleared':
      return {
        en: 'Pass Warden Kaelen trial in Terracotta Ridge to earn the Starfall Crest.',
        vi: 'Vượt qua thử thách của Thủ lĩnh Kaelen tại Đèo Đất Nung để nhận Ấn Sao Rơi.',
      };
    default:
      return {
        en: 'Complete the previous regional main story trial first.',
        vi: 'Hoàn thành thử thách cốt truyện ở vùng trước đó để mở lối đi này.',
      };
  }
}

function findNearestEncounterTile(
  map: RegionMapDefinition,
  fromX: number,
  fromY: number,
): GridPoint | null {
  let best: GridPoint | null = null;
  let bestDist = Infinity;
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      const tile = getTileAt(map, x, y);
      if (tile === 'tall_grass' || tile === 'reed_marsh') {
        const d = Math.abs(x - fromX) + Math.abs(y - fromY);
        if (d < bestDist) {
          bestDist = d;
          best = { x, y };
        }
      }
    }
  }
  return best;
}

export function findRegionPortalRoute(params: {
  fromRegion: RegionId;
  toRegion: RegionId;
  mapsById: Readonly<Record<RegionId, RegionMapDefinition>>;
  state: GameState;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
}): PortalDefinition[] | null {
  const { fromRegion, toRegion, mapsById, state, speciesById } = params;
  if (fromRegion === toRegion) return [];

  const visited = new Set<RegionId>([fromRegion]);
  const queue: Array<{ regionId: RegionId; portals: PortalDefinition[] }> = [
    { regionId: fromRegion, portals: [] },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const map = mapsById[cur.regionId];
    for (const portal of map.portals) {
      if (!isPortalUnlocked(portal, state, speciesById)) continue;
      if (visited.has(portal.targetRegion)) continue;
      const nextPortals = [...cur.portals, portal];
      if (portal.targetRegion === toRegion) {
        return nextPortals;
      }
      visited.add(portal.targetRegion);
      queue.push({ regionId: portal.targetRegion, portals: nextPortals });
    }
  }

  return null;
}

export function computeLocalBfsPath(params: {
  map: RegionMapDefinition;
  npcsInRegion: ReadonlyArray<NpcDefinition>;
  state: GameState;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  stopAdjacent: boolean;
  allowTargetPortal?: boolean;
}): GridPoint[] {
  const {
    map,
    npcsInRegion,
    state,
    startX,
    startY,
    targetX,
    targetY,
    stopAdjacent,
    allowTargetPortal = false,
  } = params;

  const isGoal = (x: number, y: number): boolean => {
    if (stopAdjacent) {
      return Math.abs(x - targetX) + Math.abs(y - targetY) === 1;
    }
    return x === targetX && y === targetY;
  };

  if (isGoal(startX, startY)) {
    return [];
  }

  const visited = new Set<string>([`${startX},${startY}`]);
  const parent = new Map<string, { prevKey: string | null; point: GridPoint }>();
  parent.set(`${startX},${startY}`, { prevKey: null, point: { x: startX, y: startY } });

  const queue: GridPoint[] = [{ x: startX, y: startY }];
  let goalKey: string | null = null;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curKey = `${cur.x},${cur.y}`;
    for (const dir of CARDINAL_DIRS) {
      const nxt = offsetByDirection(cur.x, cur.y, dir);
      const key = `${nxt.x},${nxt.y}`;
      if (visited.has(key)) continue;
      if (nxt.x < 0 || nxt.y < 0 || nxt.x >= map.width || nxt.y >= map.height) continue;

      const tile = getTileAt(map, nxt.x, nxt.y);
      const isTargetTile = nxt.x === targetX && nxt.y === targetY;
      if (tile === 'portal') {
        if (allowTargetPortal && isTargetTile) {
          parent.set(key, { prevKey: curKey, point: nxt });
          goalKey = key;
          break;
        }
        continue;
      }

      if (!isTileWalkable({ map, npcsInRegion, state, x: nxt.x, y: nxt.y })) {
        continue;
      }

      visited.add(key);
      parent.set(key, { prevKey: curKey, point: nxt });
      if (isGoal(nxt.x, nxt.y)) {
        goalKey = key;
        break;
      }
      queue.push(nxt);
    }
    if (goalKey) break;
  }

  if (!goalKey) return [];

  const path: GridPoint[] = [];
  let cursor: string | null = goalKey;
  while (cursor) {
    const entry = parent.get(cursor);
    if (!entry || entry.prevKey === null) break;
    path.push(entry.point);
    cursor = entry.prevKey;
  }
  path.reverse();
  return path;
}

export function findNearbyInteractable(params: {
  state: GameState;
  map: RegionMapDefinition;
  npcsInRegion: ReadonlyArray<NpcDefinition>;
}): NearbyInteractable | null {
  const { state, map, npcsInRegion } = params;
  const orderedDirs: Direction[] = [
    state.playerPos.facing,
    ...CARDINAL_DIRS.filter((d) => d !== state.playerPos.facing),
  ];

  for (const dir of orderedDirs) {
    const target = offsetByDirection(state.playerPos.x, state.playerPos.y, dir);
    const npc = npcsInRegion.find((n) => n.x === target.x && n.y === target.y);
    if (npc) {
      return {
        kind: 'npc',
        id: npc.id,
        x: npc.x,
        y: npc.y,
        direction: dir,
        labelEn: npc.name,
        labelVi: localizeSpeakerName(npc.name, 'vi'),
        directlyFacing: dir === state.playerPos.facing,
      };
    }
    const prop = map.props.find(
      (p) => p.x === target.x && p.y === target.y && isPropVisible(p, state),
    );
    if (prop) {
      if (prop.kind === 'chest' && state.openedProps.includes(prop.id)) {
        continue;
      }
      return {
        kind: 'prop',
        id: prop.id,
        x: prop.x,
        y: prop.y,
        direction: dir,
        labelEn: prop.labelEn,
        labelVi: prop.labelVi,
        directlyFacing: dir === state.playerPos.facing,
      };
    }
  }
  return null;
}

export function buildQuestObjectiveDetail(params: {
  quest: QuestDefinition;
  state: GameState;
  mapsById: Readonly<Record<RegionId, RegionMapDefinition>>;
  npcsById: Readonly<Record<string, NpcDefinition>>;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
}): QuestObjectiveDetail {
  const { quest, state, mapsById, npcsById, speciesById } = params;
  const progress = state.quests[quest.id];
  const isCompleted = progress?.status === 'completed';

  const completedCount = quest.steps.filter((st) =>
    isQuestConditionMet(st.condition, state, speciesById),
  ).length;
  const nextStep = quest.steps.find(
    (st) => !isQuestConditionMet(st.condition, state, speciesById),
  );

  let targetRegion: RegionId = quest.regionId;
  let target: NavigationTargetSpec | undefined;
  let targetLabelEn = mapsById[quest.regionId].nameEn;
  let targetLabelVi = mapsById[quest.regionId].nameVi;
  let progressEn = `${completedCount}/${quest.steps.length} steps`;
  let progressVi = `${completedCount}/${quest.steps.length} chặng`;
  let unmetRequirementEn: string | undefined;
  let unmetRequirementVi: string | undefined;
  let recommendedPrepEn: string | undefined;
  let recommendedPrepVi: string | undefined;
  let recommendedLevel: number | undefined;

  const setNpcTarget = (npcId: string): void => {
    const npc = npcsById[npcId];
    if (!npc) return;
    const nameVi = localizeSpeakerName(npc.name, 'vi');
    const shortName = npc.name.split(' ').pop() ?? npc.name;
    const cleanRoleVi = npc.roleVi.replace(new RegExp(`\\s+${shortName}$`), '');
    targetRegion = npc.regionId;
    targetLabelEn = npc.name;
    targetLabelVi =
      cleanRoleVi && !nameVi.includes(cleanRoleVi) ? `${nameVi} (${cleanRoleVi})` : nameVi;
    target = {
      regionId: npc.regionId,
      x: npc.x,
      y: npc.y,
      kind: 'npc',
      labelEn: npc.name,
      labelVi: nameVi,
    };
  };

  const setPropTarget = (regionId: RegionId, propId: string): void => {
    const map = mapsById[regionId];
    const prop: WorldPropDefinition | undefined = map.props.find((p) => p.id === propId);
    if (!prop) return;
    targetRegion = regionId;
    targetLabelEn = prop.labelEn;
    targetLabelVi = prop.labelVi;
    target = {
      regionId,
      x: prop.x,
      y: prop.y,
      kind: 'prop',
      labelEn: prop.labelEn,
      labelVi: prop.labelVi,
    };
  };

  const setTallGrassTarget = (regionId: RegionId, labelEn: string, labelVi: string): void => {
    const map = mapsById[regionId];
    const fromX = state.regionId === regionId ? state.playerPos.x : map.spawnX;
    const fromY = state.regionId === regionId ? state.playerPos.y : map.spawnY;
    const pt = findNearestEncounterTile(map, fromX, fromY);
    targetRegion = regionId;
    targetLabelEn = labelEn;
    targetLabelVi = labelVi;
    if (pt) {
      target = {
        regionId,
        x: pt.x,
        y: pt.y,
        kind: 'tall_grass',
        labelEn,
        labelVi,
      };
    }
  };

  if (nextStep) {
    const cond = nextStep.condition;
    if (cond.kind === 'caught_count') {
      progressEn = `${state.caughtSpecies.length}/${cond.count} species bonded`;
      progressVi = `${state.caughtSpecies.length}/${cond.count} loài đã kết bạn`;
    } else if (cond.kind === 'discovered_count') {
      progressEn = `${state.discoveredSpecies.length}/${cond.count} species recorded`;
      progressVi = `${state.discoveredSpecies.length}/${cond.count} loài đã gặp`;
    } else if (cond.kind === 'caught_element') {
      let have = 0;
      for (const spId of state.caughtSpecies) {
        if (speciesById[spId]?.element === cond.element) have += 1;
      }
      progressEn = `${have}/${cond.count} matching partners`;
      progressVi = `${have}/${cond.count} sinh vật đúng hệ`;
    }

    switch (nextStep.id) {
      case 'pick_starter':
        setNpcTarget('npc_rowan');
        break;
      case 'enter_whisperwood': {
        const hubPortal = mapsById.mosslight_hub.portals.find((p) => p.targetRegion === 'whisperwood');
        targetRegion = 'whisperwood';
        targetLabelEn = 'West Trail Gate to Whisperwood Glen';
        targetLabelVi = 'Lối mòn phía Tây sang Thung Lũng Rừng Thầm';
        if (hubPortal && state.regionId === 'mosslight_hub') {
          target = {
            regionId: 'mosslight_hub',
            x: hubPortal.x,
            y: hubPortal.y,
            kind: 'portal',
            labelEn: hubPortal.labelEn,
            labelVi: hubPortal.labelVi,
          };
        } else {
          setNpcTarget('npc_sylvan');
        }
        break;
      }
      case 'clear_sylvan':
        setNpcTarget('npc_sylvan');
        recommendedLevel = 7;
        recommendedPrepEn = 'Recommended Lv.7+ partner, 2 Dew Tonics, and Ember or Gale moves.';
        recommendedPrepVi = 'Nên luyện lên cấp 7 trở lên, mang 2 bình Sương Thảo Dược và ưu tiên chiêu hệ Lửa ấm hoặc Gió mây.';
        break;
      case 'discover_five':
        setTallGrassTarget(
          state.flags.has_starter ? 'whisperwood' : 'mosslight_hub',
          'Tall grass patches in Whisperwood Glen',
          'Bụi cỏ cao tại Thung Lũng Rừng Thầm',
        );
        break;
      case 'catch_three':
        setTallGrassTarget(
          state.flags.warden_sylvan_cleared ? 'reedwater_fen' : 'whisperwood',
          'Wild grass habitats (bring Moss Charms)',
          'Bãi cỏ hoang dã (mang theo Chuông Rêu)',
        );
        recommendedPrepEn = 'Carry at least 3 Moss Charms and weaken wild creatures before bonding.';
        recommendedPrepVi = 'Mang ít nhất 3 Chuông Rêu và đánh giảm máu sinh vật hoang trước khi ném chuông.';
        break;
      case 'enter_fen':
        targetRegion = 'reedwater_fen';
        setNpcTarget('npc_mirella');
        targetLabelEn = 'East Dock to Reedwater Fen';
        targetLabelVi = 'Bến đò phía Đông sang Đầm Sậy Nước Trong';
        break;
      case 'clear_mirella':
        setNpcTarget('npc_mirella');
        recommendedLevel = 12;
        recommendedPrepEn = 'Recommended Lv.12+ team with Leaf or Spark partners to counter Water.';
        recommendedPrepVi = 'Nên luyện đội hình cấp 12 trở lên, ưu tiên bạn hệ Lá rừng hoặc Tia chớp để khắc chế hệ Suối nước.';
        break;
      case 'read_clue':
        setPropTarget('whisperwood', 'ww_dusk_sign');
        break;
      case 'leaf_partner':
        setTallGrassTarget('whisperwood', 'Whisperwood tall grass (Dewgrub / Mosskit)', 'Bụi cỏ cao Rừng Thầm (Dewgrub / Mosskit)');
        break;
      case 'check_beacon':
        setPropTarget('reedwater_fen', 'fen_beacon_post');
        break;
      case 'spark_partner':
        setTallGrassTarget('reedwater_fen', 'Reedwater marsh (Glimmerfin) or Whisperwood (Voltkit)', 'Bụi sậy Đầm Sậy (Glimmerfin) hoặc Rừng Thầm (Voltkit)');
        break;
      case 'enter_ridge':
        targetRegion = 'terracotta_ridge';
        setNpcTarget('npc_kaelen');
        targetLabelEn = 'South Rope Lift to Terracotta Ridge';
        targetLabelVi = 'Thang dây phía Nam lên Đèo Đất Nung';
        break;
      case 'clear_kaelen':
        setNpcTarget('npc_kaelen');
        recommendedLevel = 17;
        recommendedPrepEn = 'Recommended Lv.17+ team with Water or Leaf moves against Stone and Ember.';
        recommendedPrepVi = 'Nên luyện đội hình cấp 17 trở lên, mang sinh vật hệ Suối nước để khắc chế cả Đá núi lẫn Lửa ấm.';
        break;
      case 'inspect_kiln':
        setPropTarget('terracotta_ridge', 'ridge_kiln_ruin');
        break;
      case 'stone_partner':
        setTallGrassTarget('terracotta_ridge', 'Terracotta Ridge grass (Clayback / Kilnshell)', 'Bãi cỏ Đèo Đất Nung (Clayback / Kilnshell)');
        break;
      case 'pillar_west':
        setPropTarget('starfall_sanctuary', 'sanctuary_pillar_west');
        break;
      case 'pillar_east':
        setPropTarget('starfall_sanctuary', 'sanctuary_pillar_east');
        break;
      case 'pillar_north':
        setPropTarget('starfall_sanctuary', 'sanctuary_pillar_north');
        break;
      case 'enter_sanctuary':
        targetRegion = 'starfall_sanctuary';
        setNpcTarget('npc_astraea');
        targetLabelEn = 'North Arch to Starfall Sanctuary';
        targetLabelVi = 'Cổng Bắc lên Thánh Địa Sao Rơi';
        break;
      case 'pass_astraea':
        setNpcTarget('npc_astraea');
        recommendedLevel = 21;
        recommendedPrepEn = 'Recommended Lv.21+ balanced party with healing salves for the final trial.';
        recommendedPrepVi = 'Nên luyện đội hình đa nguyên tố từ cấp 21 trở lên và hồi đầy máu trước bài khảo nghiệm cuối.';
        break;
      case 'ring_celestial_altar':
        setPropTarget('starfall_sanctuary', 'sanctuary_celestial_altar');
        break;
      case 'catch_twelve':
        setTallGrassTarget(
          state.regionId === 'mosslight_hub' ? 'whisperwood' : state.regionId,
          'Explore wild habitats across regions',
          'Khám phá bãi cỏ hoang ở các vùng sinh thái',
        );
        break;
      default:
        setNpcTarget(quest.giverNpcId);
        break;
    }

    if (targetRegion !== state.regionId) {
      const portalRoute = findRegionPortalRoute({
        fromRegion: state.regionId,
        toRegion: targetRegion,
        mapsById,
        state,
        speciesById,
      });
      if (!portalRoute) {
        const directGate = mapsById.mosslight_hub.portals.find((p) => p.targetRegion === targetRegion);
        if (directGate?.requiredFlag && !state.flags[directGate.requiredFlag]) {
          const desc = describeGateFlag(directGate.requiredFlag);
          unmetRequirementEn = desc.en;
          unmetRequirementVi = desc.vi;
        }
      }
    }
  } else {
    progressEn = 'Completed';
    progressVi = 'Đã hoàn thành';
  }

  return {
    questId: quest.id,
    titleEn: quest.titleEn,
    titleVi: quest.titleVi,
    isMainStory: quest.isMainStory,
    isCompleted,
    whatEn: nextStep?.descriptionEn ?? quest.summaryEn,
    whatVi: nextStep?.descriptionVi ?? quest.summaryVi,
    targetLabelEn,
    targetLabelVi,
    regionId: targetRegion,
    regionNameEn: mapsById[targetRegion].nameEn,
    regionNameVi: mapsById[targetRegion].nameVi,
    progressEn,
    progressVi,
    unmetRequirementEn,
    unmetRequirementVi,
    recommendedPrepEn,
    recommendedPrepVi,
    recommendedLevel,
    target,
  };
}

export function resolveTrackedQuest(
  state: GameState,
  quests: ReadonlyArray<QuestDefinition>,
): QuestDefinition | null {
  if (state.trackedQuestId) {
    const chosen = quests.find(
      (q) => q.id === state.trackedQuestId && state.quests[q.id]?.status === 'active',
    );
    if (chosen) return chosen;
  }
  const activeMain = quests.find((q) => q.isMainStory && state.quests[q.id]?.status === 'active');
  if (activeMain) return activeMain;
  const activeAny = quests.find((q) => state.quests[q.id]?.status === 'active');
  return activeAny ?? null;
}

export function getNpcQuestMarker(params: {
  npc: NpcDefinition;
  state: GameState;
  quests: ReadonlyArray<QuestDefinition>;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
}): NpcQuestMarker {
  const { npc, state, quests, speciesById } = params;

  if (npc.id === 'npc_rowan' && !state.flags.has_starter) {
    return 'new_quest';
  }

  // Turn-in / challenge markers for active story wardens
  if (
    (npc.id === 'npc_sylvan' && state.quests.q02_whisperwood_echo?.status === 'active' && !state.flags.warden_sylvan_cleared) ||
    (npc.id === 'npc_mirella' && state.quests.q05_fen_current?.status === 'active' && !state.flags.warden_mirella_cleared) ||
    (npc.id === 'npc_kaelen' && state.quests.q08_ridge_beacon?.status === 'active' && !state.flags.warden_kaelen_cleared) ||
    (npc.id === 'npc_astraea' && state.quests.q11_starfall_harmony?.status === 'active' && !state.flags.sanctuary_harmony_restored)
  ) {
    return 'turn_in';
  }

  // Side quests offered by this NPC that have not started yet
  for (const q of quests) {
    if (q.giverNpcId !== npc.id || q.isMainStory || q.autoStartOnFlag) continue;
    const prog = state.quests[q.id];
    if (!prog && (!q.prerequisiteFlag || state.flags[q.prerequisiteFlag])) {
      if (state.flags.has_starter) {
        return 'new_quest';
      }
    }
    if (prog && prog.status === 'active') {
      const ready = q.steps.every((st) => isQuestConditionMet(st.condition, state, speciesById));
      if (ready) return 'turn_in';
    }
  }

  return 'none';
}

export function computeNavigationPlan(params: {
  state: GameState;
  mapsById: Readonly<Record<RegionId, RegionMapDefinition>>;
  npcs: ReadonlyArray<NpcDefinition>;
  npcsById: Readonly<Record<string, NpcDefinition>>;
  quests: ReadonlyArray<QuestDefinition>;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
  overrideTarget?: NavigationTargetSpec | null;
  guidanceOverride?: ActiveGuidanceOverride | null;
}): NavigationPlan {
  const {
    state,
    mapsById,
    npcs,
    npcsById,
    quests,
    speciesById,
    overrideTarget,
    guidanceOverride,
  } = params;
  const currentMap = mapsById[state.regionId];
  const npcsInRegion = npcs.filter((n) => n.regionId === state.regionId);
  const nearbyInteractable = findNearbyInteractable({
    state,
    map: currentMap,
    npcsInRegion,
  });

  const trackedQuest = resolveTrackedQuest(state, quests);
  const rawObjective = trackedQuest
    ? buildQuestObjectiveDetail({
        quest: trackedQuest,
        state,
        mapsById,
        npcsById,
        speciesById,
      })
    : null;
  const objective = rawObjective && !rawObjective.isCompleted ? rawObjective : null;

  const isOnboardingOverride = Boolean(guidanceOverride);
  const goalSource: NavigationPlan['goalSource'] = isOnboardingOverride
    ? 'onboarding'
    : objective
      ? 'quest'
      : 'postgame';

  const activeGoalTitleEn = isOnboardingOverride
    ? guidanceOverride!.titleEn
    : objective
      ? objective.titleEn
      : 'Post-game exploration';
  const activeGoalTitleVi = isOnboardingOverride
    ? guidanceOverride!.titleVi
    : objective
      ? objective.titleVi
      : 'Khám phá hậu cốt truyện';
  const activeGoalActionEn = isOnboardingOverride
    ? guidanceOverride!.actionEn
    : objective
      ? objective.whatEn
      : 'Explore Verdant Basin, bond with new Wildkin, or challenge Wardens for mastery rematches.';
  const activeGoalActionVi = isOnboardingOverride
    ? guidanceOverride!.actionVi
    : objective
      ? objective.whatVi
      : 'Tự do khám phá Thung Lũng Rêu Xanh, thu phục thêm sinh vật hoặc tái đấu các Thủ lĩnh.';

  const targetSpec = isOnboardingOverride
    ? (guidanceOverride!.target ?? null)
    : (overrideTarget ?? objective?.target ?? null);

  if (!targetSpec) {
    return {
      active: false,
      goalSource,
      activeGoalTitleEn,
      activeGoalTitleVi,
      activeGoalActionEn,
      activeGoalActionVi,
      objective,
      destinationInCurrentRegion: null,
      destinationLabelEn: isOnboardingOverride ? activeGoalTitleEn : '',
      destinationLabelVi: isOnboardingOverride ? activeGoalTitleVi : '',
      waypoints: [],
      firstStepDir: null,
      distanceSteps: 0,
      arrivedAtTarget: false,
      unreachable: false,
      isCrossRegion: false,
      blockedByGate: false,
      nearbyInteractable,
    };
  }

  if (targetSpec.regionId === state.regionId) {
    const stopAdjacent = targetSpec.kind === 'npc' || targetSpec.kind === 'prop';
    const allowTargetPortal = targetSpec.kind === 'portal';
    const manhattan =
      Math.abs(targetSpec.x - state.playerPos.x) + Math.abs(targetSpec.y - state.playerPos.y);
    const standingTile = getTileAt(currentMap, state.playerPos.x, state.playerPos.y);
    const arrivedAtTarget = stopAdjacent
      ? manhattan === 1
      : targetSpec.kind === 'tall_grass'
        ? standingTile === 'tall_grass' || standingTile === 'reed_marsh' || manhattan === 0
        : manhattan === 0;

    const waypoints = arrivedAtTarget
      ? []
      : computeLocalBfsPath({
          map: currentMap,
          npcsInRegion,
          state,
          startX: state.playerPos.x,
          startY: state.playerPos.y,
          targetX: targetSpec.x,
          targetY: targetSpec.y,
          stopAdjacent,
          allowTargetPortal,
        });

    if (!arrivedAtTarget && waypoints.length === 0) {
      return {
        active: false,
        goalSource,
        activeGoalTitleEn,
        activeGoalTitleVi,
        activeGoalActionEn,
        activeGoalActionVi,
        objective,
        destinationInCurrentRegion: { x: targetSpec.x, y: targetSpec.y },
        destinationLabelEn: targetSpec.labelEn,
        destinationLabelVi: targetSpec.labelVi,
        destinationKind: targetSpec.kind,
        waypoints: [],
        firstStepDir: null,
        distanceSteps: 0,
        arrivedAtTarget: false,
        unreachable: true,
        unreachableReasonEn: `Cannot find an open path to ${targetSpec.labelEn} from your current tile. Step back onto the main trail or check another quest in your Journal.`,
        unreachableReasonVi: `Không tìm thấy lối đi thông thoáng tới ${targetSpec.labelVi} từ vị trí hiện tại. Hãy lùi lại lối mòn chính hoặc kiểm tra mục tiêu khác trong Sổ thực địa.`,
        isCrossRegion: false,
        blockedByGate: false,
        nearbyInteractable,
      };
    }

    const first = waypoints[0];
    let firstStepDir: Direction | null = null;
    if (first) {
      if (first.x > state.playerPos.x) firstStepDir = 'right';
      else if (first.x < state.playerPos.x) firstStepDir = 'left';
      else if (first.y > state.playerPos.y) firstStepDir = 'down';
      else if (first.y < state.playerPos.y) firstStepDir = 'up';
    } else if (arrivedAtTarget && stopAdjacent) {
      if (targetSpec.x > state.playerPos.x) firstStepDir = 'right';
      else if (targetSpec.x < state.playerPos.x) firstStepDir = 'left';
      else if (targetSpec.y > state.playerPos.y) firstStepDir = 'down';
      else if (targetSpec.y < state.playerPos.y) firstStepDir = 'up';
    }

    return {
      active: true,
      goalSource,
      activeGoalTitleEn,
      activeGoalTitleVi,
      activeGoalActionEn,
      activeGoalActionVi,
      objective,
      destinationInCurrentRegion: { x: targetSpec.x, y: targetSpec.y },
      destinationLabelEn: targetSpec.labelEn,
      destinationLabelVi: targetSpec.labelVi,
      destinationKind: targetSpec.kind,
      waypoints,
      firstStepDir,
      distanceSteps: waypoints.length,
      arrivedAtTarget,
      unreachable: false,
      isCrossRegion: false,
      blockedByGate: false,
      nearbyInteractable,
    };
  }

  const portalRoute = findRegionPortalRoute({
    fromRegion: state.regionId,
    toRegion: targetSpec.regionId,
    mapsById,
    state,
    speciesById,
  });

  if (!portalRoute || portalRoute.length === 0) {
    const fallbackGate =
      currentMap.portals.find((p) => p.targetRegion === targetSpec.regionId) ??
      mapsById.mosslight_hub.portals.find((p) => p.targetRegion === targetSpec.regionId);
    const gateDesc = fallbackGate?.requiredFlag
      ? describeGateFlag(fallbackGate.requiredFlag)
      : {
          en: objective?.unmetRequirementEn ?? 'Complete the active main trial to unlock the route.',
          vi:
            objective?.unmetRequirementVi ??
            'Hãy hoàn thành thử thách cốt truyện hiện tại để mở khóa lối đi.',
        };
    return {
      active: false,
      goalSource,
      activeGoalTitleEn,
      activeGoalTitleVi,
      activeGoalActionEn,
      activeGoalActionVi,
      objective,
      destinationInCurrentRegion: null,
      destinationLabelEn: targetSpec.labelEn,
      destinationLabelVi: targetSpec.labelVi,
      destinationKind: targetSpec.kind,
      waypoints: [],
      firstStepDir: null,
      distanceSteps: 0,
      arrivedAtTarget: false,
      unreachable: false,
      isCrossRegion: true,
      blockedByGate: true,
      gateRequirementEn: gateDesc.en,
      gateRequirementVi: gateDesc.vi,
      nearbyInteractable,
    };
  }

  const nextPortal = portalRoute[0]!;
  const waypoints = computeLocalBfsPath({
    map: currentMap,
    npcsInRegion,
    state,
    startX: state.playerPos.x,
    startY: state.playerPos.y,
    targetX: nextPortal.x,
    targetY: nextPortal.y,
    stopAdjacent: false,
    allowTargetPortal: true,
  });

  if (waypoints.length === 0 && (state.playerPos.x !== nextPortal.x || state.playerPos.y !== nextPortal.y)) {
    return {
      active: false,
      goalSource,
      activeGoalTitleEn,
      activeGoalTitleVi,
      activeGoalActionEn,
      activeGoalActionVi,
      objective,
      destinationInCurrentRegion: { x: nextPortal.x, y: nextPortal.y },
      destinationLabelEn: nextPortal.labelEn,
      destinationLabelVi: nextPortal.labelVi,
      destinationKind: 'portal',
      waypoints: [],
      firstStepDir: null,
      distanceSteps: 0,
      arrivedAtTarget: false,
      unreachable: true,
      unreachableReasonEn: `Cannot reach ${nextPortal.labelEn} from your current spot. Return to the main path first.`,
      unreachableReasonVi: `Không tìm thấy đường tới ${nextPortal.labelVi} từ vị trí hiện tại. Hãy quay lại đường mòn chính trước.`,
      isCrossRegion: true,
      blockedByGate: false,
      nextPortalLabelEn: nextPortal.labelEn,
      nextPortalLabelVi: nextPortal.labelVi,
      nearbyInteractable,
    };
  }

  const first = waypoints[0];
  let firstStepDir: Direction | null = null;
  if (first) {
    if (first.x > state.playerPos.x) firstStepDir = 'right';
    else if (first.x < state.playerPos.x) firstStepDir = 'left';
    else if (first.y > state.playerPos.y) firstStepDir = 'down';
    else if (first.y < state.playerPos.y) firstStepDir = 'up';
  }

  return {
    active: true,
    goalSource,
    activeGoalTitleEn,
    activeGoalTitleVi,
    activeGoalActionEn,
    activeGoalActionVi,
    objective,
    destinationInCurrentRegion: { x: nextPortal.x, y: nextPortal.y },
    destinationLabelEn: nextPortal.labelEn,
    destinationLabelVi: nextPortal.labelVi,
    destinationKind: 'portal',
    waypoints,
    firstStepDir,
    distanceSteps: waypoints.length,
    arrivedAtTarget: false,
    unreachable: false,
    isCrossRegion: true,
    blockedByGate: false,
    nextPortalLabelEn: nextPortal.labelEn,
    nextPortalLabelVi: nextPortal.labelVi,
    nearbyInteractable,
  };
}

export function buildLostHelperReport(params: {
  state: GameState;
  navPlan: NavigationPlan;
  mapsById: Readonly<Record<RegionId, RegionMapDefinition>>;
}): LostHelperReport {
  const { state, navPlan, mapsById } = params;
  const currentMap = mapsById[state.regionId];
  const needsHealFirst =
    state.party.length > 0 &&
    state.party.every((m) => m.currentHp <= Math.round(m.maxHp * 0.4));

  const dirNamesEn: Record<Direction, string> = {
    up: 'North (Up)',
    down: 'South (Down)',
    left: 'West (Left)',
    right: 'East (Right)',
  };
  const dirNamesVi: Record<Direction, string> = {
    up: 'Bắc (Lên)',
    down: 'Nam (Xuống)',
    left: 'Tây (Trái)',
    right: 'Đông (Phải)',
  };

  if (navPlan.blockedByGate) {
    return {
      regionNameEn: currentMap.nameEn,
      regionNameVi: currentMap.nameVi,
      needsHealFirst,
      nextActionEn: navPlan.gateRequirementEn ?? 'Complete the current story trial first.',
      nextActionVi: navPlan.gateRequirementVi ?? 'Hãy hoàn thành thử thách cốt truyện trước đó.',
      targetLabelEn: navPlan.destinationLabelEn || navPlan.activeGoalTitleEn,
      targetLabelVi: navPlan.destinationLabelVi || navPlan.activeGoalTitleVi,
      routeSummaryEn:
        'The route to this destination is locked. Click Track Main Story Quest below to see how to unlock it.',
      routeSummaryVi:
        'Lối đi tới mục tiêu này đang khóa. Hãy bấm nút Theo dõi nhiệm vụ chính bên dưới để mở khóa trước.',
    };
  }

  if (navPlan.unreachable) {
    return {
      regionNameEn: currentMap.nameEn,
      regionNameVi: currentMap.nameVi,
      needsHealFirst,
      nextActionEn: navPlan.activeGoalActionEn,
      nextActionVi: navPlan.activeGoalActionVi,
      targetLabelEn: navPlan.destinationLabelEn || navPlan.activeGoalTitleEn,
      targetLabelVi: navPlan.destinationLabelVi || navPlan.activeGoalTitleVi,
      routeSummaryEn:
        navPlan.unreachableReasonEn ??
        'Could not calculate a direct route from your current tile. Move back to the main path.',
      routeSummaryVi:
        navPlan.unreachableReasonVi ??
        'Chưa thể tính đường trực tiếp từ ô hiện tại. Hãy quay lại lối mòn chính.',
    };
  }

  let routeSummaryEn: string;
  let routeSummaryVi: string;

  if (navPlan.arrivedAtTarget) {
    if (navPlan.destinationKind === 'tall_grass') {
      routeSummaryEn = `You are inside ${navPlan.destinationLabelEn}! Walk back and forth a few steps to meet a wild creature.`;
      routeSummaryVi = `Bạn đang đứng trong ${navPlan.destinationLabelVi}. Hãy đi qua lại vài bước để gặp sinh vật hoang dã.`;
    } else {
      routeSummaryEn = `You have arrived right beside ${navPlan.destinationLabelEn}. Press Space, Enter, or click Interact now.`;
      routeSummaryVi = `Bạn đã tới ngay cạnh ${navPlan.destinationLabelVi}. Hãy nhấn Space, Enter hoặc bấm nút Tương tác ngay.`;
    }
  } else if (navPlan.firstStepDir) {
    if (navPlan.isCrossRegion) {
      routeSummaryEn = `Follow the glowing path ${dirNamesEn[navPlan.firstStepDir]} about ${navPlan.distanceSteps} steps to ${navPlan.nextPortalLabelEn ?? 'the region exit'}.`;
      routeSummaryVi = `Đi theo vệt sáng về hướng ${dirNamesVi[navPlan.firstStepDir]} khoảng ${navPlan.distanceSteps} bước tới ${navPlan.nextPortalLabelVi ?? 'lối chuyển vùng'}.`;
    } else {
      routeSummaryEn = `Follow the glowing path ${dirNamesEn[navPlan.firstStepDir]} about ${navPlan.distanceSteps} steps to ${navPlan.destinationLabelEn}.`;
      routeSummaryVi = `Đi theo vệt sáng về hướng ${dirNamesVi[navPlan.firstStepDir]} khoảng ${navPlan.distanceSteps} bước tới ${navPlan.destinationLabelVi}.`;
    }
  } else if (navPlan.goalSource === 'onboarding') {
    routeSummaryEn = navPlan.activeGoalActionEn;
    routeSummaryVi = navPlan.activeGoalActionVi;
  } else {
    routeSummaryEn = 'You are in the right area. Explore nearby or open your Field Journal.';
    routeSummaryVi = 'Bạn đang ở đúng khu vực. Hãy quan sát xung quanh hoặc mở Sổ thực địa.';
  }

  const obj = navPlan.goalSource === 'quest' ? navPlan.objective : null;
  return {
    regionNameEn: currentMap.nameEn,
    regionNameVi: currentMap.nameVi,
    needsHealFirst,
    nextActionEn: navPlan.activeGoalActionEn,
    nextActionVi: navPlan.activeGoalActionVi,
    targetLabelEn: navPlan.destinationLabelEn || obj?.targetLabelEn || currentMap.nameEn,
    targetLabelVi: navPlan.destinationLabelVi || obj?.targetLabelVi || currentMap.nameVi,
    routeSummaryEn,
    routeSummaryVi,
    recommendedPrepEn: obj?.recommendedPrepEn,
    recommendedPrepVi: obj?.recommendedPrepVi,
  };
}

export type ClickMoveGoal =
  | { readonly kind: 'tile'; readonly x: number; readonly y: number }
  | {
      readonly kind: 'npc';
      readonly npcId: string;
      readonly x: number;
      readonly y: number;
      readonly labelEn: string;
      readonly labelVi: string;
    }
  | {
      readonly kind: 'prop';
      readonly propId: string;
      readonly propKind: PropKind;
      readonly x: number;
      readonly y: number;
      readonly labelEn: string;
      readonly labelVi: string;
    }
  | {
      readonly kind: 'portal';
      readonly portal: PortalDefinition;
      readonly unlocked: boolean;
      readonly x: number;
      readonly y: number;
    };

export interface ClickMovePlan {
  readonly ok: boolean;
  readonly goal: ClickMoveGoal | null;
  readonly waypoints: ReadonlyArray<GridPoint>;
  readonly immediateInteract: boolean;
  readonly immediateBlockedPortal?: PortalDefinition;
  readonly reason?: 'out_of_bounds' | 'same_tile' | 'blocked_tile' | 'unreachable';
  readonly reasonEn?: string;
  readonly reasonVi?: string;
}

export function directionBetweenAdjacentTiles(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Direction | null {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';
  return null;
}

export function planClickToMove(params: {
  state: GameState;
  map: RegionMapDefinition;
  npcsInRegion: ReadonlyArray<NpcDefinition>;
  speciesById: Readonly<Record<string, SpeciesDefinition>>;
  tileX: number;
  tileY: number;
}): ClickMovePlan {
  const { state, map, npcsInRegion, speciesById, tileX, tileY } = params;
  if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) {
    return {
      ok: false,
      goal: null,
      waypoints: [],
      immediateInteract: false,
      reason: 'out_of_bounds',
      reasonEn: 'Clicked outside the playable map.',
      reasonVi: 'Vị trí chọn nằm ngoài bản đồ.',
    };
  }

  const startX = state.playerPos.x;
  const startY = state.playerPos.y;
  if (tileX === startX && tileY === startY) {
    return {
      ok: true,
      goal: { kind: 'tile', x: tileX, y: tileY },
      waypoints: [],
      immediateInteract: false,
      reason: 'same_tile',
    };
  }

  const manhattan = Math.abs(tileX - startX) + Math.abs(tileY - startY);

  // 1. Check portals first (unlocked portals transition region; locked portals explain gate condition)
  const portal = map.portals.find((p) => p.x === tileX && p.y === tileY);
  if (portal) {
    const unlocked = isPortalUnlocked(portal, state, speciesById);
    const goal: ClickMoveGoal = {
      kind: 'portal',
      portal,
      unlocked,
      x: portal.x,
      y: portal.y,
    };
    const waypoints = computeLocalBfsPath({
      map,
      npcsInRegion,
      state,
      startX,
      startY,
      targetX: portal.x,
      targetY: portal.y,
      stopAdjacent: false,
      allowTargetPortal: true,
    });
    if (waypoints.length === 0) {
      if (!unlocked) {
        const desc = portal.requiredFlag
          ? describeGateFlag(portal.requiredFlag)
          : { en: portal.labelEn, vi: portal.labelVi };
        return {
          ok: false,
          goal,
          waypoints: [],
          immediateInteract: false,
          immediateBlockedPortal: portal,
          reason: 'unreachable',
          reasonEn: desc.en,
          reasonVi: desc.vi,
        };
      }
      return {
        ok: false,
        goal,
        waypoints: [],
        immediateInteract: false,
        reason: 'unreachable',
        reasonEn: `Cannot find a clear path to ${portal.labelEn}.`,
        reasonVi: `Không tìm thấy đường tới ${portal.labelVi}.`,
      };
    }
    return { ok: true, goal, waypoints, immediateInteract: false };
  }

  // 2. Check NPCs (walk to reachable adjacent tile, face NPC, and interact once)
  const npc = npcsInRegion.find((n) => n.x === tileX && n.y === tileY);
  if (npc) {
    const goal: ClickMoveGoal = {
      kind: 'npc',
      npcId: npc.id,
      x: npc.x,
      y: npc.y,
      labelEn: npc.name,
      labelVi: localizeSpeakerName(npc.name, 'vi'),
    };
    if (manhattan === 1) {
      return { ok: true, goal, waypoints: [], immediateInteract: true };
    }
    const waypoints = computeLocalBfsPath({
      map,
      npcsInRegion,
      state,
      startX,
      startY,
      targetX: npc.x,
      targetY: npc.y,
      stopAdjacent: true,
      allowTargetPortal: false,
    });
    if (waypoints.length === 0) {
      return {
        ok: false,
        goal,
        waypoints: [],
        immediateInteract: false,
        reason: 'unreachable',
        reasonEn: `Cannot reach ${goal.labelEn} from here.`,
        reasonVi: `Không thể đi tới cạnh ${goal.labelVi} từ vị trí hiện tại.`,
      };
    }
    return { ok: true, goal, waypoints, immediateInteract: false };
  }

  // 3. Check visible interactive props (chests, signs, campfires, shrines, supply posts, overlooks, traces)
  const prop = map.props.find((p) => p.x === tileX && p.y === tileY && isPropVisible(p, state));
  if (prop) {
    const goal: ClickMoveGoal = {
      kind: 'prop',
      propId: prop.id,
      propKind: prop.kind,
      x: prop.x,
      y: prop.y,
      labelEn: prop.labelEn,
      labelVi: prop.labelVi,
    };
    if (manhattan === 1) {
      return { ok: true, goal, waypoints: [], immediateInteract: true };
    }
    const waypoints = computeLocalBfsPath({
      map,
      npcsInRegion,
      state,
      startX,
      startY,
      targetX: prop.x,
      targetY: prop.y,
      stopAdjacent: true,
      allowTargetPortal: false,
    });
    if (waypoints.length === 0) {
      return {
        ok: false,
        goal,
        waypoints: [],
        immediateInteract: false,
        reason: 'unreachable',
        reasonEn: `Cannot reach ${prop.labelEn} from here.`,
        reasonVi: `Không thể đi tới ${prop.labelVi} từ vị trí hiện tại.`,
      };
    }
    return { ok: true, goal, waypoints, immediateInteract: false };
  }

  // 4. Reject non-walkable terrain or blocking structures (never clip through water, trees, or walls)
  if (!isTileWalkable({ map, npcsInRegion, state, x: tileX, y: tileY })) {
    return {
      ok: false,
      goal: null,
      waypoints: [],
      immediateInteract: false,
      reason: 'blocked_tile',
      reasonEn: 'Cannot walk onto water, trees, or obstacles.',
      reasonVi: 'Không thể đi vào nước, cây hoặc vật cản.',
    };
  }

  // 5. Walkable ground tile -> shortest BFS route avoiding portals and obstacles
  const goal: ClickMoveGoal = { kind: 'tile', x: tileX, y: tileY };
  const waypoints = computeLocalBfsPath({
    map,
    npcsInRegion,
    state,
    startX,
    startY,
    targetX: tileX,
    targetY: tileY,
    stopAdjacent: false,
    allowTargetPortal: false,
  });
  if (waypoints.length === 0) {
    return {
      ok: false,
      goal,
      waypoints: [],
      immediateInteract: false,
      reason: 'unreachable',
      reasonEn: 'No clear path to that spot.',
      reasonVi: 'Không tìm thấy lối đi tới ô đã chọn.',
    };
  }
  return { ok: true, goal, waypoints, immediateInteract: false };
}

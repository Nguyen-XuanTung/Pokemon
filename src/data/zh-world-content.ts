import type { CombatRole, ElementType, RegionId } from '../domain/types.ts';

export interface SpeciesZhText {
  readonly nameZh: string;
  readonly titleZh: string;
  readonly fieldNoteZh: string;
}

export interface MoveZhText {
  readonly nameZh: string;
  readonly descriptionZh: string;
}

export interface ItemZhText {
  readonly nameZh: string;
  readonly descriptionZh: string;
}

export interface QuestZhText {
  readonly titleZh: string;
  readonly summaryZh: string;
  readonly stepsZh: Readonly<Record<string, string>>;
}

export interface MapZhText {
  readonly nameZh: string;
  readonly subtitleZh: string;
  readonly portalLabelsZh: ReadonlyArray<string>;
  readonly propLabelsZh: Readonly<Record<string, string>>;
}

export interface NpcZhText {
  readonly nameZh: string;
  readonly roleZh: string;
  readonly trainerTitleZh?: string;
  readonly rematchTitleZh?: string;
}

export const ELEMENT_LABELS_ZH: Readonly<Record<ElementType, string>> = {
  leaf: '草叶',
  water: '流水',
  ember: '火焰',
  stone: '岩石',
  gale: '疾风',
  spark: '雷电',
  neutral: '普通',
};

export const COMBAT_ROLE_LABELS_ZH: Readonly<Record<CombatRole, string>> = {
  striker: '强攻',
  bulwark: '防御',
  swift: '高速',
  tactician: '战术',
  guardian: '守护',
};

export const SPECIES_ZH: Readonly<Record<string, SpeciesZhText>> = {
  mosskit: {
    nameZh: '苔芽猫',
    titleZh: '蕨叶山猫幼崽',
    fieldNoteZh: '它柔软的绿耳朵能比云朵更早感觉到远方的雨。',
  },
  briarpaw: {
    nameZh: '荆爪猫',
    titleZh: '林间寻路猫',
    fieldNoteZh: '荆爪猫在长满苔藓的树枝间轻快跳跃，常为迷路旅人带路。',
  },
  verdantag: {
    nameZh: '青树灵猫',
    titleZh: '古林树冠守护者',
    fieldNoteZh: '每当树林重归和谐，青树灵猫走过的脚印里就会开出野花。',
  },
  kindlet: {
    nameZh: '火灵狐',
    titleZh: '暖炉小狐狸',
    fieldNoteZh: '火灵狐喜欢蜷在篝火旁边，在微冷的夜里分享温暖。',
  },
  cinderfox: {
    nameZh: '炎尾狐',
    titleZh: '提灯疾奔狐',
    fieldNoteZh: '它发光的尾巴像一盏明灯，能照亮山谷里的浓雾。',
  },
  pyrelume: {
    nameZh: '晨焰狐',
    titleZh: '阳炉圣狐',
    fieldNoteZh: '传说晨焰狐点亮了红土山脊上第一座古老的陶窑。',
  },
  ripplefin: {
    nameZh: '波鳍獭',
    titleZh: '清溪小水獭',
    fieldNoteZh: '波鳍獭爱收集溪底光滑的小石头，轻松漂在水面上玩耍。',
  },
  brookotter: {
    nameZh: '激流獭',
    titleZh: '激流领航獭',
    fieldNoteZh: '护林员常常跟着激流獭游出的路线，安全穿过积水湿地。',
  },
  tidecrest: {
    nameZh: '潮冠獭',
    titleZh: '山谷碧水守护獭',
    fieldNoteZh: '潮冠獭宽大的尾巴轻轻一拍，就能让汹涌的水面恢复平静。',
  },
  breezeling: {
    nameZh: '微风雀',
    titleZh: '草地清风雀',
    fieldNoteZh: '微风雀喜欢停在木头路标上，每天早上吹出清脆的歌声。',
  },
  zephyrwing: {
    nameZh: '疾风隼',
    titleZh: '山谷滑翔隼',
    fieldNoteZh: '疾风隼能借着暖风在山谷上空滑翔很久，完全不用拍翅膀。',
  },
  stormplume: {
    nameZh: '云岚雕',
    titleZh: '云顶巨雕',
    fieldNoteZh: '云岚雕在高高的石门拱顶筑巢，那里离山顶白云很近。',
  },
  dewgrub: {
    nameZh: '露虫',
    titleZh: '青苔小幼虫',
    fieldNoteZh: '露虫躲在落下的橡树叶下面，安静吃着湿润的林间苔藓。',
  },
  shellglow: {
    nameZh: '萤壳蛹',
    titleZh: '提灯翠茧',
    fieldNoteZh: '黄昏时，萤壳蛹会在空心大树里发出柔和的绿光。',
  },
  canopyhorn: {
    nameZh: '林角甲',
    titleZh: '古林独角卫士',
    fieldNoteZh: '林角甲能用光亮的绿角抬起倒下的树干，为森林小路清障。',
  },
  voltkit: {
    nameZh: '电光兔',
    titleZh: '草地火花兔',
    fieldNoteZh: '每当夏天乌云聚集，电光兔的长耳朵里就会跳动细小电光。',
  },
  thundash: {
    nameZh: '雷影兔',
    titleZh: '闪电奔兔',
    fieldNoteZh: '雷影兔只需三大步金色跃动，就能飞快穿过整片草地。',
  },
  reedhop: {
    nameZh: '芦跳蛙',
    titleZh: '湿地合唱蛙',
    fieldNoteZh: '芦跳蛙蹲在荷叶上，黄昏时常有节奏地唱起呼雨的歌。',
  },
  marshcroak: {
    nameZh: '沼鼓蛙',
    titleZh: '水鼓大蛙',
    fieldNoteZh: '它低沉的叫声像木鼓一样，在有雾的水面上回荡很远。',
  },
  lotusbell: {
    nameZh: '荷铃翁',
    titleZh: '睡莲智者',
    fieldNoteZh: '荷铃翁背上开着清香的荷花，能慢慢净化浑浊的湿地池水。',
  },
  glimmerfin: {
    nameZh: '灯鳍鱼',
    titleZh: '灯火溪鱼',
    fieldNoteZh: '成群的灯鳍鱼在木桥下游动，就像落进溪水里的小星星。',
  },
  surgecoil: {
    nameZh: '雷涡鱼',
    titleZh: '领航电鳗',
    fieldNoteZh: '下大雨时，雷涡鱼会照亮水面，引导迷路的芦苇小船回家。',
  },
  clayback: {
    nameZh: '陶甲兽',
    titleZh: '红陶穿山兽',
    fieldNoteZh: '陶甲兽重叠的鳞片像红土山坡一样，带着温暖的土红色。',
  },
  kilnshell: {
    nameZh: '窑壳龟',
    titleZh: '陶甲岩龟',
    fieldNoteZh: '窑壳龟白天在平坦的石台上晒太阳，把温暖存进厚壳里。',
  },
  cragbastion: {
    nameZh: '岩堡龟',
    titleZh: '巨岩守护龟',
    fieldNoteZh: '青苔和野花在岩堡龟古老的石壳上静静生长。',
  },
  sunskink: {
    nameZh: '阳崖蜥',
    titleZh: '暖崖小蜥蜴',
    fieldNoteZh: '阳崖蜥在陡峭的红石崖壁上飞跑，速度比滚落的石子还快。',
  },
  flarecrest: {
    nameZh: '炎冠蜥',
    titleZh: '峡谷炎冠龙蜥',
    fieldNoteZh: '炎冠蜥张开琥珀色颈冠时，峡谷的风里都带着温暖回响。',
  },
  starhoot: {
    nameZh: '星望鸮',
    titleZh: '观星小猫头鹰',
    fieldNoteZh: '星望鸮常歪着圆脑袋，看着山顶水池里倒映的星星。',
  },
  astraloom: {
    nameZh: '星夜鸮',
    titleZh: '星穹猫头鹰',
    fieldNoteZh: '星夜鸮翅膀下的银色花纹，与星落圣地的古老刻痕一模一样。',
  },
  solacern: {
    nameZh: '星鸣鹿',
    titleZh: '圣地和谐灵鹿',
    fieldNoteZh: '绿苔谷的传说守护兽，当自然平衡时，它的水晶鹿角会清脆鸣响。',
  },
};

export const MOVES_ZH: Readonly<Record<string, MoveZhText>> = {
  trail_tackle: { nameZh: '小路撞击', descriptionZh: '沿着小路稳稳向前撞击对手。' },
  quick_dash: { nameZh: '极速冲刺', descriptionZh: '在对手反应前迅速抢先出击。' },
  keen_focus: { nameZh: '专注蓄力', descriptionZh: '深吸一口气，提高自己的攻击力。' },
  shelter_stance: { nameZh: '稳固守势', descriptionZh: '放低身姿稳住脚步，提高防御力。' },
  echo_roar: { nameZh: '林间回响', descriptionZh: '发出洪亮回声，降低对手的攻击力。' },
  morning_rest: { nameZh: '晨光小憩', descriptionZh: '沐浴温暖阳光，恢复接近一半最大体力。' },
  vine_snap: { nameZh: '藤鞭轻击', descriptionZh: '用柔韧的绿藤迅速抽打对手。' },
  sap_drain: { nameZh: '树液吸收', descriptionZh: '从目标吸取森林活力，同时为自己回血。' },
  spore_drift: { nameZh: '飘散孢子', descriptionZh: '撒出苦味蘑菇孢子，使对手陷入中毒状态。' },
  lullaby_pollen: { nameZh: '安眠花粉', descriptionZh: '释放柔和金色花粉，让对手进入安静睡眠。' },
  razor_frond: { nameZh: '利叶飞斩', descriptionZh: '挥出锋利的蕨叶，切过整片林间空地。' },
  canopy_surge: { nameZh: '古林叶浪', descriptionZh: '召唤古老森林的奔涌树叶大浪攻击目标。' },
  bark_shield: { nameZh: '橡皮护盾', descriptionZh: '像橡树皮一样硬化护甲，大幅提高防御。' },
  brook_splash: { nameZh: '清溪水箭', descriptionZh: '喷出一道清凉精准的山溪水流。' },
  mist_veil: { nameZh: '湿润薄雾', descriptionZh: '用凉爽白雾笼罩场地，降低对手速度。' },
  river_dive: { nameZh: '急流冲潜', descriptionZh: '乘着旋转水流正面冲向对手。' },
  soothing_rain: { nameZh: '细雨愈合', descriptionZh: '降下温柔细雨，恢复接近一半体力。' },
  marsh_bubble: { nameZh: '湿地泡泡', descriptionZh: '喷出沉重的湿地水泡，攻击并降低对手速度。' },
  tidal_crest: { nameZh: '潮涌巨浪', descriptionZh: '唤起深谷泉眼涌出的高大水浪冲击目标。' },
  ember_nip: { nameZh: '火星轻弹', descriptionZh: '弹出炽热炭火，有几率让对手灼伤。' },
  warm_pounce: { nameZh: '焰环飞扑', descriptionZh: '穿过温暖火环扑向对手，有几率灼伤目标。' },
  willow_wisp: { nameZh: '提灯火影', descriptionZh: '飘出灯火般的火焰，使对手陷入灼伤状态。' },
  hearth_glow: { nameZh: '炉火燃心', descriptionZh: '燃起内心暖焰，大幅提高攻击力。' },
  kiln_burst: { nameZh: '古窑热浪', descriptionZh: '释放古陶窑般的高温热浪，有几率灼伤对手。' },
  sunflare_arc: { nameZh: '烈阳火弧', descriptionZh: '在天空划出耀眼火弧，炽热轰击场地。' },
  pebble_toss: { nameZh: '溪石连投', descriptionZh: '瞄准目标连续投出光滑河石。' },
  clay_roll: { nameZh: '陶甲翻滚', descriptionZh: '缩进坚硬陶壳里，沿斜坡全力滚撞对手。' },
  canyon_wall: { nameZh: '峡谷岩壁', descriptionZh: '双脚稳扎岩石地基，大幅提高防御力。' },
  amber_lance: { nameZh: '晶岩突刺', descriptionZh: '在对手脚下升起共鸣矿物尖晶。' },
  quake_stomp: { nameZh: '山谷震踏', descriptionZh: '用力踏击峡谷地面，震撼整片场地。' },
  gust_sweep: { nameZh: '清风横扫', descriptionZh: '轻快拍打翅膀，掀起清爽山谷微风。' },
  wing_glide: { nameZh: '顺风飞掠', descriptionZh: '借着上升气流抢先展开羽翼突袭。' },
  tailwind_grace: { nameZh: '顺风节律', descriptionZh: '顺应高山清风，大幅提高移动与出手速度。' },
  ridge_cyclone: { nameZh: '山脊旋风', descriptionZh: '卷起夹带秋叶与谷风的呼啸气旋。' },
  skyward_tempest: { nameZh: '云穹狂风', descriptionZh: '从最高圣地山顶唤下呼啸狂风。' },
  static_nuzzle: { nameZh: '火花脉冲', descriptionZh: '发出清脆电流涟漪，有几率令对手麻痹。' },
  thunder_wavelet: { nameZh: '静电细网', descriptionZh: '织出无害静电丝网，使对手陷入麻痹减速。' },
  volt_bound: { nameZh: '金电飞跃', descriptionZh: '披着金色电光跃过草地撞击对手。' },
  lantern_beam: { nameZh: '灯火光束', descriptionZh: '射出聚拢的生物荧光束，有几率造成麻痹。' },
  starfall_bolt: { nameZh: '星落天雷', descriptionZh: '引下璀璨的星穹雷柱劈向目标。' },
  harmony_chime: { nameZh: '和谐钟鸣', descriptionZh: '奏响圣地纯净和弦，攻击同时回复自身体力。' },
  dusk_lull: { nameZh: '黄昏轻吟', descriptionZh: '随晚风轻哼安眠曲，让对手进入睡眠状态。' },
};

export const ITEMS_ZH: Readonly<Record<string, ItemZhText>> = {
  moss_charm: {
    nameZh: '苔藓铃铛',
    descriptionZh: '编织精巧的木制风铃，用柔和声音邀请野生伙伴结伴。',
  },
  reed_charm: {
    nameZh: '芦苇铃铛',
    descriptionZh: '音色更清亮的湿地风铃，很适合害羞或动作快的伙伴。',
  },
  amber_charm: {
    nameZh: '琥珀铃铛',
    descriptionZh: '用峡谷树脂做成的暖色铃铛，能与强大高地灵兽共鸣。',
  },
  star_charm: {
    nameZh: '星光铃铛',
    descriptionZh: '稀有的圣地古铃，即使面对珍稀守护兽也能迅速共鸣。',
  },
  dew_tonic: {
    nameZh: '露水药剂',
    descriptionZh: '清晨露水与清凉薄荷叶调制而成，恢复 35 点体力。',
  },
  orchard_salve: {
    nameZh: '林果药膏',
    descriptionZh: '资深护林员常备的浓香果膏，恢复 85 点体力。',
  },
  nectar_flask: {
    nameZh: '阳花蜜露',
    descriptionZh: '采自高崖金色花朵的珍贵蜜露，恢复 180 点体力。',
  },
  clear_herb: {
    nameZh: '清心草',
    descriptionZh: '气味清新的草药，可清除睡眠、中毒、灼伤和麻痹状态。',
  },
  breeze_tea: {
    nameZh: '清风茶',
    descriptionZh: '营地泡好的温热草茶，为全部技能恢复 8 点能量。',
  },
  calm_lantern: {
    nameZh: '雪松灯笼',
    descriptionZh: '淡雅雪松香气在接下来的 45 步内避开野生遭遇。',
  },
  reed_ferry_pass: {
    nameZh: '湿地渡船证',
    descriptionZh: '西尔万赠予的橡木徽牌，可开启前往清芦湿地的渡口。',
  },
  sunforge_rope: {
    nameZh: '峡谷攀绳钩',
    descriptionZh: '米蕾拉赠予的结实芦苇攀索，用于登上红土山脊。',
  },
  starfall_crest: {
    nameZh: '共鸣徽印',
    descriptionZh: '凯伦托付的三石徽印，可开启北方星落圣地的石门。',
  },
};

export const QUESTS_ZH: Readonly<Record<string, QuestZhText>> = {
  q01_first_partner: {
    titleZh: '第一位路途伙伴',
    summaryZh: '在苔灯营地找护林员罗文说话，选出你的第一位灵兽伙伴。',
    stepsZh: {
      pick_starter: '在罗文这里从苔芽猫、火灵狐或波鳍獭中选一位伙伴。',
    },
  },
  q02_whisperwood_echo: {
    titleZh: '低语橡木的回声',
    summaryZh: '往西走进低语林谷，和守护者西尔万一起让低语橡木重归和谐。',
    stepsZh: {
      enter_whisperwood: '沿着西边小路进入低语林谷。',
      clear_sylvan: '在低语橡木旁完成守护者西尔万的试炼。',
    },
  },
  q03_field_herbarium: {
    titleZh: '野外图鉴的第一页',
    summaryZh: '帮植物学者小玲在山谷里观察并记录至少 5 种不同的灵兽。',
    stepsZh: {
      discover_five: '在野外遇见并记录 5 种灵兽到图鉴里。',
    },
  },
  q04_first_bond: {
    titleZh: '友谊的铃声',
    summaryZh: '在野外遭遇时使用铃铛，让队伍记录至少 3 种收服的灵兽。',
    stepsZh: {
      catch_three: '和 3 种不同的灵兽结伴（包括你的初始伙伴）。',
    },
  },
  q05_fen_current: {
    titleZh: '清芦湿地的水流',
    summaryZh: '前往清芦湿地，和守护者米蕾拉一起唤醒沉潮拱门的共鸣。',
    stepsZh: {
      enter_fen: '从苔灯营地东边渡口或林间溪路进入清芦湿地。',
      clear_mirella: '在沉潮拱门前完成守护者米蕾拉的试炼。',
    },
  },
  q06_lantern_cocoon: {
    titleZh: '树洞里的微光',
    summaryZh: '阅读低语林谷的空心树洞线索，并与至少 1 种草叶伙伴结伴。',
    stepsZh: {
      read_clue: '查看低语林南边的空心树洞线索路标。',
      leaf_partner: '在图鉴中拥有至少 1 种草叶属性伙伴。',
    },
  },
  q07_mist_beacons: {
    titleZh: '薄雾中的航灯',
    summaryZh: '帮渡船向导素拉检查雾道灯柱，并收服 1 种雷电属性灵兽。',
    stepsZh: {
      check_beacon: '查看清芦湿地东边的雾道灯柱。',
      spark_partner: '收服至少 1 种雷电属性伙伴（如电光兔或灯鳍鱼）。',
    },
  },
  q08_ridge_beacon: {
    titleZh: '红土山脊的烽火',
    summaryZh: '登上红土山脊，与守护者凯伦一同唤醒阳炉烽火台。',
    stepsZh: {
      enter_ridge: '登上阳光明媚的红土山脊悬崖。',
      clear_kaelen: '在阳炉烽火台完成守护者凯伦的试炼。',
    },
  },
  q09_ancient_kiln: {
    titleZh: '暖陶的记忆',
    summaryZh: '阅读古老陶窑石碑，并收服至少 1 种岩石属性伙伴。',
    stepsZh: {
      inspect_kiln: '查看红土山脊西南方的古陶窑石碑。',
      stone_partner: '收服至少 1 种岩石属性灵兽（如陶甲兽或窑壳龟）。',
    },
  },
  q10_starlight_inscriptions: {
    titleZh: '星石上的诗行',
    summaryZh: '帮学者莱拉读完星落圣地的西、东、北三处星石铭文。',
    stepsZh: {
      pillar_west: '阅读圣地木桥附近的西星石柱。',
      pillar_east: '阅读东边木桥对面的东星石柱。',
      pillar_north: '阅读高台旁的北方和谐石碑。',
    },
  },
  q11_starfall_harmony: {
    titleZh: '星落圣地的和谐乐章',
    summaryZh: '步入星落圣地，通过长老阿斯特蕾亚的试炼，唤醒星穹和谐祭坛。',
    stepsZh: {
      enter_sanctuary: '穿过北方石门登上星落圣地。',
      pass_astraea: '完成守护长老阿斯特蕾亚的最终共鸣试炼。',
      ring_celestial_altar: '在圣地最高处唤醒星穹和谐祭坛。',
    },
  },
  q12_basin_naturalist: {
    titleZh: '十二灵兽的同行者',
    summaryZh: '与至少 12 种不同灵兽结伴，组建丰富多元的探索图鉴。',
    stepsZh: {
      catch_twelve: '在野外图鉴中记录 12 种已结伴的灵兽。',
    },
  },
};

export const MAPS_ZH: Readonly<Record<RegionId, MapZhText>> = {
  mosslight_hub: {
    nameZh: '苔灯营地',
    subtitleZh: '绿苔谷的自然学者营地与探索广场',
    portalLabelsZh: [
      '西边小路：前往低语林谷',
      '东边渡口：前往清芦湿地',
      '南边绳索梯：前往红土山脊',
      '北边石门：前往星落圣地',
    ],
    propLabelsZh: {
      hub_campfire: '苔灯篝火',
      hub_supply_post: '探险补给站',
      hub_welcome_sign: '山谷十字路标',
      hub_study_notes: '罗文的野外告示板',
      hub_overlook: '南溪观景台',
      hub_garden_chest: '温室草药篮',
    },
  },
  whisperwood: {
    nameZh: '低语林谷',
    subtitleZh: '层叠古老树冠、阳光蕨叶与林间小路',
    portalLabelsZh: [
      '东边小路：返回苔灯营地',
      '北边溪径捷径：前往清芦湿地',
    ],
    propLabelsZh: {
      ww_campfire: '林间空地篝火',
      ww_oak_shrine: '低语橡木共鸣石',
      ww_trail_sign: '低语林护林员提示牌',
      ww_dusk_sign: '空心树洞线索',
      ww_overlook: '树冠空地观景台',
      ww_trace_shellglow: '发光树皮痕迹',
      ww_brook_chest: '溪边补给箱',
      ww_secret_chest: '隐藏蕨丛皮囊',
    },
  },
  reedwater_fen: {
    nameZh: '清芦湿地',
    subtitleZh: '薄雾莲池、芦苇水道与木板栈桥',
    portalLabelsZh: [
      '西边渡口：返回苔灯营地',
      '南边溪路：返回低语林谷',
      '东边石阶：前往红土山脊',
    ],
    propLabelsZh: {
      fen_campfire: '灯火码头篝火',
      fen_tide_shrine: '沉潮共鸣石拱',
      fen_entry_sign: '湿地水道指南牌',
      fen_beacon_post: '雾道灯笼柱',
      fen_overlook: '荷塘观景台',
      fen_trace_lotusbell: '带露荷叶波纹痕迹',
      fen_reed_chest: '编织芦苇箱',
      fen_lotus_chest: '莲亭木匣',
    },
  },
  terracotta_ridge: {
    nameZh: '红土山脊',
    subtitleZh: '阶梯红岩崖壁、山谷飞瀑与古老陶窑',
    portalLabelsZh: [
      '北边绳索梯：返回苔灯营地',
      '西边石阶：返回清芦湿地',
      '高处山隘：前往星落圣地',
    ],
    propLabelsZh: {
      ridge_campfire: '避风石壁篝火',
      ridge_kiln_ruin: '古老陶窑石碑',
      ridge_sunforge_shrine: '阳炉共鸣烽火台',
      ridge_entry_sign: '峡谷强风警示牌',
      ridge_overlook: '峡谷崖边观景台',
      ridge_trace_flarecrest: '暖石羽毛痕迹',
      ridge_amber_chest: '陶匠补给箱',
      ridge_summit_chest: '高崖石台铁箱',
    },
  },
  starfall_sanctuary: {
    nameZh: '星落圣地',
    subtitleZh: '山谷之巅的古老星光石台观星遗迹',
    portalLabelsZh: [
      '南边石门：返回苔灯营地',
      '南边石门：返回苔灯营地',
      '西边山隘：返回红土山脊',
    ],
    propLabelsZh: {
      sanctuary_campfire: '星光火盆',
      sanctuary_celestial_altar: '星穹和谐祭坛',
      sanctuary_pillar_west: '西星石柱',
      sanctuary_pillar_east: '东星石柱',
      sanctuary_pillar_north: '北方和谐石碑',
      sanctuary_overlook: '星光水池观景台',
      sanctuary_trace_solacern: '水晶鹿角蹄印',
      sanctuary_vault_chest: '观星台星光宝箱',
    },
  },
};

export const NPCS_ZH: Readonly<Record<string, NpcZhText>> = {
  npc_rowan: { nameZh: '护林员罗文', roleZh: '山谷首席自然学者' },
  npc_linh: { nameZh: '植物学者小玲', roleZh: '双语野外学者' },
  npc_tomas: { nameZh: '补给官托马斯', roleZh: '营地物资负责人' },
  npc_mai: { nameZh: '侦察员小梅', roleZh: '十字路口向导' },
  npc_elena: { nameZh: '侦察员艾琳娜', roleZh: '橡树林见习护林员', trainerTitleZh: '侦察员艾琳娜' },
  npc_haru: { nameZh: '木雕师阿春', roleZh: '风铃工匠' },
  npc_sylvan: {
    nameZh: '守护者西尔万',
    roleZh: '低语林谷守护者',
    trainerTitleZh: '守护者西尔万',
    rematchTitleZh: '大师守护者西尔万',
  },
  npc_noah: { nameZh: '渔夫诺亚', roleZh: '湿地水道观察员', trainerTitleZh: '渔夫诺亚' },
  npc_sora: { nameZh: '渡船向导素拉', roleZh: '芦苇小船船夫' },
  npc_mirella: {
    nameZh: '守护者米蕾拉',
    roleZh: '清芦湿地守护者',
    trainerTitleZh: '守护者米蕾拉',
    rematchTitleZh: '大师守护者米蕾拉',
  },
  npc_diego: { nameZh: '登山者迪戈', roleZh: '峡谷攀绳侦察员', trainerTitleZh: '登山者迪戈' },
  npc_amara: { nameZh: '陶艺师阿玛拉', roleZh: '红土古窑史学者' },
  npc_kaelen: {
    nameZh: '守护者凯伦',
    roleZh: '红土山脊守护者',
    trainerTitleZh: '守护者凯伦',
    rematchTitleZh: '大师守护者凯伦',
  },
  npc_lyra: { nameZh: '学者莱拉', roleZh: '圣地铭文记录者' },
  npc_orin: { nameZh: '观星者奥林', roleZh: '星台守望员', trainerTitleZh: '观星者奥林' },
  npc_astraea: {
    nameZh: '长老阿斯特蕾亚',
    roleZh: '星落圣地大守护者',
    trainerTitleZh: '长老阿斯特蕾亚',
    rematchTitleZh: '圣地大守护长老阿斯特蕾亚',
  },
};

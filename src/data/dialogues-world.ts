import type { DialogueNode } from '../domain/types.ts';

export const DIALOGUES_WORLD: ReadonlyArray<DialogueNode> = [
  {
    id: 'sign_hub_crossroads',
    speaker: 'Basin Trail Signpost',
    speakerRoleVi: 'Biển chỉ đường ngã tư',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'world_sign',
    lines: [
      {
        en: 'West: Whisperwood Glen. East: Reedwater Fen. South: Terracotta Ridge. North: Starfall Sanctuary.',
        vi: 'Tây: Thung Lũng Rừng Thầm. Đông: Đầm Sậy Nước Trong. Nam: Đèo Đất Nung. Bắc: Thánh Địa Sao Rơi.',
        focusWords: ['west', 'east', 'south', 'north', 'sanctuary'],
      },
    ],
  },
  {
    id: 'sign_rowan_board',
    speaker: 'Rowan Field Board',
    speakerRoleVi: 'Bảng ghi chú thực địa',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'world_sign',
    lines: [
      {
        en: 'Field Rule One: Take your time! Lowering a wild creature health or inducing calm sleep helps chimes resonate.',
        vi: 'Nguyên tắc thực địa số một: Cứ thong thả! Giảm máu sinh vật hoang hoặc ru ngủ êm sẽ giúp tiếng chuông dễ cộng hưởng.',
        variants: {
          A1: {
            en: 'Rule One: Take your time! Low health or calm sleep helps your chime catch a wild friend.',
            vi: 'Nguyên tắc một: Cứ thong thả! Máu thấp hoặc giấc ngủ êm giúp chuông dễ kết bạn hoang dã.',
          },
          B1: {
            en: 'Field Rule One: Take your time in tall grass! Weakening a wild partner or inducing sleep makes resonance chimes ring clear.',
            vi: 'Nguyên tắc thực địa số một: Cứ thong thả trong cỏ cao! Làm yếu sinh vật hoặc ru ngủ sẽ giúp chuông cộng hưởng vang rõ.',
          },
          B2: {
            en: 'Field Rule One: Never rush an encounter! Softening vitality or inducing calm slumber allows acoustic chimes to resonate reliably.',
            vi: 'Nguyên tắc thực địa số một: Đừng vội vàng khi chạm trán! Giảm sinh lực hoặc đưa vào giấc ngủ êm giúp chuông cộng hưởng ổn định.',
          },
        },
        focusWords: ['take your time', 'wild', 'creature', 'health', 'chime', 'resonate'],
      },
      {
        en: 'Field Rule Two: Feel free to tap any English word for help, because curiosity never carries a penalty here.',
        vi: 'Nguyên tắc số hai: Cứ thoải mái chạm vào bất kỳ từ tiếng Anh nào để xem nghĩa, vì sự tò mò ở đây không bao giờ bị phạt.',
        focusWords: ['feel free', 'help', 'curious'],
      },
    ],
  },
  {
    id: 'sign_whisperwood_entry',
    speaker: 'Whisperwood Ranger Notice',
    speakerRoleVi: 'Bảng lưu ý đầu rừng',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'world_sign',
    lines: [
      {
        en: 'Stay on the packed footpath for a safe walk, or step into swaying tall grass to meet woodland Wildkin.',
        vi: 'Đi trên đường đất nện để dạo bước an toàn, hoặc rẽ vào bụi cỏ cao đung đưa để gặp các loài rừng xanh.',
        variants: {
          A1: {
            en: 'Walk on the dirt path to stay safe, or step into tall grass to meet forest friends.',
            vi: 'Đi trên lối mòn để an toàn, hoặc bước vào cỏ cao để gặp bạn rừng xanh.',
          },
          B1: {
            en: 'Keep to the winding trail if your tonics run low, or venture into tall grass to observe woodland species.',
            vi: 'Hãy bám lối mòn uốn lượn nếu thuốc hồi sắp cạn, hoặc rẽ vào cỏ cao để quan sát các loài rừng xanh.',
          },
          B2: {
            en: 'Packed trails offer safe passage back to camp, whereas swaying fern glades shelter diverse woodland Wildkin.',
            vi: 'Đường mòn nện chặt giữ lối về trại an toàn, trong khi trảng dương xỉ đung đưa là nơi trú ngụ của nhiều loài rừng xanh.',
          },
        },
        focusWords: ['path', 'safe', 'walk', 'grass'],
      },
    ],
  },
  {
    id: 'sign_whisperwood_dusk_clue',
    speaker: 'Hollow Trunk Clue',
    speakerRoleVi: 'Manh mối hốc cây cổ',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'world_clue',
    lines: [
      {
        en: 'Carved note by Haru: Shellglow hides beneath rough oak bark by day and emerges at dusk. Check behind eastern ferns too!',
        vi: 'Lời khắc của Haru: Shellglow trốn dưới lớp vỏ sồi sần sùi ban ngày và xuất hiện lúc chạng vạng. Nhớ tìm sau bụi dương xỉ phía đông!',
        variants: {
          A1: {
            en: 'Haru note: Shellglow hides in old tree bark by day and glows at dusk. Look behind the east plants too!',
            vi: 'Ghi chú của Haru: Shellglow trốn trong vỏ cây già ban ngày và phát sáng lúc chiều tối. Hãy tìm thêm phía đông nhé!',
          },
          A2: {
            en: 'Haru trail note: Shellglow rests under oak bark during the day and glows bright at dusk. Check the eastern ferns!',
            vi: 'Ghi chú của Haru: Shellglow nghỉ dưới vỏ cây sồi ban ngày và sáng rõ vào lúc chạng vạng. Nhớ xem bụi dương xỉ phía đông!',
          },
          B2: {
            en: 'Carved note by Haru: Shellglow shelters inside damp oak hollows until twilight, glowing brightest at dusk near eastern fern thickets.',
            vi: 'Lời khắc của Haru: Shellglow ẩn trong hốc sồi ẩm tới chiều muộn, phát sáng rực nhất lúc chạng vạng gần bụi dương xỉ phía đông.',
          },
        },
        focusWords: ['hide', 'bark', 'at dusk', 'fern'],
      },
    ],
  },
  {
    id: 'shrine_whisperwood',
    speaker: 'Whispering Oak Stone',
    speakerRoleVi: 'Đá cộng hưởng rừng sồi',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'world_shrine',
    lines: [
      {
        en: 'Spiral leaf patterns wrap this moss-covered monolith. A gentle woodland chord hums deep inside the stone.',
        vi: 'Hoa văn lá xoắn ốc bao quanh khối đá phủ rêu. Một hợp âm rừng xanh dịu nhẹ ngân sâu bên trong lòng đá.',
        focusWords: ['leaf', 'moss', 'gentle', 'stone'],
      },
    ],
  },
  {
    id: 'sign_fen_entry',
    speaker: 'Fen Waterway Guide',
    speakerRoleVi: 'Bảng chỉ dẫn đường thủy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'world_sign',
    lines: [
      {
        en: 'Wooden bridges connect the reed islands. Keep an eye on lotus blossoms that mark clean water currents toward the Tide Arch.',
        vi: 'Những cây cầu gỗ nối liền các đảo sậy. Hãy để mắt tới hoa sen đánh dấu dòng nước sạch dẫn về Vòm Thủy Triều.',
        variants: {
          A1: {
            en: 'Wood bridges link the islands. Follow the lotus flowers along the clean water current to the northeast.',
            vi: 'Cầu gỗ nối các hòn đảo. Hãy đi theo hoa sen dọc dòng nước sạch về hướng đông bắc.',
          },
          A2: {
            en: 'Cross the wooden bridges between reed islands, and keep an eye on lotus flowers leading toward the Tide Arch.',
            vi: 'Băng qua cầu gỗ giữa các đảo sậy, và để mắt tới hoa sen dẫn lối về Vòm Thủy Triều.',
          },
          B2: {
            en: 'Timber footbridges span the misty reed channels, while fragrant lotus beds trace clear currents toward the sunken Tide Arch.',
            vi: 'Những nhịp cầu gỗ bắc qua rạch sậy mờ sương, còn thảm sen thơm vạch rõ luồng nước trong hướng về Vòm Thủy Triều.',
          },
        },
        focusWords: ['bridge', 'reed', 'keep an eye on', 'lotus', 'current', 'arch'],
      },
    ],
  },
  {
    id: 'sign_fen_beacon',
    speaker: 'Misty Channel Lantern Post',
    speakerRoleVi: 'Trụ đèn luồng sương',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'world_clue',
    lines: [
      {
        en: 'You trimmed the wick and lit the cedar lantern! Its amber reflection guides reed boats past the southern lotus cove.',
        vi: 'Bạn khêu bấc và thắp sáng ngọn đèn tuyết tùng! Ánh vàng phản chiếu dẫn lối thuyền sậy qua vịnh hoa sen phía nam.',
        focusWords: ['lantern', 'guide', 'reed', 'boat', 'lotus'],
      },
    ],
  },
  {
    id: 'shrine_reedwater',
    speaker: 'Sunken Tide Arch',
    speakerRoleVi: 'Vòm đá thủy triều',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'world_shrine',
    lines: [
      {
        en: 'Cool water laps rhythmically against carved wave motifs. Every ripple echoes across the serene wetland.',
        vi: 'Làn nước mát vỗ nhịp nhàng vào những nét chạm hình sóng. Từng gợn nước vang vọng khắp đầm lầy thanh bình.',
        focusWords: ['cool', 'water', 'rhythm', 'echo', 'serene'],
      },
    ],
  },
  {
    id: 'sign_ridge_entry',
    speaker: 'Canyon Wind Warning Sign',
    speakerRoleVi: 'Biển báo gió hẻm núi',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'world_sign',
    lines: [
      {
        en: 'Watch out for strong updrafts on steep sandstone slopes! Make sure to carry tonics and rest beside the central campfire.',
        vi: 'Hãy coi chừng luồng gió ngược trên sườn đá dốc! Nhớ mang theo thuốc hồi và nghỉ bên bếp lửa trại trung tâm.',
        variants: {
          A1: {
            en: 'Watch out for strong wind on the steep hill! Rest at the middle campfire when your team feels tired.',
            vi: 'Coi chừng gió mạnh trên đồi dốc! Hãy nghỉ ở lửa trại giữa đèo khi cả đội thấm mệt.',
          },
          A2: {
            en: 'Watch out on steep sandy slopes! Make sure to pack extra tonics and rest beside the central campfire.',
            vi: 'Coi chừng trên sườn cát dốc! Nhớ mang thêm thuốc hồi và nghỉ cạnh bếp lửa trung tâm.',
          },
          B2: {
            en: 'Watch out for gusting canyon updrafts along exposed sandstone ledges; replenish vitality at the central windbreak hearth.',
            vi: 'Coi chừng luồng gió lốc hẻm núi dọc các mỏm sa thạch; hãy hồi phục sinh lực tại bếp lửa chắn gió trung tâm.',
          },
        },
        focusWords: ['watch out', 'make sure', 'steep', 'slope', 'tonic', 'rest'],
      },
    ],
  },
  {
    id: 'sign_ancient_kiln',
    speaker: 'Ancient Kiln Tablet',
    speakerRoleVi: 'Bia đá lò gốm cổ',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'world_clue',
    lines: [
      {
        en: 'Inscription: Red clay shaped by patient hands and kindled by steady hearth fire endures a thousand mountain storms.',
        vi: 'Văn bia khắc: Đất sét đỏ nặn bởi đôi tay kiên nhẫn và nung bằng lửa ấm bền bỉ sẽ trường tồn qua ngàn cơn bão núi.',
        focusWords: ['inscription', 'clay', 'patient', 'kindle', 'steady', 'hearth', 'endure', 'storm'],
      },
    ],
  },
  {
    id: 'shrine_terracotta',
    speaker: 'Sunforge Resonance Beacon',
    speakerRoleVi: 'Đài cộng hưởng nắng sớm',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'world_shrine',
    lines: [
      {
        en: 'Polished amber minerals crown this terracotta tower, catching sunlight and projecting warm notes across the ridge.',
        vi: 'Những tinh thể hổ phách mài nhẵn đặt trên đỉnh tháp đất nung, đón ánh mặt trời và ngân vang khắp sống đèo.',
        focusWords: ['mineral', 'sun', 'warm', 'ridge'],
      },
    ],
  },
  {
    id: 'sign_pillar_west',
    speaker: 'West Star Pillar',
    speakerRoleVi: 'Trụ đá sao tây',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'world_clue',
    lines: [
      {
        en: 'First Verse: Walk gently beneath ancient canopies, for humble roots sustain the highest branches.',
        vi: 'Khổ thứ nhất: Hãy bước nhẹ dưới tán rừng cổ thụ, bởi bộ rễ khiêm nhường nuôi dưỡng những cành cao nhất.',
        focusWords: ['walk', 'gentle', 'ancient', 'canopy', 'humble', 'root', 'branch'],
      },
    ],
  },
  {
    id: 'sign_pillar_east',
    speaker: 'East Star Pillar',
    speakerRoleVi: 'Trụ đá sao đông',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'world_clue',
    lines: [
      {
        en: 'Second Verse: Listen to misty tides and canyon gales alike, for diverse elements safeguard natural balance.',
        vi: 'Khổ thứ hai: Hãy lắng nghe cả con nước mờ sương lẫn gió ngàn hẻm núi, vì các nguyên tố đa dạng gìn giữ thế cân bằng.',
        focusWords: ['mist', 'tide', 'canyon', 'gale', 'diverse', 'element', 'safeguard', 'balance'],
      },
    ],
  },
  {
    id: 'sign_pillar_north',
    speaker: 'North Harmony Stele',
    speakerRoleVi: 'Bia đá hòa hợp phương bắc',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'world_clue',
    lines: [
      {
        en: 'Third Verse: True resonance awakens not by force, but through patient trust between traveler and companion.',
        vi: 'Khổ thứ ba: Cộng hưởng đích thực chẳng thức tỉnh nhờ ép buộc, mà nảy nở từ niềm tin kiên nhẫn giữa người và bạn đồng hành.',
        focusWords: ['resonance', 'awaken', 'patient', 'trust', 'companion'],
      },
    ],
  },
  {
    id: 'lore_rowan_elements',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'lore_guide',
    lines: [
      {
        en: 'Our basin holds six combat elements: Leaf beats Water and Stone; Water beats Ember and Stone; Ember beats Leaf and Gale.',
        vi: 'Thung lũng có sáu nguyên tố: Lá thắng Nước và Đá; Nước thắng Lửa và Đá; Lửa thắng Lá và Gió.',
        focusWords: ['basin', 'element', 'leaf', 'water', 'stone', 'ember', 'gale'],
      },
      {
        en: 'Meanwhile, Stone beats Gale and Spark; Gale beats Leaf and Spark; and Spark beats Water and Ember!',
        vi: 'Đồng thời, Đá thắng Gió và Điện; Gió thắng Lá và Điện; còn Điện thắng Nước và Lửa!',
        focusWords: ['stone', 'gale', 'spark', 'water', 'ember'],
      },
    ],
  },
  {
    id: 'lore_linh_study_tips',
    speaker: 'Botanist Linh',
    speakerRoleVi: 'Nhà thực vật học song ngữ',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'lore_guide',
    lines: [
      {
        en: 'Whenever you tap an English word, click Save Word to bookmark it. Later at any campfire, you can practice saved words!',
        vi: 'Mỗi khi chạm vào một từ tiếng Anh, hãy bấm Lưu từ để đánh dấu. Sau đó bên lửa trại, bạn có thể ôn lại các từ đã lưu!',
        focusWords: ['meaning', 'campfire', 'practice'],
      },
    ],
  },
  {
    id: 'logbook_hub_story',
    speaker: 'Camp Logbook: Entry 1',
    speakerRoleVi: 'Nhật ký trại: Trang 1',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'ranger_log',
    lines: [
      {
        en: 'Last autumn, a shy Kindlet wandered into Mosslight Camp during heavy rain and fell asleep beside our dry firewood.',
        vi: 'Mùa thu năm ngoái, một chú Kindlet nhút nhát đi lạc vào Trại Đèn Rêu giữa cơn mưa lớn rồi ngủ quên cạnh đống củi khô.',
        focusWords: ['shy', 'camp', 'rain', 'wood'],
      },
      {
        en: 'By morning, its warm embers helped brew herbal tea for six soaked Rangers!',
        vi: 'Sáng hôm sau, đốm lửa ấm của nó đã giúp đun trà thảo mộc cho sáu kiểm lâm ướt mưa!',
        focusWords: ['morning', 'warm', 'ember', 'herb', 'ranger'],
      },
    ],
  },
  {
    id: 'logbook_forest_story',
    speaker: 'Woodland Logbook: Entry 4',
    speakerRoleVi: 'Nhật ký rừng: Trang 4',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'ranger_log',
    lines: [
      {
        en: 'A fallen pine blocked our footpath after a night gale, until two sturdy Canopyhorns lifted the timber together.',
        vi: 'Một thân thông đổ chắn ngang lối mòn sau trận gió đêm, cho tới khi hai chú Canopyhorn khỏe khoắn cùng nâng khúc gỗ lên.',
        focusWords: ['path', 'night', 'gale', 'sturdy'],
      },
      {
        en: 'We left sweet berries on the mossy stump as thanks for their quiet help.',
        vi: 'Chúng tôi đặt những trái quả mọng ngọt lên gốc cây phủ rêu để cảm ơn sự giúp đỡ thầm lặng ấy.',
        focusWords: ['berry', 'moss', 'help'],
      },
    ],
  },
  {
    id: 'logbook_fen_story',
    speaker: 'Wetland Logbook: Entry 9',
    speakerRoleVi: 'Nhật ký đầm sậy: Trang 9',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'ranger_log',
    lines: [
      {
        en: 'Dense fog hid every wooden bridge at twilight, so Sora whistled a soft three-note melody.',
        vi: 'Sương dày che khuất mọi cây cầu gỗ lúc chạng vạng, nên Sora đã huýt vang giai điệu ba nốt êm dịu.',
        focusWords: ['fog', 'bridge', 'twilight', 'whistle', 'soft'],
      },
      {
        en: 'Within moments, glowing Glimmerfin aligned along the current like floating lanterns.',
        vi: 'Chỉ lát sau, đàn Glimmerfin phát sáng đã xếp hàng dọc dòng nước như những chiếc đèn lồng nổi.',
        focusWords: ['glow', 'align', 'current', 'float', 'lantern'],
      },
    ],
  },
  {
    id: 'logbook_ridge_story',
    speaker: 'Canyon Logbook: Entry 14',
    speakerRoleVi: 'Nhật ký hẻm núi: Trang 14',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'ranger_log',
    lines: [
      {
        en: 'Midday sun baked the steep sandstone ledges, making the ascent exhausting for junior scouts.',
        vi: 'Nắng trưa nung nóng những mỏm đá sa thạch dốc đứng, khiến chặng leo trở nên vất vả với các trinh sát trẻ.',
        focusWords: ['sun', 'steep', 'sand', 'ledge', 'scout'],
      },
      {
        en: 'High overhead, a flock of Zephyrwings glided in wide circles, casting cool shade across our trail.',
        vi: 'Tít trên cao, đàn Zephyrwing sải cánh lượn vòng rộng, tỏa bóng râm mát rượi xuống lối mòn của cả đội.',
        focusWords: ['glide', 'cool', 'shade', 'trail'],
      },
    ],
  },
  {
    id: 'logbook_sanctuary_story',
    speaker: 'Observatory Chronicle: Entry 21',
    speakerRoleVi: 'Biên niên sử đài sao: Trang 21',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'ranger_log',
    lines: [
      {
        en: 'Once each season, clear starlight reflects across the upper pools while Astraloom feathers shimmer in silence.',
        vi: 'Mỗi mùa một lần, ánh sao trong vắt soi bóng xuống mặt hồ thượng nguồn khi lông vũ Astraloom lấp lánh trong tĩnh lặng.',
        focusWords: ['star', 'feather', 'shimmer', 'silent'],
      },
      {
        en: 'Those who listen with calm hearts hear Solacern antlers chime from the northern terrace.',
        vi: 'Người lắng nghe bằng tâm thế bình yên sẽ nghe tiếng gạc pha lê của Solacern ngân vang từ thềm bắc.',
        focusWords: ['calm', 'antler', 'chime', 'terrace'],
      },
    ],
  },
  {
    id: 'lore_biomes_overview',
    speaker: 'Basin Atlas Note',
    speakerRoleVi: 'Ghi chú bản đồ sinh cảnh',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Verdant Basin links five distinct habitats: central camp meadows, mossy oak woods, lotus marshes, red clay cliffs, and starlit ruins.',
        vi: 'Thung Lũng Rêu Xanh nối liền năm sinh cảnh: trảng cỏ trại trung tâm, rừng sồi rêu, đầm sen, vách đất nung và phế tích sao trời.',
        focusWords: ['basin', 'distinct', 'habitat', 'meadow', 'moss', 'lotus', 'marsh', 'clay', 'cliff', 'ruin'],
      },
    ],
  },
  {
    id: 'lore_chime_craft',
    speaker: 'Artisan Note: Resonance Chimes',
    speakerRoleVi: 'Ghi chú nghề làm chuông',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Unlike cages or traps, wooden chimes invite a wild partner to join willingly through gentle acoustic resonance.',
        vi: 'Khác với lồng hay bẫy, chuông gỗ mời gọi bạn hoang dã tự nguyện đồng hành nhờ âm thanh cộng hưởng dịu nhẹ.',
        focusWords: ['wood', 'chime', 'wild', 'partner', 'join', 'gentle', 'resonance'],
      },
    ],
  },
  {
    id: 'lore_day_night_rhythm',
    speaker: 'Naturalist Note: Daily Cycles',
    speakerRoleVi: 'Ghi chú chu kỳ ngày đêm',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Morning brings songbirds like Breezeling, midday warms Sunskink ledges, and dusk awakens Shellglow, Glimmerfin, and Starhoot.',
        vi: 'Buổi sớm gọi chim ca như Breezeling, nắng trưa sưởi mỏm đá Sunskink, còn chiều tối đánh thức Shellglow, Glimmerfin và Starhoot.',
        focusWords: ['morning', 'warm', 'ledge', 'dusk', 'awaken'],
      },
    ],
  },
  {
    id: 'lore_status_tactics',
    speaker: 'Ranger Note: Status Conditions',
    speakerRoleVi: 'Sổ tay trạng thái chiến đấu',
    cefr: 'B2',
    regionId: 'mosslight_hub',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Slumber pauses actions for one or two turns, paralysis slows agility, spores drain vitality, and embers soften physical strikes.',
        vi: 'Giấc ngủ tạm dừng hành động một hai lượt, tê liệt giảm tốc độ, bào tử rút sinh lực, còn vết bỏng làm giảm đòn vật lý.',
        focusWords: ['slumber', 'turn', 'paralyze', 'slow', 'spore', 'vitality', 'ember', 'soften', 'strike'],
      },
    ],
  },
  {
    id: 'lore_herbal_remedies',
    speaker: 'Greenhouse Note: Basin Herbs',
    speakerRoleVi: 'Ghi chú nhà vườn thảo mộc',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Dew Tonic uses cool mint, Orchard Salve blends valley berries, and Sunlit Nectar comes from high canyon blossoms.',
        vi: 'Sương Thảo Dược pha bạc hà mát, Cao Quả Rừng cô từ quả mọng thung lũng, còn Mật Hoa Nắng hái trên vách núi cao.',
        focusWords: ['dew', 'tonic', 'cool', 'salve', 'valley', 'berry', 'nectar', 'canyon'],
      },
    ],
  },
  {
    id: 'lore_sanctuary_pillars',
    speaker: 'Epigraphy Summary',
    speakerRoleVi: 'Tóm lược văn bia cổ',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Roots, tides, gales, and stars form one living circle across the basin observatory.',
        vi: 'Rễ cây, con nước, ngọn gió và vì sao kết thành một vòng tuần hoàn sống động nơi đài quan sát thung lũng.',
        focusWords: ['root', 'tide', 'gale', 'star', 'basin', 'observatory'],
      },
    ],
  },
  {
    id: 'lore_warden_tradition',
    speaker: 'History Note: Regional Wardens',
    speakerRoleVi: 'Lịch sử các Thủ lĩnh vùng',
    cefr: 'B2',
    regionId: 'mosslight_hub',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Sylvan tends ancient timber, Mirella guides wetland ferries, and Kaelen maintains cliffside beacons.',
        vi: 'Sylvan chăm sóc rừng cổ thụ, Mirella dẫn lối đò đầm sậy, còn Kaelen gìn giữ những đài lửa vách núi.',
        focusWords: ['ancient', 'guide', 'ferry', 'cliff', 'beacon'],
      },
    ],
  },
  {
    id: 'lore_campfire_etiquette',
    speaker: 'Trail Etiquette Card',
    speakerRoleVi: 'Quy tắc bên bếp lửa đường rừng',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Always share warm tea with fellow travelers and leave dry kindling stacked neatly inside stone shelters.',
        vi: 'Hãy luôn sẻ chia tách trà ấm cùng bạn đồng hành và xếp gọn củi khô trong những hốc đá trú mưa.',
        focusWords: ['warm', 'stone', 'shelter'],
      },
    ],
  },
  {
    id: 'lore_sound_of_reeds',
    speaker: 'Wetland Acoustic Note',
    speakerRoleVi: 'Ghi chú âm thanh đầm sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Hollow reeds vibrate in evening breezes, teaching Rangers how wind pitch calms startled water creatures.',
        vi: 'Thân sậy rỗng ngân rung trong gió chiều, gợi mở cho kiểm lâm cách dùng âm điệu làm dịu loài thủy sinh giật mình.',
        focusWords: ['hollow', 'reed', 'breeze', 'ranger', 'wind', 'calm', 'water', 'creature'],
      },
    ],
  },
  {
    id: 'lore_kiln_glazes',
    speaker: 'Pottery Craft Note',
    speakerRoleVi: 'Ghi chú men gốm đèo cao',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'Crushed canyon minerals give Amber Charms their warm lustre and clear acoustic ring.',
        vi: 'Khoáng chất nghiền mịn vùng hẻm núi tạo nên ánh sắc ấm áp và tiếng ngân trong trẻo cho Chuông Hổ Phách.',
        focusWords: ['canyon', 'mineral', 'charm', 'warm'],
      },
    ],
  },
  {
    id: 'lore_ward_lanterns',
    speaker: 'Scout Gear Note: Cedar Smoke',
    speakerRoleVi: 'Ghi chú đèn hương tuyết tùng',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'atlas_note',
    lines: [
      {
        en: 'When your team health runs low deep inside tall grass, light a Cedar Lantern for forty-five quiet steps back to camp.',
        vi: 'Khi máu cả đội xuống thấp giữa thảm cỏ rậm, hãy thắp Đèn Tuyết Tùng để có bốn mươi lăm bước yên tĩnh quay về trại.',
        focusWords: ['team', 'health', 'grass', 'lantern', 'camp'],
      },
    ],
  },
  {
    id: 'chat_sylvan_trees',
    speaker: 'Warden Sylvan',
    speakerRoleVi: 'Thủ lĩnh Rừng Thầm',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'warden_chat',
    lines: [
      {
        en: 'Count the rings on a fallen oak trunk to read decades of dry summers and generous autumn rains.',
        vi: 'Đếm vòng gỗ trên thân sồi đổ có thể đọc được hàng chục năm mùa hạ khô hay mùa thu mưa thuận.',
        focusWords: ['tree', 'read', 'rain'],
      },
    ],
  },
  {
    id: 'chat_sylvan_briarpaw',
    speaker: 'Warden Sylvan',
    speakerRoleVi: 'Thủ lĩnh Rừng Thầm',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'warden_chat',
    lines: [
      {
        en: 'My Briarpaw began as a tiny Mosskit who followed me home after a chilly morning drizzle.',
        vi: 'Briarpaw của tôi vốn là một chú Mosskit nhỏ từng lẽo đẽo theo tôi về trại sau cơn mưa phùn buổi sáng.',
        focusWords: ['follow', 'morning', 'rain'],
      },
    ],
  },
  {
    id: 'chat_haru_woodcraft',
    speaker: 'Woodcarver Haru',
    speakerRoleVi: 'Nghệ nhân chuông gỗ',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'artisan_chat',
    lines: [
      {
        en: 'I never cut living branches for chimes. Windfalls after a storm offer seasoned wood with the sweetest tone.',
        vi: 'Tôi không bao giờ chặt cành tươi làm chuông. Cành khô rụng sau cơn giông cho thớ gỗ già với tiếng ngân ngọt nhất.',
        focusWords: ['branch', 'chime', 'storm', 'wood'],
      },
    ],
  },
  {
    id: 'chat_elena_scouting',
    speaker: 'Scout Elena',
    speakerRoleVi: 'Kiểm lâm trẻ Elena',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'scout_chat',
    lines: [
      {
        en: 'Writing short English trail notes every morning helped me remember plant names without boring drills.',
        vi: 'Viết vài dòng ghi chú đường rừng bằng tiếng Anh mỗi sáng giúp mình nhớ tên cây cối tự nhiên không nhàm chán.',
        focusWords: ['trail', 'morning', 'memory'],
      },
    ],
  },
  {
    id: 'chat_mirella_tides',
    speaker: 'Warden Mirella',
    speakerRoleVi: 'Thủ lĩnh Đầm Sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'warden_chat',
    lines: [
      {
        en: 'Even murky floodwater clears when we give wetland roots and lotus beds enough room to breathe.',
        vi: 'Ngay cả dòng nước lũ đục ngầu cũng lắng trong khi ta dành đủ không gian cho rễ cây và đầm sen thở.',
        focusWords: ['murky', 'water', 'root', 'lotus'],
      },
    ],
  },
  {
    id: 'chat_mirella_brookotter',
    speaker: 'Warden Mirella',
    speakerRoleVi: 'Thủ lĩnh Đầm Sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'warden_chat',
    lines: [
      {
        en: 'Brookotter tests every wooden bridge plank each morning before travelers cross the fen.',
        vi: 'Brookotter kiểm tra từng tấm ván cầu gỗ mỗi sáng trước khi khách bộ hành băng qua đầm sậy.',
        focusWords: ['wood', 'bridge', 'morning', 'cross'],
      },
    ],
  },
  {
    id: 'chat_sora_reeds',
    speaker: 'Ferrywoman Sora',
    speakerRoleVi: 'Người chèo đò sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'artisan_chat',
    lines: [
      {
        en: 'Harvested autumn reeds dry light yet strong, letting flat boats glide over shallow lily beds.',
        vi: 'Sậy thu hoạch mùa thu phơi khô vừa nhẹ vừa dai, giúp thuyền đáy bằng lướt êm trên thảm súng cạn.',
        focusWords: ['reed', 'strong', 'boat', 'glide', 'shallow'],
      },
    ],
  },
  {
    id: 'chat_noah_fishing',
    speaker: 'Angler Noah',
    speakerRoleVi: 'Người gác suối Noah',
    cefr: 'A2',
    regionId: 'reedwater_fen',
    contextTag: 'scout_chat',
    lines: [
      {
        en: 'I sit on the dock just to watch Glimmerfin shimmer beneath cool ripples at sunset.',
        vi: 'Mình ngồi trên bến gỗ chỉ để ngắm đàn Glimmerfin lấp lánh dưới làn nước mát lúc chiều tà.',
        focusWords: ['dock', 'shimmer', 'cool', 'water'],
      },
    ],
  },
  {
    id: 'chat_kaelen_kilns',
    speaker: 'Warden Kaelen',
    speakerRoleVi: 'Thủ lĩnh Đèo Đất Nung',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'warden_chat',
    lines: [
      {
        en: 'Fierce heat cracks hasty clay, yet steady warmth turns humble earth into durable terracotta.',
        vi: 'Lửa gắt làm nứt đất vội, nhưng hơi ấm đều đặn lại biến đất sét bình dị thành gốm nung bền bỉ.',
        focusWords: ['fierce', 'clay', 'steady', 'warm', 'humble', 'durable'],
      },
    ],
  },
  {
    id: 'chat_kaelen_cinderfox',
    speaker: 'Warden Kaelen',
    speakerRoleVi: 'Thủ lĩnh Đèo Đất Nung',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'warden_chat',
    lines: [
      {
        en: 'Cinderfox scouts steep cliff ledges ahead of rockfalls and barks a sharp warning echo.',
        vi: 'Cinderfox dò đường trên các mỏm vách dốc trước khi có đá lăn và sủa vang tiếng báo hiệu dứt khoát.',
        focusWords: ['scout', 'steep', 'cliff', 'ledge', 'sharp', 'echo'],
      },
    ],
  },
  {
    id: 'chat_amara_glaze',
    speaker: 'Potter Amara',
    speakerRoleVi: 'Nghệ nhân gốm cổ',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'artisan_chat',
    lines: [
      {
        en: 'Every chime bell carries a slightly distinct pitch depending on the canyon mineral blend.',
        vi: 'Mỗi quả chuông gốm mang một cao độ riêng biệt tùy theo tỷ lệ khoáng chất vùng hẻm núi.',
        focusWords: ['chime', 'distinct', 'canyon', 'mineral'],
      },
    ],
  },
  {
    id: 'chat_diego_winds',
    speaker: 'Mountaineer Diego',
    speakerRoleVi: 'Trinh sát núi cao Diego',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'scout_chat',
    lines: [
      {
        en: 'Morning air stays calm for climbing, while afternoon gales favor swift winged partners.',
        vi: 'Không khí buổi sáng êm ả rất hợp leo vách, còn gió mạnh buổi chiều lại nâng bước các loài có cánh.',
        focusWords: ['morning', 'calm', 'climb', 'gale', 'swift', 'wing'],
      },
    ],
  },
  {
    id: 'chat_astraea_stars',
    speaker: 'Elder Keeper Astraea',
    speakerRoleVi: 'Trưởng lão hộ vệ',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'warden_chat',
    lines: [
      {
        en: 'Generations of naturalists climbed these stone terraces not to conquer nature, but to listen.',
        vi: 'Nhiều thế hệ nhà tự nhiên đã bước lên những thềm đá này không phải để chinh phục, mà để lắng nghe thiên nhiên.',
        focusWords: ['climb', 'stone', 'terrace'],
      },
    ],
  },
  {
    id: 'chat_lyra_language',
    speaker: 'Archivist Lyra',
    speakerRoleVi: 'Học giả văn bia',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'artisan_chat',
    lines: [
      {
        en: 'Language lives best on open trails, where every word connects to a real stream, branch, or companion.',
        vi: 'Ngôn ngữ sống động nhất trên những cung đường mở, nơi mỗi từ gắn liền với con suối, nhành cây hay người bạn thật.',
        focusWords: ['trail', 'stream', 'branch', 'companion'],
      },
    ],
  },
  {
    id: 'chat_orin_nightwatch',
    speaker: 'Starwatcher Orin',
    speakerRoleVi: 'Người gác đài sao Orin',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'scout_chat',
    lines: [
      {
        en: 'On cloudless nights, constellations mirror the exact layout of our five basin camps and shrines.',
        vi: 'Vào những đêm quang mây, các chòm sao phản chiếu đúng vị trí của năm khu trại và đài đá trong thung lũng.',
        focusWords: ['cloud', 'night', 'constellation', 'basin', 'camp', 'shrine'],
      },
    ],
  },
  {
    id: 'journal_tale_01',
    speaker: 'Expedition Tale: First Rain',
    speakerRoleVi: 'Chuyện thực địa: Cơn Mưa Đầu Mùa',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Warm tea tastes best under a dry wooden roof while cool rain taps on green leaves.',
        vi: 'Trà ấm ngon nhất là khi ngồi dưới mái gỗ khô ráo nghe mưa mát gõ nhịp trên vòm lá xanh.',
        focusWords: ['warm', 'wood', 'cool', 'rain', 'leaf'],
      },
    ],
  },
  {
    id: 'journal_tale_02',
    speaker: 'Expedition Tale: Bridge Builders',
    speakerRoleVi: 'Chuyện thực địa: Nhịp Cầu Qua Suối',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Three scouts tied sturdy ropes across the brook so children from camp could pick berries safely.',
        vi: 'Ba trinh sát đã chăng dây thừng chắc chắn qua khe suối để trẻ nhỏ trong trại sang hái quả mọng an toàn.',
        focusWords: ['scout', 'sturdy', 'rope', 'brook', 'camp', 'berry', 'safe'],
      },
    ],
  },
  {
    id: 'journal_tale_03',
    speaker: 'Expedition Tale: Lantern Boats',
    speakerRoleVi: 'Chuyện thực địa: Thuyền Đèn Đầm Sen',
    cefr: 'A2',
    regionId: 'reedwater_fen',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Every autumn dusk, reed boats carry paper lanterns across the pond to thank wetland guardians.',
        vi: 'Mỗi chiều thu, những chiếc thuyền sậy lại chở đèn giấy trôi qua mặt hồ để tri ân các loài hộ vệ đầm lầy.',
        focusWords: ['dusk', 'reed', 'boat', 'lantern', 'pond', 'guardian'],
      },
    ],
  },
  {
    id: 'journal_tale_04',
    speaker: 'Expedition Tale: Echo Canyon',
    speakerRoleVi: 'Chuyện thực địa: Hẻm Núi Vang Âm',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Whistle one clear note beside the southern cliff and five gentle echoes return from distant ridges.',
        vi: 'Chỉ cần huýt một nốt trong trẻo bên vách đá phía nam, năm tiếng ngân dịu sẽ vọng về từ những rặng đèo xa.',
        focusWords: ['whistle', 'south', 'cliff', 'gentle', 'echo', 'distant', 'ridge'],
      },
    ],
  },
  {
    id: 'journal_tale_05',
    speaker: 'Expedition Tale: Mossy Compass',
    speakerRoleVi: 'Chuyện thực địa: La Bàn Rêu Xanh',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Thick damp moss prefers the shaded northern side of tree trunks, offering hikers a natural clue.',
        vi: 'Lớp rêu dày ẩm thường mọc ở mặt bắc râm mát của thân cây, mang lại manh mối định hướng tự nhiên.',
        focusWords: ['damp', 'moss', 'shade', 'north', 'tree', 'clue'],
      },
    ],
  },
  {
    id: 'journal_tale_06',
    speaker: 'Expedition Tale: Pebble Cairns',
    speakerRoleVi: 'Chuyện thực địa: Tháp Sỏi Dẫn Đường',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Climbers stack three flat pebbles on windy ledges to mark safe footholds toward the summit.',
        vi: 'Người leo núi xếp ba viên sỏi dẹt trên mỏm đá lộng gió để đánh dấu điểm đặt chân an toàn lên đỉnh.',
        focusWords: ['climb', 'pebble', 'wind', 'ledge', 'safe', 'summit'],
      },
    ],
  },
  {
    id: 'journal_tale_07',
    speaker: 'Expedition Tale: Starlight Dew',
    speakerRoleVi: 'Chuyện thực địa: Giọt Sương Ánh Sao',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Botanists collect pure morning dew from sanctuary lotus petals to brew rare restorative tonics.',
        vi: 'Các nhà thực vật thu hứng sương mai tinh khiết trên cánh sen thánh địa để pha chế thuốc bồi bổ quý hiếm.',
        focusWords: ['collect', 'pure', 'morning', 'dew', 'sanctuary', 'lotus', 'rare', 'tonic'],
      },
    ],
  },
  {
    id: 'journal_tale_08',
    speaker: 'Expedition Tale: Winter Hearth',
    speakerRoleVi: 'Chuyện thực địa: Bếp Lửa Mùa Đông',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Even when frost dusts the high peaks, Mosslight hearth stays warm for travelers and wild foxes alike.',
        vi: 'Ngay cả khi sương giá phủ mờ đỉnh cao, bếp lửa Đèn Rêu vẫn luôn ấm áp đón cả lữ khách lẫn đàn cáo rừng.',
        focusWords: ['peak', 'hearth', 'warm', 'wild', 'fox'],
      },
    ],
  },
  {
    id: 'journal_tale_09',
    speaker: 'Expedition Tale: Patient Angler',
    speakerRoleVi: 'Chuyện thực địa: Người Ngồi Bên Bến',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Noah once waited four quiet hours in mist just to sketch a Lotusbell blossom opening.',
        vi: 'Noah từng ngồi đợi bốn tiếng yên tĩnh giữa màn sương chỉ để ký họa khoảnh khắc hoa trên lưng Lotusbell bung nở.',
        focusWords: ['patient', 'mist', 'bloom'],
      },
    ],
  },
  {
    id: 'journal_tale_10',
    speaker: 'Expedition Tale: Winged Mail',
    speakerRoleVi: 'Chuyện thực địa: Cánh Chim Đưa Thư',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'Trained Zephyrwings carry rolled parchment notes from hilltop outposts back to Ranger Rowan in minutes.',
        vi: 'Những chú Zephyrwing quen đường mang cuộn giấy ghi chép từ trạm đồi cao về cho Rowan chỉ trong vài phút.',
        focusWords: ['hill', 'ranger'],
      },
    ],
  },
  {
    id: 'journal_tale_11',
    speaker: 'Expedition Tale: Harmony Festival',
    speakerRoleVi: 'Chuyện thực địa: Lễ Hội Hòa Hợp',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'When all four regions celebrate together, wooden chimes and clay bells ring from dusk until dawn.',
        vi: 'Khi cả bốn vùng cùng mở hội chúc mừng, chuông gỗ và chuông đất nung ngân vang suốt từ chiều tối tới bình minh.',
        focusWords: ['celebrate', 'wood', 'chime', 'clay', 'dusk'],
      },
    ],
  },
  {
    id: 'journal_tale_12',
    speaker: 'Expedition Tale: Quiet Fellowship',
    speakerRoleVi: 'Chuyện thực địa: Tình Bạn Lặng Thầm',
    cefr: 'B2',
    regionId: 'mosslight_hub',
    contextTag: 'journal_tale',
    lines: [
      {
        en: 'You never need perfect grammar to be understood by a loyal partner; kindness speaks first.',
        vi: 'Bạn chẳng cần ngữ pháp hoàn hảo mới được người bạn đồng hành trung thành thấu hiểu, vì sự tử tế luôn lên tiếng trước.',
        focusWords: ['loyal', 'partner'],
      },
    ],
  },
  {
    id: 'overlook_hub_brook',
    speaker: 'South Brook Overlook',
    speakerRoleVi: 'Điểm ngắm suối phía nam',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'overlook_brook',
    lines: [
      {
        en: 'Clear spring water flows beneath the wooden bridge while moored boats bob gently along the grassy bank.',
        vi: 'Làn nước suối nguồn trong vắt chảy dưới chân cầu gỗ trong khi chiếc thuyền neo khẽ dập dềnh ven bờ cỏ.',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Clear water flows under the wood bridge. Take your time and catch your breath beside the quiet river.',
            vi: 'Nước trong chảy dưới cầu gỗ. Cứ thong thả dừng chân nghỉ lấy hơi bên dòng suối êm.',
          },
          B1: {
            en: 'Cool spring water ripples past lily pads beneath the footbridge, offering a peaceful spot to catch your breath before setting out.',
            vi: 'Nước suối mát gợn lăn tăn qua thảm súng dưới cầu gỗ, mở ra góc bình yên để bạn nghỉ lấy hơi trước khi lên đường.',
          },
          B2: {
            en: 'Crystal spring currents wind past wildflower banks toward the southern rope lift, inviting travelers to pause and reflect.',
            vi: 'Dòng nước nguồn trong trẻo uốn quanh bờ hoa dại hướng về thang dây phía nam, mời gọi lữ khách dừng chân suy ngẫm.',
          },
        },
        focusWords: ['clear', 'spring', 'bridge', 'boat', 'catch your breath'],
      },
    ],
  },
  {
    id: 'overlook_whisperwood',
    speaker: 'Fern Glade Overlook',
    speakerRoleVi: 'Điểm quan sát trảng dương xỉ',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'overlook_forest',
    lines: [
      {
        en: 'From this mossy rise, sunlit oak canopies stretch west toward the Whispering Stone while songbirds glide along the breeze.',
        vi: 'Từ gò rêu cao này, vòm sồi đón nắng trải dài về phía tây hướng tới Đá Sồi Thầm khi đàn chim lướt nhẹ theo làn gió.',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Tall green trees shine in the morning light. Keep an eye on shy forest friends moving in the grass below.',
            vi: 'Những hàng cây xanh cao đón ánh nắng sớm. Hãy để mắt tới những người bạn nhỏ đang nhúc nhích dưới thảm cỏ.',
          },
          B1: {
            en: 'Filtered light dances over rough oak bark and swaying fern clearings; patient scouts often spot rare beetles here at dusk.',
            vi: 'Ánh sáng xuyên tán nhảy múa trên vỏ sồi sần sùi và trảng dương xỉ; trinh sát kiên nhẫn thường gặp loài cánh cứng quý lúc chiều tối.',
          },
          B2: {
            en: 'Layered woodland canopies shelter winding trails below, demonstrating how ancient timber and humble moss thrive in balance.',
            vi: 'Tầng tán rừng xếp lớp che mát lối mòn uốn lượn bên dưới, cho thấy cổ thụ và rêu nhỏ cùng sinh sôi hài hòa.',
          },
        },
        focusWords: ['moss', 'canopy', 'glide', 'breeze', 'in balance'],
      },
    ],
  },
  {
    id: 'overlook_reedwater',
    speaker: 'Lotus Basin Overlook',
    speakerRoleVi: 'Vọng cảnh đầm hoa sen',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'overlook_fen',
    lines: [
      {
        en: 'Silver mist drifts across shallow lotus channels while reed boats pass quietly between lantern piers.',
        vi: 'Màn sương bạc trôi nhẹ qua những rạch sen nông trong khi thuyền sậy lướt êm giữa các bến đèn.',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Soft mist floats above the pond water. Small reed boats pass under the wood bridges.',
            vi: 'Màn sương nhẹ trôi trên mặt hồ. Những chiếc thuyền sậy nhỏ đi qua dưới gầm cầu gỗ.',
          },
          A2: {
            en: 'Cool mist covers the lotus pond, and light reed boats pass safely beside glowing lanterns.',
            vi: 'Sương mát phủ mặt đầm sen, và những chiếc thuyền sậy nhẹ nhàng lướt an toàn bên ánh đèn lồng.',
          },
          B2: {
            en: 'Evening mist veils the tranquil wetland labyrinth, where bioluminescent minnows trace gentle currents beneath timber bridges.',
            vi: 'Sương chiều phủ mờ mê cung đầm lầy tĩnh lặng, nơi đàn cá phát sáng vẽ theo luồng nước dịu dưới nhịp cầu gỗ.',
          },
        },
        focusWords: ['mist', 'lotus', 'reed', 'boat', 'pass', 'current'],
      },
    ],
  },
  {
    id: 'overlook_terracotta',
    speaker: 'Canyon Crest Overlook',
    speakerRoleVi: 'Mỏm đá ngắm toàn cảnh hẻm núi',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'overlook_ridge',
    lines: [
      {
        en: 'Warm canyon winds sweep past red clay terraces toward the high summit pass. Take a moment to catch your breath!',
        vi: 'Gió ấm hẻm núi thổi qua những bậc thềm đất sét đỏ hướng lên đèo đỉnh núi. Hãy dừng lại nghỉ lấy hơi đôi chút!',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Warm wind blows across the red stone hill. Rest here and look at the high mountain pass.',
            vi: 'Gió ấm thổi qua sườn đồi đá đỏ. Hãy dừng chân tại đây và ngắm lối đèo cao.',
          },
          A2: {
            en: 'Warm sunlight shines on red clay cliffs. Catch your breath here before walking up the summit pass.',
            vi: 'Nắng ấm chiếu rọi vách đất sét đỏ. Hãy nghỉ lấy hơi tại đây trước khi bước lên đèo cao.',
          },
          B2: {
            en: 'Sun-baked ochre cliffs descend into terraced pottery kilns below, while soaring falcons ride thermal updrafts toward the summit pass.',
            vi: 'Vách đá vàng đất đón nắng đổ dài xuống khu lò gốm cổ bên dưới, trong khi đàn chim ưng cưỡi luồng khí ấm bay về phía đèo cao.',
          },
        },
        focusWords: ['warm', 'canyon', 'clay', 'pass', 'catch your breath'],
      },
    ],
  },
  {
    id: 'overlook_starfall',
    speaker: 'Celestial Terrace Overlook',
    speakerRoleVi: 'Thềm sao ngắm toàn thung lũng',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'overlook_sanctuary',
    lines: [
      {
        en: 'All four regions of Verdant Basin gleam far below beneath clear starlight, united side by side in quiet harmony.',
        vi: 'Cả bốn vùng của Thung Lũng Rêu Xanh ánh lên phía xa dưới bầu trời sao trong vắt, gắn kết hài hòa trong tĩnh lặng.',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'You can see the whole green valley under clear starlight! Every forest, river, and hill stands in balance.',
            vi: 'Bạn có thể nhìn thấy trọn thung lũng xanh dưới ánh sao trong! Rừng cây, dòng sông và ngọn đồi đều hài hòa.',
          },
          A2: {
            en: 'Clear starlight shines over the whole valley below. Take your time enjoying how every habitat stays in balance.',
            vi: 'Ánh sao trong sáng chiếu khắp thung lũng bên dưới. Cứ thong thả ngắm nhìn mọi sinh cảnh chung sống cân bằng.',
          },
          B1: {
            en: 'From this high stone terrace, clear starlight reveals woods, marshes, and canyon ridges thriving together in balance.',
            vi: 'Từ thềm đá cao này, ánh sao trong vắt soi tỏ rừng xanh, đầm sậy và rặng đèo cùng trù phú trong thế cân bằng.',
          },
        },
        focusWords: ['basin', 'clear', 'harmony', 'in balance'],
      },
    ],
  },
  {
    id: 'trace_whisperwood_shellglow',
    speaker: 'Habitat Trace: Whisperwood',
    speakerRoleVi: 'Dấu vết sinh cảnh Rừng Thầm',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'habitat_trace',
    lines: [
      {
        en: 'Wait a second! Pale green dust glows on this damp fallen log. A shy Shellglow rested here not long ago!',
        vi: 'Chờ chút nào! Lớp bụi xanh nhạt đang phát sáng trên thân gỗ ẩm này. Một chú Shellglow nhút nhát vừa nghỉ chân tại đây cách đây không lâu!',
        variants: {
          A1: {
            en: 'Look closely! Soft green light shines on this wet log. Shy Shellglow likes to rest here at dusk!',
            vi: 'Nhìn kỹ này! Ánh sáng xanh dịu lấp lánh trên khúc gỗ ẩm. Shellglow nhút nhát rất thích nghỉ ở đây lúc chiều tối!',
          },
          B2: {
            en: 'Notice the faint bioluminescent dust clinging to this mossy log! Shellglow and rare gleaming woodland Wildkin gather nearby at dusk.',
            vi: 'Hãy chú ý lớp bụi phát quang mờ bám trên thân gỗ phủ rêu! Shellglow và biến thể Ánh Sao quý hiếm thường tụ họp quanh đây lúc chạng vạng.',
          },
        },
        focusWords: ['wait', 'glow', 'damp', 'shy', 'at dusk'],
      },
      {
        en: 'Recording this habitat trace sharpens your scouting instinct, making rare and gleaming encounters easier to spot in Whisperwood!',
        vi: 'Ghi chép dấu vết sinh cảnh này giúp tăng độ nhạy quan sát, giúp bạn dễ bắt gặp loài hiếm và biến thể Ánh Sao hơn tại Rừng Thầm!',
        focusWords: ['habitat', 'instinct', 'rare'],
      },
    ],
  },
  {
    id: 'trace_fen_lotusbell',
    speaker: 'Habitat Trace: Reedwater',
    speakerRoleVi: 'Dấu vết sinh cảnh Đầm Sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'habitat_trace',
    lines: [
      {
        en: 'Tiny golden ripples circle a floating lotus leaf up ahead! Glimmerfin and wetland frogs gather where fresh currents meet.',
        vi: 'Những gợn nước ánh vàng xoay tròn quanh tàu lá sen phía trước! Glimmerfin và ếch đầm lầy thường tụ hội nơi hai luồng nước sạch giao nhau.',
        variants: {
          A1: {
            en: 'Look up ahead! Bright ripples circle a pink lotus leaf. Glimmerfin loves to swim here at night!',
            vi: 'Nhìn phía trước kìa! Những gợn nước sáng xoay quanh lá sen hồng. Glimmerfin rất thích bơi ở đây vào ban đêm!',
          },
          B2: {
            en: 'Delicate golden ripples ring a floating lotus pad up ahead, revealing where Glimmerfin schools feed beneath evening mist.',
            vi: 'Những gợn nước vàng mảnh khảnh lan quanh lá sen phía trước, tiết lộ nơi đàn Glimmerfin kiếm ăn dưới làn sương chiều.',
          },
        },
        focusWords: ['up ahead', 'lotus', 'current', 'mist'],
      },
      {
        en: 'With this wetland trace logged in your journal, rare and gleaming marsh partners appear more often along the reed beds!',
        vi: 'Sau khi lưu dấu vết đầm lầy này vào sổ tay, các loài hiếm và biến thể Ánh Sao sẽ xuất hiện thường xuyên hơn dọc bãi sậy!',
        focusWords: ['journal', 'rare', 'reed'],
      },
    ],
  },
  {
    id: 'trace_ridge_flarecrest',
    speaker: 'Habitat Trace: Terracotta',
    speakerRoleVi: 'Dấu vết sinh cảnh Đèo Đất Nung',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'habitat_trace',
    lines: [
      {
        en: 'Warm amber feathers and claw marks line this sunny sandstone ledge! No wonder canyon scouts look up before climbing.',
        vi: 'Những chiếc lông màu hổ phách ấm áp và vết móng in dọc mỏm sa thạch đầy nắng! Thảo nào trinh sát hẻm núi luôn ngước nhìn trước khi leo.',
        focusWords: ['warm', 'feather', 'ledge', 'no wonder', 'climb'],
      },
      {
        en: 'Tracking this ridge clue helps you figure out updraft routes, boosting rare and gleaming encounters across Terracotta Ridge!',
        vi: 'Lần theo manh mối này giúp bạn nắm bắt luồng gió bốc, tăng cơ hội gặp loài hiếm và biến thể Ánh Sao khắp Đèo Đất Nung!',
        focusWords: ['clue', 'figure out', 'rare', 'ridge'],
      },
    ],
  },
  {
    id: 'trace_sanctuary_solacern',
    speaker: 'Habitat Trace: Starfall',
    speakerRoleVi: 'Dấu vết sinh cảnh Thánh Địa',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'habitat_trace',
    lines: [
      {
        en: 'Crystalline hoofprints shimmer beside the starlit pool, humming a serene chord that makes sense of old observatory legends!',
        vi: 'Những dấu chân pha lê lấp lánh bên hồ sao trời, ngân lên hợp âm thanh bình làm sáng tỏ bao truyền thuyết cổ nơi đài quan sát!',
        focusWords: ['shimmer', 'serene', 'make sense', 'legend'],
      },
      {
        en: 'Attuning to Solacern footprints deepens your bond with Starfall Sanctuary, drawing rare and gleaming guardians into view!',
        vi: 'Cảm nhận dấu chân của Solacern giúp làm sâu sắc mối gắn kết với Thánh Địa, thu hút các hộ vệ quý hiếm và Ánh Sao xuất hiện!',
        focusWords: ['footprint', 'bond', 'sanctuary', 'rare', 'guardian'],
      },
    ],
  },
];

import type { DialogueNode } from '../domain/types.ts';

export const DIALOGUES_STORY: ReadonlyArray<DialogueNode> = [
  {
    id: 'rowan_intro_choose_starter',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'hub_starter',
    lines: [
      {
        en: 'Welcome to Mosslight Camp! Across our green valley, ancient Resonance Stones have fallen silent, making wild creatures restless.',
        vi: 'Chào mừng tới Trại Đèn Rêu! Khắp thung lũng xanh này, những phiến Đá Cộng Hưởng cổ xưa bỗng lặng tiếng khiến các sinh vật hoang dã bất an.',
        variants: {
          A1: {
            en: 'Welcome to Mosslight Camp! Old magic stones in our green valley grew quiet, so wild creatures feel worried.',
            vi: 'Chào mừng tới Trại Đèn Rêu! Những phiến đá cổ trong thung lũng xanh bỗng im ắng khiến sinh vật hoang lo lắng.',
          },
          A2: {
            en: 'Welcome to Mosslight Camp! Ancient stones across our valley have grown silent, making wild creatures restless along the paths.',
            vi: 'Chào mừng tới Trại Đèn Rêu! Những phiến đá cổ khắp thung lũng bỗng lặng tiếng khiến sinh vật dọc đường bất an.',
          },
          B2: {
            en: 'Welcome to Mosslight Camp! Throughout Verdant Basin, ancient Resonance Stones have fallen silent, leaving wild habitats restless and out of balance.',
            vi: 'Chào mừng tới Trại Đèn Rêu! Khắp Thung Lũng Rêu Xanh, các phiến Đá Cộng Hưởng cổ đã lặng tiếng khiến sinh cảnh xao động mất cân bằng.',
          },
        },
        focusWords: ['camp', 'valley', 'ancient', 'silent', 'restless'],
      },
      {
        en: 'Tap any English word whenever you want its Vietnamese meaning, or switch support modes freely in your Field Journal.',
        vi: 'Hãy chạm vào bất kỳ từ tiếng Anh nào khi muốn xem nghĩa tiếng Việt, hoặc đổi chế độ hỗ trợ tùy ý trong Sổ Thực Địa.',
        focusWords: ['meaning', 'journal', 'help'],
      },
      {
        en: 'Three young partners are eager to walk the trail beside you. Which companion will join your expedition first?',
        vi: 'Ba người bạn nhỏ đang háo hức cùng bạn lên đường. Bạn muốn chọn người bạn đồng hành nào đầu tiên?',
        focusWords: ['partner', 'trail', 'companion', 'expedition'],
        choices: [
          {
            labelEn: 'Mosskit (Leaf Lynx, calm and balanced)',
            labelVi: 'Mosskit (Mèo Lá Rêu, điềm tĩnh và cân bằng)',
            action: { kind: 'choose_starter', speciesId: 'mosskit' },
            nextDialogueId: 'rowan_after_starter_mosskit',
          },
          {
            labelEn: 'Kindlet (Ember Fox, warm and swift)',
            labelVi: 'Kindlet (Cáo Lửa Ấm, nhanh nhẹn và mạnh mẽ)',
            action: { kind: 'choose_starter', speciesId: 'kindlet' },
            nextDialogueId: 'rowan_after_starter_kindlet',
          },
          {
            labelEn: 'Ripplefin (Water Otter, sturdy and steady)',
            labelVi: 'Ripplefin (Rái Cá Suối, dẻo dai và vững vàng)',
            action: { kind: 'choose_starter', speciesId: 'ripplefin' },
            nextDialogueId: 'rowan_after_starter_ripplefin',
          },
        ],
      },
    ],
  },
  {
    id: 'rowan_after_starter_mosskit',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'hub_starter',
    lines: [
      {
        en: 'Mosskit purrs softly and brushes its leafy ear against your hand. You already share a natural bond!',
        vi: 'Mosskit khẽ kêu rừ rừ và cọ chiếc tai xanh lá vào tay bạn. Hai bạn đã sớm có sự gắn kết tự nhiên!',
        focusWords: ['gentle', 'leaf', 'ear', 'bond'],
      },
      {
        en: 'Follow the western footpath into Whisperwood Glen and meet Warden Sylvan beside the Whispering Oak.',
        vi: 'Hãy đi theo lối mòn phía tây sang Thung Lũng Rừng Thầm và gặp Thủ lĩnh Sylvan bên gốc Sồi Thầm.',
        focusWords: ['follow', 'west', 'warden'],
      },
    ],
  },
  {
    id: 'rowan_after_starter_kindlet',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'hub_starter',
    lines: [
      {
        en: 'Kindlet wags its warm tail happily! Its bright spirit will light even the darkest woodland shade.',
        vi: 'Kindlet vẫy chiếc đuôi ấm áp đầy vui sướng! Tinh thần rực sáng của nó sẽ soi tỏ cả bóng rừng rậm rạp.',
        focusWords: ['warm', 'tail', 'shade'],
      },
      {
        en: 'Head west into Whisperwood Glen first, where Ember moves have a strong advantage over forest leaves.',
        vi: 'Trước tiên hãy tiến về phía tây sang Thung Lũng Rừng Thầm, nơi chiêu hệ Lửa rất ưu thế trước lá rừng.',
        focusWords: ['west', 'strong', 'forest'],
      },
    ],
  },
  {
    id: 'rowan_after_starter_ripplefin',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'hub_starter',
    lines: [
      {
        en: 'Ripplefin claps its paws cheerfully! Remember to bond with a Gale or Ember friend in the woods to cover Leaf foes.',
        vi: 'Ripplefin vỗ tay reo vui! Hãy nhớ kết bạn thêm với loài hệ Gió hoặc Lửa trong rừng để khắc chế đối thủ hệ Lá nhé.',
        focusWords: ['bond', 'forest', 'element'],
      },
      {
        en: 'Take the western path into Whisperwood Glen whenever you feel ready to begin.',
        vi: 'Hãy bước theo lối mòn phía tây vào Thung Lũng Rừng Thầm bất cứ khi nào bạn sẵn sàng.',
        focusWords: ['west', 'path', 'ready'],
      },
    ],
  },
  {
    id: 'rowan_guide_whisperwood',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'hub_guidance',
    lines: [
      {
        en: 'Set out west from camp to explore Whisperwood Glen, and head back to any campfire whenever your team grows tired.',
        vi: 'Hãy lên đường về phía tây trại để khám phá Rừng Thầm, và quay lại lửa trại bất cứ khi nào đội thấm mệt.',
        variants: {
          A1: {
            en: 'Walk west from camp to see Whisperwood Glen. Rest at any warm campfire if your team feels tired.',
            vi: 'Đi về phía tây trại để thăm Rừng Thầm. Hãy nghỉ bên bếp lửa ấm nếu đội bạn thấy mệt.',
          },
          B1: {
            en: 'Set out along the western trail into Whisperwood Glen, and keep an eye on your partner health before meeting Warden Sylvan.',
            vi: 'Hãy khởi hành theo lối mòn phía tây vào Rừng Thầm, đồng thời để mắt tới máu của đồng hành trước khi gặp Sylvan.',
          },
          B2: {
            en: 'Venture west into Whisperwood Glen to investigate the silent oak monolith, resting beside woodland hearths whenever vitality runs low.',
            vi: 'Hãy tiến về phía tây vào Rừng Thầm khảo sát khối đá sồi lặng tiếng, nghỉ bên bếp rừng mỗi khi sinh lực vơi dần.',
          },
        },
        focusWords: ['set out', 'explore', 'head back', 'rest', 'tired'],
        choices: [
          {
            labelEn: 'Ask about element strengths',
            labelVi: 'Hỏi về quy tắc khắc hệ',
            nextDialogueId: 'lore_rowan_elements',
          },
          {
            labelEn: 'Continue expedition',
            labelVi: 'Tiếp tục lên đường',
          },
        ],
      },
    ],
  },
  {
    id: 'rowan_guide_fen',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'hub_guidance',
    lines: [
      {
        en: 'Well done harmonizing the Whispering Oak! With Sylvan ferry token, the eastern dock to Reedwater Fen is open.',
        vi: 'Bạn đã khôi phục Sồi Thầm rất xuất sắc! Có thẻ đò của Sylvan, bến thuyền phía đông sang Đầm Sậy đã mở.',
        variants: {
          A1: {
            en: 'Great job in the forest! Now the east boat dock to Reedwater Fen is open for your team.',
            vi: 'Bạn làm tốt lắm ở trong rừng! Giờ bến thuyền phía đông sang Đầm Sậy đã mở đón đội bạn.',
          },
          B2: {
            en: 'Splendid work restoring resonance to Whisperwood! Sylvan token now grants passage across the eastern dock into misty Reedwater Fen.',
            vi: 'Bạn khôi phục cộng hưởng cho Rừng Thầm rất tuyệt! Thẻ của Sylvan nay mở lối qua bến đông vào Đầm Sậy mờ sương.',
          },
        },
        focusWords: ['harmony', 'ferry', 'dock', 'open'],
      },
      {
        en: 'Leaf and Spark partners thrive against Mirella wetland team. Make sure to pack tonics and Reed Charms before crossing.',
        vi: 'Đồng hành hệ Lá và Tia chớp rất mạnh trước đội hình đầm lầy của Mirella. Nhớ chuẩn bị thuốc hồi và Chuông Sậy nhé.',
        focusWords: ['thrive', 'make sure', 'tonic', 'cross'],
      },
    ],
  },
  {
    id: 'rowan_guide_ridge',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'hub_guidance',
    lines: [
      {
        en: 'Two Resonance Stones sing again! Mirella climbing rope unlocks the southern lift up to Terracotta Ridge.',
        vi: 'Hai phiến Đá Cộng Hưởng đã ngân vang trở lại! Dây leo của Mirella đã mở thang dây phía nam lên Đèo Đất Nung.',
        variants: {
          A1: {
            en: 'Two magic stones sing again! Use the south rope lift to climb up to sunny Terracotta Ridge.',
            vi: 'Hai phiến đá đã ngân vang trở lại! Hãy đi thang dây phía nam để leo lên Đèo Đất Nung đầy nắng.',
          },
          A2: {
            en: 'Two stones resonate now! Mirella strong rope opens the south path up to Terracotta Ridge.',
            vi: 'Hai phiến đá đã cộng hưởng! Dây thừng chắc của Mirella đã mở lối phía nam lên Đèo Đất Nung.',
          },
        },
        focusWords: ['resonance', 'climb', 'rope', 'ridge'],
      },
      {
        en: 'Water partners quench both Stone and Ember foes along those sunny canyon cliffs.',
        vi: 'Bạn đồng hành hệ Nước khắc chế cả đối thủ hệ Đá lẫn Lửa trên những vách hẻm núi nắng gắt đó.',
        focusWords: ['quench', 'canyon', 'cliff'],
      },
    ],
  },
  {
    id: 'rowan_guide_sanctuary',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'hub_guidance',
    lines: [
      {
        en: 'All three regional beacons shine in unison! Pass through the northern stone arch to ascend Starfall Sanctuary.',
        vi: 'Cả ba đài cộng hưởng vùng đã cùng tỏa sáng! Hãy bước qua cổng đá phía bắc để tiến lên Thánh Địa Sao Rơi.',
        variants: {
          A1: {
            en: 'All three beacons shine bright! Walk north through the stone gate to reach Starfall Sanctuary.',
            vi: 'Cả ba đài đá đều sáng rực! Hãy đi về phía bắc qua cổng đá để lên Thánh Địa Sao Rơi.',
          },
          B2: {
            en: 'All three regional beacons resonate in unison! Ascend through the northern stone arch to enter ancient Starfall Sanctuary.',
            vi: 'Cả ba đài cộng hưởng vùng đã ngân vang đồng điệu! Hãy bước qua vòm đá phía bắc để tiến vào Thánh Địa Sao Rơi cổ kính.',
          },
        },
        focusWords: ['beacon', 'pass', 'arch', 'ascend', 'sanctuary'],
      },
      {
        en: 'Elder Keeper Astraea awaits beside the Celestial Altar. Stock your best salves and Breeze Tea first.',
        vi: 'Trưởng lão Astraea đang đợi bên Bệ Đá Tinh Tú. Hãy chuẩn bị sẵn cao thảo dược và Trà Gió Ngàn trước nhé.',
        focusWords: ['altar', 'salve', 'ready'],
      },
    ],
  },
  {
    id: 'rowan_epilogue_celebration',
    speaker: 'Ranger Rowan',
    speakerRoleVi: 'Trưởng đoàn nghiên cứu',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'hub_epilogue',
    lines: [
      {
        en: 'Listen to the wind across Verdant Basin! Because of your fellowship, peace and balance have returned to every habitat.',
        vi: 'Hãy lắng nghe tiếng gió khắp Thung Lũng Rêu Xanh! Nhờ tình bằng hữu của bạn, sự bình yên và cân bằng đã trở lại.',
        focusWords: ['fellowship', 'peaceful', 'balance', 'habitat'],
      },
      {
        en: 'Feel free to roam all four regions, bond with all thirty Wildkin species, and enjoy quiet campfire reviews anytime!',
        vi: 'Bạn có thể tự do dạo bước khắp bốn vùng, kết bạn trọn ba mươi loài sinh vật và ôn từ bên lửa trại bất cứ lúc nào!',
        focusWords: ['roam', 'species', 'practice'],
      },
    ],
  },
  {
    id: 'linh_intro_herbarium',
    speaker: 'Botanist Linh',
    speakerRoleVi: 'Nhà thực vật học song ngữ',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'npc_linh',
    lines: [
      {
        en: 'Hello traveler! I compile our bilingual Field Compendium so nobody ever feels stuck because of unfamiliar English words.',
        vi: 'Chào người lữ hành! Mình biên soạn cuốn Bách khoa song ngữ để không ai bị kẹt lại chỉ vì gặp từ tiếng Anh lạ.',
        focusWords: ['compendium', 'meaning', 'help'],
      },
      {
        en: 'Could you help me observe at least five distinct Wildkin species out in the wild? I will share fresh herbal remedies!',
        vi: 'Bạn giúp mình quan sát ít nhất năm loài sinh vật khác nhau ngoài tự nhiên nhé? Mình sẽ tặng thảo dược mới hái!',
        focusWords: ['observe', 'distinct', 'species', 'remedy'],
        action: { kind: 'start_quest', questId: 'q03_field_herbarium' },
      },
    ],
  },
  {
    id: 'linh_herbarium_progress',
    speaker: 'Botanist Linh',
    speakerRoleVi: 'Nhà thực vật học song ngữ',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'npc_linh',
    lines: [
      {
        en: 'Explore tall grass in Whisperwood Glen to meet new species. Even spotting a wild creature counts toward five discoveries!',
        vi: 'Hãy khám phá thảm cỏ cao ở Rừng Thầm để gặp loài mới. Chỉ cần chạm trán ngoài tự nhiên cũng được tính vào năm loài!',
        focusWords: ['explore', 'grass', 'discover'],
        choices: [
          {
            labelEn: 'Ask how word bookmarking works',
            labelVi: 'Hỏi cách lưu từ vựng yêu thích',
            nextDialogueId: 'lore_linh_study_tips',
          },
          {
            labelEn: 'Back to exploring',
            labelVi: 'Quay lại khám phá',
          },
        ],
      },
    ],
  },
  {
    id: 'linh_herbarium_complete',
    speaker: 'Botanist Linh',
    speakerRoleVi: 'Nhà thực vật học song ngữ',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'npc_linh',
    lines: [
      {
        en: 'Your sketches and habitat notes are wonderful! Open the Compendium tab anytime to read ecological stories for each species.',
        vi: 'Những ghi chép sinh cảnh của bạn tuyệt lắm! Hãy mở mục Sổ Sinh Vật bất cứ lúc nào để đọc chuyện thực địa của từng loài.',
        focusWords: ['habitat', 'compendium', 'species'],
      },
    ],
  },
  {
    id: 'tomas_supply_intro',
    speaker: 'Quartermaster Tomas',
    speakerRoleVi: 'Quản lý trạm tiếp tế',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'npc_tomas',
    lines: [
      {
        en: 'Need extra chimes, tonics, or cedar lanterns? Exchange your Field Tokens right here at the Supply Post!',
        vi: 'Bạn cần thêm chuông, thuốc hồi hay đèn tuyết tùng? Hãy đổi Huy hiệu thực địa ngay tại Quầy Tiếp Tế này nhé!',
        focusWords: ['chime', 'tonic', 'lantern', 'exchange', 'supply'],
        choices: [
          {
            labelEn: 'Open Supply Post',
            labelVi: 'Mở Quầy Tiếp Tế',
            action: { kind: 'open_supply_post' },
          },
          {
            labelEn: 'Maybe later',
            labelVi: 'Để sau nhé',
          },
        ],
      },
    ],
  },
  {
    id: 'tomas_bond_complete',
    speaker: 'Quartermaster Tomas',
    speakerRoleVi: 'Quản lý trạm tiếp tế',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'npc_tomas',
    lines: [
      {
        en: 'Three bonded species already! You have a natural gift for earning wild trust. Browse our latest charms anytime.',
        vi: 'Bạn đã kết bạn được ba loài rồi! Bạn rất có duyên tạo dựng niềm tin với sinh vật hoang dã. Ghé xem chuông mới nhé.',
        focusWords: ['bond', 'wild', 'trust', 'charm'],
        choices: [
          {
            labelEn: 'Open Supply Post',
            labelVi: 'Mở Quầy Tiếp Tế',
            action: { kind: 'open_supply_post' },
          },
          {
            labelEn: 'Carry on',
            labelVi: 'Tiếp tục hành trình',
          },
        ],
      },
    ],
  },
  {
    id: 'mai_tips_early',
    speaker: 'Scout Mai',
    speakerRoleVi: 'Trinh sát ngã tư',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'npc_mai',
    lines: [
      {
        en: 'Tip from a trail scout: packed stone paths never trigger wild ambushes, while tall grass hides shy partners!',
        vi: 'Mẹo nhỏ từ trinh sát: đường lát đá không bao giờ gặp trận đánh bất ngờ, còn bụi cỏ cao là nơi ẩn mình của nhiều loài!',
        focusWords: ['scout', 'path', 'grass', 'shy'],
      },
    ],
  },
  {
    id: 'mai_tips_fen',
    speaker: 'Scout Mai',
    speakerRoleVi: 'Trinh sát ngã tư',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'npc_mai',
    lines: [
      {
        en: 'Heading east to Reedwater Fen? Glimmerfin shimmers brightest at dusk and night, and its Spark moves pierce Water foes.',
        vi: 'Bạn sắp sang Đầm Sậy phía đông ư? Glimmerfin xuất hiện nhiều nhất lúc chiều tối, và chiêu Điện của nó khắc hệ Nước.',
        focusWords: ['east', 'shimmer', 'dusk', 'spark'],
      },
    ],
  },
  {
    id: 'mai_tips_ridge',
    speaker: 'Scout Mai',
    speakerRoleVi: 'Trinh sát ngã tư',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'npc_mai',
    lines: [
      {
        en: 'On Terracotta Ridge, Stone armors resist Gale and Spark, so bring Water or Leaf moves to crack tough shells!',
        vi: 'Trên Đèo Đất Nung, giáp Đá kháng tốt Gió và Điện, nên hãy mang chiêu hệ Nước hoặc Lá để phá lớp mai cứng nhé!',
        focusWords: ['stone', 'resist', 'shell'],
      },
    ],
  },
  {
    id: 'mai_tips_finale',
    speaker: 'Scout Mai',
    speakerRoleVi: 'Trinh sát ngã tư',
    cefr: 'B2',
    regionId: 'mosslight_hub',
    contextTag: 'npc_mai',
    lines: [
      {
        en: 'Have you checked every hidden chest across all five maps? Explorers who read subtle trail clues find rare treasures.',
        vi: 'Bạn đã mở hết các rương ẩn khắp năm bản đồ chưa? Người chịu khó đọc manh mối dọc đường sẽ tìm ra nhiều báu vật quý.',
        focusWords: ['hidden', 'chest', 'clue'],
      },
    ],
  },
  {
    id: 'gate_need_starter',
    speaker: 'Trail Notice',
    speakerRoleVi: 'Thông báo đường mòn',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'gate_hint',
    lines: [
      {
        en: 'Wild creatures roam beyond this gate! Speak with Ranger Rowan north of the campfire to choose a partner first.',
        vi: 'Sinh vật hoang dã sinh sống bên ngoài cổng này! Hãy gặp Trưởng đoàn Rowan phía bắc lửa trại để chọn bạn đồng hành trước.',
        focusWords: ['wild', 'roam', 'gate', 'choose', 'partner'],
      },
    ],
  },
  {
    id: 'gate_need_sylvan',
    speaker: 'Ferry Gatekeeper Sign',
    speakerRoleVi: 'Biển bến đò',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'gate_hint',
    lines: [
      {
        en: 'Strong currents ahead! Earn the Reed Ferry Token from Warden Sylvan in Whisperwood Glen to unlock safe passage.',
        vi: 'Dòng nước phía trước chảy xiết! Hãy nhận Thẻ Đò Đầm Sậy từ Thủ lĩnh Sylvan ở Rừng Thầm để mở lối qua an toàn.',
        focusWords: ['current', 'ferry', 'token', 'passage'],
      },
    ],
  },
  {
    id: 'gate_need_mirella',
    speaker: 'Canyon Rope Station',
    speakerRoleVi: 'Trạm thang dây hẻm núi',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'gate_hint',
    lines: [
      {
        en: 'The cliff lift requires a Braided Canyon Hook. Complete Warden Mirella trial in Reedwater Fen to obtain one.',
        vi: 'Thang leo vách đá cần có Móc Dây Hẻm Núi. Hãy hoàn thành bài thử của Thủ lĩnh Mirella tại Đầm Sậy để nhận.',
        focusWords: ['cliff', 'trial', 'rope'],
      },
    ],
  },
  {
    id: 'gate_need_kaelen',
    speaker: 'Sanctuary Seal Arch',
    speakerRoleVi: 'Cổng phong ấn thánh địa',
    cefr: 'B1',
    regionId: 'mosslight_hub',
    contextTag: 'gate_hint',
    lines: [
      {
        en: 'Three emblems must resonate together. Awaken the Sunforge Beacon with Warden Kaelen on Terracotta Ridge first.',
        vi: 'Ba ấn hiệu phải cùng cộng hưởng. Hãy đánh thức Đài Nắng Sớm cùng Thủ lĩnh Kaelen trên Đèo Đất Nung trước.',
        focusWords: ['emblem', 'resonate', 'awaken', 'beacon'],
      },
    ],
  },
  {
    id: 'prop_hub_campfire',
    speaker: 'Mosslight Campfire',
    speakerRoleVi: 'Lửa trại trung tâm',
    cefr: 'A1',
    regionId: 'mosslight_hub',
    contextTag: 'campfire',
    lines: [
      {
        en: 'Warm cedar embers crackle gently. Your partners recover full health and move energy beside the hearth!',
        vi: 'Than hồng tuyết tùng nổ lách tách êm dịu. Cả đội của bạn đã hồi đầy máu và năng lượng chiêu thức bên bếp lửa!',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'The warm campfire heals your whole team right away! Every partner has full health and move energy again.',
            vi: 'Bếp lửa trại ấm hồi sức cho cả đội ngay lập tức! Mọi người bạn đều đã đầy máu và năng lượng.',
          },
          B2: {
            en: 'Fragrant cedar embers crackle beside the hearth, restoring full vitality and move energy across your expedition party.',
            vi: 'Than tuyết tùng thơm dịu nổ khẽ bên bếp đá, khôi phục trọn vẹn sinh lực và năng lượng chiêu cho toàn đội.',
          },
        },
        focusWords: ['warm', 'ember', 'recover', 'health', 'hearth'],
        action: { kind: 'heal_party' },
        choices: [
          {
            labelEn: 'Optional Word Practice by the Fire',
            labelVi: 'Ôn từ tự nguyện bên ánh lửa',
            action: { kind: 'open_camp_review' },
          },
          {
            labelEn: 'Rest until next time of day',
            labelVi: 'Nghỉ tới buổi tiếp theo trong ngày',
            action: { kind: 'cycle_time_of_day' },
            nextDialogueId: 'campfire_time_shifted',
          },
          {
            labelEn: 'Read Ranger Logbook Story',
            labelVi: 'Đọc nhật ký chuyện kể kiểm lâm',
            nextDialogueId: 'logbook_hub_story',
          },
          {
            labelEn: 'Leave the fire',
            labelVi: 'Rời bếp lửa',
          },
        ],
      },
    ],
  },
  {
    id: 'prop_forest_campfire',
    speaker: 'Glen Clearing Campfire',
    speakerRoleVi: 'Lửa trại trảng rừng',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'campfire',
    lines: [
      {
        en: 'Sunlight filters through mossy branches onto the camp stones. Your entire team feels rested and restored!',
        vi: 'Ánh nắng xuyên qua cành cây phủ rêu rọi xuống bếp đá. Toàn bộ đội hình của bạn đã khỏe khoắn trở lại!',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Soft forest light warms the camp stones. Your team rests here and feels strong again!',
            vi: 'Ánh sáng rừng dịu ấm rọi xuống bếp đá. Đội của bạn nghỉ chân và khỏe khoắn trở lại!',
          },
          B2: {
            en: 'Dappled sunlight filters through mossy oak boughs onto the hearth, leaving every companion rested and revitalized.',
            vi: 'Nắng lốm đốm xuyên qua tán sồi phủ rêu xuống bếp lửa, giúp mọi người bạn đồng hành hồi phục trọn vẹn.',
          },
        },
        focusWords: ['moss', 'branch', 'rest', 'restore'],
        action: { kind: 'heal_party' },
        choices: [
          {
            labelEn: 'Optional Word Practice',
            labelVi: 'Ôn từ tự nguyện',
            action: { kind: 'open_camp_review' },
          },
          {
            labelEn: 'Rest until next time of day',
            labelVi: 'Đợi sang khung giờ kế tiếp',
            action: { kind: 'cycle_time_of_day' },
            nextDialogueId: 'campfire_time_shifted',
          },
          {
            labelEn: 'Read Woodland Ranger Log',
            labelVi: 'Đọc nhật ký kiểm lâm rừng sồi',
            nextDialogueId: 'logbook_forest_story',
          },
          {
            labelEn: 'Continue down the trail',
            labelVi: 'Tiếp tục lên đường',
          },
        ],
      },
    ],
  },
  {
    id: 'prop_fen_campfire',
    speaker: 'Lantern Pier Campfire',
    speakerRoleVi: 'Lửa trại bến đèn',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'campfire',
    lines: [
      {
        en: 'Dry reed bundles burn with a clean golden flame above the misty water. Your team is back in peak condition!',
        vi: 'Những bó sậy khô cháy sáng rực phía trên mặt nước mờ sương. Đội của bạn đã trở lại trạng thái sung sức nhất!',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Dry reeds burn bright beside the misty pond. Your team warms up and recovers full health!',
            vi: 'Những bó sậy khô cháy sáng bên mặt hồ sương. Đội của bạn sưởi ấm và hồi đầy máu!',
          },
          B2: {
            en: 'Seasoned reed bundles burn with a steady amber flame above misty channels, restoring your party to peak readiness.',
            vi: 'Những bó sậy phơi kỹ cháy đều ánh hổ phách trên rạch nước mờ sương, đưa cả đội về trạng thái sung sức nhất.',
          },
        },
        focusWords: ['reed', 'mist', 'peak'],
        action: { kind: 'heal_party' },
        choices: [
          {
            labelEn: 'Optional Word Practice',
            labelVi: 'Ôn từ tự nguyện',
            action: { kind: 'open_camp_review' },
          },
          {
            labelEn: 'Rest until next time of day',
            labelVi: 'Đợi sang khung giờ kế tiếp',
            action: { kind: 'cycle_time_of_day' },
            nextDialogueId: 'campfire_time_shifted',
          },
          {
            labelEn: 'Read Wetland Boatman Log',
            labelVi: 'Đọc nhật ký người chèo đò',
            nextDialogueId: 'logbook_fen_story',
          },
          {
            labelEn: 'Step back onto the pier',
            labelVi: 'Trở lại bến gỗ',
          },
        ],
      },
    ],
  },
  {
    id: 'prop_ridge_campfire',
    speaker: 'Windbreak Campfire',
    speakerRoleVi: 'Lửa trại hốc đá',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'campfire',
    lines: [
      {
        en: 'Sheltered behind ochre sandstone walls, the hearth restores every tired partner for the climb ahead.',
        vi: 'Nằm khuất gió sau vách sa thạch vàng đất, bếp lửa hồi phục trọn vẹn sức lực cho chặng leo phía trước.',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Behind the red rock wall, this warm fire heals your tired team for the hill climb.',
            vi: 'Nằm sau vách đá đỏ chắn gió, bếp lửa ấm hồi sức cho cả đội trước chặng leo đồi.',
          },
          B2: {
            en: 'Tucked behind wind-carved sandstone alcoves, this steady hearth replenishes every weary partner before the summit ascent.',
            vi: 'Ẩn mình sau hốc sa thạch chắn gió, bếp lửa bền bỉ này bồi đắp trọn sức lực trước chặng leo lên đỉnh.',
          },
        },
        focusWords: ['shelter', 'sand', 'hearth', 'restore', 'climb'],
        action: { kind: 'heal_party' },
        choices: [
          {
            labelEn: 'Optional Word Practice',
            labelVi: 'Ôn từ tự nguyện',
            action: { kind: 'open_camp_review' },
          },
          {
            labelEn: 'Rest until next time of day',
            labelVi: 'Đợi sang khung giờ kế tiếp',
            action: { kind: 'cycle_time_of_day' },
            nextDialogueId: 'campfire_time_shifted',
          },
          {
            labelEn: 'Read Canyon Climber Log',
            labelVi: 'Đọc nhật ký người leo đèo',
            nextDialogueId: 'logbook_ridge_story',
          },
          {
            labelEn: 'Return to the ridge trail',
            labelVi: 'Quay lại đường đèo',
          },
        ],
      },
    ],
  },
  {
    id: 'prop_sanctuary_campfire',
    speaker: 'Starlight Brazier',
    speakerRoleVi: 'Đài lửa ánh sao',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'campfire',
    lines: [
      {
        en: 'Silver-gold flames dance quietly inside the ancient stone brazier. Every partner feels serene and fully healed!',
        vi: 'Ngọn lửa ánh bạc nhảy múa êm đềm trong chậu đá cổ. Mọi người bạn đồng hành đều thanh tĩnh và hồi đầy sức lực!',
        includeReencounterEcho: true,
        variants: {
          A1: {
            en: 'Bright starlight fire glows in the old stone bowl. Your whole team feels calm and fully healed!',
            vi: 'Ánh lửa sao sáng dịu trong chậu đá cổ. Cả đội cảm thấy bình tĩnh và hồi đầy máu!',
          },
          A2: {
            en: 'Quiet golden flames glow inside the stone brazier. Every partner rests and recovers full health right away!',
            vi: 'Ngọn lửa vàng êm đềm cháy trong đài đá. Mọi đồng hành đều được nghỉ ngơi và hồi đầy sức lực ngay lập tức!',
          },
        },
        focusWords: ['ancient', 'stone', 'serene'],
        action: { kind: 'heal_party' },
        choices: [
          {
            labelEn: 'Optional Word Practice',
            labelVi: 'Ôn từ tự nguyện',
            action: { kind: 'open_camp_review' },
          },
          {
            labelEn: 'Rest until next time of day',
            labelVi: 'Đợi sang khung giờ kế tiếp',
            action: { kind: 'cycle_time_of_day' },
            nextDialogueId: 'campfire_time_shifted',
          },
          {
            labelEn: 'Read Observatory Chronicle',
            labelVi: 'Đọc biên niên sử đài sao',
            nextDialogueId: 'logbook_sanctuary_story',
          },
          {
            labelEn: 'Step toward the terraces',
            labelVi: 'Bước ra thềm đá',
          },
        ],
      },
    ],
  },
  {
    id: 'campfire_time_shifted',
    speaker: 'Campfire Rest',
    speakerRoleVi: 'Nghỉ bên lửa trại',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'campfire',
    lines: [
      {
        en: 'You rested peacefully as the sky shifted. Different wild creatures become active between morning, day, dusk, and night!',
        vi: 'Bạn nghỉ ngơi thư thái khi sắc trời chuyển buổi. Nhiều loài sinh vật hoạt động mạnh hơn vào sáng, ngày, chiều hoặc đêm!',
        focusWords: ['rest', 'peaceful', 'sky', 'morning', 'dusk', 'night'],
      },
    ],
  },
  {
    id: 'prop_supply_post',
    speaker: 'Expedition Supply Counter',
    speakerRoleVi: 'Quầy tiếp tế thực địa',
    cefr: 'A2',
    regionId: 'mosslight_hub',
    contextTag: 'supply_post',
    lines: [
      {
        en: 'Shelves of woven chimes, herbal tonics, and fragrant cedar lanterns stand neatly labeled in English.',
        vi: 'Những kệ chuông đan, nước thảo dược và đèn tuyết tùng thơm dịu được xếp ngay ngắn kèm nhãn tiếng Anh.',
        focusWords: ['chime', 'tonic', 'fragrant', 'lantern'],
        action: { kind: 'open_supply_post' },
      },
    ],
  },
  {
    id: 'elena_pre_battle',
    speaker: 'Scout Elena',
    speakerRoleVi: 'Kiểm lâm trẻ Elena',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'trainer_elena',
    lines: [
      {
        en: 'Hi there! Before challenging Warden Sylvan, would you like a friendly match to test elemental weaknesses?',
        vi: 'Chào bạn! Trước khi gặp Thủ lĩnh Sylvan, bạn có muốn so tài giao hữu để thử quy tắc khắc hệ không?',
        focusWords: ['warden', 'match', 'element', 'weakness'],
        choices: [
          {
            labelEn: 'Accept Elena friendly match',
            labelVi: 'Nhận lời so tài cùng Elena',
            action: { kind: 'start_trainer_battle', npcId: 'npc_elena' },
          },
          {
            labelEn: 'Prepare my team first',
            labelVi: 'Để mình chuẩn bị đội trước',
          },
        ],
      },
    ],
  },
  {
    id: 'elena_post_battle',
    speaker: 'Scout Elena',
    speakerRoleVi: 'Kiểm lâm trẻ Elena',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'trainer_elena',
    lines: [
      {
        en: 'Great rhythm! Remember that Ember and Gale moves strike Leaf weaknesses, while Stone grounds flyers.',
        vi: 'Nhịp phối hợp tuyệt lắm! Hãy nhớ chiêu Lửa và Gió khắc hệ Lá, còn hệ Đá khắc chế các loài bay nhé.',
        focusWords: ['rhythm', 'strike', 'weakness'],
      },
    ],
  },
  {
    id: 'haru_quest_intro',
    speaker: 'Woodcarver Haru',
    speakerRoleVi: 'Nghệ nhân chuông gỗ',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'npc_haru',
    lines: [
      {
        en: 'Listen closely! I carved a trail clue on a signpost near the hollow trunk south of here.',
        vi: 'Lắng nghe này! Tôi có khắc một manh mối trên biển gỗ gần hốc cây rỗng phía nam chỗ này.',
        focusWords: ['trail', 'clue', 'sign', 'hollow'],
      },
      {
        en: 'Read that southern signpost and bond with at least one Leaf partner, and I will gift you two Cedar Lanterns!',
        vi: 'Hãy đọc tấm biển phía nam đó và kết bạn với ít nhất một loài hệ Lá, tôi sẽ tặng bạn hai chiếc Đèn Tuyết Tùng!',
        focusWords: ['read', 'bond', 'leaf', 'lantern'],
        action: { kind: 'start_quest', questId: 'q06_lantern_cocoon' },
      },
    ],
  },
  {
    id: 'haru_quest_active',
    speaker: 'Woodcarver Haru',
    speakerRoleVi: 'Nghệ nhân chuông gỗ',
    cefr: 'A2',
    regionId: 'whisperwood',
    contextTag: 'npc_haru',
    lines: [
      {
        en: 'Walk south along the mossy clearing to inspect the Hollow Trunk Clue, and keep a Leaf Wildkin in your compendium.',
        vi: 'Đi về phía nam trảng rêu để đọc biển Manh Mối Hốc Cây, đồng thời thu phục một loài hệ Lá vào sổ nhé.',
        focusWords: ['south', 'clearing', 'inspect', 'clue'],
      },
    ],
  },
  {
    id: 'haru_quest_done',
    speaker: 'Woodcarver Haru',
    speakerRoleVi: 'Nghệ nhân chuông gỗ',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'npc_haru',
    lines: [
      {
        en: 'Thank you! Shellglow soft green glow inspired my finest wooden chimes. May those Cedar Lanterns guide your steps.',
        vi: 'Cảm ơn bạn! Ánh sáng xanh dịu của Shellglow đã truyền cảm hứng cho những chiếc chuông gỗ đẹp nhất của tôi.',
        focusWords: ['glow', 'chime', 'lantern', 'guide'],
      },
    ],
  },
  {
    id: 'sylvan_pre_boss',
    speaker: 'Warden Sylvan',
    speakerRoleVi: 'Thủ lĩnh Rừng Thầm',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'boss_sylvan',
    lines: [
      {
        en: 'Beneath this ancient Whispering Oak, every falling leaf carries a story. Can your team listen and respond in harmony?',
        vi: 'Dưới tán Sồi Thầm cổ thụ này, mỗi chiếc lá rơi đều mang một câu chuyện. Đội của bạn đã sẵn sàng hòa nhịp chưa?',
        variants: {
          A1: {
            en: 'Under this big old oak tree, my Leaf team is ready! Show me how you and your partner work together.',
            vi: 'Dưới gốc sồi cổ thụ lớn này, đội hệ Lá của tôi đã sẵn sàng! Hãy cho tôi thấy bạn và đồng hành phối hợp ra sao.',
          },
          A2: {
            en: 'Under the Whispering Oak, my Leaf partners stand ready. Remember that Ember and Gale moves beat Leaf!',
            vi: 'Dưới gốc Sồi Thầm, đội hệ Lá của tôi đang đợi. Hãy nhớ chiêu hệ Lửa và Gió khắc chế hệ Lá nhé!',
          },
          B2: {
            en: 'Beneath these ancient Whispering Oak boughs, woodland guardians test composure and elemental synergy. Shall our trial begin?',
            vi: 'Dưới tán Sồi Thầm cổ kính này, các hộ vệ rừng xanh thử thách sự điềm tĩnh và phối hợp nguyên tố. Ta bắt đầu chứ?',
          },
        },
        focusWords: ['ancient', 'leaf', 'harmony'],
        choices: [
          {
            labelEn: 'Begin Warden Sylvan Trial',
            labelVi: 'Bắt đầu bài thử của Thủ lĩnh Sylvan',
            action: { kind: 'start_trainer_battle', npcId: 'npc_sylvan' },
          },
          {
            labelEn: 'Step back and prepare',
            labelVi: 'Lùi lại chuẩn bị thêm',
          },
        ],
      },
    ],
  },
  {
    id: 'sylvan_post_boss',
    speaker: 'Warden Sylvan',
    speakerRoleVi: 'Thủ lĩnh Rừng Thầm',
    cefr: 'B1',
    regionId: 'whisperwood',
    contextTag: 'boss_sylvan',
    lines: [
      {
        en: 'Hear that deep wooden chime? The Whispering Oak Resonance Stone sings once more!',
        vi: 'Bạn có nghe tiếng ngân trầm ấm đó không? Phiến Đá Cộng Hưởng Sồi Cổ Thụ đã cất tiếng trở lại!',
        focusWords: ['chime', 'resonance', 'stone'],
      },
      {
        en: 'Accept this Reed Ferry Token. Both the eastern camp dock and our northern creek shortcut now lead to Reedwater Fen.',
        vi: 'Hãy nhận Thẻ Đò Đầm Sậy này. Cả bến đông ở trại lẫn lối tắt ven suối phía bắc đều đã mở đường sang Đầm Sậy.',
        focusWords: ['ferry', 'token', 'dock', 'shortcut'],
      },
    ],
  },
  {
    id: 'noah_pre_battle',
    speaker: 'Angler Noah',
    speakerRoleVi: 'Người gác suối Noah',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'trainer_noah',
    lines: [
      {
        en: 'Misty channels hide swift swimmers! Care to test your footing against my wetland partners?',
        vi: 'Những luồng nước mờ sương ẩn giấu nhiều tay bơi cừ khôi! Bạn muốn thử sức cùng đội đầm lầy của mình chứ?',
        focusWords: ['mist', 'swift', 'partner'],
        choices: [
          {
            labelEn: 'Challenge Angler Noah',
            labelVi: 'So tài cùng Noah',
            action: { kind: 'start_trainer_battle', npcId: 'npc_noah' },
          },
          {
            labelEn: 'Not right now',
            labelVi: 'Để lát nữa nhé',
          },
        ],
      },
    ],
  },
  {
    id: 'noah_post_battle',
    speaker: 'Angler Noah',
    speakerRoleVi: 'Người gác suối Noah',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'trainer_noah',
    lines: [
      {
        en: 'Impressive poise! Watch out for Warden Mirella Glimmerfin, because Spark moves shock unwary flyers and swimmers.',
        vi: 'Vững vàng lắm! Hãy dè chừng Glimmerfin của Thủ lĩnh Mirella, vì chiêu hệ Điện khắc mạnh cả loài bay lẫn loài bơi.',
        focusWords: ['warden', 'spark', 'move'],
      },
    ],
  },
  {
    id: 'sora_quest_intro',
    speaker: 'Ferrywoman Sora',
    speakerRoleVi: 'Người chèo đò sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'npc_sora',
    lines: [
      {
        en: 'Evening fog rolls thick over our lotus channels. Could you inspect the Lantern Post east of the bridge and bond with a Spark partner?',
        vi: 'Sương chiều phủ dày trên các rạch sen. Bạn giúp mình kiểm tra Trụ Đèn phía đông cầu và kết bạn một loài hệ Điện nhé?',
        focusWords: ['fog', 'lotus', 'inspect', 'lantern', 'spark'],
        action: { kind: 'start_quest', questId: 'q07_mist_beacons' },
      },
    ],
  },
  {
    id: 'sora_quest_active',
    speaker: 'Ferrywoman Sora',
    speakerRoleVi: 'Người chèo đò sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'npc_sora',
    lines: [
      {
        en: 'Check the wooden Lantern Post just east of here, and catch a Voltkit or Glimmerfin so boats can navigate safely.',
        vi: 'Hãy kiểm tra Trụ Đèn gỗ ngay phía đông đây, đồng thời thu phục Voltkit hoặc Glimmerfin để dẫn thuyền đi an toàn.',
        focusWords: ['lantern', 'navigate', 'safe'],
      },
    ],
  },
  {
    id: 'sora_quest_done',
    speaker: 'Ferrywoman Sora',
    speakerRoleVi: 'Người chèo đò sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'npc_sora',
    lines: [
      {
        en: 'The channel beacon shines bright through the mist now! Enjoy this warm Breeze Tea on your climb southward.',
        vi: 'Ngọn đèn luồng lạch đã sáng rõ xuyên màn sương rồi! Hãy thưởng thức Trà Gió Ngàn ấm áp trên chặng leo sắp tới nhé.',
        focusWords: ['beacon', 'mist', 'warm', 'climb'],
      },
    ],
  },
  {
    id: 'mirella_pre_boss',
    speaker: 'Warden Mirella',
    speakerRoleVi: 'Thủ lĩnh Đầm Sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'boss_mirella',
    lines: [
      {
        en: 'Water yields gently around obstacles yet carves deep stone canyons. Show me how your team adapts to shifting tides!',
        vi: 'Dòng nước mềm mại uốn quanh vật cản nhưng lại khắc nên hẻm đá sâu. Hãy cho tôi thấy đội bạn thích ứng ra sao!',
        variants: {
          A1: {
            en: 'Cool water moves gently around rocks, yet my wetland team is strong! Are you ready for our trial?',
            vi: 'Nước mát chảy êm quanh đá, nhưng đội đầm lầy của tôi rất mạnh! Bạn đã sẵn sàng bước vào bài thử chưa?',
          },
          A2: {
            en: 'River currents flow gently yet shape strong stone. Tip: Leaf and Stone moves help against Water and Spark!',
            vi: 'Dòng nước trôi dịu nhẹ nhưng bào mòn cả đá cứng. Mẹo nhỏ: chiêu Lá và Đá rất hữu ích trước hệ Nước và Điện!',
          },
          B2: {
            en: 'Though water yields gracefully around every obstacle, persistent currents sculpt solid stone. Demonstrate your tactical adaptability!',
            vi: 'Dù làn nước uyển chuyển nhường lối quanh vật cản, dòng chảy bền bỉ vẫn tạc nên đá rắn. Hãy thể hiện khả năng ứng biến của bạn!',
          },
        },
        focusWords: ['gentle', 'stone', 'canyon', 'tide'],
        choices: [
          {
            labelEn: 'Begin Warden Mirella Trial',
            labelVi: 'Bắt đầu bài thử của Thủ lĩnh Mirella',
            action: { kind: 'start_trainer_battle', npcId: 'npc_mirella' },
          },
          {
            labelEn: 'Check party first',
            labelVi: 'Kiểm tra lại đội hình trước',
          },
        ],
      },
    ],
  },
  {
    id: 'mirella_post_boss',
    speaker: 'Warden Mirella',
    speakerRoleVi: 'Thủ lĩnh Đầm Sậy',
    cefr: 'B1',
    regionId: 'reedwater_fen',
    contextTag: 'boss_mirella',
    lines: [
      {
        en: 'Clear ripples spread beneath the Sunken Tide Arch! The wetland Resonance Stone hums with serene vitality.',
        vi: 'Những gợn sóng trong trẻo lan tỏa dưới Vòm Thủy Triều! Phiến đá vùng đầm đã ngân vang đầy sinh lực bình yên.',
        focusWords: ['arch', 'resonance', 'serene', 'vitality'],
      },
      {
        en: 'Take this Braided Canyon Hook. You can ascend Terracotta Ridge either from the eastern steps or south of Mosslight Camp.',
        vi: 'Hãy cầm Móc Dây Hẻm Núi này. Bạn có thể lên Đèo Đất Nung từ bậc đá phía đông hoặc từ cổng nam Trại Đèn Rêu.',
        focusWords: ['ascend', 'ridge', 'south'],
      },
    ],
  },
  {
    id: 'diego_pre_battle',
    speaker: 'Mountaineer Diego',
    speakerRoleVi: 'Trinh sát núi cao Diego',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'trainer_diego',
    lines: [
      {
        en: 'Crisp canyon gales test every climber endurance! Ready for a brisk three-partner match on the ridge?',
        vi: 'Gió đèo lồng lộng thử thách sức bền của mọi tay leo núi! Bạn sẵn sàng đấu giao hữu ba sinh vật trên đèo chứ?',
        focusWords: ['crisp', 'gale', 'endure', 'match'],
        choices: [
          {
            labelEn: 'Accept Diego ridge match',
            labelVi: 'Đấu giao hữu cùng Diego',
            action: { kind: 'start_trainer_battle', npcId: 'npc_diego' },
          },
          {
            labelEn: 'Rest at the windbreak first',
            labelVi: 'Nghỉ ở bếp chắn gió trước',
          },
        ],
      },
    ],
  },
  {
    id: 'diego_post_battle',
    speaker: 'Mountaineer Diego',
    speakerRoleVi: 'Trinh sát núi cao Diego',
    cefr: 'B1',
    regionId: 'terracotta_ridge',
    contextTag: 'trainer_diego',
    lines: [
      {
        en: 'Solid footing! Warden Kaelen commands fierce Ember and sturdy Stone partners down at the southeastern beacon.',
        vi: 'Thế đứng vững lắm! Thủ lĩnh Kaelen chỉ huy các loài hệ Lửa mãnh liệt và hệ Đá cứng cáp ở đài lửa đông nam.',
        focusWords: ['warden', 'fierce', 'sturdy', 'beacon'],
      },
    ],
  },
  {
    id: 'amara_quest_intro',
    speaker: 'Potter Amara',
    speakerRoleVi: 'Nghệ nhân gốm cổ',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'npc_amara',
    lines: [
      {
        en: 'Our ancestors baked resonant clay bells inside the ruined kiln just west of this terrace.',
        vi: 'Tổ tiên chúng tôi từng nung những chiếc chuông đất sét ngân vang ngay tại phế tích lò gốm phía tây thềm đá này.',
        focusWords: ['resonant', 'clay', 'ruin', 'kiln', 'terrace'],
      },
      {
        en: 'Please inspect the Ancient Kiln Tablet and bond with a Stone partner so we can preserve their craft!',
        vi: 'Nhờ bạn khảo sát Bia Đá Lò Gốm Cổ và kết bạn một loài hệ Đá để gìn giữ nghề xưa nhé!',
        focusWords: ['inspect', 'bond', 'stone'],
        action: { kind: 'start_quest', questId: 'q09_ancient_kiln' },
      },
    ],
  },
  {
    id: 'amara_quest_active',
    speaker: 'Potter Amara',
    speakerRoleVi: 'Nghệ nhân gốm cổ',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'npc_amara',
    lines: [
      {
        en: 'Examine the carved tablet at the western kiln ruin, and catch a Clayback or Kilnshell along the sandy slopes.',
        vi: 'Hãy đọc tấm bia chạm khắc ở phế tích lò gốm phía tây, rồi thu phục Clayback hoặc Kilnshell trên sườn cát.',
        focusWords: ['ruin', 'sand', 'slope'],
      },
    ],
  },
  {
    id: 'amara_quest_done',
    speaker: 'Potter Amara',
    speakerRoleVi: 'Nghệ nhân gốm cổ',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'npc_amara',
    lines: [
      {
        en: 'Those warm terracotta scales match our oldest pottery glazes! Take these Amber Charms with my gratitude.',
        vi: 'Lớp vảy màu đất nung ấm áp đó giống hệt nước men gốm cổ nhất! Xin gửi tặng bạn những chiếc Chuông Hổ Phách này.',
        focusWords: ['warm', 'scale', 'charm'],
      },
    ],
  },
  {
    id: 'kaelen_pre_boss',
    speaker: 'Warden Kaelen',
    speakerRoleVi: 'Thủ lĩnh Đèo Đất Nung',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'boss_kaelen',
    lines: [
      {
        en: 'Endurance and inner warmth forge unyielding trust! Stand before the Sunforge Beacon and show me your expedition spirit!',
        vi: 'Sức bền bỉ và ngọn lửa nội tâm rèn nên niềm tin kiên cường! Hãy đứng trước Đài Nắng Sớm và thể hiện bản lĩnh của bạn!',
        variants: {
          A1: {
            en: 'Strong stone and warm fire guard this high ridge! Bring your best Water or Leaf moves to our trial!',
            vi: 'Đá cứng và lửa ấm canh giữ đỉnh đèo này! Hãy mang những chiêu Nước hoặc Lá tốt nhất vào bài thử nhé!',
          },
          A2: {
            en: 'Steady warmth and sturdy stone build true trust! Stand before the Sunforge Beacon whenever your team is ready.',
            vi: 'Hơi ấm bền bỉ và đá vững tạo nên niềm tin! Hãy bước ra trước Đài Nắng Sớm khi đội bạn sẵn sàng.',
          },
        },
        focusWords: ['endure', 'warm', 'unyielding', 'trust', 'beacon'],
        choices: [
          {
            labelEn: 'Begin Warden Kaelen Trial',
            labelVi: 'Bắt đầu bài thử của Thủ lĩnh Kaelen',
            action: { kind: 'start_trainer_battle', npcId: 'npc_kaelen' },
          },
          {
            labelEn: 'Prepare a moment longer',
            labelVi: 'Chuẩn bị thêm đôi chút',
          },
        ],
      },
    ],
  },
  {
    id: 'kaelen_post_boss',
    speaker: 'Warden Kaelen',
    speakerRoleVi: 'Thủ lĩnh Đèo Đất Nung',
    cefr: 'B2',
    regionId: 'terracotta_ridge',
    contextTag: 'boss_kaelen',
    lines: [
      {
        en: 'Magnificent! Golden fire dances atop the Sunforge Beacon, uniting all three regional Resonance Stones!',
        vi: 'Tuyệt vời! Ngọn lửa vàng rực đã bừng lên trên Đài Nắng Sớm, kết nối trọn vẹn ba phiến Đá Cộng Hưởng vùng!',
        focusWords: ['fire', 'beacon', 'resonance'],
      },
      {
        en: 'Carry this Resonance Crest to Starfall Sanctuary via our northeastern summit pass or the North Arch of Mosslight Camp.',
        vi: 'Hãy mang Ấn Cộng Hưởng này lên Thánh Địa Sao Rơi qua đèo cao đông bắc hoặc Cổng Bắc của Trại Đèn Rêu.',
        focusWords: ['crest', 'sanctuary', 'summit', 'arch'],
      },
    ],
  },
  {
    id: 'lyra_quest_intro',
    speaker: 'Archivist Lyra',
    speakerRoleVi: 'Học giả văn bia',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'npc_lyra',
    lines: [
      {
        en: 'Welcome to Starfall Sanctuary! Early naturalists carved poetic English inscriptions onto three starlit pillars here.',
        vi: 'Chào mừng tới Thánh Địa Sao Rơi! Các nhà tự nhiên thuở xưa đã khắc những dòng chữ tiếng Anh giàu ý nghĩa lên ba trụ đá.',
        focusWords: ['sanctuary', 'inscription', 'star', 'pillar'],
      },
      {
        en: 'Read the West, East, and North pillars to piece together their message of harmony!',
        vi: 'Hãy đọc đủ ba trụ đá Tây, Đông và Bắc để ghép trọn thông điệp hòa hợp của tiền nhân nhé!',
        focusWords: ['read', 'harmony'],
        action: { kind: 'start_quest', questId: 'q10_starlight_inscriptions' },
      },
    ],
  },
  {
    id: 'lyra_inscriptions_active',
    speaker: 'Archivist Lyra',
    speakerRoleVi: 'Học giả văn bia',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'npc_lyra',
    lines: [
      {
        en: 'Two pillars stand near the wooden bridges, and the third stele overlooks the upper terrace to the northeast.',
        vi: 'Hai trụ đá nằm gần hai cây cầu gỗ, còn tấm bia thứ ba hướng ra thềm đá cao phía đông bắc.',
        focusWords: ['pillar', 'bridge', 'terrace'],
      },
    ],
  },
  {
    id: 'lyra_inscriptions_done',
    speaker: 'Archivist Lyra',
    speakerRoleVi: 'Học giả văn bia',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'npc_lyra',
    lines: [
      {
        en: 'You read all three celestial verses! Keep bonding with diverse species across the basin to complete twelve compendium entries.',
        vi: 'Bạn đã đọc trọn ba khổ văn khắc tinh tú! Hãy tiếp tục kết bạn đủ mười hai loài khác nhau cho cuốn sổ thực địa nhé.',
        focusWords: ['celestial', 'bond', 'diverse', 'compendium'],
      },
    ],
  },
  {
    id: 'lyra_compendium_master',
    speaker: 'Archivist Lyra',
    speakerRoleVi: 'Học giả văn bia',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'npc_lyra',
    lines: [
      {
        en: 'Twelve distinct Wildkin species bonded through patience and curiosity! You are a true Basin Naturalist.',
        vi: 'Mười hai loài sinh vật gắn kết nhờ lòng kiên nhẫn và ham học hỏi! Bạn thực sự là Nhà tự nhiên học của thung lũng.',
        focusWords: ['distinct', 'patient', 'curious'],
      },
    ],
  },
  {
    id: 'orin_pre_battle',
    speaker: 'Starwatcher Orin',
    speakerRoleVi: 'Người gác đài sao Orin',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'trainer_orin',
    lines: [
      {
        en: 'Only Rangers whose teams act in calm balance may approach the Celestial Altar. Shall we test your readiness?',
        vi: 'Chỉ những kiểm lâm phối hợp đội hình điềm tĩnh và cân bằng mới tiến tới Bệ Tinh Tú. Cùng kiểm tra sự sẵn sàng nhé?',
        focusWords: ['ranger', 'calm', 'balance', 'altar'],
        choices: [
          {
            labelEn: 'Accept Sentinel Orin match',
            labelVi: 'So tài cùng Người gác đền Orin',
            action: { kind: 'start_trainer_battle', npcId: 'npc_orin' },
          },
          {
            labelEn: 'Prepare at the brazier',
            labelVi: 'Chuẩn bị thêm bên đài lửa',
          },
        ],
      },
    ],
  },
  {
    id: 'orin_post_battle',
    speaker: 'Starwatcher Orin',
    speakerRoleVi: 'Người gác đài sao Orin',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'trainer_orin',
    lines: [
      {
        en: 'Your fellowship shines like a clear constellation. Elder Keeper Astraea awaits just north of the central stairs.',
        vi: 'Tình đồng đội của bạn tỏa sáng như chòm sao đêm quang đãng. Trưởng lão Astraea đang đợi phía bắc bậc thềm trung tâm.',
        focusWords: ['fellowship', 'constellation'],
      },
    ],
  },
  {
    id: 'astraea_pre_trial',
    speaker: 'Elder Keeper Astraea',
    speakerRoleVi: 'Trưởng lão hộ vệ',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'boss_astraea',
    lines: [
      {
        en: 'You have walked mossy woods, misty fens, and sunlit ridges while listening to every creature in its own context.',
        vi: 'Bạn đã đi qua rừng rêu, đầm sương và đèo nắng với đôi tai biết lắng nghe từng sinh vật trong ngữ cảnh sống của chúng.',
        focusWords: ['moss', 'mist', 'ridge', 'creature', 'context'],
      },
      {
        en: 'Face my sanctuary guardians in our final Resonance Trial so the Celestial Altar may awaken!',
        vi: 'Hãy đối diện những hộ vệ thánh địa trong bài khảo nghiệm Cộng Hưởng cuối cùng để đánh thức Bệ Tinh Tú!',
        variants: {
          A1: {
            en: 'Meet my three strong sanctuary guardians in our final match so the starlight altar can wake up!',
            vi: 'Hãy so tài cùng ba hộ vệ thánh địa mạnh mẽ trong trận cuối để đánh thức bệ đá ánh sao!',
          },
          A2: {
            en: 'Stand side by side with your partners in our final Resonance Trial to awaken the Celestial Altar!',
            vi: 'Hãy sát cánh cùng các bạn đồng hành trong bài thử Cộng Hưởng cuối cùng để đánh thức Bệ Tinh Tú!',
          },
        },
        focusWords: ['guardian', 'resonance', 'trial', 'awaken'],
        choices: [
          {
            labelEn: 'Begin Final Sanctuary Trial',
            labelVi: 'Bắt đầu Khảo nghiệm Thánh Địa cuối cùng',
            action: { kind: 'start_trainer_battle', npcId: 'npc_astraea' },
          },
          {
            labelEn: 'Take a quiet breath first',
            labelVi: 'Hít thở chuẩn bị thêm một chút',
          },
        ],
      },
    ],
  },
  {
    id: 'astraea_post_trial',
    speaker: 'Elder Keeper Astraea',
    speakerRoleVi: 'Trưởng lão hộ vệ',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'boss_astraea',
    lines: [
      {
        en: 'Pure harmony resonates from your partners! Step behind me and inspect the Celestial Harmony Altar to complete your journey.',
        vi: 'Sự đồng điệu thuần khiết ngân vang từ đội của bạn! Hãy bước ra phía sau tôi và chạm vào Bệ Tinh Tú để hoàn tất hành trình.',
        focusWords: ['harmony', 'resonate', 'inspect', 'altar', 'journey'],
      },
    ],
  },
  {
    id: 'shrine_starfall_altar',
    speaker: 'Celestial Harmony Altar',
    speakerRoleVi: 'Bệ Đá Cộng Hưởng Tinh Tú',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'finale_altar',
    lines: [
      {
        en: 'Starlight streams across the carved stone basin. When you hold up the Resonance Crest, four chords ring across the sky!',
        vi: 'Ánh sao tràn qua lòng bệ đá chạm khắc. Khi bạn giơ cao Ấn Cộng Hưởng, bốn hợp âm ngân vang khắp bầu trời!',
        focusWords: ['star', 'basin', 'crest', 'sky'],
        choices: [
          {
            labelEn: 'Awaken Basin Harmony',
            labelVi: 'Đánh thức Hòa Hợp Thung Lũng',
            nextDialogueId: 'finale_awakening_check',
          },
          {
            labelEn: 'Observe the carvings quietly',
            labelVi: 'Lặng ngắm những nét chạm cổ',
          },
        ],
      },
    ],
  },
  {
    id: 'finale_awakening_check',
    speaker: 'Celestial Harmony Altar',
    speakerRoleVi: 'Bệ Đá Cộng Hưởng Tinh Tú',
    cefr: 'B2',
    regionId: 'starfall_sanctuary',
    contextTag: 'finale_altar',
    lines: [
      {
        en: 'From the whisper of oaks to the hush of reeds and warmth of canyon clay, every ecosystem answers in serene balance!',
        vi: 'Từ tiếng rì rào rừng sồi tới nhịp sậy đầm sâu và hơi ấm đất nung, mọi hệ sinh thái đều đáp lời trong thế cân bằng tĩnh tại!',
        focusWords: ['reed', 'warm', 'clay', 'serene', 'balance'],
        action: { kind: 'set_flag', flag: 'main_story_completed' },
      },
      {
        en: 'A noble crystalline stag steps onto the starlit terrace. Solacern gazes at you with calm curiosity!',
        vi: 'Một linh lộc gạc pha lê uy nghi bước lên thềm đá đầy sao. Solacern nhìn bạn bằng ánh mắt điềm tĩnh và tò mò!',
        focusWords: ['noble', 'stag', 'terrace', 'calm', 'curious'],
        choices: [
          {
            labelEn: 'Greet Guardian Solacern in a wild encounter',
            labelVi: 'Chào đón Linh lộc Solacern trong cuộc gặp tự nhiên',
            action: {
              kind: 'trigger_wild_encounter',
              speciesId: 'solacern',
              level: 24,
              onceFlag: 'met_altar_solacern',
            },
          },
          {
            labelEn: 'Celebrate the restored basin peacefully',
            labelVi: 'Lặng lẽ tận hưởng khoảnh khắc hòa hợp trọn vẹn',
            nextDialogueId: 'finale_credits_summary',
          },
        ],
      },
    ],
  },
  {
    id: 'finale_credits_summary',
    speaker: 'Field Expedition Chronicle',
    speakerRoleVi: 'Biên niên sử hành trình',
    cefr: 'B1',
    regionId: 'starfall_sanctuary',
    contextTag: 'finale_credits',
    lines: [
      {
        en: 'Congratulations, Basin Naturalist! You restored harmony across Verdant Basin while experiencing English naturally in context.',
        vi: 'Chúc mừng Nhà tự nhiên học! Bạn đã khôi phục sự hòa hợp khắp Thung Lũng Rêu Xanh qua hành trình tiếng Anh giàu ngữ cảnh.',
        focusWords: ['harmony', 'basin', 'experience', 'context'],
      },
      {
        en: 'Your expedition continues freely: explore secret chests, evolve all thirty Wildkin, or relax beside any campfire!',
        vi: 'Chuyến thám hiểm vẫn mở rộng tự do: hãy tìm rương ẩn, tiến hóa đủ ba mươi loài hoặc thư giãn bên lửa trại nhé!',
        focusWords: ['expedition', 'explore', 'chest', 'evolve', 'campfire'],
      },
    ],
  },
];

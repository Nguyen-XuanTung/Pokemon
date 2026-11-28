# Ghi công và nguồn gốc tài nguyên

## 1. Phân định giấy phép mã nguồn và giấy phép tài nguyên hình ảnh

- Giấy phép mã nguồn phần mềm và nội dung văn bản nguyên bản: Toàn bộ mã nguồn trong `src/`, `scripts/`, `tests/`, `public/sw.js`, âm thanh tổng hợp bằng Web Audio API cùng toàn bộ dữ liệu hội thoại, cốt truyện, nghĩa tiếng Việt và câu ví dụ tiếng Anh, tiếng Trung biên soạn nguyên bản cho dự án LingoWild được phát hành theo giấy phép MIT trong tệp `LICENSE`.
- Giấy phép tài nguyên hình ảnh bên thứ ba: Tệp `LICENSE` (MIT) chỉ điều chỉnh mã nguồn và các tài nguyên do dự án tự tạo mới; các gói hình ảnh mở trong `assets-src/` và phần đồ họa trích xuất vào `public/assets/sprites/` giữ nguyên giấy phép riêng của từng tác giả gốc (CC0 1.0 Universal và CC-BY 3.0 / CC-BY 4.0). Bất kỳ bản sao hoặc bản phân phối lại nào có sử dụng các bảng ảnh này đều phải giữ nguyên tệp `CREDITS.md` cùng các tệp `ATTRIBUTION.txt` đi kèm trong `assets-src/`.
- Tham khảo thiết kế trò chơi: Quá trình thiết kế có nghiên cứu nguyên lý bố cục bản đồ, phân tầng cảnh vật, nhịp chiến đấu và giao diện của Pokémon Emerald, Pokémon HeartGold, Pokémon Black 2, Stardew Valley, Eastward, Cassette Beasts và Coromon. Dự án chỉ tham khảo nguyên lý thiết kế, tuyệt đối không sao chép hình ảnh, âm thanh, nhân vật hay dữ liệu thương mại.
- LingoWild là tên làm việc tạm thời phục vụ phát triển và nghiên cứu, không có bất kỳ liên hệ nào với The Pokémon Company, Nintendo hay các thương hiệu bên thứ ba.

## 2. Nguồn gốc các bộ tài nguyên pixel mã mở và phần biên soạn riêng

Kịch bản `scripts/generate-assets.ts` đóng gói tám bảng ảnh trong `public/assets/sprites/` (`tileset.png`, `structures.png`, `battle-bg.png`, `characters.png`, `creatures.png`, `companions.png`, `items.png`, `vfx.png`) từ các bộ tài nguyên mở đã xác minh giấy phép lưu tại `assets-src/` kết hợp hình vẽ pixel biên soạn riêng:

1. Gói `Roguelike/RPG Pack` của Kenney (`assets-src/kenney-roguelike-cc0/roguelikeSheet_transparent.png`):
   - Tác giả: Kenney Vleugels (`https://kenney.nl/assets/roguelike-rpg-pack`).
   - Giấy phép: CC0 1.0 Universal, lưu kèm tại `assets-src/kenney-roguelike-cc0/License.txt`.
   - Phần sử dụng và chỉnh sửa: Trích xuất thảm cỏ nhiều sắc độ, mặt nước lấp lánh, bờ nước tự nối, cầu ván gỗ qua suối, thuyền gỗ neo bến, tán cây hai lớp, bụi cỏ cao, lửa trại và hoa dại; cân chỉnh bảng màu ấm để đồng bộ giữa năm vùng sinh thái.
2. Gói `Tiny 16: Basic` của Lanea Zimmerman, bút danh Sharm (`assets-src/sharm-tiny16-ccby/`):
   - Tác giả: Lanea Zimmerman / Sharm (`https://opengameart.org/content/tiny-16-basic`).
   - Giấy phép: CC-BY 3.0 / CC-BY 4.0, lưu kèm tại `assets-src/sharm-tiny16-ccby/ATTRIBUTION.txt`.
   - Phần sử dụng và chỉnh sửa: Sử dụng khung hoạt ảnh bước đi bốn hướng từ `characters_1.png`, rương gỗ và đài lửa từ `things_0.png`, cùng vách đá phân tầng, bậc thang đá, tảng đá thực địa, đá lát rêu cổ và ván gỗ cầu đầm lầy từ `basictiles_2.png`; phối lại màu trang phục kiểm lâm cho nhân vật chính và 16 nhân vật phụ trong `characters.png`.
3. Gói `Zelda-like tilesets and sprites` của ArMM1998 (`assets-src/armm-zelda-cc0/`):
   - Tác giả: ArMM1998 (`https://opengameart.org/content/zelda-like-tilesets-and-sprites`).
   - Giấy phép: CC0 1.0 Universal, lưu kèm tại `assets-src/armm-zelda-cc0/LICENSE.txt`.
   - Phần sử dụng và chỉnh sửa: Trích xuất kiến trúc nhà gỗ kiểm lâm `5x5`, chòi gỗ `2x3`, quầy hàng mái bạt kẻ, cổng vòm đá cổ `4x4`, đài phun nước đá hoạt ảnh ba nhịp, ghế gỗ dài, thân cây đổ rỗng, tượng đá hộ vệ, thác nước `3x3`, bụi cây tròn, gốc cây rêu, chậu hoa và thùng gỗ ghép vào `structures.png` và `tileset.png`.
4. Các lớp phông nền chiến đấu pixel mở trong `assets-src/battle-backgrounds/` ghép thành năm sân đấu vùng trong `battle-bg.png` (chi tiết lưu tại `assets-src/battle-backgrounds/ATTRIBUTION.txt`):
   - `Battle Background - Hazy Hills` (`ansimuz-sunny-hills.png`) của Luis Zuno (`@ansimuz`, `https://opengameart.org/content/battle-background-hazy-hills-0`), giấy phép CC-BY 3.0: dùng làm nền đồi rừng mờ sương cho sân đấu `Whisperwood Glen`.
   - `Gothicvania Swamp` (`ansimuz-swamp-bg.png`, `ansimuz-swamp-mid.png`) của Luis Zuno (`@ansimuz`, `https://opengameart.org/content/gotthicvania-swamp`), giấy phép CC0 1.0: dùng làm lớp tán cây đầm lầy cho sân đấu `Reedwater Fen`.
   - `Parallax Backgrounds` (`admurin-plains/`, `admurin-dock/`, `admurin-mountains/`) của Admurin (`https://opengameart.org/content/parallax-backgrounds`), giấy phép CC-BY 4.0: dùng các lớp núi xa, đồng cỏ, cọc gỗ bến nước và đỉnh núi đêm cho sân đấu `Mosslight Camp`, `Reedwater Fen`, `Terracotta Ridge` và `Starfall Sanctuary`.
   - `Sunset Temple Tiles` (`pyromantic-sunset-clouds.png`) của Pyromantic (`https://opengameart.org/content/sunset-temple-tiles`), giấy phép CC0 1.0 / CC-BY 3.0: dùng làm tầng mây hoàng hôn hẻm núi cho sân đấu `Terracotta Ridge`.
5. Phần đồ họa pixel biên soạn nguyên bản của dự án:
   - Toàn bộ 30 loài sinh vật trong trận đấu (`creatures.png`, khung `48x48` hai nhịp thở kèm biến thể ánh kim tự nhiên), bảng sinh vật nhỏ đi theo sau nhân vật trên bản đồ (`companions.png`, 60 khung `16x16`), dấu chân sinh cảnh phát sáng, hàng rào gỗ, gạch đá đen chạm cổ ngữ, vật phẩm đặc thù (`items.png`) và hiệu ứng nguyên tố (`vfx.png`).
6. Nhạc nền và hiệu ứng âm thanh: Tổng hợp thời gian thực bằng Web Audio API trong `src/audio/soundEngine.ts`, không sử dụng tệp thu âm có bản quyền của bên thứ ba.
7. Phát âm tiếng Anh và tiếng Trung: Sử dụng Web Speech API có sẵn trên trình duyệt của người chơi. Với tiếng Trung, bộ phát âm lọc nghiêm ngặt giọng `zh-CN` / `zh-Hans` / `zh` và hiển thị Pinyin kèm ghi chú nếu thiết bị thiếu giọng đọc thay vì dùng giọng tiếng Anh.

## 3. Nguồn gốc dữ liệu ngôn ngữ tiếng Anh và tiếng Trung

### Tiếng Anh (CEFR A1 đến B2)
- Toàn bộ 367 mục từ vựng và cụm từ giao tiếp Anh Việt (`src/data/lexicon-*.ts`, gồm các mục đa nghĩa theo ngữ cảnh và 25 mục có nhiều câu ví dụ độc lập), từ điển gốc từ bỏ túi ngoại tuyến hơn 430 mục (`src/data/pocket-dict.ts`) phủ `90,5%` từ xuất hiện trong hội thoại, 42 mô tả chiêu thức (`src/data/moves.ts`), 13 mô tả vật phẩm (`src/data/items.ts`), 30 hồ sơ và truyện ngắn sinh thái (`src/data/species.ts`) cùng 192 đoạn hội thoại có biến thể theo trình độ (`src/data/dialogues-*.ts`) đều được biên soạn mới gắn với thế giới Thung Lũng Rêu Xanh.
- Không nhập kho dữ liệu mang điều khoản copyleft từ `wordfreq` hay `Tatoeba`.

### Tiếng Trung giản thể (chuẩn HSK 2.0, Hanban 2012)
- Danh mục đầu mục và đối chiếu phiên âm Pinyin được kiểm chứng từ hai kho công khai có giấy phép rõ ràng (truy xuất ngày `2026-11-28`, kiểm định tự động bằng `scripts/verify-hsk-data.ts`):
  - `sawcordwell/HSK-Vocab` (`https://github.com/sawcordwell/HSK-Vocab`, commit `bd786242a80ca3af65515712b70493c39d369393`, giấy phép CC0 1.0 Universal): đối chiếu đủ danh mục đầu mục `HSK 1` (`150` từ), `HSK 2` (`150` từ) và `HSK 3` (`300` mục gồm `298` đầu mục riêng biệt và `2` cách đọc đa âm chính thức `还 huán`, `长 zhǎng`).
  - `drkameleon/complete-hsk-vocabulary` (`https://github.com/drkameleon/complete-hsk-vocabulary`, commit `7ac65bf1a6387d35f1ade478906172a19311c7f9`, giấy phép MIT): đối chiếu phiên âm Pinyin có dấu thanh và phân cấp chuẩn HSK 2.0. Dự án không sao chép nghĩa tiếng Anh từ CC-CEDICT (CC BY-SA 4.0) mà biên soạn mới toàn bộ nghĩa tiếng Việt, ghi chú ngữ cảnh và câu ví dụ tiếng Trung gắn với LingoWild theo giấy phép MIT.
- Bộ dữ liệu trong `src/data/zh-lexicon-*.ts`, `src/data/zh-world-content.ts` và `src/data/zh-dialogues-*.ts` gồm `985` mục từ điển (`150` HSK 1, `150` HSK 2, `298 + 2` đa âm HSK 3, `73` từ bổ trợ HSK 4 và `314` từ ngữ cảnh không gán HSK), `55` tên riêng trong thế giới game tách riêng khỏi HSK và toàn bộ `192` đoạn hội thoại, `30` loài, `42` chiêu, `13` vật phẩm, `12` nhiệm vụ, `5` bản đồ, `16` nhân vật phụ cùng nhật ký chiến đấu.
- Nhãn CEFR và HSK 2.0 chỉ dùng để điều chỉnh độ khó câu thoại và gợi ý từ trong game, không phải chứng nhận đánh giá năng lực ngoại ngữ.

## 4. Thư viện mã nguồn mở sử dụng

- `phaser` phiên bản `3.90.0`: Photon Storm Ltd / Phaser Studio Inc, giấy phép MIT.
- `vite` phiên bản `8.4.0` dùng khi đóng gói: Evan You và cộng sự, giấy phép MIT.
- `typescript` phiên bản `5.8.3` dùng khi kiểm tra kiểu: Microsoft Corporation, giấy phép Apache-2.0.
- `vitest` và `@vitest/coverage-v8` phiên bản `5.1.2` dùng khi kiểm thử và đo độ phủ: Đội ngũ Vitest, giấy phép MIT.
- `@playwright/test` phiên bản `1.65.1` dùng khi kiểm thử trình duyệt và ghi hình thực tế: Microsoft Corporation, giấy phép Apache-2.0.

## 5. Tài liệu tham khảo kiến trúc

- Trong giai đoạn nghiên cứu độc lập tại `docs/TECHNICAL_DECISION.md`, nhóm có khảo sát cấu trúc máy trạng thái lượt đấu từ `devshareacademy/monster-tamer` và cách tách dữ liệu cấu hình trong `Tuxemon`, nhưng không sao chép tệp mã nguồn hay tài nguyên nào từ các kho đó vào sản phẩm.

# Ghi công và nguồn gốc tài nguyên

## 1. Mã nguồn và thiết kế trò chơi

- Toàn bộ kiến trúc miền nghiệp vụ, công thức chiến đấu, hệ thống thu phục, bộ điều khiển ô lưới, giao diện sổ thực địa, bộ lập lịch từ vựng thích ứng và bộ kiểm thử tự động trong kho mã này được biên soạn nguyên bản cho dự án LingoWild, phát hành theo giấy phép MIT trong tệp `LICENSE`.
- Quá trình nâng cấp trải nghiệm có nghiên cứu nhịp khám phá, cách dẫn dắt ánh nhìn và bố cục giao diện của Pokémon Emerald, Pokémon HeartGold, Stardew Valley, Eastward, Cassette Beasts, Coromon và Nexomon. Nhóm chỉ học hỏi nguyên lý thiết kế, tuyệt đối không sao chép hình ảnh, âm thanh, nhân vật hay dữ liệu thương mại.
- LingoWild là tên làm việc tạm thời phục vụ phát triển và nghiên cứu, không có bất kỳ liên hệ nào với The Pokémon Company, Nintendo hay các thương hiệu bên thứ ba.

## 2. Nguồn gốc bộ tài nguyên pixel mã mở và phần biên soạn riêng

Kịch bản `scripts/generate-assets.ts` đóng gói năm bảng ảnh trong `public/assets/sprites/` (`tileset.png`, `characters.png`, `creatures.png`, `items.png`, `vfx.png`) từ hai gói tài nguyên pixel mã mở đã xác minh giấy phép lưu tại `assets-src/` kết hợp hình vẽ nguyên bản của dự án:

1. Gói `Roguelike/RPG Pack` của Kenney (`assets-src/kenney-roguelike-cc0/roguelikeSheet_transparent.png`):
   - Tác giả: Kenney Vleugels (`https://kenney.nl/assets/roguelike-rpg-pack`).
   - Giấy phép: CC0 1.0 Universal, xem tệp `assets-src/kenney-roguelike-cc0/License.txt`.
   - Phần sử dụng và chỉnh sửa: Trích xuất thảm cỏ, mặt nước, bờ nước tự động 16 trạng thái, đường mòn uốn lượn 16 trạng thái, cầu gỗ, thuyền gỗ, mái nhà trại, tán cây hai lớp và hoa dại; cân chỉnh lại sắc độ ấm để đồng nhất bảng màu rừng rêu và đất nung của LingoWild.
2. Gói `Tiny 16: Basic` của Lanea Zimmerman, bút danh Sharm (`assets-src/sharm-tiny16-ccby/`):
   - Tác giả: Lanea Zimmerman / Sharm (`https://opengameart.org/content/tiny-16-basic`).
   - Giấy phép: CC-BY 3.0 / CC-BY 4.0, xem tệp `assets-src/sharm-tiny16-ccby/ATTRIBUTION.txt`.
   - Phần sử dụng và chỉnh sửa: Sử dụng khung hoạt ảnh bước đi 4 hướng từ `characters_1.png`, rương gỗ, lửa trại và vật dụng từ `things_0.png`, cùng vách đá tự nhiên từ `basictiles_2.png`; phối lại màu trang phục kiểm lâm cho nhân vật chính và 16 nhân vật phụ trong `characters.png`.
3. Toàn bộ 30 loài sinh vật (`creatures.png`, 60 khung hình `48x48` có đổ bóng và hoạt ảnh thở khi chờ), một phần vật phẩm đặc thù (`items.png`), hiệu ứng nguyên tố chiến đấu (`vfx.png`), ô cát hẻm núi và gạch lát quảng trường là hình vẽ pixel biên soạn nguyên bản cho dự án.
4. Nhạc nền và hiệu ứng âm thanh: Tổng hợp thời gian thực bằng Web Audio API trong `src/audio/soundEngine.ts`, không sử dụng tệp thu âm có bản quyền của bên thứ ba.
5. Phát âm tiếng Anh: Sử dụng Web Speech API có sẵn trên trình duyệt của người chơi cho cả từ đơn, cụm từ lẫn câu hội thoại hoàn chỉnh, kèm cơ chế hiển thị phiên âm dự phòng khi thiết bị thiếu giọng đọc.

## 3. Nguồn gốc dữ liệu ngôn ngữ

- Toàn bộ 343 mục từ vựng và cụm từ Anh Việt (`src/data/lexicon-*.ts`, gồm cả các mục đa nghĩa theo ngữ cảnh), 42 mô tả chiêu thức (`src/data/moves.ts`), 13 mô tả vật phẩm (`src/data/items.ts`), 30 hồ sơ sinh thái (`src/data/species.ts`) và 179 đoạn hội thoại có biến thể theo trình độ (`src/data/dialogues-*.ts`) đều được biên soạn mới gắn với thế giới Thung Lũng Rêu Xanh.
- Không nhập tự động kho dữ liệu mang điều khoản copyleft từ `wordfreq` hay `Tatoeba`. Nhãn mức độ từ A1 đến B2 chỉ dùng để điều chỉnh độ phức tạp câu thoại và chọn từ gợi ý, không phải chứng nhận đánh giá năng lực ngoại ngữ.

## 4. Thư viện mã nguồn mở sử dụng

- `phaser` phiên bản `3.90.0`: Photon Storm Ltd / Phaser Studio Inc, giấy phép MIT.
- `vite` phiên bản `8.4.0` dùng khi đóng gói: Evan You và cộng sự, giấy phép MIT.
- `typescript` phiên bản `5.8.3` dùng khi kiểm tra kiểu: Microsoft Corporation, giấy phép Apache-2.0.
- `vitest` và `@vitest/coverage-v8` phiên bản `5.1.2` dùng khi kiểm thử và đo độ phủ: Đội ngũ Vitest, giấy phép MIT.
- `@playwright/test` phiên bản `1.65.1` dùng khi kiểm thử trình duyệt: Microsoft Corporation, giấy phép Apache-2.0.

## 5. Tài liệu tham khảo kiến trúc

- Trong giai đoạn nghiên cứu độc lập tại `docs/TECHNICAL_DECISION.md`, nhóm có khảo sát cấu trúc máy trạng thái lượt đấu từ `devshareacademy/monster-tamer` và cách tách dữ liệu cấu hình trong `Tuxemon`, nhưng không sao chép tệp mã nguồn hay tài nguyên nào từ các kho đó vào sản phẩm.

# Ghi công và nguồn gốc tài nguyên

## 1. Mã nguồn và thiết kế trò chơi

- Toàn bộ kiến trúc miền nghiệp vụ, công thức chiến đấu, hệ thống thu phục, bộ điều khiển ô lưới, giao diện sổ thực địa, trình sinh tài nguyên pixel và bộ kiểm thử tự động trong kho mã này là tác phẩm biên soạn nguyên bản cho dự án LingoWild, phát hành theo giấy phép MIT (xem tệp `LICENSE`).
- LingoWild là tên làm việc tạm thời phục vụ phát triển và nghiên cứu, không có bất kỳ liên hệ nào với The Pokémon Company, Nintendo hay các thương hiệu bên thứ ba.

## 2. Nguồn gốc hình ảnh, sinh vật và âm thanh

- Hình ảnh bản đồ, nhân vật, biểu tượng vật phẩm và toàn bộ 30 loài sinh vật (`Mosskit` đến `Solacern`): Được biên soạn nguyên bản và xuất tự động thành tệp PNG qua kịch bản `scripts/generate-assets.ts` nằm ngay trong kho mã nguồn. Không sao chép hình vẽ, bảng màu thương hiệu, bản đồ hay biểu trưng từ bất kỳ trò chơi thương mại hoặc gói tài nguyên hạn chế quyền tái phân phối nào.
- Nhạc nền và hiệu ứng âm thanh: Tổng hợp thời gian thực bằng Web Audio API trong `src/audio/soundEngine.ts`, không sử dụng tệp thu âm có bản quyền của bên thứ ba.
- Phát âm từ vựng tiếng Anh: Sử dụng Web Speech API có sẵn trên trình duyệt của người chơi kèm cơ chế hiển thị phiên âm quốc tế dự phòng khi thiết bị không có giọng đọc.

## 3. Nguồn gốc dữ liệu ngôn ngữ

- Toàn bộ 321 mục từ vựng Anh Việt (`src/data/lexicon-*.ts`), 42 mô tả chiêu thức (`src/data/moves.ts`), 13 mô tả vật phẩm (`src/data/items.ts`), 30 ghi chép sinh thái (`src/data/species.ts`) và 174 đoạn hội thoại ngữ cảnh (`src/data/dialogues-*.ts`) đều được biên soạn mới gắn trực tiếp với thế giới Thung Lũng Rêu Xanh của LingoWild.
- Không nhập tự động kho dữ liệu mang điều khoản copyleft từ `wordfreq` (CC-BY-SA 4.0) hoặc `Tatoeba` (CC-BY 2.0 FR). Nhãn mức độ từ A1 đến B2 trong trò chơi chỉ mang tính tham chiếu hỗ trợ chọn lọc hiển thị, không phải chứng nhận đánh giá năng lực ngôn ngữ.

## 4. Thư viện mã nguồn mở sử dụng

- `phaser` phiên bản `3.90.0`: Tác giả Photon Storm Ltd / Phaser Studio Inc, giấy phép MIT.
- `vite` phiên bản `6.3.5` (chỉ dùng khi đóng gói): Tác giả Evan You và cộng sự, giấy phép MIT.
- `typescript` phiên bản `5.8.3` (chỉ dùng khi kiểm tra kiểu): Microsoft Corporation, giấy phép Apache-2.0.
- `vitest` phiên bản `3.1.4` (chỉ dùng khi kiểm thử): Đội ngũ Vitest, giấy phép MIT.
- `@playwright/test` phiên bản `1.65.1` (chỉ dùng khi kiểm thử trình duyệt): Microsoft Corporation, giấy phép Apache-2.0.

## 5. Tài liệu tham khảo ý tưởng kỹ thuật

- Trong giai đoạn nghiên cứu độc lập (`docs/TECHNICAL_DECISION.md`), nhóm có khảo sát cấu trúc máy trạng thái lượt đấu từ `devshareacademy/monster-tamer` (MIT) và cách tách dữ liệu cấu hình trong `Tuxemon` (GPL-3.0), nhưng không sao chép bất kỳ tệp mã nguồn hay tài nguyên nào từ các kho đó vào sản phẩm.

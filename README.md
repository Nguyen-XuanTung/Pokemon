# LingoWild

LingoWild là trò chơi nhập vai thu phục sinh vật 2D chạy trực tiếp trên trình duyệt web, kết hợp tiếp thu tiếng Anh tự nhiên ngay trong ngữ cảnh thám hiểm. Người chơi dạo bước qua năm vùng sinh thái liên thông, trò chuyện với đoàn kiểm lâm, đọc manh mối trên biển gỗ và điểm quan sát, chiến đấu theo lượt, kết bạn với sinh vật hoang dã bằng chuông cộng hưởng và khôi phục sự cân bằng cho Thung Lũng Rêu Xanh mà không bao giờ bị chặn đường bởi bài kiểm tra từ vựng bắt buộc.

## Tính năng đã triển khai và kiểm thử

- Thế giới tự nhiên 5 vùng cỡ `32x24`: Khu trại trung tâm `Mosslight Camp` kết nối hai chiều với `Whisperwood Glen`, `Reedwater Fen`, `Terracotta Ridge` và `Starfall Sanctuary`. Bản đồ có đường mòn uốn lượn tự nối 16 hướng, bờ suối cong, cây cổ thụ hai lớp che tán phía trên nhân vật, mái trại, cầu gỗ, thuyền neo, điểm ngắm cảnh, rương ẩn, chu kỳ sáng trưa chiều đêm và máy quay bám theo bước chân.
- Hệ thống sinh vật và chiến đấu: 30 loài sinh vật nguyên bản khung hình `48x48` có hoạt ảnh nhịp thở, phân loại độ hiếm và vai trò chiến thuật; 42 chiêu thức thuộc 6 nguyên tố đối xứng; 5 sân đấu vẽ riêng theo từng vùng kèm đòn bay nguyên tố, số sát thương nổi, hoạt ảnh thu phục thành công hoặc bung chuông và tùy chọn nhịp trận đấu `1x`, `2x` hoặc tức thì.
- Tuyến truyện hoàn chỉnh: 16 nhân vật phụ, 12 nhiệm vụ chính và phụ có điểm kết thúc rõ ràng, 3 thủ lĩnh vùng cùng bài khảo nghiệm cuối tại Thánh Địa Sao Rơi. Đã kiểm chứng khả năng phá đảo tự nhiên cho cả ba sinh vật khởi đầu.
- Cơ chế tiếng Anh thích ứng: 343 mục từ vựng và cụm từ thông dụng kèm giải nghĩa đa nghĩa theo ngữ cảnh, phiên âm, từ loại, ví dụ trong game và 179 đoạn hội thoại có biến thể câu từ A1 đến B2. Tách bạch số lần bắt gặp thụ động với mức độ ghi nhớ chủ động; bộ lập lịch tự động đưa các từ người chơi từng tra cứu hoặc lưu lại xuất hiện tự nhiên ở các điểm ngắm cảnh và lửa trại tiếp theo; hỗ trợ đọc phát âm cả từ đơn lẫn cả câu hội thoại.
- Giao diện sổ tay thực địa và di động: Thiết kế khung gỗ ấm và giấy kem đồng nhất từ màn hình mở đầu, thanh trạng thái gọn, hộp thoại, túi đồ, đội hình, bản đồ la bàn 5 vùng, sổ từ vựng đến màn hình chúc mừng cuối truyện. Trên di động, khung vẽ tự co giãn khít màn hình dọc lẫn ngang, thông báo dạng viên thuốc nhỏ gọn không che khu vực chơi và cụm phím chữ thập trực quan vận hành trọn vẹn không cần bàn phím cứng.
- Lưu trữ an toàn và chạy ngoại tuyến: Kiểm định sâu toàn bộ cấu trúc tệp lưu và khóa tham chiếu, bảo vệ bản lưu hợp lệ khi nhập tệp lỗi, ưu tiên bản lưu mới hơn trên bộ nhớ tạm khi trình duyệt khóa ghi đĩa, trình phục vụ ngoại tuyến chỉ quản lý bộ nhớ đệm riêng của LingoWild và không trả nhầm trang HTML cho yêu cầu mã nguồn hay hình ảnh lỗi.

## Ảnh chụp màn hình thực tế

![Màn hình hội thoại và tra từ ngữ cảnh](docs/screenshots/02-contextual-gloss.png)

![Khám phá rừng sồi nhiều lớp tại Whisperwood Glen](docs/screenshots/04-whisperwood-overworld.png)

![Sân đấu theo vùng và chiêu thức tương tác](docs/screenshots/05-wild-battle.png)

![Sổ thực địa và bách khoa 30 loài sinh vật](docs/screenshots/07-field-journal-compendium.png)

Xem đầy đủ bộ 13 ảnh chụp thực tế trên máy tính và di động dọc ngang trong thư mục `docs/screenshots/`.

## Yêu cầu hệ thống và lệnh chạy

Cần cài đặt Node.js phiên bản `22.6` trở lên, đã kiểm thử trên Node.js `v24.14.0` và npm `11.9.0`.

```bash
# Cài đặt gói phụ thuộc từ tệp khóa phiên bản
npm ci --ignore-scripts

# Kiểm tra lỗ hổng phụ thuộc
npm audit

# Chạy máy chủ phát triển cục bộ tại http://localhost:5173
npm run dev

# Sinh bảng ảnh pixel, kiểm định dữ liệu, kiểm tra kiểu, đóng gói dist/ và chèn danh mục ngoại tuyến
npm run build

# Xem thử bản đóng gói tại http://127.0.0.1:4173
npm run preview

# Chạy kiểm tra quy tắc dự án, kiểm thử kèm độ phủ mã nguồn và kiểm thử trình duyệt đầu cuối
npm run lint
npm run test:coverage
npm run test:e2e
```

## Tài liệu dự án

- [Hướng dẫn chơi chi tiết](docs/HOW_TO_PLAY.md)
- [Quyết định kỹ thuật và kiến trúc nâng cấp](docs/TECHNICAL_DECISION.md)
- [Báo cáo kiểm thử, độ phủ và đánh giá chơi thử](docs/TEST_REPORT.md)
- [Danh mục kiểm tra bàn giao](docs/RELEASE_CHECKLIST.md)
- [Ghi công và nguồn gốc tài nguyên](CREDITS.md)
- [Nghiên cứu sản phẩm ban đầu](docs/RESEARCH.md)
- [Quy tắc triển khai](AGENTS.md)

## Giới hạn và lưu ý pháp lý

- Thời lượng hoàn thành tuyến chính khoảng 25 đến 45 phút nếu đi thẳng mục tiêu, hoặc 60 đến 90 phút khi khám phá trọn vẹn 30 loài, mở hết rương ẩn, tìm các điểm ngắm cảnh và hoàn thành cả 12 nhiệm vụ.
- Trò chơi vận hành hoàn toàn phía máy khách cho một người chơi, không có máy chủ tài khoản hay đồng bộ đám mây tự động. Âm thanh dùng bộ tổng hợp Web Audio và giọng đọc tiếng Anh phụ thuộc vào trình duyệt trên thiết bị.
- Nhãn mức độ từ A1 đến B2 trong cài đặt chỉ dùng để điều chỉnh độ phức tạp câu thoại và gợi ý từ trong game, không phải chứng chỉ đánh giá năng lực ngoại ngữ và chưa qua thử nghiệm lâm sàng độc lập trên người học.
- Tên gọi LingoWild là tên làm việc tạm thời, chưa đăng ký nhãn hiệu. Dự án hoàn toàn độc lập và không có bất kỳ mối liên hệ nào với The Pokémon Company hay Nintendo.

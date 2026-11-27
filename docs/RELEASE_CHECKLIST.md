# Danh mục kiểm tra trước bàn giao phiên bản 1.0

## 1. Kiến trúc và an toàn chuỗi cung ứng

- [x] Đã thực hiện kiểm toán độc lập các kho mã nguồn mở và ghi nhận bằng chứng thực tế trong `docs/TECHNICAL_DECISION.md`.
- [x] Không sử dụng tệp `log.js` gửi dữ liệu theo dõi ngầm từ mẫu khởi tạo bên ngoài.
- [x] Tách biệt hoàn toàn tầng miền nghiệp vụ (`src/domain/`) khỏi tầng dựng hình Phaser (`src/scenes/`) và tầng giao diện sổ thực địa (`src/ui/`).
- [x] Bộ sinh số giả ngẫu nhiên có hạt giống xác định (`SeededRng`), không gọi mạng trong chiến đấu hay thu phục.
- [x] Khóa chặt phiên bản phụ thuộc trong `package.json` và `package-lock.json`, cài đặt an toàn với cờ bỏ qua kịch bản hậu cài đặt lạ.
- [x] Không chứa khóa bí mật, mã thông báo dịch vụ ngoài hay thu thập dữ liệu cá nhân trong mã máy khách.

## 2. Phạm vi nội dung và trải nghiệm cốt lõi

- [x] Đủ 1 khu trại trung tâm (`Mosslight Camp`) và 4 vùng sinh thái liên kết hai chiều (`Whisperwood Glen`, `Reedwater Fen`, `Terracotta Ridge`, `Starfall Sanctuary`).
- [x] Đủ 30 loài sinh vật nguyên bản (gồm 3 loài khởi đầu tiến hóa 3 bậc và 21 loài hoang dã), tất cả đều có thể thu phục được trong chế độ chơi đơn.
- [x] Đủ 42 chiêu thức thuộc 6 nguyên tố cân bằng đối xứng (mỗi hệ thắng 2 hệ và yếu trước 2 hệ) cùng 4 trạng thái chiến đấu.
- [x] Đủ 16 nhân vật phụ có tên riêng, 12 nhiệm vụ có điểm kết thúc và phần thưởng rõ ràng, 3 Thủ lĩnh vùng và 1 Trưởng lão khảo nghiệm cuối tại thánh địa.
- [x] Đủ 321 mục từ vựng Anh Việt biên soạn theo ngữ cảnh trò chơi (phân bổ từ A1 đến B2) và 174 đoạn hội thoại, biển chỉ đường, văn bia, hồ sơ thực địa.
- [x] Đảm bảo triết lý đặt trò chơi lên trước: không bao giờ chặn tiến trình hay biến thao tác bắt sinh vật thành bài kiểm tra từ vựng.

## 3. Đồ họa, âm thanh, điều khiển và trợ năng

- [x] Hình ảnh pixel thống nhất bảng màu rừng rêu, đất nung, kem giấy và nước suối; không dùng thẻ quản trị, chuyển sắc tím, hiệu ứng kính mờ hay biểu tượng cảm xúc thay hình vẽ.
- [x] Hỗ trợ điều khiển bàn phím (cụm mũi tên, `WASD`, cho phép đổi phím trực tiếp trong cài đặt) và cụm phím cảm ứng tự động trên thiết bị di động.
- [x] Hỗ trợ chế độ độ tương phản cao, giảm chuyển động, phóng to cỡ chữ, thanh trượt âm lượng nhạc nền riêng, thanh trượt hiệu ứng riêng và nút tắt tiếng hoàn toàn.
- [x] Phát âm từ tiếng Anh qua Web Speech API kèm thông báo phiên âm dự phòng khi trình duyệt không có giọng đọc.

## 4. Lưu trữ, triển khai tĩnh và kiểm thử cổng nghiệm thu

- [x] Tầng lưu trữ có số hiệu phiên bản, mã kiểm tra toàn vẹn FNV-1a, bản sao lưu tự động khôi phục khi bản lưu chính bị hỏng, giới hạn kích thước chống tràn và chế độ lưu tạm trên RAM khi bộ nhớ trình duyệt đầy.
- [x] Hỗ trợ xuất và nhập tệp lưu định dạng `.json` có kiểm tra cấu trúc nghiêm ngặt.
- [x] Đường dẫn tài nguyên tương đối tương thích triển khai tĩnh trên GitHub Pages dưới thư mục con `/Pokemon/` kèm trình phục vụ bộ nhớ đệm ngoại tuyến `public/sw.js`.
- [x] Chạy thực tế kiểm tra dữ liệu (`validate:data`), quy tắc dự án (`lint`), kiểm tra kiểu nghiêm ngặt (`typecheck`), kiểm thử đơn vị, kiểm thử tích hợp xuyên suốt cốt truyện và kiểm thử trình duyệt thực tế trên máy tính cùng thiết bị di động.
- [x] Mọi thay đổi thực hiện trên nhánh `develop/lingowild`, giữ nguyên lịch sử git, không tự ý gộp vào nhánh `main`.

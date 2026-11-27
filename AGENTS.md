# Quy tắc triển khai
- Đọc docs/RESEARCH.md. Nghiên cứu và xác minh trước khi chọn nền code.
- Code TypeScript strict, tên rõ nghĩa, module nhỏ, tránh abstraction thừa, không tạo file v2 trùng chức năng.
- Tài liệu tiếng Việt tự nhiên. Không em dash, en dash, emoji trang trí, viết hoa tùy tiện, ngoặc giải nghĩa tiếng Anh thừa hoặc giọng quảng cáo. Không áp quy tắc văn phong lên cú pháp code.
- Tận dụng thư viện và skill hợp lệ sau khi đọc source, license, quyền truy cập và rủi ro supply chain. Không chạy script lạ không kiểm tra. Pin version/lockfile. Không nhập asset hoặc corpus thiếu quyền.
- Không secrets, không API key trong client. Không dùng dữ liệu cá nhân. Không scrape vượt điều khoản, robots, rate limit hoặc login.
- Tự quyết định chi tiết nhỏ, ghi quyết định quan trọng và lý do. Không hỏi chủ dự án từng việc nhỏ. Không xóa dữ liệu hoặc thay đổi cấu hình tài khoản.
- Mỗi milestone có kiểm thử thực tế, ghi nhận kết quả thật. Không fake benchmark, screenshot, test pass. Không dùng placeholder cho release.
- Làm trên branch develop/lingowild, không force push, không merge main trước nghiệm thu. Giữ worklog nội bộ ngoài repo nếu không cần cho người dùng.

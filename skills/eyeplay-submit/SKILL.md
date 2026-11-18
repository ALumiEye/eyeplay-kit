---
name: eyeplay-submit
description: Đóng gói và nộp game cho EyePlay (play.alumieye.com) - chạy tools/verify.js lần cuối, kiểm tra eyeplay.json, tạo file zip gồm thư mục build và eyeplay.json, soạn thông tin gửi đội EyePlay; cũng dùng khi nộp bản cập nhật. Dùng khi người dùng muốn nộp, gửi, đăng, phát hành game lên EyePlay.
---

# Nộp game cho EyePlay

Thư mục kit là thư mục cha hai cấp của file này.

1. **Verify lần cuối** trong thư mục dự án: `node <kit>/tools/verify.js .` phải in `KẾT QUẢ: ĐẠT`. Chưa đạt thì
   quay lại skill `eyeplay-game`. Mở lại ảnh `eyeplay-shots/05-cover.png`: đây là ảnh bìa người chơi thấy.
2. **eyeplay.json**: `version` tăng so với lần nộp trước (lần đầu `1.0.0`); `contact` có cách liên hệ thật;
   `blurb` một câu hấp dẫn; `about` 1–2 đoạn; `controls` đủ phím chính. Hỏi người dùng nếu thiếu thông tin.
3. **Đóng gói**: một file zip `<id>-<version>.zip` chứa:
   - `eyeplay.json`
   - `build/` = toàn bộ thư mục build (có `index.html`, `cover.html`)

   Ví dụ (macOS / Linux), từ thư mục dự án, với `"build": "dist"`:
   ```bash
   rm -rf .eyeplay-pack && mkdir -p .eyeplay-pack && cp eyeplay.json .eyeplay-pack/ && cp -R dist .eyeplay-pack/build
   (cd .eyeplay-pack && zip -qr "../<id>-<version>.zip" .) && rm -rf .eyeplay-pack
   ```
   Windows PowerShell: chép tương tự rồi `Compress-Archive -Path .eyeplay-pack\* -DestinationPath <id>-<version>.zip`.
   Không đưa mã nguồn, `node_modules`, `.git`, `eyeplay-shots/` vào zip.
4. **Gửi đội EyePlay** file zip (theo kênh người dùng đã được ALumiEye cung cấp). Kèm một đoạn ngắn: tên game, phiên
   bản, có gì mới (nếu là bản cập nhật).
5. Báo người dùng: đường dẫn file zip, kết quả verify, và rằng đội EyePlay sẽ kiểm tra tự động, chơi thử, xem nội
   dung rồi mới đăng.

Bạn giữ bản quyền game; khi nộp, bạn cho phép ALumiEye phát hành game miễn phí trên EyePlay và gỡ game khi vi phạm.

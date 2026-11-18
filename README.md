# eyeplay-kit

Bộ công cụ để **AI của bạn** (Claude Code, Codex, Cursor…) làm game trình duyệt và đưa lên
**EyePlay** — kho game chơi ngay tại https://play.alumieye.com — đúng chuẩn ngay lần đầu.

| | |
|---|---|
| Hướng dẫn cho AI (điểm bắt đầu) | [`AGENTS.md`](AGENTS.md) |
| Game được / không được làm gì trên EyePlay | [`docs/HOP-DONG.md`](docs/HOP-DONG.md) |
| Game mẫu nhỏ | [`examples/ne-sao/`](examples/ne-sao/) |
| Game mẫu đầy đủ | [ALumiEye/eyepalace](https://github.com/ALumiEye/eyepalace) |

## Dùng thế nào

1. Tải kit về cạnh dự án game của bạn và cài (cần Node 22+ và Google Chrome):
   ```bash
   git clone https://github.com/ALumiEye/eyeplay-kit.git
   cd eyeplay-kit && npm install
   ```
2. Bảo AI của bạn: *"Đọc eyeplay-kit/AGENTS.md rồi làm (hoặc chuyển) game của tôi cho EyePlay."*
   - **Claude Code** có thể cài kit như plugin để có sẵn skill:
     `/plugin marketplace add ALumiEye/eyeplay-kit` rồi `/plugin install eyeplay-kit@alumieye`.
3. AI làm tới khi lệnh này báo **ĐẠT**:
   ```bash
   node eyeplay-kit/tools/verify.js <thư-mục-game-của-bạn>
   ```
   Lệnh kiểm tra bản build, rồi **chơi thử game trong một EyePlay thu nhỏ** trên máy bạn (khung cách ly, chặn mạng,
   SDK thật) và chụp ảnh để xem.
4. Nộp: zip thư mục build + `eyeplay.json` gửi đội EyePlay (AI làm giúp theo `skills/eyeplay-submit`).

## Trong kit có gì

| Đường dẫn | Là gì |
|---|---|
| `tools/verify.js` | Một lệnh: kiểm tra `eyeplay.json` + kiểm tra tĩnh + chơi thử. `--json` cho máy đọc |
| `tools/check.js` | Kiểm tra tĩnh thư mục build (không cần Chrome) |
| `tools/playtest.js` | Chơi thử trong EyePlay thu nhỏ, chụp ảnh `eyeplay-shots/` |
| `skills/` | Skill cho AI: làm game, nộp game |
| `templates/eyeplay.json` | Mẫu thông tin game |
| `examples/ne-sao/` | Game nhỏ nhất đạt mọi yêu cầu |

Game của chính ALumiEye cũng được kiểm tra bằng đúng bộ công cụ này.

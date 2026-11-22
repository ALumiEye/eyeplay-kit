# Hợp đồng replay: để game có contest và bảng xếp hạng chung

Trạng thái: **đang dựng** (2026-11-22). Đã làm thật trên eyemerge (game của ALumiEye, repo private). Chưa có công cụ
kiểm replay trong `verify` và chưa có game mẫu công khai (mục 8). Không bắt buộc: game không làm phần này vẫn đăng
được, chỉ không có contest (vẫn có kỷ lục trên máy).

## 1. Vì sao cần

Trên bảng xếp hạng chung, EyePlay **không tin điểm do máy người chơi gửi**. Máy gửi lên đề bài (`seed`), kết quả khai và
**danh sách thao tác**; server **chơi lại** ván đó bằng chính code của game và chỉ tin điểm nó tự tính. Bịa điểm, bịa
thời gian, sửa thao tác, thả sai luật đều bị loại.

Muốn vậy thì điều quan trọng nhất là: **ván server chơi lại phải giống hệt ván người chơi đã chơi, từng bit.**

## 2. Nguyên tắc: logic game và replay là MỘT nguồn

Không viết "bản luật cho server" riêng. Game thật và `replay()` cùng chạy **đúng một lõi** (`session`):

```
          ┌──────────── src/core (một bản duy nhất) ───────────────────┐
          │ const session = createSession(seed)                        │
          │ session.input(thao tác)   ← ghi lại tại đây, đúng thứ lõi nhận │
          │ session.step()            ← mọi thay đổi trạng thái chỉ ở đây │
          └──────▲──────────────────────────────────────▲──────────────┘
                 │                                      │
   Game thật (trình duyệt)                       replay() (server)
   chuột / phím / chạm → session.input(...)      thao tác đã ghi → session.input(...)
   vẽ, âm thanh, HUD: CHỈ ĐỌC trạng thái         không vẽ gì
```

Quy tắc:

1. **Mọi thay đổi trạng thái của ván đi qua `session`.** Code vẽ / âm thanh / giao diện không được gán vào trạng thái
   ván (khai báo kiểu `Readonly<…>` cho phần trả ra để TypeScript bắt lỗi).
2. **Bộ ghi nằm trong `session.input()`**: thứ được ghi là thứ lõi đã nhận, không phải thứ giao diện "định" gửi.
3. **Thao tác có số thực thì làm tròn trong `input()`, trước khi lõi dùng** (vd. vị trí theo 1/1000 ô). Lõi và bản ghi
   khi đó thấy cùng một số nguyên.
4. **Thao tác gắn với tick** (số bước cố định), không gắn với thời gian thật.
5. `replay()` chỉ là vòng lặp đọc thao tác → `session.input()` → `session.step()`. Không có luật game nào trong đó.

Phần không thi (menu, cảnh nền, ván thử) không cần đi qua `session`.

## 3. Tất định: cùng đầu vào, cùng kết quả, trên mọi máy

- **Bước thời gian cố định** (vd. 1/60 s), số bước không phụ thuộc tốc độ khung hình. Tạm dừng = không gọi `step()`.
- **Mọi ngẫu nhiên lấy từ seed** của ván (bộ sinh số có seed). Trong lõi không dùng `Math.random`, `Date.now`,
  `performance.now`, `crypto`.
- **Toán tất định**: `+ − × ÷` và `Math.sqrt` giống nhau trên mọi máy, nhưng **`Math.sin`, `cos`, `atan2`, `exp`, `pow`,
  `log`… thì không** (V8 của Chrome / server khác JavaScriptCore của iPhone ở bit cuối, và vật lý khuếch đại thành ván
  khác: thử 2026-11-21, iPhone chỉ khớp 3/12 ván). Với `det-math`, iPhone 11 Pro Max khớp 12/12.
  - Chép **`templates/det-math.js`** vào game, không sửa nội dung (mọi game và server dùng đúng các con số đó). Nó thay
    `Math.sin`, `cos`, `atan2` bằng bản chỉ dùng + − × ÷. Luật game dùng `exp`, `pow`, `log`… thì báo ALumiEye để thêm.
  - **Nạp nó ở dòng đầu của chính file import thư viện vật lý** (`import "./det-math.js";` trước `import … from
    "planck"`), không chỉ ở file chính. Lý do: thư viện như planck chép `Math.sin` vào biến riêng lúc nạp; và bundler
    (Vite, Rollup…) hay tách thư viện sang một chunk khác, chunk đó **chạy trước** phần thân file chính. Khi ấy trong
    trình duyệt game dùng `Math.sin` gốc, lệch server, trong khi test trên Node vẫn qua (đã gặp thật ở eyemerge).
  - Sau mỗi lần build chạy **`node templates/check-det-math.mjs <thư-mục-build>`** (gắn vào lệnh build): báo lỗi nếu
    thiếu det-math, hoặc có file mà thư viện chép `Math` trước khi det-math chạy.
- Không phụ thuộc thứ tự không xác định: duyệt `Map` / `Set` / mảng theo thứ tự chèn là được; không sắp xếp bằng hàm
  so sánh có thể trả bằng nhau cho hai phần tử khác nhau mà kết quả lại ảnh hưởng luật.

## 4. Cửa replay: `src/replay.ts` → `dist/replay.mjs`

Game xuất một module **không DOM**, đóng gói sẵn mọi thứ nó cần (lõi, thư viện vật lý, `det-math`):

```ts
// src/replay.ts
import "./core/det-math";               // dòng đầu tiên: trước mọi thư viện
import { createSession, decodeInputs } from "./core/session";

export const rules = "eyemerge@1";      // đổi khi luật đổi (mục 6)

export function replay(sub: {
  seed: number;
  inputs: string;      // thao tác đã nén (base64), do session ghi
  endTick: number;     // tick lúc ván chốt
  finished: boolean;   // false = ván bỏ dở, chốt giữa chừng
}): { ok: boolean; reason?: string; score: number; timeMs: number; endTick: number; hash: string } {
  // 1. giải nén thao tác; 2. chạy session tới endTick, đưa từng thao tác vào đúng tick;
  // 3. finished = true thì ván phải kết thúc đúng endTick; false thì dừng ở endTick;
  // 4. trả điểm / thời gian / vân tay trạng thái (băm bit float của toàn bộ trạng thái).
}
```

- Lệnh build của game xuất thêm `dist/replay.mjs` (một file ES module). EyePlay gom file này cùng bản build và đóng gói
  vào server (Cloudflare Workers).
- Ràng buộc của server: không `window` / `document` / canvas / âm thanh / `fetch`; **không `eval`, không `new
  Function`**; chơi lại một ván dài vẫn dưới vài giây CPU; file gọn (vài trăm KB).
- `recordRun` gửi thêm cho ván thi: `rules`, `inputs`, `endTick`, `finished`, `seed` (xem `HOP-DONG.md` mục 6).
- Đề của trận do **EyePlay đưa** (Đấu Trường, `HOP-DONG.md` mục 6: `EyePlay.onContest`), game chơi đúng `seed` đó.
  Cửa replay xuất thêm `contestSeed(contestId)`: đề của một trận theo mã của nó (server lấy đề từ đây, không tự tính).
- `dist/replay.mjs` **không** được phục vụ công khai: EyePlay bỏ nó khỏi bản game trên `/play/<id>/` và chỉ đóng gói nó
  vào server.

## 5. Kiểm: game thật phải khớp replay, từng bit

Ba lớp, từ "không thể sai" tới "bắt được nếu vẫn sai":

1. **Cấu trúc** (mục 2): một nguồn duy nhất, bộ ghi trong `session.input()`, phần vẽ chỉ đọc.
2. **Kiểm tự động trước khi lên** (công cụ của kit, sẽ thêm vào `verify`): mở **game thật** trong EyePlay thu nhỏ, cho
   bot thao tác trên canvas như người chơi, vài chục ván với seed khác nhau; chặn `recordRun` lấy điểm, thời gian, thao
   tác, vân tay; chạy `dist/replay.mjs` của **cùng bản build** trên Node (và workerd, đúng bộ máy server) với cùng thao
   tác. **Lệch một ván là không đạt.** EyePlay chạy lại bài kiểm này ở mỗi lần deploy, lệch thì không deploy. Đổi thư
   viện vật lý hay toán: kiểm thêm trên iPhone và Android (trang kiểm của `replay-audit`).
3. **Theo dõi khi chạy thật**: server đếm ván bị loại ở bước "so kết quả" mà chỉ lệch rất nhỏ (dấu hiệu game và replay
   đã khác nhau, không phải gian lận). Vượt ngưỡng thì tạm tắt chơi lại cho game đó (chỉ kiểm điểm cho hợp lý), báo
   ALumiEye; ván lệch còn giữ thao tác + vân tay để tìm tick đầu tiên lệch.

## 6. Đổi luật

- Mỗi contest **ghim** một `rules`. Đổi bất cứ thứ gì làm kết quả khác đi (vật lý, điểm, thứ tự đề, cách làm tròn thao
  tác) thì **tăng `rules`** (`eyemerge@1` → `eyemerge@2`). Chỉ đổi hình, âm thanh, giao diện thì giữ nguyên.
- Bản `rules` mới chỉ áp cho contest bắt đầu sau khi lên. Server giữ `replay.mjs` của bản cũ tới khi mọi contest dùng nó
  đã tính rating xong.

## 7. Ván bỏ dở

Ván đang dở (checkpoint để chơi tiếp) **chỉ lưu trên máy**, không gửi lên server. Chỉ gửi khi ván **chốt**: chơi tới hết
(`finished: true`), hoặc chốt giữa chừng (`finished: false`): game có resume thì khi người chơi chọn "Chơi lại", game
không resume thì khi thoát giữa ván. Mỗi lần chốt là một lần thử.

## 8. Chưa chốt (sẽ cập nhật)

- **Khai báo contest trong `eyeplay.json`**: chế độ thi, nhịp (ngày / tuần), game có resume không. Sẽ là trường mới
  của `rankedModes`.
- **Game chỉ nộp bản build** (game cộng đồng): nộp `replay.mjs` cùng zip ở đâu, EyePlay tách nó ra thế nào.
- **Công cụ kiểm replay trong `verify`** (mục 5, lớp 2) và **game mẫu công khai** có contest trong `examples/`.


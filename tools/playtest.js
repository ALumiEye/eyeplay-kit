#!/usr/bin/env node
// Chơi thử game trong một EyePlay thu nhỏ trên máy, giống hệt môi trường thật:
//   - game nằm trong iframe sandbox (không allow-same-origin), ở đường dẫn /play/<id>/
//   - header CSP như play.alumieye.com: connect-src 'self' (mọi kết nối ra ngoài bị chặn)
//   - SDK EyePlay thật (lấy từ play.alumieye.com, mất mạng thì dùng bản kèm theo) chèn vào mọi trang HTML
//   - màn chờ có nút "▶ Chơi": trước khi bấm, game không nhận phím
// Rồi bấm Chơi, bấm phím, đổi cỡ khung, mở cover.html, bắt mọi lỗi và chụp ảnh để xem bằng mắt.
//
//   node tools/playtest.js <thư-mục-build> --id <id> [--keys ArrowLeft,ArrowRight,Space] [--seconds 6]
//                          [--touch] [--shots <thư-mục>] [--json] [--headed]
//
// Mã thoát: 0 = đạt, 1 = có lỗi, 2 = sai cách gọi / thiếu Chrome.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SANDBOX = 'allow-scripts allow-pointer-lock allow-downloads allow-forms';
export const PLAY_CSP = "frame-ancestors 'self'; connect-src 'self'";
const LIVE_SDK = 'https://play.alumieye.com/sdk/eyeplay-sdk.js';
const DEFAULT_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];

const TYPES = {
	'.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
	'.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml',
	'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
	'.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav',
	'.m4a': 'audio/mp4', '.aac': 'audio/aac', '.webm': 'video/webm', '.mp4': 'video/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2',
	'.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json'
};

async function loadSdk() {
	try {
		const res = await fetch(LIVE_SDK, { signal: AbortSignal.timeout(5000) });
		if (res.ok) return { code: await res.text(), source: 'live' };
	} catch {
		/* mất mạng: dùng bản kèm theo */
	}
	return { code: fs.readFileSync(path.join(KIT, 'tools/vendor/eyeplay-sdk.js'), 'utf8'), source: 'vendored' };
}

function hostPage(id) {
	const name = 'eyeplay:' + JSON.stringify({ v: 1, storage: {} });
	return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>EyePlay (chạy thử) · ${id}</title>
<style>
  html,body{margin:0;height:100%;background:#3d2141;font:600 14px system-ui,sans-serif}
  body{display:grid;grid-template-rows:44px 1fr}
  .bar{display:flex;align-items:center;gap:12px;padding:0 12px;background:#f6eddb;border-bottom:3px solid #3d2141;color:#3d2141}
  .stage{position:relative}
  iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
  .wait{position:absolute;inset:0;display:grid;place-items:center;background:rgb(61 33 65 / 85%)}
  .wait button{font:800 22px system-ui;padding:14px 32px;background:#eba96b;color:#3d2141;border:3px solid #3d2141;cursor:pointer}
</style></head><body>
<div class="bar">EyePlay (chạy thử) › ${id}</div>
<div class="stage">
  <iframe id="game" sandbox="${SANDBOX}" name='${name.replace(/'/g, '&#39;')}' src="/play/${id}/" allow="fullscreen; autoplay; gamepad" title="${id}"></iframe>
  <div class="wait" id="wait"><button id="play">▶ Chơi</button></div>
</div>
<script>
  // Ghi lại mọi tin nhắn SDK để playtest đọc (window.__eyeplay).
  window.__EYEPLAY_HOST__ = 1;
  const frame = document.getElementById('game');
  const log = (window.__eyeplay = { hello: false, ready: false, starts: 0, exits: 0, runs: [], storageWrites: 0, played: false, messages: [] });
  function play() {
    if (log.played) return;
    log.played = true;
    document.getElementById('wait').remove();
    frame.contentWindow.postMessage({ source: 'eyeplay-host', v: 1, type: 'play' }, '*');
    frame.focus();
    try { frame.contentWindow.focus(); } catch (e) {}
  }
  document.getElementById('play').onclick = play;
  window.addEventListener('message', (event) => {
    if (event.origin !== 'null' || event.source !== frame.contentWindow) return;
    const m = event.data;
    if (!m || m.source !== 'eyeplay-sdk') return;
    log.messages.push(m.type);
    if (m.type === 'hello') { log.hello = true; if (log.played) play(); }
    else if (m.type === 'ready') log.ready = true;
    else if (m.type === 'start') { log.starts++; play(); }
    else if (m.type === 'exit') log.exits++;
    else if (m.type === 'run') log.runs.push(m.run);
    else if (m.type === 'storage') log.storageWrites++;
  });
</script></body></html>`;
}

function serve(buildDir, id, sdk) {
	const injectTag = `<script src="/sdk/eyeplay-sdk.js" data-game="${id}" data-sandbox></script>`;
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, 'http://x');
		const p = decodeURIComponent(url.pathname);
		if (p === '/favicon.ico') return res.writeHead(204).end();
		if (p === '/' || p === `/choi/${id}/`) return res.writeHead(200, { 'content-type': TYPES['.html'] }).end(hostPage(id));
		if (p === '/sdk/eyeplay-sdk.js')
			return res.writeHead(200, { 'content-type': TYPES['.js'], 'access-control-allow-origin': '*' }).end(sdk);
		// /play/<id>/... = bản trong khung cách ly (có SDK, có CSP). /raw/... = file gốc (cover.html).
		let rel = null, play = false;
		if (p.startsWith(`/play/${id}/`)) { rel = p.slice(`/play/${id}/`.length); play = true; }
		else if (p.startsWith('/raw/')) rel = p.slice(5);
		if (rel === null) return res.writeHead(404).end();
		if (rel === '' || rel.endsWith('/')) rel += 'index.html';
		const file = path.resolve(buildDir, rel);
		if (!file.startsWith(path.resolve(buildDir) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
			return res.writeHead(404).end();
		const ext = path.extname(file).toLowerCase();
		const headers = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' };
		if (play) Object.assign(headers, { 'content-security-policy': PLAY_CSP, 'x-frame-options': 'SAMEORIGIN', 'access-control-allow-origin': '*' });
		let body = fs.readFileSync(file);
		if (play && (ext === '.html' || ext === '.htm')) {
			const html = body.toString('utf8');
			const m = html.match(/<head[^>]*>/i);
			body = m ? html.slice(0, m.index + m[0].length) + '\n' + injectTag + html.slice(m.index + m[0].length) : injectTag + html;
		}
		res.writeHead(200, headers).end(body);
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * @returns {Promise<{ ok: boolean, checks: {code:string, level:'error'|'warning'|'info', ok:boolean, message:string, fix?:string}[], shots: string[], sdk: string, runs: unknown[] }>}
 */
export async function playtest(buildDir, opts = {}) {
	const id = opts.id;
	const keys = opts.keys?.length ? opts.keys : DEFAULT_KEYS;
	const seconds = opts.seconds ?? 6;
	const shotsDir = path.resolve(opts.shots || 'eyeplay-shots');
	fs.mkdirSync(shotsDir, { recursive: true });
	const checks = [];
	const shots = [];
	const pass = (code, message) => checks.push({ code, level: 'info', ok: true, message });
	const fail = (code, level, message, fix) => checks.push({ code, level, ok: false, message, fix });
	const shot = async (target, name) => {
		const file = path.join(shotsDir, `${name}.png`);
		await target.screenshot({ path: file }).then(() => shots.push(file), () => {});
	};

	const { chromium } = await import('playwright-core').catch(() => {
		throw Object.assign(new Error('Thiếu playwright-core. Chạy: npm install (trong thư mục eyeplay-kit).'), { usage: true });
	});
	const sdk = await loadSdk();
	const server = await serve(path.resolve(buildDir), id, sdk.code);
	const base = `http://127.0.0.1:${server.address().port}`;
	let browser;
	try {
		browser = await chromium.launch({ channel: 'chrome', headless: !opts.headed, args: ['--autoplay-policy=no-user-gesture-required'] });
	} catch (e) {
		server.close();
		throw Object.assign(new Error(`Không mở được Google Chrome: ${e.message.split('\n')[0]}\nCài Google Chrome rồi chạy lại.`), { usage: true });
	}

	const problems = { errors: [], csp: [], missing: [], external: [] };
	const watch = (context) => {
		context.on('weberror', (e) => problems.errors.push(e.error().message));
		context.on('console', (m) => {
			const t = m.text();
			if (/Content Security Policy|Refused to (connect|load|frame)/i.test(t)) problems.csp.push(t);
			// "Failed to load resource" không có tên file: đã ghi ở MISSING_FILES (có đường dẫn) nên bỏ ở đây.
			else if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(t)) problems.errors.push(t);
		});
		context.on('response', (r) => {
			const u = new URL(r.url());
			if (r.status() >= 400 && u.origin === base && !/favicon/.test(u.pathname)) problems.missing.push(`${r.status()} ${u.pathname}`);
		});
		context.on('request', (r) => {
			const u = r.url();
			if (/^https?:/.test(u) && !u.startsWith(base)) problems.external.push(u);
		});
	};

	try {
		// ---- Màn chờ → Chơi → bấm phím ----
		const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
		watch(context);
		const page = await context.newPage();
		await page.goto(`${base}/choi/${id}/`);
		const hello = await page.waitForFunction(() => window.__eyeplay.hello, null, { timeout: 30000 }).then(() => true, () => false);
		if (hello) pass('LOADS', 'Game tải xong trong khung cách ly và SDK EyePlay chạy (nhận được "hello").');
		else fail('LOADS', 'error', 'Game không báo "hello" trong 30 giây: trang game lỗi khi tải, hoặc index.html không nạp được SDK.',
			'Mở ảnh 01-waiting.png và xem lỗi bên dưới. Thường do lỗi JS lúc khởi động, đường dẫn tuyệt đối, hoặc file thiếu.');
		await shot(page, '01-waiting');

		const frame = page.frameLocator('#game');
		await page.click('#play');
		await page.waitForTimeout(800);
		const before = await page.locator('#game').screenshot().catch(() => null);
		const end = Date.now() + seconds * 1000;
		for (let i = 0; Date.now() < end; i++) {
			const key = keys[i % keys.length];
			await page.keyboard.down(key);
			await page.waitForTimeout(250);
			await page.keyboard.up(key);
			await page.waitForTimeout(100);
		}
		const after = await page.locator('#game').screenshot().catch(() => null);
		await shot(page, '02-playing');
		if (before && after && !before.equals(after)) pass('ALIVE', 'Khung game thay đổi sau khi bấm Chơi và bấm phím (game đang chạy).');
		else fail('ALIVE', 'warning', 'Khung game không đổi chút nào sau khi bấm Chơi và bấm phím.',
			`Xem 02-playing.png. Nếu game cần phím khác để vào trận, chạy lại với --keys (vd. --keys Enter,Space,ArrowUp). Nếu màn hình trống: game không vẽ được trong khung cách ly.`);

		const fit = await frame.locator('html').evaluate(() => ({ w: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight, ih: innerHeight })).catch(() => null);
		if (fit && fit.w <= fit.iw + 1 && fit.h <= fit.ih + 1) pass('FIT', 'Game vừa khung 1280×716, không có thanh cuộn.');
		else if (fit) fail('FIT', 'warning', `Game tràn khung (${fit.w}×${fit.h} trong khung ${fit.iw}×${fit.ih}): người chơi phải cuộn.`,
			'Cho game co theo cửa sổ (canvas theo innerWidth/innerHeight, CSS max-width/max-height 100%, overflow hidden).');

		// Khung nhỏ (cửa sổ hẹp / laptop nhỏ).
		await page.setViewportSize({ width: 900, height: 560 });
		await page.waitForTimeout(600);
		const small = await frame.locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1).catch(() => false);
		await shot(page, '03-small');
		if (small) pass('FIT_SMALL', 'Khung nhỏ 900×516: không tràn ngang.');
		else fail('FIT_SMALL', 'warning', 'Khung nhỏ 900×516: game tràn ngang.', 'Cho game co theo cửa sổ; xem 03-small.png.');

		const log = await page.evaluate(() => window.__eyeplay);
		if (log.storageWrites) pass('STORAGE', `Game lưu dữ liệu qua localStorage (${log.storageWrites} lần ghi), EyePlay lưu hộ được.`);
		if (log.runs.length) pass('RECORD_RUN', `Game gọi EyePlay.recordRun (${log.runs.length} ván) — dùng được cho xếp hạng.`);
		await context.close();

		// ---- Cảm ứng (game khai báo chơi được trên điện thoại) ----
		if (opts.touch) {
			const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
			watch(phone);
			const p = await phone.newPage();
			await p.goto(`${base}/choi/${id}/`);
			await p.waitForFunction(() => window.__eyeplay.hello, null, { timeout: 30000 }).catch(() => {});
			await p.tap('#play');
			for (let i = 0; i < 8; i++) {
				await p.touchscreen.tap(100 + (i % 2) * 190, 500);
				await p.waitForTimeout(300);
			}
			const fitPhone = await p.frameLocator('#game').locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1).catch(() => false);
			await shot(p, '04-phone');
			if (fitPhone) pass('TOUCH', 'Điện thoại 390×844: chạm được, không tràn ngang.');
			else fail('TOUCH', 'warning', 'Điện thoại 390×844: game tràn ngang.', 'Cho game co theo màn hình; xem 04-phone.png.');
			await phone.close();
		}

		// ---- Ảnh bìa ----
		if (fs.existsSync(path.join(buildDir, 'cover.html'))) {
			const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
			watch(ctx);
			const cover = await ctx.newPage();
			const t = Date.now();
			await cover.goto(`${base}/raw/cover.html`);
			const ready = await cover.waitForFunction(() => window.coverReady === true, null, { timeout: 60000 }).then(() => true, () => false);
			await shot(cover, '05-cover');
			if (ready) pass('COVER', `cover.html vẽ xong và báo coverReady (${((Date.now() - t) / 1000).toFixed(1)} s). Mở 05-cover.png để xem ảnh bìa.`);
			else fail('COVER', 'error', 'cover.html không đặt window.coverReady = true trong 60 giây.',
				'Đặt window.coverReady = true ngay sau khi vẽ xong khung hình cuối (ảnh, font đã tải).');
			await ctx.close();
		} else {
			fail('COVER', 'warning', 'Không có cover.html: EyePlay sẽ chụp màn hình đầu của game làm ảnh bìa.',
				'Thêm cover.html (1280×800, vẽ bằng code của game, đặt window.coverReady = true).');
		}
	} finally {
		await browser.close();
		server.close();
	}

	const uniq = (list) => [...new Set(list)];
	if (problems.errors.length) fail('JS_ERRORS', 'error', `Có lỗi JavaScript / console: ${uniq(problems.errors).slice(0, 8).join(' | ')}`,
		'Sửa từng lỗi. Lỗi chỉ có trong khung cách ly thường do dùng cookie / IndexedDB / service worker / alert / top.location.');
	else pass('JS_ERRORS', 'Không có lỗi JavaScript / console.');
	if (problems.missing.length) fail('MISSING_FILES', 'error', `File không tải được: ${uniq(problems.missing).slice(0, 8).join(', ')}`,
		'Kiểm tra file có trong thư mục build và dùng đường dẫn tương đối.');
	if (problems.external.length || problems.csp.length)
		fail('NETWORK', 'error', `Game gọi ra ngoài (bị chặn trên EyePlay): ${uniq([...problems.external, ...problems.csp.map((t) => t.slice(0, 160))]).slice(0, 5).join(' | ')}`,
			'Đưa mọi tài nguyên vào thư mục build; bỏ API, CDN, đo lượt truy cập, quảng cáo.');
	else pass('NETWORK', 'Không gọi mạng ra ngoài.');

	return { ok: !checks.some((c) => !c.ok && c.level === 'error'), checks, shots, sdk: sdk.source };
}

export function printPlaytest(r) {
	for (const c of r.checks) {
		console.log(`${c.ok ? '✓' : c.level === 'error' ? '✗' : '!'} [${c.code}] ${c.message}`);
		if (!c.ok && c.fix) console.log(`    sửa: ${c.fix}`);
	}
	console.log(`SDK: ${r.sdk === 'live' ? 'bản đang chạy trên play.alumieye.com' : 'bản kèm theo (không tải được bản mới)'}`);
	console.log(`Ảnh chụp (mở ra xem): ${r.shots.join(', ')}`);
	console.log(r.ok ? '\nChơi thử trên EyePlay: ĐẠT.' : '\nChơi thử trên EyePlay: CHƯA ĐẠT.');
}

export function parseArgs(argv) {
	const opts = { keys: [] };
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--id') opts.id = argv[++i];
		else if (a === '--keys') opts.keys = argv[++i].split(',').map((k) => (k === 'Space' ? 'Space' : k.trim())).filter(Boolean);
		else if (a === '--seconds') opts.seconds = Number(argv[++i]);
		else if (a === '--shots') opts.shots = argv[++i];
		else if (a === '--touch') opts.touch = true;
		else if (a === '--json') opts.json = true;
		else if (a === '--headed') opts.headed = true;
		else rest.push(a);
	}
	return { opts, rest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { opts, rest } = parseArgs(process.argv.slice(2));
	if (!rest[0] || !opts.id || !/^[a-z0-9-]+$/.test(opts.id)) {
		console.error('Dùng: node tools/playtest.js <thư-mục-build> --id <id-chữ-thường> [--keys A,B] [--seconds 6] [--touch] [--shots dir] [--json]');
		process.exit(2);
	}
	try {
		const r = await playtest(rest[0], opts);
		if (opts.json) console.log(JSON.stringify(r, null, 2));
		else printPlaytest(r);
		process.exit(r.ok ? 0 : 1);
	} catch (e) {
		console.error(e.message);
		process.exit(e.usage ? 2 : 1);
	}
}

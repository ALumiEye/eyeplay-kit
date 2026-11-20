#!/usr/bin/env node
// Kiểm tra TĨNH một bản build game cho EyePlay (đọc file, không chạy game).
//   node tools/check.js <thư-mục-build> [--json]
// Mỗi vấn đề có: level (error = phải sửa, warning = người duyệt xem lại), code (ổn định, để tra trong
// docs/HOP-DONG.md), file, message và fix (cách sửa). Mã thoát: 0 = không có lỗi, 1 = có lỗi, 2 = sai cách gọi.
// Bản gốc nằm ở ALumiEye/eyeplay-kit; EyePlay dùng đúng file này khi gom game.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = { maxBytes: 20 * 1024 * 1024, maxFiles: 2000, maxFileBytes: 15 * 1024 * 1024 };

export const ALLOWED_EXT = new Set([
	'.html', '.htm', '.js', '.mjs', '.css', '.json', '.map', '.txt', '.md', '.webmanifest', '.xml',
	'.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.bmp',
	'.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.flac', '.opus', '.webm', '.mp4',
	'.woff', '.woff2', '.ttf', '.otf', '.wasm', '.bin', '.glb', '.gltf', '.atlas', '.fnt', '.csv'
]);

function walk(dir, base = dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isSymbolicLink()) out.push({ full, rel: path.relative(base, full), link: true });
		else if (entry.isDirectory()) out.push(...walk(full, base));
		else out.push({ full, rel: path.relative(base, full), size: fs.statSync(full).size });
	}
	return out;
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);

/**
 * @param {string} dir thư mục build (có index.html)
 * @param {{ ignore?: string[] }} [options] ignore: tên file bỏ qua (vd. bản một file không đưa lên EyePlay)
 * @returns {{ ok: boolean, issues: {level:'error'|'warning', code:string, file:string|null, message:string, fix:string}[], files:number, bytes:number }}
 */
export function checkBuild(dir, options = {}) {
	const issues = [];
	const add = (level, code, file, message, fix) => issues.push({ level, code, file, message, fix });
	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		add('error', 'BUILD_DIR', null, `Không thấy thư mục build: ${dir}`, 'Chạy lệnh build của game rồi trỏ tới thư mục có index.html.');
		return { ok: false, issues, files: 0, bytes: 0 };
	}
	const ignore = new Set(options.ignore || []);
	const files = walk(dir).filter((f) => !ignore.has(f.rel));
	const bytes = files.reduce((s, f) => s + (f.size || 0), 0);

	if (!fs.existsSync(path.join(dir, 'index.html')))
		add('error', 'INDEX', null, 'Thiếu index.html ở gốc thư mục build.', 'Trang chính của game phải là <build>/index.html.');
	// Màu game phải giữ đúng: Auto Dark Mode của Chrome / Edge (hay bật trên Windows) tự đảo màu trang sáng thành tối.
	// SDK EyePlay đã chặn hộ, nên chỉ là cảnh báo.
	if (fs.existsSync(path.join(dir, 'index.html')) && !/color-scheme/i.test(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')))
		add('warning', 'COLOR_SCHEME', 'index.html', 'Chưa khai báo color-scheme: trình duyệt bật chế độ tự làm tối có thể đảo màu game.',
			'Thêm <meta name="color-scheme" content="only light" /> vào <head> (game màu tối: content="only dark").');
	if (!fs.existsSync(path.join(dir, 'cover.html')))
		add('warning', 'COVER_MISSING', null, 'Chưa có cover.html: EyePlay sẽ chụp màn hình đầu của game làm ảnh bìa.',
			'Thêm cover.html vẽ một cảnh đẹp 1280×800 bằng code vẽ của game rồi đặt window.coverReady = true (xem docs/HOP-DONG.md, mục Ảnh bìa).');
	if (files.length > LIMITS.maxFiles)
		add('error', 'TOO_MANY_FILES', null, `Quá nhiều file: ${files.length} (tối đa ${LIMITS.maxFiles}).`, 'Gộp file (bundler, sprite sheet).');
	if (bytes > LIMITS.maxBytes)
		add('error', 'TOO_BIG', null, `Quá nặng: ${mb(bytes)} MB (tối đa ${LIMITS.maxBytes / 1048576} MB).`,
			'Nén ảnh (WebP), nhạc (Opus/MP3 bitrate thấp), bỏ file không dùng.');

	for (const f of files) {
		if (f.link) {
			add('error', 'SYMLINK', f.rel, 'Không được dùng liên kết (symlink).', 'Chép file thật vào thư mục build.');
			continue;
		}
		const name = path.basename(f.rel);
		const ext = path.extname(f.rel).toLowerCase();
		if (name.startsWith('.') && name !== '.nojekyll')
			add('warning', 'HIDDEN_FILE', f.rel, 'File ẩn sẽ bị bỏ qua.', 'Xoá file ẩn khỏi thư mục build.');
		if (!name.startsWith('.') && !ALLOWED_EXT.has(ext))
			add('error', 'FILE_TYPE', f.rel, `Loại file không nhận (${ext || 'không có đuôi'}).`, 'Chỉ giữ file web, ảnh, âm thanh, video, font, wasm, glb/gltf (xem docs/HOP-DONG.md).');
		if (f.size > LIMITS.maxFileBytes)
			add('error', 'FILE_TOO_BIG', f.rel, `File quá lớn: ${mb(f.size)} MB (tối đa ${LIMITS.maxFileBytes / 1048576} MB).`, 'Nén hoặc chia nhỏ file.');
		if (/^(sw|service-worker)\.js$/i.test(name))
			add('warning', 'SERVICE_WORKER', f.rel, 'Có service worker: EyePlay tắt nó (khung cách ly không có service worker).',
				'Game phải chạy được khi register() bị từ chối; tốt nhất bỏ service worker khỏi bản cho EyePlay.');

		if (ext === '.html' || ext === '.htm') {
			const html = fs.readFileSync(f.full, 'utf8');
			for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
				const url = m[1];
				if (/^(https?:)?\/\//i.test(url)) {
					const before = html.slice(Math.max(0, m.index - 200), m.index);
					const isAnchor = /<a\b[^>]*$/i.test(before);
					const isFont = /^(https?:)?\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/i.test(url);
					if (isFont)
						add('warning', 'GOOGLE_FONTS', f.rel, `Dùng font Google Fonts (${url}).`, 'Được phép, nhưng nên tải font về và nhúng vào gói (woff2).');
					else if (isAnchor)
						add('warning', 'EXTERNAL_LINK', f.rel, `Có liên kết ra ngoài: ${url}.`, 'Khung cách ly không mở được cửa sổ mới; bỏ liên kết hoặc chỉ hiện chữ.');
					else
						add('error', 'EXTERNAL_RESOURCE', f.rel, `Dùng tài nguyên ngoài gói: ${url}.`, 'Tải file đó về, đặt trong thư mục build và trỏ bằng đường dẫn tương đối.');
				} else if (url.startsWith('/') && !url.startsWith('/sdk/eyeplay-sdk.js')) {
					add('error', 'ABSOLUTE_PATH', f.rel, `Đường dẫn tuyệt đối "${url}".`,
						`Dùng đường dẫn tương đối "${url.slice(1)}" (game chạy ở /play/<id>/). Với Vite: base: './'.`);
				}
			}
		}
		if (ext === '.js' || ext === '.mjs' || ext === '.html') {
			// Bỏ chú thích (gần đúng) để không báo nhầm chữ trong comment, vd. "// không dùng prompt()".
			const code = fs.readFileSync(f.full, 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
			if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(code) && /https?:\/\/(?!www\.w3\.org)/.test(code))
				add('warning', 'NETWORK', f.rel, 'Có lệnh gọi mạng và có địa chỉ http(s).',
					'Trên EyePlay mọi kết nối ra ngoài bị chặn. Nếu là chuỗi có sẵn trong thư viện thì bỏ qua; nếu game gọi API thì bỏ đi.');
			if (/\b(document\.cookie|indexedDB|caches\.open)\b/.test(code))
				add('warning', 'STORAGE_API', f.rel, 'Dùng cookie / IndexedDB / Cache API.', 'Khung cách ly chỉ lưu localStorage. Lưu dữ liệu bằng localStorage.');
			if (/\b(?:window\.)?(?:top|parent)\.(?:location|document)\b/.test(code))
				add('warning', 'TOP_ACCESS', f.rel, 'Truy cập top/parent.', 'Bị chặn trong khung cách ly. Muốn về EyePlay thì gọi window.EyePlay?.exit().');
			// alert( / window.alert( — nhưng không phải obj.alert( (phương thức của đối tượng khác).
			if (/(?:^|[^.\w$])(?:alert|confirm|prompt)\s*\(|\bwindow\.(?:alert|confirm|prompt)\s*\(/.test(code))
				add('warning', 'DIALOG', f.rel, 'Có alert / confirm / prompt.', 'Không có trong khung cách ly: hiện thông báo ngay trong game.');
		}
	}
	return { ok: !issues.some((i) => i.level === 'error'), issues, files: files.length, bytes };
}

/** Dạng cũ (EyePlay gather.js dùng): danh sách chuỗi lỗi / cảnh báo. */
export function checkSubmission(dir, options) {
	const { issues, files, bytes } = checkBuild(dir, options);
	const text = (i) => (i.file ? `${i.file}: ` : '') + i.message;
	return {
		errors: issues.filter((i) => i.level === 'error').map(text),
		warnings: issues.filter((i) => i.level === 'warning').map(text),
		files,
		bytes
	};
}

export function printReport(result) {
	console.log(`${result.files} file, ${(result.bytes / 1048576).toFixed(2)} MB`);
	for (const i of result.issues) {
		console.log(`${i.level === 'error' ? '✗' : '!'} [${i.code}] ${i.file ? i.file + ': ' : ''}${i.message}`);
		console.log(`    sửa: ${i.fix}`);
	}
	const errors = result.issues.filter((i) => i.level === 'error').length;
	console.log(errors ? `\nKiểm tra tĩnh: CHƯA ĐẠT (${errors} lỗi).` : '\nKiểm tra tĩnh: ĐẠT.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const dir = args.find((a) => !a.startsWith('--'));
	if (!dir) {
		console.error('Dùng: node tools/check.js <thư-mục-build> [--json]');
		process.exit(2);
	}
	const result = checkBuild(path.resolve(dir));
	if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
	else printReport(result);
	process.exit(result.ok ? 0 : 1);
}

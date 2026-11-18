#!/usr/bin/env node
// MỘT LỆNH để biết game đã sẵn sàng cho EyePlay chưa:
//   1. đọc và kiểm tra eyeplay.json (thông tin game)
//   2. kiểm tra tĩnh thư mục build (tools/check.js)
//   3. chơi thử trong EyePlay thu nhỏ (tools/playtest.js)
//
//   node tools/verify.js <thư-mục-dự-án-có-eyeplay.json | đường-dẫn/eyeplay.json> [--json] [--shots dir]
//   node tools/verify.js --build <thư-mục-build> --id <id> [--ignore a.html,b.html] [--touch] [--keys ...]   (không cần eyeplay.json)
//
// Mã thoát: 0 = ĐẠT, 1 = CHƯA ĐẠT, 2 = sai cách gọi / thiếu Chrome. Chạy lại tới khi ĐẠT.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBuild, printReport } from './check.js';
import { parseArgs, playtest, printPlaytest } from './playtest.js';

const GENRES = ['Hành động', 'Phiêu lưu', 'Giải đố', 'Chiến thuật', 'Đua xe', 'Thể thao', 'Bắn súng', 'Nhập vai', 'Mô phỏng', 'Âm nhạc', 'Trí tuệ', 'Văn phòng', 'Thẻ bài', 'Khác'];

/** Kiểm tra eyeplay.json. Trả về danh sách vấn đề cùng dạng với check.js. */
export function checkManifest(m) {
	const issues = [];
	const err = (code, message, fix) => issues.push({ level: 'error', code, file: 'eyeplay.json', message, fix });
	const warn = (code, message, fix) => issues.push({ level: 'warning', code, file: 'eyeplay.json', message, fix });
	const str = (v) => typeof v === 'string' && v.trim().length > 0;
	if (!m || typeof m !== 'object') return [{ level: 'error', code: 'MANIFEST', file: 'eyeplay.json', message: 'eyeplay.json không phải object JSON.', fix: 'Chép templates/eyeplay.json rồi điền.' }];
	if (!/^[a-z0-9-]{3,32}$/.test(m.id || '')) err('MANIFEST_ID', `"id" không hợp lệ: ${JSON.stringify(m.id)}.`, 'Chữ thường, số, gạch ngang, 3–32 ký tự, vd. "ne-sao". Cũng là tiền tố khoá localStorage.');
	if (!str(m.title)) err('MANIFEST_TITLE', 'Thiếu "title" (tên game).', 'Điền tên game hiện cho người chơi.');
	if (!str(m.blurb)) err('MANIFEST_BLURB', 'Thiếu "blurb" (một câu giới thiệu cho thẻ game).', 'Một câu, tối đa ~110 ký tự.');
	else if (m.blurb.length > 120) warn('MANIFEST_BLURB', `"blurb" dài ${m.blurb.length} ký tự, thẻ game chỉ hiện 2 dòng.`, 'Rút xuống ~110 ký tự.');
	if (!Array.isArray(m.about) || !m.about.length || !m.about.every(str)) err('MANIFEST_ABOUT', '"about" phải là mảng 1–2 đoạn giới thiệu.', 'Vd. ["Đoạn 1 ...", "Đoạn 2 ..."].');
	if (!str(m.genre)) err('MANIFEST_GENRE', 'Thiếu "genre".', `Chọn một: ${GENRES.join(', ')}.`);
	else if (!GENRES.includes(m.genre)) warn('MANIFEST_GENRE', `Thể loại "${m.genre}" chưa có trên EyePlay.`, `Nên chọn một: ${GENRES.join(', ')}.`);
	if (!Array.isArray(m.controls) || !m.controls.length || !m.controls.every((c) => Array.isArray(c?.keys) && c.keys.length && str(c.action)))
		err('MANIFEST_CONTROLS', '"controls" phải là mảng { "keys": ["←", "A"], "action": "Sang trái" }.', 'Liệt kê các phím chính (không cần đủ hết).');
	if (m.touch !== undefined && typeof m.touch !== 'boolean') err('MANIFEST_TOUCH', '"touch" phải là true/false.', 'true nếu chơi được trên điện thoại.');
	if (m.rankedModes !== undefined) {
		if (!Array.isArray(m.rankedModes) || !m.rankedModes.every((r) => /^[a-z0-9-]{1,40}$/.test(r?.id || '') && str(r?.name) && str(r?.metric)))
			err('MANIFEST_RANKED', '"rankedModes" phải là mảng { "id": "thuong", "name": "Chế độ thường", "metric": "Điểm" }.', 'id trùng với mode trong EyePlay.recordRun({ mode }). Bỏ trường này nếu game chơi tự do.');
	}
	if (!str(m.developer)) err('MANIFEST_DEVELOPER', 'Thiếu "developer" (tên nhà phát triển).', 'Tên cá nhân hoặc nhóm.');
	if (!str(m.contact)) warn('MANIFEST_CONTACT', 'Thiếu "contact".', 'Email hoặc cách liên hệ để đội EyePlay báo kết quả duyệt.');
	if (!/^\d+\.\d+\.\d+/.test(m.version || '')) err('MANIFEST_VERSION', `"version" không hợp lệ: ${JSON.stringify(m.version)}.`, 'Dạng số phiên bản, vd. "1.0.0". Tăng mỗi lần nộp bản mới.');
	if (!str(m.build)) err('MANIFEST_BUILD', 'Thiếu "build" (thư mục build, tương đối với eyeplay.json).', 'Vd. "dist" hoặc "." nếu game không cần build.');
	return issues;
}

function loadManifest(target) {
	const file = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'eyeplay.json') : target;
	if (!fs.existsSync(file)) throw Object.assign(new Error(`Không thấy ${file}. Chép templates/eyeplay.json của kit vào gốc dự án rồi điền.`), { usage: true });
	let manifest;
	try {
		manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (e) {
		throw Object.assign(new Error(`eyeplay.json không đọc được (JSON sai): ${e.message}`), { usage: true });
	}
	return { manifest, dir: path.dirname(path.resolve(file)) };
}

export async function verify(argv) {
	const { opts, rest } = parseArgs(argv);
	const ignoreIdx = argv.indexOf('--ignore');
	const ignore = ignoreIdx >= 0 ? argv[ignoreIdx + 1].split(',') : [];
	const buildIdx = argv.indexOf('--build');
	let manifestIssues = [];
	let buildDir, manifest = null;
	if (buildIdx >= 0) {
		buildDir = path.resolve(argv[buildIdx + 1]);
		if (!opts.id) throw Object.assign(new Error('Dùng --build thì phải có --id.'), { usage: true });
	} else {
		const loaded = loadManifest(path.resolve(rest[0] || '.'));
		manifest = loaded.manifest;
		manifestIssues = checkManifest(manifest);
		buildDir = path.resolve(loaded.dir, manifest.build || '.');
		opts.id ||= manifest.id;
		opts.touch ||= manifest.touch === true;
		if (!opts.keys.length && Array.isArray(manifest.playtest?.keys)) opts.keys = manifest.playtest.keys;
		if (manifest.playtest?.seconds) opts.seconds ??= manifest.playtest.seconds;
		ignore.push(...(manifest.playtest?.ignore || []));
		// eyeplay.json nằm trong thư mục build (game không cần build): không tính là file của game.
		if (path.resolve(loaded.dir) === buildDir) ignore.push('eyeplay.json');
	}
	const statik = checkBuild(buildDir, { ignore });
	statik.issues.unshift(...manifestIssues);
	statik.ok = !statik.issues.some((i) => i.level === 'error');
	let play = null;
	if (statik.issues.every((i) => i.code !== 'INDEX' && i.code !== 'BUILD_DIR') && /^[a-z0-9-]+$/.test(opts.id || '')) {
		play = await playtest(buildDir, opts);
		// Thiếu cover.html đã báo ở kiểm tra tĩnh: không lặp lại.
		if (statik.issues.some((i) => i.code === 'COVER_MISSING')) play.checks = play.checks.filter((c) => c.code !== 'COVER');
	}
	return { ok: statik.ok && !!play?.ok, id: opts.id, build: buildDir, static: statik, playtest: play };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const argv = process.argv.slice(2);
	try {
		const r = await verify(argv);
		if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
		else {
			console.log(`== EyePlay verify · ${r.id} · ${r.build}\n\n-- Kiểm tra tĩnh`);
			printReport(r.static);
			console.log('\n-- Chơi thử trong EyePlay thu nhỏ');
			if (r.playtest) printPlaytest(r.playtest);
			else console.log('(bỏ qua: sửa lỗi kiểm tra tĩnh trước)');
			console.log(r.ok ? '\nKẾT QUẢ: ĐẠT — game sẵn sàng cho EyePlay.' : '\nKẾT QUẢ: CHƯA ĐẠT — sửa các dòng ✗ rồi chạy lại.');
		}
		process.exit(r.ok ? 0 : 1);
	} catch (e) {
		console.error(e.message);
		process.exit(e.usage ? 2 : 1);
	}
}

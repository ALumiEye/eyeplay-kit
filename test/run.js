#!/usr/bin/env node
// Tự kiểm tra kit: game mẫu phải ĐẠT; game hỏng cố ý phải CHƯA ĐẠT với đúng các mã lỗi.
import assert from 'node:assert/strict';
import { checkBuild } from '../tools/check.js';
import { playtest } from '../tools/playtest.js';
import { verify } from '../tools/verify.js';

const good = await verify(['examples/ne-sao', '--shots', 'shots/ne-sao']);
assert.equal(good.ok, true, 'examples/ne-sao phải ĐẠT: ' + JSON.stringify([...good.static.issues, ...(good.playtest?.checks || []).filter((c) => !c.ok)]));
console.log('ok - examples/ne-sao ĐẠT');

const statik = checkBuild('test/fixtures/broken');
const codes = statik.issues.map((i) => i.code);
for (const code of ['ABSOLUTE_PATH', 'EXTERNAL_RESOURCE', 'NETWORK', 'STORAGE_API', 'COVER_MISSING']) assert.ok(codes.includes(code), `thiếu mã ${code}: ${codes}`);
assert.equal(statik.ok, false);
console.log('ok - kiểm tra tĩnh bắt đủ lỗi của game hỏng');

const play = await playtest('test/fixtures/broken', { id: 'broken', seconds: 1, shots: 'shots/broken' });
const failed = play.checks.filter((c) => !c.ok).map((c) => c.code);
for (const code of ['JS_ERRORS', 'NETWORK', 'MISSING_FILES']) assert.ok(failed.includes(code), `chơi thử thiếu mã ${code}: ${failed}`);
assert.equal(play.ok, false);
console.log('ok - chơi thử bắt lỗi cookie trong khung cách ly, gọi mạng ra ngoài và file thiếu');

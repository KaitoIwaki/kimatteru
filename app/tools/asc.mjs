// App Store Connect API を叩く小さな道具。外部の library は使わない
// （鍵を扱うので、依存を増やさない）。
//
// 使い方:
//   ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-... ASC_KEY_PATH=/path/AuthKey_XXXXXXXXXX.p8 \
//     node tools/asc.mjs status
//
// 鍵はここでしか読まない。表示もしないし、どこにも送らない。
// 送り先は api.appstoreconnect.apple.com だけ。
import crypto from 'node:crypto';
import fs from 'node:fs';

const BUNDLE_ID = 'com.kimatteru.app';
const HOST = 'https://api.appstoreconnect.apple.com';

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`環境変数 ${name} が要ります。`);
    console.error('ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH の3つを渡してください。');
    process.exit(2);
  }
  return v;
}

/** 20分だけ有効な鍵。Apple の上限もそこまで */
function token() {
  const kid = need('ASC_KEY_ID');
  const iss = need('ASC_ISSUER_ID');
  const path = need('ASC_KEY_PATH');
  if (!fs.existsSync(path)) {
    console.error(`鍵の file が見つかりません: ${path}`);
    process.exit(2);
  }
  const key = fs.readFileSync(path, 'utf8');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid, typ: 'JWT' });
  const body = b64({ iss, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' });
  // JWT は R||S の生の形を求める。Node の既定は DER なので指定が要る
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`),
    { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

let TOKEN = null;
async function get(pathAndQuery) {
  if (!TOKEN) TOKEN = token();
  const r = await fetch(HOST + pathAndQuery, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const text = await r.text();
  if (!r.ok) {
    let why = text;
    try { why = JSON.parse(text).errors?.map((e) => `${e.title}: ${e.detail}`).join('\n') || text; } catch {}
    throw new Error(`${r.status} ${pathAndQuery}\n${why}`);
  }
  return JSON.parse(text);
}

const line = (k, v) => console.log(`  ${String(k).padEnd(18)} ${v}`);

async function status() {
  const apps = await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`);
  const app = apps.data[0];
  if (!app) { console.log('そのバンドルIDのアプリが見つかりません:', BUNDLE_ID); return; }
  console.log('\n■ アプリ');
  line('名前', app.attributes.name);
  line('バンドルID', app.attributes.bundleId);
  line('SKU', app.attributes.sku);
  const id = app.id;

  console.log('\n■ バージョン（新しい順に3つ）');
  const vs = await get(`/v1/apps/${id}/appStoreVersions?limit=3&include=build`);
  const builds = Object.fromEntries((vs.included || []).map((b) => [b.id, b.attributes.version]));
  for (const v of vs.data) {
    const b = v.relationships?.build?.data?.id;
    line(v.attributes.versionString, `${v.attributes.appStoreState}   ビルド ${b ? builds[b] || b : '（未選択）'}`);
  }

  console.log('\n■ 課金アイテム');
  const ips = await get(`/v1/apps/${id}/inAppPurchasesV2?limit=20`);
  if (!ips.data.length) console.log('  ありません');
  for (const p of ips.data) {
    const a = p.attributes;
    line(a.productId, `${a.state}   ${a.inAppPurchaseType}   ${a.name}`);
  }

  console.log('\n■ 審査に出せる状態か');
  const v0 = vs.data[0];
  const checks = [];
  checks.push(['ビルドが選ばれている', !!v0.relationships?.build?.data]);
  checks.push(['課金が3つある', ips.data.length === 3]);
  checks.push(['課金がすべて審査待ちか承認済み',
    ips.data.length > 0 && ips.data.every((p) => /REVIEW|APPROVED|READY/i.test(p.attributes.state))]);
  try {
    const rd = await get(`/v1/appStoreVersions/${v0.id}/appStoreReviewDetail`);
    const notes = rd.data?.attributes?.notes || '';
    checks.push(['審査メモが入っている', notes.trim().length > 20]);
    if (notes) console.log(`\n  （いまのメモ 冒頭）${notes.slice(0, 60).replace(/\n/g, ' ')}…`);
  } catch {
    checks.push(['審査メモが入っている', false]);
  }
  console.log('');
  for (const [name, ok] of checks) console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  console.log('');
}

const cmd = process.argv[2] || 'status';
const jobs = { status };
if (!jobs[cmd]) { console.error('できること: ' + Object.keys(jobs).join(', ')); process.exit(2); }
jobs[cmd]().catch((e) => { console.error('\n失敗:', e.message); process.exit(1); });

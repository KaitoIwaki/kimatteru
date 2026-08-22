// App Store Connect API を叩く小さな道具。外部の library は使わない
// （鍵を扱うので、依存を増やさない）。
//
// 使い方:
//   ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=/path/AuthKey_XXXX.p8 \
//     node tools/asc.mjs status     ← 読むだけ
//     node tools/asc.mjs notes      ← 審査メモに応援への行き方を足す（書き込み）
//
// 鍵はここでしか読まない。表示もしないし、Apple 以外へは送らない。
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
async function call(path, method = 'GET', body) {
  if (!TOKEN) TOKEN = token();
  const r = await fetch(HOST + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) {
    let why = text;
    try { why = JSON.parse(text).errors?.map((e) => `${e.title}: ${e.detail}`).join('\n') || text; } catch { /* そのまま */ }
    throw new Error(`${r.status} ${path}\n${why}`);
  }
  return text ? JSON.parse(text) : null;
}
const get = (u) => call(u);
/** 取れなければ null。呼ぶ側で「無い」と「道が違う」を取り違えないこと */
const tryGet = async (u) => { try { return await call(u); } catch { return null; } };

const line = (k, v) => console.log(`  ${String(k).padEnd(22)} ${v}`);

async function status() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  if (!app) { console.log('そのバンドルIDのアプリが見つかりません:', BUNDLE_ID); return; }

  console.log('\n■ アプリ');
  line('名前', app.attributes.name);
  line('バンドルID', app.attributes.bundleId);

  console.log('\n■ バージョン');
  const vs = await get(`/v1/apps/${app.id}/appStoreVersions?limit=3&include=build`);
  const builds = Object.fromEntries((vs.included || []).map((b) => [b.id, b.attributes.version]));
  for (const v of vs.data) {
    const b = v.relationships?.build?.data?.id;
    line(v.attributes.versionString, `${v.attributes.appStoreState}   ビルド ${b ? builds[b] || b : '（未選択）'}`);
  }
  const v0 = vs.data[0];
  const buildNo = builds[v0.relationships?.build?.data?.id];

  console.log('\n■ 課金アイテム');
  const ips = await get(`/v1/apps/${app.id}/inAppPurchasesV2?limit=20`);
  const iapOk = [];
  for (const p of ips.data.sort((a, b) => (a.attributes.productId < b.attributes.productId ? -1 : 1))) {
    // 道は **/v2/** を使う。/v1/ にも同じ名前の道があるが古い版のもので、
    // そちらを叩くと、入っているスクショまで「無い」と返る（実際に誤報した）。
    const shot = await tryGet(`/v2/inAppPurchases/${p.id}/appStoreReviewScreenshot`);
    const loc = await tryGet(`/v2/inAppPurchases/${p.id}/inAppPurchaseLocalizations?limit=5`);
    const price = await tryGet(`/v2/inAppPurchases/${p.id}/iapPriceSchedule?include=manualPrices`);
    const named = !!(loc && loc.data.length);
    const priced = !!(price && (price.included || []).length);
    iapOk.push(!!shot && named && priced);
    console.log(`  ${p.attributes.productId}   ${p.attributes.state}`);
    console.log(`     スクショ ${shot ? '✓' : '✗'}   名前 ${named ? '✓ ' + loc.data[0].attributes.name : '✗'}   価格 ${priced ? '✓' : '✗'}`);
  }

  console.log('\n■ 提出待ちの箱');
  const subs = await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=5`);
  if (!subs.data.length) console.log('  ありません');
  for (const s of subs.data) {
    const items = await tryGet(`/v1/reviewSubmissions/${s.id}/items?limit=20`);
    line(s.attributes.state, `中身 ${items ? items.data.length : '?'} 件   ${s.attributes.submittedDate || '（未提出）'}`);
  }

  const rd = await tryGet(`/v1/appStoreVersions/${v0.id}/appStoreReviewDetail`);
  const notesText = (rd && rd.data.attributes.notes) || '';

  console.log('\n■ 審査に出せる状態か\n');
  const checks = [
    ['ビルドが選ばれている', !!buildNo],
    ['ビルドがリジェクトされた版でない', !!buildNo && buildNo !== '49'],
    ['課金が3つある', ips.data.length === 3],
    ['課金の中身がすべて揃っている', iapOk.length > 0 && iapOk.every(Boolean)],
    ['審査メモに応援への行き方がある', /開発を応援する/.test(notesText)],
  ];
  for (const [name, ok] of checks) console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  console.log('');
}

// 審査メモに、応援への行き方を足す。いまの文は消さず、先頭に付ける。
// 前のリジェクトとは別に、「課金が見つからない」で返されるのを防ぐため。
const TIP_NOTE = `【In-app purchases / 課金について】
In-app purchases are optional tips to support development. No features are unlocked
by any purchase; every feature of this app is free and unrestricted.

How to reach them: Settings tab (設定) -> scroll to the bottom -> the "応援" section
-> tap "開発を応援する" to expand the three amounts.
The "サポーターカード" (supporter card) shown after a purchase is a display of the
user's own payment history (amount and count), not a feature.

課金は「開発の応援（投げ銭）」のみです。購入しても機能は一切解放されません。
すべての機能は無料で制限なく使えます。
到達手順：設定タブ → いちばん下までスクロール →「応援」の群 →「開発を応援する」を
タップすると3つの金額が開きます。
購入後に出る「サポーターカード」は、ご自身の支払い履歴（金額と回数）の表示であり、
機能ではありません。`;

async function notes() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  const v = (await get(`/v1/apps/${app.id}/appStoreVersions?limit=1`)).data[0];
  const rd = (await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
  const before = rd.attributes.notes || '';
  if (before.includes('In-app purchases are optional tips')) {
    console.log('すでに入っています。触りません。');
    return;
  }
  const after = `${TIP_NOTE}\n\n---\n\n${before}`;
  console.log(`文字数 ${before.length} → ${after.length}（上限 4000）`);
  if (after.length > 4000) { console.log('★ 上限を超えるので入れません'); return; }
  await call(`/v1/appStoreReviewDetails/${rd.id}`, 'PATCH',
    { data: { type: 'appStoreReviewDetails', id: rd.id, attributes: { notes: after } } });
  const back = (await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data.attributes.notes;
  console.log('  応援への行き方 :', /開発を応援する/.test(back) ? '✓ 入った' : '✗ 入っていない');
  console.log('  もとの文       :', back.includes(before.slice(0, 60)) ? '✓ 残っている' : '★ 消えた');
}

const cmd = process.argv[2] || 'status';
const jobs = { status, notes };
if (!jobs[cmd]) { console.error('できること: ' + Object.keys(jobs).join(', ')); process.exit(2); }
jobs[cmd]().catch((e) => { console.error('\n失敗:', e.message); process.exit(1); });

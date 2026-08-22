// App Store Connect API を叩く小さな道具。外部の library は使わない
// （鍵を扱うので、依存を増やさない）。
//
// 使い方:
//   ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=/path/AuthKey_XXXX.p8 \
//     node tools/asc.mjs status     ← 読むだけ
//     node tools/asc.mjs notes      ← 審査メモに応援への行き方を足す（書き込み）
//     node tools/asc.mjs build      ← いちばん新しいビルドを 1.0 に付ける（書き込み）
//
// 鍵はここでしか読まない。表示もしないし、Apple 以外へは送らない。
import crypto from 'node:crypto';
import fs from 'node:fs';

const BUNDLE_ID = 'com.kimatteru.app';
const HOST = 'https://api.appstoreconnect.apple.com';
const NL = '\n';

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
    try {
      why = JSON.parse(text).errors?.map((e) => `${e.title}: ${e.detail}`).join(NL) || text;
    } catch { /* JSON でなければ、そのまま見せる */ }
    const err = new Error(`${r.status} ${path}${NL}${why}`);
    err.status = r.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}
const get = (u) => call(u);

/**
 * 「有る」「無い」「調べられなかった」の3つを分けて返す。
 *
 * 前はここが null か否かの2択で、通信が一度こけただけで「無い」と報告していた。
 * 実際、中身の揃っている課金を「足りない」と出した。しかも次に走らせると ✓ に
 * 戻るので、見た人は何を信じればいいか分からなくなる——いちばん質の悪い誤り。
 * 一度だけ待って引き直し、それでも駄目なら error と正直に言う。
 *
 * 404 は「無い」。それ以外の失敗は「調べられなかった」。ここを混ぜない。
 */
async function probe(u) {
  for (let i = 0; i < 2; i += 1) {
    try {
      const r = await call(u);
      const n = r && r.data ? (Array.isArray(r.data) ? r.data.length : 1) : 0;
      return { state: n ? 'ok' : 'none', body: r };
    } catch (e) {
      if (e.status === 404) return { state: 'none', body: null };
      if (i === 0) await new Promise((done) => { setTimeout(done, 700); });
      else return { state: 'error', why: String(e.message).split(NL)[0] };
    }
  }
  return { state: 'error', why: '不明' };
}
const MARK = { ok: '✓', none: '✗', error: '?' };

const line = (k, v) => console.log(`  ${String(k).padEnd(22)} ${v}`);
const head = (s) => console.log(NL + s);
// Apple は時差付きの ISO（例 2026-08-22T05:26:00-07:00）を返す。
// そのまま切ると Apple 側の地方時になり、UTC と名乗ると嘘になる。必ず変換する。
const stamp = (d) => `${new Date(d).toISOString().replace('T', ' ').slice(0, 16)} UTC`;

/** いちばん新しくて、処理が済んでいて、期限が切れていないビルド */
async function newestBuild(appId) {
  const bs = await get(`/v1/builds?filter[app]=${appId}&limit=5&sort=-uploadedDate`);
  const newest = bs.data.find((b) => b.attributes.processingState === 'VALID' && !b.attributes.expired);
  return { all: bs.data, newest };
}

async function status() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  if (!app) { console.log('そのバンドルIDのアプリが見つかりません:', BUNDLE_ID); return; }

  head('■ アプリ');
  line('名前', app.attributes.name);
  line('バンドルID', app.attributes.bundleId);

  head('■ バージョン');
  const vs = await get(`/v1/apps/${app.id}/appStoreVersions?limit=3&include=build`);
  const builds = Object.fromEntries((vs.included || []).map((b) => [b.id, b.attributes.version]));
  for (const v of vs.data) {
    const b = v.relationships?.build?.data?.id;
    line(v.attributes.versionString, `${v.attributes.appStoreState}   ビルド ${b ? builds[b] || b : '（未選択）'}`);
  }
  const v0 = vs.data[0];
  const buildNo = builds[v0.relationships?.build?.data?.id];

  head('■ 課金アイテム');
  const ips = await get(`/v1/apps/${app.id}/inAppPurchasesV2?limit=20`);
  const iapState = [];
  const sorted = ips.data.slice().sort((a, b) => (a.attributes.productId < b.attributes.productId ? -1 : 1));
  for (const p of sorted) {
    // 道は **/v2/** を使う。/v1/ にも同じ名前の道があるが古い版のもので、
    // そちらを叩くと、入っているスクショまで「無い」と返る（実際に誤報した）。
    const shot = await probe(`/v2/inAppPurchases/${p.id}/appStoreReviewScreenshot`);
    const loc = await probe(`/v2/inAppPurchases/${p.id}/inAppPurchaseLocalizations?limit=5`);
    const price = await probe(`/v2/inAppPurchases/${p.id}/iapPriceSchedule?include=manualPrices`);
    iapState.push([shot.state, loc.state, price.state]);
    const named = loc.state === 'ok' ? ` ${loc.body.data[0].attributes.name}` : '';
    console.log(`  ${p.attributes.productId}   ${p.attributes.state}`);
    console.log(`     スクショ ${MARK[shot.state]}   名前 ${MARK[loc.state]}${named}   価格 ${MARK[price.state]}`);
    for (const [what, r] of [['スクショ', shot], ['名前', loc], ['価格', price]]) {
      if (r.state === 'error') console.log(`     ★ ${what}は調べられませんでした: ${r.why}`);
    }
  }
  const flat = iapState.flat();
  const iapAllOk = flat.length > 0 && flat.every((s) => s === 'ok');
  const iapUnknown = flat.some((s) => s === 'error');

  head('■ 届いているビルド（新しい順）');
  const { all, newest } = await newestBuild(app.id);
  for (const b of all.slice(0, 3)) {
    line(b.attributes.version, `${b.attributes.processingState}   ${stamp(b.attributes.uploadedDate)}`);
  }

  head('■ 提出待ちの箱');
  const subs = await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=5`);
  if (!subs.data.length) console.log('  ありません');
  for (const s of subs.data) {
    const items = await probe(`/v1/reviewSubmissions/${s.id}/items?limit=20`);
    const n = items.state === 'ok' ? items.body.data.length : MARK[items.state];
    const when = s.attributes.submittedDate ? stamp(s.attributes.submittedDate) : '（未提出）';
    line(s.attributes.state, `中身 ${n} 件   ${when}`);
  }

  const rd = await probe(`/v1/appStoreVersions/${v0.id}/appStoreReviewDetail`);
  const notesText = rd.state === 'ok' ? (rd.body.data.attributes.notes || '') : '';

  head('■ 審査に出せる状態か');
  console.log('');
  const checks = [
    ['ビルドが選ばれている', buildNo ? 'ok' : 'none'],
    ['それがいちばん新しいビルド', buildNo && newest && buildNo === newest.attributes.version ? 'ok' : 'none'],
    ['課金が3つある', ips.data.length === 3 ? 'ok' : 'none'],
    ['課金の中身がすべて揃っている', iapAllOk ? 'ok' : (iapUnknown ? 'error' : 'none')],
    ['審査メモに応援への行き方がある',
      rd.state !== 'ok' ? 'error' : (/開発を応援する/.test(notesText) ? 'ok' : 'none')],
  ];
  for (const [name, s] of checks) console.log(`  ${MARK[s]} ${name}`);
  if (checks.some(([, s]) => s === 'error')) {
    console.log(NL + '  ? は「駄目」ではなく「調べられなかった」。もう一度走らせてください。');
  }
  console.log('');
}

// 審査メモに、応援への行き方を足す。いまの文は消さず、先頭に付ける。
// 前のリジェクトとは別に、「課金が見つからない」で返されるのを防ぐため。
const TIP_NOTE = [
  '【In-app purchases / 課金について】',
  'In-app purchases are optional tips to support development. No features are unlocked',
  'by any purchase; every feature of this app is free and unrestricted.',
  '',
  'How to reach them: Settings tab (設定) -> scroll to the bottom -> the "応援" section',
  '-> tap "開発を応援する" to expand the three amounts.',
  'The "サポーターカード" (supporter card) shown after a purchase is a display of the',
  'user own payment history (amount and count), not a feature.',
  '',
  '課金は「開発の応援（投げ銭）」のみです。購入しても機能は一切解放されません。',
  'すべての機能は無料で制限なく使えます。',
  '到達手順：設定タブ → いちばん下までスクロール →「応援」の群 →「開発を応援する」を',
  'タップすると3つの金額が開きます。',
  '購入後に出る「サポーターカード」は、ご自身の支払い履歴（金額と回数）の表示であり、',
  '機能ではありません。',
].join(NL);

async function notes() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  const v = (await get(`/v1/apps/${app.id}/appStoreVersions?limit=1`)).data[0];
  const rd = (await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
  const before = rd.attributes.notes || '';
  if (before.includes('In-app purchases are optional tips')) {
    console.log('すでに入っています。触りません。');
    return;
  }
  const after = `${TIP_NOTE}${NL}${NL}---${NL}${NL}${before}`;
  console.log(`文字数 ${before.length} → ${after.length}（上限 4000）`);
  if (after.length > 4000) { console.log('★ 上限を超えるので入れません'); return; }
  await call(`/v1/appStoreReviewDetails/${rd.id}`, 'PATCH',
    { data: { type: 'appStoreReviewDetails', id: rd.id, attributes: { notes: after } } });
  const back = (await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data.attributes.notes;
  console.log('  応援への行き方 :', /開発を応援する/.test(back) ? '✓ 入った' : '✗ 入っていない');
  console.log('  もとの文       :', back.includes(before.slice(0, 60)) ? '✓ 残っている' : '★ 消えた');
}

/**
 * いちばん新しいビルドを 1.0 に付ける。
 * 前は 49（リジェクトされた版）が付いたままだった。番号は上がっていくので、
 * 「何番を選ぶか」を人が覚えているのは間違いのもと——いちばん新しいものを取る。
 */
async function build() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  const v = (await get(`/v1/apps/${app.id}/appStoreVersions?limit=1`)).data[0];
  const now = (await get(`/v1/appStoreVersions/${v.id}/build`)).data;
  const { newest } = await newestBuild(app.id);
  if (!newest) { console.log('使えるビルドがありません（まだ処理中かもしれません）'); return; }
  console.log(`  いま      ビルド ${now ? now.attributes.version : '（未選択）'}`);
  console.log(`  これから  ビルド ${newest.attributes.version}（${stamp(newest.attributes.uploadedDate)}）`);
  if (now && now.id === newest.id) { console.log('  すでに付いています。触りません。'); return; }
  await call(`/v1/appStoreVersions/${v.id}/relationships/build`, 'PATCH',
    { data: { type: 'builds', id: newest.id } });
  const back = (await get(`/v1/appStoreVersions/${v.id}/build`)).data;
  const ok = back && back.id === newest.id;
  console.log(`  結果      ビルド ${back ? back.attributes.version : '（付かなかった）'}   ${ok ? '✓' : '✗'}`);
}

const cmd = process.argv[2] || 'status';
const jobs = { status, notes, build };
if (!jobs[cmd]) { console.error(`できること: ${Object.keys(jobs).join(', ')}`); process.exit(2); }
jobs[cmd]().catch((e) => { console.error(`${NL}失敗: ${e.message}`); process.exit(1); });

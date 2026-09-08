// App Store Connect API を叩く小さな道具。外部の library は使わない
// （鍵を扱うので、依存を増やさない）。
//
// 使い方:
//   ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=/path/AuthKey_XXXX.p8 \
//     node tools/asc.mjs status     ← 読むだけ
//     node tools/asc.mjs text       ← いま登録されている文言を読む
//     node tools/asc.mjs fill       ← 原稿から文言を流し込む（書き込み）
//                                     App名・サブタイトル・プロモーション・新機能・説明・キーワード
//     node tools/asc.mjs notes      ← 審査メモに応援への行き方を足す（書き込み）
//     node tools/asc.mjs build      ← いちばん新しいビルドを 1.0 に付ける（書き込み）
//     node tools/asc.mjs submit     ← 調べるだけ（出さない）
//     node tools/asc.mjs submit go  ← 審査に出す（書き込み）
//     node tools/asc.mjs cancel     ← 出してしまった審査を取り下げる（書き込み）
//
// 鍵はここでしか読まない。表示もしないし、Apple 以外へは送らない。
import crypto from 'node:crypto';
import fs from 'node:fs';

const BUNDLE_ID = 'com.kimatteru.app';
const HOST = 'https://api.appstoreconnect.apple.com';
const NL = '\n';

// 設定は環境変数か、手元の tools/asc.local.json から。
// 毎回3つの環境変数を打つのは、打ち間違いのもと（PowerShell と bash で
// 書き方も違う）。local.json は .gitignore に入れてあるので commit されない。
// 中身は鍵そのものではなく、Key ID・Issuer ID・鍵の置き場所だけ。
let LOCAL = null;
function local() {
  if (LOCAL) return LOCAL;
  const at = new URL('./asc.local.json', import.meta.url);
  try { LOCAL = JSON.parse(fs.readFileSync(at, 'utf8')); } catch { LOCAL = {}; }
  return LOCAL;
}

function need(name) {
  const v = process.env[name] || local()[name];
  if (!v) {
    console.error(`${name} が要ります。`);
    console.error('環境変数で渡すか、tools/asc.local.json にこう書いてください:');
    console.error('  { "ASC_KEY_ID": "...", "ASC_ISSUER_ID": "...", "ASC_KEY_PATH": "C:/.../AuthKey_XXXX.p8" }');
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

/**
 * 出してしまった審査を取り下げる。
 *
 * 課金を置き去りにしたまま本体だけ出てしまったとき用。審査が始まる前
 * （WAITING_FOR_REVIEW）なら取り下げられる。始まったあと（IN_REVIEW）は
 * 取り下げると審査中のものまで消えるので、そのときは触らず、ここで止める。
 *
 * 取り下げたあと、App Store Connect の画面から出し直すこと。そのとき
 * 提出物の一覧に課金3つが並んでいるかを必ず目で見る。API からは
 * 課金を提出物に足せない（Apple がその道を用意していない）。
 */
async function cancel() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  const subs = await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=10`);
  const live = subs.data.find((s) => s.attributes.state === 'WAITING_FOR_REVIEW');
  if (!live) {
    const inReview = subs.data.find((s) => s.attributes.state === 'IN_REVIEW');
    console.log(inReview
      ? 'すでに審査が始まっています（IN_REVIEW）。ここでは取り下げません。'
      : '順番待ちの提出がありません。取り下げるものがありません。');
    return;
  }
  console.log(`  取り下げる提出 ${live.id}`);
  console.log(`  出した日時     ${stamp(live.attributes.submittedDate)}`);
  await call(`/v1/reviewSubmissions/${live.id}`, 'PATCH',
    { data: { type: 'reviewSubmissions', id: live.id, attributes: { canceled: true } } });
  const back = await get(`/v1/reviewSubmissions/${live.id}`);
  console.log(`  結果           ${back.data.attributes.state}`);
  console.log('');
  console.log('  このあと App Store Connect の、その版のページから出し直してください。');
  console.log('  課金が未審査のときだけ、提出の確認画面に3つ並んでいるかを見ること。');
  console.log('  すでに APPROVED なら、本体だけの提出で正しい。');
}

/**
 * ストアに **いま登録されている文言** を読む。
 * 手元の store-assets/app-store-metadata.md は原稿でしかない。
 * 貼り忘れ・貼り間違いは、ここで実物を読まないと分からない。
 */
async function text() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  if (!app) { console.log('そのバンドルIDのアプリが見つかりません:', BUNDLE_ID); return; }
  head('■ アプリ全体');
  line('主言語', app.attributes.primaryLocale);
  // **appInfos は2つ返る。** 公開中のものと、これから出すもの。
  // どちらか書かずに名前を2行並べると、食い違って見えたときに
  // どちらが本当か分からなくなる（実際そう読めて迷った）。
  const infos = await get(`/v1/apps/${app.id}/appInfos`);
  const nameOf = (st) => (st === 'READY_FOR_SALE' ? '公開中' : st === 'PREPARE_FOR_SUBMISSION' ? 'これから出す' : st);
  for (const inf of infos.data) {
    const where = nameOf(inf.attributes.appStoreState);
    const ils = await get(`/v1/appInfos/${inf.id}/appInfoLocalizations`);
    for (const il of ils.data) {
      const a = il.attributes;
      line(`名前 ${where}`, a.name || '（空）');
      line(`サブタイトル ${where}`, a.subtitle || '（空）');
    }
  }
  const vs = await get(`/v1/apps/${app.id}/appStoreVersions?limit=3`);
  for (const v of vs.data) {
    head(`■ ${v.attributes.versionString}（${v.attributes.appStoreState}）`);
    const ls = await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
    for (const l of ls.data) {
      const a = l.attributes;
      line('言語', a.locale);
      for (const [name, key] of [['プロモーション', 'promotionalText'], ['新機能', 'whatsNew'],
        ['キーワード', 'keywords'], ['説明', 'description']]) {
        const val = a[key];
        if (!val) { line(name, '（空）'); continue; }
        const one = String(val).replace(/\s+/g, ' ').trim();
        // 欄の名前を渡すと丸ごと出す（node tools/asc.mjs text 説明）。
        // 先頭だけ見て「入っている」と判断すると、途中の書き損じを見落とす
        if (process.argv[3] && process.argv[3] === name) {
          line(name, `${one.length}字`);
          console.log(NL + val + NL);
          continue;
        }
        line(name, `${one.length}字  ${one.slice(0, 46)}${one.length > 46 ? '…' : ''}`);
      }
    }
  }
}
/**
 * 原稿（store-assets/app-store-metadata.md）から、商品ページの文言をまとめて流し込む。
 *
 * 書くのは6つ。**書き込む先が2か所に分かれている。**
 *   App情報（版に属さない）  … App名、サブタイトル
 *   版（1.1 など）           … プロモーション、新機能、説明、キーワード
 * 名前を版のほうへ書こうとしても弾かれるので、ここを混ぜないこと。
 *
 * **なぜ全部ここから書くのか。**
 * 前は プロモーション と 新機能 の2つだけを書いていて、説明と名前は画面から手で
 * 打っていた。その結果、**原稿とストアが41字ずれたまま誰も気づかなかった**
 * （2026-09-09 に発覚。名前を変えたのに、ストアだけ古い名前が残っていた）。
 * 手で打つ欄が1つでもあると、そこがいつか必ずずれる。
 *
 * **プロモーションテキストは版をまたいで引き継がれない。**
 * キーワードと説明は新しい版へ自動で入るのに、この欄だけ空で始まる。
 * 気づかずに出すと、いま出ている文が消える（1.1 を作った直後に実際そうなっていた）。
 *
 * 書き込む前に「いま」と「これから」を並べて出す。変わらない欄は触らない。
 */
async function fill() {
  const md = fs.readFileSync(new URL('../../store-assets/app-store-metadata.md', import.meta.url), 'utf8');
  // 見出しの次に来る、最初のコード塊の中身を取る
  const block = (heading) => {
    const i = md.indexOf(heading);
    if (i < 0) throw new Error(`原稿に見出しが無い: ${heading}`);
    const a = md.indexOf('```', i);
    const b = md.indexOf('```', a + 3);
    if (a < 0 || b < 0) throw new Error(`見出しの下にコード塊が無い: ${heading}`);
    return md.slice(a + 3, b).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  };
  // 「基本情報」の表から、いちばん左がこの語で始まる行の ` ` の中を取る。
  // 語で見つけるので、原稿に行を足しても動かない（行番号で取るとすぐずれる）
  const cell = (label) => {
    const row = md.split(/\r?\n/).find((l) => l.startsWith(`| ${label}`));
    if (!row) throw new Error(`原稿の表に行が無い: ${label}`);
    const q = row.match(/`([^`]+)`/);
    if (!q) throw new Error(`表の行に値が無い: ${label}`);
    return q[1];
  };

  const want = {
    name: cell('App名'),
    subtitle: cell('サブタイトル'),
    promotionalText: block('## プロモーションテキスト'),
    whatsNew: block('## このバージョンの新機能'),
    description: block('## 説明（Description）'),
    keywords: block('## キーワード'),
  };
  const JA = { name: 'App名', subtitle: 'サブタイトル', promotionalText: 'プロモーション', whatsNew: '新機能', description: '説明', keywords: 'キーワード' };
  const MAX = { name: 30, subtitle: 30, promotionalText: 170, whatsNew: 4000, description: 4000, keywords: 100 };
  for (const k of Object.keys(want)) {
    if (want[k].length > MAX[k]) throw new Error(`${JA[k]}が ${want[k].length}字。${MAX[k]}字まで`);
  }
  // キーワードは「,」区切りでスペース無し。空白が混ざると1語として数えられ、
  // 枠を食ったうえに引っかからない
  if (/\s/.test(want.keywords)) throw new Error('キーワードに空白が混ざっている');

  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];

  // App名とサブタイトルは「App情報」に付く。版ではない。
  // appInfos は2つある（公開中のものと、これから出すもの）。公開中は書けない
  const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data;
  const info = infos.find((x) => x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');

  const v = (await get(`/v1/apps/${app.id}/appStoreVersions?limit=1`)).data[0];
  if (v.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
    console.log(`いちばん新しい版は ${v.attributes.versionString}（${v.attributes.appStoreState}）。`);
    console.log('提出前の版でないと書き換えられないので、ここで止めます。');
    return;
  }
  const vls = (await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data;
  const vl = vls.find((x) => x.attributes.locale === 'ja') || vls[0];

  let il = null;
  if (info) {
    const ils = (await get(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data;
    il = ils.find((x) => x.attributes.locale === 'ja') || ils[0];
  }

  // いまの値と並べて出す。変わらない欄は触らない
  const cut = (t) => (t == null || t === '' ? '（空）' : `${t.length}字  ${t.slice(0, 38).replace(/\n/g, ' ')}${t.length > 38 ? '…' : ''}`);
  const show = (label, now, next) => {
    if (now === next) { line(label, `変わらない   ${cut(now)}`); return true; }
    line(label, '★ 変わる');
    console.log(`      いま      ${cut(now)}`);
    console.log(`      これから  ${cut(next)}`);
    return false;
  };

  head('■ App情報（名前とサブタイトル）');
  const infoPatch = {};
  if (!il) {
    console.log('  書ける App情報がありません（公開中のものしか無い）。名前は画面から替えてください。');
  } else {
    for (const k of ['name', 'subtitle']) {
      if (!show(JA[k], il.attributes[k], want[k])) infoPatch[k] = want[k];
    }
  }

  head(`■ ${v.attributes.versionString}（${vl.attributes.locale}）`);
  const verPatch = {};
  for (const k of ['promotionalText', 'whatsNew', 'description', 'keywords']) {
    if (!show(JA[k], vl.attributes[k], want[k])) verPatch[k] = want[k];
  }

  if (!Object.keys(infoPatch).length && !Object.keys(verPatch).length) {
    console.log(`${NL}すべて原稿と同じです。触りません。`);
    return;
  }
  if (Object.keys(infoPatch).length) {
    await call(`/v1/appInfoLocalizations/${il.id}`, 'PATCH',
      { data: { type: 'appInfoLocalizations', id: il.id, attributes: infoPatch } });
    console.log(`${NL}App情報を書きました: ${Object.keys(infoPatch).map((k) => JA[k]).join('、')}`);
  }
  if (Object.keys(verPatch).length) {
    await call(`/v1/appStoreVersionLocalizations/${vl.id}`, 'PATCH',
      { data: { type: 'appStoreVersionLocalizations', id: vl.id, attributes: verPatch } });
    console.log(`${v.attributes.versionString} を書きました: ${Object.keys(verPatch).map((k) => JA[k]).join('、')}`);
  }
  console.log('node tools/asc.mjs text で読み返せます。');
}

/**
 * 課金アイテムの名前と説明を読む。
 * ここは App Store の商品ページの「App内課金」の欄に出るので、
 * 書き損じがあると商品ページに出たままになる。
 */
/** 審査メモ（レビュー担当者向けの欄）を読む */
async function memo() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  const vs = await get(`/v1/apps/${app.id}/appStoreVersions?limit=2`);
  for (const v of vs.data) {
    head(`■ ${v.attributes.versionString}`);
    const d = await get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`).catch(() => null);
    console.log(d && d.data ? (d.data.attributes.notes || '（空）') : '（取れない）');
  }
}

async function iap() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  const ps = await get(`/v1/apps/${app.id}/inAppPurchasesV2?limit=20`);
  for (const it of ps.data) {
    head(`■ ${it.attributes.productId}`);
    const ls = await get(`/v2/inAppPurchases/${it.id}/inAppPurchaseLocalizations`);
    for (const l of ls.data) {
      line(`名前（${l.attributes.locale}）`, l.attributes.name || '（空）');
      line('説明', l.attributes.description || '（空）');
    }
  }
}

/**
 * 審査に出す。
 *
 * **そのままでは出さない。** 引数に go を付けたときだけ出す:
 *   node tools/asc.mjs submit      ← 調べるだけ。出さない
 *   node tools/asc.mjs submit go   ← 実際に出す
 * 出したあと取り下げられるのは審査が始まる前だけなので、間違って走らせて
 * 出てしまう形にはしない。
 *
 * **今回は課金を連れて行かない。** 課金3つはすでに APPROVED なので、
 * 提出物は本体1件だけが正しい。1.0 のときは逆に、本体だけ出して課金を
 * 置き去りにして失敗した。**入れるべきときと入れないときがある**ので、
 * 出す前に何が入っているかを必ず出す。
 * なお API からは課金を提出物に足せない（Apple がその道を用意していない）。
 * 課金も一緒に出す必要があるときは、画面から出すこと。
 */
async function submit() {
  const go = process.argv[3] === 'go';
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)).data[0];
  const v = (await get(`/v1/apps/${app.id}/appStoreVersions?limit=1`)).data[0];
  const ng = [];
  const check = (label, ok, detail) => {
    line(label, `${ok ? '✓' : '✗'}  ${detail}`);
    if (!ok) ng.push(label);
  };

  head(`■ 出そうとしているもの`);
  line('版', `${v.attributes.versionString}（${v.attributes.appStoreState}）`);

  head('■ 出す前に調べる');
  check('提出前の版か', v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION', v.attributes.appStoreState);

  const nowBuild = (await get(`/v1/appStoreVersions/${v.id}/build`)).data;
  const { newest } = await newestBuild(app.id);
  check('ビルドが付いている', !!nowBuild, nowBuild ? `ビルド ${nowBuild.attributes.version}` : '付いていない');
  check('それがいちばん新しい', !!(nowBuild && newest && nowBuild.id === newest.id),
    newest ? `いちばん新しいのは ${newest.attributes.version}` : '新しいビルドが取れない');

  // 文言。空の欄があると審査で落ちるより先に、出す前に気づきたい
  const vls = (await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data;
  const vl = vls.find((x) => x.attributes.locale === 'ja') || vls[0];
  for (const [k, ja] of [['description', '説明'], ['keywords', 'キーワード'], ['whatsNew', '新機能'], ['promotionalText', 'プロモーション']]) {
    const t = vl.attributes[k];
    check(ja, !!(t && t.length), t ? `${t.length}字` : '空');
  }

  // スクリーンショット。版を作り直すと引き継がれないことがある
  const sets = (await get(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets`)).data;
  let shots = 0;
  const kinds = [];
  for (const set of sets) {
    const ss = (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
    shots += ss.length;
    kinds.push(`${set.attributes.screenshotDisplayType} ${ss.length}枚`);
  }
  check('スクリーンショット', shots > 0, kinds.length ? kinds.join(' / ') : '1枚も無い');

  // 出しかけのものが残っていないか。残ったまま出すと二重になる
  const subs = (await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=10`)).data;
  const open = subs.find((s) => !['COMPLETE', 'CANCELING', 'CANCELED'].includes(s.attributes.state));
  check('出しかけが残っていない', !open, open ? `${open.attributes.state} のものがある` : '無し');

  head('■ 提出物に入るもの');
  console.log(`  本体 ${v.attributes.versionString}（ビルド ${nowBuild ? nowBuild.attributes.version : '？'}）  1件だけ`);
  const ps = (await get(`/v1/apps/${app.id}/inAppPurchasesV2?limit=20`)).data;
  for (const it of ps.data ? ps.data : ps) {
    const st = it.attributes.state;
    console.log(`  課金 ${it.attributes.productId}  ${st}  ${st === 'APPROVED' ? '← 済み。連れて行かない' : '★ 済んでいない'}`);
  }

  if (ng.length) {
    console.log(`${NL}✗ ${ng.join(' / ')} が駄目なので出しません。`);
    process.exit(1);
  }
  if (!go) {
    console.log(`${NL}調べただけ。出していません。`);
    console.log('実際に出すには: node tools/asc.mjs submit go');
    return;
  }

  head('■ 出します');
  const sub = (await call('/v1/reviewSubmissions', 'POST', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: app.id } } },
    },
  })).data;
  console.log(`  箱を作った       ${sub.id}`);

  await call('/v1/reviewSubmissionItems', 'POST', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } },
      },
    },
  });
  console.log(`  本体を入れた     ${v.attributes.versionString}`);

  await call(`/v1/reviewSubmissions/${sub.id}`, 'PATCH', {
    data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } },
  });

  const back = (await get(`/v1/reviewSubmissions/${sub.id}`)).data;
  const v2 = (await get(`/v1/appStoreVersions/${v.id}`)).data;
  console.log(`  提出の状態       ${back.attributes.state}`);
  console.log(`  版の状態         ${v2.attributes.appStoreState}`);
  console.log(`${NL}審査が始まる前なら node tools/asc.mjs cancel で取り下げられます。`);
}
const cmd = process.argv[2] || 'status';
const jobs = { status, text, iap, memo, fill, notes, build, submit, cancel };
if (!jobs[cmd]) { console.error(`できること: ${Object.keys(jobs).join(', ')}`); process.exit(2); }
jobs[cmd]().catch((e) => { console.error(`${NL}失敗: ${e.message}`); process.exit(1); });

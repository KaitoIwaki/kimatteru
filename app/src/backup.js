// 自動の控え。
//
// 前は「ときどき控えを取ってください」と書くだけで、控えは手で書き出すしかなかった。
// 仕事の予定を預けてもらうには、それでは足りない。
//
// 1日に1回、日付の付いた控えを端末の中（アプリの Library）に書いておく。
//   ・毎日のぶんを 7 日
//   ・毎月 1 日のぶんを 3 か月
// を残して、それより古いものは消す。Library は iPhone の iCloud バックアップに入る。
//
// ここに書くのは端末の中だけ。外には何も送らない。
// ブラウザ（PC で開いたとき）では、ファイルの代わりに localStorage に 3 つだけ持つ。
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const DIR = 'backups';
const WEB_KEY = 'lukko.backups';
const KEEP_DAILY = 7;
const KEEP_MONTHLY = 3;

const native = () => {
  try { return Capacitor.isNativePlatform(); } catch (e) { return false; }
};

const pad = (n) => String(n).padStart(2, '0');
/** 2026-09-28 の形 */
export const stampOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * 控えの名前。auto-2026-09-28.json（毎日）/ before-2026-09-28-1530.json（戻す・取り込む前）
 * 名前だけで種類と日付が分かるようにして、一覧を作るときに中身を読まずに済ませる
 */
const nameFor = (kind, d) => kind === 'auto'
  ? `auto-${stampOf(d)}.json`
  : `${kind}-${stampOf(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;

async function ensureDir() {
  try { await Filesystem.mkdir({ path: DIR, directory: Directory.Library, recursive: true }); } catch (e) { /* もうある */ }
}

function webList() {
  try { const a = JSON.parse(localStorage.getItem(WEB_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function webSave(list) {
  try { localStorage.setItem(WEB_KEY, JSON.stringify(list.slice(0, 3))); return true; } catch (e) { return false; }
}

/** 控えを1つ書く。kind は 'auto'（毎日） / 'before'（戻す・取り込む前） */
export async function writeBackup(kind, text, now = new Date()) {
  const name = nameFor(kind, now);
  if (!native()) {
    const list = webList().filter((x) => x.name !== name);
    list.unshift({ name, at: now.getTime(), text });
    return webSave(list) ? name : null;
  }
  try {
    await ensureDir();
    await Filesystem.writeFile({ path: `${DIR}/${name}`, directory: Directory.Library, encoding: Encoding.UTF8, data: text });
    return name;
  } catch (e) {
    return null;
  }
}

/** 控えの一覧。新しい順。{ name, kind, date, at } */
export async function listBackups() {
  const parse = (name, at) => {
    const m = /^(auto|before)-(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2})(\d{2})?)?\.json$/.exec(name);
    if (!m) return null;
    const d = new Date(+m[2], +m[3] - 1, +m[4], m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
    return { name, kind: m[1], at: at || d.getTime(), day: `${+m[3]}月${+m[4]}日` };
  };
  if (!native()) return webList().map((x) => parse(x.name, x.at)).filter(Boolean);
  try {
    const r = await Filesystem.readdir({ path: DIR, directory: Directory.Library });
    return (r.files || []).map((f) => parse(typeof f === 'string' ? f : f.name, null)).filter(Boolean)
      .sort((a, b) => b.at - a.at);
  } catch (e) {
    return [];
  }
}

export async function readBackup(name) {
  if (!native()) { const x = webList().find((y) => y.name === name); return x ? x.text : null; }
  try {
    const r = await Filesystem.readFile({ path: `${DIR}/${name}`, directory: Directory.Library, encoding: Encoding.UTF8 });
    return typeof r.data === 'string' ? r.data : null;
  } catch (e) {
    return null;
  }
}

/**
 * 古い控えを消す。毎日のぶんは新しい 7 つ、月初のぶんは 3 か月。
 * 「戻す前・取り込む前」の控えは新しい 5 つ。
 * 消すのは rmSync ではなく Filesystem.deleteFile（Node の話ではないが、念のため）
 */
export async function pruneBackups() {
  if (!native()) return;
  const all = await listBackups();
  const daily = all.filter((b) => b.kind === 'auto');
  const keep = new Set(daily.slice(0, KEEP_DAILY).map((b) => b.name));
  const firsts = daily.filter((b) => /-01\.json$/.test(b.name)).slice(0, KEEP_MONTHLY);
  for (const b of firsts) keep.add(b.name);
  for (const b of all.filter((x) => x.kind === 'before').slice(0, 5)) keep.add(b.name);
  for (const b of all) {
    if (keep.has(b.name)) continue;
    try { await Filesystem.deleteFile({ path: `${DIR}/${b.name}`, directory: Directory.Library }); } catch (e) { /* 消せなくても困らない */ }
  }
}

/** 今日のぶんの自動の控えがもうあるか */
export async function hasTodayBackup(now = new Date()) {
  const want = `auto-${stampOf(now)}.json`;
  return (await listBackups()).some((b) => b.name === want);
}

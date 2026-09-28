// iCloud で同期する（2台の iPhone で同じ予定にする）。
//
// 置き場は、本人の iCloud の中の、このアプリ専用の小さな置き場（NSUbiquitousKeyValueStore）。
//  ・開発者は中身を見られない。アカウント登録も、こちらのサーバーも要らない
//    ——「外に送らない・アカウントなし」の約束はそのまま
//  ・全部で 1MB まで。予定 900 件でも 250KB ほどなので足りる。1つの値は小さめに切って置く
//
// 混ぜ方：
//  ・予定は id ごとに、updatedAt が新しいほうを残す（予定を書き換える所は全部 updatedAt を押している）
//  ・消した予定は「最近消した予定」（trash）に消した時刻ごと残っているので、それを墓標として配る。
//    相手の端末では、消した時刻より前に更新された同じ予定を消す
//  ・種類・勤務先・日にち未定の棚は、足りないものを足す（名前や色の食い違いは、この端末のほうを残す）
//
// 設定で「iCloud で同期」をオンにしたときだけ動く。最初はオフ。
import { Capacitor, registerPlugin } from '@capacitor/core';

const Native = registerPlugin('LukkoNative');
const there = () => {
  try { return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LukkoNative'); } catch (e) { return false; }
};

const META = 'lukko.sync.meta';
const PART = 'lukko.sync.';
const CHUNK = 60000;

export async function syncInfo() {
  if (!there()) return { available: false, signedIn: false };
  try { const r = await Native.kvsInfo(); return { available: !!r.available, signedIn: !!r.signedIn }; } catch (e) { return { available: false, signedIn: false }; }
}

/** 向こうから変わったと知らせが来たとき */
export function onRemoteChange(fn) {
  if (!there()) return;
  try { Native.addListener('kvsChanged', () => fn()); } catch (e) { /* 無くても使える */ }
}

/** iCloud から読む。無ければ null */
export async function readRemote() {
  if (!there()) return null;
  try {
    const m = await Native.kvsGet({ key: META });
    if (!m || !m.value) return null;
    const meta = JSON.parse(m.value);
    let text = '';
    for (let i = 0; i < (meta.parts | 0); i++) {
      const p = await Native.kvsGet({ key: PART + i });
      if (!p || typeof p.value !== 'string') return null;
      text += p.value;
    }
    const data = JSON.parse(text);
    return { ...data, at: meta.at, device: meta.device };
  } catch (e) {
    return null;
  }
}

/** iCloud に書く。小さく切って、最後に目次（meta）を書く */
export async function writeRemote(data, device) {
  if (!there()) return false;
  try {
    const text = JSON.stringify(data);
    if (text.length > 900000) return false; // 置き場の上限（1MB）に近い。書かない
    const parts = Math.ceil(text.length / CHUNK);
    for (let i = 0; i < parts; i++) await Native.kvsSet({ key: PART + i, value: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    // 前より短くなったら、余った切れ端を消す
    for (let i = parts; i < parts + 5; i++) await Native.kvsSet({ key: PART + i });
    const r = await Native.kvsSet({ key: META, value: JSON.stringify({ parts, at: Date.now(), device }) });
    return !!(r && r.ok !== false);
  } catch (e) {
    return false;
  }
}

/** 同期で渡すもの（設定は渡さない。見た目や通知の好みは、端末ごとに違ってよい） */
export function packForSync(state) {
  return {
    v: 1,
    events: state.events || [],
    types: state.types || [],
    jobs: state.jobs || [],
    someday: state.someday || [],
    // 墓標：消した予定の id と、消した時刻
    tomb: (state.trash || []).map((x) => [x.ev && x.ev.id, x.at]).filter((x) => x[0]),
  };
}

/**
 * 混ぜる。local は この端末の state、remote は readRemote の結果。
 * 変わったものだけを返す（何も変わらなければ null）
 */
export function mergeSync(local, remote) {
  if (!remote || !Array.isArray(remote.events)) return null;
  const tomb = new Map();
  for (const [id, at] of [...(remote.tomb || []), ...((local.trash || []).map((x) => [x.ev && x.ev.id, x.at]))]) {
    if (!id) continue;
    tomb.set(id, Math.max(tomb.get(id) || 0, at || 0));
  }
  const byId = new Map();
  for (const e of local.events || []) byId.set(e.id, e);
  let changed = false;
  for (const e of remote.events) {
    if (!e || !e.id) continue;
    const cur = byId.get(e.id);
    if (!cur) {
      // この端末で消したものは戻さない（消した時刻のほうが新しいとき）
      const t = tomb.get(e.id);
      if (t && t >= (e.updatedAt || 0)) continue;
      byId.set(e.id, e); changed = true;
    } else if ((e.updatedAt || 0) > (cur.updatedAt || 0)) {
      byId.set(e.id, e); changed = true;
    }
  }
  // 向こうで消されたもの
  for (const [id, at] of tomb) {
    const cur = byId.get(id);
    if (cur && (cur.updatedAt || 0) <= at && !(local.trash || []).some((x) => x.ev && x.ev.id === id)) { byId.delete(id); changed = true; }
  }
  const types = [...(local.types || [])];
  for (const t of remote.types || []) if (t && !types.some((x) => x.key === t.key)) { types.push(t); changed = true; }
  const jobs = [...(local.jobs || [])];
  for (const j of remote.jobs || []) if (j && !jobs.some((x) => x.id === j.id)) { jobs.push(j); changed = true; }
  const someday = [...(local.someday || [])];
  for (const x of remote.someday || []) if (x && !someday.some((y) => y.id === x.id) && !tomb.has(x.id)) { someday.push(x); changed = true; }
  if (!changed) return null;
  return { events: [...byId.values()], types, jobs, someday };
}

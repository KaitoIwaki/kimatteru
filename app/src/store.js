// 予定の保存先。
//
// このアプリはサーバーを持たないので、端末から消えたら戻せない。
// カレンダーアプリの低評価は「予定が突然消えた」がいちばん多く、
// ここが壊れることは、機能がひとつ動かないのとは重さが違う。
//
// localStorage だけに置いてはいけない。iOS の WKWebView に入っている
// データは、端末の空きが少ないときなどに OS 側の判断で消えることがある。
// アプリのファイル（Library）は消えない。だから二重に書く。
//
//   localStorage … 毎回すぐ書く。読むのも速いので、起動時はこちらを見る
//   ファイル      … 少し待ってから書く（毎打鍵で書くと重い）。
//                   localStorage が消えていたときの、最後の砦
//
// どちらも savedAt を持たせて、どちらが新しいか分かるようにしてある。
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export const SAVE_KEY = 'kimatteru.v2';
const FILE_NAME = 'kimatteru-store.json';
// Library は iCloud のバックアップに入る（Data は入らない、Cache は消される）。
// 機種変更で戻したいので Library を使う。
const FILE_DIR = Directory.Library;

const native = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
};

const pack = (state) => {
  const { events, types, overrides, settings, notices, lastSeenVersion, jobs } = state;
  return { events, types, overrides, settings, notices, lastSeenVersion, jobs, savedAt: Date.now() };
};

/** localStorage に書く。書けたかどうかを返す（失敗を黙って捨てない） */
export function saveLocal(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(pack(state)));
    return true;
  } catch (e) {
    return false;
  }
}

/** ファイルに書く。ネイティブ以外では何もしない */
export async function saveFile(state) {
  if (!native()) return false;
  try {
    await Filesystem.writeFile({
      path: FILE_NAME,
      directory: FILE_DIR,
      encoding: Encoding.UTF8,
      data: JSON.stringify(pack(state)),
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** 起動時に localStorage から読む（同期。最初の描画に間に合わせる） */
export function readLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (e) {
    return null;
  }
}

/** 控えのファイルから読む（非同期。localStorage が消えていたときだけ使う） */
export async function readFile() {
  if (!native()) return null;
  try {
    const r = await Filesystem.readFile({ path: FILE_NAME, directory: FILE_DIR, encoding: Encoding.UTF8 });
    const obj = JSON.parse(r.data);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (e) {
    // まだ一度も書いていなければ、ここに来る（異常ではない）
    return null;
  }
}

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const native = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
};

const toBase64 = (canvas) => canvas.toDataURL('image/png').split(',')[1];

// 日本語を含む文字列を base64 にする（btoa は非ASCIIで落ちる）
const textToBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/**
 * 控え（バックアップ）のファイルを共有シートに渡す。
 * 規約に「大切な予定は控えを取ってください」と書いてある以上、
 * 取る手段はアプリ側が用意していないと筋が通らない。
 * ネイティブ以外ではダウンロードにフォールバックする。
 */
export async function shareText(text, filename, mime = 'application/json') {
  if (!native()) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return '控えを保存しました';
    } catch (e) {
      return '控えを作れませんでした';
    }
  }
  try {
    const written = await Filesystem.writeFile({
      path: filename,
      data: textToBase64(text),
      directory: Directory.Cache,
    });
    await Share.share({ files: [written.uri] });
    return '';
  } catch (e) {
    // 共有シートを閉じただけの場合もここに来るので、失敗として騒がない
    return '';
  }
}

/**
 * 文字をそのまま渡す（ファイルにしない）。まずクリップボードにコピーし、できなければ共有シートへ。
 * 社会人の日程調整は文字でやりとりするのが普通なので、「空いてる日」を文でも送れるようにした。
 * 戻り値は利用者に見せるひとこと。
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return 'コピーしました。LINE やメールに貼り付けてください';
    }
  } catch (e) { /* 共有シートへ */ }
  if (native()) {
    try { await Share.share({ text }); return ''; } catch (e) { return ''; }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    return 'コピーしました';
  } catch (e) {
    return 'コピーできませんでした';
  }
}

/** 文字を共有シートで送る（1件の予定を送るとき。.ics のファイルも一緒に渡せる） */
export async function shareTextAndFile(text, filename, fileText, mime = 'text/calendar') {
  if (!native()) return copyText(text);
  try {
    const files = [];
    if (fileText) {
      const written = await Filesystem.writeFile({ path: filename, data: textToBase64(fileText), directory: Directory.Cache });
      files.push(written.uri);
    }
    await Share.share({ text, ...(files.length ? { files } : {}) });
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * 画像を共有シートに渡す。ネイティブ以外ではダウンロードにフォールバックする。
 * 戻り値は利用者に見せるひとこと。
 */
export async function shareCanvas(canvas, filename) {
  if (!native()) {
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return '画像を保存しました';
    } catch (e) {
      return '画像を作れませんでした';
    }
  }

  try {
    // 共有シートに渡すにはファイルの実体が要るので、いったんキャッシュに書く
    const written = await Filesystem.writeFile({
      path: filename,
      data: toBase64(canvas),
      directory: Directory.Cache,
    });
    // 画像だけを渡す。text を一緒に渡すと、Slack など一部のアプリが
    // テキストだけを受け取って画像を落としてしまう。
    await Share.share({ files: [written.uri] });
    return '';
  } catch (e) {
    // 共有シートを閉じただけの場合もここに来るので、失敗として騒がない
    return '';
  }
}

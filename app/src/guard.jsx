// 描画中のエラーを受け止める。
//
// 前はこれが無く、描画のどこかで一度でもエラーが出ると、React は画面を丸ごと外すので
// 真っ白のまま動かなくなった（「開いたら真っ白で、5 秒待っても白いまま」と本人）。
// 受け止めたら、真っ白の代わりに「もう一度開く」と、エラーの中身を出す。
//
// エラーの中身は localStorage に 1 件だけ残す（LAST_ERROR_KEY）。次に起きたとき、
// 何が起きたかを調べられるように。描画の外で起きたエラー（ボタンの処理の中、Promise）も
// 画面は壊さないが、同じ所に残す。予定の保存とは別の鍵なので、予定には触らない。
import React from 'react';

export const LAST_ERROR_KEY = 'lukko.lastError';

export function recordError(err, where) {
  try {
    const e = err instanceof Error ? err : new Error(String(err && err.message ? err.message : err));
    const rec = {
      at: new Date().toISOString(),
      where,
      message: String(e.message || e).slice(0, 500),
      stack: String(e.stack || '').split('\n').slice(0, 12).join('\n').slice(0, 2000),
      version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '',
    };
    localStorage.setItem(LAST_ERROR_KEY, JSON.stringify(rec));
    return rec;
  } catch (_) {
    return null;
  }
}

// 描画の外のエラー。画面は壊れないので、記録だけ
export function watchErrors() {
  window.addEventListener('error', (ev) => recordError(ev.error || ev.message, 'error'));
  window.addEventListener('unhandledrejection', (ev) => recordError(ev.reason, 'promise'));
}

export class Guard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { rec: null };
  }
  static getDerivedStateFromError(err) {
    return { rec: { message: String((err && err.message) || err) } };
  }
  componentDidCatch(err, info) {
    const rec = recordError(err, 'render');
    if (rec && info && info.componentStack) {
      rec.componentStack = String(info.componentStack).split('\n').slice(0, 8).join('\n');
      try { localStorage.setItem(LAST_ERROR_KEY, JSON.stringify(rec)); } catch (_) { /* 書けなくても画面は出す */ }
    }
    if (rec) this.setState({ rec });
  }
  render() {
    const { rec } = this.state;
    if (!rec) return this.props.children;
    // 色は styles.css の変数（暗い画面にも合う）。変数が無くても読める色を後ろに置く
    return (
      <div style={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box',
        padding: 'calc(env(safe-area-inset-top) + 48px) 28px 40px',
        background: 'var(--bg, #F6F7F9)', color: 'var(--ink, #1E2024)', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>うまく表示できませんでした</div>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-soft, #555A62)' }}>
          予定は消えていません。下のボタンで開き直してください。
          何度も出るときは、この画面の写真を送っていただけると直せます。
        </div>
        <button onClick={() => location.reload()}
          style={{ marginTop: 8, height: 50, borderRadius: 14, border: 'none', background: '#7FAE86', color: '#fff',
            fontSize: 16, fontWeight: 600 }}>
          もう一度開く
        </button>
        <pre style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--bg2, #ECEEF1)', maxWidth: '100%', boxSizing: 'border-box',
          fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--ink-soft, #555A62)' }}>
          {/* 写真 1 枚に収まる量だけ。残りは localStorage（LAST_ERROR_KEY）に全部ある */}
          {[rec.message, [rec.version && `v${rec.version}`, rec.at].filter(Boolean).join('  '),
            String(rec.stack || '').split('\n').slice(1, 5).join('\n'),
            String(rec.componentStack || '').split('\n').slice(0, 4).join('\n')].filter(Boolean).join('\n')}
        </pre>
      </div>
    );
  }
}

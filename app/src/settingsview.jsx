import React from 'react';
import { s } from './style';
import { Jp } from './jp.jsx';

// 設定の画面。view.jsx から切り出した（群が増えて、1つのファイルに収まりにくくなったため）。
// 値はすべて App.jsx の renderVals / _settingsVals が返す v から来る。
//
// 群の並びは「よく触るもの → たまに触るもの → 見るだけ」。
//   使い方 / カレンダー / 空き状況 / お知らせ / 働いた時間と給料 / 予定の出し入れ / 安全 / このアプリについて / 応援
// 説明の地の文は群ごとに1つまで。細かい話はたたんでおく。

const HEAD = 'font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px';
const CARD = 'background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:10px';
const NOTE = 'font-size:11px;color:var(--ink-faint);margin:0 6px 24px;line-height:1.8;text-wrap:pretty';
const ICON = 'width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0';

/** 1行。左に名前（と小さな説明）、右に値やスイッチ */
function Row({ label, sub, right, onClick, last, chevron }) {
  // 右の値が長いと、左の説明が数文字幅に押しつぶされて縦長になっていた（「学校とバイト（はじめのまま）」など）。
  // 文字を大きくすると幅が減るので、もっと起きる。左には 150px を残し、入らなければ右を次の行へ回す
  return (
    <div style={s(`display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;column-gap:12px;row-gap:8px;padding:13px 16px;${last ? '' : 'border-bottom:1px solid var(--line);'}${onClick ? 'cursor:pointer;' : ''}`)} onClick={onClick}>
      <span style={s('display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 150px')}>
        <span style={s('font-size:15px;color:var(--ink)')}>{label}</span>
        {!!sub && <span style={s('font-size:11px;color:var(--ink-mut);text-wrap:pretty;line-height:1.6')}>{sub}</span>}
      </span>
      {(right || chevron) && (
        <span style={s('display:flex;align-items:center;gap:12px;margin-left:auto;max-width:100%;min-width:0')}>
          {right}
          {chevron && <span style={s('font-size:16px;color:var(--ink-faint);flex-shrink:0')}>›</span>}
        </span>
      )}
    </div>
  );
}
function Toggle({ t, onClick }) {
  return <div style={s(t.track)} onClick={(e) => { e.stopPropagation(); onClick(); }}><div style={s(t.knob)} /></div>;
}
function Seg({ items, width }) {
  return (
    <div style={s(`display:flex;background:var(--bg2);border-radius:10px;padding:2px;${width ? `width:${width}px;` : 'flex:1;'}`)}>
      {(items || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
    </div>
  );
}
function TimeSel({ value, onChange, opts }) {
  return (
    <select value={value} onChange={onChange}
      style={s('appearance:none;-webkit-appearance:none;border:none;outline:none;background:var(--bg2);border-radius:9px;padding:7px 10px;font-size:14px;color:var(--ink);font-family:inherit;font-variant-numeric:tabular-nums;text-align:center')}>
      {(opts || []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}
function Sheet({ title, onClose, children }) {
  return (
    <div style={s('position:absolute;inset:0;z-index:92;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:flex-end;justify-content:center;animation:scrimIn .2s ease')} onClick={onClose}>
      <div style={s('width:100%;max-height:82%;overflow-y:auto;background:var(--bg);border-radius:20px 20px 0 0;padding:18px 16px 34px;animation:riseUp .26s cubic-bezier(.2,.9,.2,1)')} onClick={(e) => e.stopPropagation()}>
        <div style={s('display:flex;align-items:center;justify-content:space-between;margin:0 4px 14px')}>
          <span style={s('font-size:17px;color:var(--ink)')}>{title}</span>
          <span role="button" style={s('font-size:14px;color:var(--ink-mut);cursor:pointer;padding:4px')} onClick={onClose}>閉じる</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Settings({ v }) {
  return (
    <div style={s('position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
      <div className="scr-head-solo" style={s('padding:0 20px 10px')}>
        <span style={s('font-size:30px;font-weight:300;color:var(--ink);letter-spacing:-.5px')}>設定</span>
      </div>
      <div style={s('flex:1;overflow-y:auto;padding:8px 16px 110px')}>

        {/* ===== 使い方 ===== */}
        <div style={s(HEAD)}>使い方</div>
        <div style={s(CARD)}>
          <Row label="ふだんの予定" sub="種類の並び・呼び名・空き状況の時間帯が、これに合わせて決まります" last
            right={<span style={s('font-size:14px;color:var(--ink-mut);text-align:right;min-width:0;flex-shrink:1;line-height:1.45;text-wrap:balance')}>{v.profileLabel}</span>} chevron onClick={v.onOpenProfile} />
        </div>
        <div style={s(NOTE)}>{''}<Jp parts={['卒業・就職・転職で', '働き方が変わったときも、', 'ここから選び直せます。', '予定はそのまま残ります。']} /></div>

        {/* ===== カレンダー ===== */}
        <div style={s(HEAD)}>カレンダー</div>
        <div style={s(CARD)}>
          <div style={s(`display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;${v.typeListOpen ? 'border-bottom:1px solid var(--line)' : ''}`)} onClick={v.onToggleTypeList}>
            <span style={s('font-size:15px;color:var(--ink);flex-shrink:0')}>予定の種類</span>
            <span style={s('display:flex;align-items:center;gap:5px;flex:1;min-width:0;flex-wrap:wrap;justify-content:flex-end')}>
              {(v.typeDots || []).map((d, i) => (<span key={i} style={s(d.style)} />))}
              {!!v.typeMoreLabel && <span style={s('font-size:11px;color:var(--ink-faint);font-variant-numeric:tabular-nums')}>{v.typeMoreLabel}</span>}
            </span>
            <span style={s('font-size:14px;color:var(--ink-mut);font-variant-numeric:tabular-nums;flex-shrink:0')}>{v.typeCountLabel}</span>
            <span style={s('font-size:16px;color:var(--ink-faint);flex-shrink:0')}>{v.typeListOpen ? '⌄' : '›'}</span>
          </div>
          {v.typeListOpen && (<>
            {(v.typeRows || []).map((t, i) => (
              <div key={i} style={s(t.rowStyle)}>
                <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={t.onTap}>
                  <span style={s(t.dotStyle)} />
                  <span style={s('flex:1;font-size:15px;color:var(--ink)')}>{t.name}</span>
                  <span style={s('font-size:12px;color:var(--ink-faint)')}>{t.hint}</span>
                </div>
                {t.open && (
                  <div style={s('padding:2px 16px 16px')}>
                    <input value={t.name} onChange={t.onName} placeholder="種類の名前" style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit;margin-bottom:14px')} />
                    <div style={s('display:flex;flex-wrap:wrap;gap:12px')}>
                      {(t.swatches || []).map((sw, j) => (<div key={j} style={s(sw.style)} onClick={sw.onClick} />))}
                    </div>
                    {/* 呼び名。仕事なら「仮押さえ／確定」のように、種類ごとに変えられる */}
                    <div style={s('display:flex;gap:8px;margin-top:14px')}>
                      <label style={s('flex:1;display:flex;flex-direction:column;gap:4px')}>
                        <span style={s('font-size:11px;color:var(--ink-mut)')}>まだのときの呼び名（点線）</span>
                        <input value={t.uWord} onChange={t.onUWord} placeholder="例：仮押さえ" style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:10px;padding:9px 11px;font-size:14px;color:var(--ink);font-family:inherit')} />
                      </label>
                      <label style={s('flex:1;display:flex;flex-direction:column;gap:4px')}>
                        <span style={s('font-size:11px;color:var(--ink-mut)')}>決まったときの呼び名（塗り）</span>
                        <input value={t.cWord} onChange={t.onCWord} placeholder="例：確定" style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:10px;padding:9px 11px;font-size:14px;color:var(--ink);font-family:inherit')} />
                      </label>
                    </div>
                    <div style={s('display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap')}>
                      <span style={s('font-size:11px;color:var(--ink-faint);flex:1;min-width:120px')}>{t.usedCount > 0 ? `${t.usedCount}件の予定で使っています` : 'まだ使っていません'}</span>
                      {t.onUp && <span role="button" aria-label="上へ" style={s('padding:6px 10px;border-radius:9px;border:1px solid var(--line);font-size:13px;color:var(--ink-soft);cursor:pointer')} onClick={t.onUp}>↑</span>}
                      {t.onDown && <span role="button" aria-label="下へ" style={s('padding:6px 10px;border-radius:9px;border:1px solid var(--line);font-size:13px;color:var(--ink-soft);cursor:pointer')} onClick={t.onDown}>↓</span>}
                      <span role="button" style={s('padding:6px 11px;border-radius:9px;border:1px solid var(--line);font-size:13px;color:var(--ink-soft);cursor:pointer')} onClick={t.onHide}>{t.hideLabel}</span>
                      {t.onAskDelete && <span role="button" style={s('padding:6px 11px;border-radius:9px;font-size:13px;color:#A8452B;cursor:pointer')} onClick={t.onAskDelete}>消す</span>}
                    </div>
                    {t.deleting && (
                      <div style={s('margin-top:12px;padding:12px;border-radius:12px;background:var(--bg2)')}>
                        <div style={s('font-size:12.5px;color:var(--ink-soft);margin-bottom:10px;line-height:1.7')}>この種類の予定を、どの種類へ移しますか？（予定は消えません）</div>
                        <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>{t.moveChips.map((c, k) => (<span key={k} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}</div>
                        <div style={s('font-size:12px;color:var(--ink-mut);margin-top:10px;cursor:pointer')} onClick={t.onCancelDelete}>やめる</div>
                      </div>
                    )}
                    <div style={s('font-size:11px;color:var(--ink-faint);margin-top:10px;line-height:1.7')}>隠すと、予定を作るときの選択肢から消えます。予定はカレンダーに残ります。</div>
                  </div>
                )}
              </div>
            ))}
            <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={v.onAddTypeRow}>
              <span style={s('width:26px;height:26px;border-radius:11px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:400')}>＋</span>
              <span style={s('flex:1;font-size:15px;color:var(--ink)')}>種類を追加</span>
            </div>
            {v.newTypeShown && (
              <div style={s('padding:2px 16px 16px;background:var(--bg2)')}>
                <input value={v.newTypeName} placeholder={v.typeEg || '種類の名前'} onChange={v.onNewTypeName} style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit;margin:12px 0 14px')} />
                <div style={s('display:flex;flex-wrap:wrap;gap:12px')}>
                  {(v.newTypeSwatches || []).map((sw, i) => (<div key={i} style={s(sw.style)} onClick={sw.onClick} />))}
                </div>
                <div style={s('display:flex;gap:8px;margin-top:16px')}>
                  <div style={s('flex:1;text-align:center;padding:11px;border-radius:13px;background:var(--card);color:var(--ink-soft);font-size:14px;font-weight:600;cursor:pointer')} onClick={v.onCancelNewType}>やめる</div>
                  <div style={s(v.addTypeBtnStyle)} onClick={v.onAddType}>この種類を追加</div>
                </div>
              </div>
            )}
          </>)}
        </div>
        <div style={s(CARD)}>
          <Row label="週のはじまり" right={<Seg items={v.weekSeg} width={150} />} />
          <Row label="「無くなった」予定を隠す" sub="オフなら取り消し線で薄く残します" right={<Toggle t={{ track: v.hideTrack, knob: v.hideKnob }} onClick={v.onToggleHide} />} />
          <Row label="帯に開始時刻を出す" sub="月表示の帯に「10 定例」のように時を添えます" right={<Toggle t={v.barTime} onClick={v.onBarTime} />} />
          <Row label="点線の帯に「仮」を付ける" sub="まだの予定の頭に小さく「仮」と出します" right={<Toggle t={v.kariMark} onClick={v.onKariMark} />} last />
        </div>
        <div style={s(CARD)}>
          <div style={s('padding:13px 16px;border-bottom:1px solid var(--line)')}>
            <div style={s('font-size:15px;color:var(--ink);margin-bottom:9px')}>表示</div>
            <Seg items={v.themeSeg} />
          </div>
          <div style={s('padding:13px 16px')}>
            <div style={s('font-size:15px;color:var(--ink);margin-bottom:3px')}>文字の大きさ</div>
            <div style={s('font-size:11px;color:var(--ink-mut);margin-bottom:9px')}>「iPhone」は、iPhone の設定の文字の大きさに合わせます</div>
            <Seg items={v.fontSeg} />
          </div>
        </div>
        <div style={s('margin-bottom:24px')} />

        {/* ===== 空き状況 ===== */}
        <div style={s(HEAD)}>空き状況</div>
        <div style={s(CARD)}>
          <Row label="平日に空きを見る時間" right={<span style={s('display:flex;align-items:center;gap:5px')}><TimeSel value={v.freeWd[0]} onChange={v.onFreeWd(0)} opts={v.timeOpts} />〜<TimeSel value={v.freeWd[1]} onChange={v.onFreeWd(1)} opts={v.timeOpts} /></span>} />
          <Row label="休日に空きを見る時間" sub="土日と祝日" right={<span style={s('display:flex;align-items:center;gap:5px')}><TimeSel value={v.freeHd[0]} onChange={v.onFreeHd(0)} opts={v.timeOpts} />〜<TimeSel value={v.freeHd[1]} onChange={v.onFreeHd(1)} opts={v.timeOpts} /></span>} />
          <Row label="いつもの勤務時間" sub="入れておくと、その時間は予定が無くてもふさがっている扱いにします" right={<Toggle t={v.workOn} onClick={v.onWorkToggle} />} last={!v.workHoursOn && !v.overlayCals.length} />
          {v.workHoursOn && (
            <div style={s('padding:4px 16px 14px;border-bottom:1px solid var(--line)')}>
              <div style={s('display:flex;gap:4px;margin-bottom:10px')}>{(v.workDays || []).map((d, i) => (<span key={i} style={s(d.style)} onClick={d.onClick}>{d.label}</span>))}</div>
              <div style={s('display:flex;align-items:center;gap:6px;justify-content:flex-end')}>
                <TimeSel value={v.workFrom} onChange={v.onWorkFrom} opts={v.timeOpts} />〜<TimeSel value={v.workTo} onChange={v.onWorkTo} opts={v.timeOpts} />
              </div>
            </div>
          )}
          {v.overlayCals.length > 0 && (
            <Row label="重ねて表示しているカレンダーも数える" sub="会社のカレンダーの会議も、ふさがっている扱いにします" right={<Toggle t={v.overlayFree} onClick={v.onOverlayFree} />} last />
          )}
        </div>
        <div style={s(NOTE)}>{''}<Jp parts={['「休み」の種類の予定は、', '空いている日として', '数えます。', '前の日から続く夜勤は、', '明けの朝をふさぎます。']} /></div>

        {/* ===== お知らせ ===== */}
        <div style={s(HEAD)}>お知らせ</div>
        <div style={s(CARD)}>
          <Row label="朝のまとめ" sub="「今日 3件（うち まだ1件）」を毎朝お知らせします" right={<span style={s('display:flex;align-items:center;gap:8px')}>{v.morning.track.background === 'var(--ink)' && <TimeSel value={v.morningAt} onChange={v.onMorningAt} opts={v.timeOpts} />}<Toggle t={v.morning} onClick={v.onMorning} /></span>} />
          <Row label="前の晩に、明日の予定" sub="21:00 に明日の予定をお知らせします" right={<Toggle t={v.evening} onClick={v.onEvening} />} />
          <Row label="日曜の夜に、まだの予定を見直す" sub="来週の点線の予定を、まとめて片づけられます" right={<Toggle t={v.weeklyReview} onClick={v.onWeekly} />} />
          <div style={s('padding:13px 16px;border-bottom:1px solid var(--line)')}>
            <div style={s('font-size:15px;color:var(--ink);margin-bottom:3px')}>いつものお知らせ</div>
            <div style={s('font-size:11px;color:var(--ink-mut);margin-bottom:9px')}>新しい予定に、最初から付けておくお知らせ（時刻のある予定）</div>
            <Seg items={v.remindTimedSeg} />
            <div style={s('font-size:11px;color:var(--ink-mut);margin:10px 0 9px')}>終日の予定</div>
            <Seg items={v.remindAllDaySeg} />
          </div>
          <Row label="ウィジェットと通知で名前を隠す" sub="すべての予定を「予定あり」とだけ出します（予定ごとにも選べます）" right={<Toggle t={v.hideTitles} onClick={v.onHideTitles} />} last={!v.remindRowShown} />
          {v.remindRowShown && (
            <Row label="シフト後に記録をリマインド" sub="終わった時間に「記録しますか？」とお知らせします" right={<Toggle t={{ track: v.remindTrack, knob: v.remindKnob }} onClick={v.onToggleRemind} />} last />
          )}
        </div>
        <div style={s('margin-bottom:24px')} />

        {/* ===== 働いた時間と給料 ===== */}
        <div style={s(HEAD)}>{v.wageHead}</div>
        <div style={s(CARD)}>
          {(v.jobRows || []).map((j, i) => (
            <div key={i} style={s(j.rowStyle)}>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={j.onTap}>
                <span style={s(`flex:1;font-size:15px;color:${j.retired ? 'var(--ink-faint)' : 'var(--ink)'}`)}>{j.name}</span>
                <span style={s('font-size:14px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>¥{j.hourly}</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>{j.open ? '⌄' : '›'}</span>
              </div>
              {j.open && (
                <div style={s('padding:2px 16px 16px')}>
                  <input value={j.name.replace('（辞めた）', '') === '（名前なし）' ? '' : j.name.replace('（辞めた）', '')} onChange={j.onName} placeholder={v.jobEg} style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit;margin-bottom:12px')} />
                  <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px')}>
                    <span style={s('font-size:14px;color:var(--ink-mut)')}>時給</span>
                    <div style={s('display:flex;align-items:center;gap:10px;flex-shrink:0')}>
                      <div style={s(v.stepBtn)} onClick={j.onMinus}>−</div>
                      <div style={s('display:flex;align-items:center;gap:3px;background:var(--bg2);border-radius:12px;padding:6px 12px')}>
                        <span style={s('font-size:15px;font-weight:400;color:var(--ink-soft)')}>¥</span>
                        <input value={j.hourly} onChange={j.onHourly} inputMode="numeric" maxLength={5} style={s('width:6ch;min-width:6ch;border:none;outline:none;background:transparent;font-size:16px;font-weight:400;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;font-family:inherit;padding:0')} />
                      </div>
                      <div style={s(v.stepBtn)} onClick={j.onPlus}>＋</div>
                    </div>
                  </div>
                  {/* 時給を変えても、これまでの記録の金額は変わらない。変えたくないときの逃げ道も置く */}
                  <div style={s('font-size:11px;color:var(--ink-faint);margin-top:8px;line-height:1.7')}>
                    時給を変えると、これから記録するぶんにだけ効きます。
                    {j.rateNote && <span style={s('color:var(--ink-mut);text-decoration:underline;cursor:pointer;margin-left:4px')} onClick={j.onRecount}>これまでの記録も数え直す</span>}
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px')}>
                    <span style={s('font-size:13px;color:var(--ink-mut)')}>締め日</span>
                    <TimeSel value={j.closeDay} onChange={j.onCloseDay} opts={v.closeOpts} />
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px')}>
                    <span style={s('font-size:13px;color:var(--ink-mut)')}>給料日</span>
                    <TimeSel value={j.payDay} onChange={j.onPayDay} opts={v.payOpts} />
                  </div>
                  {/* シフトの型。マスを押すだけで置く「シフト入力」で使う */}
                  <div style={s('margin-top:14px;padding-top:12px;border-top:1px solid var(--line)')}>
                    <div style={s('font-size:13px;color:var(--ink-mut);margin-bottom:8px')}>シフトの型（月表示の「シフト入力」で使います）</div>
                    {j.templates.map((t) => (
                      <div key={t.key} style={s('display:flex;align-items:center;gap:8px;padding:6px 0')}>
                        <span style={s('flex:1;font-size:14px;color:var(--ink);font-variant-numeric:tabular-nums')}>{t.text}</span>
                        <span style={s('font-size:12px;color:#A8452B;cursor:pointer')} onClick={t.onRemove}>外す</span>
                      </div>
                    ))}
                    <span style={s('display:inline-block;margin-top:4px;padding:6px 12px;border-radius:999px;border:1px dashed var(--line);font-size:12.5px;color:var(--ink-mut);cursor:pointer')} onClick={j.onAddTemplate}>＋ 型を足す（日勤・夜勤・休 など）</span>
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;margin-top:14px')}>
                    <span style={s('font-size:11px;color:var(--ink-faint)')}>{j.usedCount > 0 ? `${j.usedCount}件の予定で使っています` : 'まだ使っていません'}</span>
                    <span style={s('display:flex;gap:14px')}>
                      <span style={s('font-size:13px;color:var(--ink-soft);cursor:pointer')} onClick={j.onRetire}>{j.retireLabel}</span>
                      <span style={s('font-size:13px;color:#A8452B;cursor:pointer')} onClick={j.onRemove}>削除</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={s(`display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;${(v.jobRows || []).length ? 'border-top:1px solid var(--line)' : ''}`)} onClick={v.onAddJob}>
            <span style={s('width:26px;height:26px;border-radius:11px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:400')}>＋</span>
            <span style={s('flex:1;font-size:15px;color:var(--ink)')}>{v.jobAddLabel}</span>
          </div>
          {v.retiredCount > 0 && (
            <div style={s('padding:0 16px 12px;font-size:12px;color:var(--ink-mut);cursor:pointer')} onClick={v.onShowRetired}>{v.showRetired ? '辞めたところを隠す' : `辞めたところ（${v.retiredCount}）も出す`}</div>
          )}
        </div>
        <div style={s(CARD)}>
          <div style={s('padding:13px 16px;border-bottom:1px solid var(--line)')}>
            <div style={s('font-size:15px;color:var(--ink);margin-bottom:3px')}>月表示の「給料」スイッチ</div>
            <div style={s('font-size:11px;color:var(--ink-mut);margin-bottom:9px')}>「記録があれば」は、{v.jobWord}か働いた記録があるときだけ出します</div>
            <Seg items={v.wageFeatureSeg} />
          </div>
          <Row label="有給の残りを数える" sub="「休み」の予定で、名前に「有給」「半休」があるものを数えます" right={<Toggle t={v.leaveOn} onClick={v.onLeaveToggle} />} last={!v.leaveShown} />
          {v.leaveShown && (
            <div style={s('padding:6px 16px 14px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px')}>
                <span style={s('font-size:13px;color:var(--ink-mut)')}>1年にもらう日数</span>
                <input value={v.leaveGrant} onChange={v.onLeaveGrant} inputMode="decimal" style={s('width:6ch;border:none;outline:none;background:var(--bg2);border-radius:9px;padding:7px 10px;font-size:14px;color:var(--ink);text-align:right;font-family:inherit')} />
              </div>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px')}>
                <span style={s('font-size:13px;color:var(--ink-mut)')}>付く月</span>
                <TimeSel value={v.leaveStart} onChange={v.onLeaveStart} opts={v.leaveStartOpts} />
              </div>
              {!!v.leaveText && <div style={s('font-size:12.5px;color:var(--ink);margin-top:10px')}>{v.leaveText}</div>}
            </div>
          )}
        </div>
        {v.jobsEmpty && (
          <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px;line-height:1.8')}>
            {''}<Jp parts={['時給は', `${v.jobWord}ごとに`, '決めます。']} />
          </div>
        )}
        <div style={s('margin-bottom:24px')} />

        {/* ===== 予定の出し入れ ===== */}
        <div style={s(HEAD)}>予定の出し入れ</div>
        {v.syncShown && (
          <div style={s(CARD)}>
            <Row label="iCloud で同期（2台の iPhone で同じ予定）" sub={v.syncSub} right={<Toggle t={v.sync} onClick={v.onSync} />} last />
          </div>
        )}
        <div style={s(CARD)}>
          {v.importAvailable && (
            <Row label="ほかのカレンダーから取り込む" onClick={v.onOpenImport} chevron right={<span style={s(ICON)}>↓</span>} />
          )}
          <Row label="TimeTree・Google などのファイルから" sub="書き出したファイル（.ics）を取り込みます" onClick={v.onPickIcs} chevron />
          <Row label="ほかのカレンダー用に書き出す" sub="予定をファイル（.ics）にして、ほかのアプリへ渡せます" onClick={v.onExportIcs} chevron />
          {v.tidyCount > 0 && <Row label="取り込んだ予定を整理する" onClick={v.onOpenTidy} chevron right={<span style={s('font-size:13px;color:var(--ink-mut)')}>{v.tidyCount}件</span>} />}
          {v.undoImportShown && <Row label={v.undoImportLabel} onClick={v.onUndoImport} chevron />}
          <Row label="最近消した予定" sub="消してから30日間は、ここから戻せます" onClick={v.onOpenTrash} chevron right={<span style={s('font-size:13px;color:var(--ink-mut)')}>{v.trashCount}件</span>} last />
        </div>
        <div style={s(CARD)}>
          <Row label="機種変更用に保存する（控え）" sub={v.lastExportText} onClick={v.onExportBackup} chevron />
          <Row label="控えから戻す" sub="書き出した控えのファイルをえらびます" onClick={v.onPickBackup} chevron />
          <Row label="端末の中の控えから戻す" sub={v.lastBackupText} onClick={v.onOpenBackups} chevron last />
        </div>
        {/* 見えない入力。行から click() で開く */}
        <input id="ics-file" type="file" accept=".ics,text/calendar" onChange={v.onIcsFile} style={s('display:none')} />
        <input id="backup-file" type="file" accept=".json,application/json" onChange={v.onBackupFile} style={s('display:none')} />
        {!!v.backupError && (
          <div style={s('font-size:11px;color:#A8452B;margin:0 8px 8px;line-height:1.6;text-wrap:pretty')}>{v.backupError}</div>
        )}
        {v.pasteOpen && (
          <div style={s('background:var(--card);border-radius:17px;padding:14px;margin-bottom:8px')}>
            <div style={s('font-size:11px;color:var(--ink-mut);line-height:1.7;margin:0 2px 8px;text-wrap:pretty')}>
              書き出した控えのファイルを開いて、中身を全部コピーしてここに貼ってください。
            </div>
            <textarea value={v.backupText} onChange={v.onBackupText} placeholder="控えの中身を貼り付け" rows={4}
              style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:12px;color:var(--ink);font-family:inherit;resize:none;line-height:1.6')} />
            <div style={s(`margin-top:12px;padding:12px;border-radius:13px;text-align:center;font-size:14px;font-weight:700;cursor:pointer;background:var(--bg2);color:var(--ink);border:1px solid var(--line);${v.restoreDisabled ? 'opacity:.4' : ''}`)} onClick={v.restoreDisabled ? undefined : v.onAskRestore}>
              この控えから戻す
            </div>
          </div>
        )}
        {/* 機種変更のしかた。いちばん聞かれることなので、たたんで置く */}
        <div style={s(CARD)}>
          <Row label="機種変更のとき" onClick={v.onToggleMigrate} right={<span style={s(`font-size:12px;color:var(--ink-mut);transition:transform .2s;transform:rotate(${v.migrateOpen ? '90deg' : '0deg'})`)}>▶</span>} last={!v.migrateOpen} />
          {v.migrateOpen && (
            <div style={s('padding:4px 16px 16px;font-size:12.5px;color:var(--ink-soft);line-height:1.9')}>
              <div style={s('display:flex;gap:8px')}><span style={s('font-weight:700')}>1</span><span>iPhone を「クイックスタート」か「iCloud バックアップから復元」で移せば、予定もそのまま移ります（予定は iPhone のバックアップに入っています）。</span></div>
              <div style={s('display:flex;gap:8px;margin-top:6px')}><span style={s('font-weight:700')}>2</span><span>念のため、移す前に「機種変更用に保存する（控え）」でファイルを取っておくと安心です。移らなかったときは、新しい iPhone で「控えから戻す」を押してファイルをえらびます。</span></div>
              <div style={s('margin-top:8px;font-size:11.5px;color:var(--ink-faint)')}>控えの中身はそのまま読める文字です。自分だけが見られる場所（ファイル・iCloud Drive など）に保存してください。</div>
            </div>
          )}
        </div>
        {/* ここが唯一の「どこに保存されているか」の説明 */}
        <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 8px;line-height:1.8;text-wrap:pretty')}>
          {''}<Jp parts={['予定はこの iPhone の中だけにあり、', '外部に送られることは', 'ありません。', '端末の中に毎日1回、', '自動で控えを取っています。']} />
        </div>
        <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 24px;line-height:1.8;cursor:pointer;text-decoration:underline')} onClick={v.onTogglePaste}>
          ファイルをえらべないときは、貼り付けでも戻せます
        </div>

        {/* ===== iPhone のカレンダー ===== */}
        {v.importAvailable && (<>
          <div style={s(HEAD)}>iPhone のカレンダー</div>
          <div style={s(CARD)}>
            <Row label="重ねて表示する" sub="会社や家族のカレンダーの予定を、灰色の帯で並べて見せます（LUKKO には保存しません）" right={<Toggle t={v.overlayOn} onClick={v.onOverlay} />} last={!v.overlayCals.length} />
            {v.overlayCals.map((c, i) => (
              <div key={c.key} style={s(`display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;${i < v.overlayCals.length - 1 ? 'border-bottom:1px solid var(--line-faint)' : ''}`)} onClick={c.onClick}>
                <span style={s({ width: 10, height: 10, borderRadius: 5, background: c.dot, flexShrink: 0 })} />
                <span style={s('flex:1;font-size:14px;color:var(--ink)')}>{c.label}</span>
                <span style={s(`width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;${c.on ? 'background:var(--ink);color:var(--card)' : 'border:1.5px solid var(--line)'}`)}>{c.on ? '✓' : ''}</span>
              </div>
            ))}
          </div>
          <div style={s(CARD)}>
            <Row label="決まった予定を iPhone のカレンダーにも入れる" sub="「LUKKO」という名前のカレンダーを1つ作り、そこにだけ書きます。まだの予定は入れません" right={<Toggle t={v.exportCal} onClick={v.onExportCal} />} last />
          </div>
          <div style={s(NOTE)}>{''}<Jp parts={['どちらも、はじめはオフです。', 'オンにしなければ、', 'iPhone のカレンダーには', '何も書きません。']} /></div>
        </>)}

        {/* ===== 安全 ===== */}
        {v.lockAvailable && (<>
          <div style={s(HEAD)}>安全</div>
          <div style={s(CARD)}>
            <Row label={`開くときに ${v.lockLabel}`} sub="ほかのアプリから戻ったときも確かめます。アプリを切り替える画面では中身をぼかします" right={<Toggle t={v.lock} onClick={v.onLock} />} last />
          </div>
          <div style={s('margin-bottom:24px')} />
        </>)}

        {/* ===== このアプリについて ===== */}
        <div style={s(HEAD)}>このアプリについて</div>
        <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:14px')}>
          <Row label="使い方をもう一度見る" onClick={v.onReplayGuide} chevron />
          <a href={v.supportHref} target="_blank" rel="noreferrer" style={s('display:block;text-decoration:none;-webkit-tap-highlight-color:transparent')}>
            <Row label="よくある質問" sub="機種変更・同期・会社の予定を入れても大丈夫か など" chevron />
          </a>
          <a href={v.reviewHref} target="_blank" rel="noreferrer" style={s('display:block;text-decoration:none;-webkit-tap-highlight-color:transparent')}>
            <Row label="App Store でレビューする" chevron />
          </a>
          <a href={v.contactHref} style={s('display:block;text-decoration:none;-webkit-tap-highlight-color:transparent')}>
            <Row label="お問い合わせ" sub={v.contactEmail} chevron />
          </a>
          <Row label="利用規約" onClick={v.onOpenTerms} chevron />
          <Row label="プライバシーポリシー" onClick={v.onOpenPrivacy} chevron />
          {/* 5回叩くと診断が出る。ふつうに使う人には何も起きない */}
          <Row label="バージョン" onClick={v.onTapVersion} last right={<span style={s('font-size:14px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>{v.appVersionLabel}</span>} />
        </div>

        {/* 応援。設定のいちばん下 */}
        {v.supportGroupShown && (<>
          <div style={s(HEAD)}>応援</div>
          <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:14px')}>
            {v.supporterShown && (
              <div style={s(v.supporterRowStyle)} onClick={v.onOpenCard}
                onPointerDown={v.onSupDown} onPointerUp={v.onSupUp}
                onPointerCancel={v.onSupUp} onPointerLeave={v.onSupUp}>
                <span style={s('width:22px;height:22px;border-radius:11px;background:#1D9E75;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0')}>✓</span>
                <span style={s('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>サポーターカード</span>
                  <span style={s('font-size:11px;color:var(--ink-mut)')}>{v.supporterTotal}・{v.supporterCount}・{v.supporterSince}</span>
                </span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
            )}
            {v.tipShown && (<>
              <div style={s(v.tipHeadStyle)} onClick={v.onToggleTip}
                onPointerDown={v.onTipHeadDown} onPointerUp={v.onTipUp}
                onPointerCancel={v.onTipUp} onPointerLeave={v.onTipUp}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>開発を応援する</span>
                <span style={s(`font-size:12px;color:var(--ink-faint);transition:transform .2s ease;transform:rotate(${v.tipOpen ? '90deg' : '0deg'})`)}>▶</span>
              </div>
              {v.tipOpen && (
                <div style={s('background:var(--bg2);animation:riseUp .22s cubic-bezier(.2,.9,.2,1)')}>
                  {(v.tipRows || []).map((t, i) => (
                    <div key={i} style={s(t.rowStyle)} onClick={t.onClick}
                      onPointerDown={t.onDown} onPointerUp={t.onUp}
                      onPointerCancel={t.onUp} onPointerLeave={t.onUp}>
                      <span style={s('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}>
                        <span style={s('font-size:15px;color:var(--ink)')}>{t.label}</span>
                      </span>
                      <span style={s('font-size:15px;font-weight:400;color:var(--ink-soft);font-variant-numeric:tabular-nums')}>{t.price}</span>
                    </div>
                  ))}
                  <div style={s('font-size:11px;color:var(--ink-faint);padding:12px 16px 14px;line-height:1.8;text-wrap:pretty')}>
                    {''}<Jp parts={['応援しても、', '増える機能は', 'ありません。', '広告なし・通信なしの', 'ままで', '作りつづけます。']} />
                  </div>
                </div>
              )}
            </>)}
          </div>
        </>)}
      </div>

      {/* ===== 使い方をえらぶ ===== */}
      {v.profileSheetShown && (
        <Sheet title="ふだんの予定に近いのは？" onClose={v.onProfileClose}>
          <div style={s('display:flex;flex-direction:column;gap:8px')}>
            {(v.profileOpts || []).map((p) => (
              <div key={p.key} style={s(`display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:15px;background:var(--card);cursor:pointer;border:1px solid ${p.sel ? 'var(--ink)' : 'var(--line)'}`)} onClick={p.onClick}>
                <span style={s('flex:1;display:flex;flex-direction:column;gap:2px')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>{p.label}</span>
                  <span style={s('font-size:12px;color:var(--ink-mut)')}>{p.note}</span>
                </span>
                {p.sel && <span style={s('font-size:13px;color:var(--ink-mut)')}>いま</span>}
              </div>
            ))}
          </div>
          {v.profileRetireShown && (
            <div style={s('display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:13px;background:var(--bg2);cursor:pointer')} onClick={v.onProfileRetire}>
              <span style={s(`width:20px;height:20px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;${v.profileRetireOn ? 'background:var(--ink);color:var(--card)' : 'border:1.5px solid var(--line)'}`)}>{v.profileRetireOn ? '✓' : ''}</span>
              <span style={s('font-size:13px;color:var(--ink-soft);line-height:1.6')}>バイト先をまとめて「辞めた」にする（働いた記録と給料はそのまま残ります）</span>
            </div>
          )}
          <div style={s('font-size:11.5px;color:var(--ink-faint);margin:12px 4px 0;line-height:1.8')}>種類の並びと呼び名、空き状況で見る時間帯が変わります。予定はそのまま残ります。</div>
        </Sheet>
      )}

      {/* ===== 端末の中の控え ===== */}
      {v.backupListShown && (
        <Sheet title="端末の中の控え" onClose={v.onCloseBackups}>
          {(v.backupRows || []).length ? (
            <div style={s('background:var(--card);border-radius:15px;overflow:hidden')}>
              {v.backupRows.map((b, i) => (<Row key={b.key} label={b.label} onClick={b.onClick} chevron last={i === v.backupRows.length - 1} />))}
            </div>
          ) : (
            <div style={s('text-align:center;color:var(--ink-faint);font-size:14px;padding:30px 0')}>まだ控えはありません</div>
          )}
          <div style={s('font-size:11.5px;color:var(--ink-faint);margin:12px 4px 0;line-height:1.8')}>毎日1回、自動で取っています。7日分と、毎月1日のぶんを3か月残します。</div>
        </Sheet>
      )}

      {/* ===== 最近消した予定 ===== */}
      {v.trashShown && (
        <Sheet title="最近消した予定" onClose={v.onCloseTrash}>
          {(v.trashRows || []).length ? (
            <div style={s('background:var(--card);border-radius:15px;overflow:hidden')}>
              {v.trashRows.map((r, i) => (
                <div key={r.key} style={s(`display:flex;align-items:center;gap:10px;padding:12px 14px;${i ? 'border-top:1px solid var(--line)' : ''}`)}>
                  <span style={s('width:40px;font-size:13px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>{r.when}</span>
                  <span style={s('flex:1;min-width:0;display:flex;flex-direction:column')}>
                    <span style={s('font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.title}</span>
                    <span style={s('font-size:11px;color:var(--ink-faint)')}>{r.gone}</span>
                  </span>
                  <span style={s('padding:6px 12px;border-radius:999px;background:var(--ink);color:var(--card);font-size:12px;cursor:pointer')} onClick={r.onRestore}>戻す</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={s('text-align:center;color:var(--ink-faint);font-size:14px;padding:30px 0')}>消した予定はありません</div>
          )}
        </Sheet>
      )}

      {/* ===== シフトの型を足す ===== */}
      {v.tplNewShown && (
        <Sheet title="シフトの型を足す" onClose={v.onTplCancel}>
          <div style={s('background:var(--card);border-radius:15px;overflow:hidden')}>
            <Row label="記号（1〜2文字）" sub="マスに出す字。例：日・夜・早・遅・休" right={<input value={v.tplSym} onChange={v.onTplSym} maxLength={2} style={s('width:4ch;border:none;outline:none;background:var(--bg2);border-radius:9px;padding:7px 10px;font-size:15px;color:var(--ink);text-align:center;font-family:inherit')} />} />
            <Row label="名前" right={<input value={v.tplName} onChange={v.onTplName} placeholder="日勤" style={s('width:9ch;border:none;outline:none;background:var(--bg2);border-radius:9px;padding:7px 10px;font-size:14px;color:var(--ink);font-family:inherit')} />} />
            <Row label="休み（終日）" right={<Toggle t={v.tplAllDay} onClick={v.onTplAllDay} />} />
            {v.tplAllDay.track.background !== 'var(--ink)' && (<>
              <Row label="時間" sub="終わりが始まりより前なら、翌日に終わります（夜勤）" right={<span style={s('display:flex;align-items:center;gap:5px')}><TimeSel value={v.tplFrom} onChange={v.onTplFrom} opts={v.timeOpts} />〜<TimeSel value={v.tplTo} onChange={v.onTplTo} opts={v.timeOpts} /></span>} />
              <Row label="いつもの休憩" right={<TimeSel value={v.tplBrk} onChange={v.onTplBrk} opts={v.brkOpts} />} last />
            </>)}
          </div>
          <div style={s(`margin-top:14px;padding:14px;border-radius:15px;text-align:center;font-size:15px;font-weight:700;cursor:pointer;${v.tplSym ? 'background:var(--ink);color:var(--card)' : 'background:var(--bg2);color:var(--ink-faint)'}`)} onClick={v.onTplSave}>この型を足す</div>
        </Sheet>
      )}

      {/* ===== 勤務先を消す確認 ===== */}
      {v.confirmJobShown && (
        <div style={s('position:absolute;inset:0;z-index:93;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onCancelJob}>
          <div style={s('width:100%;max-width:300px;background:var(--card);border-radius:16px;padding:22px 20px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={(e) => e.stopPropagation()}>
            <div style={s('font-size:17px;color:var(--ink);text-align:center;text-wrap:balance')}>{v.confirmJobText}</div>
            <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:8px 0 18px;text-wrap:pretty')}>{v.confirmJobBody}</div>
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:16px;font-weight:700;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onConfirmJob}>消す</div>
              <div style={s('padding:12px;text-align:center;font-size:15px;color:var(--ink-mut);cursor:pointer')} onClick={v.onCancelJob}>やめる</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { s } from './style';
import { Jp } from './jp.jsx';
import sproutImg from './assets/sprout-line.png';

// 設定の画面。view.jsx から切り出した（群が増えて、1つのファイルに収まりにくくなったため）。
// 値はすべて App.jsx の renderVals / _settingsVals が返す v から来る。
//
// 形は TimeTree の設定に寄せた。前は 1 枚に 40 行を超えて並び、どの行にも説明が付いていて見にくかった。
//  ・最初の画面は、小さなカードの群。1 行は「名前 ＋ いまの値 ＋ › か ⌃⌄ かスイッチ」だけ
//  ・えらぶもの（週のはじまり・表示モード・通知のタイミングなど）は、押すと小さなメニューが出る
//  ・時刻は、押すと iPhone のホイールが出る（見えない <select> を重ねてある）
//  ・中身の多いもの（種類・勤務先・有給・勤務時間・重ねて表示・控え・ファイル）は、押すと開く画面へ
//  ・説明は、それが無いと分からない所にだけ、カードの下に小さく1つ

const HEAD = 'font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 7px';
const CARD = 'background:var(--card);border-radius:12px;overflow:hidden;margin-bottom:22px';
const NOTE = 'font-size:11.5px;color:var(--ink-faint);margin:-15px 6px 22px;line-height:1.6;text-wrap:pretty';
const LABEL = 'font-size:14px;font-weight:500;color:var(--ink)';
const VALUE = 'font-size:13.5px;color:var(--ink-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0';
const CHEV = 'font-size:16px;color:var(--ink-faint);flex-shrink:0;line-height:1';
const ROWPAD = 'padding:0 16px;min-height:42px';

/** 説明が2つ以上あるときの箇条書き（アプリの文章のきまり：短く・複数なら箇条書き） */
function bullets(items) {
  return items.map((t, i) => (<span key={i} style={s('display:flex;gap:6px')}><span style={s('flex-shrink:0')}>・</span><span>{t}</span></span>));
}
/** 1行。左に名前、右に値やスイッチ。sub は本当に要る所だけ */
function Row({ label, sub, right, onClick, last, chevron, value, danger, keep }) {
  // 値のある行は、名前に半分の幅を残して、長い値のほうを「…」で切る（文字を大きくしたとき、名前が2行に折れていた）
  const hold = keep || (value != null && value !== '');
  return (
    <div style={s(`position:relative;display:flex;align-items:center;gap:12px;${ROWPAD};${onClick ? 'cursor:pointer;' : ''}`)} onClick={onClick}>
      <span style={s(`display:flex;flex-direction:column;gap:1px;min-width:${hold ? `min(50%, ${String(label).length + 0.5}em)` : '0'};flex:1;padding:10px 0`)}>
        <span style={s(danger ? LABEL + ';color:#A8452B' : LABEL)}>{label}</span>
        {!!sub && <span style={s('font-size:11px;color:var(--ink-mut);text-wrap:pretty;line-height:1.5')}>{sub}</span>}
      </span>
      {value != null && value !== '' && <span style={s(VALUE + ';flex-shrink:1')}>{value}</span>}
      {right}
      {chevron && <span style={s(CHEV)}>›</span>}
      {!last && <span style={s('position:absolute;left:16px;right:0;bottom:0;height:1px;background:var(--line)')} />}
    </div>
  );
}
function Toggle({ t, onClick }) {
  return <span style={s('flex-shrink:0;display:flex')}><div style={s(t.track)} onClick={(e) => { e.stopPropagation(); onClick(); }}><div style={s(t.knob)} /></div></span>;
}
/** 押すとメニューが出る行。items は { label, sel, onClick } */
function PickRow({ label, items, open, last }) {
  const cur = (items || []).find((x) => x.sel);
  return (
    <Row label={label} last={last} value={cur ? cur.label : ''}
      right={<svg width="11" height="16" viewBox="0 0 11 16" fill="none" style={{ flexShrink: 0, marginLeft: -2 }}>
        <path d="M2 6 5.5 2.5 9 6M2 10l3.5 3.5L9 10" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>}
      onClick={(e) => open(e, items)} />
  );
}
/** 時刻。見た目は字だけ。上に見えない <select> を重ねて、押すと iPhone のホイールが出る */
function TimePick({ value, onChange, opts }) {
  const cur = (opts || []).find((o) => String(o.value) === String(value));
  return (
    <span style={s('position:relative;display:inline-flex;align-items:center;padding:5px 9px;border-radius:8px;background:var(--bg2);font-size:13.5px;color:var(--ink);font-variant-numeric:tabular-nums;flex-shrink:0')} onClick={(e) => e.stopPropagation()}>
      {cur ? String(cur.label).replace(/^0(\d):/, '$1:') : ''}
      <select value={value} onChange={onChange} style={s('position:absolute;inset:0;opacity:0;width:100%;height:100%;font-size:16px')}>
        {(opts || []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </span>
  );
}
function Range({ a, b, onA, onB, opts }) {
  return <span style={s('display:flex;align-items:center;gap:6px;flex-shrink:0;color:var(--ink-mut);font-size:14px')}><TimePick value={a} onChange={onA} opts={opts} />〜<TimePick value={b} onChange={onB} opts={opts} /></span>;
}
/** 外へ出るリンクの行（よくある質問・レビュー・お問い合わせ） */
function LinkRow({ href, label, value, last, blank }) {
  return (
    <a href={href} target={blank ? '_blank' : undefined} rel="noreferrer" style={s('display:block;text-decoration:none;-webkit-tap-highlight-color:transparent')}>
      <Row label={label} value={value} chevron last={last} />
    </a>
  );
}
function Seg({ items, width }) {
  return (
    <div style={s(`display:flex;background:var(--bg2);border-radius:10px;padding:2px;${width ? `width:${width}px;` : 'flex:1;'}`)}>
      {(items || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
    </div>
  );
}
function TimeSel({ value, onChange, opts }) {
  return <TimePick value={value} onChange={onChange} opts={opts} />;
}
function Sheet({ title, onClose, children }) {
  return (
    <div style={s('position:absolute;inset:0;z-index:92;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:flex-end;justify-content:center;animation:scrimIn .2s ease')} onClick={onClose}>
      <div style={s('width:100%;max-height:82%;overflow-y:auto;background:var(--bg);border-radius:20px 20px 0 0;padding:18px 16px 34px;animation:riseUp .26s cubic-bezier(.2,.9,.2,1)')} onClick={(e) => e.stopPropagation()}>
        <div style={s('display:flex;align-items:center;justify-content:space-between;margin:0 4px 14px')}>
          <span style={s('font-size:14px;font-weight:600;color:var(--ink)')}>{title}</span>
          <span role="button" style={s('font-size:14px;color:var(--ink-mut);cursor:pointer;padding:4px')} onClick={onClose}>閉じる</span>
        </div>
        {children}
      </div>
    </div>
  );
}
function AddRow({ label, onClick, top }) {
  return (
    <div style={s(`display:flex;align-items:center;gap:12px;${ROWPAD};cursor:pointer;${top ? 'border-top:1px solid var(--line);' : ''}`)} onClick={onClick}>
      <span style={s('width:26px;height:26px;border-radius:13px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:15px')}>＋</span>
      <span style={s(LABEL)}>{label}</span>
    </div>
  );
}

// ================= 最初の画面 =================
function Main({ v, open }) {
  return (<>
    {/* 使い方と種類 */}
    <div style={s(CARD)}>
      <Row label="使い方" value={v.profileLabel} chevron onClick={v.onOpenProfile} />
      <Row label="予定の種類" chevron onClick={v.onSetPage('types')} last keep
        right={<span style={s('display:flex;align-items:center;gap:8px;min-width:0')}>
          {/* 丸は入るぶんだけ（狭いと右から切れる）。数はいつも見せる */}
          <span style={s('display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;justify-content:flex-end')}>
            {(v.typeDots || []).slice(0, 6).map((d, i) => (<span key={i} style={s({ ...(typeof d.style === 'object' ? d.style : {}), flexShrink: 0 })} />))}
          </span>
          <span style={s('font-size:14px;color:var(--ink-mut);white-space:nowrap;flex-shrink:0')}>{v.typeCountLabel}</span>
        </span>} />
    </div>

    <div style={s(HEAD)}>カレンダー</div>
    <div style={s(CARD)}>
      <PickRow label="週のはじまり" items={v.weekSeg} open={open} />
      <Row label="帯に時刻を出す" right={<Toggle t={v.barTime} onClick={v.onBarTime} />} />
      <Row label="点線に「仮」を付ける" right={<Toggle t={v.kariMark} onClick={v.onKariMark} />} />
      <Row label="無くなった予定を隠す" right={<Toggle t={{ track: v.hideTrack, knob: v.hideKnob }} onClick={v.onToggleHide} />} last />
    </div>

    <div style={s(HEAD)}>表示</div>
    <div style={s(CARD)}>
      <PickRow label="表示モード" items={v.themeSeg} open={open} />
      <PickRow label="予定の文字の大きさ" items={v.fontSeg} open={open} last />
    </div>

    <div style={s(HEAD)}>空き状況で見る時間</div>
    <div style={s(CARD)}>
      <Row label="平日" right={<Range a={v.freeWd[0]} b={v.freeWd[1]} onA={v.onFreeWd(0)} onB={v.onFreeWd(1)} opts={v.timeOpts} />} />
      <Row label="休日" right={<Range a={v.freeHd[0]} b={v.freeHd[1]} onA={v.onFreeHd(0)} onB={v.onFreeHd(1)} opts={v.timeOpts} />} />
      <Row label="勤務時間" value={v.workLabel} chevron onClick={v.onSetPage('work')} last={!v.overlayCals.length} />
      {v.overlayCals.length > 0 && (
        <Row label="重ねた予定もふさがり扱い" right={<Toggle t={v.overlayFree} onClick={v.onOverlayFree} />} last />
      )}
    </div>

    <div style={s(HEAD)}>通知</div>
    <div style={s(CARD)}>
      <Row label="通知" right={<Toggle t={v.notifyAll} onClick={v.onNotifyAll} />} last={!v.notifyOn} />
      {v.notifyOn && (<>
        <PickRow label="予定の通知" items={v.remindTimedSeg} open={open} />
        <PickRow label="終日の予定の通知" items={v.remindAllDaySeg} open={open} last />
      </>)}
    </div>
    {v.notifyOn && (<>
      <div style={s(CARD)}>
        <Row label="朝のまとめ" right={<Toggle t={v.morning} onClick={v.onMorning} />} last={v.morning.track.background !== 'var(--ink)'} />
        {v.morning.track.background === 'var(--ink)' && (
          <Row label="時刻" right={<TimePick value={v.morningAt} onChange={v.onMorningAt} opts={v.timeOpts} />} last />
        )}
      </div>
      <div style={s(CARD)}>
        <Row label="前の晩に明日の予定" right={<Toggle t={v.evening} onClick={v.onEvening} />} />
        <Row label="日曜の夜にまだの予定" right={<Toggle t={v.weeklyReview} onClick={v.onWeekly} />} last={!v.remindRowShown} />
        {v.remindRowShown && (
          <Row label="働いたあとに記録を聞く" right={<Toggle t={{ track: v.remindTrack, knob: v.remindKnob }} onClick={v.onToggleRemind} />} last />
        )}
      </div>
    </>)}

    <div style={s(HEAD)}>{v.wageHead}</div>
    <div style={s(CARD)}>
      <Row label={v.jobWord} value={v.jobsLabel} chevron onClick={v.onSetPage('jobs')} />
      <PickRow label="給料の表示" items={v.wageFeatureSeg} open={open} />
      <Row label="有給" value={v.leaveLabel} chevron onClick={v.onSetPage('leave')} last />
    </div>

    {v.importAvailable && (<>
      <div style={s(HEAD)}>iPhone のカレンダー</div>
      <div style={s(CARD)}>
        <Row label="予定を取り込む" chevron onClick={v.onOpenImport} />
        <Row label="重ねて表示" value={v.overlayLabel} chevron onClick={v.onSetPage('overlay')} />
        <Row label="決まった予定を書き出す" right={<Toggle t={v.exportCal} onClick={v.onExportCal} />} last />
      </div>
    </>)}

    <div style={s(HEAD)}>予定の保存</div>
    <div style={s(CARD)}>
      {v.syncShown && <Row label="iCloud で同期" sub={v.syncSub} right={<Toggle t={v.sync} onClick={v.onSync} />} />}
      <Row label="最近消した予定" value={`${v.trashCount}件`} chevron onClick={v.onOpenTrash} />
      <Row label="控えと機種変更" value={v.backupLabel} chevron onClick={v.onSetPage('backup')} />
      <Row label="ファイルで出し入れ" chevron onClick={v.onSetPage('files')} last />
    </div>
    <div style={s(NOTE)}>{v.syncShown ? '予定は、この iPhone とあなたの iCloud にだけ保存します' : '予定は、この iPhone の中にだけ保存します'}</div>

    <div style={s(HEAD)}>安全</div>
    <div style={s(CARD)}>
      {v.lockAvailable && <Row label={`${v.lockLabel} でロック`} right={<Toggle t={v.lock} onClick={v.onLock} />} />}
      <Row label="予定の名前を隠す" sub="通知・ウィジェット" right={<Toggle t={v.hideTitles} onClick={v.onHideTitles} />} last />
    </div>

    <div style={s(HEAD)}>サポート</div>
    <div style={s(CARD)}>
      <LinkRow href={v.supportHref} label="よくある質問" blank />
      <Row label="使い方をもう一度見る" chevron onClick={v.onReplayGuide} />
      <LinkRow href={v.contactHref} label="お問い合わせ" value={v.contactEmail} />
      <LinkRow href={v.reviewHref} label="App Store でレビューする" blank />
      <Row label="利用規約" chevron onClick={v.onOpenTerms} />
      <Row label="プライバシーポリシー" chevron onClick={v.onOpenPrivacy} />
      {/* 5回叩くと診断が出る。ふつうに使う人には何も起きない */}
      <Row label="バージョン" value={v.appVersionLabel} onClick={v.onTapVersion} last />
    </div>

    {/* 応援。設定のいちばん下 */}
    {v.supportGroupShown && (<>
      <div style={s(HEAD)}>応援</div>
      <div style={s(CARD)}>
        {v.supporterShown && (
          <div style={s(v.supporterRowStyle)} onClick={v.onOpenCard}
            onPointerDown={v.onSupDown} onPointerUp={v.onSupUp}
            onPointerCancel={v.onSupUp} onPointerLeave={v.onSupUp}>
            <span style={s('width:22px;height:22px;border-radius:11px;background:#1D9E75;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0')}>✓</span>
            <span style={s('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}>
              <span style={s(LABEL)}>サポーターカード</span>
              <span style={s('font-size:12px;color:var(--ink-mut)')}>{v.supporterTotal}・{v.supporterCount}・{v.supporterSince}</span>
            </span>
            <span style={s(CHEV)}>›</span>
          </div>
        )}
        {/* 押すと応援の画面が開く（感謝と、これから作りたいもの、金額） */}
        {v.tipShown && <Row label="開発を応援する" chevron onClick={v.onSetPage('support')} last />}
      </div>
    </>)}
  </>);
}

// ================= 押すと開く画面 =================
function TypesPage({ v }) {
  return (
    <div style={s(CARD)}>
      {(v.typeRows || []).map((t, i) => (
        <div key={i} style={s(t.rowStyle)}>
          <div style={s(`display:flex;align-items:center;gap:12px;${ROWPAD};cursor:pointer`)} onClick={t.onTap}>
            <span style={s(t.dotStyle)} />
            <span style={s(LABEL + ';flex:1')}>{t.name}</span>
            <span style={s('font-size:13px;color:var(--ink-faint)')}>{t.hint}</span>
            <span style={s(CHEV)}>{t.open ? '⌄' : '›'}</span>
          </div>
          {t.open && (
            <div style={s('padding:2px 16px 16px')}>
              <input value={t.name} onChange={t.onName} placeholder="種類の名前" style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:14px;color:var(--ink);font-family:inherit;margin-bottom:14px')} />
              <div style={s('display:flex;flex-wrap:wrap;gap:12px')}>
                {(t.swatches || []).map((sw, j) => (<div key={j} style={s(sw.style)} onClick={sw.onClick} />))}
              </div>
              {/* 呼び名。仕事なら「仮押さえ／確定」のように、種類ごとに変えられる */}
              <div style={s('display:flex;gap:8px;margin-top:14px')}>
                <label style={s('flex:1;display:flex;flex-direction:column;gap:4px;min-width:0')}>
                  <span style={s('font-size:12px;color:var(--ink-mut)')}>まだのとき（点線）</span>
                  <input value={t.uWord} onChange={t.onUWord} placeholder="例：仮押さえ" style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:10px;padding:9px 11px;font-size:14px;color:var(--ink);font-family:inherit')} />
                </label>
                <label style={s('flex:1;display:flex;flex-direction:column;gap:4px;min-width:0')}>
                  <span style={s('font-size:12px;color:var(--ink-mut)')}>決まったとき（塗り）</span>
                  <input value={t.cWord} onChange={t.onCWord} placeholder="例：確定" style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:10px;padding:9px 11px;font-size:14px;color:var(--ink);font-family:inherit')} />
                </label>
              </div>
              <div style={s('display:flex;align-items:center;gap:8px;margin-top:14px;flex-wrap:wrap')}>
                <span style={s('font-size:12px;color:var(--ink-faint);flex:1;min-width:120px')}>{t.usedCount > 0 ? `${t.usedCount}件の予定で使っています` : 'まだ使っていません'}</span>
                {t.onUp && <span role="button" aria-label="上へ" style={s('padding:6px 10px;border-radius:9px;border:1px solid var(--line);font-size:14px;color:var(--ink-soft);cursor:pointer')} onClick={t.onUp}>↑</span>}
                {t.onDown && <span role="button" aria-label="下へ" style={s('padding:6px 10px;border-radius:9px;border:1px solid var(--line);font-size:14px;color:var(--ink-soft);cursor:pointer')} onClick={t.onDown}>↓</span>}
                <span role="button" style={s('padding:6px 11px;border-radius:9px;border:1px solid var(--line);font-size:14px;color:var(--ink-soft);cursor:pointer')} onClick={t.onHide}>{t.hideLabel}</span>
                {t.onAskDelete && <span role="button" style={s('padding:6px 11px;border-radius:9px;font-size:14px;color:#A8452B;cursor:pointer')} onClick={t.onAskDelete}>消す</span>}
              </div>
              {t.deleting && (
                <div style={s('margin-top:12px;padding:12px;border-radius:12px;background:var(--bg2)')}>
                  <div style={s('font-size:13px;color:var(--ink-soft);margin-bottom:10px;line-height:1.7')}>予定をどの種類へ移しますか？</div>
                  <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>{t.moveChips.map((c, k) => (<span key={k} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}</div>
                  <div style={s('font-size:13px;color:var(--ink-mut);margin-top:10px;cursor:pointer')} onClick={t.onCancelDelete}>やめる</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <AddRow label="種類を追加" onClick={v.onAddTypeRow} />
      {v.newTypeShown && (
        <div style={s('padding:2px 16px 16px;background:var(--bg2)')}>
          <input value={v.newTypeName} placeholder={v.newTypeEg || '種類の名前'} onChange={v.onNewTypeName} style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;font-size:14px;color:var(--ink);font-family:inherit;margin:12px 0 14px')} />
          <div style={s('display:flex;flex-wrap:wrap;gap:12px')}>
            {(v.newTypeSwatches || []).map((sw, i) => (<div key={i} style={s(sw.style)} onClick={sw.onClick} />))}
          </div>
          <div style={s('display:flex;gap:8px;margin-top:16px')}>
            <div style={s('flex:1;text-align:center;padding:11px;border-radius:13px;background:var(--card);color:var(--ink-soft);font-size:14px;font-weight:600;cursor:pointer')} onClick={v.onCancelNewType}>やめる</div>
            <div style={s(v.addTypeBtnStyle)} onClick={v.onAddType}>この種類を追加</div>
          </div>
        </div>
      )}
    </div>
  );
}
function WorkPage({ v }) {
  return (<>
    <div style={s(CARD)}>
      <Row label="勤務時間を入れる" right={<Toggle t={v.workOn} onClick={v.onWorkToggle} />} last={!v.workHoursOn} />
      {v.workHoursOn && (<>
        <div style={s('padding:6px 16px 14px;display:flex;gap:4px')}>{(v.workDays || []).map((d, i) => (<span key={i} style={s({ ...d.style, fontSize: 14, padding: '8px 0' })} onClick={d.onClick}>{d.label}</span>))}</div>
        <Row label="時間" right={<Range a={v.workFrom} b={v.workTo} onA={v.onWorkFrom} onB={v.onWorkTo} opts={v.timeOpts} />} last />
      </>)}
    </div>
    <div style={s(NOTE)}>空き状況で、この時間を「ふさがり」にします</div>
  </>);
}
function JobsPage({ v }) {
  return (<>
    <div style={s(CARD)}>
      {(v.jobRows || []).map((j, i) => (
        <div key={i} style={s(j.rowStyle)}>
          <div style={s(`display:flex;align-items:center;gap:12px;${ROWPAD};cursor:pointer`)} onClick={j.onTap}>
            <span style={s(LABEL + `;flex:1;${j.retired ? 'color:var(--ink-faint)' : ''}`)}>{j.name}</span>
            <span style={s(VALUE + ';font-variant-numeric:tabular-nums')}>¥{j.hourly}</span>
            <span style={s(CHEV)}>{j.open ? '⌄' : '›'}</span>
          </div>
          {j.open && (
            <div style={s('padding:2px 16px 16px')}>
              <input value={j.name.replace('（辞めた）', '') === '（名前なし）' ? '' : j.name.replace('（辞めた）', '')} onChange={j.onName} placeholder={v.jobEg} style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:14px;color:var(--ink);font-family:inherit;margin-bottom:12px')} />
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px')}>
                <span style={s('font-size:14px;color:var(--ink)')}>時給</span>
                <div style={s('display:flex;align-items:center;gap:10px;flex-shrink:0')}>
                  <div style={s(v.stepBtn)} onClick={j.onMinus}>−</div>
                  <div style={s('display:flex;align-items:center;gap:3px;background:var(--bg2);border-radius:12px;padding:6px 12px')}>
                    <span style={s('font-size:14px;color:var(--ink-soft)')}>¥</span>
                    <input value={j.hourly} onChange={j.onHourly} inputMode="numeric" maxLength={5} style={s('width:6ch;min-width:6ch;border:none;outline:none;background:transparent;font-size:15px;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;font-family:inherit;padding:0')} />
                  </div>
                  <div style={s(v.stepBtn)} onClick={j.onPlus}>＋</div>
                </div>
              </div>
              {j.rateNote && <div style={s('font-size:12px;color:var(--ink-mut);margin-top:8px;text-decoration:underline;cursor:pointer')} onClick={j.onRecount}>これまでの記録も新しい時給で数え直す</div>}
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px')}>
                <span style={s('font-size:14px;color:var(--ink)')}>締め日</span>
                <TimeSel value={j.closeDay} onChange={j.onCloseDay} opts={v.closeOpts} />
              </div>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px')}>
                <span style={s('font-size:14px;color:var(--ink)')}>給料日</span>
                <TimeSel value={j.payDay} onChange={j.onPayDay} opts={v.payOpts} />
              </div>
              {/* シフトの型。マスを押すだけで置く「シフト入力」で使う */}
              <div style={s('margin-top:14px;padding-top:12px;border-top:1px solid var(--line)')}>
                <div style={s('font-size:13px;color:var(--ink-mut);margin-bottom:8px')}>シフトの型</div>
                {j.templates.map((t) => (
                  <div key={t.key} style={s('display:flex;align-items:center;gap:8px;padding:6px 0')}>
                    <span style={s('flex:1;font-size:14px;color:var(--ink);font-variant-numeric:tabular-nums')}>{t.text}</span>
                    <span style={s('font-size:13px;color:#A8452B;cursor:pointer')} onClick={t.onRemove}>外す</span>
                  </div>
                ))}
                <span style={s('display:inline-block;margin-top:4px;padding:7px 13px;border-radius:999px;border:1px dashed var(--line);font-size:13px;color:var(--ink-mut);cursor:pointer')} onClick={j.onAddTemplate}>＋ 型を足す</span>
              </div>
              <div style={s('display:flex;align-items:center;justify-content:space-between;margin-top:14px')}>
                <span style={s('font-size:12px;color:var(--ink-faint)')}>{j.usedCount > 0 ? `${j.usedCount}件の予定で使っています` : 'まだ使っていません'}</span>
                <span style={s('display:flex;gap:14px')}>
                  <span style={s('font-size:14px;color:var(--ink-soft);cursor:pointer')} onClick={j.onRetire}>{j.retireLabel}</span>
                  <span style={s('font-size:14px;color:#A8452B;cursor:pointer')} onClick={j.onRemove}>削除</span>
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
      <AddRow label={v.jobAddLabel} onClick={v.onAddJob} top={(v.jobRows || []).length > 0} />
    </div>
    {v.retiredCount > 0 && (
      <div style={s('font-size:13px;color:var(--ink-mut);margin:-16px 6px 20px;cursor:pointer')} onClick={v.onShowRetired}>{v.showRetired ? '辞めたところを隠す' : `辞めたところ（${v.retiredCount}）も出す`}</div>
    )}
    <div style={s(NOTE)}>時給を変えても、記録済みの金額は変わりません</div>
  </>);
}
function LeavePage({ v }) {
  return (<>
    <div style={s(CARD)}>
      <Row label="有給の残りを数える" right={<Toggle t={v.leaveOn} onClick={v.onLeaveToggle} />} last={!v.leaveShown} />
      {v.leaveShown && (<>
        <Row label="1年にもらう日数" right={<input value={v.leaveGrant} onChange={v.onLeaveGrant} inputMode="decimal" style={s('width:6ch;border:none;outline:none;background:var(--bg2);border-radius:9px;padding:7px 10px;font-size:14px;color:var(--ink);text-align:right;font-family:inherit')} />} />
        <Row label="付く月" right={<TimeSel value={v.leaveStart} onChange={v.onLeaveStart} opts={v.leaveStartOpts} />} last />
      </>)}
    </div>
    {v.leaveShown && !!v.leaveText && <div style={s('font-size:14px;color:var(--ink);margin:-14px 6px 22px;line-height:1.7')}>{v.leaveText}</div>}
    <div style={s(NOTE)}>名前に「有給」「半休」がある休みを数えます</div>
  </>);
}
function OverlayPage({ v }) {
  return (<>
    <div style={s(CARD)}>
      <Row label="重ねて表示" right={<Toggle t={v.overlayOn} onClick={v.onOverlay} />} last={!v.overlayCals.length} />
      {v.overlayCals.map((c, i) => (
        <div key={c.key} style={s(`display:flex;align-items:center;gap:12px;${ROWPAD};cursor:pointer;${i < v.overlayCals.length - 1 ? 'border-bottom:1px solid var(--line)' : ''}`)} onClick={c.onClick}>
          <span style={s({ width: 10, height: 10, borderRadius: 5, background: c.dot, flexShrink: 0 })} />
          <span style={s(LABEL + ';flex:1;font-weight:400')}>{c.label}</span>
          <span style={s(`width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;${c.on ? 'background:var(--ink);color:var(--card)' : 'border:1.5px solid var(--line)'}`)}>{c.on ? '✓' : ''}</span>
        </div>
      ))}
    </div>
    <div style={s(NOTE)}>選んだカレンダーを灰色で表示します（保存はしません）</div>
  </>);
}
function BackupPage({ v }) {
  return (<>
    <div style={s(CARD)}>
      <Row label="端末の中の控え" value={v.backupLabel} chevron onClick={v.onOpenBackups} />
      <Row label="控えをファイルに保存" value={v.lastExportLabel} chevron onClick={v.onExportBackup} />
      <Row label="ファイルから戻す" chevron onClick={v.onPickBackup} last />
    </div>
    <div style={s(NOTE)}>毎日1回、自動でとります（7日分）</div>
    <input id="backup-file" type="file" accept=".json,application/json" onChange={v.onBackupFile} style={s('display:none')} />
    {!!v.backupError && (
      <div style={s('font-size:12px;color:#A8452B;margin:-14px 8px 18px;line-height:1.6;text-wrap:pretty')}>{v.backupError}</div>
    )}
    <div style={s(HEAD)}>機種変更のとき</div>
    <div style={s(CARD + ';padding:14px 16px;font-size:14px;color:var(--ink-soft);line-height:1.8')}>
      <div style={s('display:flex;gap:10px')}><span style={s('font-weight:700;color:var(--ink)')}>1</span><span>「クイックスタート」か「iCloud バックアップから復元」で、予定も移ります</span></div>
      <div style={s('display:flex;gap:10px;margin-top:8px')}><span style={s('font-weight:700;color:var(--ink)')}>2</span><span>移らなかったら：前の iPhone で「控えをファイルに保存」→ 新しい iPhone で「ファイルから戻す」</span></div>
    </div>
    <div style={s('font-size:13px;color:var(--ink-mut);margin:-14px 6px 20px;cursor:pointer;text-decoration:underline')} onClick={v.onTogglePaste}>ファイルをえらべないときは、貼り付けで戻す</div>
    {v.pasteOpen && (
      <div style={s(CARD + ';padding:14px')}>
        <textarea value={v.backupText} onChange={v.onBackupText} placeholder="控えの中身を貼り付け" rows={4}
          style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:13px;color:var(--ink);font-family:inherit;resize:none;line-height:1.6')} />
        <div style={s(`margin-top:12px;padding:12px;border-radius:13px;text-align:center;font-size:14px;font-weight:700;cursor:pointer;background:var(--bg2);color:var(--ink);border:1px solid var(--line);${v.restoreDisabled ? 'opacity:.4' : ''}`)} onClick={v.restoreDisabled ? undefined : v.onAskRestore}>
          この控えから戻す
        </div>
      </div>
    )}
  </>);
}
function FilesPage({ v }) {
  return (<>
    <div style={s(CARD)}>
      <Row label="ファイルから取り込む" value=".ics" chevron onClick={v.onPickIcs} />
      <Row label="ファイルに書き出す" value=".ics" chevron onClick={v.onExportIcs} last={!v.tidyCount && !v.undoImportShown} />
      {v.tidyCount > 0 && <Row label="取り込んだ予定を整理する" value={`${v.tidyCount}件`} chevron onClick={v.onOpenTidy} last={!v.undoImportShown} />}
      {v.undoImportShown && <Row label={v.undoImportLabel} chevron onClick={v.onUndoImport} last />}
    </div>
    <div style={s(NOTE)}>TimeTree・Google カレンダーのファイルを取り込めます</div>
    <input id="ics-file" type="file" accept=".ics,text/calendar" onChange={v.onIcsFile} style={s('display:none')} />
  </>);
}

// 最初の画面をどこまで下げていたか。中の画面（勤務先など）や規約を開いて戻ったとき、同じ所から続けられるように。
// 前は戻るたびにいちばん上に戻っていて、勤務先を直してから下の項目へ行くのに、また下までなぞる必要があった。
// Settings 自体が作り直される（取り込みや規約の画面へ行って戻る）ときも残るように、部品の外に置く
const SAVED = { main: 0 };
/** 下のタブから設定を開き直したときは、いちばん上から */
export function resetSettingsScroll() { SAVED.main = 0; }

// 応援の画面。お礼 → 芽の絵 → 金額3つ → 手書きの「いつもありがとう」。
// 色はカレンダーの予定の色（セージの緑 #7FAE85）と、アプリの地・カードの色だけで作る（暗い画面でもそのまま読める）
const SAGE = '#7FAE85';
// 手書きの字（Yomogi を切り出したもの。styles.css の @font-face）。無い字は丸ゴシックで出る
const ROUND = "'LukkoYomogi','Hiragino Maru Gothic ProN','Hiragino Maru Gothic Pro','Hiragino Sans',sans-serif";
const TIP_LOOK = {
  'com.kimatteru.app.tip300': { title: 'コーヒー1杯', sub: 'ちょっとした応援を、気軽に。', icon: 'cup' },
  'com.kimatteru.app.tip600': { title: 'ランチ1回', sub: '次のアイデアのために。', icon: 'rice' },
  'com.kimatteru.app.tip1000': { title: 'しっかり応援', sub: 'もっと良いものをつくるために。', icon: 'heart' },
};
function TipIcon({ kind }) {
  const st = { stroke: 'var(--ink-soft)', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'cup') return (<svg width="20" height="20" viewBox="0 0 24 24"><path d="M5 10h11v4.5A4.5 4.5 0 0 1 11.5 19h-2A4.5 4.5 0 0 1 5 14.5z" {...st} /><path d="M16 11.5h1.3a2.2 2.2 0 0 1 0 4.4H15.6" {...st} /><path d="M9 4.5c-.8 1 .8 1.7 0 2.8M12 4.5c-.8 1 .8 1.7 0 2.8" {...st} /></svg>);
  if (kind === 'rice') return (<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 4.5c2 0 3.4 1.6 4.6 3.8l2.4 4.6c1.3 2.6-.5 6.1-3.4 6.1H8.4c-2.9 0-4.7-3.5-3.4-6.1l2.4-4.6C8.6 6.1 10 4.5 12 4.5z" {...st} /><path d="M9 14h6v5H9z" {...st} fill="var(--ink-soft)" /></svg>);
  return (<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 19.5s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.3c0 4.9-7 9.2-7 9.2z" {...st} /></svg>);
}
function Sprout() {
  // イラスト：GreenStock40「芽生えのイラスト（線画）」 https://greenstock40.com/sprout01/
  // （商用・スマートフォンアプリで利用可、クレジット不要、加工可。https://greenstock40.com/kiyaku/）。手描きの線のまま使う
  return <img src={sproutImg} alt="" style={{ display: 'block', width: 150, height: 'auto', margin: '0 auto' }} />;
}
function SupportPage({ v }) {
  return (<>
    <div style={s('text-align:center;padding:18px 8px 6px')}>
      <div style={s(`font-family:${ROUND};font-size:22px;font-weight:400;color:var(--ink);line-height:1.6`)}>いつも使ってくださって、<br />ありがとうございます。</div>
      <div style={s(`font-family:${ROUND};font-size:13px;color:var(--ink-mut);line-height:1.9;margin-top:12px`)}>あなたの応援が、<br />これからの開発の力になります。</div>
    </div>
    <div style={s('margin:22px 0 26px')}><Sprout /></div>

    <div style={s(HEAD + `;font-family:${ROUND};color:#5E8A66;font-size:13px;text-align:center;margin:0 0 10px`)}>応援する</div>
    <div style={s('display:flex;flex-direction:column;gap:8px;margin-bottom:28px')}>
      {(v.tipRows || []).map((t, i) => {
        const look = TIP_LOOK[t.id] || { title: t.label, sub: '', icon: 'heart' };
        return (
          <div key={i} style={s({ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px 8px 10px', borderRadius: 16, background: 'var(--card)', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.04)', ...(t.pressed ? { background: 'var(--press)' } : {}) })}
            onClick={t.onClick} onPointerDown={t.onDown} onPointerUp={t.onUp} onPointerCancel={t.onUp} onPointerLeave={t.onUp}>
            <span style={s('width:36px;height:36px;border-radius:18px;background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0')}><TipIcon kind={look.icon} /></span>
            <span style={s('flex:1;min-width:0;display:flex;flex-direction:column;gap:0')}>
              <span style={s(`font-family:${ROUND};font-size:15px;font-weight:400;color:var(--ink)`)}>{look.title}</span>
              {!!look.sub && <span style={s(`font-family:${ROUND};font-size:11.5px;color:var(--ink-mut)`)}>{look.sub}</span>}
            </span>
            <span style={s(`font-family:${ROUND};font-size:15px;color:#5E8A66;font-variant-numeric:tabular-nums;flex-shrink:0`)}>{t.price}</span>
            <span style={s(CHEV)}>›</span>
          </div>
        );
      })}
    </div>

    {/* 手書きふうの「いつもありがとう」。まとまりごと中央に置く */}
    <div style={s('display:flex;flex-direction:column;align-items:center;margin:10px 0 0')}>
      <div style={s(`font-family:${ROUND};font-size:16px;color:var(--ink-mut);transform:rotate(-6deg);line-height:1.5;text-align:center`)}>
        <div>いつも</div>
        <div>ありがとう</div>
        <svg width="90" height="12" viewBox="0 0 90 12" style={{ display: 'block', margin: '0 auto' }}><path d="M2 10C25 3 55 1 88 4" stroke="var(--ink-faint)" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
      </div>
    </div>
    <svg viewBox="0 0 375 60" preserveAspectRatio="none" style={{ display: 'block', width: 'calc(100% + 32px)', height: 60, margin: '26px -16px -110px' }}>
      <path d="M0 22C70 4 140 4 200 18s120 24 175 4V60H0z" fill="var(--bg2)" />
    </svg>
  </>);
}

export function Settings({ v }) {
  // 押すと出るメニュー（TimeTree と同じ、行の下に小さく出る）
  const [menu, setMenu] = React.useState(null);
  const scRef = React.useRef(null);
  const rootRef = React.useRef(null);
  const open = (e, items) => {
    const row = e.currentTarget, root = rootRef.current;
    if (!row || !root) return;
    // 位置は offsetTop をたどって出す（画面ごと拡大していても、ずれない）
    let top = 0, el = row;
    while (el && el !== root) { top += el.offsetTop; el = el.offsetParent; }
    const sc = root.querySelector('[data-set-scroll]');
    const scrollTop = sc ? sc.scrollTop : 0;
    const h = (items || []).length * 42 + 8;
    let y = top - scrollTop + row.offsetHeight - 4;
    if (y + h > root.clientHeight - 90) y = Math.max(8, top - scrollTop - h + 4);
    setMenu({ items, y });
  };
  const page = v.setPage;
  React.useLayoutEffect(() => {
    if (!page && scRef.current) scRef.current.scrollTop = SAVED.main || 0;
  }, [page]);
  const Page = { support: SupportPage, types: TypesPage, work: WorkPage, jobs: JobsPage, leave: LeavePage, overlay: OverlayPage, backup: BackupPage, files: FilesPage }[page];
  return (
    <div ref={rootRef} style={s('position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
      {Page ? (
        <div className="scr-head-solo" style={s('padding:0 12px 10px;display:flex;align-items:center;gap:4px;position:relative')}>
          <span role="button" aria-label="設定へ戻る" style={s('display:flex;align-items:center;gap:2px;font-size:14px;color:var(--ink-mut);cursor:pointer;padding:6px 4px;flex-shrink:0')} onClick={v.onSetBack}><span style={s('font-size:24px;line-height:1')}>‹</span>{page === 'support' ? '' : '設定'}</span>
          {/* 題は戻るの幅に関係なく、画面の真ん中に置く */}
          <span style={s('position:absolute;left:72px;right:72px;bottom:10px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none' + (page === 'support' ? `;font-family:${ROUND};font-weight:400;font-size:16px` : ''))}>{v.setPageTitle}</span>
        </div>
      ) : (
        <div className="scr-head-solo" style={s('padding:0 20px 10px')}>
          <span style={s('font-size:30px;font-weight:300;color:var(--ink);letter-spacing:-.5px')}>設定</span>
        </div>
      )}
      <div data-set-scroll="1" key={page || 'main'} ref={scRef}
        onScroll={(e) => { if (!Page) SAVED.main = e.currentTarget.scrollTop; }}
        style={s(`flex:1;overflow-y:auto;padding:12px 16px 110px;${Page ? 'animation:slideFromRight .24s cubic-bezier(.2,.9,.2,1)' : ''}`)}>
        {Page ? <Page v={v} /> : <Main v={v} open={open} />}
      </div>

      {menu && (
        <div style={s('position:absolute;inset:0;z-index:95')} onClick={() => setMenu(null)}>
          <div style={s(`position:absolute;right:16px;top:${menu.y}px;min-width:210px;max-width:78%;background:var(--card);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18),0 0 0 1px var(--line);overflow:hidden;animation:dlgIn .18s cubic-bezier(.2,.9,.2,1)`)} onClick={(e) => e.stopPropagation()}>
            {menu.items.map((it, i) => (
              <div key={i} style={s(`display:flex;align-items:center;gap:10px;padding:0 16px;min-height:42px;cursor:pointer;${i ? 'border-top:1px solid var(--line)' : ''}`)}
                onClick={() => { it.onClick(); setMenu(null); }}>
                <span style={s('width:16px;font-size:14px;font-weight:700;color:var(--ink);flex-shrink:0')}>{it.sel ? '✓' : ''}</span>
                <span style={s('font-size:14px;color:var(--ink);white-space:nowrap')}>{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 使い方をえらぶ ===== */}
      {v.profileSheetShown && (
        <Sheet title="ふだんの予定に近いのは？" onClose={v.onProfileClose}>
          <div style={s('display:flex;flex-direction:column;gap:8px')}>
            {(v.profileOpts || []).map((p) => (
              <div key={p.key} style={s(`display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:15px;background:var(--card);cursor:pointer;border:1px solid ${p.sel ? 'var(--ink)' : 'var(--line)'}`)} onClick={p.onClick}>
                <span style={s('flex:1;display:flex;flex-direction:column;gap:2px')}>
                  <span style={s('font-size:14px;font-weight:500;color:var(--ink)')}>{p.label}</span>
                  <span style={s('font-size:12px;color:var(--ink-mut)')}>{p.note}</span>
                </span>
                {p.sel && <span style={s('font-size:13px;color:var(--ink-mut)')}>いま</span>}
              </div>
            ))}
          </div>
          {v.profileRetireShown && (
            <div style={s('display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:13px;background:var(--bg2);cursor:pointer')} onClick={v.onProfileRetire}>
              <span style={s(`width:20px;height:20px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;${v.profileRetireOn ? 'background:var(--ink);color:var(--card)' : 'border:1.5px solid var(--line)'}`)}>{v.profileRetireOn ? '✓' : ''}</span>
              <span style={s('font-size:13px;color:var(--ink-soft);line-height:1.6')}>バイト先をまとめて「辞めた」にする（記録は残ります）</span>
            </div>
          )}
          <div style={s('font-size:11.5px;color:var(--ink-faint);margin:12px 4px 0;line-height:1.8')}>{bullets(['予定の種類・呼び名・空きを見る時間が変わります', '予定はそのまま残ります'])}</div>
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
          <div style={s('font-size:11.5px;color:var(--ink-faint);margin:12px 4px 0;line-height:1.8')}>{bullets(['毎日1回、自動でとります', '7日分と、月初めの3か月分を残します'])}</div>
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
            <Row label="記号（1〜2文字）" sub="例：日・夜・早・遅・休" right={<input value={v.tplSym} onChange={v.onTplSym} maxLength={2} style={s('width:4ch;border:none;outline:none;background:var(--bg2);border-radius:9px;padding:7px 10px;font-size:14px;color:var(--ink);text-align:center;font-family:inherit')} />} />
            <Row label="名前" right={<input value={v.tplName} onChange={v.onTplName} placeholder="日勤" style={s('width:9ch;border:none;outline:none;background:var(--bg2);border-radius:9px;padding:7px 10px;font-size:14px;color:var(--ink);font-family:inherit')} />} />
            <Row label="休み（終日）" right={<Toggle t={v.tplAllDay} onClick={v.onTplAllDay} />} />
            {v.tplAllDay.track.background !== 'var(--ink)' && (<>
              <Row label="時間" sub="終わりが早ければ翌日まで（夜勤）" right={<span style={s('display:flex;align-items:center;gap:5px')}><TimeSel value={v.tplFrom} onChange={v.onTplFrom} opts={v.timeOpts} />〜<TimeSel value={v.tplTo} onChange={v.onTplTo} opts={v.timeOpts} /></span>} />
              <Row label="いつもの休憩" right={<TimeSel value={v.tplBrk} onChange={v.onTplBrk} opts={v.brkOpts} />} last />
            </>)}
          </div>
          <div style={s(`margin-top:14px;padding:14px;border-radius:15px;text-align:center;font-size:14px;font-weight:700;cursor:pointer;${v.tplSym ? 'background:var(--ink);color:var(--card)' : 'background:var(--bg2);color:var(--ink-faint)'}`)} onClick={v.onTplSave}>この型を足す</div>
        </Sheet>
      )}

      {/* ===== 勤務先を消す確認 ===== */}
      {v.confirmJobShown && (
        <div style={s('position:absolute;inset:0;z-index:93;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onCancelJob}>
          <div style={s('width:100%;max-width:300px;background:var(--card);border-radius:16px;padding:22px 20px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={(e) => e.stopPropagation()}>
            <div style={s('font-size:16px;color:var(--ink);text-align:center;text-wrap:balance')}>{v.confirmJobText}</div>
            <div style={s('font-size:13px;color:var(--ink-mut);text-align:left;margin:10px 0 18px;line-height:1.7;white-space:pre-line')}>{v.confirmJobBody}</div>
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:15px;font-weight:700;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onConfirmJob}>消す</div>
              <div style={s('padding:12px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onCancelJob}>やめる</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

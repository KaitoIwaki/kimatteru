import React from 'react';
import { s } from './style';
import { Settings } from './settingsview.jsx';
import { Jp } from './jp.jsx';

// 取り込みの画面の絵。「iPhone のカレンダー → LUKKO、読むだけ」を1枚で言う。
// 文で3段落書いていたものを、これと2行に置き換えた。説明が一気に出ると
// 読む気が失せて、結局どのボタンを押せばいいか分からない、という指摘から。
function ImportPic() {
  // LUKKO のアイコンと同じ、詰まった点と点線の輪
  const mark = (cx, cy, open) => (open
    ? <circle key={cx + ':' + cy} cx={cx} cy={cy} r="4.5" fill="none" stroke="#3A3D40" strokeWidth="1.3" strokeDasharray="2 1.8" />
    : <circle key={cx + ':' + cy} cx={cx} cy={cy} r="4.5" fill="#3A3D40" />);
  return (
    <svg width="100%" viewBox="0 0 300 110" style={s('display:block;margin:18px 0 14px')} aria-hidden="true">
      <rect x="20" y="20" width="76" height="76" rx="16" fill="#fff" stroke="var(--line)" strokeWidth="1" />
      <rect x="20" y="20" width="76" height="22" rx="16" fill="#E5463C" />
      <rect x="20" y="34" width="76" height="8" fill="#E5463C" />
      <text x="58" y="74" textAnchor="middle" fontSize="30" fontWeight="300" fill="#1E2024" fontFamily="inherit">16</text>
      <path d="M108 58 H186" stroke="var(--ink-mut)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M180 52 L188 58 L180 64" stroke="var(--ink-mut)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="148" y="46" textAnchor="middle" fontSize="11" fill="var(--ink-mut)" fontFamily="inherit">読むだけ</text>
      <rect x="204" y="20" width="76" height="76" rx="16" fill="#F2EEE6" stroke="var(--line)" strokeWidth="1" />
      <rect x="222" y="34" width="40" height="5" rx="2.5" fill="#8CA3B8" />
      {[[228, 56, false], [242, 56, true], [256, 56, false], [228, 72, true], [242, 72, false], [256, 72, false]].map(([x, y, o]) => mark(x, y, o))}
    </svg>
  );
}

// 開いたり閉じたりする小さな説明。要る人だけが開く
function Fold({ title, open, onToggle, children }) {
  return (
    <div style={s('background:var(--card);border:1px solid var(--line);border-radius:17px;overflow:hidden')}>
      <div style={s('display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer')} onClick={onToggle}>
        <span style={s('flex:1;font-size:13px;font-weight:700;color:var(--ink);line-height:1.6')}>{title}</span>
        <span style={s(`font-size:12px;color:var(--ink-mut);flex-shrink:0;transition:transform .2s ease;transform:rotate(${open ? '90deg' : '0deg'})`)}>▶</span>
      </div>
      {open && <div style={s('padding:0 16px 16px;font-size:12.5px;color:var(--ink-soft);line-height:1.95;text-wrap:pretty;animation:riseUp .22s cubic-bezier(.2,.9,.2,1)')}>{children}</div>}
    </div>
  );
}

// まとめの、種類ごとの時間。上の行が種類、その下に何が多かったか。
// 下の行は名前が2つ以上あるときだけ来る（App.jsx の _timeBreakdown が絞る）。
// 1つしか無いなら上の行と同じことを二度言うだけになる。
function Kinds({ kinds }) {
  return (
    <div style={s('margin-top:16px;padding-top:14px;border-top:1px solid var(--line)')}>
      {(kinds || []).map((k, i) => (
        <div key={k.key} style={s(i ? 'margin-top:14px' : '')}>
          <div style={s('display:flex;align-items:center;gap:8px')}>
            <span style={s({ width: 8, height: 8, borderRadius: 4, background: k.color, flexShrink: 0 })} />
            <span style={s('flex:1;font-size:14px;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{k.name}</span>
            <span style={s('font-size:11px;color:var(--ink-mut);flex-shrink:0')}>{k.times}件</span>
            <span style={s('font-size:14px;font-weight:400;color:var(--ink);flex-shrink:0;font-variant-numeric:tabular-nums')}>{k.amount}</span>
          </div>
          {k.tops.map((t, j) => (
            <div key={j} style={s('display:flex;align-items:center;gap:8px;margin-top:6px;padding-left:16px')}>
              <span style={s('flex:1;font-size:12px;color:var(--ink-mut);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{t.name}</span>
              <span style={s('font-size:12px;color:var(--ink-mut);flex-shrink:0;font-variant-numeric:tabular-nums')}>{t.amount}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// まとめの画面。本体の木から切り出してある。月と年もそれぞれ別の関数。
//
// （一度ここに「入れ子が深いと rollup が落ちる」と書いたが、**間違いだった。**
// 落ちていたのは Node 24.13 の fs.rmSync で、dist を空にするところ。vite.config.js を見よ。
// 切り出し自体は読みやすいので残してある）
//
// 月と年でタブを分けている。1枚に全部並べると、バイトの人は 2.5 画面ぶんになって
// 給料まで届くのに長かった。
function Report({ v }) {
  return (
    <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
      <div className="scr-head-solo" style={s('padding:0 20px 10px')}>
        <span style={s('font-size:30px;font-weight:300;color:var(--ink);letter-spacing:-.5px')}>まとめ</span>
      </div>
      <div style={s('flex:1;overflow-y:auto;padding:8px 16px 110px')}>
        {v.repEmpty ? (
          <div style={s('text-align:center;padding:56px 24px;color:var(--ink-faint);font-size:14px;line-height:1.9;text-wrap:pretty')}>
            {''}<Jp parts={['まだ何も','ありません。','予定を確定すると、','何にどれだけ','時間を使ったかが、','ここに','積み上がっていきます。']} />
          </div>
        ) : (
          <>
            <div style={s('display:flex;background:var(--bg2);border-radius:13px;padding:2px;margin:0 0 18px')}>
              {(v.repSeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
            </div>
            {v.repTab === 'year' ? <ReportYear v={v} /> : <ReportMonth v={v} />}
          </>
        )}
      </div>
    </div>
  );
}

// ‹ 2026年 9月 › のような、期間を送る行。月と年で同じ形
function Nav({ label, prev, next, prevLabel, nextLabel }) {
  return (
    <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 2px 10px')}>
      <span role="button" aria-label={prevLabel} style={s('width:36px;height:32px;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={prev}>‹</span>
      <span style={s('font-size:14.5px;font-weight:400;color:var(--ink);font-variant-numeric:tabular-nums')}>{label}</span>
      <span role="button" aria-label={nextLabel} style={s('width:36px;height:32px;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={next}>›</span>
    </div>
  );
}

// 大きな数字。「42 時間 30分」。時間が無ければ「2 日」
function Head({ head, sub, size }) {
  return (
    <>
      <div style={s('display:flex;align-items:baseline;gap:3px;margin-bottom:6px')}>
        <span style={s(`font-size:${size || 40}px;font-weight:300;color:var(--ink);letter-spacing:-.8px;font-variant-numeric:tabular-nums;line-height:1`)}>{head.num}</span>
        <span style={s('font-size:17px;font-weight:400;color:var(--ink-mut)')}>{head.unit}</span>
        {!!head.rest && <span style={s('font-size:14px;color:var(--ink-mut);margin-left:4px')}>{head.rest}</span>}
      </div>
      <div style={s('font-size:11px;color:var(--ink-mut);letter-spacing:.06em')}>{sub}</div>
    </>
  );
}

// バイト先ごとの行。月と年で同じ形
function JobRows({ jobs, pad, soft }) {
  return (jobs || []).map((j, i) => (
    <div key={i} style={s(`display:flex;align-items:center;gap:8px;${pad ? `padding:12px 16px;${i ? 'border-top:1px solid var(--line)' : ''}` : (i ? 'margin-top:10px' : '')}`)}>
      <span style={s({ width: 8, height: 8, borderRadius: 4, background: j.color, flexShrink: 0 })} />
      <span style={s(`flex:1;font-size:13px;color:${soft ? 'var(--ink-soft)' : 'var(--ink)'};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}>{j.name}</span>
      <span style={s('font-size:11px;color:var(--ink-mut);flex-shrink:0')}>{j.hours}</span>
      <span style={s('font-size:14px;font-weight:400;color:var(--ink);flex-shrink:0;font-variant-numeric:tabular-nums')}>{j.wage}</span>
    </div>
  ));
}

// まとめカードへの行
function ShareRow({ label, onClick }) {
  return (
    <>
      <div style={s('font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px')}>シェア</div>
      <div style={s('background:var(--card);border-radius:17px;overflow:hidden;border:1px solid var(--line)')}>
        <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={onClick}>
          <span style={s('width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800')}>✓</span>
          <span style={s('flex:1;font-size:14.5px;color:var(--ink)')}>{label}</span>
          <span style={s('font-size:15px;color:var(--ink-faint)')}>›</span>
        </div>
      </div>
    </>
  );
}

// 月のタブ。その月、何にどれだけ時間を使ったか。給料はその下
function ReportMonth({ v }) {
  return (
    <>
      <Nav label={v.repYearLabel + ' ' + v.repMonthLabel} prev={v.onRepPrevMonth} next={v.onRepNextMonth} prevLabel="前の月" nextLabel="次の月" />
      <div style={s('background:var(--card);border-radius:17px;padding:20px 18px 20px;margin-bottom:22px;border:1px solid var(--line)')}>
        {v.repMonthNone ? (
          <div style={s('font-size:13px;color:var(--ink-faint);line-height:1.8;text-wrap:pretty')}>
            {''}<Jp parts={['この月には、','確定した予定が','ありません。']} />
          </div>
        ) : (
          <>
            <Head head={v.repMonthHead} sub={v.repMonthSub} />
            <Kinds kinds={v.repMonthKinds} />
          </>
        )}
      </div>

      {/* 働いた時間の話（残業・有給）。記録や設定があるときだけ */}
      {(!!v.repOverMonth || !!v.repLeave) && (
        <div style={s('background:var(--card);border-radius:17px;padding:14px 18px;margin-bottom:22px;border:1px solid var(--line);display:flex;flex-direction:column;gap:8px')}>
          {!!v.repOverMonth && <span style={s('font-size:14px;color:var(--ink)')}>{v.repOverMonth}</span>}
          {!!v.repLeave && <span style={s('font-size:14px;color:var(--ink)')}>{v.repLeave}</span>}
        </div>
      )}
      {/* 締め日のある勤務先：給料日ごとの金額 */}
      {(v.repPayRows || []).length > 0 && (
        <>
          <div style={s('font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px')}>給料日ごと</div>
          <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:22px;border:1px solid var(--line)')}>
            {v.repPayRows.map((r, i) => (
              <div key={i} style={s(`display:flex;align-items:center;gap:10px;padding:13px 16px;${i ? 'border-top:1px solid var(--line)' : ''}`)}>
                <span style={s('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                  <span style={s('font-size:14px;color:var(--ink)')}>{r.head}</span>
                  <span style={s('font-size:11px;color:var(--ink-mut)')}>{r.name}・{r.range}・{r.times}回</span>
                </span>
                <span style={s('font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums')}>{r.wage}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {/* 給料。バイトの実績がその年にあるときだけ。無い人には金の話はいらない */}
      {v.repWageShown && (
        <>
          <div style={s('font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px')}>給料</div>
          <div style={s('background:var(--card);border-radius:17px;padding:20px 18px 20px;margin-bottom:22px;border:1px solid var(--line)')}>
            <div style={s('display:flex;align-items:baseline;gap:3px;margin-bottom:6px')}>
              <span style={s('font-size:17px;font-weight:400;color:var(--ink-mut)')}>{v.repMonthWageParts.unit}</span>
              <span style={s('font-size:30px;font-weight:300;color:var(--ink);letter-spacing:-.6px;font-variant-numeric:tabular-nums;line-height:1')}>{v.repMonthWageParts.num}</span>
            </div>
            <div style={s('font-size:11px;color:var(--ink-mut);letter-spacing:.06em')}>働いた {v.repMonthHours}・{v.repMonthDays}日</div>
            {/* バイト先ごとの内訳。掛け持ちだと、どちらでいくら稼いだかが要る */}
            {(v.repMonthJobs || []).length > 1 && (
              <div style={s('margin-top:16px;padding-top:14px;border-top:1px solid var(--line)')}>
                <JobRows jobs={v.repMonthJobs} />
              </div>
            )}
          </div>
          <div style={s('font-size:11px;color:var(--ink-faint);margin:-14px 6px 22px;line-height:1.8;text-wrap:pretty')}>
            {''}<Jp parts={['金額は時給から出した目安で、', '割増や交通費は', '入っていません。']} />
          </div>
          <ShareRow label={v.repMonthLabel + 'のまとめカード'} onClick={v.onOpenMonthCard} />
        </>
      )}
    </>
  );
}

// 年のタブ。月ごとの棒、年の合計、年の給料、使い始める前の額
function ReportYear({ v }) {
  return (
    <>
      <Nav label={v.repYearLabel} prev={v.onRepPrevYear} next={v.onRepNextYear} prevLabel="前の年" nextLabel="次の年" />
      <div style={s('font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px')}>月ごとの時間</div>
      <div style={s('background:var(--card);border-radius:17px;padding:18px 12px 12px;margin-bottom:22px;border:1px solid var(--line)')}>
        <div style={s('display:flex;align-items:flex-end;justify-content:space-between;gap:3px;height:96px;padding:0 2px')}>
          {(v.repBars || []).map((b, i) => (
            <div key={i} style={s('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;cursor:pointer')} onClick={b.onClick}>
              <div style={s('width:100%;display:flex;align-items:flex-end;justify-content:center;flex:1')}>
                <div style={s('width:100%;max-width:14px')}><div style={s(b.barStyle)} /></div>
              </div>
              <span style={s(b.labelStyle)}>{b.label}</span>
            </div>
          ))}
        </div>
        <div style={s('font-size:11px;color:var(--ink-faint);margin:10px 4px 0;text-align:center')}>押すと、その月へ</div>
      </div>

      <div style={s('font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px')}>{v.repYearLabel}の合計</div>
      <div style={s('background:var(--card);border-radius:17px;padding:20px 18px 20px;margin-bottom:22px;border:1px solid var(--line)')}>
        <Head head={v.repYearHead} sub={v.repYearSub} size={32} />
        <Kinds kinds={v.repYearKinds} />
      </div>

      {v.repWageShown && <ReportYearWage v={v} />}
    </>
  );
}

// 年の給料。働いた時間・日数・稼いだ額、バイト先ごと、使い始める前の額
function ReportYearWage({ v }) {
  return (
    <>
      <div style={s('font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px')}>給料</div>
      <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:22px;border:1px solid var(--line)')}>
        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
          <span style={s('font-size:14px;color:var(--ink-mut)')}>働いた時間</span>
          <span style={s('font-size:16px;font-weight:400;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearHours}</span>
        </div>
        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
          <span style={s('font-size:14px;color:var(--ink-mut)')}>働いた日数</span>
          <span style={s('font-size:16px;font-weight:400;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearDays}日</span>
        </div>
        <div style={s(`display:flex;align-items:center;justify-content:space-between;padding:14px 16px;${(v.repYearJobs || []).length > 1 ? 'border-bottom:1px solid var(--line)' : ''}`)}>
          <span style={s('font-size:14px;color:var(--ink-mut)')}>稼いだ額</span>
          <span style={s('font-size:16px;font-weight:400;color:var(--ink);font-variant-numeric:tabular-nums')}>およそ {v.repYearWage}</span>
        </div>
        {/* バイト先ごとの内訳。掛け持ちのときだけ出す */}
        {(v.repYearJobs || []).length > 1 && <JobRows jobs={v.repYearJobs} pad soft />}
      </div>
      {/* 金額は時給×実働の概算。割増も交通費も入らないので、そう書いておく。
          扶養の線を判定できる数字ではない。 */}
      <div style={s('font-size:11px;color:var(--ink-faint);margin:-14px 6px 10px;line-height:1.8;text-wrap:pretty')}>
        {''}<Jp parts={['時間は', '記録したそのものです。', '金額は時給から出した目安で、', '割増や交通費は', '入っていません。']} />
      </div>
      {!!v.repPriorText && (
        <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 10px;line-height:1.8;text-wrap:pretty')}>{v.repPriorText}</div>
      )}
      <div style={s('margin-bottom:12px')} />

      {/* 年の途中から使い始めた人のための、手で入れる額。
          設定ではなくここに置く —— 年を選ぶのはこの画面で、
          合計が実際と合わないと気づくのもこの画面だから。 */}
      <div style={s('background:var(--card);border-radius:17px;overflow:hidden;border:1px solid var(--line);margin-bottom:22px')}>
        <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={v.onTogglePrior}>
          <div style={s('display:flex;flex-direction:column;gap:2px;flex:1;padding-right:12px;min-width:0')}>
            <span style={s('font-size:14.5px;color:var(--ink)')}>使い始める前の額</span>
            <span style={s('font-size:11px;color:var(--ink-mut)')}>{v.repPriorHint}</span>
          </div>
          <span style={s('font-size:14px;color:var(--ink-mut);font-variant-numeric:tabular-nums;flex-shrink:0')}>{v.repPriorLabel}</span>
          <span style={s('font-size:15px;color:var(--ink-faint);flex-shrink:0')}>{v.repPriorOpen ? '⌄' : '›'}</span>
        </div>
        {v.repPriorOpen && (
          <div style={s('padding:2px 16px 16px')}>
            <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px')}>
              <span style={s('font-size:14px;color:var(--ink-mut)')}>{v.repYearLabel}のぶん</span>
              <div style={s('display:flex;align-items:center;gap:3px;background:var(--bg2);border-radius:12px;padding:6px 12px')}>
                <span style={s('font-size:14.5px;font-weight:400;color:var(--ink-soft)')}>¥</span>
                <input value={v.repPriorValue} onChange={v.onPriorChange} inputMode="numeric" maxLength={8} placeholder="0" style={s('width:9ch;min-width:9ch;border:none;outline:none;background:transparent;font-size:15px;font-weight:400;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;font-family:inherit;padding:0')} />
              </div>
            </div>
            <div style={s('font-size:11px;color:var(--ink-faint);margin-top:12px;line-height:1.8;text-wrap:pretty')}>
              {''}<Jp parts={['上の「稼いだ額」と', 'まとめカードに足します。', '働いた時間と日数には', '入りません。']} />
            </div>
          </div>
        )}
      </div>
      <ShareRow label={v.repYearLabel + 'のまとめカード'} onClick={v.onOpenYearCard} />
    </>
  );
}

/**
 * ほかのカレンダーアプリを使っている人への案内。
 *
 * このアプリは iPhone のカレンダー本体を読む。つまり Google 専用ではなく、
 * iPhone の設定にアカウントとして足せるサービスなら、もともと全部読める——
 * Outlook、Microsoft 365、Yahoo!、会社や学校のカレンダーなど。
 * ただしアプリのどこにもそう書いていないので、誰も気づけなかった。
 * 手を動かすのは iPhone の設定アプリなので、こちらにできるのは道を教えることだけ。
 *
 * 設定アプリの中の決まった場所を直接開くことはできない（そのための URL は
 * Apple が公開していないもので、使うと審査で落ちる）。だから手順を書く。
 */
function OtherCal({ v, s }) {
  return (
    <div style={s('background:var(--card);border:1px solid var(--line);border-radius:17px;overflow:hidden')}>
      <div style={s('display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer')} onClick={v.onToggleOther}>
        <span style={s('flex:1;font-size:13px;font-weight:700;color:var(--ink);line-height:1.6')}>
          {''}<Jp parts={['Outlook や Yahoo! の予定が', '出てこないときは']} />
        </span>
        <span style={s(`font-size:12px;color:var(--ink-mut);flex-shrink:0;transition:transform .2s ease;transform:rotate(${v.impOtherOpen ? '90deg' : '0deg'})`)}>▶</span>
      </div>
      {v.impOtherOpen && (
        <div style={s('padding:0 16px 16px;animation:riseUp .22s cubic-bezier(.2,.9,.2,1)')}>
          <div style={s('font-size:12.5px;color:var(--ink-soft);line-height:1.95;text-wrap:pretty')}>
            {''}<Jp parts={['このアプリは、', 'iPhone のカレンダーに', '入っている予定を読みます。', 'Outlook、Microsoft 365、', 'Yahoo!、会社や学校の', 'カレンダーは、', 'iPhone の設定に', 'アカウントを足すと、', 'ここに出てくるように', 'なります。']} />
          </div>
          <div style={s('margin-top:12px;padding:12px 14px;border-radius:13px;background:var(--bg2)')}>
            {(v.impOtherSteps || []).map((t, i) => (
              <div key={i} style={s(`display:flex;gap:9px;${i ? 'margin-top:9px' : ''}`)}>
                <span style={s('width:17px;height:17px;border-radius:9px;flex-shrink:0;background:var(--ink-faint);color:var(--card);font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:2px')}>{i + 1}</span>
                <span style={s('flex:1;font-size:12px;color:var(--ink-soft);line-height:1.85')}>{t}</span>
              </div>
            ))}
          </div>
          <div style={s('margin-top:12px;font-size:11.5px;color:var(--ink-faint);line-height:1.85;text-wrap:pretty')}>
            {''}<Jp parts={['TimeTree や ジョルテ のように、', 'アプリの中だけに', '予定を持っているものは、', 'このやり方では', '出てきません。', 'そのアプリから', '.ics で書き出したファイルなら、', '設定の', '「ファイルから取り込む」で', '入れられます。']} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 時刻の目盛りの上に予定の箱を置く（週表示と、日の「時間」表示）。
 * 決まった予定は塗り、まだの予定は点線——月表示と同じ決まりのまま。
 * 何もない所を押すと、その時刻から新しい予定を作る。
 * cols … 列（日）ごとに { key, allDay, boxes, nowTop, onSlot }。見出しは head を渡したときだけ出す
 */
function TimeGrid({ cols, hours, hourH, scrollRef, head, gutter = 30 }) {
  const total = hourH * 24;
  const anyAllDay = cols.some((c) => c.allDay && c.allDay.pills.length);
  return (
    <div style={s('display:flex;flex-direction:column;flex:1;min-height:0')}>
      {head && (
        <div style={s(`display:grid;grid-template-columns:${gutter}px repeat(${cols.length},1fr);border-bottom:1px solid var(--line)`)}>
          <span />
          {cols.map((c) => (
            <div key={c.key} style={s(c.headStyle)} onClick={c.onHead}>
              <div style={s(c.dowStyle)}>{c.dow}</div>
              <div><span style={s(c.numStyle)}>{c.date}</span></div>
            </div>
          ))}
        </div>
      )}
      {anyAllDay && (
        <div style={s(`display:grid;grid-template-columns:${gutter}px repeat(${cols.length},1fr);padding:3px 0 1px;border-bottom:1px solid var(--line)`)}>
          <span style={s('font-size:9px;color:var(--ink-faint);padding:3px 0 0 3px')}>終日</span>
          {cols.map((c) => (
            <div key={c.key} style={s('padding:0 1px;min-width:0')}>
              {c.allDay.pills.map((p) => (<div key={p.key} style={s(p.style)} onClick={p.onClick}>{p.title}</div>))}
              {c.allDay.more > 0 && <div style={s('font-size:9px;color:var(--ink-mut);padding-left:2px')}>+{c.allDay.more}</div>}
            </div>
          ))}
        </div>
      )}
      <div ref={scrollRef} style={s('flex:1;overflow-y:auto;position:relative')}>
        <div style={s(`position:relative;height:${total}px;display:grid;grid-template-columns:${gutter}px repeat(${cols.length},1fr)`)}>
          <div style={s('position:relative')}>
            {hours.map((h, i) => (
              <span key={i} style={s(`position:absolute;top:${h.top - 6}px;right:4px;font-size:9.5px;color:var(--ink-faint);font-variant-numeric:tabular-nums`)}>{h.label}</span>
            ))}
          </div>
          {cols.map((c, ci) => (
            <div key={c.key} style={s(`position:relative;border-left:1px solid var(--line-faint);background:${c.isToday && cols.length > 1 ? 'var(--today-bg)' : 'transparent'}`)} onClick={c.onSlot}>
              {hours.map((h, i) => (<div key={i} style={s(`position:absolute;left:0;right:0;top:${h.top}px;border-top:1px solid ${i ? 'var(--line-faint)' : 'transparent'}`)} />))}
              {c.boxes.map((b) => (
                <div key={b.key} style={s(b.style)} onClick={b.onClick}>
                  <div style={s('white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500')}>{b.title}</div>
                  {!!b.time && <div style={s('font-size:9.5px;opacity:.8;font-variant-numeric:tabular-nums;white-space:nowrap')}>{b.time}</div>}
                </div>
              ))}
              {c.nowTop != null && (
                <div style={s(`position:absolute;left:-3px;right:0;top:${c.nowTop}px;height:0;border-top:1.5px solid var(--sun);z-index:2;pointer-events:none`)}>
                  <span style={s('position:absolute;left:-1px;top:-4px;width:7px;height:7px;border-radius:4px;background:var(--sun)')} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 週表示：日を横一列に並べて、指で流す（iPhone 標準のカレンダーの週表示と同じ動き）。
 * ・1画面に7日。離すと日の区切りに止まる（scroll-snap）。勢いよく払えば何日も進む
 * ・左の時刻と、上の曜日・日付は動かない（sticky）
 * ・描くのは前後の数週間だけ。流し終わったら（onWeekSettle）見えている日を中心に描き直す。
 *   描き直しても、見えている位置は変えない（下の useLayoutEffect で scrollLeft を合わせ直す）
 */
function WeekStrip({ v }) {
  const GUT = 30;
  const ref = React.useRef(null);
  const vRef = React.useRef(v); vRef.current = v;
  const timer = React.useRef(0);
  const [w, setW] = React.useState(0);
  const cols = v.weekCols || [];
  const H = v.weekHourH || 44, total = H * 24;
  const hours = v.weekHours || [];
  const colW = Math.max(30, ((w || (typeof window !== 'undefined' ? Math.min(window.innerWidth, 520) : 375)) - GUT) / 7);
  const anyAllDay = cols.some((c) => c.allDay && c.allDay.pills.length);
  // 幅を測る（回転・幅の変化にも合わせる）。縦は最初に朝7時あたりへ
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const m = () => setW(el.clientWidth);
    m(); el.scrollTop = vRef.current.weekStartTop || 0;
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);
  // いちばん左に見えている日（weekFirst）が左の端に来るよう合わせる。指で流して止まったあとは、もう合っているので動かない
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const target = (v.weekFirst - v.weekBase) * colW;
    if (Math.abs(el.scrollLeft - target) > 1) {
      el.style.scrollSnapType = 'none';
      el.scrollLeft = target;
      requestAnimationFrame(() => { el.style.scrollSnapType = ''; });
    }
    if (v.onWeekEl) v.onWeekEl(el, colW);
  }, [v.weekBase, v.weekFirst, colW]);
  const onScroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current, vv = vRef.current; if (!el) return;
      const n = vv.weekBase + Math.round(el.scrollLeft / colW);
      if (vv.onWeekSettle) vv.onWeekSettle(n);
    }, 160);
  };
  const bg = 'background:var(--bg)';
  return (
    <div ref={ref} onScroll={onScroll}
      style={s(`flex:1;min-height:0;overflow:auto;position:relative;scroll-snap-type:x mandatory;scroll-padding-left:${GUT}px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch`)}>
      <div style={{ width: GUT + cols.length * colW, position: 'relative' }}>
        {/* 上：曜日と日付（と終日の予定）。縦に送っても上に残る */}
        <div style={s(`position:sticky;top:0;z-index:3;${bg};border-bottom:1px solid var(--line)`)}>
          <div style={s('display:flex')}>
            <div style={s(`position:sticky;left:0;z-index:4;width:${GUT}px;flex-shrink:0;${bg}`)} />
            {cols.map((c) => (
              <div key={c.key} style={s({ ...c.headStyle, width: colW, flexShrink: 0 })} onClick={c.onHead}>
                <div style={s(c.dowStyle)}>{c.dow}</div>
                <div><span style={s(c.numStyle)}>{c.date}</span></div>
              </div>
            ))}
          </div>
          {anyAllDay && (
            <div style={s('display:flex;padding:3px 0 1px;border-top:1px solid var(--line)')}>
              <span style={s(`position:sticky;left:0;z-index:4;width:${GUT}px;flex-shrink:0;font-size:9px;color:var(--ink-faint);padding:3px 0 0 3px;${bg}`)}>終日</span>
              {cols.map((c) => (
                <div key={c.key} style={{ width: colW, flexShrink: 0, padding: '0 1px', minWidth: 0, boxSizing: 'border-box' }}>
                  {c.allDay.pills.map((p) => (<div key={p.key} style={s(p.style)} onClick={p.onClick}>{p.title}</div>))}
                  {c.allDay.more > 0 && <div style={s('font-size:9px;color:var(--ink-mut);padding-left:2px')}>+{c.allDay.more}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 本体：左の時刻は横に流しても残る */}
        <div style={{ display: 'flex', height: total, position: 'relative' }}>
          <div style={s(`position:sticky;left:0;z-index:2;width:${GUT}px;flex-shrink:0;height:${total}px;${bg}`)}>
            {hours.map((h, i) => (
              <span key={i} style={s(`position:absolute;top:${h.top - 6}px;right:4px;font-size:9.5px;color:var(--ink-faint);font-variant-numeric:tabular-nums`)}>{h.label}</span>
            ))}
          </div>
          {cols.map((c) => (
            <div key={c.key} style={s({ position: 'relative', width: colW, flexShrink: 0, scrollSnapAlign: 'start', borderLeft: '1px solid var(--line-faint)', boxSizing: 'border-box', background: c.isToday ? 'var(--today-bg)' : 'transparent' })} onClick={c.onSlot}>
              {hours.map((h, i) => (<div key={i} style={s(`position:absolute;left:0;right:0;top:${h.top}px;border-top:1px solid ${i ? 'var(--line-faint)' : 'transparent'}`)} />))}
              {c.boxes.map((b) => (
                <div key={b.key} style={s(b.style)} onClick={b.onClick}>
                  <div style={s('white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500')}>{b.title}</div>
                  {!!b.time && <div style={s('font-size:9.5px;opacity:.8;font-variant-numeric:tabular-nums;white-space:nowrap')}>{b.time}</div>}
                </div>
              ))}
              {c.nowTop != null && (
                <div style={s(`position:absolute;left:-3px;right:0;top:${c.nowTop}px;height:0;border-top:1.5px solid var(--sun);z-index:1;pointer-events:none`)}>
                  <span style={s('position:absolute;left:-1px;top:-4px;width:7px;height:7px;border-radius:4px;background:var(--sun)')} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Claude design のテンプレートを JSX に移植したもの。
// 値はすべて renderVals() が返す v から来る（表示ロジックは logic 側に閉じている）。
export function renderApp(v) {
  return (
    <div
      data-theme={v.theme}
      style={s('position:relative;height:100%;width:100%;background:var(--bg);overflow:hidden;transition:background .3s ease')}
      onTouchStart={v.onEdgeStart}
      onTouchEnd={v.onEdgeEnd}
    >
      {/* ===================== MONTH ===================== */}
      {v.monthShown && (
        <div style={s('display:flex;flex-direction:column;height:100%')}>
          <div className="month-head" style={s(`padding:${v.hd.pad};display:flex;align-items:center;justify-content:space-between;flex-wrap:nowrap;white-space:nowrap`)}>
            <div style={s('display:flex;align-items:center;gap:2px;min-width:0;flex-shrink:1')}>
              <span role="button" aria-label="前の月" tabIndex={0} style={s(`width:${v.hd.arrowW}px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--ink-mut);cursor:pointer;user-select:none`)} onClick={v.onPrevMonth}>‹</span>
              {/* 押すと年月をえらべる。‹ › だけだと来年の3月に7回かかる */}
              <div role="button" aria-label="年と月をえらぶ" style={s('display:flex;align-items:baseline;gap:7px;cursor:pointer;user-select:none;padding:2px 4px;margin:-2px -4px;white-space:nowrap;flex-shrink:0')} onClick={v.onTapMonthHead}>
                <span style={s(`font-size:${v.hd.monthPx}px;font-weight:300;color:var(--ink);letter-spacing:-.5px;white-space:nowrap`)}>{v.monthLabel}月</span>
                {v.hd.showYear && <span style={s(`font-size:${v.hd.yearPx}px;font-weight:500;color:var(--ink-mut);white-space:nowrap`)}>{v.year}</span>}
              </div>
              <span role="button" aria-label="次の月" tabIndex={0} style={s(`width:${v.hd.arrowW}px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--ink-mut);cursor:pointer;user-select:none`)} onClick={v.onNextMonth}>›</span>
            </div>
            <div style={s('display:flex;align-items:center;gap:2px;flex-shrink:0')}>
              {/* 今月以外を見ているときだけ出る。押すと今日の月へ戻る */}
              {v.todayBtnShown && (
                <span role="button" aria-label="今日へ戻る" style={s(`padding:${v.hd.todayPad};border-radius:999px;border:1px solid var(--line);font-size:13px;color:var(--ink);cursor:pointer;user-select:none;margin-right:2px;white-space:nowrap;flex-shrink:0;animation:capRise .2s ease`)} onClick={v.onGoToday}>今日</span>
              )}
              <div role="button" aria-label="予定を探す" style={s(`width:${v.hd.iconW}px;height:38px;flex-shrink:0;`+'display:flex;align-items:center;justify-content:center;cursor:pointer')} onClick={v.onOpenSearch}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="10.5" cy="10.5" r="6.2" stroke="var(--ink-soft)" strokeWidth="1.6" />
                  <path d="M15.2 15.2 20 20" stroke="var(--ink-soft)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div role="button" aria-label="これからの予定の一覧" style={s(`width:${v.hd.iconW}px;height:38px;flex-shrink:0;`+'display:flex;align-items:center;justify-content:center;cursor:pointer')} onClick={v.onOpenAgenda}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="var(--ink-soft)" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="4.6" cy="6.5" r="1.2" fill="var(--ink-soft)" /><circle cx="4.6" cy="12" r="1.2" fill="var(--ink-soft)" /><circle cx="4.6" cy="17.5" r="1.2" fill="var(--ink-soft)" />
                </svg>
              </div>
              <div role="button" aria-label="お知らせ" style={s(`width:${v.hd.iconW}px;height:38px;flex-shrink:0;`+'display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative')} onClick={v.onBell}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <path d="M6 10a6 6 0 0 1 12 0c0 3.2.7 5 1.4 6a.6.6 0 0 1-.5.9H5.1a.6.6 0 0 1-.5-.9C5.3 15 6 13.2 6 10Z" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M10.2 20.2a2 2 0 0 0 3.6 0" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {v.bellCount > 0 && (
                  <span style={s('position:absolute;top:1px;right:0;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#1D9E75;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--bg);font-variant-numeric:tabular-nums')}>{v.bellBadge}</span>
                )}
              </div>
            </div>
          </div>

          {/* 見出しの下の細い段。月と週の切り替え、まだ決まっていない数、日にち未定の棚、給料。
              給料はバイト先か働いた記録がある人にだけ出す */}
          <div style={s('display:flex;align-items:center;gap:8px;padding:0 12px 8px 14px;min-height:30px')}>
            <div style={s('display:flex;background:var(--bg2);border-radius:9px;padding:2px;flex-shrink:0')}>
              {(v.viewSeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
            </div>
            {v.undecidedCount > 0 && (
              <span role="button" style={s('display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;border:1.3px dashed var(--ink-faint);font-size:12px;color:var(--ink-soft);cursor:pointer;white-space:nowrap;flex-shrink:0')} onClick={v.onOpenUndecided}>
                まだ {v.undecidedCount}<span style={s('color:var(--ink-faint)')}>›</span>
              </span>
            )}
            {v.shelfCount > 0 && (
              <span role="button" style={s('display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;background:var(--bg2);font-size:12px;color:var(--ink-soft);cursor:pointer;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis')} onClick={v.onOpenShelf}>
                {v.shelfLabel}
              </span>
            )}
            <span style={s('flex:1')} />
            {v.stampChipShown && (
              <span role="button" style={s(`display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;font-size:12px;cursor:pointer;white-space:nowrap;flex-shrink:0;${v.stampOn ? 'background:var(--ink);color:var(--card)' : 'border:1px solid var(--line);color:var(--ink-soft)'}`)} onClick={v.onToggleStamp}>シフト入力</span>
            )}
            {v.wageToggleShown && (
              <div style={s('display:flex;align-items:center;gap:7px;cursor:pointer;flex-shrink:0')} onClick={v.onToggleWage}>
                <span style={s(`font-size:12px;font-weight:400;color:${v.wageLabelColor}`)}>給料</span>
                <div style={s(v.wageTrackStyle)}><div style={s(v.wageKnobStyle)} /></div>
              </div>
            )}
          </div>

          {/* 週表示。日を横一列に並べて、指で流す。離すと日の区切りに止まる */}
          {v.calView === 'week' && (
            <div style={s(`display:flex;flex-direction:column;flex:1;min-height:0;padding-bottom:${v.monthPadBottom}`)}>
              <WeekStrip v={v} />
            </div>
          )}

          {/* 曜日の見出しとマスは、左右の余白を必ず同じにする。
              違うと列が横にずれる（以前は左端で7px、右端で-5pxずれていた）。
              下に週の区切りと同じ線を引いて、宙に浮かせず「表の見出し」にする。 */}
          {v.calView !== 'week' && (<>
          <div style={s('display:grid;grid-template-columns:repeat(7,1fr);padding:6px 0 5px 0;border-bottom:1px solid var(--line)')}>
            {(v.weekdays || []).map((w, i) => (
              <div key={i} style={s(w.style)}>{w.label}</div>
            ))}
          </div>

          <div
            className="month-scroll"
            ref={v.monthAreaRef}
            style={s(`flex:1;overflow-y:auto;overflow-x:hidden;padding:0 0 ${v.monthPadBottom} 0;display:flex;flex-direction:column`)}
            onTouchStart={v.onMonthTouchStart}
            onTouchMove={v.onMonthTouchMove}
            onTouchEnd={v.onMonthTouchEnd}
            onTouchCancel={v.onMonthTouchCancel}
          >
            <div style={s('flex:1 1 auto;min-height:0;position:relative;overflow:hidden')}>
              <div ref={v.trackRef} style={s(v.trackStyle)}>
                {(v.monthPages || []).map((page) => (
                  <div key={page.key} style={s('flex:0 0 33.3333%;max-width:33.3333%;display:flex;flex-direction:column;box-sizing:border-box')}>
                    {/* 外枠も角丸も付けない。画面の横いっぱいまで使う */}
                    <div style={s('display:flex;flex-direction:column;background:var(--card);overflow:hidden;flex:1 1 auto;min-height:0')}>
                      {page.weeks.map((wk) => (
                        <div key={wk.key} style={s(wk.rowStyle)}>
                          {/* 地とタップ領域。帯はこの上に載る */}
                          <div style={s('position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,1fr)')}>
                            {wk.slots.map((sl, i) => (<div key={i} style={s(sl.bgStyle)} onClick={sl.onDay} />))}
                          </div>
                          <div style={s(wk.gridStyle)}>
                            {wk.slots.map((sl, i) => (
                              !!sl.day && <div key={'d' + i} style={s(sl.numWrap)}><span style={s(sl.numStyle)}>{sl.day}</span></div>
                            ))}
                            {wk.bars.map((b) => (
                              <div key={b.key} style={s(b.style)}>
                                {b.morphing && <span style={s(b.fillStyle)} />}
                                {!!b.mark && <span style={s({ ...b.markStyle, position: 'relative', zIndex: 1 })}>{b.mark}</span>}
                                <span style={s(b.textStyle)}>{b.text}</span>
                              </div>
                            ))}
                            {wk.more.map((mo, i) => (<div key={'m' + i} style={s(mo.style)}>{mo.text}</div>))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
          </>)}

          {/* まだ1件も無いときの案内。
              前は列の中に置いていて、カレンダーの高さを奪って最終週を切っていた。
              予定がゼロなら下半分は空なので、上に浮かせて隠すほうが害が少ない。 */}
          {v.showFirstRunHint && (
            <div className="first-run" style={s('position:absolute;left:16px;right:16px;display:flex;flex-direction:column;align-items:center;gap:9px;padding:20px 22px 18px;border-radius:20px;background:var(--glass);backdrop-filter:blur(14px);border:1px solid var(--line);text-align:center;box-shadow:0 10px 30px rgba(38,37,31,.10);animation:riseUp .4s cubic-bezier(.2,.9,.2,1) .2s both')}>
              <span role="button" aria-label="この案内を閉じる" style={s('position:absolute;top:4px;right:4px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--ink-faint);cursor:pointer;user-select:none')} onClick={v.onCloseFirstRunHint}>✕</span>
              <div style={s('display:flex;align-items:center;gap:8px')}>
                <span style={s('display:inline-block;width:52px;height:15px;border-radius:5px;background:#1D9E75')} />
                <span style={s('display:inline-block;width:52px;height:15px;border-radius:5px;background:rgba(29,158,117,.10);border:1.4px dashed #1D9E75')} />
              </div>
              <div style={s('font-size:13px;color:var(--ink-soft);line-height:1.7;text-wrap:pretty')}>
                {''}<Jp parts={['決まっている予定は','塗り、','まだ分からない予定は','点線で','並びます。']} />
              </div>
              <div style={s('font-size:12.5px;color:var(--ink-mut)')}><Jp parts={['下の ＋ から、', '最初の予定を', '置いてみてください']} /></div>
              {v.importAvailable && (
                <div style={s('margin-top:8px;padding:12px 20px;border-radius:15px;border:1px solid var(--line);background:var(--card);font-size:13px;font-weight:600;color:var(--ink-soft);cursor:pointer')} onClick={v.onOpenImport}>
                  iPhone のカレンダーから取り込む
                </div>
              )}
            </div>
          )}

          {/* シフト入力のパレット。型を選んで、マスを押すだけで置く。同じマスをもう一度押すと外れる */}
          {v.stampOn && (
            <div className="wagebar" style={s('position:absolute;left:0;right:0;bottom:82px;padding:10px 12px 12px;background:var(--glass);backdrop-filter:blur(14px);border-top:1px solid var(--line);z-index:6;animation:riseUp .26s cubic-bezier(.2,.9,.2,1)')}>
              <div style={s('display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none')}>
                {(v.stampTpls || []).map((t) => (
                  <div key={t.key} style={s(t.style)} onClick={t.onClick}>
                    <span style={s('font-size:14px;font-weight:700;white-space:nowrap')}>{t.label}</span>
                    <span style={s('font-size:10px;opacity:.7;white-space:nowrap;font-variant-numeric:tabular-nums')}>{t.sub}</span>
                  </div>
                ))}
              </div>
              <div style={s('display:flex;align-items:center;gap:8px')}>
                <div style={s('display:flex;background:var(--bg2);border-radius:10px;padding:2px;flex:1')}>
                  {(v.stampSeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
                </div>
                <span role="button" style={s('padding:7px 12px;border-radius:10px;background:var(--ink);color:var(--card);font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap')} onClick={v.onToggleStamp}>おわる</span>
              </div>
              <div style={s('font-size:11.5px;color:var(--ink-mut);margin-top:8px;cursor:pointer;text-decoration:underline;text-align:center')} onClick={v.onConfirmMonthShifts}>{v.stampMonthLabel}</div>
            </div>
          )}

          {v.wageOn && !v.stampOn && (
            <div className="wagebar" style={s('position:absolute;left:0;right:0;bottom:82px;padding:14px 22px;background:var(--glass);backdrop-filter:blur(14px);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;animation:riseUp .3s cubic-bezier(.2,.9,.2,1);cursor:pointer')} onClick={v.onOpenSummary}>
              {/* ラベルは格下げ（小さく・薄く・字間を開けて）、数字は大きく細く、
                  記号は数字より一段小さく。ラベルと数字が同じ強さで喋らないようにする。 */}
              <span style={s('font-size:11px;font-weight:400;color:var(--ink-mut);letter-spacing:.1em')}>{v.monthLabel}月の実績合計</span>
              <div style={s('display:flex;align-items:baseline;gap:2px')}>
                <span style={s('font-size:14px;font-weight:400;color:var(--ink-mut)')}>{v.monthTotalParts.unit}</span>
                <span style={s('font-size:26px;font-weight:300;color:var(--ink);letter-spacing:-.3px;font-variant-numeric:tabular-nums')}>{v.monthTotalParts.num}</span>
                <span style={s('font-size:16px;color:var(--ink-faint);margin-left:6px')}>›</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== DAY ===================== */}
      {v.dayShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          {/* 上：戻る・大きな日付と曜日・一覧｜時間。その下に1週間の帯（押すとその日へ） */}
          <div className="scr-head" style={s('padding:0 16px 4px 12px;display:flex;align-items:center;gap:6px')}>
            <span role="button" aria-label="戻る" style={s('font-size:20px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 8px 6px 4px;user-select:none;flex-shrink:0')} onClick={v.onDayBack}>←</span>
            <div style={s('flex:1;min-width:0;display:flex;align-items:baseline;gap:8px;white-space:nowrap')}>
              <span style={s(`font-size:22px;font-weight:600;letter-spacing:-.3px;color:${v.dayDateColor}`)}>{v.dayBigDate}</span>
              <span style={s('font-size:13px;color:var(--ink-mut)')}>{v.dayDowFull}</span>
              {!!v.dayHoliday && <span style={s('font-size:11px;font-weight:600;color:#B4453A;overflow:hidden;text-overflow:ellipsis')}>{v.dayHoliday}</span>}
            </div>
            <div style={s('display:flex;background:var(--bg2);border-radius:9px;padding:2px;flex-shrink:0')}>
              {(v.daySeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
            </div>
          </div>
          <div style={s('display:flex;align-items:center;gap:2px;padding:4px 8px 10px')}>
            <span role="button" aria-label="前の日" style={s('width:22px;flex-shrink:0;text-align:center;font-size:18px;color:var(--ink-faint);cursor:pointer;user-select:none')} onClick={v.onDayPrev}>‹</span>
            {(v.dayStrip || []).map((c) => (
              <div key={c.key} style={s('flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer')} onClick={c.onClick}>
                <span style={s(`font-size:10px;font-weight:600;color:${c.dowColor}`)}>{c.dow}</span>
                <span style={s(`width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:15px;font-variant-numeric:tabular-nums;${c.sel ? 'background:var(--ink);font-weight:700' : c.today ? 'border:1.5px solid var(--ink);font-weight:600' : ''};color:${c.numColor}`)}>{c.date}</span>
                <span style={s(`width:4px;height:4px;border-radius:2px;background:${c.has && !c.sel ? 'var(--ink-faint)' : 'transparent'}`)} />
              </div>
            ))}
            <span role="button" aria-label="次の日" style={s('width:22px;flex-shrink:0;text-align:center;font-size:18px;color:var(--ink-faint);cursor:pointer;user-select:none')} onClick={v.onDayNext}>›</span>
          </div>
          {v.dayView === 'time' ? (
            <div key={v.dayKey} style={s(`display:flex;flex-direction:column;flex:1;min-height:0;animation:${v.dayAnim}`)}>
              <TimeGrid cols={v.dayCols || []} hours={v.dayHours || []} hourH={v.dayHourH} scrollRef={v.dayScrollRef} gutter={40} />
            </div>
          ) : (
          <div key={v.dayKey} style={s(`flex:1;overflow-y:auto;padding:8px 16px 40px 16px;animation:${v.dayAnim}`)}>
            {!!v.daySummary && <div style={s('font-size:12px;color:var(--ink-mut);margin:0 4px 10px')}>{v.daySummary}</div>}
            {v.dayEmpty && (
              <div style={s('text-align:center;padding:44px 0 20px;display:flex;flex-direction:column;align-items:center;gap:8px')}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15" rx="3" stroke="var(--ink-faint)" strokeWidth="1.4" /><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="var(--ink-faint)" strokeWidth="1.4" strokeLinecap="round" /></svg>
                <span style={s('color:var(--ink-mut);font-size:14px')}>この日の予定はまだありません</span>
              </div>
            )}
            {(v.dayEvents || []).map((r) => (
              <React.Fragment key={r.key}>
              {!!r.gapBefore && <div style={s('font-size:11.5px;color:var(--ink-faint);margin:-2px 6px 9px;display:flex;align-items:center;gap:8px')}><span style={s('flex:1;border-top:1px dashed var(--line)')} />{r.gapBefore}<span style={s('flex:1;border-top:1px dashed var(--line)')} /></div>}
              <div style={s(r.wrapStyle)}>
                <div role="button" aria-label="この予定を削除" style={s(r.delWrapStyle)} onClick={r.onDelete}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M6.4 7.5 7.2 19a1.4 1.4 0 0 0 1.4 1.3h6.8a1.4 1.4 0 0 0 1.4-1.3l.8-11.5" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M10.4 11v5.4M13.6 11v5.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div
                  style={s(r.cardStyle || r.bodyStyle)}
                  onClick={r.onClick}
                  onTouchStart={r.onTouchStart}
                  onTouchMove={r.onTouchMove}
                  onTouchEnd={r.onTouchEnd}
                  onTouchCancel={r.onTouchCancel}
                >
                  {/* 左の端に種類の色の帯（まだなら点線） */}
                  <span style={s(r.dashed ? `width:5px;flex-shrink:0;background:repeating-linear-gradient(to bottom, ${r.accent} 0 6px, transparent 6px 10px)` : `width:5px;background:${r.accent};flex-shrink:0`)} />
                  <div style={s('flex:1;min-width:0;display:flex;align-items:center;gap:14px;padding:13px 14px 13px 12px')}>
                    <div style={s('width:52px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums')}>
                      <span style={s('font-size:15px;font-weight:600;color:var(--ink)')}>{r.startText}</span>
                      {!!r.endText && <span style={s('font-size:12px;color:var(--ink-mut)')}>{r.endText}</span>}
                    </div>
                    <div style={s('flex:1;min-width:0;display:flex;flex-direction:column;gap:4px')}>
                      <span style={s({ ...r.titleStyle, fontWeight: 500 })}>{r.titlePlain || r.titleText}</span>
                      {(!!r.place || !!r.durText) && (
                        <span style={s('display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-mut);min-width:0')}>
                          {!!r.durText && <span style={s('flex-shrink:0')}>{r.durText}</span>}
                          {!!r.place && (
                            <span style={s('display:flex;align-items:center;gap:3px;min-width:0;overflow:hidden')}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" /></svg>
                              <span style={s('overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.place}</span>
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <span style={s(r.chipStyle2 || 'font-size:11px;color:var(--ink-mut);flex-shrink:0')}>{r.statusWord}</span>
                  </div>
                </div>
              </div>
              </React.Fragment>
            ))}
            {(v.dayOverlay || []).map((r) => (
              <div key={r.key} style={s('display:flex;align-items:center;gap:12px;background:var(--card);border-radius:15px;padding:12px 14px;border:1px solid var(--line);margin-bottom:9px;cursor:pointer;opacity:.85')} onClick={r.onClick}>
                <span style={s('width:44px;flex-shrink:0;font-size:13px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>{r.time}</span>
                <span style={s('width:4px;align-self:stretch;background:var(--ink-faint);border-radius:2px;flex-shrink:0')} />
                <span style={s('flex:1;min-width:0;display:flex;flex-direction:column;gap:2px')}>
                  <span style={s('font-size:14px;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.title}</span>
                  {!!r.place && <span style={s('font-size:11.5px;color:var(--ink-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.place}</span>}
                </span>
                <span style={s('font-size:10.5px;color:var(--ink-faint);flex-shrink:0')}>iPhone</span>
              </div>
            ))}
            <div style={s('display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;padding:15px;border-radius:15px;border:1.5px dashed var(--line);color:var(--ink-soft);font-size:14.5px;font-weight:400;cursor:pointer')} onClick={v.onDayAdd}>＋ 予定を追加</div>
          </div>
          )}
        </div>
      )}

      {/* ===================== これから・まだ・探す ===================== */}
      {v.listShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 8px 18px')}>
            <span role="button" aria-label="戻る" style={s('font-size:20px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onListBack}>←</span>
            <span style={s('font-size:15px;font-weight:400;color:var(--ink)')}>予定の一覧</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('padding:0 16px 10px')}>
            <div style={s('display:flex;background:var(--bg2);border-radius:13px;padding:2px')}>
              {(v.listSeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
            </div>
            {v.listTab === 'search' && (
              <input value={v.searchQ} onChange={v.onSearchQ} autoFocus placeholder="題名・場所・メモで探す" enterKeyHint="search"
                style={s('width:100%;box-sizing:border-box;margin-top:10px;border:1px solid var(--line);outline:none;background:var(--card);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit')} />
            )}
            {v.listTab === 'upcoming' && (
              <div style={s('display:flex;justify-content:flex-end;margin-top:8px')}>
                <span style={s(`padding:5px 11px;border-radius:999px;font-size:12px;cursor:pointer;${v.listDashOnly ? 'background:var(--ink);color:var(--card)' : 'border:1.3px dashed var(--ink-faint);color:var(--ink-soft)'}`)} onClick={v.onToggleDashOnly}>点線（まだ）だけ</span>
              </div>
            )}
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:0 16px 40px')}>
            {(v.listShelf || []).length > 0 && (
              <>
                <div style={s('font-size:12px;color:var(--ink-mut);margin:6px 4px 8px')}>日にちが、まだ決まっていない</div>
                <div style={s('background:var(--card);border:1px solid var(--line);border-radius:15px;overflow:hidden;margin-bottom:18px')}>
                  {v.listShelf.map((r, i) => (
                    <div key={r.key} style={s(`display:flex;align-items:center;gap:10px;padding:12px 14px;${i ? 'border-top:1px solid var(--line)' : ''}`)}>
                      <span style={s({ width: 8, height: 8, borderRadius: 4, border: '1.5px dashed ' + r.dot, flexShrink: 0 })} />
                      <span style={s('flex:1;min-width:0')}>
                        <span style={s('display:block;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.title}</span>
                        <span style={s('display:block;font-size:11px;color:var(--ink-mut)')}>{r.when}</span>
                      </span>
                      <span style={s('padding:6px 11px;border-radius:999px;background:var(--ink);color:var(--card);font-size:12px;cursor:pointer;white-space:nowrap')} onClick={r.onPick}>日を決める</span>
                      <span style={s('padding:6px 8px;font-size:12px;color:var(--ink-faint);cursor:pointer')} onClick={r.onDrop}>消す</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {(v.listGroups || []).map((g, gi) => (
              <div key={gi} style={s('margin-bottom:16px')}>
                <div style={s('font-size:12px;color:var(--ink-mut);margin:6px 4px 8px')}>{g.head}</div>
                <div style={s('background:var(--card);border:1px solid var(--line);border-radius:15px;overflow:hidden')}>
                  {g.rows.map((r, i) => (
                    <div key={r.key} style={s(`display:flex;align-items:flex-start;gap:12px;padding:11px 14px;cursor:pointer;${i ? 'border-top:1px solid var(--line-faint)' : ''}`)} onClick={r.onClick}>
                      <span style={s('width:42px;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-start')}>
                        <span style={s('font-size:14px;color:var(--ink);font-variant-numeric:tabular-nums')}>{r.date}</span>
                        <span style={s('font-size:10px;color:var(--ink-faint)')}>{r.dow}</span>
                      </span>
                      <span style={s('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px')}>
                        <span style={s('font-size:12px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>{r.time}</span>
                        <span style={s('min-width:0')}><span style={s(r.pillStyle)}>{r.title}</span></span>
                        {!!r.place && <span style={s('font-size:11.5px;color:var(--ink-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.place}</span>}
                        {r.onYes && (
                          <span style={s('display:flex;gap:6px;margin-top:4px')} onClick={v.stop}>
                            <span style={s('padding:5px 11px;border-radius:999px;background:var(--ink);color:var(--card);font-size:12px;cursor:pointer')} onClick={r.onYes}>決まった</span>
                            <span style={s('padding:5px 11px;border-radius:999px;border:1px solid var(--line);color:#A8452B;font-size:12px;cursor:pointer')} onClick={r.onGone}>{r.goneLabel}</span>
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!!v.listEmpty && (
              <div style={s('text-align:center;color:var(--ink-faint);font-size:14px;padding:48px 0')}>{v.listEmpty}</div>
            )}
          </div>
        </div>
      )}

      {/* ===================== 日にち未定の予定に、日を決める ===================== */}
      {v.somedayPickShown && (
        <div style={s('position:absolute;inset:0;z-index:88;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onSomedayPickClose}>
          <div style={s('width:100%;max-width:320px;background:var(--card);border-radius:18px;padding:18px 16px 12px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            <div style={s('font-size:15px;color:var(--ink);text-align:center;margin-bottom:10px;text-wrap:balance')}>{v.somedayPickTitle}</div>
            <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 2px 6px')}>
              <span role="button" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer')} onClick={v.onSomedayPickPrev}>‹</span>
              <span style={s('font-size:14px;font-weight:700;color:var(--ink)')}>{v.somedayPickLabel}</span>
              <span role="button" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer')} onClick={v.onSomedayPickNext}>›</span>
            </div>
            <div style={s('display:grid;grid-template-columns:repeat(7,1fr)')}>
              {(v.somedayPickWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
            </div>
            <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:2px')}>
              {(v.somedayPickCells || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
            </div>
            <div style={s('font-size:11px;color:var(--ink-faint);text-align:center;margin-top:8px')}>灰色の日は、ほかの予定が入っています。点線で置きます</div>
            <div style={s('padding:10px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onSomedayPickClose}>やめる</div>
          </div>
        </div>
      )}

      {/* ===================== いつ空いてる？ ===================== */}
      {v.freeShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          {/* シェアはこの画面に置く。空いている日を見ながら、そのまま送る。
              まとめタブに置いていたころは、見ている月と送る月が別だった。 */}
          <div className="scr-head" style={s('padding:0 18px 6px')}>
            <span />
            <span style={s('font-size:15px;font-weight:400;color:var(--ink)')}>いつ空いてる？</span>
            <span role="button" style={s('font-size:14px;color:var(--ink-mut);cursor:pointer;padding:6px 0 6px 12px;user-select:none;white-space:nowrap')} onClick={v.onOpenShare}>シェア</span>
          </div>
          <div style={s('padding:6px 18px 12px;display:flex;align-items:center;justify-content:space-between')}>
            <div style={s('display:flex;align-items:center;gap:14px')}>
              <span style={s('font-size:17px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onFreePrev}>◀</span>
              <span style={s('font-size:16px;font-weight:400;color:var(--ink);min-width:44px;text-align:center')}>{v.freeMonthLabel}月</span>
              <span style={s('font-size:17px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onFreeNext}>▶</span>
            </div>
            <div style={s('display:flex;align-items:center;gap:12px;font-size:13px;font-weight:700')}>
              <span style={s('color:#1D9E75')}>○{v.cO}</span>
              <span style={s('color:#B9770F')}>△{v.cA}</span>
              <span style={s('color:#C1C5CC')}>×{v.cX}</span>
            </div>
          </div>
          <div
            key={v.freeListKey}
            style={s(v.freeListStyle)}
            onTouchStart={v.onFreeTouchStart}
            onTouchMove={v.onFreeTouchMove}
            onTouchEnd={v.onFreeTouchEnd}
            onTouchCancel={v.onFreeTouchCancel}
          >
            {/* 予定が1件も無いと、全部「○」で意味を持たない。
                取り込みを勧めるのはここが一番いい（その寂しさを見た、その瞬間）。
                最初の画面で許可を求めると、何のためか分からないまま断られる。 */}
            {v.freeEmptyShown && (
              <div style={s('margin:14px 14px 4px;padding:16px 17px;border-radius:16px;background:var(--bg2);animation:capRise .4s cubic-bezier(.2,.9,.2,1) both')}>
                <div style={s('font-size:14px;font-weight:700;color:var(--ink);margin-bottom:6px')}>まだ予定がありません</div>
                <div style={s('font-size:12.5px;color:var(--ink-soft);line-height:1.9;text-wrap:pretty')}>
                  {''}<Jp parts={['予定を入れると、', 'その日が', '空いているかどうかが', 'ここに出ます。']} />
                </div>
                {v.freeEmptyCanImport && (
                  <div style={s('margin-top:14px;padding:12px;border-radius:13px;background:var(--card);border:1px solid var(--line);text-align:center;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer')} onClick={v.onFreeEmptyImport}>iPhone のカレンダーから取り込む</div>
                )}
              </div>
            )}
            {(v.freeRows || []).map((r, i) => (
              <div key={i} style={s(r.rowStyle)}>
                <div style={s({ ...r.dateWrap, cursor: 'pointer' })} onClick={r.onOpenDay}>
                  <span style={s(r.dowStyle)}>{r.dow}</span>
                  <span style={s(r.dayStyle)}>{r.day}</span>
                  {!!r.hol && <span style={s('font-size:8.5px;color:var(--sun);white-space:nowrap;max-width:44px;overflow:hidden;text-overflow:ellipsis')}>{r.hol}</span>}
                </div>
                <div style={s('flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;padding:0 12px')}>
                  <div style={s('display:flex;gap:4px;flex-wrap:wrap')}>
                    {(r.tags || []).map((tg, j) => (
                      <div key={j} style={s('display:flex;align-items:center;gap:5px')}>
                        <div style={s(tg.style)}>{tg.text}</div>
                        <span style={s(tg.timeStyle)}>{tg.time}</span>
                      </div>
                    ))}
                  </div>
                  {!!r.note && <span style={s(r.noteStyle)}>{r.note}</span>}
                </div>
                <div style={s(r.markWrap)} onClick={r.onCycle}><span style={s(r.markStyle)}>{r.mark}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== NEW EVENT ===================== */}
      {v.newShown && (
        <div style={s('position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span style={s('font-size:15px;color:var(--ink-mut);cursor:pointer')} onClick={v.onCancel}>キャンセル</span>
            <span style={s('font-size:15px;font-weight:400;color:var(--ink);white-space:nowrap')}>{v.newTitle}</span>
            {/* この画面の主要な動作。ここだけは 600 で残す——太さを落とすと、
                隣の「キャンセル」と同じ強さになって、どちらが本筋か分からなくなる。 */}
            <span style={s(`font-size:15px;font-weight:600;color:${v.draftColor};cursor:pointer`)} onClick={v.onSave}>保存</span>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:8px 16px 40px 16px')}>
            <div style={s(`background:var(--card);border-radius:17px;padding:4px 14px;margin-bottom:${(v.suggests || []).length ? 10 : 18}px`)}>
              <input value={v.draftTitle} placeholder={v.titlePlaceholder} onChange={v.onTitle} onKeyDown={v.onTitleKey} autoFocus={v.titleAutoFocus} enterKeyHint="done" style={s('width:100%;border:none;outline:none;padding:14px 0;font-size:15px;color:var(--ink);background:transparent')} />
            </div>
            {/* よく入れる予定。押すと種類・時刻・場所も前回と同じで入る */}
            {(v.suggests || []).length > 0 && (
              <div style={s('display:flex;gap:7px;overflow-x:auto;margin:0 -16px 16px;padding:0 16px 2px;scrollbar-width:none')}>
                {v.suggests.map((c, i) => (
                  <span key={i} style={s('display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-size:13px;color:var(--ink-soft);white-space:nowrap;cursor:pointer;flex-shrink:0')} onClick={c.onClick}>
                    <span style={s(c.dotStyle)} />{c.label}
                  </span>
                ))}
              </div>
            )}

            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
              <div style={s('font-size:13px;color:var(--ink);padding:13px 16px 9px')}>この予定は</div>
              <div style={s('display:flex;background:var(--bg2);border-radius:13px;padding:2px;margin:0 14px 10px')}>
                {(v.seg || []).map((sg, i) => (
                  <div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>
                ))}
              </div>
              <div style={s('display:flex;align-items:center;gap:7px;padding:0 16px 14px')}>
                <span style={s(v.previewDotStyle)} />
                <span style={s('font-size:12px;color:var(--ink-mut);text-wrap:pretty')}>{v.previewExplain}</span>
              </div>
            </div>

            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
              <div style={s(`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer;border-bottom:${v.jobPickerShown ? '1px solid var(--line)' : 'none'}`)} onClick={v.onTapTypeRow}>
                <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0')}>種類</span>
                <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                  <span style={s(v.typeDotStyle)} />
                  <span style={s(v.valType)}>{v.typeValue}</span>
                  <span style={s(v.chevType)}>›</span>
                </span>
              </div>
              {v.rowTypeOpen && (
                <div style={s('padding:2px 14px 14px;background:var(--bg2)')}>
                  <div style={s('display:flex;flex-wrap:wrap;gap:8px;padding-top:10px')}>
                    {(v.chips || []).map((ch, i) => (
                      <div key={i} style={s(ch.style)} onClick={ch.onClick}>{ch.label}</div>
                    ))}
                    <div style={s(v.addChipStyle)} onClick={v.onAddTypeChip}>＋ 種類</div>
                  </div>
                </div>
              )}
              {v.jobPickerShown && (
                <>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer')} onClick={v.onTapJobRow}>
                    <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0')}>{v.jobWordNew}</span>
                    <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                      <span style={s(v.valJob)}>{v.jobValue}</span>
                      <span style={s(v.chevJob)}>›</span>
                    </span>
                  </div>
                  {v.rowJobOpen && (
                    <div style={s('padding:12px 14px 14px;background:var(--bg2)')}>
                      <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
                        {(v.jobChips || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                        <div style={s(v.jobNoneChip.style)} onClick={v.jobNoneChip.onClick}>{v.jobNoneChip.label}</div>
                        <div style={s('padding:8px 14px;border-radius:999px;font-size:13px;color:var(--ink-mut);border:1px dashed var(--line);cursor:pointer')} onClick={v.onAddJobFromNew}>＋ {v.jobWordNew}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {v.newTypeShown && (
              <div style={s('background:var(--card);border-radius:15px;padding:14px;margin-bottom:16px;border:1px solid var(--line);animation:riseUp .24s cubic-bezier(.2,.9,.2,1)')}>
                <input value={v.newTypeName} placeholder={v.newTypeEg} onChange={v.onNewTypeName} style={s('width:100%;border:none;outline:none;padding:6px 0 12px;font-size:14.5px;color:var(--ink);border-bottom:1px solid var(--line)')} />
                <div style={s('display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 6px')}>
                  {(v.newTypeSwatches || []).map((sw, i) => (
                    <div key={i} style={s(sw.style)} onClick={sw.onClick} />
                  ))}
                </div>
                <div style={s('display:flex;gap:8px;margin-top:14px')}>
                  <div style={s('flex:1;text-align:center;padding:11px;border-radius:16px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:400;cursor:pointer')} onClick={v.onCancelNewType}>やめる</div>
                  <div style={s(v.addTypeBtnStyle)} onClick={v.onAddType}>この種類を追加</div>
                </div>
              </div>
            )}

            {v.jobPickerShown && (
              <>
                {v.newJobShown && (
                  <div style={s('background:var(--card);border-radius:17px;padding:16px;margin:-10px 0 22px;border:1px solid var(--line);animation:riseUp .24s cubic-bezier(.2,.9,.2,1)')}>
                    <input value={v.newJobName} onChange={v.onNewJobName} placeholder={v.newJobEg} style={s('width:100%;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:14.5px;color:var(--ink);font-family:inherit;margin-bottom:14px')} />
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px')}>
                      <span style={s('font-size:14px;color:var(--ink-mut)')}>時給</span>
                      <div style={s('display:flex;align-items:center;gap:10px;flex-shrink:0')}>
                        <div style={s(v.stepBtn)} onClick={v.onNewJobMinus}>−</div>
                        <div style={s('display:flex;align-items:center;gap:3px;background:var(--bg2);border-radius:12px;padding:6px 12px')}>
                          <span style={s('font-size:14.5px;font-weight:400;color:var(--ink-soft)')}>¥</span>
                          <input value={v.newJobHourly} onChange={v.onNewJobHourly} inputMode="numeric" maxLength={5} style={s('width:6ch;min-width:6ch;border:none;outline:none;background:transparent;font-size:15px;font-weight:400;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;font-family:inherit;padding:0')} />
                        </div>
                        <div style={s(v.stepBtn)} onClick={v.onNewJobPlus}>＋</div>
                      </div>
                    </div>
                    <div style={s('display:flex;gap:8px;margin-top:16px')}>
                      <div style={s('flex:1;text-align:center;padding:11px;border-radius:13px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:400;cursor:pointer')} onClick={v.onCancelNewJob}>やめる</div>
                      <div style={s('flex:1;text-align:center;padding:11px;border-radius:13px;background:#1D9E75;color:#fff;font-size:14px;font-weight:700;cursor:pointer')} onClick={v.onCommitNewJob}>{v.jobThisNew}</div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--line)')} onClick={v.onTapDate}>
                <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0')}>日にち</span>
                <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                  {!!v.dateSummary && <span style={s('font-size:12px;font-weight:400;color:#1D9E75;white-space:nowrap')}>{v.dateSummary}</span>}
                  <span style={s(v.dateValStyle)}>{v.dateLabel}</span>
                  <span style={s(v.chevDate)}>›</span>
                </span>
              </div>
              {v.dateOpen && (
                <div style={s('padding:2px 12px 14px;background:var(--bg2)')}>
                  {/* 年月の表示はボタン。押すと年と月を直接えらべる。
                      1ヶ月ずつしか動けないと、来年3月に行くのに8回タップになる。 */}
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:6px 2px 8px')}>
                    <span role="button" aria-label="前の月" style={s(`width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none;${v.ymPickOpen ? 'opacity:0;pointer-events:none' : ''}`)} onClick={v.onDatePrev}>‹</span>
                    <span role="button" aria-label="年と月をえらぶ" style={s(`display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:11px;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;cursor:pointer;user-select:none;transition:all .18s;${v.ymPickOpen ? 'background:var(--ink);color:var(--card)' : 'background:var(--card);color:var(--ink);border:1px solid var(--line)'}`)} onClick={v.onTapYM}>
                      {v.datePickLabel}
                      <span style={s(`font-size:10px;display:inline-block;transition:transform .2s;${v.ymPickOpen ? 'transform:rotate(180deg)' : ''}`)}>▾</span>
                    </span>
                    <span role="button" aria-label="次の月" style={s(`width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none;${v.ymPickOpen ? 'opacity:0;pointer-events:none' : ''}`)} onClick={v.onDateNext}>›</span>
                  </div>

                  {v.ymPickOpen ? (
                    <div style={s('padding:2px 0 6px')}>
                      <div style={s('display:flex;align-items:center;justify-content:center;gap:22px;padding:4px 0 12px')}>
                        <span role="button" aria-label="前の年" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYearPrev}>‹</span>
                        <span style={s('font-size:17px;font-weight:400;color:var(--ink);font-variant-numeric:tabular-nums;min-width:64px;text-align:center')}>{v.ymYearLabel}</span>
                        <span role="button" aria-label="次の年" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYearNext}>›</span>
                      </div>
                      <div style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:7px')}>
                        {(v.ymMonths || []).map((mo, i) => (
                          <div key={i} style={s(mo.style)} onClick={mo.onClick}>{mo.label}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                  <>
                  <div style={s('display:grid;grid-template-columns:repeat(7,1fr)')}>
                    {(v.dateWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
                  </div>
                  <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:2px')}>
                    {(v.dateCells || []).map((c, i) => (
                      <div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>
                    ))}
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 2px 2px')}>
                    <span style={s('font-size:11px;color:var(--ink-faint);line-height:1.6')}>{v.dateHint}</span>
                    {v.dateExtraCount > 0 && (
                      <span style={s('font-size:12px;color:var(--ink-mut);cursor:pointer;white-space:nowrap')} onClick={v.onClearExtraDays}>ほかの日を外す</span>
                    )}
                  </div>
                  {/* 日にちがまだ決まっていない予定（通院・美容院・帰省など）。月表示の上の棚に置く */}
                  {(v.somedayChips || []).length > 0 && (
                    <div style={s('margin-top:10px;padding-top:10px;border-top:1px solid var(--line)')}>
                      <div style={s('font-size:11px;color:var(--ink-mut);margin:0 2px 7px')}>日にちはまだ決めない</div>
                      <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>
                        {v.somedayChips.map((c, i) => (<span key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}
              {v.somedayOn && (
                <div style={s('padding:10px 16px 12px;font-size:12px;color:var(--ink-soft);border-bottom:1px solid var(--line);line-height:1.6')}>{v.somedayText}</div>
              )}

              <div style={s(`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)`)}>
                <span style={s('font-size:14.5px;color:var(--ink)')}>終日予定</span>
                <div style={s(v.allDayTrack)} onClick={v.onToggleAllDay}><div style={s(v.allDayKnob)} /></div>
              </div>

              {v.timed && (v.timeRows || []).map((r, i) => (
                  <div key={i} style={s(r.rowStyle)}>
                    {/* 日付と時刻を並べる。開始の日付は押すとカレンダー、
                        時刻は押すとドラムロール。終了の日付は押せない——
                        自由に選ばせると「3日後の11:00」のような、予定ではなく
                        期間になってしまい、実働時間の計算が意味を失う。 */}
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 16px')}>
                      <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0')}>{r.label}</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(i === 0
                          ? 'font-size:13.5px;color:var(--ink-soft);background:var(--bg2);border-radius:10px;padding:7px 11px;white-space:nowrap;cursor:pointer'
                          : `font-size:13.5px;border-radius:10px;padding:7px 11px;white-space:nowrap;${v.endNextDay ? 'color:#0F6E56;background:rgba(29,158,117,.12);font-weight:700' : 'color:var(--ink-faint);background:transparent'}`)}
                          onClick={i === 0 ? v.onTapStartDate : undefined}>{i === 0 ? v.startDateText : v.endDateText}</span>
                        <span style={s(`${r.valStyle && ''}font-size:14.5px;font-weight:${r.open ? 700 : 600};color:${r.open ? '#1D9E75' : 'var(--ink)'};background:var(--bg2);border-radius:10px;padding:7px 12px;font-variant-numeric:tabular-nums;cursor:pointer`)} onClick={r.onTap}>{r.value}</span>
                      </span>
                    </div>
                    {r.open && (
                      <div style={s('position:relative;display:flex;align-items:center;justify-content:center;gap:4px;height:170px;background:var(--bg2)')}>
                        <div style={s('position:absolute;top:68px;left:64px;right:64px;height:34px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);pointer-events:none')} />
                        <div style={s(v.wheelColStyle)} onScroll={r.hScroll} ref={r.hRef}>
                          {(r.hItems || []).map((it, j) => (<div key={j} style={s(v.wheelItemStyle)}>{it}</div>))}
                        </div>
                        <span style={s('font-size:18px;font-weight:300;color:var(--ink)')}>:</span>
                        <div style={s(v.wheelColStyle)} onScroll={r.mScroll} ref={r.mRef}>
                          {(r.mItems || []).map((it, j) => (<div key={j} style={s(v.wheelItemStyle)}>{it}</div>))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {v.timed && (v.durChips || []).length > 0 && (
                <div style={s('display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px 4px')}>
                  <span style={s('font-size:11px;color:var(--ink-faint);align-self:center;margin-right:2px')}>長さ</span>
                  {v.durChips.map((c, i) => (<span key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}
                </div>
              )}
              {!!v.crossNote && (
                <div style={s('padding:6px 16px 12px;font-size:11.5px;color:#0F6E56;line-height:1.6')}>{v.crossNote}</div>
              )}
              {!!v.overlapNote && (
                <div style={s('padding:6px 16px 12px;font-size:11.5px;color:#B9770F;line-height:1.6')}>{v.overlapNote}</div>
              )}
              {v.timed && !v.crossNote && !v.overlapNote && <div style={s('height:8px')} />}

              {v.allDayShown && (
                <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px')}>
                  <span style={s('display:flex;flex-direction:column;gap:2px;padding-right:12px')}>
                    <span style={s('font-size:14.5px;color:var(--ink)')}>何日間</span>
                    {!!v.spanRangeLabel && <span style={s('font-size:11px;font-weight:600;color:#1D9E75;font-variant-numeric:tabular-nums')}>{v.spanRangeLabel}</span>}
                  </span>
                  <span style={s('display:flex;align-items:center;gap:12px')}>
                    <span role="button" aria-label="1日減らす" style={s(v.spanMinusStyle)} onClick={v.onSpanMinus}>−</span>
                    <span style={s('font-size:15px;font-weight:400;color:var(--ink);min-width:52px;text-align:center;font-variant-numeric:tabular-nums')}>{v.spanCountLabel}</span>
                    <span role="button" aria-label="1日増やす" style={s(v.spanPlusStyle)} onClick={v.onSpanPlus}>＋</span>
                  </span>
                </div>
              )}
            </div>

            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer')} onClick={v.onTapRemindRow}>
                <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0')}>お知らせ</span>
                <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                  <span style={s(v.valRemind)}>{v.remindValue}</span>
                  <span style={s(v.chevRemind)}>›</span>
                </span>
              </div>
              {v.rowRemindOpen && (
                <div style={s('padding:12px 14px 14px;background:var(--bg2)')}>
                  <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
                    {(v.remindSeg || []).map((r, i) => (
                      <div key={i} style={s(r.style)} onClick={r.onClick}>{r.label}</div>
                    ))}
                  </div>
                  {!!v.remindNote && (
                    <div style={s('font-size:11px;color:var(--ink-faint);margin:9px 4px 0;line-height:1.6')}>{v.remindNote}</div>
                  )}
                </div>
              )}
              {/* 職場で画面を見られやすい人のため。ウィジェットでは「予定あり」、通知では時刻だけにする */}
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-top:1px solid var(--line)')}>
                <span style={s('display:flex;flex-direction:column;gap:2px;padding-right:10px')}>
                  <span style={s('font-size:14.5px;color:var(--ink)')}>名前を隠す</span>
                  <span style={s('font-size:11px;color:var(--ink-mut)')}>ウィジェットと通知では「予定あり」とだけ出します</span>
                </span>
                <div style={s(v.secretTrack)} onClick={v.onToggleSecret}><div style={s(v.secretKnob)} /></div>
              </div>
            </div>

            {/* ＋ で足した項目。足した順ではなく、いつも同じ並びで出す
                （足すたびに順が変わると、どこを触ればいいか分からなくなる） */}
            {v.addedAny && (
              <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
                {/* 複数日。日にちの画面から外した「まとめて置く」を、ここに作り直した。
                    選んだ日をもう一度押せば外せるので、押し間違いを直せる。 */}
                {v.multiRowShown && (
                  <div style={s(v.repRowShown || v.linkRowShown || v.placeRowShown || v.memoRowShown ? 'border-bottom:1px solid var(--line)' : '')}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapMultiRow}>複数日</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valMulti)} onClick={v.onTapMultiRow}>{v.multiValue}</span>
                        <span role="button" aria-label="複数日を外す" style={s(v.removeStyle)} onClick={v.onRemoveMulti}>✕</span>
                      </span>
                    </div>
                    {v.rowMultiOpen && (
                      <div style={s('padding:2px 12px 14px;background:var(--bg2)')}>
                        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:6px 2px 8px')}>
                          <span role="button" aria-label="前の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onMultiPrev}>‹</span>
                          <span style={s('font-size:14px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.multiPickLabel}</span>
                          <span role="button" aria-label="次の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onMultiNext}>›</span>
                        </div>
                        <div style={s('display:grid;grid-template-columns:repeat(7,1fr)')}>
                          {(v.multiWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
                        </div>
                        <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:2px')}>
                          {(v.multiCells || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                        </div>
                        <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 2px 2px')}>
                          <span style={s('font-size:11px;color:var(--ink-faint);line-height:1.6')}>{v.multiHint}</span>
                          {v.multiClearShown && (
                            <span style={s('font-size:12px;color:var(--ink-mut);cursor:pointer;white-space:nowrap')} onClick={v.onClearMulti}>ぜんぶ外す</span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* 候補日。まだの予定を何日かに置くときだけ。1つ確定したら残りを片づけられる */}
                    {v.candShown && (
                      <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-top:1px solid var(--line)')}>
                        <span style={s('display:flex;flex-direction:column;gap:2px;padding-right:10px')}>
                          <span style={s('font-size:14.5px;color:var(--ink)')}>どれか1日に決まる（候補日）</span>
                          <span style={s('font-size:11px;color:var(--ink-mut)')}>1つ確定したら、ほかの候補を片づけるか聞きます</span>
                        </span>
                        <div style={s(v.candTrack)} onClick={v.onToggleCand}><div style={s(v.candKnob)} /></div>
                      </div>
                    )}
                  </div>
                )}
                {v.repRowShown && (
                  <div style={s(v.linkRowShown || v.placeRowShown || v.memoRowShown ? 'border-bottom:1px solid var(--line)' : '')}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapRepRow}>くり返し</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valRep)} onClick={v.onTapRepRow}>{v.repValue}</span>
                        <span role="button" aria-label="くり返しを外す" style={s(v.removeStyle)} onClick={v.onRemoveRep}>✕</span>
                      </span>
                    </div>
                    {v.rowRepOpen && (
                      <div style={s('padding:2px 14px 15px;background:var(--bg2)')}>
                        <div style={s('display:flex;flex-wrap:wrap;gap:8px;padding-top:11px')}>
                          {v.repEveryChips.map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                        </div>
                        {v.repNthShown && (
                          <div style={s('display:flex;gap:5px;margin-top:13px')}>
                            {(v.repNthChips || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                          </div>
                        )}
                        {v.repDowShown && (
                          <div style={s('display:flex;gap:5px;margin-top:13px')}>
                            {(v.repDowChips || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                          </div>
                        )}
                        {v.repUntilShown && (<>
                          <div style={s('font-size:12px;color:var(--ink-faint);margin:15px 4px 8px')}>いつまで</div>
                          <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
                            {v.repWeekChips.map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                          </div>
                          <div style={s('font-size:11px;color:var(--ink-faint);margin:11px 4px 0;line-height:1.6')}>{v.repHint}</div>
                        </>)}
                      </div>
                    )}
                  </div>
                )}
                {v.linkRowShown && (
                  <div style={s(v.placeRowShown || v.memoRowShown ? 'border-bottom:1px solid var(--line)' : '')}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapLinkRow}>Web会議・リンク</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valLink)} onClick={v.onTapLinkRow}>{v.linkValue}</span>
                        <span role="button" aria-label="リンクを外す" style={s(v.removeStyle)} onClick={v.onRemoveLink}>✕</span>
                      </span>
                    </div>
                    {v.rowLinkOpen && (
                      <div style={s('padding:2px 14px 14px;background:var(--bg2)')}>
                        <input value={v.linkText} onChange={v.onLinkText} placeholder="https://（Zoom・Teams・Meet など）" inputMode="url" autoCapitalize="off" autoCorrect="off"
                          style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;margin-top:11px;font-size:14.5px;color:var(--ink);font-family:inherit')} />
                        <div style={s('font-size:11px;color:var(--ink-faint);margin:9px 4px 0;line-height:1.6')}>予定を開くと「参加する」ですぐ開けます</div>
                      </div>
                    )}
                  </div>
                )}
                {v.placeRowShown && (
                  <div style={s(v.memoRowShown ? 'border-bottom:1px solid var(--line)' : '')}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapPlaceRow}>場所</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valPlace)} onClick={v.onTapPlaceRow}>{v.placeValue}</span>
                        <span role="button" aria-label="場所を外す" style={s(v.removeStyle)} onClick={v.onRemovePlace}>✕</span>
                      </span>
                    </div>
                    {v.rowPlaceOpen && (
                      <div style={s('padding:2px 14px 14px;background:var(--bg2)')}>
                        <input value={v.placeText} onChange={v.onPlaceText} placeholder={v.placePlaceholder}
                          style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;margin-top:11px;font-size:14.5px;color:var(--ink);font-family:inherit')} />
                        <div style={s('font-size:11px;color:var(--ink-faint);margin:9px 4px 0;line-height:1.6')}>入れておくと、予定を開いたときに地図で開けます</div>
                      </div>
                    )}
                  </div>
                )}
                {v.memoRowShown && (
                  <div>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:14.5px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapMemoRow}>メモ</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valMemo)} onClick={v.onTapMemoRow}>{v.memoValue}</span>
                        <span role="button" aria-label="メモを外す" style={s(v.removeStyle)} onClick={v.onRemoveMemo}>✕</span>
                      </span>
                    </div>
                    {v.rowMemoOpen && (
                      <div style={s('padding:2px 14px 14px;background:var(--bg2)')}>
                        <textarea value={v.memoText} onChange={v.onMemoText} placeholder="持ち物や覚えておきたいこと" rows={4}
                          style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;margin-top:11px;font-size:14.5px;color:var(--ink);font-family:inherit;resize:none;line-height:1.7')} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {v.addRowShown && (
              <div style={s('display:flex;align-items:flex-start;gap:10px;margin:0 2px 18px')}>
                {/* ＋ はチップと同じ高さにする（padding 8px＋行 17px＋枠 1px）。
                    高さを決め打ちにすると、チップの寸法を変えたときに縦がずれる。
                    チップ側を触ったら、ここも合わせること。 */}
                <span style={s('width:26px;flex-shrink:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:8px 0;border:1px solid transparent;font-size:16px;line-height:17px;color:var(--ink-faint)')}>＋</span>
                <div style={s('display:flex;flex-wrap:wrap;gap:8px;flex:1')}>
                  {(v.addChips || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                </div>
              </div>
            )}
            <div style={s('height:70px')} />
          </div>
          {/* 保存は画面の下にも置く。右上だけだと、片手では親指が届かない。
              キーボードが出ているときは、そのすぐ上に来る（画面ごと縮むので） */}
          <div className="save-bar" style={s('position:absolute;left:0;right:0;bottom:0;padding:10px 16px;background:var(--glass);backdrop-filter:blur(14px);border-top:1px solid var(--line);z-index:5')}>
            <div role="button" style={s(`padding:14px;border-radius:15px;text-align:center;font-size:15px;font-weight:700;color:#fff;background:${v.draftColorDeep};cursor:pointer`)} onClick={v.onSave}>保存</div>
          </div>
          {v.discardShown && (
            <div style={s('position:absolute;inset:0;z-index:90;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onDiscardNo}>
              <div style={s('width:100%;max-width:300px;background:var(--card);border-radius:16px;padding:22px 20px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
                <div style={s('font-size:16px;font-weight:400;color:var(--ink);text-align:center')}>書きかけの予定を捨てますか？</div>
                <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:8px 0 18px')}>入れた内容は保存されません。</div>
                <div style={s('display:flex;flex-direction:column;gap:8px')}>
                  <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:15px;font-weight:700;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onDiscardYes}>捨てる</div>
                  <div style={s('padding:12px;text-align:center;font-size:14.5px;color:var(--ink-mut);cursor:pointer')} onClick={v.onDiscardNo}>書きつづける</div>
                </div>
              </div>
            </div>
          )}
          {v.repEditShown && (
            <div style={s('position:absolute;inset:0;z-index:90;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onRepEditCancel}>
              <div style={s('width:100%;max-width:300px;background:var(--card);border-radius:16px;padding:22px 20px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
                <div style={s('font-size:16px;font-weight:400;color:var(--ink);text-align:center')}>くり返しの予定です</div>
                <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:8px 0 18px')}>どこまで変えますか？</div>
                <div style={s('display:flex;flex-direction:column;gap:8px')}>
                  <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:14.5px;font-weight:700;background:var(--ink);color:var(--card);cursor:pointer')} onClick={v.onRepEditOne}>この予定だけ</div>
                  <div style={s('padding:13px;border-radius:15px;text-align:center;font-size:14.5px;background:var(--card);color:var(--ink);border:1px solid var(--line);cursor:pointer')} onClick={v.onRepEditRest}>{v.repEditRest}</div>
                  <div style={s('padding:10px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onRepEditCancel}>やめる</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== SHIFT DETAIL ===================== */}
      {v.detailShown && (
        <div style={s('position:relative;display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          {/* 題は出さない。すぐ下のカードに24pxで出ていて、2回書くことになる。
              右は「···」。編集・コピー・削除はこの中（実績の画面は混んでいるので、
              画面に箱を増やさない） */}
          <div className="scr-head-solo" style={s('display:flex;align-items:center;justify-content:space-between;padding:0 18px 10px 18px')}>
            <span role="button" aria-label="戻る" style={s('font-size:20px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onBack}>←</span>
            <span role="button" aria-label="この予定の操作" style={s('font-size:18px;line-height:1;letter-spacing:2px;color:var(--ink-mut);cursor:pointer;padding:6px 0 6px 12px;user-select:none')} onClick={v.onOpenDetailMenu}>···</span>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:14px 16px 40px 16px')}>
            <div style={s('background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--line);min-height:170px')}>
              <div style={s('padding:20px 20px 22px 22px')}>
                <div style={s('display:flex;align-items:center;gap:10px;margin-bottom:4px')}>
                  <span style={s(v.badgeStyle)}>{v.badgeChar}</span>
                  <span style={s(`font-size:13px;font-weight:400;color:${v.dTypeDark}`)}>{v.dStatusLabel}</span>
                  {!!v.dCandText && <span style={s('font-size:11px;padding:2px 8px;border-radius:999px;border:1px dashed var(--ink-faint);color:var(--ink-mut)')}>{v.dCandText}</span>}
                </div>
                <div style={s('font-size:21px;font-weight:300;color:var(--ink);margin:6px 0 2px 0;letter-spacing:-.3px')}>{v.dTitle}</div>
                <div style={s('font-size:14px;color:var(--ink-mut);margin-bottom:20px')}>
                  {v.dDateText}
                  {!!v.dHolText && <span style={s('margin-left:6px;font-size:12px;color:var(--sun)')}>{v.dHolText}</span>}
                  {!!v.dMovedText && <div style={s('font-size:12px;color:var(--ink-faint);margin-top:3px')}>{v.dMovedText}</div>}
                </div>

                <div style={s('display:flex;align-items:baseline;gap:8px')}>
                  <span style={s('font-size:14.5px;font-weight:400;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.dTimeText}</span>
                  {v.dTimeChanged && (
                    <span style={s('font-size:12px;font-weight:400;color:#D85A30')}>→ 変更あり</span>
                  )}
                </div>
                {!!v.dRemindText && (
                  <div style={s('display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink-mut);margin-top:4px')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M6 10a6 6 0 0 1 12 0c0 3.2.7 5 1.4 6a.6.6 0 0 1-.5.9H5.1a.6.6 0 0 1-.5-.9C5.3 15 6 13.2 6 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M10.2 20.2a2 2 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    {v.dRemindText}
                  </div>
                )}
                {!!v.dWantText && (
                  <div style={s('font-size:12px;color:var(--ink-mut);margin-top:3px')}>{v.dWantText}</div>
                )}

                {!!v.dPlace && (
                  <a href={v.dPlaceHref} target="_blank" rel="noreferrer" style={s('display:flex;align-items:center;gap:8px;margin-top:16px;padding:13px 14px;border-radius:13px;background:var(--bg2);text-decoration:none;-webkit-tap-highlight-color:transparent')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" stroke="var(--ink-mut)" strokeWidth="1.7" strokeLinejoin="round" />
                      <circle cx="12" cy="10" r="2.5" stroke="var(--ink-mut)" strokeWidth="1.7" />
                    </svg>
                    <span style={s('flex:1;font-size:14px;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{v.dPlace}</span>
                    <span style={s('font-size:11px;color:var(--ink-mut);flex-shrink:0')}>地図</span>
                  </a>
                )}
                {/* Web 会議のリンク。いちばん押すものなので大きく */}
                {!!v.dLink && (
                  <a href={v.dLink} target="_blank" rel="noreferrer" style={s('display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;padding:13px 14px;border-radius:13px;background:var(--ink);color:var(--card);text-decoration:none;font-size:14.5px;font-weight:700;-webkit-tap-highlight-color:transparent')}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="M16 10.5 21 8v8l-5-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                    {v.dLinkLabel}
                  </a>
                )}
                {!!v.dMemo && (
                  <div style={s('margin-top:10px;padding:12px 14px;border-radius:13px;background:var(--bg2);font-size:14px;color:var(--ink-soft);line-height:1.9;white-space:pre-wrap;text-align:justify;word-break:break-word')}>
                    {(v.dMemoParts || []).map((p, i) => (p.href
                      ? <a key={i} href={p.href} target="_blank" rel="noreferrer" style={s('color:#3D6E9C;text-decoration:underline')}>{p.t}</a>
                      : <span key={i}>{p.t}</span>))}
                  </div>
                )}

                {v.dWageShown && (
                  <div style={s('margin-top:22px;padding-top:18px;border-top:1px solid var(--line);animation:riseUp .32s cubic-bezier(.2,.9,.2,1)')}>
                    <div style={s('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px')}>
                      <span style={s('font-size:13px;color:var(--ink-mut)')}>実働時間</span>
                      <span style={s('font-size:14.5px;font-weight:400;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.dWorkHours}</span>
                    </div>
                    {!!v.dBreakText && (
                      <div style={s('font-size:11px;color:var(--ink-faint);margin:-4px 0 10px;text-align:right')}>{v.dBreakText}</div>
                    )}
                    <div style={s('display:flex;justify-content:space-between;align-items:baseline')}>
                      <span style={s('font-size:13px;color:var(--ink-mut)')}>給料</span>
                      <span style={s('font-size:21px;font-weight:300;color:var(--ink);letter-spacing:-.3px;font-variant-numeric:tabular-nums')}>{v.dWage}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!!v.dPrimaryLabel && (
              <div style={s(v.dPrimaryStyle)} onClick={v.dPrimaryAction}>{v.dPrimaryLabel}</div>
            )}

            {/* その日の、ほかの予定。この予定だけ見ても、その日が決まっているかは
                分からない。ピルは月表示と同じ（塗り＝確定・点線＝まだ） */}
            <div style={s('margin-top:30px;padding:0 2px 8px;font-size:12px;color:var(--ink-mut)')}>{v.dOthersLabel}</div>
            <div style={s('background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden')}>
              {(v.dOthers || []).length ? (v.dOthers || []).map((o, i) => (
                <div key={i} style={s(o.rowStyle)} onClick={o.onClick}
                     onPointerDown={o.onDown} onPointerUp={o.onUp}
                     onPointerCancel={o.onUp} onPointerLeave={o.onUp}>
                  <span style={s('width:38px;flex-shrink:0;font-size:12px;color:var(--ink-faint);font-variant-numeric:tabular-nums')}>{o.when}</span>
                  <span style={s(o.pillStyle)}>{o.title}</span>
                </div>
              )) : (
                <div style={s('padding:18px;text-align:center;font-size:14px;color:var(--ink-mut)')}>この日は、これだけです</div>
              )}
              {!!v.dOthersRest && (
                <div style={s('padding:10px 16px 12px;border-top:1px solid var(--line-faint);font-size:12px;color:var(--ink-faint)')}>ほか {v.dOthersRest}件</div>
              )}
            </div>

            {/* これまでの「◯◯」。同じ種類・同じ題名のものを数える */}
            <div style={s('margin-top:26px;padding:0 2px 8px;font-size:12px;color:var(--ink-mut)')}>{v.dHistLabel}</div>
            <div style={s('background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden')}>
              {v.dHist ? (
                <>
                  <div style={s('display:flex;gap:18px;padding:14px 16px 12px;font-size:14.5px')}>
                    <span style={s('color:var(--ink)')}>{v.dHist.year}</span>
                    <span style={s('color:var(--ink-soft)')}>{v.dHist.month}</span>
                  </div>
                  <div style={s('display:flex;align-items:baseline;gap:10px;padding:12px 16px 14px;border-top:1px solid var(--line-faint)')}>
                    <span style={s('font-size:13px;color:var(--ink-mut)')}>前回</span>
                    <span style={s('flex:1;font-size:13px;color:var(--ink)')}>{v.dHist.prev}</span>
                    <span style={s('font-size:12px;color:var(--ink-faint)')}>{v.dHist.ago}</span>
                  </div>
                </>
              ) : (
                <div style={s('padding:18px;text-align:center;font-size:14px;color:var(--ink-mut)')}>これが、はじめてです</div>
              )}
            </div>
          </div>

          {/* 「···」の中身。外を触れば閉じる */}
          {v.detailMenuShown && (
            <div style={s('position:absolute;inset:0;z-index:89;background:rgba(20,20,22,.10);animation:scrimIn .16s ease')} onClick={v.onCloseDetailMenu}>
              <div style={s(v.menuStyle)} onClick={v.stop}>
                {(v.menuRows || []).map((m, i) => (
                  <div key={i} style={s(m.style)} onClick={m.onClick}
                       onPointerDown={m.onDown} onPointerUp={m.onUp}
                       onPointerCancel={m.onUp} onPointerLeave={m.onUp}>{m.label}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== 年月をえらぶ（月表示） ===================== */}
      {v.ymSheetShown && (
        <div style={s('position:absolute;inset:0;z-index:88;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onYmSheetClose}>
          <div style={s('width:100%;max-width:320px;background:var(--bg);border-radius:20px;padding:18px 18px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            <div style={s('display:flex;align-items:center;justify-content:center;gap:22px;padding:2px 0 16px')}>
              <span role="button" aria-label="前の年" style={s('width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:19px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYmSheetPrevYear}>‹</span>
              <span style={s('font-size:18px;font-weight:300;color:var(--ink);font-variant-numeric:tabular-nums;min-width:72px;text-align:center')}>{v.ymSheetYear}</span>
              <span role="button" aria-label="次の年" style={s('width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:19px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYmSheetNextYear}>›</span>
            </div>
            {/* 横に払っても年が変わる。‹ › だけだと的が小さい */}
            <div
              key={v.ymSheetGridKey}
              style={s(v.ymSheetGridStyle)}
              onTouchStart={v.onYmSheetTouchStart}
              onTouchMove={v.onYmSheetTouchMove}
              onTouchEnd={v.onYmSheetTouchEnd}
            >
              {(v.ymSheetMonths || []).map((mo, i) => (
                <div key={i} style={s(mo.style)} onClick={mo.onClick}>{mo.label}</div>
              ))}
            </div>
            <div style={s('padding:14px 0 4px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onYmSheetToday}>{v.ymSheetTodayLabel}</div>
          </div>
        </div>
      )}

      {/* ===================== 削除の確認 ===================== */}
      {v.confirmShown && (
        <div style={s('position:absolute;inset:0;z-index:90;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onCancelDelete}>
          <div style={s('width:100%;max-width:300px;background:var(--card);border-radius:16px;padding:22px 20px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            <div style={s('font-size:16px;font-weight:400;color:var(--ink);text-align:center;letter-spacing:-.3px;text-wrap:balance')}>{v.confirmTitle}</div>
            <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:8px 0 20px;text-wrap:pretty')}>{v.confirmBody}</div>
            {v.repDeleteShown && (
              <div style={s('display:flex;align-items:center;gap:10px;padding:12px 13px;margin-bottom:14px;border-radius:13px;background:var(--bg2);cursor:pointer')} onClick={v.onToggleRepDelete}>
                <span style={s(v.repDeleteBox)}>{v.repDeleteOn ? '✓' : ''}</span>
                <span style={s('font-size:13px;color:var(--ink-soft);line-height:1.5')}>{v.repDeleteLabel}</span>
              </div>
            )}
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:15px;font-weight:700;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onConfirmDelete}>{v.confirmOkLabel}</div>
              <div style={s('padding:12px;text-align:center;font-size:14.5px;color:var(--ink-mut);cursor:pointer')} onClick={v.onCancelDelete}>やめる</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CENTER DIALOG ===================== */}
      {v.dialogShown && (
        <div style={s('position:absolute;inset:0;z-index:80;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onDlgDismiss}>
          <div style={s('width:100%;max-width:320px;background:var(--card);border-radius:16px;padding:22px 20px 18px 20px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            {v.dlgMoving ? (
              <>
                <div style={s('font-size:17px;font-weight:400;color:var(--ink);text-align:center;letter-spacing:-.3px')}>{v.dlgMoveTitle}</div>
                <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:6px 0 12px 0')}>{v.dlgSub}</div>
                <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 2px 6px')}>
                  <span role="button" aria-label="前の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onDlgMovePrev}>‹</span>
                  <span style={s('font-size:14px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.dlgMoveLabel}</span>
                  <span role="button" aria-label="次の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onDlgMoveNext}>›</span>
                </div>
                <div style={s('display:grid;grid-template-columns:repeat(7,1fr)')}>
                  {(v.dlgMoveWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
                </div>
                <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:2px')}>
                  {(v.dlgMoveCells || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                </div>
                <div style={s('font-size:12px;color:var(--ink-mut);text-align:center;margin:10px 0 12px')}>{v.dlgMoveChosenText}</div>
                <div style={s('display:flex;flex-direction:column;gap:8px')}>
                  <div style={s(`padding:13px;border-radius:13px;text-align:center;font-size:14.5px;font-weight:700;cursor:pointer;${v.dlgMoveChosen ? 'background:var(--ink);color:var(--card)' : 'background:var(--bg2);color:var(--ink-faint);pointer-events:none'}`)} onClick={v.onDlgMoveFix}>この日で決まった</div>
                  <div style={s(`padding:12px;border-radius:13px;text-align:center;font-size:14px;cursor:pointer;border:1px solid var(--line);${v.dlgMoveChosen ? 'color:var(--ink)' : 'color:var(--ink-faint);pointer-events:none'}`)} onClick={v.onDlgMoveKeep}>この日に、まだ仮で置く</div>
                  <div style={s('padding:10px;text-align:center;font-size:13px;color:var(--ink-mut);cursor:pointer')} onClick={v.onDlgMoveSomeday}>日にちはまだ決めない（今月のどこか）</div>
                  <div style={s('padding:6px;text-align:center;font-size:13px;color:var(--ink-faint);cursor:pointer')} onClick={v.onDlgMoveBack}>もどる</div>
                </div>
              </>
            ) : (<>
            <div style={s('font-size:17px;font-weight:400;color:var(--ink);text-align:center;letter-spacing:-.3px;text-wrap:balance')}>{v.dlgHeading}</div>
            <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:6px 0 18px 0')}>{v.dlgSub}</div>

            <div style={s('background:var(--bg2);border-radius:15px;overflow:hidden;margin-bottom:6px')}>
              {(v.dlgTimeRows || []).map((r, i) => (
                <div key={i} style={s(r.rowStyle)}>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:13px 14px;cursor:pointer')} onClick={r.onTap}>
                    <span style={s('font-size:14px;color:var(--ink)')}>{r.label}</span>
                    <span style={s(r.valStyle)}>{r.value}</span>
                  </div>
                  {r.open && (
                    <div style={s('position:relative;display:flex;align-items:center;justify-content:center;gap:4px;height:150px;background:var(--bg2)')}>
                      <div style={s('position:absolute;top:58px;left:60px;right:60px;height:34px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);pointer-events:none')} />
                      <div style={s(v.dlgWheelColStyle)} onScroll={r.hScroll} ref={r.hRef}>
                        {(r.hItems || []).map((it, j) => (<div key={j} style={s(v.wheelItemStyle)}>{it}</div>))}
                      </div>
                      <span style={s('font-size:17px;font-weight:400;color:var(--ink)')}>:</span>
                      <div style={s(v.dlgWheelColStyle)} onScroll={r.mScroll} ref={r.mRef}>
                        {(r.mItems || []).map((it, j) => (<div key={j} style={s(v.wheelItemStyle)}>{it}</div>))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 休憩を引かないと、休憩が時給に入らない勤務先では金額が多めに出る。
                引いた結果の実働時間をその場に出して、何が起きたか見えるようにする。 */}
            {v.dlgBreakShown && (
              <div style={s('background:var(--bg2);border-radius:15px;padding:11px 14px 13px;margin-top:6px')}>
                <div style={s('font-size:13px;color:var(--ink);margin-bottom:9px')}>休憩</div>
                <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>
                  {(v.dlgBreakChips || []).map((c, i) => (
                    <div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>
                  ))}
                </div>
                <div style={s('font-size:11px;color:var(--ink-mut);margin-top:10px;font-variant-numeric:tabular-nums')}>{v.dlgPaidText}</div>
              </div>
            )}

            <div style={s('text-align:center;margin-bottom:18px;height:16px')}>
              {v.dlgChanged && (
                <span style={s('font-size:12px;color:var(--ink-mut)')}>{v.dlgOrigText} <span style={s('color:#D85A30;font-weight:400')}>→ 変更あり</span></span>
              )}
            </div>

            <div style={s('display:flex;flex-direction:column;gap:9px')}>
              <div style={s(v.dlgPrimaryStyle)} onClick={v.onDlgPrimary}>{v.dlgPrimaryLabel}</div>
              <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:15px;font-weight:600;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onDlgNakunatta}>{v.dlgGoneLabel}</div>
              {v.dlgMoveShown && (
                <div style={s('padding:13px;border-radius:15px;text-align:center;font-size:14.5px;font-weight:600;background:var(--card);color:var(--ink);border:1px solid var(--line);cursor:pointer')} onClick={v.onDlgMove}>別の日になった</div>
              )}
              <div style={s('padding:12px;text-align:center;font-size:14.5px;color:var(--ink-mut);cursor:pointer')} onClick={v.onDlgStillMaybe}>{v.dlgMaybeLabel}</div>
            </div>

            <div style={s('margin-top:6px;padding-top:12px;border-top:1px solid var(--line);text-align:center')}>
              <span style={s('font-size:13px;color:var(--ink-faint);cursor:pointer')} onClick={v.onDlgEdit}>{v.dlgEditLabel}</span>
            </div>
            </>)}
          </div>
        </div>
      )}

      {/* ===================== 候補日の片づけ =====================
          候補を並べて1つ決めたら、残りの候補も片づけるか聞く。勝手には消さない */}
      {v.candAskShown && (
        <div style={s('position:absolute;inset:0;z-index:91;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')}>
          <div style={s('width:100%;max-width:300px;background:var(--card);border-radius:16px;padding:22px 20px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')}>
            <div style={s('font-size:16px;font-weight:400;color:var(--ink);text-align:center;text-wrap:balance')}>{v.candAskTitle}</div>
            <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:8px 0 18px;text-wrap:pretty')}>{v.candAskBody}</div>
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:15px;font-weight:700;background:var(--ink);color:var(--card);cursor:pointer')} onClick={v.onCandYes}>{v.candAskYes}</div>
              <div style={s('padding:12px;text-align:center;font-size:14.5px;color:var(--ink-mut);cursor:pointer')} onClick={v.onCandNo}>残しておく</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== 開くときのロック =====================
          確かめ終わるまで、中身の上に紙を1枚かぶせておく */}
      {v.lockedShown && (
        <div style={s('position:absolute;inset:0;z-index:99;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px')}>
          <span style={s('font-size:30px;letter-spacing:-3px')}><span style={s('color:#1D9E75')}>✓</span><span style={s('color:var(--ink-faint)')}>？</span></span>
          <span style={s('font-size:20px;font-weight:300;color:var(--ink);letter-spacing:.1em')}>LUKKO</span>
          <div role="button" style={s('margin-top:10px;padding:13px 26px;border-radius:15px;background:var(--ink);color:var(--card);font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onUnlock}>{v.lockLabel}で開く</div>
        </div>
      )}

      {/* ===================== 取り消しの帯 =====================
          削除・無くなった・確定した のあと5秒だけ出る。押すと元に戻る */}
      {v.undoShown && (
        <div key={v.undoKey} className={v.undoBottom > 30 ? 'undo-nav' : 'undo-solo'} style={s(`position:absolute;left:14px;right:14px;bottom:${v.undoBottom}px;z-index:72;display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-radius:14px;background:var(--ink);color:var(--card);box-shadow:0 10px 30px rgba(0,0,0,.25);animation:capRise .24s ease`)}>
          <span style={s('flex:1;font-size:13px;line-height:1.5;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{v.undoText}</span>
          <span role="button" style={s('font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;padding:4px 2px;color:#8FD3B6')} onClick={v.onUndo}>元に戻す</span>
        </div>
      )}

      {/* ===================== 「決まった」CELEBRATE ===================== */}
      {v.celebShown && (
        <div style={s('position:absolute;inset:0;z-index:85;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;animation:scrimIn .2s ease')}>
          <div style={s('position:relative;display:flex;align-items:center;justify-content:center')}>
            {v.celebOn && <div style={s(v.haloStyle)} />}
            <div style={s(v.heroPillStyle)}>
              <span style={s('position:relative;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex-shrink:0')}>
                <span style={s(v.heroQStyle)}>？</span>
                <span style={s(v.heroCheckStyle)}>✓</span>
              </span>
              <span style={s('white-space:nowrap')}>{v.heroTitle}</span>
            </div>
          </div>
          {v.celebOn && (
            <div style={s('display:flex;flex-direction:column;align-items:center;gap:3px;animation:capRise .34s cubic-bezier(.2,.9,.2,1) both')}>
              <span style={s('font-size:20px;font-weight:700;color:#fff;letter-spacing:.5px')}>{v.celebCaption}</span>
              <span style={s('font-size:13px;color:rgba(255,255,255,.7)')}>{v.celebSub}</span>
            </div>
          )}
        </div>
      )}

      {/* ===================== 今月のまとめ ===================== */}
      {/* ===================== まとめカード（月／年） =====================
          プレビューの中身は sharecard.js が描くものと同じ並びにしてある。
          見て決めたものと、書き出した画像が違っては意味がない。
          地は明色で固定（書き出す PNG に合わせる）。テーマ変数を使うと
          ダークモードで白地に白文字になる。 */}
      {v.summaryShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:#1A1A1A')}>
          <div className="scr-head" style={s('padding:0 18px 8px;flex-shrink:0')}>
            <span style={s('font-size:15px;color:rgba(255,255,255,.65);cursor:pointer')} onClick={v.onSummaryClose}>閉じる</span>
            <span style={s('font-size:14px;font-weight:400;color:rgba(255,255,255,.9)')}>{v.cardTitle}</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:10px 16px 20px')}>
            {/* 実物をそのまま出す。同じ見た目を JSX でもう一度組むと、寸法も文字の
                大きさも実物と比例せず、プレビューでは収まっているのに書き出すと
                余る、という食い違いが起きる（実際に起きた）。 */}
            {v.cardPng
              ? <img src={v.cardPng} alt="" style={s('width:100%;max-width:340px;border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.5);display:block')} />
              : <div style={s('width:100%;max-width:340px;aspect-ratio:1080/680;border-radius:16px;background:rgba(255,255,255,.06)')} />}

            <div style={s('display:flex;gap:10px;width:100%;max-width:340px;margin-top:18px')}>
              <div style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:14px;border-radius:16px;background:var(--card);color:var(--ink);font-size:14.5px;font-weight:600;cursor:pointer')} onClick={v.onShareCard}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                画像にしてシェア
              </div>
            </div>
            <div style={s('margin-top:12px;font-size:11px;color:rgba(255,255,255,.4);line-height:1.8;text-align:center;max-width:340px')}>
              金額は時給と実働から出した目安です。割増や交通費は入っていません。
            </div>
            {v.shareToast && (
              <div style={s('margin-top:10px;font-size:12px;color:rgba(255,255,255,.55)')}>{v.shareToastMsg}</div>
            )}
          </div>
        </div>
      )}

      {/* ===================== 空いてる日シェア ===================== */}
      {v.shareShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:#1A1A1A')}>
          <div className="scr-head" style={s('padding:0 18px 8px;flex-shrink:0')}>
            <span style={s('font-size:15px;color:rgba(255,255,255,.65);cursor:pointer')} onClick={v.onShareClose}>閉じる</span>
            <span style={s('font-size:14px;font-weight:400;color:rgba(255,255,255,.9)')}>空いてる日をシェア</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:6px 16px 24px')}>
            {/* まとめカードと同じ理由で、地も文字も固定色にする。
                マスの色（#FAECE7 / #EDEEF0）が明色固定なので、地だけテーマに
                従わせると書き出す PNG と食い違ってしまう。 */}
            <div style={s('width:100%;max-width:340px;background:#FFFDF8;border-radius:22px;box-shadow:0 18px 48px rgba(0,0,0,.5);padding:24px 22px 22px;overflow:hidden')}>
              <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:3px')}>
                <span style={s('width:22px;height:22px;border-radius:7px;background:#D85A30;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800')}>○</span>
                <span style={s('font-size:13px;font-weight:400;color:#D85A30')}>{v.shareLead}</span>
              </div>
              <div style={s('font-size:22px;font-weight:300;color:#26251F;letter-spacing:-.5px')}>{v.shareTitle}</div>
              <div style={s('font-size:13px;color:#8C887C;margin:2px 0 18px')}>予定の中身は出していません</div>

              <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:4px')}>
                {(v.shareWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
              </div>
              <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:5px')}>
                {(v.shareCells || []).map((c, i) => (<div key={i} style={s(c.style)}>{c.label}{!!c.note && <span style={s('font-size:8px;font-weight:600;color:#D85A30')}>{c.note}</span>}</div>))}
              </div>

              <div style={s('display:flex;align-items:center;gap:12px;margin-top:18px;padding-top:16px;border-top:1px solid #E6E2D6;flex-wrap:wrap')}>
                <div style={s('display:flex;align-items:center;gap:6px')}>
                  <span style={s('width:16px;height:16px;border-radius:5px;background:#FAECE7;border:1.5px solid #D85A30')} />
                  <span style={s('font-size:12px;color:#55524A')}>{(v.shareLegend || [])[0]}</span>
                </div>
                <div style={s('display:flex;align-items:center;gap:6px')}>
                  <span style={s('width:16px;height:16px;border-radius:5px;background:#FFFDF8;border:1.5px dashed #D85A30')} />
                  <span style={s('font-size:12px;color:#55524A')}>{(v.shareLegend || [])[1]}</span>
                </div>
                <div style={s('display:flex;align-items:center;gap:6px')}>
                  <span style={s('width:16px;height:16px;border-radius:5px;background:#EDEEF0')} />
                  <span style={s('font-size:12px;color:#55524A')}>{(v.shareLegend || [])[2]}</span>
                </div>
              </div>
            </div>

            <div style={s('width:100%;max-width:340px;margin-top:14px;font-size:12px;color:rgba(255,255,255,.5);text-align:center;text-wrap:pretty')}>埋まっている日は灰色のマスだけ。何の予定かは相手に伝わりません。</div>

            {/* 送り方。範囲・平日休日・言い回し。社会人の日程調整は文字でやりとりするのが普通なので、文字でもコピーできる */}
            <div style={s('width:100%;max-width:340px;margin-top:18px;display:flex;flex-direction:column;gap:10px')}>
              <div style={s('display:flex;gap:6px;flex-wrap:wrap')}>{(v.shareRangeChips || []).map((c, i) => (<span key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}</div>
              <div style={s('display:flex;gap:6px;flex-wrap:wrap')}>
                {(v.shareOnlyChips || []).map((c, i) => (<span key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}
                <span style={s('width:8px')} />
                {(v.shareToneChips || []).map((c, i) => (<span key={'t' + i} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}
              </div>
              <input value={v.shareName} onChange={v.onShareName} placeholder="名前を入れる（例：山田）" maxLength={16}
                style={s('width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.18);outline:none;background:rgba(255,255,255,.06);border-radius:12px;padding:10px 12px;font-size:14px;color:#fff;font-family:inherit')} />
              <div style={s('white-space:pre-wrap;font-size:12.5px;line-height:1.75;color:rgba(255,255,255,.85);background:rgba(255,255,255,.06);border-radius:12px;padding:12px 14px;max-height:160px;overflow-y:auto')}>{v.shareText}</div>
              <div style={s('display:flex;align-items:center;gap:10px;cursor:pointer')} onClick={v.onToggleShareSign}>
                <span style={s(`width:18px;height:18px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;${v.shareSign ? 'background:#fff;color:#1A1A1A' : 'border:1.5px solid rgba(255,255,255,.35)'}`)}>{v.shareSign ? '✓' : ''}</span>
                <span style={s('font-size:12px;color:rgba(255,255,255,.6)')}>画像の下に「LUKKO で作成」の一言を入れる</span>
              </div>
            </div>

            <div style={s('display:flex;gap:10px;width:100%;max-width:340px;margin-top:16px')}>
              <div style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:14px;border-radius:16px;background:rgba(255,255,255,.1);color:#fff;font-size:14.5px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.2)')} onClick={v.onCopyFreeText}>文字でコピー</div>
              <div style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:14px;border-radius:16px;background:var(--card);color:var(--ink);font-size:14.5px;font-weight:700;cursor:pointer')} onClick={v.onShareCard}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                画像で送る
              </div>
            </div>
            {v.shareToast && (
              <div style={s('margin-top:12px;font-size:12px;color:rgba(255,255,255,.55)')}>{v.shareToastMsg}</div>
            )}
          </div>
        </div>
      )}

      {v.settingsShown && <Settings v={v} />}

      {/* ===================== まとめ（働いた時間） ===================== */}
      {v.reportShown && <Report v={v} />}

      {/* ===================== サポーターカード =====================
          金ぴかにはしない。生成りの紙に真鍮の箔を押したもの、という見立て。
          光は斜めにゆっくり流れるだけで、点滅させない。
          通し番号と「いま◯人の1人です」は出せない——全員を数える場所が要り、
          このアプリはサーバーを持たないため。 */}
      {v.cardShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px')}>
            <span role="button" aria-label="戻る" style={s('font-size:22px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onCardBack}>←</span>
            <span style={s('font-size:16px;font-weight:400;color:var(--ink)')}>サポーターカード</span>
            <span />
          </div>

          <div style={s('flex:1;overflow-y:auto;padding:18px 20px 40px')}>
            {/* カード本体。押すと裏返る。指でなぞれば、なぞった分だけその場で回る */}
            <div style={s('perspective:1000px;animation:cardIn .5s cubic-bezier(.2,.9,.2,1) both')}>
              <div style={s(v.cardFlipStyle)} onClick={v.onFlipCard}
                onTouchStart={v.onCardTouchStart}
                onTouchMove={v.onCardTouchMove}
                onTouchEnd={v.onCardTouchEnd}
                onTouchCancel={v.onCardTouchEnd}>

                {/* 表 */}
                <div style={s(v.cardFaceStyle)}>
                  <div style={s(v.foilStyle)} />
                  <div style={s(v.glintStyle)} />
                  {(v.cardFlecks || []).map((f) => <div key={f.key} style={s(f.style)} />)}
                  <div style={s('position:relative;z-index:1;display:flex;flex-direction:column;height:100%;justify-content:space-between')}>
                    <div style={s('display:flex;align-items:flex-start;justify-content:space-between')}>
                      <span style={s('display:flex;flex-direction:column;gap:3px')}>
                        <span style={s(v.foilTextStyle)}>LUKKO</span>
                        <span style={s(v.foilSmallStyle)}>SUPPORTER</span>
                      </span>
                      <span style={s('font-size:17px;letter-spacing:-2px;flex-shrink:0')}>
                        <span style={s('color:#1D9E75')}>✓</span><span style={s({ color: v.cardMarkColor })}>？</span>
                      </span>
                    </div>
                    <div style={s('display:flex;align-items:flex-end;justify-content:space-between;gap:12px')}>
                      <span style={s('display:flex;flex-direction:column;gap:5px;min-width:0')}>
                        <span style={s(v.cardNameStyle)}>{v.cardOwnerShown}</span>
                        <span style={s(v.foilSmallStyle)}>{v.cardSince}</span>
                      </span>
                      <span style={s('display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0')}>
                        <span style={s(v.cardTotalStyle)}>{v.cardTotal}</span>
                        <span style={s(v.foilSmallStyle)}>{v.cardTimes}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 裏：1回ずつの記録 */}
                <div style={s(v.cardBackStyle)}>
                  <div style={s('position:relative;z-index:1;height:100%;display:flex;flex-direction:column')}>
                    <span style={s({ ...v.foilSmallStyle, marginBottom: 10 })}>RECORD</span>
                    <div style={s('flex:1;overflow-y:auto')}>
                      {(v.cardHistory || []).map((h, i) => (
                        <div key={i} style={s('display:flex;align-items:center;justify-content:space-between;padding:5px 0')}>
                          <span style={s(v.foilSmallStyle)}>{h.when}</span>
                          <span style={s(v.cardHistYenStyle)}>{h.yen}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div style={s('display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px')}>
              <span style={s('font-size:11.5px;font-weight:700;color:var(--ink-soft)')}>{v.cardTierName}カード</span>
              <span style={s('font-size:11.5px;color:var(--ink-mut)')}>指でなぞると回せます</span>
            </div>
            <div style={s('text-align:center;font-size:12px;color:var(--ink-soft);margin-top:16px;line-height:1.7')}>{v.cardNextText}</div>

            <div style={s('text-align:center;font-size:16px;font-weight:400;color:var(--ink);margin-top:26px')}>支えてくれて、ありがとう。</div>
            <div style={s('text-align:center;font-size:12.5px;color:var(--ink-soft);line-height:1.9;margin-top:8px;text-wrap:pretty')}>
              {''}<Jp parts={['広告なし・通信なしのままで','作りつづけます。']} />
            </div>

            {/* 名前はカードに載るだけ。端末の外には出ない */}
            <div style={s('margin-top:24px')}>
              <div style={s('font-size:12px;font-weight:400;color:var(--ink-mut);margin:0 6px 8px')}>カードに載せる名前</div>
              <input value={v.cardOwner} onChange={v.onCardName} placeholder="空のままでもかまいません" maxLength={20}
                style={s('width:100%;box-sizing:border-box;border:1px solid var(--line);outline:none;background:var(--card);border-radius:13px;padding:12px 14px;font-size:15px;color:var(--ink);font-family:inherit')} />
              <div style={s('font-size:11px;color:var(--ink-faint);margin:8px 6px 0;line-height:1.7')}>この名前も端末の中だけに保存されます。</div>
            </div>

            <div style={s('display:flex;align-items:center;justify-content:center;gap:7px;margin-top:22px;padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--line);color:var(--ink);font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onShareCardImage}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              カードをシェア
            </div>
          </div>
        </div>
      )}

      {/* ===================== 課金の診断（開発用） =====================
          うまくいかないとき、画面には何も出ない作りにしてある。
          そのままだと原因が誰にも見えないので、ここだけは全部見せる。 */}
      {v.probeShown && (
        <div style={s('position:absolute;inset:0;z-index:97;background:rgba(20,20,22,.5);display:flex;align-items:center;justify-content:center;padding:20px;animation:scrimIn .2s ease')} onClick={v.onProbeClose}>
          <div style={s('width:100%;max-width:340px;max-height:80%;overflow-y:auto;background:var(--card);border-radius:18px;padding:18px;animation:dlgIn .25s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            <div style={s('font-size:14.5px;font-weight:400;color:var(--ink);margin-bottom:12px')}>課金の状態</div>
            {(v.probeRows || []).map((r, i) => (
              <div key={i} style={s('margin-bottom:10px')}>
                {!!r.k && <div style={s('font-size:11px;color:var(--ink-mut);margin-bottom:2px')}>{r.k}</div>}
                <div style={s('font-size:12.5px;color:var(--ink);line-height:1.6;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,monospace')}>{r.val}</div>
              </div>
            ))}
            <div style={s('display:flex;gap:8px;margin-top:14px')}>
              <div style={s('flex:1;text-align:center;padding:11px;border-radius:12px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:400;cursor:pointer')} onClick={v.onSendWidget}>ウィジェットに送る</div>
            </div>
            <div style={s('display:flex;gap:8px;margin-top:8px')}>
              <div style={s('flex:1;text-align:center;padding:11px;border-radius:12px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:400;cursor:pointer')} onClick={v.onProbeRetry}>もう一度読む</div>
              <div style={s('flex:1;text-align:center;padding:11px;border-radius:12px;background:var(--ink);color:var(--card);font-size:14px;font-weight:700;cursor:pointer')} onClick={v.onProbeClose}>閉じる</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== 保存についての知らせ =====================
          予定が消えることは、機能がひとつ動かないのとは重さが違う。
          保存できていないことを黙っていると、いちばん悪い形で気づく——
          画面には出ているのに、閉じて開いたら消えている。 */}
      {v.saveFailedShown && (
        <div className="save-warn" style={s('position:absolute;left:14px;right:14px;z-index:96;padding:13px 16px;border-radius:16px;background:#7A2E1C;color:#FFF3EE;box-shadow:0 10px 30px rgba(0,0,0,.3);cursor:pointer;animation:notifDrop .4s cubic-bezier(.2,.9,.2,1)')} onClick={v.onSaveFailedTap}>
          <div style={s('font-size:14px;font-weight:700')}>予定を保存できていません</div>
          <div style={s('font-size:12px;line-height:1.7;margin-top:3px;opacity:.9')}>端末の空き容量を確かめてください。念のため、いま控えを書き出しておくことをおすすめします。</div>
        </div>
      )}
      {v.recoveredShown && (
        <div className="save-warn" style={s('position:absolute;left:14px;right:14px;z-index:96;padding:13px 16px;border-radius:16px;background:var(--ink);color:var(--card);box-shadow:0 10px 30px rgba(0,0,0,.25);cursor:pointer;animation:notifDrop .4s cubic-bezier(.2,.9,.2,1)')} onClick={v.onRecoveredClose}>
          <div style={s('font-size:14px;font-weight:700')}>{v.recoveredText}</div>
          <div style={s('font-size:12px;line-height:1.7;margin-top:3px;opacity:.85')}>端末の保存領域が整理されたようです。中身を確かめてください。</div>
        </div>
      )}

      {/* ===================== はじめての案内 ===================== */}
      {v.onboardShown && (
        <div style={s('position:absolute;top:0;right:0;bottom:0;left:0;z-index:95;background:var(--bg);display:flex;flex-direction:column')}>
          <div className="scr-head" style={s('padding:0 18px 4px 18px')}>
            <span style={s(`font-size:15px;color:var(--ink-mut);cursor:pointer;${v.obStep === 0 ? 'visibility:hidden' : ''}`)} onClick={v.onObBack}>←</span>
            <span />
            <span style={s('font-size:14px;color:var(--ink-faint);cursor:pointer;white-space:nowrap')} onClick={v.onObSkip}>スキップ</span>
          </div>

          <div className={v.obFast ? 'ob-fast' : ''} onClick={v.onObFast} style={s('flex:1;overflow-y:auto;padding:12px 26px 20px;display:flex;flex-direction:column')}>

            {/* 0枚目：使い方の1問。答えで種類・呼び名・見本・空き状況の時間帯が決まる */}
            {v.obStep === 0 && (
              <div>
                <div style={s({ ...v.obLineStyle, marginTop: 24 })}>
                  {(v.obQLine1 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s(v.obLineStyle)}>
                  {(v.obQLine2 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s('display:flex;flex-direction:column;gap:9px;margin-top:26px')}>
                  {(v.obProfiles || []).map((p) => (
                    <div key={p.key} style={s(p.style)} onClick={p.onClick}>
                      <span style={s('font-size:16px;color:var(--ink)')}>{p.label}</span>
                      <span style={s('font-size:12px;color:var(--ink-mut)')}>{p.note}</span>
                    </div>
                  ))}
                </div>
                <div style={s('font-size:12px;color:var(--ink-faint);margin-top:14px;line-height:1.8;text-wrap:pretty')}>
                  {''}<Jp parts={['予定の種類や', '呼び方が', 'これに合わせて', '決まります。', 'あとから設定の', '「使い方」で', '変えられます。']} />
                </div>
              </div>
            )}

            {v.obStep === 1 && (
              <div>
                {/* 一字ずつ、薄い墨から本来の濃さへ。遅れは renderVals が決めている */}
                <div style={s({ ...v.obLineStyle, marginTop: 24 })}>
                  {(v.obLine1 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s(v.obLineStyle)}>
                  {(v.obLine2 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>

                <div style={s(v.obPaperStyle)}>
                  <div style={s(v.obDateStyle)}>{v.obDateText}</div>
                  <div style={s(v.obSolidWrap)}>
                    <div style={s(v.obSolidPillStyle)}>{v.obSolidLabel}</div>
                  </div>
                  <div style={s(v.obDashWrap)}>
                    <div style={s(v.obDemoPillStyle)} onClick={v.onObDemoTap}>
                      <span style={s(v.obDemoFillStyle)} />
                      <span style={s(v.obDemoTextStyle)}>{v.obDemoLabel}</span>
                    </div>
                  </div>
                  {/* 本物では、押すとこの問いが出て「確定した」で塗りになる。
                      案内で1回で変えてしまうと、実際に触ったとき一手多く感じる。 */}
                  {v.obAsking && (
                    <div style={s('margin-top:12px;padding:12px 13px 13px;border-radius:13px;background:var(--bg2);animation:capRise .28s cubic-bezier(.2,.9,.2,1) both')}>
                      <div style={s('font-size:13px;font-weight:700;color:var(--ink)')}>{v.obAskHeading}</div>
                      <div style={s(v.obConfirmStyle)} onClick={v.onObDemoConfirm}>確定した</div>
                    </div>
                  )}
                  <div style={s({ fontSize:13, marginTop:14, lineHeight:1.7, fontWeight:400, color:v.obDemoCaptionColor })}>{v.obDemoCaption}</div>
                  {v.obDemoDone && (
                    <div style={s('font-size:12px;color:var(--ink-mut);margin-top:8px;cursor:pointer')} onClick={v.onObDemoReset}>もう一度みる</div>
                  )}
                </div>

                <div style={s(v.obCaptionDelay)}>
                  <div style={s('font-size:13px;color:var(--ink-soft);line-height:2;margin-top:16px')}>
                    {''}<Jp parts={['決まっている予定は', '塗り、', 'まだ分からない予定は', '点線です。']} />
                  </div>
                </div>
              </div>
            )}

            {/* 2枚目：空き状況。記号の説明を並べるより、本物の一覧の形で見せる */}
            {v.obStep === 2 && (
              <div>
                <div style={s({ ...v.obLineStyle, marginTop: 24 })}>
                  {(v.obFreeLine1 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s(v.obLineStyle)}>
                  {(v.obFreeLine2 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>

                <div style={s(v.obFreeCardStyle)}>
                  {(v.obFreeRows || []).map((r, i) => (
                    <div key={i} style={s({ ...r.style, display:'flex', alignItems:'center', gap:13, padding:'11px 0',
                      ...(i ? { borderTop:'1px solid var(--line)' } : {}) })}>
                      <span style={s('display:flex;flex-direction:column;align-items:center;width:26px;flex-shrink:0')}>
                        <span style={s('font-size:9px;color:var(--ink-faint);line-height:1.3')}>{r.dow}</span>
                        <span style={s('font-size:16px;font-weight:400;color:var(--ink);line-height:1.2;font-variant-numeric:tabular-nums')}>{r.day}</span>
                      </span>
                      <span style={s('flex:1;font-size:12.5px;color:var(--ink-soft);min-width:0')}>{r.note}</span>
                      <span style={s({ fontSize:19, fontWeight:400, color:r.color, flexShrink:0 })}>{r.mark}</span>
                    </div>
                  ))}
                </div>
                <div style={s(v.obFreeNote)}>
                  <div style={s('font-size:13px;color:var(--ink-soft);line-height:2;margin-top:16px')}>
                    {''}<Jp parts={['予定を入れておくだけで、', 'その日が', '空いているかどうかが', '出ます。']} />
                  </div>
                </div>
              </div>
            )}

            {/* 3枚目：シェア。送られる画像そのものを見せる */}
            {v.obStep === 3 && (
              <div>
                <div style={s({ ...v.obLineStyle, marginTop: 24 })}>
                  {(v.obShareLine1 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s(v.obLineStyle)}>
                  {(v.obShareLine2 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>

                <div style={s(v.obShareCardStyle)}>
                  <div style={s('font-size:12px;font-weight:700;color:#D85A30;margin-bottom:9px')}>わたしの空いてる日</div>
                  <div style={s('display:grid;grid-template-columns:repeat(7,1fr)')}>
                    {(v.obShareWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
                  </div>
                  <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:5px')}>
                    {(v.obShareCells || []).map((c, i) => (<div key={i} style={s(c.style)}>{c.label}</div>))}
                  </div>
                  <div style={s('display:flex;align-items:center;gap:14px;margin-top:13px')}>
                    <span style={s('display:flex;align-items:center;gap:6px')}>
                      <span style={s('width:13px;height:13px;border-radius:4px;background:#FAECE7;border:1.5px solid #D85A30')} />
                      <span style={s('font-size:11px;color:#55524A')}>空いてる</span>
                    </span>
                    <span style={s('display:flex;align-items:center;gap:6px')}>
                      <span style={s('width:13px;height:13px;border-radius:4px;background:#EDEEF0')} />
                      <span style={s('font-size:11px;color:#55524A')}>予定あり</span>
                    </span>
                  </div>
                </div>
                <div style={s(v.obShareNote)}>
                  <div style={s('font-size:13px;color:var(--ink-soft);line-height:2;margin-top:16px')}>
                    {''}<Jp parts={['カレンダーごと送ると、', '見せたくない予定まで', '写ってしまいます。', '空いている日だけの', '画像を作れます。']} />
                  </div>
                </div>
              </div>
            )}

            {/* 4枚目：取り込み */}
            {v.obStep === 4 && (
              <div>
                <div style={s({ ...v.obLineStyle, marginTop: 24 })}>
                  {(v.obImpLine1 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s(v.obLineStyle)}>
                  {(v.obImpLine2 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s(v.obImpBodyStyle)}>
                  <div style={s('font-size:14px;color:var(--ink-soft);line-height:2;margin-top:14px')}>
                    {''}<Jp parts={['iPhone のカレンダーから', '読み込めます。', 'はじめから', '作り直さなくて', '済みます。']} />
                  </div>
                </div>
                <div style={s(v.obImpCardStyle)}>
                  <div style={s('font-size:12.5px;color:var(--ink-soft);line-height:1.95')}>
                    {['読むだけです。書き込みはしません', '入れるものは1件ずつ選べます', 'あとから設定でもできます'].map((t, i) => (
                      <div key={i} style={s('display:flex;gap:6px')}><span>・</span><span style={s('flex:1')}>{t}</span></div>
                    ))}
                  </div>
                </div>
                {/* 会社の予定を入れても外に出ない、を最初に言っておく */}
                <div style={s({ ...v.obImpBodyStyle, marginTop: 14, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.9 })}>
                  {''}<Jp parts={['アカウント登録は', '要りません。', '予定はこの iPhone の', '中だけにあり、', 'どこにも送りません。']} />
                </div>
                {/* 毎朝、今日の予定をまとめて知らせる。許可は、ここでオンにした人にだけ後で聞く */}
                <div style={s('display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding:14px 16px;border-radius:16px;background:var(--card);border:1px solid var(--line)')} onClick={v.onObMorning}>
                  <span style={s('display:flex;flex-direction:column;gap:2px')}>
                    <span style={s('font-size:14px;color:var(--ink)')}>毎朝、今日の予定をお知らせ</span>
                    <span style={s('font-size:11px;color:var(--ink-mut)')}>7:30 に「今日3件（うち まだ1件）」のように届きます</span>
                  </span>
                  <div style={s(v.obMorningTrack)}><div style={s(v.obMorningKnob)} /></div>
                </div>
              </div>
            )}

            <div style={s('flex:1')} />

            <div style={s('display:flex;justify-content:center;gap:6px;padding:20px 0 16px')}>
              {(v.obDots || []).map((d, i) => (<span key={i} style={s(d.style)} />))}
            </div>

            {v.obStep === 1 && (
              <div style={s(v.obNextStyle)} onClick={v.onObNext}>{v.obNextLabel}</div>
            )}
            {(v.obStep === 2 || v.obStep === 3) && (
              <div style={s('padding:16px;border-radius:17px;background:var(--ink);color:var(--card);text-align:center;font-size:16px;font-weight:700;cursor:pointer')} onClick={v.onObNext}>つぎへ</div>
            )}
            {v.obStep === 4 && (
              <>
                {v.obCanImport && (
                  <div style={s('padding:16px;border-radius:17px;background:var(--ink);color:var(--card);text-align:center;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:9px')} onClick={v.onObImport}>カレンダーから取り込む</div>
                )}
                <div style={s(`padding:16px;border-radius:17px;text-align:center;font-size:16px;font-weight:700;cursor:pointer;${v.obCanImport ? 'background:var(--card);border:1px solid var(--line);color:var(--ink)' : 'background:var(--ink);color:var(--card)'}`)} onClick={v.onObStart}>
                  {v.obCanImport ? '空のまま はじめる' : 'はじめる'}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===================== 予定の取り込み ===================== */}
      {v.importShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span role="button" aria-label="戻る" style={s('font-size:20px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onImportBack}>←</span>
            <span style={s('font-size:15px;font-weight:400;color:var(--ink);white-space:nowrap')}>予定の取り込み</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:14px 20px 60px')}>

            {v.impPhase === 'done' ? (
              <div style={s('text-align:center;padding:56px 10px')}>
                <div style={s('width:56px;height:56px;border-radius:28px;background:#1D9E75;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;animation:checkPop .5s cubic-bezier(.2,.9,.2,1) both')}>✓</div>
                <div style={s('font-size:17px;font-weight:400;color:var(--ink);margin-top:18px')}>
                  {v.impTidied === 'skip' ? `${v.impAdded}件をまとめから外しました` : v.impTidied === 'delete' ? `${v.impAdded}件を消しました` : `${v.impAdded}件を取り込みました`}
                </div>
                <div style={s('font-size:13px;color:var(--ink-soft);margin-top:8px;line-height:1.9;text-wrap:pretty')}>
                  {v.impTidied === 'skip'
                    ? <Jp parts={['予定はカレンダーに','残っています。','時間には','数えません。']} />
                    : v.impTidied === 'delete'
                      ? <Jp parts={['カレンダーから','消えました。']} />
                      : (v.impDoneDashed || <Jp parts={['決まっている予定は','塗りで置きました。','まだ分からない予定は、','タップして','点線に','変えられます。']} />)}
                </div>
                {!!v.impDoneDetail && !v.impTidied && (
                  <div style={s('font-size:12px;color:var(--ink-mut);margin-top:6px;line-height:1.8;text-wrap:pretty')}>{v.impDoneDetail}</div>
                )}
                {/* 取り込んだ瞬間に案内が消えるので、ここで新しい予定の入れ方を伝える。
                    前は取り込んだあと、追加のしかたがどこにも出ていなかった。 */}
                {!v.impTidied && (
                  <div style={s('margin-top:20px;padding:14px 16px;border-radius:15px;background:var(--bg2);font-size:13px;color:var(--ink-soft);line-height:1.9;text-wrap:pretty')}>
                    {''}<Jp parts={['新しい予定は、','下の ＋ から','入れられます。']} />
                  </div>
                )}
                <div style={s('margin-top:28px;padding:15px;border-radius:16px;background:var(--ink);color:var(--card);font-size:14.5px;font-weight:700;cursor:pointer')} onClick={v.onImportDone}>カレンダーを見る</div>
                {v.impUndoShown && (
                  <div style={s('margin-top:12px;padding:10px;font-size:13px;color:var(--ink-mut);cursor:pointer')} onClick={v.onImportUndo}>取り込む前に戻す</div>
                )}
              </div>
            ) : v.impPhase === 'cals' ? (
              <>
                {/* どのカレンダーを読むか。カレンダーごとに種類も決められる（会社の予定表 → 仕事） */}
                <div style={s('font-size:18px;font-weight:300;color:var(--ink);letter-spacing:-.3px;margin-bottom:6px')}>どのカレンダーを読みますか？</div>
                <div style={s('font-size:13px;color:var(--ink-mut);line-height:1.9;margin-bottom:14px;text-wrap:pretty')}>
                  {''}<Jp parts={['右の札を押すと、', 'そのカレンダーの予定を', '入れる種類を決められます。', '選んだ内容は', '次も使います。']} />
                </div>
                <div style={s('background:var(--card);border-radius:17px;overflow:hidden;border:1px solid var(--line);margin-bottom:14px')}>
                  {(v.impCals || []).map((c, i) => (
                    <div key={c.key} style={s(`display:flex;align-items:center;gap:10px;padding:12px 13px;cursor:pointer;${i ? 'border-top:1px solid var(--line)' : ''};opacity:${c.on ? 1 : .5}`)} onClick={c.onToggle}>
                      <span style={s(`width:20px;height:20px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;background:${c.on ? '#1D9E75' : 'transparent'};border:1.5px solid ${c.on ? '#1D9E75' : 'var(--line)'}`)}>{c.on ? '✓' : ''}</span>
                      <span style={s({ width: 9, height: 9, borderRadius: 5, background: c.color, flexShrink: 0 })} />
                      <span style={s('flex:1;min-width:0;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{c.label}</span>
                      <span style={s(c.typeStyle)} onClick={c.onCycleType}>{c.typeName}</span>
                    </div>
                  ))}
                </div>
                <div style={s('font-size:12px;color:var(--ink-mut);margin:0 4px 8px')}>いつからの予定を読むか</div>
                <div style={s('display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px')}>
                  {(v.impRangeChips || []).map((c, i) => (<span key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</span>))}
                </div>
                <div style={s(`padding:16px;border-radius:17px;text-align:center;font-size:15px;cursor:pointer;${v.impCalsOnCount ? 'background:var(--ink);color:var(--card)' : 'background:var(--bg2);color:var(--ink-mut);pointer-events:none'}`)} onClick={v.onReadCals}>読み込む</div>
                <div style={s('padding:14px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onImportBack}>やめる</div>
              </>
            ) : v.impPhase === 'found' ? (
              <>
                <div style={s('font-size:18px;font-weight:300;color:var(--ink);letter-spacing:-.3px;margin-bottom:6px')}>
                  {v.impNone ? '予定が見つかりませんでした' : `${v.impCount}件の予定が見つかりました`}
                </div>
                <div style={s('font-size:13px;color:var(--ink-mut);line-height:1.9;margin-bottom:16px;text-wrap:pretty')}>
                  {v.impTidy
                    ? <Jp parts={['取り込みで入った、','終日の予定です。','誕生日や祝日らしいものに','印を付けてあります。']} />
                    : v.impFromIcs
                    ? (v.impNone ? <Jp parts={['このファイルに', '読める予定が', 'ありませんでした。']} /> : <Jp parts={['ファイルの中の予定です。', 'もう入っているものは', '除いてあります。']} />)
                    : v.impNone
                      ? <Jp parts={['iPhone のカレンダーに', '読める予定が', 'ありませんでした。']} />
                      : <Jp parts={['1年先までの予定です。', 'もう入っているものは', '除いてあります。', '前に取り込んだ予定が', '元で変わっていたら、', '「変わった」と出ます。']} />}
                </div>
                {/* 1件も無かったときは、ここで手が止まる。ほかのカレンダーの案内を出す */}
                {v.impNone && !v.impFromIcs && <OtherCal v={v} s={s} />}
                {!v.impNone && (
                  <>
                    {/* 前は1件ごとに種類の札が4つ並んでいた。いまは1つだけ。押すと次の種類に変わる */}
                    <div style={s('display:flex;align-items:center;justify-content:space-between;margin:0 4px 8px')}>
                      <span style={s('font-size:12px;color:var(--ink-mut)')}>{v.impTidy ? '押すと選べます' : '右の札を押すと、種類が変わります'}</span>
                      <span style={s('font-size:13px;color:var(--ink-mut);cursor:pointer;white-space:nowrap')} onClick={v.onToggleAll}>
                        {v.impAllOn ? 'すべて外す' : 'すべて選ぶ'}
                      </span>
                    </div>
                    <div style={s('background:var(--card);border-radius:17px;overflow:hidden;border:1px solid var(--line);margin-bottom:14px')}>
                      {(v.impRows || []).map((r) => (
                        <div key={r.key} style={s(r.rowStyle)} onClick={r.onToggle}>
                          <span style={s(r.checkStyle)}>{r.on ? '✓' : ''}</span>
                          <div style={s('flex:1;min-width:0')}>
                            {!!r.kindTag && <div style={s('font-size:10.5px;font-weight:700;color:#B9770F;margin-bottom:2px')}>{r.kindTag}</div>}
                            <div style={s('font-size:11px;color:var(--ink-mut);font-variant-numeric:tabular-nums;white-space:nowrap')}>{r.when}</div>
                            <div style={s('font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px')}>{r.title}</div>
                            {!!r.place && <div style={s('font-size:11px;color:var(--ink-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.place}</div>}
                          </div>
                          {!v.impTidy && <div style={s(r.typeStyle)} onClick={r.onCycleType}>{r.typeName}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {!v.impNone && !v.impTidy && (
                  <div style={s(`margin-top:8px;padding:16px;border-radius:17px;text-align:center;font-size:15px;font-weight:400;cursor:pointer;background:${v.impOnCount === '0' ? 'var(--bg2)' : 'var(--ink)'};color:${v.impOnCount === '0' ? 'var(--ink-mut)' : 'var(--card)'}`)} onClick={v.impOnCount === '0' ? undefined : v.onDoImport}>
                    {v.impOnCount}件を取り込む
                  </div>
                )}
                {/* 整理：外すのが本筋（予定は残る）。消すのは下に小さく、赤で */}
                {!v.impNone && v.impTidy && (
                  <>
                    <div style={s(`margin-top:8px;padding:16px;border-radius:17px;text-align:center;font-size:15px;font-weight:400;cursor:pointer;background:${v.impOnCount === '0' ? 'var(--bg2)' : 'var(--ink)'};color:${v.impOnCount === '0' ? 'var(--ink-mut)' : 'var(--card)'}`)} onClick={v.impOnCount === '0' ? undefined : v.onTidySkip}>
                      {v.impOnCount}件をまとめから外す
                    </div>
                    <div style={s('font-size:11px;color:var(--ink-faint);text-align:center;margin-top:8px')}>予定はカレンダーに残ります</div>
                    <div style={s(`margin-top:14px;padding:12px;text-align:center;font-size:14px;cursor:pointer;color:${v.impOnCount === '0' ? 'var(--ink-faint)' : '#A8452B'}`)} onClick={v.impOnCount === '0' ? undefined : v.onTidyDelete}>
                      {v.impOnCount}件をカレンダーから消す
                    </div>
                  </>
                )}
                <div style={s('padding:14px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onImportBack}>やめる</div>
                {!v.impNone && !v.impTidy && (
                  <div style={s('margin-top:10px')}>
                    <Fold title="まとめて種類を変える" open={v.impBulkOpen} onToggle={v.onToggleBulk}>
                      <div style={s('display:flex;gap:6px;flex-wrap:wrap;margin-top:2px')}>
                        {(v.impBulkChips || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                      </div>
                      <div style={s('margin-top:10px;font-size:12px;color:var(--ink-mut)')}>選んでいるものが、まとめてその種類になります。</div>
                    </Fold>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={s('font-size:18px;font-weight:300;color:var(--ink);letter-spacing:-.3px;margin-bottom:4px;line-height:1.55')}>
                  {''}<Jp parts={['いま使っている', 'カレンダーの', '予定を', '持ってくる']} />
                </div>
                {/* 絵1枚と2行。前はここに3段落＋箱2つがあって、読む気が失せると言われた */}
                <ImportPic />
                <div style={s('font-size:14px;color:var(--ink);line-height:1.9')}>
                  {''}<Jp parts={['iPhone のカレンダーから読んで、', 'ここに並べます。']} />
                </div>

                {!!v.impError && (
                  <div style={s('margin-top:18px')}>
                    <div style={s('font-size:13px;color:#A8452B;line-height:1.9;text-wrap:pretty')}>{v.impError}</div>
                    {v.impDenied && (
                      <div style={s('margin-top:14px;padding:14px;border-radius:17px;border:1px solid var(--line);background:var(--card);text-align:center;font-size:14.5px;font-weight:700;color:var(--ink);cursor:pointer')} onClick={v.onOpenSettingsApp}>
                        設定アプリを開く
                      </div>
                    )}
                  </div>
                )}

                {/* この画面は、もう許可を聞かれた人（許可した・断った）にだけ出る。
                    まだの人は、開いた時点で iPhone の許可の画面を出す（App.jsx の _askImportNow）。
                    1.3（110）で 5.1.1(iv)：許可の前の独自の説明に「やめる」があり、許可を聞かずに閉じられた。
                    ボタンは「続ける」（許可した先の動きを書かない。v1.0 での指摘）。 */}
                <div style={s(`margin-top:22px;padding:16px;border-radius:17px;text-align:center;font-size:15px;font-weight:400;cursor:pointer;background:${v.impPhase === 'scanning' ? 'var(--bg2)' : 'var(--ink)'};color:${v.impPhase === 'scanning' ? 'var(--ink-mut)' : 'var(--card)'}`)} onClick={v.impPhase === 'scanning' ? undefined : v.onScan}>
                  {v.impPhase === 'scanning' ? '読み込んでいます…' : '続ける'}
                </div>
                <div style={s('padding:14px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onImportBack}>やめる</div>

                {/* ここから下は、要る人だけが開く。
                    許可の話は**事実だけ**にする。どちらを選べとは書かない。
                    App Store の 5.1.1(iv) は「許可するように促す・仕向ける」ことを
                    禁じている。緑で目立たせて「選んでください」と書いていたのは、
                    まさにそれだった（v1.0(49) でリジェクト）。 */}
                <div style={s('margin-top:10px;display:flex;flex-direction:column;gap:10px')}>
                  <Fold title="次に iPhone が聞くこと" open={v.impAskOpen} onToggle={v.onToggleAsk}>
                    {''}<Jp parts={['「追加のみ」と', '「フルアクセス」の', '2つを聞かれます。', 'このアプリが予定を', '読めるのは', '「フルアクセス」のときです。']} />
                  </Fold>
                  <OtherCal v={v} s={s} />
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ===================== 規約・プライバシーポリシー ===================== */}
      {v.docShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span role="button" aria-label="戻る" style={s('font-size:20px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onDocBack}>←</span>
            <span style={s('font-size:15px;font-weight:400;color:var(--ink)')}>{v.docTitle}</span>
            <span style={s('width:44px')} />
          </div>
          {/* 長い日本語の本文は両端揃えにする。左揃えのままだと行末がそろわず、
              文章が左に寄って見える。text-wrap:pretty は行を短くする方向に働くので、
              ここでは使わない（短いUI文言では引き続き使う）。 */}
          <div style={s('flex:1;overflow-y:auto;padding:14px 18px 60px 18px;animation:slideIn .28s cubic-bezier(.2,.9,.2,1)')}>
            <p style={s('font-size:14px;line-height:1.9;color:var(--ink-soft);margin:0 0 26px;text-align:justify')}>{v.docLead}</p>
            {(v.docSections || []).map((sec, i) => (
              <div key={i} style={s('margin-bottom:26px')}>
                <h2 style={s('font-size:14px;font-weight:700;color:var(--ink);margin:0 0 8px;letter-spacing:.01em')}>{sec.h}</h2>
                {sec.p.map((t, j) => (
                  <p key={j} style={s('font-size:13.5px;line-height:1.95;color:var(--ink-soft);margin:0 0 10px;text-align:justify')}>{t}</p>
                ))}
              </div>
            ))}
            <div style={s('height:1px;background:var(--line);margin:6px 0 14px')} />
            <p style={s('font-size:11.5px;color:var(--ink-faint);margin:0')}>最終更新：{v.docEffective}</p>
          </div>
        </div>
      )}

      {/* ===================== お知らせ一覧 ===================== */}
      {v.noticesShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span role="button" aria-label="戻る" style={s('font-size:20px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onNoticesBack}>←</span>
            <span style={s('font-size:15px;font-weight:400;color:var(--ink);white-space:nowrap')}>お知らせ</span>
            <span style={s(`font-size:13px;color:${v.noticeHasUnread ? 'var(--ink-mut)' : 'transparent'};cursor:pointer;white-space:nowrap`)} onClick={v.noticeHasUnread ? v.onMarkAllRead : undefined}>
              すべて既読
            </span>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:8px 16px 40px')}>
            {v.noticeEmpty ? (
              <div style={s('text-align:center;padding:64px 24px;color:var(--ink-faint);font-size:14px;line-height:1.9')}>
                {''}<Jp parts={['お知らせは', 'まだありません。']} />
              </div>
            ) : (
              (v.noticeRows || []).map((n) => (
                <div key={n.key} style={s(`display:flex;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px 13px;margin-bottom:7px;cursor:pointer;${n.unread ? '' : 'opacity:.7'}`)} onClick={n.onClick}>
                  <span style={s(n.dotStyle)} />
                  <div style={s('flex:1;min-width:0')}>
                    <div style={s('display:flex;align-items:center;gap:6px;margin-bottom:2px')}>
                      <span style={s(n.kindTagStyle)}>{n.kindWord}</span>
                      <span style={s('font-size:10px;color:var(--ink-faint);flex-shrink:0')}>{n.when}</span>
                    </div>
                    <div style={s(`font-size:14px;font-weight:${n.unread ? '700' : '500'};color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis`)}>{n.title}</div>
                  </div>
                  <span style={s('font-size:15px;color:var(--ink-faint);flex-shrink:0')}>›</span>
                </div>
              ))
            )}
          </div>

          {/* 押したお知らせを、画面の中ほどに開いて全文を見せる */}
          {v.noticeSheetShown && (
            <div style={s('position:absolute;inset:0;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:16px;z-index:90;animation:scrimIn .2s ease')} onClick={v.onNoticeSheetClose}>
              <div style={s('width:100%;max-width:400px;background:var(--card);border-radius:18px;padding:20px 18px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1);max-height:78%;overflow-y:auto')} onClick={v.stop}>
                <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:12px')}>
                  <span style={s(v.nsKindTagStyle)}>{v.nsKindWord}</span>
                  <span style={s('font-size:11px;color:var(--ink-faint);font-variant-numeric:tabular-nums')}>{v.nsDate}</span>
                  <span style={s('flex:1')} />
                  <span style={s('font-size:11px;color:var(--ink-faint)')}>{v.nsWhen}</span>
                </div>
                <div style={s('font-size:16px;font-weight:400;color:var(--ink);line-height:1.55;text-wrap:pretty')}>{v.nsTitle}</div>
                {/* 「・」で始まる行は箇条書き。点の後ろで字がそろうように、点を左に出す */}
                <div style={s('margin-top:12px;display:flex;flex-direction:column;gap:7px')}>
                  {(v.nsLines || []).map((l) => (l.bullet ? (
                    <div key={l.key} style={s('display:flex;gap:8px;font-size:14px;color:var(--ink-soft);line-height:1.6')}>
                      <span style={s('flex-shrink:0;color:var(--ink-faint)')}>・</span>
                      <span style={s('text-wrap:pretty')}>{l.text}</span>
                    </div>
                  ) : (
                    <div key={l.key} style={s('font-size:14px;color:var(--ink-soft);line-height:1.7;text-wrap:pretty')}>{l.text}</div>
                  )))}
                </div>
                <div style={s('display:flex;gap:8px;margin-top:20px')}>
                  <div style={s('flex:1;text-align:center;padding:13px;border-radius:14px;background:var(--bg2);color:var(--ink-soft);font-size:14.5px;font-weight:400;cursor:pointer')} onClick={v.onNoticeSheetClose}>閉じる</div>
                  {!!v.nsActionLabel && (
                    <div style={s('flex:1;text-align:center;padding:13px;border-radius:14px;background:#1D9E75;color:#fff;font-size:14.5px;font-weight:700;cursor:pointer')} onClick={v.onNoticeAction}>{v.nsActionLabel}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== 知らせのひとこと ===================== */}
      {/* 画面をふさがない。タップも受けない（下のものを押せなくしない） */}
      {v.toastShown && (
        <div style={s(`position:absolute;left:0;right:0;bottom:${v.toastBottom}px;z-index:70;display:flex;justify-content:center;padding:0 24px;pointer-events:none;animation:capRise .24s ease`)}>
          <div style={s('background:var(--ink);color:var(--card);font-size:13px;font-weight:600;padding:11px 18px;border-radius:14px;text-align:center;text-wrap:pretty;line-height:1.5')}>{v.toastMsg}</div>
        </div>
      )}

      {/* ===================== TAB BAR ===================== */}
      {v.navShown && (
        <div className="tabbar" style={s('position:absolute;left:0;right:0;bottom:0;height:82px;padding:8px 24px 22px;background:var(--glass);backdrop-filter:blur(18px);border-top:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;z-index:60')}>
          <div style={s(v.navCalStyle)} onClick={v.onNavCal}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
              <path d="M3.5 9h17" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span style={s('font-size:10px;font-weight:600')}>カレンダー</span>
          </div>
          <div style={s(v.navFreeStyle)} onClick={v.onNavFree}>
            <span style={s('font-size:14.5px;letter-spacing:-2px;line-height:24px;height:24px;display:flex;align-items:center')}>
              <span style={s('color:#1D9E75')}>○</span><span style={s('color:#B9770F')}>△</span><span style={s('color:#C1C5CC')}>×</span>
            </span>
            <span style={s('font-size:10px;font-weight:600')}>空き状況</span>
          </div>
          <div role="button" aria-label="予定を追加" style={s('display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex:1')} onClick={v.onFab}>
            <div style={s('width:46px;height:46px;border-radius:23px;background:var(--ink);color:var(--card);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:300;box-shadow:0 4px 14px rgba(0,0,0,.24)')}>＋</div>
          </div>
          <div style={s(v.navReportStyle)} onClick={v.onNavReport}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 19V11M12 19V6M19 19v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span style={s('font-size:10px;font-weight:600')}>まとめ</span>
          </div>
          <div style={s(v.navSettingsStyle)} onClick={v.onNavSettings}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
              <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span style={s('font-size:10px;font-weight:600')}>設定</span>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { s } from './style';

// 日本語は語の途中でも改行されてしまう。意味のかたまりごとに
// inline-block で包んで、変なところで折れないようにする。
function Jp({ parts, style }) {
  return (
    <span style={s(style)}>
      {parts.map((t, i) => (
        <span key={i} style={s('display:inline-block')}>{t}</span>
      ))}
    </span>
  );
}

// Claude design のテンプレートを JSX に移植したもの。
// 値はすべて renderVals() が返す v から来る（表示ロジックは logic 側に閉じている）。
export function renderApp(v) {
  return (
    <div
      data-theme={v.theme}
      style={s('position:relative;height:100%;width:100%;background:var(--bg);overflow:hidden;transition:background .3s ease')}
    >
      {/* ===================== MONTH ===================== */}
      {v.monthShown && (
        <div style={s('display:flex;flex-direction:column;height:100%')}>
          <div className="month-head" style={s('padding:0 16px 10px 12px;display:flex;align-items:center;justify-content:space-between')}>
            <div style={s('display:flex;align-items:center;gap:2px')}>
              <span role="button" aria-label="前の月" tabIndex={0} style={s('width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onPrevMonth}>‹</span>
              {/* 押すと年月をえらべる。‹ › だけだと来年の3月に7回かかる */}
              <div role="button" aria-label="年と月をえらぶ" style={s('display:flex;align-items:baseline;gap:7px;cursor:pointer;user-select:none;padding:2px 4px;margin:-2px -4px')} onClick={v.onTapMonthHead}>
                <span style={s('font-size:28px;font-weight:700;color:var(--ink);letter-spacing:-.5px')}>{v.monthLabel}月</span>
                <span style={s('font-size:14px;font-weight:500;color:var(--ink-mut)')}>{v.year}</span>
              </div>
              <span role="button" aria-label="次の月" tabIndex={0} style={s('width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onNextMonth}>›</span>
            </div>
            <div style={s('display:flex;align-items:center;gap:12px')}>
              <div role="button" aria-label="お知らせ" style={s('width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative')} onClick={v.onBell}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <path d="M6 10a6 6 0 0 1 12 0c0 3.2.7 5 1.4 6a.6.6 0 0 1-.5.9H5.1a.6.6 0 0 1-.5-.9C5.3 15 6 13.2 6 10Z" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M10.2 20.2a2 2 0 0 0 3.6 0" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {v.bellCount > 0 && (
                  <span style={s('position:absolute;top:1px;right:0;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#1D9E75;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--bg);font-variant-numeric:tabular-nums')}>{v.bellBadge}</span>
                )}
              </div>
              <div style={s('display:flex;align-items:center;gap:8px')} onClick={v.onToggleWage}>
                <span style={s(`font-size:13px;font-weight:600;color:${v.wageLabelColor}`)}>給料</span>
                <div style={s(v.wageTrackStyle)}><div style={s(v.wageKnobStyle)} /></div>
              </div>
            </div>
          </div>

          {/* 曜日の見出しとマスは、左右の余白を必ず同じにする。
              違うと列が横にずれる（以前は左端で7px、右端で-5pxずれていた）。
              下に週の区切りと同じ線を引いて、宙に浮かせず「表の見出し」にする。 */}
          <div style={s('display:grid;grid-template-columns:repeat(7,1fr);padding:6px 0 5px 0;border-bottom:1px solid var(--line)')}>
            {(v.weekdays || []).map((w, i) => (
              <div key={i} style={s(w.style)}>{w.label}</div>
            ))}
          </div>

          <div
            className="month-scroll"
            style={s(`flex:1;overflow-y:auto;overflow-x:hidden;padding:0 0 ${v.monthPadBottom} 0;display:flex;flex-direction:column`)}
            onTouchStart={v.onMonthTouchStart}
            onTouchMove={v.onMonthTouchMove}
            onTouchEnd={v.onMonthTouchEnd}
          >
            <div style={s('flex:1 1 auto;min-height:0;position:relative;overflow:hidden')}>
              <div style={s(v.trackStyle)}>
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
              <div style={s('font-size:12.5px;color:var(--ink-mut)')}>下の ＋ から、最初の予定を置いてみてください</div>
              {v.importAvailable && (
                <div style={s('margin-top:8px;padding:12px 20px;border-radius:15px;border:1px solid var(--line);background:var(--card);font-size:13px;font-weight:600;color:var(--ink-soft);cursor:pointer')} onClick={v.onOpenImport}>
                  iPhone のカレンダーから取り込む
                </div>
              )}
            </div>
          )}

          {v.wageOn && (
            <div className="wagebar" style={s('position:absolute;left:0;right:0;bottom:82px;padding:14px 22px;background:var(--glass);backdrop-filter:blur(14px);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;animation:riseUp .3s cubic-bezier(.2,.9,.2,1);cursor:pointer')} onClick={v.onOpenSummary}>
              <span style={s('font-size:13px;font-weight:600;color:var(--ink)')}>{v.monthLabel}月の実績合計</span>
              <div style={s('display:flex;align-items:center;gap:8px')}>
                <span style={s('font-size:22px;font-weight:700;color:var(--ink);letter-spacing:-.3px;font-variant-numeric:tabular-nums')}>{v.monthTotal}</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== DAY ===================== */}
      {v.dayShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span role="button" aria-label="戻る" style={s('font-size:22px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onDayBack}>←</span>
            <span style={s('display:flex;flex-direction:column;align-items:center;gap:1px')}>
              <span style={s(v.dayTitleStyle)}>{v.dayTitle}</span>
              {!!v.dayHoliday && <span style={s(`font-size:11px;font-weight:600;color:${'#B4453A'}`)}>{v.dayHoliday}</span>}
            </span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:8px 16px 40px 16px;animation:slideIn .28s cubic-bezier(.2,.9,.2,1)')}>
            {v.dayEmpty && (
              <div style={s('text-align:center;color:var(--ink-faint);font-size:14px;padding:48px 0')}>この日の予定はまだありません</div>
            )}
            {(v.dayEvents || []).map((r) => (
              <div key={r.key} style={s(r.wrapStyle)}>
                <div role="button" aria-label="この予定を削除" style={s(r.delWrapStyle)} onClick={r.onDelete}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M6.4 7.5 7.2 19a1.4 1.4 0 0 0 1.4 1.3h6.8a1.4 1.4 0 0 0 1.4-1.3l.8-11.5" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M10.4 11v5.4M13.6 11v5.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div
                  style={s(r.bodyStyle)}
                  onClick={r.onClick}
                  onTouchStart={r.onTouchStart}
                  onTouchMove={r.onTouchMove}
                  onTouchEnd={r.onTouchEnd}
                >
                  <div style={s(r.chipStyle)}>{r.chipText}</div>
                  <div style={s('flex:1')} />
                  <div style={s('display:flex;flex-direction:column;align-items:flex-end;gap:2px')}>
                    <span style={s('font-size:14px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{r.timeText}</span>
                    <span style={s('font-size:11px;color:var(--ink-mut)')}>{r.statusWord}</span>
                  </div>
                </div>
              </div>
            ))}
            <div style={s('display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;padding:15px;border-radius:15px;border:1.5px dashed var(--line);color:var(--ink-soft);font-size:15px;font-weight:600;cursor:pointer')} onClick={v.onDayAdd}>＋ 予定を追加</div>
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
            <span style={s('font-size:16px;font-weight:700;color:var(--ink)')}>いつ空いてる？</span>
            <span role="button" style={s('font-size:14px;color:var(--ink-mut);cursor:pointer;padding:6px 0 6px 12px;user-select:none;white-space:nowrap')} onClick={v.onOpenShare}>シェア</span>
          </div>
          <div style={s('padding:6px 18px 12px;display:flex;align-items:center;justify-content:space-between')}>
            <div style={s('display:flex;align-items:center;gap:14px')}>
              <span style={s('font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onFreePrev}>◀</span>
              <span style={s('font-size:17px;font-weight:700;color:var(--ink);min-width:44px;text-align:center')}>{v.freeMonthLabel}月</span>
              <span style={s('font-size:18px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onFreeNext}>▶</span>
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
                <div style={s(r.dateWrap)}>
                  <span style={s(r.dowStyle)}>{r.dow}</span>
                  <span style={s(r.dayStyle)}>{r.day}</span>
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
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span style={s('font-size:16px;color:var(--ink-mut);cursor:pointer')} onClick={v.onCancel}>キャンセル</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink);white-space:nowrap')}>{v.newTitle}</span>
            <span style={s(`font-size:16px;font-weight:700;color:${v.draftColor};cursor:pointer`)} onClick={v.onSave}>保存</span>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:8px 16px 40px 16px')}>
            <div style={s('background:var(--card);border-radius:17px;padding:4px 14px;margin-bottom:18px')}>
              <input value={v.draftTitle} placeholder="タイトル" onChange={v.onTitle} style={s('width:100%;border:none;outline:none;padding:14px 0;font-size:16px;color:var(--ink);background:transparent')} />
            </div>

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
                <span style={s('font-size:15px;color:var(--ink);flex-shrink:0')}>種類</span>
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
                    <span style={s('font-size:15px;color:var(--ink);flex-shrink:0')}>バイト先</span>
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
                        <div style={s('padding:8px 14px;border-radius:999px;font-size:13px;color:var(--ink-mut);border:1px dashed var(--line);cursor:pointer')} onClick={v.onAddJobFromNew}>＋ バイト先</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {v.newTypeShown && (
              <div style={s('background:var(--card);border-radius:15px;padding:14px;margin-bottom:16px;border:1px solid var(--line);animation:riseUp .24s cubic-bezier(.2,.9,.2,1)')}>
                <input value={v.newTypeName} placeholder="種類の名前（例：ジム、勉強）" onChange={v.onNewTypeName} style={s('width:100%;border:none;outline:none;padding:6px 0 12px;font-size:15px;color:var(--ink);border-bottom:1px solid var(--line)')} />
                <div style={s('display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 6px')}>
                  {(v.newTypeSwatches || []).map((sw, i) => (
                    <div key={i} style={s(sw.style)} onClick={sw.onClick} />
                  ))}
                </div>
                <div style={s('display:flex;gap:8px;margin-top:14px')}>
                  <div style={s('flex:1;text-align:center;padding:11px;border-radius:16px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:600;cursor:pointer')} onClick={v.onCancelNewType}>やめる</div>
                  <div style={s(v.addTypeBtnStyle)} onClick={v.onAddType}>この種類を追加</div>
                </div>
              </div>
            )}

            {v.jobPickerShown && (
              <>
                {v.newJobShown && (
                  <div style={s('background:var(--card);border-radius:17px;padding:16px;margin:-10px 0 22px;border:1px solid var(--line);animation:riseUp .24s cubic-bezier(.2,.9,.2,1)')}>
                    <input value={v.newJobName} onChange={v.onNewJobName} placeholder="バイト先の名前（例：マクド、塾）" style={s('width:100%;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit;margin-bottom:14px')} />
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px')}>
                      <span style={s('font-size:14px;color:var(--ink-mut)')}>時給</span>
                      <div style={s('display:flex;align-items:center;gap:10px;flex-shrink:0')}>
                        <div style={s(v.stepBtn)} onClick={v.onNewJobMinus}>−</div>
                        <div style={s('display:flex;align-items:center;gap:3px;background:var(--bg2);border-radius:12px;padding:6px 12px')}>
                          <span style={s('font-size:15px;font-weight:700;color:var(--ink-soft)')}>¥</span>
                          <input value={v.newJobHourly} onChange={v.onNewJobHourly} inputMode="numeric" maxLength={5} style={s('width:6ch;min-width:6ch;border:none;outline:none;background:transparent;font-size:16px;font-weight:700;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;font-family:inherit;padding:0')} />
                        </div>
                        <div style={s(v.stepBtn)} onClick={v.onNewJobPlus}>＋</div>
                      </div>
                    </div>
                    <div style={s('display:flex;gap:8px;margin-top:16px')}>
                      <div style={s('flex:1;text-align:center;padding:11px;border-radius:13px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:600;cursor:pointer')} onClick={v.onCancelNewJob}>やめる</div>
                      <div style={s('flex:1;text-align:center;padding:11px;border-radius:13px;background:#1D9E75;color:#fff;font-size:14px;font-weight:700;cursor:pointer')} onClick={v.onCommitNewJob}>このバイト先を追加</div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer;border-bottom:1px solid var(--line)')} onClick={v.onTapDate}>
                <span style={s('font-size:15px;color:var(--ink);flex-shrink:0')}>日にち</span>
                <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                  {!!v.dateSummary && <span style={s('font-size:12px;font-weight:600;color:#1D9E75;white-space:nowrap')}>{v.dateSummary}</span>}
                  <span style={s(v.dateValStyle)}>{v.dateLabel}</span>
                  <span style={s(v.chevDate)}>›</span>
                </span>
              </div>
              {v.dateOpen && (
                <div style={s('padding:2px 12px 14px;background:var(--bg2)')}>
                  {/* 年月の表示はボタン。押すと年と月を直接えらべる。
                      1ヶ月ずつしか動けないと、来年3月に行くのに8回タップになる。 */}
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:6px 2px 8px')}>
                    <span role="button" aria-label="前の月" style={s(`width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none;${v.ymPickOpen ? 'opacity:0;pointer-events:none' : ''}`)} onClick={v.onDatePrev}>‹</span>
                    <span role="button" aria-label="年と月をえらぶ" style={s(`display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:11px;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;cursor:pointer;user-select:none;transition:all .18s;${v.ymPickOpen ? 'background:var(--ink);color:var(--card)' : 'background:var(--card);color:var(--ink);border:1px solid var(--line)'}`)} onClick={v.onTapYM}>
                      {v.datePickLabel}
                      <span style={s(`font-size:10px;display:inline-block;transition:transform .2s;${v.ymPickOpen ? 'transform:rotate(180deg)' : ''}`)}>▾</span>
                    </span>
                    <span role="button" aria-label="次の月" style={s(`width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none;${v.ymPickOpen ? 'opacity:0;pointer-events:none' : ''}`)} onClick={v.onDateNext}>›</span>
                  </div>

                  {v.ymPickOpen ? (
                    <div style={s('padding:2px 0 6px')}>
                      <div style={s('display:flex;align-items:center;justify-content:center;gap:22px;padding:4px 0 12px')}>
                        <span role="button" aria-label="前の年" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYearPrev}>‹</span>
                        <span style={s('font-size:19px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;min-width:64px;text-align:center')}>{v.ymYearLabel}</span>
                        <span role="button" aria-label="次の年" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYearNext}>›</span>
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
                  </>
                  )}
                </div>
              )}

              <div style={s(`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)`)}>
                <span style={s('font-size:15px;color:var(--ink)')}>終日予定</span>
                <div style={s(v.allDayTrack)} onClick={v.onToggleAllDay}><div style={s(v.allDayKnob)} /></div>
              </div>

              {v.timed && (v.timeRows || []).map((r, i) => (
                  <div key={i} style={s(r.rowStyle)}>
                    {/* 日付と時刻を並べる。開始の日付は押すとカレンダー、
                        時刻は押すとドラムロール。終了の日付は押せない——
                        自由に選ばせると「3日後の11:00」のような、予定ではなく
                        期間になってしまい、実働時間の計算が意味を失う。 */}
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 16px')}>
                      <span style={s('font-size:15px;color:var(--ink);flex-shrink:0')}>{r.label}</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(i === 0
                          ? 'font-size:13.5px;color:var(--ink-soft);background:var(--bg2);border-radius:10px;padding:7px 11px;white-space:nowrap;cursor:pointer'
                          : `font-size:13.5px;border-radius:10px;padding:7px 11px;white-space:nowrap;${v.endNextDay ? 'color:#0F6E56;background:rgba(29,158,117,.12);font-weight:700' : 'color:var(--ink-faint);background:transparent'}`)}
                          onClick={i === 0 ? v.onTapStartDate : undefined}>{i === 0 ? v.startDateText : v.endDateText}</span>
                        <span style={s(`${r.valStyle && ''}font-size:15px;font-weight:${r.open ? 700 : 600};color:${r.open ? '#1D9E75' : 'var(--ink)'};background:var(--bg2);border-radius:10px;padding:7px 12px;font-variant-numeric:tabular-nums;cursor:pointer`)} onClick={r.onTap}>{r.value}</span>
                      </span>
                    </div>
                    {r.open && (
                      <div style={s('position:relative;display:flex;align-items:center;justify-content:center;gap:4px;height:170px;background:var(--bg2)')}>
                        <div style={s('position:absolute;top:68px;left:64px;right:64px;height:34px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);pointer-events:none')} />
                        <div style={s(v.wheelColStyle)} onScroll={r.hScroll} ref={r.hRef}>
                          {(r.hItems || []).map((it, j) => (<div key={j} style={s(v.wheelItemStyle)}>{it}</div>))}
                        </div>
                        <span style={s('font-size:20px;font-weight:700;color:var(--ink)')}>:</span>
                        <div style={s(v.wheelColStyle)} onScroll={r.mScroll} ref={r.mRef}>
                          {(r.mItems || []).map((it, j) => (<div key={j} style={s(v.wheelItemStyle)}>{it}</div>))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {!!v.crossNote && (
                <div style={s('padding:0 16px 12px;font-size:11.5px;color:#0F6E56;line-height:1.6')}>{v.crossNote}</div>
              )}

              {v.allDayShown && (
                <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px')}>
                  <span style={s('display:flex;flex-direction:column;gap:2px;padding-right:12px')}>
                    <span style={s('font-size:15px;color:var(--ink)')}>何日間</span>
                    {!!v.spanRangeLabel && <span style={s('font-size:11px;font-weight:600;color:#1D9E75;font-variant-numeric:tabular-nums')}>{v.spanRangeLabel}</span>}
                  </span>
                  <span style={s('display:flex;align-items:center;gap:12px')}>
                    <span role="button" aria-label="1日減らす" style={s(v.spanMinusStyle)} onClick={v.onSpanMinus}>−</span>
                    <span style={s('font-size:16px;font-weight:700;color:var(--ink);min-width:52px;text-align:center;font-variant-numeric:tabular-nums')}>{v.spanCountLabel}</span>
                    <span role="button" aria-label="1日増やす" style={s(v.spanPlusStyle)} onClick={v.onSpanPlus}>＋</span>
                  </span>
                </div>
              )}
            </div>

            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;cursor:pointer')} onClick={v.onTapRemindRow}>
                <span style={s('font-size:15px;color:var(--ink);flex-shrink:0')}>お知らせ</span>
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
            </div>

            {/* ＋ で足した項目。足した順ではなく、いつも同じ並びで出す
                （足すたびに順が変わると、どこを触ればいいか分からなくなる） */}
            {v.addedAny && (
              <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:18px')}>
                {/* 複数日。日にちの画面から外した「まとめて置く」を、ここに作り直した。
                    選んだ日をもう一度押せば外せるので、押し間違いを直せる。 */}
                {v.multiRowShown && (
                  <div style={s(v.repRowShown || v.placeRowShown || v.memoRowShown ? 'border-bottom:1px solid var(--line)' : '')}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:15px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapMultiRow}>複数日</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valMulti)} onClick={v.onTapMultiRow}>{v.multiValue}</span>
                        <span role="button" aria-label="複数日を外す" style={s(v.removeStyle)} onClick={v.onRemoveMulti}>✕</span>
                      </span>
                    </div>
                    {v.rowMultiOpen && (
                      <div style={s('padding:2px 12px 14px;background:var(--bg2)')}>
                        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:6px 2px 8px')}>
                          <span role="button" aria-label="前の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onMultiPrev}>‹</span>
                          <span style={s('font-size:14px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.multiPickLabel}</span>
                          <span role="button" aria-label="次の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onMultiNext}>›</span>
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
                  </div>
                )}
                {v.repRowShown && (
                  <div style={s(v.placeRowShown || v.memoRowShown ? 'border-bottom:1px solid var(--line)' : '')}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:15px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapRepRow}>くり返し</span>
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
                {v.placeRowShown && (
                  <div style={s(v.memoRowShown ? 'border-bottom:1px solid var(--line)' : '')}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:15px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapPlaceRow}>場所</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valPlace)} onClick={v.onTapPlaceRow}>{v.placeValue}</span>
                        <span role="button" aria-label="場所を外す" style={s(v.removeStyle)} onClick={v.onRemovePlace}>✕</span>
                      </span>
                    </div>
                    {v.rowPlaceOpen && (
                      <div style={s('padding:2px 14px 14px;background:var(--bg2)')}>
                        <input value={v.placeText} onChange={v.onPlaceText} placeholder="店名や住所（例：渋谷駅、○○カフェ）"
                          style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;margin-top:11px;font-size:15px;color:var(--ink);font-family:inherit')} />
                        <div style={s('font-size:11px;color:var(--ink-faint);margin:9px 4px 0;line-height:1.6')}>入れておくと、予定を開いたときに地図で開けます</div>
                      </div>
                    )}
                  </div>
                )}
                {v.memoRowShown && (
                  <div>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px')}>
                      <span style={s('font-size:15px;color:var(--ink);flex-shrink:0;cursor:pointer')} onClick={v.onTapMemoRow}>メモ</span>
                      <span style={s('display:flex;align-items:center;gap:7px;min-width:0')}>
                        <span style={s(v.valMemo)} onClick={v.onTapMemoRow}>{v.memoValue}</span>
                        <span role="button" aria-label="メモを外す" style={s(v.removeStyle)} onClick={v.onRemoveMemo}>✕</span>
                      </span>
                    </div>
                    {v.rowMemoOpen && (
                      <div style={s('padding:2px 14px 14px;background:var(--bg2)')}>
                        <textarea value={v.memoText} onChange={v.onMemoText} placeholder="持ち物や覚えておきたいこと" rows={4}
                          style={s('width:100%;box-sizing:border-box;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;margin-top:11px;font-size:15px;color:var(--ink);font-family:inherit;resize:none;line-height:1.7')} />
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
                <span style={s('width:26px;flex-shrink:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:8px 0;border:1px solid transparent;font-size:17px;line-height:17px;color:var(--ink-faint)')}>＋</span>
                <div style={s('display:flex;flex-wrap:wrap;gap:8px;flex:1')}>
                  {(v.addChips || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== SHIFT DETAIL ===================== */}
      {v.detailShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span role="button" aria-label="戻る" style={s('font-size:22px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onBack}>←</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px')}>{v.dTitle}</span>
            <span style={s('font-size:16px;color:var(--ink-mut);cursor:pointer')} onClick={v.onEdit}>編集</span>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:14px 16px 40px 16px')}>
            <div style={s('background:var(--card);border-radius:16px;overflow:hidden;display:flex;border:1px solid var(--line);min-height:170px')}>
              <div style={s(v.gaugeTrackStyle)}>
                <div style={s(v.gaugeFillStyle)} />
              </div>
              <div style={s('flex:1;padding:20px 20px 22px 22px')}>
                <div style={s('display:flex;align-items:center;gap:10px;margin-bottom:4px')}>
                  <span style={s(v.badgeStyle)}>{v.badgeChar}</span>
                  <span style={s(`font-size:13px;font-weight:600;color:${v.dTypeDark}`)}>{v.dStatusLabel}</span>
                </div>
                <div style={s('font-size:24px;font-weight:700;color:var(--ink);margin:6px 0 2px 0;letter-spacing:-.3px')}>{v.dTitle}</div>
                <div style={s('font-size:14px;color:var(--ink-mut);margin-bottom:20px')}>{v.monthLabel}月{v.dDay}日</div>

                <div style={s('display:flex;align-items:baseline;gap:8px')}>
                  <span style={s('font-size:15px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.dTimeText}</span>
                  {v.dTimeChanged && (
                    <span style={s('font-size:12px;font-weight:600;color:#D85A30')}>→ 変更あり</span>
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
                {!!v.dMemo && (
                  <div style={s('margin-top:10px;padding:12px 14px;border-radius:13px;background:var(--bg2);font-size:14px;color:var(--ink-soft);line-height:1.9;white-space:pre-wrap;text-align:justify')}>{v.dMemo}</div>
                )}

                {v.dWageShown && (
                  <div style={s('margin-top:22px;padding-top:18px;border-top:1px solid var(--line);animation:riseUp .32s cubic-bezier(.2,.9,.2,1)')}>
                    <div style={s('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px')}>
                      <span style={s('font-size:13px;color:var(--ink-mut)')}>実働時間</span>
                      <span style={s('font-size:15px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.dWorkHours}</span>
                    </div>
                    {!!v.dBreakText && (
                      <div style={s('font-size:11px;color:var(--ink-faint);margin:-4px 0 10px;text-align:right')}>{v.dBreakText}</div>
                    )}
                    <div style={s('display:flex;justify-content:space-between;align-items:baseline')}>
                      <span style={s('font-size:13px;color:var(--ink-mut)')}>給料</span>
                      <span style={s('font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.3px;font-variant-numeric:tabular-nums')}>{v.dWage}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!!v.dPrimaryLabel && (
              <div style={s(v.dPrimaryStyle)} onClick={v.dPrimaryAction}>{v.dPrimaryLabel}</div>
            )}

            <div style={s('margin-top:28px;padding:14px;text-align:center;font-size:14px;color:#A8452B;cursor:pointer')} onClick={v.onDelete}>{v.dDeleteLabel}</div>
          </div>
        </div>
      )}

      {/* ===================== 年月をえらぶ（月表示） ===================== */}
      {v.ymSheetShown && (
        <div style={s('position:absolute;inset:0;z-index:88;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onYmSheetClose}>
          <div style={s('width:100%;max-width:320px;background:var(--bg);border-radius:20px;padding:18px 18px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            <div style={s('display:flex;align-items:center;justify-content:center;gap:22px;padding:2px 0 16px')}>
              <span role="button" aria-label="前の年" style={s('width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:21px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYmSheetPrevYear}>‹</span>
              <span style={s('font-size:20px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;min-width:72px;text-align:center')}>{v.ymSheetYear}</span>
              <span role="button" aria-label="次の年" style={s('width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:21px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onYmSheetNextYear}>›</span>
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
            <div style={s('font-size:17px;font-weight:700;color:var(--ink);text-align:center;letter-spacing:-.3px;text-wrap:balance')}>{v.confirmTitle}</div>
            <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:8px 0 20px;text-wrap:pretty')}>{v.confirmBody}</div>
            {v.repDeleteShown && (
              <div style={s('display:flex;align-items:center;gap:10px;padding:12px 13px;margin-bottom:14px;border-radius:13px;background:var(--bg2);cursor:pointer')} onClick={v.onToggleRepDelete}>
                <span style={s(v.repDeleteBox)}>{v.repDeleteOn ? '✓' : ''}</span>
                <span style={s('font-size:13px;color:var(--ink-soft);line-height:1.5')}>{v.repDeleteLabel}</span>
              </div>
            )}
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:16px;font-weight:700;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onConfirmDelete}>{v.confirmOkLabel}</div>
              <div style={s('padding:12px;text-align:center;font-size:15px;color:var(--ink-mut);cursor:pointer')} onClick={v.onCancelDelete}>やめる</div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CENTER DIALOG ===================== */}
      {v.dialogShown && (
        <div style={s('position:absolute;inset:0;z-index:80;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onDlgDismiss}>
          <div style={s('width:100%;max-width:320px;background:var(--card);border-radius:16px;padding:22px 20px 18px 20px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            <div style={s('font-size:19px;font-weight:700;color:var(--ink);text-align:center;letter-spacing:-.3px;text-wrap:balance')}>{v.dlgHeading}</div>
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
                      <span style={s('font-size:19px;font-weight:700;color:var(--ink)')}>:</span>
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
                <span style={s('font-size:12px;color:var(--ink-mut)')}>{v.dlgOrigText} <span style={s('color:#D85A30;font-weight:600')}>→ 変更あり</span></span>
              )}
            </div>

            <div style={s('display:flex;flex-direction:column;gap:9px')}>
              <div style={s(v.dlgPrimaryStyle)} onClick={v.onDlgPrimary}>{v.dlgPrimaryLabel}</div>
              <div style={s('padding:14px;border-radius:15px;text-align:center;font-size:16px;font-weight:600;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onDlgNakunatta}>無くなった</div>
              <div style={s('padding:12px;text-align:center;font-size:15px;color:var(--ink-mut);cursor:pointer')} onClick={v.onDlgStillMaybe}>まだ分からない</div>
            </div>

            <div style={s('margin-top:6px;padding-top:12px;border-top:1px solid var(--line);text-align:center')}>
              <span style={s('font-size:13px;color:var(--ink-faint);cursor:pointer')} onClick={v.onDlgEdit}>{v.dlgEditLabel}</span>
            </div>
          </div>
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
      {v.summaryShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:#1A1A1A')}>
          <div className="scr-head" style={s('padding:0 18px 8px;flex-shrink:0')}>
            <span style={s('font-size:16px;color:rgba(255,255,255,.65);cursor:pointer')} onClick={v.onSummaryClose}>閉じる</span>
            <span style={s('font-size:14px;font-weight:600;color:rgba(255,255,255,.9)')}>今月のまとめ</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:10px 16px 20px')}>
            <div style={s('width:100%;max-width:340px;aspect-ratio:9/16;background:linear-gradient(180deg,#FBFBFD 0%,#F4F6F8 100%);border-radius:22px;box-shadow:0 18px 48px rgba(0,0,0,.5);padding:30px 26px;display:flex;flex-direction:column;overflow:hidden')}>
              {/* このカードは地が明色で固定（書き出す PNG と同じ見た目にするため）。
                  中の文字にテーマ変数を使うと、ダークモードで白地に白文字になる。
                  色は sharecard.js の定数と揃えてある。 */}
              <div style={s('display:flex;align-items:baseline;justify-content:space-between')}>
                <span style={s('font-size:13px;font-weight:600;color:#8C887C;letter-spacing:.5px')}>{v.sumYearMonth}</span>
                <span style={s('font-size:12px;font-weight:600;color:#8C887C')}>まとめ</span>
              </div>

              <div style={s('display:flex;flex-wrap:wrap;gap:4px;margin:20px 0 22px')}>
                {(v.rhythm || []).map((r, i) => (<div key={i} style={s(r.style)} />))}
              </div>

              <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:2px')}>
                <span style={s('width:24px;height:24px;border-radius:15px;background:#1D9E75;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800')}>✓</span>
                <span style={s('font-size:13px;font-weight:600;color:#085041')}>稼いだ</span>
              </div>
              <div style={s('font-size:46px;font-weight:800;color:#26251F;letter-spacing:-1.5px;line-height:1.1')}>{v.sumWage}</div>
              <div style={s('font-size:14px;color:#8C887C;margin-top:2px')}>{v.sumHours} 働きました</div>

              <div style={s('height:1px;background:#E6E2D6;margin:22px 0')} />

              <div style={s('display:flex;gap:14px')}>
                <div style={s('flex:1')}>
                  <div style={s('display:flex;align-items:center;gap:6px;margin-bottom:6px')}>
                    <span style={s('width:16px;height:16px;border-radius:11px;background:#D85A30;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800')}>✓</span>
                    <span style={s('font-size:12px;font-weight:600;color:#712B13')}>果たした約束</span>
                  </div>
                  <div style={s('font-size:34px;font-weight:800;color:#26251F;letter-spacing:-1px')}>{v.sumPromises}</div>
                </div>
                <div style={s('flex:1')}>
                  <div style={s('display:flex;align-items:center;gap:6px;margin-bottom:6px')}>
                    <span style={s('width:16px;height:16px;border-radius:11px;background:#EDEEF0;color:#8C887C;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700')}>×</span>
                    <span style={s('font-size:12px;font-weight:600;color:#8C887C')}>流れた予定</span>
                  </div>
                  <div style={s('font-size:34px;font-weight:800;color:#B7B3A6;letter-spacing:-1px')}>{v.sumCanceled}</div>
                </div>
              </div>

              <div style={s('flex:1')} />
              {/* 1行に続けると折り返しがどこで起きるか分からず、
                  「決まってる？」がどこまでなのか読めなかった。2段に分ける。 */}
              <div style={s('display:flex;align-items:center;gap:8px;padding-top:16px')}>
                <span style={s('font-size:15px;letter-spacing:-2px;flex-shrink:0')}><span style={s('color:#1D9E75')}>✓</span><span style={s('color:#C1C5CC')}>？</span></span>
                <span style={s('display:flex;flex-direction:column;gap:1px;min-width:0')}>
                  <span style={s('font-size:12px;font-weight:600;color:#55524A;white-space:nowrap')}>決まってる？</span>
                  <span style={s('font-size:11px;font-weight:500;color:#8C887C;white-space:nowrap')}>予定が一目でわかるカレンダー</span>
                </span>
              </div>
            </div>

            <div style={s('display:flex;gap:10px;width:100%;max-width:340px;margin-top:18px')}>
              <div style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:14px;border-radius:16px;background:var(--card);color:var(--ink);font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onShareCard}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                ストーリーズにシェア
              </div>
            </div>
            {v.shareToast && (
              <div style={s('margin-top:12px;font-size:12px;color:rgba(255,255,255,.55)')}>{v.shareToastMsg}</div>
            )}
          </div>
        </div>
      )}

      {/* ===================== 空いてる日シェア ===================== */}
      {v.shareShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:#1A1A1A')}>
          <div className="scr-head" style={s('padding:0 18px 8px;flex-shrink:0')}>
            <span style={s('font-size:16px;color:rgba(255,255,255,.65);cursor:pointer')} onClick={v.onShareClose}>閉じる</span>
            <span style={s('font-size:14px;font-weight:600;color:rgba(255,255,255,.9)')}>空いてる日をシェア</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:6px 16px 24px')}>
            {/* まとめカードと同じ理由で、地も文字も固定色にする。
                マスの色（#FAECE7 / #EDEEF0）が明色固定なので、地だけテーマに
                従わせると書き出す PNG と食い違ってしまう。 */}
            <div style={s('width:100%;max-width:340px;background:#FFFDF8;border-radius:22px;box-shadow:0 18px 48px rgba(0,0,0,.5);padding:24px 22px 22px;overflow:hidden')}>
              <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:3px')}>
                <span style={s('width:22px;height:22px;border-radius:7px;background:#D85A30;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800')}>○</span>
                <span style={s('font-size:13px;font-weight:600;color:#D85A30')}>わたしの空いてる日</span>
              </div>
              <div style={s('font-size:22px;font-weight:800;color:#26251F;letter-spacing:-.5px')}>{v.shareMonthLabel}月のあいてる日</div>
              <div style={s('font-size:13px;color:#8C887C;margin:2px 0 18px')}>予定の中身は出していません</div>

              <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:4px')}>
                {(v.shareWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
              </div>
              <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:5px')}>
                {(v.shareCells || []).map((c, i) => (<div key={i} style={s(c.style)}>{c.label}</div>))}
              </div>

              <div style={s('display:flex;align-items:center;gap:16px;margin-top:18px;padding-top:16px;border-top:1px solid #E6E2D6')}>
                <div style={s('display:flex;align-items:center;gap:6px')}>
                  <span style={s('width:16px;height:16px;border-radius:5px;background:#FAECE7;border:1.5px solid #D85A30')} />
                  <span style={s('font-size:12px;color:#55524A')}>空いてる</span>
                </div>
                <div style={s('display:flex;align-items:center;gap:6px')}>
                  <span style={s('width:16px;height:16px;border-radius:5px;background:#EDEEF0')} />
                  <span style={s('font-size:12px;color:#55524A')}>予定あり</span>
                </div>
                <div style={s('flex:1')} />
                <span style={s('font-size:12px;letter-spacing:-2px')}><span style={s('color:#1D9E75')}>✓</span><span style={s('color:#C1C5CC')}>？</span></span>
              </div>
            </div>

            <div style={s('width:100%;max-width:340px;margin-top:14px;font-size:12px;color:rgba(255,255,255,.5);text-align:center;text-wrap:pretty')}>埋まっている日は灰色のマスだけ。何の予定かは相手に伝わりません。</div>

            <div style={s('display:flex;gap:10px;width:100%;max-width:340px;margin-top:16px')}>
              <div style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:14px;border-radius:16px;background:var(--card);color:var(--ink);font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onShareCard}>
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

      {/* ===================== SETTINGS ===================== */}
      {v.settingsShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head-solo" style={s('padding:0 20px 10px')}>
            <span style={s('font-size:30px;font-weight:700;color:var(--ink);letter-spacing:-.5px')}>設定</span>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:8px 16px 110px')}>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>バイト先</div>
            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:8px')}>
              {(v.jobRows || []).map((j, i) => (
                <div key={i} style={s(j.rowStyle)}>
                  <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={j.onTap}>
                    <span style={s('flex:1;font-size:15px;color:var(--ink)')}>{j.name}</span>
                    <span style={s('font-size:14px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>¥{j.hourly}</span>
                    <span style={s('font-size:16px;color:var(--ink-faint)')}>{j.open ? '⌄' : '›'}</span>
                  </div>
                  {j.open && (
                    <div style={s('padding:2px 16px 16px')}>
                      <input value={j.name === '（名前なし）' ? '' : j.name} onChange={j.onName} placeholder="バイト先の名前（例：マクド、塾）" style={s('width:100%;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit;margin-bottom:12px')} />
                      <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px')}>
                        <span style={s('font-size:14px;color:var(--ink-mut)')}>時給</span>
                        <div style={s('display:flex;align-items:center;gap:10px;flex-shrink:0')}>
                          <div style={s(v.stepBtn)} onClick={j.onMinus}>−</div>
                          <div style={s('display:flex;align-items:center;gap:3px;background:var(--bg2);border-radius:12px;padding:6px 12px')}>
                            <span style={s('font-size:15px;font-weight:700;color:var(--ink-soft)')}>¥</span>
                            <input value={j.hourly} onChange={j.onHourly} inputMode="numeric" maxLength={5} style={s('width:6ch;min-width:6ch;border:none;outline:none;background:transparent;font-size:16px;font-weight:700;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;font-family:inherit;padding:0')} />
                          </div>
                          <div style={s(v.stepBtn)} onClick={j.onPlus}>＋</div>
                        </div>
                      </div>
                      <div style={s('display:flex;align-items:center;justify-content:space-between;margin-top:14px')}>
                        <span style={s('font-size:11px;color:var(--ink-faint)')}>{j.usedCount > 0 ? `${j.usedCount}件の予定で使っています` : 'まだ使っていません'}</span>
                        <span style={s('font-size:13px;color:#A8452B;cursor:pointer')} onClick={j.onRemove}>削除</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div style={s(`display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;${v.jobsEmpty ? '' : 'border-top:1px solid var(--line)'}`)} onClick={v.onAddJob}>
                <span style={s('width:26px;height:26px;border-radius:11px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>＋</span>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>バイト先を追加</span>
              </div>
            </div>
            <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 24px;line-height:1.8')}>
              {''}<Jp parts={['時給は', 'バイト先ごとに', '決めます。']} />
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>予定の種類</div>
            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:24px')}>
              {/* たたんでいるあいだも、色の点だけは出しておく */}
              <div style={s(`display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;${v.typeListOpen ? 'border-bottom:1px solid var(--line)' : ''}`)} onClick={v.onToggleTypeList}>
                <span style={s('display:flex;align-items:center;gap:5px;flex:1;min-width:0;flex-wrap:wrap')}>
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
                      <input value={t.name} onChange={t.onName} placeholder="種類の名前" style={s('width:100%;border:none;outline:none;background:var(--bg2);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit;margin-bottom:14px')} />
                      <div style={s('display:flex;flex-wrap:wrap;gap:12px')}>
                        {(t.swatches || []).map((sw, j) => (<div key={j} style={s(sw.style)} onClick={sw.onClick} />))}
                      </div>
                      <div style={s('font-size:11px;color:var(--ink-faint);margin-top:14px')}>{t.usedCount > 0 ? `${t.usedCount}件の予定で使っています` : 'まだ使っていません'}</div>
                    </div>
                  )}
                </div>
              ))}
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={v.onAddTypeRow}>
                <span style={s('width:26px;height:26px;border-radius:11px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:600')}>＋</span>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>種類を追加</span>
              </div>
              {v.newTypeShown && (
                <div style={s('padding:2px 16px 16px;background:var(--bg2)')}>
                  <input value={v.newTypeName} placeholder="種類の名前（例：ジム、勉強）" onChange={v.onNewTypeName} style={s('width:100%;border:none;outline:none;background:var(--card);border-radius:12px;padding:11px 13px;font-size:15px;color:var(--ink);font-family:inherit;margin:12px 0 14px')} />
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

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>アプリの設定</div>
            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:24px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)')}>
                <span style={s('font-size:15px;color:var(--ink);flex-shrink:0')}>週のはじまり</span>
                <div style={s('display:flex;background:var(--bg2);border-radius:13px;padding:2px;width:150px')}>
                  {(v.weekSeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
                </div>
              </div>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
                <div style={s('display:flex;flex-direction:column;gap:2px;padding-right:12px')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>シフト後に記録をリマインド</span>
                  <span style={s('font-size:11px;color:var(--ink-mut);text-wrap:pretty')}>終わった時間に「実働どうだった？」を通知</span>
                </div>
                <div style={s(v.remindTrack)} onClick={v.onToggleRemind}><div style={s(v.remindKnob)} /></div>
              </div>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
                <div style={s('display:flex;flex-direction:column;gap:2px;padding-right:12px')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>「無くなった」予定を隠す</span>
                  <span style={s('font-size:11px;color:var(--ink-mut);text-wrap:pretty')}>オフなら取り消し線で薄く残します</span>
                </div>
                <div style={s(v.hideTrack)} onClick={v.onToggleHide}><div style={s(v.hideKnob)} /></div>
              </div>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px')}>
                <span style={s('font-size:15px;color:var(--ink)')}>ダークモード</span>
                <div style={s(v.darkTrack)} onClick={v.onToggleDark}><div style={s(v.darkKnob)} /></div>
              </div>
            </div>

            {v.importAvailable && (
              <>
                <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>予定の取り込み</div>
                <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:8px')}>
                  <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={v.onOpenImport}>
                    <span style={s('width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800')}>↓</span>
                    <span style={s('flex:1;font-size:15px;color:var(--ink)')}>iPhone のカレンダーから取り込む</span>
                    <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
                  </div>
                </div>
                <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 24px;line-height:1.8;text-wrap:pretty')}>
                  {''}<Jp parts={['読むだけです。','あなたのカレンダーに','書き込むことは','ありません。']} />
                </div>
              </>
            )}

            {/* 規約に「大切な予定は控えを取ってください」と書いてある以上、
                取る手段と戻す手段はアプリ側が持っていないと筋が通らない。 */}
            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>控え</div>
            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:8px')}>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);cursor:pointer')} onClick={v.onExportBackup}>
                <span style={s('width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800')}>↑</span>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>控えを書き出す</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
              {/* 押したらそのままファイルをえらべる。中身をコピーして貼る手順は挟まない */}
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={v.onPickBackup}>
                <span style={s('width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800')}>↓</span>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>控えから戻す</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
            </div>
            {/* 見えない入力。行から click() で開く */}
            <input id="backup-file" type="file" accept=".json,application/json" onChange={v.onBackupFile}
              style={s('display:none')} />
            {!!v.backupError && (
              <div style={s('font-size:11px;color:#A8452B;margin:0 8px 8px;line-height:1.6;text-wrap:pretty')}>{v.backupError}</div>
            )}
            <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 8px;line-height:1.8;text-wrap:pretty')}>
              {''}<Jp parts={['予定は', 'この端末の中だけに', 'あります。', '機種変更や', '紛失にそなえて、', 'ときどき控えを', '取っておいてください。']} />
            </div>
            {/* えらべなかった人が行き止まりにならないように、逃げ道は残しておく */}
            <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 8px;line-height:1.8;cursor:pointer;text-decoration:underline')} onClick={v.onTogglePaste}>
              ファイルをえらべないときは、貼り付けでも戻せます
            </div>
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
            <div style={s('margin-bottom:16px')} />

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>このアプリについて</div>
            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:14px')}>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);cursor:pointer')} onClick={v.onOpenTerms}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>利用規約</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);cursor:pointer')} onClick={v.onOpenPrivacy}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>プライバシーポリシー</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
              {/* 連絡先はリンクにしつつ、住所そのものも出す。
                  リンクが開かない環境でも、長押しでコピーできるように。 */}
              <a href={v.reviewHref} target="_blank" rel="noreferrer" style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);text-decoration:none;-webkit-tap-highlight-color:transparent')}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>App Store でレビューする</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </a>
              <a href={v.contactHref} style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);text-decoration:none;-webkit-tap-highlight-color:transparent')}>
                <span style={s('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>お問い合わせ</span>
                  <span style={s('font-size:11px;color:var(--ink-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{v.contactEmail}</span>
                </span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </a>
              {/* 5回叩くと診断が出る。ふつうに使う人には何も起きない */}
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:default')} onClick={v.onTapVersion}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>バージョン</span>
                <span style={s('font-size:14px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>{v.appVersion}</span>
              </div>
            </div>
            <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 24px;line-height:1.8;text-wrap:pretty')}>
              {''}<Jp parts={['予定はこの端末の','中だけに','保存されます。','外部に','送られることは','ありません。']} />
            </div>

            {/* サポーターカード。応援したことがある人にだけ出る。
                機能ではなく「自分がやったことの記録」なので、消耗型のままでいい。
                派手にしない——受け取った側が気恥ずかしくならない濃さで。 */}
            {v.supporterShown && (
              <div style={s('background:var(--card);border:1px solid var(--line);border-radius:17px;padding:18px 18px 16px;margin-bottom:14px;cursor:pointer')} onClick={v.onOpenCard}>
                <div style={s('display:flex;align-items:center;gap:9px;margin-bottom:9px')}>
                  <span style={s('width:22px;height:22px;border-radius:11px;background:#1D9E75;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0')}>✓</span>
                  <span style={s('font-size:14px;font-weight:700;color:var(--ink)')}>応援ありがとうございます</span>
                </div>
                <div style={s('display:flex;align-items:baseline;gap:10px;padding-left:31px')}>
                  <span style={s('font-size:20px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.supporterTotal}</span>
                  <span style={s('font-size:12px;color:var(--ink-soft)')}>{v.supporterCount}</span>
                  <span style={s('font-size:11px;color:var(--ink-mut)')}>{v.supporterSince}</span>
                  <span style={s('flex:1')} />
                  <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
                </div>
              </div>
            )}

            {/* 開発応援。規約の下に静かに置く。探した人だけが見つければいい。
                起動時に出したり、赤い点で気づかせたりはしない——
                新しい人に見せると物乞いに見える。
                商品が取れないときは、行ごと出さない。 */}
            {v.tipShown && (
              <>
                <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>開発を応援する</div>
                <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:10px')}>
                  {(v.tipRows || []).map((t, i) => (
                    <div key={i} style={s(t.rowStyle)} onClick={t.onClick}>
                      <span style={s('display:flex;flex-direction:column;gap:2px;flex:1;min-width:0')}>
                        <span style={s('font-size:15px;color:var(--ink)')}>{t.label}</span>
                      </span>
                      <span style={s('font-size:15px;font-weight:700;color:var(--ink-soft);font-variant-numeric:tabular-nums')}>{t.price}</span>
                    </div>
                  ))}
                </div>
                <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 24px;line-height:1.8;text-wrap:pretty')}>
                  {''}<Jp parts={['応援しても、','増える機能は','ありません。','広告なし・通信なしの','ままで','作りつづけます。']} />
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ===================== まとめ（働いた時間） ===================== */}
      {v.reportShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head-solo" style={s('padding:0 20px 10px')}>
            <span style={s('font-size:30px;font-weight:700;color:var(--ink);letter-spacing:-.5px')}>まとめ</span>
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:8px 16px 110px')}>

            {v.repEmpty ? (
              <div style={s('text-align:center;padding:56px 24px;color:var(--ink-faint);font-size:14px;line-height:1.9;text-wrap:pretty')}>
                {''}<Jp parts={['働いた記録が','まだありません。','バイトの予定を','確定して、','終わったら','実働時間をつけると、','ここに','積み上がっていきます。']} />
              </div>
            ) : (
              <>
                <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>{v.repMonthLabel}</div>
                <div style={s('background:var(--card);border-radius:17px;padding:18px 18px 20px;margin-bottom:22px;border:1px solid var(--line)')}>
                  <div style={s('display:flex;align-items:baseline;gap:8px;margin-bottom:2px')}>
                    <span style={s('font-size:34px;font-weight:700;color:var(--ink);letter-spacing:-.6px;font-variant-numeric:tabular-nums')}>{v.repMonthWage}</span>
                  </div>
                  <div style={s('font-size:13px;color:var(--ink-mut)')}>{v.repMonthHours}・{v.repMonthDays}日</div>
                </div>

                <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>月ごとの働いた時間</div>
                <div style={s('background:var(--card);border-radius:17px;padding:16px 12px 12px;margin-bottom:22px;border:1px solid var(--line)')}>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 4px 12px')}>
                    <span role="button" aria-label="前の年" style={s('width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:19px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onRepPrevYear}>‹</span>
                    <span style={s('font-size:14px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearLabel}</span>
                    <span role="button" aria-label="次の年" style={s('width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:19px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onRepNextYear}>›</span>
                  </div>
                  <div style={s('display:flex;align-items:flex-end;justify-content:space-between;gap:3px;height:96px;padding:0 2px')}>
                    {(v.repBars || []).map((b, i) => (
                      <div key={i} style={s('flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;cursor:pointer')} onClick={b.onClick}>
                        <div style={s('width:100%;display:flex;align-items:flex-end;justify-content:center;flex:1')}>
                          <div style={s(`width:100%;max-width:14px;${b.barStyle ? '' : ''}`)}>
                            <div style={s(b.barStyle)} />
                          </div>
                        </div>
                        <span style={s(b.labelStyle)}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>{v.repYearLabel}の合計</div>
                <div style={s('background:var(--card);border-radius:17px;overflow:hidden;margin-bottom:22px;border:1px solid var(--line)')}>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
                    <span style={s('font-size:14px;color:var(--ink-mut)')}>働いた時間</span>
                    <span style={s('font-size:17px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearHours}</span>
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
                    <span style={s('font-size:14px;color:var(--ink-mut)')}>働いた日数</span>
                    <span style={s('font-size:17px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearDays}日</span>
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px')}>
                    <span style={s('font-size:14px;color:var(--ink-mut)')}>稼いだ額</span>
                    <span style={s('font-size:17px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearWage}</span>
                  </div>
                </div>
              </>
            )}

            {/* 「空いてる日をシェア」はここには置かない。この画面の数字と関係がなく、
                どの月を送るのかも分からなくなる。空き状況の画面に置いてある。 */}
            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>シェア</div>
            <div style={s('background:var(--card);border-radius:17px;overflow:hidden;border:1px solid var(--line)')}>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={v.onOpenSummaryCard}>
                <span style={s('width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800')}>✓</span>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>今月のまとめカード</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================== サポーターカード =====================
          金ぴかにはしない。生成りの紙に真鍮の箔を押したもの、という見立て。
          光は斜めにゆっくり流れるだけで、点滅させない。
          通し番号と「いま◯人の1人です」は出せない——全員を数える場所が要り、
          このアプリはサーバーを持たないため。 */}
      {v.cardShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px')}>
            <span role="button" aria-label="戻る" style={s('font-size:22px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onCardBack}>←</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink)')}>サポーターカード</span>
            <span />
          </div>

          <div style={s('flex:1;overflow-y:auto;padding:18px 20px 40px')}>
            {/* カード本体。押すと裏返る。指でなぞれば、なぞった分だけその場で回る */}
            <div style={s('perspective:1200px;animation:cardIn .5s cubic-bezier(.2,.9,.2,1) both')}>
              <div style={s(v.cardFlipStyle)} onClick={v.onFlipCard}
                onTouchStart={v.onCardTouchStart}
                onTouchMove={v.onCardTouchMove}
                onTouchEnd={v.onCardTouchEnd}
                onTouchCancel={v.onCardTouchEnd}>

                {/* 表 */}
                <div style={s(v.cardFaceStyle)}>
                  <div style={s(v.foilStyle)} />
                  <div style={s('position:relative;z-index:1;display:flex;flex-direction:column;height:100%;justify-content:space-between')}>
                    <div style={s('display:flex;align-items:flex-start;justify-content:space-between')}>
                      <span style={s('display:flex;flex-direction:column;gap:3px')}>
                        <span style={s(v.foilTextStyle)}>決まってる？</span>
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

            <div style={s('text-align:center;font-size:16px;font-weight:700;color:var(--ink);margin-top:26px')}>支えてくれて、ありがとう。</div>
            <div style={s('text-align:center;font-size:12.5px;color:var(--ink-soft);line-height:1.9;margin-top:8px;text-wrap:pretty')}>
              {''}<Jp parts={['広告なし・通信なしのままで','作りつづけます。']} />
            </div>

            {/* 名前はカードに載るだけ。端末の外には出ない */}
            <div style={s('margin-top:24px')}>
              <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>カードに載せる名前</div>
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
            <div style={s('font-size:15px;font-weight:700;color:var(--ink);margin-bottom:12px')}>課金の状態</div>
            {(v.probeRows || []).map((r, i) => (
              <div key={i} style={s('margin-bottom:10px')}>
                {!!r.k && <div style={s('font-size:11px;color:var(--ink-mut);margin-bottom:2px')}>{r.k}</div>}
                <div style={s('font-size:12.5px;color:var(--ink);line-height:1.6;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,monospace')}>{r.val}</div>
              </div>
            ))}
            <div style={s('display:flex;gap:8px;margin-top:14px')}>
              <div style={s('flex:1;text-align:center;padding:11px;border-radius:12px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:600;cursor:pointer')} onClick={v.onProbeRetry}>もう一度読む</div>
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

          <div style={s('flex:1;overflow-y:auto;padding:12px 26px 20px;display:flex;flex-direction:column')}>

            {v.obStep === 0 && (
              <div>
                {/* 一字ずつ、薄い墨から本来の濃さへ。遅れは renderVals が決めている */}
                <div style={s({ ...v.obLineStyle, marginTop: 24 })}>
                  {(v.obLine1 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>
                <div style={s(v.obLineStyle)}>
                  {(v.obLine2 || []).map((c, i) => (<span key={i} style={s(c.style)}>{c.ch}</span>))}
                </div>

                <div style={s(v.obPaperStyle)}>
                  <div style={s(v.obDateStyle)}>7月25日（土）</div>
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
                  <div style={s({ fontSize:13, marginTop:14, lineHeight:1.7, fontWeight:600, color:v.obDemoCaptionColor })}>{v.obDemoCaption}</div>
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
            {v.obStep === 1 && (
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
                        <span style={s('font-size:16px;font-weight:700;color:var(--ink);line-height:1.2;font-variant-numeric:tabular-nums')}>{r.day}</span>
                      </span>
                      <span style={s('flex:1;font-size:12.5px;color:var(--ink-soft);min-width:0')}>{r.note}</span>
                      <span style={s({ fontSize:19, fontWeight:700, color:r.color, flexShrink:0 })}>{r.mark}</span>
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
            {v.obStep === 2 && (
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
            {v.obStep === 3 && (
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
              </div>
            )}

            <div style={s('flex:1')} />

            <div style={s('display:flex;justify-content:center;gap:6px;padding:20px 0 16px')}>
              {(v.obDots || []).map((d, i) => (<span key={i} style={s(d.style)} />))}
            </div>

            {v.obStep === 0 && (
              <div style={s(v.obNextStyle)} onClick={v.onObNext}>{v.obNextLabel}</div>
            )}
            {(v.obStep === 1 || v.obStep === 2) && (
              <div style={s('padding:16px;border-radius:17px;background:var(--ink);color:var(--card);text-align:center;font-size:16px;font-weight:700;cursor:pointer')} onClick={v.onObNext}>つぎへ</div>
            )}
            {v.obStep === 3 && (
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
            <span role="button" aria-label="戻る" style={s('font-size:22px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onImportBack}>←</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink);white-space:nowrap')}>予定の取り込み</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:14px 20px 60px')}>

            {v.impPhase === 'done' ? (
              <div style={s('text-align:center;padding:56px 10px')}>
                <div style={s('width:56px;height:56px;border-radius:28px;background:#1D9E75;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;animation:checkPop .5s cubic-bezier(.2,.9,.2,1) both')}>✓</div>
                <div style={s('font-size:19px;font-weight:700;color:var(--ink);margin-top:18px')}>{v.impAdded}件を取り込みました</div>
                <div style={s('font-size:13px;color:var(--ink-soft);margin-top:8px;line-height:1.9;text-wrap:pretty')}>
                  {''}<Jp parts={['すべて','「決まってる」として','置きました。','まだ分からない予定は、','タップして','点線に','変えられます。']} />
                </div>
                {/* 取り込んだ瞬間に案内が消えるので、ここで新しい予定の入れ方を伝える。
                    前は取り込んだあと、追加のしかたがどこにも出ていなかった。 */}
                <div style={s('margin-top:20px;padding:14px 16px;border-radius:15px;background:var(--bg2);font-size:13px;color:var(--ink-soft);line-height:1.9;text-wrap:pretty')}>
                  {''}<Jp parts={['新しい予定は、','下の ＋ から','入れられます。']} />
                </div>
                <div style={s('margin-top:28px;padding:15px;border-radius:16px;background:var(--ink);color:var(--card);font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onImportDone}>カレンダーを見る</div>
              </div>
            ) : v.impPhase === 'found' ? (
              <>
                <div style={s('font-size:20px;font-weight:700;color:var(--ink);letter-spacing:-.3px;margin-bottom:6px')}>{v.impCount}件の予定が見つかりました</div>
                <div style={s('font-size:13px;color:var(--ink-soft);line-height:1.9;margin-bottom:14px;text-wrap:pretty')}>
                  {''}<Jp parts={['先月から','1年ぶんを','読みました。','すでに入っている予定は','除いてあります。']} />
                </div>
                {!!v.impGuessText && (
                  <div style={s('font-size:12.5px;color:var(--ink-soft);line-height:1.8;margin-bottom:20px;padding:11px 13px;border-radius:13px;background:var(--bg2);text-wrap:pretty')}>{v.impGuessText}</div>
                )}

                <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 2px 8px')}>
                  <span style={s('font-size:12px;font-weight:600;color:var(--ink-mut)')}>入れるものをえらぶ</span>
                  <span style={s('font-size:13px;color:var(--ink-mut);cursor:pointer;white-space:nowrap')} onClick={v.onToggleAll}>
                    {v.impAllOn ? 'すべて外す' : 'すべて選ぶ'}
                  </span>
                </div>

                <div style={s('display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 2px 12px')}>
                  <span style={s('font-size:11px;color:var(--ink-faint)')}>まとめて種類を変える</span>
                  {(v.impBulkChips || []).map((c, i) => (<div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>))}
                </div>

                <div style={s('background:var(--card);border-radius:17px;overflow:hidden;border:1px solid var(--line);margin-bottom:14px')}>
                  {(v.impRows || []).map((r) => (
                    <div key={r.key} style={s(r.rowStyle)} onClick={r.onToggle}>
                      <span style={s(r.checkStyle)}>{r.on ? '✓' : ''}</span>
                      <div style={s('flex:1;min-width:0')}>
                        <div style={s('display:flex;align-items:baseline;gap:8px')}>
                          <span style={s('font-size:11px;color:var(--ink-mut);font-variant-numeric:tabular-nums;white-space:nowrap')}>{r.when}</span>
                          <span style={s('flex:1;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.title}</span>
                        </div>
                        <div style={s('display:flex;gap:5px;margin-top:6px;flex-wrap:wrap')}>
                          {r.typeChips.map((t, j) => (<div key={j} style={s(t.style)} onClick={t.onClick}>{t.label}</div>))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={s(`margin-top:8px;padding:16px;border-radius:17px;text-align:center;font-size:16px;font-weight:700;cursor:pointer;background:${v.impOnCount === '0' ? 'var(--bg2)' : 'var(--ink)'};color:${v.impOnCount === '0' ? 'var(--ink-faint)' : 'var(--card)'}`)} onClick={v.impOnCount === '0' ? undefined : v.onDoImport}>
                  {v.impOnCount}件を取り込む
                </div>
                <div style={s('padding:14px;text-align:center;font-size:14px;color:var(--ink-mut);cursor:pointer')} onClick={v.onImportBack}>やめる</div>
              </>
            ) : (
              <>
                <div style={s('font-size:20px;font-weight:700;color:var(--ink);letter-spacing:-.3px;margin-bottom:12px;line-height:1.55')}>
                  {''}<Jp parts={['いま使っている', 'カレンダーの', '予定を', '持ってくる']} />
                </div>
                <div style={s('font-size:14px;color:var(--ink-soft);line-height:1.95')}>
                  {''}<Jp parts={['iPhone のカレンダーに', '入っている予定を', '読み込んで、', 'このアプリに', '並べます。']} />
                </div>
                <div style={s('font-size:14px;color:var(--ink-soft);line-height:1.95;margin-top:2px')}>
                  {''}<Jp parts={['はじめから', '作り直さなくて', '済みます。']} />
                </div>

                <div style={s('margin-top:22px;background:rgba(29,158,117,.08);border:1px solid rgba(29,158,117,.28);border-radius:17px;padding:14px 16px')}>
                  <div style={s('font-size:13px;font-weight:700;color:#0F6E56;margin-bottom:7px')}>「フルアクセス」を選んでください</div>
                  <div style={s('font-size:12.5px;color:var(--ink-soft);line-height:1.9')}>
                    {''}<Jp parts={['iPhone が', '「追加のみ」と', '「フルアクセス」を', '聞いてきます。', '予定を読むには', 'フルアクセスが要ります。', '「追加のみ」だと', '読み込めません。']} />
                  </div>
                </div>

                <div style={s('margin-top:14px;background:var(--card);border-radius:17px;padding:16px 18px;border:1px solid var(--line)')}>
                  <div style={s('font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px')}>読むだけです</div>
                  <div style={s('font-size:12.5px;color:var(--ink-soft);line-height:1.95')}>
                    {['あなたのカレンダーに書き込むことはありません', '読んだ予定はこの端末の中だけに保存されます', '外部に送られることはありません'].map((t, i) => (
                      <div key={i} style={s('display:flex;gap:6px')}>
                        <span>・</span><span style={s('flex:1')}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!!v.impError && (
                  <div style={s('margin-top:18px')}>
                    <div style={s('font-size:13px;color:#A8452B;line-height:1.9;text-wrap:pretty')}>{v.impError}</div>
                    {v.impDenied && (
                      <div style={s('margin-top:14px;padding:14px;border-radius:17px;border:1px solid var(--line);background:var(--card);text-align:center;font-size:15px;font-weight:700;color:var(--ink);cursor:pointer')} onClick={v.onOpenSettingsApp}>
                        設定アプリを開く
                      </div>
                    )}
                  </div>
                )}

                <div style={s(`margin-top:26px;padding:16px;border-radius:17px;text-align:center;font-size:16px;font-weight:700;cursor:pointer;background:${v.impPhase === 'scanning' ? 'var(--bg2)' : 'var(--ink)'};color:${v.impPhase === 'scanning' ? 'var(--ink-mut)' : 'var(--card)'}`)} onClick={v.impPhase === 'scanning' ? undefined : v.onScan}>
                  {v.impPhase === 'scanning' ? '読み込んでいます…' : 'カレンダーを読む'}
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
            <span role="button" aria-label="戻る" style={s('font-size:22px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onDocBack}>←</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink)')}>{v.docTitle}</span>
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
            <span role="button" aria-label="戻る" style={s('font-size:22px;line-height:1;color:var(--ink-mut);cursor:pointer;padding:6px 12px 6px 0;user-select:none')} onClick={v.onNoticesBack}>←</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink);white-space:nowrap')}>お知らせ</span>
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
                  <span style={s('font-size:16px;color:var(--ink-faint);flex-shrink:0')}>›</span>
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
                <div style={s('font-size:17px;font-weight:700;color:var(--ink);line-height:1.55;text-wrap:pretty')}>{v.nsTitle}</div>
                <div style={s('font-size:14px;color:var(--ink-soft);margin-top:10px;line-height:1.9;text-align:justify')}>{v.nsBody}</div>
                <div style={s('display:flex;gap:8px;margin-top:20px')}>
                  <div style={s('flex:1;text-align:center;padding:13px;border-radius:14px;background:var(--bg2);color:var(--ink-soft);font-size:15px;font-weight:600;cursor:pointer')} onClick={v.onNoticeSheetClose}>閉じる</div>
                  {!!v.nsActionLabel && (
                    <div style={s('flex:1;text-align:center;padding:13px;border-radius:14px;background:#1D9E75;color:#fff;font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onNoticeAction}>{v.nsActionLabel}</div>
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
            <span style={s('font-size:15px;letter-spacing:-2px;line-height:24px;height:24px;display:flex;align-items:center')}>
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

import React from 'react';
import { s } from './style';

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
              <div style={s('display:flex;align-items:baseline;gap:7px')}>
                <span style={s('font-size:28px;font-weight:700;color:var(--ink);letter-spacing:-.5px')}>{v.monthLabel}月</span>
                <span style={s('font-size:14px;font-weight:500;color:var(--ink-mut)')}>{v.year}</span>
              </div>
              <span role="button" aria-label="次の月" tabIndex={0} style={s('width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onNextMonth}>›</span>
            </div>
            <div style={s('display:flex;align-items:center;gap:12px')}>
              <div style={s('width:34px;height:34px;border-radius:9px;background:var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative')} onClick={v.onBell}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3a5 5 0 0 0-5 5c0 5-2 6-2 6h14s-2-1-2-6a5 5 0 0 0-5-5Z" stroke="var(--ink-soft)" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M10 20a2 2 0 0 0 4 0" stroke="var(--ink-soft)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {v.bellDot && <span style={s('position:absolute;top:5px;right:6px;width:7px;height:7px;border-radius:4px;background:var(--ink-mut);border:1.5px solid var(--bg)')} />}
              </div>
              <div style={s('display:flex;align-items:center;gap:8px')} onClick={v.onToggleWage}>
                <span style={s(`font-size:13px;font-weight:600;color:${v.wageLabelColor}`)}>給料</span>
                <div style={s(v.wageTrackStyle)}><div style={s(v.wageKnobStyle)} /></div>
              </div>
            </div>
          </div>

          <div style={s('display:grid;grid-template-columns:repeat(7,1fr);padding:8px 6px 4px 6px')}>
            {(v.weekdays || []).map((w, i) => (
              <div key={i} style={s(w.style)}>{w.label}</div>
            ))}
          </div>

          <div className="month-scroll" style={s('flex:1;overflow-y:auto;padding:0 6px 104px 6px;display:flex;flex-direction:column')} onTouchStart={v.onMonthTouchStart} onTouchEnd={v.onMonthTouchEnd}>
            <div style={s('display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:minmax(86px,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;flex:1 0 auto')}>
              {(v.cells || []).map((c, i) => (
                <div key={i} style={s(c.style)} onClick={c.onDay}>
                  {!!c.day && (
                    <div style={s(c.numWrap)}><span style={s(c.numStyle)}>{c.day}</span></div>
                  )}
                  {(c.pills || []).map((p, j) => (
                    <div key={j} style={s(p.style)} onClick={p.onClick}>
                      {p.morphing && <span style={s(p.fillStyle)} />}
                      <span style={s(p.textStyle)}>{p.text}</span>
                    </div>
                  ))}
                  {c.hasMore && (
                    <div style={s('font-size:10px;font-weight:600;color:var(--ink-mut);padding:1px 5px')}>{c.moreText}</div>
                  )}
                </div>
              ))}
            </div>

            {v.showFirstRunHint && (
              <div style={s('display:flex;flex-direction:column;align-items:center;gap:10px;padding:30px 34px 8px;text-align:center')}>
                <div style={s('display:flex;align-items:center;gap:8px')}>
                  <span style={s('display:inline-block;width:52px;height:15px;border-radius:5px;background:#1D9E75')} />
                  <span style={s('display:inline-block;width:52px;height:15px;border-radius:5px;background:rgba(29,158,117,.10);border:1.4px dashed #1D9E75')} />
                </div>
                <div style={s('font-size:13px;color:var(--ink-soft);line-height:1.7;text-wrap:pretty')}>
                  決まっている予定は塗り、<br />まだ分からない予定は点線で並びます。
                </div>
                <div style={s('font-size:12px;color:var(--ink-faint)')}>＋ から最初の予定を置いてみてください</div>
              </div>
            )}
          </div>

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
            <span style={s('font-size:16px;color:var(--ink-mut);cursor:pointer')} onClick={v.onDayBack}>← {v.monthLabel}月</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink)')}>{v.dayTitle}</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:8px 16px 40px 16px;animation:slideIn .28s cubic-bezier(.2,.9,.2,1)')}>
            {v.dayEmpty && (
              <div style={s('text-align:center;color:var(--ink-faint);font-size:14px;padding:48px 0')}>この日の予定はまだありません</div>
            )}
            {(v.dayEvents || []).map((r, i) => (
              <div key={i} style={s('display:flex;align-items:center;gap:12px;background:var(--card);border-radius:12px;padding:14px;margin-bottom:9px;border:1px solid var(--line);cursor:pointer')} onClick={r.onClick}>
                <div style={s(r.chipStyle)}>{r.chipText}</div>
                <div style={s('flex:1')} />
                <div style={s('display:flex;flex-direction:column;align-items:flex-end;gap:2px')}>
                  <span style={s('font-size:14px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{r.timeText}</span>
                  <span style={s('font-size:11px;color:var(--ink-mut)')}>{r.statusWord}</span>
                </div>
              </div>
            ))}
            <div style={s('display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;padding:15px;border-radius:12px;border:1.5px dashed var(--line);color:var(--ink-soft);font-size:15px;font-weight:600;cursor:pointer')} onClick={v.onDayAdd}>＋ 予定を追加</div>
          </div>
        </div>
      )}

      {/* ===================== いつ空いてる？ ===================== */}
      {v.freeShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head-solo" style={s('padding:0 18px 6px;text-align:center')}>
            <span style={s('font-size:16px;font-weight:700;color:var(--ink)')}>いつ空いてる？</span>
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
          <div style={s('flex:1;overflow-y:auto;background:var(--card);border-top:1px solid var(--line);padding-bottom:96px')}>
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
            <div style={s('background:var(--card);border-radius:14px;padding:4px 14px;margin-bottom:18px')}>
              <input value={v.draftTitle} placeholder="タイトル" onChange={v.onTitle} style={s('width:100%;border:none;outline:none;padding:14px 0;font-size:16px;color:var(--ink);background:transparent')} />
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 4px 8px 4px')}>種類</div>
            <div style={s('display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px')}>
              {(v.chips || []).map((ch, i) => (
                <div key={i} style={s(ch.style)} onClick={ch.onClick}>{ch.label}</div>
              ))}
              <div style={s(v.addChipStyle)} onClick={v.onAddTypeChip}>＋ 種類</div>
            </div>

            {v.newTypeShown && (
              <div style={s('background:var(--card);border-radius:12px;padding:14px;margin-bottom:16px;border:1px solid var(--line);animation:riseUp .24s cubic-bezier(.2,.9,.2,1)')}>
                <input value={v.newTypeName} placeholder="種類の名前（例：ジム、勉強）" onChange={v.onNewTypeName} style={s('width:100%;border:none;outline:none;padding:6px 0 12px;font-size:15px;color:var(--ink);border-bottom:1px solid var(--line)')} />
                <div style={s('display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 6px')}>
                  {(v.newTypeSwatches || []).map((sw, i) => (
                    <div key={i} style={s(sw.style)} onClick={sw.onClick} />
                  ))}
                </div>
                <div style={s('display:flex;gap:8px;margin-top:14px')}>
                  <div style={s('flex:1;text-align:center;padding:11px;border-radius:10px;background:var(--bg2);color:var(--ink-soft);font-size:14px;font-weight:600;cursor:pointer')} onClick={v.onCancelNewType}>やめる</div>
                  <div style={s(v.addTypeBtnStyle)} onClick={v.onAddType}>この種類を追加</div>
                </div>
              </div>
            )}

            <div style={s('display:flex;align-items:center;gap:9px;margin:0 2px 20px 2px')}>
              <span style={s('font-size:11px;color:var(--ink-mut)')}>色</span>
              {(v.recolorSwatches || []).map((sw, i) => (
                <div key={i} style={s(sw.style)} onClick={sw.onClick} />
              ))}
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 4px 8px 4px')}>この予定は</div>
            <div style={s('display:flex;background:var(--bg2);border-radius:10px;padding:2px;margin-bottom:22px')}>
              {(v.seg || []).map((sg, i) => (
                <div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>
              ))}
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 4px 8px 4px')}>日付</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:22px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:15px 16px;cursor:pointer')} onClick={v.onTapDate}>
                <span style={s('font-size:15px;color:var(--ink)')}>日にち</span>
                <span style={s(`font-size:16px;font-weight:${v.dateOpen ? '700' : '600'};color:${v.dateOpen ? '#1D9E75' : 'var(--ink)'};font-variant-numeric:tabular-nums`)}>{v.dateLabel}</span>
              </div>
              {v.dateOpen && (
                <div style={s('padding:2px 12px 14px;background:var(--bg2)')}>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:6px 2px 8px')}>
                    <span role="button" aria-label="前の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onDatePrev}>‹</span>
                    <span style={s('font-size:14px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.datePickLabel}</span>
                    <span role="button" aria-label="次の月" style={s('width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onDateNext}>›</span>
                  </div>
                  <div style={s('display:grid;grid-template-columns:repeat(7,1fr)')}>
                    {(v.dateWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
                  </div>
                  <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:2px')}>
                    {(v.dateCells || []).map((c, i) => (
                      <div key={i} style={s(c.style)} onClick={c.onClick}>{c.label}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 4px 8px 4px')}>時間</div>
            <div style={s('display:flex;background:var(--bg2);border-radius:10px;padding:2px;margin-bottom:16px')}>
              {(v.spanSeg || []).map((sg, i) => (
                <div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>
              ))}
            </div>

            {v.timed && (
              <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:22px')}>
                {(v.timeRows || []).map((r, i) => (
                  <div key={i} style={s(r.rowStyle)}>
                    <div style={s('display:flex;align-items:center;justify-content:space-between;padding:15px 16px;cursor:pointer')} onClick={r.onTap}>
                      <span style={s('font-size:15px;color:var(--ink)')}>{r.label}</span>
                      <span style={s(r.valStyle)}>{r.value}</span>
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
              </div>
            )}
            {v.allDayShown && (
              <div style={s('background:var(--card);border-radius:14px;padding:16px;margin-bottom:22px;font-size:14px;color:var(--ink-mut);text-align:center')}>この予定は終日として置かれます</div>
            )}

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 4px 8px 4px')}>カレンダーでの見え方</div>
            <div style={s('background:var(--card);border-radius:14px;padding:14px;border:1px solid var(--line)')}>
              <div style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden')}>
                {(v.previewDays || []).map((pd, i) => (
                  <div key={i} style={s(pd.cellStyle)}>
                    <div style={s(pd.numStyle)}>{pd.date}</div>
                    {(pd.pills || []).map((pp, j) => (
                      <div key={j} style={s(pp.style)}>{pp.text}</div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={s('display:flex;align-items:center;gap:7px;margin-top:12px')}>
                <span style={s(v.previewDotStyle)} />
                <span style={s('font-size:13px;color:var(--ink);text-wrap:pretty')}>{v.previewExplain}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SHIFT DETAIL ===================== */}
      {v.detailShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span style={s('font-size:16px;color:var(--ink-mut);cursor:pointer')} onClick={v.onBack}>←</span>
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
                {!!v.dWantText && (
                  <div style={s('font-size:12px;color:var(--ink-mut);margin-top:3px')}>{v.dWantText}</div>
                )}

                {v.dWageShown && (
                  <div style={s('margin-top:22px;padding-top:18px;border-top:1px solid var(--line);animation:riseUp .32s cubic-bezier(.2,.9,.2,1)')}>
                    <div style={s('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px')}>
                      <span style={s('font-size:13px;color:var(--ink-mut)')}>実働時間</span>
                      <span style={s('font-size:15px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.dWorkHours}</span>
                    </div>
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

      {/* ===================== 削除の確認 ===================== */}
      {v.confirmShown && (
        <div style={s('position:absolute;inset:0;z-index:90;background:rgba(20,20,22,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;animation:scrimIn .2s ease')} onClick={v.onCancelDelete}>
          <div style={s('width:100%;max-width:300px;background:var(--card);border-radius:16px;padding:22px 20px 14px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:dlgIn .28s cubic-bezier(.2,.9,.2,1)')} onClick={v.stop}>
            <div style={s('font-size:17px;font-weight:700;color:var(--ink);text-align:center;letter-spacing:-.3px;text-wrap:balance')}>{v.confirmTitle}</div>
            <div style={s('font-size:13px;color:var(--ink-mut);text-align:center;margin:8px 0 20px;text-wrap:pretty')}>{v.confirmBody}</div>
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <div style={s('padding:14px;border-radius:12px;text-align:center;font-size:16px;font-weight:700;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onConfirmDelete}>削除する</div>
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

            <div style={s('background:var(--bg2);border-radius:12px;overflow:hidden;margin-bottom:6px')}>
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
            <div style={s('text-align:center;margin-bottom:18px;height:16px')}>
              {v.dlgChanged && (
                <span style={s('font-size:12px;color:var(--ink-mut)')}>{v.dlgOrigText} <span style={s('color:#D85A30;font-weight:600')}>→ 変更あり</span></span>
              )}
            </div>

            <div style={s('display:flex;flex-direction:column;gap:9px')}>
              <div style={s(v.dlgPrimaryStyle)} onClick={v.onDlgPrimary}>{v.dlgPrimaryLabel}</div>
              <div style={s('padding:14px;border-radius:12px;text-align:center;font-size:16px;font-weight:600;background:var(--card);color:#A8452B;border:1px solid #EAD9D2;cursor:pointer')} onClick={v.onDlgNakunatta}>無くなった</div>
              <div style={s('padding:12px;text-align:center;font-size:15px;color:var(--ink-mut);cursor:pointer')} onClick={v.onDlgStillMaybe}>まだ分からない</div>
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
              <div style={s('display:flex;align-items:baseline;justify-content:space-between')}>
                <span style={s('font-size:13px;font-weight:600;color:var(--ink-mut);letter-spacing:.5px')}>{v.sumYearMonth}</span>
                <span style={s('font-size:12px;font-weight:600;color:var(--ink-mut)')}>まとめ</span>
              </div>

              <div style={s('display:flex;flex-wrap:wrap;gap:4px;margin:20px 0 22px')}>
                {(v.rhythm || []).map((r, i) => (<div key={i} style={s(r.style)} />))}
              </div>

              <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:2px')}>
                <span style={s('width:24px;height:24px;border-radius:12px;background:#1D9E75;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800')}>✓</span>
                <span style={s('font-size:13px;font-weight:600;color:#085041')}>稼いだ</span>
              </div>
              <div style={s('font-size:46px;font-weight:800;color:var(--ink);letter-spacing:-1.5px;line-height:1.1')}>{v.sumWage}</div>
              <div style={s('font-size:14px;color:var(--ink-mut);margin-top:2px')}>{v.sumHours} 働きました</div>

              <div style={s('height:1px;background:var(--line);margin:22px 0')} />

              <div style={s('display:flex;gap:14px')}>
                <div style={s('flex:1')}>
                  <div style={s('display:flex;align-items:center;gap:6px;margin-bottom:6px')}>
                    <span style={s('width:16px;height:16px;border-radius:8px;background:#D85A30;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800')}>✓</span>
                    <span style={s('font-size:12px;font-weight:600;color:#712B13')}>果たした約束</span>
                  </div>
                  <div style={s('font-size:34px;font-weight:800;color:var(--ink);letter-spacing:-1px')}>{v.sumPromises}</div>
                </div>
                <div style={s('flex:1')}>
                  <div style={s('display:flex;align-items:center;gap:6px;margin-bottom:6px')}>
                    <span style={s('width:16px;height:16px;border-radius:8px;background:#EDEEF0;color:var(--ink-mut);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700')}>×</span>
                    <span style={s('font-size:12px;font-weight:600;color:var(--ink-mut)')}>流れた予定</span>
                  </div>
                  <div style={s('font-size:34px;font-weight:800;color:var(--ink-faint);letter-spacing:-1px')}>{v.sumCanceled}</div>
                </div>
              </div>

              <div style={s('flex:1')} />
              <div style={s('display:flex;align-items:center;gap:8px;padding-top:16px')}>
                <span style={s('font-size:15px;letter-spacing:-2px')}><span style={s('color:#1D9E75')}>✓</span><span style={s('color:#C1C5CC')}>？</span></span>
                <span style={s('font-size:12px;font-weight:600;color:var(--ink-soft);text-wrap:pretty')}>決まってる？ — 予定が一目でわかるカレンダー</span>
              </div>
            </div>

            <div style={s('display:flex;gap:10px;width:100%;max-width:340px;margin-top:18px')}>
              <div style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:14px;border-radius:13px;background:var(--card);color:var(--ink);font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onShareCard}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
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
            <div style={s('width:100%;max-width:340px;background:var(--card);border-radius:22px;box-shadow:0 18px 48px rgba(0,0,0,.5);padding:24px 22px 22px;overflow:hidden')}>
              <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:3px')}>
                <span style={s('width:22px;height:22px;border-radius:7px;background:#D85A30;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800')}>○</span>
                <span style={s('font-size:13px;font-weight:600;color:#D85A30')}>わたしの空いてる日</span>
              </div>
              <div style={s('font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.5px')}>{v.shareMonthLabel}月のあいてる日</div>
              <div style={s('font-size:13px;color:var(--ink-mut);margin:2px 0 18px')}>予定の中身は出していません</div>

              <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:4px')}>
                {(v.shareWeekdays || []).map((w, i) => (<div key={i} style={s(w.style)}>{w.label}</div>))}
              </div>
              <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:5px')}>
                {(v.shareCells || []).map((c, i) => (<div key={i} style={s(c.style)}>{c.label}</div>))}
              </div>

              <div style={s('display:flex;align-items:center;gap:16px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line)')}>
                <div style={s('display:flex;align-items:center;gap:6px')}>
                  <span style={s('width:16px;height:16px;border-radius:5px;background:#FAECE7;border:1.5px solid #D85A30')} />
                  <span style={s('font-size:12px;color:var(--ink-soft)')}>空いてる</span>
                </div>
                <div style={s('display:flex;align-items:center;gap:6px')}>
                  <span style={s('width:16px;height:16px;border-radius:5px;background:#EDEEF0')} />
                  <span style={s('font-size:12px;color:var(--ink-soft)')}>予定あり</span>
                </div>
                <div style={s('flex:1')} />
                <span style={s('font-size:12px;letter-spacing:-2px')}><span style={s('color:#1D9E75')}>✓</span><span style={s('color:#C1C5CC')}>？</span></span>
              </div>
            </div>

            <div style={s('width:100%;max-width:340px;margin-top:14px;font-size:12px;color:rgba(255,255,255,.5);text-align:center;text-wrap:pretty')}>埋まっている日は灰色のマスだけ。何の予定かは相手に伝わりません。</div>

            <div style={s('display:flex;gap:10px;width:100%;max-width:340px;margin-top:16px')}>
              <div style={s('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:14px;border-radius:13px;background:var(--card);color:var(--ink);font-size:15px;font-weight:700;cursor:pointer')} onClick={v.onShareCard}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
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

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>給料</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:24px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px')}>
                <div style={s('display:flex;flex-direction:column;gap:2px')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>時給</span>
                  <span style={s('font-size:11px;color:var(--ink-mut)')}>実働から給料を計算します</span>
                </div>
                <div style={s('display:flex;align-items:center;gap:10px')}>
                  <div style={s(v.stepBtn)} onClick={v.onHourlyMinus}>−</div>
                  <div style={s('display:flex;align-items:center;gap:2px;background:var(--bg2);border-radius:9px;padding:6px 10px')}>
                    <span style={s('font-size:15px;font-weight:700;color:var(--ink-soft)')}>¥</span>
                    <input value={v.setHourly} onChange={v.onHourlyInput} inputMode="numeric" maxLength={5} style={s('width:5ch;min-width:5ch;border:none;outline:none;background:transparent;font-size:16px;font-weight:700;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;font-family:inherit')} />
                  </div>
                  <div style={s(v.stepBtn)} onClick={v.onHourlyPlus}>＋</div>
                </div>
              </div>
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>入力</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:24px')}>
              <div style={s('padding:14px 16px;border-bottom:1px solid var(--line)')}>
                <span style={s('font-size:15px;color:var(--ink)')}>時間の刻み幅</span>
                <div style={s('display:flex;background:var(--bg2);border-radius:9px;padding:2px;margin-top:10px')}>
                  {(v.stepSeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
                </div>
              </div>
              <div style={s('padding:14px 16px')}>
                <span style={s('font-size:15px;color:var(--ink)')}>週のはじまり</span>
                <div style={s('display:flex;background:var(--bg2);border-radius:9px;padding:2px;margin-top:10px')}>
                  {(v.weekSeg || []).map((sg, i) => (<div key={i} style={s(sg.style)} onClick={sg.onClick}>{sg.label}</div>))}
                </div>
              </div>
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>予定の種類</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:8px')}>
              {(v.typeRows || []).map((t, i) => (
                <div key={i} style={s(t.rowStyle)}>
                  <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={t.onTap}>
                    <span style={s(t.dotStyle)} />
                    <span style={s('flex:1;font-size:15px;color:var(--ink)')}>{t.name}</span>
                    <span style={s('font-size:12px;color:var(--ink-faint)')}>{t.hint}</span>
                  </div>
                  {t.open && (
                    <div style={s('display:flex;flex-wrap:wrap;gap:12px;padding:4px 16px 16px')}>
                      {(t.swatches || []).map((sw, j) => (<div key={j} style={s(sw.style)} onClick={sw.onClick} />))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 24px;text-wrap:pretty')}>種類の追加や名前の変更は「＋」の新規作成画面からできます</div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>通知</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:24px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px')}>
                <div style={s('display:flex;flex-direction:column;gap:2px;padding-right:12px')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>シフト後に記録をリマインド</span>
                  <span style={s('font-size:11px;color:var(--ink-mut);text-wrap:pretty')}>終わった時間に「実働どうだった？」を通知</span>
                </div>
                <div style={s(v.remindTrack)} onClick={v.onToggleRemind}><div style={s(v.remindKnob)} /></div>
              </div>
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>表示</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:24px')}>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px')}>
                <div style={s('display:flex;flex-direction:column;gap:2px;padding-right:12px')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>「無くなった」予定を隠す</span>
                  <span style={s('font-size:11px;color:var(--ink-mut);text-wrap:pretty')}>オフなら取り消し線で薄く残します</span>
                </div>
                <div style={s(v.hideTrack)} onClick={v.onToggleHide}><div style={s(v.hideKnob)} /></div>
              </div>
              <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-top:1px solid var(--line)')}>
                <div style={s('display:flex;flex-direction:column;gap:2px;padding-right:12px')}>
                  <span style={s('font-size:15px;color:var(--ink)')}>ダークモード</span>
                  <span style={s('font-size:11px;color:var(--ink-mut);text-wrap:pretty')}>深い墨色の紙に、点線が浮かびます</span>
                </div>
                <div style={s(v.darkTrack)} onClick={v.onToggleDark}><div style={s(v.darkKnob)} /></div>
              </div>
            </div>

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>このアプリについて</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:14px')}>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);cursor:pointer')} onClick={v.onOpenTerms}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>利用規約</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);cursor:pointer')} onClick={v.onOpenPrivacy}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>プライバシーポリシー</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px')}>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>バージョン</span>
                <span style={s('font-size:14px;color:var(--ink-mut);font-variant-numeric:tabular-nums')}>{v.appVersion}</span>
              </div>
            </div>
            <div style={s('font-size:11px;color:var(--ink-faint);margin:0 6px 24px;line-height:1.8;text-wrap:pretty')}>
              予定はこの端末の中だけに保存されます。外部に送られることはありません。
            </div>

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
                働いた記録がまだありません。<br />バイトの予定を確定して、<br />終わったら実働時間をつけると、<br />ここに積み上がっていきます。
              </div>
            ) : (
              <>
                <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>{v.repMonthLabel}</div>
                <div style={s('background:var(--card);border-radius:14px;padding:18px 18px 20px;margin-bottom:22px;border:1px solid var(--line)')}>
                  <div style={s('display:flex;align-items:baseline;gap:8px;margin-bottom:2px')}>
                    <span style={s('font-size:34px;font-weight:800;color:var(--ink);letter-spacing:-.8px;font-variant-numeric:tabular-nums')}>{v.repMonthWage}</span>
                  </div>
                  <div style={s('font-size:13px;color:var(--ink-mut)')}>{v.repMonthHours}・{v.repMonthDays}日</div>
                </div>

                <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>月ごとの働いた時間</div>
                <div style={s('background:var(--card);border-radius:14px;padding:16px 12px 12px;margin-bottom:22px;border:1px solid var(--line)')}>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:0 4px 12px')}>
                    <span role="button" aria-label="前の年" style={s('width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:19px;color:var(--ink-mut);cursor:pointer;user-select:none')} onClick={v.onRepPrevYear}>‹</span>
                    <span style={s('font-size:14px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearLabel}</span>
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
                <div style={s('background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:22px;border:1px solid var(--line)')}>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
                    <span style={s('font-size:14px;color:var(--ink-mut)')}>働いた時間</span>
                    <span style={s('font-size:17px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearHours}</span>
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)')}>
                    <span style={s('font-size:14px;color:var(--ink-mut)')}>働いた日数</span>
                    <span style={s('font-size:17px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearDays}日</span>
                  </div>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;padding:14px 16px')}>
                    <span style={s('font-size:14px;color:var(--ink-mut)')}>稼いだ額</span>
                    <span style={s('font-size:17px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums')}>{v.repYearWage}</span>
                  </div>
                </div>
              </>
            )}

            <div style={s('font-size:12px;font-weight:600;color:var(--ink-mut);margin:0 6px 8px')}>シェア</div>
            <div style={s('background:var(--card);border-radius:14px;overflow:hidden;border:1px solid var(--line)')}>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);cursor:pointer')} onClick={v.onOpenSummaryCard}>
                <span style={s('width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800')}>✓</span>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>今月のまとめカード</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
              <div style={s('display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer')} onClick={v.onOpenFreeShare}>
                <span style={s('width:26px;height:26px;border-radius:7px;background:var(--bg2);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800')}>↗</span>
                <span style={s('flex:1;font-size:15px;color:var(--ink)')}>空いてる日をシェア</span>
                <span style={s('font-size:16px;color:var(--ink-faint)')}>›</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ===================== 規約・プライバシーポリシー ===================== */}
      {v.docShown && (
        <div style={s('display:flex;flex-direction:column;height:100%;background:var(--bg)')}>
          <div className="scr-head" style={s('padding:0 18px 10px 18px')}>
            <span style={s('font-size:16px;color:var(--ink-mut);cursor:pointer')} onClick={v.onDocBack}>← 設定</span>
            <span style={s('font-size:16px;font-weight:600;color:var(--ink)')}>{v.docTitle}</span>
            <span style={s('width:44px')} />
          </div>
          <div style={s('flex:1;overflow-y:auto;padding:14px 22px 60px 22px;animation:slideIn .28s cubic-bezier(.2,.9,.2,1)')}>
            <p style={s('font-size:14px;line-height:1.9;color:var(--ink-soft);margin:0 0 26px;text-wrap:pretty')}>{v.docLead}</p>
            {(v.docSections || []).map((sec, i) => (
              <div key={i} style={s('margin-bottom:26px')}>
                <h2 style={s('font-size:14px;font-weight:700;color:var(--ink);margin:0 0 8px;letter-spacing:.01em')}>{sec.h}</h2>
                {sec.p.map((t, j) => (
                  <p key={j} style={s('font-size:13.5px;line-height:1.95;color:var(--ink-soft);margin:0 0 10px;text-wrap:pretty')}>{t}</p>
                ))}
              </div>
            ))}
            <div style={s('height:1px;background:var(--line);margin:6px 0 14px')} />
            <p style={s('font-size:11.5px;color:var(--ink-faint);margin:0')}>最終更新：{v.docEffective}</p>
          </div>
        </div>
      )}

      {/* ===================== NOTIFICATION BANNER ===================== */}
      {v.notifShown && (
        <div style={s('position:absolute;top:52px;left:10px;right:10px;z-index:70;animation:notifDrop .42s cubic-bezier(.2,.9,.2,1)')}>
          <div style={s('display:flex;align-items:center;gap:12px;background:rgba(250,250,252,.86);backdrop-filter:blur(22px);border:.5px solid rgba(0,0,0,.06);border-radius:20px;padding:13px 15px;box-shadow:0 10px 34px rgba(0,0,0,.22);cursor:pointer')} onClick={v.onNotifOpen}>
            <div style={s('width:40px;height:40px;border-radius:10px;background:#1D9E75;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(8,80,65,.4)')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="#fff" strokeWidth="1.7" />
                <path d="M3.5 9h17" stroke="#fff" strokeWidth="1.7" />
                <path d="M8.5 14.5l2.2 2.2 4.3-4.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={s('flex:1;min-width:0')}>
              <div style={s('display:flex;align-items:baseline;justify-content:space-between;gap:8px')}>
                <span style={s('font-size:14px;font-weight:700;color:var(--ink)')}>{v.notifTitle}</span>
                <span style={s('font-size:11px;color:var(--ink-mut);flex-shrink:0')}>たった今</span>
              </div>
              <div style={s('font-size:13px;color:#4A4F57;margin-top:2px;text-wrap:pretty')}>{v.notifBody}</div>
            </div>
          </div>
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
          <div style={s('display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex:1')} onClick={v.onFab}>
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

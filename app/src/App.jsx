import React from 'react';
import { renderApp } from './view.jsx';
import { tapLight, penTick, settleSuccess, stampHeavy } from './haptics';
import { demoEvents, wantsDemo } from './demo';
import { readLocal, readFile, saveLocal, saveFile } from './store';
import { endsNextDay, busyEndMin } from './whenlib';
import { loadTips, buyTip, probeTips, TIPS } from './tipjar';
import { syncReminders, onNotificationTap } from './notify';
import { drawSummaryCard, drawFreeCard } from './sharecard';
import { DOCS, EFFECTIVE, CONTACT, APP_NAME, APP_STORE_ID } from './docs';
import { applyStatusBarTheme } from './statusbar';
import { canImport, askCalendarAccess, checkCalendarAccess, readCalendarEvents, dedupe, guessTypes, openAppSettings } from './calendarimport';
import { holidayName } from './holidays';
import { syncShiftNotices, syncInfoNotices, unreadCount, sortNotices, relativeTime, KIND_SHIFT } from './notices';

// 曜日と祝日の色。紙の上で浮きすぎないよう、どちらも少し落ち着かせた色にする。
const HOLIDAY_RED = '#B4453A'; // 祝日と日曜
const SATURDAY_BLUE = '#3D6E9C'; // 土曜

// 予定の塗りをどれだけ白に寄せるか。0 = 原色のまま、0.45 くらいでかなり淡い。
const FILL_SOFT = 0.32;
import { shareCanvas, shareText } from './shareimg';

// v2 から予定に y/m（実日付）を持たせた。旧形式は読み込まない。
// 保存は store.js に閉じている（localStorage とファイルの二重書き）

// 予定は y（西暦）・m（0始まりの月）・day で持つ。表示中の月も同じ形。
// days は「その日から何日続くか」。無いか 1 なら1日だけの予定。
// 日またぎは終日の予定にだけ許す（時間指定はバイトの実働・給料が1日単位のため）。

// 日付を通し番号にする。UTC で数えるので夏時間や時差の影響を受けない。
const dayNo = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);
const fromDayNo = (n) => {
  const t = new Date(n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
};
// 60日を上限にしておく。壊れたデータでカレンダーが埋まらないように。
const evSpan = (e) => Math.max(1, Math.min(60, (e && e.days) | 0 || 1));
const evFrom = (e) => dayNo(e.y, e.m, e.day);
const evTo = (e) => evFrom(e) + evSpan(e) - 1;
// その日を覆っているか
const evCovers = (e, n) => n >= evFrom(e) && n <= evTo(e);

// 月表示のマスに積める帯の段数。これを超えたぶんは「+N件」に回す。
// 段が空のときは何も描かないので、増やしても普段の見た目は変わらない。
// 3 だとマスの下 3分の1 が構造的に余っていたので、そこまで使い切る。
// （6週の月でも 22 + 17×4 + 13 = 103px で収まる）
const MAX_LANES = 4;

// 月表示の帯の高さと文字の大きさ。ここを変えると段の高さも一緒に付いてくる。
const MONTH_BAR_H = 15;
const MONTH_BAR_FS = 10;
const MONTH_LANE_H = MONTH_BAR_H + 2; // 帯と帯のあいだの隙間ぶん

// 時計の分の刻み。ホイールで選ぶので粗くする意味がなく、5分で固定する。
// （以前は設定の「時間の刻み幅」で変えられたが、既定の30分だと 17:20 が選べなかった）
const MIN_STEP = 5;

// くり返しは「規則」ではなく、その場で予定の実体を並べて作る。
// 1回ごとに確定／未確定が違うのがこのアプリの要なので、
// あとから1件だけ直せない形（規則で持つ形）にはできない。
const REPEAT_UNITS = [
  { key: 'day', label: '毎日' },
  { key: 'week', label: '毎週' },
  { key: 'month', label: '毎月' },
  { key: 'year', label: '毎年' },
];
// いつまで続けるかは「月数」で持つ。単位ごとに現実的な長さだけ出す——
// 毎日で2年を選べてしまうと 730 件になり、上限で黙って切られる。
const REPEAT_SPANS = {
  day: [{ m: 1, label: '1か月' }, { m: 3, label: '3か月' }, { m: 6, label: '半年' }],
  week: [{ m: 1, label: '1か月' }, { m: 3, label: '3か月' }, { m: 6, label: '半年' }, { m: 12, label: '1年' }],
  month: [{ m: 6, label: '半年' }, { m: 12, label: '1年' }, { m: 24, label: '2年' }],
  year: [{ m: 36, label: '3年' }, { m: 60, label: '5年' }],
};
const spansFor = (every) => REPEAT_SPANS[every] || REPEAT_SPANS.week;
const MAX_REPEAT = 200;

// 本体の日のあとに続く日を、日番号の配列で返す（本体そのものは含まない）。
// 月と年は日数で刻めないので、暦の上で進める。
// 「毎月31日」の2月のように、その月に無い日は飛ばす。
// 近い日に寄せると、頼んでいない日付に予定が置かれることになる。
const repeatAfter = (y, m, d, every, spanMonths, dows) => {
  if (!REPEAT_UNITS.some((u) => u.key === every)) return [];
  const fromN = dayNo(y, m, d);
  const limitN = dayNo(y, m + (spanMonths | 0), d);
  const out = [];
  const push = (n) => { if (n > fromN && n <= limitN && out.length < MAX_REPEAT) out.push(n); };

  if (every === 'day') {
    for (let n = fromN + 1; n <= limitN && out.length < MAX_REPEAT; n++) out.push(n);
    return out;
  }
  if (every === 'week') {
    // 曜日を選んでいれば、その曜日を毎週。選んでいなければ本体と同じ曜日。
    const want = (dows && dows.length) ? dows : [new Date(y, m, d).getDay()];
    for (let n = fromN + 1; n <= limitN && out.length < MAX_REPEAT; n++) {
      const o = fromDayNo(n);
      if (want.includes(new Date(o.y, o.m, o.d).getDay())) out.push(n);
    }
    return out;
  }
  const step = every === 'month' ? 1 : 12;
  for (let i = step; out.length < MAX_REPEAT; i += step) {
    const t = new Date(y, m + i, 1);
    const dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    if (dayNo(t.getFullYear(), t.getMonth(), 1) > limitN) break;
    if (d > dim) continue; // その月に無い日（2月31日など）は置かない
    push(dayNo(t.getFullYear(), t.getMonth(), d));
    if (dayNo(t.getFullYear(), t.getMonth(), Math.min(d, dim)) > limitN) break;
  }
  return out;
};

// 予定につける名前（id）。時刻だけで作ると、端末の時計を戻したときや、
// いつか誰かとカレンダーを混ぜるときに、別々の予定が同じ名前になりうる。
// 混ぜる側は名前で見分けるしかないので、ぶつかると黙って片方が消える。
// 5文字の乱数を足しておけば、あとから何をしても困らない。
const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 保存されている予定に壊れたものが1件でも混じると、描いている途中で落ちる。
// しかも壊れたまま保存されているので、開き直しても同じところで落ちる——
// アプリを消すまで戻れなくなる。読むときに必ずここを通す。
//
// 捨てるのは「日付が読めないもの」だけにする。それ以外は直して残す。
// 利用者の予定を黙って消すほうが、表示が少し変になるより悪い。
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const fixTime = (t, fallback) => (typeof t === 'string' && HHMM.test(t) ? t : fallback);
const sanitizeEvents = (list) => {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    if (!isNum(e.y) || !isNum(e.m) || !isNum(e.day)) continue;
    if (e.m < 0 || e.m > 11 || e.day < 1 || e.day > 31) continue;
    const start = fixTime(e.start, '09:00');
    out.push({
      ...e,
      id: typeof e.id === 'string' && e.id ? e.id : uid('x'),
      title: typeof e.title === 'string' ? e.title : '無題',
      start,
      end: fixTime(e.end, start),
      actualEnd: typeof e.actualEnd === 'string' && HHMM.test(e.actualEnd) ? e.actualEnd : undefined,
      want: Array.isArray(e.want) && e.want.length === 2 ? e.want : undefined,
    });
  }
  return out;
};
// 種類は色を引くのに使う。1つでも形が違うと月表示が丸ごと落ちるので、
// 揃っていなければ既定に戻す（数が少なく、作り直すのも簡単なため）
const typesOk = (list) => Array.isArray(list) && list.length > 0 && list.every(
  (t) => t && typeof t.key === 'string' && typeof t.name === 'string' && typeof t.color === 'string'
);
// 応援の記録。壊れていても起動を止めない（ここで落ちたら本末転倒）
const sanitizeSupports = (list) => (Array.isArray(list) ? list.filter(
  (x) => x && typeof x === 'object' && isNum(x.yen) && isNum(x.at)
) : []);

const sanitizeJobs = (list) => (Array.isArray(list) ? list.filter(
  (j) => j && typeof j.id === 'string' && isNum(j.hourly)
) : []);

// 保存済みの種類に、組み込みの種類の項目を埋め戻す。
// 種類に新しい項目（既定の時間帯など）を足しても、すでに使っている人の
// 保存データには入っていない。合成しないと、新しい項目が誰にも届かない。
// 名前と色は本人が変えている可能性があるので、保存側を優先する。
const mergeTypes = (saved, builtin) => {
  const filled = saved.map((t) => {
    const base = builtin.find((b) => b.key === t.key);
    return base ? { ...base, ...t } : t;
  });
  // 並び順も組み込みに合わせる。並びは画面のチップの順そのものなので、
  // 先頭を入れ替えたら、すでに使っている人にも届かないと意味がない。
  // 自分で足した種類は、足した順のまま後ろに置く。
  const order = (k) => { const i = builtin.findIndex((b) => b.key === k); return i < 0 ? 999 : i; };
  return filled
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (order(a.t.key) - order(b.t.key)) || (a.i - b.i))
    .map((x) => x.t);
};

const todayParts = () => {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
};
const thisMonth = () => {
  const t = todayParts();
  return { y: t.y, m: t.m };
};
// 「いつ空いてる？」の手動○△✕は月をまたいでも衝突しないようにキーを作る
const dayKey = (y, m, d) => y + '-' + m + '-' + d;
// 月を n ヶ月ずらす
const shiftMonth = (ym, n) => {
  const d = new Date(ym.y, ym.m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

// 表示ロジック（renderVals ほか）は Claude design で作った実装をそのまま使っている。
// このクラスに足しているのは「保存」と「テーマ反映」と render() だけ。
export default class App extends React.Component {
  constructor(props) {
    super(props);
    // クラスフィールド（state など）は super() 直後に初期化済みなので、ここで上書きできる
    try {
      const saved = readLocal();
      if (saved) {
        this._hadLocal = true;
        this.state = {
          ...this.state,
          events: sanitizeEvents(saved.events),
          types: typesOk(saved.types) ? mergeTypes(saved.types, this.state.types) : this.state.types,
          overrides: saved.overrides || this.state.overrides,
          // すでに使っている人には案内を出さない
          settings: { ...this.state.settings, onboarded: true, ...(saved.settings || {}) },
          notices: saved.notices || this.state.notices,
          lastSeenVersion: saved.lastSeenVersion || null,
          jobs: sanitizeJobs(saved.jobs),
          supports: sanitizeSupports(saved.supports),
        };
      }
    } catch (e) {
      // 保存データが壊れていても起動は止めない
    }
  }

  PAL = ['#1D9E75','#534AB7','#D85A30','#2F72C4','#C43C7A','#C99A16','#5A6570','#3B8E8A'];
  ITEM = 34;
  // stable wheel ref + scroll callbacks (identity fixed so scroll position survives re-renders)
  refStartH=(n)=>this._attach(n,'start','h'); refStartM=(n)=>this._attach(n,'start','m');
  refEndH=(n)=>this._attach(n,'end','h');     refEndM=(n)=>this._attach(n,'end','m');
  scStartH=(e)=>this._onWheel(e,'start','h'); scStartM=(e)=>this._onWheel(e,'start','m');
  scEndH=(e)=>this._onWheel(e,'end','h');     scEndM=(e)=>this._onWheel(e,'end','m');
  _attach(node,field,unit){ if(!node || node.dataset.pos==='1') return; const [h,m]=this.state.draft[field].split(':').map(Number); const step=MIN_STEP; node.scrollTop=(unit==='h'?h:Math.round(m/step))*this.ITEM; node.dataset.pos='1'; }
  _onWheel(e,field,unit){ if(this['_t'+field+unit]) return; this['_t'+field+unit]=requestAnimationFrame(()=>{ this['_t'+field+unit]=0; const step=MIN_STEP; const idx=Math.round(e.target.scrollTop/this.ITEM); let [h,m]=this.state.draft[field].split(':').map(Number); if(unit==='h') h=Math.min(23,Math.max(0,idx)); else m=Math.min(60-step,Math.max(0,idx*step)); const nv=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); if(nv!==this.state.draft[field]) this.setState(s=>({draft:{...s.draft,[field]:nv}})); }); }
  // dialog wheels (operate on state.dialog)
  dRefStartH=(n)=>this._dAttach(n,'start','h'); dRefStartM=(n)=>this._dAttach(n,'start','m');
  dRefEndH=(n)=>this._dAttach(n,'end','h');     dRefEndM=(n)=>this._dAttach(n,'end','m');
  dScStartH=(e)=>this._dWheel(e,'start','h'); dScStartM=(e)=>this._dWheel(e,'start','m');
  dScEndH=(e)=>this._dWheel(e,'end','h');     dScEndM=(e)=>this._dWheel(e,'end','m');
  _dAttach(node,field,unit){ if(!node || node.dataset.pos==='1' || !this.state.dialog) return; const step=MIN_STEP; const set=()=>{ if(!this.state.dialog) return; const [h,m]=this.state.dialog[field].split(':').map(Number); node.scrollTop=(unit==='h'?h:Math.round(m/step))*this.ITEM; }; node.dataset.pos='1'; set(); requestAnimationFrame(set); }
  _dWheel(e,field,unit){ if(this['_d'+field+unit]) return; this['_d'+field+unit]=requestAnimationFrame(()=>{ this['_d'+field+unit]=0; if(!this.state.dialog) return; const step=MIN_STEP; const idx=Math.round(e.target.scrollTop/this.ITEM); let [h,m]=this.state.dialog[field].split(':').map(Number); if(unit==='h') h=Math.min(23,Math.max(0,idx)); else m=Math.min(60-step,Math.max(0,idx*step)); const nv=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); if(nv!==this.state.dialog[field]) this.setState(s=>({dialog:{...s.dialog,[field]:nv}})); }); }

  state = {
    screen:'month', wageOn:false, dialog:null, detailId:null, dayNum:null, returnTo:'month',
    newType:null, overrides:{}, notif:null, editTypeKey:null, docKey:null, confirmDelete:null,
    imp:{ phase:'idle', found:[], type:'yoji', error:'' },
    swipe:{ dx:0, animating:false },
    swipeRow:null, // 一覧で左へ開いている行 {id,dx,animating}
    notices:[], lastSeenVersion:null, noticeOpen:null,
    // バイト先。名前と時給を持つ。予定に紐づけると、その時給で計算する。
    jobs:[], editJobId:null, newJob:null, supports:[],
    ym: thisMonth(),      // カレンダーで表示している月
    freeYM: thisMonth(),  // 「いつ空いてる？」で見ている月
    freeDir: 0,           // 直前に月を送った向き（滑り込む向きに使う）
    today: todayParts(),
    shareChoices:{ o1:null, o2:null, o3:null }, shareSubmitted:false, shareToast:false, shareMsg:'', morph:null,
    settings:{ hourly:1120, weekStart:0, remind:true, hideCanceled:false, dark:false, onboarded:false },
    // はじめての案内。step は 0=しくみ 1=時給 2=取り込み
    onboard:{ step:0, demo:'dash' },
    draft:{ title:'', type:'yoji', status:'kakutei', start:'10:00', end:'11:00', y:todayParts().y, m:todayParts().m, day:todayParts().d, allDay:false, picking:null },
    // 並び順がそのまま画面のチップの並びになる。既定が用事なので、用事を先頭に置く。
    types:[
      {key:'yoji',  name:'用事',   color:'#534AB7', paper:'rgba(238,237,254,.72)', dark:'#3C3489', uWord:'まだ分からない用事', cWord:'確定した用事'},
      {key:'baito', name:'バイト', color:'#1D9E75', paper:'rgba(225,245,238,.72)', dark:'#085041', uWord:'希望シフト', cWord:'確定シフト', defStart:'17:00', defEnd:'22:00'},
      {key:'asobi', name:'遊び',   color:'#D85A30', paper:'rgba(250,236,231,.72)', dark:'#712B13', uWord:'候補日', cWord:'約束'},
      {key:'other', name:'その他', color:'#5A6570', paper:'rgba(233,235,238,.72)', dark:'#374151', uWord:'未確定の予定', cWord:'予定'},
    ],
    events: [],
  };

  // ---- lookups & color ----
  T(key){ return this.state.types.find(t=>t.key===key) || this.state.types[0]; }
  _h(hex){ hex=hex.replace('#',''); return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)); }
  _mix(a,b,t){ const A=this._h(a),B=this._h(b); return A.map((v,i)=>Math.round(v+(B[i]-v)*t)); }
  paperFrom(hex){ const l=this._mix(hex,'#ffffff',.84); return `rgba(${l[0]},${l[1]},${l[2]},.72)`; }
  darkFrom(hex){ const d=this._mix(hex,'#000000',.5); return `rgb(${d[0]},${d[1]},${d[2]})`; }
  // 塗りの濃さ。白に寄せるほど紙になじむ。FILL_SOFT の一箇所で全体が変わる。
  softFill(hex){ const l=this._mix(hex,'#ffffff',FILL_SOFT); return `rgb(${l[0]},${l[1]},${l[2]})`; }
  softLine(hex){ const l=this._mix(hex,'#ffffff',FILL_SOFT*0.5); return `rgb(${l[0]},${l[1]},${l[2]})`; }
  // 薄い塗りの上に置く文字。読みやすさを保つために濃いめにする。
  inkOn(hex){ const d=this._mix(hex,'#000000',.58); return `rgb(${d[0]},${d[1]},${d[2]})`; }

  // ---- time ----
  mins(s){ const [h,m]=s.split(':').map(Number); return h*60+m; }
  addMin(s,d){ let x=(this.mins(s)+d+1440)%1440; return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0'); }
  hoursBetween(a,b){ let d=this.mins(b)-this.mins(a); if(d<0)d+=1440; return d/60; }
  fmtWage(n){ return '¥'+n.toLocaleString('ja-JP'); }
  // その予定に使う時給。バイト先が決まっていればその時給、なければ設定の時給。
  hourlyFor(ev){
    const j = ev && ev.jobId ? (this.state.jobs||[]).find(x=>x.id===ev.jobId) : null;
    return j ? j.hourly : this.state.settings.hourly;
  }
  // 休憩は何分か。持っていなければ 0。
  breakMin(ev){ const n=ev&&ev.breakMin; return typeof n==='number'&&n>0 ? Math.min(600,n) : 0; }
  /**
   * 給料の対象になる時間。
   * 「開始〜終わり」から休憩を引く。時間や金額を出すところは必ずここを通す
   * （引き忘れると、休憩が時給に入らない勤務先で金額が多めに出る）。
   */
  paidHours(ev){
    const end = ev.actualEnd || ev.end;
    return Math.max(0, this.hoursBetween(ev.start, end) - this.breakMin(ev)/60);
  }
  wage(ev){ if(ev.type!=='baito')return 0; return Math.round(this.paidHours(ev)*this.hourlyFor(ev)); }
  fmtHours(h){ const H=Math.floor(h); const M=Math.round((h-H)*60); return M? H+'時間'+M+'分' : H+'時間'; }
  fmtMin(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
  // お知らせの「いつ」を短い言葉にする。行にたたんだときの値にも、詳細画面にも使う。
  remindLabel(min, allDay){
    if(typeof min!=='number') return 'なし';
    if(allDay) return min===0 ? '当日の朝' : (min/1440)+'日前';
    if(min>=1440) return (min/1440)+'日前';
    if(min>=60) return Math.round(min/60)+'時間前';
    return min+'分前';
  }
  // 日またぎの範囲を「8/25〜8/27」の形にする。年をまたぐときだけ年を添える。
  spanLabel(ev){
    const a=fromDayNo(evFrom(ev)), b=fromDayNo(evTo(ev));
    return (a.m+1)+'/'+a.d+'〜'+(b.y!==a.y?b.y+'/':'')+(b.m+1)+'/'+b.d;
  }
  freeJudge(evs){
    if(!evs.length) return {mark:'○'};
    const conf=evs.filter(e=>e.status==='kakutei'||e.status==='jisseki');
    const unc=evs.filter(e=>e.status==='mikakutei');
    if(!conf.length){ const u=unc[0]; return {mark:'△',variant:'adjust',note:u.type==='baito'?'まだ希望を出しただけです':'まだ候補なので調整できます'}; }
    if(conf.some(e=>e.allDay)) return {mark:'×'};
    const WS=540, WE=1320;
    // 日をまたぐ勤務は、その日は24時までふさがっている。
    // そのまま [22:00, 1:00] と置くと前後が逆になり、重なりの計算が崩れる。
    const iv=conf.map(e=>[this.mins(e.start), busyEndMin(e)]).sort((a,b)=>a[0]-b[0]);
    const merged=[]; iv.forEach(x=>{ const last=merged[merged.length-1]; if(last&&x[0]<=last[1]) last[1]=Math.max(last[1],x[1]); else merged.push([x[0],x[1]]); });
    const full = merged.length===1 && merged[0][0]<=WS && merged[0][1]>=WE;
    if(full) return {mark:'×'};
    let note;
    if(merged.length===1){ const s=merged[0][0], e=merged[0][1];
      if(s<=WS+60) note=this.fmtMin(e)+'以降なら空いてます';
      else if(e>=WE-120) note=this.fmtMin(s)+'までなら空いてます';
      else note=this.fmtMin(s)+'〜'+this.fmtMin(e)+' 以外なら空いてます';
    } else note='一部の時間なら空いてます';
    return {mark:'△',variant:'partial',note};
  }
  cycleMark(day,auto){ const order=['○','△','×']; const cur=this.state.overrides[day]||auto; const next=order[(order.indexOf(cur)+1)%3]; this.setState(s=>{ const o={...s.overrides}; if(next===auto) delete o[day]; else o[day]=next; return {overrides:o}; }); }

  // ---- pills ----
  pillStyle(ev){
    const t=this.T(ev.type);
    // 狭いマスで名前を1文字でも多く見せるため、余白と字間を詰める。
    // letterSpacing を少し詰めるだけで、日本語は1文字ぶん稼げる。
    const base={height:16,boxSizing:'border-box',borderRadius:4,padding:'0 2px',marginBottom:3,fontSize:11,fontWeight:500,letterSpacing:'-.04em',lineHeight:'16px',whiteSpace:'nowrap',overflow:'hidden',cursor:'pointer',display:'flex',alignItems:'center',transition:'background .28s cubic-bezier(.2,.9,.2,1),border-color .28s,color .28s'};
    if(ev.status==='kakutei') return {...base,background:this.softFill(t.color),color:this.inkOn(t.color)};
    if(ev.status==='mikakutei') return {...base,height:17,background:t.paper,color:this.inkOn(t.color),border:'1.5px dashed '+this.softLine(t.color),lineHeight:'13px'};
    if(ev.status==='jisseki') return {...base,background:this.softFill(t.color),color:this.inkOn(t.color),opacity:.92};
    return {...base,background:'transparent',color:'#9AA0A6',textDecoration:'line-through',opacity:.5};
  }
  pillText(ev, wageOn){
    if(ev.status==='mikakutei') return '？'+ev.title;
    if(ev.status==='jisseki') return wageOn ? this.fmtWage(this.wage(ev)) : '✓'+ev.title;
    return ev.title;
  }
  // マスが狭いので、印（？ ✓）と予定の名前を分けて描く。
  // compact（月表示のマス）では「？」を出さない。点線の枠そのものが
  // 未確定を示しているので、印は重複であり、名前を削ってまで置く価値がない。
  // 「✓」は塗り同士（確定と実績）を見分ける唯一の手がかりなので残す。
  pillParts(ev, wageOn, compact){
    if(ev.status==='mikakutei') return { mark: compact ? '' : '？', body:ev.title };
    if(ev.status==='jisseki') return wageOn ? { mark:'', body:this.fmtWage(this.wage(ev)) } : { mark:'✓', body:ev.title };
    return { mark:'', body:ev.title };
  }
  markStyleFor(ev){
    return { fontSize:9, fontWeight:800, opacity:.75, marginRight:2, flexShrink:0, letterSpacing:'-.02em' };
  }
  // 月表示の帯のかたち。端だけ丸めて、続きがある側は切り落とす。
  // 切り落とした辺は隣の週（や隣の月）へ地続きに見えるので、
  // 「ここで終わっていない」が言葉なしで伝わる。
  segShape(seg){
    const L=!seg || seg.startsHere!==false, R=!seg || seg.endsHere!==false;
    // グリッドの角を直角にしたので、帯の角も詰める（4px だと1つだけ丸くて浮く）
    const r=3;
    return {
      marginBottom:0,
      // マスの幅いっぱいに置く。端だけ 1px 空けて、隣の日の別の予定とくっつかないようにする。
      padding:'0 3px', marginLeft:L?1:0, marginRight:R?1:0,
      borderRadius:`${L?r:0}px ${R?r:0}px ${R?r:0}px ${L?r:0}px`,
      _L:L, _R:R,
    };
  }
  // 帯の左右どちらかが切り落とされているとき、その辺の線も消す
  trimBorder(style, sh){
    if(!style.border) return style;
    const out={...style};
    if(!sh._L) out.borderLeft='none';
    if(!sh._R) out.borderRight='none';
    return out;
  }
  pillView(ev, wageOn, seg){
    const sh=this.segShape(seg);
    const { _L, _R, ...shape }=sh;
    const m=this.state.morph;
    // 段の高さをそろえないと、日をまたぐ帯が隣のマスでずれて見える
    // 月表示の帯は、日一覧などで使うピルより一段細くする。
    // 未確定は上下に 1.5px の点線枠があるぶん、中の行の高さを引く。
    const H=MONTH_BAR_H;
    const evenOut=(st)=>({...st, height:H, fontSize:MONTH_BAR_FS,
      lineHeight: (ev.status==='mikakutei' ? H-3 : H)+'px'});
    if(!m || m.id!==ev.id){
      const p=this.pillParts(ev,wageOn,true);
      return { text:p.body, mark:p.mark, markStyle:this.markStyleFor(ev),
        style:this.trimBorder(evenOut({...this.pillStyle(ev), ...shape}), sh),
        textStyle:{minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}, morphing:false, fillStyle:{} };
    }
    const t=this.T(ev.type);
    const dash=m.phase==='dash', filling=m.phase==='fill'||m.phase==='settle';
    const style={height:H,boxSizing:'border-box',fontSize:MONTH_BAR_FS,fontWeight:500,letterSpacing:'-.04em',lineHeight:(H-3)+'px',whiteSpace:'nowrap',overflow:'hidden',display:'flex',alignItems:'center',position:'relative',cursor:'pointer',
      background:t.paper, border:'1.5px '+(dash?'dashed':'solid')+' '+this.softLine(t.color), transition:'border-color .14s linear', animation:m.phase==='settle'?'pillSettle .2s ease-out':'none', ...shape};
    const fillStyle={position:'absolute',left:0,top:0,right:0,bottom:0,background:this.softFill(t.color),transformOrigin:'left center',transform:filling?'scaleX(1)':'scaleX(0)',animation:m.phase==='fill'?'sweepFill .3s cubic-bezier(.2,.9,.2,1) forwards':'none',zIndex:0,borderRadius:2};
    const textStyle={position:'relative',zIndex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',color:this.inkOn(t.color),transition:'color .16s .12s linear'};
    return { text: ev.title, mark: dash?'?':'', markStyle:this.markStyleFor(ev), style:this.trimBorder(style,sh), textStyle, morphing:true, fillStyle };
  }
  statusWord(ev){
    const t=this.T(ev.type);
    if(ev.status==='mikakutei') return t.uWord;
    if(ev.status==='jisseki') return '実績';
    if(ev.status==='nakunatta') return '無くなった';
    return t.cWord;
  }

  // ---- nav / actions ----
  openFor(ev, from){
    const ret = from || this.state.returnTo;
    if(ev.status==='mikakutei'){ this.openDialog(ev,'confirm',ret); return; }
    // 無くなった予定も開ける。直したり、戻したり、消したりできるように
    this.setState({screen:'detail',detailId:ev.id,returnTo:ret});
  }
  openDay(d){ this.setState({screen:'day',dayNum:d,returnTo:'month',swipeRow:null}); }

  // 空き状況の月送り。送った向きを持っておき、一覧をその向きから滑り込ませる。
  shiftFree(dir){
    tapLight();
    this.setState(s=>({ freeYM:shiftMonth(s.freeYM,dir), freeDir:dir }));
  }

  // 滑り終わったスワイプ1回ぶんを、月の差し替えとして確定させる。
  // 次のスワイプが始まったときにも呼ぶので、素早く続けて払っても
  // 払った回数ぶん動く（以前はタイマーを消すだけで、1回ぶんが消えていた）。
  _commitSwipe(){
    if(!this._settle && !this._pendingDir) return; // 滑っている最中でなければ何もしない
    if(this._settle){ clearTimeout(this._settle); this._settle=null; }
    const dir=this._pendingDir||0;
    this._pendingDir=0;
    if(dir) this.setState(s=>({ym:shiftMonth(s.ym,dir), dayNum:null, swipe:{dx:0,animating:false}}));
    else this.setState({swipe:{dx:0,animating:false}});
  }
  // 既定の種類は「用事」。バイトをしない人のほうが多いのに、
  // 何もしなければシフトになる作りだった。
  // 時間もその種類のものから始める（用事が 17:00–22:00 で始まると面食らう）。
  defTimes(key){ const t=(this.state.types||[]).find(x=>x.key===key)||{};
    return { start: t.defStart || '10:00', end: t.defEnd || '11:00' }; }
  openNew(day,ret){ const ym=this.state.ym; const dt=this.defTimes('yoji');
    this.setState({screen:'new',returnTo:ret,newType:null,draft:{editingId:null,title:'',type:'yoji',status:'kakutei',start:dt.start,end:dt.end,y:ym.y,m:ym.m,day,pickY:ym.y,pickM:ym.m,extraDays:[],jobId:(this.state.jobs[0]||{}).id,allDay:false,days:1,remindMin:null,place:'',memo:'',repEvery:null,repSpan:3,repDows:[],added:[],picking:null}}); }
  // 既存の予定を同じ画面で直す。実績は「実際に働いた終わり」を編集対象にする。
  openEdit(ev,ret){
    this.setState({screen:'new',returnTo:ret||'month',newType:null,detailId:null,draft:{
      editingId:ev.id, title:ev.title, type:ev.type, status:ev.status,
      start:ev.start, end: ev.status==='jisseki' ? (ev.actualEnd||ev.end) : ev.end,
      y:ev.y, m:ev.m, day:ev.day, pickY:ev.y, pickM:ev.m, extraDays:[], jobId:ev.jobId, allDay:!!ev.allDay, days:evSpan(ev),
      remindMin: typeof ev.remindMin==='number' ? ev.remindMin : null,
      place:ev.place||'', memo:ev.memo||'', repEvery:null, repSpan:3, repDows:[],
      // 入っている項目だけ行を出す。空のものまで並べない
      added:[...(ev.place?['place']:[]), ...(ev.memo?['memo']:[])], picking:null }});
  }
  askDelete(id){ this.setState({confirmDelete:id, deleteRest:false}); }

  // ---- 開発応援 ----
  // 値段は起動時ではなく、設定画面を開いたときに取りにいく。
  // 使い始めの人に、いきなり買えるものを見せたくない。
  async _loadTips(){
    if(this._tipsTried) return;
    this._tipsTried = true;
    try{
      const list = await loadTips();
      if(list && list.length) this.setState({tips:list});
    }catch(e){
      // 黙って諦める（利用者に見せるものではない）。診断からは見える。
      this._tipsTried = false;
    }
  }
  // バージョンを5回叩くと出る診断。ふつうに使う人には見えない。
  // 課金がうまくいかないとき、画面には何も出ない作りにしてあるので、
  // そのままだと原因が誰にも見えない。ここだけは全部見せる。
  tapVersion(){
    const n = (this._verTaps||0) + 1;
    this._verTaps = n;
    clearTimeout(this._verTimer);
    this._verTimer = setTimeout(()=>{ this._verTaps = 0; }, 1500);
    if(n >= 5){ this._verTaps = 0; this.runProbe(); }
  }
  async runProbe(){
    tapLight();
    this.setState({probe:{running:true}});
    try{
      const r = await probeTips();
      this.setState({probe:r});
      if(r.tips && r.tips.length) this.setState({tips:r.tips});
    }catch(e){
      // ここで落ちると「読み込み中…」のまま固まる。必ず何か出す。
      this.setState({probe:{ native:true, billing:null, asked:[], got:[],
        error:'診断そのものが落ちた: '+((e&&e.message)||String(e)), tips:null }});
    }
  }
  async buyTip(id){
    tapLight();
    const r = await buyTip(id);
    if(r.ok){
      // 消耗型は Apple 側で復元できない。自前で持たないと機種変更で消えるので、
      // 予定と同じ入れ物に入れる（控えにも入る）。
      const t=TIPS.find(x=>x.id===id);
      this.setState(s=>({supports:[...(s.supports||[]), {id, yen:(t&&t.yen)||0, at:Date.now()}]}));
    }
    if(r.msg) this.setState({shareToast:true, shareMsg:r.msg},
      ()=>setTimeout(()=>this.setState({shareToast:false}), 2400));
  }

  // ---- 一覧の行を左へスワイプして削除 ----
  // 開くのは一度に1行だけ。開いている行があるときは、本文をタップしても
  // 予定を開かず、まず閉じる（指の下にあるものが変わらないようにする）。
  SWIPE_W = 84; // 削除ボタンの幅
  rowSwipeStart(id,e){
    const t=e.touches&&e.touches[0]; if(!t) return;
    this._rsx=t.clientX; this._rsy=t.clientY; this._rAxis=null; this._rId=id;
    this._rBase=(this.state.swipeRow&&this.state.swipeRow.id===id)?this.state.swipeRow.dx:0;
  }
  rowSwipeMove(id,e){
    const t=e.touches&&e.touches[0]; if(!t||this._rsx==null||this._rId!==id) return;
    const dx=t.clientX-this._rsx, dy=t.clientY-this._rsy;
    // 最初の数pxで、横に払っているのか縦に送っているのかを決める
    if(!this._rAxis){
      if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
      this._rAxis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
    }
    if(this._rAxis!=='x') return;
    // 縦スクロールに持っていかれないようにするのは touch-action:pan-y の役目。
    // React の touchmove は passive なので preventDefault は効かない。
    let d=this._rBase+dx;
    if(d>0) d=0;                                   // 右には開かない
    if(d<-this.SWIPE_W) d=-this.SWIPE_W-(-this.SWIPE_W-d)*0.25; // 行き過ぎは重くする
    this.setState({swipeRow:{id, dx:d, animating:false}});
  }
  rowSwipeEnd(id){
    const wasX=this._rAxis==='x'; this._rsx=null; this._rAxis=null;
    if(!wasX) return;
    const sr=this.state.swipeRow;
    const dx=(sr&&sr.id===id)?sr.dx:0;
    const open = dx < -this.SWIPE_W/2;
    this.setState({swipeRow:{id, dx: open?-this.SWIPE_W:0, animating:true}});
  }
  closeSwipeRow(){ const sr=this.state.swipeRow; if(sr&&sr.dx) this.setState({swipeRow:{id:sr.id,dx:0,animating:true}}); }

  // ---- はじめての案内 ----
  // 点線が塗りに変わる瞬間を、その場で一度さわってもらう
  // 本物と同じ形にしてある。点線を押すと「どうなりました？」と聞かれ、
  // 「確定した」を押して初めて塗りになる。案内で1回で変わるようにしていると、
  // 実際に触ったときに一手多く感じる。しかもその一手は省けない——
  // 確定するときは時刻が変わることが多く、そこで直させたいので。
  onboardDemoTap(){
    if(this.state.onboard.demo!=='dash') return;
    tapLight();
    this.setState(s=>({onboard:{...s.onboard, demo:'asking'}}));
  }
  onboardDemoConfirm(){
    if(this.state.onboard.demo!=='asking') return;
    tapLight();
    this.setState(s=>({onboard:{...s.onboard, demo:'fill'}}));
    setTimeout(()=>{ penTick(); }, 120);
    setTimeout(()=>{ settleSuccess(); this.setState(s=>({onboard:{...s.onboard, demo:'done'}})); }, 430);
  }
  onboardResetDemo(){ this.setState(s=>({onboard:{...s.onboard, demo:'dash'}})); }
  onboardNext(){ tapLight(); this.setState(s=>({onboard:{...s.onboard, step:s.onboard.step+1}})); }
  onboardBack(){ this.setState(s=>({onboard:{...s.onboard, step:Math.max(0,s.onboard.step-1)}})); }
  finishOnboard(goImport){
    stampHeavy();
    this.setState(s=>({ settings:{...s.settings, onboarded:true}, screen: goImport ? 'import' : 'month' }));
    if(goImport) this.setState({imp:{phase:'idle', found:[], type:'yoji', error:''}});
  }

  // ---- バイト先 ----
  addJob(){
    tapLight();
    const id=uid('j');
    this.setState(s=>({ jobs:[...s.jobs,{id,name:'',hourly:s.settings.hourly}], editJobId:id }));
  }
  patchJob(id,patch){ this.setState(s=>({ jobs:s.jobs.map(j=>j.id===id?{...j,...patch}:j) })); }
  removeJob(id){
    // 消したバイト先を使っていた予定は、設定の時給に戻す
    this.setState(s=>({ jobs:s.jobs.filter(j=>j.id!==id), editJobId:null,
      events:s.events.map(e=>e.jobId===id?{...e,jobId:undefined,updatedAt:Date.now()}:e) }));
  }
  // バイト先を選ぶと、名前もそのまま予定の名前に使う（テンプレのように）
  pickJob(id){
    tapLight();
    this.setState(s=>{
      const job=s.jobs.find(j=>j.id===id);
      const prev=s.jobs.find(j=>j.id===s.draft.jobId);
      const keepTitle = s.draft.title && s.draft.title!==(prev&&prev.name);
      return { draft:{...s.draft, jobId:id, title: keepTitle ? s.draft.title : (job?job.name:s.draft.title)} };
    });
  }
  clearJob(){ this.setState(s=>({draft:{...s.draft, jobId:undefined}})); }
  // 予定を作りかけのまま、その場でバイト先を足せるようにする
  // （設定画面に飛ばすと、入力していた内容が消えてしまうため）
  startNewJob(){ tapLight(); this.setState(s=>({newJob:{name:'',hourly:s.settings.hourly}})); }
  cancelNewJob(){ this.setState({newJob:null}); }
  commitNewJob(){
    const nj=this.state.newJob; if(!nj) return;
    tapLight();
    const id=uid('j');
    const name=(nj.name||'').trim()||'バイト先';
    this.setState(s=>{
      const prev=s.jobs.find(j=>j.id===s.draft.jobId);
      const keepTitle = s.draft.title && s.draft.title!==(prev&&prev.name);
      return { jobs:[...s.jobs,{id,name,hourly:nj.hourly}], newJob:null,
        draft:{...s.draft, jobId:id, title: keepTitle ? s.draft.title : name} };
    });
  }

  // ---- 複数日えらび ----
  toggleExtraDay(y,m,d){
    const key=y+'-'+m+'-'+d;
    this.setState(s=>{
      // 本体の日付そのものは外せない
      if(s.draft.y===y && s.draft.m===m && s.draft.day===d) return null;
      const cur=s.draft.extraDays||[];
      const has=cur.includes(key);
      return { draft:{...s.draft, extraDays: has ? cur.filter(k=>k!==key) : [...cur,key]} };
    });
  }

  // ---- iPhone のカレンダーから取り込む ----
  openImport(){ this.setState({screen:'import', imp:{phase:'idle', found:[], type:'yoji', error:''}}); }
  async runScan(){
    tapLight();
    this.setState(s=>({imp:{...s.imp, phase:'scanning', error:''}}));
    const perm = await askCalendarAccess();
    if(perm!=='granted'){
      this.setState(s=>({imp:{...s.imp, phase:'idle',
        denied: perm!=='unavailable',
        error: perm==='unavailable'
          ? 'この端末では取り込みを使えません。'
          : 'カレンダーを読む許可が下りませんでした。設定アプリで「カレンダー」を許可すると取り込めます。'}}));
      return;
    }
    try{
      const all = await readCalendarEvents({monthsBack:1, monthsAhead:12});
      const fresh = dedupe(all, this.state.events);
      // 1件ずつ、入れるかどうかと種類を持たせる。種類は名前から当てにいく。
      // 当たらなかったものは用事に置く（これまでと同じ）。
      const guesses = guessTypes(fresh, this.state.types);
      const picked = fresh.map((e,i)=>({...e, key:'k'+i, on:true,
        type:guesses[i].key, guessed:!!guesses[i].why}));
      this.setState(s=>({imp:{...s.imp, phase:'found', found:picked}}));
    }catch(e){
      this.setState(s=>({imp:{...s.imp, phase:'idle', error:'予定を読めませんでした。時間をおいて試してください。'}}));
    }
  }
  doImport(){
    const on = (this.state.imp.found||[]).filter(e=>e.on);
    if(!on.length) return;
    stampHeavy();
    const now=Date.now();
    // 取り込んだ予定は「決まっている」扱い。あとから点線に変えられる。
    const tag = uid('i');
    const add = on.map((e,i)=>({ id:tag+'-'+i, type:e.type, title:e.title, y:e.y, m:e.m, day:e.day,
      start:e.start, end:e.end, status:'kakutei', allDay:e.allDay, updatedAt:now }));
    this.setState(s=>({ events:[...s.events, ...add], imp:{...s.imp, phase:'done', added:add.length} }));
  }
  toggleImportRow(key){ this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.key===key?{...e,on:!e.on}:e)}})); }
  setImportRowType(key,type){ this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.key===key?{...e,type}:e)}})); }
  setAllImport(on){ tapLight(); this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>({...e,on}))}})); }
  setAllImportType(type){ tapLight(); this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.on?{...e,type}:e)}})); }
  doDelete(){
    const id=this.state.confirmDelete;
    const all=this.state.deleteRest;
    const ev=this.state.events.find(e=>e.id===id);
    // 「これ以降ぜんぶ」のとき、同じくり返しで作った、その日以降のものを消す。
    // 前の分を残すのは、もう済んだ予定まで消えると困るため。
    const gone = (e)=>{
      if(e.id===id) return true;
      if(!all || !ev || !ev.repId) return false;
      return e.repId===ev.repId && evFrom(e)>=evFrom(ev);
    };
    this.setState(s=>({ events:s.events.filter(e=>!gone(e)), confirmDelete:null, deleteRest:false, dialog:null, swipeRow:null,
      screen: s.detailId===id ? 'month' : s.screen, detailId: s.detailId===id ? null : s.detailId }));
  }
  openDialog(ev,mode,ret){
    // 実績を記録し直すときは、記録済みの終了時刻から始める
    const again = mode==='worked' && ev.status==='jisseki';
    const origS = (mode==='confirm' && ev.want) ? ev.want[0] : ev.start;
    const origE = again ? (ev.actualEnd||ev.end) : ((mode==='confirm' && ev.want) ? ev.want[1] : ev.end);
    this.setState({ returnTo:ret||this.state.returnTo, dialog:{ id:ev.id, mode, type:ev.type, title:ev.title, y:ev.y, m:ev.m, day:ev.day, start:origS, end:origE, origS, origE,
      breakMin:this.breakMin(ev), picking:null } });
  }
  patchDlg(k,d){ this.setState(s=>({ dialog:{...s.dialog,[k]:this.addMin(s.dialog[k],d)} })); }
  setSetting(k,val){ this.setState(s=>({ settings:{...s.settings,[k]:val} })); }
  recolorKey(key,hex){ this.setState(s=>({ types:s.types.map(t=>t.key===key?{...t,color:hex,paper:this.paperFrom(hex),dark:this.darkFrom(hex)}:t) })); }
  // 種類の名前を変える。自分で足した種類は「未確定の◯◯」「◯◯」という
  // 言い回しも名前から作っているので、あわせて作り直す。
  // 最初から入っている4つ（バイト・用事・遊び・その他）は、
  // 「希望シフト／確定シフト」のような言い回しを人が選んでいるので触らない。
  renameType(key,name){
    this.setState(s=>({ types:s.types.map(t=>{
      if(t.key!==key) return t;
      return String(t.key).startsWith('c') ? {...t, name, uWord:'未確定の'+name, cWord:name} : {...t, name};
    })}));
  }
  // 予定を書き換えるところは全部ここを通る。更新時刻もここで押す。
  // （将来クラウド同期を作るとき「どちらが新しいか」の判定に要る）
  updateEvent(id,patch){ this.setState(s=>({ events:s.events.map(e=>e.id===id?{...e,...patch,updatedAt:Date.now()}:e) })); }

  dlgPrimary(){
    const d=this.state.dialog;
    tapLight();
    // 実績の確定は「✓を判子で押す」— 重めのひと突き（§6）
    if(d.mode==='worked'){ stampHeavy();
      this.updateEvent(d.id,{status:'jisseki',start:d.start,actualEnd:d.end,
        breakMin: d.breakMin>0 ? d.breakMin : undefined});
      this.setState({dialog:null}); return; }
    // 依頼A: ダイアログを閉じ→カレンダー上のピルが点線から左→右へ塗り満ちる (§6)
    this.updateEvent(d.id,{start:d.start,end:d.end,want:[d.origS,d.origE]});
    this.setState({dialog:null, screen:'month', dayNum:null, detailId:null, morph:{id:d.id, phase:'dash'}});
    setTimeout(()=>{ if(this.state.morph&&this.state.morph.id===d.id){ this.setState({morph:{id:d.id, phase:'fill'}}); penTick(); } }, 150);
    setTimeout(()=>{ if(this.state.morph&&this.state.morph.id===d.id){ this.setState({morph:{id:d.id, phase:'settle'}}); settleSuccess(); } }, 470);
    setTimeout(()=>{ if(!this.state.morph||this.state.morph.id!==d.id) return; this.updateEvent(d.id,{status:'kakutei'}); this.setState({morph:null}); }, 760);
  }
  dlgNakunatta(){ const d=this.state.dialog; this.updateEvent(d.id,{status:'nakunatta'}); this.setState(s=>({dialog:null, screen: s.detailId===d.id ? s.returnTo : s.screen, detailId: s.detailId===d.id?null:s.detailId})); }

  // ---- type editor ----
  // 種類を変えたら、時間もその種類の既定に合わせる。
  // ただし本人が時刻をいじっていたら、そのまま残す（勝手に戻さない）。
  selectType(k){
    this.setState(s=>{
      const dr=s.draft;
      const cur=this.defTimes(dr.type), next=this.defTimes(k);
      const untouched = dr.start===cur.start && dr.end===cur.end;
      return { draft:{...dr, type:k, ...(untouched ? {start:next.start, end:next.end} : {})} };
    });
  }
  addType(){
    const nt=this.state.newType; if(!nt) return;
    const name=(nt.name||'').trim()||'新しい種類';
    const key=uid('c'), hex=nt.color;
    const t={key,name,color:hex,paper:this.paperFrom(hex),dark:this.darkFrom(hex),uWord:'未確定の'+name,cWord:name};
    this.setState(s=>({ types:[...s.types,t], draft:{...s.draft,type:key}, newType:null }));
  }

  save(){
    const dr=this.state.draft;
    tapLight();
    // 日またぎは終日の予定だけ。時間指定に戻したら1日に畳む。
    const span = dr.allDay ? Math.max(1,Math.min(60,dr.days|0||1)) : 1;
    const spanField = span>1 ? span : undefined;
    const remindField = typeof dr.remindMin==='number' ? dr.remindMin : undefined;
    // 空文字は持たせない（あとで「入っているか」を見るだけで済む）
    const placeField = (dr.place||'').trim() || undefined;
    const memoField = (dr.memo||'').trim() || undefined;
    if(dr.editingId){
      this.setState(s=>({ screen:'month', detailId:null, dayNum:null, ym:{y:dr.y,m:dr.m},
        events:s.events.map(e=>{
          if(e.id!==dr.editingId) return e;
          const base={...e,type:dr.type,title:dr.title||'無題',y:dr.y,m:dr.m,day:dr.day,start:dr.start,status:dr.status,allDay:dr.allDay,days:spanField,
            remindMin:remindField, place:placeField, memo:memoField,
            jobId: dr.type==='baito' ? dr.jobId : undefined, updatedAt:Date.now()};
          // 実績のときに直しているのは「実際に働いた終わりの時刻」
          return dr.status==='jisseki' ? {...base, actualEnd:dr.end} : {...base, end:dr.end, actualEnd:undefined};
        }) }));
      return;
    }
    // 本体の日＋えらんだ他の日＋くり返しの日、まとめて置く
    const rep = repeatAfter(dr.y, dr.m, dr.day, dr.repEvery, dr.repSpan|0, dr.repDows)
      .map(n=>{ const o=fromDayNo(n); return [o.y,o.m,o.d]; });
    const placeOn=[[dr.y,dr.m,dr.day], ...(dr.extraDays||[]).map(k=>k.split('-').map(Number)), ...rep];
    const base=Date.now();
    const tag=uid('n');
    // くり返しで作ったものには同じ印をつけておく。あとでまとめて消せる。
    const repId = rep.length ? uid('r') : undefined;
    const made=placeOn.map(([y,m,d],i)=>({ id:tag+'-'+i, type:dr.type, title:dr.title||'無題',
      y, m, day:d, start:dr.start, end:dr.end, status:dr.status, allDay:dr.allDay, days:spanField, remindMin:remindField,
      place:placeField, memo:memoField, repId,
      jobId: dr.type==='baito' ? dr.jobId : undefined,
      want: dr.status==='mikakutei' ? [dr.start,dr.end] : undefined, updatedAt:base }));
    this.setState(s=>({ screen:s.returnTo, ym:{y:dr.y,m:dr.m}, events:[...s.events,...made] }));
  }

  renderVals(){
    const st=this.state, wageOn=st.wageOn;
    const stepBtn={width:30,height:30,borderRadius:15,background:'var(--bg2)',color:'var(--ink)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,cursor:'pointer',userSelect:'none'};
    // たたんだ行の「›」と値。開くと右に倒れて、値が色づく。
    const chevron=(open)=>({fontSize:16,color:'var(--ink-faint)',flexShrink:0,display:'inline-block',
      transition:'transform .22s cubic-bezier(.2,.9,.2,1)', transform:open?'rotate(90deg)':'none'});
    const rowVal=(open)=>({fontSize:15,fontWeight:open?700:500,color:open?'#1D9E75':'var(--ink-mut)',
      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontVariantNumeric:'tabular-nums'});
    const wl=['日','月','火','水','木','金','土'];
    const v={
      fw:402, fh:874,
      monthShown:st.screen==='month', dayShown:st.screen==='day', newShown:st.screen==='new', detailShown:st.screen==='detail', dialogShown:!!st.dialog&&!st.dialog.phase, celebShown:!!st.dialog&&!!st.dialog.phase, freeShown:st.screen==='free',
      monthLabel:String(st.ym.m+1), year:String(st.ym.y), wageOn, stepBtn,
      onPrevMonth:()=>this.setState(s=>({ym:shiftMonth(s.ym,-1), dayNum:null})),
      onNextMonth:()=>this.setState(s=>({ym:shiftMonth(s.ym,1), dayNum:null})),
      onToggleWage:()=>this.setState(s=>({wageOn:!s.wageOn})),
      // 見出しの「8月 2026」を押すと年月をえらべる。
      // ‹ › だけだと、来年の3月に行くのに7回押すことになる。
      onTapMonthHead:()=>{ tapLight(); this.setState(s=>({ymSheet:s.ymSheet?null:{y:s.ym.y}})); },
      // 今月を見ているなら今日、別の月を見ているならその月の1日から始める
      onFab:()=>{ const t=st.today; const same=st.ym.y===t.y&&st.ym.m===t.m; this.openNew(same?t.d:1,'month'); },
      onCancel:()=>this.setState({screen:st.returnTo}),
      onBack:()=>this.setState({screen:st.returnTo, detailId:null}),
      onDayBack:()=>this.setState({screen:'month', dayNum:null}),
      onOpenFree:()=>this.setState({screen:'free'}),
      onFreeBack:()=>this.setState({screen:'month'}),
      // 控えを貼りつけている間はナビを隠す。浮かせてあるので、
      // キーボードが上がると入力欄に重なって、貼りつけの邪魔になる。
      navShown: (st.screen==='month' || st.screen==='free' || st.screen==='report'
        || (st.screen==='settings' && !st.pasteOpen)),
      onBell:()=>this.openNotices(),
      navCur: st.screen,
      onNavCal:()=>this.setState({screen:'month', dayNum:null, detailId:null}),
      onNavFree:()=>this.setState({screen:'free'}),
      onNavReport:()=>this.setState({screen:'report'}),
      onNavSettings:()=>{ this.setState({screen:'settings', editTypeKey:null}); this._loadTips(); },
      onOpenSummary:()=>this.setState({screen:'summary', shareToast:false, cardFrom:st.screen}),
      onSummaryClose:()=>this.setState(s=>({screen:s.cardFrom||'month'})),
      // カレンダーは指の動きについてくる。離したところで隣の月に収まるか、元に戻る。
      onMonthTouchStart:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t) return;
        // 前のスワイプがまだ収まりきる前に次が始まったら、先にその1回ぶんを確定させる。
        // ここで捨てると、素早く2回払っても1ヶ月しか動かない。
        this._commitSwipe();
        this._sx=t.clientX; this._sy=t.clientY; this._axis=null;
        this._trackW=(e.currentTarget&&e.currentTarget.clientWidth)||320;
        this.setState({swipe:{dx:0, animating:false}});
      },
      onMonthTouchMove:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t||this._sx==null) return;
        const dx=t.clientX-this._sx, dy=t.clientY-this._sy;
        // 最初の数pxで、横に払っているのか縦に送っているのかを決める
        if(!this._axis){
          if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
          this._axis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
        }
        if(this._axis!=='x') return;
        // 端では少し重くして、紙を引っぱっている感じにする
        const w2=this._trackW||320;
        const d = Math.abs(dx)>w2 ? Math.sign(dx)*(w2+(Math.abs(dx)-w2)*0.3) : dx;
        this.setState({swipe:{dx:d, animating:false}});
      },
      onMonthTouchEnd:(e)=>{
        const t=e.changedTouches&&e.changedTouches[0];
        const wasX=this._axis==='x'; this._sx=null; this._axis=null;
        if(!t||!wasX) return;
        const dx=this.state.swipe?this.state.swipe.dx:0;
        const w=this._trackW||320;
        const go = Math.abs(dx) > Math.min(72, w*0.22);
        const dir = dx<0 ? 1 : -1;
        // 指を離したら滑らせる。滑り終わってから月を差し替える（_commitSwipe）
        this._pendingDir = go ? dir : 0;
        this.setState({swipe:{dx: go ? dir*-w : 0, animating:true}});
        this._settle=setTimeout(()=>this._commitSwipe(), 300);
      },
      onShareCard:()=>{ this._shareCard(st.screen==='summary'?'summary':'free'); },
      onOpenShare:()=>this.setState({screen:'share', shareToast:false, cardFrom:st.screen}),
      onShareClose:()=>this.setState(s=>({screen:s.cardFrom||'settings'})),
      onOpenTerms:()=>this.setState({screen:'doc', docKey:'terms'}),
      onOpenPrivacy:()=>this.setState({screen:'doc', docKey:'privacy'}),
      onDocBack:()=>this.setState({screen:'settings', docKey:null}),
      onFreePrev:()=>this.shiftFree(-1),
      onFreeNext:()=>this.shiftFree(1),
      // 空き状況も横に払って月を送れるようにする。
      // ここは月表示と違って縦に並ぶ一覧なので、指について動かすカルーセルにはせず、
      // 離した時点で月を差し替えて、送った向きに滑り込ませる。
      onFreeTouchStart:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t) return;
        this._fsx=t.clientX; this._fsy=t.clientY; this._fAxis=null;
      },
      onFreeTouchMove:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t||this._fsx==null) return;
        const dx=t.clientX-this._fsx, dy=t.clientY-this._fsy;
        if(!this._fAxis){
          if(Math.abs(dx)<8 && Math.abs(dy)<8) return;
          this._fAxis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
        }
      },
      onFreeTouchEnd:(e)=>{
        const t=e.changedTouches&&e.changedTouches[0];
        const wasX=this._fAxis==='x'; const sx=this._fsx;
        this._fsx=null; this._fAxis=null;
        if(!t||!wasX||sx==null) return;
        const dx=t.clientX-sx;
        if(Math.abs(dx) < 60) return;   // 浅い払いでは動かさない
        this.shiftFree(dx<0 ? 1 : -1);
      },
      stop:(e)=>e&&e.stopPropagation(),
    };

    // ---------- はじめての案内 ----------
    v.onboardShown = !st.settings.onboarded;
    if(v.onboardShown){
      const ob=st.onboard, teal='#1D9E75';
      v.obStep = ob.step;
      v.obDots = [0,1,2,3].map(i=>({ style:{width:i===ob.step?18:6,height:6,borderRadius:3,
        background:i===ob.step?'var(--ink)':'var(--line)',transition:'all .3s cubic-bezier(.2,.9,.2,1)'} }));
      v.onObNext = ()=>{ if(this.state.onboard.step===0 && this.state.onboard.demo!=='done') return; this.onboardNext(); };
      v.onObBack = ()=>this.onboardBack();
      v.onObSkip = ()=>this.finishOnboard(false);

      // 1枚目：しくみを、さわって知ってもらう。
      //
      // 一字ずつ、薄い墨から本来の濃さへ沈み込むように現れる。
      // 「ペンで書かれる」のではなく「すでに紙の中にあった字が、見えてくる」。
      // 手書きの書体は iOS に日本語のものが無いので、書体ではなく色と動きで作る。
      //
      // 遅れは全部ここに並べてある。上から順に、約2.9秒で出そろう。
      const EASE='cubic-bezier(.2,.7,.25,1)';
      const chars=(text,start,step)=>text.split('').map((ch,i)=>({ ch,
        style:{ display:'inline-block',
          animation:`inkRise .5s ${EASE} ${(start+i*step).toFixed(2)}s both` } }));
      // 「予定を、少しだけ書いておきました。」と書いていた時期があるが、
      // 実際には1件も書いていない（案内の中の見本を見せているだけ）ので嘘だった。
      // 最初の一文は、このアプリが何なのかを言う。
      v.obLine1 = chars('決まった予定も、', 0.15, 0.06);
      v.obLine2 = chars('まだの予定も。', 0.62, 0.05);
      // 折り返させない。一字ずつ inline-block にすると日本語の行末処理が効かず、
      // 「、」や「。」が行頭に来てしまう（この長さなら1行に収まる）
      v.obLineStyle = { fontFamily:"'Hiragino Mincho ProN','Yu Mincho',serif", fontSize:27,
        lineHeight:1.6, letterSpacing:'.05em', color:'var(--ink)', whiteSpace:'nowrap' };
      const at=(name,dur,delay)=>({ animation:`${name} ${dur}s ${EASE} ${delay}s both` });
      v.obPaperStyle = { marginTop:34, background:'var(--card)', border:'1px solid var(--line)',
        borderRadius:18, padding:18, ...at('obLift',.6,1.7) };
      // 日付は --ink-faint だとコントラスト比 2.06 しかなく、11px では読みにくい。
      // --ink-mut に上げて 3.4／ダーク 4.9（見出しより弱い、という関係は保つ）
      v.obDateStyle = { fontSize:11, fontWeight:600, color:'var(--ink-mut)', marginBottom:10,
        ...at('capRise',.5,1.85) };
      v.obSolidWrap = at('obLift',.55,1.95);
      v.obCaptionDelay = at('capRise',.45,2.4);
      // 点線のまま = dash / asking。塗りになるのは fill から。
      const asking = ob.demo==='asking';
      const filled = ob.demo==='fill' || ob.demo==='done';
      // このアプリで一番覚えてほしい操作なので、押されるまで待つ。
      // 押されるまでは、点線が静かに息をする（出そろってから始める）。
      v.obDashWrap = { animation: `obLift .55s ${EASE} 2.1s both`
        + (ob.demo==='dash' ? `, tapBreath 2.6s ease-in-out 2.9s infinite` : '') };
      // 押したあとに出る「確定した」。本物のダイアログと同じ言葉にしてある。
      v.obAsking = asking;
      v.onObDemoConfirm = ()=>this.onboardDemoConfirm();
      v.obAskHeading = 'この用事、どうなりました？';
      v.obConfirmStyle = { marginTop:11, padding:'11px 14px', borderRadius:12, textAlign:'center',
        fontSize:14, fontWeight:700, color:'#fff', background:teal, cursor:'pointer',
        animation:`capRise .3s ${EASE} both` };
      v.onObDemoTap = ()=>this.onboardDemoTap();
      v.onObDemoReset = ()=>this.onboardResetDemo();
      v.obDemoPillStyle = {
        position:'relative', overflow:'hidden', display:'block', width:'100%', boxSizing:'border-box',
        height:34, lineHeight:'30px', borderRadius:9, padding:'0 12px', fontSize:15, fontWeight:700,
        cursor: filled ? 'default' : 'pointer',
        // 本物の未確定のピルと同じ地色を使う（paperFrom）。
        // ここだけ薄い色を直に書いていたので、ダークモードで文字が沈んでいた
        background: filled ? this.softFill(teal) : this.paperFrom(teal),
        border: '1.6px '+(filled?'solid':'dashed')+' '+this.softLine(teal),
        color: this.inkOn(teal),
        animation: ob.demo==='done' ? 'pillSettle .24s cubic-bezier(.3,1.4,.5,1)' : 'none',
        transition:'background .25s, border-color .25s',
      };
      v.obDemoFillStyle = { position:'absolute',left:0,top:0,bottom:0,right:0,background:this.softFill(teal),
        transformOrigin:'left center', transform: filled?'scaleX(1)':'scaleX(0)',
        animation: ob.demo==='fill' ? 'sweepFill .3s cubic-bezier(.2,.9,.2,1) forwards':'none', zIndex:0 };
      v.obDemoTextStyle = { position:'relative', zIndex:1 };
      v.obDemoLabel = filled ? 'カフェバイト' : '？カフェバイト';
      v.obDemoCaption = filled ? '決まった、が形になりました。'
        : asking ? '押すと、この予定が塗りに変わります。'
        : '↑ 点線の予定をタップしてみてください';
      v.obDemoCaptionColor = filled ? '#0F6E56' : 'var(--ink)';
      v.obDemoDone = ob.demo==='done';
      // 押すまで進ませない。ここを飛ばされると、このアプリの一番の要が
      // 伝わらないまま日常に入る。押してあれば普通の黒いボタン。
      v.obNextLocked = ob.demo!=='done';
      v.obNextStyle = { padding:16, borderRadius:17, textAlign:'center', fontSize:16, fontWeight:700,
        transition:'all .3s cubic-bezier(.2,.9,.2,1)',
        ...(ob.demo==='done'
          ? { background:'var(--ink)', color:'var(--card)', cursor:'pointer' }
          : { background:'var(--bg2)', color:'var(--ink-faint)', cursor:'default' }) };
      v.obNextLabel = ob.demo==='done' ? 'つぎへ' : '点線をタップすると進めます';
      // 上に確定した予定を1本置く。違いは、並べて初めて見える。
      // 点線だけを出しても「点線が普通の形」と思われてしまう。
      {
        const at=(st.types||[]).find(t=>t.key==='asobi') || {color:'#B4453A'};
        v.obSolidPillStyle = { display:'block', width:'100%', boxSizing:'border-box', marginBottom:8,
          height:34, lineHeight:'30px', borderRadius:9, padding:'0 12px', fontSize:15, fontWeight:700,
          background:this.softFill(at.color), border:'1.6px solid '+this.softLine(at.color),
          color:this.inkOn(at.color) };
        v.obSolidLabel = '映画';
      }

      // 時給の画面はやめた。バイトをしない人には無関係な入力で、
      // そこに1枚使うのは重い。時給はバイト先を作るときに聞く。

      // 2枚目：空き状況。3枚目：シェア。
      // もとは1枚に押し込んでいたが、別の話がふたつ入って読みにくかった。
      // 1枚に1つだけ言う。
      v.obFreeLine1 = chars('空いてる日が、', 0.1, 0.06);
      v.obFreeLine2 = chars('ひと目でわかる。', 0.55, 0.05);
      v.obFreeCardStyle = { marginTop:30, background:'var(--card)', border:'1px solid var(--line)',
        borderRadius:18, padding:'6px 16px 10px', ...at('obLift',.6,1.5) };
      // 記号の説明を並べるより、本物の一覧の形で見せるほうが早い
      v.obFreeRows = [
        { day:'3', dow:'月', mark:'○', color:'#1D9E75', note:'まる1日あいてます', style:at('obLift',.5,1.75) },
        { day:'4', dow:'火', mark:'△', color:'#B9770F', note:'17:00 以降なら空いてます', style:at('obLift',.5,1.9) },
        { day:'5', dow:'水', mark:'×', color:'#C1C5CC', note:'ふさがっています', style:at('obLift',.5,2.05) },
      ];
      v.obFreeNote = at('capRise',.45,2.3);

      // 3枚目：シェア。カレンダーごと送ると見られたくない予定まで写る、
      // という困りごとに対する答えなので、その絵をそのまま見せる。
      v.obShareLine1 = chars('予定は見せずに、', 0.1, 0.06);
      v.obShareLine2 = chars('空きだけ送れる。', 0.55, 0.05);
      v.obShareCardStyle = { marginTop:30, background:'#FFFDF8', border:'1px solid var(--line)',
        borderRadius:18, padding:'16px 16px 18px', ...at('obLift',.6,1.5) };
      // 送られる画像そっくりの見本。
      // 日付は本物の画像にも入っている（隠しているのは予定の名前だけ）。
      // 数字を抜くと、そもそもカレンダーだと分からなかった。
      {
        const box={height:27,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',
          fontVariantNumeric:'tabular-nums'};
        const free={...box,background:'#FAECE7',border:'1.5px solid #D85A30',fontSize:12,fontWeight:700,color:'#712B13'};
        const busy={...box,background:'#EDEEF0',fontSize:12,fontWeight:600,color:'#C1C5CC'};
        const pattern=[1,0,0,1,1,0,1, 1,1,0,1,0,0,1, 0,1,1,1,0,1,1];
        v.obShareCells = pattern.map((f,i)=>({ label:String(i+1), style:{ ...(f?free:busy),
          animation:`obLift .4s ${EASE} ${(1.7+i*0.022).toFixed(2)}s both` } }));
        v.obShareWeekdays = ['日','月','火','水','木','金','土'].map((d,i)=>({ label:d,
          style:{textAlign:'center',fontSize:9,fontWeight:600,paddingBottom:3,
            color: i===0||i===6 ? '#8C887C' : '#B0B4BB'} }));
      }
      v.obShareNote = at('capRise',.45,2.5);

      // 4枚目：取り込み
      v.obImpLine1 = chars('いまの予定を、', 0.1, 0.06);
      v.obImpLine2 = chars('持っていきますか？', 0.55, 0.05);
      v.obImpBodyStyle = at('capRise',.5,1.4);
      v.obImpCardStyle = { marginTop:24, background:'var(--card)', border:'1px solid var(--line)',
        borderRadius:18, padding:'16px 18px', ...at('obLift',.6,1.65) };
      v.obCanImport = canImport();
      v.onObImport = ()=>this.finishOnboard(true);
      v.onObStart = ()=>this.finishOnboard(false);
    }

    // ---------- 保存についての知らせ ----------
    // 保存できていないことを黙っていると、いちばん悪い形で気づく——
    // 画面には出ているのに、閉じて開いたら消えている。必ず出す。
    v.saveFailedShown = !!st.saveFailed;
    v.onSaveFailedTap = ()=>this.setState({screen:'settings', pasteOpen:false});
    // ファイルから戻したときは、黙っていると「勝手に戻った」と見える
    v.recoveredShown = !!st.recovered;
    v.recoveredText = `保存されていた${st.recovered}件の予定を戻しました`;
    v.onRecoveredClose = ()=>this.setState({recovered:null});

    // ---------- 何も無いときの案内 ----------
    // 月表示のぶんは showFirstRunHint（前からある）。二重に出さない。
    // 空き状況は、予定が無いと全部「○」で意味を持たない。
    // ここが取り込みを勧めるのに一番いい場所（寂しい画面を見た、その瞬間）。
    v.freeEmptyShown = st.events.length===0 && !v.onboardShown && st.screen==='free';
    v.freeEmptyCanImport = canImport();
    v.onFreeEmptyImport = ()=>this.openImport();

    // ---------- 予定の取り込み ----------
    v.importAvailable = canImport();
    v.onOpenImport = ()=>this.openImport();
    v.importShown = st.screen==='import';
    if(v.importShown){
      const im=st.imp;
      v.impPhase=im.phase;
      v.impError=im.error;
      v.impCount=String((im.found||[]).length);
      v.impOnCount=String((im.found||[]).filter(e=>e.on).length);
      v.impAllOn=(im.found||[]).length>0 && (im.found||[]).every(e=>e.on);
      // どれだけ当たったかを見せる。当たらなかったものは用事に置いてあるので、
      // 「何件を自分で直せばいいか」がこの数から分かる。
      { const g=(im.found||[]).filter(e=>e.guessed).length;
        v.impGuessedCount = g;
        v.impGuessText = g ? `名前から${g}件の種類を当てました。ちがっていたら押して直せます。`
                           : ''; }
      v.onToggleAll=()=>this.setAllImport(!v.impAllOn);
      // 選んでいるものをまとめて種類変更
      v.impBulkChips = st.types.map(t=>({ label:t.name, onClick:()=>this.setAllImportType(t.key),
        style:{padding:'6px 12px',borderRadius:999,fontSize:12,cursor:'pointer',
          background:'var(--card)', color:'var(--ink-mut)', border:'1px solid var(--line)'} }));
      // 1件ごと
      v.impRows = (im.found||[]).map(e=>{
        const ty=st.types.find(t=>t.key===e.type)||st.types[0];
        return {
          key:e.key, title:e.title, on:e.on, guessed:!!e.guessed,
          when:`${e.m+1}/${e.day}　${e.allDay?'終日':e.start+'–'+e.end}`,
          onToggle:()=>this.toggleImportRow(e.key),
          rowStyle:{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',borderBottom:'1px solid var(--line)',
            cursor:'pointer', opacity:e.on?1:0.45},
          checkStyle:{width:20,height:20,borderRadius:7,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:12,fontWeight:800,
            background:e.on?'#1D9E75':'transparent', color:'#fff',
            border:'1.5px solid '+(e.on?'#1D9E75':'var(--line)')},
          typeChips: st.types.map(t=>({ label:t.name, sel:t.key===e.type,
            onClick:(ev)=>{ if(ev)ev.stopPropagation(); this.setImportRowType(e.key,t.key); },
            style:{padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:t.key===e.type?700:500,cursor:'pointer',whiteSpace:'nowrap',
              background:t.key===e.type?this.softFill(t.color):'transparent',
              color:t.key===e.type?this.inkOn(t.color):'var(--ink-faint)',
              border:'1px solid '+(t.key===e.type?this.softLine(t.color):'var(--line)')} })),
          typeName:ty.name,
        };
      });
      v.impAdded=String(im.added||0);
      v.onScan=()=>this.runScan();
      v.impDenied=!!im.denied;
      // 設定アプリを開いたら、戻ってきたときに自動でもう一度読みにいく
      v.onOpenSettingsApp=()=>{ tapLight(); this._retryImportOnReturn=true; openAppSettings(); };
      v.onDoImport=()=>this.doImport();
      v.onImportBack=()=>this.setState({screen:'settings'});
      v.onImportDone=()=>this.setState({screen:'month'});
      // 取り込んだ予定をどの種類に入れるか
      v.impTypeChips = st.types.map(t=>{ const sel=t.key===im.type;
        return { label:t.name, onClick:()=>this.setState(s=>({imp:{...s.imp,type:t.key}})),
          style:{padding:'7px 14px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',
            background:sel?t.color:'var(--card)', color:sel?'#fff':'var(--ink-mut)',
            border:'1px solid '+(sel?t.color:'var(--line)')} }; });
      // 何が入るのか見えるように、先頭のいくつかを見せる
      v.impPreview = (im.found||[]).slice(0,6).map(e=>({
        title:e.title,
        when:`${e.m+1}/${e.day}　${e.allDay?'終日':e.start+'–'+e.end}`,
      }));
      v.impMore = Math.max(0,(im.found||[]).length-6);
    }

    // ---------- 規約・プライバシーポリシー ----------
    v.docShown = st.screen==='doc' && !!DOCS[st.docKey];
    if(v.docShown){
      const doc = DOCS[st.docKey];
      v.docTitle = doc.title;
      v.docLead = doc.lead;
      v.docSections = doc.sections;
      v.docEffective = EFFECTIVE;
    }
    v.appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0';

    // ---------- 開発応援（投げ銭） ----------
    // 値段は App Store から取れたときだけ出す。取れないときは行ごと出さない——
    // 押しても買えない行が並ぶより、無いほうがいい。
    // サポーターカード。応援したことがある人にだけ出る。
    // 機能ではなく「自分がやったことの記録」——レシートに近い。
    // 消耗型のまま渡せるのは、何も解放していないから。
    {
      const sup = st.supports || [];
      v.supporterShown = sup.length > 0;
      if(v.supporterShown){
        const total = sup.reduce((a,x)=>a+(x.yen|0), 0);
        const first = new Date(Math.min(...sup.map(x=>x.at)));
        v.supporterCount = sup.length===1 ? '1回' : sup.length+'回';
        v.supporterTotal = '¥'+total.toLocaleString('ja-JP');
        v.supporterSince = `${first.getFullYear()}年${first.getMonth()+1}月から`;
      }
    }

    // 診断（バージョンを5回叩くと出る）
    v.onTapVersion = ()=>this.tapVersion();
    v.probeShown = !!st.probe;
    if(st.probe){
      const p = st.probe;
      v.onProbeClose = ()=>this.setState({probe:null});
      v.onProbeRetry = ()=>this.runProbe();
      v.probeRows = p.running ? [{k:'', val:'読み込み中…'}] : [
        {k:'ネイティブか', val: p.native ? 'はい' : 'いいえ（ブラウザ）'},
        {k:'課金が使えるか', val: p.billing===null ? '—' : (p.billing ? 'はい' : 'いいえ')},
        {k:'聞いた製品ID', val: (p.asked||[]).join(String.fromCharCode(10))},
        {k:'返ってきた数', val: String((p.got||[]).length)},
        {k:'返ってきたID', val: (p.got||[]).length ? p.got.join(String.fromCharCode(10)) : '（なし）'},
        {k:'エラー', val: p.error || '（なし）'},
      ];
    }

    v.tipShown = Array.isArray(st.tips) && st.tips.length > 0;
    v.tipRows = (st.tips||[]).map((t,i)=>({
      label:t.label, price:t.price,
      rowStyle:{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',cursor:'pointer',
        ...(i < (st.tips.length-1) ? {borderBottom:'1px solid var(--line)'} : {})},
      onClick:()=>this.buyTip(t.id),
    }));
    // 困ったときの連絡先。アプリ内に無いと、メールではなくレビュー欄に書かれる。
    // 版を件名に入れておくと、どの版の話か聞き返さずに済む。
    v.contactEmail = CONTACT;
    v.contactHref = 'mailto:'+CONTACT
      +'?subject='+encodeURIComponent(APP_NAME+' について（v'+v.appVersion+'）');
    // App Store のレビュー欄を直接開く
    v.reviewHref = 'https://apps.apple.com/app/id'+APP_STORE_ID+'?action=write-review';

    // ---------- 控え（バックアップ） ----------
    v.onExportBackup = ()=>this.exportBackup();
    // 戻すのは「ファイルをえらぶ」が本筋。貼り付けは、えらべなかったときの逃げ道。
    v.onPickBackup = ()=>this.pickBackupFile();
    v.onBackupFile = (e)=>this.readBackupFile(e);
    v.pasteOpen = !!st.pasteOpen;
    v.onTogglePaste = ()=>{ tapLight(); this.setState(s=>({pasteOpen:!s.pasteOpen, backupText:'', backupError:''})); };
    v.backupText = st.backupText||'';
    v.onBackupText = (e)=>{ const val=e.target.value; this.setState({backupText:val, backupError:''}); };
    v.backupError = st.backupError||'';
    v.onAskRestore = ()=>this.askRestore();
    v.restoreDisabled = !(st.backupText||'').trim();

    v.wageLabelColor = wageOn ? 'var(--ink)' : 'var(--ink-mut)';
    v.theme = st.settings.dark ? 'dark' : 'light';

    // ---------- お知らせ（ベル） ----------
    const nowMs = Date.now();
    const unread = unreadCount(st.notices);
    v.bellCount = unread;
    v.bellBadge = unread > 9 ? '9+' : String(unread);
    v.noticesShown = st.screen==='notices';
    if(v.noticesShown){
      v.noticeEmpty = st.notices.length===0;
      v.noticeHasUnread = unread>0;
      v.onMarkAllRead = ()=>this.markAllRead();
      v.onNoticesBack = ()=>this.setState({screen:'month', noticeOpen:null});
      // 何の知らせなのかを、アイコンだけでなく言葉でも出す
      const kindWord=(n)=> n.kind===KIND_SHIFT ? 'シフトの記録' : 'アップデート';
      const kindTagStyle=(n)=>({ fontSize:10,fontWeight:700,letterSpacing:'.02em',padding:'2px 7px',borderRadius:6,flexShrink:0,
        background: n.kind===KIND_SHIFT ? 'rgba(29,158,117,.13)' : 'var(--bg2)',
        color: n.kind===KIND_SHIFT ? '#0F6E56' : 'var(--ink-mut)' });
      v.noticeRows = sortNotices(st.notices).map(n=>({
        key:n.id, title:n.title, when:relativeTime(n.at, nowMs), unread:!n.read,
        kindWord:kindWord(n), kindTagStyle:kindTagStyle(n),
        onClick:()=>this.openNotice(n),
        dotStyle:{ width:7,height:7,borderRadius:4,flexShrink:0,
          background: n.read ? 'transparent' : '#1D9E75' },
      }));
      // タップして中央に開く詳細
      const open = st.notices.find(n=>n.id===st.noticeOpen);
      v.noticeSheetShown = !!open;
      if(open){
        const at=new Date(open.at);
        v.nsKindWord = kindWord(open);
        v.nsKindTagStyle = kindTagStyle(open);
        v.nsTitle = open.title;
        v.nsBody = open.body;
        v.nsDate = at.getFullYear()+'年'+(at.getMonth()+1)+'月'+at.getDate()+'日';
        v.nsWhen = relativeTime(open.at, nowMs);
        v.nsIsShift = open.kind===KIND_SHIFT;
        // シフトの知らせからは、その場で実働を記録しにいける
        v.nsActionLabel = v.nsIsShift ? '実働を記録する' : '';
        v.onNoticeAction = ()=>{
          const ev=st.events.find(e=>String(e.id)===String(open.eventId));
          this.setState({noticeOpen:null});
          if(ev) this.openDialog(ev,'worked','notices');
        };
        v.onNoticeSheetClose = ()=>this.setState({noticeOpen:null});
      }
    }
    // 5つを等幅で並べる（真ん中が＋）。アイランド型なので幅は固定せず分け合う
    const navItem=(active)=>({display:'flex',flex:1,flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',color:active?'var(--ink)':'var(--ink-faint)',transition:'color .2s'});
    v.navCalStyle = navItem(st.screen==='month');
    v.navFreeStyle = navItem(st.screen==='free');
    v.navReportStyle = navItem(st.screen==='report');
    v.navSettingsStyle = navItem(st.screen==='settings');

    // ---------- SETTINGS ----------
    const cfg=st.settings;
    v.settingsShown = st.screen==='settings';
    // 時給の入力は設定から外した。時給はバイト先ごとに決める。
    // settings.hourly は、バイト先を選んでいない昔の予定のための控えとして残してある。
    const segCell=(sel)=>({flex:1,textAlign:'center',padding:'8px 0',borderRadius:7,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',transition:'all .2s cubic-bezier(.2,.9,.2,1)',background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
    v.weekSeg=[[0,'日曜'],[1,'月曜']].map(([n,label])=>({ label, onClick:()=>this.setSetting('weekStart',n), style:segCell(cfg.weekStart===n) }));
    v.typeRows = st.types.map((t,i)=>({
      name:t.name, open: st.editTypeKey===t.key, hint: st.editTypeKey===t.key?'':'名前と色',
      rowStyle:{borderBottom:'1px solid var(--line)'},
      dotStyle:{width:18,height:18,borderRadius:12,background:t.color,flexShrink:0,boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)'},
      onTap:()=>this.setState(s=>({editTypeKey:s.editTypeKey===t.key?null:t.key})),
      onName:(e)=>this.renameType(t.key, e.target.value),
      usedCount: st.events.filter(e=>e.type===t.key).length,
      swatches:this.PAL.map(hex=>({ style:{width:26,height:26,borderRadius:13,background:hex,cursor:'pointer',boxShadow: t.color===hex?'0 0 0 2px #fff, 0 0 0 4px '+hex:'inset 0 0 0 1px rgba(0,0,0,.08)'}, onClick:()=>this.recolorKey(t.key,hex) })),
    }));
    // ---------- 月表示の年月えらび ----------
    {
      const sh = st.ymSheet;
      v.ymSheetShown = !!sh;
      if(sh){
        const sy = sh.y;
        v.ymSheetYear = String(sy);
        v.onYmSheetClose = ()=>this.setState({ymSheet:null});
        const shiftYear=(d)=>this.setState(s=>({ymSheet:{y:s.ymSheet.y+d, dir:d}}));
        v.onYmSheetPrevYear = ()=>{ tapLight(); shiftYear(-1); };
        v.onYmSheetNextYear = ()=>{ tapLight(); shiftYear(1); };
        // 月の並びを横に払っても年が変わる。‹ › の的が小さいので、
        // 空き状況の一覧と同じ「離したときに切り替える」やり方に合わせる。
        v.onYmSheetTouchStart = (e)=>{ const t=e.touches&&e.touches[0]; if(!t) return;
          this._ysx=t.clientX; this._ysy=t.clientY; this._yAxis=null; };
        v.onYmSheetTouchMove = (e)=>{ const t=e.touches&&e.touches[0]; if(!t||this._ysx==null) return;
          const dx=t.clientX-this._ysx, dy=t.clientY-this._ysy;
          if(!this._yAxis){
            if(Math.abs(dx)<8 && Math.abs(dy)<8) return;
            this._yAxis = Math.abs(dx)>Math.abs(dy)*1.2 ? 'x' : 'y';
          } };
        v.onYmSheetTouchEnd = (e)=>{ const t=e.changedTouches&&e.changedTouches[0];
          const wasX=this._yAxis==='x', sx=this._ysx;
          this._ysx=null; this._yAxis=null;
          if(!t||!wasX||sx==null) return;
          const dx=t.clientX-sx;
          if(Math.abs(dx)<60) return;   // 浅い払いでは動かさない
          tapLight(); shiftYear(dx<0 ? 1 : -1); };
        // 年が変わるたびに key も変えて、滑り込みをやり直させる
        v.ymSheetGridKey = String(sy);
        v.ymSheetGridStyle = {display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8,
          touchAction:'pan-y',
          animation: sh.dir ? (sh.dir>0?'slideFromRight':'slideFromLeft')+' .24s cubic-bezier(.2,.9,.2,1)' : 'none'};
        const t=st.today;
        v.onYmSheetToday = ()=>{ tapLight(); this.setState({ym:{y:t.y,m:t.m}, dayNum:null, ymSheet:null}); };
        v.ymSheetTodayLabel = `今月（${t.y}年${t.m+1}月）`;
        v.ymSheetMonths = Array.from({length:12},(_,i)=>{
          const sel = sy===st.ym.y && i===st.ym.m;
          const isThis = sy===t.y && i===t.m;
          return { label:(i+1)+'月',
            onClick:()=>{ tapLight(); this.setState({ym:{y:sy,m:i}, dayNum:null, ymSheet:null}); },
            style:{padding:'13px 0',textAlign:'center',borderRadius:12,fontSize:15,cursor:'pointer',
              fontWeight:sel?700:500, transition:'all .18s',
              background: sel?'var(--ink)':'var(--card)',
              color: sel?'var(--card)':'var(--ink-soft)',
              border:'1px solid '+(sel?'var(--ink)':(isThis?'var(--ink-faint)':'var(--line)'))} };
        });
      }
    }

    v.onAddTypeRow = ()=>{ tapLight(); this.setState(s=>({newType: s.newType?null:{name:'',color:'#2F72C4'}, editTypeKey:null})); };
    // 種類は増えていくもの。ぜんぶ並べると、それだけで設定画面が埋まる。
    // ふだんはたたんで、色の点だけ出しておく（何があるかは点で分かる）。
    v.typeListOpen = !!st.typeListOpen;
    v.onToggleTypeList = ()=>{ tapLight(); this.setState(s=>({typeListOpen:!s.typeListOpen,
      editTypeKey:null, newType:null})); };
    v.typeCountLabel = st.types.length+'つ';
    v.typeDots = st.types.slice(0,8).map(t=>({
      style:{width:13,height:13,borderRadius:7,background:t.color,flexShrink:0,
        boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)'} }));
    v.typeMoreLabel = st.types.length>8 ? '+'+(st.types.length-8) : '';
    const tgTrack=(on,col)=>({width:44,height:26,borderRadius:13,background:on?'var(--ink)':'var(--line)',padding:2,transition:'background .28s cubic-bezier(.2,.9,.2,1)',cursor:'pointer',display:'flex',flexShrink:0});
    const tgKnob=(on)=>({width:22,height:22,borderRadius:11,background:'var(--card)',boxShadow:'0 1px 2px rgba(0,0,0,.25)',transition:'transform .28s cubic-bezier(.2,.9,.2,1)',transform:on?'translateX(18px)':'translateX(0)'});
    v.remindTrack=tgTrack(cfg.remind); v.remindKnob=tgKnob(cfg.remind);
    v.darkTrack=tgTrack(cfg.dark); v.darkKnob=tgKnob(cfg.dark); v.onToggleDark=()=>this.setSetting('dark',!cfg.dark);
    v.onToggleRemind=()=>this.setSetting('remind',!cfg.remind);
    v.hideTrack=tgTrack(cfg.hideCanceled,'#5A6570'); v.hideKnob=tgKnob(cfg.hideCanceled);
    v.onToggleHide=()=>this.setSetting('hideCanceled',!cfg.hideCanceled);

    // ---------- SUMMARY (B) ----------
    v.summaryShown = st.screen==='summary';
    v.shareToast = st.shareToast;
    v.shareToastMsg = st.shareMsg || '';
    // まとめは「表示している月」だけを集計する
    const jis = st.events.filter(e=>e.y===st.ym.y && e.m===st.ym.m && e.status==='jisseki');
    const totalH = jis.reduce((a,e)=>a+this.paidHours(e),0);
    v.sumWage = this.fmtWage(jis.reduce((a,e)=>a+this.wage(e),0));
    v.sumHours = this.fmtHours(totalH);
    const monthEvents = st.events.filter(e=>e.y===st.ym.y && e.m===st.ym.m);
    v.sumPromises = String(monthEvents.filter(e=>e.type==='asobi'&&e.status==='kakutei').length);
    v.sumCanceled = String(monthEvents.filter(e=>e.status==='nakunatta').length);
    v.sumYearMonth = st.ym.y+'年 '+(st.ym.m+1)+'月';
    v.rhythm = monthEvents.map(e=>{ const t=this.T(e.type); const solid=e.status==='kakutei'||e.status==='jisseki';
      return { style:{ width:14,height:14,borderRadius:4, ...(e.status==='nakunatta'?{background:'#EDEEF0'}: solid?{background:t.color,opacity:e.status==='jisseki'?.9:1}:{background:t.paper,border:'1.5px dashed '+t.color}) } }; });

    // ---------- まとめ（働いた時間） ----------
    v.reportShown = st.screen==='report';
    if(v.reportShown){
      const Y=st.ym.y, M=st.ym.m;
      const sum=(list)=>{
        const hours=list.reduce((a,e)=>a+this.paidHours(e),0);
        const wage=list.reduce((a,e)=>a+this.wage(e),0);
        return { hours, wage, days:list.length };
      };
      const doneAll = st.events.filter(e=>e.status==='jisseki');
      const mo = sum(doneAll.filter(e=>e.y===Y && e.m===M));
      const yr = sum(doneAll.filter(e=>e.y===Y));
      v.repMonthLabel = (M+1)+'月';
      v.repYearLabel = Y+'年';
      v.repMonthHours = this.fmtHours(mo.hours);
      v.repMonthWage = this.fmtWage(mo.wage);
      v.repMonthDays = String(mo.days);
      v.repYearHours = this.fmtHours(yr.hours);
      v.repYearWage = this.fmtWage(yr.wage);
      v.repYearDays = String(yr.days);
      v.repEmpty = doneAll.length===0;
      // 月ごとの棒。今年の12ヶ月ぶんを並べて、働いた量の起伏を見せる
      const perMonth = Array.from({length:12},(_,i)=>sum(doneAll.filter(e=>e.y===Y && e.m===i)).hours);
      const peak = Math.max(1, ...perMonth);
      v.repBars = perMonth.map((h,i)=>({
        label: (i+1),
        hours: h,
        isCur: i===M,
        barStyle:{ height: Math.max(3, Math.round(h/peak*74))+'px', borderRadius:4, background: i===M?'#1D9E75':(h>0?'rgba(29,158,117,.32)':'var(--line)'), transition:'height .3s cubic-bezier(.2,.9,.2,1)' },
        labelStyle:{ fontSize:9, marginTop:5, color: i===M?'var(--ink)':'var(--ink-faint)', fontWeight:i===M?700:500 },
        onClick:()=>this.setState({ym:{y:Y,m:i}}),
      }));
      v.onRepPrevYear = ()=>this.setState(s=>({ym:{y:s.ym.y-1,m:s.ym.m}}));
      v.onRepNextYear = ()=>this.setState(s=>({ym:{y:s.ym.y+1,m:s.ym.m}}));
      v.onOpenSummaryCard = ()=>this.setState({screen:'summary', shareToast:false, cardFrom:'report'});
    }

    // ---------- 空いてる日シェア (C) ----------
    v.shareShown = st.screen==='share';

    // ---------- 知らせのひとこと ----------
    // これまで、まとめ／空きシェアの画面の中にしか置いていなかった。
    // 控えから戻すと月表示に移るので、予定が丸ごと置き換わったのに何も出ていなかった。
    // 取り返しのつかない操作こそ、済んだことを言う。
    v.toastShown = !!st.shareToast && !v.summaryShown && !v.shareShown;
    v.toastMsg = st.shareMsg || '';
    // ナビの島に隠れない高さに置く
    v.toastBottom = v.navShown ? 96 : 30;
    const swl=['日','月','火','水','木','金','土'];
    const sws=cfg.weekStart;
    v.shareWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+sws)%7; return { label:swl[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,color:dw===0?'var(--ink-mut)':dw===6?'var(--ink-mut)':'#B0B4BB'} }; });
    const shY=st.ym.y, shM=st.ym.m;
    const sRawFirst=new Date(shY,shM,1).getDay(), sFirst=(sRawFirst-sws+7)%7;
    const sDim=new Date(shY,shM+1,0).getDate();
    v.shareMonthLabel = String(shM+1);
    const sCells=[];
    for(let i=0;i<sFirst;i++) sCells.push({ label:'', style:{} });
    for(let d=1;d<=sDim;d++){
      const busy = st.events.some(e=>evCovers(e,dayNo(shY,shM,d)) && (e.status==='kakutei'||e.status==='jisseki'));
      sCells.push({ label:d, style: busy
        ? { height:34,borderRadius:7,background:'#EDEEF0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:'#C1C5CC' }
        : { height:34,borderRadius:7,background:'#FAECE7',border:'1.5px solid #D85A30',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#712B13' } });
    }
    v.shareCells = sCells;

    v.wageTrackStyle = { width:44,height:26,borderRadius:13,background:wageOn?'var(--ink)':'var(--line)',padding:2,transition:'background .28s cubic-bezier(.2,.9,.2,1)',cursor:'pointer',display:'flex' };
    v.wageKnobStyle = { width:22,height:22,borderRadius:11,background:'var(--card)',boxShadow:'0 1px 2px rgba(0,0,0,.25)',transition:'transform .28s cubic-bezier(.2,.9,.2,1)',transform:wageOn?'translateX(18px)':'translateX(0)' };

    const ws=st.settings.weekStart;
    const wlRot=Array.from({length:7},(_,i)=>{ const dw=(i+ws)%7; return {label:wl[dw], dw}; });
    v.weekdays = wlRot.map(({label,dw})=>({ label, style:{textAlign:'center',fontSize:11,fontWeight:600,padding:'6px 0',
      color: dw===0 ? HOLIDAY_RED : dw===6 ? SATURDAY_BLUE : '#9AA0A6'} }));

    // month — 前後の月も一緒に作る（スワイプで指についてくるように並べるため）
    const Y=st.ym.y, M=st.ym.m;
    const rawFirst=new Date(Y,M,1).getDay();
    // 週ごとに組む。日をまたぐ予定を1本の帯にするには、
    // マスの中にピルを積むのではなく、週の中で列をまたがせる必要がある。
    const buildWeeks=(Y,M)=>{
      const wFirst=new Date(Y,M,1).getDay(), dim=new Date(Y,M+1,0).getDate();
      const today=(st.today.y===Y && st.today.m===M) ? st.today.d : 0;
      const first=(wFirst-ws+7)%7;
      const weekCount=Math.ceil((first+dim)/7);
      const monthA=dayNo(Y,M,1), monthB=dayNo(Y,M,dim);
      // この月にかかる予定だけを相手にする。日またぎは前の月から始まっていることもある。
      const pool=st.events.filter(e=>
        !(st.settings.hideCanceled && e.status==='nakunatta') &&
        evTo(e)>=monthA && evFrom(e)<=monthB);

      const weeks=[];
      for(let w=0; w<weekCount; w++){
        // この週の7マスに入る日。月の外は null
        const slotDays=Array.from({length:7},(_,i)=>{ const d=w*7+i-first+1; return (d>=1&&d<=dim)?d:null; });
        const real=slotDays.filter(d=>d!==null);
        const weekA=dayNo(Y,M,real[0]), weekB=dayNo(Y,M,real[real.length-1]);
        const colOf=(n)=>(n-monthA)+first-w*7; // 通し番号 → この週の何列目か

        // 長い帯から先に段を決める。同じ段に居続けるので、隣のマスと横一列につながる。
        const inWeek=pool.filter(e=>evTo(e)>=weekA && evFrom(e)<=weekB)
          .sort((a,b)=> (evSpan(b)-evSpan(a)) || (evFrom(a)-evFrom(b))
            || (this.mins(a.start)-this.mins(b.start)) || String(a.id).localeCompare(String(b.id)));

        const lanes=[]; const bars=[]; const overflow={};
        for(const ev of inWeek){
          const a=Math.max(evFrom(ev),weekA), b=Math.min(evTo(ev),weekB);
          let li=0;
          while(lanes[li] && lanes[li].some(r=>a<=r[1] && b>=r[0])) li++;
          if(li>=MAX_LANES){ for(let n=a;n<=b;n++) overflow[n]=(overflow[n]||0)+1; continue; }
          (lanes[li]=lanes[li]||[]).push([a,b]);
          const c0=colOf(a), c1=colOf(b);
          const view=this.pillView(ev, wageOn, { startsHere:a===evFrom(ev), endsHere:b===evTo(ev) });
          // 帯はタップを受けない。マスの狙いにくい17pxの帯を正確に突くのではなく、
          // マスのどこを押してもその日の一覧が開き、そこから選んでもらう。
          // 日をまたぐ帯を押したときも、押した位置の下にあるマス＝その日が開く。
          bars.push({ key:ev.id+'-'+w, ...view,
            style:{...view.style, gridColumn:(c0+1)+' / span '+(c1-c0+1), gridRow:li+2, pointerEvents:'none', zIndex:1, cursor:'default'} });
        }

        // 日と日のあいだの細い縦線。地の層に引くので、日をまたぐ帯はこれを覆い隠す。
        // 「隙間から線が見える＝切れている」「線が隠れている＝続いている」を、
        // 文字の幅を一切削らずに成り立たせる。
        // 週の区切り（--line）より一段薄い --line-faint を使う。
        // 1px より細くは描けない（DPR 2/3 でも 0.8px に丸められる）ので、細さは色で作る。
        const colLine=(i)=>i<6?{borderRight:'1px solid var(--line-faint)'}:{};
        const slots=slotDays.map((d,i)=>{
          // 前後の月のマスに面は敷かない（情報がゼロなのに罫線より主張していた）。
          // ただし日付は薄く出す。月の切れ目が分かり、週の並びも読みやすくなる。
          if(d===null){
            const out=fromDayNo(monthA + (w*7 + i - first));
            return { blank:true, day:out.d,
              bgStyle:{background:'var(--card)',...colLine(i)},
              numWrap:{gridColumn:i+1, gridRow:1, lineHeight:'20px', paddingLeft:3, alignSelf:'center'},
              numStyle:{fontSize:11, fontWeight:500, color:'var(--ink-faint)'},
              onDay:()=>{} };
          }
          const dow=(wFirst+d-1)%7, isToday=d===today;
          const hol=holidayName(Y,M,d);
          // 祝日と日曜は赤、土曜は青。日本のカレンダーの見慣れた並びに合わせる。
          const dayColor = (hol || dow===0) ? HOLIDAY_RED : dow===6 ? SATURDAY_BLUE : 'var(--ink)';
          return {
            blank:false, day:d,
            bgStyle:{background:'var(--card)',cursor:'pointer',...colLine(i)},
            numWrap:{gridColumn:i+1, gridRow:1, lineHeight:'20px', paddingLeft:3, alignSelf:'center'},
            // 今日は塗りつぶした丸。一度これを輪郭だけにしてみたが、
            // 弱すぎたので戻した（画面で一番濃いインクでよい、という判断）。
            numStyle: isToday
              ? {display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:13,background:'var(--ink)',color:'var(--card)',fontSize:11,fontWeight:600}
              : {fontSize:11,fontWeight:(hol||dow===0||dow===6)?600:500, color:dayColor},
            onDay:()=>this.openDay(d),
          };
        });

        const more=Object.keys(overflow).map(n=>({
          text:'+'+overflow[n]+'件',
          style:{gridColumn:(colOf(Number(n))+1)+' / span 1', gridRow:MAX_LANES+2, fontSize:10,fontWeight:500,color:'var(--ink-mut)',paddingLeft:4,lineHeight:'13px',whiteSpace:'nowrap',overflow:'hidden'},
        }));

        weeks.push({
          key:Y+'-'+M+'-w'+w, slots, bars, more,
          // 週の区切りだけ線を引く。マスを囲む枠は引かない（予定を浮き上がらせるため）
          // 「+N件」の行は auto にする。固定で13px取ると、その日に溢れが無くても
          // 高さを食い、6週の月が実機で下にはみ出す（段を4に増やしたときに起きた）。
          rowStyle:{position:'relative', flex:'1 1 0', minHeight:22+MONTH_LANE_H*MAX_LANES,
            ...(w>0?{borderTop:'1px solid var(--line)'}:{})},
          gridStyle:{position:'relative', display:'grid', gridTemplateColumns:'repeat(7,1fr)',
            gridTemplateRows:'22px repeat('+MAX_LANES+','+MONTH_LANE_H+'px) auto', alignContent:'start', pointerEvents:'none', height:'100%'},
        });
      }
      return weeks;
    };
    const prevYM=shiftMonth(st.ym,-1), nextYM=shiftMonth(st.ym,1);
    v.monthPages=[
      { key:prevYM.y+'-'+prevYM.m, weeks:buildWeeks(prevYM.y,prevYM.m) },
      { key:st.ym.y+'-'+st.ym.m,   weeks:buildWeeks(st.ym.y,st.ym.m) },
      { key:nextYM.y+'-'+nextYM.m, weeks:buildWeeks(nextYM.y,nextYM.m) },
    ];
    // 指の動きぶんだけ横にずらす。離したときだけ滑らせる。
    // 絶対配置にして、flex の縮みで幅が崩れないようにする
    const sw=st.swipe||{dx:0,animating:false};
    v.trackStyle={ position:'absolute', top:0, left:0, height:'100%', width:'300%', display:'flex',
      transform:`translateX(calc(-33.3333% + ${sw.dx}px))`,
      transition: sw.animating ? 'transform .3s cubic-bezier(.22,.86,.3,1)' : 'none' };
    // 給料バーが出ているぶん、下に余白を足して最終週が隠れないようにする
    v.monthPadBottom = (wageOn ? 168 : 104)+'px';
    // まだ何も置かれていないときだけ、静かに使い方を添える
    // 予定が無いあいだ出る案内。✕ で消したら、もう出さない。
    // 消した人は「分かっている」と言っているので、予定をぜんぶ消して
    // また0件になっても掘り返さない。
    v.showFirstRunHint = st.events.length===0 && !st.settings.hintClosed;
    v.onCloseFirstRunHint = (e)=>{ if(e) e.stopPropagation(); tapLight(); this.setSetting('hintClosed', true); };
    v.monthTotal = this.fmtWage(st.events.filter(e=>e.y===Y && e.m===M && e.status==='jisseki').reduce((a,e)=>a+this.wage(e),0));

    // ---------- DAY ----------
    if(st.dayNum){
      const d=st.dayNum, dow=(rawFirst+d-1)%7;
      const dayHol = holidayName(Y,M,d);
      v.dayTitle = (M+1)+'月'+d+'日（'+wl[dow]+'）';
      v.dayHoliday = dayHol || '';
      v.dayTitleStyle = {fontSize:16,fontWeight:600,
        color: (dayHol || dow===0) ? HOLIDAY_RED : dow===6 ? SATURDAY_BLUE : 'var(--ink)'};
      // 日をまたぐ予定も、覆っている日すべてに出す。
      // 月表示で隠している「無くなった」予定は、ここでも隠す（画面ごとに違うと混乱する）
      const dn=dayNo(Y,M,d);
      const evs=st.events.filter(e=>evCovers(e,dn) && !(st.settings.hideCanceled && e.status==='nakunatta'))
        .sort((a,b)=> (evSpan(b)-evSpan(a)) || (this.mins(a.start)-this.mins(b.start)));
      v.dayEmpty = evs.length===0;
      const sr=st.swipeRow;
      v.dayEvents = evs.map(ev=>{
        const endShown = ev.status==='jisseki' ? (ev.actualEnd||ev.end) : ev.end;
        const dx = (sr && sr.id===ev.id) ? sr.dx : 0;
        const open = dx < -2;
        return {
          key: ev.id,
          chipStyle: {...this.pillStyle(ev), height:26, lineHeight:'26px', fontSize:13, padding:'0 12px', marginBottom:0, borderRadius:6, display:'inline-block', flexShrink:0, overflow:'visible', textOverflow:'clip', width:'max-content', maxWidth:220},
          chipText: this.pillText(ev,false),
          timeText: ev.allDay ? (evSpan(ev)>1 ? this.spanLabel(ev)+'（終日）' : '終日') : ev.start+'–'+endShown,
          statusWord: this.statusWord(ev),
          // 開いているときは、本文をタップしても予定を開かず、まず閉じる
          onClick: ()=>{ if(open){ this.closeSwipeRow(); return; } this.setState({swipeRow:null}); this.openFor(ev,'day'); },
          onTouchStart:(e)=>this.rowSwipeStart(ev.id,e),
          onTouchMove:(e)=>this.rowSwipeMove(ev.id,e),
          onTouchEnd:()=>this.rowSwipeEnd(ev.id),
          // 削除ボタンは行の下に敷いておき、本文をずらして見せる
          wrapStyle:{position:'relative',borderRadius:15,overflow:'hidden',marginBottom:9},
          delWrapStyle:{position:'absolute',top:0,right:0,bottom:0,width:this.SWIPE_W,display:'flex',
            alignItems:'center',justifyContent:'center',background:'#B4453A',cursor:'pointer'},
          onDelete:(e)=>{ if(e)e.stopPropagation(); tapLight(); this.askDelete(ev.id); },
          bodyStyle:{display:'flex',alignItems:'center',gap:12,background:'var(--card)',borderRadius:15,padding:14,
            border:'1px solid var(--line)',cursor:'pointer',position:'relative',
            transform:'translateX('+dx+'px)',
            transition: (sr&&sr.id===ev.id&&sr.animating)?'transform .22s cubic-bezier(.2,.9,.2,1)':'none',
            touchAction:'pan-y'},
        };
      });
      v.onDayAdd = ()=>this.openNew(d,'day');
    }

    // ---------- NEW ----------
    const dr=st.draft, dt=this.T(dr.type);
    v.draftTitle=dr.title; v.draftColor=dt.color; v.draftStart=dr.start; v.draftEnd=dr.end;
    v.onTitle=(e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft,title:val}})); };
    v.onSave=()=>this.save();

    // 終日 / 時間指定
    // ---------- 日付えらび（小さなカレンダーを開く） ----------
    v.editing = !!dr.editingId;
    v.newTitle = dr.editingId ? '予定を編集' : '新しい予定';
    const DOW=['日','月','火','水','木','金','土'];
    const dDate=new Date(dr.y,dr.m,dr.day);
    v.dateLabel = `${dr.y}年${dr.m+1}月${dr.day}日（${DOW[dDate.getDay()]}）`;
    v.dateOpen = dr.picking==='date';
    v.onTapDate = ()=>this.setState(s=>({draft:{...s.draft, picking:s.draft.picking==='date'?null:'date', pickY:s.draft.y, pickM:s.draft.m, pickedOnce:false, pickYM:false}}));
    // 複数日えらんだときの表示
    const extras=(dr.extraDays||[]).length;
    v.dateExtraCount = extras;
    v.dateSummary = extras ? `ほか${extras}日` : '';
    v.dateHint = v.dateOpen ? '日をえらんでください' : '';
    v.onClearExtraDays = ()=>this.setState(s=>({draft:{...s.draft, extraDays:[]}}));
    const pY = dr.pickY==null?dr.y:dr.pickY, pM = dr.pickM==null?dr.m:dr.pickM;
    v.datePickLabel = `${pY}年${pM+1}月`;
    v.onDatePrev = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},-1); return {draft:{...s.draft,pickY:n.y,pickM:n.m}}; });
    v.onDateNext = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},1); return {draft:{...s.draft,pickY:n.y,pickM:n.m}}; });
    // 「2026年7月」を押すと、年と月を直接えらべる。
    // 1ヶ月ずつしか動けないと、来年3月に行くのに8回タップすることになる。
    v.ymPickOpen = !!dr.pickYM;
    v.onTapYM = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, pickYM:!s.draft.pickYM}})); };
    v.ymYearLabel = String(pY);
    v.onYearPrev = ()=>this.setState(s=>({draft:{...s.draft, pickY:pY-1}}));
    v.onYearNext = ()=>this.setState(s=>({draft:{...s.draft, pickY:pY+1}}));
    v.ymMonths = Array.from({length:12},(_,i)=>{ const sel=i===pM;
      return { label:(i+1)+'月', onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, pickM:i, pickYM:false}})); },
        style:{padding:'11px 0',textAlign:'center',borderRadius:11,fontSize:14,fontWeight:sel?700:500,cursor:'pointer',
          transition:'all .18s', background:sel?'var(--ink)':'var(--card)', color:sel?'var(--card)':'var(--ink-soft)',
          border:'1px solid '+(sel?'var(--ink)':'var(--line)')} }; });
    const dws=st.settings.weekStart;
    v.dateWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+dws)%7;
      return { label:DOW[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,padding:'4px 0',
        color: dw===0 ? HOLIDAY_RED : dw===6 ? SATURDAY_BLUE : 'var(--ink-faint)'} }; });
    {
      const first=(new Date(pY,pM,1).getDay()-dws+7)%7;
      const dim=new Date(pY,pM+1,0).getDate();
      const cells=[];
      for(let i=0;i<first;i++) cells.push({ label:'', style:{height:36} });
      for(let d2=1;d2<=dim;d2++){
        const isMain = pY===dr.y && pM===dr.m && d2===dr.day;
        const isExtra = (dr.extraDays||[]).includes(pY+'-'+pM+'-'+d2);
        const sel = isMain || isExtra;
        const isToday = st.today.y===pY && st.today.m===pM && st.today.d===d2;
        const dw2 = new Date(pY,pM,d2).getDay();
        const hol2 = holidayName(pY,pM,d2);
        const c2 = (hol2||dw2===0) ? HOLIDAY_RED : dw2===6 ? SATURDAY_BLUE : 'var(--ink-soft)';
        cells.push({ label:d2,
          style:{height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12,cursor:'pointer',
            fontSize:14,fontVariantNumeric:'tabular-nums',
            fontWeight:sel?700:(isToday?700:500),
            background: isMain?'var(--ink)': isExtra?'var(--bg2)':'transparent',
            color: isMain?'var(--card)':c2,
            border: isExtra ? '1.5px solid var(--ink)' : (!sel&&isToday)?'1px solid var(--line)':'1px solid transparent'},
          // 押した日だけを選ぶ。
          // 以前は2回目以降を「追加の日」として足していたが、
          // 12日を押すつもりで13日を押したとき、押し直すと両方が選ばれてしまい、
          // 間違いを直す手段が無かった。押し間違いは必ず起きるので、
          // 直せないほうを取り除いた。複数日は別の入口で作る。
          onClick:()=>{ if(isMain) return;
            tapLight();
            this.setState(s=>({draft:{...s.draft, y:pY, m:pM, day:d2, extraDays:[], pickedOnce:true}})); } });
      }
      v.dateCells=cells;
    }

    // ---------- バイト先（新規作成画面） ----------
    v.jobPickerShown = dr.type==='baito';
    v.jobChips = (st.jobs||[]).map(j=>{ const sel=j.id===dr.jobId;
      return { label:(j.name||'名前なし')+'　¥'+j.hourly, onClick:()=>this.pickJob(j.id),
        style:{padding:'8px 14px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',
          background:sel?'#1D9E75':'var(--card)', color:sel?'#fff':'var(--ink-mut)',
          border:'1px solid '+(sel?'#1D9E75':'var(--line)'), fontVariantNumeric:'tabular-nums'} }; });
    v.jobNoneChip = { label:'バイト先なし', onClick:()=>this.clearJob(),
      style:{padding:'8px 14px',borderRadius:999,fontSize:13,fontWeight:!dr.jobId?700:500,cursor:'pointer',
        background:!dr.jobId?'#1D9E75':'var(--card)', color:!dr.jobId?'#fff':'var(--ink-mut)',
        border:'1px solid '+(!dr.jobId?'#1D9E75':'var(--line)'), fontVariantNumeric:'tabular-nums'} };
    // その場で足せるようにする。画面を離れないので入力が消えない。
    v.onAddJobFromNew = ()=>this.startNewJob();
    v.newJobShown = !!st.newJob;
    if(st.newJob){
      v.newJobName = st.newJob.name;
      v.newJobHourly = String(st.newJob.hourly);
      v.onNewJobName = (e)=>{ const val=e.target.value; this.setState(s=>({newJob:{...s.newJob,name:val}})); };
      v.onNewJobHourly = (e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,''),10);
        this.setState(s=>({newJob:{...s.newJob,hourly:isNaN(n)?0:Math.min(99999,n)}})); };
      v.onNewJobMinus = ()=>this.setState(s=>({newJob:{...s.newJob,hourly:Math.max(0,s.newJob.hourly-10)}}));
      v.onNewJobPlus = ()=>this.setState(s=>({newJob:{...s.newJob,hourly:s.newJob.hourly+10}}));
      v.onCancelNewJob = ()=>this.cancelNewJob();
      v.onCommitNewJob = ()=>this.commitNewJob();
    }

    // ---------- バイト先（設定画面） ----------
    v.jobRows = (st.jobs||[]).map((j,i)=>({
      name:j.name||'（名前なし）', hourly:String(j.hourly), open:st.editJobId===j.id,
      rowStyle:{borderBottom: i<st.jobs.length-1 ? '1px solid var(--line)':'none'},
      onTap:()=>this.setState(s=>({editJobId:s.editJobId===j.id?null:j.id})),
      onName:(e)=>this.patchJob(j.id,{name:e.target.value}),
      onHourly:(e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,''),10); this.patchJob(j.id,{hourly:isNaN(n)?0:Math.min(99999,n)}); },
      onMinus:()=>this.patchJob(j.id,{hourly:Math.max(0,j.hourly-10)}),
      onPlus:()=>this.patchJob(j.id,{hourly:j.hourly+10}),
      onRemove:()=>this.removeJob(j.id),
      usedCount: st.events.filter(e=>e.jobId===j.id).length,
    }));
    v.onAddJob = ()=>this.addJob();
    v.jobsEmpty = (st.jobs||[]).length===0;

    v.timed = !dr.allDay; v.allDayShown = dr.allDay;
    // 何日間つづくか。終日のときだけ選べる（時間指定は1日で完結するもの、という決め）
    {
      const n=Math.max(1,Math.min(60,dr.days|0||1));
      v.spanDays = n;
      v.spanCountLabel = n===1 ? '1日' : n+'日間';
      v.spanRangeLabel = n===1 ? '' : this.spanLabel({y:dr.y,m:dr.m,day:dr.day,days:n});
      v.spanHint = n===1 ? '2日以上にすると、カレンダーで1本の帯になります' : '';
      // 続けて押したぶんが取りこぼされないよう、今の値は state から読む
      const bump=(d)=>()=>{ tapLight(); this.setState(s=>{
        const cur=Math.max(1,Math.min(60,s.draft.days|0||1)), next=cur+d;
        return (next<1||next>60) ? null : {draft:{...s.draft,days:next}};
      }); };
      v.onSpanMinus = bump(-1);
      v.onSpanPlus = bump(1);
      v.spanMinusStyle = {...stepBtn, opacity:n<=1?.35:1};
      v.spanPlusStyle = {...stepBtn, opacity:n>=60?.35:1};
    }
    // 終日の切り替え。終日と時間指定では選べるお知らせが違うので、
    // どちらにも当てはまらない値が残っていたら「なし」に戻す（選択が消えた見た目を避ける）
    v.onToggleAllDay = ()=>{ tapLight(); this.setState(s=>{
      const allDay=!s.draft.allDay;
      const ok = allDay ? [0,1440] : [10,30,60,1440];
      const keep = ok.includes(s.draft.remindMin) ? s.draft.remindMin : null;
      return {draft:{...s.draft, allDay, remindMin:keep, picking:null}};
    }); };
    v.allDayTrack = tgTrack(!!dr.allDay); v.allDayKnob = tgKnob(!!dr.allDay);

    // ---------- 行にたたむ ----------
    // 既定はすべて閉じておき、押した行だけが開く。開けるのは一度に一つ。
    // 中身を削ったのではなく、要るまで見せないだけ。
    const openRow=(key)=>()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, picking: s.draft.picking===key ? null : key}})); };

    v.rowTypeOpen = dr.picking==='type';
    v.onTapTypeRow = openRow('type');
    v.typeValue = dt.name;
    v.typeDotStyle = {width:9,height:9,borderRadius:5,background:dt.color,flexShrink:0};
    v.chevType = chevron(v.rowTypeOpen); v.valType = rowVal(v.rowTypeOpen);

    v.rowJobOpen = dr.picking==='job';
    v.onTapJobRow = openRow('job');
    { const j=(st.jobs||[]).find(x=>x.id===dr.jobId);
      v.jobValue = j ? (j.name||'名前なし') : '設定の時給'; }
    v.chevJob = chevron(v.rowJobOpen); v.valJob = rowVal(v.rowJobOpen);

    // ---------- ＋ で足す項目 ----------
    // くり返し・場所・メモは、いつも使うものではない。
    // 最初から行を並べると、ただシフトを1件入れたいだけの人に
    // 6行ぶんスクロールさせることになる。押したぶんだけ生やす。
    {
      const added = dr.added||[];
      const addable = [
        // 直している予定にくり返しは出さない。すでに1件ずつの予定になっていて、
        // ここで触らせると、どれが変わるのか分からなくなる。
        { key:'rep', label:'くり返し', hide:!!dr.editingId },
        // 複数日もくり返しと同じで、作るときだけ。
        // 直している1件を触っているのに、別の日に予定が生えるのはおかしい。
        { key:'multi', label:'複数日', hide:!!dr.editingId },
        { key:'place', label:'場所' },
        { key:'memo', label:'メモ' },
      ];
      v.addChips = addable.filter(o=>!o.hide && !added.includes(o.key)).map(o=>({
        label:o.label,
        // 押したらその場で開く。もう一度たたませない。
        onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft,
          added:[...(s.draft.added||[]), o.key], picking:o.key}})); },
        style:{padding:'8px 14px',borderRadius:999,fontSize:13,color:'var(--ink-mut)',
          border:'1px dashed var(--line)',cursor:'pointer',whiteSpace:'nowrap'},
      }));
      v.addRowShown = v.addChips.length>0;
      // ✕ で消す。値も一緒に捨てる（行だけ消えて中身が残ると、保存されて驚く）
      const drop=(key,clear)=>()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, ...clear,
        added:(s.draft.added||[]).filter(k=>k!==key),
        picking: s.draft.picking===key ? null : s.draft.picking}})); };
      v.onRemoveRep = drop('rep',{repEvery:null, repDows:[]});
      v.onRemoveMulti = drop('multi',{extraDays:[]});
      v.onRemovePlace = drop('place',{place:''});
      v.onRemoveMemo = drop('memo',{memo:''});
      v.repRowShown = added.includes('rep') && !dr.editingId;
      v.multiRowShown = added.includes('multi') && !dr.editingId;
      v.placeRowShown = added.includes('place');
      v.memoRowShown = added.includes('memo');
      v.addedAny = v.repRowShown || v.multiRowShown || v.placeRowShown || v.memoRowShown;
      v.removeStyle = {width:26,height:26,borderRadius:13,flexShrink:0,display:'flex',
        alignItems:'center',justifyContent:'center',fontSize:13,color:'var(--ink-faint)',
        background:'var(--bg2)',cursor:'pointer'};
    }

    // ---------- 場所とメモ ----------
    // どちらも予定の中身そのもの。持ち物はメモに書く。
    v.rowPlaceOpen = dr.picking==='place';
    v.onTapPlaceRow = openRow('place');
    v.placeValue = (dr.place||'').trim() || 'なし';
    v.placeText = dr.place||'';
    v.onPlaceText = (e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft, place:val}})); };
    v.chevPlace = chevron(v.rowPlaceOpen); v.valPlace = rowVal(v.rowPlaceOpen);

    v.rowMemoOpen = dr.picking==='memo';
    v.onTapMemoRow = openRow('memo');
    { const t=(dr.memo||'').trim();
      v.memoValue = t ? (t.split('\n')[0].slice(0,12)+(t.length>12||t.includes('\n')?'…':'')) : 'なし'; }
    v.memoText = dr.memo||'';
    v.onMemoText = (e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft, memo:val}})); };
    v.chevMemo = chevron(v.rowMemoOpen); v.valMemo = rowVal(v.rowMemoOpen);

    // ---------- 複数日 ----------
    // 日にちの画面から外した「まとめて置く」を、専用の入口として作り直したもの。
    // ここなら、選んだ日をもう一度押せば外せる。日にちの画面で足していたころは
    // 押し間違いを直せなかった（12日のつもりで13日を押すと両方入る）。
    v.rowMultiOpen = dr.picking==='multi';
    v.onTapMultiRow = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft,
      picking: s.draft.picking==='multi' ? null : 'multi',
      pickY:s.draft.y, pickM:s.draft.m, pickYM:false}})); };
    {
      const n=(dr.extraDays||[]).length;
      v.multiValue = n ? `ほか${n}日` : 'なし';
      v.multiClearShown = n>0;
      v.onClearMulti = ()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, extraDays:[]}})); };
      v.multiHint = n
        ? `この予定を、ぜんぶで${n+1}日に置きます`
        : '同じ予定を置きたい日を、タップしてえらんでください';
      const mY = dr.pickY==null?dr.y:dr.pickY, mM = dr.pickM==null?dr.m:dr.pickM;
      v.multiPickLabel = `${mY}年${mM+1}月`;
      v.onMultiPrev = ()=>this.setState(s=>{ const o=shiftMonth({y:mY,m:mM},-1); return {draft:{...s.draft,pickY:o.y,pickM:o.m}}; });
      v.onMultiNext = ()=>this.setState(s=>{ const o=shiftMonth({y:mY,m:mM},1); return {draft:{...s.draft,pickY:o.y,pickM:o.m}}; });
      const mws=st.settings.weekStart;
      v.multiWeekdays = Array.from({length:7},(_,i)=>{ const dw=(i+mws)%7;
        return { label:DOW[dw], style:{textAlign:'center',fontSize:10,fontWeight:600,padding:'4px 0',
          color: dw===0 ? HOLIDAY_RED : dw===6 ? SATURDAY_BLUE : 'var(--ink-faint)'} }; });
      const first=(new Date(mY,mM,1).getDay()-mws+7)%7;
      const dim=new Date(mY,mM+1,0).getDate();
      const cells=[];
      for(let i=0;i<first;i++) cells.push({ label:'', style:{height:36} });
      for(let d2=1;d2<=dim;d2++){
        const isMain = mY===dr.y && mM===dr.m && d2===dr.day;
        const isExtra = (dr.extraDays||[]).includes(mY+'-'+mM+'-'+d2);
        const dw2 = new Date(mY,mM,d2).getDay();
        const hol2 = holidayName(mY,mM,d2);
        const c2 = (hol2||dw2===0) ? HOLIDAY_RED : dw2===6 ? SATURDAY_BLUE : 'var(--ink-soft)';
        cells.push({ label:d2,
          style:{height:36,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:12,
            cursor: isMain?'default':'pointer', fontSize:14, fontVariantNumeric:'tabular-nums',
            fontWeight:(isMain||isExtra)?700:500,
            // 本体の日は「もう選ばれている」ことだけ示して、外させない。
            // ここで外せると、予定の日そのものが消えてしまう。
            background: isMain?'var(--ink)': isExtra?'var(--bg2)':'transparent',
            color: isMain?'var(--card)':c2,
            opacity: isMain?0.55:1,
            border: isExtra ? '1.5px solid var(--ink)' : '1px solid transparent'},
          onClick: isMain ? (()=>{}) : (()=>{ tapLight(); this.toggleExtraDay(mY,mM,d2); }) });
      }
      v.multiCells=cells;
    }

    // ---------- くり返し ----------
    v.rowRepOpen = dr.picking==='rep';
    v.onTapRepRow = openRow('rep');
    {
      const DOWJ=['日','月','火','水','木','金','土'];
      const myDow = new Date(dr.y,dr.m,dr.day).getDay();
      const dows = dr.repDows||[];
      const span = dr.repSpan|0 || 3;
      const made = repeatAfter(dr.y, dr.m, dr.day, dr.repEvery, span, dows);
      // 行にたたんだときの言い方。何がくり返されるのか、開かなくても分かるように。
      v.repValue = !dr.repEvery ? 'なし'
        : dr.repEvery==='day' ? '毎日'
        : dr.repEvery==='week' ? ('毎週' + (dows.length ? dows.slice().sort().map(i=>DOWJ[i]).join('・') : DOWJ[myDow]))
        : dr.repEvery==='month' ? `毎月${dr.day}日`
        : `毎年${dr.m+1}月${dr.day}日`;
      const chip=(sel,dark)=>({padding:'9px 15px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,
        cursor:'pointer',whiteSpace:'nowrap',
        background: sel ? (dark?'var(--ink)':'#1D9E75') : 'var(--card)',
        color: sel ? (dark?'var(--card)':'#fff') : 'var(--ink-mut)',
        border:'1px solid '+(sel ? (dark?'var(--ink)':'#1D9E75') : 'var(--line)')});
      v.repEveryChips = [{key:null,label:'なし'}, ...REPEAT_UNITS].map(o=>{
        const sel=(dr.repEvery||null)===o.key;
        return { label:o.label, style:chip(sel,false),
          onClick:()=>{ tapLight(); this.setState(s=>{
            // 単位ごとに選べる長さが違うので、いまの値が無ければ真ん中に寄せる
            const list=spansFor(o.key);
            const keep=list.some(x=>x.m===(s.draft.repSpan|0));
            return {draft:{...s.draft, repEvery:o.key,
              repSpan: keep ? s.draft.repSpan : list[Math.min(1,list.length-1)].m}};
          }); } };
      });
      v.repUntilShown = !!dr.repEvery;
      // 曜日えらびは「毎週」のときだけ。何も選ばなければ本体と同じ曜日。
      v.repDowShown = dr.repEvery==='week';
      v.repDowChips = DOWJ.map((label,i)=>{ const sel = dows.length ? dows.includes(i) : i===myDow;
        return { label, onClick:()=>{ tapLight(); this.setState(s=>{
            const cur=(s.draft.repDows||[]);
            const base=cur.length?cur:[myDow];
            const next=base.includes(i)?base.filter(x=>x!==i):[...base,i];
            // ぜんぶ外すと何も作れないので、最後の1つは残す
            return {draft:{...s.draft, repDows: next.length?next:base}};
          }); },
          style:{flex:1,textAlign:'center',padding:'9px 0',borderRadius:11,fontSize:13,
            fontWeight:sel?700:500,cursor:'pointer',
            background:sel?'#1D9E75':'var(--card)', color:sel?'#fff':'var(--ink-mut)',
            border:'1px solid '+(sel?'#1D9E75':'var(--line)')} }; });
      v.repWeekChips = spansFor(dr.repEvery).map(o=>({ label:o.label, style:chip(span===o.m,true),
        onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, repSpan:o.m}})); } }));
      if(made.length){
        const last=fromDayNo(made[made.length-1]);
        v.repHint = `${last.y!==dr.y?last.y+'年':''}${last.m+1}月${last.d}日まで、ぜんぶで${made.length+1}件つくります`;
      } else v.repHint = dr.repEvery ? 'この長さでは、ほかに置ける日がありません' : '';
    }
    v.chevRep = chevron(v.rowRepOpen); v.valRep = rowVal(v.rowRepOpen);
    v.valMulti = rowVal(v.rowMultiOpen);

    v.rowRemindOpen = dr.picking==='remind';
    v.onTapRemindRow = openRow('remind');
    v.remindValue = (typeof dr.remindMin==='number') ? this.remindLabel(dr.remindMin, dr.allDay) : 'なし';
    v.chevRemind = chevron(v.rowRemindOpen); v.valRemind = rowVal(v.rowRemindOpen);
    v.chevDate = chevron(v.dateOpen);
    v.dateValStyle = rowVal(v.dateOpen);
    // ---------- お知らせ（リマインダー） ----------
    // 終日の予定は時刻を持たないので、朝9時を基準にした言い方に変える。
    {
      const opts = dr.allDay
        ? [[null,'なし'],[0,'当日の朝'],[1440,'前日の朝'],[2880,'2日前'],[4320,'3日前'],[10080,'1週間前']]
        : [[null,'なし'],[10,'10分前'],[30,'30分前'],[60,'1時間前'],[180,'3時間前'],[1440,'前日'],[2880,'2日前'],[4320,'3日前'],[10080,'1週間前']];
      const cur = typeof dr.remindMin==='number' ? dr.remindMin : null;
      // 数が増えたので、横一列ではなく折り返すチップにする
      v.remindSeg = opts.map(([val,label])=>{ const sel=cur===val;
        return { label, onClick:()=>{ tapLight(); this.setState(s=>({draft:{...s.draft, remindMin:val}})); },
          style:{padding:'8px 13px',borderRadius:999,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',whiteSpace:'nowrap',
            transition:'all .18s', background:sel?'#1D9E75':'var(--card)', color:sel?'#fff':'var(--ink-mut)',
            border:'1px solid '+(sel?'#1D9E75':'var(--line)')} }; });
      v.remindNote = cur===null ? ''
        : dr.allDay
          ? (cur===0 ? '当日の朝9時にお知らせします' : `${cur/1440}日前の朝9時にお知らせします`)
          : (cur>=1440 ? `${cur/1440}日前の同じ時刻にお知らせします`
            : `始まる${cur>=60?Math.round(cur/60)+'時間':cur+'分'}前にお知らせします`);
    }

    // drum-roll wheels
    v.wheelColStyle = {width:66,height:170,overflowY:'scroll',scrollSnapType:'y mandatory',padding:'68px 0',textAlign:'center',WebkitMaskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)',maskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)'};
    v.wheelItemStyle = {height:34,lineHeight:'34px',fontSize:21,fontWeight:600,color:'var(--ink)',scrollSnapAlign:'center',fontVariantNumeric:'tabular-nums'};
    const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    const minutes=Array.from({length:60/MIN_STEP},(_,i)=>String(i*MIN_STEP).padStart(2,'0'));
    const mkRow=(field,label,isFirst)=>({
      label, value:dr[field], open:dr.picking===field,
      rowStyle:{borderBottom:'1px solid var(--line)'},
      valStyle:rowVal(dr.picking===field), chev:chevron(dr.picking===field),
      onTap:()=>this.setState(s=>({draft:{...s.draft,picking:s.draft.picking===field?null:field}})),
      hItems:hours, mItems:minutes,
      hRef: field==='start'?this.refStartH:this.refEndH, mRef: field==='start'?this.refStartM:this.refEndM,
      hScroll: field==='start'?this.scStartH:this.scEndH, mScroll: field==='start'?this.scStartM:this.scEndM,
    });
    v.timeRows=[ mkRow('start','開始',true), mkRow('end','終了',false) ];

    // 開始と終了に日付を添える。
    // 終わりの時刻が始まりより前なら、終わるのは翌日——22:00–1:00 の深夜勤務。
    // 給料はもともと日またぎで計算していたのに、画面がそれを言っていなかった。
    // 終了日は選ばせない。自由に選ばせると「3日後の11:00」のような、
    // 予定ではなく期間になってしまい、実働時間の計算が意味を失う。
    {
      const DOWJ=['日','月','火','水','木','金','土'];
      const fmtDay=(o)=>`${o.m+1}月${o.d}日（${DOWJ[new Date(o.y,o.m,o.d).getDay()]}）`;
      const from={y:dr.y,m:dr.m,d:dr.day};
      v.startDateText = fmtDay(from);
      // 終日は「何日間」で終わりが決まる。時間指定は日またぎだけ見る。
      const span = dr.allDay ? Math.max(1,Math.min(60,dr.days|0||1)) : 1;
      const wraps = !dr.allDay && endsNextDay({start:dr.start, end:dr.end});
      const endN = dayNo(dr.y,dr.m,dr.day) + (dr.allDay ? span-1 : (wraps?1:0));
      v.endDateText = fmtDay(fromDayNo(endN));
      v.endNextDay = wraps;
      // 翌日にずれたときだけ、そう言う。ふだんは静かにしておく。
      v.crossNote = wraps ? '日をまたぐので、終わりは翌日です' : '';
      v.onTapStartDate = ()=>this.setState(s=>({draft:{...s.draft,
        picking: s.draft.picking==='date' ? null : 'date',
        pickY:s.draft.y, pickM:s.draft.m, pickedOnce:false, pickYM:false}}));
    }

    v.chips = st.types.map(t=>{ const sel=dr.type===t.key;
      return { label:t.name, onClick:()=>this.selectType(t.key),
        style:{textAlign:'center',whiteSpace:'nowrap',padding:'10px 15px',borderRadius:13,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all .2s',
          background:sel?t.color:'var(--card)', color:sel?'#fff':'var(--ink-mut)', boxShadow:'none', border:sel?'none':'1px solid var(--line)'} }; });
    v.addChipStyle = {textAlign:'center',whiteSpace:'nowrap',padding:'10px 14px',borderRadius:13,fontSize:14,fontWeight:600,cursor:'pointer',color:'var(--ink-soft)',background:'transparent',border:'1.5px dashed #C9CDD4'};
    v.onAddTypeChip = ()=>this.setState(s=>({newType: s.newType?null:{name:'',color:'#2F72C4'}}));

    // 色を変えるのは設定画面の「種類」に一本化した（作成画面では出さない）

    // new type creator
    const nt=st.newType;
    v.newTypeShown=!!nt;
    if(nt){
      v.newTypeName=nt.name;
      v.onNewTypeName=(e)=>{ const val=e.target.value; this.setState(s=>({newType:{...s.newType,name:val}})); };
      v.newTypeSwatches = this.PAL.map(hex=>({ style:{width:26,height:26,borderRadius:13,background:hex,cursor:'pointer',boxShadow: nt.color===hex?'0 0 0 2px #fff, 0 0 0 4px '+hex:'inset 0 0 0 1px rgba(0,0,0,.08)'}, onClick:()=>this.setState(s=>({newType:{...s.newType,color:hex}})) }));
      v.addTypeBtnStyle={flex:1,textAlign:'center',padding:'11px',borderRadius:13,background:nt.color,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'};
      v.onAddType=()=>this.addType();
      v.onCancelNewType=()=>this.setState({newType:null});
    } else { v.newTypeName=''; }

    v.seg=[['kakutei','決まってる'],['mikakutei','まだ不確定']].map(([k,label])=>{ const sel=dr.status===k;
      return { label, onClick:()=>this.setState(s=>({draft:{...s.draft,status:k}})),
        style:{flex:1,textAlign:'center',padding:'9px 0',borderRadius:11,fontSize:14,fontWeight:sel?700:500,cursor:'pointer',transition:'all .25s cubic-bezier(.2,.9,.2,1)',
          background:sel?'var(--card)':'transparent', color:sel?'var(--ink)':'var(--ink-mut)', border:sel?'1px solid var(--line)':'1px solid transparent'} }; });

    // 3マスのプレビューはやめ、説明の1行だけ残した（作成画面を短くするため）
    v.previewExplain = dr.status==='mikakutei' ? dt.uWord+'として、点線で置かれます' : dt.cWord+'として、塗りで置かれます';
    v.previewDotStyle = { width:10,height:10,borderRadius:3,flexShrink:0, ...(dr.status==='mikakutei'?{background:dt.paper,border:'1.5px dashed '+dt.color}:{background:dt.color}) };

    // ---------- DETAIL ----------
    const ev = st.events.find(e=>e.id===st.detailId);
    if(ev){
      const t=this.T(ev.type);
      const pct = ev.status==='mikakutei'?34: ev.status==='kakutei'?67: ev.status==='jisseki'?100: 20;
      v.dTitle=ev.title; v.dDay=ev.day; v.dTypeDark=t.dark;
      v.dStatusLabel = this.statusWord(ev);
      v.badgeChar = (ev.status==='jisseki'||ev.status==='kakutei')?'✓':'？';
      v.badgeStyle = { width:26,height:26,borderRadius:13,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,transition:'all .3s cubic-bezier(.2,.9,.2,1)',
        ...(v.badgeChar==='✓'?{background:t.color,color:'#fff'}:{background:t.paper,color:t.dark,border:'1.5px dashed '+t.color}) };
      v.gaugeTrackStyle={ width:10,alignSelf:'stretch',background:t.paper,position:'relative',flexShrink:0 };
      v.gaugeFillStyle={ position:'absolute',left:0,right:0,bottom:0,height:pct+'%',background:t.color,transition:'height .32s cubic-bezier(.2,.9,.2,1)' };
      const endShown = ev.status==='jisseki'? (ev.actualEnd||ev.end) : ev.end;
      v.dTimeText = ev.allDay ? (evSpan(ev)>1 ? this.spanLabel(ev)+'　終日' : '終日') : ev.start+'–'+endShown;
      v.dSpanText = evSpan(ev)>1 ? evSpan(ev)+'日間' : '';
      const drm = typeof ev.remindMin==='number' ? ev.remindMin : null;
      v.dRemindText = drm===null ? '' : this.remindLabel(drm, ev.allDay)+'にお知らせ';
      // 場所は地図で開けるようにする。地図アプリを持っていなくても
      // ブラウザの Google マップに落ちるので、リンク1本で済む。
      v.dPlace = (ev.place||'').trim();
      v.dPlaceHref = v.dPlace
        ? 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(v.dPlace) : '';
      v.dMemo = (ev.memo||'').trim();
      v.dTimeChanged = ev.status==='jisseki' && ev.actualEnd && ev.actualEnd!==ev.end;
      v.dWantText = ev.want ? '希望 '+ev.want[0]+'–'+ev.want[1] : (v.dTimeChanged?'予定 '+ev.start+'–'+ev.end:'');
      v.dWageShown = ev.status==='jisseki';
      if(v.dWageShown){ v.dWorkHours=this.fmtHours(this.paidHours(ev)); v.dWage=this.fmtWage(this.wage(ev));
        v.dBreakText = this.breakMin(ev) ? '休憩 '+this.breakMin(ev)+'分を引いています' : ''; }
      const primary=(label,fn)=>{ v.dPrimaryLabel=label; v.dPrimaryAction=fn;
        v.dPrimaryStyle={marginTop:16,padding:16,borderRadius:14,textAlign:'center',fontSize:16,fontWeight:700,color:t.dark,background:t.paper,border:'1px solid '+t.color,cursor:'pointer'}; };
      if(ev.status==='nakunatta') primary('予定として戻す',()=>{ tapLight(); this.updateEvent(ev.id,{status:'kakutei'}); });
      else if(ev.status==='kakutei' && ev.type==='baito') primary('働いた記録をつける',()=>this.openDialog(ev,'worked',st.returnTo));
      else if(ev.status==='jisseki') primary('働いた時間を直す',()=>this.openDialog(ev,'worked',st.returnTo));
      else if(ev.status==='mikakutei') primary('この予定、どうなった？',()=>this.openFor(ev,st.returnTo));
      else v.dPrimaryLabel=null;
      v.onEdit=()=>this.openEdit(ev,st.returnTo);
      v.onDelete=()=>this.askDelete(ev.id);
      v.dDeleteLabel = ev.status==='jisseki' ? 'この実績を削除' : 'この予定を削除';
    } else { v.dTitle=''; v.dPrimaryLabel=null; }

    // ---------- 取り返しのつかない操作の確認 ----------
    // 削除と、控えからの復元。どちらも同じ覆いを使う。
    v.confirmShown = !!st.confirmDelete || !!st.confirmRestore;
    if(st.confirmRestore){
      const r=st.confirmRestore;
      const at = r.at ? new Date(r.at) : null;
      v.confirmTitle = '控えから戻しますか？';
      v.confirmBody = `いま入っている${st.events.length}件は、控えの${r.count}件に置き換わります。`
        + (at ? `（控えは ${at.getFullYear()}年${at.getMonth()+1}月${at.getDate()}日 のもの）` : '')
        + (r.dropped ? ` 読めない予定が${r.dropped}件あり、それは戻せません。` : '')
        + ' 元に戻せません。';
      v.confirmOkLabel = '戻す';
      v.onConfirmDelete = ()=>this.doRestore();
      v.onCancelDelete = ()=>this.setState({confirmRestore:null});
    } else if(v.confirmShown){
      const target = st.events.find(e=>e.id===st.confirmDelete);
      v.confirmTitle = target ? `「${target.title}」を削除しますか？` : '削除しますか？';
      v.confirmBody = target && target.status==='jisseki'
        ? '働いた記録も一緒に消えます。元に戻せません。'
        : '元に戻せません。';
      v.confirmOkLabel = '削除する';
      v.onConfirmDelete = ()=>this.doDelete();
      v.onCancelDelete = ()=>this.setState({confirmDelete:null, deleteRest:false});
      // くり返しで作ったものなら、「これ以降ぜんぶ」もえらべるようにする。
      // 90件を1件ずつ消させるわけにいかない。
      if(target && target.repId){
        const rest=st.events.filter(e=>e.repId===target.repId && evFrom(e)>=evFrom(target)).length;
        if(rest>1){
          v.repDeleteShown = true;
          v.repDeleteOn = !!st.deleteRest;
          v.repDeleteLabel = `この日から先のくり返しも消す（${rest}件）`;
          v.onToggleRepDelete = ()=>{ tapLight(); this.setState(s=>({deleteRest:!s.deleteRest})); };
          v.repDeleteBox = {width:20,height:20,borderRadius:6,flexShrink:0,
            border:'1.5px solid '+(st.deleteRest?'#C0392B':'var(--line)'),
            background:st.deleteRest?'#C0392B':'transparent',
            color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700};
          if(st.deleteRest) v.confirmOkLabel = `${rest}件を削除する`;
        }
      }
    }

    // ---------- DIALOG ----------
    const d=st.dialog;
    if(d){
      const t=this.T(d.type);
      if(d.phase){
        const on=d.phase==='on'||d.phase==='done';
        v.celebOn=on;
        v.heroPillStyle={ display:'inline-flex',alignItems:'center',gap:8,height:48,padding:'0 22px',borderRadius:13,fontSize:19,fontWeight:700,
          border:'1.5px '+(on?'solid':'dashed')+' '+t.color,
          background:on?t.color:t.paper, color:on?'#fff':t.dark,
          transform:on?'scale(1.06)':'scale(1)',
          transition:'background .6s cubic-bezier(.2,.9,.2,1),border-color .6s cubic-bezier(.2,.9,.2,1),color .6s cubic-bezier(.2,.9,.2,1),transform .6s cubic-bezier(.2,.9,.2,1)',
          boxShadow:on?'0 10px 30px '+t.paper:'0 1px 3px rgba(0,0,0,.08)' };
        v.heroQStyle={ position:'absolute',fontSize:15,fontWeight:700, animation:on?'qFade .42s cubic-bezier(.2,.9,.2,1) forwards':'none', opacity:on?0:1 };
        v.heroCheckStyle={ position:'absolute',fontSize:16,fontWeight:800,color:'#fff', opacity:on?1:0, animation:on?'checkPop .5s .18s cubic-bezier(.2,.9,.2,1) both':'none' };
        v.heroTitle=d.title;
        v.haloStyle={ position:'absolute',left:'50%',top:'50%',width:120,height:52,borderRadius:16,border:'2px solid '+t.color,animation:'haloOut .85s .1s cubic-bezier(.2,.9,.2,1) forwards',pointerEvents:'none' };
        v.celebCaption = d.type==='asobi' ? '約束、決まった' : d.type==='baito' ? 'シフト確定' : '決まった';
        v.celebSub = (d.m+1)+'月'+d.day+'日 ・ '+d.start+'–'+d.end;
        return { v };
      }
      v.dlgHeading = d.mode==='worked' ? '何時まで働いた？'
        : d.type==='asobi' ? '約束、決まった？'
        : d.type==='yoji' ? 'この用事、どうなりました？'
        : d.type==='baito' ? 'このシフト、どうなりました？'
        : 'この予定、どうなりました？';
      v.dlgSub = (d.m+1)+'月'+d.day+'日 ・ '+d.title;
      v.dlgStart=d.start; v.dlgEnd=d.end;
      v.dlgChanged = d.start!==d.origS || d.end!==d.origE;
      v.dlgOrigText = (d.mode==='worked'?'確定 ':'希望 ')+d.origS+'–'+d.origE;
      v.dlgPrimaryLabel = d.mode==='worked'?'記録する':'確定した';
      v.dlgPrimaryStyle = {padding:15,borderRadius:12,textAlign:'center',fontSize:16,fontWeight:700,color:'#fff',background:t.color,cursor:'pointer',boxShadow:'0 3px 10px '+t.paper};
      v.dlgWheelColStyle = {width:60,height:150,overflowY:'scroll',scrollSnapType:'y mandatory',padding:'58px 0',textAlign:'center',WebkitMaskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)',maskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)'};
      const dHours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
      const dMinutes=Array.from({length:60/MIN_STEP},(_,i)=>String(i*MIN_STEP).padStart(2,'0'));
      const dMkRow=(field,label,isFirst)=>({ label, value:d[field], open:d.picking===field,
        rowStyle:{borderBottom:isFirst?'1px solid var(--line)':'none'},
        valStyle:{fontSize:16,fontWeight:d.picking===field?700:600,color:d.picking===field?t.color:'var(--ink)',fontVariantNumeric:'tabular-nums'},
        onTap:()=>this.setState(s=>({dialog:{...s.dialog,picking:s.dialog.picking===field?null:field}})),
        hItems:dHours, mItems:dMinutes,
        hRef: field==='start'?this.dRefStartH:this.dRefEndH, mRef: field==='start'?this.dRefStartM:this.dRefEndM,
        hScroll: field==='start'?this.dScStartH:this.dScEndH, mScroll: field==='start'?this.dScStartM:this.dScEndM });
      v.dlgTimeRows=[ dMkRow('start','開始',true), dMkRow('end','終了',false) ];

      // ---------- 休憩（実績を記録するときだけ） ----------
      // 休憩を引かないと、休憩が時給に入らない勤務先では金額が多めに出る。
      // 引いた結果の実働時間をその場に出して、何が起きたか見えるようにする。
      v.dlgBreakShown = d.mode==='worked';
      if(v.dlgBreakShown){
        const cur=d.breakMin||0;
        v.dlgBreakChips=[[0,'なし'],[15,'15分'],[30,'30分'],[45,'45分'],[60,'60分'],[90,'90分']]
          .map(([val,label])=>{ const sel=cur===val;
            return { label, onClick:()=>{ tapLight(); this.setState(s=>({dialog:{...s.dialog, breakMin:val}})); },
              style:{padding:'7px 11px',borderRadius:999,fontSize:12,fontWeight:sel?700:500,cursor:'pointer',whiteSpace:'nowrap',
                transition:'all .18s', background:sel?t.color:'var(--card)', color:sel?'#fff':'var(--ink-mut)',
                border:'1px solid '+(sel?t.color:'var(--line)')} }; });
        const paid=Math.max(0, this.hoursBetween(d.start,d.end) - cur/60);
        v.dlgPaidText = cur ? `実働 ${this.fmtHours(paid)}（休憩 ${cur}分を引いた）` : `実働 ${this.fmtHours(paid)}`;
      }
      v.onDlgPrimary=()=>this.dlgPrimary();
      v.onDlgNakunatta=()=>this.dlgNakunatta();
      v.onDlgStillMaybe=()=>this.setState({dialog:null});
      v.onDlgDismiss=()=>this.setState({dialog:null});
      // 3択のどれでもないとき（名前や日付を直したいとき）の逃げ道
      v.onDlgEdit=()=>{ const ev=st.events.find(e=>e.id===d.id); this.setState({dialog:null}); if(ev) this.openEdit(ev, st.returnTo); };
      v.dlgEditLabel = d.mode==='worked' ? 'この予定を編集' : '予定の内容を直す';
    }
    // ---------- いつ空いてる？ ----------
    if(v.freeShown){
      const fY=st.freeYM.y, fm=st.freeYM.m;
      const dim=new Date(fY,fm+1,0).getDate();
      const fdow=new Date(fY,fm,1).getDay();
      v.freeMonthLabel=fm+1;
      let cO=0,cA=0,cX=0; const rows=[];
      for(let d=1;d<=dim;d++){
        const dow=(fdow+d-1)%7;
        const evs = st.events.filter(e=>evCovers(e,dayNo(fY,fm,d)) && e.status!=='nakunatta');
        const j=this.freeJudge(evs);
        const ok=dayKey(fY,fm,d);
        const applied = st.overrides[ok] || j.mark;
        const overridden = !!st.overrides[ok];
        if(applied==='○')cO++; else if(applied==='△')cA++; else cX++;
        const isX = applied==='×';
        let mk={width:30,height:30,borderRadius:15,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:700,flexShrink:0,boxSizing:'border-box',transition:'all .2s cubic-bezier(.2,.9,.2,1)'};
        if(applied==='○') mk={...mk,color:'#1D9E75'};
        else if(applied==='×') mk={...mk,color:'#C1C5CC'};
        else { const variant=overridden?'manual':j.variant;
          if(variant==='adjust') mk={...mk,color:'#B9770F',border:'1.5px dashed #E0921C'};
          else if(variant==='partial') mk={...mk,color:'#B9770F',background:'rgba(224,146,28,.14)'};
          else mk={...mk,color:'#B9770F'}; }
        if(overridden) mk={...mk, boxShadow:'0 0 0 1.5px rgba(0,0,0,.22)'};
        const showNote = !overridden && applied==='△' && j.note;
        const dayColor = dow===0||dow===6?'var(--ink-mut)':(applied==='○'?'var(--ink-faint)':'var(--ink)');
        rows.push({
          day:d, dow:['日','月','火','水','木','金','土'][dow],
          rowStyle:{display:'flex',alignItems:'center',padding:'11px 16px',borderBottom:'1px solid var(--line)',opacity:isX?0.5:1,background:'var(--card)'},
          dateWrap:{width:38,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center'},
          dowStyle:{fontSize:10,fontWeight:600,color:dow===0||dow===6?'var(--ink-mut)':'var(--ink-mut)'},
          dayStyle:{fontSize:18,fontWeight:700,color:dayColor,fontVariantNumeric:'tabular-nums',lineHeight:'22px'},
          tags: evs.slice(0,2).map(ev=>({ text:this.pillText(ev,false), time: ev.allDay ? '終日' : (ev.start+'–'+(ev.status==='jisseki'?(ev.actualEnd||ev.end):ev.end)), style:{...this.pillStyle(ev),height:15,fontSize:10,lineHeight:'15px',padding:'0 6px',marginBottom:0,borderRadius:4,display:'inline-block',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}, timeStyle:{fontSize:10,fontWeight:600,color:'#9AA0A6',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'} })),
          note: showNote ? j.note : '',
          noteStyle:{fontSize:11,color: j.variant==='adjust' ? '#B9770F' : '#9AA0A6'},
          mark:applied, markStyle:mk, markWrap:{cursor:'pointer',padding:'3px',marginLeft:'6px'}, onCycle:()=>this.cycleMark(ok,j.mark),
        });
      }
      v.freeRows=rows; v.cO=cO; v.cA=cA; v.cX=cX;
      // 月が変わるたびに key も変えて、滑り込みのアニメーションをやり直させる
      v.freeListKey = fY+'-'+fm;
      v.freeListStyle = {flex:1, overflowY:'auto', background:'var(--card)',
        borderTop:'1px solid var(--line)', paddingBottom:96, touchAction:'pan-y',
        animation: st.freeDir ? (st.freeDir>0?'slideFromRight':'slideFromLeft')+' .26s cubic-bezier(.2,.9,.2,1)' : 'none'};
    }

    return { v };
  }

  componentDidMount() {
    this._applyTheme();
    // スクリーンショット撮影用。?demo=1 のときだけサンプルを表示中の月に入れる
    if (wantsDemo() && this.state.events.length === 0) {
      const { y, m } = this.state.ym;
      this.setState({ events: demoEvents(y, m) });
    }
    // 版が上がっていたら、アップデートのお知らせを足す
    const ver = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
    this.setState((s) => ({
      notices: syncInfoNotices(s.notices, ver, s.lastSeenVersion),
      lastSeenVersion: ver,
    }));
    this._refreshNotif();
    this._syncReminders();
    onNotificationTap((eventId, kind) => {
      const ev = this.state.events.find((e) => String(e.id) === String(eventId));
      if (!ev) return;
      if (kind === 'remind') {
        // お知らせからは、その日の一覧を開く。何をするかは本人に決めてもらう。
        this.setState({ screen: 'day', dayNum: ev.day, ym: { y: ev.y, m: ev.m }, returnTo: 'month', swipeRow: null });
        return;
      }
      this.openDialog(ev, 'worked', 'month');
    });
    // 設定アプリで許可してから戻ってきたら、そのまま読み込みを続ける
    this._onResume = async () => {
      if (!this._retryImportOnReturn) return;
      this._retryImportOnReturn = false;
      if (this.state.screen !== 'import') return;
      const perm = await checkCalendarAccess();
      if (perm === 'granted') this.runScan();
    };
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { this._onResume(); return; }
      // 背景に回った。このまま終了されることがあるので、待たずに書く
      this._flushFile();
    });

    // localStorage は OS の判断で消されることがある。消えていたら、
    // ファイルに残っている最後の内容から戻す。
    // localStorage が生きているときは触らない（いま編集中の内容を消さないため）。
    if (!this._hadLocal) this._recoverFromFile();

    // 日付が変わったら「今日」の位置と記録の催促を更新する
    this._tick = setInterval(() => {
      const t = todayParts();
      const cur = this.state.today;
      if (t.y !== cur.y || t.m !== cur.m || t.d !== cur.d) this.setState({ today: t });
      this._refreshNotif();
    }, 60000);
  }

  componentWillUnmount() {
    if (this._tick) clearInterval(this._tick);
    if (this._settle) clearTimeout(this._settle);
  }

  componentDidUpdate(prevProps, prevState) {
    this._applyTheme();
    this._persist();
    // 予定か通知設定が変わったときだけ予約を貼り直す
    if (prevState.events !== this.state.events || prevState.settings.remind !== this.state.settings.remind) {
      this._syncReminders();
      this._refreshNotif();
    }
  }

  _syncReminders() {
    syncReminders(this.state.events, this.state.settings);
  }

  // 終わったのにまだ実績を入れていないバイトを、お知らせに溜める。
  // 必ず setState の中で今の notices を読む。this.state を直に読むと、
  // 同じ tick で足したアップデートのお知らせを、まだ反映されていない古い配列で
  // 上書きして消してしまう（起動時に両方が走るので、実際に消えていた）。
  _refreshNotif() {
    const now = new Date();
    this.setState((s) => {
      const next = syncShiftNotices(s.notices, s.events, now);
      const changed =
        next.length !== s.notices.length || next.some((n, i) => n.id !== s.notices[i]?.id);
      return changed ? { notices: next } : null;
    });
  }

  openNotices() {
    tapLight();
    this.setState({ screen: 'notices' });
  }

  // ---- 控え（バックアップ） ----
  // 規約に「大切な予定は控えを取ってください」と書いてある以上、
  // 取る手段と戻す手段はアプリ側が持っていないと筋が通らない。
  BACKUP_MARK = 'kimatteru';
  // 控えの形。中身の並びを変えたら1つ上げる。古い版は上の版の控えを読まない。
  BACKUP_FORMAT = 2;

  async exportBackup() {
    tapLight();
    const { events, types, overrides, settings, notices, lastSeenVersion, jobs, supports } = this.state;
    const ver = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
    const now = new Date();
    const stamp = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const text = JSON.stringify(
      { app: this.BACKUP_MARK, format: this.BACKUP_FORMAT, appVersion: ver, exportedAt: now.toISOString(),
        data: { events, types, overrides, settings, notices, lastSeenVersion, jobs, supports } },
      null, 2
    );
    const msg = await shareText(text, `kimatteru-backup-${stamp}.json`);
    if (msg) {
      this.setState({ shareToast: true, shareMsg: msg });
      setTimeout(() => this.setState({ shareToast: false }), 2400);
    }
  }

  // 控えのファイルをじかにえらんで戻す。
  // 「控えを開いて全文をコピーして貼る」は、書き出した本人でも手が止まる手順だった。
  // input[type=file] は WKWebView からでもファイルアプリを開けるので、
  // これだけのためにプラグインを増やさない（増やすと iOS 側の同期も要る）。
  BACKUP_INPUT_ID = 'backup-file';
  // 控えは予定200件でも数十KBにしかならない。桁違いのものを読みに行かない。
  BACKUP_MAX_BYTES = 5 * 1024 * 1024;

  pickBackupFile() {
    tapLight();
    const el = document.getElementById(this.BACKUP_INPUT_ID);
    // ファイルをえらべない環境なら、黙って何も起きないのではなく貼り付けを開く
    if (!el) { this.setState({ pasteOpen: true, backupError: 'ファイルをえらべませんでした。貼り付けで戻してください。' }); return; }
    el.click();
  }

  async readBackupFile(e) {
    const el = e.target;
    const file = el.files && el.files[0];
    // 同じファイルをもう一度えらんでも change が起きるように、値を空に戻しておく
    el.value = '';
    if (!file) return;
    if (file.size > this.BACKUP_MAX_BYTES) {
      this.setState({ backupError: 'このファイルは控えにしては大きすぎます。書き出した控えをえらんでください。' });
      return;
    }
    let text;
    try { text = await file.text(); }
    catch (err) { this.setState({ backupError: 'ファイルを読めませんでした。もう一度えらんでください。' }); return; }
    const r = this.parseBackup(text);
    // 読めなかった理由は、貼り付けのときと同じ言い方で出す
    if (r.error) { this.setState({ backupError: r.error }); return; }
    tapLight();
    this.setState({ backupError: '', confirmRestore: r });
  }

  // 貼り付けられた文字列を確かめる。おかしければ理由を返す。
  parseBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { error: '控えの中身を読めませんでした。全文が貼れているか確かめてください。' }; }
    if (!obj || obj.app !== this.BACKUP_MARK) return { error: 'このアプリの控えではないようです。' };
    // 先の版で書かれた控えは読まない。中身の形が変わっているかもしれず、
    // 黙って読むと、戻したつもりで壊れた予定が並ぶ。
    // 「読めない」と言われるほうが、気づけるぶんましだと考える。
    if ((obj.format | 0) > this.BACKUP_FORMAT) {
      return { error: 'この控えは新しい版のアプリで作られています。アプリを最新にしてから戻してください。' };
    }
    const d = obj.data;
    if (!d || !Array.isArray(d.events)) return { error: '控えに予定が入っていません。' };
    // 数える前にふるいにかける。ここで出す件数と、実際に戻る件数を合わせる。
    const events = sanitizeEvents(d.events);
    return { data: { ...d, events }, count: events.length,
      dropped: d.events.length - events.length, at: obj.exportedAt };
  }

  askRestore() {
    const r = this.parseBackup(this.state.backupText || '');
    if (r.error) { this.setState({ backupError: r.error }); return; }
    tapLight();
    this.setState({ backupError: '', confirmRestore: r });
  }

  doRestore() {
    const r = this.state.confirmRestore;
    if (!r) return;
    stampHeavy();
    const d = r.data;
    this.setState((s) => ({
      events: sanitizeEvents(d.events),
      types: typesOk(d.types) ? mergeTypes(d.types, s.types) : s.types,
      jobs: sanitizeJobs(d.jobs),
      supports: sanitizeSupports(d.supports),
      overrides: d.overrides || {},
      notices: d.notices || [],
      settings: { ...s.settings, ...(d.settings || {}) },
      lastSeenVersion: d.lastSeenVersion || s.lastSeenVersion,
      confirmRestore: null, pasteOpen: false, backupText: '', backupError: '',
      screen: 'month', shareToast: true, shareMsg: `${(d.events || []).length}件の予定を戻しました`,
    }));
    setTimeout(() => this.setState({ shareToast: false }), 2400);
  }

  // 一覧では中身を出しきらず、押したら中央に開いて全文を見せる。
  // 開いた時点で既読にする（読まずに消えてしまわないように）。
  openNotice(n) {
    tapLight();
    this.setState((s) => ({
      noticeOpen: n.id,
      notices: s.notices.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
    }));
  }

  markAllRead() {
    tapLight();
    this.setState((s) => ({ notices: s.notices.map((x) => ({ ...x, read: true })) }));
  }

  // ダークモードを html 要素にも反映する（safe area やオーバースクロールの地色のため）
  _applyTheme() {
    const dark = !!(this.state.settings && this.state.settings.dark);
    if (this._lastDark === dark) return;
    this._lastDark = dark;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    applyStatusBarTheme(dark);
  }

  // 画面に出ているカードを画像にして共有シートへ渡す
  async _shareCard(kind) {
    tapLight();
    const st = this.state;
    const Y = st.ym.y, M = st.ym.m;
    const monthEvents = st.events.filter((e) => e.y === Y && e.m === M);
    try {
      let canvas, name;
      if (kind === 'summary') {
        const jis = monthEvents.filter((e) => e.status === 'jisseki');
        const totalH = jis.reduce((a, e) => a + this.paidHours(e), 0);
        canvas = drawSummaryCard({
          yearMonth: `${Y}年 ${M + 1}月`,
          wage: this.fmtWage(jis.reduce((a, e) => a + this.wage(e), 0)),
          hours: this.fmtHours(totalH),
          promises: monthEvents.filter((e) => e.type === 'asobi' && e.status === 'kakutei').length,
          canceled: monthEvents.filter((e) => e.status === 'nakunatta').length,
          rhythm: monthEvents.map((e) => {
            const t = this.T(e.type);
            const solid = e.status === 'kakutei' || e.status === 'jisseki';
            return {
              kind: e.status === 'nakunatta' ? 'gone' : solid ? 'solid' : 'dashed',
              color: t.color,
              paper: t.paper,
            };
          }),
        });
        name = `kimatteru-${Y}-${M + 1}-summary.png`;
      } else {
        const ws = st.settings.weekStart;
        const wl = ['日', '月', '火', '水', '木', '金', '土'];
        const first = (new Date(Y, M, 1).getDay() - ws + 7) % 7;
        const dim = new Date(Y, M + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < first; i++) cells.push({ label: '', busy: false });
        for (let d = 1; d <= dim; d++) {
          cells.push({
            label: d,
            busy: st.events.some(
              (e) => evCovers(e, dayNo(Y, M, d)) && (e.status === 'kakutei' || e.status === 'jisseki')
            ),
          });
        }
        canvas = drawFreeCard({
          monthLabel: M + 1,
          weekdays: Array.from({ length: 7 }, (_, i) => wl[(i + ws) % 7]),
          cells,
        });
        name = `kimatteru-${Y}-${M + 1}-free.png`;
      }
      const msg = await shareCanvas(canvas, name);
      if (msg) {
        this.setState({ shareToast: true, shareMsg: msg });
        setTimeout(() => this.setState({ shareToast: false }), 2400);
      }
    } catch (e) {
      this.setState({ shareToast: true, shareMsg: '画像を作れませんでした' });
      setTimeout(() => this.setState({ shareToast: false }), 2400);
    }
  }

  // localStorage が空だったときに、ファイルから戻す。
  // 初めて使う人はファイルも無いので、そのまま何も起きない。
  async _recoverFromFile() {
    const saved = await readFile();
    if (!saved || !Array.isArray(saved.events) || !saved.events.length) return;
    // 起動してから何か作っていたら、上書きしない
    if (this.state.events.length) return;
    const events = sanitizeEvents(saved.events);
    if (!events.length) return;
    this.setState((s) => ({
      events,
      types: typesOk(saved.types) ? mergeTypes(saved.types, s.types) : s.types,
      overrides: saved.overrides || s.overrides,
      settings: { ...s.settings, onboarded: true, ...(saved.settings || {}) },
      notices: saved.notices || s.notices,
      jobs: sanitizeJobs(saved.jobs),
      supports: sanitizeSupports(saved.supports),
      recovered: events.length,
    }));
  }

  // 予定が消えることは、機能がひとつ動かないのとは重さが違う。
  // すぐ書くほう（localStorage）と、消えにくいほう（ファイル）の両方に書く。
  _persist() {
    const ok = saveLocal(this.state);
    // 書けなかったことを黙って飲み込まない。画面に出して、控えを促す。
    if (ok === !!this.state.saveFailed) this.setState({ saveFailed: !ok });
    this._scheduleFileSave();
  }

  // ファイルは毎打鍵で書くと重いので、手が止まってから書く。
  // アプリが背景に回るときは待たずに書く（そのまま終了されることがある）。
  _scheduleFileSave() {
    clearTimeout(this._fileTimer);
    this._fileTimer = setTimeout(() => this._flushFile(), 1200);
  }
  _flushFile() {
    clearTimeout(this._fileTimer);
    saveFile(this.state);
  }

  render() {
    const { v } = this.renderVals();
    return renderApp(v);
  }
}



import React from 'react';
import { renderApp } from './view.jsx';
import { tapLight, penTick, settleSuccess, stampHeavy } from './haptics';
import { demoEvents, wantsDemo } from './demo';
import { syncReminders, onNotificationTap } from './notify';
import { drawSummaryCard, drawFreeCard } from './sharecard';
import { DOCS, EFFECTIVE } from './docs';
import { applyStatusBarTheme } from './statusbar';
import { canImport, askCalendarAccess, checkCalendarAccess, readCalendarEvents, dedupe, openAppSettings } from './calendarimport';
import { holidayName } from './holidays';
import { syncShiftNotices, syncInfoNotices, unreadCount, sortNotices, relativeTime, KIND_SHIFT } from './notices';

// 曜日と祝日の色。紙の上で浮きすぎないよう、どちらも少し落ち着かせた色にする。
const HOLIDAY_RED = '#B4453A'; // 祝日と日曜
const SATURDAY_BLUE = '#3D6E9C'; // 土曜

// 予定の塗りをどれだけ白に寄せるか。0 = 原色のまま、0.45 くらいでかなり淡い。
const FILL_SOFT = 0.32;
import { shareCanvas } from './shareimg';

// v2 から予定に y/m（実日付）を持たせた。旧形式は読み込まない。
const SAVE_KEY = 'kimatteru.v2';

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
const MAX_LANES = 3;

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
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        this.state = {
          ...this.state,
          events: saved.events || this.state.events,
          types: saved.types || this.state.types,
          overrides: saved.overrides || this.state.overrides,
          // すでに使っている人には案内を出さない
          settings: { ...this.state.settings, onboarded: true, ...(saved.settings || {}) },
          notices: saved.notices || this.state.notices,
          lastSeenVersion: saved.lastSeenVersion || null,
          jobs: saved.jobs || this.state.jobs,
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
  _attach(node,field,unit){ if(!node || node.dataset.pos==='1') return; const [h,m]=this.state.draft[field].split(':').map(Number); const step=this.state.settings.step; node.scrollTop=(unit==='h'?h:Math.round(m/step))*this.ITEM; node.dataset.pos='1'; }
  _onWheel(e,field,unit){ if(this['_t'+field+unit]) return; this['_t'+field+unit]=requestAnimationFrame(()=>{ this['_t'+field+unit]=0; const step=this.state.settings.step; const idx=Math.round(e.target.scrollTop/this.ITEM); let [h,m]=this.state.draft[field].split(':').map(Number); if(unit==='h') h=Math.min(23,Math.max(0,idx)); else m=Math.min(60-step,Math.max(0,idx*step)); const nv=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); if(nv!==this.state.draft[field]) this.setState(s=>({draft:{...s.draft,[field]:nv}})); }); }
  // dialog wheels (operate on state.dialog)
  dRefStartH=(n)=>this._dAttach(n,'start','h'); dRefStartM=(n)=>this._dAttach(n,'start','m');
  dRefEndH=(n)=>this._dAttach(n,'end','h');     dRefEndM=(n)=>this._dAttach(n,'end','m');
  dScStartH=(e)=>this._dWheel(e,'start','h'); dScStartM=(e)=>this._dWheel(e,'start','m');
  dScEndH=(e)=>this._dWheel(e,'end','h');     dScEndM=(e)=>this._dWheel(e,'end','m');
  _dAttach(node,field,unit){ if(!node || node.dataset.pos==='1' || !this.state.dialog) return; const step=this.state.settings.step; const set=()=>{ if(!this.state.dialog) return; const [h,m]=this.state.dialog[field].split(':').map(Number); node.scrollTop=(unit==='h'?h:Math.round(m/step))*this.ITEM; }; node.dataset.pos='1'; set(); requestAnimationFrame(set); }
  _dWheel(e,field,unit){ if(this['_d'+field+unit]) return; this['_d'+field+unit]=requestAnimationFrame(()=>{ this['_d'+field+unit]=0; if(!this.state.dialog) return; const step=this.state.settings.step; const idx=Math.round(e.target.scrollTop/this.ITEM); let [h,m]=this.state.dialog[field].split(':').map(Number); if(unit==='h') h=Math.min(23,Math.max(0,idx)); else m=Math.min(60-step,Math.max(0,idx*step)); const nv=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); if(nv!==this.state.dialog[field]) this.setState(s=>({dialog:{...s.dialog,[field]:nv}})); }); }

  state = {
    screen:'month', wageOn:false, dialog:null, detailId:null, dayNum:null, returnTo:'month',
    newType:null, overrides:{}, notif:null, editTypeKey:null, docKey:null, confirmDelete:null,
    imp:{ phase:'idle', found:[], type:'yoji', error:'' },
    swipe:{ dx:0, animating:false },
    notices:[], lastSeenVersion:null,
    // バイト先。名前と時給を持つ。予定に紐づけると、その時給で計算する。
    jobs:[], editJobId:null, newJob:null,
    ym: thisMonth(),      // カレンダーで表示している月
    freeYM: thisMonth(),  // 「いつ空いてる？」で見ている月
    today: todayParts(),
    shareChoices:{ o1:null, o2:null, o3:null }, shareSubmitted:false, shareToast:false, shareMsg:'', morph:null,
    settings:{ hourly:1120, step:30, weekStart:0, remind:true, hideCanceled:false, dark:false, onboarded:false },
    // はじめての案内。step は 0=しくみ 1=時給 2=取り込み
    onboard:{ step:0, demo:'dash', jobName:'', jobHourly:1120 },
    draft:{ title:'', type:'baito', status:'kakutei', start:'17:00', end:'22:00', y:todayParts().y, m:todayParts().m, day:todayParts().d, allDay:false, picking:null },
    types:[
      {key:'baito', name:'バイト', color:'#1D9E75', paper:'rgba(225,245,238,.72)', dark:'#085041', uWord:'希望シフト', cWord:'確定シフト'},
      {key:'yoji',  name:'用事',   color:'#534AB7', paper:'rgba(238,237,254,.72)', dark:'#3C3489', uWord:'まだ分からない用事', cWord:'確定した用事'},
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
  wage(ev){ if(ev.type!=='baito')return 0; return Math.round(this.hoursBetween(ev.start, ev.actualEnd||ev.end)*this.hourlyFor(ev)); }
  fmtHours(h){ const H=Math.floor(h); const M=Math.round((h-H)*60); return M? H+'時間'+M+'分' : H+'時間'; }
  fmtMin(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
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
    const iv=conf.map(e=>[this.mins(e.start), this.mins(e.status==='jisseki'?(e.actualEnd||e.end):e.end)]).sort((a,b)=>a[0]-b[0]);
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
    return {
      marginBottom:0,
      // マスの幅いっぱいに置く。端だけ 1px 空けて、隣の日の別の予定とくっつかないようにする。
      padding:'0 3px', marginLeft:L?1:0, marginRight:R?1:0,
      borderRadius:`${L?4:0}px ${R?4:0}px ${R?4:0}px ${L?4:0}px`,
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
    const evenOut=(st)=>({...st, height:17, lineHeight: ev.status==='mikakutei' ? '13px' : '17px'});
    if(!m || m.id!==ev.id){
      const p=this.pillParts(ev,wageOn,true);
      return { text:p.body, mark:p.mark, markStyle:this.markStyleFor(ev),
        style:this.trimBorder(evenOut({...this.pillStyle(ev), ...shape}), sh),
        textStyle:{minWidth:0,overflow:'hidden',textOverflow:'ellipsis'}, morphing:false, fillStyle:{} };
    }
    const t=this.T(ev.type);
    const dash=m.phase==='dash', filling=m.phase==='fill'||m.phase==='settle';
    const style={height:17,boxSizing:'border-box',fontSize:11,fontWeight:500,letterSpacing:'-.04em',lineHeight:'13px',whiteSpace:'nowrap',overflow:'hidden',display:'flex',alignItems:'center',position:'relative',cursor:'pointer',
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
  openDay(d){ this.setState({screen:'day',dayNum:d,returnTo:'month'}); }
  openNew(day,ret){ const ym=this.state.ym; this.setState({screen:'new',returnTo:ret,newType:null,draft:{editingId:null,title:'',type:'baito',status:'kakutei',start:'17:00',end:'22:00',y:ym.y,m:ym.m,day,pickY:ym.y,pickM:ym.m,extraDays:[],jobId:(this.state.jobs[0]||{}).id,allDay:false,days:1,picking:null}}); }
  // 既存の予定を同じ画面で直す。実績は「実際に働いた終わり」を編集対象にする。
  openEdit(ev,ret){
    this.setState({screen:'new',returnTo:ret||'month',newType:null,detailId:null,draft:{
      editingId:ev.id, title:ev.title, type:ev.type, status:ev.status,
      start:ev.start, end: ev.status==='jisseki' ? (ev.actualEnd||ev.end) : ev.end,
      y:ev.y, m:ev.m, day:ev.day, pickY:ev.y, pickM:ev.m, extraDays:[], jobId:ev.jobId, allDay:!!ev.allDay, days:evSpan(ev), picking:null }});
  }
  askDelete(id){ this.setState({confirmDelete:id}); }

  // ---- はじめての案内 ----
  // 点線が塗りに変わる瞬間を、その場で一度さわってもらう
  onboardDemoTap(){
    if(this.state.onboard.demo!=='dash') return;
    tapLight();
    this.setState(s=>({onboard:{...s.onboard, demo:'fill'}}));
    setTimeout(()=>{ penTick(); }, 120);
    setTimeout(()=>{ settleSuccess(); this.setState(s=>({onboard:{...s.onboard, demo:'done'}})); }, 430);
  }
  onboardResetDemo(){ this.setState(s=>({onboard:{...s.onboard, demo:'dash'}})); }
  onboardNext(){ tapLight(); this.setState(s=>({onboard:{...s.onboard, step:s.onboard.step+1}})); }
  onboardBack(){ this.setState(s=>({onboard:{...s.onboard, step:Math.max(0,s.onboard.step-1)}})); }
  // 時給の入力を、そのままバイト先として登録する
  onboardSaveJob(){
    const {jobName,jobHourly}=this.state.onboard;
    const name=(jobName||'').trim();
    if(name){
      const id='j'+Date.now();
      this.setState(s=>({ jobs:[...s.jobs,{id,name,hourly:jobHourly}] }));
    } else {
      this.setSetting('hourly', jobHourly);
    }
    this.onboardNext();
  }
  finishOnboard(goImport){
    stampHeavy();
    this.setState(s=>({ settings:{...s.settings, onboarded:true}, screen: goImport ? 'import' : 'month' }));
    if(goImport) this.setState({imp:{phase:'idle', found:[], type:'yoji', error:''}});
  }

  // ---- バイト先 ----
  addJob(){
    tapLight();
    const id='j'+Date.now();
    this.setState(s=>({ jobs:[...s.jobs,{id,name:'',hourly:s.settings.hourly}], editJobId:id }));
  }
  patchJob(id,patch){ this.setState(s=>({ jobs:s.jobs.map(j=>j.id===id?{...j,...patch}:j) })); }
  removeJob(id){
    // 消したバイト先を使っていた予定は、設定の時給に戻す
    this.setState(s=>({ jobs:s.jobs.filter(j=>j.id!==id), editJobId:null,
      events:s.events.map(e=>e.jobId===id?{...e,jobId:undefined}:e) }));
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
    const id='j'+Date.now();
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
      // 1件ずつ、入れるかどうかと種類を持たせる。既定は全部入れる・用事あつかい。
      const picked = fresh.map((e,i)=>({...e, key:'k'+i, on:true, type:'yoji'}));
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
    const add = on.map((e,i)=>({ id:'i'+now+'-'+i, type:e.type, title:e.title, y:e.y, m:e.m, day:e.day,
      start:e.start, end:e.end, status:'kakutei', allDay:e.allDay }));
    this.setState(s=>({ events:[...s.events, ...add], imp:{...s.imp, phase:'done', added:add.length} }));
  }
  toggleImportRow(key){ this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.key===key?{...e,on:!e.on}:e)}})); }
  setImportRowType(key,type){ this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.key===key?{...e,type}:e)}})); }
  setAllImport(on){ tapLight(); this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>({...e,on}))}})); }
  setAllImportType(type){ tapLight(); this.setState(s=>({imp:{...s.imp, found:s.imp.found.map(e=>e.on?{...e,type}:e)}})); }
  doDelete(){
    const id=this.state.confirmDelete;
    this.setState(s=>({ events:s.events.filter(e=>e.id!==id), confirmDelete:null, dialog:null,
      screen: s.detailId===id ? 'month' : s.screen, detailId: s.detailId===id ? null : s.detailId }));
  }
  openDialog(ev,mode,ret){
    // 実績を記録し直すときは、記録済みの終了時刻から始める
    const again = mode==='worked' && ev.status==='jisseki';
    const origS = (mode==='confirm' && ev.want) ? ev.want[0] : ev.start;
    const origE = again ? (ev.actualEnd||ev.end) : ((mode==='confirm' && ev.want) ? ev.want[1] : ev.end);
    this.setState({ returnTo:ret||this.state.returnTo, dialog:{ id:ev.id, mode, type:ev.type, title:ev.title, y:ev.y, m:ev.m, day:ev.day, start:origS, end:origE, origS, origE, picking:null } });
  }
  patchDlg(k,d){ this.setState(s=>({ dialog:{...s.dialog,[k]:this.addMin(s.dialog[k],d)} })); }
  patchDraft(k,d){ this.setState(s=>({ draft:{...s.draft,[k]:this.addMin(s.draft[k],d)} })); }
  setSetting(k,val){ this.setState(s=>({ settings:{...s.settings,[k]:val} })); }
  recolorKey(key,hex){ this.setState(s=>({ types:s.types.map(t=>t.key===key?{...t,color:hex,paper:this.paperFrom(hex),dark:this.darkFrom(hex)}:t) })); }
  updateEvent(id,patch){ this.setState(s=>({ events:s.events.map(e=>e.id===id?{...e,...patch}:e) })); }

  dlgPrimary(){
    const d=this.state.dialog;
    tapLight();
    // 実績の確定は「✓を判子で押す」— 重めのひと突き（§6）
    if(d.mode==='worked'){ stampHeavy(); this.updateEvent(d.id,{status:'jisseki',start:d.start,actualEnd:d.end}); this.setState({dialog:null}); return; }
    // 依頼A: ダイアログを閉じ→カレンダー上のピルが点線から左→右へ塗り満ちる (§6)
    this.updateEvent(d.id,{start:d.start,end:d.end,want:[d.origS,d.origE]});
    this.setState({dialog:null, screen:'month', dayNum:null, detailId:null, morph:{id:d.id, phase:'dash'}});
    setTimeout(()=>{ if(this.state.morph&&this.state.morph.id===d.id){ this.setState({morph:{id:d.id, phase:'fill'}}); penTick(); } }, 150);
    setTimeout(()=>{ if(this.state.morph&&this.state.morph.id===d.id){ this.setState({morph:{id:d.id, phase:'settle'}}); settleSuccess(); } }, 470);
    setTimeout(()=>{ if(!this.state.morph||this.state.morph.id!==d.id) return; this.updateEvent(d.id,{status:'kakutei'}); this.setState({morph:null}); }, 760);
  }
  dlgNakunatta(){ const d=this.state.dialog; this.updateEvent(d.id,{status:'nakunatta'}); this.setState(s=>({dialog:null, screen: s.detailId===d.id ? s.returnTo : s.screen, detailId: s.detailId===d.id?null:s.detailId})); }

  // ---- type editor ----
  selectType(k){ this.setState(s=>({draft:{...s.draft,type:k}})); }
  recolor(hex){ const k=this.state.draft.type; this.setState(s=>({ types:s.types.map(t=>t.key===k?{...t,color:hex,paper:this.paperFrom(hex),dark:this.darkFrom(hex)}:t) })); }
  addType(){
    const nt=this.state.newType; if(!nt) return;
    const name=(nt.name||'').trim()||'新しい種類';
    const key='c'+Date.now(), hex=nt.color;
    const t={key,name,color:hex,paper:this.paperFrom(hex),dark:this.darkFrom(hex),uWord:'未確定の'+name,cWord:name};
    this.setState(s=>({ types:[...s.types,t], draft:{...s.draft,type:key}, newType:null }));
  }

  save(){
    const dr=this.state.draft;
    tapLight();
    // 日またぎは終日の予定だけ。時間指定に戻したら1日に畳む。
    const span = dr.allDay ? Math.max(1,Math.min(60,dr.days|0||1)) : 1;
    const spanField = span>1 ? span : undefined;
    if(dr.editingId){
      this.setState(s=>({ screen:'month', detailId:null, dayNum:null, ym:{y:dr.y,m:dr.m},
        events:s.events.map(e=>{
          if(e.id!==dr.editingId) return e;
          const base={...e,type:dr.type,title:dr.title||'無題',y:dr.y,m:dr.m,day:dr.day,start:dr.start,status:dr.status,allDay:dr.allDay,days:spanField,
            jobId: dr.type==='baito' ? dr.jobId : undefined};
          // 実績のときに直しているのは「実際に働いた終わりの時刻」
          return dr.status==='jisseki' ? {...base, actualEnd:dr.end} : {...base, end:dr.end, actualEnd:undefined};
        }) }));
      return;
    }
    // 本体の日＋えらんだ他の日、まとめて置く
    const placeOn=[[dr.y,dr.m,dr.day], ...(dr.extraDays||[]).map(k=>k.split('-').map(Number))];
    const base=Date.now();
    const made=placeOn.map(([y,m,d],i)=>({ id:'n'+base+'-'+i, type:dr.type, title:dr.title||'無題',
      y, m, day:d, start:dr.start, end:dr.end, status:dr.status, allDay:dr.allDay, days:spanField,
      jobId: dr.type==='baito' ? dr.jobId : undefined,
      want: dr.status==='mikakutei' ? [dr.start,dr.end] : undefined }));
    this.setState(s=>({ screen:s.returnTo, ym:{y:dr.y,m:dr.m}, events:[...s.events,...made] }));
  }

  renderVals(){
    const st=this.state, wageOn=st.wageOn;
    const stepBtn={width:30,height:30,borderRadius:15,background:'var(--bg2)',color:'var(--ink)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,cursor:'pointer',userSelect:'none'};
    const wl=['日','月','火','水','木','金','土'];
    const v={
      fw:402, fh:874,
      monthShown:st.screen==='month', dayShown:st.screen==='day', newShown:st.screen==='new', detailShown:st.screen==='detail', dialogShown:!!st.dialog&&!st.dialog.phase, celebShown:!!st.dialog&&!!st.dialog.phase, freeShown:st.screen==='free',
      monthLabel:String(st.ym.m+1), year:String(st.ym.y), wageOn, stepBtn,
      onPrevMonth:()=>this.setState(s=>({ym:shiftMonth(s.ym,-1), dayNum:null})),
      onNextMonth:()=>this.setState(s=>({ym:shiftMonth(s.ym,1), dayNum:null})),
      onToggleWage:()=>this.setState(s=>({wageOn:!s.wageOn})),
      // 今月を見ているなら今日、別の月を見ているならその月の1日から始める
      onFab:()=>{ const t=st.today; const same=st.ym.y===t.y&&st.ym.m===t.m; this.openNew(same?t.d:1,'month'); },
      onCancel:()=>this.setState({screen:st.returnTo}),
      onBack:()=>this.setState({screen:st.returnTo, detailId:null}),
      onDayBack:()=>this.setState({screen:'month', dayNum:null}),
      onOpenFree:()=>this.setState({screen:'free'}),
      onFreeBack:()=>this.setState({screen:'month'}),
      navShown: st.screen==='month' || st.screen==='free' || st.screen==='report' || st.screen==='settings',
      onBell:()=>this.openNotices(),
      navCur: st.screen,
      onNavCal:()=>this.setState({screen:'month', dayNum:null, detailId:null}),
      onNavFree:()=>this.setState({screen:'free'}),
      onNavReport:()=>this.setState({screen:'report'}),
      onNavSettings:()=>this.setState({screen:'settings', editTypeKey:null}),
      onOpenSummary:()=>this.setState({screen:'summary', shareToast:false, cardFrom:st.screen}),
      onSummaryClose:()=>this.setState(s=>({screen:s.cardFrom||'month'})),
      // カレンダーは指の動きについてくる。離したところで隣の月に収まるか、元に戻る。
      onMonthTouchStart:(e)=>{
        const t=e.touches&&e.touches[0]; if(!t) return;
        if(this._settle){ clearTimeout(this._settle); this._settle=null; }
        this._sx=t.clientX; this._sy=t.clientY; this._axis=null;
        this._trackW=(e.currentTarget&&e.currentTarget.clientWidth)||320;
        this.setState(s=>({swipe:{dx:s.swipe?s.swipe.dx:0, animating:false}}));
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
        this.setState({swipe:{dx: go ? dir*-w : 0, animating:true}});
        this._settle=setTimeout(()=>{
          this._settle=null;
          if(go) this.setState(s=>({ym:shiftMonth(s.ym,dir), dayNum:null, swipe:{dx:0,animating:false}}));
          else this.setState({swipe:{dx:0,animating:false}});
        }, 300);
      },
      onShareCard:()=>{ this._shareCard(st.screen==='summary'?'summary':'free'); },
      onOpenShare:()=>this.setState({screen:'share', shareToast:false, cardFrom:st.screen}),
      onShareClose:()=>this.setState(s=>({screen:s.cardFrom||'settings'})),
      onOpenTerms:()=>this.setState({screen:'doc', docKey:'terms'}),
      onOpenPrivacy:()=>this.setState({screen:'doc', docKey:'privacy'}),
      onDocBack:()=>this.setState({screen:'settings', docKey:null}),
      onFreePrev:()=>this.setState(s=>({freeYM:shiftMonth(s.freeYM,-1)})),
      onFreeNext:()=>this.setState(s=>({freeYM:shiftMonth(s.freeYM,1)})),
      stop:(e)=>e&&e.stopPropagation(),
    };

    // ---------- はじめての案内 ----------
    v.onboardShown = !st.settings.onboarded;
    if(v.onboardShown){
      const ob=st.onboard, teal='#1D9E75';
      v.obStep = ob.step;
      v.obDots = [0,1,2].map(i=>({ style:{width:i===ob.step?18:6,height:6,borderRadius:3,
        background:i===ob.step?'var(--ink)':'var(--line)',transition:'all .3s cubic-bezier(.2,.9,.2,1)'} }));
      v.onObNext = ()=>this.onboardNext();
      v.onObBack = ()=>this.onboardBack();
      v.onObSkip = ()=>this.finishOnboard(false);

      // 1枚目：しくみを、さわって知ってもらう
      const filled = ob.demo!=='dash';
      v.obDemoDone = ob.demo==='done';
      v.onObDemoTap = ()=>this.onboardDemoTap();
      v.onObDemoReset = ()=>this.onboardResetDemo();
      v.obDemoPillStyle = {
        position:'relative', overflow:'hidden', display:'block', width:'100%', boxSizing:'border-box',
        height:34, lineHeight:'30px', borderRadius:9, padding:'0 12px', fontSize:15, fontWeight:700,
        cursor: filled ? 'default' : 'pointer',
        background: filled ? this.softFill(teal) : 'rgba(29,158,117,.09)',
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
      v.obDemoCaption = filled ? '決まった、が形になりました。' : '点線の予定をタップしてみてください';

      // 2枚目：時給
      v.obJobName = ob.jobName;
      v.obJobHourly = String(ob.jobHourly);
      v.onObJobName = (e)=>{ const val=e.target.value; this.setState(s=>({onboard:{...s.onboard, jobName:val}})); };
      v.onObHourly = (e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,''),10);
        this.setState(s=>({onboard:{...s.onboard, jobHourly:isNaN(n)?0:Math.min(99999,n)}})); };
      v.onObHourlyMinus = ()=>this.setState(s=>({onboard:{...s.onboard, jobHourly:Math.max(0,s.onboard.jobHourly-10)}}));
      v.onObHourlyPlus = ()=>this.setState(s=>({onboard:{...s.onboard, jobHourly:s.onboard.jobHourly+10}}));
      v.onObSaveJob = ()=>this.onboardSaveJob();

      // 3枚目：取り込み
      v.obCanImport = canImport();
      v.onObImport = ()=>this.finishOnboard(true);
      v.onObStart = ()=>this.finishOnboard(false);
    }

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
      v.onToggleAll=()=>this.setAllImport(!v.impAllOn);
      // 選んでいるものをまとめて種類変更
      v.impBulkChips = st.types.map(t=>({ label:t.name, onClick:()=>this.setAllImportType(t.key),
        style:{padding:'6px 12px',borderRadius:999,fontSize:12,cursor:'pointer',
          background:'var(--card)', color:'var(--ink-mut)', border:'1px solid var(--line)'} }));
      // 1件ごと
      v.impRows = (im.found||[]).map(e=>{
        const ty=st.types.find(t=>t.key===e.type)||st.types[0];
        return {
          key:e.key, title:e.title, on:e.on,
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
      v.onNoticesBack = ()=>this.setState({screen:'month'});
      v.noticeRows = sortNotices(st.notices).map(n=>({
        title:n.title, body:n.body, when:relativeTime(n.at, nowMs), unread:!n.read,
        isShift:n.kind===KIND_SHIFT,
        onClick:()=>this.readNotice(n),
        dotStyle:{ width:8,height:8,borderRadius:4,flexShrink:0,marginTop:7,
          background: n.read ? 'transparent' : '#1D9E75' },
        iconStyle:{ width:34,height:34,borderRadius:11,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:15,fontWeight:800,
          background: n.kind===KIND_SHIFT ? 'rgba(29,158,117,.12)' : 'var(--bg2)',
          color: n.kind===KIND_SHIFT ? '#0F6E56' : 'var(--ink-soft)' },
        icon: n.kind===KIND_SHIFT ? '✓' : 'i',
      }));
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
    v.setHourly = String(cfg.hourly);
    v.onHourlyInput=(e)=>{ const n=parseInt((e.target.value||'').replace(/[^0-9]/g,''),10); this.setSetting('hourly', isNaN(n)?0:Math.min(99999,n)); };
    v.onHourlyMinus=()=>this.setSetting('hourly',Math.max(0,cfg.hourly-10));
    v.onHourlyPlus=()=>this.setSetting('hourly',cfg.hourly+10);
    const segCell=(sel)=>({flex:1,textAlign:'center',padding:'8px 0',borderRadius:7,fontSize:13,fontWeight:sel?700:500,cursor:'pointer',transition:'all .2s cubic-bezier(.2,.9,.2,1)',background:sel?'var(--card)':'transparent',color:sel?'var(--ink)':'var(--ink-mut)',border:sel?'1px solid var(--line)':'1px solid transparent'});
    v.stepSeg=[5,15,30].map(n=>({ label:n+'分', onClick:()=>this.setSetting('step',n), style:segCell(cfg.step===n) }));
    v.weekSeg=[[0,'日曜'],[1,'月曜']].map(([n,label])=>({ label, onClick:()=>this.setSetting('weekStart',n), style:segCell(cfg.weekStart===n) }));
    v.typeRows = st.types.map((t,i)=>({
      name:t.name, open: st.editTypeKey===t.key, hint: st.editTypeKey===t.key?'':'色を変える',
      rowStyle:{borderBottom: i<st.types.length-1?'1px solid var(--line)':'none'},
      dotStyle:{width:18,height:18,borderRadius:12,background:t.color,flexShrink:0,boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)'},
      onTap:()=>this.setState(s=>({editTypeKey:s.editTypeKey===t.key?null:t.key})),
      swatches:this.PAL.map(hex=>({ style:{width:26,height:26,borderRadius:13,background:hex,cursor:'pointer',boxShadow: t.color===hex?'0 0 0 2px #fff, 0 0 0 4px '+hex:'inset 0 0 0 1px rgba(0,0,0,.08)'}, onClick:()=>this.recolorKey(t.key,hex) })),
    }));
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
    const totalH = jis.reduce((a,e)=>a+this.hoursBetween(e.start,e.actualEnd||e.end),0);
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
        const hours=list.reduce((a,e)=>a+this.hoursBetween(e.start,e.actualEnd||e.end),0);
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
      v.onOpenFreeShare = ()=>this.setState({screen:'share', shareToast:false, cardFrom:'report'});
    }

    // ---------- 空いてる日シェア (C) ----------
    v.shareShown = st.screen==='share';
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
          bars.push({ key:ev.id+'-'+w, ...view,
            style:{...view.style, gridColumn:(c0+1)+' / span '+(c1-c0+1), gridRow:li+2, pointerEvents:'auto', zIndex:1},
            onClick:(e)=>{ if(e)e.stopPropagation(); this.openFor(ev,'month'); } });
        }

        const slots=slotDays.map((d,i)=>{
          if(d===null) return { blank:true, day:null, bgStyle:{background:'var(--bg2)'}, numWrap:{}, numStyle:{}, onDay:()=>{} };
          const dow=(wFirst+d-1)%7, isToday=d===today;
          const hol=holidayName(Y,M,d);
          // 祝日と日曜は赤、土曜は青。日本のカレンダーの見慣れた並びに合わせる。
          const dayColor = (hol || dow===0) ? HOLIDAY_RED : dow===6 ? SATURDAY_BLUE : 'var(--ink)';
          return {
            blank:false, day:d,
            bgStyle:{background:'var(--card)',cursor:'pointer'},
            numWrap:{gridColumn:i+1, gridRow:1, lineHeight:'20px', paddingLeft:3, alignSelf:'center'},
            numStyle: isToday
              ? {display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:13,background:'var(--ink)',color:'var(--card)',fontSize:11,fontWeight:700}
              : {fontSize:11,fontWeight:(hol||dow===0||dow===6)?700:600, color:dayColor},
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
          rowStyle:{position:'relative', flex:'1 1 0', minHeight:92, ...(w>0?{borderTop:'1px solid var(--line)'}:{})},
          gridStyle:{position:'relative', display:'grid', gridTemplateColumns:'repeat(7,1fr)',
            gridTemplateRows:'22px repeat('+MAX_LANES+',19px) 13px', alignContent:'start', pointerEvents:'none', height:'100%'},
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
    v.showFirstRunHint = st.events.length===0;
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
      v.dayEvents = evs.map(ev=>{
        const endShown = ev.status==='jisseki' ? (ev.actualEnd||ev.end) : ev.end;
        return {
          chipStyle: {...this.pillStyle(ev), height:26, lineHeight:'26px', fontSize:13, padding:'0 12px', marginBottom:0, borderRadius:6, display:'inline-block', flexShrink:0, overflow:'visible', textOverflow:'clip', width:'max-content', maxWidth:220},
          chipText: this.pillText(ev,false),
          timeText: ev.allDay ? (evSpan(ev)>1 ? this.spanLabel(ev)+'（終日）' : '終日') : ev.start+'–'+endShown,
          statusWord: this.statusWord(ev),
          onClick: ()=>this.openFor(ev,'day'),
        };
      });
      v.onDayAdd = ()=>this.openNew(d,'day');
    }

    // ---------- NEW ----------
    const dr=st.draft, dt=this.T(dr.type);
    v.draftTitle=dr.title; v.draftColor=dt.color; v.draftStart=dr.start; v.draftEnd=dr.end;
    v.onTitle=(e)=>{ const val=e.target.value; this.setState(s=>({draft:{...s.draft,title:val}})); };
    v.onStartMinus=()=>this.patchDraft('start',-st.settings.step); v.onStartPlus=()=>this.patchDraft('start',st.settings.step);
    v.onEndMinus=()=>this.patchDraft('end',-st.settings.step); v.onEndPlus=()=>this.patchDraft('end',st.settings.step);
    v.onSave=()=>this.save();

    // 終日 / 時間指定
    // ---------- 日付えらび（小さなカレンダーを開く） ----------
    v.editing = !!dr.editingId;
    v.newTitle = dr.editingId ? '予定を編集' : '新しい予定';
    const DOW=['日','月','火','水','木','金','土'];
    const dDate=new Date(dr.y,dr.m,dr.day);
    v.dateLabel = `${dr.y}年${dr.m+1}月${dr.day}日（${DOW[dDate.getDay()]}）`;
    v.dateOpen = dr.picking==='date';
    v.onTapDate = ()=>this.setState(s=>({draft:{...s.draft, picking:s.draft.picking==='date'?null:'date', pickY:s.draft.y, pickM:s.draft.m, pickedOnce:false}}));
    // 複数日えらんだときの表示
    const extras=(dr.extraDays||[]).length;
    v.dateExtraCount = extras;
    v.dateSummary = extras ? `ほか${extras}日` : '';
    v.dateHint = v.dateOpen ? (extras || dr.pickedOnce ? '別の日もタップすると、まとめて置けます' : '日をえらんでください') : '';
    v.onClearExtraDays = ()=>this.setState(s=>({draft:{...s.draft, extraDays:[]}}));
    const pY = dr.pickY==null?dr.y:dr.pickY, pM = dr.pickM==null?dr.m:dr.pickM;
    v.datePickLabel = `${pY}年${pM+1}月`;
    v.onDatePrev = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},-1); return {draft:{...s.draft,pickY:n.y,pickM:n.m}}; });
    v.onDateNext = ()=>this.setState(s=>{ const n=shiftMonth({y:pY,m:pM},1); return {draft:{...s.draft,pickY:n.y,pickM:n.m}}; });
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
          // 1回目のタップで本体の日、2回目以降は追加の日として足していく
          onClick:()=>{ if(isMain) return;
            if(dr.picking==='date' && !dr.pickedOnce) this.setState(s=>({draft:{...s.draft,y:pY,m:pM,day:d2,pickedOnce:true}}));
            else this.toggleExtraDay(pY,pM,d2); } });
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
    v.jobNoneChip = { label:'設定の時給（¥'+cfg.hourly+'）', onClick:()=>this.clearJob(),
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
    v.spanSeg = [['timed','時間を指定'],['all','終日']].map(([k,label])=>{ const sel=(k==='all')===!!dr.allDay;
      return { label, onClick:()=>this.setState(s=>({draft:{...s.draft,allDay:k==='all',picking:null}})),
        style:{flex:1,textAlign:'center',padding:'9px 0',borderRadius:11,fontSize:14,fontWeight:sel?700:500,cursor:'pointer',transition:'all .25s cubic-bezier(.2,.9,.2,1)',
          background:sel?'var(--card)':'transparent', color:sel?'var(--ink)':'var(--ink-mut)', border:sel?'1px solid var(--line)':'1px solid transparent'} }; });
    // drum-roll wheels
    v.wheelColStyle = {width:66,height:170,overflowY:'scroll',scrollSnapType:'y mandatory',padding:'68px 0',textAlign:'center',WebkitMaskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)',maskImage:'linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)'};
    v.wheelItemStyle = {height:34,lineHeight:'34px',fontSize:21,fontWeight:600,color:'var(--ink)',scrollSnapAlign:'center',fontVariantNumeric:'tabular-nums'};
    const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    const minutes=Array.from({length:Math.round(60/st.settings.step)},(_,i)=>String(i*st.settings.step).padStart(2,'0'));
    const mkRow=(field,label,isFirst)=>({
      label, value:dr[field], open:dr.picking===field,
      rowStyle:{borderBottom:isFirst?'1px solid var(--line)':'none'},
      valStyle:{fontSize:16,fontWeight:dr.picking===field?700:600,color:dr.picking===field?dt.color:'var(--ink)',fontVariantNumeric:'tabular-nums'},
      onTap:()=>this.setState(s=>({draft:{...s.draft,picking:s.draft.picking===field?null:field}})),
      hItems:hours, mItems:minutes,
      hRef: field==='start'?this.refStartH:this.refEndH, mRef: field==='start'?this.refStartM:this.refEndM,
      hScroll: field==='start'?this.scStartH:this.scEndH, mScroll: field==='start'?this.scStartM:this.scEndM,
    });
    v.timeRows=[ mkRow('start','開始',true), mkRow('end','終了',false) ];

    v.chips = st.types.map(t=>{ const sel=dr.type===t.key;
      return { label:t.name, onClick:()=>this.selectType(t.key),
        style:{textAlign:'center',whiteSpace:'nowrap',padding:'10px 15px',borderRadius:13,fontSize:14,fontWeight:600,cursor:'pointer',transition:'all .2s',
          background:sel?t.color:'var(--card)', color:sel?'#fff':'var(--ink-mut)', boxShadow:'none', border:sel?'none':'1px solid var(--line)'} }; });
    v.addChipStyle = {textAlign:'center',whiteSpace:'nowrap',padding:'10px 14px',borderRadius:13,fontSize:14,fontWeight:600,cursor:'pointer',color:'var(--ink-soft)',background:'transparent',border:'1.5px dashed #C9CDD4'};
    v.onAddTypeChip = ()=>this.setState(s=>({newType: s.newType?null:{name:'',color:'#2F72C4'}}));

    // recolor swatches (selected type)
    v.recolorSwatches = this.PAL.map(hex=>({ style:{width:24,height:24,borderRadius:12,background:hex,cursor:'pointer',boxShadow: dt.color===hex?'0 0 0 2px #fff, 0 0 0 4px '+hex:'inset 0 0 0 1px rgba(0,0,0,.08)',transition:'box-shadow .15s'}, onClick:()=>this.recolor(hex) }));

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

    const previewEv={type:dr.type,title:dr.title||dt.name,status:dr.status};
    const mkPrevCell=(date,center,ctx)=>({ date, cellStyle:{background:'var(--card)',padding:'4px 4px 10px',minHeight:64}, numStyle:{fontSize:10,fontWeight:600,color:'var(--ink-mut)',marginBottom:4,paddingLeft:2},
      pills: center?[{text:this.pillText(previewEv,false),style:this.pillStyle(previewEv)}]:(ctx||[]) });
    v.previewDays=[ mkPrevCell(dr.day-1,false,[{text:'カフェ',style:this.pillStyle({type:'baito',status:'kakutei'})}]), mkPrevCell(dr.day,true), mkPrevCell(dr.day+1,false,[]) ];
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
      v.dTimeChanged = ev.status==='jisseki' && ev.actualEnd && ev.actualEnd!==ev.end;
      v.dWantText = ev.want ? '希望 '+ev.want[0]+'–'+ev.want[1] : (v.dTimeChanged?'予定 '+ev.start+'–'+ev.end:'');
      v.dWageShown = ev.status==='jisseki';
      if(v.dWageShown){ v.dWorkHours=this.fmtHours(this.hoursBetween(ev.start,endShown)); v.dWage=this.fmtWage(this.wage(ev)); }
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

    // ---------- 削除の確認 ----------
    v.confirmShown = !!st.confirmDelete;
    if(v.confirmShown){
      const target = st.events.find(e=>e.id===st.confirmDelete);
      v.confirmTitle = target ? `「${target.title}」を削除しますか？` : '削除しますか？';
      v.confirmBody = target && target.status==='jisseki'
        ? '働いた記録も一緒に消えます。元に戻せません。'
        : '元に戻せません。';
      v.onConfirmDelete = ()=>this.doDelete();
      v.onCancelDelete = ()=>this.setState({confirmDelete:null});
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
      const dMinutes=Array.from({length:Math.round(60/st.settings.step)},(_,i)=>String(i*st.settings.step).padStart(2,'0'));
      const dMkRow=(field,label,isFirst)=>({ label, value:d[field], open:d.picking===field,
        rowStyle:{borderBottom:isFirst?'1px solid var(--line)':'none'},
        valStyle:{fontSize:16,fontWeight:d.picking===field?700:600,color:d.picking===field?t.color:'var(--ink)',fontVariantNumeric:'tabular-nums'},
        onTap:()=>this.setState(s=>({dialog:{...s.dialog,picking:s.dialog.picking===field?null:field}})),
        hItems:dHours, mItems:dMinutes,
        hRef: field==='start'?this.dRefStartH:this.dRefEndH, mRef: field==='start'?this.dRefStartM:this.dRefEndM,
        hScroll: field==='start'?this.dScStartH:this.dScEndH, mScroll: field==='start'?this.dScStartM:this.dScEndM });
      v.dlgTimeRows=[ dMkRow('start','開始',true), dMkRow('end','終了',false) ];
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
    onNotificationTap((eventId) => {
      const ev = this.state.events.find((e) => String(e.id) === String(eventId));
      if (ev) this.openDialog(ev, 'worked', 'month');
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
      if (!document.hidden) this._onResume();
    });

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
    syncReminders(this.state.events, this.state.settings, this.state.types);
  }

  // 終わったのにまだ実績を入れていないバイトを、お知らせに溜める
  _refreshNotif() {
    const now = new Date();
    const next = syncShiftNotices(this.state.notices, this.state.events, now);
    const changed =
      next.length !== this.state.notices.length ||
      next.some((n, i) => n.id !== this.state.notices[i]?.id);
    if (changed) this.setState({ notices: next });
  }

  openNotices() {
    tapLight();
    this.setState({ screen: 'notices' });
  }

  readNotice(n) {
    this.setState((s) => ({ notices: s.notices.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
    if (n.kind === KIND_SHIFT) {
      const ev = this.state.events.find((e) => String(e.id) === String(n.eventId));
      if (ev) this.openDialog(ev, 'worked', 'notices');
    }
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
        const totalH = jis.reduce((a, e) => a + this.hoursBetween(e.start, e.actualEnd || e.end), 0);
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

  _persist() {
    try {
      const { events, types, overrides, settings, notices, lastSeenVersion, jobs } = this.state;
      localStorage.setItem(SAVE_KEY, JSON.stringify({ events, types, overrides, settings, notices, lastSeenVersion, jobs }));
    } catch (e) {
      // 容量オーバーなどは黙って諦める（保存できなくても操作は続けられる）
    }
  }

  render() {
    const { v } = this.renderVals();
    return renderApp(v);
  }
}



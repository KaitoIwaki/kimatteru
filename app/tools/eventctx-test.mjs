// eventctx.js を Node でそのまま試す。実行: node tools/eventctx-test.mjs
import { sameKind, historyFor, othersOnDay, agoText } from '../src/eventctx.js';

let ng = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { ng++; console.log('✗', name, '\n   出た:', a, '\n   ほしい:', b); }
  else console.log('✓', name);
};

const ev = (id, y, m, day, title, type = 'yoji', extra = {}) =>
  ({ id, y, m, day, title, type, status: 'kakutei', start: '17:00', end: '18:00', ...extra });

// ---- sameKind ----
eq('題名も種類も同じなら同じ', sameKind(ev('a', 2026, 7, 6, 'ダンス'), ev('b', 2026, 7, 13, 'ダンス')), true);
eq('前後の空白は無視する', sameKind(ev('a', 2026, 7, 6, ' ダンス '), ev('b', 2026, 7, 13, 'ダンス')), true);
eq('題名が違えば別', sameKind(ev('a', 2026, 7, 6, 'ダンス'), ev('b', 2026, 7, 13, 'ダンス発表会')), false);
eq('種類が違えば別', sameKind(ev('a', 2026, 7, 6, '面談'), ev('b', 2026, 7, 13, '面談', 'baito')), false);

// ---- historyFor ----
{
  const list = [
    ev('1', 2026, 6, 30, 'ダンス'),   // 7/30
    ev('2', 2026, 7, 6, 'ダンス'),    // 8/6
    ev('3', 2026, 7, 13, 'ダンス'),   // 8/13
    ev('4', 2026, 7, 20, 'ダンス'),   // 8/20 ← これを見る
    ev('5', 2026, 8, 3, 'ダンス'),    // 9/3（先の予定）
    ev('x', 2026, 7, 20, 'マクド', 'baito'),
  ];
  const h = historyFor(list, list[3]);
  eq('今年で何回目か', h.yearNth, 4);
  eq('今月で何回目か（8月は3回目）', h.monthNth, 3);
  eq('前回は8月13日', [h.prev.m + 1, h.prev.day], [8, 13]);
  eq('前回から7日', h.daysAgo, 7);
  eq('先の予定は数えない（5件目は入らない）', h.yearNth < 5, true);
}
{
  const list = [ev('1', 2026, 7, 20, 'ダンス')];
  eq('はじめてなら null', historyFor(list, list[0]), null);
}
{
  const list = [
    ev('1', 2025, 7, 20, 'ダンス'),   // 去年
    ev('2', 2026, 7, 20, 'ダンス'),
  ];
  const h = historyFor(list, list[1]);
  eq('年をまたぐと今年は1回目', h.yearNth, 1);
  eq('でも前回は去年のぶんが出る', h.prev.y, 2025);
  eq('前回から365日', h.daysAgo, 365);
}
{
  const list = [
    ev('1', 2026, 7, 6, 'ダンス'),
    ev('2', 2026, 7, 13, 'ダンス', 'yoji', { status: 'nakunatta' }),
    ev('3', 2026, 7, 20, 'ダンス'),
  ];
  const h = historyFor(list, list[2]);
  eq('無くなった回は数えない', h.yearNth, 2);
  eq('前回も無くなった回は飛ばす', [h.prev.m + 1, h.prev.day], [8, 6]);
}

// ---- othersOnDay ----
{
  const target = ev('me', 2026, 7, 20, 'ダンス');
  const list = [
    target,
    ev('a', 2026, 7, 20, 'マクド', 'baito', { start: '19:00' }),
    ev('b', 2026, 7, 20, 'ゼミ合宿', 'yoji', { allDay: true }),
    ev('c', 2026, 7, 21, 'べつの日', 'yoji'),
    ev('d', 2026, 7, 19, 'またぐ', 'yoji', { days: 3 }),        // 19〜21日
    ev('e', 2026, 7, 20, '消えた', 'yoji', { status: 'nakunatta' }),
  ];
  const o = othersOnDay(list, target, 3);
  eq('自分は入らない・別の日も入らない・無くなったも入らない', o.list.map((x) => x.id), ['b', 'd', 'a']);
  eq('終日が先、そのあと時刻順', o.list[0].id, 'b');
  eq('日をまたぐ予定も拾う', o.list.some((x) => x.id === 'd'), true);
  eq('あふれは0', o.rest, 0);
}
{
  const target = ev('me', 2026, 7, 20, 'ダンス');
  const list = [target,
    ev('a', 2026, 7, 20, 'あ', 'yoji', { start: '09:00' }),
    ev('b', 2026, 7, 20, 'い', 'yoji', { start: '10:00' }),
    ev('c', 2026, 7, 20, 'う', 'yoji', { start: '11:00' }),
    ev('d', 2026, 7, 20, 'え', 'yoji', { start: '12:00' })];
  const o = othersOnDay(list, target, 3);
  eq('3件までしか並べない', o.list.length, 3);
  eq('あふれた数を返す', o.rest, 1);
}
{
  const target = ev('me', 2026, 7, 20, 'ダンス');
  eq('ほかに無ければ空', othersOnDay([target], target, 3), { list: [], rest: 0 });
}

// ---- agoText ----
eq('同じ日', agoText(0), '同じ日');
eq('1日は「前の日」', agoText(1), '前の日');
eq('7日', agoText(7), '7日前');
eq('44日まではそのまま', agoText(44), '44日前');
eq('45日からは月', agoText(45), '1か月前');
eq('91日は3か月', agoText(91), '3か月前');
eq('364日は12か月', agoText(364), '12か月前');
eq('365日は1年', agoText(365), '1年前');
eq('800日は2年', agoText(800), '2年前');

console.log(ng ? `\n${ng} 件おかしい` : '\nぜんぶ通った');
process.exit(ng ? 1 : 0);

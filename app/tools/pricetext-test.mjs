// 値段の出し方を試す。実行: node tools/pricetext-test.mjs
//
// tipjar.js は Capacitor のプラグインを読むので Node でそのまま動かせない。
// 中の priceText だけを取り出して試す（本体を書き換えたら、ここも合わせる）。
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/tipjar.js', import.meta.url), 'utf8');
const i = src.indexOf('function priceText');
const body = src.slice(i, src.indexOf('\n}', i) + 2);
const priceText = eval('(' + body.replace('function priceText', 'function') + ')');

let ng = 0;
const eq = (name, got, want) => {
  if (got !== want) { ng++; console.log('✗', name, '\n   出た:', got, '\n   ほしい:', want); }
  else console.log('✓', name);
};

const t300 = { yen: 300 }, t1000 = { yen: 1000 };

eq('円で返ってきたら、そのまま使う',
  priceText({ priceString: '¥300', currencyCode: 'JPY' }, t300), '¥300');
eq('全角の￥でも、そのまま使う',
  priceText({ priceString: '￥300', currencyCode: 'JPY' }, t300), '￥300');
eq('通貨コードが無くても、記号で見分ける',
  priceText({ priceString: '¥300' }, t300), '¥300');
eq('「300円」の形でも、そのまま使う',
  priceText({ priceString: '300円' }, t300), '300円');

eq('ドルで返ってきたら、こちらの円に置き換える',
  priceText({ priceString: '$1.99', currencyCode: 'USD' }, t300), '¥300');
eq('ユーロでも置き換える',
  priceText({ priceString: '€1.99', currencyCode: 'EUR' }, t300), '¥300');
eq('通貨コードが無くても、記号が円でなければ置き換える',
  priceText({ priceString: '$1.99' }, t300), '¥300');
eq('コードが優先。記号が紛らわしくてもコードで決める',
  priceText({ priceString: '¥14.00', currencyCode: 'CNY' }, t300), '¥300');

eq('置き換えるときは3桁で区切る',
  priceText({ priceString: '$6.99', currencyCode: 'USD' }, t1000), '¥1,000');
eq('何も返ってこなければ、こちらの円',
  priceText({}, t1000), '¥1,000');
eq('空文字でも、こちらの円',
  priceText({ priceString: '' }, t1000), '¥1,000');
eq('displayPrice の名前で返ってきても拾う',
  priceText({ displayPrice: '¥1,000', currencyCode: 'JPY' }, t1000), '¥1,000');

console.log(ng ? `\n${ng} 件おかしい` : '\nぜんぶ通った');
process.exit(ng ? 1 : 0);

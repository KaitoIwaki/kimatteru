// CSS 文字列を React の style オブジェクトに変換する。
// デザイン側のロジックは style をオブジェクトで返すこともあるので、その場合は素通し。
const cache = new Map();

export function s(v) {
  if (v == null || v === '') return undefined;
  if (typeof v !== 'string') return v;
  const hit = cache.get(v);
  if (hit) return hit;
  const o = {};
  for (const decl of v.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    let k = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!k || !val) continue;
    if (!k.startsWith('--')) k = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[k] = val;
  }
  cache.set(v, o);
  return o;
}

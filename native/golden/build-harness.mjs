// いまの Web 版（app/src/App.jsx）を Node で動かせる形に束ねる。正解表（golden）を作るため。
// 画面は描かない。App クラスを作って、計算のメソッドを直接呼ぶ。
// Capacitor（iPhone の部品）は何もしない置き物に差し替える。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const NM = process.env.LUKKO_NODE_MODULES; // esbuild・react がある node_modules
const esbuild = (await import(pathToFileURL(path.join(NM, 'esbuild', 'lib', 'main.js')).href)).default;
const stub = { name: 'stub', setup(b) {
  b.onResolve({ filter: /^@capacitor\/|^@capgo\/|native-purchases|capacitor-/ }, (a) => ({ path: a.path, namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
    const plug = new Proxy({}, { get: (t, k) => k === 'then' ? undefined : (async () => ({})) });
    export const Capacitor = { isNativePlatform: () => false, isPluginAvailable: () => false, getPlatform: () => 'web' };
    export const registerPlugin = () => plug;
    export class WebPlugin {};
    export const NativePurchases = plug; export const PURCHASE_TYPE = {}; export const CapacitorCalendar = plug;
    export const App = { addListener: () => ({ remove(){} }) };
    export const Filesystem = plug; export const Directory = {}; export const Encoding = {};
    export const Haptics = plug; export const ImpactStyle = {}; export const NotificationType = {};
    export const LocalNotifications = plug; export const Share = plug; export const StatusBar = plug; export const Style = {};
    export default plug;`, loader: 'js' }));
} };
// 外に出していない関数も、正解表のために出す（元のファイルは変えない。束ねるときに末尾へ export を足すだけ）
const EXPOSE = {
  'notify.js': ['buildSchedule', 'whenText', 'numericId'],
  'App.jsx': ['sanitizeEvents', 'typesOk', 'mergeTypes', 'PROFILES', 'EXTRA_TYPES', 'evSpan', 'evFrom', 'evTo', 'evCovers', 'dayNo', 'fromDayNo'],
};
import fs from 'node:fs';
const expose = { name: 'expose', setup(b) {
  b.onLoad({ filter: /[\\/](notify\.js|App\.jsx)$/ }, (a) => {
    const name = path.basename(a.path);
    const src = fs.readFileSync(a.path, 'utf8');
    return { contents: src + `\nexport { ${EXPOSE[name].join(', ')} };\n`, loader: name.endsWith('.jsx') ? 'jsx' : 'js' };
  });
} };
await esbuild.build({
  entryPoints: [path.join(here, 'entry.jsx')],
  bundle: true, platform: 'node', format: 'esm', outfile: path.join(here, 'out', 'harness.mjs'),
  jsx: 'automatic', loader: { '.png': 'dataurl', '.woff2': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.txt': 'text', '.css': 'empty' },
  define: { __APP_VERSION__: '"0.0.0"', __APP_MARKETING__: '"0"' },
  nodePaths: [NM], plugins: [stub, expose], logLevel: 'warning',
});
console.log('built');

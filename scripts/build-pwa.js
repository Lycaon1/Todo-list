// Builds the installable offline web app into docs/ (served by GitHub Pages).
// The JS bundle and icon font are inlined into one index.html so the whole app
// is a handful of files the service worker can cache.
//
// Usage: node scripts/build-pwa.js
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'docs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-web-'));

execSync(`npx expo export --platform web --output-dir "${tmp}"`, { cwd: root, stdio: 'inherit' });

const jsDir = path.join(tmp, '_expo/static/js/web');
let bundle = fs.readFileSync(path.join(jsDir, fs.readdirSync(jsDir).find((f) => f.endsWith('.js'))), 'utf8');

const fontPattern = /"\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/MaterialIcons\.[0-9a-f]+\.ttf"/;
const fontPath = bundle.match(fontPattern)[0].slice(1, -1);
const font = fs.readFileSync(path.join(tmp, fontPath)).toString('base64');
bundle = bundle.replace(fontPattern, `"data:font/ttf;base64,${font}"`);
if (bundle.includes('</script')) throw new Error('Bundle contains </script and cannot be inlined');

const html = fs.readFileSync(path.join(root, 'web/shell.html'), 'utf8').replace('/*APP_BUNDLE*/', () => bundle);
const buildId = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(root, 'web/sw.js'), 'utf8').replace('/*BUILD_ID*/', buildId));
for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
  fs.copyFileSync(path.join(root, 'web', f), path.join(out, f));
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`Built docs/ (build ${buildId})`);

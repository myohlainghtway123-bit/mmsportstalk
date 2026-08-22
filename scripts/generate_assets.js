const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const source = path.join(root, 'branding', 'mst-score-final');
const assets = path.join(root, 'assets');
fs.mkdirSync(assets, { recursive: true });
for (const name of ['icon.png', 'adaptive-icon.png', 'splash.png']) {
  const src = path.join(source, name);
  const dst = path.join(assets, name);
  if (!fs.existsSync(src)) throw new Error(`Missing final MST Score brand asset: ${src}`);
  fs.copyFileSync(src, dst);
  console.log(`generated ${dst}`);
}

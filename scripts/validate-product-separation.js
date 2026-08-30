const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const roots = ['.github', 'App.js', 'app.config.js', '.env.example', 'eas.json', 'config', 'scripts', 'src', 'package.json'];
const exactAllowlist = new Set(['scripts/validate-product-separation.js']);
const ignoredPrefixes = ['docs/agent-runs/', 'node_modules/', 'android/', 'ios/', 'dist-ci/', '.expo/'];
const textExtensions = new Set(['.js', '.cjs', '.mjs', '.json', '.md', '.yml', '.yaml', '.toml', '.ts', '.tsx']);

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function ignored(relativePath) {
  return exactAllowlist.has(relativePath) || ignoredPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function collect(target, output) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const next = path.join(full, entry.name);
      if (ignored(rel(next))) continue;
      collect(rel(next), output);
    }
    return;
  }

  const relativePath = rel(full);
  if (ignored(relativePath)) return;
  const isKnownRootFile = ['App.js', 'app.config.js', '.env.example', 'eas.json', 'package.json'].includes(relativePath);
  if (!isKnownRootFile && !textExtensions.has(path.extname(relativePath).toLowerCase())) return;
  output.push(relativePath);
}

const files = [];
for (const target of roots) collect(target, files);

const violations = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    if (/betflow/i.test(line)) {
      violations.push(`${file}:${index + 1}: forbidden cross-product reference`);
    }
  });
}

if (violations.length) {
  console.error('MST Scores product separation FAILED:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`MST Scores product separation OK: ${files.length} active source/config files scanned.`);

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');
const swPath = path.join(distDir, 'sw.js');

if (fs.existsSync(swPath)) {
  const assetFiles: string[] = ['./', './index.html'];

  function collectAssets(dir: string): void {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        collectAssets(full);
      } else if (/\.(js|css|png|json|svg|woff2?)$/i.test(entry) && entry !== 'sw.js') {
        const rel = './' + path.relative(distDir, full).replace(/\\/g, '/');
        if (!assetFiles.includes(rel)) {
          assetFiles.push(rel);
        }
      }
    }
  }

  collectAssets(distDir);
  const hash = crypto
    .createHash('sha256')
    .update(assetFiles.join('|'))
    .digest('hex')
    .slice(0, 10);

  let swSource = fs.readFileSync(swPath, 'utf8');
  swSource = swSource.replace(
    "const CACHE_VERSION = 'v2';",
    `const CACHE_VERSION = 'v2-${hash}';`,
  );
  swSource = swSource.replace(
    /const PRECACHE_URLS = \[[\s\S]*?\];/,
    `const PRECACHE_URLS = ${JSON.stringify(assetFiles, null, 2)};`,
  );
  fs.writeFileSync(swPath, swSource, 'utf8');
  console.log(`Injected ${assetFiles.length} precache URLs into dist/sw.js (version v2-${hash}).`);
}

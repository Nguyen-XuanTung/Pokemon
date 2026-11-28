import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SwManifestResult {
  readonly urls: string[];
  readonly contentHash: string;
  readonly version: string;
}

export function computeSwManifestForDirectory(distDir: string): SwManifestResult {
  const discovered: Array<{ rel: string; full: string }> = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir).sort((a, b) => a.localeCompare(b));
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(html|js|css|png|json|svg|txt|md|woff2?)$/i.test(entry) && entry !== 'sw.js') {
        const rel = './' + path.relative(distDir, full).replace(/\\/g, '/');
        discovered.push({ rel, full });
      }
    }
  }

  walk(distDir);
  discovered.sort((a, b) => a.rel.localeCompare(b.rel));

  const hasher = crypto.createHash('sha256');
  const subUrls: string[] = [];

  for (const item of discovered) {
    hasher.update(item.rel);
    hasher.update('\0');
    hasher.update(fs.readFileSync(item.full));
    hasher.update('\0');
    if (item.rel !== './index.html') {
      subUrls.push(item.rel);
    }
  }

  const urls = ['./', './index.html', ...subUrls];
  const contentHash = hasher.digest('hex').slice(0, 12);
  const version = `v3-${contentHash}`;
  return { urls, contentHash, version };
}

export function copyLicenseFilesIntoDist(distDir: string, rootDir: string = process.cwd()): void {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['LICENSE', 'LICENSE.txt'],
    ['CREDITS.md', 'CREDITS.md'],
  ];
  for (const [srcName, dstName] of pairs) {
    const src = path.join(rootDir, srcName);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, dstName));
    }
  }
}

export function injectSwManifestIntoDist(distDir: string): SwManifestResult | null {
  const swPath = path.join(distDir, 'sw.js');
  if (!fs.existsSync(swPath)) return null;

  copyLicenseFilesIntoDist(distDir);
  const manifest = computeSwManifestForDirectory(distDir);
  let swSource = fs.readFileSync(swPath, 'utf8');
  swSource = swSource.replace(
    /const CACHE_VERSION = '[^']+';/,
    `const CACHE_VERSION = '${manifest.version}';`,
  );
  swSource = swSource.replace(
    /const PRECACHE_URLS = \[[\s\S]*?\];/,
    `const PRECACHE_URLS = ${JSON.stringify(manifest.urls, null, 2)};`,
  );
  fs.writeFileSync(swPath, swSource, 'utf8');
  return manifest;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const distDir = path.join(process.cwd(), 'dist');
  const injected = injectSwManifestIntoDist(distDir);
  if (injected) {
    console.log(
      `Injected ${injected.urls.length} sorted precache URLs into dist/sw.js (version ${injected.version}).`,
    );
  }
}

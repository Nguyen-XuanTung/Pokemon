import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC_DIRS = ['README.md', 'AGENTS.md', 'CREDITS.md', 'docs'];
const SRC_DIRS = ['src', 'scripts', 'tests'];

const issues: string[] = [];

function walkFiles(targetPath: string, exts: ReadonlySet<string>, out: string[]): void {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (exts.has(path.extname(targetPath))) {
      out.push(targetPath);
    }
    return;
  }
  for (const entry of fs.readdirSync(targetPath)) {
    walkFiles(path.join(targetPath, entry), exts, out);
  }
}

const mdFiles: string[] = [];
for (const item of DOC_DIRS) {
  walkFiles(path.join(ROOT, item), new Set(['.md']), mdFiles);
}

for (const file of mdFiles) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');
  if (/[\u2013\u2014]/.test(content)) {
    issues.push(`${rel}: contains forbidden en-dash or em-dash`);
  }
  if (/[\u{1F300}-\u{1FAFF}]/u.test(content)) {
    issues.push(`${rel}: contains forbidden decorative emoji`);
  }
}

const tsFiles: string[] = [];
for (const item of SRC_DIRS) {
  walkFiles(path.join(ROOT, item), new Set(['.ts']), tsFiles);
}

const FORBIDDEN_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /v2\.ts$/i, reason: 'duplicate v2 filename forbidden by AGENTS.md' },
  { pattern: /AIza[0-9A-Za-z_-]{35}/, reason: 'potential hardcoded Google API key' },
  { pattern: /sk-[0-9A-Za-z]{20,}/, reason: 'potential hardcoded secret key' },
  { pattern: /gryzor\.co/i, reason: 'telemetry endpoint forbidden' },
];

for (const file of tsFiles) {
  const rel = path.relative(ROOT, file);
  if (rel.replace(/\\/g, '/') === 'scripts/lint-project.ts') {
    continue;
  }
  if (/v2\.ts$/i.test(rel)) {
    issues.push(`${rel}: duplicate v2 file forbidden`);
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(content)) {
      issues.push(`${rel}: ${rule.reason}`);
    }
  }
}

if (issues.length > 0) {
  console.error(`Project lint failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log(`Project lint passed across ${mdFiles.length} markdown files and ${tsFiles.length} TypeScript files.`);

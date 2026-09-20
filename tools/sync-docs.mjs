#!/usr/bin/env node
/**
 * One-way, offline V4 mirror builder. Edit Croupier's canonical Markdown, not
 * generated copies. This command never fetches, commits, pushes or deletes.
 *
 * Import:  node tools/sync-docs.mjs --croupier PATH --wiki PATH --write
 * Build:   node build-static.mjs
 * Record:  node tools/sync-docs.mjs --croupier PATH --wiki PATH --write
 * Verify:  node tools/sync-docs.mjs --croupier PATH --wiki PATH
 * Offline: node tools/sync-docs.mjs
 *
 * --write copies the existing index.html; it deliberately does not run a build.
 * sourceRevision identifies the latest commit touching the canonical directory
 * (null only for non-Git sources). Per-file source hashes identify
 * the actual working-tree content; unrelated commits cannot create sync drift.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GENERATOR_VERSION = '2.0.0';
const CANONICAL_DIRECTORY = 'docs/animation-events/v4-8-days-mvp';
const REPOSITORY = 'https://gitlab.com/scout-gg/croupier';
const WIKI = `${REPOSITORY}/-/wikis`;
const SOURCE_BRANCH = 'jakeminator123/work';
const MANIFEST = 'docs/sync-manifest.json';
const PAGES = [
  ['s00-helheten.md', 's00-helheten.md'],
  ['s01-kartan.md', 's01-kartan.md'],
  ['s02-spraket.md', 's02-spraket.md'],
  ['s03-eventtradet.md', 's03-motorn.md'],
  ['s04-saker-presentation.md', 's04-openclaw.md'],
  ['s05-ordlista.md', 's05-ordlista.md'],
  ['s06-plan.md', 's06-plan.md'],
];
const DOCUMENTS = ['README.md', 'CANVAS.md', 'DECISIONS.md', 'RUNTIME-EVIDENCE.md'];
const MAPPING = new Map([...PAGES, ...DOCUMENTS.map(name => [name, `docs/${name}`])]);
const EXTRA_WIKI_LINKS = new Map([
  ['docs/shared/AGENT-INBOX.md', 'agent-inbox'],
]);
const GITHUB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeMarkdown(value) {
  return value.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trimEnd() + '\n';
}

function rootPath(value, label, requireGit = false) {
  const absolute = path.resolve(value);
  if (absolute === path.parse(absolute).root) throw new Error(`${label}: filesystem root is not a safe repository target`);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) throw new Error(`${label}: directory does not exist: ${absolute}`);
  if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`${label}: symlink root is not allowed`);
  const real = fs.realpathSync(absolute);
  if (requireGit && !fs.existsSync(path.join(real, '.git'))) throw new Error(`${label}: expected an existing Git worktree root (.git is missing)`);
  return real;
}

function safePath(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || path.posix.isAbsolute(relative) || /^[a-z]:/i.test(relative)) {
    throw new Error(`Unsafe mirror path: ${relative}`);
  }
  const parts = relative.split('/');
  if (parts.some(part => part === '..' || part === '.' || part === '')) throw new Error(`Unsafe mirror path: ${relative}`);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    if (fs.existsSync(current) || (() => { try { return fs.lstatSync(current).isSymbolicLink(); } catch { return false; } })()) {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink in mirror path is not allowed: ${relative}`);
      if (index < parts.length - 1 && !fs.statSync(current).isDirectory()) throw new Error(`Mirror parent is not a directory: ${relative}`);
      const resolved = fs.realpathSync(current);
      const fromRoot = path.relative(root, resolved);
      if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) throw new Error(`Mirror path escapes root: ${relative}`);
    }
  }
  return current;
}

function sourceUrl(name) {
  return `${REPOSITORY}/-/blob/${SOURCE_BRANCH}/${CANONICAL_DIRECTORY}/${name}`;
}

function rewriteHref(href, destination, surface) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return href;
  const match = /^([^?#]+)([?#].*)?$/.exec(href);
  if (!match) return href;
  const [, rawPath, suffix = ''] = match;
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return href; }
  const sourcePath = path.posix.normalize(path.posix.join(CANONICAL_DIRECTORY, decoded));
  const sourceName = path.posix.relative(CANONICAL_DIRECTORY, sourcePath);
  if (MAPPING.has(sourceName)) {
    if (surface === 'wiki') return `${WIKI}/${CANONICAL_DIRECTORY.replace(/^docs\//, '')}/${sourceName.replace(/\.md$/, '')}${suffix}`;
    const relative = path.posix.relative(path.posix.dirname(destination), MAPPING.get(sourceName));
    return `${relative}${suffix}`;
  }
  if (surface === 'wiki' && EXTRA_WIKI_LINKS.has(sourcePath)) return `${WIKI}/${EXTRA_WIKI_LINKS.get(sourcePath)}${suffix}`;
  if (!sourcePath.startsWith('../') && sourcePath !== '..') return `${REPOSITORY}/-/blob/${SOURCE_BRANCH}/${sourcePath}${suffix}`;
  throw new Error(`Relative link escapes canonical repository: ${href}`);
}

function mirrorMarkdown(source, sourceName, destination, surface) {
  let fence = null;
  const rewritten = source.split('\n').map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length) fence = null;
      return line;
    }
    if (fence) return line;
    return line
      .replace(/(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)([^)\n]*\))/g, (_all, start, target, end) => {
        const bracketed = target.startsWith('<');
        const href = bracketed ? target.slice(1, -1) : target;
        const transformed = rewriteHref(href, destination, surface);
        return `${start}${bracketed ? `<${transformed}>` : transformed}${end}`;
      })
      .replace(/^(\s{0,3}\[[^\]\n]+\]:\s*)(<[^>\n]+>|\S+)(.*)$/, (_all, start, target, end) => {
        const bracketed = target.startsWith('<');
        const href = bracketed ? target.slice(1, -1) : target;
        const transformed = rewriteHref(href, destination, surface);
        return `${start}${bracketed ? `<${transformed}>` : transformed}${end}`;
      });
  }).join('\n');
  const label = surface === 'wiki' ? 'Synkad wiki-spegel' : 'Synkad presentationskopia';
  return `${rewritten.trimEnd()}\n\n---\n\n> ${label}. Redigera [källfilen i Croupier](${sourceUrl(sourceName)}) och kör \`tools/sync-docs.mjs\` i canvas-repot. Denna kopia är inte en separat besluts- eller runtimekälla.\n`;
}

function gitRevision(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return null;
  const result = spawnSync('git', ['-C', root, 'log', '-1', '--format=%H', '--', CANONICAL_DIRECTORY], { encoding: 'utf8', windowsHide: true });
  const value = result.status === 0 ? result.stdout.trim() : '';
  if (/^[a-f0-9]{40,64}$/.test(value)) return value;
  const detail = result.error?.message || result.stderr?.trim() || 'No valid commit was returned for the canonical directory.';
  throw new Error(`Cannot determine canonical Git revision. Check repository access/ownership and committed canonical history before syncing. ${detail}`);
}

function readRequired(root, relative) {
  const target = safePath(root, relative);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`Required file is missing: ${relative}`);
  return fs.readFileSync(target);
}

function buildPlan(sourceRoot, githubRoot) {
  const github = new Map();
  const wiki = new Map();
  const sources = {};
  for (const [name, destination] of MAPPING) {
    const content = normalizeMarkdown(readRequired(sourceRoot, `${CANONICAL_DIRECTORY}/${name}`).toString('utf8'));
    sources[name] = sha256(content);
    github.set(destination, Buffer.from(mirrorMarkdown(content, name, destination, 'github')));
    for (const prefix of [CANONICAL_DIRECTORY.replace(/^docs\//, ''), 'animation-events-v4/canvas']) {
      const wikiDestination = `${prefix}/${name}`;
      wiki.set(wikiDestination, Buffer.from(mirrorMarkdown(content, name, wikiDestination, 'wiki')));
    }
    if (/^s\d\d-/.test(name)) {
      const wikiDestination = `animation-events-v4-${name.slice(0, 3)}.md`;
      wiki.set(wikiDestination, Buffer.from(mirrorMarkdown(content, name, wikiDestination, 'wiki')));
    }
  }
  const html = readRequired(githubRoot, 'index.html');
  github.set('index.html', html);
  wiki.set('animation-events-v4.html', html);
  wiki.set('animation-events-v4/canvas/index.html', html);
  const manifest = {
    schemaVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    canonicalRepository: REPOSITORY,
    canonicalDirectory: CANONICAL_DIRECTORY,
    sourceRevision: gitRevision(sourceRoot),
    sources,
    files: Object.fromEntries([...github].map(([name, content]) => [name, sha256(content)])),
    wikiFiles: Object.fromEntries([...wiki].map(([name, content]) => [name, sha256(content)])),
  };
  github.set(MANIFEST, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  return { github, wiki };
}

function expectedWikiPaths() {
  const paths = [];
  for (const [name] of MAPPING) {
    paths.push(`${CANONICAL_DIRECTORY.replace(/^docs\//, '')}/${name}`, `animation-events-v4/canvas/${name}`);
    if (/^s\d\d-/.test(name)) paths.push(`animation-events-v4-${name.slice(0, 3)}.md`);
  }
  return [...paths, 'animation-events-v4.html', 'animation-events-v4/canvas/index.html'];
}

function validateHashes(actual, expected, label) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) || Object.keys(actual).sort().join('\n') !== [...expected].sort().join('\n')) {
    throw new Error(`Invalid manifest ${label}: unexpected or missing paths`);
  }
  if (Object.values(actual).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error(`Invalid manifest ${label}: expected SHA-256 hashes`);
}

function checkManifest(githubRoot, wikiRoot) {
  const manifest = JSON.parse(readRequired(githubRoot, MANIFEST).toString('utf8'));
  if (manifest.schemaVersion !== 1 || manifest.generatorVersion !== GENERATOR_VERSION || manifest.canonicalRepository !== REPOSITORY || manifest.canonicalDirectory !== CANONICAL_DIRECTORY) throw new Error('Manifest schema or generator version does not match; resync canonical sources');
  validateHashes(manifest.sources, [...MAPPING.keys()], 'sources');
  validateHashes(manifest.files, [...MAPPING.values(), 'index.html'], 'files');
  validateHashes(manifest.wikiFiles, expectedWikiPaths(), 'wikiFiles');
  const drift = [];
  for (const [label, root, entries] of [['github', githubRoot, manifest.files], ['wiki', wikiRoot, manifest.wikiFiles]]) {
    if (!root) continue;
    for (const [name, expectedHash] of Object.entries(entries)) {
      const target = safePath(root, name);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile() || sha256(fs.readFileSync(target)) !== expectedHash) drift.push(`${label}:${name}`);
    }
  }
  return { drift, checkedFiles: Object.keys(manifest.files).length + (wikiRoot ? Object.keys(manifest.wikiFiles).length : 0) };
}

function applyOrCheck(plans, write) {
  const changed = [];
  let checkedFiles = 0;
  const validated = [];
  for (const [label, root, files] of plans) {
    if (!root) continue;
    for (const [name, content] of files) {
      const target = safePath(root, name);
      if (fs.existsSync(target) && !fs.statSync(target).isFile()) throw new Error(`Target is not a regular file: ${label}:${name}`);
      validated.push({ label, root, name, target, content });
    }
  }
  for (const item of validated) {
    const { label, root, name, target, content } = item;
    checkedFiles++;
    if (fs.existsSync(target) && fs.readFileSync(target).equals(content)) continue;
    changed.push(`${label}:${name}`);
    if (write) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      safePath(root, name);
      fs.writeFileSync(target, content);
    }
  }
  return { drift: changed, checkedFiles };
}

function main(argv) {
  const options = { write: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node tools/sync-docs.mjs [--croupier PATH] [--wiki PATH] [--write]\nDefault: read-only check. Without --croupier, checks local copies against docs/sync-manifest.json.\n--write requires --croupier. Edit canonical Croupier Markdown, import with --write, run node build-static.mjs, then --write again to record/copy the built HTML. No network, publishing or deletion.');
      return;
    }
    if (arg === '--write') options.write = true;
    else if (arg === '--croupier' || arg === '--wiki') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${arg} needs a directory`);
      if (options[arg.slice(2)]) throw new Error(`Duplicate option: ${arg}`);
      options[arg.slice(2)] = argv[++i];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.write && !options.croupier) throw new Error('--write requires --croupier; copies are not an editable source');
  const githubRoot = rootPath(GITHUB_ROOT, 'GitHub', options.write);
  const sourceRoot = options.croupier ? rootPath(options.croupier, 'Croupier') : null;
  const wikiRoot = options.wiki ? rootPath(options.wiki, 'Wiki', options.write) : null;
  if (wikiRoot && (wikiRoot === githubRoot || wikiRoot === sourceRoot)) throw new Error('Wiki target must be a separate repository root');
  if (sourceRoot === githubRoot) throw new Error('Croupier source must be a separate repository root');
  let result;
  if (sourceRoot) {
    const plan = buildPlan(sourceRoot, githubRoot);
    result = applyOrCheck([['github', githubRoot, plan.github], ['wiki', wikiRoot, plan.wiki]], options.write);
  } else result = checkManifest(githubRoot, wikiRoot);
  const status = options.write ? (result.drift.length ? 'updated' : 'ok') : (result.drift.length ? 'drift' : 'ok');
  console.log(JSON.stringify({ status, checkedFiles: result.checkedFiles, [options.write ? 'updatedFiles' : 'drift']: result.drift }, null, 2));
  if (!options.write && result.drift.length) process.exitCode = 1;
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`sync-docs: ${error.message}`);
  process.exitCode = 1;
}

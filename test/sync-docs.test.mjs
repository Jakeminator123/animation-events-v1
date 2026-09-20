import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TOOL = fileURLToPath(new URL('../tools/sync-docs.mjs', import.meta.url));
const CANONICAL_DIRECTORY = 'docs/animation-events/v4-8-days-mvp';
const NAMES = ['s00-helheten.md', 's01-kartan.md', 's02-spraket.md', 's03-eventtradet.md', 's04-saker-presentation.md', 's05-ordlista.md', 's06-plan.md', 'README.md', 'CANVAS.md', 'DECISIONS.md', 'RUNTIME-EVIDENCE.md'];
const WIKI_URL = 'https://gitlab.com/scout-gg/croupier/-/wikis/animation-events/v4-8-days-mvp/';

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'croupier-doc-sync-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const github = path.join(temporary, 'github');
  const source = path.join(temporary, 'croupier');
  const wiki = path.join(temporary, 'wiki');
  fs.mkdirSync(path.join(github, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(github, '.git'));
  fs.mkdirSync(path.join(wiki, '.git'), { recursive: true });
  fs.mkdirSync(path.join(source, CANONICAL_DIRECTORY), { recursive: true });
  fs.copyFileSync(TOOL, path.join(github, 'tools/sync-docs.mjs'));
  fs.writeFileSync(path.join(github, 'index.html'), '<!doctype html>\n<title>V4 fixture åäö</title>\n');
  fs.writeFileSync(path.join(github, 'README.md'), '# GitHub navigation: preserve me\n');
  fs.writeFileSync(path.join(wiki, 'home.md'), '# Wiki navigation: preserve me\n');
  fs.writeFileSync(path.join(wiki, 'agent-inbox.md'), '# Inbox: preserve me\n');
  for (const name of NAMES) {
    fs.writeFileSync(path.join(source, CANONICAL_DIRECTORY, name), `# ${name}\r\n\r\n[Eventträd](s03-eventtradet.md#trigger)\r\n[Presentation](./s04-saker-presentation.md)\r\n[Beslut](DECISIONS.md)\r\n[Inbox](../../shared/AGENT-INBOX.md)\r\n[Extern](https://example.test/s03-eventtradet.md)\r\n[Referens][event]\r\n[event]: s03-eventtradet.md#take "Titel"\r\n\r\n\`\`\`md\r\n[Oförändrat exempel](s03-eventtradet.md)\r\n\`\`\`\r\n`);
  }
  const run = (...args) => spawnSync(process.execPath, [path.join(github, 'tools/sync-docs.mjs'), ...args], { encoding: 'utf8', windowsHide: true });
  const sync = (...args) => run('--croupier', source, '--wiki', wiki, ...args);
  return { temporary, github, source, wiki, run, sync };
}

function snapshot(root) {
  const entries = {};
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const [relative, value] of Object.entries(snapshot(absolute))) entries[`${entry.name}/${relative}`] = value;
    } else entries[entry.name] = { content: fs.readFileSync(absolute).toString('base64'), modified: fs.statSync(absolute).mtimeMs };
  }
  return entries;
}

test('imports all specified mirrors, maps GitHub names and wiki slugs, and preserves unrelated files', t => {
  const f = fixture(t);
  const result = f.sync('--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).checkedFiles, 44);
  const ghPage = fs.readFileSync(path.join(f.github, 's03-motorn.md'), 'utf8');
  assert.match(ghPage, /\[Eventträd\]\(s03-motorn.md#trigger\)/);
  assert.match(ghPage, /\[Presentation\]\(s04-openclaw.md\)/);
  assert.match(ghPage, /\[Beslut\]\(docs\/DECISIONS.md\)/);
  assert.match(ghPage, /\[event\]: s03-motorn.md#take "Titel"/);
  assert.match(ghPage, /\[Extern\]\(https:\/\/example.test\/s03-eventtradet.md\)/);
  assert.match(ghPage, /\[Oförändrat exempel\]\(s03-eventtradet.md\)/);
  const ghDocs = fs.readFileSync(path.join(f.github, 'docs/README.md'), 'utf8');
  assert.match(ghDocs, /\[Eventträd\]\(\.\.\/s03-motorn.md#trigger\)/);
  assert.match(ghDocs, /\[Beslut\]\(DECISIONS.md\)/);
  for (const relative of ['animation-events/v4-8-days-mvp/s03-eventtradet.md', 'animation-events-v4/canvas/s03-eventtradet.md', 'animation-events-v4-s03.md']) {
    const page = fs.readFileSync(path.join(f.wiki, relative), 'utf8');
    assert.ok(page.includes(`[Eventträd](${WIKI_URL}s03-eventtradet#trigger)`));
    assert.ok(page.includes('[Inbox](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox)'));
    assert.match(page, /Synkad wiki-spegel/);
    assert.doesNotMatch(page, /wikis\/[^)\s]*\.md/);
  }
  assert.equal(fs.readFileSync(path.join(f.github, 'README.md'), 'utf8'), '# GitHub navigation: preserve me\n');
  assert.equal(fs.readFileSync(path.join(f.wiki, 'home.md'), 'utf8'), '# Wiki navigation: preserve me\n');
  assert.equal(fs.readFileSync(path.join(f.wiki, 'agent-inbox.md'), 'utf8'), '# Inbox: preserve me\n');
  assert.equal(f.sync().status, 0);
  assert.equal(f.run().status, 0);
  assert.equal(f.run('--wiki', f.wiki).status, 0);
});

test('HTML copies are byte-identical and manifest is deterministic without private paths or timestamps', t => {
  const f = fixture(t);
  assert.equal(f.sync('--write').status, 0);
  const html = fs.readFileSync(path.join(f.github, 'index.html'));
  assert.ok(html.equals(fs.readFileSync(path.join(f.wiki, 'animation-events-v4.html'))));
  assert.ok(html.equals(fs.readFileSync(path.join(f.wiki, 'animation-events-v4/canvas/index.html'))));
  const manifestPath = path.join(f.github, 'docs/sync-manifest.json');
  const initial = fs.readFileSync(manifestPath, 'utf8');
  assert.equal(JSON.parse(initial).generatorVersion, '2.0.0');
  assert.equal(JSON.parse(initial).sourceRevision, null);
  assert.ok(!initial.includes(f.temporary));
  assert.doesNotMatch(initial, /timestamp|generatedAt|checkedAt/);
  const before = snapshot(f.temporary);
  assert.equal(f.sync('--write').status, 0);
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), initial);
  assert.deepEqual(snapshot(f.temporary), before, 'unchanged write does not touch files');
});

test('default source check detects drift without creating or changing any file', t => {
  const f = fixture(t);
  const before = snapshot(f.temporary);
  const result = f.sync();
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, 'drift');
  assert.deepEqual(snapshot(f.temporary), before);
  assert.equal(f.sync('--write').status, 0);
  fs.appendFileSync(path.join(f.source, CANONICAL_DIRECTORY, 's00-helheten.md'), '\nNew canonical decision.\n');
  const changed = snapshot(f.temporary);
  const checked = f.sync();
  assert.equal(checked.status, 1);
  assert.ok(JSON.parse(checked.stdout).drift.includes('github:s00-helheten.md'));
  assert.deepEqual(snapshot(f.temporary), changed);
});

test('offline check detects both Markdown and built HTML drift', t => {
  const f = fixture(t);
  assert.equal(f.sync('--write').status, 0);
  fs.appendFileSync(path.join(f.github, 's01-kartan.md'), 'Manual mirror edit\n');
  fs.appendFileSync(path.join(f.github, 'index.html'), '<!-- stale manual edit -->\n');
  const result = f.run();
  assert.equal(result.status, 1);
  const drift = JSON.parse(result.stdout).drift;
  assert.deepEqual(drift, ['github:s01-kartan.md', 'github:index.html']);
});

test('missing canonical input fails before any output is written', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.source, CANONICAL_DIRECTORY, 's06-plan.md'));
  const before = snapshot(f.temporary);
  const result = f.sync('--write');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Required file is missing: .*s06-plan.md/);
  assert.deepEqual(snapshot(f.temporary), before);
});

test('write requires canonical source and wiki must be a separate Git root', t => {
  const f = fixture(t);
  assert.match(f.run('--write').stderr, /--write requires --croupier/);
  assert.match(f.run('--croupier', f.source, '--wiki', f.github, '--write').stderr, /separate repository root/);
  assert.match(f.run('--croupier', f.source, '--wiki', f.temporary, '--write').stderr, /Git worktree root/);
  assert.match(f.run('--wiki', path.parse(f.temporary).root).stderr, /filesystem root/);
});

test('rejects a symlink escaping the wiki root before touching mirrors', t => {
  const f = fixture(t);
  const outside = path.join(f.temporary, 'outside');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(f.wiki, 'animation-events-v4'), process.platform === 'win32' ? 'junction' : 'dir');
  const beforeGithub = snapshot(f.github);
  const result = f.sync('--write');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Symlink in mirror path/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.deepEqual(snapshot(f.github), beforeGithub);
});

test('rejects manifest path injection without reading outside the mirror root', t => {
  const f = fixture(t);
  assert.equal(f.sync('--write').status, 0);
  const filename = path.join(f.github, 'docs/sync-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  manifest.files['../outside'] = '0'.repeat(64);
  fs.writeFileSync(filename, JSON.stringify(manifest));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid manifest files/);
});

test('rejects a file in a target directory position before any output is written', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.wiki, 'animation-events-v4'), 'Not a directory\n');
  const before = snapshot(f.temporary);
  const result = f.sync('--write');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Mirror parent is not a directory/);
  assert.deepEqual(snapshot(f.temporary), before);
});

test('canonical source revision ignores unrelated Git commits but detects canonical changes', t => {
  const f = fixture(t);
  const git = (...args) => {
    const result = spawnSync('git', ['-C', f.source, ...args], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const commit = message => git('-c', 'user.name=Sync test', '-c', 'user.email=sync-test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', message);
  git('init', '--quiet');
  git('add', '--', CANONICAL_DIRECTORY);
  commit('Canonical documentation baseline');
  const canonicalRevision = git('rev-parse', 'HEAD');
  assert.equal(f.sync('--write').status, 0);
  const manifestPath = path.join(f.github, 'docs/sync-manifest.json');
  const initialManifest = fs.readFileSync(manifestPath, 'utf8');
  assert.equal(JSON.parse(initialManifest).sourceRevision, canonicalRevision);

  fs.writeFileSync(path.join(f.source, 'unrelated.txt'), 'Independent OpenClaw work\n');
  git('add', '--', 'unrelated.txt');
  commit('Unrelated implementation change');
  assert.notEqual(git('rev-parse', 'HEAD'), canonicalRevision);
  assert.equal(f.sync().status, 0, 'unrelated commit must not report mirror drift');
  assert.equal(f.sync('--write').status, 0);
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), initialManifest);

  fs.appendFileSync(path.join(f.source, CANONICAL_DIRECTORY, 's00-helheten.md'), '\nA new canonical decision.\n');
  git('add', '--', CANONICAL_DIRECTORY);
  commit('Update canonical documentation');
  const changed = f.sync();
  assert.equal(changed.status, 1);
  assert.ok(JSON.parse(changed.stdout).drift.includes('github:docs/sync-manifest.json'));
  assert.ok(JSON.parse(changed.stdout).drift.includes('github:s00-helheten.md'));
  assert.equal(f.sync('--write').status, 0);
  assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).sourceRevision, git('rev-parse', 'HEAD'));
  assert.equal(f.sync().status, 0);
});

test('read-only offline verification works in downloaded source archives without .git', t => {
  const f = fixture(t);
  assert.equal(f.sync('--write').status, 0);
  fs.rmdirSync(path.join(f.github, '.git'));
  fs.rmdirSync(path.join(f.wiki, '.git'));
  const before = snapshot(f.temporary);
  assert.equal(f.run().status, 0, 'Vercel source download needs no Git metadata');
  assert.equal(f.run('--wiki', f.wiki).status, 0, 'read-only wiki archive verification also needs no Git metadata');
  assert.deepEqual(snapshot(f.temporary), before);
  assert.match(f.sync('--write').stderr, /GitHub: expected an existing Git worktree root/);
  fs.mkdirSync(path.join(f.github, '.git'));
  assert.match(f.sync('--write').stderr, /Wiki: expected an existing Git worktree root/);
});

test('an unreadable source Git revision fails clearly without recording null or writing mirrors', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.source, '.git'));
  const before = snapshot(f.temporary);
  const result = f.sync('--write');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot determine canonical Git revision/);
  assert.match(result.stderr, /repository access\/ownership/);
  assert.deepEqual(snapshot(f.temporary), before);
});

#!/usr/bin/env node
// Produces the installable Soberanía Protocol release candidate: a real, reproducible,
// checksum-identified @aoc/protocol tarball on disk, plus the consumer lock file a downstream
// repository (Soberanía Enterprise, PMFreak) vendors alongside it.
//
// This is the artifact that replaces a repository-local source copy. Everything it writes lands
// in dist-rc/ (git-ignored — the bytes are reproducible from the commit, so the commit is the
// record; docs/release/evidence/ holds the human-readable identity).
//
// Strictly non-publishing: it never tags, versions, flips "private", or contacts a registry.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve('.');
const outDir = join(repo, 'dist-rc');
const run = (cmd, opts = {}) => execSync(cmd, { cwd: repo, encoding: 'utf8', ...opts });

const pkg = JSON.parse(readFileSync(join(repo, 'packages/protocol/package.json'), 'utf8'));
const contract = JSON.parse(readFileSync(join(repo, 'packages/protocol/integration-contract.json'), 'utf8'));

console.log(`== protocol:rc:artifact — ${pkg.name}@${pkg.version} ==`);

console.log('-- validating the frozen integration contract --');
run('node scripts/check-integration-contract.mjs', { stdio: 'inherit', encoding: undefined });

console.log('-- building --');
run('npm run build --workspace @aoc/protocol', { stdio: 'inherit', encoding: undefined });

const temp = mkdtempSync(join(tmpdir(), 'aoc-protocol-rc-artifact-'));
const packInto = (subdir) => {
  const dest = join(temp, subdir);
  mkdirSync(dest, { recursive: true });
  const meta = JSON.parse(run(`npm pack --json --pack-destination ${JSON.stringify(dest)} ./packages/protocol`))[0];
  const path = join(dest, meta.filename);
  const bytes = readFileSync(path);
  return {
    meta,
    path,
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sha512: createHash('sha512').update(bytes).digest('hex'),
  };
};

try {
  console.log('-- packing twice to prove reproducibility --');
  const first = packInto('a');
  const second = packInto('b');
  if (first.sha256 !== second.sha256) {
    console.error('The tarball is NOT reproducible — two consecutive packs of the same tree differ.');
    console.error(`  pack 1 sha256: ${first.sha256}`);
    console.error(`  pack 2 sha256: ${second.sha256}`);
    process.exit(1);
  }

  const entries = run(`tar -tzf ${JSON.stringify(first.path)}`)
    .trim()
    .split('\n')
    .map((line) => line.replace(/^package\//, ''));
  const required = ['LICENSE', 'NOTICE', 'README.md', 'integration-contract.json', 'package.json'];
  const missing = required.filter((file) => !entries.includes(file));
  if (missing.length) {
    console.error(`The candidate tarball is missing required files: ${missing.join(', ')}`);
    process.exit(1);
  }
  const leaked = entries.filter((entry) => /__tests__|__snapshots__|fixture|\.env|secret|coverage|(^|\/)src\//i.test(entry));
  if (leaked.length) {
    console.error(`The candidate tarball contains disallowed entries: ${leaked.join(', ')}`);
    process.exit(1);
  }

  // The contract inside the artifact must be the contract in the tree — a consumer that reads
  // integration-contract.json out of node_modules must be reading exactly what this repo froze.
  const extractDir = join(temp, 'verify');
  mkdirSync(extractDir, { recursive: true });
  execSync(`tar -xzf ${JSON.stringify(first.path)} -C ${JSON.stringify(extractDir)}`);
  const shippedContract = readFileSync(join(extractDir, 'package/integration-contract.json'), 'utf8');
  if (shippedContract !== readFileSync(join(repo, 'packages/protocol/integration-contract.json'), 'utf8')) {
    console.error('The integration contract inside the tarball differs from packages/protocol/integration-contract.json.');
    process.exit(1);
  }

  const commit = run('git rev-parse HEAD').trim();
  const dirty = run('git status --porcelain -- packages/protocol').trim();

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const artifactPath = join(outDir, first.meta.filename);
  copyFileSync(first.path, artifactPath);

  // The lock file a consumer vendors next to the tarball. Same shape Soberanía Enterprise already
  // uses (docs/release/REFERENCE_CONSUMER_EVIDENCE.md), so adopting it is a copy, not a redesign.
  const lock = {
    _comment:
      'Consumer lock for @aoc/protocol. Copy this next to the vendored tarball in the consuming repository and re-verify it in CI: repository + commit + version + sha256 must match a fresh pack from the pinned commit.',
    package: pkg.name,
    version: pkg.version,
    repository: contract.protocol.repository,
    commit,
    sourceClean: dirty === '',
    artifact: {
      filename: first.meta.filename,
      bytes: first.bytes.length,
      sha256: first.sha256,
      sha512: first.sha512,
      integrity: first.meta.integrity,
      reproducible: true,
      fileCount: entries.length,
    },
    integrationContract: {
      contract: contract.contract,
      contractVersion: contract.contractVersion,
      status: contract.status,
      shippedAt: 'node_modules/@aoc/protocol/integration-contract.json',
    },
    verifiedExports: contract.protocol.exports.map((entry) => entry.path),
    installForm: `file:./vendor/${first.meta.filename}`,
    registryPublication: contract.protocol.distribution.registryPublication,
    knownGaps: [],
  };
  writeFileSync(join(outDir, 'protocol-consumer.lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  writeFileSync(join(outDir, 'SHA256SUMS'), `${first.sha256}  ${first.meta.filename}\n`);
  writeFileSync(
    join(outDir, 'README.md'),
    [
      `# Soberanía Protocol release candidate — ${pkg.name}@${pkg.version}`,
      '',
      `Built from \`${contract.protocol.repository}\` commit \`${commit}\`${dirty === '' ? '' : ' **with uncommitted changes under packages/protocol — not a citable artifact**'}.`,
      '',
      '| Field | Value |',
      '| --- | --- |',
      `| Artifact | \`${first.meta.filename}\` (${first.bytes.length} bytes, ${entries.length} files) |`,
      `| SHA-256 | \`${first.sha256}\` |`,
      `| Reproducible | yes — two consecutive packs are byte-identical |`,
      `| Integration contract | \`${contract.contract}@${contract.contractVersion}\` (${contract.status}) |`,
      `| Registry publication | ${contract.protocol.distribution.registryPublication} |`,
      '',
      '## Installing it in a consuming repository',
      '',
      '```bash',
      'mkdir -p vendor',
      `cp ${first.meta.filename} vendor/`,
      'cp protocol-consumer.lock.json .',
      `npm install --save-exact file:./vendor/${first.meta.filename}`,
      '```',
      '',
      'Then verify, in a blocking CI job, that a fresh pack from the pinned commit still hashes to',
      'the `sha256` in `protocol-consumer.lock.json`, and that',
      '`node_modules/@aoc/protocol/integration-contract.json` still reports',
      `\`contractVersion: ${contract.contractVersion}\`.`,
      '',
      'These files are regenerated by `npm run protocol:rc:artifact` and are not committed —',
      'the commit plus this checksum is the record.',
      '',
    ].join('\n'),
  );

  console.log(`\nwrote ${artifactPath}`);
  console.log(`wrote ${join(outDir, 'protocol-consumer.lock.json')}`);
  console.log(`wrote ${join(outDir, 'SHA256SUMS')}`);
  console.log(`wrote ${join(outDir, 'README.md')}`);
  console.log('\n== RC artifact ==');
  console.log(`| package        | ${pkg.name}@${pkg.version}`);
  console.log(`| commit         | ${commit}${dirty === '' ? '' : ' (DIRTY under packages/protocol)'}`);
  console.log(`| sha256         | ${first.sha256}`);
  console.log(`| files          | ${entries.length}`);
  console.log(`| contract       | ${contract.contract}@${contract.contractVersion} (${contract.status})`);
  console.log(`| publication    | ${contract.protocol.distribution.registryPublication}`);
  if (dirty !== '') {
    console.warn('\nWARNING: packages/protocol has uncommitted changes. Commit them before handing this artifact to a consumer.');
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
  for (const stray of ['aoc-protocol-' + pkg.version + '.tgz']) {
    if (existsSync(join(repo, stray))) rmSync(join(repo, stray), { force: true });
  }
}

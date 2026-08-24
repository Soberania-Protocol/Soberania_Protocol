#!/usr/bin/env node
// Packs @aoc/protocol and installs the tarball into each fixture under test-consumers/
// in isolation, then compiles/executes each one against the real published surface.
// Complements scripts/validate-publishability.mjs (which owns the single contracts-only
// fixture, invalid-import assertions, and declaration-leak checks) by covering broader
// consumer shapes (CJS TypeScript, CJS JavaScript, ESM TypeScript) and every subpath.
import { execSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve('.');
const consumersDir = join(repo, 'test-consumers');
const forbidden = ['pmfreak', 'aoc-enterprise', '@aoc/enterprise'];

const consumers = [
  { name: 'typescript-cjs', build: true },
  { name: 'javascript-cjs', build: false },
  { name: 'typescript-esm', build: true },
  // Stands in for a downstream repository verifying the frozen cross-repository integration
  // contract out of the installed package — see docs/integration/CROSS_REPO_INTEGRATION_CONTRACT.md.
  { name: 'contract-verification', build: false },
];

const results = [];
let failed = false;

console.log('== protocol:consumer:check ==');

console.log('-- building @aoc/protocol --');
execSync('npm run build --workspace @aoc/protocol', { cwd: repo, stdio: 'inherit' });

console.log('-- packing tarball --');
const packJson = execSync('npm pack --json ./packages/protocol', { cwd: repo, encoding: 'utf8' });
const packMeta = JSON.parse(packJson)[0];
let tarball = join(repo, packMeta.filename);
if (!existsSync(tarball)) {
  const candidates = readdirSync(repo).filter((f) => f.endsWith('.tgz') && f.includes('aoc') && f.includes('protocol'));
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one protocol tarball, found: ${candidates.join(', ')}`);
  }
  tarball = join(repo, candidates[0]);
}

console.log(`-- inspecting tarball contents (${packMeta.filename}) --`);
const tarList = execSync(`tar -tzf ${JSON.stringify(tarball)}`, { encoding: 'utf8' })
  .trim()
  .split('\n')
  .map((line) => line.replace(/^package\//, ''));

const disallowedInTarball = tarList.filter((entry) =>
  /__tests__|__snapshots__|fixture|\.env|secret|coverage|(^|\/)src\//i.test(entry),
);
if (disallowedInTarball.length) {
  console.error('Tarball contains disallowed entries:');
  for (const entry of disallowedInTarball) console.error(`  - ${entry}`);
  failed = true;
} else {
  console.log(`  ${tarList.length} files packed; no test/fixture/src/secret leakage found.`);
}

for (const { name, build } of consumers) {
  const fixture = join(consumersDir, name);
  const temp = mkdtempSync(join(tmpdir(), `aoc-protocol-consumer-${name}-`));
  const workdir = join(temp, 'consumer');
  const result = { name, install: 'fail', compile: 'skip', execute: 'fail' };

  try {
    cpSync(fixture, workdir, { recursive: true });

    execSync(`npm install --no-audit --no-fund ${JSON.stringify(tarball)}`, { cwd: workdir, stdio: 'pipe' });
    result.install = 'ok';

    const installedPkgJson = join(workdir, 'node_modules/@aoc/protocol/package.json');
    if (existsSync(installedPkgJson)) {
      const installedJson = readFileSync(installedPkgJson, 'utf8');
      for (const term of forbidden) {
        if (installedJson.toLowerCase().includes(term)) {
          throw new Error(`Installed @aoc/protocol package.json references forbidden term "${term}"`);
        }
      }
      const installedDeps = { ...(JSON.parse(installedJson).dependencies ?? {}) };
      for (const [dep, spec] of Object.entries(installedDeps)) {
        if (spec.startsWith('file:') || spec.startsWith('workspace:')) {
          throw new Error(`Installed @aoc/protocol depends on ${dep}@${spec} (file:/workspace: not allowed)`);
        }
      }
    }

    if (build) {
      // Use the repository-pinned compiler installed by the required root
      // `npm ci`; consumer validation must not depend on a second registry
      // download after the packed artifact has been installed.
      execSync(`${JSON.stringify(join(repo, 'node_modules', '.bin', 'tsc'))} -p tsconfig.json`, {
        cwd: workdir,
        stdio: 'pipe',
      });
      result.compile = 'ok';
    } else {
      result.compile = 'n/a';
    }

    const output = execSync('npm run start', { cwd: workdir, encoding: 'utf8' });
    result.execute = output.includes('consumer OK') ? 'ok' : 'fail';
    console.log(output.trim());
  } catch (error) {
    failed = true;
    result.execute = 'fail';
    console.error(`[${name}] FAILED:`, error.message ?? error);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  results.push(result);
}

console.log('\n== Consumer validation summary ==');
console.log('| Consumer | Install | Compile | Execute |');
console.log('| --- | --- | --- | --- |');
for (const r of results) {
  console.log(`| ${r.name} | ${r.install} | ${r.compile} | ${r.execute} |`);
}

rmSync(tarball, { force: true });

if (failed || results.some((r) => r.install !== 'ok' || r.execute !== 'ok')) {
  console.error('\nprotocol:consumer:check FAILED');
  process.exit(1);
}

console.log('\nprotocol:consumer:check PASSED');

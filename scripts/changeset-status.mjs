#!/usr/bin/env node
// `changeset status`, made prerelease-aware.
//
// After a prerelease cut (`changeset pre enter <tag>` + `changeset version`), every accumulated
// changeset has been consumed and recorded in .changeset/pre.json. A bare `changeset status` then
// fails with "Some packages have been changed but no changesets were found" — which is not a
// governance failure, it is what a cut candidate looks like. Reporting it as a failure would leave
// the repository permanently red for the whole life of a prerelease.
//
// So: outside pre mode this is exactly `changeset status`. Inside pre mode it first asserts the cut
// is coherent — a tag is recorded, at least one changeset was consumed, and the released package
// actually carries that tag — and only then tolerates that one specific message. Any other failure,
// and any incoherent cut, still fails.
//
// It never versions, publishes, or writes to the tree.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve('.');
const passthrough = process.argv.slice(2);
const command = ['npx changeset status', ...passthrough].join(' ');

const prePath = join(repo, '.changeset/pre.json');
const pre = existsSync(prePath) ? JSON.parse(readFileSync(prePath, 'utf8')) : null;

if (!pre || pre.mode !== 'pre') {
  try {
    execSync(command, { cwd: repo, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
  process.exit(0);
}

const protocolVersion = JSON.parse(readFileSync(join(repo, 'packages/protocol/package.json'), 'utf8')).version;
const incoherent = [];
if (!pre.tag) incoherent.push('.changeset/pre.json is in pre mode but records no tag');
if (!(pre.changesets ?? []).length) {
  incoherent.push(`pre mode is active with tag "${pre.tag}" but no changesets have been consumed — run: npx changeset version`);
}
if (pre.tag && !new RegExp(`-${pre.tag}\\.\\d+$`).test(protocolVersion)) {
  incoherent.push(`@aoc/protocol@${protocolVersion} does not carry the active prerelease tag "${pre.tag}"`);
}
if (incoherent.length) {
  console.error('[changeset-status] the prerelease cut is incoherent:');
  for (const problem of incoherent) console.error(`  - ${problem}`);
  process.exit(1);
}

try {
  execSync(command, { cwd: repo, stdio: 'inherit' });
} catch (error) {
  // stdio was inherited, so re-run captured to classify the failure precisely.
  let output = '';
  try {
    execSync(command, { cwd: repo, stdio: 'pipe', encoding: 'utf8' });
  } catch (captured) {
    output = `${captured.stdout ?? ''}${captured.stderr ?? ''}`;
  }
  if (!/no changesets were found/i.test(output)) {
    process.exit(error.status ?? 1);
  }
  console.log(
    `\n[changeset-status] pre mode "${pre.tag}": ${pre.changesets.length} changesets consumed into ` +
      `@aoc/protocol@${protocolVersion}. No pending changesets is the expected post-cut state, not a failure. ` +
      'New work still needs its own changeset before the next cut.',
  );
}

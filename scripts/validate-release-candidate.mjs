#!/usr/bin/env node
// Release-candidate gate for @aoc/protocol: one command that proves the tree is RC-ready.
// Strictly non-destructive — it never publishes, tags, versions, or writes to the tree
// (its only writes are npm-pack tarballs inside a temp dir, removed afterwards).
//
// Coverage: build, tests, typecheck, public-API governance, symbol parity, version graph,
// Changeset status, package metadata, the private-publication block, tarball generation +
// contents + reproducibility, the frozen cross-repository integration contract, committed
// manifest/SBOM evidence freshness, consumer fixtures, release-documentation existence +
// internal links + required content markers.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repo = resolve('.');
const results = [];
const run = (cmd, opts = {}) =>
  execSync(cmd, { cwd: repo, stdio: 'inherit', ...opts });
const capture = (cmd) => execSync(cmd, { cwd: repo, encoding: 'utf8' });

const check = (name, fn) => {
  process.stdout.write(`\n== rc:check :: ${name} ==\n`);
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message ?? String(error) });
    console.error(`[FAIL] ${name}: ${error.message ?? error}`);
  }
};

// --- toolchain-quality gates (delegate to the existing battery) ---
check('typecheck', () => run('npm run typecheck'));
check('build', () => run('npm run build'));
check('tests', () => run('npm test'));
check('public API governance', () => run('npm run check:public-export-governance'));
check('symbol parity', () => run('npm run check:symbol-parity'));
check('version graph', () => run('npm run check:version-graph'));
check('Changeset status', () => run('npx changeset status'));
// The frozen cross-repository integration contract must still describe the package it ships in.
check('integration contract', () => run('npm run check:integration-contract'));

// Rejects duplicate keys anywhere in a JSON document. JSON.parse silently keeps the last
// value for a duplicated key, so license-metadata ambiguity (e.g. "license" declared twice
// with different values) survives a plain parse — this walker does not.
const assertNoDuplicateJsonKeys = (text, label) => {
  let i = 0;
  const fail = (msg) => {
    throw new Error(`${label}: ${msg} (offset ${i})`);
  };
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i += 1;
  };
  const parseString = () => {
    if (text[i] !== '"') fail('expected string');
    i += 1;
    let out = '';
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') i += 1;
      out += text[i];
      i += 1;
    }
    if (i >= text.length) fail('unterminated string');
    i += 1;
    return out;
  };
  const parseArray = () => {
    i += 1;
    ws();
    if (text[i] === ']') {
      i += 1;
      return;
    }
    for (;;) {
      parseValue();
      ws();
      if (text[i] === ',') {
        i += 1;
        continue;
      }
      if (text[i] === ']') {
        i += 1;
        return;
      }
      fail('malformed array');
    }
  };
  const parseObject = () => {
    i += 1;
    ws();
    const seen = new Set();
    if (text[i] === '}') {
      i += 1;
      return;
    }
    for (;;) {
      ws();
      const key = parseString();
      if (seen.has(key)) fail(`duplicate JSON key "${key}"`);
      seen.add(key);
      ws();
      if (text[i] !== ':') fail('expected ":"');
      i += 1;
      parseValue();
      ws();
      if (text[i] === ',') {
        i += 1;
        continue;
      }
      if (text[i] === '}') {
        i += 1;
        return;
      }
      fail('malformed object');
    }
  };
  const parseValue = () => {
    ws();
    const c = text[i];
    if (c === '{') return parseObject();
    if (c === '[') return parseArray();
    if (c === '"') return parseString();
    while (i < text.length && !/[,\]}\s]/.test(text[i])) i += 1;
    return undefined;
  };
  ws();
  parseValue();
  ws();
  if (i < text.length) fail('trailing content after JSON document');
};

// --- package metadata and the private-publication block ---
const protocolPkgRaw = readFileSync(join(repo, 'packages/protocol/package.json'), 'utf8');
const protocolPkg = JSON.parse(protocolPkgRaw);
const rootPkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
check('package metadata', () => {
  const missing = [];
  if (protocolPkg.name !== '@aoc/protocol') missing.push('name must be @aoc/protocol');
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(protocolPkg.version ?? '')) missing.push('semver version');
  for (const field of ['license', 'repository', 'homepage', 'bugs', 'engines', 'main', 'types']) {
    if (!protocolPkg[field]) missing.push(`missing "${field}"`);
  }
  if (!protocolPkg.exports?.['.']) missing.push('missing root "." export');
  if (!Array.isArray(protocolPkg.files) || !protocolPkg.files.includes('dist')) missing.push('"files" must include "dist"');
  if (missing.length) throw new Error(missing.join('; '));
});
check('license consistency', () => {
  // Strict JSON validity + no duplicate keys anywhere (JSON.parse alone would hide them).
  assertNoDuplicateJsonKeys(protocolPkgRaw, 'packages/protocol/package.json');
  const licenseKeyCount = (protocolPkgRaw.match(/"license"\s*:/g) ?? []).length;
  if (licenseKeyCount !== 1) {
    throw new Error(`packages/protocol/package.json must declare "license" exactly once (found ${licenseKeyCount})`);
  }
  if (protocolPkg.license !== 'Apache-2.0') {
    throw new Error(`effective package license must be "Apache-2.0", found "${protocolPkg.license}"`);
  }
  const licenseText = readFileSync(join(repo, 'packages/protocol/LICENSE'), 'utf8');
  if (!licenseText.includes('Apache License') || !licenseText.includes('Version 2.0')) {
    throw new Error('packages/protocol/LICENSE is not the Apache License 2.0 text');
  }
  if (/MIT License|Permission is hereby granted, free of charge/i.test(licenseText)) {
    throw new Error('packages/protocol/LICENSE still contains MIT license text');
  }
  const sbomPath = join(repo, `docs/release/evidence/aoc-protocol-${protocolPkg.version}.sbom.spdx.json`);
  if (existsSync(sbomPath)) {
    const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
    const entry = (sbom.packages ?? []).find((p) => p.name === '@aoc/protocol');
    if (!entry) throw new Error('SBOM has no @aoc/protocol package entry');
    if (entry.licenseDeclared !== protocolPkg.license) {
      throw new Error(`SBOM licenseDeclared ("${entry.licenseDeclared}") does not match package metadata ("${protocolPkg.license}")`);
    }
    if (/\bMIT\b/.test(entry.licenseDeclared ?? '')) {
      throw new Error('SBOM reports MIT as the effective package license');
    }
  }
});
check('private publication block', () => {
  // Default posture: @aoc/protocol must be unpublishable. The one exception is the
  // founder-authorized release commit itself, where private:false is required by the
  // publication approval gate — that run must set AOC_PUBLISH_AUTHORIZED=1 explicitly
  // (never set in CI workflows; see docs/release/RELEASE_AUTHORITY.md).
  const publishAuthorized = process.env.AOC_PUBLISH_AUTHORIZED === '1';
  if (protocolPkg.private !== true && !publishAuthorized) {
    throw new Error(
      'packages/protocol/package.json must remain "private": true until a founder-authorized publish decision (set AOC_PUBLISH_AUTHORIZED=1 only on the authorized release commit)',
    );
  }
  if (protocolPkg.private === true && publishAuthorized) {
    throw new Error('AOC_PUBLISH_AUTHORIZED=1 is set but the package is still private — remove the override or flip the flag deliberately');
  }
  if (rootPkg.private !== true) throw new Error('root package.json must remain "private": true in every scenario');
});

// --- tarball generation, contents, reproducibility, evidence freshness ---
const temp = mkdtempSync(join(tmpdir(), 'aoc-protocol-rc-'));
let tarballSha256 = null;
try {
  const packInto = (subdir) => {
    const dest = join(temp, subdir);
    mkdirSync(dest, { recursive: true });
    const meta = JSON.parse(capture(`npm pack --json --pack-destination ${JSON.stringify(dest)} ./packages/protocol`))[0];
    const bytes = readFileSync(join(dest, meta.filename));
    return { meta, path: join(dest, meta.filename), sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  let first;
  check('tarball generation', () => {
    first = packInto('a');
  });
  check('tarball contents', () => {
    const entries = capture(`tar -tzf ${JSON.stringify(first.path)}`)
      .trim()
      .split('\n')
      .map((line) => line.replace(/^package\//, ''));
    const leaked = entries.filter((entry) => /__tests__|__snapshots__|fixture|\.env|secret|coverage|(^|\/)src\//i.test(entry));
    if (leaked.length) throw new Error(`disallowed entries in tarball: ${leaked.join(', ')}`);
    for (const required of ['LICENSE', 'NOTICE', 'README.md', 'integration-contract.json']) {
      if (!entries.includes(required)) {
        throw new Error(`tarball must include ${required} (missing: ${required})`);
      }
    }
  });
  check('reproducibility', () => {
    const second = packInto('b');
    if (first.sha256 !== second.sha256) {
      throw new Error(`two consecutive packs differ: ${first.sha256} vs ${second.sha256}`);
    }
    tarballSha256 = first.sha256;
    console.log(`  byte-identical double pack: sha256 ${tarballSha256}`);
  });
  check('release manifest evidence', () => {
    const manifestPath = join(repo, `docs/release/evidence/aoc-protocol-${protocolPkg.version}-release-manifest.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`missing ${manifestPath} — run: npm run protocol:release:manifest`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const key of ['package', 'source', 'toolchain', 'tarball', 'files']) {
      if (!manifest[key]) throw new Error(`manifest missing "${key}"`);
    }
    if (manifest.tarball.reproducible !== true) throw new Error('manifest does not record a reproducible pack');
    if (tarballSha256 && manifest.tarball.sha256 !== tarballSha256) {
      throw new Error(
        `manifest sha256 (${manifest.tarball.sha256}) is stale — current pack is ${tarballSha256}; regenerate with: npm run protocol:release:manifest`,
      );
    }
  });
  check('SBOM evidence', () => {
    const sbomPath = join(repo, `docs/release/evidence/aoc-protocol-${protocolPkg.version}.sbom.spdx.json`);
    if (!existsSync(sbomPath)) throw new Error(`missing ${sbomPath} — run: npm run protocol:release:manifest`);
    const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
    if (!sbom.spdxVersion) throw new Error('SBOM is not an SPDX document');
    const described = JSON.stringify(sbom);
    if (!described.includes('@aoc/protocol')) throw new Error('SBOM does not describe @aoc/protocol');
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

// --- consumer fixtures (installs the real tarball into isolated consumers) ---
check('consumer fixtures', () => run('node scripts/validate-protocol-consumer.mjs'));

// --- release documentation: existence, required content markers, internal links ---
const requiredDocs = [
  'CHANGELOG.md',
  'docs/guides/CONSUMER_GUIDE.md',
  'docs/getting-started/QUICK_START.md',
  'docs/protocol/PUBLIC_API.md',
  'docs/versioning-and-stability.md',
  'docs/integration/CONSUMER_MIGRATION_GUIDE.md',
  'docs/integration/CROSS_REPO_INTEGRATION_CONTRACT.md',
  'docs/release/PACKAGE_DISTRIBUTION_STRATEGY.md',
  'docs/release/PRERELEASE_POLICY.md',
  'docs/release/RELEASE_CANDIDATE_READINESS.md',
  'docs/release/MIGRATION_GUIDE_0.2.md',
  'docs/release/REGISTRY_READINESS.md',
  'docs/release/RELEASE_AUTHORITY.md',
  'docs/release/RELEASE_NOTES_0.2.0.md',
  'docs/release/REFERENCE_CONSUMER_EVIDENCE.md',
  'docs/release/ROLLBACK_PLAN.md',
  'docs/release/KNOWN_LIMITATIONS.md',
];
check('documentation existence', () => {
  const missing = requiredDocs.filter((doc) => !existsSync(join(repo, doc)));
  if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
});
check('changelog content', () => {
  const text = readFileSync(join(repo, 'CHANGELOG.md'), 'utf8');
  if (!/^## Unreleased$/m.test(text)) throw new Error('CHANGELOG.md must contain an "## Unreleased" section');
});
check('release notes content', () => {
  const text = readFileSync(join(repo, 'docs/release/RELEASE_NOTES_0.2.0.md'), 'utf8');
  if (!text.includes('Draft — not published')) {
    throw new Error('RELEASE_NOTES_0.2.0.md must carry status "Draft — not published"');
  }
});
check('registry-readiness content', () => {
  const text = readFileSync(join(repo, 'docs/release/REGISTRY_READINESS.md'), 'utf8');
  if (!/404/.test(text) || !/does NOT prove/i.test(text)) {
    throw new Error('REGISTRY_READINESS.md must record the 404-does-not-prove-scope-ownership caveat');
  }
});
check('internal links', () => {
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  const broken = [];
  for (const doc of requiredDocs) {
    const text = readFileSync(join(repo, doc), 'utf8');
    for (const match of text.matchAll(linkPattern)) {
      const target = match[1].split('#')[0].trim();
      if (!target || /^(https?:|mailto:)/.test(target)) continue;
      if (!existsSync(resolve(join(repo, dirname(doc)), target))) {
        broken.push(`${doc} → ${match[1]}`);
      }
    }
  }
  if (broken.length) throw new Error(`broken links:\n  ${broken.join('\n  ')}`);
});

// --- summary ---
console.log('\n== RC validation summary ==');
console.log('| Check | Result |');
console.log('| --- | --- |');
for (const r of results) console.log(`| ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} |`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\nprotocol:rc:check FAILED (${failed.length}/${results.length})`);
  process.exit(1);
}
console.log(`\nprotocol:rc:check PASSED (${results.length} checks)`);

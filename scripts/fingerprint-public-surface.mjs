#!/usr/bin/env node
// Deterministic fingerprint of everything @aoc/protocol exposes, so "the public surface did not
// move" is a value you can diff rather than a claim you have to trust.
//
// Four independent digests, deliberately separated:
//
//   exportMap     — the `exports` object, canonically ordered. Changes if any export key or target
//                   is added, removed, renamed or repointed.
//   buildOutput   — every file under packages/protocol/dist, path + content. Changes if any emitted
//                   JavaScript or declaration changes. This is the protocol-semantics and
//                   runtime-behaviour digest.
//   runtimeSymbols— the exported symbol names actually reachable by requiring each declared export
//                   from the build output. Catches a surface change that somehow left the emitted
//                   bytes alone.
//   identity      — name, version, license, engines, files, dependencies. This one is EXPECTED to
//                   move on a version cut; it is kept out of `surfaceDigest` for exactly that reason.
//
// `surfaceDigest` combines the first three. Two commits with the same `surfaceDigest` expose the
// same protocol to consumers, whatever their version numbers say.
//
// Usage: node scripts/fingerprint-public-surface.mjs [--json]
// Requires a build: npm run build --workspace @aoc/protocol
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repo = resolve('.');
const packageRoot = join(repo, 'packages/protocol');
const distRoot = join(packageRoot, 'dist');
const jsonOnly = process.argv.includes('--json');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digestOf = (value) => sha256(JSON.stringify(value));

const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

if (!existsSync(distRoot)) {
  console.error('packages/protocol/dist is absent — run: npm run build --workspace @aoc/protocol');
  process.exit(1);
}

// --- exportMap ---
const exportKeys = Object.keys(pkg.exports ?? {}).sort();
const exportMap = exportKeys.map((key) => [key, pkg.exports[key]]);

// --- buildOutput ---
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
const buildFiles = walk(distRoot)
  // .tsbuildinfo is incremental-compiler bookkeeping, not distributed output, and it is not packed.
  .filter((path) => !path.endsWith('.tsbuildinfo'))
  .map((path) => [relative(packageRoot, path).split('\\').join('/'), sha256(readFileSync(path))])
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

// --- runtimeSymbols ---
const require_ = createRequire(join(packageRoot, 'package.json'));
const runtimeSymbols = exportKeys
  .map((key) => {
    const target = pkg.exports[key];
    const file = typeof target === 'string' ? target : target?.default;
    if (!file || !file.endsWith('.js')) return [key, null]; // JSON metadata export
    const loaded = require_(join(packageRoot, file));
    return [key, Object.keys(loaded).sort()];
  })
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

// --- identity (expected to move on a version cut) ---
const identity = {
  name: pkg.name,
  version: pkg.version,
  license: pkg.license,
  private: pkg.private === true,
  type: pkg.type,
  engines: pkg.engines,
  main: pkg.main,
  types: pkg.types,
  files: [...(pkg.files ?? [])].sort(),
  dependencies: pkg.dependencies ?? {},
};

const digests = {
  exportMap: digestOf(exportMap),
  buildOutput: digestOf(buildFiles),
  runtimeSymbols: digestOf(runtimeSymbols),
  identity: digestOf(identity),
};
const surfaceDigest = sha256([digests.exportMap, digests.buildOutput, digests.runtimeSymbols].join('\n'));

const report = {
  _generatedBy: 'scripts/fingerprint-public-surface.mjs — a measurement; it changes nothing and authorizes nothing',
  package: pkg.name,
  version: pkg.version,
  surfaceDigest,
  digests,
  counts: {
    exportKeys: exportKeys.length,
    buildFiles: buildFiles.length,
    runtimeSymbols: runtimeSymbols.reduce((total, [, symbols]) => total + (symbols?.length ?? 0), 0),
  },
  exportKeys,
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`== public surface fingerprint — ${pkg.name}@${pkg.version} ==`);
  console.log(`surfaceDigest   ${surfaceDigest}`);
  console.log(`  exportMap     ${digests.exportMap}  (${exportKeys.length} keys)`);
  console.log(`  buildOutput   ${digests.buildOutput}  (${buildFiles.length} files)`);
  console.log(`  runtimeSymbols ${digests.runtimeSymbols}  (${report.counts.runtimeSymbols} symbols)`);
  console.log(`identityDigest  ${digests.identity}  (expected to move on a version cut)`);
}

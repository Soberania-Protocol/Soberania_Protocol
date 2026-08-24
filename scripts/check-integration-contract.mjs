#!/usr/bin/env node
// Enforces the frozen cross-repository integration contract shipped inside @aoc/protocol
// (packages/protocol/integration-contract.json).
//
// The contract is the promise this repository makes to Soberanía Enterprise and PMFreak about
// what @aoc/protocol *is*: its identity, its export set, the forms in which it may be installed,
// and what a consumer owes in return. "Frozen" is only meaningful if drift fails a build, so
// this script asserts the contract against the things it describes:
//
//   1. the contract document itself is well-formed and marked frozen;
//   2. package identity (name, version, license, engines, module format, zero runtime deps)
//      matches packages/protocol/package.json exactly;
//   3. the declared export set is *exactly* the package's export key set — adding or removing an
//      export without editing the contract fails here;
//   4. every declared export resolves to a built artifact under packages/protocol/dist
//      (or to a real file, for the JSON metadata exports);
//   5. every code export is classified in docs/protocol/PUBLIC_API.md, so the contract and the
//      governed public-API table cannot disagree;
//   6. the contract file is actually shipped (listed in "files" and in "exports").
//
// It never publishes, packs, tags, or contacts a registry.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve('.');
const contractPath = join(repo, 'packages/protocol/integration-contract.json');
const pkgPath = join(repo, 'packages/protocol/package.json');
const publicApiPath = join(repo, 'docs/protocol/PUBLIC_API.md');
const normativeDocRelative = 'docs/integration/CROSS_REPO_INTEGRATION_CONTRACT.md';

const errors = [];
const fail = (message) => errors.push(message);

if (!existsSync(contractPath)) {
  console.error(`[check:integration-contract] missing ${contractPath}`);
  process.exit(1);
}

let contract;
try {
  contract = JSON.parse(readFileSync(contractPath, 'utf8'));
} catch (error) {
  console.error(`[check:integration-contract] packages/protocol/integration-contract.json is not valid JSON: ${error.message}`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

// --- 1. contract document shape ---
if (contract.contract !== 'aoc.cross-repository-integration') {
  fail(`"contract" must be "aoc.cross-repository-integration", found ${JSON.stringify(contract.contract)}`);
}
if (!/^\d+\.\d+\.\d+$/.test(contract.contractVersion ?? '')) {
  fail(`"contractVersion" must be an exact semver version, found ${JSON.stringify(contract.contractVersion)}`);
}
if (contract.status !== 'frozen') {
  fail('"status" must be "frozen" — an unfrozen contract cannot be relied on across repositories');
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.frozenAt ?? '')) {
  fail(`"frozenAt" must be an ISO date (YYYY-MM-DD), found ${JSON.stringify(contract.frozenAt)}`);
}
if (contract.normativeDocument !== normativeDocRelative) {
  fail(`"normativeDocument" must point at ${normativeDocRelative}`);
}
if (!existsSync(join(repo, normativeDocRelative))) {
  fail(`the normative document ${normativeDocRelative} does not exist`);
}
for (const party of ['protocol', 'enterprise', 'pmfreak']) {
  if (!contract[party] || typeof contract[party] !== 'object') {
    fail(`missing party block "${party}" — the contract must name every repository it binds`);
  }
}
for (const section of ['installForms', 'changeControl']) {
  if (!contract[section] || typeof contract[section] !== 'object') fail(`missing "${section}" section`);
}
if (!Array.isArray(contract.installForms?.allowed) || contract.installForms.allowed.length === 0) {
  fail('"installForms.allowed" must list at least one allowed install form');
}
for (const forbidden of ['workspace:', 'file:']) {
  const declared = (contract.installForms?.forbidden ?? []).some((form) => form.includes(forbidden));
  if (!declared) fail(`"installForms.forbidden" must record the forbidden "${forbidden}" specifier form`);
}

// --- 2. package identity ---
const protocol = contract.protocol ?? {};
const identityChecks = [
  ['package', protocol.package, pkg.name],
  ['version', protocol.version, pkg.version],
  ['license', protocol.license, pkg.license],
  ['private', protocol.private, pkg.private === true],
  ['moduleFormat', protocol.moduleFormat, pkg.type],
];
for (const [field, contractValue, packageValue] of identityChecks) {
  if (contractValue !== packageValue) {
    fail(`protocol.${field} is ${JSON.stringify(contractValue)} but packages/protocol/package.json says ${JSON.stringify(packageValue)}`);
  }
}
if (protocol.engines?.node !== pkg.engines?.node) {
  fail(`protocol.engines.node (${protocol.engines?.node}) does not match the package (${pkg.engines?.node})`);
}
if (protocol.repository !== 'Soberania-Protocol/Soberania_Protocol') {
  fail(`protocol.repository must be the producing repository, found ${JSON.stringify(protocol.repository)}`);
}
// The slug this contract was frozen from and the URL the package advertises are recorded
// separately and both pinned: a consumer follows the package metadata, so it must not drift
// out from under the contract either.
if (protocol.packageRepositoryUrl !== pkg.repository?.url) {
  fail(
    `protocol.packageRepositoryUrl (${JSON.stringify(protocol.packageRepositoryUrl)}) does not match ` +
      `packages/protocol/package.json repository.url (${JSON.stringify(pkg.repository?.url)})`,
  );
}
if (protocol.packageRepositoryUrl !== `git+https://github.com/${protocol.repository}.git` && !protocol.packageRepositoryUrlNote) {
  fail('protocol.repository and protocol.packageRepositoryUrl disagree, so the contract must carry a "packageRepositoryUrlNote" explaining why');
}
const declaredRuntimeDeps = Object.keys(protocol.runtimeDependencies ?? {});
const actualRuntimeDeps = Object.keys(pkg.dependencies ?? {});
if (declaredRuntimeDeps.join(',') !== actualRuntimeDeps.join(',')) {
  fail(`contract declares runtime dependencies [${declaredRuntimeDeps}] but the package has [${actualRuntimeDeps}]`);
}

// --- 3. export set equality (this is the freeze) ---
const contractExports = protocol.exports ?? [];
if (!Array.isArray(contractExports) || contractExports.length === 0) {
  fail('protocol.exports must be a non-empty array');
}
const contractPaths = contractExports.map((entry) => entry?.path);
const duplicatePaths = contractPaths.filter((path, index) => contractPaths.indexOf(path) !== index);
if (duplicatePaths.length) fail(`duplicate export paths in the contract: ${[...new Set(duplicatePaths)].join(', ')}`);

const packagePaths = Object.keys(pkg.exports ?? {});
const missingFromContract = packagePaths.filter((path) => !contractPaths.includes(path));
const missingFromPackage = contractPaths.filter((path) => !packagePaths.includes(path));
if (missingFromContract.length) {
  fail(
    `packages/protocol/package.json exports ${missingFromContract.join(', ')} but the frozen contract does not declare it — ` +
      'add it to integration-contract.json and bump contractVersion (additive: minor)',
  );
}
if (missingFromPackage.length) {
  fail(
    `the frozen contract declares ${missingFromPackage.join(', ')} but the package no longer exports it — ` +
      'removing a contracted export requires a major Changeset and a contractVersion major',
  );
}

const allowedStability = new Set(['stable', 'stable-expanding', 'experimental', 'metadata']);
const allowedKind = new Set(['type-only', 'runtime', 'mixed', 'json']);
for (const entry of contractExports) {
  if (!allowedStability.has(entry?.stability)) {
    fail(`export ${entry?.path}: stability ${JSON.stringify(entry?.stability)} is not one of ${[...allowedStability].join(', ')}`);
  }
  if (!allowedKind.has(entry?.kind)) {
    fail(`export ${entry?.path}: kind ${JSON.stringify(entry?.kind)} is not one of ${[...allowedKind].join(', ')}`);
  }
}

// --- 4. every declared export resolves to a real, built artifact ---
const distBuilt = existsSync(join(repo, 'packages/protocol/dist'));
for (const entry of contractExports) {
  const target = pkg.exports?.[entry.path];
  const files = typeof target === 'string' ? [target] : [target?.types, target?.default].filter(Boolean);
  if (!files.length) {
    fail(`export ${entry.path} has no resolvable target in packages/protocol/package.json`);
    continue;
  }
  for (const file of files) {
    const onDisk = join(repo, 'packages/protocol', file);
    if (file.startsWith('./dist/')) {
      if (!distBuilt) continue; // reported once below
      if (!existsSync(onDisk)) fail(`export ${entry.path} points at ${file}, which does not exist in the build output`);
    } else if (!existsSync(onDisk)) {
      fail(`export ${entry.path} points at ${file}, which does not exist`);
    }
  }
}
if (!distBuilt) {
  console.warn('[check:integration-contract] packages/protocol/dist is absent — build-output resolution was skipped. Run: npm run build --workspace @aoc/protocol');
}

// --- 5. code exports are classified in the governed public-API table ---
const publicApi = existsSync(publicApiPath) ? readFileSync(publicApiPath, 'utf8') : '';
if (!publicApi) {
  fail(`missing ${publicApiPath} — the contract cannot be reconciled against the governed public API table`);
} else {
  for (const entry of contractExports) {
    if (entry.kind === 'json') continue;
    const specifier = entry.path === '.' ? '@aoc/protocol' : `@aoc/protocol/${entry.path.slice(2)}`;
    if (!publicApi.includes(`\`${specifier}\``)) {
      fail(`export ${entry.path} is contracted but absent from docs/protocol/PUBLIC_API.md`);
    }
  }
}

// --- 6. the contract is actually shipped to consumers ---
if (!(pkg.files ?? []).includes('integration-contract.json')) {
  fail('packages/protocol/package.json "files" must include "integration-contract.json" so the contract ships inside the tarball');
}
if (pkg.exports?.['./integration-contract.json'] !== './integration-contract.json') {
  fail('packages/protocol/package.json must export "./integration-contract.json" so consumers can read the contract from the installed package');
}

// --- 7. the unresolved-item discipline ---
const enterpriseSlot = contract.enterprise?.producesForPmfreak ?? {};
if (enterpriseSlot.producedByThisRepository === true) {
  fail('enterprise.producesForPmfreak.producedByThisRepository must remain false — this repository does not build the Enterprise runtime artifact');
}
if (!['unresolved', 'resolved'].includes(enterpriseSlot.status)) {
  fail(`enterprise.producesForPmfreak.status must be "unresolved" or "resolved", found ${JSON.stringify(enterpriseSlot.status)}`);
}
if (enterpriseSlot.status === 'unresolved' && !enterpriseSlot.note) {
  fail('an unresolved Enterprise slot must carry a "note" saying exactly what is unresolved');
}

if (errors.length) {
  console.error(`\n[check:integration-contract] FAILED (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error(`\nThe cross-repository integration contract is frozen. See ${normativeDocRelative}.`);
  process.exit(1);
}

console.log(
  `[check:integration-contract] PASSED — ${contract.contract}@${contract.contractVersion} (${contract.status}) binds ` +
    `${protocol.package}@${protocol.version} across ${contractPaths.length} export paths`,
);

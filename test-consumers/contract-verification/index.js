'use strict';

// This fixture stands in for a downstream repository (Soberanía Enterprise, PMFreak) that has
// installed the packed @aoc/protocol artifact and nothing else. It reads the frozen
// cross-repository integration contract out of the installed package and holds the package to it:
// every contracted export must actually resolve, and nothing outside the contract may.
//
// If this fails, a consumer that trusted the contract would have been misled — which is the whole
// thing the freeze exists to prevent.

const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const installed = require('@aoc/protocol/package.json');
// The contract ships as unexported package metadata (like LICENSE and NOTICE), so it is read by
// path — exactly as a consumer's CI verification step would. It is deliberately NOT a module
// specifier: this increment does not widen @aoc/protocol's public export surface.
const packageRoot = dirname(require.resolve('@aoc/protocol/package.json'));
const contract = JSON.parse(readFileSync(join(packageRoot, 'integration-contract.json'), 'utf8'));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// --- the contract is present, frozen, and describes what was installed ---
assert(contract.contract === 'aoc.cross-repository-integration', 'installed package ships the wrong contract document');
assert(contract.status === 'frozen', `installed contract is "${contract.status}", not "frozen"`);
assert(/^\d+\.\d+\.\d+$/.test(contract.contractVersion), 'contractVersion is not an exact semver version');
assert(
  contract.protocol.package === installed.name && contract.protocol.version === installed.version,
  `contract describes ${contract.protocol.package}@${contract.protocol.version} but ${installed.name}@${installed.version} was installed`,
);
assert(contract.protocol.license === installed.license, 'contract and installed package disagree on the license');
assert(
  Object.keys(contract.protocol.runtimeDependencies || {}).length === 0 &&
    Object.keys(installed.dependencies || {}).length === 0,
  '@aoc/protocol must have zero runtime dependencies',
);

// --- every contracted export resolves from the installed package ---
const resolved = [];
for (const entry of contract.protocol.exports) {
  const specifier = entry.path === '.' ? '@aoc/protocol' : `@aoc/protocol/${entry.path.slice(2)}`;
  let value;
  try {
    value = require(specifier);
  } catch (error) {
    throw new Error(`contracted export ${specifier} does not resolve from the installed package: ${error.message}`);
  }
  assert(typeof value === 'object' && value !== null, `contracted export ${specifier} did not resolve to a module object`);
  if (entry.kind === 'runtime' || entry.kind === 'mixed') {
    assert(Object.keys(value).length > 0, `contracted export ${specifier} is classified "${entry.kind}" but exports no runtime values`);
  }
  resolved.push(specifier);
}
assert(
  resolved.length === Object.keys(installed.exports).length,
  `contract covers ${resolved.length} exports but the installed package declares ${Object.keys(installed.exports).length}`,
);
assert(
  contract.protocol.contractFile.isAPublicExport === false && installed.exports['./integration-contract.json'] === undefined,
  'the contract must ship as unexported metadata — the installed package must not declare it as an export',
);

// --- nothing outside the contract may be imported ---
for (const forbidden of [
  '@aoc/protocol/src/contracts',
  '@aoc/protocol/dist/contracts/index.js',
  '@aoc/protocol/internal',
  // The contract file itself must not be reachable as a module specifier — proving this
  // increment shipped it without widening the export surface.
  '@aoc/protocol/integration-contract.json',
]) {
  let reachable = false;
  try {
    require(forbidden);
    reachable = true;
  } catch {
    // expected: undeclared subpaths must not resolve
  }
  assert(!reachable, `forbidden import form ${forbidden} resolved — the export map is not closed`);
}

// --- consumer obligations are stated, so an adopting repository knows what it signed up for ---
assert(Array.isArray(contract.pmfreak.obligations) && contract.pmfreak.obligations.length > 0, 'contract states no consumer obligations');
assert(
  (contract.installForms.forbidden || []).some((form) => form.includes('workspace:')),
  'contract does not forbid workspace: specifiers',
);

console.log(
  `consumer OK — ${contract.contract}@${contract.contractVersion} (${contract.status}) verified against ` +
    `${installed.name}@${installed.version}: ${resolved.length} contracted exports resolved, 4 forbidden forms rejected, ` +
    'contract read as unexported metadata',
);

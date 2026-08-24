/**
 * The frozen cross-repository integration contract
 * (`packages/protocol/integration-contract.json`) is what Soberanía Enterprise and PMFreak are
 * asked to depend on. `scripts/check-integration-contract.mjs` is its full gate; these tests give
 * the same invariants fast, in-suite feedback, so a drifting export set is caught by `npm test`
 * rather than only by the release-candidate battery.
 *
 * See docs/integration/CROSS_REPO_INTEGRATION_CONTRACT.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../..');
const readJson = (relativePath: string): Record<string, any> =>
  JSON.parse(readFileSync(join(repositoryRoot, relativePath), 'utf8'));

const contract = readJson('packages/protocol/integration-contract.json');
const protocolPackage = readJson('packages/protocol/package.json');

describe('cross-repository integration contract', () => {
  it('is frozen and exactly versioned', () => {
    expect(contract.contract).toBe('aoc.cross-repository-integration');
    expect(contract.status).toBe('frozen');
    expect(contract.contractVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(contract.frozenAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('describes the package it ships inside', () => {
    expect(contract.protocol.package).toBe(protocolPackage.name);
    expect(contract.protocol.version).toBe(protocolPackage.version);
    expect(contract.protocol.license).toBe(protocolPackage.license);
    expect(contract.protocol.moduleFormat).toBe(protocolPackage.type);
    expect(contract.protocol.engines.node).toBe(protocolPackage.engines.node);
    expect(contract.protocol.packageRepositoryUrl).toBe(protocolPackage.repository.url);
    expect(contract.protocol.runtimeDependencies).toEqual({});
    expect(protocolPackage.dependencies ?? {}).toEqual({});
  });

  it('declares exactly the package export set — in both directions', () => {
    const contracted = contract.protocol.exports.map((entry: { path: string }) => entry.path).sort();
    const declared = Object.keys(protocolPackage.exports).sort();
    expect(contracted).toEqual(declared);
  });

  it('classifies every contracted export', () => {
    for (const entry of contract.protocol.exports) {
      expect(['stable', 'stable-expanding', 'experimental', 'metadata']).toContain(entry.stability);
      expect(['type-only', 'runtime', 'mixed', 'json']).toContain(entry.kind);
    }
  });

  it('ships to consumers — listed in "files" and reachable as an export', () => {
    expect(protocolPackage.files).toContain('integration-contract.json');
    expect(protocolPackage.exports['./integration-contract.json']).toBe('./integration-contract.json');
  });

  it('forbids the install forms that would defeat independent packaging', () => {
    const forbidden: string[] = contract.installForms.forbidden;
    expect(forbidden.some((form) => form.includes('workspace:'))).toBe(true);
    expect(forbidden.some((form) => form.includes('file:'))).toBe(true);
    expect(contract.installForms.allowed.length).toBeGreaterThan(0);
  });

  it('records PMFreak\'s repository-local copies as the state being migrated away from', () => {
    expect(contract.pmfreak.currentDeclaration['@aoc/protocol']).toBe('file:src/aoc/protocol');
    expect(contract.pmfreak.currentDeclaration['@aoc-enterprise/runtime']).toBe('file:src/aoc/enterprise');
    expect(contract.pmfreak.obligations.length).toBeGreaterThan(0);
  });

  it('does not claim to produce the Enterprise runtime artifact', () => {
    expect(contract.enterprise.producesForPmfreak.producedByThisRepository).toBe(false);
    expect(['unresolved', 'resolved']).toContain(contract.enterprise.producesForPmfreak.status);
    if (contract.enterprise.producesForPmfreak.status === 'unresolved') {
      expect(typeof contract.enterprise.producesForPmfreak.note).toBe('string');
      expect(contract.enterprise.producesForPmfreak.note.length).toBeGreaterThan(0);
    }
  });

  it('points at a normative document that exists', () => {
    expect(contract.normativeDocument).toBe('docs/integration/CROSS_REPO_INTEGRATION_CONTRACT.md');
    expect(existsSync(join(repositoryRoot, contract.normativeDocument))).toBe(true);
  });
});

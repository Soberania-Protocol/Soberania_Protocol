import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  PROTOCOLIZATION_EXECUTION_EVENT_TYPES,
  createInMemoryProtocolizationResultRepository,
  executeProtocolization,
} from '@aoc/asset-protocolization';
import type { ProtocolizationExecutedEvent } from '@aoc/asset-protocolization';

import { sync } from './fixtures/test-declarations';
import {
  createExecutionContext,
  execute,
  readyDeclarationDossier,
  readyDossier,
  readyEvaluation,
} from './fixtures/test-execution';

/**
 * What a `ProtocolizationResult` is, and — far more importantly — what it is
 * not.
 *
 * ```text
 * PROTOCOLIZED != legal title             PROTOCOLIZED != ownership transfer
 * PROTOCOLIZED != government registration PROTOCOLIZED != token
 * PROTOCOLIZED != Enterprise authorization
 * ```
 *
 * The failure mode of an execution artifact is that a downstream reader treats
 * its existence as a favourable conclusion about the world. These tests assert,
 * mechanically, that the artifact offers nothing to support that reading.
 */
const packageRoot = join(__dirname, '..');
const executionRoot = join(packageRoot, 'src', 'execution');

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });

const sourceFiles = (): readonly { readonly file: string; readonly source: string }[] =>
  collectTypeScriptFiles(executionRoot).map((path) => ({
    file: relative(packageRoot, path),
    source: readFileSync(path, 'utf8'),
  }));

/**
 * Whether a forbidden term appears somewhere other than a negation.
 *
 * The vocabulary this slice must never *claim* is exactly the vocabulary its
 * documentation must be free to *deny*, so a flat substring ban would forbid
 * the boundary statements that do the work. A line is admitted when it carries
 * a negation marker, matching the convention the earlier slices' truth tests use.
 */
const NEGATION_MARKERS = ['!=', 'never', 'not ', 'no ', 'nothing', 'NOT'];

const offendingLines = (term: string): readonly string[] =>
  sourceFiles().flatMap(({ file, source }) =>
    source
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => line.toLowerCase().includes(term))
      .filter(({ line }) => !NEGATION_MARKERS.some((marker) => line.includes(marker)))
      .map(({ line, number }) => `${file}:${number}: ${line.trim()}`),
  );

describe('APV-10 execution truth semantics', () => {
  // §141 / §144.47 — no production symbol or prose claims a legal conclusion.
  it('claims no legal title, ownership, registration or enforceability anywhere', () => {
    for (const term of [
      'legal title',
      'legally valid',
      'legally binding',
      'title holder',
      'titleholder',
      'legal owner',
      'ownership transfer',
      'transfer of ownership',
      'government registration',
      'officially recorded',
      'legally registered',
      'enforceable',
      'deed',
    ]) {
      expect(offendingLines(term)).toEqual([]);
    }
  });

  // §83 / §84 / §85 / §86 — no field name promises a truth upgrade.
  it('declares no field that would read as a truth, approval or legality verdict', () => {
    const declared = sourceFiles().flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\breadonly\s+(owner|legalOwner|titleHolder|ownershipPercentage|valid|verified|proven|certified|approved|registered|enforceable|titleClear|attested|trusted|legallyValid|passed|score|confidence)\??\s*:/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(declared).toEqual([]);
  });

  // §88 / §138 — nothing was tokenized, and no token vocabulary reaches the artifact.
  it('produces an artifact with no token, contract, wallet or chain reference', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const { result, event } = execute(context, dossier);

    const serialized = `${JSON.stringify(result)}\n${JSON.stringify(event)}`.toLowerCase();
    for (const forbidden of [
      'token',
      'contractaddress',
      'wallet',
      'chain',
      'nft',
      'erc-20',
      'erc20',
      'erc721',
      'erc-3643',
      'mint',
      'anchor',
      'txhash',
      'blocknumber',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // §87 / §139 / §140 — no registry, no Enterprise, no payment reached anything.
  it('produces an artifact with no registry, governance or payment vocabulary', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const { result } = execute(context, dossier, {
      correlationId: 'aoc:correlation:truth-0001',
    });

    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === 'object' && value !== null) {
        for (const [key, entry] of Object.entries(value)) {
          keys.add(key);
          walk(entry);
        }
      }
    };
    walk(result);

    for (const forbidden of [
      'grant',
      'capability',
      'policy',
      'delegation',
      'revocation',
      'authorization',
      'registryWrite',
      'fee',
      'price',
      'amount',
      'currency',
      'invoice',
      'payment',
    ]) {
      expect([...keys]).not.toContain(forbidden);
    }

    // The complete key set of the artifact, asserted rather than described.
    expect(Object.keys(result).sort()).toEqual([
      'caseId',
      'correlationId',
      'executedAt',
      'executedCaseRevision',
      'materialRefs',
      'profile',
      'readinessBasis',
      'resultId',
      'schemaVersion',
      'subject',
      'tenantId',
    ]);
  });

  // §56 / §57 / §59 / §130 — the event names an execution and nothing more.
  it('emits exactly one execution event on success, and none on failure', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const outcome = executeProtocolization(context, dossier.protocolizationCase, evaluation, {
      resultId: 'protocolization-result-0001',
    });

    // One event type exists, and its name says exactly what happened.
    expect(Object.values(PROTOCOLIZATION_EXECUTION_EVENT_TYPES)).toEqual([
      'ProtocolizationExecuted',
    ]);
    expect(outcome.event.eventType).toBe('ProtocolizationExecuted');

    // §59 — the event and the result cannot disagree.
    const event: ProtocolizationExecutedEvent = outcome.event;
    expect(event.resultId).toBe(outcome.result.resultId);
    expect(event.caseId).toBe(outcome.result.caseId);
    expect(event.tenantId).toBe(outcome.result.tenantId);
    expect(event.profile).toEqual(outcome.result.profile);
    expect(event.executedCaseRevision).toBe(outcome.result.executedCaseRevision);
    expect(event.occurredAt).toBe(outcome.result.executedAt);

    // §58 — narrow: identifiers, the pin, the revision, the instant. No subject,
    // no dossier, no warnings, no personal data.
    expect(Object.keys(event).sort()).toEqual([
      'caseId',
      'eventType',
      'executedCaseRevision',
      'occurredAt',
      'profile',
      'resultId',
      'tenantId',
    ]);

    // §57 — a refused execution produces no event at all.
    const store = createInMemoryProtocolizationResultRepository();
    expect(() =>
      executeProtocolization(
        context,
        dossier.protocolizationCase,
        { ...evaluation, evaluatedCaseRevision: evaluation.evaluatedCaseRevision + 1 },
        { resultId: 'protocolization-result-0002' },
      ),
    ).toThrow();
    expect(sync(store.listByCase(context.tenantId, dossier.protocolizationCase.caseId))).toEqual([]);
  });

  // §21 / §27 / §48 / §144.48 — no canonical Protocol record is minted to fill a field.
  it('mints no Protocol record and reuses only references the case already held', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const before = {
      attestations: JSON.stringify(dossier.attestations),
      evidence: JSON.stringify(dossier.evidence),
      declarations: JSON.stringify(dossier.declarations),
    };

    const { result } = execute(context, dossier);

    expect(JSON.stringify(dossier.attestations)).toBe(before.attestations);
    expect(JSON.stringify(dossier.evidence)).toBe(before.evidence);
    expect(JSON.stringify(dossier.declarations)).toBe(before.declarations);

    // Every reference the artifact carries is one the case already held.
    const caseRefs = new Set(
      dossier.protocolizationCase.materials.map((material) => material.materialId),
    );
    for (const entry of result.materialRefs) {
      expect(caseRefs.has(entry.materialId)).toBe(true);
    }
    const attestationRefs = new Set(
      dossier.attestations.map((attestation) => attestation.id as string),
    );
    for (const ref of result.readinessBasis.attestationRefs) {
      expect(attestationRefs.has(ref)).toBe(true);
    }

    // The subject's sovereign identity is the case's own, never a fresh mint.
    expect(result.subject.subjectRef.sovereignAssetId).toBe(
      dossier.protocolizationCase.subject.subjectRef.sovereignAssetId,
    );
  });

  // §14 — the artifact answers what it is, and refuses to answer what it is not.
  it('is self-describing about the act, and silent about the world', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const { result } = execute(context, dossier);

    // What case? Whose tenant? Which subject? Which pin? Which revision? On what
    // readiness? When? Over what dossier? With what warnings still standing?
    expect(result.caseId).toBeTruthy();
    expect(result.tenantId).toBeTruthy();
    expect(result.subject.subjectRef.sovereignAssetId).toBeTruthy();
    expect(result.profile.profileId).toBeTruthy();
    expect(result.profile.profileVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.executedCaseRevision).toBeGreaterThanOrEqual(1);
    expect(result.readinessBasis.state).toBe('Ready');
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.materialRefs.length).toBeGreaterThan(0);
    expect(result.readinessBasis.warnings.length).toBeGreaterThan(0);

    // And nothing about what anybody may now do, own, sell, transfer or claim.
    expect(Object.keys(result)).not.toContain('governedResource');
    expect(Object.keys(result)).not.toContain('record');
    expect(Object.keys(result)).not.toContain('proof');
    expect(Object.keys(result)).not.toContain('signature');
  });
});

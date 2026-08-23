import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  ProtocolizationCaseState,
  ProtocolizationMaterialKind,
  ProtocolizationRequirementMaterialStatus,
  VerificationCheckOutcome,
  addProtocolizationCaseMaterial,
  countVerificationOutcomes,
  createProtocolizationCase,
  createVerificationCheckRegistry,
  executeProtocolizationVerificationCheck,
  listProtocolizationVerificationPlan,
  runProtocolizationVerification,
} from '@aoc/asset-protocolization';
import type { ProtocolizationCase } from '@aoc/asset-protocolization';

import {
  TEST_CHECK_ALPHA,
  TEST_CHECK_FUTURE_SOURCE,
  TEST_CONTENT_IDENTITY_FOR_BYTES,
  TEST_DIGESTIBLE_SUBJECT,
  TEST_VERIFICATION_ALL_PASS_SHAPE_V1,
  TEST_VERIFICATION_CHECKS,
  TEST_VERIFICATION_SHAPE_V1,
  createFutureSourceCheck,
  createVerificationContext,
} from './fixtures/test-verification';
import type { VerificationTestContext } from './fixtures/test-verification';

const sourceRoot = join(__dirname, '..', 'src');
const verificationRoot = join(sourceRoot, 'verification');

const TYPEOF_RESULTS = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'undefined',
  'function',
  'symbol',
  'bigint',
]);

const collect = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });

function openAllPassCase(context: VerificationTestContext): ProtocolizationCase {
  return createProtocolizationCase(context, {
    caseId: 'case-all-pass-001',
    profile: { profileId: TEST_VERIFICATION_ALL_PASS_SHAPE_V1.profileId, profileVersion: '1.0.0' },
    subject: TEST_DIGESTIBLE_SUBJECT,
  }).protocolizationCase;
}

describe('verification truth boundaries', () => {
  describe('architecture proof P — all checks PASS is not READY', () => {
    it('leaves the case in Draft with no readiness, approval or protocolization anywhere', async () => {
      const context = createVerificationContext();
      let protocolizationCase = openAllPassCase(context);
      context.clock.advance(60);
      protocolizationCase = addProtocolizationCaseMaterial(context, protocolizationCase, {
        materialId: 'material-identity',
        kind: ProtocolizationMaterialKind.ContentIdentity,
        requirementIds: ['identity.content.required'],
        contentIdentity: TEST_CONTENT_IDENTITY_FOR_BYTES,
      }).protocolizationCase;

      const plan = listProtocolizationVerificationPlan(context, protocolizationCase);
      const run = await runProtocolizationVerification(context, protocolizationCase, {
        executionIds: plan.map((_, index) => `execution-all-pass-${index}`),
      });

      expect(run.results).toHaveLength(3);
      expect(run.results.every((result) => result.outcome === VerificationCheckOutcome.Pass)).toBe(
        true,
      );

      // Hard acceptance: every declared check green, and still nothing.
      expect(protocolizationCase.state).toBe(ProtocolizationCaseState.Draft);
      expect(Object.values(ProtocolizationCaseState)).not.toContain('Ready');
      expect(Object.values(ProtocolizationCaseState)).not.toContain('Protocolized');

      const serialized = JSON.stringify(run).toLowerCase();
      for (const forbidden of [
        'ready',
        'protocolized',
        'approv',
        'attest',
        'complete',
        'verdict',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('produces a tally rather than a verdict, even when everything passes', async () => {
      const context = createVerificationContext();
      const protocolizationCase = openAllPassCase(context);
      const plan = listProtocolizationVerificationPlan(context, protocolizationCase);
      const run = await runProtocolizationVerification(context, protocolizationCase, {
        executionIds: plan.map((_, index) => `execution-tally-${index}`),
      });

      expect(countVerificationOutcomes(run.results)).toEqual({
        Pass: 3,
        Fail: 0,
        Warning: 0,
        ManualReview: 0,
        Unavailable: 0,
      });
      // No boolean, no score, no readiness signal on the run.
      expect(Object.keys(run)).not.toContain('passed');
      expect(Object.keys(run)).not.toContain('ready');
      expect(Object.keys(run)).not.toContain('outcome');
    });
  });

  describe('architecture proof Q — automation does not substitute for a professional', () => {
    it('creates no attestation for a profile that requires one, even with every check green', async () => {
      const context = createVerificationContext();
      let protocolizationCase = openAllPassCase(context);
      context.clock.advance(60);
      protocolizationCase = addProtocolizationCaseMaterial(context, protocolizationCase, {
        materialId: 'material-identity',
        kind: ProtocolizationMaterialKind.ContentIdentity,
        requirementIds: ['identity.content.required'],
        contentIdentity: TEST_CONTENT_IDENTITY_FOR_BYTES,
      }).protocolizationCase;

      const plan = listProtocolizationVerificationPlan(context, protocolizationCase);
      await runProtocolizationVerification(context, protocolizationCase, {
        executionIds: plan.map((_, index) => `execution-attest-${index}`),
      });

      // The profile requires a credentialled human attestation. It is still
      // Pending, no attestation material exists, and nothing has been signed.
      const attestation = protocolizationCase.requirementStates.find(
        (state) => state.requirementId === 'attestation.professional.required',
      );
      expect(attestation?.materialStatus).toBe(ProtocolizationRequirementMaterialStatus.Pending);
      expect(attestation?.materialIds).toEqual([]);
      expect(
        protocolizationCase.materials.filter(
          (material) => material.kind === ProtocolizationMaterialKind.Attestation,
        ),
      ).toEqual([]);
    });

    it('exposes no reviewer, decision or signature vocabulary at all', () => {
      const code = collect(verificationRoot)
        .map((path) => readFileSync(path, 'utf8'))
        .join('\n');

      for (const forbidden of [
        'assignReviewer',
        'reviewerId',
        'reviewQueue',
        'ProfessionalReview',
        'createAttestation',
        'attestationScope',
        'REQUEST_MORE_EVIDENCE',
        'ABSTAIN',
        'signResult',
        'professionalSignature',
      ]) {
        expect(code).not.toContain(forbidden);
      }
    });
  });

  describe('architecture proof R — a content subject runs the same generic engine', () => {
    it('has no asset-category, profile-id or asset-class branch anywhere', () => {
      const files = collect(sourceRoot).map((path) => ({
        path,
        code: readFileSync(path, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1 '),
      }));

      const branches = files.flatMap(({ path, code }) => {
        const found: string[] = [];
        for (const match of code.matchAll(
          /\bswitch\s*\(\s*[^)]*\b(assetCategory|profileId|assetType|category|subjectKind)\b/g,
        )) {
          found.push(`${path}: switch on ${match[1]}`);
        }
        for (const match of code.matchAll(
          /\b(assetCategory|assetType|profileId)\s*(?:===|!==|==|!=)\s*['"]([^'"]*)['"]/g,
        )) {
          // A `typeof x.profileId === 'string'` guard is a structural check, not
          // a branch on which asset class this is — the same carve-out APV-04's
          // own boundary test makes.
          if (TYPEOF_RESULTS.has(match[2])) continue;
          found.push(`${path}: compares ${match[1]} to '${match[2]}'`);
        }
        return found;
      });

      expect(branches).toEqual([]);
    });

    it('reaches the same result for a content subject and an external subject', async () => {
      // The engine's behaviour comes from checkId, registered executor and pinned
      // profile — never from what kind of thing the subject is.
      const context = createVerificationContext();
      const contentCase = createProtocolizationCase(context, {
        caseId: 'case-generic-content',
        profile: { profileId: TEST_VERIFICATION_SHAPE_V1.profileId, profileVersion: '1.0.0' },
        subject: TEST_DIGESTIBLE_SUBJECT,
      }).protocolizationCase;

      const { result } = await executeProtocolizationVerificationCheck(context, contentCase, {
        executionId: 'execution-generic-content',
        requirementId: 'verification.alpha',
        checkId: TEST_CHECK_ALPHA,
      });

      expect(result.outcome).toBe(VerificationCheckOutcome.Pass);
      expect(result.checkId).toBe(TEST_CHECK_ALPHA);
    });
  });

  describe('extensibility', () => {
    it('executes a check written after the engine, through a profile fixture', async () => {
      // No production file changes to make this work: a registration, and a
      // profile that names the id.
      const registry = createVerificationCheckRegistry([
        ...TEST_VERIFICATION_CHECKS.filter((check) => check.checkId !== TEST_CHECK_ALPHA),
        { ...createFutureSourceCheck(true), checkId: TEST_CHECK_ALPHA },
      ]);
      const context = createVerificationContext({ checks: registry });
      const protocolizationCase = createProtocolizationCase(context, {
        caseId: 'case-future-001',
        profile: { profileId: TEST_VERIFICATION_SHAPE_V1.profileId, profileVersion: '1.0.0' },
        subject: TEST_DIGESTIBLE_SUBJECT,
      }).protocolizationCase;

      const { result } = await executeProtocolizationVerificationCheck(context, protocolizationCase, {
        executionId: 'execution-future',
        requirementId: 'verification.alpha',
        checkId: TEST_CHECK_ALPHA,
      });

      expect(result.outcome).toBe(VerificationCheckOutcome.Pass);
      expect(result.reasonCode).toBe('test.future-source.observed');
    });

    it('reports Unavailable when that same check’s future source is down', async () => {
      const registry = createVerificationCheckRegistry([
        ...TEST_VERIFICATION_CHECKS.filter((check) => check.checkId !== TEST_CHECK_ALPHA),
        { ...createFutureSourceCheck(false), checkId: TEST_CHECK_ALPHA },
      ]);
      const context = createVerificationContext({ checks: registry });
      const protocolizationCase = createProtocolizationCase(context, {
        caseId: 'case-future-002',
        profile: { profileId: TEST_VERIFICATION_SHAPE_V1.profileId, profileVersion: '1.0.0' },
        subject: TEST_DIGESTIBLE_SUBJECT,
      }).protocolizationCase;

      const { result } = await executeProtocolizationVerificationCheck(context, protocolizationCase, {
        executionId: 'execution-future-down',
        requirementId: 'verification.alpha',
        checkId: TEST_CHECK_ALPHA,
      });

      expect(result.outcome).toBe(VerificationCheckOutcome.Unavailable);
      expect(result.outcome).not.toBe(VerificationCheckOutcome.Fail);
      expect(TEST_CHECK_FUTURE_SOURCE).toBe('test.check.future-source');
    });
  });

  describe('determinism and order independence', () => {
    it('produces identical results for identical inputs', async () => {
      const first = createVerificationContext();
      const second = createVerificationContext();
      const caseFirst = openAllPassCase(first);
      const caseSecond = openAllPassCase(second);

      const planFirst = listProtocolizationVerificationPlan(first, caseFirst);
      const planSecond = listProtocolizationVerificationPlan(second, caseSecond);
      expect(planFirst).toEqual(planSecond);

      const runFirst = await runProtocolizationVerification(first, caseFirst, {
        executionIds: planFirst.map((_, index) => `execution-det-${index}`),
      });
      const runSecond = await runProtocolizationVerification(second, caseSecond, {
        executionIds: planSecond.map((_, index) => `execution-det-${index}`),
      });

      expect(JSON.stringify(runFirst.results)).toBe(JSON.stringify(runSecond.results));
    });

    it('is unaffected by the order in which checks were registered', async () => {
      const forwards = createVerificationContext({
        checks: createVerificationCheckRegistry([...TEST_VERIFICATION_CHECKS]),
      });
      const backwards = createVerificationContext({
        checks: createVerificationCheckRegistry([...TEST_VERIFICATION_CHECKS].reverse()),
      });

      const caseForwards = createProtocolizationCase(forwards, {
        caseId: 'case-order-001',
        profile: { profileId: TEST_VERIFICATION_SHAPE_V1.profileId, profileVersion: '1.0.0' },
        subject: TEST_DIGESTIBLE_SUBJECT,
      }).protocolizationCase;
      const caseBackwards = createProtocolizationCase(backwards, {
        caseId: 'case-order-001',
        profile: { profileId: TEST_VERIFICATION_SHAPE_V1.profileId, profileVersion: '1.0.0' },
        subject: TEST_DIGESTIBLE_SUBJECT,
      }).protocolizationCase;

      const plan = listProtocolizationVerificationPlan(forwards, caseForwards);
      const runForwards = await runProtocolizationVerification(forwards, caseForwards, {
        executionIds: plan.map((_, index) => `execution-order-${index}`),
      });
      const runBackwards = await runProtocolizationVerification(backwards, caseBackwards, {
        executionIds: plan.map((_, index) => `execution-order-${index}`),
      });

      expect(runForwards.results.map((result) => [result.checkId, result.outcome])).toEqual(
        runBackwards.results.map((result) => [result.checkId, result.outcome]),
      );
    });
  });

  describe('deferred capabilities', () => {
    it('adds no waiver, override or force mechanism', () => {
      const code = collect(sourceRoot)
        .map((path) => readFileSync(path, 'utf8'))
        .join('\n');

      for (const forbidden of [
        'forcePass',
        'ignoreFailure',
        'waiveCheck',
        'adminOverride',
        'markVerified',
        'forceReady',
        'skipCheck',
        'bypassCheck',
      ]) {
        expect(code).not.toContain(forbidden);
      }
    });

    it('adds no APV-09 state, APV-10 execution or Enterprise governance concept', () => {
      const stripped = (root: string): string =>
        collect(root)
          .map((path) =>
            readFileSync(path, 'utf8')
              .replace(/\/\*[\s\S]*?\*\//g, ' ')
              .replace(/(^|[^:])\/\/[^\n]*/g, '$1 '),
          )
          .join('\n');

      // Nothing in the package may reach for a readiness state, a lifecycle
      // member that does not exist, an Enterprise engine or a tokenization verb.
      for (const forbidden of [
        'EVIDENCE_PENDING',
        'VERIFICATION_PENDING',
        'REVIEW_PENDING',
        'MORE_EVIDENCE_REQUIRED',
        'PROTOCOLIZING',
        'PROTOCOLIZED',
        'SUPERSEDED',
        'governedResource',
        'TOKENIZE',
        'AuthorityEngine',
        'PolicyEngine',
      ]) {
        expect(stripped(sourceRoot)).not.toContain(forbidden);
      }

      // `ProtocolizationResult` is APV-10's own artifact and now legitimately
      // exists under `src/execution/`. What this suite asserts is that the
      // *verification* slice never reaches for it: APV-07 records findings, and
      // a finding is never an execution.
      expect(stripped(verificationRoot)).not.toContain('ProtocolizationResult');
    });

    it('never writes a truth flag onto evidence, declarations or the case', async () => {
      const context = createVerificationContext();
      let protocolizationCase = openAllPassCase(context);
      context.clock.advance(60);
      protocolizationCase = addProtocolizationCaseMaterial(context, protocolizationCase, {
        materialId: 'material-identity',
        kind: ProtocolizationMaterialKind.ContentIdentity,
        requirementIds: ['identity.content.required'],
        contentIdentity: TEST_CONTENT_IDENTITY_FOR_BYTES,
      }).protocolizationCase;
      const before = JSON.stringify(protocolizationCase);

      const plan = listProtocolizationVerificationPlan(context, protocolizationCase);
      await runProtocolizationVerification(context, protocolizationCase, {
        executionIds: plan.map((_, index) => `execution-no-flag-${index}`),
      });

      expect(JSON.stringify(protocolizationCase)).toBe(before);
      const serialized = JSON.stringify(protocolizationCase);
      for (const forbidden of ['"verified"', '"valid"', '"passed"', '"checked"']) {
        expect(serialized).not.toContain(forbidden);
      }
    });
  });
});

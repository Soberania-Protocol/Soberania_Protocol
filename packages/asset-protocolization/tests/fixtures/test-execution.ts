import {
  ProtocolizationReadinessState,
  evaluateProtocolizationReadiness,
  executeProtocolization,
} from '@aoc/asset-protocolization';
import type {
  AssetProfile,
  ProtocolizationCaseSubject,
  ProtocolizationExecutionOutcome,
  ProtocolizationExecutionRequest,
  ProtocolizationReadinessEvaluation,
} from '@aoc/asset-protocolization';

import {
  READINESS_DECLARATION_V1,
  READINESS_EXTERNAL_SUBJECT,
  READINESS_EXTERNAL_V1,
  READINESS_FULL_V1,
  addDeclaration,
  addEvidence,
  createReadinessContext,
  newDossier,
  readinessInputs,
  review,
  runChecks,
} from './test-readiness';
import type { ReadinessDossier, ReadinessTestContext } from './test-readiness';

/**
 * Test-only fixtures for protocolization execution.
 *
 * Everything here is assembled through the **real** operations of APV-04 through
 * APV-09 rather than hand-written records, so an execution proof rests on reuse
 * rather than on resemblance. In particular, no test in this slice hand-writes a
 * `Ready` evaluation to feed the operation: readiness comes from
 * `evaluateProtocolizationReadiness` over a dossier that was genuinely built,
 * which is the only way a proof about *consuming* APV-09 can mean anything.
 *
 * The profiles are APV-09's own abstract shapes. There is no asset class, no
 * jurisdiction, no profession, no registry and no product profile anywhere in
 * this file.
 */

export { createReadinessContext as createExecutionContext };
export type { ReadinessDossier, ReadinessTestContext };

/**
 * A dossier that APV-09 genuinely finds `Ready`, over the full profile shape:
 * identity, declaration, evidence, verification and professional attestation.
 *
 * It also carries an unsatisfied `Optional` requirement, so the resulting
 * evaluation is `Ready` **with warnings** — the case APV-10 must execute without
 * inventing a second readiness policy.
 */
export async function readyDossier(
  context: ReadinessTestContext,
  options: {
    readonly caseId?: string;
    readonly profile?: AssetProfile;
    readonly subject?: ProtocolizationCaseSubject;
  } = {},
): Promise<ReadinessDossier> {
  const dossier = newDossier(context, {
    profile: options.profile ?? READINESS_FULL_V1,
    ...(options.caseId === undefined ? {} : { caseId: options.caseId }),
    ...(options.subject === undefined ? {} : { subject: options.subject }),
  });
  addDeclaration(context, dossier);
  addEvidence(context, dossier, {
    intakeId: 'intake-a',
    materialId: 'material-evidence-a',
    evidenceRef: 'aoc:evidence:execution-a',
  });
  addEvidence(context, dossier, {
    intakeId: 'intake-b',
    materialId: 'material-evidence-b',
    evidenceRef: 'aoc:evidence:execution-b',
  });
  await review(context, dossier, { withArtifact: true });
  await runChecks(context, dossier);
  return dossier;
}

/**
 * The smallest dossier APV-09 finds `Ready`: one declaration requirement, one
 * declaration, and nothing else to get in the way.
 */
export function readyDeclarationDossier(
  context: ReadinessTestContext,
  options: { readonly caseId?: string; readonly profileVersion?: string } = {},
): ReadinessDossier {
  const dossier = newDossier(context, {
    profile: READINESS_DECLARATION_V1,
    ...(options.caseId === undefined ? {} : { caseId: options.caseId }),
    ...(options.profileVersion === undefined ? {} : { profileVersion: options.profileVersion }),
  });
  addDeclaration(context, dossier);
  return dossier;
}

/**
 * A `Ready` dossier about a subject named only inside an external namespace —
 * no bytes, no content identity.
 *
 * The second of the two fundamentally different subject shapes, so the same
 * execution path can be walked for both without a single branch between them.
 */
export async function readyExternalSubjectDossier(
  context: ReadinessTestContext,
  options: { readonly caseId?: string } = {},
): Promise<ReadinessDossier> {
  const dossier = newDossier(context, {
    profile: READINESS_EXTERNAL_V1,
    subject: READINESS_EXTERNAL_SUBJECT,
    ...(options.caseId === undefined ? {} : { caseId: options.caseId }),
  });
  addDeclaration(context, dossier);
  await runChecks(context, dossier);
  return dossier;
}

/** APV-09's real evaluation over the dossier as it currently stands. */
export function evaluate(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
): ProtocolizationReadinessEvaluation {
  return evaluateProtocolizationReadiness(
    context,
    dossier.protocolizationCase,
    readinessInputs(dossier),
  );
}

/** APV-09's real evaluation, asserted to be `Ready` before a test relies on it. */
export function readyEvaluation(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
): ProtocolizationReadinessEvaluation {
  const evaluation = evaluate(context, dossier);
  if (evaluation.state !== ProtocolizationReadinessState.Ready) {
    throw new Error(
      `fixture expected a Ready evaluation, got ${evaluation.state}: ${evaluation.blockers
        .map((blocker) => blocker.reasonCode)
        .join(', ')}`,
    );
  }
  return evaluation;
}

/** Executes over a dossier's current revision, from a freshly derived `Ready`. */
export function execute(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
  request: Partial<ProtocolizationExecutionRequest> = {},
): ProtocolizationExecutionOutcome {
  return executeProtocolization(
    context,
    dossier.protocolizationCase,
    readyEvaluation(context, dossier),
    { resultId: 'protocolization-result-0001', ...request },
  );
}

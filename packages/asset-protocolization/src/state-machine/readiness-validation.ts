import type { AssetProfile } from '../profile';
import { isValidProtocolizationTenantId, protocolizationProfileRefsEqual } from '../case/case-identifiers';
import type { ProtocolizationProfileRef, ProtocolizationTenantId } from '../case/case-identifiers';
import type { ProtocolizationCaseId } from '../case/case-identifiers';
import type { ProtocolizationCaseContext } from '../case/case-operations';
import { validateProtocolizationCase } from '../case/case-validation';
import type { ProtocolizationCase } from '../case/protocolization-case';
import { isValidUtcDateTime } from '../freshness';
import type { ProtocolizationReadinessInputs } from './readiness-evaluation';
import {
  PROTOCOLIZATION_READINESS_ERROR_CODES,
  ProtocolizationReadinessError,
} from './readiness-errors';

/**
 * Everything that must hold before a readiness conclusion may be reached at all.
 *
 * ### Why validation is not optional here
 *
 * A readiness evaluation is the input to APV-10. Producing one from a
 * reconstructed case that does not validate, from a profile that is not the
 * pinned one, or from another tenant's records would put a conclusion into
 * circulation that looks exactly like a legitimate one and is not. So the
 * refusals below happen before a single requirement is looked at, and they
 * throw rather than degrading into a blocker — see `readiness-errors.ts` on why
 * the two are different things.
 *
 * ### The isolation boundary is the tenant, never the subject
 *
 * Ownership of a workflow is `tenantId`. It is never inferred from a subject
 * reference, a declarant, a reviewer or an external identifier — a subject can
 * legitimately appear in two tenants' cases, and reading ownership off one would
 * leak one tenant's dossier into the other's readiness.
 */

function fail(
  code: (typeof PROTOCOLIZATION_READINESS_ERROR_CODES)[keyof typeof PROTOCOLIZATION_READINESS_ERROR_CODES],
  message: string,
  details: {
    readonly tenantId?: ProtocolizationTenantId;
    readonly caseId?: ProtocolizationCaseId;
    readonly profile?: ProtocolizationProfileRef;
    readonly reasonCodes?: readonly string[];
  } = {},
): never {
  throw new ProtocolizationReadinessError(code, message, {
    reasonCodes: details.reasonCodes ?? [code],
    ...(details.tenantId === undefined ? {} : { tenantId: details.tenantId }),
    ...(details.caseId === undefined ? {} : { caseId: details.caseId }),
    ...(details.profile === undefined ? {} : { profile: details.profile }),
  });
}

/**
 * The acting tenant must be well-formed and must be the case's own.
 *
 * Tenant B evaluating tenant A's case fails here, before the case is read for
 * anything else — the same gate every other slice applies, reused rather than
 * re-invented.
 */
export function assertActingTenantOwnsCase(
  context: ProtocolizationCaseContext,
  protocolizationCase: ProtocolizationCase,
): void {
  if (!isValidProtocolizationTenantId(context.tenantId)) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.invalidTenant,
      'A non-blank acting tenantId is required to evaluate protocolization readiness',
    );
  }
  if (protocolizationCase.tenantId !== context.tenantId) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.tenantMismatch,
      'This ProtocolizationCase belongs to another tenant',
      { tenantId: context.tenantId, caseId: protocolizationCase.caseId },
    );
  }
}

/**
 * The aggregate must validate against the profile it claims to be pinned to.
 *
 * A case can arrive from a store, a message or a test fixture, so it is
 * re-validated on the way in exactly as APV-04's own operations do. A malformed
 * case yields no readiness answer at all: a conclusion drawn from a broken
 * aggregate would be indistinguishable, downstream, from a sound one.
 */
export function assertCaseIsValid(
  protocolizationCase: ProtocolizationCase,
  profile: AssetProfile,
): void {
  const validation = validateProtocolizationCase(protocolizationCase, { profile });
  if (!validation.valid) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.invalidCase,
      'This ProtocolizationCase does not validate against its pinned profile',
      {
        tenantId: protocolizationCase.tenantId,
        caseId: protocolizationCase.caseId,
        profile: protocolizationCase.profile,
        reasonCodes: validation.reasons,
      },
    );
  }
}

/**
 * Resolves the **exact** pinned profile version from the catalogue.
 *
 * There is no latest, current, newest, default or nearest resolution here or
 * anywhere else in this slice. A case pinned to `1.0.0` is evaluated under
 * `1.0.0` after `2.0.0` exists, and a `2.0.0` that adds a requirement changes
 * nothing about it.
 */
export function resolvePinnedProfile(
  context: ProtocolizationCaseContext,
  protocolizationCase: ProtocolizationCase,
): AssetProfile {
  const resolved = context.catalog.get(
    protocolizationCase.profile.profileId,
    protocolizationCase.profile.profileVersion,
  );
  if (resolved === undefined) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.profileNotFound,
      `No AssetProfile ${protocolizationCase.profile.profileId}@${protocolizationCase.profile.profileVersion} is catalogued`,
      {
        tenantId: protocolizationCase.tenantId,
        caseId: protocolizationCase.caseId,
        profile: protocolizationCase.profile,
      },
    );
  }
  if (
    !protocolizationProfileRefsEqual(protocolizationCase.profile, {
      profileId: resolved.profileId,
      profileVersion: resolved.version,
    })
  ) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.profileMismatch,
      'The catalogued profile is not the version this case pinned',
      {
        tenantId: protocolizationCase.tenantId,
        caseId: protocolizationCase.caseId,
        profile: protocolizationCase.profile,
      },
    );
  }
  return resolved;
}

/** The three correlation fields every APV workflow record carries. */
interface CaseScopedRecord {
  readonly tenantId: ProtocolizationTenantId;
  readonly caseId: ProtocolizationCaseId;
  readonly profile: ProtocolizationProfileRef;
}

function scopedRecords(inputs: ProtocolizationReadinessInputs): readonly CaseScopedRecord[] {
  return [
    ...(inputs.evidenceReceipts ?? []),
    ...(inputs.declarations ?? []),
    ...(inputs.verificationResults ?? []),
    ...(inputs.reviewRequests ?? []),
    ...(inputs.reviewDecisions ?? []),
  ];
}

/**
 * Every supplied record must belong to the acting tenant, to this case, and to
 * this case's exact pinned profile version.
 *
 * All three are hard boundaries, and each fails loudly rather than being
 * filtered away — a caller who handed over a foreign record has a bug, and
 * silently ignoring it would hide the bug behind a readiness answer that looks
 * complete:
 *
 * ```text
 * another tenant's evidence         can never satisfy this case
 * another case's verification result can never satisfy this case
 * another profile version's decision can never satisfy this case
 * ```
 */
export function assertInputsBelongToCase(
  context: ProtocolizationCaseContext,
  protocolizationCase: ProtocolizationCase,
  inputs: ProtocolizationReadinessInputs,
): void {
  const records = scopedRecords(inputs);

  if (records.some((record) => record.tenantId !== context.tenantId)) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.inputTenantMismatch,
      'A supplied readiness input belongs to another tenant',
      { tenantId: context.tenantId, caseId: protocolizationCase.caseId },
    );
  }
  if (records.some((record) => record.caseId !== protocolizationCase.caseId)) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.inputCaseMismatch,
      'A supplied readiness input belongs to another case',
      { tenantId: context.tenantId, caseId: protocolizationCase.caseId },
    );
  }
  if (
    records.some((record) => !protocolizationProfileRefsEqual(record.profile, protocolizationCase.profile))
  ) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.inputProfileMismatch,
      'A supplied readiness input was produced under another profile version',
      {
        tenantId: context.tenantId,
        caseId: protocolizationCase.caseId,
        profile: protocolizationCase.profile,
      },
    );
  }
}

/** The clock must produce Protocol's canonical instant, or nothing is stamped. */
export function readEvaluationInstant(
  context: ProtocolizationCaseContext,
  protocolizationCase: ProtocolizationCase,
): string {
  const instant = context.clock.now();
  if (!isValidUtcDateTime(instant)) {
    fail(
      PROTOCOLIZATION_READINESS_ERROR_CODES.invalidTimestamp,
      'The injected clock did not return a canonical UtcDateTime',
      { tenantId: protocolizationCase.tenantId, caseId: protocolizationCase.caseId },
    );
  }
  return instant;
}

/**
 * Drops records bound to a case revision the case has not reached.
 *
 * A record can only describe a state the case actually passed through, so a
 * receipt claiming revision `40` on a case at revision `12` describes nothing
 * this evaluation is looking at. It is filtered rather than refused, matching
 * APV-08's own basis filtering: the record may be perfectly legitimate and
 * simply belong to a future the evaluation has not reached.
 */
export function withinEvaluatedRevision(recordRevision: number, evaluatedRevision: number): boolean {
  return Number.isInteger(recordRevision) && recordRevision <= evaluatedRevision;
}

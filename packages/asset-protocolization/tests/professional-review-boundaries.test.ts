import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The APV-08 boundary test.
 *
 * Same method as APV-03's, APV-04's, APV-05's, APV-06's and APV-07's, extended
 * to the properties the professional attestation workflow has to hold: it must
 * not duplicate Protocol's attestation, credential or principal substrate, must
 * not widen a Protocol enum with its workflow actions, must not know what
 * profession or jurisdiction it is dealing with, must not invent cryptography,
 * must not acquire infrastructure or a user interface, and must not start
 * APV-09 or APV-10. It asserts over this package's source and modifies nothing
 * in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const attestationRoot = join(sourceRoot, 'attestation');

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const sources = (root: string): readonly { readonly file: string; readonly source: string }[] =>
  collectTypeScriptFiles(root).map((path) => ({
    file: relative(packageRoot, path),
    source: readFileSync(path, 'utf8'),
  }));

const readImports = (source: string): readonly string[] => {
  const specifiers: string[] = [];
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
};

describe('professional attestation workflow boundaries', () => {
  it('defines no parallel Attestation, Credential, Principal, Claim or Proof substrate', () => {
    const duplicates = sources(attestationRoot).flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum|const)\s+(Attestation|AttestationType|CanonicalAttestation|CanonicalAttestationId|CanonicalAttester|APVAttestation|VerticalAttestation|Credential|CredentialType|CredentialStatus|CanonicalCredential|CanonicalCredentialRef|Principal|PrincipalKind|CanonicalPrincipalRef|Claim|ClaimType|CanonicalClaim|CanonicalClaimId|Assertion|CanonicalAssertionId|Evidence|EvidenceType|CanonicalEvidence|CanonicalEvidenceId|Verification|VerificationStatus|CanonicalVerification|CanonicalVerificationId|Proof|ProofType|CanonicalProofRef|Signature|CanonicalSignatureProof|ContentIdentity|ResourceRef|SubjectRef|SovereignSubjectRef|SovereignExternalReference|CanonicalRegistryEntryRef|CanonicalReferenceSource)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  it('reuses Protocol’s attestation, credential and identity primitives by importing them', () => {
    const attestationSources = sources(attestationRoot)
      .map(({ source }) => source)
      .join('\n');

    // Guard the guard: the duplicate-definition test above would pass trivially
    // if the attestation layer referenced Protocol's vocabulary not at all.
    for (const symbol of [
      'CanonicalAttestation',
      'CanonicalAttestationId',
      'AttestationType',
      'CanonicalCredentialRef',
      'CredentialType',
      'CanonicalPrincipalRef',
      'PrincipalKind',
      'CanonicalClaimId',
      'CanonicalProofRef',
      'ProofType',
      'SovereignSubjectRef',
      'AdapterResult',
      'ProtocolError',
      'UtcDateTime',
    ]) {
      expect(attestationSources).toMatch(new RegExp(`\\b${symbol}\\b`));
    }
    expect(attestationSources).toContain("from '@aoc/protocol/claims'");
    expect(attestationSources).toContain("from '@aoc/protocol/identity'");
  });

  it('never widens a Protocol enum with a vertical review action', () => {
    const protocolRoot = join(packageRoot, '..', 'protocol', 'src');
    const protocolSources = sources(protocolRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    // Word-bounded: `Attestation` is Protocol's and stays; the *action*
    // `Attest` must appear nowhere in it.
    for (const action of ['Attest', 'RequestMoreEvidence', 'Abstain', 'ProfessionalReview']) {
      expect(protocolSources).not.toMatch(new RegExp(`\\b${action}\\b`));
    }
    // `AttestationType` still holds exactly what it held.
    const enums = readFileSync(join(protocolRoot, 'claims', 'claim-enums.ts'), 'utf8');
    expect(enums).toContain('export const AttestationType');
    for (const member of ['Human', 'Organization', 'System', 'AI', 'Remote', 'Governance']) {
      expect(enums).toContain(`${member}: '${member}'`);
    }
    expect(enums).toContain("Pending: 'Pending'");
    expect(enums).toContain("Verified: 'Verified'");
    expect(enums).toContain("Failed: 'Failed'");
  });

  it('leaves Protocol’s CanonicalAttestation shape untouched', () => {
    const attestation = readFileSync(
      join(packageRoot, '..', 'protocol', 'src', 'claims', 'attestation.ts'),
      'utf8',
    );

    // The record still carries exactly what it carried.
    for (const field of ['id', 'type', 'attester', 'claimRef', 'statement', 'issuedAt']) {
      expect(attestation).toContain(`readonly ${field}`);
    }
    expect(attestation).not.toContain('action');
    expect(attestation).not.toContain('reviewBasisRevision');
    expect(attestation).not.toContain('requirementId');
    expect(attestation).not.toContain('scope');
  });

  it('adds no Protocol change: the review workflow lives entirely in the vertical', () => {
    const protocolRoot = join(packageRoot, '..', 'protocol', 'src');
    const protocolSources = sources(protocolRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    for (const token of [
      'ProfessionalReviewRequest',
      'ProfessionalReviewDecision',
      'ProfessionalReviewPacket',
      'ProfessionalReviewAction',
      'AttestationSigner',
      'ProtocolizationCase',
      'AssetProfile',
      'reviewBasisRevision',
    ]) {
      expect(protocolSources).not.toContain(token);
    }
  });

  it('references Protocol only through its declared subpaths', () => {
    const specifiers = sources(attestationRoot).flatMap(({ source }) => readImports(source));
    const protocolSubpaths = new Set(
      specifiers.filter((specifier) => specifier.startsWith('@aoc/protocol')),
    );

    expect([...protocolSubpaths].sort()).toEqual([
      '@aoc/protocol/adapters',
      '@aoc/protocol/claims',
      '@aoc/protocol/contracts',
      '@aoc/protocol/errors',
      '@aoc/protocol/identity',
    ]);
  });

  it('imports nothing outside @aoc/protocol subpaths and relative modules', () => {
    const foreign = sources(attestationRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('@aoc/protocol'))
        .map((specifier) => `${file}: ${specifier}`),
    );

    // Not even a Node built-in: this is pure domain and reads no file.
    expect(foreign).toEqual([]);
  });

  it('depends on no Enterprise, runtime, monetization, tokenizer, UI or storage module', () => {
    const forbidden = sources(attestationRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) =>
          /^@aoc-runtime\/|^@aoc\/(?!protocol)|(?:^|\/)(?:enterprise|runtime|monetization|governance|tokenizer|frontend|react|next|supabase|prisma|redis|database|persistence|s3|ipfs|pinata|arweave|filecoin)(?:\/|$)/.test(
            specifier,
          ),
        )
        .map((specifier) => `${file}: ${specifier}`),
    );

    expect(forbidden).toEqual([]);
  });

  // ARCHITECTURE PROOF V — no professional role branching
  it('branches on no profession, jurisdiction, asset category or role token', () => {
    const branching = sources(attestationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bswitch\s*\(\s*[^)]*\b(assetCategory|profileId|assetType|category|role|jurisdiction|subjectKind|credentialType)\b/g,
      )) {
        found.push(`${file}: switch on ${match[1]}`);
      }
      for (const match of code.matchAll(
        /\b(assetCategory|assetType|profileId|role|jurisdictionCode)\s*(?:===|!==|==|!=)\s*['"][^'"]*['"]/g,
      )) {
        found.push(`${file}: compares ${match[1]} to a literal`);
      }
      // An opaque role token is never parsed, matched or folded.
      for (const match of code.matchAll(
        /\bacceptedRoles\b[^;\n]*\.(includes|some|find|indexOf)\s*\(/g,
      )) {
        found.push(`${file}: matches acceptedRoles with ${match[1]}`);
      }
      return found;
    });

    expect(branching).toEqual([]);
  });

  it('reads no clock of its own, so every instant comes from the injected port', () => {
    const clockReads = sources(attestationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      // `Date.parse(value)` is arithmetic over a supplied instant, not a clock
      // read; an argument-less construction or `Date.now()` is a clock read.
      for (const match of code.matchAll(/\bDate\s*\.\s*now\s*\(/g)) {
        found.push(`${file}: Date.now() at ${match.index ?? 0}`);
      }
      for (const match of code.matchAll(/\bnew\s+Date\s*\(\s*\)/g)) {
        found.push(`${file}: new Date() at ${match.index ?? 0}`);
      }
      for (const match of code.matchAll(/\bMath\s*\.\s*random\s*\(/g)) {
        found.push(`${file}: Math.random() at ${match.index ?? 0}`);
      }
      for (const match of code.matchAll(/\brandomUUID\s*\(/g)) {
        found.push(`${file}: randomUUID() at ${match.index ?? 0}`);
      }
      return found;
    });

    expect(clockReads).toEqual([]);
  });

  // §64 — no fake signatures, no invented cryptography
  it('performs no cryptography, mints no identifier and constructs no adapter', () => {
    const violations = sources(attestationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bnew\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider|Client|Connector|Signer))\s*\(/g,
      )) {
        found.push(`${file}: new ${match[1]}()`);
      }
      for (const pattern of [
        /\bfetch\s*\(/g,
        /\bXMLHttpRequest\b/g,
        /\brequire\s*\(/g,
        /\breadFile/g,
        /\bwriteFile/g,
        /\bcreateHash\s*\(/g,
        /\bcreateSign\s*\(/g,
        /\bcreateVerify\s*\(/g,
        /\bgenerateKeyPair/g,
        /\bprivateKey\b/g,
        /\bsecretKey\b/g,
        /\bfrom\s*\(\s*[^)]*,\s*['"]base64['"]/g,
        /\btoString\s*\(\s*['"](?:base64|hex)['"]\s*\)/g,
        /\bmint[A-Za-z]*\s*\(/g,
      ]) {
        for (const match of code.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
      }
      return found;
    });

    // A proof reference comes from an injected port or from the caller. It is
    // never derived from the object, the reviewer id or a credential id.
    expect(violations).toEqual([]);
  });

  it('declares no truth, readiness, authority or legal vocabulary', () => {
    const forbiddenIdentifiers = [
      'isTrue',
      'isVerified',
      'isReady',
      'isApproved',
      'isAuthorized',
      'isAuthoritative',
      'markVerified',
      'markAttested',
      'setReady',
      'caseVerdict',
      'overallOutcome',
      'aggregateOutcome',
      'confidenceScore',
      'professionalStanding',
      'ownershipEstablished',
      'authorityVerified',
      'legalOwner',
      'validTitle',
      'registeredOwner',
      'lawfulRepresentative',
      'licensedProfessional',
      'transferable',
      'tokenizable',
      'enforceable',
    ];

    const hits = sources(attestationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return forbiddenIdentifiers
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);
  });

  // §125 / §129 — no APV-09 and no APV-10
  it('contains no APV-09 state, no APV-10 execution and no readiness evaluation', () => {
    const forbiddenIdentifiers = [
      'EvidencePending',
      'VerificationPending',
      'ReviewPending',
      'MoreEvidenceRequired',
      'CaseReady',
      'ReadinessEvaluation',
      'evaluateReadiness',
      'transitionCase',
      'ProtocolizationResult',
      'protocolizeCase',
      'finalizeProtocolization',
      'governedResource',
      'anchorManifest',
    ];

    const hits = sources(attestationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return forbiddenIdentifiers
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);

    // No case state is added anywhere in the package either.
    const stateSource = readFileSync(join(sourceRoot, 'case', 'case-state.ts'), 'utf8');
    expect(stateSource).toContain("Draft: 'Draft'");
    expect(stateSource).toContain("Active: 'Active'");
    expect(stateSource).toContain("Cancelled: 'Cancelled'");
    for (const forbidden of ['Ready', 'Rejected', 'MoreEvidenceRequired', 'Protocolized']) {
      expect(stateSource).not.toContain(`${forbidden}: '${forbidden}'`);
    }
  });

  // ARCHITECTURE PROOF Y / §123 / §131 / §132 / §133
  it('contains no profession, jurisdiction, asset-class, tokenization, payment or UI vocabulary', () => {
    const forbiddenTerms = [
      'notary',
      'notarial',
      'lawyer',
      'attorney',
      'solicitor',
      'architect',
      'accountant',
      'surveyor',
      'appraiser',
      'registro nacional',
      'costa rica',
      'finca',
      'real estate',
      'realestate',
      'deed',
      'title deed',
      'vehicle',
      'artwork',
      'painting',
      'tokenize',
      'tokenization',
      'erc-20',
      'erc20',
      'erc-3643',
      'smart contract',
      'blockchain',
      'wallet',
      'custody',
      'nft',
      'stripe',
      'billing',
      'settlement',
      'payout',
      'invoice',
      'dashboard',
      'inbox',
      'workbench',
      'work queue',
      'assignment queue',
      'notification',
      'upload',
      'bucket',
    ];

    const hits = sources(attestationRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  // §73 / §133 — no workbench, no assignment engine
  it('builds no reviewer assignment, queueing or notification machinery', () => {
    const forbiddenIdentifiers = [
      'assignReviewer',
      'reviewQueue',
      'reviewerInbox',
      'reviewerQueue',
      'workloadBalance',
      'notifyReviewer',
      'scheduleReview',
      'reviewerSession',
      'marketplace',
    ];

    const hits = sources(attestationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return forbiddenIdentifiers
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);
  });

  it('declares no concrete product profile id and no closed role or reason vocabulary', () => {
    const productProfilePattern = /\b(?:digital\.artifact|realestate|artwork|vehicle)\.v\d+\b/i;
    const hits = sources(sourceRoot)
      .filter(({ source }) => productProfilePattern.test(stripComments(source)))
      .map(({ file }) => file);

    expect(hits).toEqual([]);

    // A role token and a reason code are opaque dotted tokens: no enum, const
    // map or union of either exists anywhere in production code.
    const vocabulary = sources(sourceRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:const|enum|interface)\s+(ProfessionalRole|ReviewerRole|ProfessionalRoles|ReviewReasonCodes|PROFESSIONAL_REVIEW_REASON_CODES|AttestationScopeKind)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(vocabulary).toEqual([]);
  });

  it('reuses APV-03’s, APV-04’s and APV-05’s identifiers rather than respelling them', () => {
    const attestationSources = sources(attestationRoot)
      .map(({ source }) => source)
      .join('\n');

    for (const symbol of [
      'AssetRequirementId',
      'ProtocolizationCaseId',
      'ProtocolizationTenantId',
      'ProtocolizationProfileRef',
      'ProtocolizationMaterialId',
      'EvidenceIntakeCategoryId',
      'VerificationExecutionId',
    ]) {
      expect(attestationSources).toMatch(new RegExp(`\\b${symbol}\\b`));
    }

    const redeclarations = sources(attestationRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:export\s+)?type\s+(AssetRequirementId|ProtocolizationCaseId|ProtocolizationTenantId|ProtocolizationMaterialId|EvidenceIntakeCategoryId|VerificationExecutionId|VerificationCheckOutcome)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );
    expect(redeclarations).toEqual([]);
  });

  it('keeps the package dependency envelope unchanged', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

    // The envelope is the invariant this test names: exactly one dependency, on Protocol, pinned
    // exactly rather than by range. The version *literal* is owned by Changesets and moves on every
    // release cut, so it is read from the workspace instead of frozen here.
    const protocolVersion = JSON.parse(
      readFileSync(join(packageRoot, '..', 'protocol', 'package.json'), 'utf8'),
    ).version;

    expect(Object.keys(manifest.dependencies)).toEqual(['@aoc/protocol']);
    expect(manifest.dependencies['@aoc/protocol']).toBe(protocolVersion);
    expect(manifest.dependencies['@aoc/protocol']).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    expect(manifest.devDependencies).toBeUndefined();
    expect(Object.keys(manifest.exports)).toEqual(['.']);
  });

  it('exports the review slice from the single package entry point, and nothing internal', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    expect(facade).toContain("from './attestation/review-operations'");
    expect(facade).toContain("from './attestation/review-repository'");
    expect(facade).toContain("from './attestation/attestation-preparation'");
    expect(facade).toContain("from './attestation/attestation-signer'");

    // Internal helpers stay internal.
    for (const internal of [
      'deepFreeze',
      'case-freeze',
      'isDottedToken',
      'isProtocolizationInstanceIdentifier',
      'compareProfessionalReviewRequests',
      'compareProfessionalReviewDecisions',
      'isUsablePrincipalRef',
      'isUsableCredentialRef',
      'isUsableProofRef',
      'selectResultsForBasis',
      'projectParticipants',
      'projectExceptions',
    ]) {
      expect(facade).not.toContain(internal);
    }
  });

  it('ships no signer implementation and no test adapter in production code', () => {
    const code = sources(attestationRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    // The port is declared; nothing implements it here.
    expect(code).toContain('interface AttestationSigner');
    for (const forbidden of [
      'createInMemoryAttestationSigner',
      'createTestAttestationSigner',
      'KMS',
      'HSM',
      'testSigner',
    ]) {
      expect(code).not.toContain(forbidden);
    }

    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');
    expect(facade).not.toContain('createTestAttestationSigner');
  });
});

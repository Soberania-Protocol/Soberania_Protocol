import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The APV-07 boundary test.
 *
 * Same method as APV-03's, APV-04's, APV-05's and APV-06's, extended to the
 * properties the verification pipeline has to hold: it must not duplicate
 * Protocol's verification substrate, must not widen Protocol's
 * `VerificationStatus`, must not know what kind of asset it is checking, must
 * not acquire infrastructure, must not reach a legal conclusion, and must not
 * start APV-08, APV-09 or APV-10. It asserts over this package's source and
 * modifies nothing in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const verificationRoot = join(sourceRoot, 'verification');

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

describe('verification pipeline boundaries', () => {
  it('defines no parallel Verification, Claim, Evidence or identity substrate', () => {
    const duplicates = sources(verificationRoot).flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum|const)\s+(Verification|VerificationStatus|CanonicalVerification|CanonicalVerificationId|APVVerification|VerticalVerification|Claim|ClaimType|CanonicalClaim|CanonicalClaimId|Assertion|CanonicalAssertionId|Evidence|EvidenceType|CanonicalEvidence|CanonicalEvidenceId|Attestation|CanonicalAttestation|Credential|CanonicalCredentialRef|Proof|CanonicalProofRef|Principal|CanonicalPrincipalRef|PrincipalKind|ContentIdentity|ContentDigestAlgorithm|ResourceRef|SubjectRef|SovereignSubjectRef|SovereignExternalReference|CanonicalRegistryRef|CanonicalRegistryEntryRef|CanonicalRegistryLookupResult|CanonicalReferenceSource)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  it('reuses Protocol’s verification and identity primitives by importing them', () => {
    const verificationSources = sources(verificationRoot)
      .map(({ source }) => source)
      .join('\n');

    // Guard the guard: the duplicate-definition test above would pass trivially
    // if the verification layer referenced Protocol's vocabulary not at all.
    for (const symbol of [
      'CanonicalVerificationId',
      'CanonicalClaim',
      'CanonicalClaimId',
      'CanonicalPrincipalRef',
      'CanonicalRegistryEntryRef',
      'ContentIdentity',
      'SovereignSubjectRef',
      'AdapterResult',
      'ProtocolError',
      'UtcDateTime',
    ]) {
      expect(verificationSources).toMatch(new RegExp(`\\b${symbol}\\b`));
    }
    expect(verificationSources).toContain("from '@aoc/protocol/claims'");
    expect(verificationSources).toContain("from '@aoc/protocol/identity'");
  });

  it('never widens, renames or reinterprets Protocol’s VerificationStatus', () => {
    const code = sources(verificationRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    // It is not imported, not extended, not re-exported and not compared to.
    expect(code).not.toContain('VerificationStatus');
    for (const forbidden of [
      'VerificationStatus.Pass',
      'VerificationStatus.Warning',
      'VerificationStatus.ManualReview',
      'VerificationStatus.Unavailable',
      'VerificationStatus.Verified',
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('mints no CanonicalVerification and constructs no Protocol record', () => {
    const code = sources(verificationRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    // A canonical verification needs an id, an assertion-bearing claim, a
    // verifier, a status, an instant and findings. None of those is ever built
    // here: `canonicalVerificationRef` is carried when an executor legitimately
    // has one, and is absent otherwise.
    for (const pattern of [
      /\bmint[A-Za-z]*\s*\(/,
      /\brandomUUID\s*\(/,
      /\bverifier\s*:/,
      /\bverifiedAt\s*:/,
      /\bfindings\s*:/,
      /\bassertionRef\s*:/,
      /\bissuedAt\s*:/,
      /\bstatus\s*:\s*['"]Verified['"]/,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('references Protocol only through its declared subpaths', () => {
    const specifiers = sources(verificationRoot).flatMap(({ source }) => readImports(source));
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
    const foreign = sources(verificationRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('@aoc/protocol'))
        .map((specifier) => `${file}: ${specifier}`),
    );

    // Not even a Node built-in: this is pure domain and reads no file.
    expect(foreign).toEqual([]);
  });

  it('depends on no Enterprise, runtime, monetization, tokenizer or storage module', () => {
    const forbidden = sources(verificationRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) =>
          /^@aoc-runtime\/|^@aoc\/(?!protocol)|(?:^|\/)(?:enterprise|runtime|monetization|governance|tokenizer|frontend|supabase|prisma|redis|database|persistence|s3|ipfs|pinata|arweave|filecoin)(?:\/|$)/.test(
            specifier,
          ),
        )
        .map((specifier) => `${file}: ${specifier}`),
    );

    expect(forbidden).toEqual([]);
  });

  it('branches on no asset category, profile id, subject shape or check-id spelling', () => {
    const branching = sources(verificationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bswitch\s*\(\s*[^)]*\b(assetCategory|profileId|assetType|category|checkId|subjectKind)\b/g,
      )) {
        found.push(`${file}: switch on ${match[1]}`);
      }
      for (const match of code.matchAll(
        /\b(assetCategory|assetType|profileId)\s*(?:===|!==|==|!=)\s*['"][^'"]*['"]/g,
      )) {
        found.push(`${file}: compares ${match[1]} to a literal`);
      }
      // A check id is resolved through the registry and never inspected for
      // meaning: no prefix, suffix or substring test anywhere.
      for (const match of code.matchAll(
        /\bcheckId\s*\.\s*(startsWith|endsWith|includes|match|split|toLowerCase|replace)\s*\(/g,
      )) {
        found.push(`${file}: parses checkId with ${match[1]}`);
      }
      return found;
    });

    expect(branching).toEqual([]);
  });

  it('reads no clock of its own, so every instant comes from the injected port', () => {
    const clockReads = sources(verificationRoot).flatMap(({ file, source }) => {
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
      return found;
    });

    expect(clockReads).toEqual([]);
  });

  it('performs no I/O and constructs no runtime, adapter, client or provider', () => {
    const violations = sources(verificationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bnew\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider|Client|Connector))\s*\(/g,
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
      ]) {
        for (const match of code.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
      }
      return found;
    });

    // Digest comparison goes through Protocol's `verifyContentIdentity`; no
    // hashing, signature format, key model or proof format is invented here.
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
      'setReady',
      'caseVerdict',
      'overallOutcome',
      'aggregateOutcome',
      'confidenceScore',
      'ownershipEstablished',
      'authorityVerified',
      'legalOwner',
      'validTitle',
      'registeredOwner',
      'lawfulRepresentative',
      'transferable',
      'tokenizable',
      'enforceable',
    ];

    const hits = sources(verificationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return forbiddenIdentifiers
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);
  });

  it('contains no APV-08, APV-09 or APV-10 concept', () => {
    const forbiddenIdentifiers = [
      'assignReviewer',
      'reviewerId',
      'reviewQueue',
      'createAttestation',
      'attestationDecision',
      'ProfessionalReview',
      'CaseReady',
      'ReadinessEvaluation',
      'ProtocolizationResult',
      'protocolizeCase',
      'finalizeProtocolization',
      'governedResource',
    ];

    const hits = sources(verificationRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return forbiddenIdentifiers
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);
  });

  it('contains no asset-class, jurisdiction, tokenization or payment vocabulary', () => {
    const forbiddenTerms = [
      'tokenize',
      'tokenization',
      'erc-20',
      'erc20',
      'erc-3643',
      'smart contract',
      'blockchain',
      'registro nacional',
      'costa rica',
      'finca',
      'notary',
      'notarial',
      'real estate',
      'realestate',
      'vehicle',
      'artwork',
      'painting',
      'song',
      'spotify',
      'stripe',
      'billing',
      'settlement',
      'payout',
      'invoice',
      'upload',
      'multipart',
      'presigned',
      'bucket',
    ];

    const hits = sources(verificationRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  it('declares no concrete product profile id and no closed check vocabulary', () => {
    const productProfilePattern = /\b(?:digital\.artifact|realestate|artwork|vehicle)\.v\d+\b/i;
    const hits = sources(sourceRoot)
      .filter(({ source }) => productProfilePattern.test(stripComments(source)))
      .map(({ file }) => file);

    expect(hits).toEqual([]);

    // A check id is an opaque dotted token: no `VerificationCheckId` enum,
    // const map or union exists anywhere in production code. The built-in
    // library is a *list of implementations*, not a vocabulary a profile must
    // choose from.
    const checkVocabulary = sources(sourceRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:const|enum|interface)\s+(VerificationCheckId|CheckId|CheckKind|VerificationCheckKind|VerificationReasonCodes)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(checkVocabulary).toEqual([]);
  });

  it('reuses APV-03’s AssetVerificationCheckId rather than respelling it', () => {
    const verificationSources = sources(verificationRoot)
      .map(({ source }) => source)
      .join('\n');

    expect(verificationSources).toContain('AssetVerificationCheckId');
    // Declared once, by APV-03, and imported here.
    const redeclarations = sources(verificationRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:export\s+)?type\s+(AssetVerificationCheckId)\b/g,
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

  it('exports the verification slice from the single package entry point, and nothing internal', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    expect(facade).toContain("from './verification/verification-operations'");
    expect(facade).toContain("from './verification/verification-repository'");
    expect(facade).toContain("from './verification/verification-check-registry'");

    // Internal helpers stay internal: the freeze helper, the grammar predicates
    // this slice reuses from APV-03/APV-04, the ordering comparator and the
    // built-in checks' private plumbing.
    for (const internal of [
      'deepFreeze',
      'case-freeze',
      'isDottedToken',
      'isProtocolizationInstanceIdentifier',
      'compareVerificationResults',
      'OUTCOME_PRECEDENCE',
      'strongest',
      'declarantKey',
      'registryEntryConforms',
    ]) {
      expect(facade).not.toContain(internal);
    }
  });

  it('exports no test-only check', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    for (const testOnly of ['test.check', 'testPassCheck', 'testFailCheck', 'TEST_VERIFICATION']) {
      expect(facade).not.toContain(testOnly);
    }
    const productionCode = sources(sourceRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');
    expect(productionCode).not.toContain("'test.check");
  });

  it('adds no Protocol change: the verification pipeline lives entirely in the vertical', () => {
    const protocolRoot = join(packageRoot, '..', 'protocol', 'src');
    const protocolSources = sources(protocolRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    for (const token of [
      'ProtocolizationVerification',
      'VerificationCheckOutcome',
      'VerificationCheckRegistry',
      'AssetVerificationCheck',
      'VerificationExecutionId',
      'VerificationResultRepository',
      'ProtocolizationCase',
      'AssetProfile',
      'ManualReview',
    ]) {
      expect(protocolSources).not.toContain(token);
    }
  });

  it('leaves Protocol’s CanonicalVerification shape untouched', () => {
    const verification = readFileSync(
      join(packageRoot, '..', 'protocol', 'src', 'claims', 'verification.ts'),
      'utf8',
    );

    // The record still carries exactly what it carried: a claim reference, a
    // Protocol status, a verifier, an instant and findings. APV-07 added no
    // field to it and removed none.
    for (const field of ['claimRef', 'status', 'verifier', 'verifiedAt', 'findings']) {
      expect(verification).toContain(`readonly ${field}`);
    }
    expect(verification).not.toContain('outcome');
    expect(verification).not.toContain('checkId');
    expect(verification).not.toContain('requirementId');
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The APV-06 boundary test.
 *
 * Same method as APV-03's, APV-04's and APV-05's, extended to the properties
 * the declaration layer has to hold: it must not duplicate Protocol's claim or
 * assertion substrate, must not know what kind of thing is being asserted, must
 * not decide that anything asserted is true, must not reach outside the
 * vertical, and must not acquire infrastructure. It asserts over this package's
 * source and modifies nothing in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const declarationsRoot = join(sourceRoot, 'declarations');

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

describe('declaration layer boundaries', () => {
  it('defines no parallel Claim, Assertion or Evidence substrate', () => {
    const duplicates = sources(declarationsRoot).flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum|const)\s+(Claim|ClaimType|CanonicalClaim|CanonicalClaimId|APVClaim|VerticalClaim|Assertion|CanonicalAssertion|CanonicalAssertionId|Evidence|EvidenceType|CanonicalEvidence|CanonicalEvidenceId|Attestation|CanonicalAttestation|Verification|CanonicalVerification|Credential|CanonicalCredentialRef|Proof|CanonicalProofRef|Principal|CanonicalPrincipalRef|PrincipalKind|ContentIdentity|ResourceRef|SubjectRef|SovereignSubjectRef|SovereignExternalReference|CanonicalRegistryEntryRef|CanonicalReferenceSource)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  it('reuses Protocol’s claim and principal primitives by importing them', () => {
    const declarationSources = sources(declarationsRoot)
      .map(({ source }) => source)
      .join('\n');

    // Guard the guard: the duplicate-definition test above would pass trivially
    // if the declaration layer referenced Protocol's vocabulary not at all.
    for (const symbol of [
      'CanonicalClaim',
      'CanonicalClaimId',
      'ClaimType',
      'CanonicalPrincipalRef',
      'PrincipalKind',
      'CanonicalEvidenceId',
      'CanonicalReferenceSource',
    ]) {
      expect(declarationSources).toMatch(new RegExp(`\\b${symbol}\\b`));
    }
    expect(declarationSources).toContain("from '@aoc/protocol/claims'");
  });

  it('mints no canonical record identifier and constructs no Protocol record', () => {
    const code = sources(declarationsRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    // No claim, assertion or evidence document is ever built here: the two
    // pathways name one or receive one, and both discard it.
    for (const pattern of [
      /\bmint[A-Za-z]*\s*\(/,
      /\brandomUUID\s*\(/,
      /\bassertionRef\s*:/,
      /\bevidenceRefs\s*:/,
      /\battestationRefs\s*:/,
      /\bissuedAt\s*:/,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('references Protocol only through its declared subpaths', () => {
    const specifiers = sources(declarationsRoot).flatMap(({ source }) => readImports(source));
    const protocolSubpaths = new Set(
      specifiers.filter((specifier) => specifier.startsWith('@aoc/protocol')),
    );

    expect([...protocolSubpaths].sort()).toEqual([
      '@aoc/protocol/adapters',
      '@aoc/protocol/claims',
      '@aoc/protocol/contracts',
      '@aoc/protocol/errors',
    ]);
  });

  it('imports nothing outside @aoc/protocol subpaths and relative modules', () => {
    const foreign = sources(declarationsRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('@aoc/protocol'))
        .map((specifier) => `${file}: ${specifier}`),
    );

    // Not even a Node built-in: this is pure domain and reads no file.
    expect(foreign).toEqual([]);
  });

  it('depends on no Enterprise, runtime, monetization, tokenizer or storage module', () => {
    const forbidden = sources(declarationsRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) =>
          /^@aoc-runtime\/|^@aoc\/(?!protocol)|(?:^|\/)(?:enterprise|runtime|monetization|governance|tokenizer|frontend|supabase|prisma|redis|database|persistence|s3|ipfs|pinata)(?:\/|$)/.test(
            specifier,
          ),
        )
        .map((specifier) => `${file}: ${specifier}`),
    );

    expect(forbidden).toEqual([]);
  });

  it('branches on no asset category, profile id or claim subtype', () => {
    const branching = sources(declarationsRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bswitch\s*\(\s*[^)]*\b(assetCategory|profileId|assetType|claimSubtype|declarationKind|category)\b/g,
      )) {
        found.push(`${file}: switch on ${match[1]}`);
      }
      for (const match of code.matchAll(
        /\b(assetCategory|assetType|profileId|claimSubtype|declarationKind)\s*(?:===|!==|==|!=)\s*['"][^'"]*['"]/g,
      )) {
        found.push(`${file}: compares ${match[1]} to a literal`);
      }
      return found;
    });

    // A claim subtype is compared to *the profile's own* token and never to a
    // literal this package knows. Behaviour is driven by the profile, never by
    // which proposition family is being asserted.
    expect(branching).toEqual([]);
  });

  it('branches on no individual ClaimType member', () => {
    const code = sources(declarationsRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    // `ClaimType.Authorship`, `.Authorization`, `.Custom` and the rest are
    // carried and compared to what the profile asked for — never singled out.
    for (const member of [
      'Authorship',
      'Authorization',
      'Origin',
      'Derivation',
      'Identity',
      'Certification',
      'Custom',
    ]) {
      expect(code).not.toContain(`ClaimType.${member}`);
    }
  });

  it('reads no clock of its own', () => {
    const clockReads = sources(declarationsRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(/\bDate\s*\.\s*now\s*\(/g)) {
        found.push(`${file}: Date.now() at ${match.index ?? 0}`);
      }
      for (const match of code.matchAll(/\bnew\s+Date\s*\(\s*\)/g)) {
        found.push(`${file}: new Date() at ${match.index ?? 0}`);
      }
      return found;
    });

    expect(clockReads).toEqual([]);
  });

  it('performs no I/O and constructs no runtime, adapter or provider', () => {
    const violations = sources(declarationsRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bnew\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider|Client))\s*\(/g,
      )) {
        found.push(`${file}: new ${match[1]}()`);
      }
      for (const pattern of [
        /\bfetch\s*\(/g,
        /\bregistry\s*\.\s*resolve\s*\(/g,
        /\bresolveIdentity\s*\(/g,
        /\bverifySignature\s*\(/g,
        /\brequire\s*\(/g,
        /\breadFile/g,
        /\bwriteFile/g,
      ]) {
        for (const match of code.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
      }
      return found;
    });

    expect(violations).toEqual([]);
  });

  it('declares no truth, verification, authority or legal vocabulary', () => {
    const forbiddenIdentifiers = [
      'isTrue',
      'isVerified',
      'isApproved',
      'isAuthorized',
      'isAuthoritative',
      'claimProven',
      'claimConfirmed',
      'ownershipEstablished',
      'authorshipVerified',
      'authorityVerified',
      'delegationValid',
      'evidenceSupportsClaim',
      'legalOwner',
      'validTitle',
      'registeredOwner',
      'lawfulRepresentative',
      'authorizedSigner',
      'transferable',
      'registrable',
    ];

    const hits = sources(declarationsRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return forbiddenIdentifiers
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);
  });

  it('contains no verification-outcome, attestation or governance vocabulary', () => {
    const forbiddenTerms = [
      'manual_review',
      'unavailable',
      'attestationworkflow',
      'professional review',
      'request_more_evidence',
      'abstain',
      'delegation',
      'policy evaluation',
      'obligation',
      'approval workflow',
      'revocation',
    ];

    const hits = sources(declarationsRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
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
      'stripe',
      'billing',
      'settlement',
      'payout',
      'invoice',
      'upload',
      'multipart',
      'presigned',
    ];

    const hits = sources(declarationsRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  it('declares no concrete product profile id and no closed declaration vocabulary', () => {
    const productProfilePattern = /\b(?:digital\.artifact|realestate|artwork|vehicle)\.v\d+\b/i;
    const hits = sources(sourceRoot)
      .filter(({ source }) => productProfilePattern.test(stripComments(source)))
      .map(({ file }) => file);

    expect(hits).toEqual([]);

    // A declaration's machine semantics are `ClaimType` + the profile's own
    // `claimSubtype` token: no `DeclarationKind` enum, const map or union
    // exists anywhere in production code.
    const declarationVocabulary = sources(sourceRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:const|enum|interface)\s+(DeclarationKind|DeclarationKindId|DeclarationType|ClaimPreparationKind|ClaimPreparationKindId|PropositionKind)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(declarationVocabulary).toEqual([]);
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

  it('exports the declaration slice from the single package entry point, and nothing internal', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    expect(facade).toContain("from './declarations/declaration-operations'");
    expect(facade).toContain("from './declarations/declaration-repository'");

    // Internal helpers stay internal: the freeze helper, the grammar predicates
    // this slice reuses from APV-03/APV-04, the pathway key lookup, the payload
    // resolvers, the submission key list and the admission predicates on
    // Protocol types are all implementation detail.
    for (const internal of [
      'deepFreeze',
      'case-freeze',
      'isDottedToken',
      'isProtocolizationInstanceIdentifier',
      'declarationPathwayKeys',
      'submittedClaimRef',
      'submittedClaimType',
      'DECLARATION_SUBMISSION_BASE_KEYS',
      'isUsableDeclarantRef',
      'isUsableReferenceSource',
      'isAdmissibleCanonicalClaim',
      'isClaimType',
    ]) {
      expect(facade).not.toContain(internal);
    }
  });

  it('adds no Protocol change: the declaration layer lives entirely in the vertical', () => {
    const protocolRoot = join(packageRoot, '..', 'protocol', 'src');
    const protocolSources = sources(protocolRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    for (const token of [
      'ProtocolizationDeclaration',
      'DeclarationRepository',
      'DeclarationPathway',
      'EvidenceIntake',
      'ProtocolizationCase',
      'AssetProfile',
    ]) {
      expect(protocolSources).not.toContain(token);
    }
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The APV-09 boundary test.
 *
 * Same method as APV-03's through APV-08's, extended to the properties the
 * protocolization state machine has to hold: it must not reinterpret APV-04's
 * lifecycle, must not move a readiness concept into Protocol, must not branch on
 * an asset class or a profile id, must not re-run verification or reach an
 * external system, must not acquire persistence, and must not begin APV-10. It
 * asserts over this package's source and modifies nothing in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const stateMachineRoot = join(sourceRoot, 'state-machine');

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

describe('protocolization state machine boundaries', () => {
  it('defines no parallel Evidence, Claim, Attestation, Verification or identity substrate', () => {
    const duplicates = sources(stateMachineRoot).flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum|const)\s+(Evidence|EvidenceType|CanonicalEvidence|Claim|ClaimType|CanonicalClaim|Attestation|AttestationType|CanonicalAttestation|CanonicalAttester|Verification|VerificationStatus|CanonicalVerification|Credential|CredentialType|CanonicalCredentialRef|Principal|PrincipalKind|CanonicalPrincipalRef|Proof|ProofType|CanonicalProofRef|Signature|ContentIdentity|SovereignSubjectRef|SovereignExternalReference|CanonicalRegistryEntryRef)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  it('reuses the earlier slices’ own vocabulary rather than respelling it', () => {
    const stateMachineSources = sources(stateMachineRoot)
      .map(({ source }) => source)
      .join('\n');

    // Guard the guard: the duplicate-definition test would pass trivially if
    // this layer referenced nothing at all.
    for (const symbol of [
      'AssetRequirementKind',
      'AssetRequirementObligation',
      'AssetRequirementSatisfaction',
      'ProtocolizationCase',
      'ProtocolizationMaterialKind',
      'ProtocolizationRequirementMaterialStatus',
      'VerificationCheckOutcome',
      'ProfessionalReviewAction',
      'CanonicalAttestation',
      'CanonicalProofRef',
      'isUsableProofRef',
      'isVerificationResultCurrentForRevision',
      'listLatestVerificationResults',
    ]) {
      expect(stateMachineSources).toMatch(new RegExp(`\\b${symbol}\\b`));
    }
  });

  // §32 — APV-07's currentness rule is reused, never re-implemented.
  it('reuses APV-07’s own result-currency comparison instead of writing a second one', () => {
    const stateMachineSources = sources(stateMachineRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    expect(stateMachineSources).toContain('isVerificationResultCurrentForRevision');
    // No competing spelling of the comparison exists here.
    expect(stateMachineSources).not.toMatch(/function\s+isCurrent\b/);
    expect(stateMachineSources).not.toMatch(/function\s+isStale\b/);
  });

  it('references Protocol only through its declared subpaths', () => {
    const specifiers = sources(stateMachineRoot).flatMap(({ source }) => readImports(source));
    const protocolSubpaths = new Set(
      specifiers.filter((specifier) => specifier.startsWith('@aoc/protocol')),
    );

    expect([...protocolSubpaths].sort()).toEqual([
      '@aoc/protocol/claims',
      '@aoc/protocol/contracts',
      '@aoc/protocol/errors',
    ]);
  });

  it('imports nothing outside @aoc/protocol subpaths and relative modules', () => {
    const foreign = sources(stateMachineRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('@aoc/protocol'))
        .map((specifier) => `${file}: ${specifier}`),
    );

    // Not even a Node built-in: this is pure domain and reads no file.
    expect(foreign).toEqual([]);
  });

  it('depends on no Enterprise, runtime, monetization, tokenizer, UI or storage module', () => {
    const forbidden = sources(stateMachineRoot).flatMap(({ file, source }) =>
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

  // §105 / §182 HARD TEST — a generic engine, and nothing else.
  it('branches on no asset category, profile id, jurisdiction or asset-class token', () => {
    const branching = sources(stateMachineRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bswitch\s*\(\s*[^)]*\b(assetCategory|profileId|profileVersion|assetType|category|jurisdiction|subjectKind|role)\b/g,
      )) {
        found.push(`${file}: switch on ${match[1]}`);
      }
      for (const match of code.matchAll(
        /\b(assetCategory|assetType|profileId|profileVersion|role|jurisdictionCode)\s*(?:===|!==|==|!=)\s*['"][^'"]*['"]/g,
      )) {
        found.push(`${file}: compares ${match[1]} to a literal`);
      }
      return found;
    });

    expect(branching).toEqual([]);
  });

  // §106 — no concrete product profile anywhere in the package.
  it('declares no concrete product profile id', () => {
    const productProfilePattern = /\b(?:digital\.artifact|realestate|artwork|vehicle)\.v\d+\b/i;
    const hits = sources(sourceRoot)
      .filter(({ source }) => productProfilePattern.test(stripComments(source)))
      .map(({ file }) => file);

    expect(hits).toEqual([]);
  });

  // §19 / §30 / §102 / §113 — no hidden I/O, no re-execution, no cryptography.
  it('performs no I/O, runs no check and validates no signature', () => {
    const violations = sources(stateMachineRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bnew\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider|Client|Connector|Signer|Registry))\s*\(/g,
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
        /\bcreateVerify\s*\(/g,
        /\bexecute\s*\(\s*context/g,
        /\bresolvers?\s*\.\s*resolve/g,
        /\bregistry\s*\.\s*resolve\s*\(/g,
        /\bruleProtocolizationVerification\b/g,
        /\bexecuteProtocolizationVerificationCheck\b/g,
        /\brunProtocolizationVerification\b/g,
        /\brecordProfessionalReviewDecision\b/g,
        /\bintakeProtocolizationEvidence\b/g,
        /\brecordProtocolizationDeclaration\b/g,
      ]) {
        for (const match of code.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
      }
      return found;
    });

    expect(violations).toEqual([]);
  });

  // §123 — every instant comes from the injected port.
  it('reads no clock of its own and introduces no non-determinism', () => {
    const violations = sources(stateMachineRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const pattern of [
        /\bDate\s*\.\s*now\s*\(/g,
        /\bnew\s+Date\s*\(\s*\)/g,
        /\bMath\s*\.\s*random\s*\(/g,
        /\brandomUUID\s*\(/g,
      ]) {
        for (const match of code.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
      }
      return found;
    });

    expect(violations).toEqual([]);
  });

  // §41 — no scoring, no averaging, no majority.
  it('contains no score, weight, percentage or majority reduction', () => {
    const violations = sources(stateMachineRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return [
        'confidenceScore',
        'passRate',
        'percentage',
        'weightedOutcome',
        'majority',
        'quorum',
        'averageOutcome',
        'aggregateOutcome',
        'overallOutcome',
      ]
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`, 'i').test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(violations).toEqual([]);
  });

  // §55 / §115 / §181 HARD TEST — Protocol core is untouched.
  it('adds no Protocol change: readiness lives entirely in the vertical', () => {
    const protocolRoot = join(packageRoot, '..', 'protocol', 'src');
    const protocolSources = sources(protocolRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    for (const token of [
      'ProtocolizationReadiness',
      'ReadinessStatus',
      'ReadinessState',
      'ProtocolizationRequirementAssessment',
      'evaluateProtocolizationReadiness',
      'ProtocolReadiness',
      'EvidencePending',
      'VerificationPending',
      'ReviewPending',
      'MoreEvidenceRequired',
      'Protocolizing',
      'Protocolized',
      'ProtocolizationCase',
      'AssetProfile',
    ]) {
      expect(protocolSources).not.toContain(token);
    }

    // §115 — and Protocol's own asset state is exactly what it was. No readiness
    // member was added to it for this vertical's convenience.
    const manifestState = readFileSync(
      join(protocolRoot, 'manifest', 'state.ts'),
      'utf8',
    );
    expect(manifestState).toContain("Active: 'active'");
    expect(manifestState).toContain("Disputed: 'disputed'");
    expect(manifestState).toContain("Superseded: 'superseded'");
    expect(manifestState).toContain("Withdrawn: 'withdrawn'");
    for (const forbidden of ['ready', 'protocolized', 'pending', 'blocked']) {
      expect(manifestState.toLowerCase()).not.toContain(`: '${forbidden}'`);
    }
  });

  it('leaves APV-04’s lifecycle enum exactly as APV-04 froze it', () => {
    const stateSource = readFileSync(join(sourceRoot, 'case', 'case-state.ts'), 'utf8');

    expect(stateSource).toContain("Draft: 'Draft'");
    expect(stateSource).toContain("Active: 'Active'");
    expect(stateSource).toContain("Cancelled: 'Cancelled'");
    for (const forbidden of [
      'Ready',
      'Rejected',
      'Blocked',
      'MoreEvidenceRequired',
      'EvidencePending',
      'VerificationPending',
      'ReviewPending',
      'Protocolizing',
      'Protocolized',
      'Ineligible',
    ]) {
      expect(stateSource).not.toContain(`${forbidden}: '${forbidden}'`);
    }
    // And `MaterialPresent` still means what it meant.
    expect(stateSource).toContain("MaterialPresent: 'MaterialPresent'");
    expect(stateSource).not.toContain("Satisfied: 'Satisfied'");
  });

  // §108 / §109 / §178 HARD TEST — APV-10 is not begun.
  it('contains no APV-10 execution concept', () => {
    const hits = sources(stateMachineRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return [
        'protocolizeCase',
        'finalizeProtocolization',
        'ProtocolizationResult',
        'governedResource',
        'anchorManifest',
        'signManifest',
        'emitProtocolized',
        'TOKENIZE',
      ]
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);
  });

  // §110 – §113 — no Enterprise, tokenization, payment, registry or UI vocabulary.
  it('contains no governance, tokenization, payment, registry, legal or UI vocabulary', () => {
    const forbiddenTerms = [
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
      'registro nacional',
      'costa rica',
      'finca',
      'real estate',
      'realestate',
      'notary',
      'notarial',
      'lawyer',
      'attorney',
      'vehicle',
      'artwork',
      'painting',
      'dashboard',
      'workbench',
      'work queue',
      'notification',
      'upload',
      'bucket',
      'capability grant',
      'delegation',
      'approval chain',
      'revocation',
    ];

    const hits = sources(stateMachineRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  // §84 / §86 — no persistence and no event were introduced.
  it('introduces no repository, no persisted state and no domain event', () => {
    const hits = sources(stateMachineRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return [
        'Repository',
        'EVENT_TYPES',
        'EventType',
        'save',
        'persist',
        'store',
        'delete',
        'update',
      ]
        .filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(code))
        .map((identifier) => `${file}: ${identifier}`);
    });

    expect(hits).toEqual([]);
  });

  it('keeps the package dependency envelope unchanged', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

    expect(manifest.dependencies).toEqual({ '@aoc/protocol': '0.1.0' });
    expect(manifest.devDependencies).toBeUndefined();
    expect(Object.keys(manifest.exports)).toEqual(['.']);
  });

  // §116 — public API discipline.
  it('exports the readiness slice from the single package entry point, and nothing internal', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    expect(facade).toContain("from './state-machine/readiness-operations'");
    expect(facade).toContain("from './state-machine/readiness-projections'");
    expect(facade).toContain("from './state-machine/readiness-state'");

    // Internal helpers stay internal: the evaluators, the input validators, the
    // freeze helper and the private precedence constants.
    for (const internal of [
      'readiness-evaluators',
      'readiness-validation',
      'evaluateIdentityRequirement',
      'evaluateDeclarationRequirement',
      'evaluateEvidenceRequirement',
      'evaluateVerificationRequirement',
      'evaluateAttestationRequirement',
      'evaluateRequirement',
      'RequirementEvaluationContext',
      'RequirementFindings',
      'assertInputsBelongToCase',
      'resolvePinnedProfile',
      'AFFIRMATIVELY_BLOCKING',
      'QUALIFIES_SATISFACTION',
      'deepFreeze',
    ]) {
      expect(facade).not.toContain(internal);
    }
  });

  it('exports no test-only profile, requirement or check id', () => {
    const productionCode = sources(sourceRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    for (const testOnly of ['test.readiness', 'test.check', 'test.category', 'test.condition']) {
      expect(productionCode).not.toContain(testOnly);
    }
  });
});

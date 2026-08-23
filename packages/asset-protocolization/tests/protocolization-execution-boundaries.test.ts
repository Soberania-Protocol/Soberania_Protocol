import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The APV-10 boundary test.
 *
 * Same method as APV-03's through APV-09's, extended to the properties
 * protocolization execution has to hold: it must not re-implement readiness,
 * must not widen APV-04's lifecycle, must not move an execution concept into
 * Protocol, must not branch on an asset class or a profile id, must not reach an
 * external system, must not mint a Protocol record, and must not begin APV-11.
 * It asserts over this package's source and modifies nothing in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const executionRoot = join(sourceRoot, 'execution');

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

const executionCode = (): string =>
  sources(executionRoot)
    .map(({ source }) => stripComments(source))
    .join('\n');

describe('protocolization execution boundaries', () => {
  it('defines no parallel Evidence, Claim, Attestation, Verification or identity substrate', () => {
    const duplicates = sources(executionRoot).flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum|const)\s+(Evidence|EvidenceType|CanonicalEvidence|Claim|ClaimType|CanonicalClaim|Attestation|AttestationType|CanonicalAttestation|CanonicalAttester|Verification|VerificationStatus|CanonicalVerification|Credential|CredentialType|CanonicalCredentialRef|Principal|PrincipalKind|CanonicalPrincipalRef|Proof|ProofType|CanonicalProofRef|Signature|ContentIdentity|SovereignSubjectRef|SovereignExternalReference|SovereignManifestV1|SignedSovereignManifest|CanonicalRegistryEntryRef)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  // §7 / §10 / §45 — readiness is consumed, never re-implemented.
  it('reuses APV-09’s vocabulary and its own currency guard rather than respelling them', () => {
    const code = executionCode();

    for (const symbol of [
      'ProtocolizationReadinessEvaluation',
      'ProtocolizationReadinessState',
      'isProtocolizationReadinessCurrentForCase',
      'PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION',
      'ProtocolizationCase',
      'ProtocolizationMaterialKind',
      'protocolizationProfileRefsEqual',
      'validateProtocolizationCase',
    ]) {
      expect(code).toMatch(new RegExp(`\\b${symbol}\\b`));
    }

    // No second currency comparison, and no second readiness engine.
    for (const forbidden of [
      /function\s+isCurrent\b/,
      /function\s+isStale\b/,
      /function\s+deriveReadiness\b/,
      /\bevaluateProtocolizationReadiness\b/,
      /\bderiveProtocolizationReadinessState\b/,
      /\bevaluateRequirement\b/,
    ]) {
      expect(code).not.toMatch(forbidden);
    }

    // Nor any of the readiness inputs a re-evaluation would have to read.
    const redeclarations = sources(executionRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:export\s+)?(?:type|interface)\s+(ProtocolizationReadinessEvaluation|ProtocolizationReadinessInputs|ProtocolizationRequirementAssessment|ProtocolizationReadinessState|AssetRequirementId|ProtocolizationCaseId|ProtocolizationTenantId|ProtocolizationMaterialId|VerificationExecutionId|ProfessionalReviewDecisionId)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );
    expect(redeclarations).toEqual([]);
  });

  it('references Protocol only through its declared subpaths', () => {
    const specifiers = sources(executionRoot).flatMap(({ source }) => readImports(source));
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
    const foreign = sources(executionRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('@aoc/protocol'))
        .map((specifier) => `${file}: ${specifier}`),
    );

    // Not even a Node built-in: this is pure domain and reads no file.
    expect(foreign).toEqual([]);
  });

  it('depends on no Enterprise, runtime, monetization, tokenizer, UI or storage module', () => {
    const forbidden = sources(executionRoot).flatMap(({ file, source }) =>
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

  // §90 / §91 / §129 — a generic engine, and nothing else.
  it('branches on no asset category, profile id, jurisdiction or asset-class token', () => {
    const branching = sources(executionRoot).flatMap(({ file, source }) => {
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

  // §92 — no concrete product profile anywhere in the package.
  it('declares no concrete product profile id', () => {
    const productProfilePattern = /\b(?:digital\.artifact|realestate|artwork|vehicle)\.v\d+\b/i;
    const hits = sources(sourceRoot)
      .filter(({ source }) => productProfilePattern.test(stripComments(source)))
      .map(({ file }) => file);

    expect(hits).toEqual([]);
  });

  // §25 / §139 — no hidden I/O, no re-execution, no cryptography, no digest.
  it('performs no I/O, runs no check, computes no digest and validates no signature', () => {
    const violations = sources(executionRoot).flatMap(({ file, source }) => {
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
        /\bcanonicalizeJSON\s*\(/g,
        /\bcomputeManifestDigest\b/g,
        /\bsignSovereignManifest\b/g,
        /\bbuildSovereignManifestV1\b/g,
        /\bverifySovereignManifest\b/g,
        /\bmintSovereignAssetId\b/g,
        /\bresolvers?\s*\.\s*resolve/g,
        /\bregistry\s*\.\s*resolve\s*\(/g,
        /\brunProtocolizationVerification\b/g,
        /\brecordProfessionalReviewDecision\b/g,
        /\bintakeProtocolizationEvidence\b/g,
        /\brecordProtocolizationDeclaration\b/g,
        /\bprepareCanonicalAttestationFromReview\b/g,
      ]) {
        for (const match of code.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
      }
      return found;
    });

    expect(violations).toEqual([]);
  });

  // §37 / §131 — every instant comes from the injected port.
  it('reads no clock of its own and introduces no non-determinism', () => {
    const violations = sources(executionRoot).flatMap(({ file, source }) => {
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

  // §97 / §98 / §127 / §144.49 HARD TEST — Protocol core is untouched.
  it('adds no Protocol change: execution lives entirely in the vertical', () => {
    const protocolRoot = join(packageRoot, '..', 'protocol', 'src');
    const protocolSources = sources(protocolRoot)
      .map(({ source }) => stripComments(source))
      .join('\n');

    for (const token of [
      'ProtocolizationResult',
      'ProtocolizationResultId',
      'ProtocolizationExecution',
      'executeProtocolization',
      'ProtocolizedAsset',
      'SoberaniaAsset',
      'AssetProtocolizationRecord',
      'ProtocolizationReadiness',
      'Protocolizing',
      'Protocolized',
      'ProtocolizationCase',
      'AssetProfile',
    ]) {
      expect(protocolSources).not.toContain(token);
    }

    // Protocol's own asset state is exactly what it was. No execution member was
    // added to it for this vertical's convenience.
    const manifestState = readFileSync(join(protocolRoot, 'manifest', 'state.ts'), 'utf8');
    expect(manifestState).toContain("Active: 'active'");
    expect(manifestState).toContain("Disputed: 'disputed'");
    expect(manifestState).toContain("Superseded: 'superseded'");
    expect(manifestState).toContain("Withdrawn: 'withdrawn'");
    for (const forbidden of ['protocolized', 'executed', 'ready']) {
      expect(manifestState.toLowerCase()).not.toContain(`: '${forbidden}'`);
    }
  });

  // §23 / §37 / §126 HARD TEST — APV-04's lifecycle is exactly as APV-04 froze it.
  it('leaves APV-04’s lifecycle enum unwidened, with no Protocolizing or Protocolized', () => {
    const stateSource = readFileSync(join(sourceRoot, 'case', 'case-state.ts'), 'utf8');

    expect(stateSource).toContain("Draft: 'Draft'");
    expect(stateSource).toContain("Active: 'Active'");
    expect(stateSource).toContain("Cancelled: 'Cancelled'");
    for (const forbidden of [
      'Protocolizing',
      'Protocolized',
      'Executing',
      'Executed',
      'Complete',
      'Ready',
      'Finalized',
    ]) {
      expect(stateSource).not.toContain(`${forbidden}: '${forbidden}'`);
    }
    expect(stateSource).toContain("MaterialPresent: 'MaterialPresent'");
    expect(stateSource).not.toContain("Satisfied: 'Satisfied'");
  });

  // §24 — no execution status enum was invented for a workflow that has no phases.
  it('declares no execution status vocabulary', () => {
    const declarations = sources(executionRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:export\s+)?(?:const|enum|type)\s+(ProtocolizationExecutionStatus|ExecutionStatus|ExecutionState|ProtocolizationExecutionState|ProtocolizationPhase)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );
    expect(declarations).toEqual([]);
  });

  // §55 / §83 / §88 / §95 / §138 – §140 — no governance, tokenization, payment,
  // registry, legal or UI vocabulary.
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
      'mint(',
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
      'approval chain',
      'anchor',
      'contractaddress',
      'tokenid',
    ];

    const hits = sources(executionRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  // §22 — the domain operation holds no repository, and the port holds no
  // update or delete.
  it('keeps the domain operation free of persistence, and the port append-only', () => {
    const operations = readFileSync(join(executionRoot, 'execution-operations.ts'), 'utf8');
    const strippedOperations = stripComments(operations);
    for (const forbidden of ['Repository', 'repository.', 'store.', '.save(']) {
      expect(strippedOperations).not.toContain(forbidden);
    }

    const port = stripComments(readFileSync(join(executionRoot, 'execution-repository.ts'), 'utf8'));
    for (const forbidden of ['update(', 'delete(', 'remove(', 'purge(', 'listAll(', 'truncate(']) {
      expect(port).not.toContain(forbidden);
    }
  });

  // §92 / §93 — APV-11 and beyond are not begun.
  it('contains no APV-11 or later concept', () => {
    const hits = sources(executionRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      return [
        'digitalArtifact',
        'realEstateProfile',
        'ProfessionalWorkbench',
        'FeeSchedule',
        'TOKENIZE',
        'EnterpriseGrant',
        'governedResource',
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

  it('exports the execution slice from the single package entry point, and nothing internal', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    for (const module of [
      "from './execution/execution-identifiers'",
      "from './execution/protocolization-result'",
      "from './execution/execution-request'",
      "from './execution/execution-validation'",
      "from './execution/execution-events'",
      "from './execution/execution-operations'",
      "from './execution/execution-repository'",
      "from './execution/execution-projections'",
      "from './execution/execution-errors'",
    ]) {
      expect(facade).toContain(module);
    }

    // Internal helpers stay internal.
    for (const internal of [
      'deepFreeze',
      'case-freeze',
      'compareProtocolizationResults',
      'protocolizationMaterialRecordRef',
      'assertExecutingTenantOwnsCase',
      'assertCaseIsExecutable',
      'assertReadinessAuthorizesExecution',
      'assertExpectedRevision',
      'resolveExecutionProfile',
      'readExecutionInstant',
    ]) {
      expect(facade).not.toContain(internal);
    }
  });
});

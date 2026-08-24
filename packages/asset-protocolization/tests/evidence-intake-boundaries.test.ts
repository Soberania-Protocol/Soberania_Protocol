import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The APV-05 boundary test.
 *
 * Same method as APV-03's and APV-04's, extended to the properties the intake
 * layer has to hold: it must not duplicate Protocol's evidence substrate, must
 * not know what kind of thing it is receiving evidence about, must not reach
 * outside the vertical, and must not acquire infrastructure. It asserts over
 * this package's source and modifies nothing in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const evidenceRoot = join(sourceRoot, 'evidence');

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

describe('evidence intake boundaries', () => {
  it('defines no parallel Evidence substrate', () => {
    const duplicates = sources(evidenceRoot).flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum|const)\s+(Evidence|EvidenceType|CanonicalEvidence|CanonicalEvidenceId|APVEvidence|VerticalEvidence|Claim|CanonicalClaim|Attestation|CanonicalAttestation|Verification|CanonicalVerification|Credential|CanonicalCredentialRef|Proof|CanonicalProofRef|ContentIdentity|ResourceRef|SovereignSubjectRef|SovereignExternalReference|CanonicalRegistryRef|CanonicalRegistryEntryRef|CanonicalReferenceSource)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  it('reuses Protocol’s evidence primitives by importing them', () => {
    const evidenceSources = sources(evidenceRoot).map(({ source }) => source).join('\n');

    // Guard the guard: the duplicate-definition test above would pass trivially
    // if the intake layer referenced Protocol's evidence vocabulary not at all.
    for (const symbol of [
      'CanonicalEvidence',
      'CanonicalEvidenceId',
      'EvidenceType',
      'CanonicalReferenceSource',
    ]) {
      expect(evidenceSources).toMatch(new RegExp(`\\b${symbol}\\b`));
    }
    expect(evidenceSources).toContain("from '@aoc/protocol/claims'");
  });

  it('references Protocol only through its declared subpaths', () => {
    const specifiers = sources(evidenceRoot).flatMap(({ source }) => readImports(source));
    const protocolSubpaths = new Set(specifiers.filter((specifier) => specifier.startsWith('@aoc/protocol')));

    expect([...protocolSubpaths].sort()).toEqual([
      '@aoc/protocol/adapters',
      '@aoc/protocol/claims',
      '@aoc/protocol/contracts',
      '@aoc/protocol/errors',
    ]);
  });

  it('imports nothing outside @aoc/protocol subpaths and relative modules', () => {
    const foreign = sources(evidenceRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter(
          (specifier) =>
            !specifier.startsWith('.') && !specifier.startsWith('@aoc/protocol'),
        )
        .map((specifier) => `${file}: ${specifier}`),
    );

    // Not even a Node built-in: intake is pure domain and reads no file.
    expect(foreign).toEqual([]);
  });

  it('depends on no Enterprise, runtime, monetization, tokenizer or storage module', () => {
    const forbidden = sources(evidenceRoot).flatMap(({ file, source }) =>
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

  it('branches on no asset category, profile id or intake category', () => {
    const branching = sources(evidenceRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(
        /\bswitch\s*\(\s*[^)]*\b(assetCategory|profileId|assetType|categoryId|category)\b/g,
      )) {
        found.push(`${file}: switch on ${match[1]}`);
      }
      for (const match of code.matchAll(
        /\b(assetCategory|assetType|profileId|categoryId)\s*(?:===|!==|==|!=)\s*['"][^'"]*['"]/g,
      )) {
        found.push(`${file}: compares ${match[1]} to a literal`);
      }
      return found;
    });

    // A category id is recorded and never read. Behaviour is driven by the
    // profile and by generic evidence semantics, never by which source it
    // came from.
    expect(branching).toEqual([]);
  });

  it('reads no clock of its own', () => {
    const clockReads = sources(evidenceRoot).flatMap(({ file, source }) => {
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
    const violations = sources(evidenceRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(/\bnew\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider|Client))\s*\(/g)) {
        found.push(`${file}: new ${match[1]}()`);
      }
      for (const pattern of [
        /\bfetch\s*\(/g,
        /\bregistry\s*\.\s*resolve\s*\(/g,
        /\blookupRegistry\s*\(/g,
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

    const hits = sources(evidenceRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  it('declares no concrete product profile id and no closed category vocabulary', () => {
    const productProfilePattern = /\b(?:digital\.artifact|realestate|artwork|vehicle)\.v\d+\b/i;
    const hits = sources(sourceRoot)
      .filter(({ source }) => productProfilePattern.test(stripComments(source)))
      .map(({ file }) => file);

    expect(hits).toEqual([]);

    // The category identifier is an opaque token: no `EvidenceIntakeCategory`
    // enum, const map or union exists anywhere in production code.
    const categoryVocabulary = sources(sourceRoot).flatMap(({ file, source }) =>
      [
        ...stripComments(source).matchAll(
          /\b(?:const|enum)\s+(EvidenceIntakeCategory|EvidenceCategory|EvidenceSource)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(categoryVocabulary).toEqual([]);
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

  it('exports the intake slice from the single package entry point, and nothing internal', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    expect(facade).toContain("from './evidence/evidence-intake-operations'");
    expect(facade).toContain("from './evidence/evidence-intake-repository'");

    // Internal helpers stay internal: the freeze helper, the grammar predicates
    // APV-05 reuses from APV-03/APV-04, the payload-key lookup, the reference
    // resolver, and the submission key list are all implementation detail.
    for (const internal of [
      'deepFreeze',
      'case-freeze',
      'isDottedToken',
      'isProtocolizationInstanceIdentifier',
      'evidenceIntakePayloadKey',
      'submittedEvidenceRef',
      'EVIDENCE_SUBMISSION_BASE_KEYS',
      'isUsableReferenceSource',
      'isAdmissibleCanonicalEvidence',
    ]) {
      expect(facade).not.toContain(internal);
    }
  });

  it('adds no Protocol change: the intake layer lives entirely in the vertical', () => {
    const protocolRoot = join(packageRoot, '..', 'protocol', 'src');
    const protocolSources = sources(protocolRoot).map(({ source }) => stripComments(source)).join('\n');

    for (const token of [
      'EvidenceIntake',
      'ProtocolizationEvidenceSubmission',
      'ProtocolizationCase',
      'AssetProfile',
    ]) {
      expect(protocolSources).not.toContain(token);
    }
  });
});

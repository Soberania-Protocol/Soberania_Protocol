import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The APV-04 boundary test.
 *
 * Same method as `asset-profile-boundaries.test.ts`, extended to the properties
 * the case aggregate has to hold: no duplicated Protocol primitive, no
 * asset-category branching, no clock read inside the domain, and no vocabulary
 * that would make the vertical know what kind of thing it is protocolizing. It
 * asserts over this package's source and modifies nothing in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');
const caseRoot = join(sourceRoot, 'case');

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });

/** Strips comments so a vocabulary scan reads *code*, not prose — see APV-03's rationale. */
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

describe('ProtocolizationCase boundaries', () => {
  it('defines no parallel Evidence, Claim, Attestation, Verification, Credential or identity primitive', () => {
    const duplicates = sources(sourceRoot).flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum)\s+(Evidence|Claim|Attestation|Verification|Standing|Proof|Credential|ResourceRef|SovereignSubjectRef|SovereignExternalReference|ContentIdentity|CanonicalRegistryRef|CanonicalRegistryEntryRef|CanonicalEvidence|CanonicalClaim|CanonicalAttestation|CanonicalVerification|CanonicalCredentialRef)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  it('references those primitives through @aoc/protocol rather than restating them', () => {
    const specifiers = sources(caseRoot).flatMap(({ source }) => readImports(source));
    const protocolSubpaths = new Set(specifiers.filter((specifier) => specifier.startsWith('@aoc/protocol')));

    // Guard the guard: an empty set would make the duplicate-definition test
    // above pass for the wrong reason — because nothing is referenced at all.
    expect([...protocolSubpaths].sort()).toEqual([
      '@aoc/protocol/adapters',
      '@aoc/protocol/claims',
      '@aoc/protocol/contracts',
      '@aoc/protocol/errors',
      '@aoc/protocol/identity',
    ]);
  });

  it('imports nothing outside @aoc/protocol subpaths, relative modules and Node built-ins', () => {
    const foreign = sources(caseRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter(
          (specifier) =>
            !specifier.startsWith('.') &&
            !specifier.startsWith('node:') &&
            !specifier.startsWith('@aoc/protocol'),
        )
        .map((specifier) => `${file}: ${specifier}`),
    );

    expect(foreign).toEqual([]);
  });

  it('depends on no Enterprise, runtime, monetization, tokenizer or persistence module', () => {
    const forbidden = sources(sourceRoot).flatMap(({ file, source }) =>
      readImports(source)
        .filter((specifier) =>
          /^@aoc-runtime\/|^@aoc\/(?!protocol)|(?:^|\/)(?:enterprise|runtime|monetization|governance|tokenizer|frontend|supabase|prisma|redis|database|persistence)(?:\/|$)/.test(
            specifier,
          ),
        )
        .map((specifier) => `${file}: ${specifier}`),
    );

    expect(forbidden).toEqual([]);
  });

  it('branches on no asset category, profile id or asset-class discriminator', () => {
    const branching = sources(sourceRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(/\bswitch\s*\(\s*[^)]*\b(assetCategory|profileId|assetType|category)\b/g)) {
        found.push(`${file}: switch on ${match[1]}`);
      }
      for (const match of code.matchAll(
        /\b(assetCategory|assetType|profileId)\s*(?:===|!==|==|!=)\s*['"]([^'"]*)['"]/g,
      )) {
        // A `typeof x.profileId === 'string'` guard is a structural check, not a
        // branch on which asset class this is.
        if (TYPEOF_RESULTS.has(match[2])) continue;
        found.push(`${file}: compares ${match[1]} to '${match[2]}'`);
      }
      return found;
    });

    expect(branching).toEqual([]);
  });

  it('reads no clock of its own, so every timestamp comes from the injected port', () => {
    const clockReads = sources(sourceRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      // `new Date(value)` and `Date.parse(value)` are validation over a supplied
      // instant, not a clock read; an argument-less construction is a clock read.
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
    const violations = sources(sourceRoot).flatMap(({ file, source }) => {
      const code = stripComments(source);
      const found: string[] = [];
      for (const match of code.matchAll(/\bnew\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider))\s*\(/g)) {
        found.push(`${file}: new ${match[1]}()`);
      }
      for (const pattern of [/\bfetch\s*\(/g, /\bregistry\s*\.\s*resolve\s*\(/g, /\brequire\s*\(/g]) {
        for (const match of code.matchAll(pattern)) found.push(`${file}: ${match[0]}`);
      }
      return found;
    });

    expect(violations).toEqual([]);
  });

  it('contains no asset-class, tokenization, payment or legal-conclusion vocabulary', () => {
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
      'stripe',
      'billing',
      'settlement',
      'payout',
      'invoice',
      'legalowner',
      'titleholder',
    ];

    const hits = sources(caseRoot).flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  it('declares no concrete product profile id', () => {
    const productProfilePattern = /\b(?:digital\.artifact|realestate|artwork|vehicle)\.v\d+\b/i;
    const hits = sources(sourceRoot)
      .filter(({ source }) => productProfilePattern.test(stripComments(source)))
      .map(({ file }) => file);

    expect(hits).toEqual([]);
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

  it('exports the case slice from the single package entry point, and nothing internal', () => {
    const facade = readFileSync(join(sourceRoot, 'index.ts'), 'utf8');

    expect(facade).toContain("from './case/case-operations'");
    // Freezing, and the module that implements it, are internal helpers.
    expect(facade).not.toContain('case-freeze');
    expect(facade).not.toContain('deepFreeze');
  });
});

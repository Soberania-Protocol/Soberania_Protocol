import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The vertical's own boundary test, mirroring
 * `__tests__/architecture/protocol-purity.test.ts` and discharging the
 * follow-on the ADR's Enforcement section anticipated for APV-03. It asserts
 * over the vertical's source and modifies nothing in Protocol.
 */
const packageRoot = join(__dirname, '..');
const sourceRoot = join(packageRoot, 'src');

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });

const readImports = (path: string): readonly string[] => {
  const source = readFileSync(path, 'utf8');
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

const verticalImports = (): readonly { readonly file: string; readonly specifier: string }[] =>
  collectTypeScriptFiles(sourceRoot).flatMap((path) =>
    readImports(path).map((specifier) => ({ file: relative(packageRoot, path), specifier })),
  );

/**
 * Strips comments so a vocabulary scan reads *code*, not prose. The doc
 * comments in this package deliberately name the concepts that must not appear
 * — "no jurisdiction- or profession-specific value", "it does not tokenize" —
 * and a scanner that flagged the prohibition alongside the violation would
 * pressure the code toward saying less about its own boundary.
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const sources = (): readonly { readonly file: string; readonly source: string }[] =>
  collectTypeScriptFiles(sourceRoot).map((path) => ({
    file: relative(packageRoot, path),
    source: readFileSync(path, 'utf8'),
  }));

describe('asset protocolization package boundaries', () => {
  it('imports nothing but declared @aoc/protocol subpaths, relative modules and Node built-ins', () => {
    // The allow-list is read from Protocol's own `exports` rather than restated
    // here, so a subpath Protocol adds or withdraws is honoured immediately and
    // this test never becomes a second, drifting copy of LAW-004.
    const protocolManifest = JSON.parse(
      readFileSync(join(packageRoot, '..', 'protocol', 'package.json'), 'utf8'),
    );
    const declaredSubpaths = new Set(
      Object.keys(protocolManifest.exports)
        .filter((key) => key !== './package.json')
        .map((key) => `@aoc/protocol${key === '.' ? '' : key.slice(1)}`),
    );

    const foreign = verticalImports().filter(({ specifier }) => {
      if (specifier.startsWith('.')) return false;
      if (specifier.startsWith('node:')) return false;
      return !declaredSubpaths.has(specifier);
    });

    expect(foreign).toEqual([]);
    // Guard the guard: an empty allow-list would make the assertion above
    // vacuous rather than meaningful.
    expect(declaredSubpaths.has('@aoc/protocol/claims')).toBe(true);
  });

  it('never reaches into another package\'s source, internals or an Enterprise/runtime module', () => {
    const forbidden = verticalImports().filter(({ specifier }) =>
      /(?:^|\/)(?:src|internal|private)(?:\/|$)|^@aoc-runtime\/|^@aoc\/(?!protocol)|(?:^|\/)(?:enterprise|runtime|monetization|governance|tokenizer|frontend)(?:\/|$)/.test(
        specifier,
      ),
    );

    expect(forbidden).toEqual([]);
  });

  it('declares only @aoc/protocol as a dependency, keeping the facade envelope intact', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

    expect(manifest.name).toBe('@aoc/asset-protocolization');
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
    expect(manifest.peerDependencies).toBeUndefined();
  });

  it('declares no implementation owner the ownership boundary scanner reserves for Enterprise', () => {
    const ownerDeclaration =
      /\b(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider|Registry|CompositionRoot|Profile|Defaults?))\b|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:Defaults?|Registry|CompositionRoot|Profile))\b/g;

    const owners = sources().flatMap(({ file, source }) =>
      [...source.matchAll(ownerDeclaration)].map((match) => `${file}: ${match[1] ?? match[2]}`),
    );

    expect(owners).toEqual([]);
  });

  it('constructs no runtime, adapter or provider and resolves nothing from a registry', () => {
    const constructions = sources().flatMap(({ file, source }) => {
      const found: string[] = [];
      for (const match of source.matchAll(/\bnew\s+([A-Za-z_$][\w$]*(?:Runtime|Adapter|Provider))\s*\(/g)) {
        found.push(`${file}: new ${match[1]}()`);
      }
      for (const match of source.matchAll(/\bregistry\s*\.\s*resolve\s*\(/g)) {
        found.push(`${file}: registry.resolve() at ${match.index ?? 0}`);
      }
      return found;
    });

    expect(constructions).toEqual([]);
  });

  it('defines no parallel Evidence, Claim, Attestation, Verification, Standing or Proof primitive', () => {
    const duplicates = sources().flatMap(({ file, source }) =>
      [
        ...source.matchAll(
          /\b(?:export\s+)?(?:interface|type|class|enum)\s+(Evidence|Claim|Attestation|Verification|Standing|Proof|Credential|ResourceRef|SovereignSubjectRef|ContentIdentity)\b/g,
        ),
      ].map((match) => `${file}: ${match[1]}`),
    );

    expect(duplicates).toEqual([]);
  });

  it('contains no Enterprise governance, tokenization or asset-class-specific vocabulary', () => {
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
      'stripe',
      'settlement',
      'payout',
    ];

    const hits = sources().flatMap(({ file, source }) => {
      const lowered = stripComments(source).toLowerCase();
      return forbiddenTerms.filter((term) => lowered.includes(term)).map((term) => `${file}: ${term}`);
    });

    expect(hits).toEqual([]);
  });

  it('exports the framework from a single declared entry point', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

    expect(Object.keys(manifest.exports)).toEqual(['.']);
    expect(collectTypeScriptFiles(sourceRoot).map((path) => relative(sourceRoot, path))).toContain('index.ts');
  });
});

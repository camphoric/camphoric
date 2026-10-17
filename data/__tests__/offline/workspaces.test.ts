/**
 * Every workspace (the @camphoric/camphoric-event-* packages under packages/ and
 * events/) imports only its own files and the packages its package.json
 * declares, so each one works on its own: an event's folder can become a
 * repository of its own, and install what it needs from the registry.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from '@jest/globals';
import type {
  EventImport as SpecEventImport,
  FetchMethod as SpecFetchMethod,
  OrganizationImport as SpecOrganizationImport,
  Override as SpecOverride,
  SampleRegGenerator as SpecSampleRegGenerator,
  SampleRegistration as SpecSampleRegistration,
  Saved as SpecSaved,
  SavedResults as SpecSavedResults,
} from '@camphoric/camphoric-event-import-spec';
import type {
  FetchMethod as ToolsFetchMethod,
  ImportData as ToolsImportData,
  OrganizationImport as ToolsOrganizationImport,
  Override as ToolsOverride,
  SampleRegGenerator as ToolsSampleRegGenerator,
  SampleRegistration as ToolsSampleRegistration,
  Saved as ToolsSaved,
  SavedResults as ToolsSavedResults,
} from '@camphoric/camphoric-event-import-tools/types';

import { EVENTS } from '../../eventModules.ts';

const DATA = fileURLToPath(new URL('../..', import.meta.url));

// Every folder under packages/ and events/ that holds a package
const WORKSPACES = ['packages', 'events'].flatMap(dir => readdirSync(path.join(DATA, dir))
  .map(name => path.join(dir, name))
  .filter(workspace => existsSync(path.join(DATA, workspace, 'package.json'))));

// The shared packages an event may use; any other @camphoric/camphoric-event-* package
// is another event
const SHARED_PACKAGES = ['@camphoric/camphoric-event-import-spec', '@camphoric/camphoric-event-import-tools'];

// Every .ts file in a workspace, outside its node_modules
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist'].includes(entry.name) ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

// What a file imports: static imports and exports, and dynamic import()s,
// outside comments (which may show an example)
function specifiers(file: string): string[] {
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)(['"])([^'"]+)\1/gm)]
    .map(match => match[2]);
}

// The package an import names: 'lodash' for 'lodash/fp', '@jest/globals' as is
function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const isBuiltin = (specifier: string) => specifier.startsWith('node:')
  || builtinModules.includes(packageName(specifier));

// Every event package is one the importer loads, so none escapes the import,
// the conformance checks and the server's schema checks.
// import-tools keeps its own copies of the spec types it uses, so that it
// depends on no spec version; the type-check fails when they drift apart.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Fits<A, B> = [A] extends [B] ? true : false;
// (Annotated, not asserted: `true as false` would type-check.)
const toolsTypesMatchTheSpec: [
  Same<SpecFetchMethod, ToolsFetchMethod>,
  Same<SpecSaved, ToolsSaved>,
  Same<SpecOrganizationImport, ToolsOrganizationImport>,
  Same<SpecSampleRegistration, ToolsSampleRegistration>,
  Same<SpecSavedResults, ToolsSavedResults>,
  // what an event module gives, the importer takes
  Fits<SpecEventImport, ToolsImportData>,
  Fits<SpecOverride, ToolsOverride>,
  Fits<SpecSampleRegGenerator, ToolsSampleRegGenerator>,
] = [true, true, true, true, true, true, true, true];

test('import-tools\' copies of the spec\'s types match the spec', () => {
  expect(toolsTypesMatchTheSpec.every(Boolean)).toBe(true);
});

test('the importer is private, and uses the workspace copies by "*"', () => {
  const pkg = readJson('package.json');
  expect(pkg.private).toBe(true);
  expect(Object.entries(pkg.dependencies)
    .filter(([name, range]) => name.startsWith('@camphoric/') && range !== '*')).toEqual([]);
});

test('the importer loads every event under events/, by its package name', async () => {
  const folders = WORKSPACES.filter(workspace => workspace.startsWith('events/'))
    .map(workspace => path.basename(workspace));
  expect(Object.keys(EVENTS).sort()).toEqual(folders.sort());
  for (const folder of folders) {
    const pkg = JSON.parse(readFileSync(path.join(DATA, 'events', folder, 'package.json'), 'utf8'));
    expect(pkg.name).toBe(`@camphoric/camphoric-event-${folder}`);
  }
});

// The export condition that, in this repository, resolves the @camphoric
// packages to their TypeScript source rather than their built dist/
const SOURCE_CONDITION = 'camphoric-source';

const readJson = (file: string) => JSON.parse(readFileSync(path.join(DATA, file), 'utf8'));

// Everything that runs tsx: package scripts, script shebangs and data/import
function tsxInvocations(): { where: string, command: string }[] {
  const scripts = ['package.json', ...WORKSPACES.map(w => path.join(w, 'package.json'))]
    .flatMap(file => Object.entries(readJson(file).scripts ?? {})
      .map(([name, command]) => ({ where: `${file} ${name}`, command: String(command) })));
  const shebangs = [DATA, ...WORKSPACES.map(w => path.join(DATA, w))]
    .flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.ts'))
      .map(name => path.join(dir, name)))
    .map(file => ({ where: path.relative(DATA, file), command: readFileSync(file, 'utf8').split('\n')[0] }))
    .filter(({ command }) => command.startsWith('#!'));
  const importScript = { where: 'import', command: readFileSync(path.join(DATA, 'import'), 'utf8') };
  return [...scripts, ...shebangs, importScript].filter(({ command }) => /\btsx\b/.test(command));
}

describe('in this repository, the @camphoric packages run from their source', () => {
  // The spec only imports itself, by relative paths
  const consumers = ['.', ...WORKSPACES.filter(w => w !== 'packages/event-import-spec')];

  test.each(consumers)('%s type-checks and tests against the source', (dir) => {
    expect(readFileSync(path.join(DATA, dir, 'tsconfig.json'), 'utf8'))
      .toMatch(`"customConditions": ["${SOURCE_CONDITION}"]`);
    expect(readFileSync(path.join(DATA, dir, 'jest.config.cjs'), 'utf8'))
      .toMatch(`customExportConditions: ['${SOURCE_CONDITION}', 'node', 'node-addons']`);
  });

  test('every tsx run passes the source condition', () => {
    const missing = tsxInvocations()
      .filter(({ command }) => !command.includes(`tsx --conditions=${SOURCE_CONDITION}`));
    expect(missing).toEqual([]);
  });
});

describe.each(WORKSPACES)('%s', (workspace) => {
  const root = path.join(DATA, workspace);
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
  const imports = sourceFiles(root).flatMap(file => specifiers(file)
    .map(specifier => ({ file: path.relative(root, file), specifier })));

  test('imports only its own files', () => {
    const outside = imports.filter(({ file, specifier }) => specifier.startsWith('.')
      && path.relative(root, path.resolve(root, path.dirname(file), specifier)).startsWith('..'));
    expect(outside).toEqual([]);
  });

  if (SHARED_PACKAGES.includes(pkg.name)) {
    // So a published package never waits on another's release, and no
    // release can leave a range the workspace copy doesn't satisfy
    test('depends on no other @camphoric package when installed', () => {
      const runtime = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })
        .filter(name => name.startsWith('@camphoric/'));
      expect(runtime).toEqual([]);
    });

    test('publishes its built dist/, with its source for this repository', () => {
      const entries = Object.values(pkg.exports as Record<string, string | Record<string, string>>)
        .filter(target => typeof target === 'object');
      expect(entries).not.toEqual([]);
      for (const target of entries) {
        expect(target.types).toMatch(/^\.\/dist\/.+\.d\.ts$/);
        expect(target.default).toMatch(/^\.\/dist\/.+\.js$/);
        expect(pkg.files).toContain(target[SOURCE_CONDITION].replace(/^\.\//, ''));
      }
      expect(pkg.files).toContain('dist');
      expect(pkg.publishConfig?.registry).toBe('https://npm.pkg.github.com');
      expect(pkg.private).toBeUndefined();
    });
  } else {
    test('is private', () => {
      expect(pkg.private).toBe(true);
    });
  }

  // A workspace always uses the workspace copy of the others, whatever version
  // a release gives it
  test('depends on the other workspaces by "*"', () => {
    const ranges = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
      .filter(([name, range]) => name.startsWith('@camphoric/') && range !== '*');
    expect(ranges).toEqual([]);
  });

  if (workspace.startsWith('events/')) {
    // So it can be packed and published as it is when it moves to a
    // repository of its own (scripts/smoke-test-event-package.sh)
    test('builds from its index.ts to dist/, and packs its build and report templates', () => {
      expect(pkg.exports['.']).toEqual({
        [SOURCE_CONDITION]: './index.ts',
        types: './dist/index.d.ts',
        default: './dist/index.js',
      });
      expect(pkg.files).toContain('dist');
      expect(pkg.files.includes('reports')).toBe(existsSync(path.join(root, 'reports')));
      expect(pkg.scripts.build).toBe('rm -rf dist && tsc -p tsconfig.build.json');
      expect(readFileSync(path.join(root, 'tsconfig.build.json'), 'utf8')).toMatch('"files": ["index.ts"]');
    });

    test('depends on no other event', () => {
      const events = [...declared].filter(name => name.startsWith('@camphoric/camphoric-event-')
        && !SHARED_PACKAGES.includes(name));
      expect(events).toEqual([]);
    });
  }

  test('imports only the packages it declares', () => {
    const undeclared = imports.filter(({ specifier }) => !specifier.startsWith('.')
      && !isBuiltin(specifier) && !declared.has(packageName(specifier)));
    expect(undeclared).toEqual([]);
  });
});

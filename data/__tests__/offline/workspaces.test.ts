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
test('the importer is private', () => {
  expect(readJson('package.json').private).toBe(true);
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

  if (workspace.startsWith('events/')) {
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

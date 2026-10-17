/**
 * Every workspace (the camphoric-event-* packages under packages/ and
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

// The shared packages an event may use; any other camphoric-event-* package
// is another event
const SHARED_PACKAGES = ['camphoric-event-import-spec', 'camphoric-event-import-tools'];

// Every .ts file in a workspace, outside its node_modules
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
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
test('the importer loads every event under events/, by its package name', async () => {
  const folders = WORKSPACES.filter(workspace => workspace.startsWith('events/'))
    .map(workspace => path.basename(workspace));
  expect(Object.keys(EVENTS).sort()).toEqual(folders.sort());
  for (const folder of folders) {
    const pkg = JSON.parse(readFileSync(path.join(DATA, 'events', folder, 'package.json'), 'utf8'));
    expect(pkg.name).toBe(`camphoric-event-${folder}`);
  }
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

  if (workspace.startsWith('events/')) {
    test('depends on no other event', () => {
      const events = [...declared].filter(name => name.startsWith('camphoric-event-')
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

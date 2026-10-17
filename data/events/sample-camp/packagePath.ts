import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * A path inside this package, from its root (the folder with its
 * package.json). Files the event reads at runtime, such as its report
 * templates, are found the same way whether it runs from its TypeScript
 * source or from its build in dist/.
 */
export function packagePath(...parts: string[]): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`no package.json above ${import.meta.url}`);
    dir = parent;
  }
  return path.join(dir, ...parts);
}

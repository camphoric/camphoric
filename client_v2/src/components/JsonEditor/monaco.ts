/**
 * Monaco, bundled with the app (§15, DR-58). `@monaco-editor/react` would
 * otherwise fetch its own pinned copy from a CDN; handing its loader this
 * instance makes the installed `monaco-editor` the one that runs. Reached only
 * through `JsonEditor`'s lazy import, so none of it is in the registration
 * bundle (§11).
 *
 * Only what the admin uses is imported — not `monaco-editor` itself, which
 * registers every language and emits the TypeScript and CSS workers (8 MB).
 */

// The editor's features — suggestions, snippets, hover, find, folding — the
// same set `monaco-editor` itself loads. Monaco keeps them in this module (its
// language services import it); should a release move it, the build fails.
import 'monaco-editor/internal/common/workers';
// JSON (schemas, settings): validation and formatting in its worker.
import 'monaco-editor/languages/features/json/register';
// Highlighting for the legacy report formats (ReportEditForm); the Jinja
// language is registered by the template editor (TemplateEditor/languageServices).
import 'monaco-editor/languages/definitions/handlebars/register';
import 'monaco-editor/languages/definitions/html/register';
import 'monaco-editor/languages/definitions/markdown/register';

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';

// Monaco asks for its workers by label. Vite bundles them from these `?worker`
// imports; left to itself, Monaco points the editor's own worker at a plain
// `new URL(…)` that Vite inlines unbundled, and it fails to start.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === 'json' ? new JsonWorker() : new EditorWorker();
  },
};

loader.config({ monaco });

export { default } from '@monaco-editor/react';

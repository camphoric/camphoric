/**
 * Wires the `camphoric-jinja` language into Monaco (SPEC §9.6, DR-36):
 * highlighting, autocomplete and hover docs. Providers are registered once
 * per Monaco instance and shared by every template editor; each editor
 * registers its model's variable spec and template kind, keyed by model URI,
 * so two editors on one page (a report and an email) suggest different
 * variables.
 */

import type { TemplateContextName, TemplateDescription } from 'api-types';
import type * as MonacoApi from 'monaco-editor';
import type { editor, languages, Position } from 'monaco-editor';

import {
  collectScope,
  completionEntries,
  type CompletionEntry,
  getCursorContext,
} from './completion';
import { hoverMarkdown } from './hover';
import { configuration, LANGUAGE_ID, monarch } from './jinjaLanguage';

export interface ModelTemplateContext {
  description: TemplateDescription;
  context: TemplateContextName;
}

/** The Monaco API object (as passed to `beforeMount`). */
export type Monaco = typeof MonacoApi;

const modelContexts = new Map<string, ModelTemplateContext>();

export function registerModelContext(uri: string, value: ModelTemplateContext) {
  modelContexts.set(uri, value);
}

export function unregisterModelContext(uri: string) {
  modelContexts.delete(uri);
}

const initialized = new WeakSet<object>();

function textBefore(model: editor.ITextModel, position: Position) {
  return model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });
}

function itemKind(monaco: Monaco, kind: CompletionEntry['kind']): languages.CompletionItemKind {
  const kinds = monaco.languages.CompletionItemKind;
  switch (kind) {
    case 'variable':
      return kinds.Variable;
    case 'field':
      return kinds.Field;
    case 'method':
      return kinds.Method;
    case 'filter':
      return kinds.Function;
    case 'test':
      return kinds.Operator;
    case 'tag':
      return kinds.Snippet;
  }
}

/** Register the language and its providers with this Monaco instance, once. */
export function ensureJinjaSupport(instance: unknown) {
  const monaco = instance as Monaco;
  if (initialized.has(monaco)) return;
  initialized.add(monaco);

  monaco.languages.register({ id: LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, configuration);
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarch);

  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: ['.', '|', ' '],
    provideCompletionItems(model: editor.ITextModel, position: Position) {
      const registered = modelContexts.get(model.uri.toString());
      if (!registered) return { suggestions: [] };
      const before = textBefore(model, position);
      const cursor = getCursorContext(before);
      if (!cursor) return { suggestions: [] };

      const scope = collectScope(before, registered.description, registered.context);
      const entries = completionEntries(cursor, scope, registered.description);
      const start = position.column - cursor.partial.length;
      // A tag snippet brings its own closing "%}": swallow the auto-closed one.
      const after = model.getLineContent(position.lineNumber).slice(position.column - 1);
      const closer = cursor.kind === 'tag' ? /^\s*-?%\}/.exec(after) : null;

      return {
        suggestions: entries.map((entry, index) => ({
          label: entry.label,
          kind: itemKind(monaco, entry.kind),
          detail: entry.detail,
          documentation: entry.documentation ? { value: entry.documentation } : undefined,
          insertText: entry.insertText,
          insertTextRules: entry.snippet
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          sortText: `${entry.sortPrefix ?? '1'}${String(index).padStart(4, '0')}`,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: entry.replacesDot ? start - 1 : start,
            endColumn: position.column + (closer ? closer[0].length : 0),
          },
        })),
      };
    },
  });

  monaco.languages.registerHoverProvider(LANGUAGE_ID, {
    provideHover(model: editor.ITextModel, position: Position) {
      const registered = modelContexts.get(model.uri.toString());
      const word = model.getWordAtPosition(position);
      if (!registered || !word) return null;
      const end = { lineNumber: position.lineNumber, column: word.endColumn } as Position;
      const markdown = hoverMarkdown(
        textBefore(model, end),
        registered.description,
        registered.context,
      );
      if (!markdown) return null;
      return {
        contents: [{ value: markdown }],
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        },
      };
    },
  });
}

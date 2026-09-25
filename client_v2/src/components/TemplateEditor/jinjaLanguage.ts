/**
 * The `camphoric-jinja` language for Monaco (SPEC §9.6, DR-36): Jinja
 * highlighting for plain-text, markdown and CSV templates. Adapted from
 * Monaco's twig tokenizer, without its HTML rules, with Jinja's keywords and
 * operators, `{# #}` comments and auto-closing `{{ }}` / `{% %}`.
 */

import type { languages } from 'monaco-editor';

export const LANGUAGE_ID = 'camphoric-jinja';

export const configuration: languages.LanguageConfiguration = {
  wordPattern: /(-?\d*\.\d\w*)|([^`~!@$^&*()=+[{\]}\\|;:'",.<>/\s]+)/g,
  comments: { blockComment: ['{#', '#}'] },
  brackets: [
    ['{#', '#}'],
    ['{%', '%}'],
    ['{{', '}}'],
    ['(', ')'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '{#', close: ' #}' },
    { open: '{%', close: ' %}' },
    { open: '{{', close: ' }}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '(', close: ')' },
    { open: '[', close: ']' },
  ],
};

export const KEYWORDS = [
  'autoescape',
  'endautoescape',
  'block',
  'endblock',
  'break',
  'call',
  'endcall',
  'continue',
  'do',
  'else',
  'elif',
  'filter',
  'endfilter',
  'for',
  'endfor',
  'from',
  'if',
  'endif',
  'import',
  'include',
  'macro',
  'endmacro',
  'raw',
  'endraw',
  'set',
  'endset',
  'with',
  'endwith',
  'recursive',
  'scoped',
  'ignore',
  'missing',
  'context',
  'without',
];

export const WORD_OPERATORS = ['and', 'or', 'not', 'in', 'is', 'if', 'else'];

export const CONSTANTS = ['true', 'false', 'none', 'True', 'False', 'None'];

export const monarch: languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.jinja',
  keywords: KEYWORDS,
  wordOperators: WORD_OPERATORS,
  constants: CONSTANTS,
  symbols: /[=><!~?:&|+\-*/^%]+/,
  tokenizer: {
    root: [
      [/\{#-?/, 'comment.jinja', '@comment'],
      [/\{%-?/, 'delimiter.tag.jinja', '@block'],
      [/\{\{-?/, 'delimiter.output.jinja', '@expression'],
      [/[^{]+/, ''],
      [/\{/, ''],
    ],

    comment: [
      [/-?#\}/, 'comment.jinja', '@pop'],
      [/[^#-]+/, 'comment.jinja'],
      [/./, 'comment.jinja'],
    ],

    // Inside {% %}: the first word is the tag name.
    block: [
      [/\s+/, ''],
      [/[a-zA-Z_]\w*/, { token: 'keyword.jinja', switchTo: '@blockBody' }],
      { include: '@blockBody' },
    ],
    blockBody: [[/-?%\}/, 'delimiter.tag.jinja', '@pop'], { include: '@exprTokens' }],

    // Inside {{ }}.
    expression: [[/-?\}\}/, 'delimiter.output.jinja', '@pop'], { include: '@exprTokens' }],

    exprTokens: [
      [/\s+/, ''],
      [/"([^"\\]|\\.)*"/, 'string.jinja'],
      [/'([^'\\]|\\.)*'/, 'string.jinja'],
      [/\d+(\.\d+)?/, 'number.jinja'],
      // A filter or test name after | or is.
      [/(\|)(\s*)([a-zA-Z_]\w*)/, ['operator.jinja', '', 'predefined.jinja']],
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@wordOperators': 'operator.jinja',
            '@constants': 'constant.jinja',
            '@keywords': 'keyword.jinja',
            '@default': 'variable.jinja',
          },
        },
      ],
      [/[()[\]{}]/, '@brackets'],
      [/[.,:]/, 'delimiter.jinja'],
      [/@symbols/, 'operator.jinja'],
    ],
  },
};

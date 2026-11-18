import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Editor features (find, folding, suggest, bracket matching, …)
import 'monaco-editor/esm/vs/editor/editor.all';

// Language services with real IntelliSense / diagnostics
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';

// Syntax highlighting for the languages a workspace usually contains
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution';
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution';
import 'monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution';
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution';
import 'monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
import 'monaco-editor/esm/vs/basic-languages/php/php.contribution';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution';
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';

type MonacoEnvironment = {
  getWorker: (moduleId: string, label: string) => Worker;
};

const environment: MonacoEnvironment = {
  getWorker(_moduleId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

(globalThis as unknown as { MonacoEnvironment: MonacoEnvironment }).MonacoEnvironment =
  environment;

// Use the bundled Monaco instead of the default CDN loader so the IDE works
// fully offline. The cast keeps @monaco-editor/react's full-namespace type happy
// while we ship a trimmed build.
loader.config({ monaco: monaco as unknown as typeof import('monaco-editor') });

/* ---------------------------------------------------------------------------
 * Themes
 * ------------------------------------------------------------------------- */

export const EDITOR_THEMES = {
  dark: 'safari-dark',
  light: 'safari-light',
} as const;

export function defineStudioThemes(): void {
  monaco.editor.defineTheme('safari-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7684', fontStyle: 'italic' },
      { token: 'keyword', foreground: '79b8ff' },
      { token: 'string', foreground: '9ecbff' },
      { token: 'number', foreground: 'f0b072' },
      { token: 'type', foreground: '7ee787' },
    ],
    colors: {
      'editor.background': '#0e1116',
      'editor.foreground': '#d7dce3',
      'editorLineNumber.foreground': '#3d4753',
      'editorLineNumber.activeForeground': '#8b949e',
      'editor.lineHighlightBackground': '#151a22',
      'editor.selectionBackground': '#26406b',
      'editorGutter.background': '#0e1116',
      'editorIndentGuide.background1': '#1b212b',
      'editorWidget.background': '#151a22',
      'editorWidget.border': '#232b38',
      'editorHoverWidget.background': '#151a22',
      'editorHoverWidget.border': '#232b38',
      'scrollbarSlider.background': '#232b3899',
      'scrollbarSlider.hoverBackground': '#2f3947',
    },
  });

  monaco.editor.defineTheme('safari-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1f242c',
      'editorLineNumber.foreground': '#b3bcc8',
      'editorLineNumber.activeForeground': '#5b6472',
      'editor.lineHighlightBackground': '#f4f6f9',
      'editor.selectionBackground': '#cfe0ff',
      'editorIndentGuide.background1': '#e8ebf0',
    },
  });
}

/**
 * TypeScript defaults so that `.tsx` files validate without a tsconfig. The
 * contribution module augments Monaco at runtime; the cast keeps the trimmed
 * import surface honest for the type checker.
 */
interface TypescriptDefaults {
  setCompilerOptions: (options: Record<string, unknown>) => void;
}

interface TypescriptNamespace {
  typescriptDefaults: TypescriptDefaults;
  ScriptTarget: { ESNext: number };
  ModuleKind: { ESNext: number };
  ModuleResolutionKind: { NodeJs: number };
  JsxEmit: { ReactJSX: number };
}

const typescript = (monaco.languages as unknown as { typescript?: TypescriptNamespace })
  .typescript;

typescript?.typescriptDefaults.setCompilerOptions({
  target: typescript.ScriptTarget.ESNext,
  module: typescript.ModuleKind.ESNext,
  moduleResolution: typescript.ModuleResolutionKind.NodeJs,
  jsx: typescript.JsxEmit.ReactJSX,
  allowNonTsExtensions: true,
  allowJs: true,
  esModuleInterop: true,
  strict: false,
  noEmit: true,
});

export { monaco };

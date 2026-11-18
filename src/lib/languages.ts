const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  vue: 'html',
  svelte: 'html',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  sql: 'sql',
  xml: 'xml',
  svg: 'xml',
  dockerfile: 'dockerfile',
  graphql: 'graphql',
  gql: 'graphql',
  txt: 'plaintext',
};

const DISPLAY_NAME: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  html: 'HTML',
  markdown: 'Markdown',
  python: 'Python',
  ruby: 'Ruby',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  php: 'PHP',
  shell: 'Shell',
  yaml: 'YAML',
  ini: 'INI',
  sql: 'SQL',
  xml: 'XML',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL',
  plaintext: 'Plain Text',
};

export function languageForPath(filePath: string | null | undefined): string {
  if (!filePath) return 'plaintext';
  const name = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (name === 'dockerfile') return 'dockerfile';

  const extension = name.includes('.') ? name.split('.').pop() ?? '' : '';
  return LANGUAGE_BY_EXTENSION[extension] ?? 'plaintext';
}

export function languageLabel(filePath: string | null | undefined): string {
  const language = languageForPath(filePath);
  return DISPLAY_NAME[language] ?? language;
}

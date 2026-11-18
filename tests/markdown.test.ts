import { describe, expect, it } from 'vitest';
import { parseInlineCode, parseMessageSegments } from '../src/lib/markdown';

describe('parseMessageSegments', () => {
  it('returns plain text when there is no code', () => {
    expect(parseMessageSegments('Hello there')).toEqual([
      { type: 'text', content: 'Hello there' },
    ]);
  });

  it('extracts fenced code blocks', () => {
    const segments = parseMessageSegments('Before\n```ts\nconst a = 1;\n```\nAfter');
    expect(segments).toHaveLength(3);
    expect(segments[1]).toEqual({
      type: 'code',
      language: 'ts',
      content: 'const a = 1;',
    });
  });

  it('handles fences without a language', () => {
    const segments = parseMessageSegments('```\necho hi\n```');
    expect(segments).toEqual([{ type: 'code', language: undefined, content: 'echo hi' }]);
  });

  it('returns an empty list for empty input', () => {
    expect(parseMessageSegments('')).toEqual([]);
  });
});

describe('parseInlineCode', () => {
  it('splits inline code spans', () => {
    expect(parseInlineCode('use `npm run dev` now')).toEqual([
      { code: false, value: 'use ' },
      { code: true, value: 'npm run dev' },
      { code: false, value: ' now' },
    ]);
  });

  it('leaves text without backticks untouched', () => {
    expect(parseInlineCode('plain')).toEqual([{ code: false, value: 'plain' }]);
  });
});

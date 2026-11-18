export interface MessageSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Splits assistant Markdown into plain text and fenced code blocks. This is a
 * deliberately small subset — enough for chat answers without pulling in a full
 * Markdown engine.
 */
export function parseMessageSegments(source: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fence = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(source)) !== null) {
    if (match.index > cursor) {
      const text = source.slice(cursor, match.index);
      if (text.trim()) segments.push({ type: 'text', content: text.trim() });
    }

    segments.push({
      type: 'code',
      language: match[1] || undefined,
      content: match[2].replace(/\n$/, ''),
    });

    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    const tail = source.slice(cursor);
    if (tail.trim()) segments.push({ type: 'text', content: tail.trim() });
  }

  if (segments.length === 0 && source.trim()) {
    segments.push({ type: 'text', content: source.trim() });
  }

  return segments;
}

/** Split a text segment into plain and inline-code spans. */
export function parseInlineCode(text: string): Array<{ code: boolean; value: string }> {
  const parts: Array<{ code: boolean; value: string }> = [];
  const pattern = /`([^`]+)`/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ code: false, value: text.slice(cursor, match.index) });
    }
    parts.push({ code: true, value: match[1] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) parts.push({ code: false, value: text.slice(cursor) });
  return parts;
}

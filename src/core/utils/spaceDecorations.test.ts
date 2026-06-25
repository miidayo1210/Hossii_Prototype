import { describe, expect, it } from 'vitest';
import { normalizeDecoration, parseDecorationsFromJson } from './spaceDecorations';

describe('spaceDecorations', () => {
  it('parses bulletin_board decoration', () => {
    const d = normalizeDecoration({
      id: 'd1',
      type: 'bulletin_board',
      position: { x: 50, y: 30 },
      content: { body: 'hello' },
    });
    expect(d?.type).toBe('bulletin_board');
    expect(d?.content.body).toBe('hello');
  });

  it('falls back unknown type to bulletin_board', () => {
    const d = normalizeDecoration({
      id: 'd2',
      type: 'unknown',
      position: { x: 10, y: 10 },
      content: { body: 'x' },
    });
    expect(d?.type).toBe('bulletin_board');
  });

  it('parseDecorationsFromJson filters invalid entries', () => {
    const list = parseDecorationsFromJson([
      { id: 'a', type: 'sign', position: { x: 1, y: 2 }, content: { body: 'ok' } },
      { id: 'b' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('sign');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StarView } from './StarView';
import type { Hossii } from '../../core/types';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  // StarView uses useMediaQuery (mobile landscape) after main updates.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);

function makeHossii(overrides: Partial<Hossii> = {}): Hossii {
  return {
    id: 'star-1',
    message: '星の気持ち',
    authorName: 'みい',
    createdAt: new Date('2026-07-01'),
    visibility: 'public',
    ...overrides,
  } as Hossii;
}

function renderStar(hossii: Hossii, showPreview = true) {
  return render(
    <StarView
      hossii={hossii}
      x={40}
      y={40}
      onClick={() => {}}
      showPreview={showPreview}
      animationLevel="none"
    />,
  );
}

describe('StarView tag display', () => {
  it('shows preset tags and hashtags in preview', () => {
    const { container } = renderStar(
      makeHossii({ tags: ['質問'], hashtags: ['自由'] }),
    );
    expect(container.textContent).toContain('#質問');
    expect(container.textContent).toContain('#自由');
  });

  it('dedupes identical tag strings', () => {
    const { container } = renderStar(
      makeHossii({ tags: ['同じ'], hashtags: ['同じ'] }),
    );
    expect(container.textContent?.match(/#同じ/g)?.length).toBe(1);
  });

  it('shows at most 2 tags and +N for extras', () => {
    const { container } = renderStar(
      makeHossii({ tags: ['a', 'b'], hashtags: ['c'] }),
    );
    expect(container.textContent).toContain('#a');
    expect(container.textContent).toContain('#b');
    expect(container.textContent).toContain('+1');
    expect(container.textContent).not.toContain('#c');
  });

  it('does not add a tag row when tags and hashtags are empty/null', () => {
    const { container } = renderStar(
      makeHossii({ tags: null, hashtags: null }),
    );
    expect(container.querySelector('[class*="previewTags"]')).toBeNull();
    expect(container.textContent).not.toMatch(/#/);
  });

  it('does not show tags when preview is hidden', () => {
    const { container } = renderStar(
      makeHossii({ tags: ['質問'], hashtags: ['自由'] }),
      false,
    );
    expect(container.textContent).not.toContain('#質問');
  });
});

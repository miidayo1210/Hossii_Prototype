// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ConnectionOverlay } from './ConnectionOverlay';
import type { HossiiConnection } from '../../core/types/hossiiConnection';

const connections: HossiiConnection[] = [
  {
    id: 'c1',
    spaceId: 's1',
    paneId: 'pane-a',
    sourceHossiiId: 'h1',
    targetHossiiId: 'h2',
    strength: 'medium',
    createdBy: null,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
  },
];

function renderOverlay(overrides: Partial<ComponentProps<typeof ConnectionOverlay>> = {}) {
  const bubbleArea = document.createElement('div');
  bubbleArea.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  const bubbleAreaRef = { current: bubbleArea };

  const props = {
    bubbleAreaRef,
    connections,
    selectedBubbleId: 'h1' as string | null,
    presentationMode: 'custom' as const,
    renderAsStar: false,
    viewMode: 'full' as const,
    layoutMode: 'random' as const,
    activePaneId: 'pane-a',
    visibleHossiiIds: new Set(['h1', 'h2']),
    ...overrides,
  };

  return render(<ConnectionOverlay {...props} />);
}

function queryOverlay() {
  return document.body.querySelector('[data-connection-overlay]');
}

describe('ConnectionOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders overlay when gate is open and selection exists', () => {
    renderOverlay();
    expect(queryOverlay()).not.toBeNull();
    expect(document.querySelector('[data-connection-id="c1"]')).not.toBeNull();
  });

  it('does not render in slideshow', () => {
    renderOverlay({ viewMode: 'slideshow' });
    expect(queryOverlay()).toBeNull();
  });

  it('does not render in star presentation mode', () => {
    renderOverlay({ presentationMode: 'stars' });
    expect(queryOverlay()).toBeNull();
  });

  it('does not render when renderAsStar is true', () => {
    renderOverlay({ renderAsStar: true });
    expect(queryOverlay()).toBeNull();
  });

  it('does not render in byAuthor layout', () => {
    renderOverlay({ layoutMode: 'byAuthor' });
    expect(queryOverlay()).toBeNull();
  });

  it('does not render for other pane connections', () => {
    renderOverlay({ activePaneId: 'pane-b' });
    expect(queryOverlay()).toBeNull();
  });

  it('marks hit paths disabled while pulling', () => {
    renderOverlay({ hitPathsDisabled: true });
    const overlay = queryOverlay();
    expect(overlay?.getAttribute('data-hit-paths-disabled')).toBe('true');
    const hitPath = document.querySelector('[data-connection-id="c1"] path:nth-of-type(2)') as SVGPathElement | null;
    expect(hitPath?.style.pointerEvents).toBe('none');
  });
});

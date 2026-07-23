// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ConnectionOverlay } from './ConnectionOverlay';
import type { HossiiConnection } from '../../core/types/hossiiConnection';

const connectionMeta = {
  spaceId: 's1',
  paneId: 'pane-a',
  sourceHossiiId: 'h1',
  targetHossiiId: 'h2',
  strength: 'medium' as const,
  reasonText: null,
  reasonEmoji: null,
  createdBy: null,
  createdAt: '2026-07-22T00:00:00Z',
  updatedAt: '2026-07-22T00:00:00Z',
};

const connections: HossiiConnection[] = [
  {
    id: 'c1',
    ...connectionMeta,
  },
];

function mockOverlayRect(element: Element) {
  (element as HTMLElement).getBoundingClientRect = () =>
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
}

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

function getHitPath(connectionId = 'c1') {
  return document.querySelector(
    `[data-connection-id="${connectionId}"] path:nth-of-type(2)`,
  ) as SVGPathElement | null;
}

function queryReasonTooltip() {
  return document.querySelector('[data-connection-reason-tooltip]');
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
    const hitPath = getHitPath();
    expect(hitPath?.style.pointerEvents).toBe('none');
  });
});

describe('ConnectionOverlay reason tooltip', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows tooltip when hovered connection has reason', () => {
    renderOverlay({
      connections: [
        {
          ...connections[0],
          reasonText: 'テーマが近い',
          reasonEmoji: '💡',
        },
      ],
    });

    const overlay = queryOverlay();
    expect(overlay).not.toBeNull();
    mockOverlayRect(overlay!);

    fireEvent.pointerEnter(getHitPath()!, { clientX: 80, clientY: 60 });

    const tooltip = queryReasonTooltip();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe('💡 テーマが近い');
  });

  it('does not show tooltip when reason is absent', () => {
    renderOverlay();

    const overlay = queryOverlay();
    mockOverlayRect(overlay!);
    fireEvent.pointerEnter(getHitPath()!, { clientX: 80, clientY: 60 });

    expect(queryReasonTooltip()).toBeNull();
  });

  it('hides tooltip when pointer leaves the thread', () => {
    renderOverlay({
      connections: [
        {
          ...connections[0],
          reasonText: 'メモ',
          reasonEmoji: null,
        },
      ],
    });

    const overlay = queryOverlay();
    mockOverlayRect(overlay!);
    const hitPath = getHitPath()!;

    fireEvent.pointerEnter(hitPath, { clientX: 80, clientY: 60 });
    expect(queryReasonTooltip()).not.toBeNull();

    fireEvent.pointerLeave(hitPath);
    expect(queryReasonTooltip()).toBeNull();
  });

  it('does not show tooltip while pulling', () => {
    renderOverlay({
      hitPathsDisabled: true,
      connections: [
        {
          ...connections[0],
          reasonText: 'メモ',
          reasonEmoji: '💡',
        },
      ],
    });

    const overlay = queryOverlay();
    mockOverlayRect(overlay!);
    fireEvent.pointerEnter(getHitPath()!, { clientX: 80, clientY: 60 });

    expect(queryReasonTooltip()).toBeNull();
  });

  it('renders XSS-like reason strings as plain text', () => {
    const xss = '<img onerror=alert(1)>';
    renderOverlay({
      connections: [
        {
          ...connections[0],
          reasonText: xss,
          reasonEmoji: null,
        },
      ],
    });

    const overlay = queryOverlay();
    mockOverlayRect(overlay!);
    fireEvent.pointerEnter(getHitPath()!, { clientX: 80, clientY: 60 });

    const tooltip = queryReasonTooltip();
    expect(tooltip?.textContent).toBe(xss);
    expect(tooltip?.querySelector('img')).toBeNull();
  });
});

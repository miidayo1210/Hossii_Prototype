// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Bubble } from './Tree';
import {
  HossiiActionsContext,
  type HossiiActionsContextValue,
} from '../../core/hooks/useHossiiActions';
import type { Hossii } from '../../core/types';

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: null }),
}));

afterEach(cleanup);

beforeEach(() => {
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

function makeHossii(overrides: Partial<Hossii> = {}): Hossii {
  return {
    id: 'post-1',
    message: 'ぷにぷに',
    authorName: 'みい',
    createdAt: new Date('2026-07-01'),
    visibility: 'public',
    ...overrides,
  } as Hossii;
}

const actionsValue = {
  editMyHossiiContent: vi.fn(async () => ({ ok: true })),
  setMyHossiiVisibilityAction: vi.fn(async () => ({ ok: true })),
  softDeleteMyHossiiAction: vi.fn(async () => ({ ok: true })),
} as unknown as HossiiActionsContextValue;

function renderBubble(
  props: Partial<ComponentProps<typeof Bubble>> & {
    isSelected?: boolean;
    canEdit?: boolean;
  } = {},
) {
  const onSelect = vi.fn();
  const onPositionSave = vi.fn();
  const onActionMenuToggle = vi.fn();

  const view = render(
    <HossiiActionsContext.Provider value={actionsValue}>
      <div data-bubble-area style={{ width: 800, height: 600, position: 'relative' }}>
        <Bubble
          hossii={makeHossii()}
          index={0}
          position={{ x: 50, y: 50 }}
          isActive={false}
          onActivate={() => {}}
          isSelected={props.isSelected ?? false}
          onSelect={onSelect}
          onPositionSave={onPositionSave}
          canEdit={props.canEdit ?? true}
          animationLevel="none"
          actionMenuEnabled={props.actionMenuEnabled}
          actionMenuOpen={props.actionMenuOpen}
          onActionMenuToggle={onActionMenuToggle}
          onViewDetail={props.onViewDetail}
          {...props}
        />
      </div>
    </HossiiActionsContext.Provider>,
  );

  const bubble = screen.getByText('ぷにぷに').closest('[data-hossii-bubble]') as HTMLElement;
  return { ...view, bubble, onSelect, onPositionSave, onActionMenuToggle };
}

describe('Bubble drag threshold and action menu', () => {
  it('selects on first click when unselected', () => {
    const { bubble, onSelect } = renderBubble({ isSelected: false });
    fireEvent.click(bubble);
    expect(onSelect).toHaveBeenCalledWith('post-1');
  });

  it('toggles action menu on selected click when enabled', () => {
    const { bubble, onActionMenuToggle } = renderBubble({
      isSelected: true,
      actionMenuEnabled: true,
    });
    fireEvent.click(bubble);
    expect(onActionMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('does not save position for sub-threshold movement', () => {
    const { bubble, onPositionSave } = renderBubble({ isSelected: true, canEdit: true });

    fireEvent.pointerDown(bubble, { clientX: 100, clientY: 100, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 103, clientY: 100, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 103, clientY: 100, pointerId: 1 });

    expect(onPositionSave).not.toHaveBeenCalled();
  });

  it('saves position after threshold drag', () => {
    const { bubble, onPositionSave } = renderBubble({ isSelected: true, canEdit: true });

    fireEvent.pointerDown(bubble, { clientX: 100, clientY: 100, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 130, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 120, clientY: 130, pointerId: 1 });

    expect(onPositionSave).toHaveBeenCalledTimes(1);
  });

  it('does not toggle menu after drag release', () => {
    const { bubble, onActionMenuToggle } = renderBubble({
      isSelected: true,
      canEdit: true,
      actionMenuEnabled: true,
    });

    fireEvent.pointerDown(bubble, { clientX: 100, clientY: 100, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 140, clientY: 140, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 140, clientY: 140, pointerId: 1 });
    fireEvent.click(bubble);

    expect(onActionMenuToggle).not.toHaveBeenCalled();
  });

  it('shows action menu items when open', () => {
    renderBubble({
      isSelected: true,
      actionMenuEnabled: true,
      actionMenuOpen: true,
      onViewDetail: () => {},
      onConnect: () => {},
      connectionCount: 2,
      onConnectionsClick: () => {},
    });

    expect(screen.getByRole('button', { name: 'くわしく見る' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つないでみる' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つながり 2' })).toBeTruthy();
  });
});

describe('Bubble persistent pull handle', () => {
  const onPullHandlePointerDown = vi.fn();

  beforeEach(() => {
    onPullHandlePointerDown.mockClear();
  });

  it('shows bubble pull handle when selected with connections', () => {
    renderBubble({
      isSelected: true,
      showBubblePullHandle: true,
      onPullHandlePointerDown,
    });

    expect(screen.getByLabelText('つながりを引っ張る')).toBeTruthy();
    expect(document.querySelector('[data-bubble-pull-handle]')).toBeTruthy();
  });

  it('hides bubble pull handle when not selected', () => {
    renderBubble({
      isSelected: false,
      showBubblePullHandle: true,
      onPullHandlePointerDown,
    });

    expect(screen.queryByLabelText('つながりを引っ張る')).toBeNull();
  });

  it('hides bubble pull handle when showBubblePullHandle is false', () => {
    renderBubble({
      isSelected: true,
      showBubblePullHandle: false,
      onPullHandlePointerDown,
    });

    expect(screen.queryByLabelText('つながりを引っ張る')).toBeNull();
  });

  it('does not start bubble drag from pull handle pointerdown', () => {
    const { onPositionSave } = renderBubble({
      isSelected: true,
      canEdit: true,
      showBubblePullHandle: true,
      onPullHandlePointerDown,
    });

    const handle = screen.getByLabelText('つながりを引っ張る') as HTMLElement;
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = vi.fn(() => true);
    handle.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(handle, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      buttons: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(document, { clientX: 140, clientY: 140, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 140, clientY: 140, pointerId: 1 });

    expect(onPositionSave).not.toHaveBeenCalled();
    expect(onPullHandlePointerDown).toHaveBeenCalledTimes(1);
  });

  it('shows pull hint with dismiss control', () => {
    const onConnectionPullHintDismiss = vi.fn();
    renderBubble({
      isSelected: true,
      showBubblePullHandle: true,
      showConnectionPullHint: true,
      onConnectionPullHintDismiss,
      onPullHandlePointerDown,
    });

    expect(screen.getByRole('status').textContent).toContain('✦を引っ張ると、つながりが見えるよ');
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onConnectionPullHintDismiss).toHaveBeenCalledTimes(1);
  });
});

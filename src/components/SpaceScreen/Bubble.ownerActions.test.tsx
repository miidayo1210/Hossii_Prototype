// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Bubble } from './Tree';
import {
  HossiiActionsContext,
  type HossiiActionsContextValue,
} from '../../core/hooks/useHossiiActions';
import type { Hossii } from '../../core/types';

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

function renderBubble(props: {
  isSelected: boolean;
  canManageOwn: boolean;
}) {
  return render(
    <HossiiActionsContext.Provider value={actionsValue}>
      <Bubble
        hossii={makeHossii()}
        index={0}
        position={{ x: 50, y: 50 }}
        isActive={false}
        onActivate={() => {}}
        isSelected={props.isSelected}
        canManageOwn={props.canManageOwn}
        animationLevel="none"
      />
    </HossiiActionsContext.Provider>,
  );
}

describe('Bubble contextual owner actions', () => {
  it('mounts the owner action bar when own post is selected', () => {
    renderBubble({ isSelected: true, canManageOwn: true });
    expect(screen.getByRole('button', { name: '編集する' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '削除する' })).toBeTruthy();
  });

  it('does not mount owner actions when the bubble is not selected', () => {
    renderBubble({ isSelected: true, canManageOwn: false });
    expect(screen.queryByRole('button', { name: '編集する' })).toBeNull();
  });

  it('does not mount owner actions for other people\'s posts (canManageOwn=false)', () => {
    renderBubble({ isSelected: true, canManageOwn: false });
    expect(screen.queryByRole('button', { name: '編集する' })).toBeNull();
  });

  it('does not mount owner actions on an unselected own post', () => {
    renderBubble({ isSelected: false, canManageOwn: true });
    expect(screen.queryByRole('button', { name: '編集する' })).toBeNull();
  });
});

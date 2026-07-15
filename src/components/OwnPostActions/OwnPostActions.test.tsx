// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { OwnPostActions } from './OwnPostActions';
import {
  HossiiActionsContext,
  type HossiiActionsContextValue,
} from '../../core/hooks/useHossiiActions';
import type { Hossii } from '../../core/types';

afterEach(cleanup);

function makeHossii(overrides: Partial<Hossii> = {}): Hossii {
  return {
    id: 'post-1',
    message: 'いまの気持ち',
    authorName: 'みい',
    createdAt: new Date('2026-07-01'),
    visibility: 'public',
    ...overrides,
  } as Hossii;
}

function renderWithActions(
  ui: React.ReactElement,
  actions: Partial<HossiiActionsContextValue> = {},
) {
  const value = {
    editMyHossiiContent: vi.fn(async () => ({ ok: true })),
    setMyHossiiVisibilityAction: vi.fn(async () => ({ ok: true })),
    softDeleteMyHossiiAction: vi.fn(async () => ({ ok: true })),
    ...actions,
  } as unknown as HossiiActionsContextValue;
  return render(
    <HossiiActionsContext.Provider value={value}>{ui}</HossiiActionsContext.Provider>,
  );
}

describe('OwnPostActions bar variant', () => {
  it('renders the three direct icon buttons (edit / visibility / delete)', () => {
    renderWithActions(<OwnPostActions hossii={makeHossii()} variant="bar" />);
    expect(screen.getByRole('button', { name: '編集する' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '自分だけに見せる' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '削除する' })).toBeTruthy();
  });

  it('shows "みんなに公開する" toggle when the post is owner_only', () => {
    renderWithActions(
      <OwnPostActions hossii={makeHossii({ visibility: 'owner_only' })} variant="bar" />,
    );
    expect(screen.getByRole('button', { name: 'みんなに公開する' })).toBeTruthy();
  });

  it('opens an edit dialog prefilled with the current message', () => {
    renderWithActions(<OwnPostActions hossii={makeHossii({ message: '今日のログ' })} variant="bar" />);
    fireEvent.click(screen.getByRole('button', { name: '編集する' }));
    const dialog = screen.getByRole('dialog', { name: '投稿を編集' });
    const textarea = within(dialog).getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('今日のログ');
  });

  it('opens a delete confirmation dialog', () => {
    renderWithActions(<OwnPostActions hossii={makeHossii()} variant="bar" />);
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));
    expect(screen.getByRole('dialog', { name: '投稿を削除' })).toBeTruthy();
  });
});

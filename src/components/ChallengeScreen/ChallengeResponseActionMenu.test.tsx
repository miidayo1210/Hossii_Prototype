// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChallengeResponseActionMenu } from './ChallengeResponseActionMenu';

describe('ChallengeResponseActionMenu', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens menu, supports keyboard, and restores focus on Escape', async () => {
    const onRewrite = vi.fn();
    const onDelete = vi.fn();
    render(
      <ChallengeResponseActionMenu
        itemTitle="今日、印象に残ったことは？"
        onRewrite={onRewrite}
        onDelete={onDelete}
      />,
    );

    const trigger = screen.getByRole('button', {
      name: '「今日、印象に残ったことは？」の回答操作',
    });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '書き直す' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '回答を削除' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /回答を見る/ })).toBeNull();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' });
    expect(onRewrite).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeTruthy();
    });
    expect(
      screen.getByText('「今日、印象に残ったことは？」への回答を削除しますか？'),
    ).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  it('calls rewrite and closes menu', () => {
    const onRewrite = vi.fn();
    render(
      <ChallengeResponseActionMenu
        itemTitle="質問A"
        onRewrite={onRewrite}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /回答操作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '書き直す' }));
    expect(onRewrite).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on outside click', () => {
    render(
      <ChallengeResponseActionMenu
        itemTitle="質問A"
        onRewrite={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /回答操作/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('deletes after confirm and keeps dialog on failure', async () => {
    const onDelete = vi
      .fn()
      .mockRejectedValueOnce(new Error('この回答を削除する権限がありません'))
      .mockResolvedValueOnce(undefined);
    render(
      <ChallengeResponseActionMenu
        itemTitle="質問A"
        onRewrite={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /回答操作/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '回答を削除' }));
    fireEvent.click(screen.getByRole('button', { name: '回答を削除' }));
    expect(await screen.findByText('この回答を削除する権限がありません')).toBeTruthy();
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '回答を削除' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(onDelete).toHaveBeenCalledTimes(2);
  });
});

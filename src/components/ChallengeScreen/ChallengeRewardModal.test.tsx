// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChallengeRewardModal,
  type ChallengeRewardModalModel,
} from './ChallengeRewardModal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function model(
  overrides: Partial<ChallengeRewardModalModel> = {},
): ChallengeRewardModalModel {
  return {
    hossiiKey: 'emotion/wow',
    itemTitle: '朝の気持ち',
    kind: 'continue',
    progressLabel: '必須 1 / 3',
    optionalLeftoverLabel: null,
    nextFocusItemId: 'i2',
    ...overrides,
  };
}

describe('ChallengeRewardModal', () => {
  it('renders continue state with image, item, progress, and CTAs', () => {
    render(
      <ChallengeRewardModal
        model={model()}
        onPrimary={() => {}}
        onSecondary={() => {}}
        onDismiss={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hossiiをゲット！' })).toBeTruthy();
    expect(screen.getByText(/朝の気持ち/)).toBeTruthy();
    expect(screen.getByText('必須 1 / 3')).toBeTruthy();
    expect(screen.getByRole('img', { name: /獲得したHossii/ }).getAttribute('src')).toContain(
      '/hossii/emotion/wow.png',
    );
    expect(screen.getByRole('button', { name: 'つづける' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'いったん戻る' })).toBeTruthy();
  });

  it('renders clear_optional and complete copy', () => {
    const { rerender } = render(
      <ChallengeRewardModal
        model={model({
          kind: 'clear_optional',
          progressLabel: '必須 2 / 2 達成',
          optionalLeftoverLabel: 'おまけの挑戦があと2つあります',
        })}
        onPrimary={() => {}}
        onSecondary={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: '挑戦状クリア！' })).toBeTruthy();
    expect(screen.getByText('おまけの挑戦があと2つあります')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'おまけに挑戦する' })).toBeTruthy();

    rerender(
      <ChallengeRewardModal
        model={model({
          kind: 'complete',
          progressLabel: '3 / 3 完了',
          nextFocusItemId: null,
        })}
        onPrimary={() => {}}
        onSecondary={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: '挑戦状コンプリート！' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '回答を振り返る' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '一覧へ戻る' })).toBeTruthy();
  });

  it('uses safe fallback for unknown hossii keys', () => {
    render(
      <ChallengeRewardModal
        model={model({ hossiiKey: 'unknown/key' })}
        onPrimary={() => {}}
        onSecondary={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByRole('img', { name: /獲得したHossii（/ })).toBeNull();
    expect(screen.getByRole('img', { name: '獲得したHossii' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hossiiをゲット！' })).toBeTruthy();
  });

  it('traps focus and closes on Escape', () => {
    const onDismiss = vi.fn();
    render(
      <ChallengeRewardModal
        model={model()}
        onPrimary={() => {}}
        onSecondary={() => {}}
        onDismiss={onDismiss}
      />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'つづける' })).toBe(
      document.activeElement,
    );

    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('invokes primary and secondary handlers', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <ChallengeRewardModal
        model={model()}
        onPrimary={onPrimary}
        onSecondary={onSecondary}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'つづける' }));
    fireEvent.click(screen.getByRole('button', { name: 'いったん戻る' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});

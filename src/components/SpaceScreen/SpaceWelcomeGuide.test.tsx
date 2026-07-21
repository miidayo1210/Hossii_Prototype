// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  SpaceWelcomeGuide,
  SPACE_WELCOME_PRIVACY_NOTICE_TEXT,
} from './SpaceWelcomeGuide';
import styles from './SpaceWelcomeGuide.module.css';

describe('SpaceWelcomeGuide', () => {
  afterEach(() => cleanup());

  const defaultProps = {
    nickname: 'Test',
    interactionHint: '画面をダブルタップして投稿してね。',
    onClose: () => {},
  };

  it('プライバシー注意文を表示する', () => {
    render(<SpaceWelcomeGuide {...defaultProps} />);
    expect(screen.getByText(SPACE_WELCOME_PRIVACY_NOTICE_TEXT)).toBeTruthy();
  });

  it('role=note と aria-live=off を持つ', () => {
    render(<SpaceWelcomeGuide {...defaultProps} />);
    const notice = screen.getByRole('note');
    expect(notice.getAttribute('aria-live')).toBe('off');
  });

  it('CSS class を適用する', () => {
    render(<SpaceWelcomeGuide {...defaultProps} />);
    const notice = screen.getByRole('note');
    expect(notice.className).toContain(styles.privacyNotice);
  });

  it('space description がある場合も注意文を表示する', () => {
    render(
      <SpaceWelcomeGuide
        {...defaultProps}
        description={'長いスペース説明文'.repeat(5)}
      />,
    );
    expect(screen.getByText(SPACE_WELCOME_PRIVACY_NOTICE_TEXT)).toBeTruthy();
    expect(screen.getByText(/長いスペース説明文/)).toBeTruthy();
  });

  it('操作案内より前に注意文が並ぶ', () => {
    render(<SpaceWelcomeGuide {...defaultProps} />);
    const notice = screen.getByRole('note');
    const hint = screen.getByText(defaultProps.interactionHint);
    expect(
      notice.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

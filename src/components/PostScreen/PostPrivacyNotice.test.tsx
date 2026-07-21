// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { POST_PRIVACY_NOTICE_TEXT } from '../../core/constants/postPrivacyNotice';
import { PostPrivacyNotice } from './PostPrivacyNotice';
import styles from './PostPrivacyNotice.module.css';

describe('PostPrivacyNotice', () => {
  afterEach(() => cleanup());

  it('指定文言を表示する', () => {
    render(<PostPrivacyNotice />);
    expect(screen.getByText(POST_PRIVACY_NOTICE_TEXT)).toBeTruthy();
  });

  it('role=note と aria-live=off を持つ', () => {
    render(<PostPrivacyNotice />);
    const notice = screen.getByRole('note');
    expect(notice.getAttribute('aria-live')).toBe('off');
  });

  it('CSS class を適用する', () => {
    render(<PostPrivacyNotice />);
    const notice = screen.getByRole('note');
    expect(notice.className).toContain(styles.notice);
  });

  it('コンポーネント内で1回だけ表示する', () => {
    render(<PostPrivacyNotice />);
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });
});

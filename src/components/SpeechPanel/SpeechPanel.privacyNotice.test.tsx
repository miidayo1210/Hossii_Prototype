// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { POST_PRIVACY_NOTICE_TEXT } from '../../core/constants/postPrivacyNotice';
import { SpeechPanel } from './SpeechPanel';
import styles from './SpeechPanel.module.css';

vi.mock('../FloatingPanelShell/FloatingPanelShell', () => ({
  FloatingPanelShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('SpeechPanel privacy notice', () => {
  afterEach(() => cleanup());

  const baseProps = {
    listenMode: false,
    onListenToggle: () => {},
    confirmedText: '',
    interimText: '',
    speechLevels: { word: false, short: true, long: false },
    setSpeechLevels: () => {},
    onPost: vi.fn(),
    onEditCandidate: () => {},
    onDismissCandidate: () => {},
    dismissedCandidates: [] as string[],
    onClose: () => {},
  };

  const multiCandidateText =
    '今日は晴れ、明日も晴れ、明後日も晴れ、来週も晴れ、再来週も晴れ';

  it('固定文言を表示する', () => {
    render(<SpeechPanel {...baseProps} />);
    expect(screen.getByText(POST_PRIVACY_NOTICE_TEXT)).toBeTruthy();
    expect(screen.getByRole('note').textContent).toBe(POST_PRIVACY_NOTICE_TEXT);
  });

  it('role=note を持つ', () => {
    render(<SpeechPanel {...baseProps} />);
    expect(screen.getByRole('note')).toBeTruthy();
  });

  it('aria-live=off を持つ', () => {
    render(<SpeechPanel {...baseProps} />);
    expect(screen.getByRole('note').getAttribute('aria-live')).toBe('off');
  });

  it('CSS class を適用する', () => {
    render(<SpeechPanel {...baseProps} />);
    expect(screen.getByRole('note').className).toContain(styles.privacyNotice);
  });

  it('コンポーネント内で1件のみ表示する', () => {
    render(<SpeechPanel {...baseProps} />);
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it('候補複数でも notice は1件のみ footer に残る', () => {
    render(
      <SpeechPanel {...baseProps} listenMode confirmedText={multiCandidateText} />,
    );
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByRole('note').closest('[class*="panelFooter"]')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'スペースに置く' }).length).toBeGreaterThan(1);
  });

  it('投稿 callback に影響しない', () => {
    const onPost = vi.fn();
    render(
      <SpeechPanel
        {...baseProps}
        listenMode
        confirmedText={multiCandidateText}
        onPost={onPost}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'スペースに置く' })[0]);

    expect(onPost).toHaveBeenCalledTimes(1);
    expect(onPost.mock.calls[0][0]).toEqual(expect.any(String));
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByText(POST_PRIVACY_NOTICE_TEXT)).toBeTruthy();
  });

  it('候補0件（未入力）でも notice を表示する', () => {
    render(<SpeechPanel {...baseProps} />);
    expect(screen.getByText('まだ候補がありません')).toBeTruthy();
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByText(POST_PRIVACY_NOTICE_TEXT)).toBeTruthy();
  });

  it('候補0件（抽出不可テキスト）でも notice を表示する', () => {
    render(
      <SpeechPanel
        {...baseProps}
        listenMode
        confirmedText={'区切りのない長い文字起こし'.repeat(3)}
      />,
    );
    expect(screen.getByText('該当する候補がありません')).toBeTruthy();
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it('loading（interim 認識中）でも notice を表示する', () => {
    render(
      <SpeechPanel
        {...baseProps}
        listenMode
        confirmedText=""
        interimText="認識中のテキスト"
      />,
    );
    expect(screen.getByText('認識中のテキスト')).toBeTruthy();
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByText(POST_PRIVACY_NOTICE_TEXT)).toBeTruthy();
  });
});

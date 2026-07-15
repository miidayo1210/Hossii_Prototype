// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PostFieldLabel } from './PostFieldLabel';

describe('PostFieldLabel', () => {
  afterEach(() => cleanup());

  it('required=true のとき「必須」を表示する', () => {
    render(<PostFieldLabel label="メッセージ" required />);
    expect(screen.getByText('メッセージ')).toBeTruthy();
    expect(screen.getByText('必須')).toBeTruthy();
    expect(screen.queryByText('任意')).toBeNull();
  });

  it('required=false のとき「任意」を表示する', () => {
    render(<PostFieldLabel label="気持ちをつける" required={false} />);
    expect(screen.getByText('気持ちをつける')).toBeTruthy();
    expect(screen.getByText('任意')).toBeTruthy();
    expect(screen.queryByText('必須')).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CAMERA_CAPTURE_NOTICE_TEXT } from '../../core/constants/cameraCaptureNotice';
import { CameraCaptureNoticeModal } from './CameraCaptureNoticeModal';

describe('CameraCaptureNoticeModal', () => {
  afterEach(() => cleanup());

  it('注意文言とボタンを表示する', () => {
    render(
      <CameraCaptureNoticeModal
        onAcknowledge={() => {}}
        onDismissForever={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(CAMERA_CAPTURE_NOTICE_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'わかった' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '今後表示しない' })).toBeTruthy();
  });

  it('わかったで onAcknowledge を呼ぶ', () => {
    let called = false;
    render(
      <CameraCaptureNoticeModal
        onAcknowledge={() => {
          called = true;
        }}
        onDismissForever={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'わかった' }));
    expect(called).toBe(true);
  });

  it('今後表示しないで onDismissForever を呼ぶ', () => {
    let called = false;
    render(
      <CameraCaptureNoticeModal
        onAcknowledge={() => {}}
        onDismissForever={() => {
          called = true;
        }}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '今後表示しない' }));
    expect(called).toBe(true);
  });
});

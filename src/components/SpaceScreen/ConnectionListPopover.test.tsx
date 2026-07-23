// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectionListPopover } from './ConnectionListPopover';

function setupAnchor() {
  const anchor = document.createElement('div');
  anchor.dataset.hossiiId = 'root-1';
  document.body.appendChild(anchor);
  anchor.getBoundingClientRect = () =>
    ({
      left: 100,
      top: 200,
      width: 80,
      height: 80,
      right: 180,
      bottom: 280,
    }) as DOMRect;
  return anchor;
}

describe('ConnectionListPopover', () => {
  let anchor: HTMLDivElement;

  beforeEach(() => {
    anchor = setupAnchor();
  });

  afterEach(() => {
    anchor.remove();
    document.querySelectorAll('[data-connection-list-popover]').forEach((el) => el.remove());
  });

  it('renders direct connection items and selects peer on click', async () => {
    const onSelectPeer = vi.fn();

    render(
      <ConnectionListPopover
        anchorHossiiId="root-1"
        items={[
          {
            connectionId: 'c1',
            peerHossiiId: 'peer-1',
            messagePreview: 'こんにちは',
            strengthLabel: 'やわらか',
          },
        ]}
        onSelectPeer={onSelectPeer}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('つながり 1')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /こんにちは/ }));
    expect(onSelectPeer).toHaveBeenCalledWith('peer-1');
  });

  it('shows emoji-only reason preview', async () => {
    render(
      <ConnectionListPopover
        anchorHossiiId="root-1"
        items={[
          {
            connectionId: 'c1',
            peerHossiiId: 'peer-1',
            messagePreview: 'こんにちは',
            strengthLabel: 'やわらか',
            reasonPreview: '💡',
          },
        ]}
        onSelectPeer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('💡')).toBeTruthy();
    });
  });

  it('shows text-only reason preview', async () => {
    render(
      <ConnectionListPopover
        anchorHossiiId="root-1"
        items={[
          {
            connectionId: 'c1',
            peerHossiiId: 'peer-1',
            messagePreview: 'こんにちは',
            strengthLabel: 'やわらか',
            reasonPreview: 'テーマが近い',
          },
        ]}
        onSelectPeer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('テーマが近い')).toBeTruthy();
    });
  });

  it('shows emoji and text reason preview', async () => {
    render(
      <ConnectionListPopover
        anchorHossiiId="root-1"
        items={[
          {
            connectionId: 'c1',
            peerHossiiId: 'peer-1',
            messagePreview: 'こんにちは',
            strengthLabel: 'やわらか',
            reasonPreview: '💡 テーマが近い',
          },
        ]}
        onSelectPeer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('💡 テーマが近い')).toBeTruthy();
    });
  });

  it('hides reason row when reasonPreview is absent', async () => {
    render(
      <ConnectionListPopover
        anchorHossiiId="root-1"
        items={[
          {
            connectionId: 'c1',
            peerHossiiId: 'peer-1',
            messagePreview: 'こんにちは',
            strengthLabel: 'やわらか',
          },
        ]}
        onSelectPeer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'こんにちは、やわらか' })).toBeTruthy();
    });

    const button = screen.getByRole('button', { name: 'こんにちは、やわらか' });
    expect(button.childElementCount).toBe(2);
  });

  it('renders XSS-like reason as plain text', async () => {
    const xss = '<img onerror=alert(1)>';
    render(
      <ConnectionListPopover
        anchorHossiiId="root-1"
        items={[
          {
            connectionId: 'c1',
            peerHossiiId: 'peer-1',
            messagePreview: 'こんにちは',
            strengthLabel: 'やわらか',
            reasonPreview: xss,
          },
        ]}
        onSelectPeer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(xss)).toBeTruthy();
    });
    expect(document.querySelector('img[onerror]')).toBeNull();
  });
});

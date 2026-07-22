// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectionListPopover } from './ConnectionListPopover';

describe('ConnectionListPopover', () => {
  it('renders direct connection items and selects peer on click', async () => {
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

    anchor.remove();
  });
});

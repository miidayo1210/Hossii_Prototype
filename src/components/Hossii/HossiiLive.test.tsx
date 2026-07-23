// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { HossiiLive } from './HossiiLive';

afterEach(cleanup);

describe('HossiiLive connection entry handle', () => {
  it('renders Space Hossii handle when enabled', () => {
    render(
      <HossiiLive
        decorative
        showConnectionViewHandle
        onConnectionViewClick={vi.fn()}
      />,
    );

    expect(document.querySelector('[data-space-hossii-connection-handle]')).toBeTruthy();
  });

  it('does not render handle when disabled', () => {
    render(<HossiiLive decorative />);

    expect(document.querySelector('[data-space-hossii-connection-handle]')).toBeNull();
  });

  it('does not invoke decorative tap handler when handle is clicked', () => {
    const onConnectionViewClick = vi.fn();
    render(
      <HossiiLive
        showConnectionViewHandle
        onConnectionViewClick={onConnectionViewClick}
      />,
    );

    const handle = document.querySelector('[data-space-hossii-connection-handle]');
    expect(handle).toBeTruthy();
    fireEvent.click(handle!);
    expect(onConnectionViewClick).toHaveBeenCalledTimes(1);
  });
});

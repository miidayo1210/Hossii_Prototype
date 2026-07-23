// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SpaceHossiiConnectionHandle } from './SpaceHossiiConnectionHandle';

afterEach(cleanup);

describe('SpaceHossiiConnectionHandle', () => {
  it('renders with aria-label and handle marker', () => {
    render(<SpaceHossiiConnectionHandle onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'つながりを見る' })).toBeTruthy();
    expect(document.querySelector('[data-space-hossii-connection-handle]')).toBeTruthy();
  });

  it('calls onClick when activated', () => {
    const onClick = vi.fn();
    render(<SpaceHossiiConnectionHandle onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'つながりを見る' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stops pointer and click propagation so parent tap handlers are not invoked', () => {
    const onClick = vi.fn();
    const parentPointerDown = vi.fn();
    const parentClick = vi.fn();

    render(
      <div
        onPointerDown={parentPointerDown}
        onClick={parentClick}
      >
        <SpaceHossiiConnectionHandle onClick={onClick} />
      </div>,
    );

    const button = screen.getByRole('button', { name: 'つながりを見る' });
    fireEvent.pointerDown(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(parentPointerDown).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });
});

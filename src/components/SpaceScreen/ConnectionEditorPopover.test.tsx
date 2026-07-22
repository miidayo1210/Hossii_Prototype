// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConnectionStrengthPopover } from './ConnectionStrengthPopover';
import { ConnectionDeleteConfirmPopover } from './ConnectionDeleteConfirmPopover';

afterEach(cleanup);

const anchorRect = {
  left: 120,
  top: 180,
  right: 280,
  bottom: 300,
  width: 160,
  height: 120,
  x: 120,
  y: 180,
  toJSON: () => ({}),
} as DOMRect;

describe('ConnectionStrengthPopover', () => {
  it('renders strength options and create primary action', () => {
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="create"
        selectedStrength="medium"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /ほのか/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /やわらか/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /しっかり/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つなぐ' })).toBeTruthy();
  });

  it('renders edit actions including 強さ変更 and ほどく', () => {
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="edit"
        selectedStrength="soft"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onRequestDelete={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '強さ変更' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ほどく' })).toBeTruthy();
  });

  it('shows role=alert error message', () => {
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="create"
        selectedStrength="medium"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onCancel={() => {}}
        errorMessage="保存に失敗しました"
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe('保存に失敗しました');
  });

  it('invokes handlers', () => {
    const onSelectStrength = vi.fn();
    const onPrimaryAction = vi.fn();

    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="create"
        selectedStrength="medium"
        onSelectStrength={onSelectStrength}
        onPrimaryAction={onPrimaryAction}
        onCancel={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /しっかり/ }));
    fireEvent.click(screen.getByRole('button', { name: 'つなぐ' }));

    expect(onSelectStrength).toHaveBeenCalledWith('strong');
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});

describe('ConnectionDeleteConfirmPopover', () => {
  it('renders confirm dialog with role=alertdialog', () => {
    render(
      <ConnectionDeleteConfirmPopover
        anchorRect={anchorRect}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ほどく' })).toBeTruthy();
  });
});

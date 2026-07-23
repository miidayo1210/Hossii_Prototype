// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConnectionStrengthPopover } from './ConnectionStrengthPopover';
import { ConnectionDeleteConfirmPopover } from './ConnectionDeleteConfirmPopover';
import { HOSSII_CONNECTION_REASON_EMOJIS } from '../../core/types/hossiiConnection';

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

const defaultReasonProps = {
  reasonExpanded: false,
  draftReasonText: '',
  draftReasonEmoji: null as const,
  onToggleReasonExpanded: vi.fn(),
  onDraftReasonTextChange: vi.fn(),
  onToggleDraftReasonEmoji: vi.fn(),
};

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
        {...defaultReasonProps}
      />,
    );

    expect(screen.getByRole('button', { name: /ほのか/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /やわらか/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /しっかり/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'つなぐ' })).toBeTruthy();
  });

  it('renders edit actions including 保存する and ほどく', () => {
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="edit"
        selectedStrength="soft"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onRequestDelete={() => {}}
        onCancel={() => {}}
        {...defaultReasonProps}
      />,
    );

    expect(screen.getByRole('button', { name: '保存する' })).toBeTruthy();
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
        {...defaultReasonProps}
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
        {...defaultReasonProps}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /しっかり/ }));
    fireEvent.click(screen.getByRole('button', { name: 'つなぐ' }));

    expect(onSelectStrength).toHaveBeenCalledWith('strong');
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('初期collapsedで理由トグルを表示', () => {
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="create"
        selectedStrength="medium"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onCancel={() => {}}
        {...defaultReasonProps}
      />,
    );

    expect(screen.getByRole('button', { name: '＋ 理由も添える' })).toBeTruthy();
    expect(screen.queryByLabelText('つながりの理由')).toBeNull();
  });

  it('toggleで展開し emoji 8種類を表示', () => {
    const onToggleReasonExpanded = vi.fn();
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="create"
        selectedStrength="medium"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onCancel={() => {}}
        {...defaultReasonProps}
        onToggleReasonExpanded={onToggleReasonExpanded}
        reasonExpanded
      />,
    );

    expect(HOSSII_CONNECTION_REASON_EMOJIS).toHaveLength(8);
    for (const emoji of HOSSII_CONNECTION_REASON_EMOJIS) {
      expect(screen.getByRole('button', { name: `理由の絵文字 ${emoji}` })).toBeTruthy();
    }
    expect(screen.getByLabelText('つながりの理由')).toBeTruthy();
  });

  it('emoji選択と解除', () => {
    const onToggleDraftReasonEmoji = vi.fn();
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="create"
        selectedStrength="medium"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onCancel={() => {}}
        {...defaultReasonProps}
        reasonExpanded
        onToggleDraftReasonEmoji={onToggleDraftReasonEmoji}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '理由の絵文字 💡' }));
    expect(onToggleDraftReasonEmoji).toHaveBeenCalledWith('💡');
  });

  it('50文字カウンタを表示', () => {
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="create"
        selectedStrength="medium"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onCancel={() => {}}
        {...defaultReasonProps}
        reasonExpanded
        draftReasonText="12345"
      />,
    );

    expect(screen.getByText('5/50')).toBeTruthy();
  });

  it('edit時既存reasonで展開状態を反映', () => {
    render(
      <ConnectionStrengthPopover
        anchorRect={anchorRect}
        mode="edit"
        selectedStrength="medium"
        onSelectStrength={() => {}}
        onPrimaryAction={() => {}}
        onCancel={() => {}}
        reasonExpanded
        draftReasonText="既存理由"
        draftReasonEmoji="💡"
        onToggleReasonExpanded={vi.fn()}
        onDraftReasonTextChange={vi.fn()}
        onToggleDraftReasonEmoji={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('既存理由')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '＋ 理由も添える' })).toBeNull();
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

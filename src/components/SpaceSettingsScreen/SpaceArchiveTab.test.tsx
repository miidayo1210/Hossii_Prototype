// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SpaceArchiveTab } from './SpaceArchiveTab';

vi.mock('../../core/utils/spaceArchiveApi', () => ({
  setSpaceArchived: vi.fn(),
}));

import { setSpaceArchived } from '../../core/utils/spaceArchiveApi';

const baseSpace = {
  id: 'dev-space-public',
  name: 'Public',
  quickEmotions: [],
  createdAt: new Date(),
  isArchived: false,
};

describe('SpaceArchiveTab', () => {
  const confirmSpy = vi.spyOn(window, 'confirm');
  const onArchiveChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    confirmSpy.mockReturnValue(true);
    vi.mocked(setSpaceArchived).mockResolvedValue({
      ok: true,
      spaceId: baseSpace.id,
      isArchived: true,
      archivedAt: '2026-07-15T00:00:00Z',
      archivedBy: 'admin-1',
    });
  });

  afterEach(() => {
    confirmSpy.mockReset();
    cleanup();
  });

  function getArchiveToggle() {
    return screen.getByRole('checkbox', { name: 'スペースをアーカイブ' });
  }

  it('renders archive toggle and description', () => {
    render(<SpaceArchiveTab space={baseSpace} onArchiveChange={onArchiveChange} />);
    expect(getArchiveToggle()).toBeTruthy();
    expect(screen.getByText(/閲覧専用になります/)).toBeTruthy();
  });

  it('shows read-only status when archived', () => {
    render(
      <SpaceArchiveTab
        space={{ ...baseSpace, isArchived: true }}
        onArchiveChange={onArchiveChange}
      />,
    );
    expect(screen.getByText('現在、このスペースは閲覧専用です')).toBeTruthy();
  });

  it('calls set_space_archived after confirm on ON', async () => {
    render(<SpaceArchiveTab space={baseSpace} onArchiveChange={onArchiveChange} />);
    fireEvent.click(getArchiveToggle());
    await waitFor(() => {
      expect(setSpaceArchived).toHaveBeenCalledWith(baseSpace.id, true);
    });
    expect(onArchiveChange).toHaveBeenCalledWith({
      isArchived: true,
      archivedAt: new Date('2026-07-15T00:00:00Z'),
      archivedBy: 'admin-1',
    });
  });

  it('does not call RPC when confirm is cancelled', async () => {
    confirmSpy.mockReturnValue(false);
    render(<SpaceArchiveTab space={baseSpace} onArchiveChange={onArchiveChange} />);
    fireEvent.click(getArchiveToggle());
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
    expect(setSpaceArchived).not.toHaveBeenCalled();
    expect(onArchiveChange).not.toHaveBeenCalled();
  });

  it('shows error and keeps state when RPC fails', async () => {
    vi.mocked(setSpaceArchived).mockResolvedValue({
      ok: false,
      message: 'permission denied',
    });
    render(<SpaceArchiveTab space={baseSpace} onArchiveChange={onArchiveChange} />);
    fireEvent.click(getArchiveToggle());
    await waitFor(() => {
      expect(screen.getByText('permission denied')).toBeTruthy();
    });
    expect(onArchiveChange).not.toHaveBeenCalled();
    expect((getArchiveToggle() as HTMLInputElement).checked).toBe(false);
  });

  it('disables toggle while loading', async () => {
    let resolveRpc: (value: Awaited<ReturnType<typeof setSpaceArchived>>) => void = () => {};
    vi.mocked(setSpaceArchived).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        }),
    );

    render(<SpaceArchiveTab space={baseSpace} onArchiveChange={onArchiveChange} />);
    fireEvent.click(getArchiveToggle());
    expect((getArchiveToggle() as HTMLInputElement).disabled).toBe(true);

    resolveRpc({
      ok: true,
      spaceId: baseSpace.id,
      isArchived: true,
      archivedAt: null,
      archivedBy: null,
    });
    await waitFor(() => {
      expect((getArchiveToggle() as HTMLInputElement).disabled).toBe(false);
    });
  });
});

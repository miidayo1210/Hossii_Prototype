// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ExportRecordTab } from './ExportRecordTab';

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../core/utils/spacePanesApi', () => ({
  fetchSpacePanes: vi.fn(),
}));

vi.mock('../../core/utils/hossiiExportApi', () => ({
  fetchAllAdminExportHossiis: vi.fn(),
}));

vi.mock('../../core/utils/hossiiExportCsv', () => ({
  buildAdminExportCsv: vi.fn(),
  buildAdminExportFilename: vi.fn(),
  downloadAdminExportCsv: vi.fn(),
}));

import { useAuth } from '../../core/contexts/useAuth';
import { fetchSpacePanes } from '../../core/utils/spacePanesApi';
import { fetchAllAdminExportHossiis } from '../../core/utils/hossiiExportApi';
import {
  buildAdminExportCsv,
  buildAdminExportFilename,
  downloadAdminExportCsv,
} from '../../core/utils/hossiiExportCsv';

const baseSpace = {
  id: 'dev-space-public',
  name: 'Dev Space',
  quickEmotions: [],
  createdAt: new Date(),
  communityId: 'community-1',
  spaceType: 'shared' as const,
};

const sampleItem = {
  hossiiId: 'h1',
  createdAt: '2026-07-21T10:00:00+09:00',
  paneName: 'Default',
  authorType: 'guest' as const,
  anonymousId: 'anon-1',
  message: 'hello',
  emotion: 'joy',
  hashtags: [],
  numberValue: null,
  postKind: 'bubble',
  hasImage: false,
};

describe('ExportRecordTab', () => {
  const confirmSpy = vi.spyOn(window, 'confirm');

  beforeEach(() => {
    vi.clearAllMocks();
    confirmSpy.mockReturnValue(true);
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
        uid: 'admin-1',
        isAdmin: true,
        communityId: 'community-1',
      },
    } as ReturnType<typeof useAuth>);
    vi.mocked(fetchSpacePanes).mockResolvedValue([
      {
        id: 'pane-1',
        spaceId: baseSpace.id,
        name: 'Ideas',
        slug: 'ideas',
        sortOrder: 1,
        isDefault: false,
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.mocked(fetchAllAdminExportHossiis).mockResolvedValue({ ok: true, data: [sampleItem] });
    vi.mocked(buildAdminExportCsv).mockReturnValue('csv-content');
    vi.mocked(buildAdminExportFilename).mockReturnValue('export.csv');
  });

  afterEach(() => {
    confirmSpy.mockReset();
    cleanup();
  });

  it('shows ineligible message for personal space', async () => {
    render(
      <ExportRecordTab
        space={{ ...baseSpace, spaceType: 'personal', communityId: undefined }}
      />,
    );
    expect(
      screen.getByText('個人スペースでは回答履歴エクスポートを利用できません。'),
    ).toBeTruthy();
  });

  it('loads count and exports CSV after confirm', async () => {
    render(<ExportRecordTab space={baseSpace} />);

    await waitFor(() => {
      expect(screen.getByText('1件')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'CSVをエクスポート' }));

    await waitFor(() => {
      expect(fetchAllAdminExportHossiis).toHaveBeenCalledTimes(2);
      expect(buildAdminExportCsv).toHaveBeenCalled();
      expect(downloadAdminExportCsv).toHaveBeenCalledWith('csv-content', 'export.csv');
      expect(screen.getByText('1件の回答をCSVでダウンロードしました')).toBeTruthy();
    });
  });

  it('shows empty message when no rows', async () => {
    vi.mocked(fetchAllAdminExportHossiis).mockResolvedValue({ ok: true, data: [] });
    render(<ExportRecordTab space={baseSpace} />);

    await waitFor(() => {
      expect(screen.getByText('0件')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'CSVをエクスポート' }));

    await waitFor(() => {
      expect(screen.getByText('エクスポートできる回答がありません')).toBeTruthy();
    });
    expect(downloadAdminExportCsv).not.toHaveBeenCalled();
  });

  it('does not export when confirm is cancelled', async () => {
    confirmSpy.mockReturnValue(false);
    render(<ExportRecordTab space={baseSpace} />);

    await waitFor(() => {
      expect(screen.getByText('1件')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'CSVをエクスポート' }));
    expect(fetchAllAdminExportHossiis).toHaveBeenCalledTimes(1);
    expect(downloadAdminExportCsv).not.toHaveBeenCalled();
  });

  it('shows opt-in warnings when toggles are enabled', async () => {
    render(<ExportRecordTab space={baseSpace} />);

    fireEvent.click(screen.getByLabelText('投稿者表示名を含める'));
    fireEvent.click(screen.getByLabelText('画像URLを含める'));

    expect(screen.getByText(/個人情報が含まれる可能性があります/)).toBeTruthy();
    expect(screen.getByText(/CSVの共有先から閲覧される可能性があります/)).toBeTruthy();
  });
});

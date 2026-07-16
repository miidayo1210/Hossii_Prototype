// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SpacesScreen } from './SpacesScreen';
import type { Space } from '../../core/types/space';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setActiveSpace: vi.fn(),
  fetchPersonalSpaceOwnerLabels: vi.fn(),
  currentUser: {
    uid: 'admin-1',
    displayName: 'Admin',
    email: 'admin@example.test',
    isAdmin: true,
    isSuperAdmin: false,
    communityId: 'comm-a',
    communityName: 'Dev Community',
  },
  spaces: [] as Space[],
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: { spaces: h.spaces },
    addSpace: vi.fn(),
    updateSpace: vi.fn(),
    removeSpace: vi.fn(),
    setActiveSpace: h.setActiveSpace,
    communitySlug: 'dev-community',
    spacesLoadedFromSupabase: true,
  }),
}));

vi.mock('../../core/hooks/useRouter', () => ({
  useRouter: () => ({ navigate: h.navigate, screenParam: null }),
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({
    currentUser: h.currentUser,
    logout: vi.fn(),
    refreshCommunitySlug: vi.fn(),
  }),
}));

vi.mock('../../core/contexts/useAdminNavigation', () => ({
  useAdminNavigation: () => ({
    overrideCommunityId: null,
    overrideCommunityName: null,
    clearOverrideCommunity: vi.fn(),
    setOverrideCommunity: vi.fn(),
  }),
}));

vi.mock('./PersonalSpaceTemplateEditor', () => ({
  PersonalSpaceTemplateEditor: () => <div data-testid="template-editor" />,
}));

vi.mock('../../core/utils/personalSpaceOwnerLabelsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/utils/personalSpaceOwnerLabelsApi')>();
  return {
    ...actual,
    fetchPersonalSpaceOwnerLabels: h.fetchPersonalSpaceOwnerLabels,
  };
});

function space(partial: Partial<Space> & Pick<Space, 'id' | 'name'>): Space {
  return {
    quickEmotions: [],
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('SpacesScreen admin personal space list', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.navigate.mockReset();
    h.setActiveSpace.mockReset();
    h.fetchPersonalSpaceOwnerLabels.mockReset();
    h.fetchPersonalSpaceOwnerLabels.mockResolvedValue(
      new Map([
        [
          'owner-1',
          {
            communityNickname: '田中',
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: 'tanaka@example.test',
          },
        ],
        [
          'owner-2',
          {
            communityNickname: '佐藤',
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: 'sato@example.test',
          },
        ],
        [
          'owner-3',
          {
            communityNickname: '山田',
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: null,
          },
        ],
      ]),
    );

    h.spaces = [
      space({
        id: 'shared-1',
        name: 'Team Space',
        communityId: 'comm-a',
        spaceType: 'shared',
        spaceURL: 'team',
        createdAt: new Date('2026-01-01'),
      }),
      space({
        id: 'shared-2',
        name: 'Alpha Room',
        communityId: 'comm-a',
        spaceType: 'shared',
        spaceURL: 'alpha',
        createdAt: new Date('2026-03-01'),
        isArchived: true,
      }),
      space({
        id: 'ps-1',
        name: 'マイスペース',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-1',
        spaceURL: 'p-1',
        createdAt: new Date('2026-01-01'),
      }),
      space({
        id: 'ps-2',
        name: '朝の記録',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-2',
        spaceURL: 'p-2',
        isArchived: true,
        createdAt: new Date('2026-03-01'),
      }),
      space({
        id: 'ps-3',
        name: '日記スペース',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-3',
        spaceURL: 'p-3',
        createdAt: new Date('2026-02-01'),
      }),
      space({
        id: 'ps-other',
        name: 'Other',
        communityId: 'comm-b',
        spaceType: 'personal',
        ownerUserId: 'owner-x',
      }),
    ];
  });

  it('shared と personal を別セクションに分ける', () => {
    render(<SpacesScreen />);
    expect(screen.getByRole('heading', { name: '共有スペース' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /個人スペース/ })).toBeTruthy();
    expect(screen.getByText('Team Space')).toBeTruthy();
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('個人スペースは初期状態で閉じ、件数を表示する', () => {
    render(<SpacesScreen />);
    expect(screen.getByText('3件')).toBeTruthy();
    expect(screen.queryByText('田中さん')).toBeNull();
  });

  it('展開すると所有者名とアーカイブバッジが表示される', async () => {
    render(<SpacesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /個人スペース/ }));
    await waitFor(() => {
      expect(screen.getByText('田中さん')).toBeTruthy();
    });
    expect(screen.getByText('佐藤さん')).toBeTruthy();
    expect(screen.getByText('山田さん')).toBeTruthy();
    expect(screen.getAllByText('アーカイブ').length).toBeGreaterThan(0);
  });

  it('開く・設定が正しい space を参照する', async () => {
    const locationRef = { href: 'http://localhost/' };
    vi.stubGlobal('location', locationRef);

    render(<SpacesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /個人スペース/ }));
    await waitFor(() => expect(screen.getByText('田中さん')).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button', { name: '開く' })[0]);
    expect(locationRef.href).toBe('/c/dev-community/s/p-1#screen');

    fireEvent.click(screen.getAllByRole('button', { name: '設定' })[0]);
    expect(h.setActiveSpace).toHaveBeenCalledWith('ps-1');
    expect(h.navigate).toHaveBeenCalledWith('settings');

    vi.unstubAllGlobals();
  });
});

describe('SpacesScreen admin search and sort', () => {
  afterEach(cleanup);

  beforeEach(() => {
    h.fetchPersonalSpaceOwnerLabels.mockReset();
    h.fetchPersonalSpaceOwnerLabels.mockResolvedValue(
      new Map([
        [
          'owner-1',
          {
            communityNickname: '田中',
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: 'tanaka@example.test',
          },
        ],
        [
          'owner-2',
          {
            communityNickname: '佐藤',
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: 'sato@example.test',
          },
        ],
        [
          'owner-3',
          {
            communityNickname: '山田',
            profileNickname: null,
            participantDisplayName: null,
            adminEmail: null,
          },
        ],
      ]),
    );

    h.spaces = [
      space({
        id: 'shared-1',
        name: 'Team Space',
        communityId: 'comm-a',
        spaceType: 'shared',
        spaceURL: 'team',
        createdAt: new Date('2026-01-01'),
      }),
      space({
        id: 'shared-2',
        name: 'Alpha Room',
        communityId: 'comm-a',
        spaceType: 'shared',
        spaceURL: 'alpha',
        createdAt: new Date('2026-03-01'),
        isArchived: true,
      }),
      space({
        id: 'ps-1',
        name: 'マイスペース',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-1',
        spaceURL: 'p-1',
        createdAt: new Date('2026-01-01'),
      }),
      space({
        id: 'ps-2',
        name: '朝の記録',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-2',
        spaceURL: 'p-2',
        isArchived: true,
        createdAt: new Date('2026-03-01'),
      }),
      space({
        id: 'ps-3',
        name: '日記スペース',
        communityId: 'comm-a',
        spaceType: 'personal',
        ownerUserId: 'owner-3',
        spaceURL: 'p-3',
        createdAt: new Date('2026-02-01'),
      }),
      space({
        id: 'ps-other',
        name: 'Other',
        communityId: 'comm-b',
        spaceType: 'personal',
        ownerUserId: 'owner-x',
      }),
    ];
  });

  async function expandPersonalSection() {
    render(<SpacesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /個人スペース/ }));
    await waitFor(() => expect(screen.getByLabelText('個人スペースを検索')).toBeTruthy());
  }

  it('名前で検索できる', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), { target: { value: '田中' } });
    expect(screen.getByText('田中さん')).toBeTruthy();
    expect(screen.queryByText('山田さん')).toBeNull();
    expect(screen.getByText('1件')).toBeTruthy();
  });

  it('email で検索できる', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), {
      target: { value: 'sato@example' },
    });
    expect(screen.getByText('佐藤さん')).toBeTruthy();
    expect(screen.queryByText('田中さん')).toBeNull();
  });

  it('スペース名で検索できる', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), { target: { value: '日記' } });
    expect(screen.getByText('山田さん')).toBeTruthy();
    expect(screen.queryByText('田中さん')).toBeNull();
  });

  it('大文字小文字と前後空白を無視する', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), {
      target: { value: '  TANAKA@EXAMPLE  ' },
    });
    expect(screen.getByText('田中さん')).toBeTruthy();
    expect(screen.queryByText('山田さん')).toBeNull();
  });

  it('検索 0 件でメッセージを表示する', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), {
      target: { value: '存在しない' },
    });
    expect(screen.getByText('「存在しない」に一致する個人スペースはありません')).toBeTruthy();
    expect(screen.getByText('0件')).toBeTruthy();
  });

  it('archived も検索対象に含める', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), { target: { value: '朝の' } });
    expect(screen.getByText('佐藤さん')).toBeTruthy();
    expect(screen.getAllByText('アーカイブ').length).toBeGreaterThan(0);
  });

  it('他 community の personal は検索結果に含めない', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), { target: { value: 'Other' } });
    expect(screen.getByText('「Other」に一致する個人スペースはありません')).toBeTruthy();
  });

  it('個人スペースを所有者名順に並び替えできる', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースの並び替え'), {
      target: { value: 'owner_asc' },
    });
    const names = screen.getAllByText(/さん/).map((el) => el.textContent);
    expect(names.indexOf('佐藤さん')).toBeLessThan(names.indexOf('山田さん'));
    expect(names.indexOf('山田さん')).toBeLessThan(names.indexOf('田中さん'));
  });

  it('個人スペースをスペース名順に並び替えできる', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースの並び替え'), {
      target: { value: 'name_asc' },
    });
    const spaceNames = screen.getAllByText(/マイスペース|朝の記録|日記スペース/).map((el) => el.textContent);
    expect(spaceNames).toEqual(['マイスペース', '朝の記録', '日記スペース']);
  });

  it('検索後にソートを適用する', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), { target: { value: 'スペース' } });
    fireEvent.change(screen.getByLabelText('個人スペースの並び替え'), {
      target: { value: 'name_asc' },
    });
    const spaceNames = screen.getAllByText(/マイスペース|日記スペース/).map((el) => el.textContent);
    expect(spaceNames).toEqual(['マイスペース', '日記スペース']);
  });

  it('共有スペースを名前順に並び替えできる', () => {
    render(<SpacesScreen />);
    fireEvent.change(screen.getByLabelText('共有スペースの並び替え'), {
      target: { value: 'name_asc' },
    });
    const cards = screen.getAllByText(/Team Space|Alpha Room/);
    expect(cards[0].textContent).toBe('Alpha Room');
    expect(cards[1].textContent).toBe('Team Space');
  });

  it('共有スペースをアーカイブを下へで並び替えできる', () => {
    render(<SpacesScreen />);
    fireEvent.change(screen.getByLabelText('共有スペースの並び替え'), {
      target: { value: 'archived_last' },
    });
    const cards = screen.getAllByText(/Team Space|Alpha Room/);
    expect(cards[0].textContent).toBe('Team Space');
    expect(cards[1].textContent).toBe('Alpha Room');
  });

  it('折りたたみ時は検索欄を非表示にし state を保持する', async () => {
    await expandPersonalSection();
    fireEvent.change(screen.getByLabelText('個人スペースを検索'), { target: { value: '田中' } });
    fireEvent.click(screen.getByRole('button', { name: /個人スペース/ }));
    expect(screen.queryByLabelText('個人スペースを検索')).toBeNull();
    expect(screen.getByText('1件')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /個人スペース/ }));
    expect((screen.getByLabelText('個人スペースを検索') as HTMLInputElement).value).toBe('田中');
  });

  it('検索・ソート UI が mobile 相当でも操作できる', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    await expandPersonalSection();
    expect(screen.getByLabelText('個人スペースを検索')).toBeTruthy();
    expect(screen.getByLabelText('個人スペースの並び替え')).toBeTruthy();
  });
});

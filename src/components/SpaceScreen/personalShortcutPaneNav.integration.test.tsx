// @vitest-environment jsdom
//
// 統合テスト: 共有スペース画面の Pane 切替タブ列に「マイスペース」が表示されるまでの
// 実データ経路を、SpaceScreen と同じ配線で検証する。
//
// 目的（111 の受入）:
//   - fetchSpaceByUrl → MERGE_SPACE 経路と同じ normalizeSpace を通したスペースが
//     community_id / space_type / owner_user_id を保持すること（回帰防止）。
//   - その正規化済みスペースと membership から canShowPersonalShortcut / isViewingOwnPersonalSpace を
//     算出し、SpacePaneBar の role="tablist" 内・可視 Pane の後ろに「マイスペース」が出ること。
//   - guest / suspended / removed / community_id なし では出ないこと。
//   - click で ensureMyPersonalSpace 相当が呼ばれ、同一画面内で個人スペース表示へ切り替わること（URL 遷移なし）。
//   - Pane 選択で共有スペースへ戻り、「マイスペース」の active が解除されること。
//   - 二重クリックで作成が 1 回に抑止されること。失敗時は切り替えしないこと。
//
// ※ SpacePaneBar 単体へ personalShortcut を手で渡すだけの isolated test ではなく、
//    実際の normalizeSpace（＝ブラウザで community_id が落ちていた箇所）を経由させる。
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useCallback, useMemo, useRef, useState } from 'react';
import { render, screen, cleanup, within, fireEvent, act } from '@testing-library/react';
import { SpacePaneBar } from './SpacePaneBar';
import { normalizeSpace } from '../../core/hooks/HossiiStoreProvider';
import {
  canShowPersonalShortcut,
  isSharedSpaceShell,
  isViewingOwnPersonalSpace,
} from '../../core/utils/personalSpaceShortcut';
import { resolveContentSpaceId } from '../../core/utils/personalSpaceTabView';
import type { SpacePane } from '../../core/types/spacePane';
import type { MyCommunityMembership } from '../../core/types/communityMembership';

afterEach(cleanup);

const COMMUNITY_ID = 'comm-1';
const USER_ID = 'user-1';
const PERSONAL_SPACE_ID = 'personal-space-1';

function makePane(id: string, name: string, sortOrder: number, isDefault = false): SpacePane {
  return {
    id,
    spaceId: 'space-1',
    name,
    slug: id,
    sortOrder,
    isDefault,
    isVisible: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

const SINGLE_PANE = [makePane('main', 'メイン', 0, true)];
const MULTI_PANE = [
  makePane('main', 'メイン', 0, true),
  makePane('week', '今週の実践', 1),
  makePane('step', '今日の一歩', 2),
  makePane('plaza', 'みんなの広場', 3),
];

function membership(status: string): MyCommunityMembership {
  return {
    communityId: COMMUNITY_ID,
    communityName: 'Dev Community',
    communitySlug: 'dev-community',
    communityDescription: undefined,
    role: 'member',
    status: status as MyCommunityMembership['status'],
    communityNickname: null,
  };
}

// fetchSpaceByUrl が返す形（rowToSpace 後の Space 相当）。camelCase。
function sharedSpaceRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: 'space-1',
    spaceURL: 'dev-space-public',
    name: 'Dev Public Space',
    quickEmotions: [],
    createdAt: new Date('2026-01-01').toISOString(),
    communityId: COMMUNITY_ID,
    spaceType: 'shared',
    ownerUserId: undefined,
    ...overrides,
  };
}

type HarnessProps = {
  rawSpace: Record<string, unknown>;
  currentUser: { uid: string } | null;
  memberships: MyCommunityMembership[];
  visiblePanes: SpacePane[];
  onEnsurePersonal: () => Promise<{ ok: boolean; spaceId?: string; spaceUrl?: string }>;
  onNavigate: (url: string) => void;
};

/**
 * SpaceScreen の個人スペースショートカット配線を最小再現する統合ハーネス。
 * rawSpace は必ず実 normalizeSpace（MERGE_SPACE と同一）を通す。
 */
function PaneNavHarness({
  rawSpace,
  currentUser,
  memberships,
  visiblePanes,
  onEnsurePersonal,
}: HarnessProps) {
  const activeSpace = useMemo(() => normalizeSpace(rawSpace), [rawSpace]);
  const [busy, setBusy] = useState(false);
  const [personalViewSpaceId, setPersonalViewSpaceId] = useState<string | null>(null);
  const busyRef = useRef(false);

  const isAuthenticated = !!currentUser;

  const spaceCommunityMembership = useMemo(() => {
    const cid = activeSpace.communityId;
    if (!cid) return null;
    return memberships.find((m) => m.communityId === cid) ?? null;
  }, [activeSpace.communityId, memberships]);

  const eligible =
    isSharedSpaceShell(activeSpace.spaceType) &&
    canShowPersonalShortcut({
      isAuthenticated,
      isVisiting: false,
      spaceCommunityId: activeSpace.communityId,
      membershipStatus: spaceCommunityMembership?.status,
    });

  const active =
    (personalViewSpaceId != null && isSharedSpaceShell(activeSpace.spaceType)) ||
    isViewingOwnPersonalSpace({
      spaceType: activeSpace.spaceType,
      spaceOwnerUserId: activeSpace.ownerUserId,
      currentUserId: currentUser?.uid,
    });

  const contentSpaceId = resolveContentSpaceId({
    shellSpaceType: activeSpace.spaceType,
    shellSpaceId: activeSpace.id,
    personalViewSpaceId,
  });

  const handlePersonalClick = useCallback(async () => {
    if (busyRef.current || personalViewSpaceId) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await onEnsurePersonal();
      if (res.ok && res.spaceId) {
        setPersonalViewSpaceId(res.spaceId);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onEnsurePersonal, personalViewSpaceId]);

  const handlePaneSelect = useCallback(
    (paneId: string) => {
      if (personalViewSpaceId) {
        setPersonalViewSpaceId(null);
      }
      void paneId;
    },
    [personalViewSpaceId],
  );

  const personalShortcut = eligible
    ? { label: 'マイスペース', loading: busy, active, onClick: () => void handlePersonalClick() }
    : null;

  return (
    <div>
      <div data-testid="content-space-id">{contentSpaceId}</div>
      <SpacePaneBar
        spaceId={activeSpace.id}
        variant="desktop"
        folders={[]}
        visiblePanes={visiblePanes}
        activePaneId={personalViewSpaceId ? null : visiblePanes[0]?.id ?? null}
        isAdmin={false}
        onSelect={handlePaneSelect}
        personalShortcut={personalShortcut}
      />
    </div>
  );
}

function renderHarness(props: Partial<HarnessProps> = {}) {
  const onEnsurePersonal =
    props.onEnsurePersonal ??
    vi.fn(async () => ({ ok: true, spaceId: PERSONAL_SPACE_ID, spaceUrl: 'ps-abc' }));
  const onNavigate = props.onNavigate ?? vi.fn();
  render(
    <PaneNavHarness
      rawSpace={props.rawSpace ?? sharedSpaceRaw()}
      currentUser={'currentUser' in props ? (props.currentUser ?? null) : { uid: USER_ID }}
      memberships={props.memberships ?? [membership('active')]}
      visiblePanes={props.visiblePanes ?? MULTI_PANE}
      onEnsurePersonal={onEnsurePersonal}
      onNavigate={onNavigate}
    />,
  );
  return { onEnsurePersonal, onNavigate };
}

function tablistPersonalButtons() {
  const tablist = screen.getByRole('tablist');
  return Array.from(tablist.querySelectorAll('button')).filter(
    (b) => b.textContent === 'マイスペース',
  );
}

describe('normalizeSpace preserves community/space metadata (fetchSpaceByUrl → MERGE_SPACE regression)', () => {
  it('keeps communityId / spaceType / ownerUserId', () => {
    const space = normalizeSpace(
      sharedSpaceRaw({ spaceType: 'personal', ownerUserId: USER_ID }),
    );
    expect(space.communityId).toBe(COMMUNITY_ID);
    expect(space.spaceType).toBe('personal');
    expect(space.ownerUserId).toBe(USER_ID);
  });

  it('leaves communityId undefined when absent (standalone space)', () => {
    const space = normalizeSpace(sharedSpaceRaw({ communityId: undefined }));
    expect(space.communityId).toBeUndefined();
  });
});

describe('Pane tab bar 「マイスペース」 shortcut (integration via real normalizeSpace + eligibility)', () => {
  it('active member + shared space + single pane → [メイン][マイスペース]', () => {
    renderHarness({ visiblePanes: SINGLE_PANE });
    const tablist = screen.getByRole('tablist');
    const labels = Array.from(tablist.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(['メイン', 'マイスペース']);
  });

  it('active member + shared space + multiple panes → 「マイスペース」 is the last tab', () => {
    renderHarness({ visiblePanes: MULTI_PANE });
    const tablist = screen.getByRole('tablist');
    const buttons = Array.from(tablist.querySelectorAll('button'));
    expect(buttons[buttons.length - 1]?.textContent).toBe('マイスペース');
    const paneTabs = within(tablist)
      .getAllByRole('tab')
      .filter((b) => b.getAttribute('aria-controls') === 'space-pane-panel')
      .map((b) => b.textContent);
    expect(paneTabs).toEqual(['メイン', '今週の実践', '今日の一歩', 'みんなの広場']);
    expect(within(tablist).getByRole('tab', { name: 'マイスペースを開く' })).toBeTruthy();
  });

  it('guest (unauthenticated) → no 「マイスペース」', () => {
    renderHarness({ currentUser: null });
    expect(tablistPersonalButtons()).toHaveLength(0);
  });

  it('suspended membership → no 「マイスペース」', () => {
    renderHarness({ memberships: [membership('suspended')] });
    expect(tablistPersonalButtons()).toHaveLength(0);
  });

  it('removed membership → no 「マイスペース」', () => {
    renderHarness({ memberships: [membership('removed')] });
    expect(tablistPersonalButtons()).toHaveLength(0);
  });

  it('no community membership at all → no 「マイスペース」', () => {
    renderHarness({ memberships: [] });
    expect(tablistPersonalButtons()).toHaveLength(0);
  });

  it('space without community_id → no 「マイスペース」', () => {
    renderHarness({ rawSpace: sharedSpaceRaw({ communityId: undefined }) });
    expect(tablistPersonalButtons()).toHaveLength(0);
  });

  it('legacy shared space without spaceType → still shows 「マイスペース」', () => {
    renderHarness({ rawSpace: sharedSpaceRaw({ spaceType: undefined }) });
    expect(tablistPersonalButtons()).toHaveLength(1);
  });

  it('personal space URL (direct access) → no 「マイスペース」 shortcut', () => {
    renderHarness({
      rawSpace: sharedSpaceRaw({ spaceType: 'personal', ownerUserId: USER_ID }),
    });
    expect(tablistPersonalButtons()).toHaveLength(0);
  });

  it('another user personal space URL → no 「マイスペース」 shortcut', () => {
    renderHarness({
      rawSpace: sharedSpaceRaw({ spaceType: 'personal', ownerUserId: 'someone-else' }),
    });
    expect(tablistPersonalButtons()).toHaveLength(0);
  });

  it('click → ensureMyPersonalSpace called and switches content space in-place (no navigation)', async () => {
    const onEnsurePersonal = vi.fn(async () => ({
      ok: true,
      spaceId: PERSONAL_SPACE_ID,
      spaceUrl: 'ps-abc',
    }));
    const onNavigate = vi.fn();
    renderHarness({ onEnsurePersonal, onNavigate });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'マイスペースを開く' }));
    });

    expect(onEnsurePersonal).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('content-space-id').textContent).toBe(PERSONAL_SPACE_ID);
    expect(screen.getByRole('tab', { name: 'マイスペースを表示中' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('click pane after personal tab → returns to shared content space', async () => {
    renderHarness();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'マイスペースを開く' }));
    });
    expect(screen.getByTestId('content-space-id').textContent).toBe(PERSONAL_SPACE_ID);

    fireEvent.click(screen.getByRole('tab', { name: 'メイン' }));
    expect(screen.getByTestId('content-space-id').textContent).toBe('space-1');
    expect(screen.getByRole('tab', { name: 'マイスペースを開く' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('double click → ensureMyPersonalSpace called only once', async () => {
    let resolve!: (v: { ok: boolean; spaceId?: string; spaceUrl?: string }) => void;
    const onEnsurePersonal = vi.fn(
      () => new Promise<{ ok: boolean; spaceId?: string; spaceUrl?: string }>((r) => (resolve = r)),
    );
    renderHarness({ onEnsurePersonal });

    const btn = screen.getByRole('tab', { name: 'マイスペースを開く' });
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(onEnsurePersonal).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true, spaceId: PERSONAL_SPACE_ID, spaceUrl: 'ps-abc' });
    });
  });

  it('ensureMyPersonalSpace failure → does not switch content space', async () => {
    const onEnsurePersonal = vi.fn(async () => ({ ok: false }));
    const onNavigate = vi.fn();
    renderHarness({ onEnsurePersonal, onNavigate });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'マイスペースを開く' }));
    });

    expect(onEnsurePersonal).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('content-space-id').textContent).toBe('space-1');
  });
});

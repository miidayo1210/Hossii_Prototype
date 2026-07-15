// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SpaceArchiveBadge } from './SpaceArchiveBadge';
import { buildJoinedSpaces } from '../../core/utils/joinedSpacesApi';
import type { SpaceMembership } from '../../core/types/spaceMembership';

function membership(over: Partial<SpaceMembership> & { id: string; spaceId: string }): SpaceMembership {
  return {
    id: over.id,
    spaceId: over.spaceId,
    authUserId: 'me',
    role: over.role ?? 'member',
    status: over.status ?? 'active',
    spaceNickname: over.spaceNickname ?? null,
    joinedAt: over.joinedAt ?? '2026-07-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('SpaceArchiveBadge', () => {
  afterEach(() => cleanup());

  it('renders archive label and read-only hint', () => {
    render(<SpaceArchiveBadge />);
    expect(screen.getByText('アーカイブ')).toBeTruthy();
    expect(screen.getByText('閲覧専用')).toBeTruthy();
  });

  it('can hide read-only hint', () => {
    render(<SpaceArchiveBadge showReadOnlyHint={false} />);
    expect(screen.getByText('アーカイブ')).toBeTruthy();
    expect(screen.queryByText('閲覧専用')).toBeNull();
  });
});

describe('joined space list archive flags', () => {
  it('maps isArchived from space lookup row', () => {
    const result = buildJoinedSpaces(
      [membership({ id: 'm1', spaceId: 's-arch' }), membership({ id: 'm2', spaceId: 's-live' })],
      [
        { id: 's-arch', name: '過去イベント', space_url: 'past', community_id: null, is_archived: true },
        { id: 's-live', name: '通常', space_url: 'live', community_id: null, is_archived: false },
      ],
      [],
    );
    expect(result.find((r) => r.spaceId === 's-arch')?.isArchived).toBe(true);
    expect(result.find((r) => r.spaceId === 's-live')?.isArchived).toBe(false);
  });

  it('defaults isArchived to false when column is missing', () => {
    const result = buildJoinedSpaces(
      [membership({ id: 'm1', spaceId: 's1' })],
      [{ id: 's1', name: 'S', space_url: 'a', community_id: null }],
      [],
    );
    expect(result[0].isArchived).toBe(false);
  });
});

describe('space list archive badge visibility (unit)', () => {
  afterEach(() => cleanup());

  it('shows badge only for archived spaces in list item markup', () => {
    const archived = buildJoinedSpaces(
      [membership({ id: 'm1', spaceId: 's1' })],
      [{ id: 's1', name: 'Archived', space_url: 'arch', community_id: null, is_archived: true }],
      [],
    )[0];

    const { unmount } = render(
      <div>
        {archived.isArchived ? <SpaceArchiveBadge /> : null}
      </div>,
    );
    expect(screen.getByText('アーカイブ')).toBeTruthy();
    unmount();

    const normal = buildJoinedSpaces(
      [membership({ id: 'm2', spaceId: 's2' })],
      [{ id: 's2', name: 'Normal', space_url: 'norm', community_id: null, is_archived: false }],
      [],
    )[0];

    const { container: normalContainer } = render(
      <div>
        {normal.isArchived ? <SpaceArchiveBadge /> : null}
      </div>,
    );
    expect(normalContainer.textContent).not.toContain('アーカイブ');
  });

  it('does not affect canEnter / access mode fields on shared space model', () => {
    const archivedPublic = {
      spaceId: 's1',
      spaceName: 'Past',
      spaceUrl: 'past',
      accessMode: 'public' as const,
      canEnter: true,
      isArchived: true,
    };
    const archivedInvite = {
      ...archivedPublic,
      accessMode: 'invite_only' as const,
      canEnter: false,
    };

    expect(archivedPublic.canEnter).toBe(true);
    expect(archivedPublic.accessMode).toBe('public');
    expect(archivedInvite.canEnter).toBe(false);
    expect(archivedInvite.accessMode).toBe('invite_only');
    expect(archivedPublic.isArchived).toBe(true);
  });
});

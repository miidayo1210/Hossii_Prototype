// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpaceArchiveBanner } from './SpaceArchiveBanner';
import { SpaceArchivePostNotice } from './SpaceArchivePostNotice';
import {
  isSpaceArchivedReadOnly,
  resolveBubbleCanEditForArchivedSpace,
  resolveCanManageOwnForArchivedSpace,
  resolveLikesEnabledForArchivedSpace,
  SPACE_ARCHIVE_POST_DISABLED_MESSAGE,
} from '../../core/utils/spaceArchivePolicy';
import { resolveContentSpaceId } from '../../core/utils/personalSpaceTabView';

describe('space archive read-only policy', () => {
  it('detects archived space', () => {
    expect(isSpaceArchivedReadOnly({ isArchived: true })).toBe(true);
    expect(isSpaceArchivedReadOnly({ isArchived: false })).toBe(false);
    expect(isSpaceArchivedReadOnly(null)).toBe(false);
  });

  it('disables likes, edit, and own-manage when archived', () => {
    expect(resolveLikesEnabledForArchivedSpace(true, true)).toBe(false);
    expect(resolveLikesEnabledForArchivedSpace(false, true)).toBe(true);
    expect(resolveBubbleCanEditForArchivedSpace(true, true)).toBe(false);
    expect(resolveBubbleCanEditForArchivedSpace(false, true)).toBe(true);
    expect(resolveCanManageOwnForArchivedSpace(true, true)).toBe(false);
    expect(resolveCanManageOwnForArchivedSpace(false, true)).toBe(true);
  });

  it('restores interactions after unarchive', () => {
    expect(resolveLikesEnabledForArchivedSpace(false, true)).toBe(true);
    expect(resolveCanManageOwnForArchivedSpace(false, true)).toBe(true);
  });

  it('uses personal view space as archive source on shared shell', () => {
    const contentSpaceId = resolveContentSpaceId({
      shellSpaceType: 'shared',
      shellSpaceId: 'shared-1',
      personalViewSpaceId: 'personal-1',
    });
    expect(contentSpaceId).toBe('personal-1');

    const archivedPersonal = { id: 'personal-1', isArchived: true };
    const normalShared = { id: 'shared-1', isArchived: false };
    const contentSpace =
      contentSpaceId === archivedPersonal.id ? archivedPersonal : normalShared;
    expect(isSpaceArchivedReadOnly(contentSpace)).toBe(true);
    expect(isSpaceArchivedReadOnly(normalShared)).toBe(false);
  });
});

describe('SpaceArchiveBanner', () => {
  it('renders archive guidance', () => {
    render(<SpaceArchiveBanner />);
    expect(screen.getByText('このスペースはアーカイブされています')).toBeTruthy();
    expect(screen.getByText('過去の記録を閲覧できます')).toBeTruthy();
  });
});

describe('SpaceArchivePostNotice', () => {
  it('renders post disabled message', () => {
    render(<SpaceArchivePostNotice />);
    expect(screen.getByText(SPACE_ARCHIVE_POST_DISABLED_MESSAGE)).toBeTruthy();
  });
});

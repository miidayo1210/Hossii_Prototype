// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCustomBubbleActionMenu } from './useCustomBubbleActionMenu';
import type { Hossii } from '../../core/types';

function makeHossii(id: string): Hossii {
  return {
    id,
    message: 'test',
    authorName: 'author',
    createdAt: new Date('2026-07-01'),
    visibility: 'public',
  } as Hossii;
}

describe('useCustomBubbleActionMenu', () => {
  it('hides connect action in archived spaces but keeps view-detail', () => {
    const setSelectedBubbleId = vi.fn();
    const setActiveBubbleId = vi.fn();
    const setSelectedPostId = vi.fn();

    const { result } = renderHook(() =>
      useCustomBubbleActionMenu({
        isMobile: false,
        presentationMode: 'custom',
        layoutMode: 'random',
        viewMode: 'full',
        isContentArchived: true,
        selectedBubbleId: 'post-1',
        setSelectedBubbleId,
        setActiveBubbleId,
        setSelectedPostId,
        filteredHossiis: [makeHossii('post-1')],
        contextActivePaneId: 'pane-1',
      }),
    );

    const props = result.current.getBubbleActionMenuProps('post-1', true);
    expect(props.actionMenuEnabled).toBe(true);
    expect(props.onViewDetail).toBeTypeOf('function');
    expect(props.onConnect).toBeUndefined();
    expect(props.connectionCount).toBeUndefined();
  });

  it('resets selection when filtered out', async () => {
    const setSelectedBubbleId = vi.fn();
    const setActiveBubbleId = vi.fn();
    const setSelectedPostId = vi.fn();

    const { rerender } = renderHook(
      ({ filteredHossiis }: { filteredHossiis: Hossii[] }) =>
        useCustomBubbleActionMenu({
          isMobile: false,
          presentationMode: 'custom',
          layoutMode: 'ordered',
          viewMode: 'full',
          isContentArchived: false,
          selectedBubbleId: 'post-1',
          setSelectedBubbleId,
          setActiveBubbleId,
          setSelectedPostId,
          filteredHossiis,
          contextActivePaneId: 'pane-1',
        }),
      {
        initialProps: { filteredHossiis: [makeHossii('post-1')] },
      },
    );

    rerender({ filteredHossiis: [] });

    await waitFor(() => {
      expect(setSelectedBubbleId).toHaveBeenCalledWith(null);
      expect(setActiveBubbleId).toHaveBeenCalledWith(null);
    });
  });

  it('closes menu when selecting another bubble', () => {
    const setSelectedBubbleId = vi.fn();
    const setActiveBubbleId = vi.fn();
    const setSelectedPostId = vi.fn();

    const { result } = renderHook(() =>
      useCustomBubbleActionMenu({
        isMobile: false,
        presentationMode: 'custom',
        layoutMode: 'random',
        viewMode: 'full',
        isContentArchived: false,
        selectedBubbleId: null,
        setSelectedBubbleId,
        setActiveBubbleId,
        setSelectedPostId,
        filteredHossiis: [makeHossii('post-1')],
        contextActivePaneId: 'pane-1',
      }),
    );

    act(() => {
      result.current.handleBubbleSelect('post-1');
    });

    expect(setSelectedBubbleId).toHaveBeenCalledWith('post-1');
  });
});

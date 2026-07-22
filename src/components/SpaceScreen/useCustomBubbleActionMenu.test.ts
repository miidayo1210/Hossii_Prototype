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

const baseOptions = {
  renderAsStar: false,
  presentationMode: 'custom' as const,
  layoutMode: 'random' as const,
  viewMode: 'full' as const,
  isContentArchived: false,
  selectedBubbleId: 'post-1',
  setSelectedBubbleId: vi.fn(),
  setActiveBubbleId: vi.fn(),
  setSelectedPostId: vi.fn(),
  filteredHossiis: [makeHossii('post-1')],
  contextActivePaneId: 'pane-1',
};

describe('useCustomBubbleActionMenu', () => {
  it('hides connect action in archived spaces but keeps view-detail', () => {
    const setSelectedBubbleId = vi.fn();
    const setActiveBubbleId = vi.fn();
    const setSelectedPostId = vi.fn();

    const { result } = renderHook(() =>
      useCustomBubbleActionMenu({
        ...baseOptions,
        isContentArchived: true,
        setSelectedBubbleId,
        setActiveBubbleId,
        setSelectedPostId,
      }),
    );

    const props = result.current.getBubbleActionMenuProps('post-1', true);
    expect(props.actionMenuEnabled).toBe(true);
    expect(props.onViewDetail).toBeTypeOf('function');
    expect(props.onConnect).toBeUndefined();
    expect(props.connectionCount).toBeUndefined();
  });

  it('disables action menu when connections context gate is closed', () => {
    const { result: starsMode } = renderHook(() =>
      useCustomBubbleActionMenu({
        ...baseOptions,
        presentationMode: 'stars',
      }),
    );
    expect(starsMode.current.getBubbleActionMenuProps('post-1', true).actionMenuEnabled).toBe(
      false,
    );

    const { result: slideshow } = renderHook(() =>
      useCustomBubbleActionMenu({
        ...baseOptions,
        viewMode: 'slideshow',
      }),
    );
    expect(slideshow.current.getBubbleActionMenuProps('post-1', true).actionMenuEnabled).toBe(
      false,
    );

    const { result: byAuthor } = renderHook(() =>
      useCustomBubbleActionMenu({
        ...baseOptions,
        layoutMode: 'byAuthor',
      }),
    );
    expect(byAuthor.current.getBubbleActionMenuProps('post-1', true).actionMenuEnabled).toBe(
      false,
    );

    const { result: renderAsStar } = renderHook(() =>
      useCustomBubbleActionMenu({
        ...baseOptions,
        renderAsStar: true,
      }),
    );
    expect(renderAsStar.current.getBubbleActionMenuProps('post-1', true).actionMenuEnabled).toBe(
      false,
    );
  });

  it('resets selection when filtered out', async () => {
    const setSelectedBubbleId = vi.fn();
    const setActiveBubbleId = vi.fn();
    const setSelectedPostId = vi.fn();

    const { rerender } = renderHook(
      ({ filteredHossiis }: { filteredHossiis: Hossii[] }) =>
        useCustomBubbleActionMenu({
          ...baseOptions,
          setSelectedBubbleId,
          setActiveBubbleId,
          setSelectedPostId,
          filteredHossiis,
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

  it('blocks reset while shouldAllowReset returns false', () => {
    const setSelectedBubbleId = vi.fn();
    const setActiveBubbleId = vi.fn();

    const { result } = renderHook(() =>
      useCustomBubbleActionMenu({
        ...baseOptions,
        setSelectedBubbleId,
        setActiveBubbleId,
        shouldAllowReset: () => false,
      }),
    );

    act(() => {
      result.current.resetBubbleInteraction();
    });

    expect(setSelectedBubbleId).not.toHaveBeenCalled();
  });

  it('closes menu when selecting another bubble', () => {
    const setSelectedBubbleId = vi.fn();
    const setActiveBubbleId = vi.fn();
    const setSelectedPostId = vi.fn();

    const { result } = renderHook(() =>
      useCustomBubbleActionMenu({
        ...baseOptions,
        selectedBubbleId: null,
        setSelectedBubbleId,
        setActiveBubbleId,
        setSelectedPostId,
      }),
    );

    act(() => {
      result.current.handleBubbleSelect('post-1');
    });

    expect(setSelectedBubbleId).toHaveBeenCalledWith('post-1');
  });
});

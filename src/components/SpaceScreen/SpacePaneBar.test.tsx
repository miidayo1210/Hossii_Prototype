// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { SpacePaneBar } from './SpacePaneBar';
import type { SpacePane } from '../../core/types/spacePane';

afterEach(cleanup);

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

const panes = [
  makePane('main', 'メイン', 0, true),
  makePane('week', '今週の実践', 1),
  makePane('plaza', 'みんなの広場', 2),
];

describe('SpacePaneBar personal shortcut', () => {
  it('renders 「マイスペース」 as the last button inside the pane tab list', () => {
    render(
      <SpacePaneBar
        spaceId="space-1"
        variant="desktop"
        folders={[]}
        visiblePanes={panes}
        activePaneId="main"
        isAdmin={false}
        onSelect={() => {}}
        personalShortcut={{ label: 'マイスペース', onClick: () => {} }}
      />,
    );

    const tablist = screen.getByRole('tablist');

    // ペインタブ（aria-controls でパネルに紐づく本物の Pane タブ）が存在
    const paneTabLabels = within(tablist)
      .getAllByRole('tab')
      .filter((b) => b.getAttribute('aria-controls') === 'space-pane-panel')
      .map((b) => b.textContent);
    expect(paneTabLabels).toEqual(['メイン', '今週の実践', 'みんなの広場']);

    // 「マイスペース」は同じタブ列コンテナ内の最後の <button>
    const allButtons = Array.from(tablist.querySelectorAll('button'));
    expect(allButtons.length).toBeGreaterThan(0);
    expect(allButtons[allButtons.length - 1]?.textContent).toBe('マイスペース');
    expect(within(tablist).getByRole('tab', { name: 'マイスペースを開く' })).toBeTruthy();
  });

  it('does not render 「マイスペース」 when no personalShortcut is provided (e.g. guest / suspended)', () => {
    render(
      <SpacePaneBar
        spaceId="space-1"
        variant="desktop"
        folders={[]}
        visiblePanes={panes}
        activePaneId="main"
        isAdmin={false}
        onSelect={() => {}}
        personalShortcut={null}
      />,
    );

    expect(screen.queryByRole('button', { name: 'マイスペースを開く' })).toBeNull();
    expect(screen.queryByText('マイスペース')).toBeNull();
  });

  it('calls onClick when 「マイスペース」 is pressed', () => {
    const onClick = vi.fn();
    render(
      <SpacePaneBar
        spaceId="space-1"
        variant="desktop"
        folders={[]}
        visiblePanes={panes}
        activePaneId="main"
        isAdmin={false}
        onSelect={() => {}}
        personalShortcut={{ label: 'マイスペース', onClick }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'マイスペースを開く' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['desktop', 'mobile'] as const)(
    'marks 「マイスペース」 active (aria-selected) in own personal space on %s',
    (variant) => {
      render(
        <SpacePaneBar
          spaceId="space-1"
          variant={variant}
          folders={[]}
          visiblePanes={panes}
          activePaneId="main"
          isAdmin={false}
          onSelect={() => {}}
          personalShortcut={{ label: 'マイスペース', active: true, onClick: () => {} }}
        />,
      );

      const shortcut = screen.getByRole('tab', { name: 'マイスペースを表示中' });
      expect(shortcut.getAttribute('aria-selected')).toBe('true');
    },
  );

  it.each(['desktop', 'mobile'] as const)(
    'does not mark 「マイスペース」 active on a shared space on %s',
    (variant) => {
      render(
        <SpacePaneBar
          spaceId="space-1"
          variant={variant}
          folders={[]}
          visiblePanes={panes}
          activePaneId="main"
          isAdmin={false}
          onSelect={() => {}}
          personalShortcut={{ label: 'マイスペース', active: false, onClick: () => {} }}
        />,
      );

      const shortcut = screen.getByRole('tab', { name: 'マイスペースを開く' });
      expect(shortcut.getAttribute('aria-selected')).toBe('false');
    },
  );
});

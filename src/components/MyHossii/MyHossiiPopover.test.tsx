// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MyHossiiPopover } from './MyHossiiPopover';
import type { MyHossiiActivity } from '../../core/utils/myHossiiActivity';

afterEach(cleanup);

function renderPopover(activity: MyHossiiActivity, opts: { isSelf?: boolean; activityLoading?: boolean } = {}) {
  render(
    <MyHossiiPopover
      nickname="わたし"
      stateLabel="ここにいるよ"
      activity={activity}
      showLogs
      isSelf={opts.isSelf ?? false}
      activityLoading={opts.activityLoading ?? false}
      onViewLogs={() => {}}
      onClose={() => {}}
    />,
  );
}

describe('MyHossiiPopover self activity (DB aggregate)', () => {
  it('shows the accurate DB post count for self (1+)', () => {
    renderPopover(
      {
        postCount: 12,
        recentPosts: [
          { id: 'a', message: '記録1', createdAt: new Date('2026-07-10T00:00:00Z') },
        ],
        lastActivityAt: new Date('2026-07-10T00:00:00Z'),
      },
      { isSelf: true },
    );
    expect(screen.getByText('この場所での記録: 12件')).toBeTruthy();
    expect(screen.getByText('記録1')).toBeTruthy();
  });

  it('shows 0件 count and empty message for self with no posts', () => {
    renderPopover(
      { postCount: 0, recentPosts: [], lastActivityAt: null },
      { isSelf: true },
    );
    expect(screen.getByText('この場所での記録: 0件')).toBeTruthy();
    expect(screen.getByText('この場所での記録はまだありません')).toBeTruthy();
  });

  it('shows a loading message for self while the DB aggregate is pending', () => {
    renderPopover(
      { recentPosts: [], lastActivityAt: null }, // postCount undefined = not yet loaded
      { isSelf: true, activityLoading: true },
    );
    expect(screen.getByText('この場所での記録を集計中…')).toBeTruthy();
    expect(screen.queryByText(/この場所での記録: /)).toBeNull();
  });

  it('does not show the DB count for other participants (no postCount)', () => {
    renderPopover(
      {
        recentPosts: [{ id: 'x', message: '他人の記録', createdAt: new Date('2026-07-10T00:00:00Z') }],
        lastActivityAt: new Date('2026-07-10T00:00:00Z'),
      },
      { isSelf: false },
    );
    expect(screen.queryByText(/この場所での記録: /)).toBeNull();
    expect(screen.getByText('他人の記録')).toBeTruthy();
  });
});

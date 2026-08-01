// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeCompletion, ChallengeReward } from '../../core/types/challengeReward';
import type { ChallengeStampSlot } from '../../core/utils/challengeStampProgress';
import {
  ChallengeProgressSummary,
  ChallengeStampCard,
} from './ChallengeStampCard';

vi.mock('../../core/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

afterEach(() => {
  cleanup();
});

function item(
  overrides: Partial<ChallengeItem> & Pick<ChallengeItem, 'id' | 'title'>,
): ChallengeItem {
  return {
    programId: 'p1',
    itemType: 'question',
    description: null,
    reason: null,
    responseType: 'comment',
    isRequired: true,
    sortOrder: 0,
    createdAt: new Date('2026-07-31T00:00:00.000Z'),
    updatedAt: new Date('2026-07-31T00:00:00.000Z'),
    ...overrides,
  };
}

function slot(partial: Partial<ChallengeStampSlot> & { item: ChallengeItem }): ChallengeStampSlot {
  return {
    index: 1,
    completion: null,
    reward: null,
    achieved: false,
    hossiiKey: null,
    ...partial,
  };
}

function achievedSlot(
  id: string,
  title: string,
  index: number,
  opts: {
    isRequired?: boolean;
    hossiiKey?: string | null;
    sortOrder?: number;
  } = {},
): ChallengeStampSlot {
  const completion: ChallengeCompletion = {
    id: `c-${id}`,
    itemId: id,
    userId: 'u1',
    responseId: null,
    completedAt: new Date(),
    createdAt: new Date(),
  };
  const hossiiKey = opts.hossiiKey === undefined ? 'emotion/wow' : opts.hossiiKey;
  const reward: ChallengeReward | null =
    hossiiKey == null
      ? null
      : {
          id: `r-${id}`,
          completionId: completion.id,
          userId: 'u1',
          itemId: id,
          hossiiKey,
          awardedAt: new Date(),
          createdAt: new Date(),
        };
  return slot({
    index,
    item: item({
      id,
      title,
      isRequired: opts.isRequired ?? true,
      sortOrder: opts.sortOrder ?? index - 1,
    }),
    completion,
    reward,
    achieved: true,
    hossiiKey,
  });
}

describe('ChallengeProgressSummary', () => {
  it('shows required progress 0/3 and remaining label', () => {
    render(
      <ChallengeProgressSummary
        slots={[
          slot({ index: 1, item: item({ id: 'i1', title: 'a', sortOrder: 0 }) }),
          slot({ index: 2, item: item({ id: 'i2', title: 'b', sortOrder: 1 }) }),
          slot({ index: 3, item: item({ id: 'i3', title: 'c', sortOrder: 2 }) }),
        ]}
      />,
    );
    expect(screen.getByText('必須 0 / 3')).toBeTruthy();
    expect(screen.getByText('あと3つでクリア')).toBeTruthy();
  });

  it('shows required progress 1/3', () => {
    render(
      <ChallengeProgressSummary
        slots={[
          achievedSlot('i1', 'a', 1),
          slot({ index: 2, item: item({ id: 'i2', title: 'b', sortOrder: 1 }) }),
          slot({ index: 3, item: item({ id: 'i3', title: 'c', sortOrder: 2 }) }),
        ]}
      />,
    );
    expect(screen.getByText('必須 1 / 3')).toBeTruthy();
    expect(screen.getByText('あと2つでクリア')).toBeTruthy();
  });

  it('shows clear copy when all required done with optional leftover', () => {
    render(
      <ChallengeProgressSummary
        slots={[
          achievedSlot('r1', '必須', 1),
          slot({
            index: 2,
            item: item({
              id: 'o1',
              title: 'おまけ1',
              isRequired: false,
              sortOrder: 1,
            }),
          }),
          slot({
            index: 3,
            item: item({
              id: 'o2',
              title: 'おまけ2',
              isRequired: false,
              sortOrder: 2,
            }),
          }),
        ]}
      />,
    );
    expect(screen.getByText('クリア！')).toBeTruthy();
    expect(screen.getByText(/1つのHossiiを集めました/)).toBeTruthy();
    expect(screen.getByText(/おまけの挑戦があと2つあります/)).toBeTruthy();
  });

  it('treats required-zero programs as all-item completion', () => {
    render(
      <ChallengeProgressSummary
        slots={[
          slot({
            index: 1,
            item: item({ id: 'o1', title: 'a', isRequired: false }),
          }),
          achievedSlot('o2', 'b', 2, { isRequired: false, sortOrder: 1 }),
        ]}
      />,
    );
    expect(screen.getByText('達成 1 / 2')).toBeTruthy();
    expect(screen.getByText('あと1つでクリア')).toBeTruthy();
  });

  it('renders nothing for zero items', () => {
    const { container } = render(<ChallengeProgressSummary slots={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows all-item clear when every slot is achieved', () => {
    render(
      <ChallengeProgressSummary
        slots={[
          achievedSlot('i1', 'a', 1, { hossiiKey: 'idle/idle_smile' }),
          achievedSlot('i2', 'b', 2, {
            hossiiKey: 'emotion/wow',
            sortOrder: 1,
          }),
        ]}
      />,
    );
    expect(screen.getByText('クリア！')).toBeTruthy();
    expect(screen.getByText('2つのHossiiを集めました')).toBeTruthy();
    expect(screen.queryByText(/おまけの挑戦があと/)).toBeNull();
  });
});

describe('ChallengeStampCard', () => {
  it('auto-expands small sets and renders empty stamp for unfinished slot', () => {
    render(
      <ChallengeStampCard
        slots={[
          slot({
            item: item({ id: 'i1', title: '朝の気持ち' }),
          }),
        ]}
      />,
    );
    expect(screen.getByText('まだ')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByText('朝の気持ち')).toBeNull();
    expect(screen.queryByText('質問・クリアに必要')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'スタンプを見る' })).toBeNull();
    expect(screen.getByText('スタンプを押して、思い出をひらこう')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /朝の気持ちに答える/ }),
    ).toBeTruthy();
  });

  it('renders hossii image in expanded detail for achieved slots', () => {
    const onSelectAchieved = vi.fn();
    const onSelectPending = vi.fn();
    const { container } = render(
      <ChallengeStampCard
        slots={[
          achievedSlot('i1', '朝の気持ち', 1),
          slot({
            index: 2,
            item: item({
              id: 'i2',
              title: 'おまけ',
              isRequired: false,
              sortOrder: 1,
            }),
          }),
        ]}
        onSelectAchieved={onSelectAchieved}
        onSelectPending={onSelectPending}
      />,
    );
    expect(screen.getByText('1 / 2 獲得')).toBeTruthy();
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toContain('/hossii/emotion/wow.png');
    expect(screen.getByText('GET!')).toBeTruthy();
    expect(screen.getByText('まだ')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /朝の気持ちのスタンプを振り返る/ }));
    expect(onSelectAchieved).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /おまけに答える/ }));
    expect(onSelectPending).toHaveBeenCalledTimes(1);
  });

  it('starts collapsed for 5+ stamps and toggles expand/collapse', () => {
    const slots = Array.from({ length: 5 }, (_, i) =>
      slot({
        index: i + 1,
        item: item({
          id: `i${i + 1}`,
          title: `項目${i + 1}`,
          sortOrder: i,
        }),
        achieved: i === 0,
        hossiiKey: i === 0 ? 'emotion/wow' : null,
        completion:
          i === 0
            ? {
                id: 'c1',
                itemId: 'i1',
                userId: 'u1',
                responseId: null,
                completedAt: new Date(),
                createdAt: new Date(),
              }
            : null,
        reward:
          i === 0
            ? {
                id: 'r1',
                completionId: 'c1',
                userId: 'u1',
                itemId: 'i1',
                hossiiKey: 'emotion/wow',
                awardedAt: new Date(),
                createdAt: new Date(),
              }
            : null,
      }),
    );

    render(<ChallengeStampCard slots={slots} />);

    const toggle = screen.getByRole('button', { name: 'スタンプを見る' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText('スタンププレビュー')).toBeTruthy();
    expect(screen.getByText('ほか1個')).toBeTruthy();
    expect(screen.queryByText('スタンプを押して、思い出をひらこう')).toBeNull();
    expect(screen.queryByText('質問・クリアに必要')).toBeNull();

    fireEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: 'スタンプを閉じる' }).getAttribute(
        'aria-expanded',
      ),
    ).toBe('true');
    expect(screen.getByText('スタンプを押して、思い出をひらこう')).toBeTruthy();
    expect(screen.getByText('GET!')).toBeTruthy();
    expect(screen.getAllByText('まだ').length).toBe(4);

    fireEvent.click(screen.getByRole('button', { name: 'スタンプを閉じる' }));
    expect(screen.getByRole('button', { name: 'スタンプを見る' })).toBeTruthy();
  });

  it('keeps item order in preview and shows empty frames for unearned', () => {
    render(
      <ChallengeStampCard
        slots={[
          slot({
            index: 1,
            item: item({ id: 'i1', title: '先頭', sortOrder: 0 }),
          }),
          achievedSlot('i2', '二番目', 2, { sortOrder: 1 }),
          slot({
            index: 3,
            item: item({ id: 'i3', title: '三番目', sortOrder: 2 }),
          }),
          achievedSlot('i4', '四番目', 4, {
            sortOrder: 3,
            hossiiKey: 'idle/idle_smile',
          }),
          slot({
            index: 5,
            item: item({ id: 'i5', title: '五番目', sortOrder: 4 }),
          }),
        ]}
      />,
    );

    const preview = screen.getByLabelText('スタンププレビュー');
    const labels = within(preview)
      .getAllByRole('button')
      .map((node) => node.getAttribute('aria-label'));
    expect(labels).toEqual([
      '先頭に答える',
      '二番目のスタンプを振り返る',
      '三番目に答える',
      '四番目のスタンプを振り返る',
    ]);
    // Decorative preview images use empty alt and are excluded from the a11y tree.
    expect(preview.querySelectorAll('img').length).toBe(2);
  });

  it('shows achieved fallback text when completion exists without reward image', () => {
    render(
      <ChallengeStampCard
        slots={[achievedSlot('i1', '画像なし', 1, { hossiiKey: null })]}
      />,
    );
    expect(screen.getByText('獲得済み（画像なし）')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

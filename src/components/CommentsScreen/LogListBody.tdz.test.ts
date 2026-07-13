import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Hossii } from '../../core/types';
import type { SpacePane } from '../../core/types/spacePane';
import type { MyAuthorshipIdsStatus } from '../../core/utils/myAuthorshipIdsController';

// LogListBody は多数の hook / context / localStorage に依存するため、
// レンダリング系テスト基盤（jsdom / testing-library）が無い本リポジトリでは
// 依存 hook と storage だけを最小 mock し、react-dom/server で純粋に描画する。
// 目的は「showMovePane を listSection より前に宣言する」順序不変条件の回帰検証。
// 本番コードへテスト専用 export は追加しない。
const mockState = vi.hoisted(() => ({
  currentUser: null as { uid: string; isAdmin: boolean } | null,
  myAuthorshipIds: new Set<string>() as ReadonlySet<string>,
  myAuthorshipIdsStatus: 'ready' as MyAuthorshipIdsStatus,
  postAuthorDisplayNames: new Map<string, string>() as ReadonlyMap<string, string>,
  guestAuthorId: 'guest-device-1' as string | null,
}));

vi.mock('../../core/contexts/useAuth', () => ({
  useAuth: () => ({ currentUser: mockState.currentUser }),
}));

vi.mock('../../core/hooks/useHossiiStore', () => ({
  useHossiiStore: () => ({
    state: { spaces: [] },
    hideHossii: () => {},
    getActiveNickname: () => 'Tester',
    getAuthorId: () => mockState.guestAuthorId,
    myAuthorshipIds: mockState.myAuthorshipIds,
    myAuthorshipIdsStatus: mockState.myAuthorshipIdsStatus,
    postAuthorDisplayNames: mockState.postAuthorDisplayNames,
  }),
}));

vi.mock('../../core/hooks/useSpaceSettings', () => ({
  useSpaceSettings: () => ({ spaceSettings: { features: { likesEnabled: true } } }),
}));

vi.mock('../../core/utils/filterStorage', () => ({
  loadFilters: () => ({ comment: true, emotion: true }),
  saveFilters: () => {},
}));

vi.mock('../../core/utils/logScopeStorage', () => ({
  loadLogScope: () => 'all',
  saveLogScope: () => {},
}));

import { LogListBody, type LogListBodyProps } from './LogListBody';

const panes: SpacePane[] = [
  { id: 'p1', name: 'Tab1' } as SpacePane,
  { id: 'p2', name: 'Tab2' } as SpacePane,
];

function makeHossii(over: Partial<Hossii> & { id: string }): Hossii {
  return {
    id: over.id,
    spaceId: over.spaceId ?? 's1',
    message: over.message ?? `msg-${over.id}`,
    authorId: over.authorId ?? null,
    createdAt: over.createdAt ?? new Date('2026-07-01T00:00:00Z'),
    likeCount: over.likeCount ?? 0,
    ...over,
  } as Hossii;
}

function render(props: Partial<LogListBodyProps>): string {
  const base: LogListBodyProps = {
    hossiis: [],
    spaceId: 's1',
    initialLogScope: 'all',
    panelMode: true,
    ...props,
  };
  return renderToStaticMarkup(createElement(LogListBody, base));
}

const MOVE_UI_MARKER = '投稿を移動するタブ';

beforeEach(() => {
  mockState.currentUser = null;
  mockState.myAuthorshipIds = new Set();
  mockState.myAuthorshipIdsStatus = 'ready';
  mockState.guestAuthorId = 'guest-device-1';
});

describe('LogListBody TDZ 回帰（showMovePane を listSection より前に宣言）', () => {
  it('isAdmin=true かつ投稿が1件以上でも render が throw しない', () => {
    mockState.currentUser = { uid: 'admin1', isAdmin: true };
    let html = '';
    expect(() => {
      html = render({ hossiis: [makeHossii({ id: 'h1', message: 'hello-admin' })] });
    }).not.toThrow();
    expect(html).toContain('hello-admin');
  });

  it('isAdmin=true かつ Pane 移動条件が揃うと移動 UI が表示される', () => {
    mockState.currentUser = { uid: 'admin1', isAdmin: true };
    const html = render({
      hossiis: [makeHossii({ id: 'h1', spacePaneId: 'p1' })],
      movePaneVisiblePanes: panes,
      movePaneDefaultPaneId: 'p1',
      onMoveHossiiToPane: () => {},
    });
    expect(html).toContain(MOVE_UI_MARKER);
  });

  it('isAdmin=true でも Pane 条件が不足なら移動 UI を出さず throw しない', () => {
    mockState.currentUser = { uid: 'admin1', isAdmin: true };
    const html = render({
      hossiis: [makeHossii({ id: 'h1' })],
      movePaneVisiblePanes: [panes[0]],
      movePaneDefaultPaneId: 'p1',
      onMoveHossiiToPane: () => {},
    });
    expect(html).not.toContain(MOVE_UI_MARKER);
  });

  it('isAdmin=false（一般ログイン）は従来どおり render でき、移動 UI は出ない', () => {
    mockState.currentUser = { uid: 'u1', isAdmin: false };
    const html = render({
      hossiis: [makeHossii({ id: 'h1', message: 'user-post' })],
      movePaneVisiblePanes: panes,
      movePaneDefaultPaneId: 'p1',
      onMoveHossiiToPane: () => {},
    });
    expect(html).toContain('user-post');
    expect(html).not.toContain(MOVE_UI_MARKER);
  });
});

describe('LogListBody mine/all 本人抽出が変わっていない', () => {
  it('ログイン中は myAuthorshipIds のみで mine を抽出する（author_id フォールバックなし）', () => {
    mockState.currentUser = { uid: 'admin1', isAdmin: true };
    mockState.myAuthorshipIdsStatus = 'ready';
    mockState.myAuthorshipIds = new Set(['h1']);
    const html = render({
      initialLogScope: 'mine',
      hossiis: [
        makeHossii({ id: 'h1', message: 'mine-post', authorId: 'someone' }),
        makeHossii({ id: 'h2', message: 'other-post', authorId: 'admin1' }),
      ],
    });
    // authorship にある h1 のみ mine。author_id が admin1 と一致する h2 は入らない。
    expect(html).toContain('mine-post');
    expect(html).not.toContain('other-post');
  });

  it('ゲストは端末 author_id 一致で mine を抽出する', () => {
    mockState.currentUser = null;
    mockState.guestAuthorId = 'guest-device-1';
    const html = render({
      initialLogScope: 'mine',
      hossiis: [
        makeHossii({ id: 'h1', message: 'guest-mine', authorId: 'guest-device-1' }),
        makeHossii({ id: 'h2', message: 'not-mine', authorId: 'other-device' }),
      ],
    });
    expect(html).toContain('guest-mine');
    expect(html).not.toContain('not-mine');
    expect(html).not.toContain(MOVE_UI_MARKER);
  });
});

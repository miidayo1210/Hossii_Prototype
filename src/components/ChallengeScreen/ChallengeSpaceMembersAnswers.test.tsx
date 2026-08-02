// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import { ChallengeSpaceMembersAnswers } from './ChallengeSpaceMembersAnswers';

function makeAnswer(
  id: string,
  userId: string,
  comment: string,
): ChallengeResponse {
  return {
    id,
    itemId: 'i1',
    userId,
    visibility: 'space_members',
    comment,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
  };
}

afterEach(() => {
  cleanup();
});

describe('ChallengeSpaceMembersAnswers', () => {
  it('hides the entry when there are zero answers', () => {
    const { container } = render(
      <ChallengeSpaceMembersAnswers
        answers={[]}
        currentUserId="me"
        responderNames={{}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('starts collapsed and expands to show peer answers', () => {
    render(
      <ChallengeSpaceMembersAnswers
        answers={[makeAnswer('a1', 'peer', '共有コメント')]}
        currentUserId="me"
        responderNames={{ peer: 'ともだち' }}
      />,
    );

    expect(screen.getByRole('button', { name: /みんなの回答 1件/ })).toBeTruthy();
    expect(screen.queryByText('共有コメント')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /みんなの回答 1件/ }));
    expect(screen.getByText('共有コメント')).toBeTruthy();
    expect(screen.getByText('ともだち')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /編集|削除/ })).toBeNull();
  });

  it('marks own answers without offering manage actions', () => {
    render(
      <ChallengeSpaceMembersAnswers
        answers={[makeAnswer('a1', 'me', '自分の共有')]}
        currentUserId="me"
        responderNames={{ me: 'ニック' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /みんなの回答 1件/ }));
    expect(screen.getByText('あなた')).toBeTruthy();
    expect(screen.getByText('自分の回答')).toBeTruthy();
    expect(screen.getByText('自分の共有')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /編集|削除|再回答/ })).toBeNull();
  });

  it('paginates with もっと見る', () => {
    const answers = Array.from({ length: 6 }, (_, index) =>
      makeAnswer(`a${index}`, `u${index}`, `コメント${index}`),
    );
    render(
      <ChallengeSpaceMembersAnswers
        answers={answers}
        currentUserId="me"
        responderNames={{}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /みんなの回答 6件/ }));
    expect(screen.getByText('コメント0')).toBeTruthy();
    expect(screen.getByText('コメント4')).toBeTruthy();
    expect(screen.queryByText('コメント5')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /もっと見る/ }));
    expect(screen.getByText('コメント5')).toBeTruthy();
  });
});

import type { AddHossiiInput } from '../types';

export type PersonalPostTarget = {
  spaceId: string;
  paneId: string;
};

/**
 * 共有スペース画面上で「わたし」タブ選択中の表示・取得先 space_id。
 * shell（URL 正本）が shared のときだけ personalViewSpaceId を採用する。
 */
export function resolveContentSpaceId(params: {
  shellSpaceType: 'shared' | 'personal' | null | undefined;
  shellSpaceId: string | null;
  personalViewSpaceId: string | null;
}): string | null {
  if (params.shellSpaceType !== 'personal' && params.personalViewSpaceId) {
    return params.personalViewSpaceId;
  }
  return params.shellSpaceId;
}

/** 個人タブ表示中の投稿先（personal space + default pane）。 */
export function resolvePersonalPostTarget(
  personalViewSpaceId: string | null,
  defaultPaneIdFor: (spaceId: string) => string,
): PersonalPostTarget | null {
  if (!personalViewSpaceId) return null;
  return {
    spaceId: personalViewSpaceId,
    paneId: defaultPaneIdFor(personalViewSpaceId),
  };
}

export function applyPostTargetToInput(
  input: AddHossiiInput,
  target: PersonalPostTarget | null,
): AddHossiiInput {
  if (!target) return input;
  return {
    ...input,
    postSpaceId: target.spaceId,
    postPaneId: target.paneId,
  };
}

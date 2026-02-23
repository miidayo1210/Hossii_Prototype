// ユーザープロフィール（ローカル）
export type UserProfile = {
  id: string;
  defaultNickname: string;
  createdAt: Date;
};

// スペースごとのニックネーム（spaceId -> nickname）
export type SpaceNicknames = Record<string, string>;

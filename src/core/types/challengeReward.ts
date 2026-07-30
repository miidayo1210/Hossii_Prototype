export type ChallengeCompletion = {
  id: string;
  itemId: string;
  userId: string;
  responseId: string | null;
  completedAt: Date;
  createdAt: Date;
};

export type ChallengeReward = {
  id: string;
  completionId: string;
  userId: string;
  itemId: string;
  hossiiKey: string;
  awardedAt: Date;
  createdAt: Date;
};

export type SubmitChallengeCommentResult = {
  response: {
    id: string;
    itemId: string;
    userId: string;
    visibility: 'self_only' | 'manager_only';
    comment: string;
    createdAt: Date;
    updatedAt: Date;
  };
  completion: ChallengeCompletion;
  reward: ChallengeReward;
  isNewReward: boolean;
  wasInsert: boolean;
};

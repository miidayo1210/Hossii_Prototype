/** Display text stored in challenge_responses.comment for complete_button. */
export const CHALLENGE_COMPLETE_BUTTON_COMMENT = '完了しました';

/** Participant-facing CTA label. */
export const CHALLENGE_COMPLETE_BUTTON_LABEL = '完了する';

/** Response types the participant challenge UI can answer today. */
export const CHALLENGE_PARTICIPANT_RESPONSE_TYPES = [
  'comment',
  'complete_button',
  'choice3',
  'photo',
] as const;

export type ChallengeParticipantResponseType =
  (typeof CHALLENGE_PARTICIPANT_RESPONSE_TYPES)[number];

export function isChallengeParticipantResponseType(
  value: string,
): value is ChallengeParticipantResponseType {
  return (CHALLENGE_PARTICIPANT_RESPONSE_TYPES as readonly string[]).includes(
    value,
  );
}

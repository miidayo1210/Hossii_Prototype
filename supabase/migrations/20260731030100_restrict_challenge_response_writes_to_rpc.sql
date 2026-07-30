-- P5 follow-up: challenge_responses INSERT/UPDATE only via SECURITY DEFINER RPC.
-- Prevents participants from saving answers without completion/reward.
-- SELECT (owner/manager_only) and DELETE (owner) policies remain.

DROP POLICY IF EXISTS "challenge_responses_insert_member_published_comment"
  ON public.challenge_responses;

DROP POLICY IF EXISTS "challenge_responses_update_owner_active"
  ON public.challenge_responses;

-- Table privileges: clients may SELECT/DELETE under RLS; writes go through RPC owner.
REVOKE INSERT, UPDATE ON public.challenge_responses FROM authenticated;
GRANT SELECT, DELETE ON public.challenge_responses TO authenticated;

COMMENT ON TABLE public.challenge_responses IS
  '挑戦状コメント回答の正本。INSERT/UPDATE は submit_challenge_comment_response のみ。DELETEは本人可（completion/rewardは保持）。';

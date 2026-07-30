-- P4 follow-up: participant SELECT of programs/items is published-only.
-- ended/archived were previously readable by all active members, but P4 has no
-- trail UI and listPublishedChallengePrograms already filters published.
-- Own answers remain readable via challenge_responses RLS without exposing
-- ended/archived program metadata to every member.
-- Future trail can add a narrower policy (e.g. programs the user answered).

DROP POLICY IF EXISTS "challenge_programs_select_member_visible"
  ON public.challenge_programs;

CREATE POLICY "challenge_programs_select_member_visible"
  ON public.challenge_programs
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND public.is_active_space_member(space_id)
  );

DROP POLICY IF EXISTS "challenge_items_select_member_visible"
  ON public.challenge_items;

CREATE POLICY "challenge_items_select_member_visible"
  ON public.challenge_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_programs p
      WHERE p.id = challenge_items.program_id
        AND p.status = 'published'
        AND public.is_active_space_member(p.space_id)
    )
  );

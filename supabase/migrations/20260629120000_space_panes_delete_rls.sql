-- space_panes: allow DELETE for community admins and super admins (non-default panes only)

CREATE POLICY "space_panes_delete_admin"
  ON public.space_panes
  FOR DELETE
  USING (
    NOT is_default
    AND EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  );

CREATE POLICY "super_admin delete space_panes"
  ON public.space_panes
  FOR DELETE
  USING (
    NOT is_default
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

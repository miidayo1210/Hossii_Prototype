-- Fix EXECUTE grants for Phase 6 community RPCs (authenticated)

GRANT EXECUTE ON FUNCTION public.list_my_community_memberships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_community_nickname(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_community_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_community_invitation(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_community_invitation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_community_invitations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_community_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_community_home(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_community_shared_spaces(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_community_content(uuid) TO authenticated;

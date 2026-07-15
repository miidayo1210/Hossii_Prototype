import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'issue' | 'regenerate' | 'revoke';

type RequestBody = {
  spaceId: string;
  action: Action;
  slotNumber?: number;
  linkCommunityMembership?: boolean;
  linkSpaceMembership?: boolean;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function slugPrefix(spaceSlug: string): string {
  const cleaned = spaceSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20);
  return cleaned || 'space';
}

function formatLoginId(prefix: string, slotNumber: number): string {
  return `${prefix}-${String(slotNumber).padStart(2, '0')}`;
}

function buildAuthEmail(spaceId: string, loginId: string): string {
  const safeLoginId = loginId.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${spaceId}.${safeLoginId}@participants.internal`;
}

async function ensureCommunityMembershipForSpaceMember(
  adminClient: ReturnType<typeof createClient>,
  spaceId: string,
  authUserId: string,
) {
  const { error } = await adminClient.rpc('ensure_community_membership_for_space_member', {
    p_space_id: spaceId,
    p_auth_user_id: authUserId,
  });

  if (error) {
    console.error(
      '[issue-participant-account] ensure_community_membership_for_space_member failed:',
      error.message,
    );
  }
}

async function assertAdminAccess(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  role: string | undefined,
  spaceId: string
) {
  if (role === 'super_admin') return;

  if (role !== 'admin') {
    throw new Error('Forbidden');
  }

  const { data: space, error: spaceError } = await adminClient
    .from('spaces')
    .select('community_id')
    .eq('id', spaceId)
    .maybeSingle();

  if (spaceError || !space?.community_id) {
    throw new Error('Space not found');
  }

  const { data: community, error: communityError } = await adminClient
    .from('communities')
    .select('admin_id')
    .eq('id', space.community_id)
    .maybeSingle();

  if (communityError || community?.admin_id !== userId) {
    throw new Error('Forbidden');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const { spaceId, action, slotNumber, linkCommunityMembership, linkSpaceMembership } = body;

    if (!spaceId || !action) {
      return jsonResponse({ error: 'spaceId and action are required' }, 400);
    }

    const role = userData.user.app_metadata?.role as string | undefined;
    await assertAdminAccess(adminClient, userData.user.id, role, spaceId);

    const { data: spaceRow, error: spaceRowError } = await adminClient
      .from('spaces')
      .select('id, space_url, community_id')
      .eq('id', spaceId)
      .maybeSingle();

    if (spaceRowError || !spaceRow) {
      return jsonResponse({ error: 'Space not found' }, 404);
    }

    const spaceSlug = (spaceRow.space_url as string | null) ?? spaceId;
    const prefix = slugPrefix(spaceSlug);

    if (action === 'issue') {
      const { data: existing, error: existingError } = await adminClient
        .from('space_participant_accounts')
        .select('slot_number')
        .eq('space_id', spaceId)
        .eq('status', 'active');

      if (existingError) {
        return jsonResponse({ error: existingError.message }, 500);
      }

      const usedSlots = new Set((existing ?? []).map((row) => row.slot_number as number));
      if (usedSlots.size >= 20) {
        return jsonResponse({ error: 'Maximum 20 participant accounts per space' }, 400);
      }

      let targetSlot = slotNumber;
      if (targetSlot != null) {
        if (targetSlot < 1 || targetSlot > 20 || usedSlots.has(targetSlot)) {
          return jsonResponse({ error: 'Invalid or occupied slot number' }, 400);
        }
      } else {
        targetSlot = Array.from({ length: 20 }, (_, i) => i + 1).find((n) => !usedSlots.has(n));
        if (!targetSlot) {
          return jsonResponse({ error: 'No available slots' }, 400);
        }
      }

      const loginId = formatLoginId(prefix, targetSlot);
      const authEmail = buildAuthEmail(spaceId, loginId);
      const password = generatePassword();

      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        app_metadata: { participant: true },
      });

      if (createError || !createdUser.user) {
        return jsonResponse({ error: createError?.message ?? 'Failed to create auth user' }, 500);
      }

      const { error: insertError } = await adminClient.from('space_participant_accounts').insert({
        space_id: spaceId,
        slot_number: targetSlot,
        login_id: loginId,
        auth_user_id: createdUser.user.id,
        auth_email: authEmail,
        status: 'active',
        issued_by: userData.user.id,
      });

      if (insertError) {
        await adminClient.auth.admin.deleteUser(createdUser.user.id);
        return jsonResponse({ error: insertError.message }, 500);
      }

      if (linkCommunityMembership && spaceRow.community_id) {
        await adminClient.from('community_memberships').upsert(
          {
            community_id: spaceRow.community_id,
            auth_user_id: createdUser.user.id,
            role: 'member',
            status: 'active',
            invited_by: userData.user.id,
            accepted_at: new Date().toISOString(),
          },
          { onConflict: 'community_id,auth_user_id' },
        );
      }

      if (linkSpaceMembership) {
        await adminClient.from('space_memberships').upsert(
          {
            space_id: spaceId,
            auth_user_id: createdUser.user.id,
            role: 'member',
            status: 'active',
          },
          { onConflict: 'space_id,auth_user_id' },
        );

        await ensureCommunityMembershipForSpaceMember(
          adminClient,
          spaceId,
          createdUser.user.id,
        );
      }

      return jsonResponse({ loginId, password, slotNumber: targetSlot });
    }

    if (slotNumber == null || slotNumber < 1 || slotNumber > 20) {
      return jsonResponse({ error: 'slotNumber is required' }, 400);
    }

    const { data: account, error: accountError } = await adminClient
      .from('space_participant_accounts')
      .select('id, auth_user_id, login_id, status')
      .eq('space_id', spaceId)
      .eq('slot_number', slotNumber)
      .maybeSingle();

    if (accountError) {
      return jsonResponse({ error: accountError.message }, 500);
    }

    if (!account || account.status !== 'active') {
      return jsonResponse({ error: 'Account not found' }, 404);
    }

    if (action === 'regenerate') {
      const password = generatePassword();
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        account.auth_user_id as string,
        { password }
      );

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }

      return jsonResponse({
        loginId: account.login_id as string,
        password,
        slotNumber,
      });
    }

    if (action === 'revoke') {
      const { error: revokeError } = await adminClient
        .from('space_participant_accounts')
        .update({ status: 'revoked' })
        .eq('id', account.id);

      if (revokeError) {
        return jsonResponse({ error: revokeError.message }, 500);
      }

      await adminClient.auth.admin.updateUserById(account.auth_user_id as string, {
        ban_duration: '876000h',
      });

      return jsonResponse({ slotNumber, revoked: true });
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message === 'Forbidden' ? 403 : message === 'Space not found' ? 404 : 500;
    return jsonResponse({ error: message }, status);
  }
});

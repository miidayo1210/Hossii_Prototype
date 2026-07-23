import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  configured: true,
  rpc: vi.fn(),
}));

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMock.configured;
  },
  supabase: {
    rpc: (name: string, args: unknown) => supabaseMock.rpc(name, args),
  },
}));

import {
  TYPE_B_CREATE_RPC_NAME,
  TYPE_B_MESSAGE_MAX_LENGTH,
  buildTypeBCreateRpcArgs,
  createTypeBConnectedHossii,
  isTypeBCreateRpcMissingError,
  parseTypeBCreateRpcResponse,
} from './typeBCreateApi';

const baseInput = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  spaceId: 'dev-space-public',
  paneId: 'dev-space-public-pane-default',
  originHossiiId: 'dev-post-001',
  newHossiiId: 'tb2-new-001',
  message: '  Type B message  ',
  positionX: 40,
  positionY: 55,
};

const baseRpcResponse = {
  new_hossii_id: 'tb2-new-001',
  connection_id: '6765a988-ba04-429d-8253-2dee44685790',
  origin_hossii_id: 'dev-post-001',
  idempotent_replay: false,
};

describe('buildTypeBCreateRpcArgs', () => {
  it('maps camelCase input to snake_case RPC args and trims message', () => {
    expect(buildTypeBCreateRpcArgs(baseInput)).toEqual({
      p_idempotency_key: baseInput.idempotencyKey,
      p_space_id: baseInput.spaceId,
      p_pane_id: baseInput.paneId,
      p_origin_hossii_id: baseInput.originHossiiId,
      p_new_hossii_id: baseInput.newHossiiId,
      p_message: 'Type B message',
      p_position_x: 40,
      p_position_y: 55,
      p_emotion: null,
      p_author_id: null,
      p_author_name: null,
    });
  });

  it('passes optional fields when provided', () => {
    const args = buildTypeBCreateRpcArgs({
      ...baseInput,
      emotion: 'joy',
      authorId: 'profile-1',
      authorName: 'Tester',
    });
    expect(args).toMatchObject({
      p_emotion: 'joy',
      p_author_id: 'profile-1',
      p_author_name: 'Tester',
    });
  });

  it('does not include strength / reason / createdBy', () => {
    const args = buildTypeBCreateRpcArgs(baseInput);
    expect(args).not.toHaveProperty('p_strength');
    expect(args).not.toHaveProperty('reason_text');
    expect(args).not.toHaveProperty('created_by');
  });

  it('rejects empty message after trim', () => {
    expect(buildTypeBCreateRpcArgs({ ...baseInput, message: '   ' })).toEqual({
      ok: false,
      message: 'message must not be empty',
    });
  });

  it(`rejects message longer than ${TYPE_B_MESSAGE_MAX_LENGTH}`, () => {
    expect(
      buildTypeBCreateRpcArgs({ ...baseInput, message: 'x'.repeat(TYPE_B_MESSAGE_MAX_LENGTH + 1) }),
    ).toEqual({
      ok: false,
      message: `message must be at most ${TYPE_B_MESSAGE_MAX_LENGTH} characters`,
    });
  });
});

describe('parseTypeBCreateRpcResponse', () => {
  it('maps snake_case jsonb to camelCase result', () => {
    expect(parseTypeBCreateRpcResponse(baseRpcResponse)).toEqual({
      newHossiiId: 'tb2-new-001',
      connectionId: '6765a988-ba04-429d-8253-2dee44685790',
      originHossiiId: 'dev-post-001',
      idempotentReplay: false,
    });
  });

  it('accepts idempotent replay as normal success shape', () => {
    expect(
      parseTypeBCreateRpcResponse({
        ...baseRpcResponse,
        idempotent_replay: true,
      }),
    ).toMatchObject({ idempotentReplay: true });
  });

  it('rejects malformed response (fail closed)', () => {
    expect(parseTypeBCreateRpcResponse(null)).toEqual({
      ok: false,
      message: 'invalid RPC response',
    });
    expect(parseTypeBCreateRpcResponse({ ...baseRpcResponse, connection_id: '' })).toEqual({
      ok: false,
      message: 'invalid RPC response: connection_id',
    });
    expect(parseTypeBCreateRpcResponse({ ...baseRpcResponse, idempotent_replay: 'true' })).toEqual({
      ok: false,
      message: 'invalid RPC response: idempotent_replay',
    });
  });
});

describe('isTypeBCreateRpcMissingError', () => {
  it('detects PostgREST missing function errors', () => {
    expect(
      isTypeBCreateRpcMissingError({
        code: 'PGRST202',
        message: 'Could not find the function public.create_type_b_connected_hossii',
      }),
    ).toBe(true);
    expect(
      isTypeBCreateRpcMissingError({
        message: 'Could not find the function public.create_type_b_connected_hossii(uuid, text)',
      }),
    ).toBe(true);
    expect(isTypeBCreateRpcMissingError({ message: 'permission denied', code: '42501' })).toBe(false);
  });
});

describe('createTypeBConnectedHossii', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.rpc.mockReset();
  });

  it('calls RPC with converted args on success', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: baseRpcResponse, error: null });

    const res = await createTypeBConnectedHossii(baseInput);

    expect(supabaseMock.rpc).toHaveBeenCalledWith(TYPE_B_CREATE_RPC_NAME, {
      p_idempotency_key: baseInput.idempotencyKey,
      p_space_id: baseInput.spaceId,
      p_pane_id: baseInput.paneId,
      p_origin_hossii_id: baseInput.originHossiiId,
      p_new_hossii_id: baseInput.newHossiiId,
      p_message: 'Type B message',
      p_position_x: 40,
      p_position_y: 55,
      p_emotion: null,
      p_author_id: null,
      p_author_name: null,
    });
    expect(res).toEqual({
      ok: true,
      result: {
        newHossiiId: 'tb2-new-001',
        connectionId: '6765a988-ba04-429d-8253-2dee44685790',
        originHossiiId: 'dev-post-001',
        idempotentReplay: false,
      },
    });
  });

  it('returns idempotent replay as ok:true', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { ...baseRpcResponse, idempotent_replay: true },
      error: null,
    });

    const res = await createTypeBConnectedHossii(baseInput);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.idempotentReplay).toBe(true);
    }
  });

  it('surfaces Supabase RPC errors in unified format', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'authentication required', code: 'P0001' },
    });

    const res = await createTypeBConnectedHossii(baseInput);
    expect(res).toEqual({ ok: false, message: 'authentication required', code: 'P0001' });
  });

  it('maps RPC missing to distinguishable error', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.create_type_b_connected_hossii',
      },
    });

    const res = await createTypeBConnectedHossii(baseInput);
    expect(res).toEqual({
      ok: false,
      message: `${TYPE_B_CREATE_RPC_NAME} RPC is not available`,
      code: 'RPC_NOT_AVAILABLE',
    });
  });

  it('rejects malformed RPC response without throwing', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { new_hossii_id: 'only-id' }, error: null });

    const res = await createTypeBConnectedHossii(baseInput);
    expect(res).toEqual({ ok: false, message: 'invalid RPC response: connection_id' });
  });

  it('fails safely when Supabase is not configured', async () => {
    supabaseMock.configured = false;
    const res = await createTypeBConnectedHossii(baseInput);
    expect(res).toEqual({ ok: false, message: 'Supabase is not configured' });
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});

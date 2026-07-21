import { describe, expect, it } from 'vitest';
import { parseRouterHash } from './useRouter';

describe('parseRouterHash', () => {
  it('parses account screen from hash', () => {
    expect(parseRouterHash('#account')).toEqual({ screen: 'account' });
  });

  it('parses comments screen from hash', () => {
    expect(parseRouterHash('#comments')).toEqual({ screen: 'comments' });
  });

  it('parses neighbors screen from hash', () => {
    expect(parseRouterHash('#neighbors')).toEqual({ screen: 'neighbors' });
  });

  it('defaults empty hash to screen', () => {
    expect(parseRouterHash('')).toEqual({ screen: 'screen' });
  });

  it('parses community screen with param', () => {
    expect(parseRouterHash('#community/dev-community')).toEqual({
      screen: 'community',
      screenParam: 'dev-community',
    });
  });
});

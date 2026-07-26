import { describe, expect, it } from 'vitest';
import { resolveAccountAffiliationSource } from './resolveAccountAffiliationSource';

describe('resolveAccountAffiliationSource', () => {
  it('uses issued participant scope when participant=true', () => {
    expect(resolveAccountAffiliationSource(true)).toBe('issued_participant_scope');
  });

  it('uses memberships when participant=false', () => {
    expect(resolveAccountAffiliationSource(false)).toBe('memberships');
  });

  it('uses memberships when participant is undefined (regular / guest path)', () => {
    expect(resolveAccountAffiliationSource(undefined)).toBe('memberships');
  });
});

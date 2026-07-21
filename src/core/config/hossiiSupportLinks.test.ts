import { describe, expect, it } from 'vitest';
import {
  getVisibleHossiiSupportLinks,
  HOSSII_SUPPORT_LINK_DEFINITIONS,
  isPublishableSupportUrl,
} from './hossiiSupportLinks';

describe('hossiiSupportLinks', () => {
  it('rejects empty, hash, and invalid URLs', () => {
    expect(isPublishableSupportUrl(undefined)).toBe(false);
    expect(isPublishableSupportUrl('')).toBe(false);
    expect(isPublishableSupportUrl('   ')).toBe(false);
    expect(isPublishableSupportUrl('#')).toBe(false);
    expect(isPublishableSupportUrl('not-a-url')).toBe(false);
    expect(isPublishableSupportUrl('https://example.com/contact')).toBe(true);
  });

  it('shows configured links and hides unset URLs', () => {
    const visible = getVisibleHossiiSupportLinks();
    expect(visible.map((link) => link.id)).toEqual(['feedback', 'instagram']);
    expect(visible.every((link) => isPublishableSupportUrl(link.url))).toBe(true);
    expect(
      HOSSII_SUPPORT_LINK_DEFINITIONS.find((link) => link.id === 'x')?.url,
    ).toBeUndefined();
  });
});

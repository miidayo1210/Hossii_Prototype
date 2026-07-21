// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadAdminExportCsv } from './hossiiExportCsv';

describe('downloadAdminExportCsv blob lifecycle', () => {
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates and revokes an object URL when downloading', () => {
    downloadAdminExportCsv('a,b', 'test.csv');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('revokes the object URL even when click throws', () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => {
      throw new Error('click failed');
    });
    expect(() => downloadAdminExportCsv('a,b', 'test.csv')).toThrow('click failed');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('cleans up object URLs across repeated downloads', () => {
    createObjectURL.mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two');
    downloadAdminExportCsv('one', 'one.csv');
    downloadAdminExportCsv('two', 'two.csv');
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenNthCalledWith(1, 'blob:one');
    expect(revokeObjectURL).toHaveBeenNthCalledWith(2, 'blob:two');
  });
});

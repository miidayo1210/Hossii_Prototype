// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CAMERA_CAPTURE_NOTICE_STORAGE_KEY,
  dismissCameraCaptureNotice,
  isCameraCaptureNoticeDismissed,
} from './cameraCaptureNoticeStorage';

function createStorageMock(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('cameraCaptureNoticeStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('初期状態では未 dismiss', () => {
    expect(isCameraCaptureNoticeDismissed()).toBe(false);
  });

  it('dismiss 後は true になる', () => {
    dismissCameraCaptureNotice();
    expect(isCameraCaptureNoticeDismissed()).toBe(true);
    expect(localStorage.getItem(CAMERA_CAPTURE_NOTICE_STORAGE_KEY)).toBe('1');
  });
});

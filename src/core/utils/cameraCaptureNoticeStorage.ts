const STORAGE_KEY = 'hossii.cameraCaptureNotice.dismissed';

export function isCameraCaptureNoticeDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function dismissCameraCaptureNotice(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, '1');
}

/** @internal テスト用 */
export { STORAGE_KEY as CAMERA_CAPTURE_NOTICE_STORAGE_KEY };

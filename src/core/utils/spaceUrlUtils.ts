import type { Space } from '../types/space';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const generateSpaceURL = (): string => {
  const length = 8;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
};

export type SpaceURLValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * ユーザー入力（スラッグ単体、/s/...、完全 URL など）からスペース用スラッグを取り出す。
 * 検証は {@link validateSpaceURL} を別途呼ぶ。
 */
export const parseSpaceSlugFromInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const extractFromPath = (pathname: string): string | null => {
    // App.tsx の pathname 判定と揃える
    const communityMatch = pathname.match(
      /^\/c\/[a-z0-9][a-z0-9-]*\/s\/([a-z0-9][a-z0-9-]*)$/
    );
    if (communityMatch) return communityMatch[1];
    const legacyMatch = pathname.match(
      /^\/s\/([a-z0-9][a-z0-9-]*[a-z0-9]?[a-z0-9]*)$/
    );
    if (legacyMatch) return legacyMatch[1];
    return null;
  };

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const fromPath = extractFromPath(u.pathname);
      if (fromPath) return fromPath;
    } catch {
      /* fall through */
    }
  }

  const pathOnly = trimmed.split('?')[0] ?? trimmed;
  if (pathOnly.startsWith('/')) {
    const fromPath = extractFromPath(pathOnly);
    if (fromPath) return fromPath;
  }

  return trimmed;
};

export const validateSpaceURL = (url: string): SpaceURLValidationResult => {
  if (!url) {
    return { valid: false, error: 'URLを入力してください' };
  }
  if (url.length < 3) {
    return { valid: false, error: '3文字以上で入力してください' };
  }
  if (url.length > 40) {
    return { valid: false, error: '40文字以内で入力してください' };
  }
  // Only lowercase alphanumeric and hyphens; cannot start or end with hyphen
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(url) && !/^[a-z0-9]$/.test(url)) {
    return {
      valid: false,
      error: '半角英小文字・数字・ハイフンのみ使用可（先頭・末尾はハイフン不可）',
    };
  }
  return { valid: true };
};

export const isSpaceURLUnique = (
  url: string,
  spaces: Space[],
  excludeId?: string
): boolean => {
  return !spaces.some(
    (s) => s.spaceURL === url && s.id !== excludeId
  );
};

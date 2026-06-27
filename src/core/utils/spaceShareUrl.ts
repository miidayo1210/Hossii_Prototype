import { buildUrlWithPaneSlug } from './paneUrl';

export type SpaceShareUrlParams = {
  origin: string;
  communitySlug: string | null | undefined;
  spaceURL: string | undefined;
  activeSpaceId: string;
};

function buildSpacePath(params: SpaceShareUrlParams): string | null {
  const { origin, communitySlug, spaceURL } = params;
  if (!spaceURL) return null;
  return communitySlug
    ? `${origin}/c/${communitySlug}/s/${spaceURL}`
    : `${origin}/s/${spaceURL}`;
}

/** QR・書き出し用のスペース共有 URL（pane なし — 既存 QR と同一、デフォルト Pane 到達） */
export function buildSpaceShareUrl(params: SpaceShareUrlParams): string {
  const path = buildSpacePath(params);
  if (path) return path;
  return `${params.origin}?space=${params.activeSpaceId}`;
}

/** 追加 Pane 用共有 URL（必ず ?pane= を付与。pathname ベース URL のみ） */
export function buildPaneShareUrl(
  params: SpaceShareUrlParams & { paneSlug: string },
): string | null {
  const path = buildSpacePath(params);
  if (!path) return null;

  const url = new URL(path);
  const relative = buildUrlWithPaneSlug(params.paneSlug, {
    pathname: url.pathname,
    search: url.search,
    hash: '',
  });
  return `${url.origin}${relative}`;
}

/** Pane 種別に応じた共有 URL（default → pane なし、追加 → ?pane=） */
export function buildShareUrlForPane(
  params: SpaceShareUrlParams & { pane: { slug: string; isDefault: boolean } },
): string {
  if (params.pane.isDefault) {
    return buildSpaceShareUrl(params);
  }
  const paneUrl = buildPaneShareUrl({ ...params, paneSlug: params.pane.slug });
  return paneUrl ?? buildSpaceShareUrl(params);
}

/** QR ダウンロード用ファイル名 */
export function paneQrDownloadFilename(
  spaceURL: string | undefined,
  spaceId: string,
  paneSlug: string,
): string {
  const base = spaceURL?.trim() || spaceId;
  const safe = base.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `qr-${safe}-${paneSlug}.png`;
}

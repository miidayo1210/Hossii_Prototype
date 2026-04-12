/** QR・書き出し用のスペース共有 URL（QRCodePanel と同じ規則） */
export function buildSpaceShareUrl(params: {
  origin: string;
  communitySlug: string | null | undefined;
  spaceURL: string | undefined;
  activeSpaceId: string;
}): string {
  const { origin, communitySlug, spaceURL, activeSpaceId } = params;
  if (spaceURL) {
    return communitySlug
      ? `${origin}/c/${communitySlug}/s/${spaceURL}`
      : `${origin}/s/${spaceURL}`;
  }
  return `${origin}?space=${activeSpaceId}`;
}

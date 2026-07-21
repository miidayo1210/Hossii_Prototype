export type HossiiSupportLinkId = 'feedback' | 'instagram' | 'x';

/**
 * Hossii 公式導線 URL。ここだけを更新すればアカウント画面に反映される。
 * 未設定・空文字・ `#` の項目は表示しない。
 */
export const HOSSII_SUPPORT_LINK_URLS = {
  feedback: 'https://forms.gle/q7Y3YnDTsJxgXNa98',
  instagram: 'https://www.instagram.com/hossiidayon/',
  x: undefined,
} as const satisfies Record<HossiiSupportLinkId, string | undefined>;

export type HossiiSupportLinkDefinition = {
  id: HossiiSupportLinkId;
  label: string;
  description?: string;
  url: string | undefined;
  ariaLabel: string;
};

export const HOSSII_SUPPORT_LINK_DEFINITIONS: readonly HossiiSupportLinkDefinition[] = [
  {
    id: 'feedback',
    label: '質問・不具合を送る',
    description: '使い方の質問や不具合報告はこちら',
    url: HOSSII_SUPPORT_LINK_URLS.feedback,
    ariaLabel: '質問・不具合を送る（外部サイトで開く）',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    url: HOSSII_SUPPORT_LINK_URLS.instagram,
    ariaLabel: 'Hossii の Instagram（外部サイトで開く）',
  },
  {
    id: 'x',
    label: 'X',
    url: HOSSII_SUPPORT_LINK_URLS.x,
    ariaLabel: 'Hossii の X（外部サイトで開く）',
  },
];

export function isPublishableSupportUrl(url: string | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getVisibleHossiiSupportLinks(): Array<
  HossiiSupportLinkDefinition & { url: string }
> {
  return HOSSII_SUPPORT_LINK_DEFINITIONS.filter(
    (link): link is HossiiSupportLinkDefinition & { url: string } =>
      isPublishableSupportUrl(link.url),
  );
}

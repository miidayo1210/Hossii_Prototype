export type SettingsScreenId =
  | 'spaceMode'
  | 'basicInfo'
  | 'publicShare'
  | 'postForm'
  | 'paneManagement'
  | 'interactionRules'
  | 'tags'
  | 'background'
  | 'appearance'
  | 'character'
  | 'decoration'
  | 'moderation'
  | 'exportRecord'
  | 'neighbors'
  | 'participantAccounts'
  | 'spaceMembers';

export type NavItem = {
  id: SettingsScreenId;
  label: string;
  description?: string;
  adminOnly?: boolean;
};

export type NavGroup = {
  heading: string;
  items: NavItem[];
};

export const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    heading: 'このスペースの使い方',
    items: [{ id: 'spaceMode', label: 'スペースモード' }],
  },
  {
    heading: 'スペース',
    items: [
      { id: 'basicInfo', label: '基本情報' },
      { id: 'publicShare', label: '公開・共有' },
    ],
  },
  {
    heading: '参加・投稿',
    items: [
      { id: 'postForm', label: '投稿フォーム' },
      { id: 'paneManagement', label: 'タブ管理', adminOnly: true },
      { id: 'interactionRules', label: '投稿・交流ルール' },
      { id: 'tags', label: 'タグ', adminOnly: true },
    ],
  },
  {
    heading: 'デザイン',
    items: [
      { id: 'background', label: '背景' },
      { id: 'appearance', label: '投稿の見た目' },
      { id: 'character', label: '中心キャラクター', adminOnly: true },
      { id: 'decoration', label: '装飾' },
    ],
  },
  {
    heading: '運営',
    items: [
      { id: 'moderation', label: '投稿管理', adminOnly: true },
      { id: 'spaceMembers', label: 'スペースメンバー', description: '招待制スペースの参加メンバーを管理', adminOnly: true },
      { id: 'participantAccounts', label: '参加者アカウント', adminOnly: true },
      { id: 'exportRecord', label: '出力・記録', adminOnly: true },
      { id: 'neighbors', label: '隣のスペース', adminOnly: true },
    ],
  },
];

export const EXPLICIT_SAVE_SCREENS = new Set<SettingsScreenId>([
  'basicInfo',
  'publicShare',
  'postForm',
  'interactionRules',
  'background',
  'appearance',
  'character',
]);

/** Tabs that support per-pane setting override (Phase 7). */
export const PANE_OVERRIDE_SCREENS = new Set<SettingsScreenId>([
  'background',
  'postForm',
  'interactionRules',
  'appearance',
  'character',
  'decoration',
]);

export const DEFAULT_SETTINGS_SCREEN: SettingsScreenId = 'basicInfo';

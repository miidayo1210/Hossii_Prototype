export type SettingsScreenId =
  | 'spaceMode'
  | 'basicInfo'
  | 'publicShare'
  | 'postForm'
  | 'interactionRules'
  | 'tags'
  | 'background'
  | 'appearance'
  | 'character'
  | 'decoration'
  | 'moderation'
  | 'exportRecord'
  | 'neighbors';

export type NavItem = {
  id: SettingsScreenId;
  label: string;
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
      { id: 'interactionRules', label: '投稿・交流ルール' },
      { id: 'tags', label: 'タグ', adminOnly: true },
    ],
  },
  {
    heading: 'デザイン',
    items: [
      { id: 'background', label: '背景' },
      { id: 'appearance', label: '投稿の見た目' },
      { id: 'character', label: '中心キャラクター' },
      { id: 'decoration', label: '装飾' },
    ],
  },
  {
    heading: '運営',
    items: [
      { id: 'moderation', label: '投稿管理', adminOnly: true },
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

export const DEFAULT_SETTINGS_SCREEN: SettingsScreenId = 'basicInfo';

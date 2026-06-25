import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';

export const ExportRecordTab = () => (
  <SettingsPageHeader
    title="出力・記録"
    description="スペースの内容を外部に出力・記録する機能です。"
  >
    <SettingsSection
      title="スペースを画像で保存"
      description="スペース画面の表示内容を PNG 画像として書き出せます。"
    >
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
        コミュニティ管理者は、スペース画面右上のメニューからいつでも PNG 書き出しを利用できます。
      </p>
    </SettingsSection>
  </SettingsPageHeader>
);

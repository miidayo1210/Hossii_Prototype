import { useEffect, useState } from 'react';
import type { Space } from '../../core/types/space';
import { setSpaceArchived } from '../../core/utils/spaceArchiveApi';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import sharedStyles from './SettingsShared.module.css';
import formStyles from './GeneralTab.module.css';
import styles from './SpaceArchiveTab.module.css';

const ARCHIVE_ON_CONFIRM =
  'このスペースをアーカイブしますか？\n\nアーカイブすると閲覧専用になり、新しい投稿や投稿内容の変更ができなくなります。あとから解除できます。';

const ARCHIVE_OFF_CONFIRM =
  'アーカイブを解除しますか？\n\n通常どおり投稿・編集ができるようになります。';

const ARCHIVE_DESCRIPTION =
  'アーカイブすると、このスペースは閲覧専用になります。過去の投稿は引き続き見ることができますが、新しい投稿や投稿内容の変更はできません。あとからアーカイブを解除できます。';

export type ArchiveChangePatch = {
  isArchived: boolean;
  archivedAt: Date | undefined;
  archivedBy: string | undefined;
};

type Props = {
  space: Space;
  onArchiveChange: (patch: ArchiveChangePatch) => void;
};

export const SpaceArchiveTab = ({ space, onArchiveChange }: Props) => {
  const isArchived = space.isArchived === true;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [space.id, isArchived]);

  const handleToggle = async (nextArchived: boolean) => {
    if (isLoading || nextArchived === isArchived) return;

    const confirmed = window.confirm(nextArchived ? ARCHIVE_ON_CONFIRM : ARCHIVE_OFF_CONFIRM);
    if (!confirmed) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await setSpaceArchived(space.id, nextArchived);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onArchiveChange({
        isArchived: result.isArchived,
        archivedAt: result.archivedAt ? new Date(result.archivedAt) : undefined,
        archivedBy: result.archivedBy ?? undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="アーカイブ"
        description="終了したイベントや活動のスペースを、削除せず閲覧専用として保存します。"
      >
        <SettingsSection title="スペースをアーカイブ">
          <p className={formStyles.description}>{ARCHIVE_DESCRIPTION}</p>
          <div className={styles.toggleRow}>
            <span className={formStyles.toggleLabel} id="space-archive-toggle-label">
              スペースをアーカイブ
            </span>
            <label className={formStyles.toggleWrapper}>
              <input
                type="checkbox"
                className={formStyles.toggleInput}
                checked={isArchived}
                disabled={isLoading}
                onChange={(e) => void handleToggle(e.target.checked)}
                aria-labelledby="space-archive-toggle-label"
                aria-busy={isLoading}
              />
              <span className={formStyles.toggleSlider} />
            </label>
          </div>
          {isArchived && (
            <p className={styles.archivedStatus} role="status">
              現在、このスペースは閲覧専用です
            </p>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </SettingsSection>
      </SettingsPageHeader>

      {isLoading && (
        <div className={`${sharedStyles.toast} ${sharedStyles.toastSuccess}`} role="status">
          保存中...
        </div>
      )}
    </>
  );
};

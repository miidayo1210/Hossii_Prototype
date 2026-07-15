import { SPACE_ARCHIVE_POST_DISABLED_MESSAGE } from '../../core/utils/spaceArchivePolicy';
import styles from './SpaceArchivePostNotice.module.css';

export function SpaceArchivePostNotice() {
  return (
    <div className={styles.notice} role="status" data-space-export="exclude">
      {SPACE_ARCHIVE_POST_DISABLED_MESSAGE}
    </div>
  );
}

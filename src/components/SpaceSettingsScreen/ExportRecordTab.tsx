import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Space } from '../../core/types/space';
import type { SpacePane } from '../../core/types/spacePane';
import { useAuth } from '../../core/contexts/useAuth';
import { canManageSpace } from '../../core/utils/spaceAdminAccess';
import { fetchSpacePanes } from '../../core/utils/spacePanesApi';
import { fetchAllAdminExportHossiis } from '../../core/utils/hossiiExportApi';
import {
  buildAdminExportCsv,
  buildAdminExportFilename,
  downloadAdminExportCsv,
} from '../../core/utils/hossiiExportCsv';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import formStyles from './GeneralTab.module.css';
import styles from './ExportRecordTab.module.css';

const EXPORT_CONFIRM =
  'このCSVには、スペース内で投稿された回答が含まれます。回答者のメールアドレスや認証情報は含まれません。取得したデータは、参加者に説明した目的の範囲内で取り扱ってください。\n\nCSVをエクスポートしますか？';

const DISPLAY_NAME_WARNING =
  '表示名には、投稿者が入力した個人情報が含まれる可能性があります。';

const IMAGE_URL_WARNING = '画像URLはCSVの共有先から閲覧される可能性があります。';

const ALL_PANES_VALUE = '__all__';

type Props = {
  space: Space;
};

function isExportEligibleSpace(space: Space): boolean {
  return space.spaceType !== 'personal' && !!space.communityId;
}

export const ExportRecordTab = ({ space }: Props) => {
  const { currentUser } = useAuth();
  const canExport = canManageSpace(currentUser, space) && isExportEligibleSpace(space);

  const [panes, setPanes] = useState<SpacePane[]>([]);
  const [panesLoading, setPanesLoading] = useState(true);
  const [selectedPaneId, setSelectedPaneId] = useState(ALL_PANES_VALUE);
  const [includeAuthorDisplayNames, setIncludeAuthorDisplayNames] = useState(false);
  const [includeImageUrls, setIncludeImageUrls] = useState(false);

  const [countLoading, setCountLoading] = useState(false);
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const paneLabel = useMemo(() => {
    if (selectedPaneId === ALL_PANES_VALUE) return '全タブ';
    return panes.find((pane) => pane.id === selectedPaneId)?.name ?? '特定タブ';
  }, [panes, selectedPaneId]);

  useEffect(() => {
    let cancelled = false;
    setPanesLoading(true);
    fetchSpacePanes(space.id)
      .then((loaded) => {
        if (cancelled) return;
        setPanes(loaded);
      })
      .catch(() => {
        if (!cancelled) setPanes([]);
      })
      .finally(() => {
        if (!cancelled) setPanesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [space.id]);

  const countAbortRef = useRef<AbortController | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      countAbortRef.current?.abort();
      exportAbortRef.current?.abort();
    };
  }, []);

  const beginCountFetch = useCallback(() => {
    countAbortRef.current?.abort();
    const controller = new AbortController();
    countAbortRef.current = controller;
    return controller.signal;
  }, []);

  const beginExportFetch = useCallback(() => {
    exportAbortRef.current?.abort();
    const controller = new AbortController();
    exportAbortRef.current = controller;
    return controller.signal;
  }, []);

  const buildFetchOptions = useCallback(
    (signal: AbortSignal, onProgress?: (fetchedCount: number, pageCount: number) => void) => ({
      spaceId: space.id,
      spacePaneId: selectedPaneId === ALL_PANES_VALUE ? null : selectedPaneId,
      includeAuthorDisplayNames,
      includeImageUrls,
      signal,
      onProgress: onProgress
        ? (progress: { fetchedCount: number; pageCount: number }) =>
            onProgress(progress.fetchedCount, progress.pageCount)
        : undefined,
    }),
    [space.id, selectedPaneId, includeAuthorDisplayNames, includeImageUrls],
  );

  const refreshCount = useCallback(async () => {
    if (!canExport) return;
    const signal = beginCountFetch();
    setCountLoading(true);
    setCountError(null);
    setExportCount(null);
    try {
      const result = await fetchAllAdminExportHossiis(buildFetchOptions(signal));
      if (signal.aborted) return;
      if (!result.ok) {
        if (result.message !== 'aborted') setCountError(result.message);
        return;
      }
      setExportCount(result.data.length);
    } finally {
      setCountLoading(false);
    }
  }, [beginCountFetch, buildFetchOptions, canExport]);

  useEffect(() => {
    setExportError(null);
    setExportSuccess(null);
    if (!canExport) {
      setExportCount(null);
      return;
    }
    void refreshCount();
  }, [canExport, refreshCount]);

  const handleExport = async () => {
    if (!canExport || exporting) return;
    if (!window.confirm(EXPORT_CONFIRM)) return;

    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    setExportProgress('回答を取得しています…');

    const signal = beginExportFetch();
    try {
      const result = await fetchAllAdminExportHossiis(
        buildFetchOptions(signal, (fetchedCount, pageCount) => {
          if (signal.aborted) return;
          setExportProgress(`${fetchedCount}件を取得しました（${pageCount}ページ目）`);
        }),
      );

      if (signal.aborted) return;

      if (!result.ok) {
        if (result.message === 'aborted') return;
        const suffix =
          typeof result.partialCount === 'number' && result.partialCount > 0
            ? `（${result.partialCount}件まで取得済み）`
            : '';
        setExportError(`${result.message}${suffix}`);
        return;
      }

      if (result.data.length === 0) {
        setExportCount(0);
        setExportError('エクスポートできる回答がありません');
        return;
      }

      const exportedAt = new Date();
      const csv = buildAdminExportCsv({
        items: result.data,
        spaceName: space.name,
        exportedAt,
        includeAuthorDisplayNames,
        includeImageUrls,
      });

      if (!csv) {
        setExportError('エクスポートできる回答がありません');
        return;
      }

      const filename = buildAdminExportFilename(space.name, paneLabel, exportedAt);
      downloadAdminExportCsv(csv, filename);
      setExportCount(result.data.length);
      setExportSuccess(`${result.data.length}件の回答をCSVでダウンロードしました`);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <SettingsPageHeader
      title="出力・記録"
      description="スペースの内容を外部に出力・記録する機能です。"
    >
      <SettingsSection
        title="スペースを画像で保存"
        description="スペース画面の表示内容を PNG 画像として書き出せます。"
      >
        <p className={formStyles.description}>
          コミュニティ管理者は、スペース画面右上のメニューからいつでも PNG 書き出しを利用できます。
        </p>
      </SettingsSection>

      <SettingsSection
        title="回答履歴エクスポート"
        description="スペース内の回答をCSV形式でダウンロードします。対象期間は全期間です。"
      >
        {!canExport ? (
          <p className={styles.ineligible} role="status">
            {space.spaceType === 'personal'
              ? '個人スペースでは回答履歴エクスポートを利用できません。'
              : 'このスペースの回答履歴エクスポートは、コミュニティ管理者のみ利用できます。'}
          </p>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="export-pane-select">
                対象タブ
              </label>
              <select
                id="export-pane-select"
                className={styles.select}
                value={selectedPaneId}
                disabled={panesLoading || exporting || countLoading}
                onChange={(e) => setSelectedPaneId(e.target.value)}
              >
                <option value={ALL_PANES_VALUE}>すべてのタブ</option>
                {panes.map((pane) => (
                  <option key={pane.id} value={pane.id}>
                    {pane.name}
                  </option>
                ))}
              </select>
              <p className={styles.note}>対象期間: 全期間（変更不可）</p>
            </div>

            <div className={styles.checkboxRow}>
              <input
                id="export-include-display-name"
                type="checkbox"
                checked={includeAuthorDisplayNames}
                disabled={exporting}
                onChange={(e) => setIncludeAuthorDisplayNames(e.target.checked)}
              />
              <div className={styles.checkboxText}>
                <label className={styles.checkboxLabel} htmlFor="export-include-display-name">
                  投稿者表示名を含める
                </label>
                {includeAuthorDisplayNames && (
                  <p className={styles.warning}>{DISPLAY_NAME_WARNING}</p>
                )}
              </div>
            </div>

            <div className={styles.checkboxRow}>
              <input
                id="export-include-image-url"
                type="checkbox"
                checked={includeImageUrls}
                disabled={exporting}
                onChange={(e) => setIncludeImageUrls(e.target.checked)}
              />
              <div className={styles.checkboxText}>
                <label className={styles.checkboxLabel} htmlFor="export-include-image-url">
                  画像URLを含める
                </label>
                {includeImageUrls && <p className={styles.warning}>{IMAGE_URL_WARNING}</p>}
              </div>
            </div>

            <div className={styles.countRow}>
              <span className={styles.label}>対象回答数</span>
              <span className={styles.countValue} aria-live="polite">
                {countLoading
                  ? '確認中…'
                  : exportCount === null
                    ? '—'
                    : `${exportCount.toLocaleString()}件`}
              </span>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={exporting || countLoading || panesLoading}
                onClick={() => void handleExport()}
              >
                {exporting ? 'エクスポート中…' : 'CSVをエクスポート'}
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={exporting || countLoading}
                onClick={() => void refreshCount()}
              >
                件数を再確認
              </button>
            </div>

            {exportProgress && (
              <p className={styles.progress} role="status">
                {exportProgress}
              </p>
            )}
            {countError && (
              <p className={styles.error} role="alert">
                件数の確認に失敗しました: {countError}
              </p>
            )}
            {exportError && (
              <p className={styles.error} role="alert">
                {exportError}
              </p>
            )}
            {exportSuccess && (
              <p className={styles.success} role="status">
                {exportSuccess}
              </p>
            )}
          </>
        )}
      </SettingsSection>
    </SettingsPageHeader>
  );
};

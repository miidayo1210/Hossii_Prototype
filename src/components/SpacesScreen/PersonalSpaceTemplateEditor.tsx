import { useState, useEffect, useCallback } from 'react';
import { UserSquare } from 'lucide-react';
import {
  fetchCommunityPersonalSpaceTemplate,
  saveCommunityPersonalSpaceTemplate,
  type PersonalSpaceTemplate,
} from '../../core/utils/personalSpaceTemplateApi';
import styles from './PersonalSpaceTemplateEditor.module.css';

type Status = 'loading' | 'ready' | 'error';

const BACKGROUND_PATTERNS = ['mist', 'nebula', 'galaxy', 'stars'] as const;

/**
 * Phase 4: コミュニティ管理者向けの個人スペーステンプレート編集（最小 UI）。
 *
 * - community に属するテンプレート（名前・背景）を編集する。
 * - 個人スペースの「新規作成時」にのみ適用される。既存スペースは変わらない旨を明示。
 * - 編集は communities の RLS でコミュニティ管理者・super_admin のみに限定される
 *   （一般メンバー・ゲストは保存が 0 行 → 失敗表示）。
 * - 詳細（タブ初期構成・投稿フォーム）は将来の詳細 UI に委ねる（テンプレート JSON は温存）。
 */
export const PersonalSpaceTemplateEditor = ({ communityId }: { communityId: string }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [enabled, setEnabled] = useState(false);
  const [namePattern, setNamePattern] = useState('');
  const [bgValue, setBgValue] = useState<string>('mist');
  const [rest, setRest] = useState<PersonalSpaceTemplate>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const tmpl = await fetchCommunityPersonalSpaceTemplate(communityId);
      const t = tmpl ?? {};
      setEnabled(!!t.enabled);
      setNamePattern(t.name_pattern ?? '');
      setBgValue(t.background?.value ?? 'mist');
      // 既知フィールド以外（panes / space_settings 等）は温存する
      const { enabled: _e, name_pattern: _n, background: _b, ...others } = t;
      void _e; void _n; void _b;
      setRest(others);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [communityId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const template: PersonalSpaceTemplate = {
      ...rest,
      enabled,
      name_pattern: namePattern.trim() || undefined,
      background: { kind: 'pattern', value: bgValue },
    };
    const res = await saveCommunityPersonalSpaceTemplate(communityId, template);
    setSaving(false);
    if (!res.ok) {
      setError('保存に失敗しました。権限をご確認ください。');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (status === 'loading') {
    return <p className={styles.note}>テンプレートを読み込み中…</p>;
  }
  if (status === 'error') {
    return (
      <div className={styles.note}>
        <p>テンプレートの取得に失敗しました。</p>
        <button type="button" className={styles.retryBtn} onClick={() => void load()}>再読み込み</button>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <UserSquare size={16} />
        <h3 className={styles.title}>個人スペーステンプレート</h3>
      </div>
      <p className={styles.desc}>
        メンバーがこのコミュニティ内で個人スペースを<strong>新規作成するとき</strong>の初期設定です。
        変更しても、すでに作成済みの個人スペースには反映されません。
      </p>

      <label className={styles.toggleRow}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>テンプレートを有効にする</span>
      </label>

      <div className={styles.field}>
        <label className={styles.label}>スペース名の初期値</label>
        <input
          className={styles.input}
          type="text"
          value={namePattern}
          maxLength={100}
          placeholder="例: ふりかえりスペース（未入力なら「個人スペース」）"
          disabled={!enabled}
          onChange={(e) => setNamePattern(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>背景パターン</label>
        <select
          className={styles.input}
          value={bgValue}
          disabled={!enabled}
          onChange={(e) => setBgValue(e.target.value)}
        >
          {BACKGROUND_PATTERNS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.saveBtn} disabled={saving} onClick={() => void save()}>
          {saving ? '保存中…' : saved ? '保存しました ✓' : '保存'}
        </button>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    </div>
  );
};

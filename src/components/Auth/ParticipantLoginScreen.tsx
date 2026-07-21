import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../core/contexts/useAuth';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { HOSSII_IDLE } from '../../core/assets/hossiiIdle';
import styles from './ParticipantLoginScreen.module.css';

const HOSSII_SORRY = '/hossii/greeting/sorry.png';

const SPEECH_INTRO = `アカウントで参加するよ！
案内された参加IDと
パスワードを入力してね`;

const SPEECH_READY = `準備できたよ！
参加してみてね`;

const SPEECH_ERROR = `うまくログインできなかったみたい
参加IDとパスワードを確認してみてね`;

type Props = {
  spaceId: string;
  onClose: () => void;
};

function resolveFormError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  const lower = message.toLowerCase();
  if (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror')
  ) {
    return 'うまく接続できなかったみたい。少し待って、もう一度試してみてね';
  }
  if (message.includes('Invalid login credentials') || message.includes('正しくありません')) {
    return '参加IDまたはパスワードを確認してみてね';
  }
  if (message) {
    return '参加IDまたはパスワードを確認してみてね';
  }
  return '参加IDまたはパスワードを確認してみてね';
}

function resolveHossiiImageSrc(input: {
  hasError: boolean;
  loading: boolean;
  canSubmit: boolean;
}): string {
  if (input.hasError) return HOSSII_SORRY;
  if (input.loading) return HOSSII_IDLE.closingEye;
  if (input.canSubmit) return HOSSII_IDLE.smile;
  return HOSSII_IDLE.base;
}

function resolveSpeechText(input: {
  hasError: boolean;
  canSubmit: boolean;
  loading: boolean;
}): string {
  if (input.hasError) return SPEECH_ERROR;
  if (input.canSubmit && !input.loading) return SPEECH_READY;
  return SPEECH_INTRO;
}

export const ParticipantLoginScreen = ({ spaceId, onClose }: Props) => {
  const { loginParticipant } = useAuth();
  const { state } = useHossiiStore();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const space = state.spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name ?? 'スペース';
  const trimmedLoginId = loginId.trim();
  const canSubmit = trimmedLoginId.length > 0 && password.length > 0;
  const hasError = error !== null;

  const hossiiSrc = resolveHossiiImageSrc({ hasError, loading, canSubmit });
  const hossiiKey = hasError ? 'sorry' : loading ? 'closing' : canSubmit ? 'smile' : 'base';
  const speechText = resolveSpeechText({ hasError, canSubmit, loading });

  const clearError = () => {
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !canSubmit) return;

    setError(null);

    setLoading(true);
    try {
      await loginParticipant(spaceId, trimmedLoginId, password);
    } catch (err: unknown) {
      console.error('Participant login error:', err);
      setError(resolveFormError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />

      <div className={styles.card}>
        <button type="button" className={styles.stepBackButton} onClick={onClose}>
          ← 戻る
        </button>

        <div className={styles.header}>
          <h1 className={styles.logo}>✨ Hossii</h1>
          <p className={styles.spaceName}>{spaceName}</p>
        </div>

        <div className={styles.hossiiArea}>
          <img
            key={hossiiKey}
            src={hossiiSrc}
            alt="Hossii"
            className={styles.hossiiImage}
          />
        </div>

        <div className={styles.speechBubble}>
          <p className={styles.speechText}>{speechText}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={styles.form}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.nativeEvent.isComposing) {
              e.preventDefault();
            }
          }}
        >
          <label className={styles.fieldLabel} htmlFor="participant-login-id">
            参加ID
          </label>
          <input
            id="participant-login-id"
            type="text"
            className={styles.textInput}
            placeholder="参加IDを入力"
            value={loginId}
            onChange={(e) => {
              setLoginId(e.target.value);
              clearError();
            }}
            autoComplete="username"
            disabled={loading}
            autoFocus
          />

          <label className={styles.fieldLabel} htmlFor="participant-login-password">
            パスワード
          </label>
          <div className={styles.passwordRow}>
            <input
              id="participant-login-password"
              type={showPassword ? 'text' : 'password'}
              className={styles.textInput}
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={!canSubmit || loading}
            aria-disabled={!canSubmit || loading}
          >
            {loading ? '参加しています…' : '参加する'}
          </button>
        </form>
      </div>
    </div>
  );
};

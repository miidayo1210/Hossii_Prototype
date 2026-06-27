import { useState } from 'react';
import { Hash } from 'lucide-react';
import { AuthEntryShell } from '../Auth/AuthEntryShell';
import shell from '../Auth/authEntryShell.module.css';
import authStyles from '../Auth/LoginScreen.module.css';
import { navigateAuthRoute } from '../../core/utils/authRoute';
import { parseSpaceSlugFromInput, validateSpaceURL } from '../../core/utils/spaceUrlUtils';
import styles from './StartScreen.module.css';

export const StartScreen = () => {
  const [rawInput, setRawInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const slug = parseSpaceSlugFromInput(rawInput);
    const validation = validateSpaceURL(slug);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    window.location.assign(`${window.location.origin}/s/${encodeURIComponent(slug)}`);
  };

  return (
    <AuthEntryShell>
      <div className={`${shell.glassCard} ${shell.cardEnter}`}>
        <div className={authStyles.header}>
          <h1 className={authStyles.title}>✨ Hossii</h1>
          <p className={authStyles.subtitle}>
            気持ちを、つながる空間に置いていこう
          </p>
        </div>

        <p className={styles.lead}>
          スペースのID、または共有URLを入力して参加できます。
        </p>

        <form onSubmit={handleJoin} className={authStyles.form}>
          {error && (
            <div className={authStyles.error} role="alert">
              {error}
            </div>
          )}

          <div className={authStyles.inputGroup}>
            <Hash size={18} className={authStyles.inputIcon} />
            <input
              type="text"
              className={authStyles.input}
              placeholder="スペースID または URL"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label="スペースID または URL"
            />
          </div>

          <button type="submit" className={authStyles.submitButton}>
            スペースに参加
          </button>
        </form>

        <div className={authStyles.divider}>
          <span className={authStyles.dividerText}>または</span>
        </div>

        <div className={styles.authLinks}>
          <button
            type="button"
            className={authStyles.submitButton}
            onClick={() => navigateAuthRoute('login')}
          >
            アカウントでログイン
          </button>
          <p className={styles.signupHint}>
            はじめての方はこちら{' '}
            <button
              type="button"
              className={styles.signupLink}
              onClick={() => navigateAuthRoute('signup')}
            >
              新規登録
            </button>
          </p>
        </div>
      </div>
    </AuthEntryShell>
  );
};

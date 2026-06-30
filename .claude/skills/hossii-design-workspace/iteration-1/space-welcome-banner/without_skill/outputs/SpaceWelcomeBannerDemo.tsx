import { useState } from 'react';
import { SpaceWelcomeBanner } from './SpaceWelcomeBanner';

const DEMO_SPACE_ID = 'demo-space-welcome-banner';

/**
 * スタンドアロン確認用。SpaceScreen 相当の背景の上にバナーを重ねて表示する。
 */
export function SpaceWelcomeBannerDemo() {
  const [key, setKey] = useState(0);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const reset = () => {
    try {
      localStorage.removeItem(`hossii.spaceWelcomeBanner.dismissed.${DEMO_SPACE_ID}`);
    } catch {
      /* noop */
    }
    setLastAction(null);
    setKey((k) => k + 1);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at 20% 0%, rgba(168,85,247,0.35) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(236,72,153,0.25) 0%, transparent 55%), linear-gradient(160deg, #1e1033 0%, #0f172a 100%)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        デモスペース
      </div>

      <SpaceWelcomeBanner
        key={key}
        spaceId={DEMO_SPACE_ID}
        spaceName="みんなの広場"
        respectDismissStorage={false}
        onPostClick={() => setLastAction('投稿してみる をタップ')}
        onDismiss={() => setLastAction('バナーを閉じました')}
      />

      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {lastAction && (
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            {lastAction}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          バナーを再表示
        </button>
      </div>
    </div>
  );
}

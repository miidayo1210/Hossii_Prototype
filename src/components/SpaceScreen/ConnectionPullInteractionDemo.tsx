import { useRef } from 'react';
import { useConnectionPullInteraction } from '../../core/hooks/useConnectionPullInteraction';
import styles from './ConnectionPullInteractionDemo.module.css';

/** pull-to-reveal 独立デモ（DB/API/SpaceScreen 非依存） */
export function ConnectionPullInteractionDemo() {
  const sourceRef = useRef<HTMLDivElement>(null);
  const connectedRef = useRef<HTMLDivElement>(null);

  const { phase, isPulling, handlers, starParticleCount } = useConnectionPullInteraction({
    sourceRef,
    connectedRef,
  });

  return (
    <div data-connection-pull-demo data-is-pulling={isPulling ? 'true' : 'false'}>
      <div className={styles.stage}>
        <div
          ref={connectedRef}
          className={styles.connectedBubble}
          data-testid="connected-bubble"
        >
          接続先
        </div>
        <div
          ref={sourceRef}
          className={styles.pullSource}
          data-testid="pull-source"
          data-pull-phase={phase}
          onPointerDown={handlers.onPointerDown}
        >
          <span>引っ張る</span>
          {phase === 'pulling' && (
            <div className={styles.starParticles} data-testid="star-particles" aria-hidden>
              {Array.from({ length: starParticleCount }, (_, index) => (
                <span key={index}>✦</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className={styles.hint}>ドラッグで糸プレビュー · 離すと原位置へ復帰</p>
    </div>
  );
}

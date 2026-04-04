import { useState, useCallback, useEffect } from 'react';
import type { SpaceSettings } from '../../core/types/settings';
import { loadSpaceSettings } from '../../core/utils/settingsStorage';
import type { Space } from '../../core/types/space';

/**
 * スペース設定の読み込みと、ウィンドウフォーカス時の再読み込みを管理するフック。
 * 設定画面から戻ったときに最新の設定が反映されるようにする。
 */
export function useSpaceSettings(activeSpace: Space | null | undefined) {
  const [spaceSettings, setSpaceSettings] = useState<SpaceSettings | null>(null);

  const loadSettings = useCallback(() => {
    if (activeSpace) {
      const settings = loadSpaceSettings(activeSpace.id, activeSpace.name);
      setSpaceSettings(settings);
    }
  }, [activeSpace]);

  useEffect(() => {
    // localStorage からの同期読み込みのため、effect 内の setState は意図的
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, [loadSettings]);

  // 設定画面から戻ってきたとき（フォーカス時）に最新設定を再読み込み
  useEffect(() => {
    window.addEventListener('focus', loadSettings);
    return () => window.removeEventListener('focus', loadSettings);
  }, [loadSettings]);

  return { spaceSettings, reloadSettings: loadSettings };
}

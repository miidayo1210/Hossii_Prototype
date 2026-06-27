import { useEffect, useState } from 'react';

/** Portal target for modals — stays inside browser Fullscreen API subtree when active. */
export function getModalPortalRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    return null as unknown as HTMLElement;
  }
  return (document.fullscreenElement as HTMLElement | null) ?? document.body;
}

export function useModalPortalRoot(): HTMLElement {
  const [root, setRoot] = useState(getModalPortalRoot);

  useEffect(() => {
    const sync = () => setRoot(getModalPortalRoot());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  return root;
}

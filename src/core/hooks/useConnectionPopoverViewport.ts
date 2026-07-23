import { useEffect, useState } from 'react';
import {
  readConnectionPopoverViewport,
  type ConnectionPopoverViewport,
} from '../utils/connectionPopoverPosition';

export function useConnectionPopoverViewport(): ConnectionPopoverViewport {
  const [viewport, setViewport] = useState<ConnectionPopoverViewport>(() =>
    readConnectionPopoverViewport(),
  );

  useEffect(() => {
    const updateViewport = () => {
      setViewport(readConnectionPopoverViewport());
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  return viewport;
}

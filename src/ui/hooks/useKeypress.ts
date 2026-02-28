import { useEffect } from 'react';
import { useKeypressContext, type Key } from '../contexts/KeypressContext.js';

export type { Key };

export function useKeypress(handler: (key: Key) => boolean | void): void {
  const { subscribe, unsubscribe } = useKeypressContext();

  useEffect(() => {
    subscribe(handler);
    return () => unsubscribe(handler);
  }, [handler, subscribe, unsubscribe]);
}

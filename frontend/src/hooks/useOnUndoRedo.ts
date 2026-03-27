'use client';

import { useEffect } from 'react';

/**
 * Listens for the custom 'undoredo' event and calls the provided callback.
 * Use this in page components to refresh data after undo/redo.
 */
export function useOnUndoRedo(callback: () => void) {
  useEffect(() => {
    window.addEventListener('undoredo', callback);
    return () => window.removeEventListener('undoredo', callback);
  }, [callback]);
}

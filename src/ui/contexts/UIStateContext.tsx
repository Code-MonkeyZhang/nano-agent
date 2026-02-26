import { createContext, useContext } from 'react';
import type { UIState } from '../types.js';

const UIStateContext = createContext<UIState | undefined>(undefined);

export function useUIState(): UIState {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
}

export { UIStateContext };

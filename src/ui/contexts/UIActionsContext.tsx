import { createContext, useContext } from 'react';
import type { UIActions } from '../types.js';

const UIActionsContext = createContext<UIActions | undefined>(undefined);

export function useUIActions(): UIActions {
  const context = useContext(UIActionsContext);
  if (!context) {
    throw new Error('useUIActions must be used within a UIActionsProvider');
  }
  return context;
}

export { UIActionsContext };

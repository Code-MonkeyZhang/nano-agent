import { useState, useRef, useCallback } from 'react';

/**
 * Hook to return state, state setter, and ref to most up-to-date value of state.
 * We need this in order to setState and reference the updated state multiple
 * times in the same function (especially in async callbacks).
 */
export const useStateAndRef = <
  T extends object | null | undefined | number | string | boolean,
>(
  initialValue: T
) => {
  const [state, setState] = useState<T>(initialValue);
  const ref = useRef<T>(initialValue);

  const setStateInternal = useCallback<typeof setState>(
    (newStateOrCallback) => {
      let newValue: T;
      if (typeof newStateOrCallback === 'function') {
        newValue = (newStateOrCallback as (prev: T) => T)(ref.current);
      } else {
        newValue = newStateOrCallback;
      }
      setState(newValue);
      ref.current = newValue;
    },
    []
  );

  return [state, ref, setStateInternal] as const;
};

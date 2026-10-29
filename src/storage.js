import { useEffect, useReducer, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A reducer whose state is saved to phone storage under `key` after every change.
// `normalize` turns saved data into a usable state, or returns null to ignore it.
// Dispatch { type: 'LOAD', state } to replace the whole state (used by restore).
export function usePersistentReducer(key, reducer, createInitial, normalize) {
  const [state, dispatch] = useReducer(
    (current, action) => (action.type === 'LOAD' ? action.state : reducer(current, action)),
    null,
    createInitial
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((json) => {
        const saved = json ? normalize(JSON.parse(json)) : null;
        if (saved) dispatch({ type: 'LOAD', state: saved });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [key, normalize]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(key, JSON.stringify(state)).catch(() => {});
  }, [key, state, loaded]);

  return [state, dispatch, loaded];
}

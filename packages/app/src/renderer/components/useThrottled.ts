import { useEffect, useRef, useState } from 'react';

/** The value, but changing at most once per `intervalMs`: keeps a live region from chattering. */
export const useThrottled = <Value>(value: Value, intervalMs: number): Value => {
  const [shown, setShown] = useState(value);
  const lastChange = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, lastChange.current + intervalMs - Date.now());
    const timer = setTimeout(() => {
      lastChange.current = Date.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(timer);
  }, [value, intervalMs]);
  return shown;
};

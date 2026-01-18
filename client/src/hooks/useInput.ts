import { useEffect, useRef } from 'react';

export function useInput() {
  const inputRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      inputRef.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      inputRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return inputRef;
}

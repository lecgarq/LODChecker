import { useEffect } from 'react';

/** Register a keyboard shortcut handler. */
export function useKeyboard(
  key: string,
  handler: () => void,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === key) handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);
}

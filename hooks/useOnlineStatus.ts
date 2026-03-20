'use client';

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  // Always initialize as `true` to match server render and avoid hydration mismatch
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Sync with actual browser status after hydration
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

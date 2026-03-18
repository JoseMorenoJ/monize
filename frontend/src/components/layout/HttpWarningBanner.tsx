'use client';

import { useState, useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getIsHttp = () => window.location.protocol === 'http:';
const getServerSnapshot = () => false;

interface HttpWarningBannerProps {
  httpsHeadersActive: boolean;
}

export function HttpWarningBanner({ httpsHeadersActive }: HttpWarningBannerProps) {
  const isHttp = useSyncExternalStore(subscribe, getIsHttp, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  if (!httpsHeadersActive || !isHttp || dismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
      <span className="font-semibold">HTTPS Required</span>
      {' \u2014 '}
      Security headers are active but this site is being accessed over plain HTTP. API requests may fail.
      {' '}
      Set <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded text-xs">DISABLE_HTTPS_HEADERS=true</code> in your environment or access the site over HTTPS.
      <button
        onClick={() => setDismissed(true)}
        className="ml-3 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline text-xs"
        aria-label="Dismiss HTTPS warning"
      >
        Dismiss
      </button>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAnalyticsAuthTokenProvider } from '../lib/productAnalytics.js';
import { trackEvent } from '../lib/firebaseAnalytics.js';

export default function AnalyticsBridge() {
  const { getToken, isSignedIn, userId } = useAuth();
  const signedInTrackedRef = useRef(false);

  useEffect(() => {
    setAnalyticsAuthTokenProvider(async () => {
      if (!isSignedIn) return null;
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => setAnalyticsAuthTokenProvider(null);
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      signedInTrackedRef.current = false;
      return;
    }
    if (signedInTrackedRef.current) return;
    signedInTrackedRef.current = true;
    trackEvent('user_signed_in', {
      page_path: typeof window !== 'undefined' ? window.location.pathname : '',
      clerk_user_id: userId,
    });
  }, [isSignedIn, userId]);

  return null;
}

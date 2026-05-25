import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

let analyticsInstancePromise = null;

function canInitFirebase() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.measurementId
  );
}

async function getAnalyticsInstance() {
  if (analyticsInstancePromise) return analyticsInstancePromise;

  analyticsInstancePromise = (async () => {
    if (!canInitFirebase() || typeof window === 'undefined') return null;
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;

    const app = initializeApp(firebaseConfig);
    return getAnalytics(app);
  })();

  return analyticsInstancePromise;
}

export async function trackEvent(name, params = {}) {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    logEvent(analytics, name, sanitizeParams(params));
  } catch {
    // Ignore analytics failures so user flows never break.
  }
}

export function trackPageView(pathname = '/', extra = {}) {
  return trackEvent('page_view', { page_path: pathname, ...extra });
}

function sanitizeParams(params = {}) {
  const next = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value;
    } else if (Array.isArray(value)) {
      next[key] = value.join(',');
    } else {
      next[key] = String(value);
    }
  }
  return next;
}


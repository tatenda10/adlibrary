import { API_URL } from './api.js';

const SESSION_KEY = 'val_analytics_session';

let authTokenProvider = null;

export function setAnalyticsAuthTokenProvider(fn) {
  authTokenProvider = typeof fn === 'function' ? fn : null;
}

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export async function mirrorProductEvent(name, params = {}) {
  try {
    const token = authTokenProvider ? await authTokenProvider() : null;
    const pagePath = params.page_path || (typeof window !== 'undefined' ? window.location.pathname : '');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    await fetch(`${API_URL}/api/analytics/event`, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({
        event_name: name,
        page_path: pagePath,
        element_label: params.element_label || params.element || '',
        session_id: getSessionId(),
        props: params,
      }),
    });
  } catch {
    // Never break UX for analytics.
  }
}

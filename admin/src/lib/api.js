//export const API_URL =  'https://viraladlibrary.space';

export const API_URL = 'http://localhost:5000';
async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function adminHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function adminLogin({ username, password }) {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function adminGetArticles(token) {
  return request('/api/admin/articles', {
    headers: adminHeaders(token),
  });
}

export function adminCreateArticle(token, payload) {
  return request('/api/admin/articles', {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function adminUpdateArticle(token, id, payload) {
  return request(`/api/admin/articles/${id}`, {
    method: 'PUT',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function adminDeleteArticle(token, id) {
  return request(`/api/admin/articles/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
}

export function adminGetUsers(token, { limit, offset } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/users${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetAnalytics(token, { days } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/analytics${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetAnalyticsEvents(token, { days } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/analytics/events${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetAnalyticsEventDetail(token, eventName, { days } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/analytics/events/${encodeURIComponent(eventName)}${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetAnalyticsOnboarding(token, { days } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/analytics/onboarding${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetAnalyticsSignIn(token, { days } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/analytics/signin${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetAnalyticsFunnels(token, { days, openFunnel } = {}) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  if (openFunnel) params.set('openFunnel', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/analytics/funnels${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetIncidents(token, { limit, severity, source } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (severity) params.set('severity', severity);
  if (source) params.set('source', source);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/incidents${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetIncidentsSummary(token, { hours, sinceId } = {}) {
  const params = new URLSearchParams();
  if (hours) params.set('hours', String(hours));
  if (sinceId) params.set('sinceId', String(sinceId));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/incidents/summary${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetIncidentDetail(token, id) {
  return request(`/api/admin/incidents/${id}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetOnboardingProfiles(token, { limit, offset, search } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  if (search) params.set('search', search);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/api/admin/onboarding${query}`, {
    headers: adminHeaders(token),
  });
}

export function adminGetOnboardingProfileDetail(token, userId) {
  return request(`/api/admin/onboarding/${encodeURIComponent(userId)}`, {
    headers: adminHeaders(token),
  });
}

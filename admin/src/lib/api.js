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

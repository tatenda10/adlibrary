const STORAGE_KEY = 'val_admin_incidents_last_seen';

export function getIncidentsLastSeenId() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY) ?? '0';
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

export function setIncidentsLastSeenId(id) {
  const value = String(Number(id) || 0);
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
}

export function markIncidentsSeenFromSummary(summary) {
  const latestId = Number(summary?.latest_id);
  if (latestId > 0) {
    setIncidentsLastSeenId(latestId);
  }
}

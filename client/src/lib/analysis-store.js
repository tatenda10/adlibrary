function storeAnalysisRecord(key, record) {
  try {
    const raw = localStorage.getItem('tiktok_analysis_map');
    const map = raw ? JSON.parse(raw) : {};
    map[key] = record;
    localStorage.setItem('tiktok_analysis_map', JSON.stringify(map));
  } catch {
    // no-op
  }
}

function getAnalysisRecord(key) {
  try {
    const raw = localStorage.getItem('tiktok_analysis_map');
    const map = raw ? JSON.parse(raw) : {};
    return map[key] || null;
  } catch {
    return null;
  }
}

function keyForVideo(video) {
  return String(video.url || video.tiktok_url || video.id || '').trim();
}

export { storeAnalysisRecord, getAnalysisRecord, keyForVideo };

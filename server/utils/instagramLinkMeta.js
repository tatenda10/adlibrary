/**
 * Lightweight Instagram link metadata (URL parse + oEmbed). No Apify scraper.
 */

function isPublicInstagramUrl(raw = '') {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'instagram.com') return false;
    return /\/(p|reel|reels|tv)\/[^/?#]+/i.test(parsed.pathname || '');
  } catch {
    return false;
  }
}

function normalizeInstagramUrl(raw = '') {
  const trimmed = String(raw || '').trim();
  if (!isPublicInstagramUrl(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    let path = parsed.pathname.replace(/\/+$/, '');
    if (path.includes('/reels/')) {
      path = path.replace('/reels/', '/reel/');
    }
    return `https://www.instagram.com${path}`;
  } catch {
    return trimmed;
  }
}

function extractInstagramShortcode(url = '') {
  const raw = String(url || '').trim();
  const match = raw.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return match ? match[2] : '';
}

function extractUsernameFromUrl(url = '') {
  const raw = String(url || '').trim();
  const match = raw.match(/instagram\.com\/([^/?#]+)\/(?:p|reel|reels|tv)\//i);
  if (!match) return '';
  const candidate = String(match[1]).replace(/^@/, '').trim();
  if (['p', 'reel', 'reels', 'tv', 'explore', 'accounts'].includes(candidate.toLowerCase())) {
    return '';
  }
  return candidate;
}

async function fetchInstagramOEmbed(url) {
  const target = String(url || '').trim();
  if (!target) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const endpoint = `https://api.instagram.com/oembed?url=${encodeURIComponent(target)}`;
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const authorName = String(data?.author_name || '').trim();
    const username = authorName.replace(/^@/, '').trim();

    return {
      caption: String(data?.title || '').trim(),
      author_name: authorName,
      author_username: username,
      thumbnail_url: String(data?.thumbnail_url || '').trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveWorkspaceLinkMeta(url) {
  const usernameFromUrl = extractUsernameFromUrl(url);
  const oembed = await fetchInstagramOEmbed(url);

  return {
    caption: oembed?.caption || '',
    author_name: oembed?.author_name || '',
    author_username: oembed?.author_username || usernameFromUrl || '',
    thumbnail_url: oembed?.thumbnail_url || '',
  };
}

module.exports = {
  isPublicInstagramUrl,
  normalizeInstagramUrl,
  extractInstagramShortcode,
  extractUsernameFromUrl,
  resolveWorkspaceLinkMeta,
};

/**
 * Lightweight TikTok link metadata (URL parse + oEmbed). No Apify scraper.
 */

function extractUsernameFromUrl(url = '') {
  const raw = String(url || '').trim();
  const match = raw.match(/tiktok\.com\/@([^/?#]+)/i);
  if (!match) return '';
  return String(match[1]).replace(/^@/, '').trim();
}

async function fetchTikTokOEmbed(url) {
  const target = String(url || '').trim();
  if (!target) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`;
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const authorUrl = String(data?.author_url || '').trim();
    const username = extractUsernameFromUrl(authorUrl) || extractUsernameFromUrl(target);

    return {
      caption: String(data?.title || '').trim(),
      author_name: String(data?.author_name || '').trim(),
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
  const oembed = await fetchTikTokOEmbed(url);

  return {
    caption: oembed?.caption || '',
    author_name: oembed?.author_name || '',
    author_username: oembed?.author_username || usernameFromUrl || '',
    thumbnail_url: oembed?.thumbnail_url || '',
  };
}

module.exports = {
  extractUsernameFromUrl,
  fetchTikTokOEmbed,
  resolveWorkspaceLinkMeta,
};

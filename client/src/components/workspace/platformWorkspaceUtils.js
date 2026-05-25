import {
  enrichWorkspaceVideo as enrichTikTokItem,
  workspaceVideoTitle as tiktokTitle,
  workspaceVideoUsername as tiktokUsername,
} from '../tiktok/workspaceUtils.js';

function resolveInstagramEmbedUrl(item) {
  const url = String(item?.instagram_url || item?.url || '').trim();
  const shortcode = String(item?.video_id || '').trim();
  const match = url.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  const code = shortcode || (match ? match[2] : '');
  if (!code) return '';
  let type = match ? match[1].toLowerCase() : 'p';
  if (type === 'reels') type = 'reel';
  const pathType = type === 'reel' ? 'reel' : type === 'tv' ? 'tv' : 'p';
  return `https://www.instagram.com/${pathType}/${code}/embed`;
}

export function enrichWorkspaceItem(item, platform) {
  if (platform === 'tiktok') {
    return enrichTikTokItem(item);
  }

  const urlField = platform === 'facebook' ? 'facebook_url' : 'instagram_url';
  const contentUrl = String(item?.[urlField] || item?.url || '').trim();
  const embedUrl = platform === 'instagram' ? resolveInstagramEmbedUrl(item) : '';
  const playbackUrl =
    platform === 'facebook'
      ? String(item?.source_video_stream_url || item?.meta?.source_video_stream_url || '').trim()
      : '';

  return {
    ...item,
    [urlField]: contentUrl,
    embedUrl,
    playbackUrl,
    canEmbed: Boolean(embedUrl),
  };
}

export function workspaceItemTitle(item, platform) {
  const caption = String(item?.caption || '').trim();
  if (caption) return caption;
  if (platform === 'tiktok') return 'TikTok video';
  if (platform === 'facebook') return 'Facebook post';
  return 'Instagram post';
}

export function workspaceItemUsername(item, platform) {
  if (platform === 'tiktok') {
    return tiktokUsername(item);
  }

  const username = String(item?.author_username || '').trim();
  if (username) return username.startsWith('@') ? username : `@${username}`;
  const name = String(item?.author_name || '').trim();
  if (name) return name.startsWith('@') ? name : name;

  const urlField = platform === 'facebook' ? 'facebook_url' : 'instagram_url';
  const url = String(item?.[urlField] || '').trim();
  if (platform === 'instagram') {
    try {
      const match = new URL(url).pathname.match(/^\/([^/]+)\/(?:p|reel|reels|tv)\//i);
      if (match && !['p', 'reel', 'reels', 'tv', 'explore'].includes(match[1].toLowerCase())) {
        return `@${match[1]}`;
      }
    } catch {
      // ignore
    }
  }
  return '';
}

export function matchesWorkspaceItemSearch(item, query, platform) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = workspaceItemTitle(item, platform).toLowerCase();
  const username = workspaceItemUsername(item, platform).toLowerCase();
  const urlField =
    platform === 'tiktok' ? 'tiktok_url' : platform === 'facebook' ? 'facebook_url' : 'instagram_url';
  const url = String(item?.[urlField] || '').toLowerCase();
  return title.includes(q) || username.includes(q) || url.includes(q);
}

export function matchesFolderSearch(folder, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return String(folder?.name || '').toLowerCase().includes(q);
}

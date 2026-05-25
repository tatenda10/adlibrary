export function resolveTikTokEmbedUrl(video) {
  const directId = String(video?.video_id || video?.videoId || '').trim();
  if (/^\d{8,}$/.test(directId)) {
    return `https://www.tiktok.com/player/v1/${directId}?controls=1&music_info=0&description=0`;
  }

  const rawUrl = String(video?.tiktok_url || video?.url || '').trim();
  if (!rawUrl) return '';

  const match = rawUrl.match(/\/video\/(\d{8,})/i);
  if (!match) return '';

  return `https://www.tiktok.com/player/v1/${match[1]}?controls=1&music_info=0&description=0`;
}

/** Workspace videos are link-only — playback uses TikTok embed, not Apify stream URLs. */
export function enrichWorkspaceVideo(video) {
  const tiktokUrl = String(video?.tiktok_url || video?.url || '').trim();
  const embedUrl = resolveTikTokEmbedUrl(video);

  return {
    ...video,
    tiktok_url: tiktokUrl,
    embedUrl,
    canEmbed: Boolean(embedUrl),
  };
}

export function workspaceVideoTitle(video) {
  const caption = String(video?.caption || '').trim();
  if (caption) return caption;
  return 'TikTok video';
}

export function workspaceVideoUsername(video) {
  const username = String(video?.author_username || '').trim();
  if (username) return username.startsWith('@') ? username : `@${username}`;
  const name = String(video?.author_name || '').trim();
  if (name) return name;
  const url = String(video?.tiktok_url || '').trim();
  try {
    const match = new URL(url).pathname.match(/@([^/]+)/);
    if (match) return `@${match[1]}`;
  } catch {
    // ignore
  }
  return '';
}

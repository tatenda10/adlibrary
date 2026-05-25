const { createWorkspaceController } = require('../utils/workspaceControllerFactory');
const {
  normalizeInstagramUrl,
  extractInstagramShortcode,
  resolveWorkspaceLinkMeta,
} = require('../utils/instagramLinkMeta');

module.exports = createWorkspaceController({
  folderTable: 'instagram_workspace_folders',
  videoTable: 'instagram_workspace_videos',
  urlColumn: 'instagram_url',
  urlBodyKeys: ['url', 'instagram_url'],
  maxFoldersEnv: 'INSTAGRAM_WORKSPACE_MAX_FOLDERS',
  maxVideosEnv: 'INSTAGRAM_WORKSPACE_MAX_VIDEOS',
  normalizeUrl: normalizeInstagramUrl,
  extractContentId: extractInstagramShortcode,
  resolveLinkMeta: resolveWorkspaceLinkMeta,
  invalidUrlMessage: 'Enter a valid public Instagram post or reel link.',
  addErrorMessage: 'Could not add that Instagram link. Check the URL and try again.',
});

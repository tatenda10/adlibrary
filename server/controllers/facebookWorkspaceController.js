const { createWorkspaceController } = require('../utils/workspaceControllerFactory');
const {
  resolveCanonicalFacebookUrl,
  extractFacebookContentId,
  resolveWorkspaceLinkMeta,
} = require('../utils/facebookLinkMeta');

module.exports = createWorkspaceController({
  folderTable: 'facebook_workspace_folders',
  videoTable: 'facebook_workspace_videos',
  urlColumn: 'facebook_url',
  urlBodyKeys: ['url', 'facebook_url'],
  maxFoldersEnv: 'FACEBOOK_WORKSPACE_MAX_FOLDERS',
  maxVideosEnv: 'FACEBOOK_WORKSPACE_MAX_VIDEOS',
  normalizeUrl: resolveCanonicalFacebookUrl,
  extractContentId: extractFacebookContentId,
  resolveLinkMeta: resolveWorkspaceLinkMeta,
  invalidUrlMessage: 'Enter a valid public Facebook post or video link.',
  addErrorMessage: 'Could not add that Facebook link. Check the URL and try again.',
});

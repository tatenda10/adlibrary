-- TikTok Workspace: user folders + saved video links
CREATE TABLE IF NOT EXISTS tiktok_workspace_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tiktok_workspace_folders_user (user_id),
  INDEX idx_tiktok_workspace_folders_user_updated (user_id, updated_at)
);

CREATE TABLE IF NOT EXISTS tiktok_workspace_videos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folder_id INT NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  tiktok_url VARCHAR(512) NOT NULL,
  video_id VARCHAR(64) DEFAULT NULL,
  caption TEXT,
  author_name VARCHAR(255) DEFAULT NULL,
  author_username VARCHAR(128) DEFAULT NULL,
  thumbnail_url TEXT,
  source_video_stream_url TEXT,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  meta_json JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tiktok_workspace_videos_folder (folder_id),
  INDEX idx_tiktok_workspace_videos_user (user_id),
  UNIQUE KEY uniq_folder_tiktok_url (folder_id, tiktok_url(191))
);

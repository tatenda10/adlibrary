const pool = require('./connection');

const CREATE_TABLE_QUERIES = [
  `CREATE TABLE IF NOT EXISTS user_usage_counters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    cycle_key VARCHAR(32) NOT NULL,
    metric_key VARCHAR(64) NOT NULL,
    usage_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_cycle_metric (user_id, cycle_key, metric_key)
  )`,
  `CREATE TABLE IF NOT EXISTS saved_collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    platform VARCHAR(64) NOT NULL DEFAULT 'tiktok',
    source VARCHAR(64) NOT NULL DEFAULT 'manual_search',
    name VARCHAR(255) NOT NULL,
    query_text VARCHAR(512) DEFAULT NULL,
    limit_count INT DEFAULT NULL,
    sort_by VARCHAR(64) DEFAULT NULL,
    intelligent TINYINT(1) NOT NULL DEFAULT 0,
    prompt_text TEXT DEFAULT NULL,
    results_json LONGTEXT DEFAULT NULL,
    plan_json JSON DEFAULT NULL,
    meta_json JSON DEFAULT NULL,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS tiktok_trending_music_cache (
    country_code VARCHAR(8) NOT NULL PRIMARY KEY,
    items_json LONGTEXT NOT NULL,
    item_count INT NOT NULL DEFAULT 0,
    source VARCHAR(32) NOT NULL DEFAULT 'daily_job',
    fetched_at DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tiktok_trending_music_fetched (fetched_at)
  )`,
  `CREATE TABLE IF NOT EXISTS tiktok_trending_creators_cache (
    country_code VARCHAR(8) NOT NULL,
    sort_key VARCHAR(32) NOT NULL,
    follower_band VARCHAR(8) NOT NULL DEFAULT '',
    items_json LONGTEXT NOT NULL,
    item_count INT NOT NULL DEFAULT 0,
    source VARCHAR(32) NOT NULL DEFAULT 'api',
    fetched_at DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (country_code, sort_key, follower_band),
    INDEX idx_tiktok_creators_fetched (fetched_at)
  )`,
  `CREATE TABLE IF NOT EXISTS tiktok_workspace_folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tiktok_workspace_folders_user (user_id),
    INDEX idx_tiktok_workspace_folders_user_updated (user_id, updated_at)
  )`,
  `CREATE TABLE IF NOT EXISTS tiktok_workspace_videos (
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
  )`,
  `CREATE TABLE IF NOT EXISTS facebook_workspace_folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_facebook_workspace_folders_user (user_id),
    INDEX idx_facebook_workspace_folders_user_updated (user_id, updated_at)
  )`,
  `CREATE TABLE IF NOT EXISTS facebook_workspace_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folder_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    facebook_url VARCHAR(512) NOT NULL,
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
    INDEX idx_facebook_workspace_videos_folder (folder_id),
    INDEX idx_facebook_workspace_videos_user (user_id),
    UNIQUE KEY uniq_folder_facebook_url (folder_id, facebook_url(191))
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_workspace_folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_instagram_workspace_folders_user (user_id),
    INDEX idx_instagram_workspace_folders_user_updated (user_id, updated_at)
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_workspace_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folder_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    instagram_url VARCHAR(512) NOT NULL,
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
    INDEX idx_instagram_workspace_videos_folder (folder_id),
    INDEX idx_instagram_workspace_videos_user (user_id),
    UNIQUE KEY uniq_folder_instagram_url (folder_id, instagram_url(191))
  )`,
  `CREATE TABLE IF NOT EXISTS instagram_trends_cache (
    hashtag_key VARCHAR(255) NOT NULL,
    items_json LONGTEXT NOT NULL,
    item_count INT NOT NULL DEFAULT 0,
    source VARCHAR(64) NOT NULL DEFAULT 'api',
    fetched_at DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (hashtag_key),
    INDEX idx_instagram_trends_fetched (fetched_at)
  )`,
  `CREATE TABLE IF NOT EXISTS tiktok_top_ads_cache (
    country_code VARCHAR(8) NOT NULL,
    industry_key VARCHAR(48) NOT NULL DEFAULT '',
    objective_key VARCHAR(48) NOT NULL DEFAULT '',
    period_key VARCHAR(8) NOT NULL DEFAULT '7',
    ad_format VARCHAR(32) NOT NULL DEFAULT '',
    order_by VARCHAR(32) NOT NULL DEFAULT 'for_you',
    items_json LONGTEXT NOT NULL,
    item_count INT NOT NULL DEFAULT 0,
    source VARCHAR(32) NOT NULL DEFAULT 'api',
    fetched_at DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (country_code, industry_key, objective_key, period_key, ad_format, order_by),
    INDEX idx_tiktok_top_ads_fetched (fetched_at)
  )`,
  `CREATE TABLE IF NOT EXISTS async_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    job_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    payload_json LONGTEXT NOT NULL,
    result_json LONGTEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    available_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_async_jobs_status_available (status, available_at)
  )`,
];

const WATCHLIST_COLUMNS = [
  ['alert_preferences_json', 'ALTER TABLE competitor_watchlist ADD COLUMN alert_preferences_json JSON DEFAULT NULL'],
  ['last_results_count', 'ALTER TABLE competitor_watchlist ADD COLUMN last_results_count INT DEFAULT 0'],
  ['last_signal_score', 'ALTER TABLE competitor_watchlist ADD COLUMN last_signal_score INT DEFAULT 0'],
  ['notes', 'ALTER TABLE competitor_watchlist ADD COLUMN notes TEXT DEFAULT NULL'],
];

async function ensureColumn(tableName, columnName, alterSql) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  if (Number(rows[0]?.total || 0) === 0) {
    await pool.query(alterSql);
  }
}

async function ensureRuntimeTables() {
  for (const query of CREATE_TABLE_QUERIES) {
    await pool.query(query);
  }
  for (const [columnName, alterSql] of WATCHLIST_COLUMNS) {
    await ensureColumn('competitor_watchlist', columnName, alterSql);
  }
}

module.exports = { ensureRuntimeTables };

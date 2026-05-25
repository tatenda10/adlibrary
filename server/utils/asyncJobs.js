const pool = require('../db/connection');

const handlers = new Map();
let processing = false;

function registerJobHandler(jobType, handler) {
  handlers.set(jobType, handler);
}

async function enqueueJob(userId, jobType, payload = {}, options = {}) {
  const [result] = await pool.query(
    `INSERT INTO async_jobs (user_id, job_type, status, payload_json, max_attempts)
     VALUES (?, ?, 'queued', ?, ?)`,
    [userId, jobType, JSON.stringify(payload || {}), Number(options.max_attempts || 3)]
  );
  return getJobById(result.insertId, userId);
}

async function getJobById(id, userId = null) {
  const params = [id];
  let sql = `SELECT * FROM async_jobs WHERE id = ?`;
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  sql += ' LIMIT 1';
  const [rows] = await pool.query(sql, params);
  if (!rows.length) return null;
  return normalizeJob(rows[0]);
}

function normalizeJob(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    job_type: row.job_type,
    status: row.status,
    payload: parseJson(row.payload_json, {}),
    result: parseJson(row.result_json, null),
    error_message: row.error_message || '',
    attempts: Number(row.attempts || 0),
    max_attempts: Number(row.max_attempts || 3),
    available_at: row.available_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function processNextJob() {
  const [rows] = await pool.query(
    `SELECT * FROM async_jobs
     WHERE status = 'queued' AND available_at <= NOW()
     ORDER BY created_at ASC
     LIMIT 1`
  );
  if (!rows.length) return false;
  const row = rows[0];
  const handler = handlers.get(row.job_type);
  if (!handler) {
    await pool.query(
      `UPDATE async_jobs
       SET status = 'failed', error_message = ?, completed_at = NOW(), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [`No handler registered for ${row.job_type}`, row.id]
    );
    return true;
  }

  await pool.query(
    `UPDATE async_jobs
     SET status = 'running', started_at = NOW(), attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'queued'`,
    [row.id]
  );

  try {
    const payload = parseJson(row.payload_json, {});
    const result = await handler({ userId: row.user_id, payload, jobId: row.id });
    await pool.query(
      `UPDATE async_jobs
       SET status = 'completed', result_json = ?, completed_at = NOW(), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(result || null), row.id]
    );
  } catch (error) {
    const attempts = Number(row.attempts || 0) + 1;
    const maxAttempts = Number(row.max_attempts || 3);
    const finalFailure = attempts >= maxAttempts;
    await pool.query(
      `UPDATE async_jobs
       SET status = ?, error_message = ?, available_at = ${finalFailure ? 'available_at' : 'DATE_ADD(NOW(), INTERVAL 2 MINUTE)'},
           completed_at = ${finalFailure ? 'NOW()' : 'NULL'}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [finalFailure ? 'failed' : 'queued', error?.message || 'Job failed', row.id]
    );
  }
  return true;
}

async function processQueueCycle() {
  if (processing) return;
  processing = true;
  try {
    let keepGoing = true;
    while (keepGoing) {
      keepGoing = await processNextJob();
    }
  } finally {
    processing = false;
  }
}

function startAsyncJobLoop() {
  processQueueCycle().catch((error) => {
    console.error('Initial async job cycle failed:', error);
  });
  return setInterval(() => {
    processQueueCycle().catch((error) => {
      console.error('Async job cycle failed:', error);
    });
  }, Number(process.env.ASYNC_JOB_INTERVAL_MS || 15000));
}

module.exports = {
  enqueueJob,
  getJobById,
  normalizeJob,
  processQueueCycle,
  registerJobHandler,
  startAsyncJobLoop,
};

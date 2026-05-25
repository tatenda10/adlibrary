const { ensureUser } = require('../utils/users');
const { getJobById } = require('../utils/asyncJobs');

async function getJobStatus(req, res) {
  try {
    await ensureUser(req.user);
    const id = Number(req.params?.id || 0);
    if (!id) return res.status(400).json({ error: 'Invalid job id.' });
    const job = await getJobById(id, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    return res.json({ job });
  } catch (error) {
    console.error('getJobStatus error:', error);
    return res.status(500).json({ error: 'Failed to fetch job status.' });
  }
}

module.exports = { getJobStatus };

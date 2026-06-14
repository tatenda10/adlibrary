const { ensureUser } = require('../utils/users');
const { recordProductEvent } = require('../utils/observabilityStore');

async function ingestProductEvent(req, res) {
  try {
    const {
      event_name: eventName = '',
      page_path: pagePath = '',
      element_label: elementLabel = '',
      session_id: sessionId = '',
      props = null,
    } = req.body || {};

    if (!String(eventName).trim()) {
      return res.status(400).json({ error: 'event_name is required' });
    }

    if (req.user?.id) {
      await ensureUser(req.user);
    }

    await recordProductEvent({
      userId: req.user?.id || null,
      eventName,
      pagePath,
      elementLabel,
      sessionId,
      props: props && typeof props === 'object' ? props : null,
    });

    return res.status(202).json({ ok: true });
  } catch (error) {
    console.error('ingestProductEvent error:', error);
    return res.status(500).json({ error: 'Failed to record event' });
  }
}

module.exports = { ingestProductEvent };

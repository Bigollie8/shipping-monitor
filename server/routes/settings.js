const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    const settings = db.getAllSettings();

    const defaults = {
      poll_interval_minutes: process.env.DEFAULT_POLL_INTERVAL_MINUTES || '30',
      smtp_host: process.env.SMTP_HOST || '',
      smtp_port: process.env.SMTP_PORT || '587',
      smtp_user: process.env.SMTP_USER || '',
      notification_email: process.env.NOTIFICATION_EMAIL || '',
      discord_webhook_url: process.env.DISCORD_WEBHOOK_URL || '',
      email_enabled: 'false',
      discord_enabled: 'false'
    };

    res.json({ ...defaults, ...settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', (req, res) => {
  try {
    const allowedKeys = [
      'poll_interval_minutes',
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_pass',
      'notification_email',
      'discord_webhook_url',
      'email_enabled',
      'discord_enabled'
    ];

    const oldInterval = db.getSetting('poll_interval_minutes');

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedKeys.includes(key)) {
        db.setSetting(key, String(value));
      }
    }

    // Restart scheduler if poll interval changed
    const newInterval = db.getSetting('poll_interval_minutes');
    if (oldInterval !== newInterval) {
      const scheduler = require('../services/scheduler');
      scheduler.restart();
      console.log(`Scheduler restarted with new interval: ${newInterval} minutes`);
    }

    res.json(db.getAllSettings());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test-email', async (req, res) => {
  try {
    const emailService = require('../services/notifications/email');
    await emailService.sendTestEmail();
    res.json({ success: true, message: 'Test email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test-discord', async (req, res) => {
  try {
    const discordService = require('../services/notifications/discord');
    await discordService.sendTestMessage();
    res.json({ success: true, message: 'Test Discord message sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/scheduler', (req, res) => {
  try {
    const scheduler = require('../services/scheduler');
    res.json(scheduler.getStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

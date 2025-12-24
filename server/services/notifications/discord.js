const axios = require('axios');
const db = require('../../db');

function getWebhookUrl() {
  const settings = db.getAllSettings();
  return settings.discord_webhook_url || process.env.DISCORD_WEBHOOK_URL;
}

function isEnabled() {
  const settings = db.getAllSettings();
  return settings.discord_enabled === 'true';
}

async function sendDiscord({ shipment, status, message }) {
  if (!isEnabled()) {
    console.log('Discord notifications disabled');
    return;
  }

  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  const embed = {
    title: 'Package Delivered!',
    color: 0x22c55e,
    fields: [
      {
        name: 'Package',
        value: shipment.friendly_name || 'Unknown Package',
        inline: true
      },
      {
        name: 'Carrier',
        value: (shipment.carrier || 'Unknown').toUpperCase(),
        inline: true
      },
      {
        name: 'Status',
        value: status,
        inline: true
      },
      {
        name: 'Tracking Number',
        value: shipment.tracking_number || 'N/A',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Shipping Monitor'
    }
  };

  if (shipment.tracking_url) {
    embed.url = shipment.tracking_url;
  }

  await axios.post(webhookUrl, {
    content: message || null,
    embeds: [embed]
  });
}

async function sendTestMessage() {
  if (!isEnabled()) {
    throw new Error('Discord notifications are disabled. Enable them in settings first.');
  }

  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  await axios.post(webhookUrl, {
    content: null,
    embeds: [{
      title: 'Shipping Monitor - Test Message',
      description: 'Your Discord notifications are configured correctly!',
      color: 0x3b82f6,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Shipping Monitor'
      }
    }]
  });
}

async function sendCustomMessage(content) {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    throw new Error('Discord webhook URL not configured');
  }

  await axios.post(webhookUrl, { content });
}

async function sendCheckLog(results) {
  if (!isEnabled()) {
    return;
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return;
  }

  const total = results.length;
  const delivered = results.filter(r => r.isDelivered).length;
  const changed = results.filter(r => r.statusChanged).length;
  const errors = results.filter(r => r.error).length;
  const skipped = results.filter(r => r.skipped).length;

  // Build status summary for each shipment
  const shipmentLines = results.map(r => {
    if (r.skipped) {
      return `• **#${r.shipmentId}** - Skipped (delivered)`;
    }
    if (r.error) {
      return `• **#${r.shipmentId}** - Error: ${r.error}`;
    }
    const statusIcon = r.isDelivered ? '✅' : (r.statusChanged ? '🔄' : '📦');
    return `• ${statusIcon} **${r.trackingNumber?.slice(-8) || '#' + r.shipmentId}** - ${r.status}${r.statusChanged ? ' (changed)' : ''}`;
  }).join('\n');

  const embed = {
    title: '📋 Scheduled Check Complete',
    color: errors > 0 ? 0xef4444 : (changed > 0 ? 0xf59e0b : 0x3b82f6),
    fields: [
      {
        name: 'Summary',
        value: `Checked: **${total}** | Changed: **${changed}** | Delivered: **${delivered}** | Errors: **${errors}**`,
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Shipping Monitor - Auto Check'
    }
  };

  if (shipmentLines && total > 0) {
    embed.fields.push({
      name: 'Shipments',
      value: shipmentLines.slice(0, 1024), // Discord field limit
      inline: false
    });
  }

  if (total === 0) {
    embed.fields[0].value = 'No active shipments to check';
  }

  try {
    await axios.post(webhookUrl, {
      embeds: [embed]
    });
  } catch (error) {
    console.error('Failed to send check log to Discord:', error.message);
  }
}

module.exports = {
  sendDiscord,
  sendTestMessage,
  sendCustomMessage,
  sendCheckLog,
  isEnabled,
  getWebhookUrl
};

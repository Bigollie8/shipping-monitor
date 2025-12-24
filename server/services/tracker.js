const db = require('../db');
const { getScraper } = require('./carriers');
const { detectCarrier, extractTrackingNumber, normalizeStatus } = require('./carriers/detector');
const rateLimiter = require('./rateLimiter');
const notifications = require('./notifications');

async function checkShipment(shipmentId) {
  const shipment = db.getShipmentById(shipmentId);
  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} not found`);
  }

  if (shipment.is_delivered) {
    console.log(`Shipment ${shipmentId} already delivered, skipping`);
    return { skipped: true, reason: 'already_delivered' };
  }

  const carrier = shipment.carrier || detectCarrier(shipment.tracking_url);
  const trackingNumber = shipment.tracking_number || extractTrackingNumber(shipment.tracking_url, carrier);

  if (carrier !== shipment.carrier || trackingNumber !== shipment.tracking_number) {
    db.updateShipment(shipmentId, { carrier, tracking_number: trackingNumber });
  }

  const scraper = getScraper(carrier);

  const result = await rateLimiter.enqueue({
    carrier,
    execute: async () => {
      console.log(`Checking shipment ${shipmentId} (${carrier})`);
      return await scraper.track(shipment.tracking_url, trackingNumber);
    }
  });

  const normalizedStatus = normalizeStatus(result.status);
  const now = new Date().toISOString();

  const previousStatus = shipment.current_status;

  // Don't overwrite a good status with "Unknown" - keep the previous status
  const shouldUpdateStatus = normalizedStatus !== 'Unknown' ||
    previousStatus === 'Pending first check' ||
    !previousStatus;

  const effectiveStatus = shouldUpdateStatus ? normalizedStatus : previousStatus;
  const statusChanged = previousStatus !== effectiveStatus && shouldUpdateStatus;

  db.updateShipment(shipmentId, {
    current_status: effectiveStatus,
    is_delivered: result.isDelivered ? 1 : 0,
    last_checked_at: now,
    ...(statusChanged && { last_status_change_at: now })
  });

  if (!shouldUpdateStatus) {
    console.log(`Keeping previous status "${previousStatus}" instead of "Unknown" for shipment ${shipmentId}`);

    // Send Discord alert about failed status fetch
    try {
      const discord = require('./notifications/discord');
      if (discord.isEnabled()) {
        const axios = require('axios');
        const webhookUrl = discord.getWebhookUrl();
        if (webhookUrl) {
          await axios.post(webhookUrl, {
            embeds: [{
              title: '⚠️ Status Check Failed',
              description: `Could not fetch status for **${shipment.friendly_name || 'Package #' + shipmentId}**. Keeping previous status.`,
              color: 0xf59e0b,
              fields: [
                { name: 'Previous Status', value: previousStatus, inline: true },
                { name: 'Carrier', value: (carrier || 'Unknown').toUpperCase(), inline: true },
                { name: 'Tracking', value: trackingNumber || 'N/A', inline: true }
              ],
              timestamp: new Date().toISOString(),
              footer: { text: 'Shipping Monitor' }
            }]
          });
        }
      }
    } catch (alertError) {
      console.error('Failed to send Unknown status alert:', alertError.message);
    }
  }

  if (statusChanged || result.events.length > 0) {
    const existingHistory = db.getShipmentHistory(shipmentId);
    const existingStatuses = new Set(existingHistory.map(h => `${h.status}|${h.timestamp}`));

    for (const event of result.events) {
      const eventKey = `${event.status}|${event.timestamp}`;
      if (!existingStatuses.has(eventKey)) {
        db.addStatusHistory({
          shipment_id: shipmentId,
          status: event.status,
          location: event.location,
          details: event.details,
          timestamp: event.timestamp,
          raw_data: result.rawData
        });
      }
    }

    if (result.events.length === 0 && statusChanged) {
      db.addStatusHistory({
        shipment_id: shipmentId,
        status: normalizedStatus,
        location: null,
        details: `Status changed from "${previousStatus}" to "${normalizedStatus}"`,
        timestamp: now
      });
    }
  }

  if (result.isDelivered && !shipment.is_delivered) {
    console.log(`Shipment ${shipmentId} has been delivered!`);
    await sendDeliveryNotifications(shipment, normalizedStatus);
  }

  return {
    shipmentId,
    carrier,
    trackingNumber,
    status: effectiveStatus,
    isDelivered: result.isDelivered,
    statusChanged,
    eventsFound: result.events.length,
    checkedAt: now
  };
}

async function sendDeliveryNotifications(shipment, status) {
  const updatedShipment = db.getShipmentById(shipment.id);

  if (updatedShipment.notify_email) {
    try {
      await notifications.sendEmail({
        subject: `Package Delivered: ${updatedShipment.friendly_name || updatedShipment.tracking_number}`,
        shipment: updatedShipment,
        status
      });
      console.log(`Email notification sent for shipment ${shipment.id}`);
    } catch (error) {
      console.error(`Failed to send email notification: ${error.message}`);
    }
  }

  if (updatedShipment.notify_discord) {
    try {
      await notifications.sendDiscord({
        shipment: updatedShipment,
        status
      });
      console.log(`Discord notification sent for shipment ${shipment.id}`);
    } catch (error) {
      console.error(`Failed to send Discord notification: ${error.message}`);
    }
  }
}

async function checkAllActiveShipments() {
  const activeShipments = db.getActiveShipments();
  console.log(`Checking ${activeShipments.length} active shipments`);

  const results = [];
  for (const shipment of activeShipments) {
    try {
      const result = await checkShipment(shipment.id);
      results.push(result);
    } catch (error) {
      console.error(`Error checking shipment ${shipment.id}: ${error.message}`);
      results.push({
        shipmentId: shipment.id,
        error: error.message
      });
    }
  }

  return results;
}

module.exports = {
  checkShipment,
  checkAllActiveShipments
};

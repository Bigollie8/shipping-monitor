const express = require('express');
const router = express.Router();
const db = require('../db');
const { detectCarrier, extractTrackingNumber } = require('../services/carriers/detector');

router.get('/', (req, res) => {
  try {
    const shipments = db.getShipments();
    res.json(shipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const shipment = db.getShipmentById(parseInt(req.params.id));
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    const history = db.getShipmentHistory(shipment.id);
    res.json({ ...shipment, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { tracking_url, friendly_name, notify_email, notify_discord } = req.body;

    if (!tracking_url) {
      return res.status(400).json({ error: 'tracking_url is required' });
    }

    const carrier = detectCarrier(tracking_url);
    const tracking_number = extractTrackingNumber(tracking_url, carrier);

    const id = db.createShipment({
      tracking_url,
      carrier,
      tracking_number,
      friendly_name: friendly_name || `Package ${Date.now()}`,
      current_status: 'Pending first check',
      notify_email: notify_email || false,
      notify_discord: notify_discord || false
    });

    const shipment = db.getShipmentById(id);
    res.status(201).json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const shipment = db.getShipmentById(id);

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const updated = db.updateShipment(id, req.body);
    if (updated) {
      res.json(db.getShipmentById(id));
    } else {
      res.status(400).json({ error: 'No valid fields to update' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = db.deleteShipment(id);

    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Shipment not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

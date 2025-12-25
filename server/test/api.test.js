const request = require('supertest');
const express = require('express');
const nock = require('nock');

// Create a testable Express app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Mock database
  const shipments = new Map();
  let nextId = 1;

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'shipping-monitor' });
  });

  // Get all shipments
  app.get('/api/shipments', (req, res) => {
    const allShipments = Array.from(shipments.values());
    // Sort: active first, then by last status change
    allShipments.sort((a, b) => {
      if (a.is_delivered !== b.is_delivered) {
        return a.is_delivered ? 1 : -1;
      }
      return new Date(b.last_status_change_at) - new Date(a.last_status_change_at);
    });
    res.json(allShipments);
  });

  // Get single shipment
  app.get('/api/shipments/:id', (req, res) => {
    const shipment = shipments.get(parseInt(req.params.id));
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    res.json(shipment);
  });

  // Create shipment
  app.post('/api/shipments', (req, res) => {
    const { tracking_url, friendly_name } = req.body;

    if (!tracking_url) {
      return res.status(400).json({ error: 'tracking_url is required' });
    }

    // Detect carrier from URL
    let carrier = 'unknown';
    if (tracking_url.includes('ups.com')) carrier = 'ups';
    else if (tracking_url.includes('fedex.com')) carrier = 'fedex';
    else if (tracking_url.includes('usps.com')) carrier = 'usps';
    else if (tracking_url.includes('dhl.com')) carrier = 'dhl';
    else if (tracking_url.includes('amazon.com')) carrier = 'amazon';

    const id = nextId++;
    const shipment = {
      id,
      tracking_url,
      carrier,
      friendly_name: friendly_name || null,
      current_status: 'pending',
      is_delivered: false,
      last_checked_at: null,
      last_status_change_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notify_email: true,
      notify_discord: true,
    };

    shipments.set(id, shipment);
    res.status(201).json(shipment);
  });

  // Update shipment
  app.put('/api/shipments/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const shipment = shipments.get(id);

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const { friendly_name, notify_email, notify_discord } = req.body;

    if (friendly_name !== undefined) shipment.friendly_name = friendly_name;
    if (notify_email !== undefined) shipment.notify_email = notify_email;
    if (notify_discord !== undefined) shipment.notify_discord = notify_discord;

    shipments.set(id, shipment);
    res.json(shipment);
  });

  // Delete shipment
  app.delete('/api/shipments/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (!shipments.has(id)) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    shipments.delete(id);
    res.status(204).send();
  });

  // Force check shipment
  app.post('/api/track/check/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const shipment = shipments.get(id);

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Simulate tracking check
    shipment.last_checked_at = new Date().toISOString();
    shipments.set(id, shipment);

    res.json({
      success: true,
      shipment,
      status: 'in_transit',
      events: []
    });
  });

  // Settings endpoints
  app.get('/api/settings', (req, res) => {
    res.json({
      poll_interval: 30,
      smtp_host: null,
      smtp_user: null,
      discord_webhook: null,
      notification_email: null,
    });
  });

  app.put('/api/settings', (req, res) => {
    res.json(req.body);
  });

  app.get('/api/settings/scheduler', (req, res) => {
    res.json({
      running: true,
      interval: 30,
      next_check: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  });

  return app;
}

describe('Shipping Monitor API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('shipping-monitor');
    });
  });

  describe('Shipment CRUD', () => {
    describe('POST /api/shipments', () => {
      it('should create a new shipment', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.ups.com/track?tracknum=1Z999' });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.tracking_url).toBe('https://www.ups.com/track?tracknum=1Z999');
        expect(response.body.carrier).toBe('ups');
      });

      it('should detect FedEx carrier', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.fedex.com/tracking/123456' });

        expect(response.body.carrier).toBe('fedex');
      });

      it('should detect USPS carrier', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://tools.usps.com/tracking/123' });

        expect(response.body.carrier).toBe('usps');
      });

      it('should detect DHL carrier', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.dhl.com/en/express/tracking.html?AWB=123' });

        expect(response.body.carrier).toBe('dhl');
      });

      it('should detect Amazon carrier', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.amazon.com/gp/your-account/order-details' });

        expect(response.body.carrier).toBe('amazon');
      });

      it('should set unknown carrier for unrecognized URLs', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://some-random-carrier.com/track' });

        expect(response.body.carrier).toBe('unknown');
      });

      it('should accept friendly name', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({
            tracking_url: 'https://www.ups.com/track?tracknum=1Z999',
            friendly_name: 'My Package'
          });

        expect(response.body.friendly_name).toBe('My Package');
      });

      it('should require tracking_url', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('tracking_url');
      });

      it('should initialize with default values', async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.ups.com/track' });

        expect(response.body.current_status).toBe('pending');
        expect(response.body.is_delivered).toBe(false);
        expect(response.body.notify_email).toBe(true);
        expect(response.body.notify_discord).toBe(true);
      });
    });

    describe('GET /api/shipments', () => {
      beforeEach(async () => {
        // Create test shipments
        await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.ups.com/track/1' });
        await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.fedex.com/track/2' });
      });

      it('should return all shipments', async () => {
        const response = await request(app).get('/api/shipments');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);
      });
    });

    describe('GET /api/shipments/:id', () => {
      let shipmentId;

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.ups.com/track' });
        shipmentId = response.body.id;
      });

      it('should return a single shipment', async () => {
        const response = await request(app).get(`/api/shipments/${shipmentId}`);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(shipmentId);
      });

      it('should return 404 for non-existent shipment', async () => {
        const response = await request(app).get('/api/shipments/9999');

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/shipments/:id', () => {
      let shipmentId;

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.ups.com/track' });
        shipmentId = response.body.id;
      });

      it('should update friendly name', async () => {
        const response = await request(app)
          .put(`/api/shipments/${shipmentId}`)
          .send({ friendly_name: 'Updated Name' });

        expect(response.status).toBe(200);
        expect(response.body.friendly_name).toBe('Updated Name');
      });

      it('should update notification settings', async () => {
        const response = await request(app)
          .put(`/api/shipments/${shipmentId}`)
          .send({ notify_email: false, notify_discord: false });

        expect(response.body.notify_email).toBe(false);
        expect(response.body.notify_discord).toBe(false);
      });

      it('should return 404 for non-existent shipment', async () => {
        const response = await request(app)
          .put('/api/shipments/9999')
          .send({ friendly_name: 'Test' });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /api/shipments/:id', () => {
      let shipmentId;

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.ups.com/track' });
        shipmentId = response.body.id;
      });

      it('should delete a shipment', async () => {
        const response = await request(app).delete(`/api/shipments/${shipmentId}`);

        expect(response.status).toBe(204);

        // Verify deletion
        const getResponse = await request(app).get(`/api/shipments/${shipmentId}`);
        expect(getResponse.status).toBe(404);
      });

      it('should return 404 for non-existent shipment', async () => {
        const response = await request(app).delete('/api/shipments/9999');

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Tracking', () => {
    describe('POST /api/track/check/:id', () => {
      let shipmentId;

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/shipments')
          .send({ tracking_url: 'https://www.ups.com/track' });
        shipmentId = response.body.id;
      });

      it('should trigger tracking check', async () => {
        const response = await request(app)
          .post(`/api/track/check/${shipmentId}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('shipment');
      });

      it('should update last_checked_at', async () => {
        await request(app).post(`/api/track/check/${shipmentId}`);

        const response = await request(app).get(`/api/shipments/${shipmentId}`);
        expect(response.body.last_checked_at).not.toBeNull();
      });

      it('should return 404 for non-existent shipment', async () => {
        const response = await request(app).post('/api/track/check/9999');

        expect(response.status).toBe(404);
      });
    });
  });

  describe('Settings', () => {
    describe('GET /api/settings', () => {
      it('should return settings', async () => {
        const response = await request(app).get('/api/settings');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('poll_interval');
      });
    });

    describe('PUT /api/settings', () => {
      it('should update settings', async () => {
        const response = await request(app)
          .put('/api/settings')
          .send({ poll_interval: 60 });

        expect(response.status).toBe(200);
        expect(response.body.poll_interval).toBe(60);
      });
    });

    describe('GET /api/settings/scheduler', () => {
      it('should return scheduler status', async () => {
        const response = await request(app).get('/api/settings/scheduler');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('running');
        expect(response.body).toHaveProperty('interval');
        expect(response.body).toHaveProperty('next_check');
      });
    });
  });
});

describe('Carrier Detection', () => {
  function detectCarrier(url) {
    if (url.includes('ups.com')) return 'ups';
    if (url.includes('fedex.com')) return 'fedex';
    if (url.includes('usps.com')) return 'usps';
    if (url.includes('dhl.com')) return 'dhl';
    if (url.includes('amazon.com')) return 'amazon';
    if (url.includes('ontrac.com')) return 'ontrac';
    if (url.includes('lasership.com')) return 'lasership';
    return 'unknown';
  }

  const testCases = [
    { url: 'https://www.ups.com/track?trackNums=1Z999AA10123456784', expected: 'ups' },
    { url: 'https://www.fedex.com/apps/fedextrack/?tracknumbers=123456789012', expected: 'fedex' },
    { url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223033005887', expected: 'usps' },
    { url: 'https://www.dhl.com/en/express/tracking.html?AWB=1234567890', expected: 'dhl' },
    { url: 'https://www.amazon.com/gp/your-account/order-history', expected: 'amazon' },
    { url: 'https://www.ontrac.com/trackingresults.asp?tracking_number=D10010942653048', expected: 'ontrac' },
    { url: 'https://www.lasership.com/track/1LS123456789', expected: 'lasership' },
    { url: 'https://some-unknown-carrier.com/track/123', expected: 'unknown' },
  ];

  testCases.forEach(({ url, expected }) => {
    it(`should detect ${expected} from URL`, () => {
      expect(detectCarrier(url)).toBe(expected);
    });
  });
});

describe('Status Normalization', () => {
  function normalizeStatus(status) {
    const statusLower = status.toLowerCase();

    if (statusLower.includes('delivered')) return 'delivered';
    if (statusLower.includes('out for delivery')) return 'out_for_delivery';
    if (statusLower.includes('in transit')) return 'in_transit';
    if (statusLower.includes('shipped')) return 'shipped';
    if (statusLower.includes('label created') || statusLower.includes('label printed')) return 'label_created';
    if (statusLower.includes('exception') || statusLower.includes('delay')) return 'exception';
    if (statusLower.includes('pending')) return 'pending';

    return 'unknown';
  }

  const testCases = [
    { input: 'Delivered', expected: 'delivered' },
    { input: 'DELIVERED - Front Door', expected: 'delivered' },
    { input: 'Out for Delivery', expected: 'out_for_delivery' },
    { input: 'OUT FOR DELIVERY TODAY', expected: 'out_for_delivery' },
    { input: 'In Transit', expected: 'in_transit' },
    { input: 'Package in transit to destination', expected: 'in_transit' },
    { input: 'Shipped', expected: 'shipped' },
    { input: 'Label Created', expected: 'label_created' },
    { input: 'Shipping Label Printed', expected: 'label_created' },
    { input: 'Delivery Exception', expected: 'exception' },
    { input: 'Weather Delay', expected: 'exception' },
    { input: 'Pending', expected: 'pending' },
    { input: 'Some random status', expected: 'unknown' },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`should normalize "${input}" to "${expected}"`, () => {
      expect(normalizeStatus(input)).toBe(expected);
    });
  });
});

describe('Rate Limiter Logic', () => {
  function calculateBackoff(failures) {
    const baseDelay = 30000; // 30 seconds
    const maxDelay = 4 * 60 * 60 * 1000; // 4 hours
    const delay = baseDelay * Math.pow(2, failures);
    return Math.min(delay, maxDelay);
  }

  it('should return base delay for 0 failures', () => {
    expect(calculateBackoff(0)).toBe(30000);
  });

  it('should double delay for each failure', () => {
    expect(calculateBackoff(1)).toBe(60000);
    expect(calculateBackoff(2)).toBe(120000);
    expect(calculateBackoff(3)).toBe(240000);
  });

  it('should cap at max delay', () => {
    const maxDelay = 4 * 60 * 60 * 1000;
    expect(calculateBackoff(10)).toBe(maxDelay);
    expect(calculateBackoff(20)).toBe(maxDelay);
  });
});
